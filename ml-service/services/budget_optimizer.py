# ml-service/services/budget_optimizer.py
"""Budget Optimization — allocates budgets based on historical spending and priorities."""

from __future__ import annotations

import logging

import numpy as np

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    BudgetOptimization, BudgetOptimizationResponse, BudgetRequest,
    Explanation, RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_budget_optimization(
    req: BudgetRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> BudgetOptimizationResponse:
    optimizations = []
    total_savings = 0.0

    total_current = sum(c.current_spend for c in req.categories)
    total_budget = req.total_budget if req.total_budget > 0 else total_current * 1.1

    for cat in req.categories:
        if cat.budget > 0:
            recommended = cat.budget
        elif total_current > 0:
            share = cat.current_spend / total_current
            recommended = total_budget * share
        else:
            recommended = cat.current_spend

        savings = cat.current_spend - recommended
        if cat.priority == "high":
            recommended = max(recommended, cat.current_spend * 0.9)
        elif cat.priority == "low":
            recommended = min(recommended, cat.current_spend * 0.7)

        savings = cat.current_spend - recommended
        total_savings += max(0, savings)

        if savings > 0:
            reasoning = f"Reduce '{cat.name}' by ${savings:,.2f} ({savings/max(cat.current_spend,1)*100:.0f}%)"
        elif savings < 0:
            reasoning = f"Increase '{cat.name}' by ${abs(savings):,.2f} based on priority"
        else:
            reasoning = f"Maintain '{cat.name}' at current level"

        optimizations.append(BudgetOptimization(
            category=cat.name,
            current_spend=round(cat.current_spend, 2),
            recommended_spend=round(recommended, 2),
            savings=round(max(0, savings), 2),
            priority=cat.priority,
            reasoning=reasoning,
        ))

    budget_utilization = total_current / max(total_budget, 1)
    optimization_score = round(min(1.0, max(0.0, 1.0 - abs(budget_utilization - 0.85) / 0.5)), 4)

    confidence = "high" if len(req.categories) >= 5 else "medium" if len(req.categories) >= 2 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"total_budget": total_budget, "utilization": budget_utilization},
    )

    recs = []
    if total_savings > 0:
        recs.append(f"Potential savings: ${total_savings:,.2f}")
    over_budget = [o for o in optimizations if o.current_spend > o.recommended_spend * 1.1]
    if over_budget:
        recs.append(f"{len(over_budget)} category(ies) over recommended budget")
    if not recs:
        recs.append("Budget allocation appears optimal")

    explanations = explainability.explain_timeseries(
        np.array([o.current_spend for o in optimizations]),
        np.array([o.recommended_spend for o in optimizations]),
        "budget allocation",
    )

    record = PredictionRecord(
        feature_name="budget_optimization",
        model_used="optimization",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_savings": total_savings, "optimization_score": optimization_score},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return BudgetOptimizationResponse(
        optimizations=optimizations,
        total_potential_savings=round(total_savings, 2),
        optimization_score=optimization_score,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["optimization", "rule_based"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="optimization",
    )
