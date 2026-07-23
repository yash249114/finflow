// api/internal/handlers/analytics.go
package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/finflow/api/internal/analytics"
	"github.com/finflow/api/internal/business"
	"github.com/finflow/api/internal/costing"
	"github.com/finflow/api/internal/experiment"
	limSvc "github.com/finflow/api/internal/limits"
	"github.com/finflow/api/internal/recommendations"
	"github.com/gin-gonic/gin"
)

// AnalyticsHandler serves all business intelligence and AIOps endpoints.
type AnalyticsHandler struct {
	events         *analytics.EventStore
	config         *analytics.ConfigStore
	growth         *business.GrowthService
	revenue        *business.RevenueService
	retention      *business.RetentionService
	forecastAcc    *business.ForecastAccuracyService
	costTracker    *costing.CostTracker
	optimizer      *costing.Optimizer
	experiments    *experiment.Service
	limits         *limSvc.Service
	recEngine      *recommendations.Engine
}

// NewAnalyticsHandler creates the analytics handler.
func NewAnalyticsHandler(
	events *analytics.EventStore,
	config *analytics.ConfigStore,
	growth *business.GrowthService,
	revenue *business.RevenueService,
	retention *business.RetentionService,
	forecastAcc *business.ForecastAccuracyService,
	costTracker *costing.CostTracker,
	optimizer *costing.Optimizer,
	experiments *experiment.Service,
	limitsSvc *limSvc.Service,
	recEngine *recommendations.Engine,
) *AnalyticsHandler {
	return &AnalyticsHandler{
		events:      events,
		config:      config,
		growth:      growth,
		revenue:     revenue,
		retention:   retention,
		forecastAcc: forecastAcc,
		costTracker: costTracker,
		optimizer:   optimizer,
		experiments: experiments,
		limits:      limitsSvc,
		recEngine:   recEngine,
	}
}

// ─── Feature Tracking ─────────────────────────────────────────────────────

