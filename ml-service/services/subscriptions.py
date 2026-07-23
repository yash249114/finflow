# ml-service/services/subscriptions.py
"""Subscription Waste Detection — identifies unused or underutilized subscriptions."""

from __future__ import annotations

import logging
from datetime import datetime

import numpy as np
import pandas as pd

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, RiskAssessment, SubscriptionInsight,
    SubscriptionRequest, SubscriptionWasteResponse,
)

logger = logging.getLogger(__name__)


def detect_subscription_waste(
    req: SubscriptionRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> SubscriptionWasteResponse:
    insights = []
    total_monthly = 0.0
    potential_savings = 0.0

    for sub in req.subscriptions:
        freq_multiplier = {"monthly": 1, "quarterly": 1 / 3, "annual": 1 / 12, "weekly": 4.33}
        monthly_cost = sub.amount * freq_multiplier.get(sub.frequency, 1)
        annual_cost = monthly_cost * 12

        if sub.usage_count == 0:
            usage_score = 0.0
            waste_risk = 0.95
            recommendation = f"Unused subscription '{sub.name}' — consider cancelling (${monthly_cost:,.2f}/month)"
        elif sub.usage_count < 3:
            usage_score = 0.3
            waste_risk = 0.7
            recommendation = f"Low usage on '{sub.name}' — evaluate if still needed"
        elif sub.usage_count < 10:
            usage_score = 0.6
            waste_risk = 0.4
            recommendation = f"Moderate usage on '{sub.name}' — review usage patterns"
        else:
            usage_score = 0.9
            waste_risk = 0.1
            recommendation = f"'{sub.name}' is well-utilized"

        if sub.last_used:
            try:
                last_used_date = datetime.strptime(sub.last_used, "%Y-%m-%d")
                days_since = (datetime.now() - last_used_date).days
                if days_since > 90:
                    waste_risk = min(1.0, waste_risk + 0.2)
                    recommendation = f"'{sub.name}' not used in {days_since} days — strong cancellation candidate"
            except ValueError:
                pass

        if waste_risk > 0.6:
            potential_savings += monthly_cost

        total_monthly += monthly_cost

        insights.append(SubscriptionInsight(
            name=sub.name,
            monthly_cost=round(monthly_cost, 2),
            annual_cost=round(annual_cost, 2),
            usage_score=round(usage_score, 3),
            waste_risk=round(waste_risk, 3),
            recommendation=recommendation,
        ))

    total_annual = total_monthly * 12
    waste_score = float(np.mean([i.waste_risk for i in insights])) if insights else 0.0

    confidence = "high" if len(req.subscriptions) >= 5 else "medium" if len(req.subscriptions) >= 2 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"total_monthly": total_monthly, "waste_score": waste_score},
    )

    recs = []
    if potential_savings > 0:
        recs.append(f"Potential monthly savings: ${potential_savings:,.2f}")
    high_waste = [i for i in insights if i.waste_risk > 0.6]
    if high_waste:
        recs.append(f"{len(high_waste)} subscription(s) flagged as waste candidates")
    if not recs:
        recs.append("All subscriptions appear well-utilized")

    explanations = explainability.explain_timeseries(
        np.array([i.usage_score for i in insights]),
        np.array([i.waste_risk for i in insights]),
        "subscription usage",
    )

    record = PredictionRecord(
        feature_name="subscription_waste",
        model_used="rule_based",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_monthly": total_monthly, "potential_savings": potential_savings},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return SubscriptionWasteResponse(
        insights=insights,
        total_monthly=round(total_monthly, 2),
        total_annual=round(total_annual, 2),
        potential_savings=round(potential_savings, 2),
        waste_score=round(waste_score, 4),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["rule_based", "usage_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="rule_based",
    )
