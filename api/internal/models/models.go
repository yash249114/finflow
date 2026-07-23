// api/internal/models/models.go
package models

import "time"

// ─── Users ────────────────────────────────────────────────

type User struct {
	ID                     string     `json:"id"`
	Email                  string     `json:"email"`
	FullName               string     `json:"full_name"`
	Plan                   string     `json:"plan"`
	LemonSqueezyCustomerID *string    `json:"lemonsqueezy_customer_id,omitempty"`
	SubscriptionStatus     *string    `json:"subscription_status,omitempty"`
	SubscriptionID         *string    `json:"subscription_id,omitempty"`
	SubscriptionItemID     *string    `json:"subscription_item_id,omitempty"`
	VariantID              *string    `json:"variant_id,omitempty"`
	BillingCycle           *string    `json:"billing_cycle,omitempty"`
	PlanName               *string    `json:"plan_name,omitempty"`
	TrialStartsAt          *time.Time `json:"trial_starts_at,omitempty"`
	TrialEndsAt            *time.Time `json:"trial_ends_at,omitempty"`
	CurrentPeriodStartsAt  *time.Time `json:"current_period_starts_at,omitempty"`
	CurrentPeriodEndsAt    *time.Time `json:"current_period_ends_at,omitempty"`
	CancelAtPeriodEnd      *bool      `json:"cancel_at_period_end,omitempty"`
	CancelledAt            *time.Time `json:"cancelled_at,omitempty"`
	RenewsAt               *time.Time `json:"renews_at,omitempty"`
	LastPaymentStatus      *string    `json:"last_payment_status,omitempty"`
	LastPaymentAt          *time.Time `json:"last_payment_at,omitempty"`
	CouponCode             *string    `json:"coupon_code,omitempty"`
	VariantSlug            *string    `json:"variant_slug,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Plan     string `json:"plan"`
}

// ─── Transactions ─────────────────────────────────────────

type Transaction struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Date        string    `json:"date"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	Category    *string   `json:"category"`
	Source      string    `json:"source"`
	CreatedAt   time.Time `json:"created_at"`
}

type UploadResult struct {
	Uploaded int           `json:"uploaded"`
	Failed   int           `json:"failed"`
	Errors   []UploadError `json:"errors"`
}

type UploadError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

type TransactionListResponse struct {
	Data       []Transaction `json:"data"`
	Pagination Pagination    `json:"pagination"`
}

type Pagination struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
	Total int `json:"total"`
}

// ─── Transaction Summary ──────────────────────────────────

type TransactionSummary struct {
	NetCashFlow      float64           `json:"net_cash_flow"`
	TotalIncome      float64           `json:"total_income"`
	TotalExpenses    float64           `json:"total_expenses"`
	ByCategory       []CategorySummary `json:"by_category"`
	TransactionCount int               `json:"transaction_count"`
}

type CategorySummary struct {
	Category   string  `json:"category"`
	Total      float64 `json:"total"`
	Percentage float64 `json:"percentage"`
}

// ─── Refresh Tokens ───────────────────────────────────────

type RefreshToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// ─── ML Service ───────────────────────────────────────────

type ClassifyRequest struct {
	Descriptions []string `json:"descriptions"`
}

type ClassifyResponse struct {
	Categories []string `json:"categories"`
}

type ForecastTransaction struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
}

type ForecastRequest struct {
	Transactions []ForecastTransaction `json:"transactions"`
	HorizonDays  int                   `json:"horizon_days"`
}

type ForecastPoint struct {
	Date      string  `json:"date"`
	Predicted float64 `json:"predicted"`
	Lower     float64 `json:"lower"`
	Upper     float64 `json:"upper"`
}

type ForecastSummary struct {
	ExpectedNet     float64 `json:"expected_net"`
	Trend           string  `json:"trend"`
	Confidence      string  `json:"confidence"`
	ConfidenceScore float64 `json:"confidence_score"`
}

type ForecastResponse struct {
	Forecast []ForecastPoint `json:"forecast"`
	Summary  ForecastSummary `json:"summary"`
}

// ─── Billing ──────────────────────────────────────────────

type CheckoutResponse struct {
	CheckoutURL string `json:"checkout_url"`
}

type PortalResponse struct {
	PortalURL string `json:"portal_url"`
}
