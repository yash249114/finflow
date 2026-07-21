# Deployment Guide

FinFlow supports multiple deployment strategies. This guide covers Docker Compose (local/self-hosted), Vercel + Render (production SaaS), and manual deployment.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 24+ | For containerized deployment |
| Docker Compose | v2 | Multi-service orchestration |
| Go | 1.24+ | For manual API deployment |
| Node.js | 20+ | For manual frontend deployment |
| Python | 3.11+ | For manual ML service deployment |
| Supabase | Free tier+ | Authentication provider |
| Lemon Squeezy | Account | Billing (optional for free tier) |

---

## 1. Docker Compose (Recommended)

### Quick Start

```bash
git clone https://github.com/yash249114/finflow.git
cd finflow
cp .env.example .env
# Edit .env with your credentials
docker compose up -d --build
```

### Services Started

| Service | Port | Health Check | Memory Limit |
|---------|------|-------------|--------------|
| Nginx | 80 | — | 128 MB |
| Frontend | 3000 | — | 512 MB |
| API | 8080 | `GET /health` | 256 MB |
| ML Service | 8001 | `GET /health` | 512 MB |
| PostgreSQL | 5432 | `pg_isready` | 512 MB |
| Redis | 6379 | `redis-cli ping` | 256 MB |

### Network Architecture

```
┌─────────────────────────────────────────┐
│           frontend-net (bridge)         │
│  Nginx ◄──► Frontend                    │
└────────────────┬────────────────────────┘
                 │
┌────────────────┼────────────────────────┐
│         backend-net (internal)          │
│  Nginx ◄──► API ◄──► ML Service        │
└────────────────┬────────────────────────┘
                 │
┌────────────────┼────────────────────────┐
│           db-net (internal)             │
│  API ◄──► PostgreSQL                    │
│  API ◄──► Redis                         │
│  ML Service (no DB access)             │
└─────────────────────────────────────────┘
```

**Key design decisions:**
- `frontend-net` is external (accessible from host)
- `backend-net` and `db-net` are internal (not accessible from host)
- ML Service has no direct database access (goes through API only)
- All services bind to `127.0.0.1` (not exposed to public internet)

### Persisted Volumes

```yaml
volumes:
  postgres_data:     # PostgreSQL data
  redis_data:        # Redis AOF persistence
  ml_models:         # Trained ML model files
```

### Stopping

```bash
docker compose down          # Stop containers
docker compose down -v       # Stop + remove volumes (data loss!)
```

---

## 2. Vercel + Render (Production)

### Frontend (Vercel)

