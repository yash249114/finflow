// api/internal/aiops/engine.go
package aiops

import (
	"math"
	"sort"
	"strconv"
	"time"
)

// HealthScore is a 0-100 aggregate health rating of the platform.
type HealthScore struct {
	Score      int       `json:"score"`      // 0-100, higher is healthier
	Status     string    `json:"status"`     // healthy | degraded | critical
	Components map[string]ComponentHealth `json:"components"`
	ComputedAt time.Time `json:"computed_at"`
}

// ComponentHealth is the per-service/dependency health breakdown.
type ComponentHealth struct {
	Score      int     `json:"score"`
	ErrorRate  float64 `json:"error_rate"`  // 0-1 over window
	P95Latency float64 `json:"p95_latency_ms"`
	Drift      float64 `json:"drift_score"`
	Notes      string  `json:"notes,omitempty"`
}

// Window aggregates recent telemetry for scoring.
type Window struct {
	Events []TelemetryEvent
}

// NewWindow builds an aggregation window from events.
func NewWindow(events []TelemetryEvent) *Window { return &Window{Events: events} }

// p95 returns the 95th percentile latency in ms for the given predicate.
func (w *Window) p95(match func(TelemetryEvent) bool) float64 {
	var vals []float64
	for _, e := range w.Events {
		if match(e) {
			vals = append(vals, e.LatencyMs)
		}
	}
	if len(vals) == 0 {
		return 0
	}
	sort.Float64s(vals)
	idx := int(math.Ceil(0.95*float64(len(vals)))) - 1
	if idx < 0 {
		idx = 0
	}
	return vals[idx]
}

// errorRate returns fraction of events (matching predicate) with status error.
func (w *Window) errorRate(match func(TelemetryEvent) bool) float64 {
	var total, errs int
	for _, e := range w.Events {
		if match(e) {
			total++
			if e.Status == "error" {
				errs++
			}
		}
	}
	if total == 0 {
		return 0
	}
	return float64(errs) / float64(total)
}

// maxDrift returns the highest drift score among model events.
func (w *Window) maxDrift() float64 {
	max := 0.0
	for _, e := range w.Events {
		if e.Kind == "model" && e.DriftScore > max {
			max = e.DriftScore
		}
	}
	return max
}

// ComputeHealth produces a health score from the window.
func (w *Window) ComputeHealth() HealthScore {
	components := map[string]ComponentHealth{}

	services := map[string]bool{}
	for _, e := range w.Events {
		services[e.Service] = true
	}
	if len(services) == 0 {
		services["api"] = true
	}

	for svc := range services {
		match := func(e TelemetryEvent) bool { return e.Service == svc }
		er := w.errorRate(match)
		p95 := w.p95(match)
		drift := 0.0
		if svc == "ml" {
			drift = w.maxDrift()
		}
		score := scoreComponent(er, p95, drift)
		ch := ComponentHealth{
			Score:      score,
			ErrorRate:  er,
			P95Latency: p95,
			Drift:      drift,
		}
		if score < 60 {
			ch.Notes = "elevated error rate or latency"
		}
		if drift > 0.6 {
			ch.Notes = "model drift detected"
		}
		components[svc] = ch
	}

	total := 0
	for _, c := range components {
		total += c.Score
	}
	agg := 0
	if len(components) > 0 {
		agg = total / len(components)
	}
	status := "healthy"
	if agg < 60 {
		status = "critical"
	} else if agg < 80 {
		status = "degraded"
	}

	return HealthScore{
		Score:      agg,
		Status:     status,
		Components: components,
		ComputedAt: time.Now().UTC(),
	}
}

func scoreComponent(errorRate, p95, drift float64) int {
	score := 100.0
	score -= errorRate * 100      // each 1% error rate -1 point
	score -= math.Max(0, p95-300) / 20 // penalty above 300ms p95
	score -= drift * 30           // drift penalty
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return int(score)
}

// Incident is a detected anomaly requiring attention.
type Incident struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Severity    string    `json:"severity"` // low | medium | high | critical
	Service     string    `json:"service"`
	RootCause   string    `json:"root_cause"`
	Evidence    []string  `json:"evidence"`
	CreatedAt   time.Time `json:"created_at"`
}

// DetectIncidents scans the window and returns incidents (RCA-lite).
func (w *Window) DetectIncidents() []Incident {
	var incidents []Incident
	now := time.Now().UTC()

	for svc := range map[string]bool{"api": true, "ml": true, "frontend": true, "worker": true} {
		match := func(e TelemetryEvent) bool { return e.Service == svc }
		er := w.errorRate(match)
		if er >= 0.2 {
			incidents = append(incidents, Incident{
				ID:        "inc-" + svc + "-" + now.Format("20060102150405"),
				Title:     svc + " error rate breach",
				Severity:  severityFromErrorRate(er),
				Service:   svc,
				RootCause: rootCauseForErrors(w, svc),
				Evidence:  []string{fmtErr("error_rate", er)},
				CreatedAt: now,
			})
		}
	}

	// Model drift incident
	drift := w.maxDrift()
	if drift > 0.6 {
		incidents = append(incidents, Incident{
			ID:        "inc-ml-drift-" + now.Format("20060102150405"),
			Title:     "ML model drift detected",
			Severity:  "medium",
			Service:   "ml",
			RootCause: "Prediction distribution shifted beyond threshold; possible data drift or seasonality.",
			Evidence:  []string{fmtErr("drift_score", drift)},
			CreatedAt: now,
		})
	}

	return incidents
}

