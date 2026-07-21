package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAuthHandler_Register_Deprecated(t *testing.T) {
	handler := NewAuthHandler(nil, nil, "development")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/auth/register", handler.Register)

	req := httptest.NewRequest("POST", "/api/v1/auth/register", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusGone {
		t.Errorf("expected 410, got %d", w.Code)
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "registration is handled via Supabase Auth directly" {
		t.Errorf("unexpected error message: %q", resp["error"])
	}
}

func TestAuthHandler_Login_Deprecated(t *testing.T) {
	handler := NewAuthHandler(nil, nil, "development")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/auth/login", handler.Login)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusGone {
		t.Errorf("expected 410, got %d", w.Code)
	}
}

func TestAuthHandler_Refresh_Deprecated(t *testing.T) {
	handler := NewAuthHandler(nil, nil, "development")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/auth/refresh", handler.Refresh)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusGone {
		t.Errorf("expected 410, got %d", w.Code)
	}
}

func TestAuthHandler_Logout_Deprecated(t *testing.T) {
	handler := NewAuthHandler(nil, nil, "development")

	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/api/v1/auth/logout", handler.Logout)

	req := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusGone {
		t.Errorf("expected 410, got %d", w.Code)
	}
}

func TestNewAuthHandler_Secure(t *testing.T) {
	h := NewAuthHandler(nil, nil, "production")
	if !h.secure {
		t.Error("expected secure=true in production")
	}
}

func TestNewAuthHandler_Insecure(t *testing.T) {
	h := NewAuthHandler(nil, nil, "development")
	if h.secure {
		t.Error("expected secure=false in development")
	}
}
