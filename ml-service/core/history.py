# ml-service/core/history.py
"""Prediction History — log every prediction with full context for audit and feedback."""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PredictionRecord:
    prediction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    feature_name: str = ""
    model_used: str = ""
    model_version: int = 0
    model_id: str = ""
    tier: str = "blue"
    input_summary: str = ""
    prediction: Any = None
    confidence: float = 0.0
    confidence_score: float = 0.0
    risk_score: float = 0.0
    explanation: dict[str, Any] = field(default_factory=dict)
    recommendations: list[str] = field(default_factory=list)
    accuracy: float = 0.0
    timestamp: float = field(default_factory=time.time)
    actual_value: Any = None
    feedback: str = ""
    feedback_at: float | None = None
    feedback_score: float | None = None
    duration_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PredictionHistory:
    """Stores prediction history with feedback loop support."""

    def __init__(self, storage_dir: str = "prediction_history") -> None:
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._records: list[PredictionRecord] = []
        self._load()

    def _history_path(self) -> Path:
        return self.storage_dir / "predictions.json"

    def _load(self) -> None:
        path = self._history_path()
        if path.exists():
            try:
                with open(path) as f:
                    data = json.load(f)
                for entry in data[-10000:]:
                    rec = PredictionRecord(**{k: v for k, v in entry.items() if k in PredictionRecord.__dataclass_fields__})
                    self._records.append(rec)
            except Exception:
                pass

    def _save(self) -> None:
        path = self._history_path()
        with open(path, "w") as f:
            json.dump([r.to_dict() for r in self._records[-10000:]], f, indent=2, default=str)

    def log_prediction(self, record: PredictionRecord) -> None:
        self._records.append(record)
        if len(self._records) % 50 == 0:
            self._save()

    def record_feedback(
        self, prediction_id: str, actual_value: Any,
        feedback: str = "", score: float | None = None,
    ) -> bool:
        for rec in self._records:
            if rec.prediction_id == prediction_id:
                rec.actual_value = actual_value
                rec.feedback = feedback
                rec.feedback_at = time.time()
                rec.feedback_score = score
                self._save()
                logger.info("Feedback recorded for prediction %s", prediction_id)
                return True
        return False

    def get_history(
        self, feature_name: str | None = None,
        model_used: str | None = None,
        tier: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PredictionRecord]:
        results = self._records
        if feature_name:
            results = [r for r in results if r.feature_name == feature_name]
        if model_used:
            results = [r for r in results if r.model_used == model_used]
        if tier:
            results = [r for r in results if r.tier == tier]
        results = sorted(results, key=lambda r: r.timestamp, reverse=True)
        return results[offset:offset + limit]

    def get_accuracy_trend(self, feature_name: str, window: int = 50) -> list[dict[str, Any]]:
        feedback_records = [
            r for r in self._records
            if r.feature_name == feature_name and r.actual_value is not None
        ]
        feedback_records = sorted(feedback_records, key=lambda r: r.timestamp)
        trend = []
        for i in range(len(feedback_records)):
            start = max(0, i - window + 1)
            window_records = feedback_records[start:i + 1]
            correct = sum(
                1 for r in window_records
                if r.prediction == r.actual_value
            )
            trend.append({
                "timestamp": feedback_records[i].timestamp,
                "accuracy": correct / len(window_records) if window_records else 0,
                "window_size": len(window_records),
            })
        return trend

    def get_model_performance(self, feature_name: str | None = None) -> dict[str, dict[str, float]]:
        results: dict[str, list[float]] = {}
        for rec in self._records:
            if rec.actual_value is None:
                continue
            if feature_name and rec.feature_name != feature_name:
                continue
            key = f"{rec.model_used}:{rec.model_version}"
            if rec.prediction == rec.actual_value:
                results.setdefault(key, []).append(1.0)
            else:
                results.setdefault(key, []).append(0.0)
        return {
            k: {"accuracy": sum(v) / len(v), "count": len(v)}
            for k, v in results.items()
            if v
        }

    def get_stats(self, feature_name: str | None = None) -> dict[str, Any]:
        records = self._records
        if feature_name:
            records = [r for r in records if r.feature_name == feature_name]
        feedback_records = [r for r in records if r.actual_value is not None]
        return {
            "total_predictions": len(records),
            "total_feedback": len(feedback_records),
            "feedback_rate": len(feedback_records) / max(len(records), 1),
            "avg_confidence": sum(r.confidence_score for r in records) / max(len(records), 1),
            "avg_risk_score": sum(r.risk_score for r in records) / max(len(records), 1),
        }
