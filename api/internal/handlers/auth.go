// api/internal/handlers/auth.go
package handlers

import (
	"net/http"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
	jwtService "github.com/finflow/api/internal/services/jwt"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	userRepo *db.UserRepo
	jwt      *jwtService.Service
	secure   bool // true in production for Secure cookies
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(userRepo *db.UserRepo, jwt *jwtService.Service, appEnv string) *AuthHandler {
	return &AuthHandler{
		userRepo: userRepo,
		jwt:      jwt,
		secure:   appEnv == "production",
	}
}

// Register creates a new user and issues JWT tokens.
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: email, password (min 8 chars), and full_name are required"})
		return
	}

	// Check if email already exists
	existing, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("checking existing user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// Hash password with bcrypt cost 12
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		log.Error().Err(err).Msg("hashing password")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Create user
	user, err := h.userRepo.Create(c.Request.Context(), req.Email, string(hash), req.FullName)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("creating user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Issue tokens
	if err := h.issueTokens(c, user); err != nil {
		log.Error().Err(err).Str("user_id", user.ID).Msg("issuing tokens")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user": models.UserResponse{
			ID:       user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Plan:     user.Plan,
		},
	})
}

// Login verifies credentials and issues JWT tokens.
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("looking up user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	if err := h.issueTokens(c, user); err != nil {
		log.Error().Err(err).Str("user_id", user.ID).Msg("issuing tokens")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

// Refresh rotates the refresh token and issues a new access token.
func (h *AuthHandler) Refresh(c *gin.Context) {
	rawToken, err := c.Cookie("refresh_token")
	if err != nil || rawToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token required"})
		return
	}

	tokenHash := jwtService.HashToken(rawToken)

	// Verify token exists and is not expired
	rt, err := h.userRepo.GetRefreshToken(c.Request.Context(), tokenHash)
	if err != nil {
		log.Error().Err(err).Msg("looking up refresh token")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if rt == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}
	if time.Now().After(rt.ExpiresAt) {
		// Clean up expired token
		_ = h.userRepo.DeleteRefreshToken(c.Request.Context(), tokenHash)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token expired"})
		return
	}

	// Delete old refresh token (rotation)
	if err := h.userRepo.DeleteRefreshToken(c.Request.Context(), tokenHash); err != nil {
		log.Error().Err(err).Msg("deleting old refresh token")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Look up user for fresh claims
	user, err := h.userRepo.GetByID(c.Request.Context(), rt.UserID)
	if err != nil || user == nil {
		log.Error().Err(err).Str("user_id", rt.UserID).Msg("looking up user for refresh")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Issue new token pair
	if err := h.issueTokens(c, user); err != nil {
		log.Error().Err(err).Str("user_id", user.ID).Msg("issuing tokens on refresh")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Logout invalidates the refresh token and clears cookies.
func (h *AuthHandler) Logout(c *gin.Context) {
	rawToken, err := c.Cookie("refresh_token")
	if err == nil && rawToken != "" {
		tokenHash := jwtService.HashToken(rawToken)
		if err := h.userRepo.DeleteRefreshToken(c.Request.Context(), tokenHash); err != nil {
			log.Error().Err(err).Msg("deleting refresh token on logout")
		}
	}

	// Clear cookies
	h.clearCookies(c)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Me returns the current authenticated user's info.
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	user, err := h.userRepo.GetByID(c.Request.Context(), userID.(string))
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
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

// ─── Helpers ──────────────────────────────────────────────

func (h *AuthHandler) issueTokens(c *gin.Context, user *models.User) error {
	// Generate access token
	accessToken, accessExp, err := h.jwt.GenerateAccessToken(user.ID, user.Email, user.Plan)
	if err != nil {
		return err
	}

	// Generate refresh token
	rawRefresh, refreshHash, refreshExp, err := h.jwt.GenerateRefreshToken()
	if err != nil {
		return err
	}

	// Store refresh token hash in DB
	if err := h.userRepo.SaveRefreshToken(c.Request.Context(), user.ID, refreshHash, refreshExp); err != nil {
		return err
	}

	// Set httpOnly cookies
	accessMaxAge := int(time.Until(accessExp).Seconds())
	refreshMaxAge := int(time.Until(refreshExp).Seconds())

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("access_token", accessToken, accessMaxAge, "/", "", h.secure, true)
	c.SetCookie("refresh_token", rawRefresh, refreshMaxAge, "/api/v1/auth", "", h.secure, true)

	return nil
}

func (h *AuthHandler) clearCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("access_token", "", -1, "/", "", h.secure, true)
	c.SetCookie("refresh_token", "", -1, "/api/v1/auth", "", h.secure, true)
}
