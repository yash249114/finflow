package entitlements

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// UsageRecord represents a usage record for a user+feature in a period.
type UsageRecord struct {
	UserID      string    `json:"user_id"`
	FeatureName string    `json:"feature_name"`
	UsageCount  int       `json:"usage_count"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	CreatedAt   time.Time `json:"created_at"`
}

// UsageStatus is the current usage status for a user+feature.
type UsageStatus struct {
	FeatureName      string `json:"feature_name"`
	CurrentUsage     int    `json:"current_usage"`
	LimitValue      int    `json:"limit_value"`
	Remaining       int    `json:"remaining"`
	RefreshInterval string `json:"refresh_interval"`
	IsUnlimited     bool   `json:"is_unlimited"`
}

// Repo handles database operations for the entitlements system.
type Repo struct {
	pool *pgxpool.Pool
}

// NewRepo creates a new Repo.
func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// GetAllFeatures loads all feature definitions.
func (r *Repo) GetAllFeatures(ctx context.Context) ([]Feature, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT name, display_name, COALESCE(description,''), category, is_beta, is_internal, created_at, updated_at
		 FROM features ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("querying features: %w", err)
	}
	defer rows.Close()

	var features []Feature
	for rows.Next() {
		var f Feature
		if err := rows.Scan(&f.Name, &f.DisplayName, &f.Description, &f.Category, &f.IsBeta, &f.IsInternal, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning feature: %w", err)
		}
		features = append(features, f)
	}
	return features, rows.Err()
}

// GetAllTiers loads all tiers with their entitlements.
func (r *Repo) GetAllTiers(ctx context.Context) ([]Tier, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT name, display_name, COALESCE(description,''), sort_order, created_at
		 FROM tiers ORDER BY sort_order`)
	if err != nil {
		return nil, fmt.Errorf("querying tiers: %w", err)
	}
	defer rows.Close()

	tierMap := make(map[string]*Tier)
	var tierOrder []string

	for rows.Next() {
		var t Tier
		if err := rows.Scan(&t.Name, &t.DisplayName, &t.Description, &t.SortOrder, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning tier: %w", err)
		}
		t.Entitlements = make(map[string]*FeatureEntitlement)
		tierMap[t.Name] = &t
		tierOrder = append(tierOrder, t.Name)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load entitlements for all tiers
	if len(tierOrder) > 0 {
		entRows, err := r.pool.Query(ctx,
			`SELECT fe.id, fe.feature_name, fe.tier_name, fe.enabled, fe.rollout_percentage,
			        fe.limit_value, fe.limit_unit, fe.refresh_interval, fe.priority, fe.max_batch_size, fe.created_at
			 FROM feature_entitlements fe
			 ORDER BY fe.tier_name, fe.priority DESC`)
		if err != nil {
			return nil, fmt.Errorf("querying entitlements: %w", err)
		}
		defer entRows.Close()

		for entRows.Next() {
			var ent FeatureEntitlement
			if err := entRows.Scan(&ent.ID, &ent.FeatureName, &ent.TierName, &ent.Enabled, &ent.RolloutPercentage,
				&ent.LimitValue, &ent.LimitUnit, &ent.RefreshInterval, &ent.Priority, &ent.MaxBatchSize, &ent.CreatedAt); err != nil {
				return nil, fmt.Errorf("scanning entitlement: %w", err)
			}
			if tier, ok := tierMap[ent.TierName]; ok {
				tier.Entitlements[ent.FeatureName] = &ent
			}
		}
		if err := entRows.Err(); err != nil {
			return nil, err
		}
	}

	tiers := make([]Tier, 0, len(tierOrder))
	for _, name := range tierOrder {
		if t, ok := tierMap[name]; ok {
			tiers = append(tiers, *t)
		}
	}
	return tiers, nil
}

// IncrementUsage increments the usage counter for a user+feature.
// Uses Redis for real-time counting with PostgreSQL persistence.
func (r *Repo) IncrementUsage(ctx context.Context, userID, featureName string, rdb *redis.Client) error {
	now := time.Now().UTC()
	periodKey := getPeriodKey(featureName, now)
	redisKey := fmt.Sprintf("usage:%s:%s:%s", userID, featureName, periodKey)

	// Increment in Redis (nil-safe)
	if rdb != nil {
		pipe := rdb.Pipeline()
		pipe.Incr(ctx, redisKey)
		pipe.Expire(ctx, redisKey, 72*time.Hour)
		if _, err := pipe.Exec(ctx); err != nil {
			return fmt.Errorf("incrementing usage in redis: %w", err)
		}
	}

	// Async persist to PostgreSQL (best-effort)
	go func() {
		pCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		periodStart, periodEnd := getPeriodRange(featureName, now)
		_, err := r.pool.Exec(pCtx,
			`INSERT INTO usage_tracking (user_id, feature_name, usage_count, period_start, period_end)
			 VALUES ($1, $2, 1, $3, $4)
			 ON CONFLICT (user_id, feature_name, period_start)
			 DO UPDATE SET usage_count = usage_tracking.usage_count + 1`,
			userID, featureName, periodStart, periodEnd)
		if err != nil {
			// Log but don't fail — Redis has the real-time counter
			fmt.Printf("error persisting usage: %v\n", err)
		}

		// Also log to audit trail
		_, _ = r.pool.Exec(pCtx,
			`INSERT INTO usage_log (user_id, feature_name, usage_count) VALUES ($1, $2, 1)`,
			userID, featureName)
	}()

	return nil
}

