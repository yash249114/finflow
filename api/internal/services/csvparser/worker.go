// api/internal/services/csvparser/worker.go
package csvparser

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/services/mlclient"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// UploadStatus represents the real-time processing metrics of a CSV ingestion.
type UploadStatus struct {
	UploadID           string        `json:"upload_id"`
	UserID             string        `json:"user_id"`
	Status             string        `json:"status"` // pending, processing, completed, failed
	FileName           string        `json:"file_name"`
	TotalRows          int           `json:"total_rows"`
	ProcessedRows      int           `json:"processed_rows"`
	FailedRows         int           `json:"failed_rows"`
	StartTime          time.Time     `json:"start_time"`
	EndTime            *time.Time    `json:"end_time,omitempty"`
	Speed              float64       `json:"speed"`               // rows/sec
	EstimatedRemaining float64       `json:"estimated_remaining"` // seconds
	Errors             []UploadError `json:"errors"`
}

type UploadError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

// IngestionManager coordinates asynchronous CSV ingestion pipelines.
type IngestionManager struct {
	txRepo *db.TransactionRepo
	ml     *mlclient.Client
	rdb    *redis.Client
}

// NewIngestionManager creates a new IngestionManager.
func NewIngestionManager(txRepo *db.TransactionRepo, ml *mlclient.Client, rdb *redis.Client) *IngestionManager {
	return &IngestionManager{
		txRepo: txRepo,
		ml:     ml,
		rdb:    rdb,
	}
}

// InitializeStatus creates a pending status entry in Redis and returns the upload ID.
func (m *IngestionManager) InitializeStatus(ctx context.Context, userID, fileName string) (string, error) {
	uploadID := uuid.New().String()
	status := UploadStatus{
		UploadID:  uploadID,
		UserID:    userID,
		Status:    "pending",
		FileName:  fileName,
		StartTime: time.Now(),
		Errors:    []UploadError{},
	}

	data, err := json.Marshal(status)
	if err != nil {
		return "", err
	}

	key := fmt.Sprintf("upload:%s", uploadID)
	err = m.rdb.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		return "", err
	}

	return uploadID, nil
}

// GetStatus retrieves the current ingestion progress metrics.
func (m *IngestionManager) GetStatus(ctx context.Context, uploadID string) (*UploadStatus, error) {
	key := fmt.Sprintf("upload:%s", uploadID)
	data, err := m.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var status UploadStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, err
	}

	return &status, nil
}

// updateStatus writes current status changes back to Redis.
func (m *IngestionManager) updateStatus(ctx context.Context, status *UploadStatus) {
	key := fmt.Sprintf("upload:%s", status.UploadID)
	data, err := json.Marshal(status)
	if err == nil {
		m.rdb.Set(ctx, key, data, 24*time.Hour)
	}
}

