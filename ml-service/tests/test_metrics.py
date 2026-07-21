"""Tests for the metrics endpoint."""

import os
os.environ.setdefault("ML_API_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from main import app
from services.categorizer import Categorizer
from routes.classify import init_categorizer

# Initialize the categorizer so the app can start
categorizer = Categorizer()
init_categorizer(categorizer)

client = TestClient(app)

auth_headers = {"Authorization": "Bearer test-key"}


@pytest.fixture(autouse=True)
def reset_metrics():
    from routes.metrics import reset_metrics
    reset_metrics()
    yield


def test_metrics_initial_state():
    """Test that metrics endpoint returns initial default values."""
    response = client.get("/metrics", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["forecast_count"] == 0


def test_metrics_after_forecast():
    """Test that metrics update after a forecast run."""
    from routes.metrics import record_forecast
    record_forecast(drift_score=0.05, confidence_score=0.85)

    response = client.get("/metrics", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["forecast_count"] == 1
    assert data["drift_score"] == 0.05
