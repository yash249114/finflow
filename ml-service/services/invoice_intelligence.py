# ml-service/services/invoice_intelligence.py
"""Invoice Intelligence — payment probability, expected dates, DSO analysis."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, InvoiceInsight, InvoiceIntelligenceResponse, InvoiceRequest,
    RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_invoice_intelligence(
    req: InvoiceRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> InvoiceIntelligenceResponse:
    insights = []
    total_pending = 0.0
    total_overdue = 0.0
    payment_days = []

    today = datetime.now()

    for inv in req.invoices:
        due = datetime.strptime(inv.due_date, "%Y-%m-%d") if inv.due_date else today
        days_overdue = (today - due).days if due < today else 0

        if inv.status == "overdue" or days_overdue > 0:
            total_overdue += inv.amount
            payment_prob = max(0.1, 0.9 - days_overdue * 0.02)
            expected_date = inv.due_date
            risk_score = min(1.0, 0.3 + days_overdue * 0.03)
            recommendation = f"Follow up on overdue invoice ({days_overdue} days past due)"
        elif inv.status == "paid":
            payment_prob = 1.0
            expected_date = inv.due_date
            risk_score = 0.0
            recommendation = "Already paid"
            if inv.due_date and req.transactions:
                paid_dates = [t.date for t in req.transactions if t.amount > 0]
                if paid_dates:
                    payment_days.append(0)
        else:
            total_pending += inv.amount
            days_until_due = (due - today).days
            if days_until_due < 0:
                payment_prob = 0.3
                risk_score = 0.6
                recommendation = "Payment overdue — initiate collection"
            elif days_until_due <= 7:
                payment_prob = 0.8
                risk_score = 0.2
                recommendation = "Payment due soon — send reminder"
            elif days_until_due <= 30:
                payment_prob = 0.6
                risk_score = 0.3
                recommendation = "Monitor until due date"
            else:
                payment_prob = 0.4
                risk_score = 0.4
                recommendation = "Long-term receivable — monitor regularly"
            expected_date = inv.due_date

        insights.append(InvoiceInsight(
            invoice_id=inv.invoice_id,
            payment_probability=round(payment_prob, 3),
            expected_payment_date=expected_date,
            risk_score=round(risk_score, 3),
            recommendation=recommendation,
        ))

    avg_payment_days = float(np.mean(payment_days)) if payment_days else 30.0
    dso = avg_payment_days

    confidence = "high" if len(req.invoices) >= 10 else "medium" if len(req.invoices) >= 3 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"total_pending": total_pending, "total_overdue": total_overdue},
    )

    recs = []
    if total_overdue > 0:
        recs.append(f"${total_overdue:,.2f} in overdue invoices — collection action recommended")
    if dso > 45:
        recs.append(f"DSO of {dso:.0f} days is above industry average — improve collections")
    if not recs:
        recs.append("Invoice portfolio appears healthy")

    explanations = explainability.explain_timeseries(
        np.array([i.payment_probability for i in insights]),
        np.array([i.risk_score for i in insights]),
        "invoice payment",
    )

    record = PredictionRecord(
        feature_name="invoice_intelligence",
        model_used="rule_based",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_pending": total_pending, "dso": dso},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return InvoiceIntelligenceResponse(
        insights=insights,
        total_pending=round(total_pending, 2),
        total_overdue=round(total_overdue, 2),
        days_sales_outstanding=round(dso, 1),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["rule_based", "payment_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="rule_based",
    )
