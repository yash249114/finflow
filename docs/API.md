# API Reference

Base URL: `https://finflow-api-axvw.onrender.com`

All authenticated endpoints require a valid JWT in either:
- `Authorization: Bearer <token>` header, OR
- `finflow_access_token` httpOnly cookie

---

## Authentication

### POST `/api/v1/auth/register`

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "full_name": "Jane Doe"
}
```

**Response (201):**
```json
{
  "message": "registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "plan": "free"
  }
}
```

**Errors:**
- `400` — Invalid input (missing fields, weak password)
- `409` — Email already registered

---

### POST `/api/v1/auth/login`

Authenticate and receive JWT cookies.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "message": "login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "plan": "pro"
  }
}
```

**Cookies set:**
- `finflow_access_token` — JWT (15min TTL, httpOnly, Secure, SameSite=Strict)
- `finflow_refresh_token` — Refresh token (7 day TTL, httpOnly, Secure, SameSite=Strict)

**Errors:**
- `400` — Missing credentials
- `401` — Invalid email or password

---

### POST `/api/v1/auth/refresh`

Rotate the access token using the refresh token cookie.

**Response (200):**
```json
{
  "message": "token refreshed"
}
```

**Errors:**
- `401` — Refresh token missing, expired, or invalid

---

### POST `/api/v1/auth/logout`

Clear all auth cookies and revoke the refresh token.

**Response (200):**
```json
{
  "message": "logged out"
}
```

---

### GET `/api/v1/auth/me`

