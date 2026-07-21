# ml-service/services/forecaster.py
"""Cash flow forecasting using Exponential Smoothing."""

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from models.schemas import (
    ForecastPoint,
    ForecastRequest,
    ForecastResponse,
    ForecastSummary,
)
from routes.metrics import record_forecast

logger = logging.getLogger(__name__)


def compute_forecast(req: ForecastRequest) -> ForecastResponse:
    """Compute a cash flow forecast from historical transactions.

    Aggregates transactions by day, fills gaps with 0, applies
    Holt-Winters ExponentialSmoothing, and returns predictions
    with confidence intervals.
    """
    # Build daily time series
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().reset_index()
    daily = daily.set_index("date").sort_index()

    # Fill missing dates with 0
    if len(daily) < 2:
        raise ValueError("Need at least 2 days of transaction data")

    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    daily.columns = ["amount"]

    num_days = len(daily)
    if num_days < 14:
        raise ValueError(f"Need at least 14 days of history, got {num_days}")

    # Determine confidence level based on data volume
    if num_days < 30:
        confidence = "low"
    elif num_days <= 90:
        confidence = "medium"
    else:
        confidence = "high"

    # Fit Exponential Smoothing model
    series = daily["amount"].values.astype(float)

    try:
        # Use additive trend, no seasonality for simplicity in MVP
        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal=None,
            initialization_method="estimated",
        )
        fitted = model.fit(optimized=True)
        predictions = fitted.forecast(req.horizon_days)
    except Exception as e:
        logger.warning("ExponentialSmoothing failed, falling back to simple average: %s", e)
        # Fallback: use rolling mean of last 30 days
        window = min(30, num_days)
        avg = float(np.mean(series[-window:]))
        predictions = np.full(req.horizon_days, avg)

    # Confidence interval: ±1.5 std dev of last 30 days variance
    window = min(30, num_days)
    recent_std = float(np.std(series[-window:]))
    margin = 1.5 * recent_std

    # Build forecast points
    last_date = daily.index.max()
    forecast_points: list[ForecastPoint] = []

    for i in range(req.horizon_days):
        forecast_date = last_date + timedelta(days=i + 1)
        predicted = float(predictions[i])
        forecast_points.append(ForecastPoint(
            date=forecast_date.strftime("%Y-%m-%d"),
            predicted=round(predicted, 2),
            lower=round(predicted - margin, 2),
            upper=round(predicted + margin, 2),
        ))

    # Summary
    expected_net = round(float(np.sum(predictions)), 2)

    # Trend: compare forecast mean vs last 30 days mean
    recent_mean = float(np.mean(series[-window:]))
    forecast_mean = float(np.mean(predictions))

    if recent_mean != 0:
        pct_change = (forecast_mean - recent_mean) / abs(recent_mean)
    else:
        pct_change = 0.0

    if pct_change > 0.05:
        trend = "improving"
    elif pct_change < -0.05:
        trend = "declining"
    else:
        trend = "stable"

    # ── AIOps signals ────────────────────────────────────────
    # Forecast confidence score (0-1): higher with more history and lower variance.
    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    if recent_std > 0:
        variance_penalty = min(0.3, recent_std / (abs(recent_mean) + recent_std + 1e-9))
    else:
        variance_penalty = 0.0
    confidence_score = max(0.05, min(0.98, base - variance_penalty))

    # Model drift score (0-1): compares recent volatility vs full-series volatility.
    full_std = float(np.std(series))
    drift_score = 0.0
    if full_std > 0:
        drift_score = float(np.clip(abs(recent_std - full_std) / full_std, 0.0, 1.0))

    summary = ForecastSummary(
        expected_net=expected_net,
        trend=trend,
        confidence=confidence,
        confidence_score=round(confidence_score, 3),
    )

    # Feed AIOps metrics route.
    record_forecast(drift_score, confidence_score)

    return ForecastResponse(forecast=forecast_points, summary=summary)
