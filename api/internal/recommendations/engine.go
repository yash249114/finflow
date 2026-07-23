// api/internal/recommendations/engine.go
package recommendations

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/finflow/api/internal/analytics"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AutomatedRecommendation is a data-driven business recommendation.
type AutomatedRecommendation struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`        // 'limit_adjustment' | 'feature_rollout' | 'feature_disable' | 'model_switch' | 'routing_change'
	Action      string                 `json:"action"`      // human-readable action
	Reason      string                 `json:"reason"`      // why this recommendation was generated
	Impact      string                 `json:"impact"`      // estimated impact
	Priority    string                 `json:"priority"`    // low | medium | high | critical
	Status      string                 `json:"status"`      // pending | accepted | rejected | applied
	ConfigKey   string                 `json:"config_key"`  // business_config key to modify
	ConfigValue interface{}            `json:"config_value"` // new value to set
	Confidence  float64                `json:"confidence"`  // 0-1
	Metadata    map[string]interface{} `json:"metadata"`
	CreatedAt   time.Time              `json:"created_at"`
}

// Engine generates automated business recommendations.
type Engine struct {
	pool        *pgxpool.Pool
	configStore *analytics.ConfigStore
}

// NewEngine creates a recommendation engine.
func NewEngine(pool *pgxpool.Pool, configStore *analytics.ConfigStore) *Engine {
	return &Engine{pool: pool, configStore: configStore}
}

// Generate runs all recommendation rules and returns actionable suggestions.
func (e *Engine) Generate(ctx context.Context) ([]AutomatedRecommendation, error) {
	var recs []AutomatedRecommendation

	// 1. Check if free limits should be increased or decreased
	limitRecs, err := e.analyzeLimits(ctx)
	if err == nil {
		recs = append(recs, limitRecs...)
	}

	// 2. Check model routing optimization
	modelRecs, err := e.analyzeModelRouting(ctx)
	if err == nil {
		recs = append(recs, modelRecs...)
	}

	// 3. Check feature adoption for rollout/disable decisions
	featureRecs, err := e.analyzeFeatureAdoption(ctx)
	if err == nil {
		recs = append(recs, featureRecs...)
	}

	// 4. Check conversion funnel for optimization
	conversionRecs, err := e.analyzeConversionFunnel(ctx)
	if err == nil {
		recs = append(recs, conversionRecs...)
	}

	return recs, nil
}

// analyzeLimits suggests adjusting free plan limits based on usage patterns.
func (e *Engine) analyzeLimits(ctx context.Context) ([]AutomatedRecommendation, error) {
	var recs []AutomatedRecommendation
	now := time.Now().UTC()

	// Check what % of free users hit transaction limits
	var totalFree, hittingLimit int
	_ = e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE plan = 'free'`,
	).Scan(&totalFree)

	_ = e.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE event_type = 'limit_hit' AND feature = 'transaction' AND created_at >= NOW() - INTERVAL '7 days'`,
	).Scan(&hittingLimit)

	if totalFree > 0 {
		hitRate := float64(hittingLimit) / float64(totalFree) * 100

		// If > 60% of free users hit the limit, consider increasing it
		if hitRate > 60 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-limit-incr-%s", now.Format("20060102150405")),
				Type:     "limit_adjustment",
				Action:   "Increase free transaction limit from 250 to 500",
				Reason:   fmt.Sprintf("%.0f%% of free users hit the transaction limit in the past 7 days. Increasing the limit may improve conversion by reducing frustration.", hitRate),
				Impact:   "Expected 15-25% improvement in free-to-pro conversion",
				Priority: "high",
				Status:   "pending",
				ConfigKey: "free.transactions.max",
				ConfigValue: map[string]interface{}{
					"soft": 400, "hard": 500, "warn_at_pct": 80,
				},
				Confidence: 0.75,
				CreatedAt:  now,
			})
		}

		// If < 5% of free users hit the limit, consider decreasing (save costs)
		if hitRate < 5 && totalFree > 100 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-limit-decr-%s", now.Format("20060102150405")),
				Type:     "limit_adjustment",
				Action:   "Decrease free transaction limit from 250 to 100",
				Reason:   fmt.Sprintf("Only %.0f%% of free users hit the transaction limit. Most users don't need 250 transactions on the free plan.", hitRate),
				Impact:   "Reduces storage and processing costs for free tier",
				Priority: "medium",
				Status:   "pending",
				ConfigKey: "free.transactions.max",
				ConfigValue: map[string]interface{}{
					"soft": 80, "hard": 100, "warn_at_pct": 80,
				},
				Confidence: 0.65,
				CreatedAt:  now,
			})
		}
	}

	return recs, nil
}

// analyzeModelRouting suggests switching to cheaper models when quality allows.
func (e *Engine) analyzeModelRouting(ctx context.Context) ([]AutomatedRecommendation, error) {
	var recs []AutomatedRecommendation
	now := time.Now().UTC()

	// Check cost per model over last 30 days
	rows, err := e.pool.Query(ctx,
		`SELECT model, SUM(cost_usd) AS total_cost, COUNT(*) AS calls, AVG(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS success_rate
		 FROM cost_tracking
		 WHERE created_at >= NOW() - INTERVAL '30 days' AND model != ''
		 GROUP BY model
		 ORDER BY total_cost DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type modelCost struct {
		Model       string
		TotalCost   float64
		Calls       int
		SuccessRate float64
	}
	var costs []modelCost
	for rows.Next() {
		var mc modelCost
		if err := rows.Scan(&mc.Model, &mc.TotalCost, &mc.Calls, &mc.SuccessRate); err == nil {
			costs = append(costs, mc)
		}
	}

	// If gpt-4o is being used and cost is high, suggest gpt-4o-mini
	for _, mc := range costs {
		if mc.Model == "gpt-4o" && mc.TotalCost > 10.0 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-model-switch-%s", now.Format("20060102150405")),
				Type:     "model_switch",
				Action:   "Switch from gpt-4o to gpt-4o-mini for AI chat (pro plan)",
				Reason:   fmt.Sprintf("gpt-4o has cost $%.2f over 30 days across %d calls. gpt-4o-mini provides comparable quality at 97%% lower cost.", mc.TotalCost, mc.Calls),
				Impact:   fmt.Sprintf("Estimated savings: $%.2f/month", mc.TotalCost*0.97),
				Priority: "high",
				Status:   "pending",
				ConfigKey: "ai_chat.model.pro",
				ConfigValue: map[string]interface{}{
					"provider":    "openai",
					"model":       "gpt-4o-mini",
					"cost_per_1k": 0.00015,
				},
				Confidence: 0.85,
				CreatedAt:  now,
			})
		}
	}

	return recs, nil
}

