-- 005_create_entitlements.sql
-- AI Product Layer: Feature Flags, Tiers, Entitlements, Usage Tracking

-- ─── Tiers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tiers (
    name        VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Features Catalog ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS features (
    name         VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(200) NOT NULL,
    description  TEXT,
    category     VARCHAR(50) NOT NULL
                 CHECK (category IN ('ai','data','automation','reporting','integration','insights')),
    is_beta      BOOLEAN NOT NULL DEFAULT FALSE,
    is_internal  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Feature Entitlements per Tier ─────────────────────────
CREATE TABLE IF NOT EXISTS feature_entitlements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name     VARCHAR(100) NOT NULL REFERENCES features(name) ON DELETE CASCADE,
    tier_name        VARCHAR(50) NOT NULL REFERENCES tiers(name) ON DELETE CASCADE,
    enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
    limit_value      INTEGER,          -- null = unlimited
    limit_unit       VARCHAR(20) NOT NULL DEFAULT 'count'
                     CHECK (limit_unit IN ('count','mb','minutes','requests')),
    refresh_interval VARCHAR(20) NOT NULL DEFAULT 'monthly'
                     CHECK (refresh_interval IN ('daily','weekly','monthly','yearly','none')),
    priority         INTEGER NOT NULL DEFAULT 0,
    max_batch_size   INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (feature_name, tier_name)
);

-- ─── Per-User Feature Overrides ────────────────────────────
CREATE TABLE IF NOT EXISTS user_feature_overrides (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_name         VARCHAR(100) NOT NULL REFERENCES features(name) ON DELETE CASCADE,
    enabled              BOOLEAN,             -- null = use tier default
    override_limit_value INTEGER,             -- null = use tier default
    override_until       TIMESTAMPTZ,         -- null = permanent
    created_by           UUID REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, feature_name)
);

