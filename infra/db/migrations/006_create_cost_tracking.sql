-- 006_create_cost_tracking.sql
-- Tracks API and LLM costs per request for cost monitoring and optimization.

CREATE TABLE IF NOT EXISTS cost_tracking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    service         VARCHAR(50) NOT NULL,         -- 'openai' | 'anthropic' | 'gemini' | 'ml-local' | 'supabase' | 'lemonsqueezy'
    operation       VARCHAR(100) NOT NULL,        -- 'classify' | 'forecast' | 'chat' | 'embeddings'
    model           VARCHAR(100),                 -- 'gpt-4o-mini' | 'claude-3-5-haiku' | 'gemini-1.5-flash' etc.
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    latency_ms      NUMERIC(10,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'ok',     -- 'ok' | 'error' | 'timeout'
    plan            VARCHAR(50),                  -- snapshot of user plan at time of call
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service ON cost_tracking (service, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created ON cost_tracking (created_at DESC);
