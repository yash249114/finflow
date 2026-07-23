// api/internal/billing/razorpay_webhook.go
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

// RazorpayWebhookHandler processes Razorpay webhook events.
type RazorpayWebhookHandler struct {
	svc    *SubscriptionService
	secret string
}

// NewRazorpayWebhookHandler creates a new RazorpayWebhookHandler.
func NewRazorpayWebhookHandler(svc *SubscriptionService, secret string) *RazorpayWebhookHandler {
	return &RazorpayWebhookHandler{svc: svc, secret: secret}
}

type rzpWebhookPayload struct {
	Entity  string `json:"entity"`
	Event   string `json:"event"`
	Count   int    `json:"count"`
	Payload struct {
		Entity struct {
			ID               string                 `json:"id"`
			Entity           string                 `json:"entity"`
			Amount           int64                  `json:"amount"`
			Currency         string                 `json:"currency"`
			Status           string                 `json:"status"`
			OrderID          string                 `json:"order_id"`
			InvoiceID        string                 `json:"invoice_id"`
			International    bool                   `json:"international"`
			Method           string                 `json:"method"`
			AmountRefunded   int64                  `json:"amount_refunded"`
			RefundStatus     string                 `json:"refund_status"`
			Captured         bool                   `json:"captured"`
			Description      string                 `json:"description"`
			CardID           string                 `json:"card_id"`
			Bank             string                 `json:"bank"`
			Wallet           string                 `json:"wallet"`
			VPA              string                 `json:"vpa"`
			Email            string                 `json:"email"`
			Contact          string                 `json:"contact"`
			Notes            map[string]string      `json:"notes"`
			Fee              int64                  `json:"fee"`
			Tax              int64                  `json:"tax"`
			ErrorCode        string                 `json:"error_code"`
			ErrorDescription string                 `json:"error_description"`
			CreatedAt        int64                  `json:"created_at"`
			CustomerID       string                 `json:"customer_id"`
			SubscriptionID   string                 `json:"subscription_id"`
			PlanID           string                 `json:"plan_id"`
			Quantity         int                    `json:"quantity"`
			TotalCount       int                    `json:"total_count"`
			PaidCount        int                    `json:"paid_count"`
			StartAt          int64                  `json:"start_at"`
			EndAt            int64                  `json:"end_at"`
			RemainingCount   int                    `json:"remaining_count"`
			CustomerNotify   bool                   `json:"customer_notify"`
			CurrentStart     int64                  `json:"current_start"`
			CurrentEnd       int64                  `json:"current_end"`
			ChargeAt         int64                  `json:"charge_at"`
			StatusDetails    map[string]interface{} `json:"status_details"`
		} `json:"entity"`
	} `json:"payload"`
}

func (h *RazorpayWebhookHandler) HandleWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
		return
	}

	signature := c.GetHeader("X-Razorpay-Signature")
	if signature == "" {
		log.Warn().Msg("missing X-Razorpay-Signature header")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}

	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(expectedSig), []byte(signature)) != 1 {
		log.Warn().Msg("invalid Razorpay webhook signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload rzpWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Error().Err(err).Msg("failed to unmarshal Razorpay webhook")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	eventID := fmt.Sprintf("rzp_%s_%s", payload.Event, payload.Payload.Entity.ID)
	eventName := payload.Event

	processed, err := h.svc.IsEventProcessed(c.Request.Context(), eventID)
	if err != nil {
		log.Error().Err(err).Str("event_id", eventID).Msg("idempotency check failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if processed {
		log.Info().Str("event_id", eventID).Msg("duplicate Razorpay webhook, skipping")
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "already processed"})
		return
	}

	start := time.Now()
	err = h.routeEvent(c.Request.Context(), &payload, eventName)
	duration := time.Since(start)

	_ = h.svc.MarkEventProcessed(c.Request.Context(), eventID, eventName, body)

	if err != nil {
		log.Error().Err(err).Str("event_id", eventID).Str("event_name", eventName).
			Dur("duration", duration).Msg("Razorpay webhook handler error")
		c.JSON(http.StatusOK, gin.H{"ok": true, "warning": "handler error logged"})
		return
	}

	log.Info().Str("event_id", eventID).Str("event_name", eventName).
		Dur("duration", duration).Msg("Razorpay webhook processed")
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *RazorpayWebhookHandler) routeEvent(ctx context.Context, p *rzpWebhookPayload, eventName string) error {
	switch eventName {
	// Payment events
	case "payment.captured":
		return h.handlePaymentCaptured(ctx, p)
	case "payment.failed":
		return h.handlePaymentFailed(ctx, p)
	case "payment.authorized":
		return h.handlePaymentAuthorized(ctx, p)
	case "payment.refunded":
		return h.handleRefund(ctx, p)

	// Subscription events
	case "subscription.activated":
		return h.handleSubscriptionActivated(ctx, p)
	case "subscription.charged":
		return h.handleSubscriptionCharged(ctx, p)
	case "subscription.completed":
		return h.handleSubscriptionCompleted(ctx, p)
	case "subscription.cancelled":
		return h.handleSubscriptionCancelled(ctx, p)
	case "subscription.paused":
		return h.handleSubscriptionPaused(ctx, p)
	case "subscription.resumed":
		return h.handleSubscriptionResumed(ctx, p)
	case "subscription.expired":
		return h.handleSubscriptionExpired(ctx, p)
	case "subscription.halted":
		return h.handleSubscriptionHalted(ctx, p)

	// Invoice events
	case "invoice.paid":
		return h.handleInvoicePaid(ctx, p)
	case "invoice.payment_failed":
		return h.handleInvoicePaymentFailed(ctx, p)

	// Order events
	case "order.paid":
		return h.handleOrderPaid(ctx, p)

	// Refund events
	case "refund.created":
		return h.handleRefundCreated(ctx, p)
	case "refund.processed":
		return h.handleRefundProcessed(ctx, p)

	default:
		log.Debug().Str("event_name", eventName).Msg("unhandled Razorpay webhook event")
		return nil
	}
}

