# ml-service/core/recommendations.py
"""Recommendation Engine — generates actionable recommendations for every prediction.

Recommendations are context-aware and tier-appropriate.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """Generates actionable recommendations from predictions and context."""

    def generate_classification_recommendations(
        self,
        prediction: str,
        confidence: float,
        probabilities: dict[str, float] | None = None,
        top_features: list[dict[str, Any]] | None = None,
        risk_level: str = "low",
        context: dict[str, Any] | None = None,
    ) -> list[str]:
        recs = []

        if confidence < 0.5:
            recs.append(f"Low confidence ({confidence:.0%}) — manual review recommended for '{prediction}' classification")

        if probabilities:
            sorted_probs = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
            if len(sorted_probs) >= 2:
                top_two_diff = sorted_probs[0][1] - sorted_probs[1][1]
                if top_two_diff < 0.15:
                    recs.append(
                        f"Ambiguous classification: '{sorted_probs[0][0]}' ({sorted_probs[0][1]:.0%}) "
                        f"vs '{sorted_probs[1][0]}' ({sorted_probs[1][1]:.0%}) — consider rule-based override"
                    )

        if risk_level in ("high", "critical"):
            recs.append("High risk classification — flag for supervisor review")

        if top_features:
            primary = top_features[0]
            if "feature" in primary:
                recs.append(f"Primary signal: '{primary['feature']}' — verify this matches the transaction description")

        if context:
            amount = context.get("amount", 0)
            if abs(amount) > 10000:
                recs.append(f"Large transaction (${amount:,.2f}) — verify category accuracy")

            if prediction == "Other" and confidence < 0.3:
                recs.append("Consider creating a new category or mapping this to an existing one")

        if not recs:
            recs.append(f"Classification '{prediction}' appears reliable — no action needed")

        return recs

    def generate_forecast_recommendations(
        self,
        predictions: list[float],
        trend: str,
        confidence: str,
        confidence_score: float,
        risk_level: str = "low",
        historical_stats: dict[str, float] | None = None,
    ) -> list[str]:
        recs = []
        forecast_mean = float(np.mean(predictions)) if predictions else 0
        forecast_total = float(np.sum(predictions)) if predictions else 0

        if trend == "declining":
            recs.append("Cash flow trend is declining — review upcoming expenses and consider delaying non-essential purchases")
            if forecast_total < 0:
                recs.append(f"Projected net cash flow of ${forecast_total:,.2f} over forecast period — monitor closely")
        elif trend == "improving":
            recs.append("Positive cash flow trend — good time to invest in growth initiatives or build reserves")
        else:
            recs.append("Cash flow is stable — maintain current spending patterns")

        if confidence == "low":
            recs.append("Low forecast confidence — use conservative estimates for planning")

        if confidence_score < 0.5:
            recs.append("Model confidence is low — verify data quality and consider collecting more history")

        if risk_level in ("high", "critical"):
            recs.append("High forecast risk — prepare contingency plans")

        if historical_stats:
            recent_avg = historical_stats.get("recent_avg", 0)
            if recent_avg > 0 and forecast_mean < recent_avg * 0.7:
                recs.append("Forecast significantly below recent average — investigate potential revenue gaps")
            if recent_avg < 0 and forecast_mean > 0:
                recs.append("Forecast shows recovery from negative cash flow — validate assumptions")

        if forecast_total < -50000:
            recs.append("Significant projected cash deficit — consider emergency funding options")
        elif forecast_total > 100000:
            recs.append("Strong projected cash surplus — consider investment opportunities")

        if not recs:
            recs.append("Forecast looks healthy — continue monitoring")

        return recs

    def generate_anomaly_recommendations(
        self,
        anomalies: list[dict[str, Any]],
        category: str = "",
        context: dict[str, Any] | None = None,
    ) -> list[str]:
        recs = []
        if not anomalies:
            recs.append("No anomalies detected — spending patterns appear normal")
            return recs

        recs.append(f"Detected {len(anomalies)} anomalous transactions — review recommended")

        for anomaly in anomalies[:3]:
            val = anomaly.get("amount", anomaly.get("value", 0))
            z = anomaly.get("z_score", 0)
            if abs(z) > 3:
                recs.append(f"Extreme anomaly (z={z:.1f}): ${val:,.2f} — investigate immediately")
            elif abs(z) > 2.5:
                recs.append(f"Notable anomaly (z={z:.1f}): ${val:,.2f} — verify if expected")

        if category:
            recs.append(f"Anomalies in '{category}' — check if vendor or billing changed")

        if context and context.get("is_recurring", False):
            recs.append("Recurring expense with anomalies — verify contract terms")

        return recs

    def generate_runway_recommendations(
        self,
        runway_days: float,
        monthly_burn: float,
        current_balance: float,
        trend: str = "stable",
    ) -> list[str]:
        recs = []

        if runway_days < 30:
            recs.append(f"CRITICAL: Only {runway_days:.0f} days of runway remaining — immediate action required")
            recs.append("Consider emergency cost cuts or bridge financing")
        elif runway_days < 90:
            recs.append(f"Warning: {runway_days:.0f} days of runway — begin fundraising or cost reduction planning")
        elif runway_days < 180:
            recs.append(f"Runway of {runway_days:.0f} days — adequate but monitor burn rate")
        else:
            recs.append(f"Healthy runway of {runway_days:.0f} days — focus on growth")

        if monthly_burn > 0:
            recs.append(f"Monthly burn rate: ${monthly_burn:,.2f} — review discretionary spending")

        if trend == "increasing":
            recs.append("Burn rate is increasing — identify and cut non-essential expenses")
        elif trend == "decreasing":
            recs.append("Burn rate is decreasing — good cost discipline")

        return recs

    def generate_expense_recommendations(
        self,
        category: str,
        amount: float,
        percentile: float,
        trend: str,
        budget_remaining: float | None = None,
    ) -> list[str]:
        recs = []

        if percentile > 90:
            recs.append(f"'{category}' spending at {percentile:.0f}th percentile — above typical range")
        elif percentile < 10:
            recs.append(f"'{category}' spending unusually low at {percentile:.0f}th percentile")

        if trend == "increasing":
            recs.append(f"'{category}' spending is trending upward — review for optimization")
        elif trend == "decreasing":
            recs.append(f"'{category}' spending is decreasing — good cost management")

        if budget_remaining is not None:
            if budget_remaining < 0:
                recs.append(f"Over budget in '{category}' by ${abs(budget_remaining):,.2f} — take corrective action")
            elif budget_remaining < amount * 0.2:
                recs.append(f"Running low on '{category}' budget — ${budget_remaining:,.2f} remaining")

        if not recs:
            recs.append(f"'{category}' spending appears within normal range")

        return recs
