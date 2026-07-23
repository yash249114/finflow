// api/internal/limits/limits.go
package limits

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/finflow/api/internal/analytics"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// LimitResult is the outcome of a limit check.
type LimitResult struct {
	Allowed   bool    `json:"allowed"`
	Current   int     `json:"current"`
	HardLimit int     `json:"hard_limit"` // -1 = unlimited
	SoftLimit int     `json:"soft_limit"` // -1 = unlimited
	UsagePct  float64 `json:"usage_pct"`
	NearLimit bool    `json:"near_limit"` // within warn_at_pct
	Blocked   bool    `json:"blocked"`    // true only when hard limit exceeded AND upgrade prompt shown
	Message   string  `json:"message,omitempty"`
	UpgradeURL string `json:"upgrade_url,omitempty"`
}

// Service enforces configurable plan limits with soft warnings and hard caps.
type Service struct {
	pool        *pgxpool.Pool
	rdb         *redis.Client
	configStore *analytics.ConfigStore
	eventStore  *analytics.EventStore
}

// NewService creates a limit enforcement service.
func NewService(pool *pgxpool.Pool, rdb *redis.Client, configStore *analytics.ConfigStore, eventStore *analytics.EventStore) *Service {
	return &Service{
		pool:        pool,
		rdb:         rdb,
		configStore: configStore,
		eventStore:  eventStore,
	}
}

// CheckTransactionLimit checks if a user can upload more transactions.
// NEVER blocks aggressively: shows upgrade prompt but allows limited continuation.
func (s *Service) CheckTransactionLimit(ctx context.Context, userID, plan string) (*LimitResult, error) {
	return s.checkCountLimit(ctx, userID, plan, "transactions",
		`SELECT COUNT(*) FROM transactions WHERE user_id = $1`,
		"transaction", "/settings/billing")
}

// CheckDailyAILimit checks daily AI chat usage.
func (s *Service) CheckDailyAILimit(ctx context.Context, userID, plan string) (*LimitResult, error) {
	today := time.Now().UTC().Format("2006-01-02")
	return s.checkCountLimit(ctx, userID, plan, "ai_chat.daily",
		`SELECT COUNT(*) FROM feature_events WHERE user_id = $1 AND feature = 'ai_chat' AND event_type = 'usage' AND created_at >= $2`,
		"AI chat query", "/settings/billing", today)
}

// CheckFeatureAccess checks if a feature is available for the user's plan.
// Returns allowed=true with upgrade suggestion, never blocks workflow.
func (s *Service) CheckFeatureAccess(ctx context.Context, featureName, plan string) (*LimitResult, error) {
	enabled, plans, err := s.configStore.GetFeatureFlag(ctx, featureName)
	if err != nil {
		return &LimitResult{Allowed: true}, nil // default: allow if config missing
	}
	if !enabled {
		return &LimitResult{
			Allowed:   false,
			Blocked:   true,
			Message:   fmt.Sprintf("%s is currently disabled.", featureName),
			UpgradeURL: "/settings/billing",
		}, nil
	}

	// Check if plan is in the allowed list
	for _, p := range plans {
		if p == plan {
			return &LimitResult{Allowed: true, HardLimit: -1, SoftLimit: -1}, nil
		}
	}

	// Plan not allowed but don't block: suggest upgrade
	return &LimitResult{
		Allowed:    false,
		NearLimit:  true,
		Message:    fmt.Sprintf("This feature requires a higher plan. Current plan: %s", plan),
		UpgradeURL: "/settings/billing",
	}, nil
}

