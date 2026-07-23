<div align="center">

# FinFlow

### AI-Native Financial Intelligence Platform

**Production-grade SaaS that ingests messy bank CSVs, auto-categorizes every transaction with ML, forecasts cash flow with Holt-Winters time-series analysis, and gives founders a CFO-level AI copilot — all in a real-time dashboard.**

---

[![CI](https://github.com/yash249114/finflow/actions/workflows/ci.yml/badge.svg)](https://github.com/yash249114/finflow/actions/workflows/ci.yml)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Live Demo](https://finflow-3js0lbb1a-yash249114s-projects.vercel.app) · [API Docs](docs/API.md) · [Architecture](docs/Architecture.md) · [Contributing](docs/Contributing.md)

</div>

---

## Demo

> **Upload any bank CSV → Watch ML categorize every transaction in real-time → See your 90-day cash flow forecast → Ask the AI copilot anything about your finances.**

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload ──► Categorize ──► Dashboard ──► Forecast ──► AI Chat   │
│  CSV        ML (TF-IDF     Recharts      Holt-Winters  GPT/Claude│
│  Parser     + LogReg)      Charts        30/60/90 days  /Gemini  │
└─────────────────────────────────────────────────────────────────┘
```

![Dashboard Screenshot](docs/images/dashboard.png)
![Forecast Screenshot](docs/images/forecast.png)
![Copilot Screenshot](docs/images/copilot.png)

---

## Live Deployment

| Service | URL | Stack |
|---------|-----|-------|
| **Frontend** | [finflow-3js0lbb1a-yash249114s-projects.vercel.app](https://finflow-3js0lbb1a-yash249114s-projects.vercel.app) | Next.js 14 (Vercel) |
| **API** | [finflow-api-axvw.onrender.com](https://finflow-api-axvw.onrender.com) | Go / Gin (Render) |
| **ML Service** | [finflow-ml.onrender.com](https://finflow-ml.onrender.com) | FastAPI / scikit-learn (Render) |

---

## Features

| Feature | Description |
|---------|-------------|
| **CSV Import** | Upload any bank export. Handles messy dates, currencies, pipe/tab/comma delimiters, and malformed rows automatically. Supports chunked upload for files 100MB+. |
| **ML Categorization** | TF-IDF + Logistic Regression trained on 326 labeled examples across 10 categories. 97.4% accuracy. Runs in <50ms. |
| **90-Day Forecasting** | Holt-Winters exponential smoothing with upper/lower confidence bands. 30/60/90-day horizons. Redis-cached. |
| **AI Copilot** | Plan-tiered LLM routing: Free (offline knowledge base), Pro (GPT-4o), Max (Gemini → Claude → GPT-4o fallback chain). |
| **Anomaly Detection** | Automatic flagging of unusual spending patterns using statistical deviation analysis. |
| **Real-Time Dashboard** | Recharts-powered analytics: cash flow charts, category breakdowns, financial health score, recent transactions. |
| **AIOps Self-Healing** | Telemetry-driven incident detection, auto-retry, GitHub issue drafting, email alerts, and health scoring (0-100). |
| **Billing** | 3-tier SaaS billing via Razorpay withh regional pricing (10 currencies), checkout, portal, and webhook idempotency. |
| **Security** | JWT auth (cookie + Bearer), CSRF protection, 10 security headers, rate limiting (sliding window), path traversal prevention. |
| **Admin Panel** | User management, system health monitoring, AIOps dashboard for platform operators. |

---

## Tech Stack

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 14 · React 18 · TypeScript · Tailwind CSS          │
│  Radix UI · Framer Motion · Recharts · Geist Font           │
├──────────────────────────────────────────────────────────────┤
│                         API LAYER                            │
│  Go 1.24 · Gin · pgx/v5 · go-redis/v9 · zerolog            │
│  JWT (golang-jwt) · UUID · CORS                              │
├──────────────────────────────────────────────────────────────┤
│                       ML SERVICE                             │
│  Python 3.11 · FastAPI · scikit-learn · statsmodels          │
│  TF-IDF + LogisticRegression · Holt-Winters · joblib         │
├──────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                          │
│  PostgreSQL 16 · Redis 7 · Docker · Nginx · GitHub Actions   │
│  Vercel (FE) — Render (API/ML) — Razorpay (billing)    │
├──────────────────────────────────────────────────────────────┤
│                      AI PROVIDERS                            │
│  OpenAI (GPT-4o) · Anthropic (Claude 3.5) · Google (Gemini)  │
├──────────────────────────────────────────────────────────────┤
│                     SECURITY & OBSERVABILITY                 │
│  Supabase Auth · Google reCAPTCHA · TruffleHog · Trivy       │
│  CodeQL · GitLeaks · AIOps (self-healing telemetry)          │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
                          ┌─────────────┐
                          │   Nginx     │
                          │  (TLS +     │
                          │  rate limit)│
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    │                         │
              ┌─────▼─────┐           ┌───────▼──────┐
              │  Frontend  │           │   Go API     │
              │  Next.js   │◄─────────►│   Gin        │
              │  (Vercel)  │  JWT      │   (Render)   │
              └────────────┘  Cookie   └──────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                        ┌─────▼─────┐   ┌─────▼─────┐   ┌────▼────┐
                        │ PostgreSQL │   │   Redis   │   │  ML     │
                        │     16     │   │     7     │   │ Service │
                        │ (Render)   │   │ (Render)  │   │FastAPI  │
                        └───────────┘   └───────────┘   └─────────┘
```

For the full architecture breakdown, see [docs/Architecture.md](docs/Architecture.md).

---

## Quick Start

### Prerequisites

- **Go** 1.24+
- **Node.js** 20+
- **Python** 3.11+
- **Docker** & Docker Compose
- **Supabase** project (free tier works)
- **Razorpay** account (for payment processing)

### 1. Clone & Configure

```bash
git clone https://github.com/yash249114/finflow.git
cd finflow
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/finflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-64-char-random-secret
ML_API_KEY=your-ml-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (AI providers)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

### 2. Run with Docker (Recommended)

```bash
docker compose up -d --build
```

This starts all 5 services: Nginx, Frontend, API, ML Service, PostgreSQL, and Redis.

### 3. Run Locally (Development)

```bash
# Terminal 1: Database
docker compose up postgres redis -d

# Terminal 2: API
cd api
go mod tidy
go run ./cmd/main.go

# Terminal 3: ML Service
cd ml-service
pip install -r requirements.txt
python main.py

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

**Services:**
- Frontend: http://localhost:3000
- API: http://localhost:8080
- ML Service: http://localhost:8001

---

## Folder Structure

```
finflow/
├── api/                          # Go API server
│   ├── cmd/main.go               # Entry point, route definitions
│   ├── internal/
│   │   ├── aiops/                # AIOps subsystem
│   │   │   ├── alerting.go       # Email, GitHub, Web3Forms alerts
│   │   │   ├── copilot.go        # AI copilot (GPT/Claude/Gemini routing)
│   │   │   ├── engine.go         # Health scoring, incident detection
│   │   │   ├── github.go         # GitHub issue creation
│   │   │   ├── recommendations.go # Proactive financial suggestions
│   │   │   ├── telemetry.go      # Redis Stream telemetry publisher
│   │   │   └── worker.go         # Telemetry consumer + self-healing loop
│   │   ├── config/config.go      # Environment config loader
│   │   ├── db/                   # PostgreSQL repos (users, transactions)
│   │   ├── handlers/             # HTTP handlers (auth, upload, forecast, billing, AI)
│   │   ├── middleware/           # JWT auth, CSRF, rate limiting, security headers
│   │   ├── models/               # Shared data models
│   │   └── services/
│   │       ├── csvparser/        # CSV ingestion pipeline
│   │       ├── jwt/              # JWT token generation/validation
│   │       └── mlclient/         # ML service HTTP client
│   ├── go.mod / go.sum
│   └── tests/                    # Stress tests
│
├── frontend/                     # Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/               # Login, Register
│   │   ├── (dashboard)/          # Dashboard, Transactions, Forecast, Copilot, Settings, Admin
│   │   ├── api/ai/chat/          # AI Chat API route (Next.js serverless)
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   ├── dashboard/            # Metric cards, AI insights, financial health
│   │   ├── landing/              # Hero, Features, Pricing, Testimonials
│   │   ├── layout/               # Navbar, Footer, Sidebar
│   │   └── ui/                   # Shared UI components (Radix + Tailwind)
│   ├── lib/
│   │   ├── auth-context.tsx      # Auth provider (Supabase)
│   │   ├── constants.ts          # Plan features, currencies, app config
│   │   └── motion.ts             # Framer Motion animation variants
│   └── tests/                    # Playwright E2E tests
│
├── ml-service/                   # Python ML microservice
│   ├── main.py                   # FastAPI entry point
│   ├── models/schemas.py         # Pydantic v2 request/response models
│   ├── routes/
│   │   ├── classify.py           # /classify endpoint
│   │   ├── forecast.py           # /forecast endpoint
│   │   └── metrics.py            # /metrics endpoint (drift + confidence)
│   ├── services/
│   │   ├── categorizer.py        # TF-IDF + LogisticRegression
│   │   └── forecaster.py         # Holt-Winters exponential smoothing
│   └── tests/                    # 35 unit tests
│
├── infra/
│   ├── db/migrations/            # PostgreSQL schema migrations (4 files)
│   └── nginx/nginx.conf          # Reverse proxy config
│
├── docs/                         # Documentation
├── .github/workflows/ci.yml     # CI/CD pipeline (9 jobs)
├── docker-compose.yml            # Full stack orchestration
├── .gitleaks.toml                # Secret scanning config
└── .env.example                  # Environment template
```

---

## API Overview

### Authentication

```bash
# Register
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"securepass123","full_name":"Your Name"}'

# Login (returns JWT cookies)
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"securepass123"}'
```

### Core Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/transactions/upload` | Yes | Upload CSV for categorization |
| `POST` | `/api/v1/transactions/upload/start` | Yes | Start chunked upload |
| `POST` | `/api/v1/transactions/upload/chunk` | Yes | Upload file chunk |
| `GET` | `/api/v1/transactions` | Yes | List transactions (paginated) |
| `GET` | `/api/v1/transactions/summary` | Yes | Cash flow summary |
| `GET` | `/api/v1/forecast` | Pro | 30/60/90-day forecast |
| `GET` | `/api/v1/forecast/quality` | Pro | Forecast accuracy metrics |
| `POST` | `/api/v1/ai/chat` | Yes | AI copilot chat |
| `GET` | `/api/v1/ai/recommendations` | Yes | Financial recommendations |
| `POST` | `/api/v1/billing/checkout` | Yes | Create Razorpay order for checkout |
| `POST` | `/api/v1/billing/portal` | Yes | Open billing portal |
| `GET` | `/health` | No | API health check |
| `GET` | `/api/aiops/health` | No | AIOps system health |

Full API reference: [docs/API.md](docs/API.md)

---

## AI Copilot

The copilot routes queries through a tiered provider chain:

```
┌─────────────────────────────────────────────────────┐
│                    MAX TIER                         │
│  Gemini Flash ──► Claude 3.5 Haiku ──► GPT-4o-mini │
│  (first success wins — automatic fallback)          │
├─────────────────────────────────────────────────────┤
│                    PRO TIER                         │
│  GPT-4o-mini (direct)                               │
├─────────────────────────────────────────────────────┤
│                   FREE TIER                         │
│  Offline knowledge base (pattern-matched)           │
│  20+ financial topics, deterministic responses      │
└─────────────────────────────────────────────────────┘
```

**Free tier knowledge base covers:** runway calculation, burn rate, cash flow management, anomaly detection, budgeting (50/30/20), MRR/LTV/CAC metrics, tax planning, fundraising readiness, accounts receivable/payable, payroll analysis, and more.

**Low-confidence auto-escalation:** When the AI responds with <40% confidence or detects unresolved queries, it automatically creates a support ticket routed to human agents.

---

## AIOps (Self-Healing Infrastructure)

FinFlow includes a built-in AIOps subsystem that monitors, diagnoses, and self-heals platform issues in real-time:

```
Request ──► Telemetry Publisher ──► Redis Stream ──► AIOps Worker
                                                         │
                                    ┌────────────────────┤
                                    ▼                    ▼
                              Health Scoring       Incident Detection
                              (0-100 score)        (error rate, drift)
                                    │                    │
                                    ▼                    ▼
                              Dashboard API        Alert Pipeline
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              Email Alert    GitHub Issue    Web3Forms Ticket
```

**Capabilities:**
- **Health scoring**: Computes a 0-100 score per service based on error rate, P95 latency, and model drift
- **Incident detection**: Alerts when error rate >20% or model drift >0.6
- **Self-healing**: Automatically retries failed dependency calls (Redis, Postgres, ML service)
- **Dependency monitoring**: Probes all services every 30 seconds
- **Root cause analysis**: Distinguishes between internal errors and upstream dependency failures
- **Multi-channel alerts**: Email (SMTP), GitHub issues, Web3Forms support tickets

Full AIOps documentation: [docs/AIOps.md](docs/AIOps.md)

---

## Rendering Engine

FinFlow's frontend uses a **static-first rendering strategy** with selective server-side rendering:

| Page | Strategy | Why |
|------|----------|-----|
| Landing (`/`) | Static (SSG) | SEO, fast first paint |
| Login/Register | Static + Client hydration | Auth state via Supabase client |
| Dashboard | Static shell + Client data fetch | Fast shell, real-time data |
| Transactions | Client-side | Dynamic filtering/pagination |
| Forecast | Client-side | Authenticated, plan-gated |
| Copilot | Client-side | WebSocket-like chat UI |
| Settings | Client-side | User-specific config |
| Admin | Client-side | Role-gated, admin only |

**Key patterns:**
- **Geist font** for premium typography (loaded via `geist` package)
- **Framer Motion** for all animations (staggered reveals, slide-ups, page transitions)
- **Radix UI** primitives for accessible, unstyled components
- **Recharts** for all data visualizations (area, line, pie, bar charts)
- **Responsive** mobile-first design with Tailwind CSS

---

## Test Coverage

| Suite | Tests | Status |
|-------|-------|--------|
| Go API (handlers) | 17 | ✅ All passing |
| Go API (middleware) | 27 | ✅ All passing |
| Go API (mlclient) | 14 | ✅ All passing |
| Go API (csvparser) | 13 | ✅ All passing |
| Go API (jwt) | 11 | ✅ All passing |
| Python ML | 35 | ✅ All passing |
| Frontend Lint | — | ✅ Zero warnings |
| Frontend Build | 25 pages | ✅ All generated |
| E2E (Playwright) | 20+ | ✅ Full flow |
| **Total** | **137+** | **All green** |

---

## Performance

| Metric | Value |
|--------|-------|
| Security Headers middleware | 404K ops/sec (3μs) |
| CSRF middleware | 1.6M ops/sec (778ns) |
| ML classification latency | <50ms |
| Forecast computation | <2s |
| Frontend shared JS | 87.5 KB |
| Largest page (Dashboard) | 329 KB |

---

## Deployment

### Docker Compose (Recommended)

```bash
docker compose up -d --build
```

This deploys all services with:
- Nginx reverse proxy (TLS-ready)
- Health checks on all services
- Resource limits (memory caps)
- Internal networks (frontend-net, backend-net, db-net)
- Persistent volumes (PostgreSQL, Redis, ML models)

### Vercel + Render (Production)

1. **Frontend**: Push to GitHub → Vercel auto-deploys
2. **API**: Docker image → Render web service
3. **ML Service**: Docker image → Render web service

### CI/CD Pipeline

Every push triggers 9 parallel jobs:
- Go API tests (vet, build, test)
- Python ML tests
- Frontend lint + build
- Playwright E2E tests
- Security scans (TruffleHog, Trivy, GitLeaks, CodeQL)
- Docker build verification
- Dependency review (PRs only)

Full deployment guide: [docs/Deployment.md](docs/Deployment.md)

---

## Roadmap

| Phase | Status | Milestones |
|-------|--------|------------|
| **v1.0** | ✅ Complete | Core platform, ML, billing, AIOps, security |
| **v1.1** | 🔄 In Progress | Real-time WebSocket updates, export to PDF/Excel |
| **v1.2** | 📋 Planned | Plaid integration, multi-currency, team accounts |
| **v2.0** | 🔮 Vision | Mobile app, API marketplace, white-label |

Full roadmap: [docs/Roadmap.md](docs/Roadmap.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/Architecture.md) | System architecture, data flow, design decisions |
| [AIOps](docs/AIOps.md) | Self-healing infrastructure deep dive |
| [API Reference](docs/API.md) | Complete API endpoint documentation |
| [Deployment](docs/Deployment.md) | Docker, Vercel, Render deployment guides |
| [Security](docs/Security.md) | Security model, threat analysis, compliance |
| [Contributing](docs/Contributing.md) | Development setup, PR guidelines, code standards |
| [Roadmap](docs/Roadmap.md) | Product roadmap and feature plans |

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

Built by **Yash** — [GitHub](https://github.com/yash249114) · [LinkedIn](https://linkedin.com/in/yash249114)

### Open Source Dependencies

- **[Next.js](https://nextjs.org/)** — React framework by Vercel
- **[Go](https://go.dev/)** — Fast, statically typed language by Google
- **[Gin](https://github.com/gin-gonic/gin)** — Go web framework
- **[FastAPI](https://fastapi.tiangolo.com/)** — Python web framework
- **[scikit-learn](https://scikit-learn.org/)** — Machine learning library
- **[statsmodels](https://www.statsmodels.org/)** — Time-series forecasting
- **[Recharts](https://recharts.org/)** — React charting library
- **[Radix UI](https://www.radix-ui.com/)** — Accessible UI primitives
- **[Framer Motion](https://www.framer.com/motion/)** — Animation library
- **[Supabase](https://supabase.com/)** — Auth and database
- **[Razorpay](https://razorpay.com/)** — Payment processing

---

<div align="center">

**Built with care. Shipped with confidence.**

*137+ tests. 19 bugs fixed. 0 critical issues. Production-ready.*

</div>
