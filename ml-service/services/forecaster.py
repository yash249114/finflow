# ml-service/services/forecaster.py
"""Cash flow forecasting using Exponential Smoothing — upgraded with core infrastructure."""

import logging
from datetime import timedelta

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, ForecastPoint, ForecastRequest, ForecastResponse,
    ForecastSummary, RiskAssessment,
)
from routes.metrics import record_forecast

logger = logging.getLogger(__name__)


def compute_forecast(
    req: ForecastRequest,
    explainability: ExplainabilityEngine | None = None,
    risk_engine: RiskScoringEngine | None = None,
    recommendations_engine: RecommendationEngine | None = None,
    history: PredictionHistory | None = None,
) -> ForecastResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().reset_index()
    daily = daily.set_index("date").sort_index()

    if len(daily) < 2:
        raise ValueError("Need at least 2 days of transaction data")

    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    daily.columns = ["amount"]

    num_days = len(daily)
    if num_days < 14:
        raise ValueError(f"Need at least 14 days of history, got {num_days}")

    series = daily["amount"].values.astype(float)

    try:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        predictions = fitted.forecast(req.horizon_days)
    except Exception as e:
        logger.warning("ExponentialSmoothing failed, falling back to simple average: %s", e)
        window = min(30, num_days)
        avg = float(np.mean(series[-window:]))
        predictions = np.full(req.horizon_days, avg)

    window = min(30, num_days)
    recent_std = float(np.std(series[-window:]))
    margin = 1.5 * recent_std

    last_date = daily.index.max()
    forecast_points = []
    for i in range(req.horizon_days):
        forecast_date = last_date + timedelta(days=i + 1)
        predicted = float(predictions[i])
        forecast_points.append(ForecastPoint(
            date=forecast_date.strftime("%Y-%m-%d"),
            predicted=round(predicted, 2),
            lower=round(predicted - margin, 2),
            upper=round(predicted + margin, 2),
        ))

    expected_net = round(float(np.sum(predictions)), 2)
    recent_mean = float(np.mean(series[-window:]))
    forecast_mean = float(np.mean(predictions))
    pct_change = (forecast_mean - recent_mean) / abs(recent_mean) if recent_mean != 0 else 0.0
    trend = "improving" if pct_change > 0.05 else "declining" if pct_change < -0.05 else "stable"

    if num_days < 30:
        confidence = "low"
    elif num_days <= 90:
        confidence = "medium"
    else:
        confidence = "high"

    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    variance_penalty = min(0.3, recent_std / (abs(recent_mean) + recent_std + 1e-9)) if recent_std > 0 else 0.0
    confidence_score = max(0.05, min(0.98, base - variance_penalty))

    full_std = float(np.std(series))
    drift_score = float(np.clip(abs(recent_std - full_std) / full_std, 0.0, 1.0)) if full_std > 0 else 0.0

    summary = ForecastSummary(
        expected_net=expected_net, trend=trend, confidence=confidence,
        confidence_score=round(confidence_score, 3),
    )
    record_forecast(drift_score, confidence_score)

    risk_level = "low"
    risk_assessment = RiskAssessment(overall_risk=0.1, risk_level="low")
    recs = []
    explanations = Explanation()

    if explainability:
        explanations_ts = explainability.explain_timeseries(predictions, series, "cash flow")
        explanations = Explanation(
            methods_used=explanations_ts.get("methods_used", []),
            reasoning=explanations_ts.get("reasoning", ""),
            key_factors=explanations_ts.get("key_factors", []),
        )
    if risk_engine:
        risk_assessment_obj = risk_engine.compute_forecast_risk(predictions, series, [(p.lower, p.upper) for p in forecast_points])
        risk_assessment = RiskAssessment(
            overall_risk=risk_assessment_obj.overall_risk,
            risk_level=risk_assessment_obj.risk_level,
            model_risk=risk_assessment_obj.model_risk,
            data_risk=risk_assessment_obj.data_risk,
            uncertainty_risk=risk_assessment_obj.uncertainty_risk,
            domain_risk=risk_assessment_obj.domain_risk,
            risk_factors=risk_assessment_obj.risk_factors,
            mitigation_actions=risk_assessment_obj.mitigation_actions,
        )
    if recommendations_engine:
        historical_stats = {"recent_avg": recent_mean, "recent_std": recent_std}
        recs = recommendations_engine.generate_forecast_recommendations(
            predictions.tolist(), trend, confidence, confidence_score,
            risk_assessment.risk_level, historical_stats,
        )
    if history:
        record = PredictionRecord(
            feature_name="forecast",
            model_used="exponential_smoothing",
            confidence=confidence_score,
            confidence_score=confidence_score,
            risk_score=risk_assessment.overall_risk,
            prediction={"expected_net": expected_net, "trend": trend},
            explanation={"reasoning": explanations.reasoning},
            recommendations=recs,
        )
        history.log_prediction(record)

    return ForecastResponse(
        forecast=forecast_points,
        summary=summary,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=explanations,
        recommendations=recs,
        risk=risk_assessment,
        model_used="exponential_smoothing",
    )
