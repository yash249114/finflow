package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestSecurityHeaders(t *testing.T) {
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", SecurityHeaders(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	tests := []struct {
		header   string
		expected string
	}{
		{"Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"},
		{"X-Content-Type-Options", "nosniff"},
		{"X-Frame-Options", "DENY"},
		{"X-XSS-Protection", "0"},
		{"Referrer-Policy", "strict-origin-when-cross-origin"},
		{"Cross-Origin-Resource-Policy", "same-origin"},
		{"Cross-Origin-Opener-Policy", "same-origin"},
		{"Cross-Origin-Embedder-Policy", "require-corp"},
		{"Server", ""},
	}

	for _, tt := range tests {
		t.Run(tt.header, func(t *testing.T) {
			val := w.Header().Get(tt.header)
			if val != tt.expected {
				t.Errorf("header %s: expected %q, got %q", tt.header, tt.expected, val)
			}
		})
	}

	// CSP is complex; just verify it's present and non-empty
	csp := w.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Error("expected Content-Security-Policy header to be set")
	}
	if !contains(csp, "default-src 'self'") {
		t.Error("CSP should contain default-src 'self'")
	}
	if !contains(csp, "frame-ancestors 'none'") {
		t.Error("CSP should contain frame-ancestors 'none'")
	}
}

func TestSecurityHeaders_PermissionsPolicy(t *testing.T) {
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", SecurityHeaders(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	r.ServeHTTP(w, req)

	pp := w.Header().Get("Permissions-Policy")
	if pp == "" {
		t.Error("expected Permissions-Policy header to be set")
	}
	for _, denied := range []string{"camera=()", "microphone=()", "geolocation=()"} {
		if !contains(pp, denied) {
			t.Errorf("Permissions-Policy should deny %s", denied)
		}
	}
}

func TestSecurityHeaders_ContextPropagation(t *testing.T) {
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", SecurityHeaders(), func(c *gin.Context) {
		c.Set("test-value", 42)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	r.ServeHTTP(w, req)

	// Verify middleware didn't short-circuit
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstr(s, substr))
}

func containsSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
