# ml-service/core/registry.py
"""Model Registry — versioned model storage with metadata, lineage, and lifecycle management.

Supports Blue/Emerald/Diamond tiers through configuration, not duplicated code.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import joblib

from core.config import Tier, TierConfig, get_tier_config

logger = logging.getLogger(__name__)


class ModelStatus(str, Enum):
    REGISTERED = "registered"
    TRAINING = "training"
    TRAINED = "trained"
    VALIDATED = "validated"
    PRODUCTION = "production"
    SHADOW = "shadow"
    ARCHIVED = "archived"
    FAILED = "failed"


class ModelType(str, Enum):
    LOGISTIC_REGRESSION = "logistic_regression"
    CATBOOST = "catboost"
    LIGHTGBM = "lightgbm"
    XGBOOST = "xgboost"
    PROPHET = "prophet"
    ARIMA = "arima"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    LSTM = "lstm"
    TRANSFORMER = "transformer"
    ENSEMBLE = "ensemble"
    ISOLATION_FOREST = "isolation_forest"
    ZSCORE = "zscore"


@dataclass
class ModelMetadata:
    model_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    model_type: ModelType = ModelType.LOGISTIC_REGRESSION
    version: int = 1
    status: ModelStatus = ModelStatus.REGISTERED
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    trained_at: float | None = None
    deployed_at: float | None = None
    training_rows: int = 0
    training_features: int = 0
    hyperparameters: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)
    tier: Tier = Tier.BLUE
    feature_names: list[str] = field(default_factory=list)
    target_name: str = ""
    parent_model_id: str | None = None
    tags: list[str] = field(default_factory=list)
    description: str = ""
    artifact_path: str = ""
    checksum: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["model_type"] = self.model_type.value
        d["status"] = self.status.value
        d["tier"] = self.tier.value
        return d


class ModelRegistry:
    """Thread-safe model registry with versioning, lineage, and lifecycle."""

    def __init__(self, registry_dir: str = "model_registry") -> None:
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self._index_path = self.registry_dir / "index.json"
        self._index: dict[str, list[dict[str, Any]]] = self._load_index()

    def _load_index(self) -> dict[str, list[dict[str, Any]]]:
        if self._index_path.exists():
            with open(self._index_path, "r") as f:
                return json.load(f)
        return {}

    def _save_index(self) -> None:
        with open(self._index_path, "w") as f:
            json.dump(self._index, f, indent=2)

    def _model_dir(self, model_id: str, version: int) -> Path:
        d = self.registry_dir / model_id / f"v{version}"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def register(
        self,
        name: str,
        model_type: ModelType,
        tier: Tier = Tier.BLUE,
        hyperparameters: dict[str, Any] | None = None,
        description: str = "",
        tags: list[str] | None = None,
    ) -> ModelMetadata:
        meta = ModelMetadata(
            name=name,
            model_type=model_type,
            tier=tier,
            hyperparameters=hyperparameters or {},
            description=description,
            tags=tags or [],
        )
        entry = meta.to_dict()
        key = f"{name}:{model_type.value}"
        if key not in self._index:
            self._index[key] = []
        self._index[key].append(entry)
        self._save_index()
        logger.info("Registered model %s v%d [%s]", name, meta.version, model_type.value)
        return meta

    def save_model(
        self,
        meta: ModelMetadata,
        model_obj: Any,
        metrics: dict[str, float] | None = None,
        feature_names: list[str] | None = None,
    ) -> ModelMetadata:
        model_dir = self._model_dir(meta.model_id, meta.version)
        artifact_path = model_dir / "model.joblib"
        joblib.dump(model_obj, artifact_path)

        meta.artifact_path = str(artifact_path)
        meta.checksum = str(artifact_path.stat().st_mtime_ns)
        if metrics:
            meta.metrics = metrics
        if feature_names:
            meta.feature_names = feature_names
        meta.status = ModelStatus.TRAINED
        meta.trained_at = time.time()
        meta.updated_at = time.time()

        self._update_index_entry(meta)
        logger.info("Saved model %s v%d to %s", meta.name, meta.version, artifact_path)
        return meta

    def load_model(self, meta: ModelMetadata) -> Any:
        if not meta.artifact_path:
            raise FileNotFoundError(f"No artifact path for model {meta.model_id}")
        path = Path(meta.artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found: {path}")
        return joblib.load(path)

    def promote(self, meta: ModelMetadata) -> ModelMetadata:
        key = f"{meta.name}:{meta.model_type.value}"
        for entry in self._index.get(key, []):
            if entry["status"] == ModelStatus.PRODUCTION.value and entry["model_id"] != meta.model_id:
                entry["status"] = ModelStatus.ARCHIVED.value
                entry["updated_at"] = time.time()
        meta.status = ModelStatus.PRODUCTION
        meta.deployed_at = time.time()
        meta.updated_at = time.time()
        self._update_index_entry(meta)
        self._save_index()
        logger.info("Promoted model %s v%d to PRODUCTION", meta.name, meta.version)
        return meta

    def get_production(self, name: str, model_type: ModelType) -> ModelMetadata | None:
        key = f"{name}:{model_type.value}"
        for entry in self._index.get(key, []):
            if entry["status"] == ModelStatus.PRODUCTION.value:
                return self._entry_to_meta(entry)
        return None

    def get_latest(self, name: str, model_type: ModelType) -> ModelMetadata | None:
        key = f"{name}:{model_type.value}"
        entries = self._index.get(key, [])
        if not entries:
            return None
        latest = max(entries, key=lambda e: e.get("version", 0))
        return self._entry_to_meta(latest)

    def list_models(self, name: str | None = None, status: ModelStatus | None = None) -> list[ModelMetadata]:
        results = []
        for key, entries in self._index.items():
            if name and not key.startswith(f"{name}:"):
                continue
            for entry in entries:
                if status and entry.get("status") != status.value:
                    continue
                results.append(self._entry_to_meta(entry))
        return results

    def rollback(self, name: str, model_type: ModelType) -> ModelMetadata | None:
        key = f"{name}:{model_type.value}"
        entries = self._index.get(key, [])
        production = [e for e in entries if e.get("status") == ModelStatus.PRODUCTION.value]
        if not production:
            return None
        prod_entry = production[0]
        prod_entry["status"] = ModelStatus.ARCHIVED.value
        prod_entry["updated_at"] = time.time()
        candidates = sorted(
            [e for e in entries if e.get("status") == ModelStatus.VALIDATED.value],
            key=lambda e: e.get("version", 0),
            reverse=True,
        )
        if candidates:
            rollback_entry = candidates[0]
            rollback_entry["status"] = ModelStatus.PRODUCTION.value
            rollback_entry["deployed_at"] = time.time()
            rollback_entry["updated_at"] = time.time()
            self._save_index()
            return self._entry_to_meta(rollback_entry)
        self._save_index()
        return None

    def _update_index_entry(self, meta: ModelMetadata) -> None:
        key = f"{meta.name}:{meta.model_type.value}"
        entries = self._index.get(key, [])
        for i, entry in enumerate(entries):
            if entry.get("model_id") == meta.model_id:
                entries[i] = meta.to_dict()
                break
        self._save_index()

    def _entry_to_meta(self, entry: dict[str, Any]) -> ModelMetadata:
        entry = entry.copy()
        entry["model_type"] = ModelType(entry["model_type"])
        entry["status"] = ModelStatus(entry["status"])
        entry["tier"] = Tier(entry["tier"])
        return ModelMetadata(**{k: v for k, v in entry.items() if k in ModelMetadata.__dataclass_fields__})

    def enforce_version_limit(self, name: str, model_type: ModelType, max_versions: int) -> list[ModelMetadata]:
        key = f"{name}:{model_type.value}"
        entries = sorted(self._index.get(key, []), key=lambda e: e.get("version", 0))
        archived = []
        while len(entries) > max_versions:
            oldest = entries.pop(0)
            if oldest.get("status") in (ModelStatus.PRODUCTION.value, ModelStatus.TRAINING.value):
                continue
            oldest["status"] = ModelStatus.ARCHIVED.value
            oldest["updated_at"] = time.time()
            archived.append(self._entry_to_meta(oldest))
        self._index[key] = entries
        self._save_index()
        return archived
