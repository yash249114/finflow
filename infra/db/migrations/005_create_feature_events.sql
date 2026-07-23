-- 005_create_feature_events.sql
-- Tracks every AI feature usage event for adoption, accuracy, cost, and satisfaction analytics.

CREATE TABLE IF NOT EXISTS feature_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature         VARCHAR(100) NOT NULL,        -- 'classify' | 'forecast' | 'ai_chat' | 'recommendations' | 'upload'
    event_type      VARCHAR(50) NOT NULL,         -- 'usage' | 'accuracy' | 'cost' | 'error' | 'satisfaction' | 'limit_hit'
    value           NUMERIC(12,4) DEFAULT 0,      -- numeric value: latency_ms, cost_usd, accuracy_score, rating
    metadata        JSONB DEFAULT '{}',           -- flexible payload: model, provider, plan, latency, confidence, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_events_user_feature ON feature_events (user_id, feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_events_feature_type ON feature_events (feature, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_events_created ON feature_events (created_at DESC);
