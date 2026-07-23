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
		`SELECT id, email, full_name, plan, razorpay_customer_id, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.FullName,
		&user.Plan, &user.RazorpayCustomerID, &user.CreatedAt)
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
