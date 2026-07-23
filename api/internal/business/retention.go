// api/internal/business/retention.go
package business

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CohortRow is one row in a retention cohort table.
type CohortRow struct {
	CohortWeek  string    `json:"cohort_week"`  // week starting date
	UserCount   int       `json:"user_count"`   // users in cohort
	Retention   []float64 `json:"retention"`     // % retained at week 0,1,2,...
}

// RetentionService computes retention cohorts and churn analysis.
type RetentionService struct {
	pool *pgxpool.Pool
}

// NewRetentionService creates a retention analytics service.
func NewRetentionService(pool *pgxpool.Pool) *RetentionService {
	return &RetentionService{pool: pool}
}

// GetRetentionCohorts returns weekly retention cohorts for the last N weeks.
func (s *RetentionService) GetRetentionCohorts(ctx context.Context, weeks int) ([]CohortRow, error) {
	rows, err := s.pool.Query(ctx,
		`WITH cohorts AS (
			SELECT user_id, date_trunc('week', MIN(activity_date))::date AS cohort_week
			FROM user_activity
			WHERE activity_date >= CURRENT_DATE - ($1::int * 7 + 14)::int
			GROUP BY user_id
		),
		activity_weeks AS (
			SELECT
				c.cohort_week,
				c.user_id,
				date_trunc('week', ua.activity_date)::date AS activity_week
			FROM cohorts c
			JOIN user_activity ua ON ua.user_id = c.user_id
		),
		week_offsets AS (
			SELECT
				cohort_week,
				user_id,
				(activity_week - cohort_week) / 7 AS week_offset
			FROM activity_weeks
		)
		SELECT
			cohort_week,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 0) AS cohort_size,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 0) AS w0,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 1) AS w1,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 2) AS w2,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 3) AS w3,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 4) AS w4,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 5) AS w5,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 6) AS w6,
			COUNT(DISTINCT user_id) FILTER (WHERE week_offset = 7) AS w7
		FROM week_offsets
		WHERE cohort_week >= CURRENT_DATE - ($1::int * 7 + 14)::int
		GROUP BY cohort_week
		ORDER BY cohort_week ASC
		LIMIT $1`, weeks,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cohorts []CohortRow
	for rows.Next() {
		var cohortWeek time.Time
		var cohortSize int
		var w [8]int
		if err := rows.Scan(&cohortWeek, &cohortSize, &w[0], &w[1], &w[2], &w[3], &w[4], &w[5], &w[6], &w[7]); err != nil {
			return nil, err
		}
		retention := make([]float64, 8)
		for i := 0; i < 8; i++ {
			if cohortSize > 0 {
				retention[i] = float64(w[i]) / float64(cohortSize) * 100
			}
		}
		cohorts = append(cohorts, CohortRow{
			CohortWeek: cohortWeek.Format("2006-01-02"),
			UserCount:  cohortSize,
			Retention:  retention,
		})
	}
	return cohorts, rows.Err()
}

// ChurnMetrics holds churn analytics.
type ChurnMetrics struct {
	ChurnRate30Day  float64            `json:"churn_rate_30_day"`
	ChurnRate7Day   float64            `json:"churn_rate_7_day"`
	AtRiskUsers     int                `json:"at_risk_users"`
	ChurnedByPlan   map[string]int     `json:"churned_by_plan"`
	ChurnReasons    []ChurnReason      `json:"churn_reasons"`
}

// ChurnReason is a categorized churn cause.
type ChurnReason struct {
	Reason string  `json:"reason"`
	Count  int     `json:"count"`
	Rate   float64 `json:"rate"`
}

// GetChurnMetrics computes churn analytics.
func (s *RetentionService) GetChurnMetrics(ctx context.Context) (*ChurnMetrics, error) {
	m := &ChurnMetrics{
		ChurnedByPlan: make(map[string]int),
	}
	now := time.Now().UTC()
	daysAgo30 := now.AddDate(0, 0, -30).Format("2006-01-02")
	daysAgo7 := now.AddDate(0, 0, -7).Format("2006-01-02")

	// Total users 30 days ago (cohort)
	var cohort30, churned30 int
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at <= $1`, daysAgo30,
	).Scan(&cohort30)

	// Users who were active 30 days ago but not in last 7 days = churned
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT ua.user_id)
		 FROM user_activity ua
		 WHERE ua.activity_date >= $1 AND ua.activity_date <= $2
		 AND NOT EXISTS (
			SELECT 1 FROM user_activity ua2
			WHERE ua2.user_id = ua.user_id AND ua2.activity_date >= $3
		 )`, daysAgo30, daysAgo7, daysAgo7,
	).Scan(&churned30)

	if cohort30 > 0 {
		m.ChurnRate30Day = float64(churned30) / float64(cohort30) * 100
	}

	// 7-day churn
	var cohort7, churned7 int
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at <= $1`, daysAgo7,
	).Scan(&cohort7)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT ua.user_id)
		 FROM user_activity ua
		 WHERE ua.activity_date >= $1 AND ua.activity_date <= CURRENT_DATE
		 AND NOT EXISTS (
			SELECT 1 FROM user_activity ua2
			WHERE ua2.user_id = ua.user_id AND ua2.activity_date >= CURRENT_DATE - 3
		 )`, daysAgo7,
	).Scan(&churned7)

	if cohort7 > 0 {
		m.ChurnRate7Day = float64(churned7) / float64(cohort7) * 100
	}

	// Users at risk: active in last 14 days but declining
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT ua1.user_id)
		 FROM user_activity ua1
		 JOIN user_activity ua2 ON ua1.user_id = ua2.user_id
		 WHERE ua1.activity_date = CURRENT_DATE - 14
		 AND ua2.activity_date = CURRENT_DATE - 3
		 AND ua1.total_events > ua2.total_events * 2`,
	).Scan(&m.AtRiskUsers)

	// Downgrades by plan
	rows, err := s.pool.Query(ctx,
		`SELECT from_plan, COUNT(*) AS cnt
		 FROM upgrade_events
		 WHERE event_type = 'downgrade' AND created_at >= $1
		 GROUP BY from_plan`, daysAgo30,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var plan string
			var count int
			if err := rows.Scan(&plan, &count); err == nil {
				m.ChurnedByPlan[plan] = count
			}
		}
	}

	return m, nil
}

// FeatureAdoption tracks feature adoption rates.
type FeatureAdoption struct {
	Feature         string  `json:"feature"`
	TotalUsers      int     `json:"total_users"`
	AdoptedUsers    int     `json:"adopted_users"`
	AdoptionRate    float64 `json:"adoption_rate"`
	WeeklyGrowth    float64 `json:"weekly_growth"`
}

// GetFeatureAdoption returns adoption rates for all features.
func (s *RetentionService) GetFeatureAdoption(ctx context.Context) ([]FeatureAdoption, error) {
	features := []string{"classify", "forecast", "ai_chat", "recommendations", "upload"}
	var result []FeatureAdoption

	for _, f := range features {
		fa := FeatureAdoption{Feature: f}

		_ = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&fa.TotalUsers)

		_ = s.pool.QueryRow(ctx,
			`SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = $1`,
			f,
		).Scan(&fa.AdoptedUsers)

		if fa.TotalUsers > 0 {
			fa.AdoptionRate = float64(fa.AdoptedUsers) / float64(fa.TotalUsers) * 100
		}

		// Weekly growth: compare this week's adopters to last week's
		var thisWeek, lastWeek int
		_ = s.pool.QueryRow(ctx,
			`SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = $1 AND created_at >= CURRENT_DATE - 7`,
			f,
		).Scan(&thisWeek)

		_ = s.pool.QueryRow(ctx,
			`SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = $1 AND created_at >= CURRENT_DATE - 14 AND created_at < CURRENT_DATE - 7`,
			f,
		).Scan(&lastWeek)

		if lastWeek > 0 {
			fa.WeeklyGrowth = float64(thisWeek-lastWeek) / float64(lastWeek) * 100
		}

		result = append(result, fa)
	}

	return result, nil
}
