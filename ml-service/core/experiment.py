# ml-service/core/experiment.py
"""Experiment Tracking — log experiments, metrics, parameters, and model lineage."""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from core.registry import ModelMetadata

logger = logging.getLogger(__name__)


@dataclass
class Experiment:
    experiment_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    model_type: str = ""
    status: str = "running"
    params: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)
    model_id: str | None = None
    started_at: float = field(default_factory=time.time)
    ended_at: float | None = None
    duration_seconds: float = 0.0
    error: str = ""
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ExperimentTracker:
    """Tracks experiments with parameters, metrics, and model lineage."""

    def __init__(self, storage_dir: str = "experiments") -> None:
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._active: dict[str, Experiment] = {}
        self._completed: list[Experiment] = []
        self._load_history()

    def _history_path(self) -> Path:
        return self.storage_dir / "history.json"

    def _load_history(self) -> None:
        path = self._history_path()
        if path.exists():
            try:
                with open(path) as f:
                    data = json.load(f)
                for entry in data:
                    exp = Experiment(**{k: v for k, v in entry.items() if k in Experiment.__dataclass_fields__})
                    self._completed.append(exp)
            except Exception:
                pass

    def _save_history(self) -> None:
        path = self._history_path()
        all_exps = list(self._active.values()) + self._completed
        with open(path, "w") as f:
            json.dump([e.to_dict() for e in all_exps[-500:]], f, indent=2)

    def start_experiment(
        self,
        name: str,
        model_type: str = "",
        params: dict[str, Any] | None = None,
        tags: list[str] | None = None,
    ) -> Experiment:
        exp = Experiment(
            name=name, model_type=model_type,
            params=params or {}, tags=tags or [],
        )
        self._active[exp.experiment_id] = exp
        logger.info("Started experiment %s [%s]", exp.experiment_id, name)
        return exp

    def log_metrics(self, experiment_id: str, metrics: dict[str, float]) -> None:
        exp = self._active.get(experiment_id)
        if exp:
            exp.metrics.update(metrics)

    def log_param(self, experiment_id: str, key: str, value: Any) -> None:
        exp = self._active.get(experiment_id)
        if exp:
            exp.params[key] = value

    def log_model(self, experiment_id: str, meta: ModelMetadata) -> None:
        exp = self._active.get(experiment_id)
        if exp:
            exp.model_id = meta.model_id

    def end_experiment(self, experiment_id: str, status: str = "completed", error: str = "") -> None:
        exp = self._active.pop(experiment_id, None)
        if exp:
            exp.status = status
            exp.ended_at = time.time()
            exp.duration_seconds = exp.ended_at - exp.started_at
            exp.error = error
            self._completed.append(exp)
            self._save_history()
            logger.info(
                "Ended experiment %s [%s] — %s (%.1fs)",
                experiment_id, exp.name, status, exp.duration_seconds,
            )

    def get_experiment(self, experiment_id: str) -> Experiment | None:
        if experiment_id in self._active:
            return self._active[experiment_id]
        for exp in self._completed:
            if exp.experiment_id == experiment_id:
                return exp
        return None

    def list_experiments(
        self, name: str | None = None, status: str | None = None, limit: int = 100,
    ) -> list[Experiment]:
        all_exps = list(self._active.values()) + self._completed
        if name:
            all_exps = [e for e in all_exps if e.name == name]
        if status:
            all_exps = [e for e in all_exps if e.status == status]
        return sorted(all_exps, key=lambda e: e.started_at, reverse=True)[:limit]

    def get_best_experiment(self, name: str, metric: str = "accuracy") -> Experiment | None:
        candidates = [e for e in self._completed if e.name == name and metric in e.metrics]
        if not candidates:
            return None
        return max(candidates, key=lambda e: e.metrics.get(metric, 0))

    def compare_experiments(self, experiment_ids: list[str]) -> list[dict[str, Any]]:
        results = []
        for eid in experiment_ids:
            exp = self.get_experiment(eid)
            if exp:
                results.append(exp.to_dict())
        return results
