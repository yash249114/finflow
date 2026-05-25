# ml-service/routes/classify.py
"""Classification route for transaction categorization."""

import logging
from fastapi import APIRouter, HTTPException

from models.schemas import ClassifyRequest, ClassifyResponse
from services.categorizer import Categorizer

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level categorizer instance — loaded once at import time
_categorizer: Categorizer | None = None


def init_categorizer(categorizer: Categorizer) -> None:
    """Initialize the categorizer instance for this route module."""
    global _categorizer
    _categorizer = categorizer


@router.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest) -> ClassifyResponse:
    """Classify transaction descriptions into categories."""
    if _categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    logger.info("Classifying %d descriptions", len(req.descriptions))

    try:
        categories = _categorizer.classify(req.descriptions)
    except Exception as e:
        logger.error("Classification failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    return ClassifyResponse(categories=categories)
