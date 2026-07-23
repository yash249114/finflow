# ml-service/routes/intelligence.py
"""Routes for all financial intelligence features."""

import logging
from fastapi import APIRouter, HTTPException

from core.config import Tier, get_active_tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    BusinessHealthRequest, BusinessHealthResponse,
    CashFlowRequest, CashFlowResponse,
    ExpenseAnomalyRequest, ExpenseAnomalyResponse,
    ExpenseRequest, ExpenseForecastResponse,
    ExecutiveReportRequest, ExecutiveReportResponse,
    FraudDetectionResponse, FraudRequest,
    InventoryRequest, InventoryForecastResponse,
    InvoiceRequest, InvoiceIntelligenceResponse,
    KPIRequest, KPIResponse,
    RunwayRequest, RunwayResponse,
    ScenarioRequest, ScenarioResponse,
    SeasonalityRequest, SeasonalityResponse,
    SubscriptionRequest, SubscriptionWasteResponse,
    VendorRequest, VendorAnalysisResponse,
    WorkingCapitalRequest, WorkingCapitalResponse,
    RiskDetectionRequest, RiskDetectionResponse,
    RevenueRequest, RevenueResponse,
    CustomerPaymentRequest, CustomerPaymentResponse,
    BudgetRequest, BudgetOptimizationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_explainability = ExplainabilityEngine()
_risk_engine = RiskScoringEngine()
_recommendations_engine = RecommendationEngine()
_history = PredictionHistory()


@router.post("/cash-flow", response_model=CashFlowResponse)
async def cash_flow(req: CashFlowRequest) -> CashFlowResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    config = get_tier_config(tier)
    if len(req.transactions) > config.features.max_input_rows:
        raise HTTPException(status_code=400, detail=f"Max {config.features.max_input_rows} transactions for {tier.value} tier")
    try:
        from services.cash_flow import compute_cash_flow
        return compute_cash_flow(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Cash flow computation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/expenses", response_model=ExpenseForecastResponse)
async def expense_forecast(req: ExpenseRequest) -> ExpenseForecastResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.expense_forecaster import compute_expense_forecast
        categorizer = None
        try:
            from services.categorizer import Categorizer
            categorizer = Categorizer()
        except Exception:
            pass
        return compute_expense_forecast(req, categorizer, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Expense forecast failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/runway", response_model=RunwayResponse)
async def runway(req: RunwayRequest) -> RunwayResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.runway import compute_runway
        return compute_runway(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Runway computation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/invoices", response_model=InvoiceIntelligenceResponse)
async def invoice_intelligence(req: InvoiceRequest) -> InvoiceIntelligenceResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.invoice_intelligence import compute_invoice_intelligence
        return compute_invoice_intelligence(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Invoice intelligence failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/vendors", response_model=VendorAnalysisResponse)
async def vendor_analysis(req: VendorRequest) -> VendorAnalysisResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.vendor_analyzer import compute_vendor_analysis
        return compute_vendor_analysis(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Vendor analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/fraud", response_model=FraudDetectionResponse)
async def fraud_detection(req: FraudRequest) -> FraudDetectionResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.fraud import detect_fraud
        return detect_fraud(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Fraud detection failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/subscriptions", response_model=SubscriptionWasteResponse)
async def subscription_waste(req: SubscriptionRequest) -> SubscriptionWasteResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.subscriptions import detect_subscription_waste
        return detect_subscription_waste(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Subscription waste detection failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/business-health", response_model=BusinessHealthResponse)
async def business_health(req: BusinessHealthRequest) -> BusinessHealthResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.business_health import compute_business_health
        return compute_business_health(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Business health failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/working-capital", response_model=WorkingCapitalResponse)
async def working_capital(req: WorkingCapitalRequest) -> WorkingCapitalResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.working_capital import compute_working_capital
        return compute_working_capital(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Working capital failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/risk", response_model=RiskDetectionResponse)
async def risk_detection(req: RiskDetectionRequest) -> RiskDetectionResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.risk_detector import detect_financial_risk
        return detect_financial_risk(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Risk detection failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/scenarios", response_model=ScenarioResponse)
async def scenario_simulation(req: ScenarioRequest) -> ScenarioResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.scenario_simulator import compute_scenario_simulation
        return compute_scenario_simulation(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Scenario simulation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/budget", response_model=BudgetOptimizationResponse)
async def budget_optimization(req: BudgetRequest) -> BudgetOptimizationResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.budget_optimizer import compute_budget_optimization
        return compute_budget_optimization(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Budget optimization failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/revenue", response_model=RevenueResponse)
async def revenue_forecast(req: RevenueRequest) -> RevenueResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.revenue_forecaster import compute_revenue_forecast
        return compute_revenue_forecast(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Revenue forecast failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/inventory", response_model=InventoryForecastResponse)
async def inventory_forecast(req: InventoryRequest) -> InventoryForecastResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.inventory_forecaster import forecast_inventory
        return forecast_inventory(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Inventory forecast failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/seasonality", response_model=SeasonalityResponse)
async def seasonality_detection(req: SeasonalityRequest) -> SeasonalityResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.seasonality_detector import detect_seasonality
        return detect_seasonality(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Seasonality detection failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/customer-payments", response_model=CustomerPaymentResponse)
async def customer_payments(req: CustomerPaymentRequest) -> CustomerPaymentResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.customer_payment_predictor import predict_customer_payments
        return predict_customer_payments(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Customer payment prediction failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/expense-anomalies", response_model=ExpenseAnomalyResponse)
async def expense_anomalies(req: ExpenseAnomalyRequest) -> ExpenseAnomalyResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.expense_anomaly_detector import detect_expense_anomalies
        return detect_expense_anomalies(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Expense anomaly detection failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/kpis", response_model=KPIResponse)
async def kpi_engine(req: KPIRequest) -> KPIResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.kpi_engine import compute_kpis
        return compute_kpis(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("KPI computation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.post("/executive-report", response_model=ExecutiveReportResponse)
async def executive_report(req: ExecutiveReportRequest) -> ExecutiveReportResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    try:
        from services.executive_reporter import generate_executive_report
        return generate_executive_report(req, _explainability, _risk_engine, _recommendations_engine, _history, tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Executive report failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Computation failed: {str(e)}")


@router.get("/prediction-history")
async def prediction_history(
    feature_name: str | None = None,
    model_used: str | None = None,
    tier: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    records = _history.get_history(feature_name, model_used, tier, limit, offset)
    return {
        "total": len(_history._records),
        "records": [r.to_dict() for r in records],
    }


@router.post("/prediction-history/feedback")
async def record_feedback(
    prediction_id: str,
    actual_value: str,
    feedback: str = "",
    score: float | None = None,
):
    success = _history.record_feedback(prediction_id, actual_value, feedback, score)
    if not success:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"status": "ok", "message": "Feedback recorded"}


@router.get("/prediction-stats")
async def prediction_stats(feature_name: str | None = None):
    return _history.get_stats(feature_name)
