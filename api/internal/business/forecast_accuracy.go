// api/internal/business/forecast_accuracy.go
package business

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ForecastAccuracyMetrics tracks forecast model accuracy over time.
type ForecastAccuracyMetrics struct {
	OverallMAE        float64               `json:"overall_mae"`
	OverallMAPE       float64               `json:"overall_mape"`
	OverallRMSE       float64               `json:"overall_rmse"`
	DirectionAccuracy float64               `json:"direction_accuracy"`
	TotalForecasts    int                   `json:"total_forecasts"`
	ByHorizon         map[int]HorizonAcc    `json:"by_horizon"`
	WeeklyTrend       []WeeklyAccuracyTrend `json:"weekly_trend"`
}

// HorizonAcc is accuracy metrics for a specific forecast horizon.
type HorizonAcc struct {
	MAE    float64 `json:"mae"`
	MAPE   float64 `json:"mape"`
	Count  int     `json:"count"`
}

// WeeklyAccuracyTrend tracks accuracy over time.
type WeeklyAccuracyTrend struct {
	Week   string  `json:"week"`
	MAE    float64 `json:"mae"`
	MAPE   float64 `json:"mape"`
	Count  int     `json:"count"`
}

// ForecastAccuracyService tracks forecast model accuracy.
type ForecastAccuracyService struct {
	pool *pgxpool.Pool
}

// NewForecastAccuracyService creates a forecast accuracy service.
func NewForecastAccuracyService(pool *pgxpool.Pool) *ForecastAccuracyService {
	return &ForecastAccuracyService{pool: pool}
}

// RecordAccuracy records a forecast accuracy measurement.
func (s *ForecastAccuracyService) RecordAccuracy(ctx context.Context, userID string, horizonDays int, mae, mape, rmse, directionAccuracy float64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO feature_events (user_id, feature, event_type, value, metadata, created_at)
		 VALUES ($1, 'forecast', 'accuracy', $2, $3, NOW())`,
		userID, mae,
		formatJSON(map[string]interface{}{
			"horizon_days":        horizonDays,
			"mae":                mae,
			"mape":               mape,
			"rmse":               rmse,
			"direction_accuracy": directionAccuracy,
		}),
	)
	return err
}

// GetMetrics returns aggregate forecast accuracy metrics.
func (s *ForecastAccuracyService) GetMetrics(ctx context.Context, startDate, endDate string) (*ForecastAccuracyMetrics, error) {
	m := &ForecastAccuracyMetrics{
		ByHorizon:     make(map[int]HorizonAcc),
		WeeklyTrend:   []WeeklyAccuracyTrend{},
	}

	rows, err := s.pool.Query(ctx,
		`SELECT
			COALESCE(AVG(value), 0) AS avg_mae,
			COALESCE(AVG((metadata->>'mape')::numeric), 0) AS avg_mape,
			COALESCE(AVG((metadata->>'rmse')::numeric), 0) AS avg_rmse,
			COALESCE(AVG((metadata->>'direction_accuracy')::numeric), 0) AS avg_dir_acc,
			COUNT(*) AS total
		 FROM feature_events
		 WHERE feature = 'forecast' AND event_type = 'accuracy'
		 AND created_at >= $1 AND created_at <= $2`,
		startDate, endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if rows.Next() {
		_ = rows.Scan(&m.OverallMAE, &m.OverallMAPE, &m.OverallRMSE, &m.DirectionAccuracy, &m.TotalForecasts)
	}

	// By horizon
	horizonRows, err := s.pool.Query(ctx,
		`SELECT
			(metadata->>'horizon_days')::int AS horizon,
			AVG(value) AS mae,
			AVG((metadata->>'mape')::numeric) AS mape,
			COUNT(*) AS cnt
		 FROM feature_events
		 WHERE feature = 'forecast' AND event_type = 'accuracy'
		 AND created_at >= $1 AND created_at <= $2
		 GROUP BY horizon
		 ORDER BY horizon`,
		startDate, endDate,
	)
	if err == nil {
		defer horizonRows.Close()
		for horizonRows.Next() {
			var h int
			var ha HorizonAcc
			if err := horizonRows.Scan(&h, &ha.MAE, &ha.MAPE, &ha.Count); err == nil {
				m.ByHorizon[h] = ha
			}
		}
	}

	// Weekly trend
	trendRows, err := s.pool.Query(ctx,
		`SELECT
			date_trunc('week', created_at)::date AS week,
			AVG(value) AS mae,
			AVG((metadata->>'mape')::numeric) AS mape,
			COUNT(*) AS cnt
		 FROM feature_events
		 WHERE feature = 'forecast' AND event_type = 'accuracy'
		 AND created_at >= $1 AND created_at <= $2
		 GROUP BY week
		 ORDER BY week ASC`,
		startDate, endDate,
	)
	if err == nil {
		defer trendRows.Close()
		for trendRows.Next() {
			var w WeeklyAccuracyTrend
			var week time.Time
			if err := trendRows.Scan(&week, &w.MAE, &w.MAPE, &w.Count); err == nil {
				w.Week = week.Format("2006-01-02")
				m.WeeklyTrend = append(m.WeeklyTrend, w)
			}
		}
	}

	// Clamp values
	if m.OverallMAPE > 100 {
		m.OverallMAPE = 100
	}
	if m.DirectionAccuracy > 100 {
		m.DirectionAccuracy = 100
	}
	m.OverallRMSE = math.Sqrt(m.OverallRMSE * m.OverallRMSE) // ensure positive

	return m, nil
}

func formatJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
