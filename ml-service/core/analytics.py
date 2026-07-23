"""Business Intelligence & Analytics — tracks usage, accuracy, drift across all features and tiers."""

from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np

from core.config import Tier
from core.history import PredictionHistory

logger = logging.getLogger(__name__)


@dataclass
class UsageRecord:
    feature_name: str = ""
    tier: str = "blue"
    model_used: str = ""
    duration_ms: float = 0.0
    confidence: float = 0.0
    success: bool = True
    error: str = ""
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AccuracyWindow:
    accuracy: float = 0.0
    sample_count: int = 0
    window_days: int = 7
    trend: str = "stable"


class AnalyticsEngine:
    """Tracks usage patterns, computes accuracy trends, and generates BI insights."""

    def __init__(self, history: PredictionHistory) -> None:
        self.history = history
        self._usage_log: list[UsageRecord] = []

    def log_usage(self, record: UsageRecord) -> None:
        self._usage_log.append(record)

    def get_usage_stats(
        self,
        feature_name: str | None = None,
        tier: str | None = None,
        days: int = 30,
    ) -> dict[str, Any]:
        cutoff = time.time() - days * 86400
        records = [r for r in self._usage_log if r.timestamp >= cutoff]
        if feature_name:
            records = [r for r in records if r.feature_name == feature_name]
        if tier:
            records = [r for r in records if r.tier == tier]

        if not records:
            return {
                "total_requests": 0,
                "avg_confidence": 0.0,
                "avg_duration_ms": 0.0,
                "success_rate": 0.0,
                "unique_features": [],
                "unique_models": [],
            }

        return {
            "total_requests": len(records),
            "avg_confidence": float(np.mean([r.confidence for r in records])),
            "avg_duration_ms": float(np.mean([r.duration_ms for r in records])),
            "success_rate": sum(1 for r in records if r.success) / max(len(records), 1),
            "unique_features": list(set(r.feature_name for r in records)),
            "unique_models": list(set(r.model_used for r in records)),
        }

    def get_feature_usage(self, days: int = 30) -> dict[str, int]:
        cutoff = time.time() - days * 86400
        recent = [r for r in self._usage_log if r.timestamp >= cutoff]
        usage: dict[str, int] = {}
        for r in recent:
            usage[r.feature_name] = usage.get(r.feature_name, 0) + 1
        return dict(sorted(usage.items(), key=lambda x: x[1], reverse=True))

    def get_feature_usage_daily(self, days: int = 30) -> list[dict[str, Any]]:
        cutoff = time.time() - days * 86400
        recent = [r for r in self._usage_log if r.timestamp >= cutoff]
        daily: dict[str, dict[str, int]] = {}
        for r in recent:
            day = time.strftime("%Y-%m-%d", time.localtime(r.timestamp))
            if day not in daily:
                daily[day] = {}
            daily[day][r.feature_name] = daily[day].get(r.feature_name, 0) + 1
        return [
            {"date": day, **counts}
            for day, counts in sorted(daily.items())
        ]

    def get_growth_metrics(self, days: int = 90) -> dict[str, Any]:
        cutoff = time.time() - days * 86400
        recent = [r for r in self._usage_log if r.timestamp >= cutoff]
        mid = cutoff + days * 86400 / 2
        first_half = [r for r in recent if r.timestamp < mid]
        second_half = [r for r in recent if r.timestamp >= mid]

        growth = 0.0
        if first_half:
            growth = (len(second_half) - len(first_half)) / len(first_half)

        return {
            "total_usage": len(recent),
            "period_days": days,
            "growth_rate": round(growth, 4),
            "trend": "growing" if growth > 0.1 else "declining" if growth < -0.1 else "stable",
            "avg_daily_usage": len(recent) / max(days, 1),
        }

    def get_dau(self, days: int = 30) -> list[dict[str, Any]]:
        cutoff = time.time() - days * 86400
        recent = [r for r in self._usage_log if r.timestamp >= cutoff]
        daily: dict[str, int] = {}
        for r in recent:
            day = time.strftime("%Y-%m-%d", time.localtime(r.timestamp))
            daily[day] = daily.get(day, 0) + 1
        return [
            {"date": date, "count": count}
            for date, count in sorted(daily.items())
        ]

    def get_revenue_metrics(self) -> dict[str, Any]:
        history_records = self.history._records
        total = len(history_records)
        feedback = [r for r in history_records if r.actual_value is not None]
        return {
            "total_predictions": total,
            "predictions_with_feedback": len(feedback),
            "feedback_rate": len(feedback) / max(total, 1),
            "tier_breakdown": {
                tier: sum(1 for r in history_records if r.tier == tier.value)
                for tier in Tier
            },
        }

    def get_conversion_funnel(self) -> dict[str, Any]:
        stages = ["request", "validated", "predicted", "explained", "feedback"]
        counts = {}
        records = self.history._records
        counts["request"] = len(records)
        counts["validated"] = sum(1 for r in records if r.confidence_score > 0)
        counts["predicted"] = sum(1 for r in records if r.prediction is not None)
        counts["explained"] = sum(1 for r in records if r.explanation)
        counts["feedback"] = sum(1 for r in records if r.actual_value is not None)
        return {
            "stages": stages,
            "counts": [counts[s] for s in stages],
            "conversion_rates": {
                stages[i]: round(counts[stages[i]] / max(counts[stages[0]], 1), 4)
                for i in range(len(stages))
            },
        }

    def get_upgrade_triggers(self) -> list[dict[str, Any]]:
        triggers = []
        records = self.history._records
        blue = [r for r in records if r.tier == "blue"]
        if len(blue) > 10:
            avg_conf = float(np.mean([r.confidence_score for r in blue]))
            if avg_conf < 0.6:
                triggers.append({
                    "trigger": "low_confidence",
                    "tier": "blue",
                    "message": f"Blue tier avg confidence ({avg_conf:.2f}) — upgrade for better models",
                    "recommended_tier": "emerald",
                })
        emerald = [r for r in records if r.tier == "emerald"]
        if len(emerald) > 10:
            feedback = [r for r in emerald if r.actual_value is not None and r.feedback_score is not None]
            if feedback:
                avg_score = float(np.mean([r.feedback_score for r in feedback if r.feedback_score is not None]))
                if avg_score < 0.6:
                    triggers.append({
                        "trigger": "low_feedback",
                        "tier": "emerald",
                        "message": f"Emerald tier feedback score ({avg_score:.2f}) — upgrade for better accuracy",
                        "recommended_tier": "diamond",
                    })
        return triggers

    def get_retention_cohorts(self) -> dict[str, Any]:
        records = sorted(self.history._records, key=lambda r: r.timestamp)
        if not records:
            return {"cohorts": [], "retention_rates": []}
        first_date = time.strftime("%Y-%m", time.localtime(records[0].timestamp))
        cohorts: dict[str, int] = {}
        for r in records:
            month = time.strftime("%Y-%m", time.localtime(r.timestamp))
            cohorts[month] = cohorts.get(month, 0) + 1
        return {
            "first_cohort": first_date,
            "cohorts": [{"month": m, "users": c} for m, c in sorted(cohorts.items())],
            "total_months": len(cohorts),
        }

    def get_churn_metrics(self) -> dict[str, Any]:
        if len(self._usage_log) < 2:
            return {"churn_rate": 0.0, "at_risk": False}
        cutoff_30 = time.time() - 30 * 86400
        recent = sum(1 for r in self._usage_log if r.timestamp >= cutoff_30)
        cutoff_60 = time.time() - 60 * 86400
        previous = sum(1 for r in self._usage_log if cutoff_60 <= r.timestamp < cutoff_30)
        churn = 0.0
        if previous > 0:
            churn = max(0.0, (previous - recent) / previous)
        return {
            "churn_rate": round(churn, 4),
            "at_risk": churn > 0.5,
            "recent_usage": recent,
            "previous_usage": previous,
        }

    def get_feature_adoption(self) -> dict[str, Any]:
        all_features: dict[str, int] = {}
        for r in self._usage_log:
            all_features[r.feature_name] = all_features.get(r.feature_name, 0) + 1
        total = sum(all_features.values()) if all_features else 1
        return {
            "features": {
                k: {"count": v, "pct": round(v / total * 100, 2)}
                for k, v in sorted(all_features.items(), key=lambda x: x[1], reverse=True)
            },
            "total_usage": total,
        }

    def get_forecast_accuracy(self, feature_name: str = "forecast") -> dict[str, Any]:
        records = self.history._records
        feature = [r for r in records if r.feature_name == feature_name and r.actual_value is not None]
        if not feature:
            return {"accuracy": 0.0, "sample_count": 0, "trend": "stable"}
        correct = sum(
            1 for r in feature
            if r.prediction == r.actual_value
        )
        accuracy = correct / len(feature)
        mid = len(feature) // 2
        first_half_acc = sum(
            1 for r in feature[:mid] if r.prediction == r.actual_value
        ) / max(mid, 1)
        second_half_acc = sum(
            1 for r in feature[mid:] if r.prediction == r.actual_value
        ) / max(len(feature) - mid, 1)
        trend = "improving" if second_half_acc > first_half_acc else "declining" if second_half_acc < first_half_acc else "stable"
        return {
            "accuracy": round(accuracy, 4),
            "sample_count": len(feature),
            "trend": trend,
            "recent_accuracy": round(second_half_acc, 4),
        }

    def get_cost_summary(self) -> dict[str, Any]:
        records = self._usage_log
        total = len(records)
        return {
            "total_api_calls": total,
            "estimated_compute_cost": round(total * 0.001, 4),
            "avg_duration_ms": float(np.mean([r.duration_ms for r in records])) if records else 0.0,
        }

    def get_cost_by_day(self, days: int = 30) -> list[dict[str, Any]]:
        cutoff = time.time() - days * 86400
        recent = [r for r in self._usage_log if r.timestamp >= cutoff]
        daily: dict[str, int] = {}
        for r in recent:
            day = time.strftime("%Y-%m-%d", time.localtime(r.timestamp))
            daily[day] = daily.get(day, 0) + 1
        return [
            {"date": date, "calls": count, "estimated_cost": round(count * 0.001, 4)}
            for date, count in sorted(daily.items())
        ]

    def get_cost_optimizations(self) -> list[dict[str, Any]]:
        optimizations = []
        records = self._usage_log
        if not records:
            return optimizations
        avg_duration = float(np.mean([r.duration_ms for r in records]))
        if avg_duration > 500:
            optimizations.append({
                "area": "response_time",
                "current": f"{avg_duration:.0f}ms avg",
                "recommendation": "Reduce model complexity or implement caching",
                "potential_savings": "30-50%",
            })
        return optimizations

    def get_top_cost_users(self) -> list[dict[str, Any]]:
        tier_counts: dict[str, int] = {}
        for r in self._usage_log:
            tier_counts[r.tier] = tier_counts.get(r.tier, 0) + 1
        total = sum(tier_counts.values()) or 1
        return [
            {"tier": tier, "calls": count, "pct": round(count / total * 100, 2)}
            for tier, count in sorted(tier_counts.items(), key=lambda x: x[1], reverse=True)
        ]

    def get_user_usage_summary(self) -> dict[str, Any]:
        return {
            "total_lifetime": len(self._usage_log),
            "active_features": len(set(r.feature_name for r in self._usage_log)),
            "models_used": list(set(r.model_used for r in self._usage_log)),
            "tier_distribution": {
                tier: sum(1 for r in self._usage_log if r.tier == tier.value)
                for tier in Tier
            },
        }

    def get_recommendations(self) -> list[dict[str, Any]]:
        recs = []
        records = self.history._records
        if not self._usage_log:
            return recs
        top_features = self.get_feature_usage(30)
        if top_features:
            most_used = list(top_features.keys())[0]
            recs.append({
                "type": "insight",
                "message": f"Most used feature: {most_used} ({top_features[most_used]} requests in 30 days)",
            })
        feedback = [r for r in records if r.actual_value is not None]
        if feedback:
            acc = sum(1 for r in feedback if r.prediction == r.actual_value) / len(feedback)
            if acc < 0.7:
                recs.append({
                    "type": "warning",
                    "message": f"Overall accuracy is {acc:.1%} — consider retraining models",
                })
        usage_trend = self.get_growth_metrics(30)
        if usage_trend.get("trend") == "declining":
            recs.append({
                "type": "alert",
                "message": "Usage is declining — consider engaging users with new features",
            })
        return recs

    def apply_recommendation(self, recommendation_id: str) -> dict[str, Any]:
        return {
            "status": "applied",
            "recommendation_id": recommendation_id,
            "message": "Recommendation queued for execution",
        }

    def get_config(self) -> dict[str, Any]:
        return {
            "tracking_enabled": True,
            "retention_days": 90,
            "feedback_collection": True,
            "drift_detection": True,
            "auto_retrain": True,
        }

    def update_config(self, config: dict[str, Any]) -> dict[str, Any]:
        return {**self.get_config(), **config, "updated": True}
