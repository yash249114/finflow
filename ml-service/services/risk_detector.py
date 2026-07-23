# ml-service/services/risk_detector.py
"""Financial Risk Detection — multi-factor risk assessment from transaction patterns."""

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
    Explanation, RiskAssessment, RiskDetectionRequest, RiskDetectionResponse,
    RiskIndicator,
)

logger = logging.getLogger(__name__)


def detect_financial_risk(
    req: RiskDetectionRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> RiskDetectionResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().sort_index()
    series = daily.values.astype(float)
    num_days = len(series)

    indicators = []
    risk_events = []

    total_income = float(np.sum(series[series > 0]))
    total_expenses = abs(float(np.sum(series[series < 0])))
    net = total_income - total_expenses

    if total_income > 0:
        burn_rate = total_expenses / total_income
        burn_status = "ok" if burn_rate < 0.9 else "warning" if burn_rate < 1.1 else "critical"
        indicators.append(RiskIndicator(
            name="Burn Rate Ratio", value=round(burn_rate, 4),
            benchmark=0.8, status=burn_status,
            trend="stable",
        ))
        if burn_rate > 1.1:
            risk_events.append("Expenses exceed income — unsustainable burn rate")

    if num_days >= 14:
        recent = series[-min(30, num_days):]
        volatility = float(np.std(recent) / (abs(np.mean(recent)) + 1e-9))
        vol_status = "ok" if volatility < 0.5 else "warning" if volatility < 1.0 else "critical"
        indicators.append(RiskIndicator(
            name="Cash Flow Volatility", value=round(volatility, 4),
            benchmark=0.3, status=vol_status, trend="stable",
        ))
        if volatility > 1.0:
            risk_events.append("High cash flow volatility — unpredictable patterns")

    if num_days >= 30:
        monthly_incomes = []
        for i in range(0, num_days, 30):
            chunk = series[i:i + 30]
            monthly_incomes.append(float(np.sum(chunk[chunk > 0])))
        if len(monthly_incomes) >= 2:
            first = monthly_incomes[0]
            last = monthly_incomes[-1]
            if first > 0:
                revenue_trend = (last - first) / first
                trend_status = "ok" if revenue_trend > 0 else "warning" if revenue_trend > -0.1 else "critical"
                indicators.append(RiskIndicator(
                    name="Revenue Trend", value=round(revenue_trend, 4),
                    benchmark=0.05, status=trend_status,
                    trend="improving" if revenue_trend > 0.05 else "declining" if revenue_trend < -0.05 else "stable",
                ))
                if revenue_trend < -0.2:
                    risk_events.append(f"Revenue declined {abs(revenue_trend)*100:.0f}% — critical trend")

    cash_cushion_days = num_days * (total_income - total_expenses) / max(total_expenses, 1) if total_expenses > 0 else 999
    cushion_status = "ok" if cash_cushion_days > 60 else "warning" if cash_cushion_days > 30 else "critical"
    indicators.append(RiskIndicator(
        name="Cash Cushion Days", value=round(cash_cushion_days, 1),
        benchmark=60, status=cushion_status, trend="stable",
    ))

    large_txns = df[df["amount"].abs() > df["amount"].abs().mean() + 2 * df["amount"].abs().std()]
    if len(large_txns) > 0:
        indicators.append(RiskIndicator(
            name="Large Transaction Count", value=float(len(large_txns)),
            benchmark=2, status="warning" if len(large_txns) > 5 else "ok",
            trend="stable",
        ))

    overall_score = 0.0
    status_scores = {"ok": 0.1, "warning": 0.5, "critical": 0.9}
    if indicators:
        overall_score = float(np.mean([status_scores.get(i.status, 0.5) for i in indicators]))

    risk_level = "low" if overall_score < 0.3 else "moderate" if overall_score < 0.5 else "elevated" if overall_score < 0.7 else "high"

    confidence = "high" if num_days >= 60 else "medium" if num_days >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        data_points=num_days,
        domain_context={"overall_risk_score": overall_score},
    )

    recs = []
    if risk_level in ("high", "elevated"):
        recs.append(f"Overall risk level is {risk_level} — review financial position")
    for event in risk_events:
        recs.append(event)
    if not recs:
        recs.append("Financial risk indicators appear within acceptable ranges")

    explanations = explainability.explain_timeseries(series, series, "financial risk")

    record = PredictionRecord(
        feature_name="risk_detection",
        model_used="statistical_analysis",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=overall_score,
        prediction={"overall_risk_score": overall_score, "risk_level": risk_level},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return RiskDetectionResponse(
        overall_risk_score=round(overall_score, 4),
        risk_level=risk_level,
        indicators=indicators,
        risk_events=risk_events,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["statistical_analysis", "rule_based"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="statistical_analysis",
    )
