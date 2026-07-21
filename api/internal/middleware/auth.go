package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/services/jwt"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type userCacheEntry struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Plan  string `json:"plan"`
}

func Auth(jwtService *jwt.Service, userRepo *db.UserRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
			tokenString = cookie
		}

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

		// Try Redis cache first
		rdb, hasRedis := c.Get("redis")
		var found bool
		if hasRedis {
			if redisClient, ok := rdb.(*redis.Client); ok {
				val, err := redisClient.Get(context.Background(), "user:"+userID).Bytes()
				if err == nil {
					var cached userCacheEntry
					if json.Unmarshal(val, &cached) == nil {
						c.Set("user_id", cached.ID)
						c.Set("email", cached.Email)
						c.Set("plan", cached.Plan)
						found = true
					}
				}
			}
		}

		if !found {
			user, err := userRepo.GetByID(c.Request.Context(), userID)
			if err != nil || user == nil {
				log.Warn().Err(err).Str("user_id", userID).Msg("user profile not found in db")
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user profile not found"})
				return
			}

			c.Set("user_id", user.ID)
			c.Set("email", user.Email)
			c.Set("plan", user.Plan)

			// Cache in Redis for 5 minutes (best-effort)
			if hasRedis {
				if redisClient, ok := rdb.(*redis.Client); ok {
					if data, err := json.Marshal(userCacheEntry{
						ID:    user.ID,
						Email: user.Email,
						Plan:  user.Plan,
					}); err == nil {
						redisClient.Set(context.Background(), "user:"+userID, data, 5*time.Minute)
					}
				}
			}
		}

		c.Next()
	}
}
