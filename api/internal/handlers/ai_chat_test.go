package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finflow/api/internal/aiops"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestTruncate_ShorterThanLimit(t *testing.T) {
	result := truncate("hello", 10)
	if result != "hello" {
		t.Errorf("expected 'hello', got %q", result)
	}
}

func TestTruncate_ExactlyLimit(t *testing.T) {
	result := truncate("hello", 5)
	if result != "hello" {
		t.Errorf("expected 'hello', got %q", result)
	}
}

func TestTruncate_LongerThanLimit(t *testing.T) {
	result := truncate("hello world", 5)
	if result != "hello..." {
		t.Errorf("expected 'hello...', got %q", result)
	}
}

func TestTruncate_EmptyString(t *testing.T) {
	result := truncate("", 10)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestTruncate_ZeroLimit(t *testing.T) {
	result := truncate("hello", 0)
	if result != "..." {
		t.Errorf("expected '...', got %q", result)
	}
}

func TestToString_StringValue(t *testing.T) {
	result := toString("test")
	if result != "test" {
		t.Errorf("expected 'test', got %q", result)
	}
}

func TestToString_NonStringValue(t *testing.T) {
	result := toString(42)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestToString_NilValue(t *testing.T) {
	result := toString(nil)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestAIChatHandler_InvalidJSON(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/ai/chat", handler.Chat)

	body := bytes.NewBufferString("not json")
	req := httptest.NewRequest("POST", "/api/ai/chat", body)
	req.Header.Set("Content-Type", "application/json")

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "invalid request" {
		t.Errorf("expected 'invalid request' error, got %q", resp["error"])
	}
}

func TestAIChatHandler_EmptyBody(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/ai/chat", handler.Chat)

	body := bytes.NewBufferString(`{}`)
	req := httptest.NewRequest("POST", "/api/ai/chat", body)
	req.Header.Set("Content-Type", "application/json")

	r.ServeHTTP(w, req)

	// Empty message should still be parsed (copilot handles validation)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for empty JSON body, got %d", w.Code)
	}
}

func TestNewAIChatHandler(t *testing.T) {
	copilot := &aiops.Copilot{}
	alerter := &aiops.Alerter{}
	handler := NewAIChatHandler(copilot, alerter)
	if handler == nil {
		t.Fatal("expected non-nil handler")
	}
	if handler.copilot != copilot {
		t.Error("copilot not set correctly")
	}
	if handler.alerter != alerter {
		t.Error("alerter not set correctly")
	}
}
