# ml-service/services/revenue_forecaster.py
"""Revenue Forecasting — revenue prediction with growth and seasonality analysis."""

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
    Explanation, ForecastPoint, ForecastSummary, RiskAssessment,
    RevenueRequest, RevenueResponse,
)

logger = logging.getLogger(__name__)


def compute_revenue_forecast(
    req: RevenueRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> RevenueResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    revenue = df[df["amount"] > 0]

    if revenue.empty:
        raise ValueError("No revenue transactions found")

    daily = revenue.groupby("date")["amount"].sum().sort_index()
    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    series = daily.values.astype(float)

    if len(series) < 14:
        raise ValueError(f"Need at least 14 days of revenue data, got {len(series)}")

    try:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        predictions = fitted.forecast(req.horizon_days)
    except Exception:
        avg = float(np.mean(series[-30:]))
        predictions = np.full(req.horizon_days, avg)

    last_date = daily.index.max()
    forecast_points = []
    for i in range(req.horizon_days):
        d = last_date + timedelta(days=i + 1)
        pred = float(predictions[i])
        recent_std = float(np.std(series[-30:])) if len(series) >= 30 else float(np.std(series))
        margin = 1.5 * recent_std
        forecast_points.append(ForecastPoint(
            date=d.strftime("%Y-%m-%d"),
            predicted=round(pred, 2),
            lower=round(pred - margin, 2),
            upper=round(pred + margin, 2),
        ))

    expected_revenue = round(float(np.sum(predictions)), 2)
    recent_mean = float(np.mean(series[-30:])) if len(series) >= 30 else float(np.mean(series))
    forecast_mean = float(np.mean(predictions))
    if recent_mean != 0:
        pct_change = (forecast_mean - recent_mean) / abs(recent_mean)
    else:
        pct_change = 0
    trend = "improving" if pct_change > 0.05 else "declining" if pct_change < -0.05 else "stable"

    num_days = len(series)
    confidence = "low" if num_days < 30 else "medium" if num_days <= 90 else "high"
    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    recent_std = float(np.std(series[-30:])) if len(series) >= 30 else float(np.std(series))
    variance_penalty = min(0.3, recent_std / (abs(recent_mean) + recent_std + 1e-9))
    confidence_score = round(max(0.05, min(0.98, base - variance_penalty)), 3)

    seasonality_detected = False
    if len(series) >= 28:
        for period in [7, 14, 30]:
            if len(series) >= period * 2:
                autocorr = np.corrcoef(series[:-period], series[period:])[0, 1]
                if abs(autocorr) > 0.3:
                    seasonality_detected = True
                    break

    yoy_growth = 0.0
    if len(series) >= 365:
        first_year = float(np.sum(series[:365]))
        last_year = float(np.sum(series[-365:]))
        if first_year > 0:
            yoy_growth = (last_year - first_year) / first_year

    summary = ForecastSummary(
        expected_net=expected_revenue, trend=trend,
        confidence=confidence, confidence_score=confidence_score,
    )

    risk = risk_engine.compute_forecast_risk(predictions, series,
        [(p.lower, p.upper) for p in forecast_points])

    recs = recommendations_engine.generate_forecast_recommendations(
        predictions.tolist(), trend, confidence, confidence_score, risk.risk_level,
    )

    explanations = explainability.explain_timeseries(predictions, series, "revenue")

    record = PredictionRecord(
        feature_name="revenue_forecast",
        model_used="exponential_smoothing",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"expected_revenue": expected_revenue, "trend": trend},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return RevenueResponse(
        forecast=forecast_points,
        summary=summary,
        yoy_growth=round(yoy_growth, 4),
        seasonality_detected=seasonality_detected,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["exponential_smoothing"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="exponential_smoothing",
    )
