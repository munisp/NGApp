import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
"""
Fraud Detection Engine
Port: 8153

Production fraud detection service with:
- Deterministic feature-based ML scoring (amount, velocity, geo, device, time, merchant)
- Configurable rules engine (8 rules with block/review/allow decisions)
- Ensemble ML model (RandomForest + XGBoost + IsolationForest) via real_fraud_model
- SQLAlchemy-backed case management (Transaction → FraudCheckResult → Case)
- External ML service fallback via FRAUD_ML_SERVICE_URL
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

apply_middleware(app)
setup_logging("fraud-detection-engine")
app.include_router(metrics_router)

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import logging
import uvicorn

from config import settings, get_db, get_ml_service, init_db, MLService, Base, engine
from models import (
    TransactionCreate, TransactionRead, TransactionCheckResponse,
    FraudCheckResultRead, CaseRead, CaseUpdate, CaseStatus,
    DecisionStatus, Transaction, FraudCheckResult, Case,
)
from router import router as fraud_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fraud Detection Engine",
    description="Production fraud detection with ML scoring, rules engine, and case management",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:5173,http://localhost:5174,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fraud_router)

_ensemble_model = None
stats = {
    "total_checks": 0,
    "total_blocked": 0,
    "total_reviewed": 0,
    "total_allowed": 0,
    "start_time": datetime.now(),
}


def _get_ensemble_model():
    global _ensemble_model
    if _ensemble_model is None:
        try:
            from real_fraud_model import RealFraudDetectionModel
            _ensemble_model = RealFraudDetectionModel()
            logger.info("Ensemble fraud model (RF+XGB+IsoForest) initialized")
        except Exception as e:
            logger.warning(f"Ensemble model unavailable, using deterministic scoring only: {e}")
    return _ensemble_model


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Fraud Detection Engine started on port 8153")
    _get_ensemble_model()


@app.get("/")
async def root():
    return {
        "service": "fraud-detection-engine",
        "description": "Production fraud detection with ML scoring, rules engine, and case management",
        "version": "2.0.0",
        "port": 8153,
        "status": "operational",
        "endpoints": {
            "check_transaction": "POST /fraud/check_transaction",
            "ensemble_predict": "POST /ensemble/predict",
            "cases": "GET /fraud/cases",
            "health": "GET /health",
            "stats": "GET /stats",
            "config": "GET /config",
        }
    }


class EnsemblePredictRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique transaction identifier")
    amount: float = Field(..., gt=0)
    hour: int = Field(12, ge=0, le=23)
    day_of_week: int = Field(0, ge=0, le=6)
    merchant_category: int = Field(0, ge=0)
    transaction_count_1h: int = Field(0, ge=0)
    transaction_count_24h: int = Field(0, ge=0)
    amount_sum_1h: float = Field(0.0, ge=0)
    amount_sum_24h: float = Field(0.0, ge=0)
    distance_from_home: float = Field(0.0, ge=0)
    is_weekend: int = Field(0, ge=0, le=1)
    is_night: int = Field(0, ge=0, le=1)
    device_score: float = Field(0.0, ge=0, le=1)
    location_risk: float = Field(0.0, ge=0, le=1)
    velocity_score: float = Field(0.0, ge=0)
    behavioral_score: float = Field(0.0)
    network_risk: float = Field(0.0, ge=0, le=1)
    customer_age_days: float = Field(365.0, ge=0)
    avg_amount_30d: float = Field(0.0, ge=0)
    transaction_frequency: float = Field(0.0, ge=0)
    cross_border: int = Field(0, ge=0, le=1)


@app.post("/ensemble/predict")
async def ensemble_predict(req: EnsemblePredictRequest):
    """Run the full ensemble model (RF + XGBoost + IsolationForest + meta-learner)
    on a transaction feature vector and return per-model scores, risk level,
    feature importance, and human-readable explanations."""
    model = _get_ensemble_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Ensemble model not available. Install sklearn/xgboost/lightgbm."
        )

    features = req.model_dump()
    result = model.predict_fraud(features)

    stats["total_checks"] += 1
    if result.risk_level == "CRITICAL":
        stats["total_blocked"] += 1
    elif result.risk_level == "HIGH":
        stats["total_reviewed"] += 1
    else:
        stats["total_allowed"] += 1

    return {
        "transaction_id": result.transaction_id,
        "fraud_probability": round(result.fraud_probability, 4),
        "risk_score": round(result.risk_score, 1),
        "risk_level": result.risk_level,
        "confidence": round(result.confidence, 4),
        "model_predictions": {k: round(v, 4) for k, v in result.model_predictions.items()},
        "feature_importance": {k: round(v, 4) for k, v in result.feature_importance.items()},
        "explanation": result.explanation,
        "timestamp": result.timestamp.isoformat(),
    }


class QuickScreenRequest(BaseModel):
    user_id: int = Field(..., description="User/customer ID")
    merchant_id: int = Field(..., description="Merchant ID")
    amount: float = Field(..., gt=0)
    currency: str = Field("NGN", min_length=3, max_length=3)
    country: str = Field("NG", min_length=2, max_length=2)
    ip_country: str = Field("")
    usual_country: str = Field("NG")
    device_fingerprint: str = Field("")
    known_devices: List[str] = Field(default_factory=list)
    is_new_device: bool = Field(False)
    is_new_location: bool = Field(False)
    beneficiary_is_new: bool = Field(False)
    channel: str = Field("")
    merchant_category: str = Field("")
    merchant_risk_score: float = Field(0.0)
    hour: int = Field(12, ge=0, le=23)
    usual_active_hours: List[int] = Field(default_factory=list)
    transaction_count_24h: int = Field(0, ge=0)
    transaction_count_1h: int = Field(0, ge=0)
    avg_transaction_amount: float = Field(50000.0, ge=0)
    std_transaction_amount: float = Field(25000.0, ge=0)


@app.post("/screen")
async def quick_screen(req: QuickScreenRequest):
    """Lightweight fraud screening using the deterministic scoring model + rules engine.
    Does NOT persist to the database (use /fraud/check_transaction for full persistence).
    Returns ML score, triggered rules, and decision in <50ms."""
    ml_service = get_ml_service()
    tx_data = req.model_dump()

    ml_score = ml_service.score_transaction(tx_data)
    rules = ml_service.apply_rules(tx_data)
    decision, reason = ml_service.get_decision(ml_score, rules)

    stats["total_checks"] += 1
    if decision == "BLOCK":
        stats["total_blocked"] += 1
    elif decision == "REVIEW":
        stats["total_reviewed"] += 1
    else:
        stats["total_allowed"] += 1

    return {
        "ml_score": round(ml_score, 4),
        "rules_triggered": rules,
        "decision": decision,
        "reason": reason,
        "screened_at": datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health_check():
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    ensemble_ready = _ensemble_model is not None and _ensemble_model.is_trained
    return {
        "status": "healthy",
        "uptime_seconds": int(uptime),
        "total_checks": stats["total_checks"],
        "ensemble_model_ready": ensemble_ready,
        "rules_engine_enabled": settings.RULES_ENGINE_ENABLED,
        "ml_threshold": settings.ML_MODEL_THRESHOLD,
        "external_ml_url": settings.FRAUD_ML_SERVICE_URL or None,
    }


@app.get("/stats")
async def get_statistics():
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    return {
        "uptime_seconds": int(uptime),
        "total_checks": stats["total_checks"],
        "total_blocked": stats["total_blocked"],
        "total_reviewed": stats["total_reviewed"],
        "total_allowed": stats["total_allowed"],
        "block_rate": round(stats["total_blocked"] / max(stats["total_checks"], 1), 4),
        "review_rate": round(stats["total_reviewed"] / max(stats["total_checks"], 1), 4),
        "service": "fraud-detection-engine",
        "port": 8153,
        "status": "operational",
    }


@app.get("/config")
async def get_config():
    """Return current fraud engine configuration (non-secret values)."""
    return {
        "ml_model_threshold": settings.ML_MODEL_THRESHOLD,
        "rules_engine_enabled": settings.RULES_ENGINE_ENABLED,
        "velocity_check_window_hours": settings.VELOCITY_CHECK_WINDOW_HOURS,
        "high_value_threshold_ngn": settings.HIGH_VALUE_THRESHOLD_NGN,
        "max_velocity_count": settings.MAX_VELOCITY_COUNT,
        "weights": {
            "amount_anomaly": settings.AMOUNT_ANOMALY_WEIGHT,
            "velocity": settings.VELOCITY_WEIGHT,
            "geo_anomaly": settings.GEO_ANOMALY_WEIGHT,
            "device_fingerprint": settings.DEVICE_FINGERPRINT_WEIGHT,
            "time_anomaly": settings.TIME_ANOMALY_WEIGHT,
            "merchant_risk": settings.MERCHANT_RISK_WEIGHT,
        },
        "suspicious_countries": settings.SUSPICIOUS_COUNTRIES.split(","),
        "external_ml_service": bool(settings.FRAUD_ML_SERVICE_URL),
        "ensemble_model_loaded": _ensemble_model is not None,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8153)