-- ─── Usage Tracking (aggregated periods) ───────────────────
CREATE TABLE IF NOT EXISTS usage_tracking (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL REFERENCES features(name) ON DELETE CASCADE,
    usage_count  INTEGER NOT NULL DEFAULT 1,
    period_start TIMESTAMPTZ NOT NULL,
    period_end   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, feature_name, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_lookup
    ON usage_tracking (user_id, feature_name, period_start);

-- ─── Usage Audit Log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL REFERENCES features(name) ON DELETE CASCADE,
    usage_count  INTEGER NOT NULL DEFAULT 1,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_user_feature
    ON usage_log (user_id, feature_name, recorded_at);

-- ─── Seed Data: Tiers ──────────────────────────────────────
INSERT INTO tiers (name, display_name, description, sort_order) VALUES
    ('free', 'Blue Sapphire', 'Free tier — strong classical ML pipeline', 0),
    ('pro',  'Emerald',       'Professional tier — enhanced forecasting and AI', 1),
    ('max',  'Diamond',       'Ultimate tier — multi-provider AI, CFO, strategy', 2)
ON CONFLICT (name) DO NOTHING;

-- ─── Seed Data: Features ───────────────────────────────────
INSERT INTO features (name, display_name, description, category) VALUES
    ('transaction_classification', 'Transaction Categorization', 'AI-powered transaction categorization using ML', 'ai'),
    ('cash_flow_forecast', 'Cash Flow Forecasting', 'Forecast future cash flows using Holt-Winters', 'ai'),
    ('budget_suggestions', 'Budget Suggestions', 'AI-driven budget recommendations', 'ai'),
    ('financial_health_score', 'Financial Health Score', 'Overall financial health assessment', 'insights'),
    ('risk_detection', 'Risk Detection', 'Anomaly and risk detection in transactions', 'ai'),
    ('expense_intelligence', 'Expense Intelligence', 'Deep expense analysis and insights', 'insights'),
    ('business_kpis', 'Business KPIs', 'Key business performance indicators', 'insights'),
    ('recommendation_engine', 'Recommendation Engine', 'Proactive financial recommendations', 'ai'),
    ('weekly_reports', 'Weekly Reports', 'Automated weekly financial reports', 'reporting'),
    ('monthly_reports', 'Monthly Reports', 'Automated monthly financial reports', 'reporting'),
    ('basic_copilot', 'Basic AI Copilot', 'Rule-based AI assistant for financial questions', 'ai'),
    ('csv_analysis', 'CSV Analysis', 'CSV file analysis and insights', 'data'),
    ('dashboard_insights', 'Dashboard Insights', 'AI-powered insights on the dashboard', 'insights'),
    ('scenario_simulation', 'Scenario Simulations', 'What-if scenario simulations for financial planning', 'ai'),
    ('monte_carlo', 'Monte Carlo Analysis', 'Monte Carlo simulations for risk assessment', 'ai'),
    ('benchmarking', 'Benchmarking', 'Industry and peer benchmarking', 'insights'),
    ('advanced_copilot', 'Advanced AI Copilot', 'LLM-powered AI financial assistant', 'ai'),
    ('advanced_insights', 'Advanced Insights', 'Deep AI-driven financial insights', 'insights'),
    ('priority_execution', 'Priority Execution', 'Priority processing and execution', 'automation'),
    ('provider_routing', 'Provider Routing', 'Automatic AI provider routing (Gemini/Claude/OpenAI)', 'ai'),
    ('ai_cfo', 'AI CFO', 'AI Chief Financial Officer agent', 'ai'),
    ('ai_financial_advisor', 'AI Financial Advisor', 'Personalized AI financial advisory', 'ai'),
    ('ai_strategy', 'AI Strategy', 'Strategic financial planning with AI', 'ai'),
    ('ai_cash_flow_optimizer', 'AI Cash Flow Optimizer', 'AI-driven cash flow optimization', 'ai'),
    ('ai_pricing_advisor', 'AI Pricing Advisor', 'AI-powered pricing recommendations', 'ai'),
    ('ai_executive_reports', 'AI Executive Reports', 'AI-generated executive financial reports', 'reporting'),
    ('voice_ai', 'Voice AI', 'Voice interface for financial queries', 'ai'),
    ('nlp_financial_analysis', 'NLP Financial Analysis', 'Natural language financial data analysis', 'ai')
ON CONFLICT (name) DO NOTHING;

-- ─── Seed Data: Feature Entitlements ───────────────────────
-- Blue Sapphire (free): strong classical ML, limited automation, basic insights
INSERT INTO feature_entitlements (feature_name, tier_name, enabled, limit_value, refresh_interval, priority) VALUES
    ('transaction_classification', 'free', TRUE,  NULL, 'none',     100),
    ('cash_flow_forecast',         'free', TRUE,  30,   'monthly',  90),
    ('budget_suggestions',         'free', TRUE,  NULL, 'none',     80),
    ('financial_health_score',     'free', TRUE,  NULL, 'none',     70),
    ('risk_detection',             'free', TRUE,  NULL, 'none',     60),
    ('expense_intelligence',       'free', TRUE,  NULL, 'none',     50),
    ('business_kpis',              'free', TRUE,  NULL, 'none',     40),
    ('recommendation_engine',      'free', TRUE,  10,   'monthly',  30),
    ('weekly_reports',             'free', TRUE,  NULL, 'none',     20),
    ('monthly_reports',            'free', TRUE,  NULL, 'none',     10),
    ('basic_copilot',              'free', TRUE,  10,   'daily',     5),
    ('csv_analysis',               'free', TRUE,  NULL, 'none',      4),
    ('dashboard_insights',         'free', TRUE,  NULL, 'none',      3)
ON CONFLICT (feature_name, tier_name) DO NOTHING;

-- Emerald (pro): enhanced forecasting, simulations, priority execution
INSERT INTO feature_entitlements (feature_name, tier_name, enabled, limit_value, refresh_interval, priority, max_batch_size) VALUES
    ('transaction_classification', 'pro', TRUE,  NULL,  'none',     100, NULL),
    ('cash_flow_forecast',         'pro', TRUE,  500,   'monthly',  90,  NULL),
    ('budget_suggestions',         'pro', TRUE,  NULL,  'none',     80,  NULL),
    ('financial_health_score',     'pro', TRUE,  NULL,  'none',     70,  NULL),
    ('risk_detection',             'pro', TRUE,  NULL,  'none',     60,  NULL),
    ('expense_intelligence',       'pro', TRUE,  NULL,  'none',     50,  NULL),
    ('business_kpis',              'pro', TRUE,  NULL,  'none',     40,  NULL),
    ('recommendation_engine',      'pro', TRUE,  100,   'monthly',  30,  NULL),
    ('weekly_reports',             'pro', TRUE,  NULL,  'none',     20,  NULL),
    ('monthly_reports',            'pro', TRUE,  NULL,  'none',     10,  NULL),
    ('basic_copilot',              'pro', TRUE,  NULL,  'none',      9,  NULL),
    ('csv_analysis',               'pro', TRUE,  NULL,  'none',      8,  10000),
    ('dashboard_insights',         'pro', TRUE,  NULL,  'none',      7,  NULL),
    ('scenario_simulation',        'pro', TRUE,  50,    'monthly',   6,  NULL),
    ('monte_carlo',                'pro', TRUE,  20,    'monthly',   5,  NULL),
    ('benchmarking',               'pro', TRUE,  NULL,  'none',      4,  NULL),
    ('advanced_copilot',           'pro', TRUE,  NULL,  'none',      9,  NULL),
    ('advanced_insights',          'pro', TRUE,  NULL,  'none',      7,  NULL),
    ('priority_execution',         'pro', TRUE,  NULL,  'none',     10,  NULL)
ON CONFLICT (feature_name, tier_name) DO NOTHING;

-- Diamond (max): everything unlimited, multi-provider AI, executive features
INSERT INTO feature_entitlements (feature_name, tier_name, enabled, limit_value, refresh_interval, priority, max_batch_size) VALUES
    ('transaction_classification', 'max', TRUE,  NULL, 'none',     100, NULL),
    ('cash_flow_forecast',         'max', TRUE,  NULL, 'none',      90, NULL),
    ('budget_suggestions',         'max', TRUE,  NULL, 'none',      80, NULL),
    ('financial_health_score',     'max', TRUE,  NULL, 'none',      70, NULL),
    ('risk_detection',             'max', TRUE,  NULL, 'none',      60, NULL),
    ('expense_intelligence',       'max', TRUE,  NULL, 'none',      50, NULL),
    ('business_kpis',              'max', TRUE,  NULL, 'none',      40, NULL),
    ('recommendation_engine',      'max', TRUE,  NULL, 'none',      30, NULL),
    ('weekly_reports',             'max', TRUE,  NULL, 'none',      20, NULL),
    ('monthly_reports',            'max', TRUE,  NULL, 'none',      10, NULL),
    ('basic_copilot',              'max', TRUE,  NULL, 'none',       9, NULL),
    ('csv_analysis',               'max', TRUE,  NULL, 'none',       8, 50000),
    ('dashboard_insights',         'max', TRUE,  NULL, 'none',       7, NULL),
    ('scenario_simulation',        'max', TRUE,  NULL, 'none',       6, NULL),
    ('monte_carlo',                'max', TRUE,  NULL, 'none',       5, NULL),
    ('benchmarking',               'max', TRUE,  NULL, 'none',       4, NULL),
    ('advanced_copilot',           'max', TRUE,  NULL, 'none',       9, NULL),
    ('advanced_insights',          'max', TRUE,  NULL, 'none',       7, NULL),
    ('priority_execution',         'max', TRUE,  NULL, 'none',      10, NULL),
    ('provider_routing',           'max', TRUE,  NULL, 'none',       8, NULL),
    ('ai_cfo',                     'max', TRUE,  NULL, 'none',      10, NULL),
    ('ai_financial_advisor',       'max', TRUE,  NULL, 'none',      10, NULL),
    ('ai_strategy',                'max', TRUE,  NULL, 'none',      10, NULL),
    ('ai_cash_flow_optimizer',     'max', TRUE,  NULL, 'none',      10, NULL),
    ('ai_pricing_advisor',         'max', TRUE,  NULL, 'none',       9, NULL),
    ('ai_executive_reports',       'max', TRUE,  NULL, 'none',       8, NULL),
    ('voice_ai',                   'max', TRUE,  NULL, 'none',       7, NULL),
    ('nlp_financial_analysis',     'max', TRUE,  NULL, 'none',       7, NULL)
ON CONFLICT (feature_name, tier_name) DO NOTHING;
