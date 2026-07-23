// api/internal/billing/subscription.go
package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// Plan represents a billing plan with its tier mapping.
type Plan struct {
	Tier        string // entitlements tier: "free", "pro", "max"
	Name        string // display name: "Blue Sapphire", "Emerald", "Diamond"
	VariantSlug string // plan slug: 'blue-sapphire' | 'emerald' | 'diamond'
}

// KnownPlans maps variant slugs to their plan definitions.
var KnownPlans = map[string]Plan{
	"blue-sapphire": {Tier: "free", Name: "Blue Sapphire", VariantSlug: "blue-sapphire"},
	"emerald":       {Tier: "pro", Name: "Emerald", VariantSlug: "emerald"},
	"diamond":       {Tier: "max", Name: "Diamond", VariantSlug: "diamond"},
}

// PlanForVariant returns the Plan for a variant slug, defaulting to free.
func PlanForVariant(slug string) Plan {
	if p, ok := KnownPlans[slug]; ok {
		return p
	}
	return KnownPlans["blue-sapphire"]
}

// PlanForTier returns the Plan for an entitlements tier name.
func PlanForTier(tier string) Plan {
	for _, p := range KnownPlans {
		if p.Tier == tier {
			return p
		}
	}
	return KnownPlans["blue-sapphire"]
}

// SubscriptionState represents the full billing state of a user.
type SubscriptionState struct {
	UserID              string     `json:"user_id"`
	Status              string     `json:"status"`
	Plan                string     `json:"plan"`
	PlanName            string     `json:"plan_name"`
	VariantSlug         string     `json:"variant_slug"`
	BillingCycle        string     `json:"billing_cycle"`
	SubscriptionID      string     `json:"subscription_id"`
	SubscriptionItemID  string     `json:"subscription_item_id"`
	CustomerID          string     `json:"customer_id"`
	TrialStartsAt       *time.Time `json:"trial_starts_at,omitempty"`
	TrialEndsAt         *time.Time `json:"trial_ends_at,omitempty"`
	CurrentPeriodStarts *time.Time `json:"current_period_starts_at,omitempty"`
	CurrentPeriodEnds   *time.Time `json:"current_period_ends_at,omitempty"`
	CancelAtPeriodEnd   bool       `json:"cancel_at_period_end"`
	CancelledAt         *time.Time `json:"cancelled_at,omitempty"`
	RenewsAt            *time.Time `json:"renews_at,omitempty"`
	LastPaymentStatus   string     `json:"last_payment_status,omitempty"`
	LastPaymentAt       *time.Time `json:"last_payment_at,omitempty"`
	CouponCode          string     `json:"coupon_code,omitempty"`
}

// SubscriptionService manages the full subscription lifecycle in the database.
type SubscriptionService struct {
	pool *pgxpool.Pool
}

// NewSubscriptionService creates a new SubscriptionService.
func NewSubscriptionService(pool *pgxpool.Pool) *SubscriptionService {
	return &SubscriptionService{pool: pool}
}

// GetState returns the current subscription state for a user.
func (s *SubscriptionService) GetState(ctx context.Context, userID string) (*SubscriptionState, error) {
	st := &SubscriptionState{}
	err := s.pool.QueryRow(ctx,
		`SELECT id, COALESCE(subscription_status,'inactive'),
		        COALESCE(plan,'free'),
		        COALESCE(plan_name,'Blue Sapphire'),
		        COALESCE(variant_slug,'blue-sapphire'),
		        COALESCE(billing_cycle,'monthly'),
		        COALESCE(subscription_id,''),
		        COALESCE(subscription_item_id,''),
		        COALESCE(razorpay_customer_id,''),
		        trial_starts_at, trial_ends_at,
		        current_period_starts_at, current_period_ends_at,
		        COALESCE(cancel_at_period_end, FALSE),
		        cancelled_at, renews_at,
		        COALESCE(last_payment_status,''),
		        last_payment_at,
		        COALESCE(coupon_code,'')
		 FROM users WHERE id = $1`,
		userID,
	).Scan(
		&st.UserID, &st.Status, &st.Plan, &st.PlanName,
		&st.VariantSlug, &st.BillingCycle, &st.SubscriptionID,
		&st.SubscriptionItemID, &st.CustomerID,
		&st.TrialStartsAt, &st.TrialEndsAt,
		&st.CurrentPeriodStarts, &st.CurrentPeriodEnds,
		&st.CancelAtPeriodEnd, &st.CancelledAt, &st.RenewsAt,
		&st.LastPaymentStatus, &st.LastPaymentAt, &st.CouponCode,
	)
	if err != nil {
		return nil, fmt.Errorf("querying subscription state: %w", err)
	}
	return st, nil
}

