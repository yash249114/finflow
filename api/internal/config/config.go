package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/rs/zerolog/log"
)

type Config struct {
	Port                      string
	DatabaseURL               string
	RedisURL                  string
	JWTSecret                 string
	JWTAccessTTLMin           int
	JWTRefreshTTLDays         int
	MLServiceURL              string
	MLAPIKey                  string
	LemonSqueezyAPIKey        string
	LemonSqueezyStoreID       string
	LemonSqueezyVariantID     string
	LemonSqueezyWebhookSecret string
	FrontendURL               string
	AppEnv                    string

	// AI Providers
	OpenAIAPIKey    string
	AnthropicAPIKey string
	GeminiAPIKey    string

	// Security
	RecaptchaSecretKey string
	UpstashRedisURL    string
	UpstashRedisToken  string

	// AIOps — Self-healing / Self-monitoring
	TelemetryStream     string
	AlertEmailFrom      string
	SMTPHost            string
	SMTPPort            int
	SMTPUser            string
	SMTPPassword        string
	AlertEmailTo        string
	GitHubToken         string
	GitHubOwner         string
	GitHubRepo          string
	AIOpsOwnerEmail     string
	Web3FormsKey        string
	QuotaRefreshMinutes int
}

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
		Port:                      getEnv("PORT", "8080"),
		DatabaseURL:               getEnv("DATABASE_URL", ""),
		RedisURL:                  getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:                 getEnv("JWT_SECRET", ""),
		JWTAccessTTLMin:           accessTTL,
		JWTRefreshTTLDays:         refreshTTL,
		MLServiceURL:              getEnv("ML_SERVICE_URL", "http://localhost:8001"),
		MLAPIKey:                  getEnv("ML_API_KEY", ""),
		LemonSqueezyAPIKey:        getEnv("LEMONSQUEEZY_API_KEY", ""),
		LemonSqueezyStoreID:       getEnv("LEMONSQUEEZY_STORE_ID", ""),
		LemonSqueezyVariantID:     getEnv("LEMONSQUEEZY_VARIANT_ID", ""),
		LemonSqueezyWebhookSecret: getEnv("LEMONSQUEEZY_WEBHOOK_SECRET", ""),
		FrontendURL:               getEnv("FRONTEND_URL", "http://localhost:3000"),
		AppEnv:                    getEnv("APP_ENV", "development"),
		OpenAIAPIKey:              getEnv("OPENAI_API_KEY", ""),
		AnthropicAPIKey:           getEnv("ANTHROPIC_API_KEY", ""),
		GeminiAPIKey:              getEnv("GEMINI_API_KEY", ""),
		RecaptchaSecretKey:        getEnv("RECAPTCHA_SECRET_KEY", ""),
		UpstashRedisURL:           getEnv("UPSTASH_REDIS_REST_URL", ""),
		UpstashRedisToken:         getEnv("UPSTASH_REDIS_REST_TOKEN", ""),
		TelemetryStream:           getEnv("TELEMETRY_STREAM", "finflow:telemetry"),
		AlertEmailFrom:            getEnv("ALERT_EMAIL_FROM", "aiops@finflow.ai"),
		SMTPHost:                  getEnv("SMTP_HOST", ""),
		SMTPPort:                  getIntEnv("SMTP_PORT", 587),
		SMTPUser:                  getEnv("SMTP_USER", ""),
		SMTPPassword:              getEnv("SMTP_PASSWORD", ""),
		AlertEmailTo:              getEnv("ALERT_EMAIL_TO", ""),
		GitHubToken:               getEnv("GITHUB_TOKEN", ""),
		GitHubOwner:               getEnv("GITHUB_OWNER", "yash249114"),
		GitHubRepo:                getEnv("GITHUB_REPO", "finflow"),
		AIOpsOwnerEmail:           getEnv("AIOPS_OWNER_EMAIL", ""),
		Web3FormsKey:              getEnv("WEB3FORMS_KEY", ""),
		QuotaRefreshMinutes:       getIntEnv("QUOTA_REFRESH_MINUTES", 5),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	// Billing: require all four LemonSqueezy keys or disable billing.
	if cfg.LemonSqueezyAPIKey == "" || cfg.LemonSqueezyStoreID == "" || cfg.LemonSqueezyVariantID == "" || cfg.LemonSqueezyWebhookSecret == "" {
		cfg.LemonSqueezyAPIKey = ""
		cfg.LemonSqueezyStoreID = ""
		cfg.LemonSqueezyVariantID = ""
		cfg.LemonSqueezyWebhookSecret = ""
		log.Warn().Msg("LEMONSQUEEZY_API_KEY, STORE_ID, VARIANT_ID, or WEBHOOK_SECRET missing — billing features disabled")
	}

	return cfg, nil
}

func (c *Config) BillingEnabled() bool {
	return c.LemonSqueezyAPIKey != "" && c.LemonSqueezyStoreID != "" &&
		c.LemonSqueezyVariantID != "" && c.LemonSqueezyWebhookSecret != ""
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