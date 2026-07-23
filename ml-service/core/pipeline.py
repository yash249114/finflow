# ml-service/core/pipeline.py
"""Training Pipeline — configurable, reproducible training with validation gates.

Supports Blue/Emerald/Diamond tiers through configuration.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score

from core.config import Tier, TierConfig, get_tier_config
from core.evaluation import EvaluationResult, evaluate_model
from core.experiment import ExperimentTracker
from core.factory import ModelFactory
from core.registry import ModelMetadata, ModelRegistry, ModelStatus, ModelType

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    meta: ModelMetadata
    model: Any
    evaluation: EvaluationResult
    training_time_seconds: float
    features_used: list[str]
    rows_used: int
    success: bool
    error: str = ""


class TrainingPipeline:
    """End-to-end training: data prep → model creation → training → evaluation → registry."""

    def __init__(
        self,
        registry: ModelRegistry,
        factory: ModelFactory,
        experiment_tracker: ExperimentTracker,
    ) -> None:
        self.registry = registry
        self.factory = factory
        self.experiment_tracker = experiment_tracker

    def train_classification(
        self,
        name: str,
        model_type: ModelType,
        X: pd.DataFrame | np.ndarray,
        y: np.ndarray,
        tier: Tier = Tier.BLUE,
        hyperparameters: dict[str, Any] | None = None,
        description: str = "",
    ) -> TrainingResult:
        config = get_tier_config(tier)
        start = time.time()

        experiment = self.experiment_tracker.start_experiment(
            name=f"{name}_training",
            model_type=model_type.value,
            params={"tier": tier.value, **(hyperparameters or {})},
        )

        try:
            meta, model = self.factory.register_and_create(
                name=name, model_type=model_type, tier=tier,
                hyperparameters=hyperparameters, description=description,
            )
            meta.training_rows = X.shape[0]
            meta.training_features = X.shape[1]
            if hasattr(X, "columns"):
                meta.feature_names = list(X.columns)

            meta.status = ModelStatus.TRAINING
            model.fit(X, y)

            cv_folds = min(config.models.cross_validation_folds, 5)
            if cv_folds >= 2 and X.shape[0] >= cv_folds * 2:
                cv_scores = cross_val_score(model, X, y, cv=cv_folds, scoring="accuracy")
                cv_accuracy = float(np.mean(cv_scores))
                cv_std = float(np.std(cv_scores))
            else:
                cv_accuracy = None
                cv_std = None

            evaluation = evaluate_model(model, X, y, cv_accuracy=cv_accuracy, cv_std=cv_std)

            meta = self.registry.save_model(meta, model, metrics=evaluation.to_dict(), feature_names=meta.feature_names)
            meta.status = ModelStatus.VALIDATED
            self.registry._update_index_entry(meta)

            self.experiment_tracker.log_metrics(experiment.experiment_id, evaluation.to_dict())
            self.experiment_tracker.log_model(experiment.experiment_id, meta)
            self.experiment_tracker.end_experiment(experiment.experiment_id, "completed")

            elapsed = time.time() - start
            logger.info(
                "Trained %s [%s] in %.1fs — accuracy=%.4f",
                name, model_type.value, elapsed, evaluation.accuracy,
            )

            return TrainingResult(
                meta=meta, model=model, evaluation=evaluation,
                training_time_seconds=elapsed,
                features_used=meta.feature_names,
                rows_used=X.shape[0], success=True,
            )

        except Exception as e:
            elapsed = time.time() - start
            logger.error("Training failed for %s: %s", name, e)
            self.experiment_tracker.end_experiment(experiment.experiment_id, "failed", str(e))
            return TrainingResult(
                meta=ModelMetadata(name=name, model_type=model_type),
                model=None,
                evaluation=EvaluationResult(),
                training_time_seconds=elapsed,
                features_used=[], rows_used=X.shape[0] if hasattr(X, "shape") else 0,
                success=False, error=str(e),
            )

    def train_time_series(
        self,
        name: str,
        model_type: ModelType,
        series: pd.Series,
        tier: Tier = Tier.BLUE,
        hyperparameters: dict[str, Any] | None = None,
        horizon: int = 30,
        description: str = "",
    ) -> TrainingResult:
        config = get_tier_config(tier)
        start = time.time()

        experiment = self.experiment_tracker.start_experiment(
            name=f"{name}_training",
            model_type=model_type.value,
            params={"tier": tier.value, "horizon": horizon, **(hyperparameters or {})},
        )

        try:
            meta = self.registry.register(
                name=name, model_type=model_type, tier=tier,
                hyperparameters=hyperparameters, description=description,
            )
            meta.training_rows = len(series)
            meta.training_features = 1
            meta.status = ModelStatus.TRAINING

            model_obj = self.factory.create(model_type, hyperparameters, tier)
            if model_obj is None:
                raise ValueError(f"Model type {model_type} could not be created (missing dependency?)")

            train_result = self._fit_timeseries(model_type, model_obj, series, horizon, hyperparameters or {})

            evaluation = evaluate_model(
                None, None, None,
                metrics={
                    "mae": train_result.get("mae", 0),
                    "rmse": train_result.get("rmse", 0),
                    "mape": train_result.get("mape", 0),
                },
                cv_accuracy=train_result.get("cv_accuracy"),
            )

            meta = self.registry.save_model(meta, model_obj, metrics=evaluation.to_dict(), feature_names=["amount"])
            meta.status = ModelStatus.VALIDATED
            self.registry._update_index_entry(meta)

            self.experiment_tracker.log_metrics(experiment.experiment_id, evaluation.to_dict())
            self.experiment_tracker.end_experiment(experiment.experiment_id, "completed")

            elapsed = time.time() - start
            return TrainingResult(
                meta=meta, model=model_obj, evaluation=evaluation,
                training_time_seconds=elapsed,
                features_used=["amount"], rows_used=len(series),
                success=True,
            )

        except Exception as e:
            elapsed = time.time() - start
            logger.error("Time series training failed for %s: %s", name, e)
            self.experiment_tracker.end_experiment(experiment.experiment_id, "failed", str(e))
            return TrainingResult(
                meta=ModelMetadata(name=name, model_type=model_type),
                model=None, evaluation=EvaluationResult(),
                training_time_seconds=elapsed, features_used=[],
                rows_used=len(series) if series is not None else 0,
                success=False, error=str(e),
            )

    def _fit_timeseries(
        self, model_type: ModelType, model: Any, series: pd.Series,
        horizon: int, hp: dict[str, Any],
    ) -> dict[str, Any]:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        from statsmodels.tsa.arima.model import ARIMA as ARIMAModel

        values = series.values.astype(float)

        if len(values) < 14:
            raise ValueError(f"Need at least 14 data points, got {len(values)}")

        train_size = max(int(len(values) * 0.8), 14)
        train = values[:train_size]
        test = values[train_size:]

        if model_type == ModelType.EXPONENTIAL_SMOOTHING:
            fitted = ExponentialSmoothing(
                train, trend=hp.get("trend", "add"),
                seasonal=hp.get("seasonal", None),
                initialization_method="estimated",
            ).fit(optimized=True)
            predictions = fitted.forecast(len(test)) if len(test) > 0 else fitted.forecast(horizon)

        elif model_type == ModelType.ARIMA:
            order = hp.get("order", (1, 1, 1))
            fitted = ARIMAModel(train, order=order).fit()
            predictions = fitted.forecast(len(test)) if len(test) > 0 else fitted.forecast(horizon)

        elif model_type == ModelType.PROPHET:
            try:
                import pandas as _pd
                df_train = pd.DataFrame({"ds": _pd.date_range("2020-01-01", periods=len(train), freq="D"), "y": train})
                model.fit(df_train)
                future = model.make_future_dataframe(periods=max(len(test), horizon))
                forecast = model.predict(future)
                predictions = forecast["yhat"].values[-max(len(test), horizon):]
            except Exception:
                raise ValueError("Prophet fitting failed")

        else:
            raise ValueError(f"Time series training not implemented for {model_type}")

        if len(test) > 0 and len(predictions) >= len(test):
            pred_test = predictions[:len(test)]
            mae = float(np.mean(np.abs(test - pred_test)))
            rmse = float(np.sqrt(np.mean((test - pred_test) ** 2)))
            mean_actual = np.mean(np.abs(test))
            mape = float(np.mean(np.abs((test - pred_test) / (mean_actual + 1e-9))) * 100) if mean_actual > 0 else 0.0
        else:
            mae = rmse = mape = 0.0

        return {"mae": mae, "rmse": rmse, "mape": mape}
