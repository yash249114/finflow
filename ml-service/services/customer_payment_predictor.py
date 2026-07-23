# ml-service/services/customer_payment_predictor.py
"""Customer Payment Prediction — predicts when customers will pay invoices."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    CustomerPaymentRequest, CustomerPaymentResponse, CustomerPaymentPrediction,
    Explanation, RiskAssessment,
)

logger = logging.getLogger(__name__)


def predict_customer_payments(
    req: CustomerPaymentRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> CustomerPaymentResponse:
    predictions = []
    total_expected = 0.0
    total_at_risk = 0.0
    all_days = []

    today = datetime.now()

    for payment in req.payments:
        due = datetime.strptime(payment.due_date, "%Y-%m-%d") if payment.due_date else today
        invoice = datetime.strptime(payment.invoice_date, "%Y-%m-%d") if payment.invoice_date else today

        if payment.historical_payment_days:
            avg_days = float(np.mean(payment.historical_payment_days))
            std_days = float(np.std(payment.historical_payment_days)) if len(payment.historical_payment_days) > 1 else 5
            consistency = 1.0 / (1.0 + std_days / max(avg_days, 1))
        else:
            avg_days = 30.0
            std_days = 10.0
            consistency = 0.5

        expected_days = avg_days
        expected_date = invoice + timedelta(days=int(expected_days))
        all_days.append(expected_days)

        days_until = (expected_date - today).days
        payment_prob = min(1.0, max(0.1, consistency * 0.8 + (1 if days_until > 0 else 0.3)))

        if payment_prob < 0.3:
            risk_level = "high"
            total_at_risk += payment.amount
            recommendation = f"High risk of late payment from '{payment.customer}' — send reminder"
        elif payment_prob < 0.6:
            risk_level = "moderate"
            recommendation = f"Moderate payment risk — monitor '{payment.customer}'"
        else:
            risk_level = "low"
            recommendation = f"Expected timely payment from '{payment.customer}'"

        if payment.historical_payment_days:
            late_count = sum(1 for d in payment.historical_payment_days if d > 30)
            if late_count > len(payment.historical_payment_days) * 0.3:
                risk_level = "high"
                recommendation = f"'{payment.customer}' has history of late payments — consider prepayment terms"

        total_expected += payment.amount * payment_prob

        days_late_risk = max(0, avg_days - 30) if avg_days > 30 else 0

        predictions.append(CustomerPaymentPrediction(
            customer=payment.customer,
            amount=payment.amount,
            expected_payment_date=expected_date.strftime("%Y-%m-%d"),
            payment_probability=round(payment_prob, 3),
            days_late_risk=round(days_late_risk, 1),
            risk_level=risk_level,
            recommendation=recommendation,
        ))

    avg_collection = float(np.mean(all_days)) if all_days else 30.0

    confidence = "high" if len(req.payments) >= 5 else "medium" if len(req.payments) >= 2 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"total_expected": total_expected, "total_at_risk": total_at_risk},
    )

    recs = []
    if total_at_risk > 0:
        recs.append(f"${total_at_risk:,.2f} at risk of late payment")
    high_risk = [p for p in predictions if p.risk_level == "high"]
    if high_risk:
        recs.append(f"{len(high_risk)} customer(s) flagged as high payment risk")
    if not recs:
        recs.append("Customer payment outlook appears healthy")

    explanations = explainability.explain_timeseries(
        np.array([p.payment_probability for p in predictions]),
        np.array([p.amount for p in predictions]),
        "customer payment",
    )

    record = PredictionRecord(
        feature_name="customer_payment",
        model_used="statistical_analysis",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_expected": total_expected, "total_at_risk": total_at_risk},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return CustomerPaymentResponse(
        predictions=predictions,
        total_expected=round(total_expected, 2),
        total_at_risk=round(total_at_risk, 2),
        avg_collection_days=round(avg_collection, 1),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["statistical_analysis", "historical_pattern"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="statistical_analysis",
    )
