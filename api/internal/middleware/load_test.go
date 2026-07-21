package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func BenchmarkSecurityHeaders(b *testing.B) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", SecurityHeaders(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	req := httptest.NewRequest("GET", "/", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}
}

func BenchmarkCSRF_AllowsGET(b *testing.B) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", CSRF("http://localhost:3000"), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	req := httptest.NewRequest("GET", "/", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}
}

func BenchmarkCSRF_BlocksNoOrigin(b *testing.B) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.POST("/", CSRF("http://localhost:3000"), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	req := httptest.NewRequest("POST", "/", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
	}
}

func BenchmarkRequirePro_Allows(b *testing.B) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", RequirePro(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w = httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("plan", "pro")
		c.Request = httptest.NewRequest("GET", "/", nil)
		r.ServeHTTP(w, c.Request)
	}
}

func BenchmarkSecurityHeaders_Parallel(b *testing.B) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	_, r := gin.CreateTestContext(w)
	r.GET("/", SecurityHeaders(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	req := httptest.NewRequest("GET", "/", nil)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			w = httptest.NewRecorder()
			r.ServeHTTP(w, req)
		}
	})
}
