// api/internal/analytics/config.go
package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ConfigValue is a parsed business configuration entry.
type ConfigValue struct {
	Category    string          `json:"category"`
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Description string          `json:"description"`
	UpdatedAt   time.Time       `json:"updated_at"`
	UpdatedBy   string          `json:"updated_by"`
}

// ConfigStore reads and writes business configuration.
type ConfigStore struct {
	pool *pgxpool.Pool
}

// NewConfigStore creates a config store.
func NewConfigStore(pool *pgxpool.Pool) *ConfigStore {
	return &ConfigStore{pool: pool}
}

// Get retrieves a config value by category and key.
func (s *ConfigStore) Get(ctx context.Context, category, key string) (*ConfigValue, error) {
	c := &ConfigValue{}
	err := s.pool.QueryRow(ctx,
		`SELECT category, key, value, description, updated_at, updated_by
		 FROM business_config WHERE category = $1 AND key = $2`,
		category, key,
	).Scan(&c.Category, &c.Key, &c.Value, &c.Description, &c.UpdatedAt, &c.UpdatedBy)
	if err != nil {
		return nil, fmt.Errorf("getting config %s/%s: %w", category, key, err)
	}
	return c, nil
}

// GetByCategory returns all config entries for a category.
func (s *ConfigStore) GetByCategory(ctx context.Context, category string) ([]ConfigValue, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT category, key, value, description, updated_at, updated_by
		 FROM business_config WHERE category = $1 ORDER BY key`,
		category,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ConfigValue
	for rows.Next() {
		c := ConfigValue{}
		if err := rows.Scan(&c.Category, &c.Key, &c.Value, &c.Description, &c.UpdatedAt, &c.UpdatedBy); err != nil {
			return nil, err
		}
		results = append(results, c)
	}
	return results, rows.Err()
}

// Set creates or updates a config value.
func (s *ConfigStore) Set(ctx context.Context, category, key string, value interface{}, updatedBy string) error {
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO business_config (category, key, value, updated_at, updated_by)
		 VALUES ($1, $2, $3, NOW(), $4)
		 ON CONFLICT (category, key)
		 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
		category, key, string(valueJSON), updatedBy,
	)
	return err
}

// GetLimitConfig retrieves a limit config for a plan and feature.
func (s *ConfigStore) GetLimitConfig(ctx context.Context, plan, feature string) (map[string]interface{}, error) {
	key := plan + "." + feature + ".max"
	cv, err := s.Get(ctx, "limits", key)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(cv.Value, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetRoutingConfig retrieves the LLM routing config for a feature and plan.
func (s *ConfigStore) GetRoutingConfig(ctx context.Context, feature, plan string) (map[string]interface{}, error) {
	key := feature + ".model." + plan
	cv, err := s.Get(ctx, "routing", key)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(cv.Value, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetFeatureFlag checks if a feature is enabled for a plan.
func (s *ConfigStore) GetFeatureFlag(ctx context.Context, featureName string) (bool, []string, error) {
	key := featureName + ".enabled"
	cv, err := s.Get(ctx, "features", key)
	if err != nil {
		return false, nil, err
	}
	var result struct {
		Value bool     `json:"value"`
		Plans []string `json:"plans"`
	}
	if err := json.Unmarshal(cv.Value, &result); err != nil {
		return false, nil, err
	}
	return result.Value, result.Plans, nil
}

// GetThreshold retrieves a threshold value.
func (s *ConfigStore) GetThreshold(ctx context.Context, key string) (float64, error) {
	cv, err := s.Get(ctx, "thresholds", key)
	if err != nil {
		return 0, err
	}
	var result struct {
		Value float64 `json:"value"`
	}
	if err := json.Unmarshal(cv.Value, &result); err != nil {
		return 0, err
	}
	return result.Value, nil
}

// GetAll returns all config entries grouped by category.
func (s *ConfigStore) GetAll(ctx context.Context) (map[string][]ConfigValue, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT category, key, value, description, updated_at, updated_by
		 FROM business_config ORDER BY category, key`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string][]ConfigValue)
	for rows.Next() {
		c := ConfigValue{}
		if err := rows.Scan(&c.Category, &c.Key, &c.Value, &c.Description, &c.UpdatedAt, &c.UpdatedBy); err != nil {
			return nil, err
		}
		result[c.Category] = append(result[c.Category], c)
	}
	return result, rows.Err()
}
