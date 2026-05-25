# ml-service/tests/test_forecast.py
"""Tests for the forecast endpoint."""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _generate_transactions(num_days: int = 60) -> list[dict]:
    """Generate synthetic daily transactions for testing."""
    transactions = []
    base_date = datetime.now() - timedelta(days=num_days)

    for i in range(num_days):
        date = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        # Simulate typical cash flow: mix of income and expenses
        if i % 7 == 0:  # Weekly income
            transactions.append({"date": date, "amount": 2500.00})
        if i % 3 == 0:  # Regular expenses
            transactions.append({"date": date, "amount": -350.00})
        if i % 14 == 0:  # Bi-weekly payroll
            transactions.append({"date": date, "amount": -4250.00})
        # Daily small expenses
        transactions.append({"date": date, "amount": -45.00})

    return transactions


def test_forecast_basic():
    """Test forecast with sufficient data returns correct shape."""
    transactions = _generate_transactions(60)

    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    })
    assert response.status_code == 200
    data = response.json()

    assert "forecast" in data
    assert "summary" in data
    assert len(data["forecast"]) == 30

    # Each forecast point has required fields
    point = data["forecast"][0]
    assert "date" in point
    assert "predicted" in point
    assert "lower" in point
    assert "upper" in point

    # Summary has required fields
    summary = data["summary"]
    assert "expected_net" in summary
    assert "trend" in summary
    assert "confidence" in summary
    assert summary["trend"] in ("declining", "stable", "improving")
    assert summary["confidence"] in ("low", "medium", "high")


def test_forecast_insufficient_data():
    """Test that too few days of data returns 400."""
    transactions = [
        {"date": "2024-01-01", "amount": 100.00},
        {"date": "2024-01-02", "amount": -50.00},
    ]

    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    })
    assert response.status_code == 400


def test_forecast_different_horizons():
    """Test forecast with different horizon values."""
    transactions = _generate_transactions(60)

    for horizon in [7, 30, 60, 90]:
        response = client.post("/forecast", json={
            "transactions": transactions,
            "horizon_days": horizon,
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["forecast"]) == horizon


def test_forecast_confidence_intervals():
    """Test that lower bound < predicted < upper bound."""
    transactions = _generate_transactions(60)

    response = client.post("/forecast", json={
        "transactions": transactions,
        "horizon_days": 30,
    })
    assert response.status_code == 200
    data = response.json()

    for point in data["forecast"]:
        assert point["lower"] <= point["predicted"] <= point["upper"]
