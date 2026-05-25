// api/internal/db/transaction_repo.go
package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/finflow/api/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TransactionRepo handles all transaction-related database operations.
type TransactionRepo struct {
	pool *pgxpool.Pool
}

// NewTransactionRepo creates a new TransactionRepo.
func NewTransactionRepo(pool *pgxpool.Pool) *TransactionRepo {
	return &TransactionRepo{pool: pool}
}

// ParsedRow holds a single parsed CSV row ready for insertion.
type ParsedRow struct {
	Date        string
	Description string
	Amount      float64
	Category    *string
	Source      string
}

// BatchInsert inserts multiple transactions atomically using a DB transaction.
func (r *TransactionRepo) BatchInsert(ctx context.Context, userID string, rows []ParsedRow) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	inserted := 0
	for _, row := range rows {
		_, err := tx.Exec(ctx,
			`INSERT INTO transactions (user_id, date, description, amount, category, source)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			userID, row.Date, row.Description, row.Amount, row.Category, row.Source,
		)
		if err != nil {
			return 0, fmt.Errorf("inserting row (date=%s, desc=%s): %w", row.Date, row.Description, err)
		}
		inserted++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("committing batch insert: %w", err)
	}
	return inserted, nil
}

// List retrieves paginated transactions for a user with optional filters.
func (r *TransactionRepo) List(ctx context.Context, userID string, startDate, endDate, category string, page, limit int) ([]models.Transaction, int, error) {
	// Build WHERE clause dynamically
	conditions := []string{"user_id = $1"}
	args := []interface{}{userID}
	argIdx := 2

	if startDate != "" {
		conditions = append(conditions, fmt.Sprintf("date >= $%d", argIdx))
		args = append(args, startDate)
		argIdx++
	}
	if endDate != "" {
		conditions = append(conditions, fmt.Sprintf("date <= $%d", argIdx))
		args = append(args, endDate)
		argIdx++
	}
	if category != "" {
		conditions = append(conditions, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Get total count
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM transactions WHERE %s", where)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting transactions: %w", err)
	}

	// Get paginated rows
	offset := (page - 1) * limit
	dataQuery := fmt.Sprintf(
		`SELECT id, user_id, date::text, description, amount, category, source, created_at
		 FROM transactions WHERE %s
		 ORDER BY date DESC, created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying transactions: %w", err)
	}
	defer rows.Close()

	transactions, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (models.Transaction, error) {
		var t models.Transaction
		err := row.Scan(&t.ID, &t.UserID, &t.Date, &t.Description, &t.Amount,
			&t.Category, &t.Source, &t.CreatedAt)
		return t, err
	})
	if err != nil {
		return nil, 0, fmt.Errorf("scanning transactions: %w", err)
	}

	return transactions, total, nil
}

// GetSummary computes a cash flow summary for a user in a date range.
func (r *TransactionRepo) GetSummary(ctx context.Context, userID, startDate, endDate string) (*models.TransactionSummary, error) {
	// Net cash flow, total income, total expenses
	var netCashFlow, totalIncome, totalExpenses float64
	var txCount int

	err := r.pool.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(amount), 0),
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0),
			COUNT(*)
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date <= $3`,
		userID, startDate, endDate,
	).Scan(&netCashFlow, &totalIncome, &totalExpenses, &txCount)
	if err != nil {
		return nil, fmt.Errorf("computing transaction summary: %w", err)
	}

	// Category breakdown (expenses only — negative amounts)
	catRows, err := r.pool.Query(ctx,
		`SELECT COALESCE(category, 'Uncategorized'), SUM(amount)
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date <= $3 AND amount < 0
		 GROUP BY category
		 ORDER BY SUM(amount) ASC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return nil, fmt.Errorf("querying category breakdown: %w", err)
	}
	defer catRows.Close()

	var categories []models.CategorySummary
	for catRows.Next() {
		var cs models.CategorySummary
		if err := catRows.Scan(&cs.Category, &cs.Total); err != nil {
			return nil, fmt.Errorf("scanning category row: %w", err)
		}
		categories = append(categories, cs)
	}
	if err := catRows.Err(); err != nil {
		return nil, fmt.Errorf("iterating category rows: %w", err)
	}

	// Calculate percentages based on absolute total expenses
	absTotalExpenses := -totalExpenses // make positive for percentage calc
	if absTotalExpenses > 0 {
		for i := range categories {
			categories[i].Percentage = (-categories[i].Total / absTotalExpenses) * 100
		}
	}

	return &models.TransactionSummary{
		NetCashFlow:      netCashFlow,
		TotalIncome:      totalIncome,
		TotalExpenses:    totalExpenses,
		ByCategory:       categories,
		TransactionCount: txCount,
	}, nil
}

// GetForForecast retrieves the last N days of transactions for forecast computation.
func (r *TransactionRepo) GetForForecast(ctx context.Context, userID string, days int) ([]models.ForecastTransaction, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT date::text, amount FROM transactions
		 WHERE user_id = $1 AND date >= (SELECT COALESCE(MAX(date), CURRENT_DATE) FROM transactions WHERE user_id = $1) - $2::int
		 ORDER BY date ASC`,
		userID, days,
	)
	if err != nil {
		return nil, fmt.Errorf("querying forecast transactions: %w", err)
	}
	defer rows.Close()

	transactions, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (models.ForecastTransaction, error) {
		var ft models.ForecastTransaction
		err := row.Scan(&ft.Date, &ft.Amount)
		return ft, err
	})
	if err != nil {
		return nil, fmt.Errorf("scanning forecast transactions: %w", err)
	}

	return transactions, nil
}
