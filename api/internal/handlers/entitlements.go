package handlers

import (
	"net/http"

	"github.com/finflow/api/internal/entitlements"
	"github.com/gin-gonic/gin"
)

// EntitlementHandler serves the AI Product Layer API endpoints.
type EntitlementHandler struct {
	engine *entitlements.Engine
}

// NewEntitlementHandler creates a new EntitlementHandler.
func NewEntitlementHandler(engine *entitlements.Engine) *EntitlementHandler {
	return &EntitlementHandler{engine: engine}
}

// ListFeatures returns all available features.
func (h *EntitlementHandler) ListFeatures(c *gin.Context) {
	features := h.engine.GetAllFeatures()
	c.JSON(http.StatusOK, gin.H{"features": features})
}

// ListTiers returns all tiers with their entitlements.
func (h *EntitlementHandler) ListTiers(c *gin.Context) {
	tiers := h.engine.GetAllTiers()
	c.JSON(http.StatusOK, gin.H{"tiers": tiers})
}

// FeatureStatus is the per-user status of a feature.
type FeatureStatus struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Category    string `json:"category"`
	Enabled     bool   `json:"enabled"`
	IsBeta      bool   `json:"is_beta"`
	CurrentUsage int   `json:"current_usage,omitempty"`
	Limit       int    `json:"limit,omitempty"`
	Remaining   int    `json:"remaining,omitempty"`
	IsUnlimited bool   `json:"is_unlimited,omitempty"`
}

// GetMyEntitlements returns the current user's feature entitlements and usage.
func (h *EntitlementHandler) GetMyEntitlements(c *gin.Context) {
	plan, _ := c.Get("plan")
	tierName, _ := plan.(string)
	if tierName == "" {
		tierName = "free"
	}
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)

	tier, ok := h.engine.GetTier(tierName)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "tier_not_found"})
		return
	}

	features := h.engine.GetAllFeatures()
	statuses := make([]FeatureStatus, 0, len(features))

	for _, feat := range features {
		enabled := h.engine.IsFeatureEnabled(tierName, feat.Name)
		fs := FeatureStatus{
			Name:        feat.Name,
			DisplayName: feat.DisplayName,
			Category:    feat.Category,
			Enabled:     enabled,
			IsBeta:      feat.IsBeta,
		}

		if enabled && uid != "" {
			limit, _, err := h.engine.GetUsageLimit(c.Request.Context(), uid, tierName, feat.Name)
			if err == nil && limit != 0 {
				if limit == -1 {
					fs.IsUnlimited = true
					fs.Limit = -1
					fs.Remaining = -1
				} else {
					fs.Limit = limit
					current, err := h.engine.GetUsage(c.Request.Context(), uid, feat.Name)
					if err == nil {
						fs.CurrentUsage = current
						fs.Remaining = limit - current
						if fs.Remaining < 0 {
							fs.Remaining = 0
						}
					}
				}
			}
		}

		statuses = append(statuses, fs)
	}

	c.JSON(http.StatusOK, gin.H{
		"tier":     tier,
		"features": statuses,
	})
}

// GetMyUsage returns the current user's usage for a specific feature.
func (h *EntitlementHandler) GetMyUsage(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	plan, _ := c.Get("plan")
	tierName, _ := plan.(string)
	if tierName == "" {
		tierName = "free"
	}
	featureName := c.Param("feature")

	if uid == "" || featureName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user_id or feature"})
		return
	}

	current, err := h.engine.GetUsage(c.Request.Context(), uid, featureName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get usage"})
		return
	}

	limit, refresh, err := h.engine.GetUsageLimit(c.Request.Context(), uid, tierName, featureName)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"feature":        featureName,
			"current_usage":  current,
			"limit":          -1,
			"remaining":      -1,
			"is_unlimited":   true,
			"refresh_period": "none",
		})
		return
	}

	isUnlimited := limit == -1
	remaining := -1
	if !isUnlimited {
		remaining = limit - current
		if remaining < 0 {
			remaining = 0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"feature":        featureName,
		"current_usage":  current,
		"limit":          limit,
		"remaining":      remaining,
		"is_unlimited":   isUnlimited,
		"refresh_period": refresh,
	})
}

// GetUpgradeRecommendation returns an upgrade recommendation for the current user.
func (h *EntitlementHandler) GetUpgradeRecommendation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	plan, _ := c.Get("plan")
	tierName, _ := plan.(string)
	if tierName == "" {
		tierName = "free"
	}

	if uid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authentication required"})
		return
	}

	rec, err := h.engine.EvaluateUpgrade(c.Request.Context(), uid, tierName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to evaluate upgrade"})
		return
	}

	tierNames := []string{"free", "pro", "max"}
	nextTier := ""
	hasNext := false
	for i, t := range tierNames {
		if t == tierName && i < len(tierNames)-1 {
			nextTier = tierNames[i+1]
			hasNext = true
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"recommendation": rec,
		"tier":           tierName,
		"next_tier":      nextTier,
		"has_next_tier":  hasNext,
	})
}
