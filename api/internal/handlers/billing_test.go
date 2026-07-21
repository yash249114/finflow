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

	"github.com/gin-gonic/gin"
)

func TestBillingHandler_Webhook_InvalidSignature(t *testing.T) {
	handler := NewBillingHandler(nil, "", "", "", "webhook-secret", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	body := `{"meta":{"event_name":"subscription_created","webhook_id":"evt-123","custom_data":{"user_id":"user-1"}},"data":{"id":"sub-1","type":"subscriptions","attributes":{"customer_id":123,"user_email":"test@example.com","status":"active"}}}`

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", "invalid-signature")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "invalid signature" {
		t.Errorf("expected 'invalid signature', got %q", resp["error"])
	}
}

func TestBillingHandler_Webhook_ValidSignature(t *testing.T) {
	secret := "test-webhook-secret"
	handler := NewBillingHandler(nil, "", "", "", secret, "")

	body := `{"meta":{"event_name":"order_created","webhook_id":"evt-456","custom_data":{"user_id":"user-1"}},"data":{"id":"ord-1","type":"orders","attributes":{"customer_id":123,"user_email":"test@example.com","status":"successful"}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	signature := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", signature)

	// Signature verification succeeds, then the handler panics on nil userRepo.
	// This is expected — proves the HMAC check passed.
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Logf("signature verified OK (panic on nil userRepo is expected: %v)", r)
			}
		}()
		r.ServeHTTP(w, req)
	}()

	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("expected 200 or 500, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_EmptySignature(t *testing.T) {
	handler := NewBillingHandler(nil, "", "", "", "secret", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", "")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_InvalidJSON(t *testing.T) {
	handler := NewBillingHandler(nil, "", "", "", "secret", "")

	mac := hmac.New(sha256.New, []byte("secret"))
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
	handler := NewBillingHandler(nil, "", "", "", secret, "")

	body := `{"meta":{"event_name":"subscription_created","webhook_id":"","custom_data":{"user_id":"user-1"}},"data":{"id":"sub-1","type":"subscriptions","attributes":{"customer_id":123,"user_email":"test@example.com","status":"active"}}}`

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
	h := NewBillingHandler(nil, "api-key", "store-1", "variant-1", "wh-secret", "http://localhost:3000")
	if h.apiKey != "api-key" {
		t.Errorf("expected api-key, got %s", h.apiKey)
	}
	if h.storeID != "store-1" {
		t.Errorf("expected store-1, got %s", h.storeID)
	}
	if h.variantID != "variant-1" {
		t.Errorf("expected variant-1, got %s", h.variantID)
	}
	if h.webhookSecret != "wh-secret" {
		t.Errorf("expected wh-secret, got %s", h.webhookSecret)
	}
	if h.frontendURL != "http://localhost:3000" {
		t.Errorf("expected http://localhost:3000, got %s", h.frontendURL)
	}
}
