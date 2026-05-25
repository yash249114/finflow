# ml-service/models/schemas.py
"""Pydantic v2 schemas for all ML service request/response models."""

from pydantic import BaseModel, Field


# ─── Classification ────────────────────────────────────────

class ClassifyRequest(BaseModel):
    descriptions: list[str] = Field(..., min_length=1, description="Transaction descriptions to classify")


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


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]
    summary: ForecastSummary


# ─── Health ────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    model_loaded: bool = False
