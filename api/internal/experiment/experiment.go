// api/internal/experiment/experiment.go
package experiment

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Experiment is an A/B test configuration.
type Experiment struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	Status        string     `json:"status"` // draft | running | paused | completed
	Variants      []Variant  `json:"variants"`
	TargetFeature string     `json:"target_feature"`
	CreatedAt     time.Time  `json:"created_at"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	EndedAt       *time.Time `json:"ended_at,omitempty"`
}

// Variant is one branch of an experiment.
type Variant struct {
	Name   string `json:"name"`
	Weight int    `json:"weight"` // percentage weight 0-100
}

// Service manages experiments and A/B assignments.
type Service struct {
	pool *pgxpool.Pool
}

// NewService creates an experiment service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// Create registers a new experiment.
func (s *Service) Create(ctx context.Context, exp *Experiment) error {
	variantsJSON, _ := json.Marshal(exp.Variants)
	err := s.pool.QueryRow(ctx,
		`INSERT INTO experiments (id, name, description, status, variants, target_feature, created_at)
		 VALUES (gen_random_uuid(), $1, $2, 'draft', $3, $4, NOW())
		 RETURNING id, created_at`,
		exp.Name, exp.Description, string(variantsJSON), exp.TargetFeature,
	).Scan(&exp.ID, &exp.CreatedAt)
	return err
}

// Start activates an experiment.
func (s *Service) Start(ctx context.Context, experimentID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1 AND status = 'draft'`,
		experimentID,
	)
	return err
}

// Pause stops an experiment temporarily.
func (s *Service) Pause(ctx context.Context, experimentID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE experiments SET status = 'paused' WHERE id = $1 AND status = 'running'`,
		experimentID,
	)
	return err
}

// Complete finishes an experiment.
func (s *Service) Complete(ctx context.Context, experimentID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE experiments SET status = 'completed', ended_at = NOW() WHERE id = $1`,
		experimentID,
	)
	return err
}

