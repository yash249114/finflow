package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequirePro_AllowsProPlan(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("plan", "pro")
		c.Next()
	})
	router.Use(RequirePro())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("pro plan should be allowed, got status %d", w.Code)
	}
}

func TestRequirePro_AllowsMaxPlan(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("plan", "max")
		c.Next()
	})
	router.Use(RequirePro())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("max plan should be allowed, got status %d", w.Code)
	}
}

func TestRequirePro_BlocksFreePlan(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("plan", "free")
		c.Next()
	})
	router.Use(RequirePro())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("free plan should be blocked, got status %d", w.Code)
	}
}

func TestRequirePro_BlocksNoPlan(t *testing.T) {
	router := gin.New()
	router.Use(RequirePro())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("no plan should return 401, got status %d", w.Code)
	}
}
