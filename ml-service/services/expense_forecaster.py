# ml-service/services/expense_forecaster.py
"""Expense Forecasting — per-category expense prediction with budget tracking."""

from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from core.config import Tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import (
    ExpenseCategoryForecast, ExpenseForecastResponse, ExpenseRequest,
    Explanation, RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_expense_forecast(
    req: ExpenseRequest,
    categorizer: Any,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> ExpenseForecastResponse:
    from typing import Any
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])
    expenses = df[df["amount"] < 0].copy()
    expenses["abs_amount"] = expenses["amount"].abs()

    if categorizer and hasattr(categorizer, "classify"):
        descriptions = [f"expense_{i}" for i in range(len(expenses))]
        try:
            categories = categorizer.classify(descriptions)
            expenses["category"] = categories
        except Exception:
            expenses["category"] = "Other"
    else:
        expenses["category"] = "Uncategorized"

    if req.categories:
        expenses = expenses[expenses["category"].isin(req.categories)]

    if expenses.empty:
        raise ValueError("No expense data to forecast")

    category_forecasts = []
    total_predicted = 0.0
    all_pred = []
    all_hist = []

    for cat, group in expenses.groupby("category"):
        daily = group.set_index("date")["abs_amount"].resample("D").sum()
        date_range = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
        daily = daily.reindex(date_range, fill_value=0.0)
        series = daily.values.astype(float)

        if len(series) < 14:
            continue

        try:
            model = ExponentialSmoothing(series, trend="add", seasonal=None, initialization_method="estimated")
            fitted = model.fit(optimized=True)
            predictions = fitted.forecast(req.horizon_days)
        except Exception:
            avg = float(np.mean(series[-30:])) if len(series) >= 30 else float(np.mean(series))
            predictions = np.full(req.horizon_days, avg)

        recent_mean = float(np.mean(series[-30:])) if len(series) >= 30 else float(np.mean(series))
        forecast_mean = float(np.mean(predictions))
        if recent_mean > 0:
            pct_change = (forecast_mean - recent_mean) / recent_mean
        else:
            pct_change = 0
        trend = "increasing" if pct_change > 0.05 else "decreasing" if pct_change < -0.05 else "stable"

        std = float(np.std(series[-30:])) if len(series) >= 30 else float(np.std(series))
        margin = 1.5 * std

        total_predicted_cat = float(np.sum(predictions))
        all_pred.extend(predictions.tolist())
        all_hist.extend(series.tolist())

        category_forecasts.append(ExpenseCategoryForecast(
            category=cat,
            predicted=round(total_predicted_cat, 2),
            lower=round(total_predicted_cat - margin * req.horizon_days / 30, 2),
            upper=round(total_predicted_cat + margin * req.horizon_days / 30, 2),
            trend=trend,
            pct_of_total=0.0,
        ))
        total_predicted += total_predicted_cat

    for cf in category_forecasts:
        if total_predicted > 0:
            cf.pct_of_total = round(cf.predicted / total_predicted, 4)

    num_days = len(expenses["date"].dt.date.unique())
    confidence = "low" if num_days < 30 else "medium" if num_days <= 90 else "high"
    base = {"low": 0.45, "medium": 0.7, "high": 0.88}[confidence]
    recent_std = float(np.std(all_hist[-30:])) if len(all_hist) >= 30 else float(np.std(all_hist)) if all_hist else 0
    variance_penalty = min(0.3, recent_std / (abs(float(np.mean(all_hist[-30:] if len(all_hist) >= 30 else all_hist))) + recent_std + 1e-9)) if all_hist else 0
    confidence_score = round(max(0.05, min(0.98, base - variance_penalty)), 3)

    risk = risk_engine.compute_forecast_risk(
        np.array(all_pred) if all_pred else np.array([0]),
        np.array(all_hist) if all_hist else np.array([0]),
    )

    recs = []
    increasing = [cf for cf in category_forecasts if cf.trend == "increasing"]
    if increasing:
        recs.append(f"{len(increasing)} expense category(ies) trending upward")
    high_spend = [cf for cf in category_forecasts if cf.pct_of_total > 0.3]
    if high_spend:
        names = ", ".join(cf.category for cf in high_spend)
        recs.append(f"High concentration in: {names}")
    if not recs:
        recs.append("Expense forecast appears stable")

    explanations = explainability.explain_timeseries(
        np.array(all_pred) if all_pred else np.array([0]),
        np.array(all_hist) if all_hist else np.array([0]),
        "expenses",
    )

    record = PredictionRecord(
        feature_name="expense_forecast",
        model_used="exponential_smoothing",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_predicted": total_predicted},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return ExpenseForecastResponse(
        category_forecasts=category_forecasts,
        total_predicted_expenses=round(total_predicted, 2),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["exponential_smoothing"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="exponential_smoothing",
    )
