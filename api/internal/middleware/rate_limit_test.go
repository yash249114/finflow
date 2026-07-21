package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRateLimiter_AllowsUnderLimit(t *testing.T) {
	rl := NewIPRateLimiter(5, 1*time.Minute, 30*time.Minute)
	defer rl.Stop()

	for i := 0; i < 5; i++ {
		if !rl.Allow("192.168.1.1") {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	rl := NewIPRateLimiter(3, 1*time.Minute, 30*time.Minute)
	defer rl.Stop()

	for i := 0; i < 3; i++ {
		rl.Allow("10.0.0.1")
	}

	if rl.Allow("10.0.0.1") {
		t.Fatal("expected rate limit to block after 3 requests")
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	rl := NewIPRateLimiter(2, 1*time.Minute, 30*time.Minute)
	defer rl.Stop()

	rl.Allow("1.1.1.1")
	rl.Allow("1.1.1.1")
	if rl.Allow("1.1.1.1") {
		t.Fatal("IP 1 should be blocked")
	}

	// Different IP should still be allowed
	if !rl.Allow("2.2.2.2") {
		t.Fatal("IP 2 should be allowed")
	}
}

func TestRateLimiter_WindowExpiry(t *testing.T) {
	rl := NewIPRateLimiter(2, 50*time.Millisecond, 30*time.Minute)
	defer rl.Stop()

	rl.Allow("1.1.1.1")
	rl.Allow("1.1.1.1")
	if rl.Allow("1.1.1.1") {
		t.Fatal("should be blocked")
	}

	time.Sleep(60 * time.Millisecond)

	if !rl.Allow("1.1.1.1") {
		t.Fatal("should be allowed after window expiry")
	}
}

func TestParseIP_WithPort(t *testing.T) {
	ip := parseIP("192.168.1.1:12345")
	if ip != "192.168.1.1" {
		t.Errorf("parseIP = %q, want 192.168.1.1", ip)
	}
}

func TestParseIP_WithoutPort(t *testing.T) {
	ip := parseIP("10.0.0.1")
	if ip != "10.0.0.1" {
		t.Errorf("parseIP = %q, want 10.0.0.1", ip)
	}
}

func TestRateLimitMiddleware_AllowsNormalRequest(t *testing.T) {
	router := gin.New()
	router.Use(RateLimit(""))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestCSRF_AllowsGET(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET should be allowed, got status %d", w.Code)
	}
}

func TestCSRF_AllowsHEAD(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.HEAD("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("HEAD", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("HEAD should be allowed, got status %d", w.Code)
	}
}

func TestCSRF_AllowsOPTIONS(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.OPTIONS("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("OPTIONS should be allowed, got status %d", w.Code)
	}
}

func TestCSRF_BlocksPOSTWithoutOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("POST without origin should be blocked, got status %d", w.Code)
	}
}

func TestCSRF_AllowsPOSTWithValidOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("POST with valid origin should be allowed, got status %d", w.Code)
	}
}

func TestCSRF_BlocksPOSTWithInvalidOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("POST with invalid origin should be blocked, got status %d", w.Code)
	}
}

func TestCSRF_AllowsPOSTWithReferer(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000"))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/test", nil)
	req.Header.Set("Referer", "http://localhost:3000")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("POST with valid referer should be allowed, got status %d", w.Code)
	}
}

func TestCSRF_MultipleAllowedOrigins(t *testing.T) {
	router := gin.New()
	router.Use(CSRF("http://localhost:3000,http://localhost:3001"))
	router.POST("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/test", nil)
	req1.Header.Set("Origin", "http://localhost:3001")
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("second origin should be allowed, got status %d", w1.Code)
	}
}
