# ml-service/routes/metrics.py
"""AIOps metrics route: exposes model drift and forecast confidence signals."""

import logging
import time

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level latest-signal store, updated by the forecaster on each run.
_latest = {
    "drift_score": 0.0,
    "confidence_score": 0.0,
    "last_forecast_at": 0.0,
    "forecast_count": 0,
}


def record_forecast(drift_score: float, confidence_score: float) -> None:
    """Update the latest AIOps signals after a forecast computation."""
    _latest["drift_score"] = drift_score
    _latest["confidence_score"] = confidence_score
    _latest["last_forecast_at"] = time.time()
    _latest["forecast_count"] += 1


def reset_metrics() -> None:
    """Reset metrics to initial state (useful for tests)."""
    _latest["drift_score"] = 0.0
    _latest["confidence_score"] = 0.0
    _latest["last_forecast_at"] = 0.0
    _latest["forecast_count"] = 0


@router.get("/metrics")
async def metrics():
    """Return current model drift and confidence for AIOps self-monitoring."""
    return {
        "drift_score": round(_latest["drift_score"], 4),
        "confidence_score": round(_latest["confidence_score"], 4),
        "last_forecast_at": _latest["last_forecast_at"],
        "forecast_count": _latest["forecast_count"],
    }
