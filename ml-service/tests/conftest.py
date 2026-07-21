"""Shared test configuration — ensures ML_API_KEY is set before any test imports."""
import os

os.environ.setdefault("ML_API_KEY", "test-key")
