// api/internal/handlers/transactions.go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// TransactionHandler handles transaction listing and summary endpoints.
type TransactionHandler struct {
	txRepo *db.TransactionRepo
}

// NewTransactionHandler creates a new TransactionHandler.
func NewTransactionHandler(txRepo *db.TransactionRepo) *TransactionHandler {
	return &TransactionHandler{txRepo: txRepo}
}

// List returns paginated transactions with optional filters.
func (h *TransactionHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	category := c.Query("category")

	transactions, total, err := h.txRepo.List(c.Request.Context(), userID, startDate, endDate, category, page, limit)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("listing transactions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transactions"})
		return
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": transactions,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// Summary returns an aggregated summary of the user's transactions.
func (h *TransactionHandler) Summary(c *gin.Context) {
	userID := c.GetString("user_id")

	// Default: last 30 days
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))

	summary, err := h.txRepo.GetSummary(c.Request.Context(), userID, startDate, endDate)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("computing summary")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute summary"})
		return
	}

	c.JSON(http.StatusOK, summary)
}
