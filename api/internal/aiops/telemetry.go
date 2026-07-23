// api/internal/aiops/telemetry.go
package aiops

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

// TelemetryEvent is a single observability signal emitted by any FinFlow service.
type TelemetryEvent struct {
	ID         string            `json:"id"`
	Service    string            `json:"service"`   // api | ml | frontend | worker
	Kind       string            `json:"kind"`      // request | dependency | model | job | incident
	Operation  string            `json:"operation"` // e.g. forecast, classify, db_query, smtp
	Status     string            `json:"status"`    // ok | degraded | error
	LatencyMs  float64           `json:"latency_ms"`
	Error      string            `json:"error,omitempty"`
	Confidence float64           `json:"confidence,omitempty"`  // model confidence / forecast confidence 0-1
	DriftScore float64           `json:"drift_score,omitempty"` // 0-1, higher = more drift
	Meta       map[string]string `json:"meta,omitempty"`
	Timestamp  time.Time         `json:"timestamp"`
}

// Publisher emits telemetry onto a Redis Stream for the AIOps worker to consume.
type Publisher struct {
	rdb     *redis.Client
	stream  string
	service string
}

// NewPublisher creates a telemetry publisher for the given service.
func NewPublisher(rdb *redis.Client, stream, service string) *Publisher {
	return &Publisher{rdb: rdb, stream: stream, service: service}
}

// Emit records a telemetry event onto the stream. Failures are non-fatal (best-effort).
func (p *Publisher) Emit(ctx context.Context, e TelemetryEvent) {
	if e.ID == "" {
		e.ID = time.Now().UTC().Format("20060102150405.000000000")
	}
	if e.Service == "" {
		e.Service = p.service
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	if e.Meta == nil {
		e.Meta = map[string]string{}
	}

	payload, err := json.Marshal(e)
	if err != nil {
		return
	}
	// Best-effort: do not block the caller on telemetry.
	if p.rdb == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		p.rdb.XAdd(ctx, &redis.XAddArgs{
			Stream: p.stream,
			Values: map[string]interface{}{"event": string(payload)},
		})
	}()
}

// EmitRequest is a convenience helper for HTTP/dependency latency signals.
func (p *Publisher) EmitRequest(ctx context.Context, operation, status string, latencyMs float64, err error, meta map[string]string) {
	e := TelemetryEvent{
		Kind:      "request",
		Operation: operation,
		Status:    status,
		LatencyMs: latencyMs,
		Meta:      meta,
	}
	if err != nil {
		e.Error = err.Error()
	}
	p.Emit(ctx, e)
}