// analyzeFeatureAdoption suggests enabling/disabling features based on usage.
func (e *Engine) analyzeFeatureAdoption(ctx context.Context) ([]AutomatedRecommendation, error) {
	var recs []AutomatedRecommendation
	now := time.Now().UTC()

	// Check each feature's adoption rate
	features := []struct {
		Name     string
		MinRate  float64 // below this => suggest disable
		HighRate float64 // above this => suggest wider rollout
	}{
		{"forecast", 5.0, 30.0},
		{"ai_chat", 10.0, 50.0},
		{"recommendations", 5.0, 40.0},
		{"anomaly_detection", 2.0, 20.0},
	}

	for _, f := range features {
		var totalUsers, adoptedUsers int
		_ = e.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
		_ = e.pool.QueryRow(ctx,
			`SELECT COUNT(DISTINCT user_id) FROM feature_events WHERE feature = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
			f.Name,
		).Scan(&adoptedUsers)

		if totalUsers == 0 {
			continue
		}

		adoptionRate := float64(adoptedUsers) / float64(totalUsers) * 100

		// Low adoption: consider disabling or improving
		if adoptionRate < f.MinRate && totalUsers > 50 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-feat-low-%s-%s", f.Name, now.Format("20060102")),
				Type:     "feature_disable",
				Action:   fmt.Sprintf("Review %s feature (adoption: %.1f%%)", f.Name, adoptionRate),
				Reason:   fmt.Sprintf("%s has only %.1f%% adoption (%d/%d users) over 30 days. Consider improving UX or disabling to reduce maintenance burden.", f.Name, adoptionRate, adoptedUsers, totalUsers),
				Impact:   "Reduces code complexity or improves user experience",
				Priority: "low",
				Status:   "pending",
				ConfigKey: fmt.Sprintf("features.%s.enabled", f.Name),
				Confidence: 0.6,
				CreatedAt:  now,
			})
		}

		// High adoption: consider wider rollout or premium gating
		if adoptionRate > f.HighRate && totalUsers > 20 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-feat-high-%s-%s", f.Name, now.Format("20060102")),
				Type:     "feature_rollout",
				Action:   fmt.Sprintf("Expand %s to all plans (adoption: %.1f%%)", f.Name, adoptionRate),
				Reason:   fmt.Sprintf("%s has %.1f%% adoption (%d/%d users). High demand suggests it should be available to all plans as a value driver.", f.Name, adoptionRate, adoptedUsers, totalUsers),
				Impact:   "Increases platform stickiness and reduces churn",
				Priority: "medium",
				Status:   "pending",
				ConfigKey: fmt.Sprintf("features.%s.enabled", f.Name),
				ConfigValue: map[string]interface{}{
					"value": true,
					"plans": []string{"free", "pro", "max"},
				},
				Confidence: 0.7,
				CreatedAt:  now,
			})
		}
	}

	return recs, nil
}

// analyzeConversionFunnel suggests optimizing the upgrade funnel.
func (e *Engine) analyzeConversionFunnel(ctx context.Context) ([]AutomatedRecommendation, error) {
	var recs []AutomatedRecommendation
	now := time.Now().UTC()

	// Check prompt click-through rate
	var promptsShown, promptsClicked, checkoutsCompleted int
	_ = e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'prompt_shown' AND created_at >= NOW() - INTERVAL '30 days'`,
	).Scan(&promptsShown)

	_ = e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'prompt_clicked' AND created_at >= NOW() - INTERVAL '30 days'`,
	).Scan(&promptsClicked)

	_ = e.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM upgrade_events WHERE event_type = 'checkout_completed' AND created_at >= NOW() - INTERVAL '30 days'`,
	).Scan(&checkoutsCompleted)

	if promptsShown > 100 {
		clickRate := float64(promptsClicked) / float64(promptsShown) * 100
		convRate := float64(checkoutsCompleted) / float64(promptsShown) * 100

		// Low click-through: suggest improving the prompt messaging
		if clickRate < 10 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-funnel-clicks-%s", now.Format("20060102")),
				Type:     "routing_change",
				Action:   "Improve upgrade prompt messaging (low click-through)",
				Reason:   fmt.Sprintf("Only %.1f%% of upgrade prompts are clicked (%d/%d). Consider more contextual, value-focused messaging.", clickRate, promptsClicked, promptsShown),
				Impact:   "Could increase conversion rate by 20-40%",
				Priority: "high",
				Status:   "pending",
				Confidence: 0.8,
				CreatedAt:  now,
			})
		}

		// Low checkout completion: suggest simplifying checkout
		if promptsClicked > 50 && convRate < 5 {
			recs = append(recs, AutomatedRecommendation{
				ID:       fmt.Sprintf("rec-funnel-checkout-%s", now.Format("20060102")),
				Type:     "routing_change",
				Action:   "Simplify checkout flow (high abandonment)",
				Reason:   fmt.Sprintf("Only %.1f%% of started checkouts complete (%d/%d). Possible friction in the checkout process.", convRate, checkoutsCompleted, promptsClicked),
				Impact:   "Direct revenue increase",
				Priority: "critical",
				Status:   "pending",
				Confidence: 0.85,
				CreatedAt:  now,
			})
		}
	}

	return recs, nil
}

