-- 008_create_upgrade_events.sql
-- Tracks upgrade prompts, conversions, and subscription funnel events.

CREATE TABLE IF NOT EXISTS upgrade_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,         -- 'prompt_shown' | 'prompt_clicked' | 'checkout_started' | 'checkout_completed' | 'checkout_abandoned' | 'downgrade'
    trigger_feature VARCHAR(100),                 -- which feature triggered the prompt
    trigger_reason  VARCHAR(200),                 -- 'limit_reached' | 'forecast_access' | 'ai_chat_limit' | 'manual'
    from_plan       VARCHAR(50) NOT NULL,
    to_plan         VARCHAR(50),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upgrade_events_user ON upgrade_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upgrade_events_type ON upgrade_events (event_type, created_at DESC);
