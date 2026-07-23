# ml-service/services/executive_reporter.py
"""Executive Reports — comprehensive financial reports for decision makers."""

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
    ExecutiveReportRequest, ExecutiveReportResponse, ExecutiveReportSection,
    Explanation, RiskAssessment,
)

logger = logging.getLogger(__name__)


def generate_executive_report(
    req: ExecutiveReportRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> ExecutiveReportResponse:
    df = pd.DataFrame([{"date": t.date, "amount": t.amount} for t in req.transactions])
    df["date"] = pd.to_datetime(df["date"])

    total_income = float(df[df["amount"] > 0]["amount"].sum())
    total_expenses = abs(float(df[df["amount"] < 0]["amount"].sum()))
    net = total_income - total_expenses
    num_days = (df["date"].max() - df["date"].min()).days + 1
    num_months = max(num_days / 30, 1)

    sections = []
    key_metrics = {}

    income_section = ExecutiveReportSection(
        title="Revenue Overview",
        content=f"Total revenue: ${total_income:,.2f} over {num_days} days (${total_income/num_months:,.2f}/month)",
        metrics={"total_revenue": total_income, "monthly_revenue": total_income / num_months, "daily_avg": total_income / max(num_days, 1)},
    )
    sections.append(income_section)
    key_metrics["total_revenue"] = total_income

    expense_section = ExecutiveReportSection(
        title="Expense Overview",
        content=f"Total expenses: ${total_expenses:,.2f} over {num_days} days (${total_expenses/num_months:,.2f}/month)",
        metrics={"total_expenses": total_expenses, "monthly_expenses": total_expenses / num_months},
    )
    sections.append(expense_section)
    key_metrics["total_expenses"] = total_expenses

    profit_section = ExecutiveReportSection(
        title="Profitability",
        content=f"Net: ${net:,.2f} | Margin: {net/max(total_income,1)*100:.1f}%",
        metrics={"net_income": net, "profit_margin": net / max(total_income, 1)},
    )
    sections.append(profit_section)
    key_metrics["net_income"] = net

    daily = df.groupby("date")["amount"].sum().sort_index()
    series = daily.values.astype(float)

    if len(series) >= 14:
        recent_30 = series[-30:] if len(series) >= 30 else series
        recent_avg = float(np.mean(recent_30))
        overall_avg = float(np.mean(series))
        if overall_avg != 0:
            momentum = (recent_avg - overall_avg) / abs(overall_avg)
        else:
            momentum = 0

        trend_section = ExecutiveReportSection(
            title="Trend Analysis",
            content=f"Recent trend: {'improving' if momentum > 0.05 else 'declining' if momentum < -0.05 else 'stable'} ({momentum*100:+.1f}%)",
            metrics={"momentum": momentum, "recent_avg": recent_avg, "overall_avg": overall_avg},
        )
        sections.append(trend_section)

    alerts = []
    if net < 0:
        alerts.append("Negative net cash flow")
    if total_expenses > total_income:
        alerts.append("Expenses exceed revenue")
    if alerts:
        alert_section = ExecutiveReportSection(
            title="Alerts", content="; ".join(alerts), alerts=alerts,
        )
        sections.append(alert_section)

    action_items = []
    if net < 0:
        action_items.append("Review and reduce expenses to restore profitability")
    if total_expenses / max(total_income, 1) > 0.9:
        action_items.append("Expense ratio approaching 100% — optimize spending")

    summary = f"Over {num_days} days, the business generated ${total_income:,.2f} in revenue with ${total_expenses:,.2f} in expenses, resulting in ${net:,.2f} net income."

    confidence = "high" if num_days >= 60 else "medium" if num_days >= 30 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score, data_points=len(df),
        domain_context={"net_income": net},
    )

    recs = recommendations_engine.generate_forecast_recommendations(
        [net / num_months] * 30,
        "improving" if net > 0 else "declining",
        confidence, confidence_score, risk.risk_level,
    )

    explanations = explainability.explain_timeseries(
        np.array([total_income, total_expenses, net]),
        series, "executive report",
    )

    record = PredictionRecord(
        feature_name="executive_report",
        model_used="aggregation",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"net_income": net},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return ExecutiveReportResponse(
        title=f"Financial Executive Report — {datetime.now().strftime('%B %Y')}",
        period=f"Last {num_days} days",
        sections=sections,
        summary=summary,
        key_metrics=key_metrics,
        action_items=action_items,
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["aggregation", "financial_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="aggregation",
    )