// GetBySubscriptionID returns the user ID for a LemonSqueezy subscription ID.
func (s *SubscriptionService) GetBySubscriptionID(ctx context.Context, subscriptionID string) (string, error) {
	var userID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE subscription_id = $1`, subscriptionID,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("querying by subscription_id: %w", err)
	}
	return userID, nil
}

// GetUserByCustomerID returns the user ID for a LemonSqueezy customer ID.
func (s *SubscriptionService) GetUserByCustomerID(ctx context.Context, customerID string) (string, error) {
	var userID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE lemonsqueezy_customer_id = $1`, customerID,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("querying by customer_id: %w", err)
	}
	return userID, nil
}

// GetUserByEmail returns the user ID for an email address.
func (s *SubscriptionService) GetUserByEmail(ctx context.Context, email string) (string, error) {
	var userID string
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE email = $1`, email,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("querying by email: %w", err)
	}
	return userID, nil
}

// Activate sets the user to the given plan tier and stores subscription metadata.
func (s *SubscriptionService) Activate(ctx context.Context, userID string, plan Plan, subscriptionID, subscriptionItemID, customerID, billingCycle string, periodStarts, periodEnds *time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = 'active',
			subscription_id = $5,
			razorpay_customer_id = COALESCE(NULLIF($6,''), razorpay_customer_id),
			billing_cycle = $7,
			current_period_starts_at = $8,
			current_period_ends_at = $9,
			renews_at = $9,
			cancel_at_period_end = FALSE,
			cancelled_at = NULL
		 WHERE id = $1`,
		userID, plan.Tier, plan.Name, plan.VariantSlug,
		subscriptionID, subscriptionItemID, customerID,
		billingCycle, periodStarts, periodEnds,
	)
	if err != nil {
		return fmt.Errorf("activating subscription: %w", err)
	}
	log.Info().Str("user_id", userID).Str("plan", plan.Name).Msg("subscription activated")
	return nil
}

// Cancel marks the user's subscription as cancelled (at period end or immediately).
func (s *SubscriptionService) Cancel(ctx context.Context, userID string, atPeriodEnd bool) error {
	now := time.Now().UTC()
	if atPeriodEnd {
		_, err := s.pool.Exec(ctx,
			`UPDATE users SET cancel_at_period_end = TRUE WHERE id = $1`, userID,
		)
		if err != nil {
			return fmt.Errorf("scheduling cancellation: %w", err)
		}
		log.Info().Str("user_id", userID).Msg("subscription cancellation scheduled at period end")
	} else {
		plan := PlanForTier("free")
		_, err := s.pool.Exec(ctx,
			`UPDATE users SET
				plan = $2, plan_name = $3, variant_slug = $4,
				subscription_status = 'cancelled',
				cancel_at_period_end = FALSE, cancelled_at = $5
			 WHERE id = $1`,
			userID, plan.Tier, plan.Name, plan.VariantSlug, now,
		)
		if err != nil {
			return fmt.Errorf("cancelling subscription: %w", err)
		}
		log.Info().Str("user_id", userID).Msg("subscription cancelled immediately")
	}
	return nil
}

// Expire transitions the user to the free tier after subscription expiry.
func (s *SubscriptionService) Expire(ctx context.Context, userID string) error {
	plan := PlanForTier("free")
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = 'expired',
			cancel_at_period_end = FALSE, cancelled_at = $5
		 WHERE id = $1`,
		userID, plan.Tier, plan.Name, plan.VariantSlug, now,
	)
	if err != nil {
		return fmt.Errorf("expiring subscription: %w", err)
	}
	log.Info().Str("user_id", userID).Msg("subscription expired -> free tier")
	return nil
}

// Reactivate re-enables a previously cancelled subscription.
func (s *SubscriptionService) Reactivate(ctx context.Context, userID string, plan Plan, periodEnds *time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = 'active',
			cancel_at_period_end = FALSE, cancelled_at = NULL,
			current_period_ends_at = $5, renews_at = $5
		 WHERE id = $1`,
		userID, plan.Tier, plan.Name, plan.VariantSlug, periodEnds,
	)
	if err != nil {
		return fmt.Errorf("reactivating subscription: %w", err)
	}
	log.Info().Str("user_id", userID).Msg("subscription reactivated")
	return nil
}

