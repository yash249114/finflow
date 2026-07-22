// api/internal/handlers/forecast.go
package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
	"github.com/finflow/api/internal/services/mlclient"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// ForecastHandler handles the forecast endpoint.
type ForecastHandler struct {
	txRepo *db.TransactionRepo
	ml     *mlclient.Client
	rdb    *redis.Client
}

// NewForecastHandler creates a new ForecastHandler.
func NewForecastHandler(txRepo *db.TransactionRepo, ml *mlclient.Client, rdb *redis.Client) *ForecastHandler {
	return &ForecastHandler{
		txRepo: txRepo,
		ml:     ml,
		rdb:    rdb,
	}
}

// GetForecast retrieves or computes a cash flow forecast.
func (h *ForecastHandler) GetForecast(c *gin.Context) {
	userID := c.GetString("user_id")

	horizon, _ := strconv.Atoi(c.DefaultQuery("horizon", "30"))
	if horizon != 30 && horizon != 60 && horizon != 90 {
		horizon = 30
	}

	// Check Redis cache
	cacheKey := fmt.Sprintf("forecast:%s:%d", userID, horizon)
	cached, err := h.rdb.Get(c.Request.Context(), cacheKey).Result()
	if err == nil && cached != "" {
		// Return cached response
		var result interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			log.Debug().Str("user_id", userID).Int("horizon", horizon).Msg("returning cached forecast")
			c.JSON(http.StatusOK, result)
			return
		}
	}

	// Fetch last 90 days of transactions
	transactions, err := h.txRepo.GetForForecast(c.Request.Context(), userID, 90)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("fetching forecast transactions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transaction data"})
		return
	}

	if len(transactions) < 14 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":            "not enough data",
			"minimum_required": 14,
			"current_count":    len(transactions),
		})
		return
	}

	// Call ML service
	forecast, err := h.ml.Forecast(c.Request.Context(), transactions, horizon)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Int("horizon", horizon).Msg("ml-service forecast failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "forecast computation failed"})
		return
	}

	// Cache result for 1 hour
	forecastBytes, err := json.Marshal(forecast)
	if err == nil {
		h.rdb.Set(c.Request.Context(), cacheKey, string(forecastBytes), 1*time.Hour)
	}

	log.Info().Str("user_id", userID).Int("horizon", horizon).Msg("forecast computed and cached")
	c.JSON(http.StatusOK, forecast)
}

// ─── Forecast Quality Metrics ────────────────────────────────────────────────

// ForecastQualityMetrics holds accuracy and quality metrics for forecasts.
type ForecastQualityMetrics struct {
	MeanAbsoluteError   float64                `json:"mean_absolute_error"`
	MeanSquaredError    float64                `json:"mean_squared_error"`
	RootMeanSquareError float64                `json:"root_mean_square_error"`
	MeanAbsolutePctErr  float64                `json:"mean_absolute_pct_error"`
	R2Score             float64                `json:"r2_score"`
	DirectionAccuracy   float64                `json:"direction_accuracy"`  // % of times direction was correct
	ConfidenceCoverage  float64                `json:"confidence_coverage"` // % of actuals within confidence interval
	ForecastCount       int                    `json:"forecast_count"`
	ByHorizon           map[int]HorizonMetrics `json:"by_horizon,omitempty"`
	ComputedAt          time.Time              `json:"computed_at"`
}

// HorizonMetrics is quality metrics for a specific forecast horizon.
type HorizonMetrics struct {
	MAE   float64 `json:"mae"`
	MAPE  float64 `json:"mape"`
	Count int     `json:"count"`
}

// GetForecastQuality computes forecast accuracy metrics by comparing past forecasts with actuals.
func (h *ForecastHandler) GetForecastQuality(c *gin.Context) {
	userID := c.GetString("user_id")

	// Fetch recent transactions (actuals)
	transactions, err := h.txRepo.GetForForecast(c.Request.Context(), userID, 90)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("fetching quality metrics transactions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transaction data"})
		return
	}

	if len(transactions) < 14 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":            "insufficient data for quality metrics",
			"minimum_required": 14,
			"current_count":    len(transactions),
		})
		return
	}

	// Compute daily actuals
	dailyActuals := computeDailyActuals(transactions)

	// Try to get cached forecast and compare
	cacheKey := fmt.Sprintf("forecast:%s:30", userID)
	cached, err := h.rdb.Get(c.Request.Context(), cacheKey).Result()
	if err != nil || cached == "" {
		// No forecast available; return synthetic metrics based on data quality
		c.JSON(http.StatusOK, ForecastQualityMetrics{
			MeanAbsoluteError:   0,
			MeanSquaredError:    0,
			RootMeanSquareError: 0,
			MeanAbsolutePctErr:  0,
			R2Score:             0,
			DirectionAccuracy:   0,
			ConfidenceCoverage:  0,
			ForecastCount:       0,
			ComputedAt:          time.Now().UTC(),
		})
		return
	}

	var forecastData map[string]interface{}
	if err := json.Unmarshal([]byte(cached), &forecastData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid forecast cache"})
		return
	}

	// Extract forecast points
	forecastPoints, ok := forecastData["forecast"].([]interface{})
	if !ok || len(forecastPoints) == 0 {
		c.JSON(http.StatusOK, ForecastQualityMetrics{
			ForecastCount: 0,
			ComputedAt:    time.Now().UTC(),
		})
		return
	}

	// Compute quality metrics by comparing overlapping dates
	metrics := computeForecastQuality(dailyActuals, forecastPoints)

	c.JSON(http.StatusOK, metrics)
}

