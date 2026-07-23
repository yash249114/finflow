# ml-service/core/risk.py
"""Risk Scoring Engine — computes risk scores for every prediction.

Risk is computed from model quality, data quality, prediction uncertainty,
and domain-specific financial signals.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class RiskAssessment:
    overall_risk: float = 0.0
    risk_level: str = "low"
    model_risk: float = 0.0
    data_risk: float = 0.0
    uncertainty_risk: float = 0.0
    domain_risk: float = 0.0
    risk_factors: list[str] = field(default_factory=list)
    mitigation_actions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_risk": self.overall_risk,
            "risk_level": self.risk_level,
            "model_risk": self.model_risk,
            "data_risk": self.data_risk,
            "uncertainty_risk": self.uncertainty_risk,
            "domain_risk": self.domain_risk,
            "risk_factors": self.risk_factors,
            "mitigation_actions": self.mitigation_actions,
        }


class RiskScoringEngine:
    """Computes multi-dimensional risk scores for predictions."""

    def compute_risk(
        self,
        model: Any = None,
        prediction: Any = None,
        confidence: float = 0.0,
        model_metrics: dict[str, float] | None = None,
        data_points: int = 0,
        feature_count: int = 0,
        historical_volatility: float = 0.0,
        domain_context: dict[str, Any] | None = None,
    ) -> RiskAssessment:
        assessment = RiskAssessment()

        assessment.model_risk = self._model_risk(model, model_metrics)
        assessment.data_risk = self._data_risk(data_points, feature_count)
        assessment.uncertainty_risk = self._uncertainty_risk(confidence, model, prediction)
        assessment.domain_risk = self._domain_risk(domain_context, historical_volatility)

        weights = {"model": 0.3, "data": 0.2, "uncertainty": 0.3, "domain": 0.2}
        assessment.overall_risk = round(
            assessment.model_risk * weights["model"]
            + assessment.data_risk * weights["data"]
            + assessment.uncertainty_risk * weights["uncertainty"]
            + assessment.domain_risk * weights["domain"],
            4,
        )
        assessment.risk_level = self._risk_level(assessment.overall_risk)
        assessment.risk_factors = self._identify_risk_factors(assessment)
        assessment.mitigation_actions = self._suggest_mitigations(assessment)

        return assessment

    def compute_forecast_risk(
        self,
        predictions: np.ndarray | list[float],
        historical: np.ndarray | list[float],
        confidence_intervals: list[tuple[float, float]] | None = None,
    ) -> RiskAssessment:
        pred = np.array(predictions, dtype=float)
        hist = np.array(historical, dtype=float)
        assessment = RiskAssessment()

        if len(hist) > 1:
            hist_vol = float(np.std(hist) / (abs(np.mean(hist)) + 1e-9))
        else:
            hist_vol = 0.5

        if len(pred) > 1:
            pred_vol = float(np.std(pred) / (abs(np.mean(pred)) + 1e-9))
        else:
            pred_vol = 0.0

        assessment.model_risk = min(1.0, hist_vol * 0.8)
        assessment.data_risk = min(1.0, max(0, 1.0 - len(hist) / 100))
        assessment.uncertainty_risk = min(1.0, pred_vol * 0.6)

        if confidence_intervals:
            ci_widths = [(upper - lower) / (abs((upper + lower) / 2) + 1e-9) for lower, upper in confidence_intervals]
            avg_ci = float(np.mean(ci_widths))
            assessment.uncertainty_risk = min(1.0, avg_ci * 0.5)

        assessment.domain_risk = self._forecast_domain_risk(pred, hist)

        weights = {"model": 0.25, "data": 0.2, "uncertainty": 0.35, "domain": 0.2}
        assessment.overall_risk = round(
            assessment.model_risk * weights["model"]
            + assessment.data_risk * weights["data"]
            + assessment.uncertainty_risk * weights["uncertainty"]
            + assessment.domain_risk * weights["domain"],
            4,
        )
        assessment.risk_level = self._risk_level(assessment.overall_risk)
        assessment.risk_factors = self._identify_forecast_risk_factors(assessment, pred, hist)
        assessment.mitigation_actions = self._suggest_forecast_mitigations(assessment)

        return assessment

    def _model_risk(self, model: Any, metrics: dict[str, float] | None) -> float:
        risk = 0.3
        if metrics:
            accuracy = metrics.get("accuracy", 0)
            f1 = metrics.get("f1", 0)
            auc = metrics.get("auc_roc", 0)
            if accuracy > 0:
                risk = max(0, 1.0 - accuracy) * 0.4
            if f1 > 0:
                risk += max(0, 1.0 - f1) * 0.3
            if auc > 0:
                risk += max(0, 1.0 - auc) * 0.3
        return min(1.0, risk)

    def _data_risk(self, data_points: int, feature_count: int) -> float:
        if data_points == 0:
            return 1.0
        size_risk = max(0, 1.0 - math.log10(max(data_points, 1)) / 5)
        feature_risk = max(0, 1.0 - feature_count / 20) if feature_count > 0 else 0.3
        return min(1.0, (size_risk + feature_risk) / 2)

    def _uncertainty_risk(self, confidence: float, model: Any, prediction: Any) -> float:
        base_uncertainty = 1.0 - confidence if confidence > 0 else 0.5
        prob_risk = 0.0
        if model is not None and hasattr(model, "predict_proba") and prediction is not None:
            try:
                X = prediction if isinstance(prediction, (list, np.ndarray)) else [prediction]
                proba = model.predict_proba(np.array(X).reshape(1, -1) if np.isscalar(prediction) else np.array(X))
                max_prob = float(np.max(proba))
                entropy = float(-np.sum(proba * np.log(proba + 1e-10)))
                prob_risk = 1.0 - max_prob
                if entropy > 1.0:
                    prob_risk = min(1.0, prob_risk + 0.2)
            except Exception:
                pass
        return min(1.0, (base_uncertainty + prob_risk) / 2)

    def _domain_risk(self, domain_context: dict[str, Any] | None, volatility: float) -> float:
        risk = 0.2
        if domain_context:
            amount = domain_context.get("amount", 0)
            if abs(amount) > 100000:
                risk += 0.3
            if domain_context.get("is_recurring", False):
                risk -= 0.1
            if domain_context.get("category") in ("Other", "Unknown"):
                risk += 0.15
        risk += min(0.3, volatility * 0.5)
        return max(0.0, min(1.0, risk))

    def _forecast_domain_risk(self, predictions: np.ndarray, historical: np.ndarray) -> float:
        risk = 0.2
        if len(historical) > 0 and len(predictions) > 0:
            hist_mean = abs(float(np.mean(historical)))
            pred_mean = abs(float(np.mean(predictions)))
            if hist_mean > 0:
                divergence = abs(pred_mean - hist_mean) / hist_mean
                risk += min(0.4, divergence * 0.3)
            if float(np.min(predictions)) < 0 and float(np.min(historical)) >= 0:
                risk += 0.2
            if float(np.max(predictions)) > float(np.max(historical)) * 2:
                risk += 0.15
        return min(1.0, risk)

    def _risk_level(self, score: float) -> str:
        if score < 0.2:
            return "low"
        elif score < 0.4:
            return "moderate"
        elif score < 0.6:
            return "elevated"
        elif score < 0.8:
            return "high"
        return "critical"

    def _identify_risk_factors(self, assessment: RiskAssessment) -> list[str]:
        factors = []
        if assessment.model_risk > 0.5:
            factors.append("Model accuracy is below threshold")
        if assessment.data_risk > 0.5:
            factors.append("Insufficient training data")
        if assessment.uncertainty_risk > 0.5:
            factors.append("High prediction uncertainty")
        if assessment.domain_risk > 0.5:
            factors.append("Domain-specific risk signals detected")
        return factors

    def _identify_forecast_risk_factors(self, assessment: RiskAssessment, pred: np.ndarray, hist: np.ndarray) -> list[str]:
        factors = []
        if assessment.model_risk > 0.4:
            factors.append("High historical volatility reduces forecast reliability")
        if assessment.data_risk > 0.4:
            factors.append("Limited historical data — forecast may be unreliable")
        if assessment.uncertainty_risk > 0.4:
            factors.append("Wide confidence intervals indicate high forecast uncertainty")
        if len(pred) > 0 and len(hist) > 0:
            if float(np.mean(pred)) < 0 and float(np.mean(hist)) > 0:
                factors.append("Forecast crosses from positive to negative territory")
        return factors

    def _suggest_mitigations(self, assessment: RiskAssessment) -> list[str]:
        actions = []
        if assessment.model_risk > 0.5:
            actions.append("Consider retraining with more data or a different model")
        if assessment.data_risk > 0.5:
            actions.append("Collect more historical data before relying on this prediction")
        if assessment.uncertainty_risk > 0.5:
            actions.append("Use ensemble methods or wider confidence intervals")
        if assessment.domain_risk > 0.5:
            actions.append("Review domain context and validate assumptions")
        return actions

    def _suggest_forecast_mitigations(self, assessment: RiskAssessment) -> list[str]:
        actions = []
        if assessment.model_risk > 0.4:
            actions.append("Consider smoothing techniques to reduce volatility impact")
        if assessment.data_risk > 0.4:
            actions.append("Extend historical data window for more reliable forecasts")
        if assessment.uncertainty_risk > 0.4:
            actions.append("Widen confidence intervals and present conservative estimates")
        return actions
