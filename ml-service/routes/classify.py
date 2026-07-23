# ml-service/routes/classify.py
"""Classification route for transaction categorization."""

import logging
from fastapi import APIRouter, HTTPException

from core.analytics import AnalyticsEngine, UsageRecord
from core.config import Tier, get_active_tier, get_tier_config
from core.explainability import ExplainabilityEngine
from core.history import PredictionHistory, PredictionRecord
from core.recommendations import RecommendationEngine
from core.risk import RiskScoringEngine
from models.schemas import ClassifyRequest, ClassifyResponse, ClassifyResult, Explanation, RiskAssessment
from services.categorizer import Categorizer

logger = logging.getLogger(__name__)

router = APIRouter()

_categorizer: Categorizer | None = None
_explainability: ExplainabilityEngine | None = None
_risk_engine: RiskScoringEngine | None = None
_recommendations_engine: RecommendationEngine | None = None
_history: PredictionHistory | None = None
_analytics: AnalyticsEngine | None = None


def init_services(
    categorizer: Categorizer,
    explainability: ExplainabilityEngine,
    risk_engine: RiskScoringEngine,
    recommendations_engine: RecommendationEngine,
    history: PredictionHistory,
    analytics: AnalyticsEngine | None = None,
) -> None:
    global _categorizer, _explainability, _risk_engine, _recommendations_engine, _history, _analytics
    _categorizer = categorizer
    _explainability = explainability
    _risk_engine = risk_engine
    _recommendations_engine = recommendations_engine
    _history = history
    _analytics = analytics


@router.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest) -> ClassifyResponse:
    if _categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    tier = Tier(req.tier) if req.tier else get_active_tier()
    config = get_tier_config(tier)

    if len(req.descriptions) > config.features.max_input_rows:
        raise HTTPException(status_code=400, detail=f"Max {config.features.max_input_rows} descriptions for {tier.value} tier")

    max_desc_len = 500
    for i, desc in enumerate(req.descriptions):
        if len(desc) > max_desc_len:
            raise HTTPException(status_code=422, detail=f"Description at index {i} exceeds max length of {max_desc_len}")

    logger.info("Classifying %d descriptions [tier=%s]", len(req.descriptions), tier.value)

    try:
        categories = _categorizer.classify(req.descriptions)
        probabilities = _categorizer.predict_proba(req.descriptions) if hasattr(_categorizer, "predict_proba") else None
    except Exception as e:
        logger.error("Classification failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    results = []
    all_risks = []

    for i, (desc, cat) in enumerate(zip(req.descriptions, categories)):
        probs = probabilities[i] if probabilities is not None else None
        prob_dict = {}
        confidence = 0.0

        if probs is not None and hasattr(_categorizer, "pipeline") and _categorizer.pipeline is not None:
            classes = _categorizer.pipeline.classes_
            prob_dict = {c: round(float(p), 4) for c, p in zip(classes, probs)}
            confidence = float(max(probs))

        explanation = Explanation()
        risk = RiskAssessment()
        recs = []

        if config.features.explainability and _explainability and _categorizer.pipeline:
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer
                import numpy as np
                tfidf = _categorizer.pipeline.named_steps.get("tfidf")
                if tfidf:
                    X = tfidf.transform([desc])
                    feature_names = tfidf.get_feature_names_out()
                    clf = _categorizer.pipeline.named_steps.get("clf")
                    if clf and hasattr(clf, "coef_"):
                        coef = clf.coef_
                        if cat in clf.classes_:
                            cat_idx = list(clf.classes_).index(cat)
                            cat_coef = coef[cat_idx]
                            top_indices = np.argsort(np.abs(cat_coef))[::-1][:5]
                            top_features = [(feature_names[j], round(float(cat_coef[j]), 6)) for j in top_indices]
                            explanation = Explanation(
                                methods_used=["tfidf_coef"],
                                feature_importance={f: s for f, s in top_features},
                                top_features=[{"feature": f, "importance": s, "direction": "positive" if s > 0 else "negative"} for f, s in top_features],
                                reasoning=f"Classification '{cat}' driven by: {', '.join(f for f, _ in top_features[:3])}",
                            )
            except Exception:
                pass

        if config.features.risk_scoring and _risk_engine:
            risk_obj = _risk_engine.compute_risk(confidence=confidence, data_points=len(req.descriptions))
            risk = RiskAssessment(
                overall_risk=risk_obj.overall_risk, risk_level=risk_obj.risk_level,
                model_risk=risk_obj.model_risk, data_risk=risk_obj.data_risk,
            )

        if config.features.recommendations and _recommendations_engine:
            recs = _recommendations_engine.generate_classification_recommendations(
                cat, confidence, prob_dict,
                explanation.top_features if explanation.top_features else None,
                risk.risk_level,
            )

        results.append(ClassifyResult(
            description=desc, category=cat, confidence=round(confidence, 4),
            probabilities=prob_dict, explanation=explanation,
            recommendations=recs, risk=risk,
        ))
        all_risks.append(risk.overall_risk)

        if _history:
            record = PredictionRecord(
                feature_name="classify",
                model_used="tfidf_logistic_regression",
                confidence=confidence,
                confidence_score=confidence,
                risk_score=risk.overall_risk,
                prediction={"category": cat},
                explanation={"reasoning": explanation.reasoning},
                recommendations=recs,
            )
            _history.log_prediction(record)

    avg_risk = float(sum(all_risks) / max(len(all_risks), 1))
    overall_risk = RiskAssessment(overall_risk=round(avg_risk, 4), risk_level="low" if avg_risk < 0.3 else "moderate")

    return ClassifyResponse(
        categories=categories,
        results=results,
        accuracy=0.0,
        confidence_score=float(sum(r.confidence for r in results) / max(len(results), 1)),
        model_used="tfidf_logistic_regression",
        risk=overall_risk,
        recommendations=[r for res in results for r in res.recommendations][:5],
    )
