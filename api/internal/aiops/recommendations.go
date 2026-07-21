// api/internal/aiops/recommendations.go
package aiops

import (
	"math"
	"time"
)

// Recommendation is a proactive financial suggestion.
type Recommendation struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`   // savings | revenue | risk | efficiency
	Priority    string    `json:"priority"`   // low | medium | high | critical
	Impact      string    `json:"impact"`     // estimated financial impact
	Confidence  float64   `json:"confidence"` // 0-1
	CreatedAt   time.Time `json:"created_at"`
}

// RecommendationEngine generates proactive financial recommendations.
type RecommendationEngine struct {
	maxRecommendations int
}

// NewRecommendationEngine creates a recommendation engine.
func NewRecommendationEngine(maxRecs int) *RecommendationEngine {
	if maxRecs <= 0 {
		maxRecs = 10
	}
	return &RecommendationEngine{maxRecommendations: maxRecs}
}

// FinancialSnapshot holds user's financial data for analysis.
type FinancialSnapshot struct {
	TotalIncome      float64            `json:"total_income"`
	TotalExpenses    float64            `json:"total_expenses"`
	NetCashFlow      float64            `json:"net_cash_flow"`
	CategoryTotals   map[string]float64 `json:"category_totals"`
	TransactionCount int                `json:"transaction_count"`
	AvgTransaction   float64            `json:"avg_transaction"`
	HighValueTxCount int                `json:"high_value_tx_count"`
	RecurringTxCount int                `json:"recurring_tx_count"`
}

// GenerateRecommendations analyzes financial data and returns actionable suggestions.
func (e *RecommendationEngine) GenerateRecommendations(snapshot FinancialSnapshot) []Recommendation {
	var recs []Recommendation
	now := time.Now().UTC()

	// 1. Cash flow analysis
	if snapshot.NetCashFlow < 0 {
		recs = append(recs, Recommendation{
			ID:          "rec-negative-cashflow-" + now.Format("20060102"),
			Title:       "Address Negative Cash Flow",
			Description: "Your net cash flow is negative. Review discretionary spending categories and consider cost reduction measures. Focus on non-essential expenses that can be deferred or eliminated.",
			Category:    "risk",
			Priority:    "high",
			Impact:      "Prevents runway depletion",
			Confidence:  0.9,
			CreatedAt:   now,
		})
	}

	// 2. Expense ratio analysis
	if snapshot.TotalIncome > 0 {
		expenseRatio := math.Abs(snapshot.TotalExpenses) / snapshot.TotalIncome
		if expenseRatio > 0.9 {
			recs = append(recs, Recommendation{
				ID:          "rec-high-expense-ratio-" + now.Format("20060102"),
				Title:       "Expense Ratio Exceeds 90%",
				Description: "Your expenses are consuming over 90% of income. This leaves minimal buffer for savings or unexpected costs. Target an expense ratio below 80% for financial health.",
				Category:    "efficiency",
				Priority:    "high",
				Impact:      "Improves financial resilience",
				Confidence:  0.85,
				CreatedAt:   now,
			})
		}
	}

	// 3. Category-specific recommendations
	for category, amount := range snapshot.CategoryTotals {
		if snapshot.TotalIncome > 0 {
			catRatio := math.Abs(amount) / snapshot.TotalIncome
			switch {
			case catRatio > 0.3 && category != "revenue":
				recs = append(recs, Recommendation{
					ID:          "rec-high-category-" + category + "-" + now.Format("20060102"),
					Title:       "High Spending in " + category,
					Description: category + " accounts for over 30% of your income. Review for optimization opportunities: negotiate contracts, switch providers, or reduce frequency.",
					Category:    "savings",
					Priority:    "medium",
					Impact:      "Potential 10-20% cost reduction",
					Confidence:  0.75,
					CreatedAt:   now,
				})
			}
		}
	}

	// 4. Transaction patterns
	if snapshot.HighValueTxCount > 5 {
		recs = append(recs, Recommendation{
			ID:          "rec-high-value-tx-" + now.Format("20060102"),
			Title:       "Multiple High-Value Transactions",
			Description: "You have several high-value transactions. Consider implementing approval workflows or batch processing to reduce transaction fees and improve cash flow timing.",
			Category:    "efficiency",
			Priority:    "medium",
			Impact:      "Reduces fees and improves cash management",
			Confidence:  0.7,
			CreatedAt:   now,
		})
	}

	// 5. Recurring expense optimization
	if snapshot.RecurringTxCount > 10 {
		recs = append(recs, Recommendation{
			ID:          "rec-recurring-review-" + now.Format("20060102"),
			Title:       "Review Recurring Subscriptions",
			Description: "You have over 10 recurring expenses. Audit each for utilization and ROI. Cancel unused subscriptions and negotiate annual discounts for essential services.",
			Category:    "savings",
			Priority:    "medium",
			Impact:      "Typically saves 15-25% on subscriptions",
			Confidence:  0.8,
			CreatedAt:   now,
		})
	}

	// 6. Runway warning (if data available)
	if snapshot.NetCashFlow < 0 && snapshot.TotalExpenses != 0 {
		// Simple runway estimate (assuming current cash balance would need to be passed in)
		recs = append(recs, Recommendation{
			ID:          "rec-runway-alert-" + now.Format("20060102"),
			Title:       "Runway Conservation Needed",
			Description: "Negative cash flow reduces your runway. Focus on: 1) Accelerating revenue collection, 2) Deferring non-critical purchases, 3) Exploring bridge financing options.",
			Category:    "risk",
			Priority:    "critical",
			Impact:      "Extends operational runway",
			Confidence:  0.85,
			CreatedAt:   now,
		})
	}

	// 7. Revenue optimization
	if snapshot.TotalIncome > 0 && snapshot.NetCashFlow > 0 {
		growthPotential := snapshot.NetCashFlow / snapshot.TotalIncome
		if growthPotential > 0.3 {
			recs = append(recs, Recommendation{
				ID:          "rec-reinvest-" + now.Format("20060102"),
				Title:       "Strong Cash Position for Growth",
				Description: "Your positive cash flow indicates room for strategic investment. Consider: 1) Hiring key roles, 2) Marketing expansion, 3) Product development, 4) Building cash reserves.",
				Category:    "revenue",
				Priority:    "low",
				Impact:      "Accelerates growth trajectory",
				Confidence:  0.7,
				CreatedAt:   now,
			})
		}
	}

	// Limit recommendations
	if len(recs) > e.maxRecommendations {
		recs = recs[:e.maxRecommendations]
	}

	return recs
}

// RankByPriority sorts recommendations by priority level.
func RankByPriority(recs []Recommendation) []Recommendation {
	priorityOrder := map[string]int{
		"critical": 0,
		"high":     1,
		"medium":   2,
		"low":      3,
	}

	// Simple bubble sort for small datasets
	for i := 0; i < len(recs); i++ {
		for j := i + 1; j < len(recs); j++ {
			if priorityOrder[recs[i].Priority] > priorityOrder[recs[j].Priority] {
				recs[i], recs[j] = recs[j], recs[i]
			}
		}
	}
	return recs
}
