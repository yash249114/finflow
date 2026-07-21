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
	MLAPIKey              string
	LemonSqueezyAPIKey    string
	LemonSqueezyStoreID   string
	LemonSqueezyVariantID string
	LemonSqueezyWebhookSecret string
	FrontendURL               string
	AppEnv                string

	// AIOps
	TelemetryStream    string
	AlertEmailFrom     string
	SMTPHost           string
	SMTPPort           int
	SMTPUser           string
	SMTPPassword       string
	AlertEmailTo       string
	GitHubToken        string
	GitHubOwner        string
	GitHubRepo         string
	OpenAIAPIKey       string
	AnthropicAPIKey    string
	GeminiAPIKey       string
	AIOpsOwnerEmail    string
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
		DatabaseURL:       getEnv("DATABASE_URL", ""),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:         getEnv("JWT_SECRET", ""),
		JWTAccessTTLMin:   accessTTL,
		JWTRefreshTTLDays: refreshTTL,
		MLServiceURL:      getEnv("ML_SERVICE_URL", "http://localhost:8001"),
		MLAPIKey:          getEnv("ML_API_KEY", ""),
		LemonSqueezyAPIKey:    getEnv("LEMONSQUEEZY_API_KEY", ""),
		LemonSqueezyStoreID:   getEnv("LEMONSQUEEZY_STORE_ID", ""),
		LemonSqueezyVariantID: getEnv("LEMONSQUEEZY_VARIANT_ID", ""),
		LemonSqueezyWebhookSecret: getEnv("LEMONSQUEEZY_WEBHOOK_SECRET", ""),
		FrontendURL:       getEnv("FRONTEND_URL", "http://localhost:3000"),
		AppEnv:            getEnv("APP_ENV", "development"),

		TelemetryStream: getEnv("TELEMETRY_STREAM", "finflow:telemetry"),
		AlertEmailFrom: getEnv("ALERT_EMAIL_FROM", "aiops@finflow.ai"),
		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       getIntEnv("SMTP_PORT", 587),
		SMTPUser:       getEnv("SMTP_USER", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		AlertEmailTo:   getEnv("ALERT_EMAIL_TO", ""),
		GitHubToken:    getEnv("GITHUB_TOKEN", ""),
		GitHubOwner:    getEnv("GITHUB_OWNER", "yash249114"),
		GitHubRepo:     getEnv("GITHUB_REPO", "finflow"),
		OpenAIAPIKey:   getEnv("OPENAI_API_KEY", ""),
		AnthropicAPIKey: getEnv("ANTHROPIC_API_KEY", ""),
		GeminiAPIKey:   getEnv("GEMINI_API_KEY", ""),
		AIOpsOwnerEmail: getEnv("AIOPS_OWNER_EMAIL", ""),
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

func getIntEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
