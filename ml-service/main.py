# ml-service/main.py
"""FinFlow ML Service — FastAPI application entry point.

Production-ready backend for financial intelligence platform.
Supports Blue/Emerald/Diamond tiers through configuration.
"""

import logging
import os
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.config import Tier, get_active_tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.experiment import ExperimentTracker
from core.factory import ModelFactory
from core.feedback import ContinuousImprovement
from core.history import PredictionHistory
from core.recommendations import RecommendationEngine
from core.registry import ModelRegistry
from core.risk import RiskScoringEngine
from core.router import ModelRouter
from core.pipeline import TrainingPipeline
from models.schemas import HealthResponse
from routes.classify import init_services, router as classify_router
from routes.forecast import router as forecast_router
from routes.intelligence import router as intelligence_router
from routes.metrics import router as metrics_router
from services.categorizer import Categorizer

security = HTTPBearer(auto_error=False)

ML_API_KEY = os.environ.get("ML_API_KEY", "")


async def verify_api_key(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not ML_API_KEY:
        return
    if credentials is None or credentials.credentials != ML_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("finflow-ml")

categorizer: Categorizer | None = None
model_registry: ModelRegistry | None = None
model_factory: ModelFactory | None = None
training_pipeline: TrainingPipeline | None = None
experiment_tracker: ExperimentTracker | None = None
model_router: ModelRouter | None = None
prediction_history: PredictionHistory | None = None
continuous_improvement: ContinuousImprovement | None = None
explainability_engine: ExplainabilityEngine | None = None
risk_engine: RiskScoringEngine | None = None
recommendations_engine: RecommendationEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global categorizer, model_registry, model_factory, training_pipeline
    global experiment_tracker, model_router, prediction_history, continuous_improvement
    global explainability_engine, risk_engine, recommendations_engine

    logger.info("Starting FinFlow ML Service v2.0...")

    start = time.time()

    model_registry = ModelRegistry()
    model_factory = ModelFactory(model_registry)
    experiment_tracker = ExperimentTracker()
    model_router = ModelRouter(model_registry)
    prediction_history = PredictionHistory()
    continuous_improvement = ContinuousImprovement(model_registry, prediction_history)
    explainability_engine = ExplainabilityEngine()
    risk_engine = RiskScoringEngine()
    recommendations_engine = RecommendationEngine()
    training_pipeline = TrainingPipeline(model_registry, model_factory, experiment_tracker)

    categorizer = Categorizer()

    init_services(
        categorizer,
        explainability_engine,
        risk_engine,
        recommendations_engine,
        prediction_history,
    )

    elapsed = time.time() - start
    logger.info("FinFlow ML Service started in %.2f seconds", elapsed)
    logger.info("Registered models: %d", len(model_registry.list_models()))
    yield


app = FastAPI(
    title="FinFlow ML Service",
    description="Financial Intelligence Platform — predictions with explainability, risk scoring, and recommendations",
    version="2.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def limit_body_size(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        return JSONResponse(
            status_code=413, content={"detail": "Request too large (max 10 MB)"}
        )
    return await call_next(request)


app.include_router(classify_router, dependencies=[Depends(verify_api_key)])
app.include_router(forecast_router, dependencies=[Depends(verify_api_key)])
app.include_router(intelligence_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(metrics_router, dependencies=[Depends(verify_api_key)])


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    features = [
        "classify", "forecast", "cash-flow", "expenses", "runway",
        "invoices", "vendors", "fraud", "subscriptions", "business-health",
        "working-capital", "risk", "scenarios", "budget", "revenue",
        "inventory", "seasonality", "customer-payments", "expense-anomalies",
        "kpis", "executive-report",
    ]
    return HealthResponse(
        status="ok",
        model_loaded=categorizer is not None and categorizer.is_loaded,
        version="2.0.0",
        features=features,
        tiers=["blue", "emerald", "diamond"],
        models_registered=len(model_registry.list_models()) if model_registry else 0,
        predictions_served=prediction_history.get_stats()["total_predictions"] if prediction_history else 0,
    )


@app.get("/api/v1/tiers")
async def list_tiers():
    tiers = {}
    for tier in [Tier.BLUE, Tier.EMERALD, Tier.DIAMOND]:
        config = get_tier_config(tier)
        tiers[tier.value] = {
            "max_input_rows": config.features.max_input_rows,
            "max_horizon_days": config.features.max_horizon_days,
            "explainability": config.features.explainability,
            "risk_scoring": config.features.risk_scoring,
            "recommendations": config.features.recommendations,
            "ensemble_size": config.features.ensemble_size,
            "available_models": config.models.available_models,
            "feedback_loop": config.features.feedback_loop,
            "realtime_alerts": config.realtime_alerts,
        }
    return tiers


@app.get("/api/v1/models")
async def list_models(name: str | None = None, status: str | None = None):
    from core.registry import ModelStatus
    s = ModelStatus(status) if status else None
    models = model_registry.list_models(name=name, status=s) if model_registry else []
    return {"models": [m.to_dict() for m in models]}


@app.get("/api/v1/experiments")
async def list_experiments(name: str | None = None, status: str | None = None, limit: int = 100):
    experiments = experiment_tracker.list_experiments(name=name, status=status, limit=limit) if experiment_tracker else []
    return {"experiments": [e.to_dict() for e in experiments]}


@app.get("/api/v1/feedback-stats")
async def feedback_stats(feature_name: str | None = None):
    if continuous_improvement:
        return continuous_improvement.compute_feedback_stats(feature_name)
    return {"error": "Continuous improvement not initialized"}


@app.get("/api/v1/drift/{feature_name}")
async def check_drift(feature_name: str):
    if continuous_improvement:
        signal = continuous_improvement.detect_drift(feature_name)
        return signal.to_dict()
    return {"error": "Continuous improvement not initialized"}


@app.get("/api/v1/retrain-check/{feature_name}")
async def check_retrain(feature_name: str, tier: str = "blue"):
    if continuous_improvement:
        should_retrain, reason = continuous_improvement.should_auto_retrain(feature_name, Tier(tier))
        return {"should_retrain": should_retrain, "reason": reason}
    return {"error": "Continuous improvement not initialized"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
