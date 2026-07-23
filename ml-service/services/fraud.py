"""Fraud Detection — hybrid Isolation Forest + z-score anomaly detection."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, FraudAlert, FraudDetectionResponse, FraudRequest,
    RiskAssessment,
)

logger = logging.getLogger(__name__)


def _build_isolation_forest(amounts: np.ndarray) -> IsolationForest:
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
    )
    X = amounts.reshape(-1, 1) if amounts.ndim == 1 else amounts
    model.fit(X)
    return model


def _zscore_anomaly_score(amount: float, mean: float, std: float) -> float:
    if std == 0:
        return 0.0
    return abs(amount - mean) / std


def detect_fraud(
    req: FraudRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> FraudDetectionResponse:
    config = get_tier_config(tier)

    current_df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    current_df["date"] = pd.to_datetime(current_df["date"])

    if req.historical_transactions:
        hist_df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.historical_transactions])
        hist_df["date"] = pd.to_datetime(hist_df["date"])
        ref_amounts = hist_df["amount"].values.astype(float)
    else:
        ref_amounts = current_df["amount"].values.astype(float)

    if len(ref_amounts) < 10:
        raise ValueError(f"Need at least 10 reference transactions, got {len(ref_amounts)}")

    ref_mean = float(np.mean(ref_amounts))
    ref_std = float(np.std(ref_amounts))
    if ref_std == 0:
        ref_std = abs(ref_mean) * 0.1 + 1e-9

    if_model = None
    if tier in (Tier.EMERALD, Tier.DIAMOND) and len(ref_amounts) >= 20:
        try:
            if_model = _build_isolation_forest(ref_amounts)
        except Exception as e:
            logger.warning("IsolationForest training failed, falling back to z-score: %s", e)

    amounts_for_if = current_df["amount"].values.astype(float).reshape(-1, 1)
    if_scores = if_model.score_samples(amounts_for_if) if if_model is not None else None

    alerts = []
    current_amounts = current_df["amount"].values.astype(float)

    for i, row in current_df.iterrows():
        amount = float(row["amount"])
        z_score = (amount - ref_mean) / ref_std

        if_score = float(if_scores[i]) if if_scores is not None else 0.0
        if_anomaly = if_score < -0.5 if if_model is not None else False

        combined_anomaly = abs(z_score) > 2.0 or if_anomaly

        if combined_anomaly:
            if if_model is not None:
                if_weight = 0.5
                z_weight = 0.5
                normalized_if = max(0.0, min(1.0, abs(if_score + 0.5) / 1.5))
                normalized_z = min(1.0, abs(z_score) / 5.0)
                prob = normalized_if * if_weight + normalized_z * z_weight
            else:
                prob = min(1.0, abs(z_score) / 5.0)

            if abs(z_score) > 3.5 or (if_anomaly and abs(z_score) > 2.5):
                risk_level = "critical"
            elif abs(z_score) > 3.0 or (if_anomaly and abs(z_score) > 2.0):
                risk_level = "high"
            elif abs(z_score) > 2.5 or if_anomaly:
                risk_level = "moderate"
            else:
                risk_level = "low"

            expected_low = ref_mean - 2 * ref_std
            expected_high = ref_mean + 2 * ref_std

            ifsc = f", IsolationForest score: {if_score:.3f}" if if_model is not None else ""
            explanation = (
                f"Transaction ${amount:,.2f} deviates {z_score:.1f}σ from mean (${ref_mean:,.2f}). "
                f"Expected: ${expected_low:,.2f}–${expected_high:,.2f}.{ifsc}"
            )
            recommendation = (
                f"{'Investigate immediately' if risk_level in ('critical', 'high') else 'Review transaction'}"
                f": ${amount:,.2f} on {row['date'].strftime('%Y-%m-%d')}"
            )

            alerts.append(FraudAlert(
                transaction_index=i,
                amount=amount,
                date=row["date"].strftime("%Y-%m-%d"),
                fraud_probability=round(prob, 4),
                risk_level=risk_level,
                anomaly_score=round(float(abs(z_score)), 4),
                explanation=explanation,
                recommendation=recommendation,
            ))

    total_flagged = len(alerts)
    total_risk_amount = sum(a.amount for a in alerts)
    avg_prob = float(np.mean([a.fraud_probability for a in alerts])) if alerts else 0.0

    confidence = "high" if len(ref_amounts) >= 100 else "medium" if len(ref_amounts) >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]
    if if_model is not None:
        confidence_score = min(0.95, confidence_score + 0.08)

    risk = risk_engine.compute_risk(
        data_points=len(ref_amounts),
        confidence=confidence_score,
        domain_context={"total_flagged": total_flagged},
    )

    recs: list[str] = []
    if total_flagged > 0:
        recs.append(f"{total_flagged} suspicious transactions detected (${total_risk_amount:,.2f} total)")
        if total_risk_amount > 10000:
            recs.append("High-value fraud alerts — immediate review recommended")
        critical_alerts = [a for a in alerts if a.risk_level in ("critical", "high")]
        if critical_alerts:
            recs.append(f"{len(critical_alerts)} high/critical severity alerts require immediate attention")
    else:
        recs.append("No suspicious transactions detected")

    explanations = explainability.explain_timeseries(current_amounts, ref_amounts, "transaction amount")

    record = PredictionRecord(
        feature_name="fraud_detection",
        model_used="isolation_forest+zscore" if if_model is not None else "zscore",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_flagged": total_flagged, "total_risk_amount": total_risk_amount},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
        tier=tier.value,
    )
    history.log_prediction(record)

    return FraudDetectionResponse(
        alerts=alerts,
        total_flagged=total_flagged,
        total_risk_amount=round(total_risk_amount, 2),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=(["isolation_forest", "zscore"] if if_model is not None else ["zscore"]),
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
        model_used="isolation_forest+zscore" if if_model is not None else "zscore",
    )
