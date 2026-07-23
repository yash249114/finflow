package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/finflow/api/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, full_name, plan, razorpay_customer_id,
		        subscription_status, subscription_id, subscription_item_id, variant_id,
		        billing_cycle, plan_name, trial_starts_at, trial_ends_at,
		        current_period_starts_at, current_period_ends_at, cancel_at_period_end,
		        cancelled_at, renews_at, last_payment_status, last_payment_at,
		        coupon_code, variant_slug, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(
		&user.ID, &user.Email, &user.FullName, &user.Plan, &user.RazorpayCustomerID,
		&user.SubscriptionStatus, &user.SubscriptionID, &user.SubscriptionItemID, &user.VariantID,
		&user.BillingCycle, &user.PlanName, &user.TrialStartsAt, &user.TrialEndsAt,
		&user.CurrentPeriodStartsAt, &user.CurrentPeriodEndsAt, &user.CancelAtPeriodEnd,
		&user.CancelledAt, &user.RenewsAt, &user.LastPaymentStatus, &user.LastPaymentAt,
		&user.CouponCode, &user.VariantSlug, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepo) UpdatePlan(ctx context.Context, userID, plan string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET plan = $1 WHERE id = $2`,
		plan, userID,
	)
	if err != nil {
		return fmt.Errorf("updating user plan: %w", err)
	}
	return nil
}

func (r *UserRepo) UpdateRazorpayCustomerID(ctx context.Context, userID, customerID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET razorpay_customer_id = $1 WHERE id = $2`,
		customerID, userID,
	)
	if err != nil {
		return fmt.Errorf("updating razorpay customer id: %w", err)
	}
	return nil
}

func (r *UserRepo) GetByRazorpayCustomerID(ctx context.Context, customerID string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, full_name, plan, razorpay_customer_id, created_at
		 FROM users WHERE razorpay_customer_id = $1`,
		customerID,
	).Scan(&user.ID, &user.Email, &user.FullName, &user.Plan, &user.RazorpayCustomerID, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by razorpay customer id: %w", err)
	}
	return user, nil
}

func (r *UserRepo) GetBySubscriptionID(ctx context.Context, subscriptionID string) (string, error) {
	var userID string
	err := r.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE subscription_id = $1`, subscriptionID,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("querying by subscription_id: %w", err)
	}
	return userID, nil
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (string, error) {
	var userID string
	err := r.pool.QueryRow(ctx,
		`SELECT id FROM users WHERE email = $1`, email,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("querying by email: %w", err)
	}
	return userID, nil
}

func (r *UserRepo) UpdateSubscriptionState(ctx context.Context, userID string, state *models.User) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET
			plan = $2, plan_name = $3, variant_slug = $4,
			subscription_status = $5, subscription_id = $6, subscription_item_id = $7,
			razorpay_customer_id = COALESCE(NULLIF($8,''), razorpay_customer_id),
			billing_cycle = $9, current_period_starts_at = $10, current_period_ends_at = $11,
			cancel_at_period_end = $12, cancelled_at = $13, renews_at = $14,
			last_payment_status = $15, last_payment_at = $16, coupon_code = $17,
			trial_starts_at = $18, trial_ends_at = $19
		 WHERE id = $1`,
		userID,
		state.Plan, state.PlanName, state.VariantSlug,
		state.SubscriptionStatus, state.SubscriptionID, state.SubscriptionItemID,
		state.RazorpayCustomerID,
		state.BillingCycle, state.CurrentPeriodStartsAt, state.CurrentPeriodEndsAt,
		state.CancelAtPeriodEnd, state.CancelledAt, state.RenewsAt,
		state.LastPaymentStatus, state.LastPaymentAt, state.CouponCode,
		state.TrialStartsAt, state.TrialEndsAt,
	)
	if err != nil {
		return fmt.Errorf("updating subscription state: %w", err)
	}
	return nil
}

// ─── Webhook Events (idempotency) ─────────────────────────

func (r *UserRepo) IsWebhookEventProcessed(ctx context.Context, eventID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM webhook_events WHERE event_id = $1)`,
		eventID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checking webhook event: %w", err)
	}
	return exists, nil
}

func (r *UserRepo) MarkWebhookEventProcessed(ctx context.Context, eventID, eventName string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO webhook_events (event_id, event_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		eventID, eventName,
	)
	if err != nil {
		return fmt.Errorf("marking webhook event processed: %w", err)
	}
	return nil
}

func (r *UserRepo) GetTransactionCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM transactions WHERE user_id = $1`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting transactions: %w", err)
	}
	return count, nil
}
