package entitlements

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// Engine is the core AI Product Layer engine.
// It evaluates feature flags, manages usage, refreshes quotas,
// and generates upgrade recommendations.
type Engine struct {
	pool *pgxpool.Pool
	rdb  *redis.Client
	repo *Repo

	mu       sync.RWMutex
	features map[string]*Feature
	tiers    map[string]*Tier

	stopCh chan struct{}
}

// NewEngine creates and initializes the entitlement engine.
func NewEngine(pool *pgxpool.Pool, rdb *redis.Client) *Engine {
	e := &Engine{
		pool:     pool,
		rdb:      rdb,
		repo:     NewRepo(pool),
		features: make(map[string]*Feature),
		tiers:    make(map[string]*Tier),
		stopCh:   make(chan struct{}),
	}
	return e
}

// Start loads entitlements and starts the quota refresh worker.
// If the database tables (features, tiers) do not exist yet (e.g. migrations
// are pending), the engine starts in degraded mode with an empty catalog and
// retries every 5 minutes via the refresh loop.
func (e *Engine) Start(ctx context.Context) error {
	if err := e.load(ctx); err != nil {
		log.Warn().Err(err).Msg("Entitlement engine started in degraded mode — feature catalog unavailable")
	} else {
		log.Info().Msg("Entitlement engine started")
	}
	go e.refreshLoop(ctx)
	return nil
}

// Healthy returns true if the engine has successfully loaded features and tiers.
func (e *Engine) Healthy() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.features) > 0 && len(e.tiers) > 0
}

// Stop stops the quota refresh worker.
func (e *Engine) Stop() {
	close(e.stopCh)
}

// load fetches all features and tiers from the database.
// If the underlying tables are missing (migrations pending) the error is
// returned but callers are expected to treat it as non-fatal — the engine
// retries on the next refresh cycle.
func (e *Engine) load(ctx context.Context) error {
	features, err := e.repo.GetAllFeatures(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load features — entitlements will be empty")
		e.mu.Lock()
		e.features = make(map[string]*Feature)
		e.tiers = make(map[string]*Tier)
		e.mu.Unlock()
		return nil // Don't fail startup, just log and continue
	}
	tiers, err := e.repo.GetAllTiers(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load tiers — entitlements will be empty")
		e.mu.Lock()
		e.features = make(map[string]*Feature)
		e.tiers = make(map[string]*Tier)
		e.mu.Unlock()
		return nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	e.features = make(map[string]*Feature, len(features))
	for i := range features {
		e.features[features[i].Name] = &features[i]
	}

	e.tiers = make(map[string]*Tier, len(tiers))
	for i := range tiers {
		e.tiers[tiers[i].Name] = &tiers[i]
	}

	return nil
}

// refreshLoop periodically reloads entitlements from the database.
func (e *Engine) refreshLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := e.load(ctx); err != nil {
				log.Warn().Err(err).Msg("Entitlement refresh failed")
			}
		case <-e.stopCh:
			return
		}
	}
}

// ─── Feature Evaluation ─────────────────────────────────────

// IsFeatureEnabled checks if a feature is available for the given user's tier.
func (e *Engine) IsFeatureEnabled(tierName, featureName string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()

	ent, ok := e.getEntitlement(tierName, featureName)
	if !ok || !ent.Enabled {
		return false
	}
	// Rollout percentage check (deterministic by feature name for consistency)
	if ent.RolloutPercentage < 100 {
		h := hash(featureName + tierName)
		if h%100 >= ent.RolloutPercentage {
			return false
		}
	}
	return true
}

// GetEntitlement returns the entitlement for a given tier and feature.
func (e *Engine) GetEntitlement(tierName, featureName string) (*FeatureEntitlement, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.getEntitlement(tierName, featureName)
}

func (e *Engine) getEntitlement(tierName, featureName string) (*FeatureEntitlement, bool) {
	tier, ok := e.tiers[tierName]
	if !ok {
		return nil, false
	}
	ent, ok := tier.Entitlements[featureName]
	if !ok {
		return nil, false
	}
	return ent, true
}

// GetFeature returns a feature definition by name.
func (e *Engine) GetFeature(name string) (*Feature, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	f, ok := e.features[name]
	if !ok {
		return nil, false
	}
	return f, true
}

// GetAllFeatures returns all feature definitions.
func (e *Engine) GetAllFeatures() []Feature {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Feature, 0, len(e.features))
	for _, f := range e.features {
		result = append(result, *f)
	}
	return result
}

// GetTier returns a tier by name.
func (e *Engine) GetTier(name string) (*Tier, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	t, ok := e.tiers[name]
	if !ok {
		return nil, false
	}
	return t, true
}

// GetAllTiers returns all tiers.
func (e *Engine) GetAllTiers() []Tier {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Tier, 0, len(e.tiers))
	for _, t := range e.tiers {
		result = append(result, *t)
	}
	return result
}

// ─── Usage Tracking ─────────────────────────────────────────

