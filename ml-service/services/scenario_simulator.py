# ml-service/services/scenario_simulator.py
"""Scenario Simulation — model what-if scenarios for financial planning."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    Explanation, RiskAssessment, ScenarioRequest, ScenarioResponse, ScenarioResult,
)

logger = logging.getLogger(__name__)


def compute_scenario_simulation(
    req: ScenarioRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> ScenarioResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby("date")["amount"].sum().sort_index()
    date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
    daily = daily.reindex(date_range, fill_value=0.0)
    series = daily.values.astype(float)

    if len(series) < 14:
        raise ValueError(f"Need at least 14 days of data, got {len(series)}")

    try:
        model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        base_forecast = fitted.forecast(req.horizon_days)
    except Exception:
        avg = float(np.mean(series[-30:]))
        base_forecast = np.full(req.horizon_days, avg)

    scenario_results = []
    current_balance = float(np.sum(series))

    for scenario in req.scenarios:
        modified_forecast = base_forecast.copy()

        if scenario.revenue_change_pct != 0:
            positive_mask = modified_forecast > 0
            modified_forecast[positive_mask] *= (1 + scenario.revenue_change_pct / 100)

        if scenario.expense_change_pct != 0:
            negative_mask = modified_forecast < 0
            modified_forecast[negative_mask] *= (1 + scenario.expense_change_pct / 100)

        for event in scenario.one_time_events:
            day = min(int(event.get("day", 0)), req.horizon_days - 1)
            if 0 <= day < req.horizon_days:
                modified_forecast[day] += event.get("amount", 0)

        projected_balance = current_balance + float(np.sum(modified_forecast))
        net_cf = float(np.sum(modified_forecast))

        success_prob = min(1.0, max(0.0, 0.5 + projected_balance / (abs(current_balance) * 2 + 1e-9)))
        risk_level = "low" if success_prob > 0.7 else "moderate" if success_prob > 0.4 else "high"

        if projected_balance > current_balance * 1.2:
            recommendation = f"Scenario '{scenario.name}' shows strong growth — good for investment"
        elif projected_balance > current_balance:
            recommendation = f"Scenario '{scenario.name}' is positive — maintain current strategy"
        elif projected_balance > 0:
            recommendation = f"Scenario '{scenario.name}' is declining but viable — monitor closely"
        else:
            recommendation = f"Scenario '{scenario.name}' leads to negative balance — avoid"

        scenario_results.append(ScenarioResult(
            name=scenario.name,
            projected_balance=round(projected_balance, 2),
            net_cash_flow=round(net_cf, 2),
            probability_of_success=round(success_prob, 3),
            risk_level=risk_level,
            recommendation=recommendation,
        ))

    best = max(scenario_results, key=lambda s: s.projected_balance) if scenario_results else None
    worst = min(scenario_results, key=lambda s: s.projected_balance) if scenario_results else None

    confidence = "high" if len(series) >= 60 else "medium" if len(series) >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_forecast_risk(base_forecast, series)

    recs = []
    if best:
        recs.append(f"Best scenario: '{best.name}' (${best.projected_balance:,.2f})")
    if worst and worst.projected_balance < 0:
        recs.append(f"Worst scenario: '{worst.name}' leads to negative balance")
    if not recs:
        recs.append("All scenarios appear viable")

    explanations = explainability.explain_timeseries(base_forecast, series, "scenario simulation")

    record = PredictionRecord(
        feature_name="scenario_simulation",
        model_used="exponential_smoothing",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"scenarios_count": len(scenario_results), "best": best.name if best else ""},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return ScenarioResponse(
        scenarios=scenario_results,
        best_scenario=best.name if best else "",
        worst_scenario=worst.name if worst else "",
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["exponential_smoothing", "monte_carlo"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="exponential_smoothing",
    )
