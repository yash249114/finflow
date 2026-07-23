# ml-service/core/explainability.py
"""Explainability Engine — SHAP, LIME, feature importance for every prediction.

Every prediction must explain WHY. Never produce black-box predictions.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class ExplainabilityEngine:
    """Generates explanations for every prediction using multiple methods."""

    def __init__(self) -> None:
        self._shap_available = False
        self._lime_available = False
        try:
            import shap
            self._shap_available = True
        except ImportError:
            pass
        try:
            import lime
            self._lime_available = True
        except ImportError:
            pass

    def explain(
        self,
        model: Any,
        X: pd.DataFrame | np.ndarray,
        feature_names: list[str] | None = None,
        prediction_index: int = 0,
        task: str = "classification",
    ) -> dict[str, Any]:
        if isinstance(X, np.ndarray):
            if feature_names is None:
                feature_names = [f"feature_{i}" for i in range(X.shape[1])]
            X_df = pd.DataFrame(X, columns=feature_names)
        else:
            X_df = X
            feature_names = list(X_df.columns)

        explanations = {
            "methods_used": [],
            "feature_importance": {},
            "top_features": [],
            "reasoning": "",
            "confidence_factors": [],
        }

        fi = self._feature_importance(model, X_df, feature_names)
        if fi:
            explanations["feature_importance"] = fi
            explanations["methods_used"].append("feature_importance")

        shap_vals = self._shap_explanation(model, X_df, prediction_index)
        if shap_vals:
            explanations["shap_values"] = shap_vals
            explanations["methods_used"].append("shap")

        top = self._rank_top_features(explanations["feature_importance"], top_n=5)
        explanations["top_features"] = top
        explanations["reasoning"] = self._generate_reasoning(top, task)
        explanations["confidence_factors"] = self._compute_confidence_factors(model, X_df)

        return explanations

    def explain_timeseries(
        self,
        predictions: np.ndarray,
        historical: np.ndarray,
        feature_name: str = "amount",
    ) -> dict[str, Any]:
        explanations = {
            "methods_used": ["statistical_analysis"],
            "trend_analysis": {},
            "seasonality": {},
            "anomalies": [],
            "reasoning": "",
            "key_factors": [],
        }

        if len(historical) > 0:
            recent_mean = float(np.mean(historical[-30:])) if len(historical) >= 30 else float(np.mean(historical))
            recent_std = float(np.std(historical[-30:])) if len(historical) >= 30 else float(np.std(historical))
            forecast_mean = float(np.mean(predictions))

            trend_pct = (forecast_mean - recent_mean) / max(abs(recent_mean), 1e-9)
            explanations["trend_analysis"] = {
                "recent_mean": round(recent_mean, 2),
                "forecast_mean": round(forecast_mean, 2),
                "change_pct": round(trend_pct * 100, 2),
                "direction": "increasing" if trend_pct > 0.05 else "decreasing" if trend_pct < -0.05 else "stable",
            }

            if len(historical) >= 14:
                seasonal = self._detect_seasonality(historical)
                explanations["seasonality"] = seasonal

            anomalies = self._detect_anomalies(historical, recent_mean, recent_std)
            explanations["anomalies"] = anomalies

            explanations["key_factors"] = [
                f"Recent average {feature_name}: ${recent_mean:,.2f}",
                f"Forecasted average: ${forecast_mean:,.2f}",
                f"Trend: {explanations['trend_analysis']['direction']} ({trend_pct*100:+.1f}%)",
                f"Volatility (std): ${recent_std:,.2f}",
            ]
            if anomalies:
                explanations["key_factors"].append(f"Detected {len(anomalies)} anomalies in recent history")

            explanations["reasoning"] = self._generate_timeseries_reasoning(explanations)

        return explanations

    def _feature_importance(
        self, model: Any, X: pd.DataFrame, feature_names: list[str],
    ) -> dict[str, float]:
        importance = {}
        try:
            if hasattr(model, "feature_importances_"):
                vals = model.feature_importances_
                for name, val in zip(feature_names, vals):
                    importance[name] = round(float(val), 6)
            elif hasattr(model, "coef_"):
                coef = model.coef_
                if coef.ndim > 1:
                    coef = np.mean(np.abs(coef), axis=0)
                else:
                    coef = np.abs(coef)
                for name, val in zip(feature_names, coef):
                    importance[name] = round(float(val), 6)
        except Exception as e:
            logger.debug("Feature importance extraction failed: %s", e)
        if importance:
            total = sum(importance.values())
            if total > 0:
                importance = {k: round(v / total, 4) for k, v in importance.items()}
        return importance

    def _shap_explanation(self, model: Any, X: pd.DataFrame, prediction_index: int) -> dict[str, Any] | None:
        if not self._shap_available:
            return None
        try:
            import shap
            if hasattr(model, "predict_proba") or hasattr(model, "feature_importances_"):
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(X.iloc[[prediction_index]])
                if isinstance(shap_values, list):
                    vals = shap_values[0] if len(shap_values) > 0 else shap_values
                else:
                    vals = shap_values
                feature_shap = {}
                for name, val in zip(X.columns, vals[0] if vals.ndim > 1 else vals):
                    feature_shap[name] = round(float(val), 6)
                return {"values": feature_shap, "method": "tree"}
        except Exception as e:
            logger.debug("SHAP explanation failed: %s", e)
        return None

    def _rank_top_features(self, feature_importance: dict[str, float], top_n: int = 5) -> list[dict[str, Any]]:
        if not feature_importance:
            return []
        sorted_features = sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True)
        return [
            {"feature": name, "importance": score, "direction": "positive" if score > 0 else "negative"}
            for name, score in sorted_features[:top_n]
        ]

    def _generate_reasoning(self, top_features: list[dict[str, Any]], task: str) -> str:
        if not top_features:
            return "Insufficient feature data for explanation."
        primary = top_features[0]
        parts = [
            f"Primary factor: {primary['feature']} (impact: {primary['importance']:.4f}, {primary['direction']})."
        ]
        if len(top_features) > 1:
            secondary = top_features[1]
            parts.append(f"Secondary factor: {secondary['feature']} ({secondary['importance']:.4f}).")
        if len(top_features) > 2:
            parts.append(f"Also influenced by: {', '.join(f['feature'] for f in top_features[2:4])}.")
        return " ".join(parts)

    def _compute_confidence_factors(self, model: Any, X: pd.DataFrame) -> list[str]:
        factors = []
        if hasattr(model, "predict_proba"):
            try:
                proba = model.predict_proba(X)
                max_proba = float(np.max(proba))
                entropy = float(-np.sum(proba * np.log(proba + 1e-10)))
                if max_proba > 0.9:
                    factors.append(f"High prediction confidence ({max_proba:.2%})")
                elif max_proba < 0.5:
                    factors.append(f"Low prediction confidence ({max_proba:.2%})")
                if entropy < 0.5:
                    factors.append("Low prediction entropy — clear classification")
                elif entropy > 1.5:
                    factors.append("High prediction entropy — uncertain classification")
            except Exception:
                pass
        if hasattr(model, "n_features_in_"):
            factors.append(f"Model trained on {model.n_features_in_} features")
        return factors

    def _detect_seasonality(self, historical: np.ndarray) -> dict[str, Any]:
        result = {"detected": False, "period": None, "strength": 0.0}
        if len(historical) < 28:
            return result
        try:
            for period in [7, 14, 30]:
                if len(historical) >= period * 2:
                    autocorr = np.corrcoef(historical[:-period], historical[period:])[0, 1]
                    if abs(autocorr) > 0.3:
                        result = {"detected": True, "period": period, "strength": round(float(autocorr), 4)}
                        break
        except Exception:
            pass
        return result

    def _detect_anomalies(self, historical: np.ndarray, mean: float, std: float) -> list[dict[str, Any]]:
        if std == 0 or len(historical) < 10:
            return []
        anomalies = []
        for i, val in enumerate(historical):
            z = (val - mean) / std
            if abs(z) > 2.5:
                anomalies.append({"index": i, "value": round(float(val), 2), "z_score": round(float(z), 2)})
        return anomalies[-10:]

    def _generate_timeseries_reasoning(self, explanations: dict[str, Any]) -> str:
        parts = []
        trend = explanations.get("trend_analysis", {})
        if trend:
            direction = trend.get("direction", "stable")
            change = trend.get("change_pct", 0)
            parts.append(f"Forecast shows a {direction} trend ({change:+.1f}%).")
        seasonal = explanations.get("seasonality", {})
        if seasonal.get("detected"):
            parts.append(f"Seasonal pattern detected with {seasonal['period']}-day cycle.")
        anomalies = explanations.get("anomalies", [])
        if anomalies:
            parts.append(f"{len(anomalies)} anomalous data points in history may affect accuracy.")
        return " ".join(parts) if parts else "Analysis based on historical trend data."