// StartIngest begins processing a CSV file in a background worker pool.
func (m *IngestionManager) StartIngest(userID, uploadID, filePath string) {
	go func() {
		ctx := context.Background()
		log.Info().Str("upload_id", uploadID).Str("file", filePath).Msg("Starting background ingestion pipeline")

		// 1. Read status
		status, err := m.GetStatus(ctx, uploadID)
		if err != nil {
			log.Error().Err(err).Str("upload_id", uploadID).Msg("Failed to load status block for pipeline")
			return
		}

		status.Status = "processing"
		m.updateStatus(ctx, status)

		file, err := os.Open(filePath)
		if err != nil {
			status.Status = "failed"
			status.Errors = append(status.Errors, UploadError{Row: 0, Reason: fmt.Sprintf("failed to open file: %v", err)})
			m.updateStatus(ctx, status)
			return
		}
		defer file.Close()
		defer os.Remove(filePath) // clean up temp file afterwards

		// 2. Parse CSV rows
		result, err := Parse(file)
		if err != nil {
			status.Status = "failed"
			status.Errors = append(status.Errors, UploadError{Row: 0, Reason: fmt.Sprintf("failed to parse CSV header/format: %v", err)})
			m.updateStatus(ctx, status)
			return
		}

		status.TotalRows = len(result.Rows)
		for _, parseErr := range result.Errors {
			status.Errors = append(status.Errors, UploadError{Row: parseErr.Row, Reason: parseErr.Reason})
		}
		status.FailedRows = len(result.Errors)
		m.updateStatus(ctx, status)

		if len(result.Rows) == 0 {
			status.Status = "completed"
			now := time.Now()
			status.EndTime = &now
			m.updateStatus(ctx, status)
			return
		}

		// 3. Spawning worker pool to batch rows, auto-categorize, and insert in parallel.
		numWorkers := 3
		rowChan := make(chan db.ParsedRow, 10000)
		errChan := make(chan UploadError, 1000)

		var wg sync.WaitGroup

		// Spawn workers
		for w := 1; w <= numWorkers; w++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				m.worker(ctx, userID, rowChan, errChan)
			}()
		}

		// Progress reporter goroutine
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()

		var progressWg sync.WaitGroup
		progressWg.Add(1)
		go func() {
			defer progressWg.Done()
			for {
				select {
				case <-ticker.C:
					// Calculate ingestion metrics
					elapsed := time.Since(status.StartTime).Seconds()
					if elapsed > 0 {
						status.Speed = math.Round(float64(status.ProcessedRows) / elapsed)
						if status.Speed > 0 && status.TotalRows > status.ProcessedRows {
							status.EstimatedRemaining = math.Round(float64(status.TotalRows-status.ProcessedRows) / status.Speed)
						}
					}
					m.updateStatus(ctx, status)
				case parseErr, ok := <-errChan:
					if !ok {
						return
					}
					status.Errors = append(status.Errors, parseErr)
					status.FailedRows++
				}
			}
		}()

		// Send rows to channel in batches
		batchSize := 2000
		for i := 0; i < len(result.Rows); i += batchSize {
			end := i + batchSize
			if end > len(result.Rows) {
				end = len(result.Rows)
			}
			batch := result.Rows[i:end]

			// Send to worker pool
			for _, row := range batch {
				rowChan <- row
			}

			// Optimistically increment processed rows
			status.ProcessedRows += len(batch)
			m.updateStatus(ctx, status)
		}

		close(rowChan)
		wg.Wait()
		close(errChan)
		progressWg.Wait()

		// Final updates
		status.Status = "completed"
		now := time.Now()
		status.EndTime = &now
		status.Speed = 0
		status.EstimatedRemaining = 0
		m.updateStatus(ctx, status)

		// Invalidate caches
		m.rdb.Del(ctx,
			fmt.Sprintf("forecast:%s:30", userID),
			fmt.Sprintf("forecast:%s:60", userID),
			fmt.Sprintf("forecast:%s:90", userID),
		)
		log.Info().Str("upload_id", uploadID).Int("processed", status.ProcessedRows).Msg("CSV background ingestion pipeline completed successfully")
	}()
}

func (m *IngestionManager) worker(ctx context.Context, userID string, rowChan <-chan db.ParsedRow, errChan chan<- UploadError) {
	batchSize := 500
	var batch []db.ParsedRow

	flush := func() {
		if len(batch) == 0 {
			return
		}

		// Auto-categorize missing categories via ML Service Client
		var uncategorizedDescs []string
		var uncategorizedIndices []int
		for idx, r := range batch {
			if r.Category == nil {
				uncategorizedDescs = append(uncategorizedDescs, r.Description)
				uncategorizedIndices = append(uncategorizedIndices, idx)
			}
		}

		if len(uncategorizedDescs) > 0 {
			categories, err := m.ml.Classify(ctx, uncategorizedDescs)
			if err == nil && len(categories) == len(uncategorizedIndices) {
				for j, origIdx := range uncategorizedIndices {
					cat := categories[j]
					batch[origIdx].Category = &cat
				}
			}
		}

		// PostgreSQL COPY Optimization
		_, err := m.txRepo.BulkCopyInsert(ctx, userID, batch)
		if err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("COPY batch insertion failed in background worker")
			for _, r := range batch {
				errChan <- UploadError{Row: 0, Reason: fmt.Sprintf("Failed to insert row (%s: %s): %v", r.Date, r.Description, err)}
			}
		}

		batch = nil
	}

	for row := range rowChan {
		batch = append(batch, row)
		if len(batch) >= batchSize {
			flush()
		}
	}
	flush()
}
