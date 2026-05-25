# FinFlow — Testing Guide

## Prerequisites

All services running via `docker compose up -d --build`

---

## 1. Health Checks

```bash
# API
curl http://localhost:8080/health
# Expected: {"service":"finflow-api","status":"ok","time":"..."}

# ML Service
curl http://localhost:8001/health
# Expected: {"status":"ok","model_loaded":true}
```

---

## 2. Auth Flow

### Register
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@test.com","password":"password123","full_name":"Test User"}'
```
Expected: `201 Created` with user object. Cookies saved to `cookies.txt`.

### Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@test.com","password":"password123"}'
```
Expected: `200 OK` with user object.

### Get Current User
```bash
curl -b cookies.txt http://localhost:8080/api/v1/auth/me
```
Expected: `200 OK` with `{ "user": { ... } }`.

### Refresh Token
```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -b cookies.txt -c cookies.txt
```
Expected: `200 OK` with `{ "ok": true }`.

### Logout
```bash
curl -X POST http://localhost:8080/api/v1/auth/logout \
  -b cookies.txt
```
Expected: `200 OK` with `{ "ok": true }`.

---

## 3. CSV Upload

```bash
curl -X POST http://localhost:8080/api/v1/transactions/upload \
  -b cookies.txt \
  -F "file=@docs/sample_transactions.csv"
```
Expected: `{ "uploaded": 20, "failed": 3, "errors": [...] }`

The 3 errors should be:
- Row 22: invalid date "BAD-DATE"
- Row 23: description is empty
- Row 24: invalid amount (empty)

---

## 4. List Transactions

### All transactions
```bash
curl -b cookies.txt "http://localhost:8080/api/v1/transactions"
```

### With filters
```bash
curl -b cookies.txt "http://localhost:8080/api/v1/transactions?start_date=2024-02-01&end_date=2024-03-31&category=Revenue"
```

### Pagination
```bash
curl -b cookies.txt "http://localhost:8080/api/v1/transactions?page=1&limit=5"
```

---

## 5. Transaction Summary

```bash
curl -b cookies.txt "http://localhost:8080/api/v1/transactions/summary?start_date=2024-01-01&end_date=2024-12-31"
```
Expected: JSON with `net_cash_flow`, `total_income`, `total_expenses`, `by_category`, `transaction_count`.

---

## 6. Forecast (Pro Plan Required)

### Free user gets 402:
```bash
curl -b cookies.txt "http://localhost:8080/api/v1/forecast?horizon=30"
```
Expected: `402 Payment Required` with upgrade message.

### After upgrade to Pro:
```bash
# Manually upgrade in DB for testing:
docker compose exec postgres psql -U postgres -d finflow -c \
  "UPDATE users SET plan = 'pro' WHERE email = 'test@test.com';"

# Re-login to get fresh JWT with updated plan:
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@test.com","password":"password123"}'

# Now forecast works:
curl -b cookies.txt "http://localhost:8080/api/v1/forecast?horizon=30"
```

---

## 7. ML Service Direct Testing

### Classify
```bash
curl -X POST http://localhost:8001/classify \
  -H "Content-Type: application/json" \
  -d '{"descriptions":["AWS Monthly Bill","Team Lunch","Client Payment"]}'
```
Expected: `{"categories":["Infrastructure","Meals","Revenue"]}`

### Forecast
```bash
curl -X POST http://localhost:8001/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {"date":"2024-01-01","amount":100},
      {"date":"2024-01-02","amount":-50},
      {"date":"2024-01-15","amount":200},
      {"date":"2024-01-20","amount":-75},
      {"date":"2024-02-01","amount":150},
      {"date":"2024-02-10","amount":-100}
    ],
    "horizon_days": 30
  }'
```

---

## 8. Lemon Squeezy Webhook Testing

### Option A: Local Tunneling (Recommended)
1. Start an `ngrok` tunnel for the API (runs on port `8080`):
   ```bash
   ngrok http 8080
   ```
2. Configure the webhook in the Lemon Squeezy Developer Dashboard:
   - URL: `https://<your-ngrok-subdomain>.ngrok-free.app/api/v1/billing/webhook`
   - Signing Secret: Matches `LEMONSQUEEZY_WEBHOOK_SECRET` in your `.env`
   - Select events: `subscription_created`, `subscription_resumed`, `subscription_cancelled`, `subscription_expired`
3. Trigger test webhook events directly from the Lemon Squeezy dashboard.

### Option B: Direct Local Testing via Curl (Manual HMAC Verification)
You can simulate a webhook request locally using `curl` by manually computing the `X-Signature` header.
With a local signing secret of `test_secret` and a payload of:
`{"meta":{"event_name":"subscription_created","webhook_id":"evt_123","custom_data":{"user_id":"<user-uuid>"}},"data":{"id":"sub_abc","type":"subscriptions","attributes":{"customer_id":12345,"user_email":"test@test.com","status":"active"}}}`

The computed HMAC-SHA256 signature is `4e09f5cc988185c88bdfb1e956e182307ef196b0ee693f9de78a6358dbb3b4f6`. Run:

```bash
curl -X POST http://localhost:8080/api/v1/billing/webhook \
  -H "Content-Type: application/json" \
  -H "X-Signature: 4e09f5cc988185c88bdfb1e956e182307ef196b0ee693f9de78a6358dbb3b4f6" \
  -d '{"meta":{"event_name":"subscription_created","webhook_id":"evt_123","custom_data":{"user_id":"<user-uuid>"}},"data":{"id":"sub_abc","type":"subscriptions","attributes":{"customer_id":12345,"user_email":"test@test.com","status":"active"}}}'
```

---

## 9. Redis Cache Verification

```bash
# Check if forecast is cached
docker compose exec redis redis-cli KEYS "forecast:*"

# After a forecast request, you should see keys like:
# forecast:{user-uuid}:30

# Check TTL
docker compose exec redis redis-cli TTL "forecast:{user-uuid}:30"
# Expected: ~3600 (1 hour)

# Verify cache invalidation after upload
curl -X POST http://localhost:8080/api/v1/transactions/upload \
  -b cookies.txt -F "file=@docs/sample_transactions.csv"

docker compose exec redis redis-cli KEYS "forecast:*"
# Expected: empty (cache invalidated)
```

---

## 10. Full End-to-End Flow

1. Register: `POST /api/v1/auth/register`
2. Upload CSV: `POST /api/v1/transactions/upload`
3. View transactions: `GET /api/v1/transactions`
4. View summary: `GET /api/v1/transactions/summary`
5. Upgrade to Pro (DB or Lemon Squeezy)
6. Re-login to refresh JWT
7. Get forecast: `GET /api/v1/forecast?horizon=30`
8. Open frontend: `http://localhost:3000`
9. Login with registered credentials
10. View dashboard charts and forecast
