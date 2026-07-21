# ml-service/tests/test_categorizer.py
"""Tests for the categorizer service directly."""

import pytest
from services.categorizer import Categorizer


@pytest.fixture(scope="module")
def categorizer():
    return Categorizer()


def test_categorizer_loaded(categorizer):
    assert categorizer.is_loaded


def test_classify_revenue(categorizer):
    results = categorizer.classify(["Client Payment", "Invoice Payment"])
    assert all(r == "Revenue" for r in results)


def test_classify_payroll(categorizer):
    results = categorizer.classify(["Payroll", "Salary Payment"])
    assert all(r == "Payroll" for r in results)


def test_classify_infrastructure(categorizer):
    results = categorizer.classify(["AWS Monthly Bill", "Google Cloud Platform"])
    assert all(r == "Infrastructure" for r in results)


def test_classify_meals(categorizer):
    results = categorizer.classify(["Team Lunch", "Client Dinner"])
    assert all(r == "Meals" for r in results)


def test_classify_marketing(categorizer):
    results = categorizer.classify(["Facebook Ads", "Google Ads Campaign"])
    assert all(r == "Marketing" for r in results)


def test_classify_travel(categorizer):
    results = categorizer.classify(["Flight Booking", "Hotel Booking"])
    assert all(r == "Travel" for r in results)


def test_classify_utilities(categorizer):
    results = categorizer.classify(["Electricity Bill", "Internet Service"])
    assert all(r == "Utilities" for r in results)


def test_classify_contractors(categorizer):
    results = categorizer.classify(["Contractor Invoice", "Freelancer Payment"])
    assert all(r == "Contractors" for r in results)


def test_classify_office(categorizer):
    results = categorizer.classify(["Office Supplies", "Office Rent"])
    assert all(r == "Office" for r in results)


def test_classify_empty_input(categorizer):
    results = categorizer.classify([])
    assert results == []


def test_classify_returns_correct_length(categorizer):
    inputs = ["AWS", "Payroll", "Office Supplies"]
    results = categorizer.classify(inputs)
    assert len(results) == len(inputs)


def test_classify_unknown_returns_other_or_known(categorizer):
    results = categorizer.classify(["xyzzy random gibberish 12345"])
    assert len(results) == 1
    assert isinstance(results[0], str)
