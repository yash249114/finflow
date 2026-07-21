"""Tests for the classification endpoint."""

import os
os.environ.setdefault("ML_API_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from main import app
from services.categorizer import Categorizer
from routes.classify import init_categorizer


@pytest.fixture(scope="module", autouse=True)
def setup_categorizer():
    categorizer = Categorizer()
    init_categorizer(categorizer)
    yield


client = TestClient(app)

auth_headers = {"Authorization": "Bearer test-key"}


def test_classify_known_descriptions():
    """Test that well-known descriptions get correct categories."""
    response = client.post("/classify", json={
        "descriptions": [
            "AWS Monthly Bill",
            "Team Lunch",
            "Client Payment - Acme Corp",
            "Facebook Ads Campaign",
            "Payroll February",
        ]
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert len(data["categories"]) == 5

    categories = data["categories"]
    assert categories[0] == "Infrastructure"
    assert categories[1] == "Meals"
    assert categories[2] == "Revenue"
    assert categories[3] == "Marketing"
    assert categories[4] == "Payroll"


def test_classify_empty_request():
    """Test that empty descriptions list returns 422."""
    response = client.post("/classify", json={"descriptions": []}, headers=auth_headers)
    assert response.status_code == 422


def test_classify_single_description():
    """Test classification of a single description."""
    response = client.post("/classify", json={
        "descriptions": ["Office Supplies - Staples"]
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["categories"]) == 1
    assert data["categories"][0] == "Office"


def test_classify_unknown_description():
    """Test that an unknown description still returns a category."""
    response = client.post("/classify", json={
        "descriptions": ["xyzzy random gibberish 12345"]
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["categories"]) == 1
    assert isinstance(data["categories"][0], str)


def test_health():
    """Test health endpoint reports model loaded."""
    with TestClient(app) as c:
        response = c.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True