Get the currently authenticated user's profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "plan": "pro"
}
```

**Errors:**
- `401` — Not authenticated

---

## Transactions

### POST `/api/v1/transactions/upload`

Upload a CSV file for ML-powered categorization.

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | CSV file (max 100MB) |

**Supported CSV formats:**
- Comma, pipe (`|`), or tab delimited
- Auto-detected header row
- Flexible date parsing (MM/DD/YYYY, YYYY-MM-DD, etc.)
- Handles BOM, different encodings

**Response (200):**
```json
{
  "uploaded": 150,
  "failed": 2,
  "errors": [
    { "row": 45, "reason": "invalid date format" },
    { "row": 89, "reason": "missing amount" }
  ]
}
```

**Errors:**
- `400` — Invalid CSV, too many rows (>100K), or missing file
- `500` — ML service unavailable

---

### POST `/api/v1/transactions/upload/start`

Initialize a chunked upload for large files.

**Request:**
```json
{
  "filename": "bank_export.csv",
  "total_size": 104857600,
  "content_type": "text/csv"
}
```

**Response (200):**
```json
{
  "upload_id": "uuid",
  "chunk_size": 5242880
}
```

---

### POST `/api/v1/transactions/upload/chunk`

Upload a single chunk of a large file.

**Request:** `multipart/form-data`
| Field | Type | Required |
|-------|------|----------|
| `chunk` | File | Yes |
| `upload_id` | string | Yes |
| `chunk_index` | int | Yes |
| `total_chunks` | int | Yes |

**Response (200):**
```json
{
  "message": "chunk uploaded",
  "chunks_received": 5,
  "total_chunks": 20
}
```

When all chunks are received, the file is automatically merged and processed.

---

### GET `/api/v1/transactions/upload/status`

Check the status of a chunked upload.

**Query params:**
| Param | Type | Required |
|-------|------|----------|
| `upload_id` | string | Yes |

**Response (200):**
```json
{
  "upload_id": "uuid",
  "status": "processing",
  "chunks_received": 20,
  "total_chunks": 20,
  "rows_processed": 5000,
  "created_at": "2026-07-21T12:00:00Z"
}
```

---

### GET `/api/v1/transactions`

List transactions with pagination and filters.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Results per page (max 100) |
| `start_date` | string | — | Filter: transactions after this date |
| `end_date` | string | — | Filter: transactions before this date |
| `category` | string | — | Filter by category |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "date": "2026-07-15",
      "description": "AWS Monthly Bill",
      "amount": -2450.00,
      "category": "infrastructure",
      "source": "csv",
      "created_at": "2026-07-20T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### GET `/api/v1/transactions/summary`

Get a cash flow summary for a date range.

**Query params:**
| Param | Type | Required |
|-------|------|----------|
| `start_date` | string | Yes |
| `end_date` | string | Yes |

**Response (200):**
```json
{
  "net_cash_flow": 12500.00,
  "total_income": 35000.00,
  "total_expenses": -22500.00,
  "transaction_count": 150,
  "by_category": [
    {
      "category": "infrastructure",
      "total": -8500.00,
      "percentage": 37.8
    },
    {
      "category": "payroll",
      "total": -10000.00,
      "percentage": 44.4
    }
  ]
}
```

---

## Forecast

> **Requires Pro plan or higher.**

### GET `/api/v1/forecast`

Get a cash flow forecast.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `horizon` | int | 30 | Forecast horizon (30, 60, or 90 days) |

**Response (200):**
```json
{
  "forecast": [
    {
      "date": "2026-07-22",
      "predicted": 1250.00,
      "lower": 800.00,
      "upper": 1700.00
    }
  ],
  "summary": {
    "expected_net": 37500.00,
    "trend": "upward",
    "confidence": "high"
  }
}
```

**Caching:** Results are cached in Redis for 1 hour. Subsequent requests within the window return cached data.

**Errors:**
- `400` — Not enough historical data (minimum 14 days)
- `403` — Pro plan required

---

### GET `/api/v1/forecast/quality`

Get forecast accuracy metrics by comparing past forecasts with actuals.

**Response (200):**
```json
{
  "mean_absolute_error": 125.50,
  "mean_squared_error": 25000.00,
  "root_mean_square_error": 158.11,
  "mean_absolute_pct_error": 8.2,
  "r2_score": 0.92,
  "direction_accuracy": 85.0,
  "confidence_coverage": 94.0,
  "forecast_count": 30,
  "computed_at": "2026-07-21T12:00:00Z"
}
```

---

## AI Copilot

### POST `/api/v1/ai/chat`

Send a message to the AI copilot.

**Request:**
```json
{
  "message": "What's my burn rate?",
  "history": [
    { "role": "user", "content": "Show me my expenses" },
    { "role": "assistant", "content": "Your total expenses are $22,500..." }
  ]
}
```

**Response (200):**
```json
{
  "reply": "Your current monthly burn rate is approximately $18,750...",
  "text": "Your current monthly burn rate is approximately $18,750...",
  "confidence": 0.85,
  "provider": "openai",
  "needs_ticket": false
}
```

**Provider routing by plan:**
| Plan | Provider | Fallback |
|------|----------|----------|
| Free | Offline knowledge base | — |
| Pro | GPT-4o-mini | — |
| Max | Gemini Flash → Claude 3.5 → GPT-4o | Automatic |

**Confidence scoring:**
- Confidence < 0.4: Automatically creates a support ticket
- Provider reports "cannot help": Creates a ticket
- User requests human: Creates a ticket

---

### GET `/api/v1/ai/recommendations`

Get AI-powered financial recommendations.

**Response (200):**
```json
{
  "recommendations": [
    {
      "id": "rec-negative-cashflow-20260721",
      "title": "Address Negative Cash Flow",
      "description": "Your net cash flow is negative...",
      "category": "risk",
      "priority": "high",
      "impact": "Prevents runway depletion",
      "confidence": 0.9,
      "created_at": "2026-07-21T12:00:00Z"
    }
  ],
  "snapshot": {
    "total_income": 35000.00,
    "total_expenses": -22500.00,
    "net_cash_flow": 12500.00,
    "transaction_count": 150
  }
}
```

**Recommendation categories:** `savings`, `revenue`, `risk`, `efficiency`
**Priority levels:** `critical`, `high`, `medium`, `low`

---

## Billing

### GET `/api/v1/billing/plans`

List available pricing plans.

**Response (200):**
```json
{
  "plans": [
    {
      "id": "emerald_monthly",
      "name": "Emerald",
      "slug": "emerald",
      "tier": "pro",
      "price": 999.00,
      "currency": "INR",
      "interval": "month",
      "features": ["Unlimited transactions", "AI-powered insights", "Priority support", "Advanced analytics"]
    }
  ]
}
```

---

### POST `/api/v1/billing/checkout`

Create a Razorpay order for plan purchase.

**Request:**
```json
{
  "plan": "emerald",
  "billing_cycle": "monthly"
}
```

**Response (200):**
```json
{
  "order_id": "order_xxxxx",
  "amount": 99900,
  "currency": "INR",
  "razorpay_key_id": "rzp_xxxxx",
  "receipt": "finflow_user-id_1234567890",
  "notes": {
    "user_id": "user-id",
    "plan": "emerald"
  }
}
```

---

### GET `/api/v1/billing/subscription`

Get the current subscription state for the authenticated user.

**Response (200):**
```json
{
  "subscription": {
    "user_id": "uuid",
    "status": "active",
    "plan": "pro",
    "plan_name": "Emerald",
    "variant_slug": "emerald",
    "billing_cycle": "monthly",
    "subscription_id": "sub_xxxxx",
    "customer_id": "cust_xxxxx",
    "current_period_ends_at": "2026-08-23T00:00:00Z"
  }
}
```

---

### POST `/api/v1/billing/webhook`

Razorpay webhook endpoint. Processes payment and subscription events.

**Headers required:**
- `X-Razorpay-Signature` — HMAC-SHA256 signature for verification

**Supported events:**
- `payment.authorized` / `payment.captured` — Activate or upgrade plan
- `payment.failed` — Mark subscription as past_due
- `refund.created` / `refund.processed` — Revert to free plan
- `subscription.activated` — Activate subscription plan
- `subscription.charged` — Renew billing period
- `subscription.completed` — Expire subscription
- `subscription.cancelled` — Cancel immediately
- `subscription.paused` — Mark as past_due
- `subscription.resumed` — Reactivate plan

**Idempotency:** Events are deduplicated via the `webhook_events` table.

---

## System

### GET `/health`

API health check (no authentication).

**Response (200):**
```json
{
  "status": "ok",
  "service": "finflow-api",
  "time": "2026-07-21T12:00:00Z"
}
```

---

### GET `/api/aiops/health`

AIOps system health (no authentication).

**Response (200):**
```json
{
  "score": 87,
  "status": "healthy",
  "components": { ... },
  "computed_at": "2026-07-21T12:00:00Z"
}
```

---

## Rate Limits

| Endpoint Group | Rate | Burst |
|----------------|------|-------|
| General | 50 req/s | — |
| Auth (login/register) | 5 req/s | 3 |
| API (authenticated) | 100 req/s | 20 |

Rate limiting uses a sliding window algorithm backed by Redis. The client's IP address is used as the rate limit key.

---

## Error Format

All errors follow a consistent format:

```json
{
  "error": "human-readable error message"
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad request (invalid input) |
| 401 | Authentication required or invalid credentials |
| 403 | Insufficient permissions (plan upgrade required) |
| 404 | Resource not found |
| 409 | Conflict (e.g., email already registered) |
| 413 | Request too large |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (ML service down) |