func (h *RazorpayWebhookHandler) resolveUserID(ctx context.Context, p *rzpWebhookPayload) string {
	// 1. Check notes for user_id (passed during checkout)
	if p.Payload.Entity.Notes != nil {
		if uid := p.Payload.Entity.Notes["user_id"]; uid != "" {
			return uid
		}
	}

	// 2. Try subscription ID
	if p.Payload.Entity.SubscriptionID != "" {
		if uid, err := h.svc.GetBySubscriptionID(ctx, p.Payload.Entity.SubscriptionID); err == nil && uid != "" {
			return uid
		}
	}

	// 3. Try customer ID
	if p.Payload.Entity.CustomerID != "" {
		if uid, err := h.svc.GetUserByCustomerID(ctx, p.Payload.Entity.CustomerID); err == nil && uid != "" {
			return uid
		}
	}

	// 4. Try email
	if p.Payload.Entity.Email != "" {
		if uid, err := h.svc.GetUserByEmail(ctx, p.Payload.Entity.Email); err == nil && uid != "" {
			return uid
		}
	}

	return ""
}

func (h *RazorpayWebhookHandler) getPlanFromPayload(p *rzpWebhookPayload) Plan {
	// Map Razorpay plan IDs to our internal plans
	planMap := map[string]Plan{
		"plan_emerald_monthly": PlanForVariant("emerald"),
		"plan_emerald_yearly":  PlanForVariant("emerald"),
		"plan_diamond_monthly": PlanForVariant("diamond"),
		"plan_diamond_yearly":  PlanForVariant("diamond"),
	}

	if p.Payload.Entity.PlanID != "" {
		if plan, ok := planMap[p.Payload.Entity.PlanID]; ok {
			return plan
		}
	}

	// Default to emerald (pro tier)
	return PlanForVariant("emerald")
}

// --- Payment Handlers ---

func (h *RazorpayWebhookHandler) handlePaymentCaptured(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment.captured: %s", p.Payload.Entity.ID)
	}

	// Record payment
	if err := h.svc.RecordPayment(ctx, userID, "captured"); err != nil {
		return err
	}

	// If this is a subscription payment, renew the subscription
	if p.Payload.Entity.SubscriptionID != "" {
		now := time.Now().UTC()
		return h.svc.Renew(ctx, userID, now)
	}

	return nil
}

func (h *RazorpayWebhookHandler) handlePaymentFailed(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment.failed: %s", p.Payload.Entity.ID)
	}

	// Record failed payment
	if err := h.svc.RecordPayment(ctx, userID, "failed"); err != nil {
		return err
	}

	// Handle failed subscription payment
	if p.Payload.Entity.SubscriptionID != "" {
		return h.svc.HandleFailedPayment(ctx, userID, p.Payload.Entity.ID)
	}

	return nil
}

func (h *RazorpayWebhookHandler) handlePaymentAuthorized(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment.authorized: %s", p.Payload.Entity.ID)
	}

	// Record authorized payment (will be captured later)
	return h.svc.RecordPayment(ctx, userID, "authorized")
}

func (h *RazorpayWebhookHandler) handleRefund(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for payment.refunded: %s", p.Payload.Entity.ID)
	}

	return h.svc.HandleRefund(ctx, userID, p.Payload.Entity.ID)
}

// --- Subscription Handlers ---

