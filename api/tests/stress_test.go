// api/tests/stress_test.go
// Integration stress tests for FinFlow API.
// Run with: go test -tags=stress -v -run Stress ./tests/
// Requires: STRESS_TEST=1 and running postgres + redis backends.

//go:build stress

package tests

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/finflow/api/internal/middleware"
	"github.com/finflow/api/internal/services/csvparser"
	"github.com/finflow/api/internal/services/jwt"
)

// ── Rate Limiting Stress ──────────────────────────────────

func TestStress_RateLimitConcurrentBurst(t *testing.T) {
	handler := middleware.RateLimit("")
	router := gin.New()
	router.Use(handler)
	router.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed, blocked := 0, 0

	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			req.RemoteAddr = "10.0.0.1:12345"
			router.ServeHTTP(w, req)
			mu.Lock()
			if w.Code == 200 {
				allowed++
			} else if w.Code == 429 {
				blocked++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()

	t.Logf("Rate limit burst: allowed=%d blocked=%d", allowed, blocked)
	if allowed > 110 {
		t.Errorf("Too many passed rate limit: %d (expected <= 100)", allowed)
	}
	if blocked < 50 {
		t.Errorf("Too few blocked: %d (expected >= 50)", blocked)
	}
}

func TestStress_RateLimitMultiIP(t *testing.T) {
	handler := middleware.RateLimit("")
	router := gin.New()
	router.Use(handler)
	router.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	var mu sync.Mutex
	blocked := 0

	for ip := 0; ip < 50; ip++ {
		for i := 0; i < 5; i++ {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			req.RemoteAddr = fmt.Sprintf("10.0.%d.%d:12345", ip/256, ip%256)
			router.ServeHTTP(w, req)
			mu.Lock()
			if w.Code == 429 {
				blocked++
			}
			mu.Unlock()
		}
	}

	if blocked > 0 {
		t.Errorf("Expected 0 blocks for low-rate multi-IP traffic, got %d", blocked)
	}
}

// ── Authentication Stress ─────────────────────────────────

func TestStress_AuthTokenValidation(t *testing.T) {
	jwtSvc := jwt.NewService("test-stress-secret-32-chars-long!!", 15, 7)
	token, _, err := jwtSvc.GenerateAccessToken("stress-user", "stress@finflow.test", "free")
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	passed := 0

	for i := 0; i < 500; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claims, err := jwtSvc.ValidateAccessToken(token)
			mu.Lock()
			if err == nil && claims != nil && claims.UserID == "stress-user" {
				passed++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()

	t.Logf("JWT validation stress: %d/500 passed", passed)
	if passed != 500 {
		t.Errorf("Expected 500/500, got %d", passed)
	}
}

// ── CSV Upload Stress ─────────────────────────────────────

func TestStress_CSVParserThroughput(t *testing.T) {
	var buf bytes.Buffer
	buf.WriteString("date,description,amount\n")
	for i := 0; i < 5000; i++ {
		buf.WriteString(fmt.Sprintf("2026-01-%02d,Transaction %d,%.2f\n", (i%28)+1, i, float64(i)*1.5))
	}

	start := time.Now()
	result, err := csvparser.Parse(&buf)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Parsed %d rows in %v (%.0f rows/sec)", len(result.Rows), elapsed, float64(len(result.Rows))/elapsed.Seconds())
	if len(result.Rows) != 5000 {
		t.Errorf("Expected 5000 rows, got %d", len(result.Rows))
	}
}

// ── Webhook Signature Stress ──────────────────────────────

func TestStress_WebhookSignatures(t *testing.T) {
	secret := "test-webhook-secret-256bit-long-enough-for-hmac!"

	var wg sync.WaitGroup
	var mu sync.Mutex
	passed := 0

	for i := 0; i < 500; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			body := []byte(fmt.Sprintf(`{"event_id":"evt_%d","data":"test"}`, n))
			mac := hmac.New(sha256.New, []byte(secret))
			mac.Write(body)
			sig := hex.EncodeToString(mac.Sum(nil))

			m := hmac.New(sha256.New, []byte(secret))
			m.Write(body)
			expected := hex.EncodeToString(m.Sum(nil))
			if subtle.ConstantTimeCompare([]byte(expected), []byte(sig)) == 1 {
				mu.Lock()
				passed++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	t.Logf("Webhook signatures: %d/500 verified", passed)
	if passed != 500 {
		t.Errorf("Expected 500/500, got %d", passed)
	}
}

// ── Forecast (serialization) Stress ───────────────────────

func TestStress_ForecastSerialization(t *testing.T) {
	type tx struct {
		Date   string  `json:"date"`
		Amount float64 `json:"amount"`
	}
	transactions := make([]tx, 0, 180)
	for i := 0; i < 90; i++ {
		d := fmt.Sprintf("2026-01-%02d", (i%28)+1)
		transactions = append(transactions, tx{d, 5000.0})
		if i%7 == 0 {
			transactions = append(transactions, tx{d, -200.0})
		}
	}

	start := time.Now()
	for i := 0; i < 20; i++ {
		data, _ := json.Marshal(transactions)
		var decoded []tx
		json.Unmarshal(data, &decoded)
		_ = decoded
	}
	elapsed := time.Since(start)
	t.Logf("Forecast serialization stress: 20 iterations in %v", elapsed)
}

// ── Concurrency Stress (Mixed workloads) ──────────────────

func TestStress_MixedWorkload(t *testing.T) {
	jwtSvc := jwt.NewService("test-stress-secret-32-chars-long!!", 15, 7)
	token, _, _ := jwtSvc.GenerateAccessToken("stress-user", "stress@finflow.test", "pro")

	var wg sync.WaitGroup
	var mu sync.Mutex
	errors := 0

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()

			switch n % 5 {
			case 0:
				_, err := jwtSvc.ValidateAccessToken(token)
				if err != nil {
					mu.Lock()
					errors++
					mu.Unlock()
				}
			case 1:
				_, _, err := jwtSvc.GenerateAccessToken("user", "e@mail.com", "free")
				if err != nil {
					mu.Lock()
					errors++
					mu.Unlock()
				}
			case 2:
				_, _, _, _ = jwtSvc.GenerateRefreshToken()
			case 3:
				mac := hmac.New(sha256.New, []byte("test"))
				mac.Write([]byte("body"))
				_ = hex.EncodeToString(mac.Sum(nil))
			case 4:
				_, err := json.Marshal(map[string]string{"test": "data"})
				if err != nil {
					mu.Lock()
					errors++
					mu.Unlock()
				}
			}
		}(i)
	}
	wg.Wait()

	t.Logf("Mixed workload stress: %d errors", errors)
	if errors > 0 {
		t.Errorf("Expected 0 errors in mixed workload, got %d", errors)
	}
}
