-- 009_create_retention_cohorts.sql
-- Tracks user activity for retention cohort analysis.

CREATE TABLE IF NOT EXISTS user_activity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date   DATE NOT NULL,
    features_used   TEXT[] DEFAULT '{}',           -- array of feature names used that day
    session_count   INTEGER DEFAULT 1,
    total_events    INTEGER DEFAULT 0,
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    UNIQUE(user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity (activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id, activity_date DESC);
