# ml-service/services/cash_flow.py
"""Cash Flow Prediction — predicts future cash flow with income/expense breakdown."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    CashFlowPoint, CashFlowRequest, CashFlowResponse,
    Explanation, ForecastPoint, ForecastSummary, RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_cash_flow(
    req: CashFlowRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> CashFlowResponse:
    config = get_tier_config(tier)
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    df["is_income"] = df["amount"] > 0

    daily_income = df[df["is_income"]].groupby("date")["amount"].sum()
    daily_expense = df[~df["is_income"]].groupby("date")["amount"].sum()

    date_range = pd.date_range(start=df["date"].min(), end=df["date"].max(), freq="D")
    daily_income = daily_income.reindex(date_range, fill_value=0.0)
    daily_expense = daily_expense.reindex(date_range, fill_value=0.0)

    income_series = daily_income.values.astype(float)
    expense_series = daily_expense.values.astype(float)
    net_series = income_series - expense_series

    if len(net_series) < 14:
        raise ValueError(f"Need at least 14 days of data, got {len(net_series)}")

    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    def forecast_series(series: np.ndarray, horizon: int) -> tuple[np.ndarray, float]:
        try:
            model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
            fitted = model.fit(optimized=True)
            preds = fitted.forecast(horizon)
        except Exception:
            avg = float(np.mean(series[-30:])) if len(series) >= 30 else float(np.mean(series))
            preds = np.full(horizon, avg)
        return preds, float(np.std(series[-30:] if len(series) >= 30 else series))

    income_pred, income_std = forecast_series(income_series, req.horizon_days)
    expense_pred, expense_std = forecast_series(expense_series, req.horizon_days)
    net_pred = income_pred - expense_pred

    last_date = daily_income.index.max()
    cash_flow_points = []
    cumulative = float(np.sum(net_series))

    for i in range(req.horizon_days):
        d = last_date + timedelta(days=i + 1)
        inc = float(income_pred[i])
        exp = float(expense_pred[i])
        net = inc - exp
        cumulative += net
        margin = 1.5 * (income_std + expense_std)

        cash_flow_points.append(CashFlowPoint(
            date=d.strftime("%Y-%m-%d"),
            income=round(inc, 2),
            expenses=round(-exp, 2),
            net=round(net, 2),
            cumulative=round(cumulative, 2),
            lower=round(net - margin, 2),
            upper=round(net + margin, 2),
        ))

    recent_income_mean = float(np.mean(income_series[-30:])) if len(income_series) >= 30 else float(np.mean(income_series))
    forecast_income_mean = float(np.mean(income_pred))
    if recent_income_mean != 0:
        pct_change = (forecast_income_mean - recent_income_mean) / abs(recent_income_mean)
    else:
        pct_change = 0.0

    trend = "improving" if pct_change > 0.05 else "declining" if pct_change < -0.05 else "stable"
    expected_net = round(float(np.sum(net_pred)), 2)
    num_days = len(net_series)
    confidence = "low" if num_days < 30 else "medium" if num_days <= 90 else "high"
    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    recent_std = float(np.std(net_series[-30:]))
    variance_penalty = min(0.3, recent_std / (abs(float(np.mean(net_series[-30:]))) + recent_std + 1e-9))
    confidence_score = round(max(0.05, min(0.98, base - variance_penalty)), 3)

    summary = ForecastSummary(
        expected_net=expected_net, trend=trend, confidence=confidence,
        confidence_score=confidence_score,
    )

    explanations = explainability.explain_timeseries(
        net_pred, net_series, "net cash flow",
    )

    risk = risk_engine.compute_forecast_risk(
        net_pred, net_series,
        [(p.lower, p.upper) for p in cash_flow_points],
    )

    historical_stats = {
        "recent_avg": float(np.mean(net_series[-30:])) if len(net_series) >= 30 else float(np.mean(net_series)),
        "recent_std": recent_std,
    }
    recs = recommendations_engine.generate_forecast_recommendations(
        net_pred.tolist(), trend, confidence, confidence_score,
        risk.risk_level, historical_stats,
    )

    record = PredictionRecord(
        feature_name="cash_flow",
        model_used="exponential_smoothing",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"expected_net": expected_net, "trend": trend},
        explanation={"methods_used": explanations.get("methods_used", []), "reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return CashFlowResponse(
        cash_flow=cash_flow_points,
        summary=summary,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=explanations.get("methods_used", []),
            reasoning=explanations.get("reasoning", ""),
            key_factors=explanations.get("key_factors", []),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
            model_risk=risk.model_risk,
            data_risk=risk.data_risk,
            uncertainty_risk=risk.uncertainty_risk,
            domain_risk=risk.domain_risk,
            risk_factors=risk.risk_factors,
            mitigation_actions=risk.mitigation_actions,
        ),
        model_used="exponential_smoothing",
    )
