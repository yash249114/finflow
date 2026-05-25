# ml-service/tests/test_classify.py
"""Tests for the classification endpoint."""

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
    })
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert len(data["categories"]) == 5

    # Verify expected categories (model should get these right with training data)
    categories = data["categories"]
    assert categories[0] == "Infrastructure"
    assert categories[1] == "Meals"
    assert categories[2] == "Revenue"
    assert categories[3] == "Marketing"
    assert categories[4] == "Payroll"


def test_classify_empty_request():
    """Test that empty descriptions list returns 422."""
    response = client.post("/classify", json={"descriptions": []})
    assert response.status_code == 422


def test_classify_single_description():
    """Test classification of a single description."""
    response = client.post("/classify", json={
        "descriptions": ["Office Supplies - Staples"]
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["categories"]) == 1
    assert data["categories"][0] == "Office"


def test_classify_unknown_description():
    """Test that an unknown description still returns a category."""
    response = client.post("/classify", json={
        "descriptions": ["xyzzy random gibberish 12345"]
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["categories"]) == 1
    # Should return "Other" or some category — just shouldn't crash
    assert isinstance(data["categories"][0], str)


def test_health():
    """Test health endpoint reports model loaded."""
    with TestClient(app) as c:
        response = c.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True
