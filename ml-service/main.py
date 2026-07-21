# ml-service/main.py
"""FinFlow ML Service — FastAPI application entry point."""

import logging
import os
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models.schemas import HealthResponse
from routes.classify import init_categorizer, router as classify_router
from routes.forecast import router as forecast_router
from services.categorizer import Categorizer

security = HTTPBearer(auto_error=False)

ML_API_KEY = os.environ.get("ML_API_KEY", "")


async def verify_api_key(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not ML_API_KEY:
        raise HTTPException(status_code=503, detail="ML_API_KEY not configured")
    if credentials is None or credentials.credentials != ML_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")

# ── Structured JSON Logging ────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("finflow-ml")

# ── Startup: Load/Train Model ─────────────────────────────
categorizer: Categorizer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global categorizer
    logger.info("Starting FinFlow ML Service...")

    start = time.time()
    categorizer = Categorizer()
    elapsed = time.time() - start

    init_categorizer(categorizer)
    logger.info("Model loaded in %.2f seconds", elapsed)
    yield


# ── Application ────────────────────────────────────────────
app = FastAPI(
    title="FinFlow ML Service",
    description="Transaction categorization and cash flow forecasting",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def limit_body_size(request, call_next):
    """Reject requests with body larger than 10 MB."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=413, content={"detail": "Request too large (max 10 MB)"}
        )
    return await call_next(request)


# ── Routes ─────────────────────────────────────────────────
app.include_router(classify_router, dependencies=[Depends(verify_api_key)])
app.include_router(forecast_router, dependencies=[Depends(verify_api_key)])
from routes.metrics import router as metrics_router
app.include_router(metrics_router, dependencies=[Depends(verify_api_key)])


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=categorizer is not None and categorizer.is_loaded,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