// StartTrial begins a trial period for the user.
func (s *SubscriptionService) StartTrial(ctx context.Context, userID string, plan Plan, trialEnds time.Time) error {
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = 'trial',
			trial_starts_at = $5, trial_ends_at = $6,
			current_period_starts_at = $5, current_period_ends_at = $6
		 WHERE id = $1`,
		userID, plan.Tier, plan.Name, plan.VariantSlug, now, trialEnds,
	)
	if err != nil {
		return fmt.Errorf("starting trial: %w", err)
	}
	log.Info().Str("user_id", userID).Time("trial_end", trialEnds).Msg("trial started")
	return nil
}

// MarkPastDue flags a subscription as past due (payment failed).
func (s *SubscriptionService) MarkPastDue(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET subscription_status = 'past_due' WHERE id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("marking past due: %w", err)
	}
	log.Info().Str("user_id", userID).Msg("subscription marked as past_due")
	return nil
}

// HandleFailedPayment logs a failed payment event and marks as past_due.
func (s *SubscriptionService) HandleFailedPayment(ctx context.Context, userID string, eventID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			subscription_status = 'past_due',
			last_payment_status = 'failed',
			last_payment_at = NOW()
		 WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("handling failed payment: %w", err)
	}
	log.Warn().Str("user_id", userID).Str("event_id", eventID).Msg("failed payment recorded -> past_due")
	return nil
}

// HandleRefund processes a refund event and downgrades to free.
func (s *SubscriptionService) HandleRefund(ctx context.Context, userID string, eventID string) error {
	plan := PlanForTier("free")
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = 'cancelled',
			last_payment_status = 'refunded', last_payment_at = NOW(),
			cancelled_at = NOW()
		 WHERE id = $1`,
		userID, plan.Tier, plan.Name, plan.VariantSlug,
	)
	if err != nil {
		return fmt.Errorf("handling refund: %w", err)
	}
	log.Warn().Str("user_id", userID).Str("event_id", eventID).Msg("refund recorded -> free tier")
	return nil
}

// Renew extends the billing period after a successful renewal payment.
func (s *SubscriptionService) Renew(ctx context.Context, userID string, newPeriodEnds time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET
			current_period_starts_at = current_period_ends_at,
			current_period_ends_at = $2,
			renews_at = $2,
			last_payment_status = 'success',
			last_payment_at = NOW()
		 WHERE id = $1`,
		userID, newPeriodEnds,
	)
	if err != nil {
		return fmt.Errorf("renewing subscription: %w", err)
	}
	log.Info().Str("user_id", userID).Time("new_period_end", newPeriodEnds).Msg("subscription renewed")
	return nil
}

// Downgrade schedules a plan change for the end of the current billing period.
func (s *SubscriptionService) Downgrade(ctx context.Context, userID string, targetSlug string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET cancel_at_period_end = TRUE WHERE id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("scheduling downgrade: %w", err)
	}
	log.Info().Str("user_id", userID).Str("target", PlanForVariant(targetSlug).Name).Msg("downgrade scheduled at period end")
	return nil
}

// RecordPayment logs a payment event for audit.
func (s *SubscriptionService) RecordPayment(ctx context.Context, userID string, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET last_payment_status = $2, last_payment_at = NOW() WHERE id = $1`,
		userID, status,
	)
	if err != nil {
		return fmt.Errorf("recording payment: %w", err)
	}
	return nil
}

// ResetQuotas resets all usage counters for a user (called on renewal or plan change).
func (s *SubscriptionService) ResetQuotas(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM usage_tracking WHERE user_id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("resetting quotas: %w", err)
	}
	_, _ = s.pool.Exec(ctx,
		`DELETE FROM usage_log WHERE user_id = $1`, userID,
	)
	log.Info().Str("user_id", userID).Msg("quotas reset")
	return nil
}

// IsEventProcessed checks idempotency for webhook events.
func (s *SubscriptionService) IsEventProcessed(ctx context.Context, eventID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM webhook_events WHERE event_id = $1)`, eventID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checking webhook idempotency: %w", err)
	}
	return exists, nil
}

// MarkEventProcessed records that a webhook event has been processed.
func (s *SubscriptionService) MarkEventProcessed(ctx context.Context, eventID, eventName string, payload []byte) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO webhook_events (event_id, event_name, payload)
		 VALUES ($1, $2, $3)
		 ON CONFLICT DO NOTHING`,
		eventID, eventName, payload,
	)
	if err != nil {
		return fmt.Errorf("marking webhook event: %w", err)
	}
	return nil
}
