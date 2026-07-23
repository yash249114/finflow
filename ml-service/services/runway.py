# ml-service/services/runway.py
"""Runway Prediction — predicts how long the business can survive at current burn rate."""

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
    Explanation, ForecastPoint, ForecastSummary, RiskAssessment,
    RunwayRequest, RunwayResponse,
)

logger = logging.getLogger(__name__)


def compute_runway(
    req: RunwayRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> RunwayResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])

    daily = df.groupby("date")["amount"].sum().sort_index()
    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)

    series = daily.values.astype(float)
    num_days = len(series)

    if num_days < 14:
        raise ValueError(f"Need at least 14 days, got {num_days}")

    expenses = series[series < 0]
    incomes = series[series > 0]

    if len(expenses) > 0:
        recent_window = min(30, num_days)
        recent_expenses = series[-recent_window:]
        monthly_burn = abs(float(np.sum(recent_expenses[recent_expenses < 0]))) * (30 / recent_window)
    else:
        monthly_burn = abs(float(np.mean(series))) * 30

    if monthly_burn <= 0:
        monthly_burn = abs(float(np.mean(series))) * 30 if np.mean(series) < 0 else 1000

    daily_burn = monthly_burn / 30
    if daily_burn > 0:
        runway_days = req.current_balance / daily_burn
    else:
        runway_days = 999

    runway_date = (datetime.now() + timedelta(days=runway_days)).strftime("%Y-%m-%d")

    if num_days >= 14:
        early_burn = abs(float(np.mean(series[:num_days // 2][series[:num_days // 2] < 0]))) if np.any(series[:num_days // 2] < 0) else monthly_burn / 2
        late_burn = abs(float(np.mean(series[num_days // 2:][series[num_days // 2:] < 0]))) if np.any(series[num_days // 2:] < 0) else monthly_burn / 2
        if early_burn > 0:
            burn_change = (late_burn - early_burn) / early_burn
        else:
            burn_change = 0
        burn_trend = "increasing" if burn_change > 0.1 else "decreasing" if burn_change < -0.1 else "stable"
    else:
        burn_trend = "stable"

    avg_daily_income = float(np.mean(incomes)) if len(incomes) > 0 else 0
    avg_daily_expense = abs(float(np.mean(expenses))) if len(expenses) > 0 else 1
    break_even_days = req.current_balance / max(avg_daily_income - avg_daily_expense, 0.01) if avg_daily_income > avg_daily_expense else None
    break_even_point = (datetime.now() + timedelta(days=break_even_days)).strftime("%Y-%m-%d") if break_even_days and break_even_days < 3650 else "Not projected"

    survival_months = runway_days / 30

    confidence = "low" if num_days < 30 else "medium" if num_days <= 90 else "high"
    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    recent_std = float(np.std(series[-30:])) if num_days >= 30 else float(np.std(series))
    variance_penalty = min(0.3, recent_std / (abs(float(np.mean(series[-30:] if num_days >= 30 else series))) + recent_std + 1e-9))
    confidence_score = round(max(0.05, min(0.98, base - variance_penalty)), 3)

    trend = "declining" if burn_trend == "increasing" else "improving" if burn_trend == "decreasing" else "stable"

    explanations = explainability.explain_timeseries(
        np.array([runway_days, monthly_burn]), series, "runway",
    )

    risk = risk_engine.compute_forecast_risk(
        np.array([runway_days]), series,
    )

    recs = recommendations_engine.generate_runway_recommendations(
        runway_days, monthly_burn, req.current_balance, burn_trend,
    )

    record = PredictionRecord(
        feature_name="runway",
        model_used="runway_calculator",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"runway_days": runway_days, "monthly_burn": monthly_burn},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return RunwayResponse(
        runway_days=round(runway_days, 1),
        runway_date=runway_date,
        monthly_burn=round(monthly_burn, 2),
        burn_trend=burn_trend,
        break_even_point=break_even_point,
        survival_months=round(survival_months, 1),
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
            risk_factors=risk.risk_factors,
            mitigation_actions=risk.mitigation_actions,
        ),
        model_used="runway_calculator",
    )
