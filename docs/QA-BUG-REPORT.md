# FinFlow QA Bug Report

**Date**: 2026-07-21
**Environment**: Local (Windows), Production (Vercel/Render)
**Release Manager**: v1.0 RC Audit

---

## Bugs Found & Fixed

### BUG-001: Invalid Go version in go.mod
- **Severity**: HIGH (build-breaking)
- **File**: `api/go.mod`
- **Issue**: `go 1.25.0` does not exist (Go releases are 1.24, 1.26, etc.)
- **Fix**: Changed to `go 1.24`, ran `go mod tidy`
- **Status**: FIXED

### BUG-002: ML service `on_event` deprecation
- **Severity**: MEDIUM (deprecation warning, future breakage)
- **File**: `ml-service/main.py`
- **Issue**: `@app.on_event("startup")` deprecated in FastAPI, will be removed
- **Fix**: Migrated to `lifespan` async context manager pattern
- **Status**: FIXED

### BUG-003: Pydantic `protected_namespaces` warning
- **Severity**: MEDIUM (deprecation warning)
- **File**: `ml-service/models/schemas.py`
- **Issue**: `model_loaded` field conflicts with Pydantic v2 `model_` namespace
- **Fix**: Added `ConfigDict(protected_namespaces=())` to affected models
- **Status**: FIXED

### BUG-004: ML test flakiness (stale __pycache__)
- **Severity**: HIGH (tests fail non-deterministically)
- **File**: `ml-service/tests/test_metrics.py`
- **Issue**: `os.environ.setdefault` + cached modules caused 403 on metrics endpoint
- **Fix**: Added `tests/conftest.py` to ensure env var is set before any import; clear `__pycache__` resolves
- **Status**: FIXED

### BUG-005: Unused variables in AI chat route
- **Severity**: LOW (lint warning)
- **File**: `frontend/app/api/ai/chat/route.ts`
- **Issue**: Unused `errBody` and `err` variables
- **Fix**: Removed dead code
- **Status**: FIXED

### BUG-006: Categorizer crash on empty input
- **Severity**: MEDIUM (runtime error)
- **File**: `ml-service/services/categorizer.py`
- **Issue**: `classify([])` crashed with empty input list
- **Fix**: Added early return guard for empty input
- **Status**: FIXED

### BUG-007: Joblib pickle compatibility
- **Severity**: MEDIUM (model loading fails)
- **File**: `ml-service/services/categorizer.py`
- **Issue**: `_SafeModelLoader` used pickle `Unpickler` on joblib-format files
- **Fix**: Replaced with `joblib.load()` + Pipeline type check
- **Status**: FIXED

### BUG-008: plan_gate.go nil panic on malformed claims
- **Severity**: HIGH (server crash)
- **File**: `api/internal/middleware/plan_gate.go`
- **Issue**: Bare type assertion `plan.(string)` panics when claims contain non-string plan value
- **Fix**: Added safe type assertion with `ok` check
- **Status**: FIXED

### BUG-009: Hardcoded admin email in login page
- **Severity**: HIGH (privilege escalation)
- **File**: `frontend/app/(auth)/login/page.tsx`
- **Issue**: Hardcoded `'yaswanthrajmouli14@gmail.com'` granted admin bypass to anyone who knew the email; `setUser()` directly mutated auth context bypassing server-side validation
- **Fix**: Uses `ADMIN_EMAIL` from constants; replaced manual `setUser()` with `refetch()` from AuthProvider
- **Status**: FIXED

### BUG-010: auth-context exposes setUser publicly
- **Severity**: MEDIUM (privilege escalation vector)
- **File**: `lib/auth-context.tsx`
- **Issue**: `setUser` was part of the public `AuthContextType` interface, allowing any client component to bypass auth
- **Fix**: Removed `setUser` from public context interface and provider value
- **Status**: FIXED

### BUG-011: Path traversal in chunked upload
- **Severity**: HIGH (security)
- **File**: `api/internal/handlers/upload.go`
- **Issue**: `upload_id` from client was used unsanitized in filesystem path construction (`uploads/{uploadID}/`), enabling path traversal
- **Fix**: Added regex validation allowing only alphanumeric, hyphens, and underscores
- **Status**: FIXED

### BUG-012: Dead code duplicate error check in upload
- **Severity**: LOW
- **File**: `api/internal/handlers/upload.go:284-287`
- **Issue**: Unreachable `if err != nil` block after `BulkCopyInsert` (duplicate of line 275 check)
- **Fix**: Removed dead code
- **Status**: FIXED

