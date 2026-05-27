// api/internal/middleware/auth.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/services/jwt"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Auth creates middleware that validates JWT access tokens from cookies or Authorization header.
func Auth(jwtService *jwt.Service, userRepo *db.UserRepo) gin.HandlerFunc {
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

		userID := claims.UserID
		if userID == "" && claims.Subject != "" {
			userID = claims.Subject
		}

		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user id in token"})
			return
		}

		// Look up user in database to get plan and other profile details
		user, err := userRepo.GetByID(c.Request.Context(), userID)
		if err != nil || user == nil {
			log.Warn().Err(err).Str("user_id", userID).Msg("user profile not found in db")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user profile not found in database"})
			return
		}

		// Attach user info to context for downstream handlers
		c.Set("user_id", user.ID)
		c.Set("email", user.Email)
		c.Set("plan", user.Plan)

		c.Next()
	}
}
