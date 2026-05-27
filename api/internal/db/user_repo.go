// api/internal/db/user_repo.go
package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/finflow/api/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepo handles all user-related database operations.
type UserRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo creates a new UserRepo.
func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

// Create inserts a new user and returns it.
func (r *UserRepo) Create(ctx context.Context, id, email, fullName string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (id, email, full_name)
		 VALUES ($1, $2, $3)
		 RETURNING id, email, full_name, plan, lemonsqueezy_customer_id, created_at`,
		id, email, fullName,
	).Scan(&user.ID, &user.Email, &user.FullName,
		&user.Plan, &user.LemonSqueezyCustomerID, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting user: %w", err)
	}
	return user, nil
}

// GetByEmail retrieves a user by email address.
func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, full_name, plan, lemonsqueezy_customer_id, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.FullName,
		&user.Plan, &user.LemonSqueezyCustomerID, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by email: %w", err)
	}
	return user, nil
}

// GetByID retrieves a user by their UUID.
func (r *UserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, full_name, plan, lemonsqueezy_customer_id, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.FullName,
		&user.Plan, &user.LemonSqueezyCustomerID, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by id: %w", err)
	}
	return user, nil
}

// UpdatePlan changes a user's subscription plan.
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

// UpdateLemonSqueezyCustomerID saves the Lemon Squeezy customer ID for a user.
func (r *UserRepo) UpdateLemonSqueezyCustomerID(ctx context.Context, userID, customerID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET lemonsqueezy_customer_id = $1 WHERE id = $2`,
		customerID, userID,
	)
	if err != nil {
		return fmt.Errorf("updating lemonsqueezy customer id: %w", err)
	}
	return nil
}

// GetByLemonSqueezyCustomerID retrieves a user by their Lemon Squeezy customer ID.
func (r *UserRepo) GetByLemonSqueezyCustomerID(ctx context.Context, customerID string) (*models.User, error) {
	user := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, full_name, plan, lemonsqueezy_customer_id, created_at
		 FROM users WHERE lemonsqueezy_customer_id = $1`,
		customerID,
	).Scan(&user.ID, &user.Email, &user.FullName,
		&user.Plan, &user.LemonSqueezyCustomerID, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying user by lemonsqueezy customer id: %w", err)
	}
	return user, nil
}

// ─── Refresh Token Operations ─────────────────────────────

// SaveRefreshToken stores a hashed refresh token in the database.
func (r *UserRepo) SaveRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt interface{}) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("saving refresh token: %w", err)
	}
	return nil
}

// GetRefreshToken retrieves a refresh token record by its hash.
func (r *UserRepo) GetRefreshToken(ctx context.Context, tokenHash string) (*models.RefreshToken, error) {
	rt := &models.RefreshToken{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, token_hash, expires_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("querying refresh token: %w", err)
	}
	return rt, nil
}

// DeleteRefreshToken removes a specific refresh token by its hash.
func (r *UserRepo) DeleteRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	)
	if err != nil {
		return fmt.Errorf("deleting refresh token: %w", err)
	}
	return nil
}

// DeleteAllRefreshTokens removes all refresh tokens for a user.
func (r *UserRepo) DeleteAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM refresh_tokens WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("deleting all refresh tokens: %w", err)
	}
	return nil
}

// ─── Webhook Events ───────────────────────────────────────

// IsWebhookEventProcessed checks if a webhook event was already processed (idempotency).
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

// MarkWebhookEventProcessed records a webhook event as processed.
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

// GetTransactionCount returns total transaction count for a user.
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