func severityFromErrorRate(er float64) string {
	switch {
	case er >= 0.5:
		return "critical"
	case er >= 0.35:
		return "high"
	case er >= 0.2:
		return "medium"
	default:
		return "low"
	}
}

func rootCauseForErrors(w *Window, svc string) string {
	// Count dependency vs internal errors via meta tags.
	dep, internal := 0, 0
	var lastErr string
	for _, e := range w.Events {
		if e.Service != svc || e.Status != "error" {
			continue
		}
		if e.Meta != nil {
			if e.Meta["type"] == "dependency" {
				dep++
			} else {
				internal++
			}
		}
		lastErr = e.Error
	}
	if dep > internal {
		return "Upstream dependency failure (database/ML/Redis). Last: " + lastErr
	}
	return "Internal service error. Last: " + lastErr
}

func fmtErr(k string, v float64) string {
	return k + "=" + strconv.FormatFloat(v, 'f', 4, 64)
}

// ─── Incident Memory & Timeline ──────────────────────────────────────────────

// IncidentRecord is a stored incident with resolution tracking.
type IncidentRecord struct {
	Incident
	Resolved    bool      `json:"resolved"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy  string    `json:"resolved_by,omitempty"`
	Timeline    []TimelineEntry `json:"timeline,omitempty"`
}

// TimelineEntry is a single event in an incident's lifecycle.
type TimelineEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Event     string    `json:"event"`
	Actor     string    `json:"actor"` // system | user | auto-heal
}

// IncidentMemory stores and retrieves incident history for RCA and recommendations.
type IncidentMemory struct {
	incidents []IncidentRecord
	maxSize   int
}

// NewIncidentMemory creates an incident memory store.
func NewIncidentMemory(maxSize int) *IncidentMemory {
	if maxSize <= 0 {
		maxSize = 1000
	}
	return &IncidentMemory{
		incidents: make([]IncidentRecord, 0, maxSize),
		maxSize:   maxSize,
	}
}

// Record adds an incident to memory with initial timeline entry.
func (m *IncidentMemory) Record(inc Incident) {
	record := IncidentRecord{
		Incident: inc,
		Resolved: false,
		Timeline: []TimelineEntry{
			{
				Timestamp: time.Now().UTC(),
				Event:     "Incident detected: " + inc.Title,
				Actor:     "system",
			},
		},
	}
	m.incidents = append(m.incidents, record)
	if len(m.incidents) > m.maxSize {
		m.incidents = m.incidents[len(m.incidents)-m.maxSize:]
	}
}

// Resolve marks an incident as resolved and adds timeline entry.
func (m *IncidentMemory) Resolve(id, resolvedBy string) bool {
	for i := range m.incidents {
		if m.incidents[i].ID == id && !m.incidents[i].Resolved {
			now := time.Now().UTC()
			m.incidents[i].Resolved = true
			m.incidents[i].ResolvedAt = &now
			m.incidents[i].ResolvedBy = resolvedBy
			m.incidents[i].Timeline = append(m.incidents[i].Timeline, TimelineEntry{
				Timestamp: now,
				Event:     "Incident resolved by " + resolvedBy,
				Actor:     resolvedBy,
			})
			return true
		}
	}
	return false
}

// AddTimelineEvent adds a custom event to an incident's timeline.
func (m *IncidentMemory) AddTimelineEvent(id, event, actor string) bool {
	for i := range m.incidents {
		if m.incidents[i].ID == id {
			m.incidents[i].Timeline = append(m.incidents[i].Timeline, TimelineEntry{
				Timestamp: time.Now().UTC(),
				Event:     event,
				Actor:     actor,
			})
			return true
		}
	}
	return false
}

// Recent returns the last n incidents.
func (m *IncidentMemory) Recent(n int) []IncidentRecord {
	if n <= 0 || n > len(m.incidents) {
		n = len(m.incidents)
	}
	start := len(m.incidents) - n
	result := make([]IncidentRecord, n)
	copy(result, m.incidents[start:])
	return result
}

// ByService returns incidents filtered by service name.
func (m *IncidentMemory) ByService(service string) []IncidentRecord {
	var result []IncidentRecord
	for _, inc := range m.incidents {
		if inc.Service == service {
			result = append(result, inc)
		}
	}
	return result
}

// Unresolved returns all unresolved incidents.
func (m *IncidentMemory) Unresolved() []IncidentRecord {
	var result []IncidentRecord
	for _, inc := range m.incidents {
		if !inc.Resolved {
			result = append(result, inc)
		}
	}
	return result
}

// Stats returns aggregate incident statistics.
func (m *IncidentMemory) Stats() IncidentStats {
	stats := IncidentStats{
		Total:    len(m.incidents),
		Resolved: 0,
		BySeverity: map[string]int{},
		ByService:  map[string]int{},
	}
	for _, inc := range m.incidents {
		if inc.Resolved {
			stats.Resolved++
		}
		stats.BySeverity[inc.Severity]++
		stats.ByService[inc.Service]++
	}
	if stats.Total > 0 {
		stats.ResolutionRate = float64(stats.Resolved) / float64(stats.Total)
	}
	return stats
}

// IncidentStats is aggregate incident data for reporting.
type IncidentStats struct {
	Total         int            `json:"total"`
	Resolved      int            `json:"resolved"`
	ResolutionRate float64       `json:"resolution_rate"`
	BySeverity    map[string]int `json:"by_severity"`
	ByService     map[string]int `json:"by_service"`
}
