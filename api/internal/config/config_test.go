package config

import (
	"os"
	"testing"
)

func setenv(t *testing.T, key, value string) {
	t.Helper()
	prev := os.Getenv(key)
	os.Setenv(key, value)
	t.Cleanup(func() { os.Setenv(key, prev) })
}

func TestLoadMinimalRequired(t *testing.T) {
	setenv(t, "DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	setenv(t, "JWT_SECRET", "test-secret-at-least-32-chars-long-for-testing-here")
	setenv(t, "ML_API_KEY", "test-ml-key")
	setenv(t, "APP_ENV", "development")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() with minimal required vars returned error: %v", err)
	}
	if cfg.BillingEnabled() {
		t.Error("BillingEnabled() should be false when all LemonSqueezy keys are empty")
	}
}

func TestLoadMissingJWT(t *testing.T) {
	setenv(t, "DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	setenv(t, "JWT_SECRET", "")
	setenv(t, "ML_API_KEY", "test-ml-key")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() should fail when JWT_SECRET is missing")
	}
}

func TestLoadMissingDatabase(t *testing.T) {
	setenv(t, "DATABASE_URL", "")
	setenv(t, "JWT_SECRET", "test-secret-at-least-32-chars-long-for-testing-here")
	setenv(t, "ML_API_KEY", "test-ml-key")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() should fail when DATABASE_URL is missing")
	}
}

func TestBillingEnabledWithAllKeys(t *testing.T) {
	setenv(t, "DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	setenv(t, "JWT_SECRET", "test-secret-at-least-32-chars-long-for-testing-here")
	setenv(t, "ML_API_KEY", "test-ml-key")
	setenv(t, "LEMONSQUEEZY_API_KEY", "test-api-key")
	setenv(t, "LEMONSQUEEZY_STORE_ID", "test-store-id")
	setenv(t, "LEMONSQUEEZY_VARIANT_ID", "test-variant-id")
	setenv(t, "LEMONSQUEEZY_WEBHOOK_SECRET", "test-webhook-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() with billing keys returned error: %v", err)
	}
	if !cfg.BillingEnabled() {
		t.Error("BillingEnabled() should be true when all LemonSqueezy keys are set")
	}
}

func TestBillingDisabledWithPartialKeys(t *testing.T) {
	setenv(t, "DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	setenv(t, "JWT_SECRET", "test-secret-at-least-32-chars-long-for-testing-here")
	setenv(t, "ML_API_KEY", "test-ml-key")
	// Only set API key, leave others empty
	setenv(t, "LEMONSQUEEZY_API_KEY", "test-api-key")
	setenv(t, "LEMONSQUEEZY_STORE_ID", "")
	setenv(t, "LEMONSQUEEZY_VARIANT_ID", "")
	setenv(t, "LEMONSQUEEZY_WEBHOOK_SECRET", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() with partial billing keys returned error: %v", err)
	}
	if cfg.BillingEnabled() {
		t.Error("BillingEnabled() should be false when some LemonSqueezy keys are missing")
	}
	if cfg.LemonSqueezyAPIKey != "" {
		t.Error("LemonSqueezyAPIKey should be cleared when billing is disabled")
	}
}

func TestOptionalAIVarsDefaultEmpty(t *testing.T) {
	setenv(t, "DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	setenv(t, "JWT_SECRET", "test-secret-at-least-32-chars-long-for-testing-here")
	setenv(t, "ML_API_KEY", "test-ml-key")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.OpenAIAPIKey != "" {
		t.Error("OpenAIAPIKey should default to empty")
	}
	if cfg.AnthropicAPIKey != "" {
		t.Error("AnthropicAPIKey should default to empty")
	}
	if cfg.GeminiAPIKey != "" {
		t.Error("GeminiAPIKey should default to empty")
	}
	if cfg.RecaptchaSecretKey != "" {
		t.Error("RecaptchaSecretKey should default to empty")
	}
}
