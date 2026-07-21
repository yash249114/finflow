# Roadmap

FinFlow's product roadmap — from current capabilities to future vision.

---

## Current Release: v1.0 (Complete)

### Core Platform
- [x] CSV upload with smart parsing (pipe, tab, comma delimiters)
- [x] ML-powered transaction categorization (TF-IDF + LogReg, 97.4% accuracy)
- [x] 90-day cash flow forecasting (Holt-Winters, 30/60/90 horizons)
- [x] Real-time dashboard with Recharts visualizations
- [x] Transaction listing with pagination and filters
- [x] Cash flow summary with category breakdowns

### Authentication & Security
- [x] Supabase Auth integration (email + Google OAuth)
- [x] JWT with httpOnly cookies and refresh token rotation
- [x] CSRF protection on all state-changing requests
- [x] 10 security headers (HSTS, CSP, CORP, COOP, COEP, etc.)
- [x] Sliding window rate limiting (Nginx + Redis)
- [x] Path traversal prevention, input validation, parameterized queries

### AI Copilot
- [x] Free tier: Offline knowledge base (20+ financial topics)
- [x] Pro tier: GPT-4o-mini direct access
- [x] Max tier: Gemini → Claude → GPT-4o fallback chain
- [x] Confidence scoring with auto-ticket creation
- [x] Chat history support

### Billing
- [x] 3-tier SaaS billing (Free / Pro / Max)
- [x] Lemon Squeezy integration (checkout, portal, webhooks)
- [x] 10-currency regional pricing
- [x] Webhook idempotency
- [x] HMAC signature verification

### AIOps
- [x] Telemetry pipeline (Redis Streams)
- [x] Health scoring (0-100, per-component)
- [x] Incident detection (error rate, model drift)
- [x] Self-healing (automatic retry on dependency failure)
- [x] Multi-channel alerts (email, GitHub issues, Web3Forms)
- [x] Root cause analysis (dependency vs internal)
- [x] Incident memory with lifecycle tracking

### Infrastructure
- [x] Docker Compose with 5 services + Nginx
- [x] PostgreSQL 16 with 4 migration files
- [x] Redis 7 for caching, rate limiting, event streaming
- [x] Nginx reverse proxy with TLS support
- [x] GitHub Actions CI/CD (9 parallel jobs)
- [x] Security scanning (GitLeaks, TruffleHog, Trivy, CodeQL)
- [x] Dependabot for automated dependency updates

### Testing
- [x] 82 Go API unit tests
- [x] 35 Python ML unit tests
- [x] Frontend lint (zero warnings)
- [x] 25/25 pages build successfully
- [x] Playwright E2E tests
- [x] Go middleware benchmarks (404K+ ops/sec)

---

## v1.1 — Real-Time & Export (In Progress)

**Target**: Q3 2026

### Real-Time Features
- [ ] WebSocket connection for live dashboard updates
- [ ] Push notifications for anomaly alerts
- [ ] Live transaction feed (auto-refresh without page reload)
- [ ] Real-time forecast updates as new data arrives

### Export & Reporting
- [ ] PDF export for forecasts and summaries
- [ ] Excel/CSV export with custom date ranges
- [ ] Scheduled report delivery (daily/weekly email summaries)
- [ ] Custom report builder (drag-and-drop metrics)

### UX Improvements
- [ ] Dark mode toggle (system preference detection)
- [ ] Keyboard shortcuts for power users
- [ ] Bulk transaction editing (select, recategorize, delete)
- [ ] Transaction search with full-text search
- [ ] Date range picker with presets (This Month, Last Quarter, YTD)

### Performance
- [ ] Lazy-load Recharts (reduce Dashboard first-load by ~100 KB)
- [ ] Service worker for offline CSV upload queuing
- [ ] Optimistic UI updates for better perceived performance

---

## v1.2 — Integrations & Teams (Planned)

**Target**: Q4 2026

