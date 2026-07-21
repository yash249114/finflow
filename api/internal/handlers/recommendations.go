// api/internal/handlers/recommendations.go
package handlers

import (
	"net/http"

	"github.com/finflow/api/internal/aiops"
	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// RecommendationsHandler serves proactive financial recommendations.
type RecommendationsHandler struct {
	txRepo *db.TransactionRepo
	engine *aiops.RecommendationEngine
}

// NewRecommendationsHandler creates a new handler.
func NewRecommendationsHandler(txRepo *db.TransactionRepo) *RecommendationsHandler {
	return &RecommendationsHandler{
		txRepo: txRepo,
		engine: aiops.NewRecommendationEngine(10),
	}
}

// GetRecommendations returns AI-powered financial recommendations.
func (h *RecommendationsHandler) GetRecommendations(c *gin.Context) {
	userID := c.GetString("user_id")

	// Fetch transactions for analysis
	transactions, err := h.txRepo.GetForForecast(c.Request.Context(), userID, 90)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("fetching transactions for recommendations")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transaction data"})
		return
	}

	if len(transactions) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"recommendations": []aiops.Recommendation{},
			"message":         "Upload transactions to receive personalized recommendations.",
		})
		return
	}

	// Build financial snapshot
	snapshot := buildFinancialSnapshot(transactions)

	// Generate recommendations
	recs := h.engine.GenerateRecommendations(snapshot)
	recs = aiops.RankByPriority(recs)

	c.JSON(http.StatusOK, gin.H{
		"recommendations": recs,
		"snapshot": gin.H{
			"total_income":       snapshot.TotalIncome,
			"total_expenses":     snapshot.TotalExpenses,
			"net_cash_flow":      snapshot.NetCashFlow,
			"transaction_count":  snapshot.TransactionCount,
		},
	})
}

// buildFinancialSnapshot aggregates transaction data into a snapshot.
func buildFinancialSnapshot(transactions []models.ForecastTransaction) aiops.FinancialSnapshot {
	snapshot := aiops.FinancialSnapshot{
		CategoryTotals: make(map[string]float64),
	}

	for _, tx := range transactions {
		if tx.Amount > 0 {
			snapshot.TotalIncome += tx.Amount
		} else {
			snapshot.TotalExpenses += tx.Amount
		}
		snapshot.TransactionCount++

		if tx.Amount > 1000 {
			snapshot.HighValueTxCount++
		}
	}

	snapshot.NetCashFlow = snapshot.TotalIncome + snapshot.TotalExpenses
	if snapshot.TransactionCount > 0 {
		snapshot.AvgTransaction = (snapshot.TotalIncome + snapshot.TotalExpenses) / float64(snapshot.TransactionCount)
	}

	return snapshot
}
