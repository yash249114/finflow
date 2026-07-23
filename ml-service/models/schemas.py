# ml-service/models/schemas.py
"""Pydantic v2 schemas for all ML service request/response models.

Every prediction exposes: accuracy, confidence, explanation, recommendation, risk score.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict


# ─── Common Intelligence Fields ─────────────────────────────

class Explanation(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    methods_used: list[str] = Field(default_factory=list)
    feature_importance: dict[str, float] = Field(default_factory=dict)
    top_features: list[dict[str, float]] = Field(default_factory=list)
    reasoning: str = ""
    key_factors: list[str] = Field(default_factory=list)
    confidence_factors: list[str] = Field(default_factory=list)


class RiskAssessment(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    overall_risk: float = 0.0
    risk_level: str = "low"
    model_risk: float = 0.0
    data_risk: float = 0.0
    uncertainty_risk: float = 0.0
    domain_risk: float = 0.0
    risk_factors: list[str] = Field(default_factory=list)
    mitigation_actions: list[str] = Field(default_factory=list)


class IntelligenceResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    accuracy: float = 0.0
    confidence: float = 0.0
    confidence_score: float = 0.0
    explanation: Explanation = Field(default_factory=Explanation)
    recommendations: list[str] = Field(default_factory=list)
    risk: RiskAssessment = Field(default_factory=RiskAssessment)
    model_used: str = ""
    model_version: int = 0


# ─── Classification ────────────────────────────────────────

class ClassifyRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    descriptions: list[str] = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Transaction descriptions to classify (max 10,000)",
    )
    tier: str = Field(default="blue", description="User tier: blue, emerald, diamond")


class ClassifyResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    description: str = ""
    category: str = ""
    confidence: float = 0.0
    probabilities: dict[str, float] = Field(default_factory=dict)
    explanation: Explanation = Field(default_factory=Explanation)
    recommendations: list[str] = Field(default_factory=list)
    risk: RiskAssessment = Field(default_factory=RiskAssessment)


class ClassifyResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    categories: list[str] = Field(..., description="Predicted categories for each description")
    results: list[ClassifyResult] = Field(default_factory=list, description="Detailed results with explanations")
    accuracy: float = 0.0
    confidence_score: float = 0.0
    model_used: str = ""
    model_version: int = 0
    risk: RiskAssessment = Field(default_factory=RiskAssessment)
    recommendations: list[str] = Field(default_factory=list)


# ─── Forecasting ───────────────────────────────────────────

class ForecastTransaction(BaseModel):
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    amount: float = Field(..., description="Transaction amount (negative=expense, positive=income)")


class ForecastRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    horizon_days: int = Field(default=30, ge=7, le=365, description="Number of days to forecast")
    tier: str = Field(default="blue", description="User tier: blue, emerald, diamond")


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class ForecastSummary(BaseModel):
    expected_net: float
    trend: str
    confidence: str
    confidence_score: float = 0.0


class ForecastResponse(IntelligenceResponse):
    forecast: list[ForecastPoint] = Field(default_factory=list)
    summary: ForecastSummary = Field(default_factory=ForecastSummary)


# ─── Cash Flow Prediction ──────────────────────────────────

class CashFlowRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    horizon_days: int = Field(default=30, ge=7, le=365)
    tier: str = Field(default="blue")
    include_breakdown: bool = Field(default=True, description="Include income/expense breakdown")


class CashFlowPoint(BaseModel):
    date: str
    income: float = 0.0
    expenses: float = 0.0
    net: float = 0.0
    cumulative: float = 0.0
    lower: float = 0.0
    upper: float = 0.0


class CashFlowResponse(IntelligenceResponse):
    cash_flow: list[CashFlowPoint] = Field(default_factory=list)
    summary: ForecastSummary = Field(default_factory=ForecastSummary)


# ─── Expense Forecasting ───────────────────────────────────

class ExpenseRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    categories: list[str] = Field(default_factory=list, description="Filter to specific categories")
    horizon_days: int = Field(default=30, ge=7, le=365)
    tier: str = Field(default="blue")


class ExpenseCategoryForecast(BaseModel):
    category: str
    predicted: float
    lower: float
    upper: float
    trend: str = "stable"
    pct_of_total: float = 0.0


class ExpenseForecastResponse(IntelligenceResponse):
    category_forecasts: list[ExpenseCategoryForecast] = Field(default_factory=list)
    total_predicted_expenses: float = 0.0


# ─── Runway Prediction ─────────────────────────────────────

class RunwayRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    current_balance: float = Field(..., description="Current cash balance")
    monthly_fixed_costs: float = Field(default=0.0, ge=0)
    tier: str = Field(default="blue")


class RunwayResponse(IntelligenceResponse):
    runway_days: float = 0.0
    runway_date: str = ""
    monthly_burn: float = 0.0
    burn_trend: str = "stable"
    break_even_point: str = ""
    survival_months: float = 0.0


# ─── Invoice Intelligence ─────────────────────────────────

class InvoiceItem(BaseModel):
    invoice_id: str = ""
    amount: float = 0.0
    due_date: str = ""
    vendor: str = ""
    category: str = ""
    status: str = "pending"


class InvoiceRequest(BaseModel):
    invoices: list[InvoiceItem] = Field(..., min_length=1)
    transactions: list[ForecastTransaction] = Field(default_factory=list)
    tier: str = Field(default="blue")


class InvoiceInsight(BaseModel):
    invoice_id: str = ""
    payment_probability: float = 0.0
    expected_payment_date: str = ""
    risk_score: float = 0.0
    recommendation: str = ""


class InvoiceIntelligenceResponse(IntelligenceResponse):
    insights: list[InvoiceInsight] = Field(default_factory=list)
    total_pending: float = 0.0
    total_overdue: float = 0.0
    days_sales_outstanding: float = 0.0


# ─── Vendor Analysis ───────────────────────────────────────

class VendorTransaction(BaseModel):
    vendor: str = ""
    amount: float = 0.0
    date: str = ""
    category: str = ""


class VendorRequest(BaseModel):
    transactions: list[VendorTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")


class VendorProfile(BaseModel):
    name: str = ""
    total_spend: float = 0.0
    avg_transaction: float = 0.0
    transaction_count: int = 0
    trend: str = "stable"
    risk_score: float = 0.0
    recommendation: str = ""


class VendorAnalysisResponse(IntelligenceResponse):
    vendors: list[VendorProfile] = Field(default_factory=list)
    total_spend: float = 0.0
    top_vendor_concentration: float = 0.0


# ─── Fraud Detection ───────────────────────────────────────

class FraudRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    historical_transactions: list[ForecastTransaction] = Field(default_factory=list)
    tier: str = Field(default="blue")


class FraudAlert(BaseModel):
    transaction_index: int = 0
    amount: float = 0.0
    date: str = ""
    fraud_probability: float = 0.0
    risk_level: str = "low"
    anomaly_score: float = 0.0
    explanation: str = ""
    recommendation: str = ""


class FraudDetectionResponse(IntelligenceResponse):
    alerts: list[FraudAlert] = Field(default_factory=list)
    total_flagged: int = 0
    total_risk_amount: float = 0.0


# ─── Subscription Waste Detection ──────────────────────────

class SubscriptionItem(BaseModel):
    name: str = ""
    amount: float = 0.0
    frequency: str = "monthly"
    category: str = ""
    last_used: str = ""
    usage_count: int = 0


class SubscriptionRequest(BaseModel):
    subscriptions: list[SubscriptionItem] = Field(..., min_length=1)
    transactions: list[ForecastTransaction] = Field(default_factory=list)
    tier: str = Field(default="blue")


class SubscriptionInsight(BaseModel):
    name: str = ""
    monthly_cost: float = 0.0
    annual_cost: float = 0.0
    usage_score: float = 0.0
    waste_risk: float = 0.0
    recommendation: str = ""


class SubscriptionWasteResponse(IntelligenceResponse):
    insights: list[SubscriptionInsight] = Field(default_factory=list)
    total_monthly: float = 0.0
    total_annual: float = 0.0
    potential_savings: float = 0.0
    waste_score: float = 0.0


# ─── Business Health ───────────────────────────────────────

class BusinessHealthRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")
    industry: str = ""


class HealthMetric(BaseModel):
    name: str = ""
    value: float = 0.0
    benchmark: float = 0.0
    status: str = "ok"
    trend: str = "stable"


class BusinessHealthResponse(IntelligenceResponse):
    health_score: float = 0.0
    health_grade: str = ""
    metrics: list[HealthMetric] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)


# ─── Working Capital Prediction ────────────────────────────

class WorkingCapitalRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    accounts_receivable: float = Field(default=0.0, ge=0)
    accounts_payable: float = Field(default=0.0, ge=0)
    inventory: float = Field(default=0.0, ge=0)
    horizon_days: int = Field(default=30, ge=7, le=365)
    tier: str = Field(default="blue")


class WorkingCapitalResponse(IntelligenceResponse):
    current_working_capital: float = 0.0
    projected_working_capital: float = 0.0
    working_capital_ratio: float = 0.0
    quick_ratio: float = 0.0
    cash_conversion_cycle: float = 0.0
    forecast_points: list[ForecastPoint] = Field(default_factory=list)


# ─── Financial Risk Detection ──────────────────────────────

class RiskDetectionRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")
    risk_factors: list[str] = Field(default_factory=list)


class RiskIndicator(BaseModel):
    name: str = ""
    score: float = 0.0
    level: str = "low"
    description: str = ""
    trend: str = "stable"


class RiskDetectionResponse(IntelligenceResponse):
    overall_risk_score: float = 0.0
    risk_level: str = "low"
    indicators: list[RiskIndicator] = Field(default_factory=list)
    risk_events: list[str] = Field(default_factory=list)


# ─── Scenario Simulation ───────────────────────────────────

class ScenarioVariant(BaseModel):
    name: str = "base"
    revenue_change_pct: float = 0.0
    expense_change_pct: float = 0.0
    one_time_events: list[dict[str, float]] = Field(default_factory=list)


class ScenarioRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    scenarios: list[ScenarioVariant] = Field(default_factory=lambda: [ScenarioVariant()])
    horizon_days: int = Field(default=30, ge=7, le=365)
    tier: str = Field(default="blue")


class ScenarioResult(BaseModel):
    name: str = ""
    projected_balance: float = 0.0
    net_cash_flow: float = 0.0
    probability_of_success: float = 0.0
    risk_level: str = "low"
    recommendation: str = ""


class ScenarioResponse(IntelligenceResponse):
    scenarios: list[ScenarioResult] = Field(default_factory=list)
    best_scenario: str = ""
    worst_scenario: str = ""


# ─── Budget Optimization ───────────────────────────────────

class BudgetCategory(BaseModel):
    name: str = ""
    current_spend: float = 0.0
    budget: float = 0.0
    priority: str = "medium"


class BudgetRequest(BaseModel):
    categories: list[BudgetCategory] = Field(..., min_length=1)
    transactions: list[ForecastTransaction] = Field(default_factory=list)
    total_budget: float = Field(default=0.0, ge=0)
    tier: str = Field(default="blue")


class BudgetOptimization(BaseModel):
    category: str = ""
    current_spend: float = 0.0
    recommended_spend: float = 0.0
    savings: float = 0.0
    priority: str = "medium"
    reasoning: str = ""


class BudgetOptimizationResponse(IntelligenceResponse):
    optimizations: list[BudgetOptimization] = Field(default_factory=list)
    total_potential_savings: float = 0.0
    optimization_score: float = 0.0


# ─── Revenue Forecasting ───────────────────────────────────

class RevenueRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    horizon_days: int = Field(default=30, ge=7, le=365)
    tier: str = Field(default="blue")
    include_segments: bool = Field(default=False)


class RevenueResponse(IntelligenceResponse):
    forecast: list[ForecastPoint] = Field(default_factory=list)
    summary: ForecastSummary = Field(default_factory=ForecastSummary)
    yoy_growth: float = 0.0
    seasonality_detected: bool = False


# ─── Inventory Forecasting ─────────────────────────────────

class InventoryItem(BaseModel):
    name: str = ""
    sku: str = ""
    current_stock: int = 0
    daily_usage: float = 0.0
    lead_time_days: int = 7
    unit_cost: float = 0.0


class InventoryRequest(BaseModel):
    items: list[InventoryItem] = Field(..., min_length=1)
    tier: str = Field(default="blue")


class InventoryForecast(BaseModel):
    name: str = ""
    sku: str = ""
    days_until_stockout: float = 0.0
    reorder_point: int = 0
    reorder_quantity: int = 0
    stockout_risk: str = "low"
    recommendation: str = ""


class InventoryForecastResponse(IntelligenceResponse):
    forecasts: list[InventoryForecast] = Field(default_factory=list)
    total_inventory_value: float = 0.0
    items_at_risk: int = 0


# ─── Seasonality Detection ─────────────────────────────────

class SeasonalityRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")


class SeasonalPattern(BaseModel):
    period: str = ""
    strength: float = 0.0
    peak_period: str = ""
    low_period: str = ""
    description: str = ""


class SeasonalityResponse(IntelligenceResponse):
    patterns: list[SeasonalPattern] = Field(default_factory=list)
    overall_seasonality: float = 0.0
    is_seasonal: bool = False


# ─── Customer Payment Prediction ───────────────────────────

class CustomerPayment(BaseModel):
    customer: str = ""
    amount: float = 0.0
    due_date: str = ""
    invoice_date: str = ""
    historical_payment_days: list[int] = Field(default_factory=list)


class CustomerPaymentRequest(BaseModel):
    payments: list[CustomerPayment] = Field(..., min_length=1)
    tier: str = Field(default="blue")


class CustomerPaymentPrediction(BaseModel):
    customer: str = ""
    amount: float = 0.0
    expected_payment_date: str = ""
    payment_probability: float = 0.0
    days_late_risk: float = 0.0
    risk_level: str = "low"
    recommendation: str = ""


class CustomerPaymentResponse(IntelligenceResponse):
    predictions: list[CustomerPaymentPrediction] = Field(default_factory=list)
    total_expected: float = 0.0
    total_at_risk: float = 0.0
    avg_collection_days: float = 0.0


# ─── Expense Anomaly Detection ─────────────────────────────

class ExpenseAnomalyRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    sensitivity: float = Field(default=3.0, ge=1.0, le=5.0, description="Z-score threshold")
    tier: str = Field(default="blue")


class ExpenseAnomaly(BaseModel):
    index: int = 0
    amount: float = 0.0
    date: str = ""
    z_score: float = 0.0
    expected_range: tuple[float, float] = (0.0, 0.0)
    severity: str = "low"
    explanation: str = ""
    recommendation: str = ""


class ExpenseAnomalyResponse(IntelligenceResponse):
    anomalies: list[ExpenseAnomaly] = Field(default_factory=list)
    total_anomalies: int = 0
    anomaly_rate: float = 0.0
    total_anomaly_amount: float = 0.0


# ─── Financial KPI Engine ──────────────────────────────────

class KPIRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")
    period_days: int = Field(default=30, ge=7, le=365)


class KPI(BaseModel):
    name: str = ""
    value: float = 0.0
    unit: str = ""
    trend: str = "stable"
    benchmark: float = 0.0
    status: str = "ok"
    explanation: str = ""


class KPIResponse(IntelligenceResponse):
    kpis: list[KPI] = Field(default_factory=list)
    overall_score: float = 0.0
    score_grade: str = ""


# ─── Executive Reports ─────────────────────────────────────

class ExecutiveReportRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    tier: str = Field(default="blue")
    period_days: int = Field(default=30, ge=7, le=365)
    include_forecast: bool = Field(default=True)
    include_recommendations: bool = Field(default=True)


class ExecutiveReportSection(BaseModel):
    title: str = ""
    content: str = ""
    metrics: dict[str, float] = Field(default_factory=dict)
    alerts: list[str] = Field(default_factory=list)


class ExecutiveReportResponse(IntelligenceResponse):
    title: str = ""
    period: str = ""
    sections: list[ExecutiveReportSection] = Field(default_factory=list)
    summary: str = ""
    key_metrics: dict[str, float] = Field(default_factory=dict)
    action_items: list[str] = Field(default_factory=list)


# ─── Health ────────────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str = "ok"
    model_loaded: bool = False
    version: str = "2.0.0"
    features: list[str] = Field(default_factory=list)
    tiers: list[str] = Field(default_factory=lambda: ["blue", "emerald", "diamond"])
    models_registered: int = 0
    predictions_served: int = 0
