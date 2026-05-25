# ml-service/routes/forecast.py
"""Forecast route for cash flow prediction."""

import logging
from fastapi import APIRouter, HTTPException

from models.schemas import ForecastRequest, ForecastResponse
from services.forecaster import compute_forecast

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest) -> ForecastResponse:
    """Generate cash flow forecast from transaction history."""
    logger.info(
        "Forecasting %d days from %d transactions",
        req.horizon_days,
        len(req.transactions),
    )

    try:
        result = compute_forecast(req)
    except ValueError as e:
        logger.warning("Forecast validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Forecast computation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")

    return result
