-- 010_create_business_config.sql
-- Fully configurable business logic: limits, thresholds, model routing, feature flags.
-- No hardcoded business logic anywhere — everything reads from here.

CREATE TABLE IF NOT EXISTS business_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(100) NOT NULL,        -- 'limits' | 'routing' | 'features' | 'pricing' | 'thresholds'
    key             VARCHAR(200) NOT NULL,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      VARCHAR(100) DEFAULT 'system',
    UNIQUE(category, key)
);

-- Seed default configuration
INSERT INTO business_config (category, key, value, description) VALUES
-- Plan limits (soft = warn, hard = block after N retries)
('limits', 'free.transactions.max', '{"soft":200,"hard":250,"warn_at_pct":80}', 'Free plan transaction limit'),
('limits', 'free.ai_chat.daily', '{"soft":2,"hard":3,"warn_at_pct":67}', 'Free plan daily AI chat queries'),
('limits', 'free.forecast.daily', '{"soft":0,"hard":0,"warn_at_pct":100}', 'Free plan forecast access (pro only)'),
('limits', 'free.upload.size_mb', '{"soft":10,"hard":20,"warn_at_pct":50}', 'Free plan upload size limit'),
('limits', 'pro.transactions.max', '{"soft":-1,"hard":-1}', 'Pro plan: unlimited (-1)'),
('limits', 'pro.ai_chat.daily', '{"soft":-1,"hard":-1}', 'Pro plan: unlimited AI chat'),
('limits', 'pro.forecast.daily', '{"soft":-1,"hard":-1}', 'Pro plan: unlimited forecast'),

-- LLM routing: which model to use per plan and feature
('routing', 'ai_chat.model.free', '{"provider":"local","model":"deterministic_kb","cost_per_1k":0}', 'Free plan: deterministic knowledge base'),
('routing', 'ai_chat.model.pro', '{"provider":"openai","model":"gpt-4o-mini","cost_per_1k":0.00015}', 'Pro plan: OpenAI routing'),
('routing', 'ai_chat.model.max', '{"provider":"multi","models":["gemini-1.5-flash","claude-3-5-haiku","gpt-4o-mini"],"fallback":true,"cost_per_1k":0.00035}', 'Max plan: multi-model with fallback'),
('routing', 'classify.model', '{"provider":"local","model":"scikit-nb","cost_per_1k":0}', 'Classification: always local'),
('routing', 'forecast.model', '{"provider":"local","model":"statsmodels","cost_per_1k":0}', 'Forecast: always local'),

-- Feature flags
('features', 'forecast.enabled', '{"value":true,"plans":["pro","max"]}', 'Forecast feature toggle'),
('features', 'ai_chat.enabled', '{"value":true,"plans":["free","pro","max"]}', 'AI Chat feature toggle'),
('features', 'recommendations.enabled', '{"value":true,"plans":["free","pro","max"]}', 'Recommendations feature toggle'),
('features', 'anomaly_detection.enabled', '{"value":true,"plans":["pro","max"]}', 'Anomaly detection feature toggle'),
('features', 'export.enabled', '{"value":true,"plans":["pro","max"]}', 'Data export feature toggle'),

-- Thresholds for automated recommendations
('thresholds', 'churn_risk.daily_active_decline_pct', '{"value":30,"window_days":7}', 'Churn risk: decline in daily active usage'),
('thresholds', 'upgrade_prompt.usage_pct_trigger', '{"value":80}', 'Show upgrade prompt when usage exceeds this %'),
('thresholds', 'model_switch.cost_savings_threshold', '{"value":0.20}', 'Switch model when savings exceed 20%'),
('thresholds', 'forecast_accuracy.retrain_trigger', '{"value":0.70}', 'Retrain when accuracy drops below this')
ON CONFLICT (category, key) DO NOTHING;
