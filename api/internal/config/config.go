// api/internal/config/config.go
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port              string
	DatabaseURL       string
	RedisURL          string
	JWTSecret         string
	JWTAccessTTLMin   int
	JWTRefreshTTLDays int
	MLServiceURL          string
	LemonSqueezyAPIKey    string
	LemonSqueezyStoreID   string
	LemonSqueezyVariantID string
	LemonSqueezyWebhookSecret string
	FrontendURL               string
	AppEnv                string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	accessTTL, err := strconv.Atoi(getEnv("JWT_ACCESS_TTL_MINUTES", "15"))
	if err != nil {
		return nil, fmt.Errorf("parsing JWT_ACCESS_TTL_MINUTES: %w", err)
	}

	refreshTTL, err := strconv.Atoi(getEnv("JWT_REFRESH_TTL_DAYS", "7"))
	if err != nil {
		return nil, fmt.Errorf("parsing JWT_REFRESH_TTL_DAYS: %w", err)
	}

	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/finflow"),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:         getEnv("JWT_SECRET", ""),
		JWTAccessTTLMin:   accessTTL,
		JWTRefreshTTLDays: refreshTTL,
		MLServiceURL:      getEnv("ML_SERVICE_URL", "http://localhost:8001"),
		LemonSqueezyAPIKey:    getEnv("LEMONSQUEEZY_API_KEY", ""),
		LemonSqueezyStoreID:   getEnv("LEMONSQUEEZY_STORE_ID", ""),
		LemonSqueezyVariantID: getEnv("LEMONSQUEEZY_VARIANT_ID", ""),
		LemonSqueezyWebhookSecret: getEnv("LEMONSQUEEZY_WEBHOOK_SECRET", ""),
		FrontendURL:       getEnv("FRONTEND_URL", "http://localhost:3000"),
		AppEnv:            getEnv("APP_ENV", "development"),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
