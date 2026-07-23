package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finflow/api/internal/billing"
	"github.com/gin-gonic/gin"
)

func TestBillingHandler_Webhook_InvalidSignature(t *testing.T) {
	secret := "test-webhook-secret"
	billingSvc := &billing.SubscriptionService{}
	webhookHdlr := billing.NewWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, webhookHdlr, "api-key", "store-id", "variant-id", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	body := `{"meta":{"event_name":"subscription_created","webhook_id":"evt-123","custom_data":{"user_id":"user-1"}},"data":{"id":"sub_123","type":"subscriptions","attributes":{"subscription_id":"sub_123","customer_id":"cust_123","user_email":"test@example.com","status":"active","variant_id":"var_123","billing_cycle":"monthly"}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	invalidSig := hex.EncodeToString(mac.Sum(nil)) + "invalid"

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", invalidSig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "invalid signature" {
		t.Errorf("expected 'invalid signature', got %q", resp["error"])
	}
}

func TestBillingHandler_Webhook_EmptySignature(t *testing.T) {
	secret := "secret"
	billingSvc := &billing.SubscriptionService{}
	webhookHdlr := billing.NewWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, webhookHdlr, "api-key", "store-id", "variant-id", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", "")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_InvalidJSON(t *testing.T) {
	secret := "secret"
	billingSvc := &billing.SubscriptionService{}
	webhookHdlr := billing.NewWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, webhookHdlr, "api-key", "store-id", "variant-id", "")

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("not json"))
	sig := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", sig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_MissingWebhookID(t *testing.T) {
	secret := "secret"
	billingSvc := &billing.SubscriptionService{}
	webhookHdlr := billing.NewWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, webhookHdlr, "api-key", "store-id", "variant-id", "")

	body := `{"meta":{"event_name":"subscription_created","webhook_id":"","custom_data":{"user_id":"user-1"}},"data":{"id":"sub_123","type":"subscriptions","attributes":{"subscription_id":"sub_123","customer_id":"cust_123","user_email":"test@example.com","status":"active","variant_id":"var_123","billing_cycle":"monthly"}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	sig := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", sig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestNewBillingHandler(t *testing.T) {
	h := NewBillingHandler(nil, nil, nil, "ls-api-key", "store-id", "variant-id", "http://localhost:3000")
	if h.apiKey != "ls-api-key" {
		t.Errorf("expected ls-api-key, got %s", h.apiKey)
	}
	if h.storeID != "store-id" {
		t.Errorf("expected store-id, got %s", h.storeID)
	}
	if h.variantID != "variant-id" {
		t.Errorf("expected variant-id, got %s", h.variantID)
	}
	if h.frontendURL != "http://localhost:3000" {
		t.Errorf("expected http://localhost:3000, got %s", h.frontendURL)
	}
}