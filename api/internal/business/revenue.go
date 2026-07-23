// api/internal/business/revenue.go
package business

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// RevenueMetrics holds revenue and subscription analytics.
type RevenueMetrics struct {
	TotalRevenue   float64            `json:"total_revenue"`
	MRR            float64            `json:"mrr"`
	ARPU           float64            `json:"arpu"`  // average revenue per user
	ARPPU          float64            `json:"arppu"` // average revenue per paying user
	PayingUsers    int                `json:"paying_users"`
	FreeUsers      int                `json:"free_users"`
	ConversionRate float64            `json:"conversion_rate"` // free -> pro %
	UpgradeCount   int                `json:"upgrade_count"`
	DowngradeCount int                `json:"downgrade_count"`
	ChurnCount     int                `json:"churn_count"`
	RevenueByPlan  map[string]float64 `json:"revenue_by_plan"`
}

// RevenueService computes revenue analytics.
type RevenueService struct {
	pool *pgxpool.Pool
}

// NewRevenueService creates a revenue analytics service.
func NewRevenueService(pool *pgxpool.Pool) *RevenueService {
	return &RevenueService{pool: pool}
}

// Pro plan price (should come from config, hardcoded here as default)
const proPlanPrice = 12.0 // USD/month

// GetMetrics computes current revenue metrics.
func (s *RevenueService) GetMetrics(ctx context.Context) (*RevenueMetrics, error) {
	m := &RevenueMetrics{
		RevenueByPlan: make(map[string]float64),
	}

	// User counts by plan
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE plan = 'pro' OR plan = 'max'`,
	).Scan(&m.PayingUsers); err != nil {
		log.Warn().Err(err).Msg("revenue: failed to count paying users")
	}

	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE plan = 'free'`,
	).Scan(&m.FreeUsers); err != nil {
		log.Warn().Err(err).Msg("revenue: failed to count free users")
	}

	// MRR from paying users
	m.MRR = float64(m.PayingUsers) * proPlanPrice
	m.TotalRevenue = m.MRR // simplified: in production, sum from billing_events

	// ARPU
	totalUsers := m.PayingUsers + m.FreeUsers
	if totalUsers > 0 {
		m.ARPU = m.MRR / float64(totalUsers)
	}
	if m.PayingUsers > 0 {
		m.ARPPU = m.MRR / float64(m.PayingUsers)
	}

	// Conversion rate
	if totalUsers > 0 {
		m.ConversionRate = float64(m.PayingUsers) / float64(totalUsers) * 100
	}

	// Upgrade/downgrade events this month
	monthStart := time.Now().UTC().Format("2006-01-01")
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'checkout_completed' AND created_at >= $1`, monthStart,
	).Scan(&m.UpgradeCount); err != nil {
		log.Warn().Err(err).Msg("revenue: failed to count upgrade events")
	}

	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'downgrade' AND created_at >= $1`, monthStart,
	).Scan(&m.DowngradeCount); err != nil {
		log.Warn().Err(err).Msg("revenue: failed to count downgrade events")
	}

	// Revenue by plan
	m.RevenueByPlan["free"] = 0
	m.RevenueByPlan["pro"] = float64(m.PayingUsers) * proPlanPrice

	return m, nil
}

// ConversionFunnel tracks the free-to-pro upgrade funnel.
type ConversionFunnel struct {
	Period             string  `json:"period"`
	FreeUsers          int     `json:"free_users"`
	PromptsShown       int     `json:"prompts_shown"`
	PromptsClicked     int     `json:"prompts_clicked"`
	CheckoutsStarted   int     `json:"checkouts_started"`
	CheckoutsCompleted int     `json:"checkouts_completed"`
	ClickRate          float64 `json:"click_rate"`
	CheckoutRate       float64 `json:"checkout_rate"`
	ConversionRate     float64 `json:"conversion_rate"`
}

// GetConversionFunnel returns the upgrade funnel for a time period.
func (s *RevenueService) GetConversionFunnel(ctx context.Context, startDate, endDate string) (*ConversionFunnel, error) {
	f := &ConversionFunnel{}

	// Free users at period start
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE plan = 'free' AND created_at < $1`, endDate,
	).Scan(&f.FreeUsers)

	// Funnel events
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'prompt_shown' AND created_at >= $1 AND created_at <= $2`,
		startDate, endDate,
	).Scan(&f.PromptsShown)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'prompt_clicked' AND created_at >= $1 AND created_at <= $2`,
		startDate, endDate,
	).Scan(&f.PromptsClicked)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'checkout_started' AND created_at >= $1 AND created_at <= $2`,
		startDate, endDate,
	).Scan(&f.CheckoutsStarted)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'checkout_completed' AND created_at >= $1 AND created_at <= $2`,
		startDate, endDate,
	).Scan(&f.CheckoutsCompleted)

	// Rates
	if f.PromptsShown > 0 {
		f.ClickRate = float64(f.PromptsClicked) / float64(f.PromptsShown) * 100
	}
	if f.PromptsClicked > 0 {
		f.CheckoutRate = float64(f.CheckoutsStarted) / float64(f.PromptsClicked) * 100
	}
	if f.CheckoutsStarted > 0 {
		f.ConversionRate = float64(f.CheckoutsCompleted) / float64(f.CheckoutsStarted) * 100
	}

	f.Period = startDate + " to " + endDate
	return f, nil
}

// UpgradeTriggerBreakdown returns which features trigger upgrade prompts most.
func (s *RevenueService) UpgradeTriggerBreakdown(ctx context.Context, startDate, endDate string) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT trigger_feature, trigger_reason, COUNT(*) AS count
		 FROM upgrade_events
		 WHERE event_type = 'prompt_shown' AND created_at >= $1 AND created_at <= $2
		 GROUP BY trigger_feature, trigger_reason
		 ORDER BY count DESC`,
		startDate, endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var feature, reason string
		var count int
		if err := rows.Scan(&feature, &reason, &count); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"feature": feature,
			"reason":  reason,
			"count":   count,
		})
	}
	return result, rows.Err()
}
