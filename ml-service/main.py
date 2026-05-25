# ml-service/main.py
"""FinFlow ML Service — FastAPI application entry point."""

import logging
import sys
import time

from fastapi import FastAPI

from models.schemas import HealthResponse
from routes.classify import init_categorizer, router as classify_router
from routes.forecast import router as forecast_router
from services.categorizer import Categorizer

# ── Structured JSON Logging ────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("finflow-ml")

# ── Application ────────────────────────────────────────────
app = FastAPI(
    title="FinFlow ML Service",
    description="Transaction categorization and cash flow forecasting",
    version="1.0.0",
)

# ── Startup: Load/Train Model ─────────────────────────────
categorizer: Categorizer | None = None


@app.on_event("startup")
async def startup() -> None:
    global categorizer
    logger.info("Starting FinFlow ML Service...")

    start = time.time()
    categorizer = Categorizer()
    elapsed = time.time() - start

    init_categorizer(categorizer)
    logger.info("Model loaded in %.2f seconds", elapsed)


# ── Routes ─────────────────────────────────────────────────
app.include_router(classify_router)
app.include_router(forecast_router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=categorizer is not None and categorizer.is_loaded,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