### Bank Integrations
- [ ] Plaid integration (auto-sync bank transactions)
- [ ] Stripe integration (payment data enrichment)
- [ ] QuickBooks import/export
- [ ] Xero import/export

### Multi-Currency & International
- [ ] Multi-currency transaction support
- [ ] Automatic currency conversion
- [ ] Regional tax rules (US, EU, UK, India)
- [ ] Localized number/date formatting

### Team Accounts
- [ ] Multi-user organizations
- [ ] Role-based access control (Owner, Admin, Viewer)
- [ ] Team invitation flow
- [ ] Shared transaction libraries
- [ ] Audit log for team actions

### Advanced Analytics
- [ ] Cohort analysis (customer segments, revenue cohorts)
- [ ] What-if scenario modeling
- [ ] Comparative analysis (month-over-month, year-over-year)
- [ ] Custom KPI tracking (MRR, ARR, LTV, CAC, Burn Multiple)

### API & Integrations
- [ ] Public REST API with API key authentication
- [ ] Webhook support for external integrations
- [ ] Zapier / Make.com integration
- [ ] Slack notifications for financial alerts

---

## v2.0 — Platform & Scale (Vision)

**Target**: 2027

### Mobile App
- [ ] React Native mobile application
- [ ] Biometric authentication (Face ID, Touch ID)
- [ ] Receipt scanning with OCR
- [ ] Push notifications for real-time alerts
- [ ] Offline mode with sync

### AI Enhancements
- [ ] Natural language queries ("Show me all expenses over $1000 last month")
- [ ] Predictive insights ("You'll run out of runway in 4 months at current burn")
- [ ] Anomaly explanation ("This expense is 3x your average because...")
- [ ] Automatic bill payment scheduling
- [ ] Vendor comparison ("Your AWS bill is 40% higher than similar companies")

### Marketplace & Extensions
- [ ] Plugin system for custom analytics
- [ ] Industry-specific templates (SaaS, E-commerce, Services)
- [ ] Custom category creation with user-trained models
- [ ] White-label solution for accountants and advisors

### Enterprise
- [ ] SSO (SAML, OIDC)
- [ ] SOC 2 compliance
- [ ] Data residency options (US, EU, APAC)
- [ ] Custom SLA and support tiers
- [ ] On-premise deployment option

### Intelligence
- [ ] Cross-company benchmarking (anonymized)
- [ ] Market data integration (interest rates, inflation)
- [ ] Investment tracking and portfolio analysis
- [ ] Tax optimization recommendations
- [ ] Cash flow simulation ("What if we hire 5 engineers?")

---

## Feature Request Process

Have an idea? Here's how it gets prioritized:

1. **Open an Issue** — Describe the feature, use case, and expected behavior
2. **Community Vote** — React with 👍 to show support
3. **Triage** — Maintainers review weekly
4. **Prioritization** — Features are categorized:
   - **P0 (Critical)** — Security, data loss, production breakage
   - **P1 (High)** — High impact, frequently requested
   - **P2 (Medium)** — Nice to have, moderate impact
   - **P3 (Low)** — Future consideration, low urgency

---

## Technology Evolution

| Area | Current | Planned |
|------|---------|---------|
| Frontend | Next.js 14, React 18 | React 19, Server Actions |
| API | Go 1.24, Gin | Go 1.25+, possible gRPC |
| ML | scikit-learn, statsmodels | PyTorch, custom transformers |
| Database | PostgreSQL 16 | + TimescaleDB for time-series |
| Cache | Redis 7 | + Upstash for serverless edge |
| Auth | Supabase | + Custom OAuth provider |
| Billing | Lemon Squeezy | + Stripe direct |

---

## Contributing to the Roadmap

We welcome community input on priorities:

- **Vote** on existing feature requests via GitHub Issues
- **Propose** new features with detailed use cases
- **Contribute** — see [Contributing.md](Contributing.md)
- **Sponsor** — Financial support accelerates development

---

*This roadmap is a living document and will be updated as the project evolves.*
