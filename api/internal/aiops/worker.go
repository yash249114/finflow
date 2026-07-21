// api/internal/aiops/worker.go
package aiops

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Worker consumes the telemetry stream and runs the AIOps loop:
// score health, detect incidents, auto-retry, and alert.
type Worker struct {
	rdb        *redis.Client
	stream     string
	group      string
	consumer   string
	publisher  *Publisher
	alerter    *Alerter
	windowSize int
	events     []TelemetryEvent
	lastScore  HealthScore
}

// NewWorker creates the AIOps worker.
func NewWorker(rdb *redis.Client, stream, reportStream string, pub *Publisher, alerter *Alerter) *Worker {
	return &Worker{
		rdb:        rdb,
		stream:     stream,
		group:      "aiops",
		consumer:   "worker-1",
		publisher:  pub,
		alerter:    alerter,
		windowSize: 500,
	}
}

// Start runs the consume + analyze loop until ctx is cancelled.
func (w *Worker) Start(ctx context.Context) {
	// Ensure consumer group exists (ignore if already created).
	w.rdb.XGroupCreateMkStream(ctx, w.stream, w.group, "0").Err()

	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				w.consume(ctx)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.analyze(ctx)
			}
		}
	}()
}

func (w *Worker) consume(ctx context.Context) {
	res, err := w.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    w.group,
		Consumer: w.consumer,
		Streams:  []string{w.stream, ">"},
		Count:    50,
		Block:    2 * time.Second,
	}).Result()
	if err != nil {
		if err != redis.Nil {
			log.Printf("aiops: consume error: %v", err)
		}
		return
	}
	for _, stream := range res {
		for _, msg := range stream.Messages {
			raw, ok := msg.Values["event"].(string)
			if !ok {
				w.rdb.XAck(ctx, w.stream, w.group, msg.ID)
				continue
			}
			var e TelemetryEvent
			if err := json.Unmarshal([]byte(raw), &e); err == nil {
				w.ingest(e)
				// Auto-retry dependency errors (self-healing).
				if e.Status == "error" && e.Meta != nil && e.Meta["type"] == "dependency" {
					w.retry(ctx, e)
				}
			}
			w.rdb.XAck(ctx, w.stream, w.group, msg.ID)
		}
	}
}

func (w *Worker) ingest(e TelemetryEvent) {
	w.events = append(w.events, e)
	if len(w.events) > w.windowSize {
		w.events = w.events[len(w.events)-w.windowSize:]
	}
}

// retry performs a best-effort automatic retry of a failed dependency op.
func (w *Worker) retry(ctx context.Context, e TelemetryEvent) {
	log.Printf("aiops: self-healing retry for %s/%s", e.Service, e.Operation)
	// Re-emit as a retry attempt; downstream consumers/services may act on it.
	w.publisher.Emit(ctx, TelemetryEvent{
		Kind:      "job",
		Operation: e.Operation + ":retry",
		Status:    "ok",
		Meta:      map[string]string{"type": "retry", "original": e.ID},
	})
}

func (w *Worker) analyze(ctx context.Context) {
	if len(w.events) == 0 {
		return
	}
	win := NewWindow(w.events)
	w.lastScore = win.ComputeHealth()

	incidents := win.DetectIncidents()
	for _, inc := range incidents {
		log.Printf("aiops: incident detected %s/%s (%s)", inc.Service, inc.Title, inc.Severity)
		w.alerter.Notify(ctx, inc)
	}
}

// Health returns the most recent computed health score.
func (w *Worker) Health() HealthScore { return w.lastScore }