// computeDailyActuals aggregates transactions by date.
func computeDailyActuals(transactions []models.ForecastTransaction) map[string]float64 {
	daily := make(map[string]float64)
	for _, tx := range transactions {
		daily[tx.Date] += tx.Amount
	}
	return daily
}

// computeForecastQuality compares forecast points with actuals.
func computeForecastQuality(actuals map[string]float64, forecastPoints []interface{}) ForecastQualityMetrics {
	var absErrors, sqErrors, absPctErrors []float64
	var directionCorrect, withinInterval int
	total := 0
	var prevActual, prevPredicted float64
	hasPrev := false

	for _, point := range forecastPoints {
		fp, ok := point.(map[string]interface{})
		if !ok {
			continue
		}

		date, _ := fp["date"].(string)
		predicted, _ := fp["predicted"].(float64)
		actual, hasActual := actuals[date]

		if !hasActual {
			continue
		}

		total++
		absErr := math.Abs(predicted - actual)
		sqErr := absErr * absErr
		absErrors = append(absErrors, absErr)
		sqErrors = append(sqErrors, sqErr)

		if actual != 0 {
			absPctErrors = append(absPctErrors, absErr/math.Abs(actual)*100)
		}

		// Direction accuracy: did forecast predict increase/decrease correctly?
		if hasPrev {
			actualUp := actual > prevActual
			predictedUp := predicted > prevPredicted
			if actualUp == predictedUp || actual == prevActual && predicted == prevPredicted {
				directionCorrect++
			}
		}
		prevActual = actual
		prevPredicted = predicted
		hasPrev = true

		// Confidence interval coverage
		lower, hasLower := fp["lower"].(float64)
		upper, hasUpper := fp["upper"].(float64)
		if hasLower && hasUpper && actual >= lower && actual <= upper {
			withinInterval++
		}
	}

	metrics := ForecastQualityMetrics{
		ForecastCount: total,
	}

	if total > 0 {
		// MAE
		sumAbs := 0.0
		for _, v := range absErrors {
			sumAbs += v
		}
		metrics.MeanAbsoluteError = sumAbs / float64(total)

		// MSE & RMSE
		sumSq := 0.0
		for _, v := range sqErrors {
			sumSq += v
		}
		metrics.MeanSquaredError = sumSq / float64(total)
		metrics.RootMeanSquareError = math.Sqrt(metrics.MeanSquaredError)

		// MAPE
		if len(absPctErrors) > 0 {
			sumPct := 0.0
			for _, v := range absPctErrors {
				sumPct += v
			}
			metrics.MeanAbsolutePctErr = sumPct / float64(len(absPctErrors))
		}

		// Direction accuracy
		dirTotal := total
		if dirTotal > 1 {
			dirTotal-- // first point has no previous
		}
		if dirTotal > 0 {
			metrics.DirectionAccuracy = float64(directionCorrect) / float64(dirTotal) * 100
		}

		// Confidence coverage
		metrics.ConfidenceCoverage = float64(withinInterval) / float64(total) * 100

		// R² Score (simplified: 1 - (SS_res / SS_tot))
		// SS_tot = variance of actuals
		meanActual := 0.0
		for _, v := range actuals {
			meanActual += v
		}
		meanActual /= float64(len(actuals))

		ssTot := 0.0
		for _, v := range actuals {
			diff := v - meanActual
			ssTot += diff * diff
		}

		if ssTot > 0 {
			metrics.R2Score = 1 - (sumSq / ssTot)
			if metrics.R2Score < 0 {
				metrics.R2Score = 0
			}
		}
	}

	return metrics
}
