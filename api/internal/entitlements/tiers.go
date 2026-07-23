package entitlements

import "time"

// Tier represents a product tier (Blue Sapphire, Emerald, Diamond).
type Tier struct {
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`

	// Entitlements is populated after loading from DB.
	Entitlements map[string]*FeatureEntitlement `json:"entitlements"`
}

// TierResponse is the public API response for a tier.
type TierResponse struct {
	Name             string                   `json:"name"`
	DisplayName      string                   `json:"display_name"`
	Description      string                   `json:"description"`
	SortOrder        int                      `json:"sort_order"`
	FeatureCount     int                      `json:"feature_count"`
	Entitlements     []FeatureEntitlementResponse `json:"entitlements"`
}

// FeatureEntitlementResponse is the public API response for an entitlement.
type FeatureEntitlementResponse struct {
	FeatureName     string `json:"feature_name"`
	FeatureDisplay  string `json:"feature_display"`
	FeatureCategory string `json:"feature_category"`
	Enabled         bool   `json:"enabled"`
	LimitValue      *int   `json:"limit_value,omitempty"`
	LimitUnit       string `json:"limit_unit"`
	RefreshInterval string `json:"refresh_interval"`
	Priority        int    `json:"priority"`
}