// RecordUsage increments the usage counter for a user+feature.
// It records in Redis for real-time and asynchronously persists to PostgreSQL.
func (e *Engine) RecordUsage(ctx context.Context, userID, featureName string) error {
	return e.repo.IncrementUsage(ctx, userID, featureName, e.rdb)
}

// GetUsage returns the current usage count for a user+feature in the current period.
func (e *Engine) GetUsage(ctx context.Context, userID, featureName string) (int, error) {
	return e.repo.GetCurrentUsage(ctx, userID, featureName, e.rdb)
}

// GetUsageLimit returns the usage limit and refresh interval for a user+feature.
func (e *Engine) GetUsageLimit(ctx context.Context, userID, tierName, featureName string) (limit int, refresh string, err error) {
	ent, ok := e.GetEntitlement(tierName, featureName)
	if !ok {
		return 0, "", fmt.Errorf("no entitlement for %s/%s", tierName, featureName)
	}

	// Check per-user override
	override, err := e.repo.GetUserOverride(ctx, userID, featureName)
	if err == nil && override != nil && override.OverrideLimitValue != nil {
		return *override.OverrideLimitValue, ent.RefreshInterval, nil
	}

	if ent.LimitValue == nil {
		return -1, ent.RefreshInterval, nil // -1 = unlimited
	}
	return *ent.LimitValue, ent.RefreshInterval, nil
}

// CheckQuota checks if the user has remaining quota for a feature.
// Returns (allowed, remaining, limit, error).
func (e *Engine) CheckQuota(ctx context.Context, userID, tierName, featureName string) (bool, int, int, error) {
	limit, _, err := e.GetUsageLimit(ctx, userID, tierName, featureName)
	if err != nil {
		return false, 0, 0, err
	}
	// Unlimited
	if limit == -1 {
		return true, -1, -1, nil
	}

	current, err := e.GetUsage(ctx, userID, featureName)
	if err != nil {
		return false, 0, limit, err
	}

	remaining := limit - current
	if remaining <= 0 {
		return false, 0, limit, nil
	}
	return true, remaining, limit, nil
}

// ─── Upgrade Recommendations ───────────────────────────────

// EvaluateUpgrade checks if a user would benefit from upgrading.
func (e *Engine) EvaluateUpgrade(ctx context.Context, userID, currentTier string) (*UpgradeRecommendation, error) {
	tierNames := []string{"free", "pro", "max"}
	currentIdx := -1
	for i, t := range tierNames {
		if t == currentTier {
			currentIdx = i
			break
		}
	}
	if currentIdx < 0 || currentIdx >= len(tierNames)-1 {
		return nil, nil
	}

	nextTier := tierNames[currentIdx+1]
	hittingLimits := make([]FeatureLimit, 0)

	allFeatures := e.GetAllFeatures()
	for _, feat := range allFeatures {
		ent, ok := e.GetEntitlement(currentTier, feat.Name)
		if !ok || !ent.Enabled || ent.LimitValue == nil || *ent.LimitValue <= 0 {
			continue
		}

		current, err := e.GetUsage(ctx, userID, feat.Name)
		if err != nil {
			continue
		}

		usagePct := float64(current) / float64(*ent.LimitValue) * 100
		hittingLimits = append(hittingLimits, FeatureLimit{
			FeatureName:     feat.Name,
			FeatureDisplay:  feat.DisplayName,
			CurrentUsage:    current,
			LimitValue:      *ent.LimitValue,
			UsagePercentage: usagePct,
			IsAtLimit:       current >= *ent.LimitValue,
		})
	}

	// Count features that will be unlocked
	unlockedCount := 0
	unlockedFeatures := make([]string, 0)
	for _, feat := range allFeatures {
		curEnt, ok := e.GetEntitlement(currentTier, feat.Name)
		if ok && curEnt.Enabled {
			continue
		}
		nextEnt, ok := e.GetEntitlement(nextTier, feat.Name)
		if ok && nextEnt.Enabled {
			unlockedCount++
			unlockedFeatures = append(unlockedFeatures, feat.DisplayName)
		}
	}

	if len(hittingLimits) == 0 && unlockedCount == 0 {
		return nil, nil
	}

	return &UpgradeRecommendation{
		CurrentTier:      currentTier,
		RecommendedTier:  nextTier,
		FeaturesAtLimit:  hittingLimits,
		UnlockedFeatures: unlockedFeatures,
		UnlockCount:      unlockedCount,
		Urgency:          evaluateUrgency(hittingLimits),
	}, nil
}

func evaluateUrgency(limits []FeatureLimit) string {
	for _, l := range limits {
		if l.IsAtLimit {
			return "high"
		}
		if l.UsagePercentage >= 80 {
			return "medium"
		}
	}
	return "low"
}

// hash provides a deterministic hash for rollout percentage evaluation.
func hash(s string) int {
	h := 0
	for _, c := range s {
		h = h*31 + int(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}
