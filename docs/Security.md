# Security

FinFlow implements defense-in-depth security across all layers: network, application, data, and infrastructure.

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NETWORK LAYER                            │
│  Nginx rate limiting · TLS termination · Header filtering   │
├─────────────────────────────────────────────────────────────┤
│                   APPLICATION LAYER                         │
│  JWT auth · CSRF protection · Input validation · CORS       │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                              │
│  Parameterized queries · Row-level isolation · UUID PKs     │
├─────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                       │
│  Container isolation · Secret scanning · Dependency audit    │
├─────────────────────────────────────────────────────────────┤
│                    OBSERVABILITY LAYER                      │
│  AIOps monitoring · Incident detection · Auto-remediation   │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication & Authorization

### JWT Implementation

- **Algorithm**: HMAC-SHA256 (HS256)
- **Access token**: 15-minute TTL, httpOnly cookie
- **Refresh token**: 7-day TTL, httpOnly cookie, stored as SHA-256 hash in database
- **Token rotation**: Every refresh generates a new token pair; old refresh token is revoked

### Auth Flow

```
User ──► Login ──► Supabase Auth ──► JWT signed by API ──► httpOnly cookie
                                                                    │
User ◄── Protected Page ◄── API validates JWT ◄── Request arrives ──┘
```

### Plan-Based Access Control

```go
// Middleware: RequirePro() gates forecast and advanced features
func RequirePro() gin.HandlerFunc {
    return func(c *gin.Context) {
        plan, _ := c.Get("user_plan")
        if plan.(string) != "pro" && plan.(string) != "max" {
            c.AbortWithStatusJSON(403, gin.H{"error": "pro plan required"})
            return
        }
        c.Next()
    }
}
```

| Feature | Free | Pro | Max |
|---------|------|-----|-----|
| CSV upload | ✅ | ✅ | ✅ |
| Categorization | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| AI chat (offline) | ✅ | ✅ | ✅ |
| Forecasting | ❌ | ✅ | ✅ |
| AI chat (GPT-4o) | ❌ | ✅ | ✅ |
| AI chat (multi-model) | ❌ | ❌ | ✅ |

---

## CSRF Protection

All state-changing requests (POST, PUT, DELETE) require a CSRF token:

```
Request flow:
1. Client sends GET to any page → server sets CSRF token in cookie
2. Client reads cookie value and sends it as X-CSRF-Token header on POST
3. Server validates Origin/Referer header matches allowed frontend URL
4. Server compares cookie token with header token
```

**Implementation**: `api/internal/middleware/auth.go`

```go
func CSRF(frontendURL string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // GET requests pass through (set cookie)
        // Non-GET requests must have matching Origin/Referer
        // Token comparison using constant-time comparison
    }
}
```

---

## Security Headers

10 security headers applied to every response via Go middleware and Nginx:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `0` | Disable legacy XSS filter (use CSP) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer information |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable browser features |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block cross-origin reads |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Require CORS for resources |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; ...` | Restrict resource loading |

---

## Rate Limiting

### API-Level (Redis Sliding Window)

```go
// Per-IP sliding window rate limiter
func RateLimit(redisURL string) gin.HandlerFunc {
    // Window: 60 seconds
    // Max requests: configurable per endpoint group
    // Response: 429 Too Many Requests
}
```

### Nginx-Level

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
```

### Rate Limit Table

| Endpoint | Nginx Rate | API Rate | Burst |
|----------|------------|----------|-------|
| Auth (login/register) | 5/s | Sliding window | 3 |
| General (health) | 50/s | — | — |
| API endpoints | 100/s | Sliding window | 20 |

---

## Input Validation

### CSV Upload

- File size limit: 100MB (configurable)
- Row limit: 100,000 rows per upload
- MIME type validation
- Encoding detection (UTF-8, Latin-1, etc.)

### SQL Injection Prevention

All database queries use parameterized statements:

```go
// ✅ Safe: parameterized query
pool.Query(ctx, "SELECT * FROM users WHERE id = $1", userID)

// ❌ Never: string interpolation
pool.Query(ctx, fmt.Sprintf("SELECT * FROM users WHERE id = '%s'", userID))
```

### Path Traversal Prevention

File operations validate and sanitize user-provided paths:

```go
// upload_id is validated against alphanumeric + hyphens/underscores only
for _, ch := range uploadID {
    if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || 
         (ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
        c.JSON(400, gin.H{"error": "invalid upload_id format"})
        return
    }
}
```

### Request Body Size Limits

| Component | Limit |
|-----------|-------|
| Nginx | 25 MB |
| Go API | Default Gin limit |
| ML Service | 10 MB (middleware check) |
| ML Client Response | 1 MB (io.LimitReader) |

---

## Data Isolation

