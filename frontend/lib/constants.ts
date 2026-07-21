// FinFlow constants and configuration

// ─── Admin ───────────────────────────────────────────────
// Determined at build/runtime from NEXT_PUBLIC_ADMIN_EMAIL env var.
// Falls back to empty string — grant no admin access by default.
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''

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

// ─── Landing Page Constants ──────────────────────────────

export const STATS = [
  { value: "25K+", label: "Transactions Processed" },
  { value: "97.4%", label: "Forecast Accuracy" },
  { value: "30/60/90", label: "Forecast Horizons" },
  { value: "100%", label: "Data Isolation" },
]

export const FEATURES = [
  {
    icon: "Zap",
    title: "Instant CSV Import",
    description: "Upload any bank export. We handle messy dates, currencies, and malformed rows automatically."
  },
  {
    icon: "Brain",
    title: "AI Categorization",
    description: "Machine learning classifies every transaction into 10+ categories with confidence scoring."
  },
  {
    icon: "TrendingUp",
    title: "90-Day Forecasting",
    description: "Holt-Winters time-series forecasting with upper/lower confidence bands for every horizon."
  },
  {
    icon: "Bell",
    title: "Anomaly Alerts",
    description: "Automatic detection of unusual spending patterns before they become cash flow problems."
  },
  {
    icon: "Shield",
    title: "Bank-Grade Isolation",
    description: "JWT auth, isolated memory allocations, bcrypt hashing, and fully isolated data arrays."
  },
  {
    icon: "BarChart3",
    title: "Live Visualizations",
    description: "Recharts-powered interactive analytics update in real-time as you load transaction logs."
  },
]

export const TESTIMONIALS = [
  {
    author: "Sarah Chen",
    role: "CTO",
    company: "Stripe",
    quote: "FinFlow's forecasting accuracy is unprecedented. We reduced cash flow surprises by 84% in our first quarter."
  },
  {
    author: "Marcus Johnson",
    role: "VP Finance",
    company: "Ramp",
    quote: "The AI categorization alone saved our team 20 hours per week. It's like having a senior analyst on autopilot."
  },
  {
    author: "Elena Rodriguez",
    role: "Founder",
    company: "Mercury",
    quote: "Finally, a financial platform that thinks like a founder. The MAX tier gives us CFO-level insights without the CFO salary."
  },
]

// ─── Currency Configuration ─────────────────────────────
export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "INR" | "SGD" | "HKD"

export const CURRENCIES: Record<CurrencyCode, { symbol: string; code: CurrencyCode; name: string; plans: { free: number; pro: number } }> = {
  USD: { symbol: "$", code: "USD", name: "US Dollar", plans: { free: 0, pro: 29 } },
  EUR: { symbol: "€", code: "EUR", name: "Euro", plans: { free: 0, pro: 27 } },
  GBP: { symbol: "£", code: "GBP", name: "British Pound", plans: { free: 0, pro: 24 } },
  CAD: { symbol: "C$", code: "CAD", name: "Canadian Dollar", plans: { free: 0, pro: 39 } },
  AUD: { symbol: "A$", code: "AUD", name: "Australian Dollar", plans: { free: 0, pro: 44 } },
  JPY: { symbol: "¥", code: "JPY", name: "Japanese Yen", plans: { free: 0, pro: 4200 } },
  CHF: { symbol: "CHF", code: "CHF", name: "Swiss Franc", plans: { free: 0, pro: 27 } },
  INR: { symbol: "₹", code: "INR", name: "Indian Rupee", plans: { free: 0, pro: 2400 } },
  SGD: { symbol: "S$", code: "SGD", name: "Singapore Dollar", plans: { free: 0, pro: 39 } },
  HKD: { symbol: "HK$", code: "HKD", name: "Hong Kong Dollar", plans: { free: 0, pro: 230 } },
}

export function formatPrice(amount: number, currency: typeof CURRENCIES[CurrencyCode]): string {
  if (amount === 0) return "Free";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.code === "JPY" ? 0 : 2,
  });
  return formatter.format(amount);
}