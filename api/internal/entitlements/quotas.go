package entitlements

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// QuotaRefresher periodically refreshes usage quotas.
type QuotaRefresher struct {
	engine   *Engine
	interval time.Duration
	stopCh   chan struct{}
}

// NewQuotaRefresher creates a new quota refresh worker.
func NewQuotaRefresher(engine *Engine, interval time.Duration) *QuotaRefresher {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &QuotaRefresher{
		engine:   engine,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic quota refresh loop.
func (qr *QuotaRefresher) Start(ctx context.Context) {
	log.Info().Dur("interval", qr.interval).Msg("Quota refresher started")
	ticker := time.NewTicker(qr.interval)
	defer ticker.Stop()

	qr.refresh(ctx)

	for {
		select {
		case <-ticker.C:
			qr.refresh(ctx)
		case <-qr.stopCh:
			log.Info().Msg("Quota refresher stopped")
			return
		}
	}
}

// Stop signals the refresher to stop.
func (qr *QuotaRefresher) Stop() {
	close(qr.stopCh)
}

func (qr *QuotaRefresher) refresh(ctx context.Context) {
	now := time.Now().UTC()

	if now.Hour() == 0 && now.Minute() < 5 {
		if err := qr.engine.repo.RefreshQuotas(ctx); err != nil {
			log.Warn().Err(err).Msg("Quota refresh failed")
		} else {
			log.Debug().Msg("Quotas refreshed")
		}
	}

	if err := qr.engine.repo.RefreshExpiries(ctx, qr.engine.rdb); err != nil {
		log.Warn().Err(err).Msg("Redis usage expiry refresh failed")
	}
}

// RefreshExpiries extends the TTL on all active Redis usage keys.
func (r *Repo) RefreshExpiries(ctx context.Context, rdb *redis.Client) error {
	if rdb == nil {
		return nil
	}
	var cursor uint64
	for {
		keys, nextCursor, err := rdb.Scan(ctx, cursor, "usage:*", 100).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			rdb.Expire(ctx, key, 72*time.Hour)
		}
		if nextCursor == 0 {
			break
		}
		cursor = nextCursor
	}
	return nil
}
