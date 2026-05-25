// api/internal/middleware/auth.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/finflow/api/internal/services/jwt"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Auth creates middleware that validates JWT access tokens from cookies or Authorization header.
func Auth(jwtService *jwt.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// Try cookie first
		if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
			tokenString = cookie
		}

		// Fallback to Authorization header
		if tokenString == "" {
			auth := c.GetHeader("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				tokenString = strings.TrimPrefix(auth, "Bearer ")
			}
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		claims, err := jwtService.ValidateAccessToken(tokenString)
		if err != nil {
			log.Warn().Err(err).Msg("invalid access token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Attach user info to context for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("plan", claims.Plan)

		c.Next()
	}
}