func (h *RazorpayWebhookHandler) handleSubscriptionActivated(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.activated: %s", p.Payload.Entity.ID)
	}

	plan := h.getPlanFromPayload(p)
	subscriptionID := p.Payload.Entity.ID
	subscriptionItemID := "" // Razorpay doesn't have separate item IDs
	customerID := p.Payload.Entity.CustomerID
	billingCycle := "monthly" // Default, could be determined from plan

	var startAt, renewsAt *time.Time
	if p.Payload.Entity.CurrentStart > 0 {
		t := time.Unix(p.Payload.Entity.CurrentStart, 0).UTC()
		startAt = &t
	}
	if p.Payload.Entity.CurrentEnd > 0 {
		t := time.Unix(p.Payload.Entity.CurrentEnd, 0).UTC()
		renewsAt = &t
	}

	return h.svc.Activate(ctx, userID, plan, subscriptionID, subscriptionItemID, customerID,
		billingCycle, startAt, renewsAt)
}

func (h *RazorpayWebhookHandler) handleSubscriptionCharged(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.charged: %s", p.Payload.Entity.ID)
	}

	// Record successful charge
	if err := h.svc.RecordPayment(ctx, userID, "captured"); err != nil {
		return err
	}

	// Renew subscription
	now := time.Now().UTC()
	return h.svc.Renew(ctx, userID, now)
}

func (h *RazorpayWebhookHandler) handleSubscriptionCompleted(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.completed: %s", p.Payload.Entity.ID)
	}

	// Subscription completed (all payments done)
	return h.svc.Expire(ctx, userID)
}

func (h *RazorpayWebhookHandler) handleSubscriptionCancelled(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.cancelled: %s", p.Payload.Entity.ID)
	}

	// Check if immediate or at period end
	atPeriodEnd := true
	if p.Payload.Entity.EndAt > 0 {
		endTime := time.Unix(p.Payload.Entity.EndAt, 0).UTC()
		if endTime.Before(time.Now().UTC()) {
			atPeriodEnd = false
		}
	}

	return h.svc.Cancel(ctx, userID, atPeriodEnd)
}

func (h *RazorpayWebhookHandler) handleSubscriptionPaused(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.paused: %s", p.Payload.Entity.ID)
	}

	_, err := h.svc.pool.Exec(ctx,
		"UPDATE users SET subscription_status = 'paused' WHERE id = $1", userID,
	)
	return err
}

func (h *RazorpayWebhookHandler) handleSubscriptionResumed(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.resumed: %s", p.Payload.Entity.ID)
	}

	plan := h.getPlanFromPayload(p)
	return h.svc.Reactivate(ctx, userID, plan, nil)
}

func (h *RazorpayWebhookHandler) handleSubscriptionExpired(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.expired: %s", p.Payload.Entity.ID)
	}

	return h.svc.Expire(ctx, userID)
}

func (h *RazorpayWebhookHandler) handleSubscriptionHalted(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for subscription.halted: %s", p.Payload.Entity.ID)
	}

	_, err := h.svc.pool.Exec(ctx,
		"UPDATE users SET subscription_status = 'halted' WHERE id = $1", userID,
	)
	return err
}

// --- Invoice Handlers ---

func (h *RazorpayWebhookHandler) handleInvoicePaid(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for invoice.paid: %s", p.Payload.Entity.ID)
	}

	if err := h.svc.RecordPayment(ctx, userID, "captured"); err != nil {
		return err
	}

	if p.Payload.Entity.SubscriptionID != "" {
		now := time.Now().UTC()
		return h.svc.Renew(ctx, userID, now)
	}

	return nil
}

func (h *RazorpayWebhookHandler) handleInvoicePaymentFailed(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for invoice.payment_failed: %s", p.Payload.Entity.ID)
	}

	if err := h.svc.RecordPayment(ctx, userID, "failed"); err != nil {
		return err
	}

	if p.Payload.Entity.SubscriptionID != "" {
		return h.svc.HandleFailedPayment(ctx, userID, p.Payload.Entity.ID)
	}

	return nil
}

// --- Order Handlers ---

func (h *RazorpayWebhookHandler) handleOrderPaid(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for order.paid: %s", p.Payload.Entity.ID)
	}

	// Record the payment
	return h.svc.RecordPayment(ctx, userID, "captured")
}

// --- Refund Handlers ---

func (h *RazorpayWebhookHandler) handleRefundCreated(ctx context.Context, p *rzpWebhookPayload) error {
	// Log refund creation
	log.Info().
		Str("refund_id", p.Payload.Entity.ID).
		Str("payment_id", p.Payload.Entity.OrderID).
		Int64("amount", p.Payload.Entity.Amount).
		Msg("Razorpay refund created")
	return nil
}

func (h *RazorpayWebhookHandler) handleRefundProcessed(ctx context.Context, p *rzpWebhookPayload) error {
	userID := h.resolveUserID(ctx, p)
	if userID == "" {
		return fmt.Errorf("could not resolve user for refund.processed: %s", p.Payload.Entity.ID)
	}

	return h.svc.HandleRefund(ctx, userID, p.Payload.Entity.ID)
}
