# ml-service/models/schemas.py
"""Pydantic v2 schemas for all ML service request/response models."""

from pydantic import BaseModel, Field, ConfigDict


# ─── Classification ────────────────────────────────────────

class ClassifyRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    descriptions: list[str] = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Transaction descriptions to classify (max 10,000)",
    )
    _single_max_length: int = 500  # individual description max length, validated in route


class ClassifyResponse(BaseModel):
    categories: list[str] = Field(..., description="Predicted categories for each description")


# ─── Forecasting ───────────────────────────────────────────

class ForecastTransaction(BaseModel):
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    amount: float = Field(..., description="Transaction amount (negative=expense, positive=income)")


class ForecastRequest(BaseModel):
    transactions: list[ForecastTransaction] = Field(..., min_length=1)
    horizon_days: int = Field(default=30, ge=7, le=90, description="Number of days to forecast")


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class ForecastSummary(BaseModel):
    expected_net: float
    trend: str  # "declining" | "stable" | "improving"
    confidence: str  # "low" | "medium" | "high"
    confidence_score: float = 0.0  # 0-1 numeric, consumed by AIOps


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]
    summary: ForecastSummary


# ─── Health ────────────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str = "ok"
    model_loaded: bool = False
