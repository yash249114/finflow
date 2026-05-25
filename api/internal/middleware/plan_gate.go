// api/internal/middleware/plan_gate.go
package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequirePro blocks free-tier users from accessing pro-only features.
func RequirePro() gin.HandlerFunc {
	return func(c *gin.Context) {
		plan, exists := c.Get("plan")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		if plan.(string) != "pro" {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       "pro_required",
				"message":     "This feature requires a Pro plan ($19/month). Upgrade to unlock forecasting and unlimited transactions.",
				"upgrade_url": "/settings/billing",
			})
			return
		}

		c.Next()
	}
}
