-- 011_create_billing_lifecycle.sql
-- Adds full billing lifecycle tracking to the users table

-- Subscription state columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
-- Values: inactive | active | trial | past_due | cancelled | paused | expired

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
-- Razorpay subscription ID (sub_xxxxx)

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_item_id VARCHAR(255);
-- Razorpay subscription item ID

ALTER TABLE users ADD COLUMN IF NOT EXISTS variant_id VARCHAR(255);
-- Razorpay plan variant ID that determines the plan

ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
-- Values: monthly | yearly

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100) DEFAULT 'Blue Sapphire';
-- Human-readable plan name: Blue Sapphire | Emerald | Diamond

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_starts_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
-- True if user requested cancellation at end of current billing period

ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ;
-- When the next billing cycle renewal is due

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_status VARCHAR(50);
-- Values: success | failed | refunded | pending

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

ALTER TABLE users ADD COLUMN IF NOT EXISTS variant_slug VARCHAR(100);
-- The plan slug for routing: 'blue-sapphire' | 'emerald' | 'diamond'

-- Indexes for subscription lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users (subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users (subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_renews_at ON users (renews_at) WHERE renews_at IS NOT NULL;

-- Enhanced webhook_events: add payload storage for replay capability
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for webhook replay lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_name ON webhook_events (event_name, processed_at DESC);
