# ml-service/services/seasonality_detector.py
"""Seasonality Detection — detects cyclical patterns in transaction data."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, RiskAssessment, SeasonalityRequest, SeasonalityResponse,
    SeasonalPattern,
)

logger = logging.getLogger(__name__)


def detect_seasonality(
    req: SeasonalityRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> SeasonalityResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().sort_index()
    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    series = daily.values.astype(float)

    if len(series) < 28:
        raise ValueError(f"Need at least 28 days of data, got {len(series)}")

    patterns = []
    detected_periods = []

    for period, name in [(7, "weekly"), (14, "bi-weekly"), (30, "monthly"), (90, "quarterly")]:
        if len(series) >= period * 2:
            autocorr = np.corrcoef(series[:-period], series[period:])[0, 1]
            if abs(autocorr) > 0.2:
                cycle = series[:period]
                peak_idx = int(np.argmax(cycle))
                low_idx = int(np.argmin(cycle))
                peak_period = f"day {peak_idx + 1}" if period <= 14 else f"period {peak_idx + 1}"
                low_period = f"day {low_idx + 1}" if period <= 14 else f"period {low_idx + 1}"

                patterns.append(SeasonalPattern(
                    period=name,
                    strength=round(float(abs(autocorr)), 4),
                    peak_period=peak_period,
                    low_period=low_period,
                    description=f"{name.title()} pattern detected (strength: {abs(autocorr):.2f})",
                ))
                detected_periods.append(period)

    overall_seasonality = float(np.mean([p.strength for p in patterns])) if patterns else 0.0
    is_seasonal = len(patterns) > 0

    confidence = "high" if len(series) >= 90 else "medium" if len(series) >= 45 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(confidence=confidence_score, data_points=len(series))

    recs = []
    if is_seasonal:
        recs.append(f"Detected {len(patterns)} seasonal pattern(s) — use for planning")
        for p in patterns:
            recs.append(f"{p.period.title()} pattern: peak at {p.peak_period}, low at {p.low_period}")
    else:
        recs.append("No significant seasonal patterns detected")

    explanations = explainability.explain_timeseries(series, series, "seasonality")

    record = PredictionRecord(
        feature_name="seasonality",
        model_used="autocorrelation",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"is_seasonal": is_seasonal, "patterns_count": len(patterns)},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return SeasonalityResponse(
        patterns=patterns,
        overall_seasonality=round(overall_seasonality, 4),
        is_seasonal=is_seasonal,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["autocorrelation", "statistical_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="autocorrelation",
    )
