# ml-service/core/evaluation.py
"""Evaluation Framework — accuracy, confidence, explanation quality, risk scoring.

Every prediction must expose accuracy, confidence, explanation, recommendation, risk score.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    auc_roc: float = 0.0
    mae: float = 0.0
    rmse: float = 0.0
    mape: float = 0.0
    r_squared: float = 0.0
    cv_accuracy: float | None = None
    cv_std: float | None = None
    confidence_score: float = 0.0
    explanation_quality: float = 0.0
    risk_score: float = 0.0
    recommendation_quality: float = 0.0
    feature_importance_coverage: float = 0.0
    metrics: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d = {k: v for k, v in d.items() if v is not None and v != 0.0 and v != ""}
        d.update(self.metrics)
        return d


def evaluate_model(
    model: Any,
    X: Any,
    y: Any,
    cv_accuracy: float | None = None,
    cv_std: float | None = None,
    metrics: dict[str, float] | None = None,
) -> EvaluationResult:
    result = EvaluationResult(cv_accuracy=cv_accuracy, cv_std=cv_std)

    if metrics:
        result.mae = metrics.get("mae", 0.0)
        result.rmse = metrics.get("rmse", 0.0)
        result.mape = metrics.get("mape", 0.0)
        result.r_squared = metrics.get("r_squared", 0.0)

    if model is not None and X is not None and y is not None:
        try:
            from sklearn.metrics import (
                accuracy_score, precision_score, recall_score, f1_score,
                roc_auc_score,
            )
            y_pred = model.predict(X)
            result.accuracy = float(accuracy_score(y, y_pred))

            n_classes = len(np.unique(y))
            average = "binary" if n_classes == 2 else "weighted"
            result.precision = float(precision_score(y, y_pred, average=average, zero_division=0))
            result.recall = float(recall_score(y, y_pred, average=average, zero_division=0))
            result.f1 = float(f1_score(y, y_pred, average=average, zero_division=0))

            if hasattr(model, "predict_proba"):
                y_proba = model.predict_proba(X)
                if n_classes == 2:
                    result.auc_roc = float(roc_auc_score(y, y_proba[:, 1]))
                else:
                    result.auc_roc = float(roc_auc_score(y, y_proba, multi_class="ovr", average="weighted"))
        except Exception as e:
            logger.warning("Model evaluation failed: %s", e)

    result.confidence_score = _compute_confidence(result)
    result.explanation_quality = _compute_explanation_quality(model, X)
    result.risk_score = _compute_risk(result)
    result.recommendation_quality = _compute_recommendation_quality(result)
    result.feature_importance_coverage = _compute_feature_coverage(model, X)

    return result


def _compute_confidence(result: EvaluationResult) -> float:
    score = 0.0
    weights = 0.0
    if result.accuracy > 0:
        score += result.accuracy * 0.3
        weights += 0.3
    if result.f1 > 0:
        score += result.f1 * 0.25
        weights += 0.25
    if result.auc_roc > 0:
        score += result.auc_roc * 0.2
        weights += 0.2
    if result.cv_accuracy is not None:
        score += result.cv_accuracy * 0.25
        weights += 0.25
    return round(min(1.0, score / max(weights, 0.001)), 4)


def _compute_explanation_quality(model: Any, X: Any) -> float:
    if model is None:
        return 0.0
    has_importance = hasattr(model, "feature_importances_") or hasattr(model, "coef_")
    has_shap = False
    try:
        import shap
        has_shap = True
    except ImportError:
        pass
    score = 0.5 if has_importance else 0.2
    if has_shap:
        score += 0.3
    if X is not None and hasattr(X, "shape"):
        score += min(0.2, X.shape[1] / 100)
    return round(min(1.0, score), 4)


def _compute_risk(result: EvaluationResult) -> float:
    risk = 0.0
    if result.accuracy > 0 and result.accuracy < 0.6:
        risk += 0.3
    if result.cv_std is not None and result.cv_std > 0.1:
        risk += 0.2
    if result.mape > 30:
        risk += 0.2
    if result.auc_roc > 0 and result.auc_roc < 0.6:
        risk += 0.15
    return round(min(1.0, risk), 4)


def _compute_recommendation_quality(result: EvaluationResult) -> float:
    base = 0.3
    if result.accuracy > 0.8:
        base += 0.3
    if result.f1 > 0.7:
        base += 0.2
    if result.confidence_score > 0.7:
        base += 0.2
    return round(min(1.0, base), 4)


def _compute_feature_coverage(model: Any, X: Any) -> float:
    if model is None or X is None:
        return 0.0
    n_features = X.shape[1] if hasattr(X, "shape") else 0
    if n_features == 0:
        return 0.0
    has_importances = hasattr(model, "feature_importances_") or hasattr(model, "coef_")
    if has_importances:
        return round(min(1.0, 0.8 + min(0.2, n_features / 100)), 4)
    return round(min(1.0, n_features / 100), 4)
