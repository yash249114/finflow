# ml-service/routes/forecast.py
"""Forecast route for cash flow prediction."""

import logging
from fastapi import APIRouter, HTTPException

from core.config import Tier, get_active_tier, get_tier_config
from models.schemas import ForecastRequest, ForecastResponse
from services.forecaster import compute_forecast

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest) -> ForecastResponse:
    tier = Tier(req.tier) if req.tier else get_active_tier()
    config = get_tier_config(tier)

    if len(req.transactions) > config.features.max_input_rows:
        raise HTTPException(status_code=400, detail=f"Max {config.features.max_input_rows} transactions for {tier.value} tier")

    logger.info("Forecasting %d days from %d transactions [tier=%s]", req.horizon_days, len(req.transactions), tier.value)

    try:
        result = compute_forecast(req)
    except ValueError as e:
        logger.warning("Forecast validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Forecast computation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")

    return result
