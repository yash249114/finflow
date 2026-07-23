# ml-service/tests/test_schemas.py
"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError

from models.schemas import (
    ClassifyRequest,
    ClassifyResponse,
    ForecastRequest,
    ForecastPoint,
    ForecastSummary,
    ForecastResponse,
    ForecastTransaction,
    HealthResponse,
)


def test_classify_request_valid():
    req = ClassifyRequest(descriptions=["AWS Monthly Bill", "Team Lunch"])
    assert len(req.descriptions) == 2


def test_classify_request_empty_list():
    with pytest.raises(ValidationError):
        ClassifyRequest(descriptions=[])


def test_classify_response():
    resp = ClassifyResponse(categories=["Infrastructure", "Meals"])
    assert resp.categories == ["Infrastructure", "Meals"]


def test_forecast_transaction():
    ft = ForecastTransaction(date="2024-01-15", amount=-500.0)
    assert ft.date == "2024-01-15"
    assert ft.amount == -500.0


def test_forecast_request_defaults():
    req = ForecastRequest(transactions=[ForecastTransaction(date="2024-01-15", amount=100)])
    assert req.horizon_days == 30


def test_forecast_request_custom_horizon():
    req = ForecastRequest(
        transactions=[ForecastTransaction(date="2024-01-15", amount=100)],
        horizon_days=60,
    )
    assert req.horizon_days == 60


def test_forecast_request_horizon_bounds():
    with pytest.raises(ValidationError):
        ForecastRequest(
            transactions=[ForecastTransaction(date="2024-01-15", amount=100)],
            horizon_days=3,
        )
    with pytest.raises(ValidationError):
        ForecastRequest(
            transactions=[ForecastTransaction(date="2024-01-15", amount=100)],
            horizon_days=500,
        )


def test_forecast_point():
    fp = ForecastPoint(date="2024-02-01", predicted=1500.0, lower=1200.0, upper=1800.0)
    assert fp.lower <= fp.predicted <= fp.upper


def test_forecast_summary():
    fs = ForecastSummary(expected_net=5000.0, trend="improving", confidence="high", confidence_score=0.88)
    assert fs.trend in ("improving", "stable", "declining")
    assert fs.confidence in ("low", "medium", "high")
    assert 0.0 <= fs.confidence_score <= 1.0


def test_forecast_response():
    resp = ForecastResponse(
        forecast=[ForecastPoint(date="2024-02-01", predicted=100.0, lower=80.0, upper=120.0)],
        summary=ForecastSummary(expected_net=100.0, trend="stable", confidence="low", confidence_score=0.5),
    )
    assert len(resp.forecast) == 1
    assert resp.summary.trend == "stable"


def test_health_response():
    hr = HealthResponse(status="ok", model_loaded=True)
    assert hr.status == "ok"
    assert hr.model_loaded is True
