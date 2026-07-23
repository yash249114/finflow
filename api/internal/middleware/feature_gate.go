package middleware

import (
	"net/http"

	"github.com/finflow/api/internal/entitlements"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// FeatureGate creates middleware that checks if a feature is enabled for the user's tier
// and enforces usage quotas.
//
// Usage:
//
//	protected.GET("/forecast", FeatureGate("cash_flow_forecast"), forecastHandler.GetForecast)
func FeatureGate(featureName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("entitlement_engine")
		if !exists {
			c.Next()
			return
		}
		eng, ok := raw.(*entitlements.Engine)
		if !ok {
			c.Next()
			return
		}

		plan, _ := c.Get("plan")
		tierName, _ := plan.(string)
		if tierName == "" {
			tierName = "free"
		}

		if !eng.IsFeatureEnabled(tierName, featureName) {
			log.Debug().Str("feature", featureName).Str("tier", tierName).Msg("Feature not enabled for tier")
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       "feature_not_available",
				"feature":     featureName,
				"message":     "This feature is not available on your current plan. Upgrade to unlock it.",
				"upgrade_url": "/settings/billing",
			})
			return
		}

		userID, _ := c.Get("user_id")
		uid, _ := userID.(string)

		if uid != "" {
			allowed, remaining, limit, err := eng.CheckQuota(c.Request.Context(), uid, tierName, featureName)
			if err != nil {
				log.Warn().Err(err).Str("feature", featureName).Str("user", uid).Msg("Quota check failed")
				c.Next()
				return
			}
			if !allowed {
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error":       "quota_exceeded",
					"feature":     featureName,
					"message":     "You have reached your usage limit for this feature. Upgrade or try again later.",
					"limit":       limit,
					"upgrade_url": "/settings/billing",
					"retry_after": "period_end",
				})
				return
			}

			c.Set("quota_remaining", remaining)
			c.Set("quota_limit", limit)

			if err := eng.RecordUsage(c.Request.Context(), uid, featureName); err != nil {
				log.Warn().Err(err).Str("feature", featureName).Str("user", uid).Msg("Failed to record usage")
			}
		}

		c.Next()
	}
}

// RequireFeature checks if a feature is enabled for the user's tier without tracking usage.
// Suitable for entitlements that should not count against a quota.
func RequireFeature(featureName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("entitlement_engine")
		if !exists {
			c.Next()
			return
		}
		eng, ok := raw.(*entitlements.Engine)
		if !ok {
			c.Next()
			return
		}

		plan, _ := c.Get("plan")
		tierName, _ := plan.(string)
		if tierName == "" {
			tierName = "free"
		}

		if !eng.IsFeatureEnabled(tierName, featureName) {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       "feature_not_available",
				"feature":     featureName,
				"message":     "This feature is not available on your current plan. Upgrade to unlock it.",
				"upgrade_url": "/settings/billing",
			})
			return
		}

		c.Next()
	}
}
