// api/internal/billing/webhook.go
package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// WebhookHandler processes LemonSqueezy webhook events.
type WebhookHandler struct {
	svc    *SubscriptionService
	secret string
}

// NewWebhookHandler creates a new WebhookHandler.
func NewWebhookHandler(svc *SubscriptionService, secret string) *WebhookHandler {
	return &WebhookHandler{svc: svc, secret: secret}
}

type lsWebhookPayload struct {
	Meta struct {
		EventName  string            `json:"event_name"`
		WebhookID  string            `json:"webhook_id"`
		CustomData map[string]string `json:"custom_data"`
	} `json:"meta"`
	Data struct {
		ID         string `json:"id"`
		Type       string `json:"type"`
		Attributes struct {
			SubscriptionID     interface{} `json:"subscription_id"`
			CustomerID         interface{} `json:"customer_id"`
			UserEmail          string      `json:"user_email"`
			Status             string      `json:"status"`
			ProductName        string      `json:"product_name"`
			VariantName        string      `json:"variant_name"`
			VariantID          interface{} `json:"variant_id"`
			PlanName           string      `json:"plan_name"`
			RenewsAt           *time.Time  `json:"renews_at"`
			EndsAt             *time.Time  `json:"ends_at"`
			TrialStartsAt      *time.Time  `json:"trial_starts_at"`
			TrialEndsAt        *time.Time  `json:"trial_ends_at"`
			BillingCycle       string      `json:"billing_cycle"`
			CreatedAt          *time.Time  `json:"created_at"`
			UpdatedAt          *time.Time  `json:"updated_at"`
			OrderNumber        interface{} `json:"order_number"`
			Total              interface{} `json:"total"`
			Currency           string      `json:"currency"`
			PaymentStatus      string      `json:"payment_status"`
			SubscriptionItemID interface{} `json:"subscription_item_id"`
		} `json:"attributes"`
	} `json:"data"`
}

func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
		return
	}

	signature := c.GetHeader("X-Signature")
	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(expectedSig), []byte(signature)) != 1 {
		log.Warn().Msg("invalid webhook signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload lsWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Error().Err(err).Msg("failed to unmarshal webhook")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	eventID := payload.Meta.WebhookID
	eventName := payload.Meta.EventName
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing webhook_id"})
		return
	}

	processed, err := h.svc.IsEventProcessed(c.Request.Context(), eventID)
	if err != nil {
		log.Error().Err(err).Str("event_id", eventID).Msg("idempotency check failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if processed {
		log.Info().Str("event_id", eventID).Msg("duplicate webhook, skipping")
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "already processed"})
		return
	}

	start := time.Now()
	err = h.routeEvent(c.Request.Context(), &payload, eventName)
	duration := time.Since(start)

	_ = h.svc.MarkEventProcessed(c.Request.Context(), eventID, eventName, body)

	if err != nil {
		log.Error().Err(err).Str("event_id", eventID).Str("event_name", eventName).
			Dur("duration", duration).Msg("webhook handler error")
		c.JSON(http.StatusOK, gin.H{"ok": true, "warning": "handler error logged"})
		return
	}

	log.Info().Str("event_id", eventID).Str("event_name", eventName).
		Dur("duration", duration).Msg("webhook processed")
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *WebhookHandler) routeEvent(ctx context.Context, p *lsWebhookPayload, eventName string) error {
	switch eventName {
	case "subscription_created":
		return h.handleSubscriptionCreated(ctx, p)
	case "subscription_updated":
		return h.handleSubscriptionUpdated(ctx, p)
	case "subscription_resumed":
		return h.handleSubscriptionResumed(ctx, p)
	case "subscription_cancelled":
		return h.handleSubscriptionCancelled(ctx, p)
	case "subscription_expired":
		return h.handleSubscriptionExpired(ctx, p)
	case "subscription_paused":
		return h.handleSubscriptionPaused(ctx, p)
	case "subscription_payment_success", "order_payment_success":
		return h.handlePaymentSuccess(ctx, p)
	case "subscription_payment_failed", "order_payment_failed":
		return h.handlePaymentFailed(ctx, p)
	case "order_created":
		log.Info().Str("event_id", p.Meta.WebhookID).Msg("order created")
		return nil
	case "order_expired":
		log.Info().Str("event_id", p.Meta.WebhookID).Msg("order expired")
		return nil
	case "order_refunded":
		return h.handleRefund(ctx, p)
	default:
		log.Debug().Str("event_name", eventName).Msg("unhandled webhook event")
		return nil
	}
}

