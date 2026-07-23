# ml-service/services/business_health.py
"""Business Health Scoring — comprehensive health assessment from transaction data."""

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
    BusinessHealthRequest, BusinessHealthResponse,
    Explanation, HealthMetric, RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_business_health(
    req: BusinessHealthRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> BusinessHealthResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])

    total_income = float(df[df["amount"] > 0]["amount"].sum())
    total_expenses = abs(float(df[df["amount"] < 0]["amount"].sum()))
    net = total_income - total_expenses
    num_days = (df["date"].max() - df["date"].min()).days + 1
    num_months = max(num_days / 30, 1)

    monthly_income = total_income / num_months
    monthly_expenses = total_expenses / num_months
    monthly_net = net / num_months

    income_volatility = float(df[df["amount"] > 0]["amount"].std()) if len(df[df["amount"] > 0]) > 1 else 0
    expense_volatility = float(df[df["amount"] < 0]["amount"].std()) if len(df[df["amount"] < 0]) > 1 else 0

    runway = req.transactions[-1].amount if req.transactions else 0
    daily_burn = total_expenses / max(num_days, 1)

    metrics = []

    revenue_growth = 0.0
    if num_days >= 30:
        midpoint = df["date"].min() + pd.Timedelta(days=num_days // 2)
        first_half = float(df[df["date"] < midpoint]["amount"].sum())
        second_half = float(df[df["date"] >= midpoint]["amount"].sum())
        if abs(first_half) > 0:
            revenue_growth = (second_half - first_half) / abs(first_half)

    metrics.append(HealthMetric(
        name="Monthly Revenue", value=round(monthly_income, 2),
        benchmark=monthly_expenses * 1.2, status="ok" if monthly_income > monthly_expenses else "warning",
        trend="improving" if revenue_growth > 0.05 else "declining" if revenue_growth < -0.05 else "stable",
    ))

    expense_ratio = monthly_expenses / max(monthly_income, 1)
    metrics.append(HealthMetric(
        name="Expense Ratio", value=round(expense_ratio, 4),
        benchmark=0.8, status="ok" if expense_ratio < 0.9 else "warning" if expense_ratio < 1.1 else "critical",
        trend="stable",
    ))

    savings_rate = (monthly_income - monthly_expenses) / max(monthly_income, 1)
    metrics.append(HealthMetric(
        name="Savings Rate", value=round(savings_rate, 4),
        benchmark=0.1, status="ok" if savings_rate > 0.1 else "warning" if savings_rate > 0 else "critical",
        trend="stable",
    ))

    income_cv = income_volatility / max(monthly_income, 1)
    metrics.append(HealthMetric(
        name="Revenue Stability", value=round(1 - min(income_cv, 1), 4),
        benchmark=0.7, status="ok" if income_cv < 0.3 else "warning" if income_cv < 0.6 else "critical",
        trend="stable",
    ))

    days_with_income = len(df[df["amount"] > 0]["date"].dt.date.unique())
    income_consistency = days_with_income / max(num_days, 1)
    metrics.append(HealthMetric(
        name="Income Consistency", value=round(income_consistency, 4),
        benchmark=0.5, status="ok" if income_consistency > 0.3 else "warning",
        trend="stable",
    ))

    health_score = 0.0
    weights = [0.25, 0.2, 0.25, 0.15, 0.15]
    scores = []
    for m in metrics:
        if m.name == "Expense Ratio":
            s = max(0, 1 - abs(m.value - 0.7) / 0.5)
        elif m.name == "Savings Rate":
            s = min(1, max(0, (m.value + 0.2) / 0.5))
        elif m.name == "Revenue Stability":
            s = m.value
        elif m.name == "Income Consistency":
            s = m.value
        else:
            s = 0.7 if m.status == "ok" else 0.4 if m.status == "warning" else 0.1
        scores.append(s)

    for w, s in zip(weights, scores):
        health_score += w * s
    health_score = round(min(1.0, max(0.0, health_score)), 4)

    if health_score >= 0.8:
        grade = "A"
    elif health_score >= 0.65:
        grade = "B"
    elif health_score >= 0.5:
        grade = "C"
    elif health_score >= 0.35:
        grade = "D"
    else:
        grade = "F"

    strengths = []
    weaknesses = []
    for m in metrics:
        if m.status == "ok":
            strengths.append(f"{m.name}: performing well ({m.value:.2f})")
        elif m.status in ("warning", "critical"):
            weaknesses.append(f"{m.name}: needs attention ({m.value:.2f})")

    confidence = "high" if num_days >= 60 else "medium" if num_days >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        data_points=len(df),
        domain_context={"health_score": health_score},
    )

    recs = []
    if health_score < 0.5:
        recs.append("Business health is concerning — review expenses and revenue streams")
    if expense_ratio > 1:
        recs.append("Expenses exceed income — immediate cost reduction needed")
    if savings_rate < 0:
        recs.append("Negative savings rate — cash reserves are depleting")
    if not recs:
        recs.append("Business health appears stable — continue monitoring")

    explanations = explainability.explain_timeseries(
        np.array([health_score]), np.array([monthly_net, monthly_income]),
        "business health",
    )

    record = PredictionRecord(
        feature_name="business_health",
        model_used="rule_based",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"health_score": health_score, "grade": grade},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return BusinessHealthResponse(
        health_score=health_score,
        health_grade=grade,
        metrics=metrics,
        strengths=strengths,
        weaknesses=weaknesses,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["rule_based", "financial_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="rule_based",
    )
