// api/internal/handlers/billing.go
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finflow/api/internal/billing"
	"github.com/finflow/api/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type BillingHandler struct {
	userRepo       *db.UserRepo
	billingSvc     *billing.SubscriptionService
	rzpWebhookHdlr *billing.RazorpayWebhookHandler
	keyID          string
	keySecret      string
	webhookSecret  string
	frontendURL    string
}

func NewBillingHandler(
	userRepo *db.UserRepo,
	billingSvc *billing.SubscriptionService,
	rzpWebhookHdlr *billing.RazorpayWebhookHandler,
	keyID, keySecret, webhookSecret, frontendURL string,
) *BillingHandler {
	return &BillingHandler{
		userRepo:       userRepo,
		billingSvc:     billingSvc,
		rzpWebhookHdlr: rzpWebhookHdlr,
		keyID:          keyID,
		keySecret:      keySecret,
		webhookSecret:  webhookSecret,
		frontendURL:    frontendURL,
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

	plan, interval := h.parsePlan(req.Plan, req.BillingCycle)

	frontendURL := h.frontendURL
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	redirectURL := fmt.Sprintf("%s/settings/billing?success=true", frontendURL)
	if req.CheckoutURL != "" {
		redirectURL = req.CheckoutURL
	}

	// Create Razorpay order for subscription
	orderPayload := map[string]interface{}{
		"amount":          plan.PricePaise,
		"currency":        plan.Currency,
		"receipt":         fmt.Sprintf("rcpt_%s_%d", userID, time.Now().Unix()),
		"partial_payment": false,
		"notes": map[string]string{
			"user_id":  userID,
			"plan":     plan.VariantSlug,
			"interval": interval,
		},
	}

	bodyBytes, err := json.Marshal(orderPayload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Create Razorpay order
	reqHTTP, err := http.NewRequestWithContext(c.Request.Context(), "POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(bodyBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	reqHTTP.SetBasicAuth(h.keyID, h.keySecret)
	reqHTTP.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(reqHTTP)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("razorpay order request failed")
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
		log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Msg("razorpay order error")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "billing provider returned an error"})
		return
	}

	var orderResp struct {
		ID       string `json:"id"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		Receipt  string `json:"receipt"`
	}
	if err := json.Unmarshal(respBody, &orderResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Store order ID for webhook reconciliation
	if err := h.billingSvc.RecordOrder(c.Request.Context(), userID, orderResp.ID, plan.VariantSlug, fmt.Sprintf("%d", plan.PricePaise)); err != nil {
		log.Error().Err(err).Str("order_id", orderResp.ID).Msg("failed to record order")
	}

	// Return checkout URL with order details for Razorpay Checkout
	checkoutURL := fmt.Sprintf("%s?order_id=%s&key_id=%s&amount=%d&currency=%s&name=%s&description=%s&prefill[email]=%s&theme[color]=%s",
		redirectURL,
		orderResp.ID,
		h.keyID,
		plan.PricePaise,
		plan.Currency,
		"FinFlow",
		fmt.Sprintf("%s - %s", plan.Name, interval),
		emailStr,
		"#4F46E5",
	)

	c.JSON(http.StatusOK, gin.H{"checkout_url": checkoutURL, "order_id": orderResp.ID})
}

func (h *BillingHandler) CreatePortal(c *gin.Context) {
	userID := c.GetString("user_id")

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	// Razorpay doesn't have a customer portal like LemonSqueezy
	// Users manage subscriptions via dashboard or we redirect to Razorpay's manage page
	if user.RazorpayCustomerID == nil || *user.RazorpayCustomerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no active subscription found"})
		return
	}

	// Redirect to Razorpay subscription management (or our own billing page)
	portalURL := fmt.Sprintf("%s/settings/billing?customer_id=%s", h.frontendURL, *user.RazorpayCustomerID)
	c.JSON(http.StatusOK, gin.H{"portal_url": portalURL})
}

func (h *BillingHandler) RazorpayWebhook(c *gin.Context) {
	h.rzpWebhookHdlr.HandleWebhook(c)
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

func (h *BillingHandler) parsePlan(plan, cycle string) (Plan, string) {
	plans := map[string]Plan{
		"emerald":        {VariantSlug: "emerald", Name: "Emerald", Tier: "pro", PricePaise: 99900, Currency: "INR"},
		"emerald_yearly": {VariantSlug: "emerald", Name: "Emerald", Tier: "pro", PricePaise: 999000, Currency: "INR"},
		"diamond":        {VariantSlug: "diamond", Name: "Diamond", Tier: "max", PricePaise: 249900, Currency: "INR"},
		"diamond_yearly": {VariantSlug: "diamond", Name: "Diamond", Tier: "max", PricePaise: 2499000, Currency: "INR"},
	}

	if p, ok := plans[plan]; ok {
		interval := "month"
		if cycle == "yearly" || plan == "emerald_yearly" || plan == "diamond_yearly" {
			interval = "year"
		}
		return p, interval
	}

	// Default to emerald monthly
	return plans["emerald"], "month"
}

type Plan struct {
	VariantSlug string
	Name        string
	Tier        string
	PricePaise  int
	Currency    string
}

// ListPlans returns available subscription plans.
func (h *BillingHandler) ListPlans(c *gin.Context) {
	plans := []gin.H{
		{
			"id":       "emerald",
			"name":     "Emerald",
			"slug":     "emerald",
			"tier":     "pro",
			"price":    999,
			"currency": "INR",
			"interval": "month",
			"features": []string{"Cash flow forecasting", "Fraud detection", "AI recommendations", "1000 transactions/mo"},
		},
		{
			"id":       "emerald",
			"name":     "Emerald Annual",
			"slug":     "emerald",
			"tier":     "pro",
			"price":    9990,
			"currency": "INR",
			"interval": "year",
			"features": []string{"Everything in Emerald Monthly", "2 months free"},
		},
		{
			"id":       "diamond",
			"name":     "Diamond",
			"slug":     "diamond",
			"tier":     "max",
			"price":    2499,
			"currency": "INR",
			"interval": "month",
			"features": []string{"All Emerald features", "Unlimited transactions", "Priority support", "Custom AI models"},
		},
		{
			"id":       "diamond",
			"name":     "Diamond Annual",
			"slug":     "diamond",
			"tier":     "max",
			"price":    24990,
			"currency": "INR",
			"interval": "year",
			"features": []string{"Everything in Diamond Monthly", "2 months free"},
		},
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}