func (h *WebhookHandler) resolveUserID(ctx context.Context, p *lsWebhookPayload) string {
	if p.Meta.CustomData != nil {
		if uid := p.Meta.CustomData["user_id"]; uid != "" {
			return uid
		}
	}

	subID := toString(p.Data.Attributes.SubscriptionID)
	if subID != "" {
		if uid, err := h.svc.GetBySubscriptionID(ctx, subID); err == nil && uid != "" {
			return uid
		}
	}

	custID := toString(p.Data.Attributes.CustomerID)
	if custID != "" {
		if uid, err := h.svc.GetUserByCustomerID(ctx, custID); err == nil && uid != "" {
			return uid
		}
	}

	if p.Data.Attributes.UserEmail != "" {
		if uid, err := h.svc.GetUserByEmail(ctx, p.Data.Attributes.UserEmail); err == nil && uid != "" {
			return uid
		}
	}

	return ""
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		return fmt.Sprintf("%.0f", val)
	case json.Number:
		return val.String()
	default:
		return fmt.Sprintf("%v", val)
	}
}

func variantSlugFromID(variantID string) string {
	return ""
}

func (h *WebhookHandler) handleSubscriptionCreated(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription_created")
	}

	subscriptionID := toString(p.Data.Attributes.SubscriptionID)
	customerID := toString(p.Data.Attributes.CustomerID)
	subscriptionItemID := toString(p.Data.Attributes.SubscriptionItemID)
	variantID := toString(p.Data.Attributes.VariantID)
	slug := variantSlugFromID(variantID)
	if slug == "" {
		slug = "emerald"
	}
	plan := PlanForVariant(slug)

	billingCycle := p.Data.Attributes.BillingCycle
	if billingCycle == "" {
		billingCycle = "monthly"
	}

	return h.svc.Activate(ctx, userID, plan, subscriptionID, subscriptionItemID, customerID,
		billingCycle, p.Data.Attributes.CreatedAt, p.Data.Attributes.RenewsAt)
}

func (h *WebhookHandler) handleSubscriptionUpdated(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription_updated")
	}

	subscriptionID := toString(p.Data.Attributes.SubscriptionID)
	customerID := toString(p.Data.Attributes.CustomerID)
	subscriptionItemID := toString(p.Data.Attributes.SubscriptionItemID)
	variantID := toString(p.Data.Attributes.VariantID)
	slug := variantSlugFromID(variantID)
	if slug == "" {
		slug = "emerald"
	}
	plan := PlanForVariant(slug)

	billingCycle := p.Data.Attributes.BillingCycle
	if billingCycle == "" {
		billingCycle = "monthly"
	}

	return h.svc.Activate(ctx, userID, plan, subscriptionID, subscriptionItemID, customerID,
		billingCycle, p.Data.Attributes.CreatedAt, p.Data.Attributes.RenewsAt)
}

func (h *WebhookHandler) handleSubscriptionResumed(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription_resumed")
	}

	variantID := toString(p.Data.Attributes.VariantID)
	slug := variantSlugFromID(variantID)
	if slug == "" {
		slug = "emerald"
	}
	plan := PlanForVariant(slug)

	return h.svc.Reactivate(ctx, userID, plan, p.Data.Attributes.RenewsAt)
}

func (h *WebhookHandler) handleSubscriptionCancelled(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription_cancelled")
	}

	atPeriodEnd := true
	if p.Data.Attributes.EndsAt != nil && p.Data.Attributes.EndsAt.Before(time.Now()) {
		atPeriodEnd = false
	}

	return h.svc.Cancel(ctx, userID, atPeriodEnd)
}

func (h *WebhookHandler) handleSubscriptionExpired(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription_expired")
	}

	return h.svc.Expire(ctx, userID)
}

func (h *WebhookHandler) handleSubscriptionPaused(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return nil
	}

	_, err := h.svc.pool.Exec(ctx,
		"UPDATE users SET subscription_status = 'paused' WHERE id = $1", userID,
	)
	return err
}

func (h *WebhookHandler) handlePaymentSuccess(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment_success")
	}

	newEnd := p.Data.Attributes.RenewsAt
	if newEnd == nil {
		now := time.Now().UTC()
		newEnd = &now
	}

	return h.svc.Renew(ctx, userID, *newEnd)
}

func (h *WebhookHandler) handlePaymentFailed(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment_failed")
	}

	return h.svc.HandleFailedPayment(ctx, userID, p.Meta.WebhookID)
}

func (h *WebhookHandler) handleRefund(ctx context.Context, p *lsWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for refund")
	}

	return h.svc.HandleRefund(ctx, userID, p.Meta.WebhookID)
}
