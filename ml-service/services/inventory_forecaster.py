# ml-service/services/inventory_forecaster.py
"""Inventory Forecasting — stockout prediction and reorder optimization."""

from __future__ import annotations

import logging
import math

import numpy as np

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, InventoryForecast, InventoryForecastResponse, InventoryRequest,
    RiskAssessment,
)

logger = logging.getLogger(__name__)


def forecast_inventory(
    req: InventoryRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> InventoryForecastResponse:
    forecasts = []
    total_value = 0.0
    items_at_risk = 0

    for item in req.items:
        total_value += item.current_stock * item.unit_cost

        if item.daily_usage > 0:
            days_until_stockout = item.current_stock / item.daily_usage
        else:
            days_until_stockout = 999

        safety_stock = item.daily_usage * math.sqrt(item.lead_time_days) * 1.5
        reorder_point = int(item.daily_usage * item.lead_time_days + safety_stock)

        avg_daily_usage_30 = item.daily_usage
        reorder_quantity = int(avg_daily_usage_30 * 30)

        if days_until_stockout <= item.lead_time_days:
            stockout_risk = "critical"
            recommendation = f"URGENT: '{item.name}' will stock out in {days_until_stockout:.0f} days — reorder immediately"
            items_at_risk += 1
        elif days_until_stockout <= item.lead_time_days * 2:
            stockout_risk = "high"
            recommendation = f"High risk: '{item.name}' stockout in {days_until_stockout:.0f} days — place order now"
            items_at_risk += 1
        elif days_until_stockout <= 30:
            stockout_risk = "moderate"
            recommendation = f"Moderate risk: '{item.name}' stockout in {days_until_stockout:.0f} days — plan reorder"
        else:
            stockout_risk = "low"
            recommendation = f"'{item.name}' has adequate stock ({days_until_stockout:.0f} days)"

        forecasts.append(InventoryForecast(
            name=item.name,
            sku=item.sku,
            days_until_stockout=round(days_until_stockout, 1),
            reorder_point=reorder_point,
            reorder_quantity=reorder_quantity,
            stockout_risk=stockout_risk,
            recommendation=recommendation,
        ))

    confidence = "high" if len(req.items) >= 5 else "medium" if len(req.items) >= 2 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"items_at_risk": items_at_risk, "total_value": total_value},
    )

    recs = []
    if items_at_risk > 0:
        recs.append(f"{items_at_risk} item(s) at risk of stockout")
    recs.append(f"Total inventory value: ${total_value:,.2f}")

    explanations = explainability.explain_timeseries(
        np.array([f.days_until_stockout for f in forecasts]),
        np.array([0] * len(forecasts)),
        "inventory",
    )

    record = PredictionRecord(
        feature_name="inventory_forecast",
        model_used="deterministic",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"items_at_risk": items_at_risk, "total_value": total_value},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return InventoryForecastResponse(
        forecasts=forecasts,
        total_inventory_value=round(total_value, 2),
        items_at_risk=items_at_risk,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["deterministic", "lead_time_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="deterministic",
    )
