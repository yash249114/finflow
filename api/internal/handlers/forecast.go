// api/internal/handlers/forecast.go
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/finflow/api/internal/db"
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "forecast computation failed: " + err.Error()})
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