// GetCurrentUsage returns the current usage count for a user+feature in the current period.
// Prefers Redis for real-time accuracy, falls back to PostgreSQL.
func (r *Repo) GetCurrentUsage(ctx context.Context, userID, featureName string, rdb *redis.Client) (int, error) {
	now := time.Now().UTC()
	periodKey := getPeriodKey(featureName, now)
	redisKey := fmt.Sprintf("usage:%s:%s:%s", userID, featureName, periodKey)

	// Try Redis first (nil-safe)
	if rdb != nil {
		count, err := rdb.Get(ctx, redisKey).Int()
		if err == nil {
			return count, nil
		}
		if err != redis.Nil {
			// Redis error, fall through to PostgreSQL
			fmt.Printf("error reading usage from redis: %v\n", err)
		}
	}

	// Fallback to PostgreSQL
	periodStart, periodEnd := getPeriodRange(featureName, now)
	var pgCount int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE((SELECT usage_count FROM usage_tracking
		 WHERE user_id = $1 AND feature_name = $2 AND period_start = $3 AND period_end = $4), 0)`,
		userID, featureName, periodStart, periodEnd).Scan(&pgCount)
	if err != nil {
		return 0, fmt.Errorf("querying usage: %w", err)
	}
	return pgCount, nil
}

// GetUserOverride returns the per-user feature override if one exists.
func (r *Repo) GetUserOverride(ctx context.Context, userID, featureName string) (*UserFeatureOverride, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, user_id, feature_name, enabled, override_limit_value, override_until, created_by, created_at
		 FROM user_feature_overrides
		 WHERE user_id = $1 AND feature_name = $2
		   AND (override_until IS NULL OR override_until > NOW())`,
		userID, featureName)

	var o UserFeatureOverride
	err := row.Scan(&o.ID, &o.UserID, &o.FeatureName, &o.Enabled, &o.OverrideLimitValue, &o.OverrideUntil, &o.CreatedBy, &o.CreatedAt)
	if err != nil {
		return nil, nil
	}
	return &o, nil
}

// SetUserOverride creates or updates a per-user feature override.
func (r *Repo) SetUserOverride(ctx context.Context, override *UserFeatureOverride) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_feature_overrides (user_id, feature_name, enabled, override_limit_value, override_until, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id, feature_name)
		 DO UPDATE SET enabled = EXCLUDED.enabled,
		               override_limit_value = EXCLUDED.override_limit_value,
		               override_until = EXCLUDED.override_until`,
		override.UserID, override.FeatureName, override.Enabled, override.OverrideLimitValue, override.OverrideUntil, override.CreatedBy)
	if err != nil {
		return fmt.Errorf("setting user override: %w", err)
	}
	return nil
}

// RefreshQuotas resets usage counters for features whose refresh interval has elapsed.
func (r *Repo) RefreshQuotas(ctx context.Context) error {
	now := time.Now().UTC()

	// Delete usage_tracking records whose period has ended
	_, err := r.pool.Exec(ctx,
		`DELETE FROM usage_tracking WHERE period_end < $1`, now)
	if err != nil {
		return fmt.Errorf("refreshing quotas: %w", err)
	}

	// Clean up old usage_log entries (keep 90 days)
	cutoff := now.AddDate(0, 0, -90)
	_, err = r.pool.Exec(ctx,
		`DELETE FROM usage_log WHERE recorded_at < $1`, cutoff)
	return err
}

// getPeriodKey returns a string key for the current period of a feature.
func getPeriodKey(featureName string, now time.Time) string {
	return fmt.Sprintf("%s_%s", featureName, now.Format("2006_01"))
}

// getPeriodRange returns the start and end of the current period for a feature.
// For now, all features use monthly periods. This can be extended per-feature.
func getPeriodRange(featureName string, now time.Time) (time.Time, time.Time) {
	year, month, _ := now.Date()
	start := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	return start, end
}
