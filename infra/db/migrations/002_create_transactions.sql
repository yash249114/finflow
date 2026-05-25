-- 002_create_transactions.sql
-- Creates the transactions table for financial data

CREATE TABLE IF NOT EXISTS transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    description TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,  -- negative = expense, positive = income
    category    VARCHAR(100),
    source      VARCHAR(50) NOT NULL DEFAULT 'csv',  -- 'csv' | 'plaid' | 'manual'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for date-range queries scoped to a user
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);

-- Composite index for category filtering scoped to a user
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions (user_id, category);
