# FinFlow — OWASP Top 10 Security Assessment

**Date:** 21 July 2026  
**Assessor:** Principal Security Engineer  
**Version:** 1.0.0

---

## A01:2021 — Broken Access Control

| Risk | Status | Notes |
|------|--------|-------|
| JWT authentication enforced on protected routes | ✅ Mitigated | `/api/v1/*` protected by auth middleware; AI chat moved to protected group |
| `/api/ai/chat` moved behind auth | ✅ Fixed | Previously public — now requires valid JWT |
| `/api/aiops/health` remains public | ⚠️ Accepted | Read-only health data, rate-limited |
| Plan gating on `/forecast` | ✅ Mitigated | `RequirePro` middleware enforces plan tier |
| **CVE risk score:** Low | | |

## A02:2021 — Cryptographic Failures

| Risk | Status | Notes |
|------|--------|-------|
| JWT signed with HMAC-SHA256 | ⚠️ Medium | Symmetric key; RS256 would be stronger. Key is env-var only |
| **Gemini API key in URL** | ✅ **FIXED** | Moved to `X-Goog-Api-Key` header — no longer sent as query param |
| Password hashing delegated to Supabase Auth | ✅ Mitigated | No passwords stored in API codebase |
| Tokens use short TTL (15m access, 7d refresh) | ✅ Mitigated | |
| **CVE risk score:** Low | | |

## A03:2021 — Injection

| Risk | Status | Notes |
|------|--------|-------|
| SQL injection | ✅ **Mitigated** | All queries use pgx parameterized placeholders (`$1`, `$2`) |
| CSV injection | ✅ **Fixed** | File size limits (20MB), row limits (100k), chunk validation, extension whitelist |
| Migration script SQL injection | ✅ **Fixed** | Sanitization regex + validation added |
| Log injection (ML service) | ⚠️ Low | User input appears in structured JSON logs only |
| **CVE risk score:** Low | | |

## A04:2021 — Insecure Design

| Risk | Status | Notes |
|------|--------|-------|
| Rate limiting added to all endpoints | ✅ **Fixed** | Global (100/min) + auth-specific (5/min) + AI chat (20/min) limits |
| Distributed Redis-based rate limiting | ✅ **Fixed** | Falls back to in-memory if Redis unavailable |
| Request size limiting (ML service) | ✅ **Fixed** | 10MB max body size middleware |
| No OTP in API (delegated to Supabase) | ✅ Acceptable | Supabase handles email verification |
| **CVE risk score:** Low | | |

## A05:2021 — Security Misconfiguration

| Risk | Status | Notes |
|------|--------|-------|
| Missing security headers | ✅ **FIXED** | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy, COOP, COEP, CORP all added |
| Server header leakage | ✅ **Fixed** | `Server: ""` set in middleware + nginx `server_tokens off` |
| Default database password | ✅ **FIXED** | Removed hardcoded `password` default from config.go and migrate.sh |
| Cookie security | ✅ **Mitigated** | Auth delegated to Supabase (cookies set by Supabase gateway) |
| CORS properly restricted | ✅ Mitigated | Single origin, credentials allowed only to configured frontend |
| **CVE risk score:** Low | | |

## A06:2021 — Vulnerable and Outdated Components

| Risk | Status | Notes |
|------|--------|-------|
| Go dependencies (gin, pgx, redis, jwt) | ✅ Current | v1.12.0, v5.6.0, v9.5.3, v5.2.1 — no known CVEs |
| Python dependencies (fastapi, sklearn, statsmodels) | ✅ Pinned | All versions pinned in requirements.txt |
| Node dependencies | ⚠️ Unknown | `npm audit` added to CI pipeline |
| Docker base images | ✅ Pinned | All use explicit version tags (no `latest`) |
| **CVE risk score:** Low-Medium | | |

## A07:2021 — Identification and Authentication Failures

| Risk | Status | Notes |
|------|--------|-------|
| Auth delegated to Supabase | ✅ Strong | Supabase Auth is SOC 2 compliant, handles MFA, OAuth, email verification |
| JWT validation with algorithm check | ✅ Strong | `jwt.ParseWithClaims` rejects non-HMAC algorithms |
| No brute-force protection on auth | ✅ **Fixed** | Auth-specific rate limiting (5 req/min per IP) via nginx + Go middleware |
| ML service API key enforcement | ✅ **FIXED** | No longer bypassable when `ML_API_KEY` is unset |
| **CVE risk score:** Low | | |

## A08:2021 — Software and Data Integrity Failures

| Risk | Status | Notes |
|------|--------|-------|
| Webhook signature verification | ✅ Strong | HMAC-SHA256 with constant-time comparison |
| Webhook idempotency | ✅ Strong | `webhook_events` table with UNIQUE `event_id` |
| No dependency supply-chain verification | ⚠️ Medium | No `go.sum` verification in CI, no `npm audit --audit-level=high` in CI yet |
| **CVE risk score:** Low-Medium | | |

## A09:2021 — Security Logging and Monitoring Failures

| Risk | Status | Notes |
|------|--------|-------|
| Structured JSON logging | ✅ Strong | zerolog for Go, structured JSON for Python |
| AIOps self-monitoring | ✅ Strong | Redis stream telemetry, dependency probes every 30s, auto-ticketing |
| Rate limit warnings logged | ✅ Present | `log.Warn()` on rate limit blocks |
| No centralized log aggregation | ⚠️ Medium | No ELK/Datadog/Grafana Loki configured (deployment concern) |
| **CVE risk score:** Low | | |

## A10:2021 — Server-Side Request Forgery (SSRF)

| Risk | Status | Notes |
|------|--------|-------|
| External API calls (OpenAI, Anthropic, Gemini) | ⚠️ Medium | URLs are hardcoded, not user-controlled. Safe from SSRF |
| ML service health probes | ✅ Mitigated | Hardcoded to internal Docker service names |
| Dependency monitors use fixed URLs | ✅ Mitigated | No user input in URL construction |
| **CVE risk score:** Low | | |

---

## Overall OWASP Risk Summary

| Category | Score |
|----------|-------|
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 4 (A02 JWT symmetric, A06 audit in CI, A08 supply chain, A10 SSRF) |
| **Low** | 6 |

**All critical and high-risk OWASP items have been remediated.**
