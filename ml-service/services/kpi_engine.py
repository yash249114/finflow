# ml-service/services/kpi_engine.py
"""Financial KPI Engine — computes key financial metrics and health scores."""

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
    Explanation, KPI, KPIRequest, KPIResponse, RiskAssessment,
)

logger = logging.getLogger(__name__)


def compute_kpis(
    req: KPIRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> KPIResponse:
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

    kpis = []

    kpis.append(KPI(
        name="Monthly Revenue", value=round(monthly_income, 2), unit="USD",
        trend="stable", benchmark=monthly_expenses * 1.1,
        status="ok" if monthly_income > monthly_expenses else "warning",
        explanation=f"Average monthly revenue over {num_days} days",
    ))

    kpis.append(KPI(
        name="Monthly Expenses", value=round(monthly_expenses, 2), unit="USD",
        trend="stable", benchmark=monthly_income * 0.8,
        status="ok" if monthly_expenses < monthly_income else "critical",
        explanation=f"Average monthly expenses",
    ))

    profit_margin = net / max(total_income, 1)
    kpis.append(KPI(
        name="Profit Margin", value=round(profit_margin, 4), unit="ratio",
        trend="stable", benchmark=0.1,
        status="ok" if profit_margin > 0.1 else "warning" if profit_margin > 0 else "critical",
        explanation=f"Net profit margin: {profit_margin:.1%}",
    ))

    expense_ratio = total_expenses / max(total_income, 1)
    kpis.append(KPI(
        name="Expense Ratio", value=round(expense_ratio, 4), unit="ratio",
        trend="stable", benchmark=0.8,
        status="ok" if expense_ratio < 0.8 else "warning" if expense_ratio < 1.0 else "critical",
        explanation=f"Expenses as percentage of revenue: {expense_ratio:.1%}",
    ))

    income_vol = float(df[df["amount"] > 0]["amount"].std()) if len(df[df["amount"] > 0]) > 1 else 0
    income_cv = income_vol / max(monthly_income, 1)
    kpis.append(KPI(
        name="Revenue Volatility", value=round(income_cv, 4), unit="cv",
        trend="stable", benchmark=0.3,
        status="ok" if income_cv < 0.3 else "warning" if income_cv < 0.6 else "critical",
        explanation=f"Coefficient of variation: {income_cv:.2f}",
    ))

    daily_net = df.groupby("date")["amount"].sum()
    days_positive = (daily_net > 0).sum()
    days_negative = (daily_net < 0).sum()
    income_consistency = days_positive / max(days_positive + days_negative, 1)
    kpis.append(KPI(
        name="Income Consistency", value=round(income_consistency, 4), unit="ratio",
        trend="stable", benchmark=0.6,
        status="ok" if income_consistency > 0.5 else "warning",
        explanation=f"{income_consistency:.0%} of days had positive cash flow",
    ))

    avg_daily_income = total_income / max(num_days, 1)
    avg_daily_expenses = total_expenses / max(num_days, 1)
    days_of_runway = (total_income - total_expenses) / max(avg_daily_expenses, 1) if avg_daily_expenses > 0 else 999
    kpis.append(KPI(
        name="Cash Runway Days", value=round(min(days_of_runway, 999), 1), unit="days",
        trend="stable", benchmark=90,
        status="ok" if days_of_runway > 90 else "warning" if days_of_runway > 30 else "critical",
        explanation=f"Estimated days of cash runway",
    ))

    score = 0.0
    weights = [0.15, 0.15, 0.2, 0.15, 0.15, 0.1, 0.1]
    for kpi, w in zip(kpis, weights):
        if kpi.status == "ok":
            score += w
        elif kpi.status == "warning":
            score += w * 0.5
    score = round(min(1.0, score), 4)

    if score >= 0.8:
        grade = "A"
    elif score >= 0.65:
        grade = "B"
    elif score >= 0.5:
        grade = "C"
    elif score >= 0.35:
        grade = "D"
    else:
        grade = "F"

    confidence = "high" if num_days >= 60 else "medium" if num_days >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score, data_points=len(df),
        domain_context={"overall_score": score},
    )

    recs = []
    if score < 0.5:
        recs.append("Overall KPI score is concerning — review key metrics")
    critical_kpis = [k for k in kpis if k.status == "critical"]
    if critical_kpis:
        recs.append(f"{len(critical_kpis)} KPI(s) in critical state")
    if not recs:
        recs.append("KPIs appear healthy — continue monitoring")

    explanations = explainability.explain_timeseries(
        np.array([k.value for k in kpis]),
        np.array([k.benchmark for k in kpis]),
        "KPIs",
    )

    record = PredictionRecord(
        feature_name="kpi_engine",
        model_used="rule_based",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"overall_score": score, "grade": grade},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return KPIResponse(
        kpis=kpis,
        overall_score=score,
        score_grade=grade,
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
