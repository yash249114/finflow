package db

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// ConnectRedis connects to Redis with exponential backoff retry.
// Returns nil (with logged warning) if all retries fail, so callers
// can degrade gracefully instead of crashing at startup.
func ConnectRedis(ctx context.Context, redisURL string) (*redis.Client, error) {
	if redisURL == "" {
		return nil, fmt.Errorf("redis URL is empty")
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing Redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	backoff := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second}
	var lastErr error
	for i, d := range backoff {
		if i > 0 {
			log.Warn().Dur("backoff", d).Msg("Retrying Redis connection")
			select {
			case <-ctx.Done():
				client.Close()
				return nil, ctx.Err()
			case <-time.After(d):
			}
		}

		if err := client.Ping(ctx).Err(); err != nil {
			lastErr = err
			continue
		}
		return client, nil
	}

	client.Close()
	return nil, fmt.Errorf("connecting to Redis after %d retries: %w", len(backoff), lastErr)
}

// RedisHealth returns nil if Redis is reachable, or an error otherwise.
// Safely handles nil client (returns an error without panicking).
func RedisHealth(rdb *redis.Client) error {
	if rdb == nil {
		return fmt.Errorf("redis not configured")
	}
	return rdb.Ping(context.Background()).Err()
}
