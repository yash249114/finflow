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
	handler := NewBillingHandler(nil, nil, "", "", "webhook-secret", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	body := `{"event":"payment.authorized","id":"evt-123","payload":{"payment":{"entity":{"id":"pay_123","notes":{"user_id":"user-1","plan":"emerald"}}}}}`

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", "invalid-signature")
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

func TestBillingHandler_Webhook_ValidSignature(t *testing.T) {
	secret := "test-webhook-secret"
	handler := NewBillingHandler(nil, nil, "", "", secret, "")

	body := `{"event":"payment.authorized","id":"evt_456","payload":{"payment":{"entity":{"id":"pay_456","notes":{"user_id":"user-1","plan":"emerald"}}}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	signature := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", signature)

	// Signature verification succeeds, then the handler returns 500 because billingSvc is nil.
	// This is expected — proves the HMAC check passed.
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 (nil billingSvc), got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_EmptySignature(t *testing.T) {
	handler := NewBillingHandler(nil, nil, "", "", "secret", "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", "")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_InvalidJSON(t *testing.T) {
	handler := NewBillingHandler(nil, nil, "", "", "secret", "")

	mac := hmac.New(sha256.New, []byte("secret"))
	mac.Write([]byte("not json"))
	sig := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", sig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestBillingHandler_Webhook_MissingWebhookID(t *testing.T) {
	secret := "secret"
	handler := NewBillingHandler(nil, nil, "", "", secret, "")

	body := `{"event":"payment.authorized","id":"","payload":{"payment":{"entity":{"id":"pay_123","notes":{"user_id":"user-1","plan":"emerald"}}}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	sig := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook", handler.Webhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", sig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

func TestNewBillingHandler(t *testing.T) {
	h := NewBillingHandler(nil, nil, "rp-key-id", "rp-key-secret", "wh-secret", "http://localhost:3000")
	if h.razorpayKeyID != "rp-key-id" {
		t.Errorf("expected rp-key-id, got %s", h.razorpayKeyID)
	}
	if h.razorpayKeySec != "rp-key-secret" {
		t.Errorf("expected rp-key-secret, got %s", h.razorpayKeySec)
	}
	if h.razorpayWebhook != "wh-secret" {
		t.Errorf("expected wh-secret, got %s", h.razorpayWebhook)
	}
	if h.frontendURL != "http://localhost:3000" {
		t.Errorf("expected http://localhost:3000, got %s", h.frontendURL)
	}
}
