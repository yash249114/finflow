package entitlements

import "time"

// Feature represents a single feature flag in the catalog.
type Feature struct {
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	IsBeta      bool      `json:"is_beta"`
	IsInternal  bool      `json:"is_internal"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FeatureEntitlement represents the entitlement for a feature on a specific tier.
type FeatureEntitlement struct {
	ID               string    `json:"id"`
	FeatureName      string    `json:"feature_name"`
	TierName         string    `json:"tier_name"`
	Enabled          bool      `json:"enabled"`
	RolloutPercentage int      `json:"rollout_percentage"`
	LimitValue       *int      `json:"limit_value,omitempty"`
	LimitUnit        string    `json:"limit_unit"`
	RefreshInterval  string    `json:"refresh_interval"`
	Priority         int       `json:"priority"`
	MaxBatchSize     *int      `json:"max_batch_size,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// UserFeatureOverride represents a per-user override for a feature.
type UserFeatureOverride struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"user_id"`
	FeatureName        string    `json:"feature_name"`
	Enabled            *bool     `json:"enabled,omitempty"`
	OverrideLimitValue *int      `json:"override_limit_value,omitempty"`
	OverrideUntil      *time.Time `json:"override_until,omitempty"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}