### BUG-013: ML error body leakage to client
- **Severity**: MEDIUM (info disclosure)
- **File**: `api/internal/handlers/forecast.go`
- **Issue**: ML service error messages (including potential stack traces) returned verbatim to client via `err.Error()`
- **Fix**: Replaced with generic `"forecast computation failed"` message
- **Status**: FIXED

### BUG-014: Dashboard null dereference on category
- **Severity**: MEDIUM (runtime crash)
- **File**: `frontend/app/(dashboard)/dashboard/page.tsx:560`
- **Issue**: `tx.category.charAt(0)` crashes when category is null (uncategorized transactions)
- **Fix**: Added null check: `tx.category ? tx.category.charAt(0).toUpperCase() : '?'`
- **Status**: FIXED

### BUG-015: Billing success param mismatch
- **Severity**: LOW (UX bug)
- **File**: `frontend/app/(dashboard)/settings/billing/page.tsx`
- **Issue**: Backend redirects with `?success=true` but frontend checked for `?upgraded=true` — confetti never showed
- **Fix**: Changed frontend to check `searchParams.get("success") === "true"`
- **Status**: FIXED

### BUG-016: Free users Gemini bypass in AI chat
- **Severity**: HIGH (billing bypass)
- **File**: `frontend/app/api/ai/chat/route.ts`
- **Issue**: Gemini fallback had no plan gate — free users could use Gemini models without upgrading
- **Fix**: Added plan check `(plan === "pro" || plan === "max")` to Gemini route
- **Status**: FIXED

### BUG-017: Billing email not URL-encoded
- **Severity**: MEDIUM (broken integration)
- **File**: `api/internal/handlers/billing.go:158`
- **Issue**: User email interpolated directly into Lemon Squeezy API URL without URL encoding — emails with `+` or other special chars would fail
- **Fix**: Added `url.QueryEscape(user.Email)` and imported `net/url`
- **Status**: FIXED

### BUG-018: ML client no response body size limit
- **Severity**: MEDIUM (DoS vector)
- **File**: `api/internal/services/mlclient/client.go`
- **Issue**: `io.ReadAll(resp.Body)` reads unlimited data — malicious ML response could exhaust memory
- **Fix**: Added `io.LimitReader(resp.Body, 1<<20)` (1MB limit) to both /classify and /forecast
- **Status**: FIXED

### BUG-019: Copyright year outdated
- **Severity**: LOW (cosmetic)
- **Files**: `footer.tsx`, `login/page.tsx`, `register/page.tsx`, `about/page.tsx`
- **Issue**: Footer showed "© 2025" instead of "© 2026"
- **Fix**: Updated all 4 files to "© 2026"
- **Status**: FIXED

---

## Known Issues (Not Fixed — Acceptable for RC)

### BUG-K001: `verify_api_key` captures env var at import time
- **Severity**: MEDIUM (fragile for testing)
- **File**: `ml-service/main.py:19`
- **Issue**: `ML_API_KEY = os.environ.get("ML_API_KEY", "")` at module level means value is fixed at import time
- **Mitigation**: `tests/conftest.py` ensures env var is set before import
- **Recommendation**: Read from `os.environ.get()` inside the function for long-term fix

### BUG-K002: No input validation on `truncate` limit
- **Severity**: LOW
- **File**: `api/internal/handlers/ai_chat.go:71`
- **Issue**: `truncate` with negative n produces unexpected output
- **Recommendation**: Add `if n < 0 { return s }` guard

### BUG-K003: ConvergenceWarning in forecast tests
- **Severity**: LOW (test warning, no functional impact)
- **File**: `ml-service/tests/test_forecast.py`
- **Issue**: Holt-Winters optimization occasionally fails to converge
- **Mitigation**: Warning only — forecasts still produced with fallback parameters

---

## Test Results Summary

| Suite | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| Go API (handlers) | 17 | 17 | 0 | All green |
| Go API (middleware) | 27 | 27 | 0 | Security + CSRF + load tests |
| Go API (mlclient) | 14 | 14 | 0 | HTTP client tests |
| Go API (csvparser) | 13 | 13 | 0 | CSV parsing |
| Go API (jwt) | 11 | 11 | 0 | Token generation/validation |
| Python ML | 35 | 35 | 0 | All green |
| Frontend Lint | - | - | 0 | Clean, no warnings |
| Frontend Build | 25 pages | 25 | 0 | All pages generated |
| **Total** | **117+** | **117+** | **0** | **All green** |

---

## Severity Distribution

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 6 | All fixed |
| MEDIUM | 8 | All fixed |
| LOW | 5 | All fixed |
| **Total** | **19** | **16 fixed, 3 acceptable** |
