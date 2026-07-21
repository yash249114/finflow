# FinFlow — Dependency Vulnerability Report

**Date:** 21 July 2026  
**Assessor:** Principal Security Engineer

---

## Go API (`api/go.mod`)

| Dependency | Version | Purpose | Known CVEs | Notes |
|------------|---------|---------|------------|-------|
| `github.com/gin-gonic/gin` | v1.12.0 | HTTP router | None (current) | Well-maintained |
| `github.com/gin-contrib/cors` | v1.7.7 | CORS middleware | None | |
| `github.com/golang-jwt/jwt/v5` | v5.2.1 | JWT creation/validation | None | Latest v5 |
| `github.com/google/uuid` | v1.6.0 | UUID generation | None | |
| `github.com/jackc/pgx/v5` | v5.6.0 | PostgreSQL driver | None | Latest v5 |
| `github.com/redis/go-redis/v9` | v9.5.3 | Redis client | None | Latest v9 |
| `github.com/rs/zerolog` | v1.33.0 | Structured logging | None | |
| `go.mongodb.org/mongo-driver/v2` | v2.5.0 | Transitive | None | Not used directly |

**No known CVEs in Go dependencies.**

---

## ML Service (`ml-service/requirements.txt`)

| Dependency | Version | Purpose | Known CVEs | Notes |
|------------|---------|---------|------------|-------|
| `fastapi` | 0.111.0 | Web framework | None | Pinned |
| `uvicorn[standard]` | 0.30.1 | ASGI server | None | Pinned |
| `pydantic` | 2.7.4 | Data validation | None | Pinned (v2) |
| `scikit-learn` | 1.5.0 | ML models | None | Pinned |
| `joblib` | 1.4.2 | Model serialization | None | Pickle risk mitigated by type check |
| `statsmodels` | 0.14.2 | Holt-Winters | None | Pinned |
| `numpy` | 1.26.4 | Numerical computing | None | Pinned |
| `pandas` | 2.2.2 | Data manipulation | None | Pinned |
| `pytest` | 8.2.2 | Testing | N/A | Not in production image after multi-stage fix |
| `httpx` | 0.27.0 | HTTP client for tests | None | Not in production image after multi-stage fix |

**No known CVEs in Python dependencies. Test deps split into multi-stage build.**

---

## Frontend (`frontend/package.json`)

| Dependency | Version | Purpose | Known CVEs | Notes |
|------------|---------|---------|------------|-------|
| `next` | 14.2.35 | React framework | None | Current stable |
| `react` / `react-dom` | ^18 | UI framework | None | |
| `@supabase/ssr` | ^0.10.3 | Supabase Auth SSR | None | |
| `@supabase/supabase-js` | ^2.110.7 | Supabase client | None | |
| `framer-motion` | ^12.42.2 | Animations | None | |
| `@radix-ui/*` | ^1.3.0 | UI primitives | None | |
| `recharts` | ^2.15.4 | Charts | None | |
| `@playwright/test` | ^1.48.0 | E2E testing | N/A | Dev dependency |

**Note: `npm audit` runs in CI pipeline. No critical/high advisories at time of audit.**

---

## Docker Images

| Image | Tag | Size | Known CVEs | Notes |
|-------|-----|------|------------|-------|
| `golang:alpine` | (builder) | ~350MB | None | Build stage only |
| `alpine:3.19` | (runtime) | ~5MB | 0 critical | Minimal |
| `node:20-alpine` | (runtime) | ~125MB | None | Non-root user |
| `python:3.11-slim` | (runtime) | ~120MB | None | Multi-stage now |
| `postgres:16-alpine` | (runtime) | ~150MB | 0 critical | Official |
| `redis:7-alpine` | (runtime) | ~30MB | 0 critical | Official |
| `nginx:1.27-alpine` | (runtime) | ~25MB | 0 critical | Official |

---

## CI Security Tools Added

| Tool | Purpose | Status |
|------|---------|--------|
| `trufflehog` | Secret scanning | ✅ Existing |
| `Trivy` | Container vuln scanning | ✅ **Added** |
| `CodeQL` | SAST for Go, JS, Python | ✅ **Added** |
| `npm audit` | Node advisory scanning | ✅ **Added** |
| `go vet` | Go static analysis | ✅ Existing |

---

## Overall Dependency Risk: **LOW**

All direct dependencies are on current stable versions with no known critical CVEs.  
CI pipeline now includes automated vulnerability scanning on every PR.
