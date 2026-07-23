// api/internal/handlers/billing.go
package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// BillingHandler handles Lemon Squeezy billing endpoints.
type BillingHandler struct {
	userRepo      *db.UserRepo
	apiKey        string
	storeID       string
	variantID     string
	webhookSecret string
	frontendURL   string
}

// NewBillingHandler creates a new BillingHandler.
func NewBillingHandler(userRepo *db.UserRepo, apiKey, storeID, variantID, webhookSecret, frontendURL string) *BillingHandler {
	return &BillingHandler{
		userRepo:      userRepo,
		apiKey:        apiKey,
		storeID:       storeID,
		variantID:     variantID,
		webhookSecret: webhookSecret,
		frontendURL:   frontendURL,
	}
}

// CreateCheckout creates a Lemon Squeezy checkout session for the Pro plan.
func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	userID := c.GetString("user_id")
	email, _ := c.Get("email")
	emailStr, _ := email.(string)

	frontendURL := h.frontendURL
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	redirectURL := fmt.Sprintf("%s/settings/billing?success=true", frontendURL)

	// Build request payload for Lemon Squeezy Checkouts API
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
						"id":   h.variantID,
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to marshal checkout payload")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), "POST", "https://api.lemonsqueezy.com/v1/checkouts", bytes.NewReader(bodyBytes))
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to create checkout request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+h.apiKey)
	req.Header.Set("Content-Type", "application/vnd.api+json")
	req.Header.Set("Accept", "application/vnd.api+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to perform checkout request to Lemon Squeezy")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to contact billing provider"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to read checkout response body")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Str("user_id", userID).Msg("lemon squeezy returned error status")
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
		log.Error().Err(err).Str("body", string(respBody)).Str("user_id", userID).Msg("failed to parse checkout response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"checkout_url": resData.Data.Attributes.URL})
}

// CreatePortal creates a Lemon Squeezy Customer Portal session redirect URL.
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
		log.Error().Err(err).Str("user_id", userID).Msg("failed to create customers request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+h.apiKey)
	req.Header.Set("Accept", "application/vnd.api+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to perform customer request to Lemon Squeezy")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to contact billing provider"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("failed to read customers response body")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Str("user_id", userID).Msg("lemon squeezy customer query returned error status")
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
		log.Error().Err(err).Str("body", string(respBody)).Str("user_id", userID).Msg("failed to parse customers response")
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

// Webhook handles Lemon Squeezy webhook events.
func (h *BillingHandler) Webhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
		return
	}

	// Verify Lemon Squeezy signature
	signature := c.GetHeader("X-Signature")
	mac := hmac.New(sha256.New, []byte(h.webhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(signature)) != 1 {
		log.Warn().Msg("invalid lemon squeezy webhook signature")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	// Parse payload
	type webhookPayload struct {
		Meta struct {
			EventName  string            `json:"event_name"`
			WebhookID  string            `json:"webhook_id"`
			CustomData map[string]string `json:"custom_data"`
		} `json:"meta"`
		Data struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				CustomerID interface{} `json:"customer_id"`
				UserEmail  string      `json:"user_email"`
				Status     string      `json:"status"`
			} `json:"attributes"`
		} `json:"data"`
	}

	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Error().Err(err).Msg("failed to unmarshal webhook body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload json"})
		return
	}

	eventID := payload.Meta.WebhookID
	eventName := payload.Meta.EventName

	if eventID == "" {
		log.Warn().Msg("missing webhook_id in payload")
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing webhook_id"})
		return
	}

	// Idempotency check
	processed, err := h.userRepo.IsWebhookEventProcessed(c.Request.Context(), eventID)
	if err != nil {
		log.Error().Err(err).Str("event_id", eventID).Msg("checking webhook event idempotency")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if processed {
		log.Info().Str("event_id", eventID).Msg("skipping already-processed webhook event")
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "already processed"})
		return
	}

	// Format customer ID as string safely
	var customerIDStr string
	if payload.Data.Attributes.CustomerID != nil {
		switch v := payload.Data.Attributes.CustomerID.(type) {
		case float64:
			customerIDStr = fmt.Sprintf("%.0f", v)
		case string:
			customerIDStr = v
		default:
			customerIDStr = fmt.Sprintf("%v", v)
		}
	}

	// Determine user to act on
	var userID string
	if payload.Meta.CustomData != nil {
		userID = payload.Meta.CustomData["user_id"]
	}

	// If no userID is in custom_data, resolve from DB via customer ID
	if userID == "" && customerIDStr != "" {
		user, err := h.userRepo.GetByLemonSqueezyCustomerID(c.Request.Context(), customerIDStr)
		if err == nil && user != nil {
			userID = user.ID
		}
	}

	log.Info().Str("event_name", eventName).Str("user_id", userID).Str("customer_id", customerIDStr).Msg("processing webhook event")

	switch eventName {
	case "subscription_created":
		if userID == "" {
			log.Error().Msg("subscription_created event missing user_id context")
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing user_id context"})
			return
		}

		// Upgrade to pro
		if err := h.userRepo.UpdatePlan(c.Request.Context(), userID, "pro"); err != nil {
			log.Error().Err(err).Str("user_id", userID).Msg("upgrading user plan to pro")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
			return
		}

		// Save Lemon Squeezy customer ID
		if customerIDStr != "" {
			if err := h.userRepo.UpdateLemonSqueezyCustomerID(c.Request.Context(), userID, customerIDStr); err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("saving lemonsqueezy customer id")
			}
		}
		log.Info().Str("user_id", userID).Msg("subscription created: upgraded user plan to pro")

	case "subscription_resumed":
		if userID != "" {
			if err := h.userRepo.UpdatePlan(c.Request.Context(), userID, "pro"); err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("upgrading user plan to pro on resume")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
				return
			}
			log.Info().Str("user_id", userID).Msg("subscription resumed: user plan set to pro")
		} else {
			log.Warn().Msg("subscription_resumed event could not resolve user")
		}

	case "subscription_cancelled", "subscription_expired":
		if userID != "" {
			if err := h.userRepo.UpdatePlan(c.Request.Context(), userID, "free"); err != nil {
				log.Error().Err(err).Str("user_id", userID).Msg("downgrading user plan to free")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
				return
			}
			log.Info().Str("user_id", userID).Msg("subscription cancelled/expired: user plan set to free")
		} else {
			log.Warn().Msg("subscription cancelled/expired event could not resolve user")
		}

	case "order_created":
		log.Info().Str("event_id", eventID).Msg("order_created webhook received (log only)")

	default:
		log.Debug().Str("event_name", eventName).Msg("unhandled lemon squeezy event")
	}

	// Mark event as processed
	if err := h.userRepo.MarkWebhookEventProcessed(c.Request.Context(), eventID, eventName); err != nil {
		log.Error().Err(err).Str("event_id", eventID).Msg("marking webhook event processed")
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
