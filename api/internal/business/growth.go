// api/internal/business/growth.go
package business

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// GrowthMetrics holds growth analytics for the platform.
type GrowthMetrics struct {
	TotalUsers       int     `json:"total_users"`
	ActiveUsersDay   int     `json:"active_users_day"`
	ActiveUsersWeek  int     `json:"active_users_week"`
	ActiveUsersMonth int     `json:"active_users_month"`
	NewUsersToday    int     `json:"new_users_today"`
	NewUsersWeek     int     `json:"new_users_week"`
	NewUsersMonth    int     `json:"new_users_month"`
	StickinessRatio  float64 `json:"stickiness_ratio"` // DAU/MAU
	GrowthRateDaily  float64 `json:"growth_rate_daily"`
	GrowthRateWeekly float64 `json:"growth_rate_weekly"`
}

// GrowthService computes growth analytics.
type GrowthService struct {
	pool *pgxpool.Pool
}

// NewGrowthService creates a growth analytics service.
func NewGrowthService(pool *pgxpool.Pool) *GrowthService {
	return &GrowthService{pool: pool}
}

// GetMetrics computes current growth metrics.
func (s *GrowthService) GetMetrics(ctx context.Context) (*GrowthMetrics, error) {
	m := &GrowthMetrics{}
	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	weekAgo := now.AddDate(0, 0, -7).Format("2006-01-02")
	monthAgo := now.AddDate(0, -1, 0).Format("2006-01-02")
	twoWeeksAgo := now.AddDate(0, 0, -14).Format("2006-01-02")
	twoMonthsAgo := now.AddDate(0, -2, 0).Format("2006-01-02")

	// Total users
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&m.TotalUsers)

	// Active users by period
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date = $1`, today,
	).Scan(&m.ActiveUsersDay)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= $1`, weekAgo,
	).Scan(&m.ActiveUsersWeek)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= $1`, monthAgo,
	).Scan(&m.ActiveUsersMonth)

	// New users
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at::date = $1`, today,
	).Scan(&m.NewUsersToday)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at >= $1`, weekAgo,
	).Scan(&m.NewUsersWeek)

	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at >= $1`, monthAgo,
	).Scan(&m.NewUsersMonth)

	// Stickiness ratio (DAU/MAU)
	if m.ActiveUsersMonth > 0 {
		m.StickinessRatio = float64(m.ActiveUsersDay) / float64(m.ActiveUsersMonth)
	}

	// Growth rates (compare current period to previous)
	var prevWeekNew, prevMonthNew int
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2`, twoWeeksAgo, weekAgo,
	).Scan(&prevWeekNew)
	_ = s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2`, twoMonthsAgo, monthAgo,
	).Scan(&prevMonthNew)

	if prevWeekNew > 0 {
		m.GrowthRateWeekly = float64(m.NewUsersWeek-prevWeekNew) / float64(prevWeekNew) * 100
	}
	if prevMonthNew > 0 {
		m.GrowthRateDaily = float64(m.NewUsersMonth-prevMonthNew) / float64(prevMonthNew) * 100
	}

	return m, nil
}

// DAUDaily returns daily active users for the last N days.
func (s *GrowthService) DAUDaily(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT activity_date, COUNT(DISTINCT user_id) AS dau
		 FROM user_activity
		 WHERE activity_date >= (CURRENT_DATE - $1::int)
		 GROUP BY activity_date
		 ORDER BY activity_date ASC`, days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var dau int
		if err := rows.Scan(&date, &dau); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"date": date.Format("2006-01-02"),
			"dau":  dau,
		})
	}
	return result, rows.Err()
}
