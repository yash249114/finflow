# ml-service/core/config.py
"""Tier-based configuration for Blue, Emerald, and Diamond plans.

Every ML feature scales through these configs — never via duplicated code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Tier(str, Enum):
    BLUE = "blue"
    EMERALD = "emerald"
    DIAMOND = "diamond"


class ModelComplexity(str, Enum):
    LIGHT = "light"
    STANDARD = "standard"
    HEAVY = "heavy"


@dataclass(frozen=True)
class FeatureConfig:
    enabled: bool = True
    max_input_rows: int = 10_000
    max_horizon_days: int = 90
    explainability: bool = False
    risk_scoring: bool = False
    recommendations: bool = False
    prediction_history_days: int = 0
    feedback_loop: bool = False
    ensemble_size: int = 1


@dataclass(frozen=True)
class ModelConfig:
    complexity: ModelComplexity = ModelComplexity.LIGHT
    available_models: tuple[str, ...] = ("logistic_regression", "arima")
    default_model: str = "logistic_regression"
    catboost: bool = False
    lightgbm: bool = False
    xgboost: bool = False
    prophet: bool = False
    arima: bool = True
    lstm: bool = False
    transformer: bool = False
    ensemble: bool = False
    cross_validation_folds: int = 3
    hyperparameter_tuning: bool = False
    retrain_interval_hours: int = 168  # 7 days


@dataclass(frozen=True)
class ExperimentConfig:
    tracking: bool = False
    versioning: bool = False
    max_versions_per_model: int = 5
    auto_rollback_threshold: float = 0.05


@dataclass(frozen=True)
class TierConfig:
    tier: Tier
    features: FeatureConfig = field(default_factory=FeatureConfig)
    models: ModelConfig = field(default_factory=ModelConfig)
    experiments: ExperimentConfig = field(default_factory=ExperimentConfig)
    max_concurrent_predictions: int = 10
    rate_limit_per_minute: int = 60
    cache_ttl_seconds: int = 300
    realtime_alerts: bool = False
    custom_model_training: bool = False
    data_retention_days: int = 30
    api_priority: int = 1  # 1=low, 2=medium, 3=high


# ── Tier Definitions ────────────────────────────────────────

BLUE = TierConfig(
    tier=Tier.BLUE,
    features=FeatureConfig(
        enabled=True,
        max_input_rows=1_000,
        max_horizon_days=30,
        explainability=False,
        risk_scoring=False,
        recommendations=False,
        prediction_history_days=7,
        feedback_loop=False,
        ensemble_size=1,
    ),
    models=ModelConfig(
        complexity=ModelComplexity.LIGHT,
        available_models=("logistic_regression", "arima", "exponential_smoothing"),
        default_model="logistic_regression",
        arima=True,
        cross_validation_folds=3,
        hyperparameter_tuning=False,
        retrain_interval_hours=168,
    ),
    experiments=ExperimentConfig(tracking=False, versioning=False, max_versions_per_model=2),
    max_concurrent_predictions=5,
    rate_limit_per_minute=30,
    cache_ttl_seconds=600,
    realtime_alerts=False,
    custom_model_training=False,
    data_retention_days=7,
    api_priority=1,
)

EMERALD = TierConfig(
    tier=Tier.EMERALD,
    features=FeatureConfig(
        enabled=True,
        max_input_rows=50_000,
        max_horizon_days=60,
        explainability=True,
        risk_scoring=True,
        recommendations=True,
        prediction_history_days=90,
        feedback_loop=True,
        ensemble_size=3,
    ),
    models=ModelConfig(
        complexity=ModelComplexity.STANDARD,
        available_models=(
            "logistic_regression", "arima", "exponential_smoothing",
            "lightgbm", "xgboost", "prophet",
        ),
        default_model="lightgbm",
        lightgbm=True,
        xgboost=True,
        prophet=True,
        arima=True,
        ensemble=True,
        cross_validation_folds=5,
        hyperparameter_tuning=True,
        retrain_interval_hours=72,
    ),
    experiments=ExperimentConfig(tracking=True, versioning=True, max_versions_per_model=10, auto_rollback_threshold=0.03),
    max_concurrent_predictions=50,
    rate_limit_per_minute=300,
    cache_ttl_seconds=120,
    realtime_alerts=True,
    custom_model_training=False,
    data_retention_days=90,
    api_priority=2,
)

DIAMOND = TierConfig(
    tier=Tier.DIAMOND,
    features=FeatureConfig(
        enabled=True,
        max_input_rows=500_000,
        max_horizon_days=365,
        explainability=True,
        risk_scoring=True,
        recommendations=True,
        prediction_history_days=365,
        feedback_loop=True,
        ensemble_size=5,
    ),
    models=ModelConfig(
        complexity=ModelComplexity.HEAVY,
        available_models=(
            "logistic_regression", "arima", "exponential_smoothing",
            "lightgbm", "xgboost", "catboost", "prophet",
            "lstm", "transformer",
        ),
        default_model="ensemble_stacked",
        catboost=True,
        lightgbm=True,
        xgboost=True,
        prophet=True,
        arima=True,
        lstm=True,
        transformer=True,
        ensemble=True,
        cross_validation_folds=10,
        hyperparameter_tuning=True,
        retrain_interval_hours=24,
    ),
    experiments=ExperimentConfig(tracking=True, versioning=True, max_versions_per_model=50, auto_rollback_threshold=0.01),
    max_concurrent_predictions=500,
    rate_limit_per_minute=3000,
    cache_ttl_seconds=30,
    realtime_alerts=True,
    custom_model_training=True,
    data_retention_days=365,
    api_priority=3,
)

TIER_MAP: dict[Tier, TierConfig] = {
    Tier.BLUE: BLUE,
    Tier.EMERALD: EMERALD,
    Tier.DIAMOND: DIAMOND,
}


def get_tier_config(tier: Tier | str) -> TierConfig:
    if isinstance(tier, str):
        tier = Tier(tier.lower())
    return TIER_MAP[tier]


def get_active_tier() -> Tier:
    raw = os.environ.get("FINFLOW_TIER", "blue").lower()
    try:
        return Tier(raw)
    except ValueError:
        return Tier.BLUE