// TrackEvent records a feature usage event.
func (h *AnalyticsHandler) TrackEvent(c *gin.Context) {
	var req struct {
		Feature   string  `json:"feature" binding:"required"`
		EventType string  `json:"event_type" binding:"required"`
		Value     float64 `json:"value"`
		Metadata  string  `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID := c.GetString("user_id")

	h.events.Track(c.Request.Context(), analytics.FeatureEvent{
		UserID:    userID,
		Feature:   req.Feature,
		EventType: analytics.EventType(req.EventType),
		Value:     req.Value,
		Metadata:  []byte(req.Metadata),
	})

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GetFeatureUsage returns aggregated usage for a feature.
func (h *AnalyticsHandler) GetFeatureUsage(c *gin.Context) {
	feature := c.Query("feature")
	if feature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feature parameter required"})
		return
	}

	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))

	usage, err := h.events.GetFeatureUsage(c.Request.Context(), feature, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch feature usage"})
		return
	}

	c.JSON(http.StatusOK, usage)
}

// GetFeatureUsageDaily returns daily usage time-series for a feature.
func (h *AnalyticsHandler) GetFeatureUsageDaily(c *gin.Context) {
	feature := c.Query("feature")
	if feature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feature parameter required"})
		return
	}

	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))

	data, err := h.events.GetFeatureUsageByDay(c.Request.Context(), feature, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch daily usage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ─── Growth Analytics ─────────────────────────────────────────────────────

// GetGrowthMetrics returns platform growth metrics.
func (h *AnalyticsHandler) GetGrowthMetrics(c *gin.Context) {
	metrics, err := h.growth.GetMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute growth metrics"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GetDAU returns daily active users for the last N days.
func (h *AnalyticsHandler) GetDAU(c *gin.Context) {
	days := 30
	if d := c.Query("days"); d != "" {
		fmt.Sscanf(d, "%d", &days)
	}
	data, err := h.growth.DAUDaily(c.Request.Context(), days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch DAU data"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ─── Revenue Analytics ────────────────────────────────────────────────────

// GetRevenueMetrics returns revenue and subscription analytics.
func (h *AnalyticsHandler) GetRevenueMetrics(c *gin.Context) {
	metrics, err := h.revenue.GetMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute revenue metrics"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GetConversionFunnel returns the free-to-pro upgrade funnel.
func (h *AnalyticsHandler) GetConversionFunnel(c *gin.Context) {
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))

	funnel, err := h.revenue.GetConversionFunnel(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute conversion funnel"})
		return
	}
	c.JSON(http.StatusOK, funnel)
}

// GetUpgradeTriggers returns which features trigger upgrade prompts most.
func (h *AnalyticsHandler) GetUpgradeTriggers(c *gin.Context) {
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))

	data, err := h.revenue.UpgradeTriggerBreakdown(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch upgrade triggers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ─── Retention Analytics ──────────────────────────────────────────────────

// GetRetentionCohorts returns weekly retention cohort data.
func (h *AnalyticsHandler) GetRetentionCohorts(c *gin.Context) {
	weeks := 12
	if w := c.Query("weeks"); w != "" {
		fmt.Sscanf(w, "%d", &weeks)
	}

	cohorts, err := h.retention.GetRetentionCohorts(c.Request.Context(), weeks)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute retention cohorts"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"cohorts": cohorts})
}

// GetChurnMetrics returns churn analytics.
func (h *AnalyticsHandler) GetChurnMetrics(c *gin.Context) {
	metrics, err := h.retention.GetChurnMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute churn metrics"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GetFeatureAdoption returns feature adoption rates.
func (h *AnalyticsHandler) GetFeatureAdoption(c *gin.Context) {
	adoption, err := h.retention.GetFeatureAdoption(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute feature adoption"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"adoption": adoption})
}

// ─── Forecast Accuracy ────────────────────────────────────────────────────

// GetForecastAccuracy returns forecast model accuracy metrics.
func (h *AnalyticsHandler) GetForecastAccuracy(c *gin.Context) {
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))

	metrics, err := h.forecastAcc.GetMetrics(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute forecast accuracy"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// ─── Cost Monitoring ──────────────────────────────────────────────────────

// GetCostSummary returns aggregated cost metrics.
func (h *AnalyticsHandler) GetCostSummary(c *gin.Context) {
	summary, err := h.costTracker.GetSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute cost summary"})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// GetCostByDay returns daily cost breakdown.
func (h *AnalyticsHandler) GetCostByDay(c *gin.Context) {
	days := 30
	if d := c.Query("days"); d != "" {
		fmt.Sscanf(d, "%d", &days)
	}

	data, err := h.costTracker.CostByDay(c.Request.Context(), days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch cost data"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetCostOptimizations returns model routing cost optimization suggestions.
func (h *AnalyticsHandler) GetCostOptimizations(c *gin.Context) {
	suggestions, err := h.optimizer.AnalyzeRouting(c.Request.Context(), h.costTracker)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to analyze cost optimizations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
}

// GetTopCostUsers returns the highest-cost users.
func (h *AnalyticsHandler) GetTopCostUsers(c *gin.Context) {
	days := 30
	limit := 20
	if d := c.Query("days"); d != "" {
		fmt.Sscanf(d, "%d", &days)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	data, err := h.costTracker.TopCostUsers(c.Request.Context(), limit, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch top cost users"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ─── Experiments ──────────────────────────────────────────────────────────

// ListExperiments returns all experiments.
func (h *AnalyticsHandler) ListExperiments(c *gin.Context) {
	status := c.Query("status")
	exps, err := h.experiments.List(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list experiments"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"experiments": exps})
}

// CreateExperiment creates a new A/B test.
func (h *AnalyticsHandler) CreateExperiment(c *gin.Context) {
	var req struct {
		Name          string `json:"name" binding:"required"`
		Description   string `json:"description"`
		TargetFeature string `json:"target_feature"`
		Variants      []struct {
			Name   string `json:"name"`
			Weight int    `json:"weight"`
		} `json:"variants" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	variants := make([]experiment.Variant, len(req.Variants))
	for i, v := range req.Variants {
		variants[i] = experiment.Variant{Name: v.Name, Weight: v.Weight}
	}

	exp := &experiment.Experiment{
		Name:          req.Name,
		Description:   req.Description,
		TargetFeature: req.TargetFeature,
		Variants:      variants,
	}

	if err := h.experiments.Create(c.Request.Context(), exp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create experiment"})
		return
	}

	c.JSON(http.StatusCreated, exp)
}

// GetExperimentResults returns results for an experiment.
func (h *AnalyticsHandler) GetExperimentResults(c *gin.Context) {
	experimentID := c.Param("id")
	if experimentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "experiment id required"})
		return
	}

	results, err := h.experiments.GetResults(c.Request.Context(), experimentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute experiment results"})
		return
	}
	c.JSON(http.StatusOK, results)
}

// ─── Limits ───────────────────────────────────────────────────────────────

// GetUserUsageSummary returns the complete usage summary for the current user.
func (h *AnalyticsHandler) GetUserUsageSummary(c *gin.Context) {
	userID := c.GetString("user_id")
	plan := c.GetString("plan")

	summary, err := h.limits.GetUsageSummary(c.Request.Context(), userID, plan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute usage summary"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"usage": summary, "plan": plan})
}

// ─── Automated Recommendations ────────────────────────────────────────────

// GetRecommendations returns automated business recommendations.
func (h *AnalyticsHandler) GetRecommendations(c *gin.Context) {
	recs, err := h.recEngine.Generate(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate recommendations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recommendations": recs})
}

// ApplyRecommendation applies an automated recommendation.
func (h *AnalyticsHandler) ApplyRecommendation(c *gin.Context) {
	var req struct {
		ID string `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Find the recommendation
	recs, err := h.recEngine.Generate(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate recommendations"})
		return
	}

	for _, rec := range recs {
		if rec.ID == req.ID {
			if err := h.recEngine.Apply(c.Request.Context(), rec); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to apply recommendation: " + err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true, "message": "recommendation applied"})
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "recommendation not found"})
}

// ─── Business Config ──────────────────────────────────────────────────────

// GetConfig returns all business configuration.
func (h *AnalyticsHandler) GetConfig(c *gin.Context) {
	category := c.Query("category")

	if category != "" {
		configs, err := h.config.GetByCategory(c.Request.Context(), category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch config"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"configs": configs})
		return
	}

	all, err := h.config.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"configs": all})
}

// UpdateConfig updates a business configuration value.
func (h *AnalyticsHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		Category string      `json:"category" binding:"required"`
		Key      string      `json:"key" binding:"required"`
		Value    interface{} `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := h.config.Set(c.Request.Context(), req.Category, req.Key, req.Value, "admin"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
