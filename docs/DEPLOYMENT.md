# FinFlow — Railway Deployment Guide

## Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) installed
- Docker Desktop running locally (for testing)
- PostgreSQL and Redis plugins available on Railway

---

## Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

## Step 2: Create Project

```bash
railway init
# Select "Empty project"
```

## Step 3: Add Database Plugins

In the Railway dashboard:

1. **Add Plugin → PostgreSQL**
   - Auto-injects `DATABASE_URL` into all services
2. **Add Plugin → Redis**
   - Auto-injects `REDIS_URL` into all services

## Step 4: Deploy Services

Deploy each service from the project root:

```bash
# API Service
railway up --service api

# ML Service
railway up --service ml-service

# Frontend
railway up --service frontend
```

## Step 5: Set Environment Variables

### API Service

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `PORT` | `8080` |
| `APP_ENV` | `production` |
| `FRONTEND_URL` | `https://your-frontend.railway.app` |
| `ML_SERVICE_URL` | `https://your-ml.railway.app` |
| `LEMONSQUEEZY_API_KEY` | Your Lemon Squeezy API key |
| `LEMONSQUEEZY_STORE_ID` | Your store ID |
| `LEMONSQUEEZY_VARIANT_ID` | Your variant ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Your webhook secret |
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | `FinFlow <noreply@yourdomain.com>` |

### ML Service

| Variable | Value |
|----------|-------|
| `PORT` | `8001` |

### Frontend

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.railway.app` |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | Your Web3Forms access key |
| `PORT` | `3000` |

> **Note:** `NEXT_PUBLIC_*` variables must also be set as **build args** in Railway's service settings since Next.js inlines them at build time.

## Step 6: Update Lemon Squeezy Webhook

In Lemon Squeezy dashboard:
- **Settings → Webhooks → Update URL** to: `https://your-api.railway.app/api/v1/billing/webhook`

## Step 7: Verify Deployment

```bash
# API Health
curl https://your-api.railway.app/health
# Expected: {"status":"ok","service":"finflow-api",...}

# ML Health
curl https://your-ml.railway.app/health
# Expected: {"status":"ok","model_loaded":true}

# Frontend
open https://your-frontend.railway.app
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend    │────▶│  Go API     │────▶│  ML Service  │
│  (Next.js)  │     │  (Gin)      │     │  (FastAPI)   │
│  :3000      │     │  :8080      │     │  :8001       │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼────┐
              │ PostgreSQL │ │  Redis  │
              │  :5432     │ │  :6379  │
              └───────────┘ └─────────┘
```

## Troubleshooting

- **CORS errors**: Ensure `FRONTEND_URL` in API service matches the actual frontend domain exactly (including `https://`)
- **Auth failures**: Ensure `JWT_SECRET` is consistent across API restarts (set it as a persistent env var, not auto-generated)
- **ML model slow to load**: First cold start takes ~30s while model trains. Subsequent starts use cached `.joblib` file from the volume
- **Forecast returns 402**: User must be on `pro` plan. Check `users.plan` column in PostgreSQL
