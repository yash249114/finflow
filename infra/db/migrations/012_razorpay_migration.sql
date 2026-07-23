-- 012_razorpay_migration.sql
-- Migrates from Lemon Squeezy to Razorpay billing

-- Rename LemonSqueezy customer ID column to Razorpay
ALTER TABLE users RENAME COLUMN lemonsqueezy_customer_id TO razorpay_customer_id;

-- Add Razorpay-specific columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255);

-- Drop old LemonSqueezy index and create Razorpay index
DROP INDEX IF EXISTS idx_users_lemonsqueezy_customer_id;
CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer_id ON users (razorpay_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_razorpay_order_id ON users (razorpay_order_id);
