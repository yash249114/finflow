# ml-service/services/vendor_analyzer.py
"""Vendor Analysis — spend analysis, concentration risk, vendor profiling."""

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
    Explanation, RiskAssessment, VendorAnalysisResponse, VendorProfile,
    VendorRequest,
)

logger = logging.getLogger(__name__)


def compute_vendor_analysis(
    req: VendorRequest,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    tier: Tier,
) -> VendorAnalysisResponse:
    df = pd.DataFrame([{"vendor": t.vendor, "amount": abs(t.amount), "date": t.date, "category": t.category} for t in req.transactions])

    if df.empty:
        raise ValueError("No vendor transactions to analyze")

    vendor_profiles = []
    total_spend = float(df["amount"].sum())

    for vendor, group in df.groupby("vendor"):
        total = float(group["amount"].sum())
        avg = float(group["amount"].mean())
        count = len(group)

        if count >= 2:
            amounts = group["amount"].values.astype(float)
            mean_val = float(np.mean(amounts))
            std_val = float(np.std(amounts))
            cv = std_val / max(mean_val, 1e-9)
            if cv > 0.5:
                trend = "volatile"
            elif len(amounts) >= 3:
                first_half = float(np.mean(amounts[:len(amounts) // 2]))
                second_half = float(np.mean(amounts[len(amounts) // 2:]))
                if first_half > 0:
                    change = (second_half - first_half) / first_half
                    trend = "increasing" if change > 0.1 else "decreasing" if change < -0.1 else "stable"
                else:
                    trend = "stable"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"

        concentration = total / max(total_spend, 1)
        risk_score = min(1.0, concentration * 2 + (0.2 if count > 20 else 0))

        if concentration > 0.3:
            recommendation = f"High concentration risk ({concentration:.0%} of total spend) — diversify vendors"
        elif trend == "increasing":
            recommendation = f"Spend increasing — review pricing and contracts"
        elif trend == "volatile":
            recommendation = f"Volatile spending — consider fixed-price contracts"
        else:
            recommendation = f"Stable vendor relationship"

        vendor_profiles.append(VendorProfile(
            name=vendor,
            total_spend=round(total, 2),
            avg_transaction=round(avg, 2),
            transaction_count=count,
            trend=trend,
            risk_score=round(risk_score, 3),
            recommendation=recommendation,
        ))

    vendor_profiles.sort(key=lambda v: v.total_spend, reverse=True)
    top_concentration = vendor_profiles[0].total_spend / max(total_spend, 1) if vendor_profiles else 0

    confidence = "high" if len(req.transactions) >= 20 else "medium" if len(req.transactions) >= 5 else "low"
    confidence_score = {"low": 0.5, "medium": 0.7, "high": 0.85}[confidence]

    risk = risk_engine.compute_risk(
        confidence=confidence_score,
        domain_context={"total_spend": total_spend, "vendor_count": len(vendor_profiles)},
    )

    recs = []
    if top_concentration > 0.3:
        recs.append(f"Top vendor represents {top_concentration:.0%} of spend — diversification needed")
    high_risk = [v for v in vendor_profiles if v.risk_score > 0.5]
    if high_risk:
        recs.append(f"{len(high_risk)} vendor(s) flagged as high-risk")
    if not recs:
        recs.append("Vendor portfolio appears well-balanced")

    explanations = explainability.explain_timeseries(
        np.array([v.total_spend for v in vendor_profiles]),
        np.array([v.risk_score for v in vendor_profiles]),
        "vendor spend",
    )

    record = PredictionRecord(
        feature_name="vendor_analysis",
        model_used="statistical_analysis",
        confidence=confidence_score,
        confidence_score=confidence_score,
        risk_score=risk.overall_risk,
        prediction={"total_spend": total_spend, "vendor_count": len(vendor_profiles)},
        explanation={"reasoning": explanations.get("reasoning", "")},
        recommendations=recs,
    )
    history.log_prediction(record)

    return VendorAnalysisResponse(
        vendors=vendor_profiles,
        total_spend=round(total_spend, 2),
        top_vendor_concentration=round(top_concentration, 4),
        accuracy=confidence_score,
        confidence=confidence_score,
        confidence_score=confidence_score,
        explanation=Explanation(
            methods_used=["statistical_analysis"],
            reasoning=explanations.get("reasoning", ""),
        ),
        recommendations=recs,
        risk=RiskAssessment(
            overall_risk=risk.overall_risk,
            risk_level=risk.risk_level,
        ),
        model_used="statistical_analysis",
    )