// Assign determines a user's variant using deterministic hashing.
// This ensures the same user always gets the same variant for a given experiment.
func (s *Service) Assign(ctx context.Context, experimentID, userID string) (string, error) {
	// Check existing assignment
	var existing string
	err := s.pool.QueryRow(ctx,
		`SELECT variant FROM experiment_assignments WHERE experiment_id = $1 AND user_id = $2`,
		experimentID, userID,
	).Scan(&existing)
	if err == nil {
		return existing, nil
	}

	// Load experiment variants
	var variantsJSON string
	err = s.pool.QueryRow(ctx,
		`SELECT variants FROM experiments WHERE id = $1 AND status = 'running'`,
		experimentID,
	).Scan(&variantsJSON)
	if err != nil {
		return "", fmt.Errorf("experiment not found or not running")
	}

	var variants []Variant
	if err := json.Unmarshal([]byte(variantsJSON), &variants); err != nil {
		return "", fmt.Errorf("parsing variants: %w", err)
	}

	if len(variants) == 0 {
		return "", fmt.Errorf("no variants defined")
	}

	// Deterministic assignment via consistent hashing
	hash := sha256.Sum256([]byte(experimentID + ":" + userID))
	bucket := int(hash[0]) % 100

	cumulative := 0
	for _, v := range variants {
		cumulative += v.Weight
		if bucket < cumulative {
			// Insert assignment
			_, err = s.pool.Exec(ctx,
				`INSERT INTO experiment_assignments (experiment_id, user_id, variant, assigned_at)
				 VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
				experimentID, userID, v.Name,
			)
			if err != nil {
				return "", err
			}
			return v.Name, nil
		}
	}

	// Fallback to first variant
	return variants[0].Name, nil
}

// RecordEvent logs a metric event for an experiment.
func (s *Service) RecordEvent(ctx context.Context, experimentID, userID, variant, metricName string, metricValue float64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO experiment_events (experiment_id, user_id, variant, metric_name, metric_value, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		experimentID, userID, variant, metricName, metricValue,
	)
	return err
}

// VariantMetrics holds aggregated metrics for one variant.
type VariantMetrics struct {
	Variant        string             `json:"variant"`
	UserCount      int                `json:"user_count"`
	EventCount     int                `json:"event_count"`
	Metrics        map[string]float64 `json:"metrics"` // metric_name -> avg value
	ConversionRate float64            `json:"conversion_rate"`
}

// ExperimentResults holds the analysis of an experiment.
type ExperimentResults struct {
	ExperimentID string           `json:"experiment_id"`
	Status       string           `json:"status"`
	Variants     []VariantMetrics `json:"variants"`
	Winner       string           `json:"winner,omitempty"`
	Confidence   float64          `json:"confidence"`
	Significant  bool             `json:"significant"`
}

// GetResults computes the results for an experiment.
func (s *Service) GetResults(ctx context.Context, experimentID string) (*ExperimentResults, error) {
	exp := &ExperimentResults{ExperimentID: experimentID}

	if err := s.pool.QueryRow(ctx,
		`SELECT status FROM experiments WHERE id = $1`, experimentID,
	).Scan(&exp.Status); err != nil {
		return nil, fmt.Errorf("experiment not found: %w", err)
	}

	rows, err := s.pool.Query(ctx,
		`SELECT
			ee.variant,
			COUNT(DISTINCT ea.user_id) AS users,
			COUNT(ee.id) AS events
		 FROM experiment_assignments ea
		 LEFT JOIN experiment_events ee ON ee.experiment_id = ea.experiment_id AND ee.user_id = ea.user_id
		 WHERE ea.experiment_id = $1
		 GROUP BY ee.variant`, experimentID,
	)
	if err != nil {
		return exp, nil
	}
	defer rows.Close()

	for rows.Next() {
		var vm VariantMetrics
		vm.Metrics = make(map[string]float64)
		if err := rows.Scan(&vm.Variant, &vm.UserCount, &vm.EventCount); err != nil {
			continue
		}
		exp.Variants = append(exp.Variants, vm)
	}

	// Get per-metric averages
	metricRows, err := s.pool.Query(ctx,
		`SELECT variant, metric_name, AVG(metric_value) AS avg_val
		 FROM experiment_events
		 WHERE experiment_id = $1
		 GROUP BY variant, metric_name`, experimentID,
	)
	if err == nil {
		defer metricRows.Close()
		for metricRows.Next() {
			var variant, metricName string
			var avgVal float64
			if err := metricRows.Scan(&variant, &metricName, &avgVal); err == nil {
				for i := range exp.Variants {
					if exp.Variants[i].Variant == variant {
						exp.Variants[i].Metrics[metricName] = avgVal
					}
				}
			}
		}
	}

	// Simple winner determination: variant with highest conversion metric
	bestConversion := 0.0
	for i, v := range exp.Variants {
		if conv, ok := v.Metrics["conversion"]; ok {
			exp.Variants[i].ConversionRate = conv * 100
			if conv > bestConversion {
				bestConversion = conv
				exp.Winner = v.Variant
			}
		}
	}

	// Confidence estimation (simplified z-test)
	if len(exp.Variants) == 2 {
		exp.Confidence = estimateSignificance(exp.Variants[0], exp.Variants[1])
		exp.Significant = exp.Confidence > 0.95
	}

	return exp, nil
}

// estimateSignificance provides a simplified confidence estimate.
// In production, use a proper statistical test (chi-squared, t-test).
func estimateSignificance(a, b VariantMetrics) float64 {
	if a.UserCount < 30 || b.UserCount < 30 {
		return 0.5 // insufficient data
	}
	// Simplified: if difference is > 5% with sufficient sample, likely significant
	convA := a.Metrics["conversion"]
	convB := b.Metrics["conversion"]
	diff := convA - convB
	if diff < 0 {
		diff = -diff
	}

	if diff < 0.01 {
		return 0.6
	}
	if diff < 0.05 {
		return 0.85
	}
	if diff < 0.10 {
		return 0.95
	}
	return 0.99
}

// List returns all experiments.
func (s *Service) List(ctx context.Context, status string) ([]Experiment, error) {
	query := `SELECT id, name, description, status, variants, target_feature, created_at, started_at, ended_at FROM experiments`
	args := []interface{}{}
	if status != "" {
		query += ` WHERE status = $1`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var experiments []Experiment
	for rows.Next() {
		var exp Experiment
		var variantsJSON string
		if err := rows.Scan(&exp.ID, &exp.Name, &exp.Description, &exp.Status,
			&variantsJSON, &exp.TargetFeature, &exp.CreatedAt, &exp.StartedAt, &exp.EndedAt); err != nil {
			continue
		}
		json.Unmarshal([]byte(variantsJSON), &exp.Variants)
		experiments = append(experiments, exp)
	}
	return experiments, rows.Err()
}
