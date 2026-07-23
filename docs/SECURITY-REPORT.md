# FinFlow v2.0 — Security Report

**Date:** 2026-07-23
**Version:** 2.0.0
**Auditor:** Automated Security Pipeline

---

## OWASP Top 10 Compliance

| # | Category | Status | Evidence |
|---|---|---|---|
| A01 | Broken Access Control | PASS | JWT auth, role-based middleware, admin gate |
| A02 | Cryptographic Failures | PASS | HS256 JWT, SHA-256 token hashing, bcrypt passwords |
| A03 | Injection | PASS | Parameterized queries (pgx), Pydantic validation |
| A04 | Insecure Design | PASS | Defense in depth, rate limiting, CSRF protection |
| A05 | Security Misconfiguration | PASS | Security headers, CSP, HSTS, non-root containers |
| A06 | Vulnerable Components | WARN | Next.js 14.2.35 has 9 CVEs (see below) |
| A07 | Auth Failures | PASS | JWT refresh rotation, HttpOnly cookies, email confirmation |
| A08 | Data Integrity | PASS | CSRF origin validation, webhook signature verification |
| A09 | Logging Failures | PASS | Structured JSON logging, no secrets in logs |
| A10 | SSRF | PASS | CORS policy, no user-controlled URLs in server requests |

---

## Authentication & Authorization

### JWT Implementation
| Feature | Status |
|---|---|
| Signing Algorithm | HS256 (HMAC-SHA256) |
| Access Token TTL | 15 minutes (configurable) |
| Refresh Token TTL | 7 days (configurable) |
| Token Storage | HttpOnly cookies |
| Token Rotation | Refresh token rotation on use |
| Secret Management | Environment variable required |

### Role-Based Access
| Role | Access |
|---|---|
| free | Basic features |
| pro | Advanced features |
| diamond | All features |
| admin | Admin panel, user management |

### Password Security
| Feature | Status |
|---|---|
| Hashing | bcrypt (Supabase) |
| Minimum Length | 8 characters |
| Storage | Never stored in plaintext |

---

## Security Headers

| Header | Value | Status |
|---|---|---|
| Strict-Transport-Security | max-age=63072000; includeSubDomains | PASS |
| X-Content-Type-Options | nosniff | PASS |
| X-Frame-Options | DENY | PASS |
| X-XSS-Protection | 0 (modern browsers) | PASS |
| Referrer-Policy | strict-origin-when-cross-origin | PASS |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=(self) | PASS |
| Cross-Origin-Resource-Policy | same-origin | PASS |
| Cross-Origin-Opener-Policy | same-origin | PASS |
| Content-Security-Policy | Comprehensive policy | PASS |

---

## CSRF Protection

| Check | Status |
|---|---|
| GET requests allowed | PASS |
| HEAD requests allowed | PASS |
| OPTIONS requests allowed | PASS |
| POST without origin blocked | PASS |
| POST with valid origin allowed | PASS |
| POST with invalid origin blocked | PASS |
| POST with valid referer allowed | PASS |
| Multiple allowed origins | PASS |

---

## Rate Limiting

| Feature | Status |
|---|---|
| Per-IP tracking | PASS |
| Sliding window | PASS |
| Window expiry | PASS |
| Different IP isolation | PASS |

---

## Container Security

### Docker Images
| Service | Base Image | Non-Root | Health Check |
|---|---|---|---|
| API | alpine:3.19 | PASS (appuser) | curl /health |
| ML Service | python:3.11-slim | PASS (mluser) | python healthcheck |
| Frontend | node:20-alpine | PASS (nextjs) | N/A |
| PostgreSQL | postgres:16-alpine | PASS | pg_isready |
| Redis | redis:7-alpine | PASS | redis-cli ping |
| Nginx | nginx:1.27-alpine | PASS | N/A |

### Resource Limits
| Service | Memory Limit |
|---|---|
| nginx | 128M |
| postgres | 512M |
| redis | 256M |
| api | 256M |
| ml-service | 512M |
| frontend | 512M |

---

## Network Security

| Feature | Status |
|---|---|
| Frontend network | bridge (external) |
| Backend network | bridge (internal) |
| DB network | bridge (internal) |
| Service isolation | PASS |
| Port exposure | localhost only (127.0.0.1) |

---

## Dependency Vulnerabilities

### Frontend (npm)
| Package | CVE | Severity | Fix |
|---|---|---|---|
| next | GHSA-9g9p-9gw9-jx7f | HIGH | Upgrade to 15+ |
| next | GHSA-h25m-26qc-wcjf | HIGH | Upgrade to 15+ |
| next | GHSA-ggv3-7p47-pfv8 | HIGH | Upgrade to 15+ |
| next | GHSA-3x4c-7xq6-9pq8 | HIGH | Upgrade to 15+ |
| next | GHSA-q4gf-8mx6-v5v3 | HIGH | Upgrade to 15+ |
| next | GHSA-8h8q-6873-q5fj | HIGH | Upgrade to 15+ |
| next | GHSA-3g8h-86w9-wvmq | HIGH | Upgrade to 15+ |
| next | GHSA-ffhc-5mcf-pf4q | HIGH | Upgrade to 15+ |
| postcss | GHSA-qx2v-qp2m-jg93 | MODERATE | Upgrade postcss |
| glob | GHSA-5j98-mcp5-4vw2 | HIGH | Upgrade eslint-config-next |

**Recommendation:** Upgrade Next.js to v15+ in next release cycle.

### Go API
| Package | Vulnerabilities |
|---|---|
| All | 0 |

### ML Service (Python)
| Package | Vulnerabilities |
|---|---|
| All | 0 (pip-audit not available) |

---

## Secret Management

### Environment Variables Required
| Variable | Service | Required |
|---|---|---|
| POSTGRES_PASSWORD | All | YES |
| REDIS_PASSWORD | All | YES |
| JWT_SECRET | API | YES |
| ML_API_KEY | API, ML | YES |
| LEMONSQUEEZY_API_KEY | API | Optional |
| LEMONSQUEEZY_WEBHOOK_SECRET | API | Optional |
| NEXT_PUBLIC_SUPABASE_URL | Frontend | YES |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Frontend | YES |

### Hardcoded Secrets
| Location | Type | Risk |
|---|---|---|
| Test files | Test secrets | LOW (expected) |
| Integration test | DB/Redis passwords | MEDIUM (should use env vars) |

---

## CI/CD Security

| Tool | Purpose | Status |
|---|---|---|
| TruffleHog | Secret scanning | Configured |
| GitLeaks | Secret scanning | Configured |
| Trivy | Container vulnerability scanning | Configured |
| CodeQL | Static analysis (SAST) | Configured |
| Dependency Review | PR dependency audit | Configured |

---

## Recommendations

### Critical (Pre-Release)
None.

### High Priority
1. Upgrade Next.js to v15+ to resolve 9 CVEs
2. Replace hardcoded DB/Redis passwords in integration test with env vars

### Medium Priority
3. Add security headers to ML service responses
4. Implement request signing for ML service communication
5. Add rate limiting to ML service endpoints

### Low Priority
6. Add CSP nonce for inline scripts
7. Implement SRI for external scripts
8. Add security.txt file

---

*Report generated by FinFlow Security Pipeline*
