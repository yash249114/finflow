// api/internal/analytics/events.go
package analytics

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// EventType enumerates the kinds of feature events we track.
type EventType string

const (
	EventUsage       EventType = "usage"
	EventAccuracy    EventType = "accuracy"
	EventCost        EventType = "cost"
	EventError       EventType = "error"
	EventSatisfaction EventType = "satisfaction"
	EventLimitHit    EventType = "limit_hit"
)

// FeatureEvent is a single observability signal for an AI feature.
type FeatureEvent struct {
	ID        string          `json:"id"`
	UserID    string          `json:"user_id"`
	Feature   string          `json:"feature"`    // classify | forecast | ai_chat | recommendations | upload
	EventType EventType       `json:"event_type"`
	Value     float64         `json:"value"`      // latency_ms, cost_usd, accuracy_score, rating
	Metadata  json.RawMessage `json:"metadata"`
	CreatedAt time.Time       `json:"created_at"`
}

// EventStore persists and queries feature events.
type EventStore struct {
	pool *pgxpool.Pool
	rdb  *redis.Client
}

// NewEventStore creates an analytics event store.
func NewEventStore(pool *pgxpool.Pool, rdb *redis.Client) *EventStore {
	return &EventStore{pool: pool, rdb: rdb}
}

// Track records a feature event. Best-effort: failures are non-fatal.
func (s *EventStore) Track(ctx context.Context, e FeatureEvent) {
	if e.ID == "" {
		e.ID = time.Now().UTC().Format("20060102150405.000000000")
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, err := s.pool.Exec(ctx,
			`INSERT INTO feature_events (id, user_id, feature, event_type, value, metadata, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			e.ID, e.UserID, e.Feature, string(e.EventType), e.Value, e.Metadata, e.CreatedAt,
		)
		if err != nil {
			_ = err // non-fatal; telemetry is best-effort
		}

		// Also push to Redis stream for real-time dashboards
		if s.rdb != nil {
			payload, _ := json.Marshal(e)
			s.rdb.XAdd(ctx, &redis.XAddArgs{
				Stream: "finflow:feature_events",
				Values: map[string]interface{}{"event": string(payload)},
			})
		}
	}()
}

// FeatureUsageSummary is aggregated usage for a feature.
type FeatureUsageSummary struct {
	Feature      string  `json:"feature"`
	TotalEvents  int     `json:"total_events"`
	UniqueUsers  int     `json:"unique_users"`
	TotalValue   float64 `json:"total_value"`
	AvgValue     float64 `json:"avg_value"`
	ErrorCount   int     `json:"error_count"`
	ErrorRate    float64 `json:"error_rate"`
}

// GetFeatureUsage returns aggregated usage for a feature in a time range.
func (s *EventStore) GetFeatureUsage(ctx context.Context, feature, startDate, endDate string) (*FeatureUsageSummary, error) {
	summary := &FeatureUsageSummary{Feature: feature}

	err := s.pool.QueryRow(ctx,
		`SELECT
			COUNT(*),
			COALESCE(COUNT(DISTINCT user_id), 0),
			COALESCE(SUM(value), 0),
			COALESCE(AVG(value), 0),
			COALESCE(SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END), 0)
		 FROM feature_events
		 WHERE feature = $1 AND created_at >= $2 AND created_at <= $3`,
		feature, startDate, endDate,
	).Scan(&summary.TotalEvents, &summary.UniqueUsers, &summary.TotalValue,
		&summary.AvgValue, &summary.ErrorCount)
	if err != nil {
		return nil, err
	}

	if summary.TotalEvents > 0 {
		summary.ErrorRate = float64(summary.ErrorCount) / float64(summary.TotalEvents)
	}

	return summary, nil
}

// GetFeatureUsageByDay returns daily usage counts for a feature.
func (s *EventStore) GetFeatureUsageByDay(ctx context.Context, feature, startDate, endDate string) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT
			date_trunc('day', created_at)::date AS day,
			COUNT(*) AS events,
			COUNT(DISTINCT user_id) AS users,
			COALESCE(SUM(value), 0) AS total_value
		 FROM feature_events
		 WHERE feature = $1 AND created_at >= $2 AND created_at <= $3
		 GROUP BY day
		 ORDER BY day ASC`,
		feature, startDate, endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var day time.Time
		var events, users int
		var totalValue float64
		if err := rows.Scan(&day, &events, &users, &totalValue); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"day":         day.Format("2006-01-02"),
			"events":      events,
			"users":       users,
			"total_value": totalValue,
		})
	}
	return result, rows.Err()
}

// GetUserFeatureUsage returns per-user feature usage for a time range.
func (s *EventStore) GetUserFeatureUsage(ctx context.Context, userID, startDate, endDate string) (map[string]*FeatureUsageSummary, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT
			feature,
			COUNT(*) AS events,
			COALESCE(SUM(value), 0) AS total_value,
			COALESCE(AVG(value), 0) AS avg_value,
			COALESCE(SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END), 0) AS errors
		 FROM feature_events
		 WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
		 GROUP BY feature
		 ORDER BY events DESC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]*FeatureUsageSummary)
	for rows.Next() {
		s := &FeatureUsageSummary{}
		if err := rows.Scan(&s.Feature, &s.TotalEvents, &s.TotalValue, &s.AvgValue, &s.ErrorCount); err != nil {
			return nil, err
		}
		result[s.Feature] = s
	}
	return result, rows.Err()
}

// TrackActivity records daily user activity for retention analysis.
func (s *EventStore) TrackActivity(ctx context.Context, userID, plan string, features []string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		today := time.Now().UTC().Format("2006-01-02")
		_, err := s.pool.Exec(ctx,
			`INSERT INTO user_activity (user_id, activity_date, features_used, total_events, plan)
			 VALUES ($1, $2, $3, 1, $4)
			 ON CONFLICT (user_id, activity_date)
			 DO UPDATE SET
				features_used = array_cat(user_activity.features_used, EXCLUDED.features_used),
				total_events = user_activity.total_events + 1,
				plan = EXCLUDED.plan`,
			userID, today, features, plan,
		)
		if err != nil {
			_ = err
		}
	}()
}
