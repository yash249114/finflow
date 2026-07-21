# AIOps — Self-Healing Infrastructure

FinFlow includes a built-in AIOps (AI for IT Operations) subsystem that provides autonomous monitoring, incident detection, root cause analysis, and self-healing capabilities — all without external observability platforms.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AIOps Architecture                          │
│                                                                 │
│  Every HTTP Request ──► Telemetry Event ──► Redis Stream        │
│                                                    │            │
│                                              ┌─────▼──────┐    │
│                                              │  AIOps     │    │
│                                              │  Worker    │    │
│                                              │  (15s loop)│    │
│                                              └─────┬──────┘    │
│                                                    │            │
│                              ┌─────────────────────┼──────┐     │
│                              │                     │      │     │
│                        ┌─────▼─────┐        ┌─────▼─────┐│     │
│                        │  Health   │        │ Incident  ││     │
│                        │  Scoring  │        │ Detection ││     │
│                        │  (0-100)  │        │           ││     │
│                        └─────┬─────┘        └─────┬─────┘│     │
│                              │                    │      │     │
│                        ┌─────▼─────┐        ┌─────▼─────┐│     │
│                        │  /api/    │        │  Alert    ││     │
│                        │  aiops/   │        │  Pipeline ││     │
│                        │  health   │        └─────┬─────┘│     │
│                        └──────────┘              │      │     │
│                                                  │      │     │
│                              ┌───────────────────┼──┐   │     │
│                              │                   │  │   │     │
│                        ┌─────▼─────┐  ┌─────▼───▼┐ │   │     │
│                        │  Email    │  │ GitHub   │ │   │     │
│                        │  Alert    │  │ Issue    │ │   │     │
│                        └──────────┘  └──────────┘ │   │     │
│                                                    │   │     │
│                        ┌──────────┐  ┌──────────┐  │   │     │
│                        │ Web3Forms│  │ Self-    │◄─┘   │     │
│                        │ Ticket   │  │ Healing  │      │     │
│                        └──────────┘  │ Retry    │      │     │
│                                      └──────────┘      │     │
└─────────────────────────────────────────────────────────┘     │
```

---

## Components

### 1. Telemetry Publisher

**File**: `api/internal/aiops/telemetry.go`

Every service emits structured telemetry events to a Redis Stream. Events are fire-and-forget — failures are non-fatal to avoid impacting production traffic.

```go
type TelemetryEvent struct {
    Service     string            // api | ml | frontend | worker
    Kind        string            // request | dependency | model | job | incident
    Operation   string            // e.g. /api/v1/forecast, classify, redis ping
    Status      string            // ok | degraded | error
    LatencyMs   float64
    Confidence  float64           // ML model confidence (0-1)
    DriftScore  float64           // ML model drift (0-1)
    Meta        map[string]string // type=internal|dependency, retry=true, etc.
}
```

**Emission points:**
- Request logger middleware (every HTTP request)
- Dependency monitor (Redis, PostgreSQL, ML service health probes every 30s)
- ML model metrics endpoint (drift + confidence scores)

### 2. AIOps Worker

**File**: `api/internal/aiops/worker.go`

A background goroutine that runs two loops:
1. **Consume** (2s block): Reads events from the Redis Stream, ingests into a sliding window
2. **Analyze** (15s tick): Computes health scores and detects incidents

```go
func (w *Worker) Start(ctx context.Context) {
    // Consumer group ensures exactly-once processing
    w.rdb.XGroupCreateMkStream(ctx, w.stream, w.group, "0")
    
    go func() {
        for {
            w.consume(ctx)    // Read new events
            w.analyze(ctx)    // Score + detect incidents
        }
    }()
}
```

**Self-healing behavior**: When a dependency error is detected (Redis timeout, PostgreSQL connection failure, ML service 500), the worker automatically re-emits a retry event. This triggers downstream consumers to reattempt the failed operation.

### 3. Health Scoring Engine

**File**: `api/internal/aiops/engine.go`

Computes a 0-100 health score for each service component:

```go
func scoreComponent(errorRate, p95, drift float64) int {
    score := 100.0
    score -= errorRate * 100                    // -1 per 1% error rate
    score -= math.Max(0, p95-300) / 20          // penalty above 300ms P95
    score -= drift * 30                          // drift penalty
    return clamp(score, 0, 100)
}
```

**Status thresholds:**
| Score | Status | Action |
|-------|--------|--------|
| 80-100 | `healthy` | No action |
| 60-79 | `degraded` | Log warning, monitor closely |
| 0-59 | `critical` | Alert immediately, attempt self-healing |

**Incident detection rules:**
- Error rate ≥20% → Incident (severity based on rate)
- Model drift >0.6 → Drift incident
- P95 latency >300ms → Degraded status (not a standalone incident)

### 4. Alert Pipeline

**File**: `api/internal/aiops/alerting.go`

When an incident is detected, alerts are dispatched through multiple channels:

#### Email Alerts (SMTP)
```go
// Template includes service, severity, root cause, and evidence
// Sent to configured alert recipient + optional owner email
al.SendEmail(inc)
```

#### GitHub Issues (REST API)
```go
// Auto-creates issues with [AIOps] prefix and auto-triage labels
// Includes severity, root cause, and evidence in issue body
url, _ := al.DraftGitHubIssue(ctx, inc)
```

#### Web3Forms Support Tickets
```go
// Creates user-facing support tickets when copilot confidence is low
// Routes to configured support email via Web3Forms API
al.CreateSupportTicket(ctx, ticket)
```

#### Self-Reporting (Redis Stream)
```go
// All incidents and tickets are logged to a report stream
// for auditing and dashboard display
al.Report(ctx, inc, issueURL)
```

### 5. Incident Memory

**File**: `api/internal/aiops/engine.go` (lines 244-394)

A rolling in-memory store of incidents with full lifecycle tracking:

```go
type IncidentRecord struct {
    Incident
    Resolved    bool
    ResolvedAt  *time.Time
    ResolvedBy  string        // system | user | auto-heal
    Timeline    []TimelineEntry
}
```

**Operations:**
- `Record(inc)` — Add incident with initial timeline entry
- `Resolve(id, by)` — Mark resolved with timestamp
- `AddTimelineEvent(id, event, actor)` — Add custom timeline entry
- `Recent(n)` — Get last N incidents
- `ByService(svc)` — Filter by service
- `Unresolved()` — Get open incidents
- `Stats()` — Aggregate statistics (total, resolved, by severity/service)

### 6. Root Cause Analysis

The engine automatically classifies incidents by root cause:

```go
func rootCauseForErrors(w *Window, svc string) string {
    dep, internal := 0, 0
    for _, e := range w.Events {
        if e.Meta["type"] == "dependency" { dep++ } else { internal++ }
    }
    if dep > internal {
        return "Upstream dependency failure (database/ML/Redis)"
    }
    return "Internal service error"
}
```

---

## Dependency Monitoring

A background goroutine probes all dependencies every 30 seconds:

```go
func monitorDependencies(ctx context.Context, rdb, pool, mlURL, telemetry) {
    ticker := time.NewTicker(30 * time.Second)
    for {
        // Redis ping
        // PostgreSQL ping
        // ML service /health
        // ML model /metrics (drift + confidence)
    }
}
```

Each probe emits a telemetry event with `type=dependency` in the metadata, enabling the AIOps worker to distinguish dependency failures from internal errors.

---

## API Endpoints

### `GET /api/aiops/health`

Returns the current health score and component breakdown:

```json
{
  "score": 87,
  "status": "healthy",
  "components": {
    "api": {
      "score": 95,
      "error_rate": 0.001,
      "p95_latency_ms": 45.2,
      "drift_score": 0,
      "notes": ""
    },
    "ml": {
      "score": 82,
      "error_rate": 0.003,
      "p95_latency_ms": 120.5,
      "drift_score": 0.15,
      "notes": ""
    },
    "redis": {
      "score": 98,
      "error_rate": 0,
      "p95_latency_ms": 2.1,
      "drift_score": 0,
      "notes": ""
    },
    "postgres": {
      "score": 96,
      "error_rate": 0.001,
      "p95_latency_ms": 15.3,
      "drift_score": 0,
      "notes": ""
    }
  },
  "computed_at": "2026-07-21T12:00:00Z"
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEMETRY_STREAM` | Redis Stream key for telemetry events | Yes |
| `ALERT_EMAIL_FROM` | Sender email for incident alerts | No |
| `SMTP_HOST` | SMTP server for email alerts | No |
| `SMTP_PORT` | SMTP port (default: 587) | No |
| `SMTP_USER` | SMTP authentication user | No |
| `SMTP_PASSWORD` | SMTP authentication password | No |
| `ALERT_EMAIL_TO` | Recipient email for alerts | No |
| `GITHUB_TOKEN` | GitHub PAT for issue creation | No |
| `GITHUB_OWNER` | GitHub repo owner | No |
| `GITHUB_REPO` | GitHub repository name | No |
| `AIOPS_OWNER_EMAIL` | Owner email for alert escalation | No |

All alert channels are optional — the system gracefully skips unconfigured channels.

---

## Telemetry Flow

```
Request arrives
    │
    ├──► requestLogger() middleware
    │    Emits: {service: "api", kind: "request", operation: "/api/v1/transactions", status: "ok", latency: 45.2}
    │
    ├──► monitorDependencies() goroutine (every 30s)
    │    Emits: {service: "api", kind: "dependency", operation: "redis", status: "ok", latency: 2.1}
    │    Emits: {service: "api", kind: "dependency", operation: "ml-service", status: "error", latency: 5000}
    │    Emits: {service: "api", kind: "model", operation: "drift", drift_score: 0.15}
    │
    └──► Worker.consume()
         Reads from Redis Stream
         Ingests into sliding window (500 events)
         
         Worker.analyze() (every 15s)
         ├── ComputeHealth() → Score 87 (healthy)
         └── DetectIncidents() → ml-service error rate >20%
              └── Alert pipeline
                   ├── SendEmail() → SMTP
                   ├── DraftGitHubIssue() → GitHub API
                   └── Report() → Redis Stream
```

---

## Self-Healing Behavior

When the AIOps worker detects a dependency failure:

1. **Detection**: Dependency probe emits event with `status: "error"` and `meta.type = "dependency"`
2. **Ingestion**: Worker ingests the event into its sliding window
3. **Retry**: Worker calls `retry()` which re-emits the event as a retry attempt
4. **Recovery**: The original operation is reattempted (e.g., re-ping Redis, re-query PostgreSQL)
5. **Reporting**: If retry succeeds, the incident resolves. If not, alerts continue firing.

This provides automatic recovery from transient failures (network blips, temporary overloads) without human intervention.

---

## Performance Overhead

| Component | Overhead |
|-----------|----------|
| Telemetry emission | <1μs per event (fire-and-forget Redis XADD) |
| Worker consume | 2s block timeout (no CPU when idle) |
| Worker analyze | 15s interval, <1ms compute |
| Health scoring | O(n) over 500-event window |
| Incident detection | O(n) per service (4 services) |

**Total overhead**: <5μs per request, negligible impact on production traffic.