// GetPending returns all pending recommendations.
func (e *Engine) GetPending(ctx context.Context) ([]AutomatedRecommendation, error) {
	// For now, generate fresh recommendations on each call.
	// In production, store and retrieve from a recommendations table.
	return e.Generate(ctx)
}

// Accept marks a recommendation as accepted.
func (e *Engine) Accept(ctx context.Context, recommendationID string) error {
	// In production, update a recommendations table
	return nil
}

// Apply executes the recommended config change.
func (e *Engine) Apply(ctx context.Context, rec AutomatedRecommendation) error {
	if rec.ConfigKey == "" {
		return fmt.Errorf("no config key specified")
	}

	// Parse category and key from configKey
	// e.g., "free.transactions.max" -> category="limits", key="free.transactions.max"
	category := "limits"
	if rec.ConfigValue != nil {
		switch rec.Type {
		case "model_switch", "routing_change":
			category = "routing"
		case "feature_rollout", "feature_disable":
			category = "features"
		case "limit_adjustment":
			category = "limits"
		}
	}

	err := e.configStore.Set(ctx, category, rec.ConfigKey, rec.ConfigValue, "auto-recommendation")
	if err != nil {
		return fmt.Errorf("applying config change: %w", err)
	}

	// Log the application
	_, _ = e.pool.Exec(ctx,
		`INSERT INTO feature_events (user_id, feature, event_type, value, metadata, created_at)
		 VALUES ('system', 'recommendations', 'usage', 1, $1, NOW())`,
		func() string {
			b, _ := json.Marshal(map[string]interface{}{
				"recommendation_id": rec.ID,
				"type":              rec.Type,
				"config_key":        rec.ConfigKey,
			})
			return string(b)
		}(),
	)

	return nil
}
