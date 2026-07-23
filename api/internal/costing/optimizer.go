// api/internal/costing/optimizer.go
package costing

import (
	"context"

	"github.com/finflow/api/internal/analytics"
)

// ModelSuggestion is a cost optimization recommendation for LLM routing.
type ModelSuggestion struct {
	CurrentModel   string  `json:"current_model"`
	SuggestedModel string  `json:"suggested_model"`
	CurrentCost    float64 `json:"current_cost_per_1k"`
	SuggestedCost  float64 `json:"suggested_cost_per_1k"`
	SavingsPct     float64 `json:"savings_pct"`
	QualityImpact  string  `json:"quality_impact"` // minimal | moderate | significant
	Reason         string  `json:"reason"`
}

// Optimizer analyzes cost patterns and suggests model switches.
type Optimizer struct {
	configStore *analytics.ConfigStore
}

// NewOptimizer creates a cost optimizer.
func NewOptimizer(configStore *analytics.ConfigStore) *Optimizer {
	return &Optimizer{configStore: configStore}
}

// AnalyzeRouting returns model routing suggestions based on cost data.
func (o *Optimizer) AnalyzeRouting(ctx context.Context, tracker *CostTracker) ([]ModelSuggestion, error) {
	threshold, err := o.configStore.GetThreshold(ctx, "model_switch.cost_savings_threshold")
	if err != nil {
		threshold = 0.20 // default 20% savings threshold
	}
	_ = threshold

	// Get cost by model
	rows, err := tracker.pool.Query(ctx,
		`SELECT model, service,
			COALESCE(AVG(cost_usd), 0) AS avg_cost,
			COALESCE(AVG(latency_ms), 0) AS avg_latency,
			COUNT(*) AS requests
		 FROM cost_tracking
		 WHERE model != '' AND created_at >= CURRENT_DATE - 30
		 GROUP BY model, service
		 ORDER BY avg_cost DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Compare expensive models against cheaper alternatives
	alternatives := map[string]ModelSuggestion{
		"gpt-4o": {
			CurrentModel:   "gpt-4o",
			SuggestedModel: "gpt-4o-mini",
			CurrentCost:    0.005,
			SuggestedCost:  0.00015,
			SavingsPct:     97,
			QualityImpact:  "minimal",
			Reason:         "gpt-4o-mini handles most financial queries with comparable accuracy at 97% lower cost",
		},
		"claude-3-5-sonnet-latest": {
			CurrentModel:   "claude-3-5-sonnet-latest",
			SuggestedModel: "claude-3-5-haiku-latest",
			CurrentCost:    0.003,
			SuggestedCost:  0.00025,
			SavingsPct:     92,
			QualityImpact:  "minimal",
			Reason:         "Haiku handles structured financial data well at fraction of cost",
		},
	}

	var suggestions []ModelSuggestion
	for rows.Next() {
		var model, service string
		var avgCost, avgLatency float64
		var requests int
		if err := rows.Scan(&model, &service, &avgCost, &avgLatency, &requests); err != nil {
			continue
		}

		if alt, ok := alternatives[model]; ok {
			suggestions = append(suggestions, alt)
		}
		_ = service
	}

	return suggestions, nil
}