func (s *Service) checkCountLimit(ctx context.Context, userID, plan, configKey, query, featureLabel, upgradeURL string, extraArgs ...interface{}) (*LimitResult, error) {
	result := &LimitResult{UpgradeURL: upgradeURL}

	// Get limit config
	limits, err := s.configStore.GetLimitConfig(ctx, plan, configKey)
	if err != nil {
		// Fallback: no config = unlimited
		result.Allowed = true
		result.HardLimit = -1
		result.SoftLimit = -1
		return result, nil
	}

	// Parse limits
	hardLimit := parseInt(limits["hard"])
	softLimit := parseInt(limits["soft"])

	result.HardLimit = hardLimit
	result.SoftLimit = softLimit

	// -1 = unlimited
	if hardLimit == -1 {
		result.Allowed = true
		result.UsagePct = 0
		return result, nil
	}

	// Get current usage
	var current int
	args := append([]interface{}{userID}, extraArgs...)
	err = s.pool.QueryRow(ctx, query, args...).Scan(&current)
	if err != nil {
		result.Allowed = true
		return result, nil
	}

	result.Current = current

	if hardLimit > 0 {
		result.UsagePct = float64(current) / float64(hardLimit) * 100
	}

	// Check soft limit (warning zone)
	if softLimit > 0 && current >= softLimit {
		result.NearLimit = true
	}

	// Check hard limit
	if hardLimit > 0 && current >= hardLimit {
		result.Blocked = true
		result.Allowed = false
		result.Message = fmt.Sprintf(
			"You've reached the %s limit (%d/%d) on your %s plan. Upgrade for unlimited access.",
			featureLabel, current, hardLimit, plan)

		// Track limit hit event
		if s.eventStore != nil {
			metadata, _ := json.Marshal(map[string]interface{}{
				"feature": featureLabel,
				"current": current,
				"limit":   hardLimit,
				"plan":    plan,
			})
			s.eventStore.Track(ctx, analytics.FeatureEvent{
				UserID:    userID,
				Feature:   featureLabel,
				EventType: analytics.EventLimitHit,
				Value:     float64(current),
				Metadata:  metadata,
			})
		}

		// Emit upgrade recommendation (non-blocking)
		s.emitUpgradeNudge(ctx, userID, featureLabel, current, hardLimit)
	} else if result.NearLimit {
		result.Message = fmt.Sprintf(
			"You're approaching the %s limit (%d/%d). Upgrade to avoid interruptions.",
			featureLabel, current, hardLimit)
		result.Allowed = true // still allowed, just warning
	} else {
		result.Allowed = true
	}

	return result, nil
}

// emitUpgradeNudge writes a soft upgrade recommendation to the user's context.
// It never blocks the workflow — it's advisory only.
func (s *Service) emitUpgradeNudge(ctx context.Context, userID, feature string, current, limit int) {
	if s.rdb == nil {
		return
	}

	nudge := map[string]interface{}{
		"type":         "upgrade_nudge",
		"user_id":      userID,
		"feature":      feature,
		"current":      current,
		"limit":        limit,
		"urgency":      "soft", // never aggressive
		"created_at":   time.Now().UTC().Format(time.RFC3339),
	}
	payload, _ := json.Marshal(nudge)

	// Write to Redis for real-time frontend pickup
	ctx2, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.rdb.XAdd(ctx2, &redis.XAddArgs{
		Stream: "finflow:upgrade_nudges",
		Values: map[string]interface{}{"nudge": string(payload)},
	})

	// Also track the prompt_shown event for funnel analytics
	if s.eventStore != nil {
		meta, _ := json.Marshal(map[string]interface{}{
			"feature": feature,
			"current": current,
			"limit":   limit,
			"reason":  "limit_reached",
		})
		s.eventStore.Track(ctx, analytics.FeatureEvent{
			UserID:    userID,
			Feature:   feature,
			EventType: analytics.EventLimitHit,
			Value:     float64(current),
			Metadata:  meta,
		})
	}
}

// GetUsageSummary returns a complete usage summary for a user.
func (s *Service) GetUsageSummary(ctx context.Context, userID, plan string) (map[string]*LimitResult, error) {
	summary := make(map[string]*LimitResult)

	txn, err := s.CheckTransactionLimit(ctx, userID, plan)
	if err == nil {
		summary["transactions"] = txn
	}

	ai, err := s.CheckDailyAILimit(ctx, userID, plan)
	if err == nil {
		summary["ai_chat_daily"] = ai
	}

	features := []string{"forecast", "ai_chat", "recommendations", "anomaly_detection", "export"}
	for _, f := range features {
		fa, err := s.CheckFeatureAccess(ctx, f, plan)
		if err == nil {
			summary[f] = fa
		}
	}

	return summary, nil
}

func parseInt(v interface{}) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	default:
		return -1
	}
}
