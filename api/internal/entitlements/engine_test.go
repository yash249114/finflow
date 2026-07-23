package entitlements

import (
	"context"
	"testing"
	"time"
)

func TestHash(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"", 0},
		{"a", 97},
		{"hello", 99162322},
	}
	for _, tt := range tests {
		got := hash(tt.input)
		if got != tt.want {
			t.Errorf("hash(%q) = %d, want %d", tt.input, got, tt.want)
		}
	}
}

func TestHashDeterministic(t *testing.T) {
	h1 := hash("cash_flow_forecastfree")
	h2 := hash("cash_flow_forecastfree")
	if h1 != h2 {
		t.Errorf("hash should be deterministic: %d != %d", h1, h2)
	}
}

func TestGetPeriodKey(t *testing.T) {
	now := time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC)
	key := getPeriodKey("test_feature", now)
	expected := "test_feature_2026_07"
	if key != expected {
		t.Errorf("getPeriodKey = %q, want %q", key, expected)
	}
}

func TestGetPeriodRange(t *testing.T) {
	now := time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC)
	start, end := getPeriodRange("test", now)

	if start.Year() != 2026 || start.Month() != 7 || start.Day() != 1 {
		t.Errorf("start should be 2026-07-01, got %v", start)
	}
	if end.Year() != 2026 || end.Month() != 8 || end.Day() != 1 {
		t.Errorf("end should be 2026-08-01, got %v", end)
	}
}

func TestGetPeriodRangeEdge(t *testing.T) {
	now := time.Date(2026, 12, 15, 10, 0, 0, 0, time.UTC)
	start, end := getPeriodRange("test", now)

	if start.Year() != 2026 || start.Month() != 12 || start.Day() != 1 {
		t.Errorf("start should be 2026-12-01, got %v", start)
	}
	if end.Year() != 2027 || end.Month() != 1 || end.Day() != 1 {
		t.Errorf("end should be 2027-01-01, got %v", end)
	}
}

func TestEvaluateUrgency(t *testing.T) {
	cases := []struct {
		name   string
		limits []FeatureLimit
		want   string
	}{
		{
			name:   "empty",
			limits: nil,
			want:   "low",
		},
		{
			name: "at limit",
			limits: []FeatureLimit{
				{FeatureName: "test", CurrentUsage: 10, LimitValue: 10, IsAtLimit: true},
			},
			want: "high",
		},
		{
			name: "approaching limit",
			limits: []FeatureLimit{
				{FeatureName: "test", CurrentUsage: 9, LimitValue: 10, UsagePercentage: 90},
			},
			want: "medium",
		},
		{
			name: "low usage",
			limits: []FeatureLimit{
				{FeatureName: "test", CurrentUsage: 3, LimitValue: 10, UsagePercentage: 30},
			},
			want: "low",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := evaluateUrgency(tc.limits)
			if got != tc.want {
				t.Errorf("evaluateUrgency = %q, want %q", got, tc.want)
			}
		})
	}
}

// ─── Integration tests ─────────────────────────────────────

func TestIntegrationLoadFeatures(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	// Uses environment variables: DATABASE_URL and REDIS_URL
	pool, rdb, err := testSetup()
	if err != nil {
		t.Fatalf("test setup: %v", err)
	}
	defer pool.Close()
	defer rdb.Close()

	engine := NewEngine(pool, rdb)
	defer engine.Stop()

	if err := engine.Start(context.Background()); err != nil {
		t.Fatalf("engine start: %v", err)
	}

	features := engine.GetAllFeatures()
	if len(features) == 0 {
		t.Fatal("expected non-empty features")
	}

	found := false
	for _, f := range features {
		if f.Name == "cash_flow_forecast" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'cash_flow_forecast' feature to exist")
	}
}

func TestIntegrationTierEntitlements(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	pool, rdb, err := testSetup()
	if err != nil {
		t.Fatalf("test setup: %v", err)
	}
	defer pool.Close()
	defer rdb.Close()

	engine := NewEngine(pool, rdb)
	defer engine.Stop()

	if err := engine.Start(context.Background()); err != nil {
		t.Fatalf("engine start: %v", err)
	}

	tests := []struct {
		tier    string
		feature string
		want    bool
	}{
		{"free", "transaction_classification", true},
		{"free", "cash_flow_forecast", true},
		{"free", "basic_copilot", true},
		{"free", "advanced_copilot", false},
		{"free", "scenario_simulation", false},
		{"free", "ai_cfo", false},
		{"pro", "transaction_classification", true},
		{"pro", "cash_flow_forecast", true},
		{"pro", "advanced_copilot", true},
		{"pro", "scenario_simulation", true},
		{"pro", "monte_carlo", true},
		{"pro", "provider_routing", false},
		{"pro", "ai_cfo", false},
		{"max", "transaction_classification", true},
		{"max", "provider_routing", true},
		{"max", "ai_cfo", true},
		{"max", "voice_ai", true},
		{"max", "nlp_financial_analysis", true},
	}

	for _, tt := range tests {
		t.Run(tt.tier+"/"+tt.feature, func(t *testing.T) {
			got := engine.IsFeatureEnabled(tt.tier, tt.feature)
			if got != tt.want {
				t.Errorf("IsFeatureEnabled(%q, %q) = %v, want %v", tt.tier, tt.feature, got, tt.want)
			}
		})
	}
}

func TestIntegrationUsageTracking(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	pool, rdb, err := testSetup()
	if err != nil {
		t.Fatalf("test setup: %v", err)
	}
	defer pool.Close()
	defer rdb.Close()

	engine := NewEngine(pool, rdb)
	defer engine.Stop()
	engine.Start(context.Background())

	userID := "00000000-0000-0000-0000-000000000000"
	featureName := "test_usage_feature"

	// Record usage
	if err := engine.RecordUsage(context.Background(), userID, featureName); err != nil {
		t.Fatalf("RecordUsage: %v", err)
	}

	usage, err := engine.GetUsage(context.Background(), userID, featureName)
	if err != nil {
		t.Fatalf("GetUsage: %v", err)
	}
	if usage < 1 {
		t.Errorf("expected usage >= 1, got %d", usage)
	}

	// Verify quota check works
	allowed, remaining, limit, err := engine.CheckQuota(context.Background(), userID, "free", featureName)
	if err != nil {
		t.Fatalf("CheckQuota: %v", err)
	}
	if allowed {
		t.Logf("Quota check: allowed=%v, remaining=%d, limit=%d", allowed, remaining, limit)
	}
}

func TestIntegrationUpgradeEvaluation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	pool, rdb, err := testSetup()
	if err != nil {
		t.Fatalf("test setup: %v", err)
	}
	defer pool.Close()
	defer rdb.Close()

	engine := NewEngine(pool, rdb)
	defer engine.Stop()
	engine.Start(context.Background())

	userID := "00000000-0000-0000-0000-000000000000"

	rec, err := engine.EvaluateUpgrade(context.Background(), userID, "free")
	if err != nil {
		t.Fatalf("EvaluateUpgrade: %v", err)
	}
	if rec == nil {
		t.Log("No upgrade recommendation (expected for test user)")
	} else {
		t.Logf("Upgrade rec: %s -> %s (urgency: %s, unlock: %d features)",
			rec.CurrentTier, rec.RecommendedTier, rec.Urgency, rec.UnlockCount)
	}
}
