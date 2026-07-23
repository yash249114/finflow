# ml-service/services/working_capital.py
"""Working Capital Prediction — WC ratio, quick ratio, cash conversion cycle."""

from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, ForecastPoint, RiskAssessment,
    WorkingCapitalRequest, WorkingCapitalResponse,
)

logger = logging.getLogger(__name__)


def compute_working_capital(
    req: WorkingCapitalRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> WorkingCapitalResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().sort_index()
    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    series = daily.values.astype(float)

    current_assets = req.current_balance if hasattr(req, "current_balance") else float(np.sum(series))
    current_liabilities = req.accounts_payable
    inventory = req.inventory

    current_wc = current_assets - current_liabilities
    wc_ratio = current_assets / max(current_liabilities, 1)
    quick_ratio = (current_assets - inventory) / max(current_liabilities, 1)

    recent_income = series[series > 0]
    recent_expenses = abs(series[series < 0])
    avg_daily_revenue = float(np.mean(recent_income)) if len(recent_income) > 0 else 0
    avg_daily_cogs = float(np.mean(recent_expenses)) * 0.7 if len(recent_expenses) > 0 else 0

    dso = (req.accounts_receivable / max(avg_daily_revenue, 1)) if req.accounts_receivable > 0 else 30
    dio = (inventory / max(avg_daily_cogs, 1)) if inventory > 0 and avg_daily_cogs > 0 else 0
    dpo = (req.accounts_payable / max(avg_daily_cogs, 1)) if req.accounts_payable > 0 and avg_daily_cogs > 0 else 30
    ccc = dso + dio - dpo

    if len(series) < 14:
        raise ValueError(f"Need at least 14 days of data, got {len(series)}")

    try:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        forecast = fitted.forecast(req.horizon_days)
    except Exception:
        avg = float(np.mean(series[-30:]))
        forecast = np.full(req.horizon_days, avg)

    last_date = daily.index.max()
    forecast_points = []
    cumulative_wc = current_wc
    recent_std = float(np.std(series[-30:])) if len(series) >= 30 else float(np.std(series))

    for i in range(req.horizon_days):
        d = last_date + timedelta(days=i + 1)
        cumulative_wc += float(forecast[i])
        margin = 1.5 * recent_std
        forecast_points.append(ForecastPoint(
            date=d.strftime("%Y-%m-%d"),
            predicted=round(cumulative_wc, 2),
            lower=round(cumulative_wc - margin * (i + 1) / 30, 2),
            upper=round(cumulative_wc + margin * (i + 1) / 30, 2),
        ))

    projected_wc = float(forecast_points[-1].predicted) if forecast_points else current_wc

    confidence = "high" if len(series) >= 60 else "medium" if len(series) >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_forecast_risk(forecast, series)

    recs = []
    if wc_ratio < 1.0:
        recs.append("Working capital ratio below 1.0 — liquidity risk")
    if quick_ratio < 0.5:
        recs.append("Quick ratio below 0.5 — may struggle to meet short-term obligations")
    if ccc > 60:
        recs.append(f"Cash conversion cycle of {ccc:.0f} days — consider accelerating collections")
    if not recs:
        recs.append("Working capital position appears healthy")

    explanations = explainability.explain_timeseries(forecast, series, "working capital")

    record = PredictionRecord(
        feature_name="working_capital",
        model_used="exponential_smoothing",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"current_wc": current_wc, "projected_wc": projected_wc},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return WorkingCapitalResponse(
        current_working_capital=round(current_wc, 2),
        projected_working_capital=round(projected_wc, 2),
        working_capital_ratio=round(wc_ratio, 4),
        quick_ratio=round(quick_ratio, 4),
        cash_conversion_cycle=round(ccc, 1),
        forecast_points=forecast_points,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["exponential_smoothing", "financial_ratios"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="exponential_smoothing",
    )
