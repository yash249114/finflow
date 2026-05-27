// api/internal/services/jwt/jwt.go
package jwt

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Service handles JWT access token and refresh token operations.
type Service struct {
	secret        []byte
	accessTTLMin  int
	refreshTTLDay int
}

// NewService creates a new JWT service.
func NewService(secret string, accessTTLMin, refreshTTLDays int) *Service {
	return &Service{
		secret:        []byte(secret),
		accessTTLMin:  accessTTLMin,
		refreshTTLDay: refreshTTLDays,
	}
}

// Claims represents the JWT access token claims payload.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Plan   string `json:"plan"`
	jwt.RegisteredClaims
}

// GenerateAccessToken creates a signed JWT access token.
func (s *Service) GenerateAccessToken(userID, email, plan string) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(s.accessTTLMin) * time.Minute)

	claims := &Claims{
		UserID: userID,
		Email:  email,
		Plan:   plan,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "finflow",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("signing access token: %w", err)
	}

	return signed, expiresAt, nil
}

// GenerateRefreshToken creates a random refresh token and its SHA-256 hash for DB storage.
func (s *Service) GenerateRefreshToken() (rawToken string, hash string, expiresAt time.Time, err error) {
	rawToken = uuid.New().String()
	hash = HashToken(rawToken)
	expiresAt = time.Now().Add(time.Duration(s.refreshTTLDay) * 24 * time.Hour)
	return rawToken, hash, expiresAt, nil
}

// ValidateAccessToken parses and validates a JWT access token, returning the claims.
func (s *Service) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parsing access token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Map Supabase Subject (sub) to UserID if user_id claim is empty
	if claims.UserID == "" && claims.Subject != "" {
		claims.UserID = claims.Subject
	}

	return claims, nil
}

// HashToken computes a SHA-256 hash of a raw token string.
func HashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// AccessTTLMinutes returns the access token TTL for cookie max-age.
func (s *Service) AccessTTLMinutes() int {
	return s.accessTTLMin
}

// RefreshTTLDays returns the refresh token TTL for cookie max-age.
func (s *Service) RefreshTTLDays() int {
	return s.refreshTTLDay
}
