package entitlements

// UpgradeRecommendation represents a suggested tier upgrade for a user.
type UpgradeRecommendation struct {
	CurrentTier      string         `json:"current_tier"`
	RecommendedTier  string         `json:"recommended_tier"`
	FeaturesAtLimit  []FeatureLimit `json:"features_at_limit,omitempty"`
	UnlockedFeatures []string       `json:"unlocked_features,omitempty"`
	UnlockCount      int            `json:"unlock_count"`
	Urgency          string         `json:"urgency"` // "high", "medium", "low"
}

// FeatureLimit represents a feature that is approaching or at its usage limit.
type FeatureLimit struct {
	FeatureName     string  `json:"feature_name"`
	FeatureDisplay  string  `json:"feature_display"`
	CurrentUsage    int     `json:"current_usage"`
	LimitValue      int     `json:"limit_value"`
	UsagePercentage float64 `json:"usage_percentage"`
	IsAtLimit       bool    `json:"is_at_limit"`
}

// UpgradeResponse is the API response for an upgrade evaluation.
type UpgradeResponse struct {
	Recommendation *UpgradeRecommendation `json:"recommendation,omitempty"`
	Tier           string                 `json:"tier"`
	NextTier       string                 `json:"next_tier"`
	HasNextTier    bool                   `json:"has_next_tier"`
}
