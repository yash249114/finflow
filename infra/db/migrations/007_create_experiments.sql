-- 007_create_experiments.sql
-- A/B experiment tracking: assignments, variants, and metrics.

CREATE TABLE IF NOT EXISTS experiments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) UNIQUE NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' | 'running' | 'paused' | 'completed'
    variants        JSONB NOT NULL DEFAULT '[]',           -- [{"name":"control","weight":50},{"name":"treatment","weight":50}]
    target_feature  VARCHAR(100),                          -- which feature this experiment affects
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant         VARCHAR(100) NOT NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(experiment_id, user_id)
);

CREATE TABLE IF NOT EXISTS experiment_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant         VARCHAR(100) NOT NULL,
    metric_name     VARCHAR(100) NOT NULL,       -- 'conversion' | 'upgrade' | 'retention' | 'latency' | 'cost'
    metric_value    NUMERIC(12,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_exp ON experiment_assignments (experiment_id, variant);
CREATE INDEX IF NOT EXISTS idx_experiment_events_exp ON experiment_events (experiment_id, variant, metric_name);
CREATE INDEX IF NOT EXISTS idx_experiment_events_created ON experiment_events (created_at DESC);
