# ml-service/services/expense_anomaly_detector.py
"""Expense Anomaly Detection — detects unusual spending patterns."""

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
    ExpenseAnomaly, ExpenseAnomalyRequest, ExpenseAnomalyResponse,
    Explanation, RiskAssessment,
)

logger = logging.getLogger(__name__)


def detect_expense_anomalies(
    req: ExpenseAnomalyRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> ExpenseAnomalyResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    expenses = df[df["amount"] < 0].copy()
    expenses["abs_amount"] = expenses["amount"].abs()

    if len(expenses) < 10:
        raise ValueError(f"Need at least 10 expense transactions, got {len(expenses)}")

    amounts = expenses["abs_amount"].values.astype(float)
    mean_val = float(np.mean(amounts))
    std_val = float(np.std(amounts))

    if std_val == 0:
        std_val = mean_val * 0.1 + 1e-9

    anomalies = []
    z_threshold = req.sensitivity

    for idx, (_, row) in enumerate(expenses.iterrows()):
        amount = float(row["abs_amount"])
        z_score = (amount - mean_val) / std_val

        if abs(z_score) > z_threshold:
            expected_low = max(0, mean_val - z_threshold * std_val)
            expected_high = mean_val + z_threshold * std_val

            if abs(z_score) > 4:
                severity = "critical"
                explanation = f"Extreme anomaly: ${amount:,.2f} is {abs(z_score):.1f}σ from mean (${mean_val:,.2f})"
                recommendation = f"Investigate immediately: ${amount:,.2f} on {row['date'].strftime('%Y-%m-%d')}"
            elif abs(z_score) > 3:
                severity = "high"
                explanation = f"Significant anomaly: ${amount:,.2f} is {abs(z_score):.1f}σ from mean"
                recommendation = f"Review transaction: ${amount:,.2f} — verify vendor and purpose"
            elif abs(z_score) > 2.5:
                severity = "moderate"
                explanation = f"Notable deviation: ${amount:,.2f} is {abs(z_score):.1f}σ from mean"
                recommendation = f"Monitor: ${amount:,.2f} — check if expected"
            else:
                severity = "low"
                explanation = f"Mild anomaly: ${amount:,.2f} is {abs(z_score):.1f}σ from mean"
                recommendation = f"Note: ${amount:,.2f} slightly above typical range"

            anomalies.append(ExpenseAnomaly(
                index=idx,
                amount=amount,
                date=row["date"].strftime("%Y-%m-%d"),
                z_score=round(float(z_score), 4),
                expected_range=(round(expected_low, 2), round(expected_high, 2)),
                severity=severity,
                explanation=explanation,
                recommendation=recommendation,
            ))

    total_anomaly_amount = sum(a.amount for a in anomalies)
    anomaly_rate = len(anomalies) / max(len(expenses), 1)

    confidence = "high" if len(expenses) >= 50 else "medium" if len(expenses) >= 20 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"anomaly_count": len(anomalies), "anomaly_rate": anomaly_rate},
    )

    recs = []
    if anomalies:
        recs.append(f"{len(anomalies)} anomalous transactions detected (${total_anomaly_amount:,.2f})")
        critical = [a for a in anomalies if a.severity in ("critical", "high")]
        if critical:
            recs.append(f"{len(critical)} require immediate investigation")
    else:
        recs.append("No expense anomalies detected — spending patterns appear normal")

    explanations = explainability.explain_timeseries(amounts, amounts, "expense anomalies")

    record = PredictionRecord(
        feature_name="expense_anomaly",
        model_used="zscore",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"anomaly_count": len(anomalies), "anomaly_rate": anomaly_rate},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return ExpenseAnomalyResponse(
        anomalies=anomalies,
        total_anomalies=len(anomalies),
        anomaly_rate=round(anomaly_rate, 4),
        total_anomaly_amount=round(total_anomaly_amount, 2),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["zscore", "statistical_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="zscore",
    )
