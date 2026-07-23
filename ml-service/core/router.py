# ml-service/core/router.py
"""Model Router — tier-based model selection, ensemble orchestration, fallback chains.

Every prediction request is routed through the appropriate model(s) for the user's tier.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

from core.config import Tier, TierConfig, get_tier_config
from core.registry import ModelMetadata, ModelRegistry, ModelStatus, ModelType

logger = logging.getLogger(__name__)


class ModelRouter:
    """Routes prediction requests to the appropriate model based on tier."""

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry

    def route(
        self,
        name: str,
        tier: Tier,
        input_data: pd.DataFrame | np.ndarray | pd.Series,
        task: str = "classification",
    ) -> dict[str, Any]:
        config = get_tier_config(tier)
        available_models = config.models.available_models

        if config.models.ensemble and len(available_models) >= 2:
            return self._ensemble_predict(name, tier, input_data, task)

        model_type = self._select_best_model(name, tier)
        if model_type is None:
            fallback = self._get_fallback_model(tier)
            if fallback:
                return self._single_predict(name, fallback, input_data, task)
            return {"error": "No available model for this tier", "tier": tier.value}

        return self._single_predict(name, model_type, input_data, task)

    def _select_best_model(self, name: str, tier: Tier) -> ModelType | None:
        config = get_tier_config(tier)
        for model_name in reversed(config.models.available_models):
            try:
                mt = ModelType(model_name)
                meta = self.registry.get_production(name, mt)
                if meta is not None:
                    return mt
            except ValueError:
                continue
        for model_name in reversed(config.models.available_models):
            try:
                mt = ModelType(model_name)
                meta = self.registry.get_latest(name, mt)
                if meta is not None and meta.status in (ModelStatus.VALIDATED, ModelStatus.TRAINED):
                    return mt
            except ValueError:
                continue
        return None

    def _get_fallback_model(self, tier: Tier) -> ModelType | None:
        fallback_order = [ModelType.LOGISTIC_REGRESSION, ModelType.ARIMA, ModelType.EXPONENTIAL_SMOOTHING]
        for mt in fallback_order:
            try:
                config = get_tier_config(tier)
                if mt.value in config.models.available_models:
                    return mt
            except ValueError:
                continue
        return None

    def _single_predict(
        self, name: str, model_type: ModelType,
        input_data: pd.DataFrame | np.ndarray | pd.Series, task: str,
    ) -> dict[str, Any]:
        meta = self.registry.get_production(name, model_type)
        if meta is None:
            meta = self.registry.get_latest(name, model_type)
        if meta is None:
            return {"error": f"No model found: {name}/{model_type.value}"}

        model = self.registry.load_model(meta)

        if task == "classification" and hasattr(model, "predict"):
            X = input_data if isinstance(input_data, (pd.DataFrame, np.ndarray)) else input_data.values.reshape(-1, 1)
            predictions = model.predict(X)
            probabilities = model.predict_proba(X) if hasattr(model, "predict_proba") else None

            return {
                "model_used": model_type.value,
                "model_version": meta.version,
                "model_id": meta.model_id,
                "predictions": predictions.tolist(),
                "probabilities": probabilities.tolist() if probabilities is not None else None,
                "confidence_score": meta.metrics.get("confidence_score", 0.0),
            }

        elif task == "timeseries":
            return {
                "model_used": model_type.value,
                "model_version": meta.version,
                "model_id": meta.model_id,
                "model_params": meta.hyperparameters,
                "status": "ready",
            }

        return {"error": f"Unknown task: {task}"}

    def _ensemble_predict(
        self, name: str, tier: Tier,
        input_data: pd.DataFrame | np.ndarray | pd.Series, task: str,
    ) -> dict[str, Any]:
        config = get_tier_config(tier)
        all_predictions = []
        model_versions = []

        for model_name in config.models.available_models:
            try:
                mt = ModelType(model_name)
                result = self._single_predict(name, mt, input_data, task)
                if "predictions" in result:
                    all_predictions.append(result["predictions"])
                    model_versions.append({
                        "model": model_name,
                        "version": result.get("model_version", 0),
                        "model_id": result.get("model_id", ""),
                    })
            except Exception as e:
                logger.warning("Ensemble member %s failed: %s", model_name, e)

        if not all_predictions:
            return {"error": "All ensemble models failed", "tier": tier.value}

        ensemble_pred = np.mean(all_predictions, axis=0)
        ensemble_std = np.std(all_predictions, axis=0) if len(all_predictions) > 1 else np.zeros_like(ensemble_pred)

        return {
            "model_used": "ensemble",
            "model_version": 0,
            "model_id": f"ensemble_{name}",
            "predictions": ensemble_pred.tolist(),
            "confidence_score": float(1.0 - np.mean(ensemble_std)),
            "ensemble_members": model_versions,
            "ensemble_size": len(all_predictions),
            "prediction_variance": ensemble_std.tolist(),
        }

    def get_model_info(self, name: str, tier: Tier) -> dict[str, Any]:
        config = get_tier_config(tier)
        models = []
        for model_name in config.models.available_models:
            try:
                mt = ModelType(model_name)
                meta = self.registry.get_production(name, mt)
                if meta is None:
                    meta = self.registry.get_latest(name, mt)
                if meta:
                    models.append({
                        "type": model_name,
                        "version": meta.version,
                        "status": meta.status.value,
                        "metrics": meta.metrics,
                    })
            except ValueError:
                continue
        return {
            "name": name,
            "tier": tier.value,
            "models": models,
            "ensemble_enabled": config.models.ensemble,
        }
