-- 004_create_webhook_events.sql
-- Creates the webhook_events table for webhook idempotency

CREATE TABLE IF NOT EXISTS webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name      VARCHAR(255) NOT NULL,
    event_id        VARCHAR(255) UNIQUE NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The UNIQUE constraint on event_id acts as the idempotency guard.
-- Before processing any webhook, we INSERT into this table.
-- If it conflicts, the event was already processed — skip it.
