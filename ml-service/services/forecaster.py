"""Cash flow forecasting with ensemble methods — Prophet, ARIMA, ExponentialSmoothing."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd

from core.config import Tier, get_tier_config
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


def _fit_exponential_smoothing(series: np.ndarray, horizon: int) -> np.ndarray:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    try:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        return fitted.forecast(horizon)
    except Exception as e:
        logger.warning("ExponentialSmoothing failed: %s", e)
        avg = float(np.mean(series[-min(30, len(series)):]))
        return np.full(horizon, avg)


def _fit_arima(series: np.ndarray, horizon: int) -> np.ndarray | None:
    from statsmodels.tsa.arima.model import ARIMA
    try:
        model = ARIMA(series, order=(1, 1, 1))
        fitted = model.fit()
        return fitted.forecast(horizon)
    except Exception as e:
        logger.warning("ARIMA failed: %s", e)
        return None


def _fit_prophet(series: np.ndarray, horizon: int) -> np.ndarray | None:
    try:
        import pandas as _pd
        from prophet import Prophet
        df = _pd.DataFrame({
            "ds": _pd.date_range("2020-01-01", periods=len(series), freq="D"),
            "y": series,
        })
        model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            weekly_seasonality=True,
            yearly_seasonality=False,
        )
        model.fit(df)
        future = model.make_future_dataframe(periods=horizon)
        forecast = model.predict(future)
        return forecast["yhat"].values[-horizon:]
    except Exception as e:
        logger.warning("Prophet failed: %s", e)
        return None


def _ensemble_forecast(series: np.ndarray, horizon: int, tier: Tier) -> dict[str, Any]:
    forecasts: list[np.ndarray] = []
    model_names: list[str] = []

    es = _fit_exponential_smoothing(series, horizon)
    forecasts.append(es)
    model_names.append("exponential_smoothing")

    arima = _fit_arima(series, horizon)
    if arima is not None:
        forecasts.append(arima)
        model_names.append("arima")

    if tier in (Tier.EMERALD, Tier.DIAMOND):
        prophet = _fit_prophet(series, horizon)
        if prophet is not None:
            forecasts.append(prophet)
            model_names.append("prophet")

    if len(forecasts) == 1:
        ensemble = forecasts[0]
        weights = [1.0]
    else:
        hist_recent = series[-min(30, len(series)):]
        if len(hist_recent) > 1:
            errors = []
            for f in forecasts:
                err = float(np.mean(np.abs(f[:min(len(f), len(hist_recent))] - hist_recent[:min(len(f), len(hist_recent))])))
                errors.append(max(err, 1e-9))
            inv_errors = [1.0 / e for e in errors]
            weights = [w / sum(inv_errors) for w in inv_errors]
        else:
            weights = [1.0 / len(forecasts)] * len(forecasts)

        ensemble = np.average(forecasts, axis=0, weights=weights)

    ensemble_std = np.std(forecasts, axis=0) if len(forecasts) > 1 else np.full(horizon, float(np.std(series)))

    return {
        "predictions": ensemble,
        "std": ensemble_std,
        "model_names": model_names,
        "weights": weights,
        "ensemble_size": len(forecasts),
    }


def compute_forecast(
    req: ForecastRequest,
    explainability: ExplainabilityEngine | None = None,
    risk_engine: RiskScoringEngine | None = None,
    recommendations_engine: RecommendationEngine | None = None,
    history: PredictionHistory | None = None,
) -> ForecastResponse:
    tier = Tier(req.tier) if req.tier else Tier.BLUE
    config = get_tier_config(tier)

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

    ensemble = _ensemble_forecast(series, req.horizon_days, tier)
    predictions = ensemble["predictions"]
    pred_std = ensemble["std"]
    ensemble_size = ensemble["ensemble_size"]
    model_names = ensemble["model_names"]

    margin = 1.5 * pred_std
    last_date = daily.index.max()
    forecast_points = []
    for i in range(req.horizon_days):
        forecast_date = last_date + timedelta(days=i + 1)
        predicted = float(predictions[i])
        forecast_points.append(ForecastPoint(
            date=forecast_date.strftime("%Y-%m-%d"),
            predicted=round(predicted, 2),
            lower=round(predicted - float(margin[i]), 2),
            upper=round(predicted + float(margin[i]), 2),
        ))

    expected_net = round(float(np.sum(predictions)), 2)
    window = min(30, num_days)
    recent_mean = float(np.mean(series[-window:]))
    forecast_mean = float(np.mean(predictions))
    pct_change = (forecast_mean - recent_mean) / abs(recent_mean) if recent_mean != 0 else 0.0
    trend = "improving" if pct_change > 0.05 else "declining" if pct_change < -0.05 else "stable"

    if num_days < 30:
        confidence = "low"
        conf_base = 0.45
    elif num_days <= 90:
        confidence = "medium"
        conf_base = 0.70
    else:
        confidence = "high"
        conf_base = 0.88

    variance_penalty = min(0.3, float(np.mean(pred_std) / (abs(float(np.mean(predictions))) + float(np.mean(pred_std)) + 1e-9))) if float(np.mean(pred_std)) > 0 else 0.0
    ensemble_boost = min(0.12, (ensemble_size - 1) * 0.04)
    confidence_score = max(0.05, min(0.98, conf_base - variance_penalty + ensemble_boost))

    full_std = float(np.std(series))
    drift_score = float(np.clip(abs(float(np.std(series[-window:])) - full_std) / full_std, 0.0, 1.0)) if full_std > 0 else 0.0

    summary = ForecastSummary(
        expected_net=expected_net, trend=trend, confidence=confidence,
        confidence_score=round(confidence_score, 3),
    )
    record_forecast(drift_score, confidence_score)

    risk_assessment = RiskAssessment(overall_risk=0.1, risk_level="low")
    recs: list[str] = []
    explanations = Explanation()

    if explainability:
        explanations_ts = explainability.explain_timeseries(predictions, series, "cash flow")
        explanations = Explanation(
            methods_used=explanations_ts.get("methods_used", []),
            reasoning=explanations_ts.get("reasoning", ""),
            key_factors=explanations_ts.get("key_factors", []),
        )
    if risk_engine:
        risk_obj = risk_engine.compute_forecast_risk(predictions, series, [(p.lower, p.upper) for p in forecast_points])
        risk_assessment = RiskAssessment(
            overall_risk=risk_obj.overall_risk,
            risk_level=risk_obj.risk_level,
            model_risk=risk_obj.model_risk,
            data_risk=risk_obj.data_risk,
            uncertainty_risk=risk_obj.uncertainty_risk,
            domain_risk=risk_obj.domain_risk,
            risk_factors=risk_obj.risk_factors,
            mitigation_actions=risk_obj.mitigation_actions,
        )
    if recommendations_engine:
        historical_stats = {"recent_avg": recent_mean, "recent_std": float(np.std(series[-window:])) if len(series) >= window else float(np.std(series))}
        recs = recommendations_engine.generate_forecast_recommendations(
            predictions.tolist(), trend, confidence, confidence_score,
            risk_assessment.risk_level, historical_stats,
        )
    if history:
        record = PredictionRecord(
            feature_name="forecast",
            model_used="+".join(model_names) if len(model_names) > 1 else model_names[0],
            model_version=ensemble_size,
            confidence=confidence_score,
            confidence_score=confidence_score,
            risk_score=risk_assessment.overall_risk,
            prediction={"expected_net": expected_net, "trend": trend},
            explanation={"reasoning": explanations.reasoning, "ensemble_models": model_names},
            recommendations=recs,
            tier=tier.value,
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
        model_used="+".join(model_names) if len(model_names) > 1 else model_names[0],
    )
