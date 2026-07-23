# Architecture

FinFlow is a three-tier microservice platform with clear separation of concerns, designed for horizontal scaling and independent deployment.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Landing Page     │  │  Dashboard       │  │  Admin Panel     │   │
│  │  (SSG, SEO)      │  │  (CSR + SSG)     │  │  (CSR, role-gated│   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           └─────────────────────┼──────────────────────┘             │
│                                 │                                    │
│                    ┌────────────▼────────────┐                       │
│                    │   Next.js 14 Frontend   │                       │
│                    │   React 18 + TypeScript │                       │
│                    │   Tailwind + Radix UI   │                       │
│                    └────────────┬────────────┘                       │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │ HTTPS (JWT Cookie)
┌─────────────────────────────────┼────────────────────────────────────┐
│                          API GATEWAY                                  │
│                                 │                                    │
│                    ┌────────────▼────────────┐                       │
│                    │   Nginx Reverse Proxy   │                       │
│                    │   TLS · Rate Limiting   │                       │
│                    │   Security Headers      │                       │
│                    └────────────┬────────────┘                       │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                         APPLICATION LAYER                             │
│                                 │                                    │
│  ┌──────────────────────────────▼──────────────────────────────┐    │
│  │                    Go API (Gin)                              │    │
│  │                                                              │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │    │
│  │  │  Auth    │ │  Upload  │ │ Forecast │ │ Billing  │       │    │
│  │  │ Handler  │ │ Handler  │ │ Handler  │ │ Handler  │       │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │    │
│  │       │            │            │            │               │    │
│  │  ┌────▼────────────▼────────────▼────────────▼─────┐        │    │
│  │  │              Middleware Stack                    │        │    │
│  │  │  Recovery → Logger → SecurityHeaders → CORS     │        │    │
│  │  │  → Redis Inject → RateLimit → Auth → CSRF       │        │    │
│  │  └─────────────────────────────────────────────────┘        │    │
│  │                                                              │    │
│  │  ┌─────────────────────────────────────────────────┐        │    │
│  │  │              AIOps Subsystem                     │        │    │
│  │  │  Publisher → Redis Stream → Worker → Alerter     │        │    │
│  │  └─────────────────────────────────────────────────┘        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                          DATA LAYER                                   │
│                                 │                                    │
│  ┌──────────────┐  ┌────────────▼───────┐  ┌──────────────────┐    │
│  │  PostgreSQL   │  │     Redis 7        │  │   ML Service     │    │
│  │  16           │  │                    │  │   FastAPI        │    │
│  │              │  │  • Session cache    │  │   scikit-learn   │    │
│  │  • users     │  │  • Forecast cache   │  │   statsmodels    │    │
│  │  • txns      │  │  • Rate limiting    │  │                  │    │
│  │  • tokens    │  │  • Telemetry stream │  │  • Categorizer   │    │
│  │  • webhooks  │  │  • AIOps state      │  │  • Forecaster    │    │
│  └──────────────┘  └────────────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Separation of Concerns
Each service has a single responsibility:
- **Frontend**: UI rendering, client-side state, auth context
- **API**: Business logic, auth, billing, data aggregation
- **ML Service**: Model inference, training, metrics
- **Redis**: Caching, rate limiting, event streaming
- **PostgreSQL**: Persistent storage, ACID transactions

### 2. Defense in Depth
Security is layered at every boundary:
- **Nginx**: Rate limiting, request size limits, header filtering
- **API middleware**: JWT validation, CSRF tokens, security headers
- **Application**: Input sanitization, parameterized queries, plan gating
- **Data**: Row-level security (user_id scoping), encrypted tokens

### 3. Event-Driven AIOps
The AIOps subsystem uses Redis Streams as a lightweight event bus:
- Every request emits a telemetry event
- The worker consumes events, computes health scores, detects incidents
- Failed dependency calls trigger automatic retries (self-healing)
- Incidents route through a multi-channel alert pipeline

### 4. Plan-Based Feature Gating
Features are gated at both API and UI levels:
- **Free**: CSV upload, categorization, anomaly detection, basic AI
- **Pro**: Forecasting, advanced AI (GPT-4o), predictive alerts
- **Max**: Multi-model AI chain (Gemini → Claude → GPT), CFO assistant

---

## Data Flow

### Transaction Ingestion Pipeline

```
CSV Upload ──► File Parser ──► Row Validator ──► ML Classifier ──► DB Insert
    │              │               │                  │              │
    │              │               │                  │              │
    ▼              ▼               ▼                  ▼              ▼
  Chunked      Handle pipes,   Validate dates,   TF-IDF +      Batch INSERT
  upload       tabs, commas,   amounts, dedup    LogReg         via pgx
  (100MB+)     encoding        against user      classify       CopyFrom
```

### Forecast Pipeline

```
User Request ──► Redis Cache Check ──► (miss) ──► Fetch 90 days ──► ML Service
    │                    │                              │                │
    │                    │                              │                ▼
    │                    │                              │          Holt-Winters
    │                    │                              │          extrapolation
    │                    │                              │                │
    ▼                    ▼                              ▼                ▼
  Cached           Return cache                    Format as        30/60/90 day
  response                                       ForecastTx         projections
                                                  array              with CI bands
```

### AI Copilot Routing

```
Chat Request ──► Plan Check ──► Provider Routing ──► Response ──► Confidence Check
    │               │                │                  │              │
    │               │                │                  │              ▼
    │               │                │                  │         < 0.4? Create
    │               │                │                  │         ticket + flag
    │               │                │                  │              │
    │               ▼                ▼                  ▼              ▼
    │          Free: KB         Pro: GPT-4o       Max: Gemini      Return to
    │          (offline)        (direct)          → Claude → GPT    client
    │                                                  │
    │                                                  ▼
    │                                            First success
    │                                            wins (fallback)
```

---

## Database Schema

### Entity Relationship

```
┌─────────────────┐       ┌──────────────────────┐
│     users        │       │    transactions       │
├─────────────────┤       ├──────────────────────┤
│ id        UUID  │◄──┐   │ id          UUID     │
│ email     VARCHAR│   │   │ user_id     UUID     │──► FK → users.id
│ password_hash    │   │   │ date        DATE     │
│ full_name VARCHAR│   │   │ description TEXT     │
│ plan      VARCHAR│   │   │ amount      NUMERIC  │
│ ls_customer_id   │   │   │ category    VARCHAR  │
│ created_at       │   │   │ source      VARCHAR  │
└─────────────────┘   │   │ created_at           │
                      │   └──────────────────────┘
                      │
                      │   ┌──────────────────────┐
                      │   │   refresh_tokens      │
                      │   ├──────────────────────┤
                      │   │ id          UUID      │
                      ├───│ user_id     UUID      │──► FK → users.id
                      │   │ token_hash  TEXT      │
                      │   │ expires_at  TIMESTAMPTZ
                      │   │ created_at           │
                      │   └──────────────────────┘
                      │
                      │   ┌──────────────────────┐
                      │   │   webhook_events      │
                      │   ├──────────────────────┤
                      │   │ id          UUID      │
                      │   │ event_name  VARCHAR   │
                      │   │ event_id    VARCHAR   │  UNIQUE (idempotency)
                      │   │ processed_at          │
                      │   └──────────────────────┘
```

### Key Design Decisions

1. **UUID primary keys**: Generated server-side via `pgcrypto.gen_random_uuid()`. No sequential IDs exposed.

2. **Soft amounts**: `NUMERIC(12,2)` with sign convention: positive = income, negative = expense. No separate type column needed.

3. **Cascade deletes**: Deleting a user cascades to transactions and refresh tokens. Clean data lifecycle.

4. **Idempotent webhooks**: The `webhook_events` table uses a `UNIQUE` constraint on `event_id` to prevent duplicate processing.

5. **Plan in users table**: The `plan` column is a simple VARCHAR enum (`free`/`pro`/`max`). Updated by Lemon Squeezy webhook.

---

## Service Communication

### API → ML Service
- **Protocol**: HTTP/1.1 with API key authentication
- **Timeout**: 25 seconds for classification, 30 seconds for forecasting
- **Body limit**: 10MB max request, 1MB max response
- **Error handling**: Generic error messages to client (no internal details leaked)

### API → Redis
- **Connection**: go-redis v9 with connection pooling
- **Usage**: Forecast caching (1hr TTL), rate limiting (sliding window), AIOps event streaming
- **Resilience**: Graceful degradation if Redis unavailable (caching disabled, rate limiting disabled)

### API → PostgreSQL
- **Connection pool**: pgx/v5 with configurable pool size
- **Queries**: Parameterized (no SQL injection)
- **Transactions**: Used for batch inserts (atomicity guarantee)

### Frontend → API
- **Auth**: JWT in httpOnly cookie + CSRF token in header
- **Protocol**: HTTPS only in production
- **CORS**: Strict origin allowlist

---

## Scalability Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| Frontend | CDN (Vercel edge network), static generation |
| API | Horizontal (stateless, JWT auth) |
| ML Service | Horizontal (model loaded in memory, stateless inference) |
| PostgreSQL | Vertical (connection pooling via pgx) |
| Redis | Vertical (memory), optional cluster mode |

### Bottlenecks & Mitigations

1. **CSV processing**: Chunked upload + async pipeline prevents request timeouts
2. **ML inference**: Model pre-loaded at startup, batch classification reduces per-request overhead
3. **Forecast computation**: Redis caching (1hr TTL) eliminates redundant Holt-Winters runs
4. **AIOps**: Redis Streams provide backpressure without message loss

---

## Technology Rationale

| Choice | Why |
|--------|-----|
| **Go for API** | Sub-millisecond middleware, strong typing, excellent concurrency |
| **Next.js for frontend** | Static generation for SEO, API routes for AI proxy, React ecosystem |
| **Python for ML** | scikit-learn + statsmodels are battle-tested, fast to prototype |
| **PostgreSQL** | ACID compliance, JSON support, mature ecosystem |
| **Redis** | Sub-millisecond caching, native streams for event processing |
| **Gin** | Minimal overhead (3μs middleware), middleware composition |
| **Razorpay** | Payment processing and subscription management |
| **Supabase Auth** | Managed auth with OAuth, MFA, and row-level security |
