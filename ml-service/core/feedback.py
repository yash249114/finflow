# ml-service/core/feedback.py
"""Continuous Improvement — feedback loop, model retraining triggers, drift detection.

Models improve over time through feedback collection, performance monitoring,
and automated retraining triggers.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from core.history import PredictionHistory
from core.registry import ModelMetadata, ModelRegistry, ModelStatus, ModelType
from core.config import Tier, get_tier_config

logger = logging.getLogger(__name__)


@dataclass
class DriftSignal:
    detected: bool = False
    drift_type: str = ""
    severity: float = 0.0
    description: str = ""
    detected_at: float = field(default_factory=time.time)
    metrics: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "detected": self.detected,
            "drift_type": self.drift_type,
            "severity": self.severity,
            "description": self.description,
            "detected_at": self.detected_at,
            "metrics": self.metrics,
        }


@dataclass
class RetrainTrigger:
    should_retrain: bool = False
    reason: str = ""
    urgency: str = "low"
    detected_at: float = field(default_factory=time.time)
    metrics: dict[str, Any] = field(default_factory=dict)


class ContinuousImprovement:
    """Monitors model performance, detects drift, and triggers retraining."""

    def __init__(self, registry: ModelRegistry, history: PredictionHistory) -> None:
        self.registry = registry
        self.history = history
        self._drift_history: list[DriftSignal] = []

    def check_retrain_needed(
        self,
        feature_name: str,
        tier: Tier = Tier.BLUE,
    ) -> RetrainTrigger:
        config = get_tier_config(tier)
        trigger = RetrainTrigger()

        perf = self.history.get_model_performance(feature_name)
        if not perf:
            return trigger

        for model_key, stats in perf.items():
            accuracy = stats.get("accuracy", 0)
            count = stats.get("count", 0)
            threshold = config.models.retrain_interval_hours

            if count >= 20 and accuracy < 0.6:
                trigger.should_retrain = True
                trigger.reason = f"Model {model_key} accuracy dropped to {accuracy:.2%}"
                trigger.urgency = "high"
                trigger.metrics = {"accuracy": accuracy, "sample_count": count}
                return trigger

            if count >= 50 and accuracy < 0.7:
                trigger.should_retrain = True
                trigger.reason = f"Model {model_key} accuracy at {accuracy:.2%} with {count} samples"
                trigger.urgency = "medium"
                trigger.metrics = {"accuracy": accuracy, "sample_count": count}
                return trigger

        return trigger

    def detect_drift(
        self,
        feature_name: str,
        recent_window: int = 50,
        baseline_window: int = 200,
    ) -> DriftSignal:
        signal = DriftSignal()
        records = [
            r for r in self.history._records
            if r.feature_name == feature_name and r.actual_value is not None
        ]
        records = sorted(records, key=lambda r: r.timestamp)

        if len(records) < recent_window + 10:
            return signal

        recent = records[-recent_window:]
        baseline = records[-(recent_window + baseline_window):-recent_window] if len(records) >= recent_window + baseline_window else records[:len(records) - recent_window]

        if not baseline:
            return signal

        recent_correct = [1.0 if r.prediction == r.actual_value else 0.0 for r in recent]
        baseline_correct = [1.0 if r.prediction == r.actual_value else 0.0 for r in baseline]

        recent_acc = np.mean(recent_correct)
        baseline_acc = np.mean(baseline_correct)

        drift_magnitude = abs(recent_acc - baseline_acc)

        if drift_magnitude > 0.15:
            signal.detected = True
            signal.drift_type = "performance"
            signal.severity = min(1.0, drift_magnitude * 3)
            signal.description = (
                f"Performance drift detected: accuracy dropped from {baseline_acc:.2%} "
                f"to {recent_acc:.2%} ({drift_magnitude:.1%} change)"
            )
            signal.metrics = {
                "recent_accuracy": float(recent_acc),
                "baseline_accuracy": float(baseline_acc),
                "drift_magnitude": float(drift_magnitude),
            }
        elif drift_magnitude > 0.08:
            signal.detected = True
            signal.drift_type = "warning"
            signal.severity = drift_magnitude * 2
            signal.description = f"Early drift warning: accuracy change of {drift_magnitude:.1%}"
            signal.metrics = {
                "recent_accuracy": float(recent_acc),
                "baseline_accuracy": float(baseline_acc),
            }

        self._drift_history.append(signal)
        return signal

    def get_drift_history(self, feature_name: str | None = None) -> list[DriftSignal]:
        if feature_name:
            return [d for d in self._drift_history if feature_name in d.description]
        return list(self._drift_history)

    def compute_feedback_stats(self, feature_name: str | None = None) -> dict[str, Any]:
        records = self.history._records
        if feature_name:
            records = [r for r in records if r.feature_name == feature_name]

        total = len(records)
        with_feedback = [r for r in records if r.actual_value is not None]
        correct = [r for r in with_feedback if r.prediction == r.actual_value]

        feedback_scores = [r.feedback_score for r in records if r.feedback_score is not None]
        avg_feedback = float(np.mean(feedback_scores)) if feedback_scores else None

        return {
            "total_predictions": total,
            "predictions_with_feedback": len(with_feedback),
            "feedback_rate": len(with_feedback) / max(total, 1),
            "accuracy_from_feedback": len(correct) / max(len(with_feedback), 1),
            "avg_feedback_score": avg_feedback,
            "unique_models_used": list(set(r.model_used for r in records)),
        }

    def should_auto_retrain(self, feature_name: str, tier: Tier) -> tuple[bool, str]:
        trigger = self.check_retrain_needed(feature_name, tier)
        if trigger.should_retrain:
            return True, trigger.reason

        drift = self.detect_drift(feature_name)
        if drift.detected and drift.severity > 0.3:
            return True, f"Drift detected: {drift.description}"

        stats = self.compute_feedback_stats(feature_name)
        if stats["feedback_rate"] > 0.3 and stats["accuracy_from_feedback"] < 0.65:
            return True, f"Low accuracy ({stats['accuracy_from_feedback']:.2%}) from feedback data"

        return False, ""

    def recommend_model_changes(self, feature_name: str, tier: Tier) -> list[dict[str, Any]]:
        recommendations = []
        perf = self.history.get_model_performance(feature_name)

        for model_key, stats in perf.items():
            acc = stats.get("accuracy", 0)
            count = stats.get("count", 0)
            if count >= 20 and acc < 0.6:
                recommendations.append({
                    "action": "retrain",
                    "model": model_key,
                    "reason": f"Low accuracy ({acc:.2%})",
                    "urgency": "high",
                })

        drift = self.detect_drift(feature_name)
        if drift.detected:
            recommendations.append({
                "action": "retrain",
                "model": "all",
                "reason": drift.description,
                "urgency": "high" if drift.severity > 0.5 else "medium",
            })

        return recommendations
