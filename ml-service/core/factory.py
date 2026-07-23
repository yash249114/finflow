# ml-service/core/factory.py
"""Model Factory — creates, configures, and manages all supported model types.

Supports: CatBoost, LightGBM, XGBoost, Prophet, ARIMA, ExponentialSmoothing,
LSTM, Transformer, LogisticRegression, IsolationForest, ZScore.

All model selection is driven by TierConfig — never duplicated code.
"""

from __future__ import annotations

import logging
from typing import Any

from core.config import ModelConfig, Tier, TierConfig, get_tier_config
from core.registry import ModelMetadata, ModelRegistry, ModelType

logger = logging.getLogger(__name__)


class ModelFactory:
    """Creates model instances based on type and tier configuration."""

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry

    def create(
        self,
        model_type: ModelType,
        hyperparameters: dict[str, Any] | None = None,
        tier: Tier = Tier.BLUE,
    ) -> Any:
        hp = hyperparameters or {}
        config = get_tier_config(tier).models

        if model_type == ModelType.LOGISTIC_REGRESSION:
            return self._create_logistic_regression(hp)
        elif model_type == ModelType.CATBOOST:
            return self._create_catboost(hp)
        elif model_type == ModelType.LIGHTGBM:
            return self._create_lightgbm(hp)
        elif model_type == ModelType.XGBOOST:
            return self._create_xgboost(hp)
        elif model_type == ModelType.PROPHET:
            return self._create_prophet(hp)
        elif model_type == ModelType.ARIMA:
            return self._create_arima(hp)
        elif model_type == ModelType.EXPONENTIAL_SMOOTHING:
            return self._create_exponential_smoothing(hp)
        elif model_type == ModelType.LSTM:
            return self._create_lstm(hp)
        elif model_type == ModelType.TRANSFORMER:
            return self._create_transformer(hp)
        elif model_type == ModelType.ENSEMBLE:
            return self._create_ensemble(hp, config)
        elif model_type == ModelType.ISOLATION_FOREST:
            return self._create_isolation_forest(hp)
        elif model_type == ModelType.ZSCORE:
            return self._create_zscore(hp)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    def get_available_models(self, tier: Tier) -> list[ModelType]:
        config = get_tier_config(tier).models
        mapping = {
            "logistic_regression": ModelType.LOGISTIC_REGRESSION,
            "catboost": ModelType.CATBOOST,
            "lightgbm": ModelType.LIGHTGBM,
            "xgboost": ModelType.XGBOOST,
            "prophet": ModelType.PROPHET,
            "arima": ModelType.ARIMA,
            "exponential_smoothing": ModelType.EXPONENTIAL_SMOOTHING,
            "lstm": ModelType.LSTM,
            "transformer": ModelType.TRANSFORMER,
        }
        result = []
        for name in config.available_models:
            if name in mapping:
                result.append(mapping[name])
        return result

    def register_and_create(
        self,
        name: str,
        model_type: ModelType,
        tier: Tier = Tier.BLUE,
        hyperparameters: dict[str, Any] | None = None,
        description: str = "",
    ) -> tuple[ModelMetadata, Any]:
        meta = self.registry.register(
            name=name,
            model_type=model_type,
            tier=tier,
            hyperparameters=hyperparameters,
            description=description,
        )
        model = self.create(model_type, hyperparameters, tier)
        return meta, model

    def _create_logistic_regression(self, hp: dict[str, Any]) -> Any:
        from sklearn.linear_model import LogisticRegression
        return LogisticRegression(
            max_iter=hp.get("max_iter", 1000),
            C=hp.get("C", 1.0),
            class_weight=hp.get("class_weight", "balanced"),
            random_state=hp.get("random_state", 42),
        )

    def _create_catboost(self, hp: dict[str, Any]) -> Any:
        try:
            from catboost import CatBoostClassifier
            return CatBoostClassifier(
                iterations=hp.get("iterations", 500),
                learning_rate=hp.get("learning_rate", 0.1),
                depth=hp.get("depth", 6),
                verbose=0,
                random_seed=hp.get("random_state", 42),
            )
        except ImportError:
            logger.warning("CatBoost not installed, falling back to LogisticRegression")
            return self._create_logistic_regression({})

    def _create_lightgbm(self, hp: dict[str, Any]) -> Any:
        try:
            from lightgbm import LGBMClassifier
            return LGBMClassifier(
                n_estimators=hp.get("n_estimators", 500),
                learning_rate=hp.get("learning_rate", 0.1),
                max_depth=hp.get("max_depth", 6),
                num_leaves=hp.get("num_leaves", 31),
                random_state=hp.get("random_state", 42),
                verbose=-1,
            )
        except ImportError:
            logger.warning("LightGBM not installed, falling back to LogisticRegression")
            return self._create_logistic_regression({})

    def _create_xgboost(self, hp: dict[str, Any]) -> Any:
        try:
            from xgboost import XGBClassifier
            return XGBClassifier(
                n_estimators=hp.get("n_estimators", 500),
                learning_rate=hp.get("learning_rate", 0.1),
                max_depth=hp.get("max_depth", 6),
                use_label_encoder=False,
                eval_metric="mlogloss",
                random_state=hp.get("random_state", 42),
                verbosity=0,
            )
        except ImportError:
            logger.warning("XGBoost not installed, falling back to LogisticRegression")
            return self._create_logistic_regression({})

    def _create_prophet(self, hp: dict[str, Any]) -> Any:
        try:
            from prophet import Prophet
            return Prophet(
                changepoint_prior_scale=hp.get("changepoint_prior_scale", 0.05),
                seasonality_prior_scale=hp.get("seasonality_prior_scale", 10.0),
                yearly_seasonality=hp.get("yearly_seasonality", True),
                weekly_seasonality=hp.get("weekly_seasonality", True),
                daily_seasonality=hp.get("daily_seasonality", False),
            )
        except ImportError:
            logger.warning("Prophet not installed")
            return None

    def _create_arima(self, hp: dict[str, Any]) -> Any:
        return {
            "order": hp.get("order", (1, 1, 1)),
            "seasonal_order": hp.get("seasonal_order", (0, 0, 0, 0)),
            "method": hp.get("method", "css-mle"),
        }

    def _create_exponential_smoothing(self, hp: dict[str, Any]) -> Any:
        return {
            "trend": hp.get("trend", "add"),
            "seasonal": hp.get("seasonal", None),
            "seasonal_periods": hp.get("seasonal_periods", None),
            "initialization_method": hp.get("initialization_method", "estimated"),
        }

    def _create_lstm(self, hp: dict[str, Any]) -> Any:
        try:
            import torch
            import torch.nn as nn

            input_size = hp.get("input_size", 1)
            hidden_size = hp.get("hidden_size", 64)
            num_layers = hp.get("num_layers", 2)
            output_size = hp.get("output_size", 1)
            dropout = hp.get("dropout", 0.2)

            class LSTMPredictor(nn.Module):
                def __init__(self):
                    super().__init__()
                    self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
                    self.fc = nn.Linear(hidden_size, output_size)

                def forward(self, x):
                    out, _ = self.lstm(x)
                    return self.fc(out[:, -1, :])

            return LSTMPredictor()
        except ImportError:
            logger.warning("PyTorch not installed, LSTM unavailable")
            return None

    def _create_transformer(self, hp: dict[str, Any]) -> Any:
        try:
            import torch
            import torch.nn as nn

            d_model = hp.get("d_model", 64)
            nhead = hp.get("nhead", 4)
            num_layers = hp.get("num_layers", 3)
            dim_feedforward = hp.get("dim_feedforward", 128)
            dropout = hp.get("dropout", 0.1)
            input_size = hp.get("input_size", 1)
            output_size = hp.get("output_size", 1)

            class TransformerPredictor(nn.Module):
                def __init__(self):
                    super().__init__()
                    self.input_proj = nn.Linear(input_size, d_model)
                    encoder_layer = nn.TransformerEncoderLayer(
                        d_model=d_model, nhead=nhead,
                        dim_feedforward=dim_feedforward, dropout=dropout, batch_first=True,
                    )
                    self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
                    self.fc = nn.Linear(d_model, output_size)

                def forward(self, x):
                    x = self.input_proj(x)
                    x = self.transformer(x)
                    return self.fc(x[:, -1, :])

            return TransformerPredictor()
        except ImportError:
            logger.warning("PyTorch not installed, Transformer unavailable")
            return None

    def _create_ensemble(self, hp: dict[str, Any], config: ModelConfig) -> Any:
        from sklearn.ensemble import VotingClassifier, StackingClassifier
        from sklearn.linear_model import LogisticRegression

        estimators = []
        if config.logistic_regression:
            estimators.append(("lr", LogisticRegression(max_iter=1000, random_state=42)))
        if config.lightgbm:
            try:
                from lightgbm import LGBMClassifier
                estimators.append(("lgbm", LGBMClassifier(n_estimators=200, verbose=-1)))
            except ImportError:
                pass
        if config.xgboost:
            try:
                from xgboost import XGBClassifier
                estimators.append(("xgb", XGBClassifier(n_estimators=200, use_label_encoder=False, eval_metric="mlogloss", verbosity=0)))
            except ImportError:
                pass
        if not estimators:
            estimators.append(("lr", LogisticRegression(max_iter=1000, random_state=42)))

        method = hp.get("ensemble_method", "stacking")
        if method == "stacking" and len(estimators) >= 2:
            return StackingClassifier(
                estimators=estimators,
                final_estimator=LogisticRegression(max_iter=1000),
                cv=min(config.cross_validation_folds, 3),
            )
        elif len(estimators) >= 2:
            return VotingClassifier(estimators=estimators, voting="soft")
        return estimators[0][1] if estimators else LogisticRegression(max_iter=1000)

    def _create_isolation_forest(self, hp: dict[str, Any]) -> Any:
        from sklearn.ensemble import IsolationForest
        return IsolationForest(
            n_estimators=hp.get("n_estimators", 100),
            contamination=hp.get("contamination", 0.1),
            random_state=hp.get("random_state", 42),
        )

    def _create_zscore(self, hp: dict[str, Any]) -> Any:
        return {
            "threshold": hp.get("threshold", 3.0),
            "window": hp.get("window", 30),
        }
