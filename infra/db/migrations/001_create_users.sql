-- 001_create_users.sql
-- Creates the users table for authentication and billing

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255),
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
    razorpay_customer_id VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Index for Razorpay customer lookups during webhook processing
CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer_id ON users (razorpay_customer_id);