1. Connect GitHub repository to Vercel
2. Set root directory to `frontend/`
3. Configure environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your API URL (e.g., `https://finflow-api.onrender.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Admin user email |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA site key |

4. Deploy — Vercel auto-detects Next.js and deploys

### API (Render)

1. Create a new **Web Service** on Render
2. Connect GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `api` |
| Runtime | Docker |
| Dockerfile | `api/Dockerfile` |
| Port | 8080 |

4. Set environment variables (see `.env.example`)
5. Add a **PostgreSQL** database on Render
6. Add a **Redis** instance on Render

### ML Service (Render)

1. Create a new **Web Service** on Render
2. Connect GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `ml-service` |
| Runtime | Docker |
| Dockerfile | `ml-service/Dockerfile` |
| Port | 8001 |

4. Set `ML_API_KEY` environment variable
5. Free tier works but has cold start delays (503 on first request)

---

## 3. Manual Deployment

### API

```bash
cd api
go mod tidy
CGO_ENABLED=0 go build -o finflow-api ./cmd/main.go
./finflow-api
```

### ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm start
```

---

## Database Migrations

### Running Migrations

```bash
# Using the migration script
cd infra/db
./migrate.sh

# Or manually
psql $DATABASE_URL -f migrations/001_create_users.sql
psql $DATABASE_URL -f migrations/002_create_transactions.sql
psql $DATABASE_URL -f migrations/003_create_refresh_tokens.sql
psql $DATABASE_URL -f migrations/004_create_webhook_events.sql
```

### Schema Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, email, password_hash, plan |
| `transactions` | Financial data | id, user_id, date, amount, category |
| `refresh_tokens` | JWT rotation | id, user_id, token_hash, expires_at |
| `webhook_events` | Idempotency | event_id (UNIQUE) |

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | 64-char random string for JWT signing |
| `ML_API_KEY` | API key for ML service authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_ACCESS_TTL_MINUTES` | Access token TTL | 15 |
| `JWT_REFRESH_TTL_DAYS` | Refresh token TTL | 7 |
| `OPENAI_API_KEY` | OpenAI API key (for AI copilot) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (for AI copilot) | — |
| `GEMINI_API_KEY` | Google Gemini API key (for AI copilot) | — |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy API key (for billing) | — |
| `APP_ENV` | Environment (development/production) | development |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Admin user email | — |

See `.env.example` for the complete list.

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note the project URL and keys

### 2. Configure Auth

1. Go to **Authentication → Providers**
2. Enable **Email** provider (default)
3. Optionally enable **Google** OAuth:
   - Create Google Cloud Console credentials
   - Add authorized origins: `http://localhost:3000`, your production URL
   - Add redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Enter Client ID and Secret in Supabase

### 3. Database Schema

The FinFlow PostgreSQL schema is managed separately from Supabase's auth schema. Run the migration files in `infra/db/migrations/` against your database.

---

## Nginx Configuration

The Nginx reverse proxy provides:

- **TLS termination** (uncomment TLS block in `infra/nginx/nginx.conf`)
- **Rate limiting**: 50 req/s general, 5 req/s auth, 100 req/s API
- **Security headers**: HSTS, CSP, X-Frame-Options, etc.
- **Static asset caching**: `/_next/static/` cached for 365 days
- **Request size limit**: 25MB max upload

### Production TLS Setup

TLS is now **enabled by default** in `nginx.conf`. The HTTPS server block is active with TLS 1.2 & 1.3, modern AEAD ciphers, OCSP stapling, HSTS (2-year), and secure cookie flags.

#### 1. Obtain TLS certificates

```bash
# Let's Encrypt (recommended)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

#### 2. Generate DH parameters (for forward secrecy)

```bash
openssl dhparam -out ./infra/nginx/dhparam.pem 2048
```

#### 3. Mount certificates in docker-compose.yml

Uncomment the certificate volumes in `docker-compose.yml`:

```yaml
volumes:
  - ./infra/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
  - ./infra/nginx/dhparam.pem:/etc/ssl/certs/dhparam.pem:ro
  - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/ssl/certs/fullchain.pem:ro
  - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/ssl/private/privkey.pem:ro
```

#### 4. (Optional) Customize TLS cert paths

Edit `infra/nginx/nginx.conf` and change the `ssl_certificate` / `ssl_certificate_key` directives if your certs are at different paths.

#### TLS Configuration Summary

| Setting | Value |
|---------|-------|
| Protocols | TLS 1.2, TLS 1.3 |
| Ciphers | ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305 |
| HSTS | max-age=63072000; includeSubDomains; preload |
| OCSP Stapling | On |
| Session Tickets | Off |
| HTTP→HTTPS | Automatic redirect (301) |
| Secure Cookies | HttpOnly; Secure; SameSite=Lax |

---

## Monitoring

### Health Checks

All services expose health endpoints:

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| API | `GET /health` | `{"status": "ok"}` |
| ML Service | `GET /health` | `{"status": "ok", "model_loaded": true}` |
| AIOps | `GET /api/aiops/health` | `{"score": 87, "status": "healthy"}` |

### Logs

```bash
# Docker Compose
docker compose logs -f api          # API logs
docker compose logs -f ml-service   # ML logs
docker compose logs -f frontend     # Frontend logs

# Render
# View logs in Render dashboard → Logs tab
```

### AIOps Dashboard

```bash
curl http://localhost:8080/api/aiops/health
```

Returns a comprehensive health score (0-100) with per-component breakdown.

---

## Rollback

### Docker Compose

```bash
# Revert to previous image
git checkout <previous-commit>
docker compose up -d --build
```

### Vercel

1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click "Promote to Production"

### Render

1. Go to Render dashboard → Events
2. Find the last successful deploy
3. Click "Manual Deploy" → "Deploy previous commit"

---

## Troubleshooting

### "ML service returned 503"

Render free tier services cold-start after inactivity. The first request takes 30-60 seconds. Subsequent requests are fast.

### "Connection refused" on API

Ensure PostgreSQL and Redis are running:
```bash
docker compose ps postgres redis
```

### "JWT validation failed"

Check that `JWT_SECRET` is consistent across API and frontend. The same secret must be used in both.

### Frontend shows "Auth fetch error"

Verify Supabase environment variables are set correctly in the frontend:
```bash
cd frontend
cat .env.local  # Should have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```
