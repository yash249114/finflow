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

func TestBillingHandler_RazorpayWebhook_InvalidSignature(t *testing.T) {
	secret := "test-webhook-secret"
	billingSvc := &billing.SubscriptionService{}
	rzpHdlr := billing.NewRazorpayWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, rzpHdlr, "rzp_key_id", "rzp_key_secret", secret, "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook/razorpay", handler.RazorpayWebhook)

	body := `{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123","notes":{"user_id":"user-1","plan":"emerald"}}}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	invalidSig := hex.EncodeToString(mac.Sum(nil)) + "invalid"

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook/razorpay", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", invalidSig)
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

func TestBillingHandler_RazorpayWebhook_EmptySignature(t *testing.T) {
	secret := "secret"
	billingSvc := &billing.SubscriptionService{}
	rzpHdlr := billing.NewRazorpayWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, rzpHdlr, "rzp_key_id", "rzp_key_secret", secret, "")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook/razorpay", handler.RazorpayWebhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook/razorpay", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", "")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBillingHandler_RazorpayWebhook_InvalidJSON(t *testing.T) {
	secret := "secret"
	billingSvc := &billing.SubscriptionService{}
	rzpHdlr := billing.NewRazorpayWebhookHandler(billingSvc, secret)
	handler := NewBillingHandler(nil, billingSvc, rzpHdlr, "rzp_key_id", "rzp_key_secret", secret, "")

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("not json"))
	sig := hex.EncodeToString(mac.Sum(nil))

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/billing/webhook/razorpay", handler.RazorpayWebhook)

	req := httptest.NewRequest("POST", "/api/v1/billing/webhook/razorpay", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", sig)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestNewBillingHandler(t *testing.T) {
	h := NewBillingHandler(nil, nil, nil, "rzp-key-id", "rzp-key-secret", "wh-secret", "http://localhost:3000")
	if h.keyID != "rzp-key-id" {
		t.Errorf("expected rzp-key-id, got %s", h.keyID)
	}
	if h.keySecret != "rzp-key-secret" {
		t.Errorf("expected rzp-key-secret, got %s", h.keySecret)
	}
	if h.webhookSecret != "wh-secret" {
		t.Errorf("expected wh-secret, got %s", h.webhookSecret)
	}
	if h.frontendURL != "http://localhost:3000" {
		t.Errorf("expected http://localhost:3000, got %s", h.frontendURL)
	}
}
