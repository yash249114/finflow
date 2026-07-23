// api/internal/handlers/billing.go
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/finflow/api/internal/billing"
	"github.com/finflow/api/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type BillingHandler struct {
	userRepo    *db.UserRepo
	billingSvc  *billing.SubscriptionService
	webhookHdlr *billing.WebhookHandler
	apiKey      string
	storeID     string
	variantID   string
	frontendURL string
}

func NewBillingHandler(
	userRepo *db.UserRepo,
	billingSvc *billing.SubscriptionService,
	webhookHdlr *billing.WebhookHandler,
	apiKey, storeID, variantID, frontendURL string,
) *BillingHandler {
	return &BillingHandler{
		userRepo:    userRepo,
		billingSvc:  billingSvc,
		webhookHdlr: webhookHdlr,
		apiKey:      apiKey,
		storeID:     storeID,
		variantID:   variantID,
		frontendURL: frontendURL,
	}
}

type CreateCheckoutRequest struct {
	Plan         string `json:"plan" binding:"required"`
	BillingCycle string `json:"billing_cycle"`
	CheckoutURL  string `json:"checkout_url"`
}

func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	userID := c.GetString("user_id")
	email, _ := c.Get("email")
	emailStr, _ := email.(string)

	var req CreateCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Plan = "emerald"
		req.BillingCycle = "monthly"
	}

	variantID := h.resolveVariantID(req.Plan, req.BillingCycle)

	frontendURL := h.frontendURL
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	redirectURL := fmt.Sprintf("%s/settings/billing?success=true", frontendURL)
	if req.CheckoutURL != "" {
		redirectURL = req.CheckoutURL
	}

	payload := map[string]interface{}{
		"data": map[string]interface{}{
			"type": "checkouts",
			"attributes": map[string]interface{}{
				"checkout_data": map[string]interface{}{
					"email": emailStr,
					"custom": map[string]string{
						"user_id": userID,
					},
				},
				"product_options": map[string]interface{}{
					"redirect_url": redirectURL,
				},
			},
			"relationships": map[string]interface{}{
				"store": map[string]interface{}{
					"data": map[string]interface{}{
						"type": "stores",
						"id":   h.storeID,
					},
				},
				"variant": map[string]interface{}{
					"data": map[string]interface{}{
						"type": "variants",
						"id":   variantID,
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	reqHTTP, err := http.NewRequestWithContext(c.Request.Context(), "POST", "https://api.lemonsqueezy.com/v1/checkouts", bytes.NewReader(bodyBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	reqHTTP.Header.Set("Authorization", "Bearer "+h.apiKey)
	reqHTTP.Header.Set("Content-Type", "application/vnd.api+json")
	reqHTTP.Header.Set("Accept", "application/vnd.api+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(reqHTTP)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("checkout request failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to contact billing provider"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Msg("lemon squeezy error")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "billing provider returned an error"})
		return
	}

	var resData struct {
		Data struct {
			Attributes struct {
				URL string `json:"url"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &resData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"checkout_url": resData.Data.Attributes.URL})
}

func (h *BillingHandler) CreatePortal(c *gin.Context) {
	userID := c.GetString("user_id")

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	if user.LemonSqueezyCustomerID == nil || *user.LemonSqueezyCustomerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no active subscription found"})
		return
	}

	filterURL := fmt.Sprintf("https://api.lemonsqueezy.com/v1/customers?filter[email]=%s", url.QueryEscape(user.Email))
	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", filterURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+h.apiKey)
	req.Header.Set("Accept", "application/vnd.api+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to contact billing provider"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Msg("lemon squeezy customer query error")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "billing provider returned an error"})
		return
	}

	var resData struct {
		Data []struct {
			Attributes struct {
				Urls struct {
					CustomerPortal string `json:"customer_portal"`
				} `json:"urls"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &resData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if len(resData.Data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer record not found in billing provider"})
		return
	}

	portalURL := resData.Data[0].Attributes.Urls.CustomerPortal
	if portalURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "customer portal URL is not available"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"portal_url": portalURL})
}

func (h *BillingHandler) Webhook(c *gin.Context) {
	h.webhookHdlr.HandleWebhook(c)
}

func (h *BillingHandler) GetSubscription(c *gin.Context) {
	userID := c.GetString("user_id")

	state, err := h.billingSvc.GetState(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"subscription": state,
		"plan": map[string]string{
			"tier":    state.Plan,
			"name":    state.PlanName,
			"variant": state.VariantSlug,
			"cycle":   state.BillingCycle,
			"status":  state.Status,
		},
	})
}

type ChangePlanRequest struct {
	Plan         string `json:"plan" binding:"required"`
	BillingCycle string `json:"billing_cycle"`
	AtPeriodEnd  bool   `json:"at_period_end"`
}

func (h *BillingHandler) ChangePlan(c *gin.Context) {
	userID := c.GetString("user_id")

	var req ChangePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan is required"})
		return
	}

	current, err := h.billingSvc.GetState(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	targetPlan := billing.PlanForVariant(req.Plan)
	currentPlan := billing.PlanForVariant(current.VariantSlug)
	isUpgrade := targetPlan.Tier > currentPlan.Tier

	if isUpgrade {
		c.JSON(http.StatusOK, gin.H{
			"action":   "upgrade",
			"target":   req.Plan,
			"current":  current.VariantSlug,
			"checkout": true,
			"message":  "Please complete checkout to upgrade your plan.",
		})
		return
	}

	if req.AtPeriodEnd || current.CancelAtPeriodEnd {
		if err := h.billingSvc.Downgrade(c.Request.Context(), userID, req.Plan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to schedule downgrade"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"action":  "downgrade_scheduled",
			"target":  req.Plan,
			"message": "Your plan will change at the end of the current billing period.",
		})
	} else {
		if err := h.billingSvc.Cancel(c.Request.Context(), userID, false); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process downgrade"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"action":  "downgraded",
			"target":  "blue-sapphire",
			"message": "Your plan has been changed to Blue Sapphire (free).",
		})
	}
}

func (h *BillingHandler) CancelSubscription(c *gin.Context) {
	userID := c.GetString("user_id")

	current, err := h.billingSvc.GetState(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	atPeriodEnd := current.Status == "active" || current.Status == "trial"
	if err := h.billingSvc.Cancel(c.Request.Context(), userID, atPeriodEnd); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel subscription"})
		return
	}

	if atPeriodEnd {
		c.JSON(http.StatusOK, gin.H{
			"message": "Your subscription will be cancelled at the end of the current billing period.",
			"status":  "cancelled_at_period_end",
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"message": "Your subscription has been cancelled. You have been moved to the free plan.",
			"status":  "cancelled",
		})
	}
}

func (h *BillingHandler) resolveVariantID(plan, cycle string) string {
	if h.variantID != "" {
		return h.variantID
	}
	return plan
}

// ListPlans returns available subscription plans.
func (h *BillingHandler) ListPlans(c *gin.Context) {
	plans := []gin.H{
		{
			"id":         "emerald_monthly",
			"name":       "Emerald",
			"slug":       "emerald",
			"tier":       "pro",
			"price":      9.99,
			"currency":   "USD",
			"interval":   "month",
			"features":   []string{"Cash flow forecasting", "Fraud detection", "AI recommendations", "1000 transactions/mo"},
		},
		{
			"id":         "emerald_yearly",
			"name":       "Emerald Annual",
			"slug":       "emerald",
			"tier":       "pro",
			"price":      99.99,
			"currency":   "USD",
			"interval":   "year",
			"features":   []string{"Everything in Emerald Monthly", "2 months free"},
		},
		{
			"id":         "diamond_monthly",
			"name":       "Diamond",
			"slug":       "diamond",
			"tier":       "max",
			"price":      24.99,
			"currency":   "USD",
			"interval":   "month",
			"features":   []string{"All Emerald features", "Unlimited transactions", "Priority support", "Custom AI models"},
		},
		{
			"id":         "diamond_yearly",
			"name":       "Diamond Annual",
			"slug":       "diamond",
			"tier":       "max",
			"price":      249.99,
			"currency":   "USD",
			"interval":   "year",
			"features":   []string{"Everything in Diamond Monthly", "2 months free"},
		},
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}