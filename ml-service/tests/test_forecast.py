"""Tests for the forecast endpoint."""

import os
os.environ["ML_API_KEY"] = "test-key"

import pytest
from fastapi.testclient import TestClient

from main import app
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from services.categorizer import Categorizer
from routes.classify import init_services


@pytest.fixture(scope="module", autouse=True)
def setup_categorizer():
    categorizer = Categorizer()
    explainability = ExplainabilityEngine()
    risk_engine = RiskScoringEngine()
    recommendations_engine = RecommendationEngine()
    history = PredictionHistory()
    init_services(categorizer, explainability, risk_engine, recommendations_engine, history)
    yield


client = TestClient(app)

auth_headers = {"Authorization": "Bearer test-key"}


def _generate_sample_transactions(num_days: int = 60) -> list[dict]:
    import random
    import datetime

    random.seed(42)
    transactions = []
    for i in range(num_days):
        d = (datetime.date(2026, 1, 1) + datetime.timedelta(days=i)).isoformat()
        transactions.append({"date": d, "amount": 5000.0})  # weekly income
        if i % 7 == 0:
            transactions.append({"date": d, "amount": -200.0})
        if i % 3 == 0:
            transactions.append({"date": d, "amount": -50.0})
        if i % 14 == 0:
            transactions.append({"date": d, "amount": -3000.0})
    return transactions


def test_forecast_basic():
    """Test that forecast returns expected structure with 60 days of data."""
    transactions = _generate_sample_transactions(60)
    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "forecast" in data
    assert "summary" in data
    assert len(data["forecast"]) == 30
    s = data["summary"]
    assert "trend" in s
    assert "expected_net" in s
    assert "confidence" in s
    assert "confidence_score" in s


def test_forecast_insufficient_data():
    """Test that less than 14 days of data returns 400."""
    transactions = _generate_sample_transactions(5)
    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    }, headers=auth_headers)
    assert response.status_code == 400


def test_forecast_different_horizons():
    """Test that different horizon values work correctly."""
    transactions = _generate_sample_transactions(60)
    for horizon in [7, 14, 30, 60, 90]:
        response = client.post("/forecast", json={
            "transactions": transactions,
            "horizon_days": horizon,
        }, headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()["forecast"]) == horizon


def test_forecast_confidence_intervals():
    """Test that confidence intervals are valid (lower <= predicted <= upper)."""
    transactions = _generate_sample_transactions(60)
    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for point in data["forecast"]:
        assert point["lower"] <= point["predicted"]
        assert point["predicted"] <= point["upper"]
