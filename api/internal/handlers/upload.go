// api/internal/handlers/upload.go
package handlers

import (
	"fmt"
	"net/http"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/services/csvparser"
	"github.com/finflow/api/internal/services/mlclient"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// UploadHandler handles CSV transaction uploads.
type UploadHandler struct {
	txRepo   *db.TransactionRepo
	userRepo *db.UserRepo
	ml       *mlclient.Client
	rdb      *redis.Client
}

// NewUploadHandler creates a new UploadHandler.
func NewUploadHandler(txRepo *db.TransactionRepo, userRepo *db.UserRepo, ml *mlclient.Client, rdb *redis.Client) *UploadHandler {
	return &UploadHandler{
		txRepo:   txRepo,
		userRepo: userRepo,
		ml:       ml,
		rdb:      rdb,
	}
}

// Upload processes a CSV file upload and inserts transactions.
func (h *UploadHandler) Upload(c *gin.Context) {
	userID := c.GetString("user_id")
	plan := c.GetString("plan")

	// Free tier: check transaction limit (100 max)
	if plan == "free" {
		count, err := h.userRepo.GetTransactionCount(c.Request.Context(), userID)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("checking transaction count")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if count >= 100 {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "transaction limit reached",
				"message": "Free plan allows up to 100 transactions. Upgrade to Pro for unlimited.",
			})
			return
		}
	}

	// Parse multipart file (max 10MB)
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field 'file' is required"})
		return
	}
	defer file.Close()

	// Limit file size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20) // 10MB

	// Parse CSV
	result, err := csvparser.Parse(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid CSV: " + err.Error()})
		return
	}

	if len(result.Rows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"uploaded": 0,
			"failed":   len(result.Errors),
			"errors":   result.Errors,
		})
		return
	}

	// Auto-categorize rows missing categories using ML service
	var uncategorizedDescs []string
	var uncategorizedIndices []int
	for i, row := range result.Rows {
		if row.Category == nil {
			uncategorizedDescs = append(uncategorizedDescs, row.Description)
			uncategorizedIndices = append(uncategorizedIndices, i)
		}
	}

	if len(uncategorizedDescs) > 0 {
		categories, err := h.ml.Classify(c.Request.Context(), uncategorizedDescs)
		if err != nil {
			// Log but don't fail — rows will just have nil category
			log.Warn().Err(err).Msg("ml-service classify call failed, proceeding without categories")
		} else if len(categories) == len(uncategorizedIndices) {
			for j, idx := range uncategorizedIndices {
				cat := categories[j]
				result.Rows[idx].Category = &cat
			}
		}
	}

	// Batch insert into DB
	inserted, err := h.txRepo.BatchInsert(c.Request.Context(), userID, result.Rows)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("batch inserting transactions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save transactions"})
		return
	}

	// Invalidate forecast cache for this user
	h.rdb.Del(c.Request.Context(),
		fmt.Sprintf("forecast:%s:30", userID),
		fmt.Sprintf("forecast:%s:60", userID),
		fmt.Sprintf("forecast:%s:90", userID),
	)

	log.Info().
		Str("user_id", userID).
		Int("uploaded", inserted).
		Int("failed", len(result.Errors)).
		Msg("CSV upload completed")

	c.JSON(http.StatusOK, gin.H{
		"uploaded": inserted,
		"failed":   len(result.Errors),
		"errors":   result.Errors,
	})
}
