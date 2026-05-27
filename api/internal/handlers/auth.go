// api/internal/handlers/auth.go
package handlers

import (
	"net/http"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
	jwtService "github.com/finflow/api/internal/services/jwt"
	"github.com/gin-gonic/gin"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	userRepo *db.UserRepo
	jwt      *jwtService.Service
	secure   bool
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(userRepo *db.UserRepo, jwt *jwtService.Service, appEnv string) *AuthHandler {
	return &AuthHandler{
		userRepo: userRepo,
		jwt:      jwt,
		secure:   appEnv == "production",
	}
}

// Register is deprecated. Registration is handled via Supabase Auth directly.
func (h *AuthHandler) Register(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "registration is handled via Supabase Auth directly"})
}

// Login is deprecated. Login is handled via Supabase Auth directly.
func (h *AuthHandler) Login(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "login is handled via Supabase Auth directly"})
}

// Refresh is deprecated. Session refresh is handled via Supabase Auth directly.
func (h *AuthHandler) Refresh(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "session refresh is handled via Supabase Auth directly"})
}

// Logout is deprecated. Logout is handled via Supabase Auth directly.
func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "logout is handled via Supabase Auth directly"})
}

// Me returns the current authenticated user's profile info from the DB.
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	user, err := h.userRepo.GetByID(c.Request.Context(), userID.(string))
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user profile not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": models.UserResponse{
			ID:       user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Plan:     user.Plan,
		},
	})
}
