// FinFlow constants and configuration

// ─── Admin ───────────────────────────────────────────────
export const ADMIN_EMAIL = 'yaswanthrajmouli14@gmail.com'

// ─── Roles ───────────────────────────────────────────────
export type UserRole = 'user' | 'admin'

// ─── Plans ───────────────────────────────────────────────
export type PlanTier = 'free' | 'pro' | 'max'

export interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeature[]> = {
  free: [
    { text: '250 transactions', included: true },
    { text: 'CSV import & export', included: true },
    { text: 'ML categorization', included: true },
    { text: 'Anomaly detection', included: true },
    { text: 'Lightweight local AI', included: true },
    { text: 'Advanced forecasting', included: false },
    { text: 'Transformer intelligence', included: false },
    { text: 'AI copilot', included: false },
  ],
  pro: [
    { text: 'Unlimited transactions', included: true },
    { text: 'CSV import & export', included: true },
    { text: 'ML categorization', included: true },
    { text: 'Anomaly detection', included: true },
    { text: 'Advanced forecasting', included: true, highlight: true },
    { text: 'Transformer intelligence', included: true, highlight: true },
    { text: 'AI copilot', included: true, highlight: true },
    { text: 'Predictive alerts', included: true, highlight: true },
  ],
  max: [
    { text: 'Everything in Pro', included: true },
    { text: 'Gemini integration', included: true, highlight: true },
    { text: 'Multi-agent reasoning', included: true, highlight: true },
    { text: 'AI CFO assistant', included: true, highlight: true },
    { text: 'Strategic intelligence', included: true, highlight: true },
    { text: 'Enterprise workflows', included: true, highlight: true },
    { text: 'Priority support', included: true, highlight: true },
    { text: 'Custom integrations', included: true, highlight: true },
  ],
}

// ─── Navigation ──────────────────────────────────────────
export const PROTECTED_PATHS = [
  '/dashboard',
  '/transactions',
  '/forecast',
  '/copilot',
  '/settings',
  '/admin',
]

export const AUTH_PATHS = ['/login', '/register']

// ─── App Info ────────────────────────────────────────────
export const APP_NAME = 'FinFlow'
export const APP_DESCRIPTION = 'AI-native financial intelligence platform'
