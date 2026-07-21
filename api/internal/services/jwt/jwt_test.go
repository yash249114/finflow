package jwt

import (
	"testing"
	"time"
)

func TestGenerateAccessToken(t *testing.T) {
	svc := NewService("test-secret-key-for-testing", 15, 7)

	token, expiresAt, err := svc.GenerateAccessToken("user-123", "test@example.com", "pro")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if expiresAt.Before(time.Now()) {
		t.Fatal("expected expiry in the future")
	}
	if expiresAt.After(time.Now().Add(20 * time.Minute)) {
		t.Fatal("expiry too far in the future")
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	svc := NewService("test-secret", 15, 7)

	token, _, err := svc.GenerateAccessToken("user-456", "alice@test.com", "free")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	claims, err := svc.ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if claims.UserID != "user-456" {
		t.Errorf("UserID = %q, want %q", claims.UserID, "user-456")
	}
	if claims.Email != "alice@test.com" {
		t.Errorf("Email = %q, want %q", claims.Email, "alice@test.com")
	}
	if claims.Plan != "free" {
		t.Errorf("Plan = %q, want %q", claims.Plan, "free")
	}
}

func TestValidateAccessToken_Expired(t *testing.T) {
	// TTL of 0 minutes → immediately expired
	svc := NewService("test-secret", 0, 7)

	token, _, err := svc.GenerateAccessToken("user-789", "bob@test.com", "pro")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	// Small sleep to ensure the token is expired
	time.Sleep(10 * time.Millisecond)

	_, err = svc.ValidateAccessToken(token)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestValidateAccessToken_WrongSecret(t *testing.T) {
	svc1 := NewService("secret-one", 15, 7)
	svc2 := NewService("secret-two", 15, 7)

	token, _, _ := svc1.GenerateAccessToken("user-1", "a@b.com", "free")

	_, err := svc2.ValidateAccessToken(token)
	if err == nil {
		t.Fatal("expected error when validating with wrong secret")
	}
}

func TestValidateAccessToken_Malformed(t *testing.T) {
	svc := NewService("test-secret", 15, 7)

	_, err := svc.ValidateAccessToken("not-a-jwt-token")
	if err == nil {
		t.Fatal("expected error for malformed token")
	}
}

func TestValidateAccessToken_EmptyString(t *testing.T) {
	svc := NewService("test-secret", 15, 7)

	_, err := svc.ValidateAccessToken("")
	if err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	svc := NewService("test-secret", 15, 7)

	raw, hash, expiresAt, err := svc.GenerateRefreshToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if raw == "" {
		t.Fatal("expected non-empty raw token")
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if raw == hash {
		t.Fatal("raw token and hash should be different")
	}
	if expiresAt.Before(time.Now()) {
		t.Fatal("expected expiry in the future")
	}
}

func TestHashToken_Deterministic(t *testing.T) {
	raw := "my-raw-refresh-token"
	h1 := HashToken(raw)
	h2 := HashToken(raw)
	if h1 != h2 {
		t.Errorf("HashToken not deterministic: %q != %q", h1, h2)
	}
}

func TestHashToken_DifferentInputs(t *testing.T) {
	h1 := HashToken("token-a")
	h2 := HashToken("token-b")
	if h1 == h2 {
		t.Error("different inputs should produce different hashes")
	}
}

func TestAccessTTLMinutes(t *testing.T) {
	svc := NewService("secret", 42, 7)
	if got := svc.AccessTTLMinutes(); got != 42 {
		t.Errorf("AccessTTLMinutes() = %d, want 42", got)
	}
}

func TestRefreshTTLDays(t *testing.T) {
	svc := NewService("secret", 15, 30)
	if got := svc.RefreshTTLDays(); got != 30 {
		t.Errorf("RefreshTTLDays() = %d, want 30", got)
	}
}
