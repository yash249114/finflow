// api/internal/costing/tracker.go
package costing

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// CostRecord is a single cost event for an API/LLM call.
type CostRecord struct {
	ID           string  `json:"id"`
	UserID       string  `json:"user_id"`
	Service      string  `json:"service"`       // openai | anthropic | gemini | ml-local
	Operation    string  `json:"operation"`     // classify | forecast | chat | embeddings
	Model        string  `json:"model"`         // gpt-4o-mini | claude-3-5-haiku etc.
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	CostUSD      float64 `json:"cost_usd"`
	LatencyMs    float64 `json:"latency_ms"`
	Status       string  `json:"status"`
	Plan         string  `json:"plan"`
	CreatedAt    time.Time `json:"created_at"`
}

// CostTracker persists and queries cost events.
type CostTracker struct {
	pool      *pgxpool.Pool
	rdb       *redis.Client
	semaphore chan struct{}
}

// NewCostTracker creates a cost tracker.
func NewCostTracker(pool *pgxpool.Pool, rdb *redis.Client) *CostTracker {
	return &CostTracker{pool: pool, rdb: rdb, semaphore: make(chan struct{}, 25)}
}

// Record logs a cost event. Best-effort.
func (t *CostTracker) Record(ctx context.Context, r CostRecord) {
	if r.ID == "" {
		r.ID = time.Now().UTC().Format("20060102150405.000000000")
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}

	select {
	case t.semaphore <- struct{}{}:
	default:
		return // drop rather than spawn unbounded goroutines
	}
	go func() {
		defer func() { <-t.semaphore }()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, err := t.pool.Exec(ctx,
			`INSERT INTO cost_tracking (id, user_id, service, operation, model, input_tokens, output_tokens, cost_usd, latency_ms, status, plan, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			r.ID, r.UserID, r.Service, r.Operation, r.Model,
			r.InputTokens, r.OutputTokens, r.CostUSD, r.LatencyMs,
			r.Status, r.Plan, r.CreatedAt,
		)
		if err != nil {
			_ = err
		}

		// Push to Redis for real-time cost dashboards
		if t.rdb != nil {
			payload, _ := json.Marshal(r)
			t.rdb.XAdd(ctx, &redis.XAddArgs{
				Stream: "finflow:cost_events",
				Values: map[string]interface{}{"event": string(payload)},
			})
		}
	}()
}

// CostSummary holds aggregated cost data.
type CostSummary struct {
	TotalCostUSD  float64            `json:"total_cost_usd"`
	TodayCostUSD  float64            `json:"today_cost_usd"`
	MonthCostUSD  float64            `json:"month_cost_usd"`
	ByService     map[string]float64 `json:"by_service"`
	ByModel       map[string]float64 `json:"by_model"`
	ByPlan        map[string]float64 `json:"by_plan"`
	AvgLatencyMs  float64            `json:"avg_latency_ms"`
	TotalRequests int                `json:"total_requests"`
	ErrorRate     float64            `json:"error_rate"`
}

// GetSummary returns aggregated cost metrics.
func (t *CostTracker) GetSummary(ctx context.Context) (*CostSummary, error) {
	s := &CostSummary{
		ByService: make(map[string]float64),
		ByModel:   make(map[string]float64),
		ByPlan:    make(map[string]float64),
	}

	// Total and today
	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	monthStart := now.Format("2006-01-01")

	_ = t.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(cost_usd), 0) FROM cost_tracking`,
	).Scan(&s.TotalCostUSD)

	_ = t.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(cost_usd), 0) FROM cost_tracking WHERE created_at >= $1`, today,
	).Scan(&s.TodayCostUSD)

	_ = t.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(cost_usd), 0) FROM cost_tracking WHERE created_at >= $1`, monthStart,
	).Scan(&s.MonthCostUSD)

	_ = t.pool.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(AVG(latency_ms), 0) FROM cost_tracking`,
	).Scan(&s.TotalRequests, &s.AvgLatencyMs)

	var errCount int
	_ = t.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM cost_tracking WHERE status != 'ok'`,
	).Scan(&errCount)

	if s.TotalRequests > 0 {
		s.ErrorRate = float64(errCount) / float64(s.TotalRequests) * 100
	}

	// By service
	svcRows, err := t.pool.Query(ctx,
		`SELECT service, COALESCE(SUM(cost_usd), 0) FROM cost_tracking GROUP BY service`,
	)
	if err == nil {
		defer svcRows.Close()
		for svcRows.Next() {
			var svc string
			var cost float64
			if err := svcRows.Scan(&svc, &cost); err == nil {
				s.ByService[svc] = cost
			}
		}
	}

	// By model
	modelRows, err := t.pool.Query(ctx,
		`SELECT model, COALESCE(SUM(cost_usd), 0) FROM cost_tracking WHERE model != '' GROUP BY model ORDER BY SUM(cost_usd) DESC LIMIT 20`,
	)
	if err == nil {
		defer modelRows.Close()
		for modelRows.Next() {
			var model string
			var cost float64
			if err := modelRows.Scan(&model, &cost); err == nil {
				s.ByModel[model] = cost
			}
		}
	}

	// By plan
	planRows, err := t.pool.Query(ctx,
		`SELECT COALESCE(plan, 'free'), COALESCE(SUM(cost_usd), 0) FROM cost_tracking GROUP BY plan`,
	)
	if err == nil {
		defer planRows.Close()
		for planRows.Next() {
			var plan string
			var cost float64
			if err := planRows.Scan(&plan, &cost); err == nil {
				s.ByPlan[plan] = cost
			}
		}
	}

	return s, nil
}

// CostByDay returns daily cost breakdown.
func (t *CostTracker) CostByDay(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := t.pool.Query(ctx,
		`SELECT
			date_trunc('day', created_at)::date AS day,
			SUM(cost_usd) AS cost,
			COUNT(*) AS requests,
			AVG(latency_ms) AS avg_latency
		 FROM cost_tracking
		 WHERE created_at >= CURRENT_DATE - $1::int
		 GROUP BY day
		 ORDER BY day ASC`, days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var day time.Time
		var cost, avgLatency float64
		var requests int
		if err := rows.Scan(&day, &cost, &requests, &avgLatency); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"day":         day.Format("2006-01-02"),
			"cost_usd":    cost,
			"requests":    requests,
			"avg_latency": avgLatency,
		})
	}
	return result, rows.Err()
}

// TopCostUsers returns the users consuming the most cost.
func (t *CostTracker) TopCostUsers(ctx context.Context, limit int, days int) ([]map[string]interface{}, error) {
	rows, err := t.pool.Query(ctx,
		`SELECT
			user_id,
			SUM(cost_usd) AS total_cost,
			COUNT(*) AS requests,
			AVG(latency_ms) AS avg_latency
		 FROM cost_tracking
		 WHERE created_at >= CURRENT_DATE - $1::int AND user_id IS NOT NULL
		 GROUP BY user_id
		 ORDER BY total_cost DESC
		 LIMIT $2`, days, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var userID string
		var cost, avgLatency float64
		var requests int
		if err := rows.Scan(&userID, &cost, &requests, &avgLatency); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"user_id":     userID,
			"total_cost":  cost,
			"requests":    requests,
			"avg_latency": avgLatency,
		})
	}
	return result, rows.Err()
}
