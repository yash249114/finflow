package entitlements

import (
	"context"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func testSetup() (*pgxpool.Pool, *redis.Client, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres:finflow_postgres_password_2024@localhost:5432/finflow"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://default:finflow_redis_password_2024@localhost:6379"
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		return nil, nil, err
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		pool.Close()
		return nil, nil, err
	}
	rdb := redis.NewClient(opts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		pool.Close()
		rdb.Close()
		return nil, nil, err
	}

	return pool, rdb, nil
}