### Row-Level Scoping

Every transaction query is scoped to the authenticated user:

```go
// All queries include user_id filter
conditions := []string{"user_id = $1"}
args := []interface{}{userID}
```

### UUID Primary Keys

All primary keys use UUID v4 (random), generated server-side:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

No sequential IDs are exposed. No IDOR (Insecure Direct Object Reference) possible.

### Cascade Deletes

```sql
-- Deleting a user cascades to all their data
ALTER TABLE transactions ADD CONSTRAINT fk_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

## Webhook Security

### HMAC Signature Verification

Lemon Squeezy webhooks are verified using HMAC-SHA256:

```go
func (h *BillingHandler) Webhook(c *gin.Context) {
    signature := c.GetHeader("X-Signature")
    body, _ := io.ReadAll(c.Request.Body)
    
    mac := hmac.New(sha256.New, []byte(webhookSecret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    
    if subtle.ConstantTimeCompare([]byte(signature), []byte(expected)) != 1 {
        c.AbortWithStatusJSON(401, gin.H{"error": "invalid signature"})
        return
    }
}
```

### Idempotency

```sql
-- webhook_events table prevents duplicate processing
UNIQUE constraint on event_id ensures each webhook is processed exactly once
```

---

## Secret Management

### Environment Variables

All secrets are stored as environment variables, never in code:

```bash
# .env.example contains placeholders only
JWT_SECRET=replace-with-64-char-random-string
ML_API_KEY=replace-with-random-32-char-min
```

### Secret Scanning

Three layers of secret scanning in CI/CD:

1. **GitLeaks** — Custom rules in `.gitleaks.toml` plus default ruleset
2. **TruffleHog** — Verified secret detection (only confirmed secrets)
3. **CodeQL** — Static analysis for hardcoded credentials

### Dependency Scanning

| Tool | Scope | Trigger |
|------|-------|---------|
| Trivy | Container + filesystem | Every push |
| npm audit | Frontend dependencies | Every push |
| Go vulnerabilities | API dependencies | Every push |
| Dependabot | All ecosystems | Weekly + PRs |
| Dependency Review | PR diffs | PRs only |

---

## Container Security

### Docker Best Practices

- **Alpine base images** — Minimal attack surface
- **Non-root user** — Containers run as non-root
- **Read-only mounts** — Config files mounted read-only
- **Resource limits** — Memory caps prevent DoS
- **Internal networks** — Database and ML service not exposed to host

### Network Isolation

```
frontend-net:  Nginx ↔ Frontend (external access)
backend-net:   Nginx ↔ API ↔ ML Service (internal only)
db-net:        API ↔ PostgreSQL ↔ Redis (internal only)
```

---

## Incident Response

### AIOps Auto-Remediation

When the AIOps system detects issues:

1. **Dependency failure** → Automatic retry with exponential backoff
2. **Error rate >20%** → Alert via email + GitHub issue
3. **Model drift >0.6** → Incident created + owner notified
4. **Critical severity** → Multiple alert channels activated simultaneously

### Manual Incident Response

```bash
# Check system health
curl http://localhost:8080/api/aiops/health

# View recent logs
docker compose logs -f --tail=100 api

# Restart specific service
docker compose restart api

# Full system restart
docker compose down && docker compose up -d
```

---

## Compliance Considerations

| Area | Implementation |
|------|---------------|
| Data encryption at rest | PostgreSQL column-level encryption (pgcrypto) |
| Data encryption in transit | TLS (HSTS enforced, 2-year max-age) |
| Password hashing | bcrypt (via Supabase Auth) |
| Session management | JWT with short TTL + refresh rotation |
| Audit logging | AIOps telemetry stream (all requests logged) |
| Right to deletion | CASCADE deletes on user removal |
| Data isolation | Row-level scoping on all queries |

---

## Security Checklist

- [x] JWT with httpOnly cookies (no XSS token theft)
- [x] CSRF tokens on all state-changing requests
- [x] 10 security headers on every response
- [x] Rate limiting (Nginx + Redis sliding window)
- [x] Parameterized SQL queries (no injection)
- [x] Input validation and sanitization
- [x] Path traversal prevention
- [x] HMAC webhook signature verification
- [x] Webhook idempotency
- [x] Response body size limits (DoS prevention)
- [x] UUID primary keys (no IDOR)
- [x] Row-level data isolation
- [x] Container network isolation
- [x] Secret scanning (GitLeaks + TruffleHog + CodeQL)
- [x] Dependency scanning (Trivy + npm audit + Dependabot)
- [x] AIOps monitoring and auto-remediation
- [x] Graceful degradation on dependency failures

---

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email security concerns to the repository owner
3. Include: description, steps to reproduce, potential impact
4. Allow reasonable time for remediation before public disclosure
