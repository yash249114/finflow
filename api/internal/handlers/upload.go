// api/internal/handlers/upload.go
package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/services/csvparser"
	"github.com/finflow/api/internal/services/mlclient"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const (
	maxUploadSize    = 20 << 20 // 20 MB max CSV file
	maxUploadRows    = 100000   // 100k rows max per upload
	maxChunkSize     = 5 << 20  // 5 MB per chunk
	contentTypeCSV   = "text/csv"
	contentTypeOctet = "application/octet-stream"
)

var allowedCSVExtensions = []string{".csv", ".tsv"}

func validateCSVFile(header *multipart.FileHeader) error {
	if header.Size > maxUploadSize {
		return fmt.Errorf("file too large: %d bytes exceeds %d byte limit", header.Size, maxUploadSize)
	}
	ext := filepath.Ext(header.Filename)
	valid := false
	for _, e := range allowedCSVExtensions {
		if ext == e {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid file extension: %q (only .csv accepted)", ext)
	}
	return nil
}

// UploadHandler handles CSV transaction uploads.
type UploadHandler struct {
	txRepo    *db.TransactionRepo
	userRepo  *db.UserRepo
	ml        *mlclient.Client
	rdb       *redis.Client
	ingestMgr *csvparser.IngestionManager
}

// NewUploadHandler creates a new UploadHandler.
func NewUploadHandler(txRepo *db.TransactionRepo, userRepo *db.UserRepo, ml *mlclient.Client, rdb *redis.Client) *UploadHandler {
	return &UploadHandler{
		txRepo:    txRepo,
		userRepo:  userRepo,
		ml:        ml,
		rdb:       rdb,
		ingestMgr: csvparser.NewIngestionManager(txRepo, ml, rdb),
	}
}

// StartUpload registers a new upload session, returning a unique task ID.
func (h *UploadHandler) StartUpload(c *gin.Context) {
	userID := c.GetString("user_id")
	plan := c.GetString("plan")

	// Free tier: check transaction limit (250 max as per new plan)
	if plan == "free" {
		count, err := h.userRepo.GetTransactionCount(c.Request.Context(), userID)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("checking transaction count")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if count >= 250 {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":   "transaction_limit_reached",
				"message": "Free plan allows up to 250 transactions. Upgrade to Pro for unlimited.",
			})
			return
		}
	}

	var req struct {
		FileName string `json:"file_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body request"})
		return
	}

	uploadID, err := h.ingestMgr.InitializeStatus(c.Request.Context(), userID, req.FileName)
	if err != nil {
		log.Error().Err(err).Msg("initializing upload status")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize upload session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upload_id": uploadID,
		"status":    "pending",
	})
}

// UploadChunk processes a single chunk segment and merges them upon completion.
func (h *UploadHandler) UploadChunk(c *gin.Context) {
	userID := c.GetString("user_id")
	uploadID := c.PostForm("upload_id")
	chunkIdxStr := c.PostForm("chunk_index")
	totalChunksStr := c.PostForm("total_chunks")

	if uploadID == "" || chunkIdxStr == "" || totalChunksStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing upload metadata"})
		return
	}

	// Sanitize upload_id to prevent path traversal
	for _, ch := range uploadID {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload_id format"})
			return
		}
	}

	chunkIdx, _ := strconv.Atoi(chunkIdxStr)
	totalChunks, _ := strconv.Atoi(totalChunksStr)

	// Fetch file part
	fileHeader, err := c.FormFile("chunk")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "chunk form field is required"})
		return
	}

	// Validate chunk size
	if fileHeader.Size > maxChunkSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("chunk too large: %d bytes exceeds %d byte limit", fileHeader.Size, maxChunkSize)})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open chunk segment"})
		return
	}
	defer file.Close()

	// Validate chunk index bounds
	if chunkIdx < 0 || chunkIdx >= 1000 || totalChunks <= 0 || totalChunks > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chunk metadata"})
		return
	}

	// Ensure target directories exist
	tempDir := filepath.Join(os.TempDir(), "finflow-uploads")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to allocate directory"})
		return
	}

	// Write chunk
	chunkPath := filepath.Join(tempDir, fmt.Sprintf("%s.part_%d", uploadID, chunkIdx))
	out, err := os.Create(chunkPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chunk file"})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to write chunk payload"})
		return
	}

	// Verify if all chunks are uploaded and merge
	allUploaded := true
	for i := 0; i < totalChunks; i++ {
		p := filepath.Join(tempDir, fmt.Sprintf("%s.part_%d", uploadID, i))
		if _, err := os.Stat(p); os.IsNotExist(err) {
			allUploaded = false
			break
		}
	}

	if allUploaded {
		// Atomic sentinel to prevent concurrent merges for the same uploadID.
		sentinelPath := filepath.Join(tempDir, fmt.Sprintf("%s.merging", uploadID))
		sentinelFile, err := os.OpenFile(sentinelPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			// Another goroutine already started merging — just trigger ingest.
			mergedPath := filepath.Join(tempDir, fmt.Sprintf("%s.csv", uploadID))
			if _, statErr := os.Stat(mergedPath); statErr == nil {
				h.ingestMgr.StartIngest(userID, uploadID, mergedPath)
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}
		sentinelFile.Close()
		defer os.Remove(sentinelPath)

		// Merge chunks
		finalPath := filepath.Join(tempDir, fmt.Sprintf("%s.csv", uploadID))
		mergedFile, err := os.Create(finalPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize merge stream"})
			return
		}
		defer mergedFile.Close()

		for i := 0; i < totalChunks; i++ {
			p := filepath.Join(tempDir, fmt.Sprintf("%s.part_%d", uploadID, i))
			partFile, err := os.Open(p)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open part stream"})
				return
			}
			_, err = io.Copy(mergedFile, partFile)
			partFile.Close()
			os.Remove(p) // remove part chunk

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed during parts merge"})
				return
			}
		}

		// Trigger Ingest asynchronously
		h.ingestMgr.StartIngest(userID, uploadID, finalPath)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// UploadStatus returns the real-time parsing progress metrics.
func (h *UploadHandler) UploadStatus(c *gin.Context) {
	uploadID := c.Query("upload_id")
	if uploadID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "upload_id parameter is required"})
		return
	}

	status, err := h.ingestMgr.GetStatus(c.Request.Context(), uploadID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "upload task not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// Upload legacy handler (kept for compatibility or fallbacks)
func (h *UploadHandler) Upload(c *gin.Context) {
	userID := c.GetString("user_id")
	plan := c.GetString("plan")

	if plan == "free" {
		count, err := h.userRepo.GetTransactionCount(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if count >= 250 {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "transaction limit reached"})
			return
		}
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}
	defer file.Close()

	// File validation
	if err := validateCSVFile(header); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Direct parsing for lightweight legacy support
	result, err := csvparser.Parse(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid CSV: " + err.Error()})
		return
	}

	if len(result.Rows) > maxUploadRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("CSV has %d rows, exceeds limit of %d", len(result.Rows), maxUploadRows)})
		return
	}

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
		if err == nil && len(categories) == len(uncategorizedIndices) {
			for j, idx := range uncategorizedIndices {
				cat := categories[j]
				result.Rows[idx].Category = &cat
			}
		}
	}

	inserted, err := h.txRepo.BulkCopyInsert(c.Request.Context(), userID, result.Rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save transactions"})
		return
	}

	if h.rdb != nil {
		h.rdb.Del(c.Request.Context(),
			fmt.Sprintf("forecast:%s:30", userID),
			fmt.Sprintf("forecast:%s:60", userID),
			fmt.Sprintf("forecast:%s:90", userID),
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"uploaded":  inserted,
		"failed":    len(result.Errors),
		"errors":    result.Errors,
		"file_name": header.Filename,
	})
}
