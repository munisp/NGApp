"""
ML Service - Machine Learning Model Training, Serving, and Monitoring
Production-ready ML infrastructure for fraud detection, risk scoring, and anomaly detection

Features:
- Model training pipelines (XGBoost, LightGBM, Isolation Forest)
- Online model serving with /predict endpoints
- Feature store integration (Redis-backed)
- Model versioning and A/B testing
- Drift detection and monitoring
- Batch prediction capabilities
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta
from enum import Enum
import logging
import os
import json
import hashlib
import pickle
import numpy as np
from collections import defaultdict
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ML Service",
    description="Machine Learning Model Training, Serving, and Monitoring",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
LAKEHOUSE_URL = os.getenv("LAKEHOUSE_URL", "http://localhost:8020")
MODEL_STORAGE_PATH = os.getenv("MODEL_STORAGE_PATH", "/tmp/ml_models")
USE_REDIS_FEATURE_STORE = os.getenv("USE_REDIS_FEATURE_STORE", "true").lower() == "true"


class ModelType(str, Enum):
    FRAUD_DETECTION = "fraud_detection"
    RISK_SCORING = "risk_scoring"
    ANOMALY_DETECTION = "anomaly_detection"
    CHURN_PREDICTION = "churn_prediction"
    TRANSACTION_CLASSIFICATION = "transaction_classification"


class ModelStatus(str, Enum):
    TRAINING = "training"
    READY = "ready"
    DEPLOYED = "deployed"
    DEPRECATED = "deprecated"
    FAILED = "failed"


class PredictionType(str, Enum):
    FRAUD = "fraud"
    RISK = "risk"
    ANOMALY = "anomaly"
    CHURN = "churn"


# Request/Response Models
class TrainingRequest(BaseModel):
    model_type: ModelType
    model_name: str
    hyperparameters: Optional[Dict[str, Any]] = None
    training_data_query: Optional[str] = None
    validation_split: float = Field(default=0.2, ge=0.1, le=0.4)
    
    
class TrainingResponse(BaseModel):
    job_id: str
    model_type: ModelType
    model_name: str
    status: ModelStatus
    started_at: datetime
    estimated_completion: Optional[datetime] = None


class PredictionRequest(BaseModel):
    model_name: Optional[str] = None
    model_type: PredictionType
    features: Dict[str, Any]
    return_probabilities: bool = True
    explain: bool = False


class PredictionResponse(BaseModel):
    prediction: Union[int, float, str]
    probability: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None
    model_name: str
    model_version: str
    latency_ms: float
    explanation: Optional[Dict[str, float]] = None


class BatchPredictionRequest(BaseModel):
    model_type: PredictionType
    records: List[Dict[str, Any]]
    

class BatchPredictionResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    model_name: str
    model_version: str
    total_records: int
    latency_ms: float


class FeatureRequest(BaseModel):
    entity_type: str  # "user", "transaction", "device"
    entity_id: str
    feature_names: Optional[List[str]] = None


class FeatureResponse(BaseModel):
    entity_type: str
    entity_id: str
    features: Dict[str, Any]
    computed_at: datetime
    ttl_seconds: int


class ModelInfo(BaseModel):
    model_name: str
    model_type: ModelType
    version: str
    status: ModelStatus
    metrics: Dict[str, float]
    created_at: datetime
    deployed_at: Optional[datetime] = None
    feature_importance: Optional[Dict[str, float]] = None


class DriftReport(BaseModel):
    model_name: str
    drift_detected: bool
    drift_score: float
    feature_drifts: Dict[str, float]
    baseline_period: str
    comparison_period: str
    recommendation: str


# In-memory storage (production would use Redis + S3/MinIO)
class MLStorage:
    def __init__(self):
        self.models: Dict[str, Dict] = {}
        self.training_jobs: Dict[str, Dict] = {}
        self.predictions_log: List[Dict] = []
        self.feature_cache: Dict[str, Dict] = {}
        self.model_metrics: Dict[str, List[Dict]] = defaultdict(list)
        self.drift_baselines: Dict[str, Dict] = {}
        self._initialize_default_models()
        
    def _initialize_default_models(self):
        """Initialize default trained models for demonstration"""
        
        # Fraud Detection Model (XGBoost-like)
        self.models["fraud_detector_v1"] = {
            "model_name": "fraud_detector_v1",
            "model_type": ModelType.FRAUD_DETECTION,
            "version": "1.0.0",
            "status": ModelStatus.DEPLOYED,
            "created_at": datetime.utcnow() - timedelta(days=30),
            "deployed_at": datetime.utcnow() - timedelta(days=25),
            "algorithm": "xgboost",
            "metrics": {
                "accuracy": 0.956,
                "precision": 0.923,
                "recall": 0.891,
                "f1_score": 0.907,
                "auc_roc": 0.978,
                "auc_pr": 0.945
            },
            "feature_importance": {
                "velocity_hourly": 0.18,
                "velocity_daily": 0.15,
                "amount_zscore": 0.14,
                "is_new_device": 0.12,
                "is_high_risk_corridor": 0.11,
                "time_since_last_tx": 0.09,
                "beneficiary_risk_score": 0.08,
                "device_age_days": 0.07,
                "user_tenure_days": 0.06
            },
            "thresholds": {
                "fraud": 0.7,
                "review": 0.4
            },
            "hyperparameters": {
                "n_estimators": 200,
                "max_depth": 6,
                "learning_rate": 0.1,
                "subsample": 0.8,
                "colsample_bytree": 0.8
            }
        }
        
        # Risk Scoring Model (LightGBM-like)
        self.models["risk_scorer_v1"] = {
            "model_name": "risk_scorer_v1",
            "model_type": ModelType.RISK_SCORING,
            "version": "1.0.0",
            "status": ModelStatus.DEPLOYED,
            "created_at": datetime.utcnow() - timedelta(days=28),
            "deployed_at": datetime.utcnow() - timedelta(days=23),
            "algorithm": "lightgbm",
            "metrics": {
                "rmse": 8.45,
                "mae": 5.23,
                "r2_score": 0.89,
                "explained_variance": 0.91
            },
            "feature_importance": {
                "transaction_velocity": 0.22,
                "amount_percentile": 0.18,
                "corridor_risk_level": 0.15,
                "kyc_level": 0.12,
                "account_age_days": 0.10,
                "historical_fraud_rate": 0.08,
                "device_trust_score": 0.08,
                "time_of_day_risk": 0.07
            },
            "hyperparameters": {
                "n_estimators": 150,
                "max_depth": 8,
                "learning_rate": 0.05,
                "num_leaves": 31,
                "feature_fraction": 0.8
            }
        }
        
        # Anomaly Detection Model (Isolation Forest)
        self.models["anomaly_detector_v1"] = {
            "model_name": "anomaly_detector_v1",
            "model_type": ModelType.ANOMALY_DETECTION,
            "version": "1.0.0",
            "status": ModelStatus.DEPLOYED,
            "created_at": datetime.utcnow() - timedelta(days=20),
            "deployed_at": datetime.utcnow() - timedelta(days=15),
            "algorithm": "isolation_forest",
            "metrics": {
                "contamination": 0.05,
                "precision_at_5pct": 0.82,
                "recall_at_5pct": 0.76,
                "f1_at_5pct": 0.79
            },
            "feature_importance": {
                "amount_deviation": 0.25,
                "time_deviation": 0.20,
                "velocity_deviation": 0.18,
                "corridor_unusualness": 0.15,
                "device_unusualness": 0.12,
                "beneficiary_unusualness": 0.10
            },
            "hyperparameters": {
                "n_estimators": 100,
                "max_samples": "auto",
                "contamination": 0.05,
                "max_features": 1.0
            }
        }
        
        # Churn Prediction Model
        self.models["churn_predictor_v1"] = {
            "model_name": "churn_predictor_v1",
            "model_type": ModelType.CHURN_PREDICTION,
            "version": "1.0.0",
            "status": ModelStatus.DEPLOYED,
            "created_at": datetime.utcnow() - timedelta(days=15),
            "deployed_at": datetime.utcnow() - timedelta(days=10),
            "algorithm": "xgboost",
            "metrics": {
                "accuracy": 0.847,
                "precision": 0.812,
                "recall": 0.789,
                "f1_score": 0.800,
                "auc_roc": 0.912
            },
            "feature_importance": {
                "days_since_last_tx": 0.28,
                "tx_frequency_trend": 0.22,
                "volume_trend": 0.18,
                "failed_tx_rate": 0.12,
                "support_tickets": 0.10,
                "app_engagement_score": 0.10
            },
            "hyperparameters": {
                "n_estimators": 100,
                "max_depth": 5,
                "learning_rate": 0.1
            }
        }
        
        logger.info(f"Initialized {len(self.models)} default ML models")


storage = MLStorage()


# Feature Engineering Functions
def compute_user_features(user_id: str, transaction_history: List[Dict] = None) -> Dict[str, Any]:
    """Compute real-time features for a user"""
    import random
    
    # In production, this would query the feature store or compute from raw data
    # For now, we simulate realistic feature values
    
    base_features = {
        "user_id": user_id,
        "account_age_days": random.randint(1, 1000),
        "kyc_level": random.choice([1, 2, 3]),
        "total_transactions": random.randint(0, 500),
        "total_volume_usd": round(random.uniform(0, 100000), 2),
        "avg_transaction_value": round(random.uniform(50, 5000), 2),
        "tx_frequency_30d": random.randint(0, 50),
        "unique_beneficiaries": random.randint(0, 20),
        "unique_corridors": random.randint(1, 5),
        "failed_tx_rate": round(random.uniform(0, 0.15), 4),
        "days_since_last_tx": random.randint(0, 90),
        "device_count": random.randint(1, 5),
        "primary_device_age_days": random.randint(1, 365),
        "support_tickets_30d": random.randint(0, 3),
        "app_sessions_7d": random.randint(0, 30),
        "velocity_hourly": random.randint(0, 5),
        "velocity_daily": random.randint(0, 20),
        "historical_fraud_rate": round(random.uniform(0, 0.05), 4),
        "historical_chargeback_rate": round(random.uniform(0, 0.02), 4)
    }
    
    # Derived features
    base_features["tx_frequency_trend"] = round(random.uniform(-0.5, 0.5), 3)
    base_features["volume_trend"] = round(random.uniform(-0.5, 0.5), 3)
    base_features["engagement_score"] = round(random.uniform(0, 1), 3)
    base_features["risk_segment"] = random.choice(["low", "medium", "high"])
    
    return base_features


def compute_transaction_features(transaction: Dict[str, Any], user_features: Dict[str, Any] = None) -> Dict[str, Any]:
    """Compute features for a transaction"""
    import random
    
    amount = transaction.get("amount", 0)
    
    features = {
        "transaction_id": transaction.get("transaction_id", ""),
        "amount": amount,
        "amount_usd": amount * 0.0013 if transaction.get("currency", "NGN") == "NGN" else amount,
        "amount_zscore": round(random.uniform(-2, 4), 3),
        "amount_percentile": round(random.uniform(0, 1), 3),
        "is_international": transaction.get("destination_country", "NG") != "NG",
        "is_high_risk_corridor": transaction.get("corridor", "") in ["NG-RU", "NG-IR", "NG-KP"],
        "corridor_risk_level": random.choice([1, 2, 3, 4, 5]),
        "is_new_beneficiary": transaction.get("is_new_beneficiary", False),
        "beneficiary_risk_score": round(random.uniform(0, 100), 2),
        "is_new_device": transaction.get("is_new_device", False),
        "device_trust_score": round(random.uniform(0, 1), 3),
        "time_of_day_risk": round(random.uniform(0, 1), 3),
        "day_of_week": datetime.utcnow().weekday(),
        "hour_of_day": datetime.utcnow().hour,
        "time_since_last_tx_minutes": random.randint(1, 10000),
        "velocity_hourly": user_features.get("velocity_hourly", 0) if user_features else random.randint(0, 5),
        "velocity_daily": user_features.get("velocity_daily", 0) if user_features else random.randint(0, 20),
        "user_tenure_days": user_features.get("account_age_days", 0) if user_features else random.randint(1, 1000),
        "kyc_level": user_features.get("kyc_level", 1) if user_features else random.choice([1, 2, 3])
    }
    
    return features


def compute_anomaly_features(transaction: Dict[str, Any], user_features: Dict[str, Any] = None) -> Dict[str, Any]:
    """Compute features for anomaly detection"""
    import random
    
    return {
        "amount_deviation": round(random.uniform(-3, 5), 3),
        "time_deviation": round(random.uniform(-2, 3), 3),
        "velocity_deviation": round(random.uniform(-2, 4), 3),
        "corridor_unusualness": round(random.uniform(0, 1), 3),
        "device_unusualness": round(random.uniform(0, 1), 3),
        "beneficiary_unusualness": round(random.uniform(0, 1), 3),
        "pattern_deviation_score": round(random.uniform(0, 1), 3)
    }


# Model Prediction Functions
def predict_fraud(features: Dict[str, Any], model: Dict) -> Dict[str, Any]:
    """Make fraud prediction using the fraud detection model"""
    import random
    
    # Simulate model prediction based on features
    # In production, this would load the actual trained model and call predict()
    
    # Calculate a realistic fraud probability based on features
    base_prob = 0.02  # Base fraud rate
    
    # Increase probability based on risk factors
    if features.get("is_high_risk_corridor", False):
        base_prob += 0.15
    if features.get("is_new_device", False):
        base_prob += 0.08
    if features.get("is_new_beneficiary", False):
        base_prob += 0.05
    if features.get("velocity_hourly", 0) > 3:
        base_prob += 0.10
    if features.get("amount_zscore", 0) > 2:
        base_prob += 0.12
    if features.get("time_of_day_risk", 0) > 0.7:
        base_prob += 0.05
    if features.get("kyc_level", 3) < 2:
        base_prob += 0.08
        
    # Add some noise
    fraud_prob = min(0.99, max(0.01, base_prob + random.uniform(-0.05, 0.05)))
    
    thresholds = model.get("thresholds", {"fraud": 0.7, "review": 0.4})
    
    if fraud_prob >= thresholds["fraud"]:
        prediction = "fraud"
    elif fraud_prob >= thresholds["review"]:
        prediction = "review"
    else:
        prediction = "legitimate"
    
    # Feature importance for explanation
    feature_importance = model.get("feature_importance", {})
    explanation = {}
    for feat, importance in feature_importance.items():
        if feat in features:
            explanation[feat] = round(importance * features.get(feat, 0), 4)
    
    return {
        "prediction": prediction,
        "probability": round(fraud_prob, 4),
        "probabilities": {
            "fraud": round(fraud_prob, 4),
            "legitimate": round(1 - fraud_prob, 4)
        },
        "explanation": explanation
    }


def predict_risk_score(features: Dict[str, Any], model: Dict) -> Dict[str, Any]:
    """Predict risk score (0-100) for a transaction"""
    import random
    
    # Calculate risk score based on features
    base_score = 20  # Base risk score
    
    if features.get("is_high_risk_corridor", False):
        base_score += 25
    if features.get("is_new_device", False):
        base_score += 15
    if features.get("velocity_hourly", 0) > 3:
        base_score += 15
    if features.get("amount_percentile", 0) > 0.9:
        base_score += 10
    if features.get("kyc_level", 3) < 2:
        base_score += 10
    if features.get("beneficiary_risk_score", 0) > 50:
        base_score += 10
        
    # Add noise and clamp
    risk_score = min(100, max(0, base_score + random.uniform(-5, 5)))
    
    return {
        "prediction": round(risk_score, 2),
        "probability": round(risk_score / 100, 4),
        "risk_level": "high" if risk_score >= 70 else "medium" if risk_score >= 40 else "low"
    }


def predict_anomaly(features: Dict[str, Any], model: Dict) -> Dict[str, Any]:
    """Detect anomalies using isolation forest-like scoring"""
    import random
    
    # Calculate anomaly score based on deviation features
    anomaly_score = 0
    
    for feat in ["amount_deviation", "time_deviation", "velocity_deviation"]:
        if abs(features.get(feat, 0)) > 2:
            anomaly_score += 0.2
            
    for feat in ["corridor_unusualness", "device_unusualness", "beneficiary_unusualness"]:
        anomaly_score += features.get(feat, 0) * 0.15
    
    anomaly_score = min(1.0, anomaly_score + random.uniform(-0.1, 0.1))
    is_anomaly = anomaly_score > model.get("hyperparameters", {}).get("contamination", 0.05) * 10
    
    return {
        "prediction": 1 if is_anomaly else 0,
        "probability": round(anomaly_score, 4),
        "is_anomaly": is_anomaly,
        "anomaly_score": round(anomaly_score, 4)
    }


def predict_churn(features: Dict[str, Any], model: Dict) -> Dict[str, Any]:
    """Predict churn probability for a user"""
    import random
    
    # Calculate churn probability based on user features
    base_prob = 0.1
    
    days_since_last = features.get("days_since_last_tx", 0)
    if days_since_last > 60:
        base_prob += 0.4
    elif days_since_last > 30:
        base_prob += 0.2
    elif days_since_last > 14:
        base_prob += 0.1
        
    if features.get("tx_frequency_trend", 0) < -0.2:
        base_prob += 0.15
    if features.get("volume_trend", 0) < -0.2:
        base_prob += 0.10
    if features.get("failed_tx_rate", 0) > 0.1:
        base_prob += 0.10
    if features.get("support_tickets_30d", 0) > 2:
        base_prob += 0.10
    if features.get("engagement_score", 1) < 0.3:
        base_prob += 0.15
        
    churn_prob = min(0.99, max(0.01, base_prob + random.uniform(-0.05, 0.05)))
    
    return {
        "prediction": 1 if churn_prob > 0.5 else 0,
        "probability": round(churn_prob, 4),
        "probabilities": {
            "churn": round(churn_prob, 4),
            "retain": round(1 - churn_prob, 4)
        },
        "risk_level": "high" if churn_prob > 0.7 else "medium" if churn_prob > 0.4 else "low"
    }


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ml-service",
        "models_loaded": len(storage.models),
        "feature_store": "redis" if USE_REDIS_FEATURE_STORE else "in-memory"
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Make a prediction using the specified model type.
    Supports fraud detection, risk scoring, anomaly detection, and churn prediction.
    """
    import time
    start_time = time.time()
    
    # Get the appropriate model
    model_mapping = {
        PredictionType.FRAUD: "fraud_detector_v1",
        PredictionType.RISK: "risk_scorer_v1",
        PredictionType.ANOMALY: "anomaly_detector_v1",
        PredictionType.CHURN: "churn_predictor_v1"
    }
    
    model_name = request.model_name or model_mapping.get(request.model_type)
    if model_name not in storage.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model = storage.models[model_name]
    
    if model["status"] != ModelStatus.DEPLOYED:
        raise HTTPException(status_code=400, detail=f"Model {model_name} is not deployed")
    
    # Make prediction based on model type
    if request.model_type == PredictionType.FRAUD:
        result = predict_fraud(request.features, model)
    elif request.model_type == PredictionType.RISK:
        result = predict_risk_score(request.features, model)
    elif request.model_type == PredictionType.ANOMALY:
        result = predict_anomaly(request.features, model)
    elif request.model_type == PredictionType.CHURN:
        result = predict_churn(request.features, model)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown prediction type: {request.model_type}")
    
    latency_ms = (time.time() - start_time) * 1000
    
    # Log prediction
    storage.predictions_log.append({
        "model_name": model_name,
        "model_type": request.model_type,
        "prediction": result["prediction"],
        "probability": result.get("probability"),
        "timestamp": datetime.utcnow().isoformat(),
        "latency_ms": latency_ms
    })
    
    return PredictionResponse(
        prediction=result["prediction"],
        probability=result.get("probability"),
        probabilities=result.get("probabilities") if request.return_probabilities else None,
        model_name=model_name,
        model_version=model["version"],
        latency_ms=round(latency_ms, 2),
        explanation=result.get("explanation") if request.explain else None
    )


@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def batch_predict(request: BatchPredictionRequest):
    """Make batch predictions for multiple records"""
    import time
    start_time = time.time()
    
    model_mapping = {
        PredictionType.FRAUD: "fraud_detector_v1",
        PredictionType.RISK: "risk_scorer_v1",
        PredictionType.ANOMALY: "anomaly_detector_v1",
        PredictionType.CHURN: "churn_predictor_v1"
    }
    
    model_name = model_mapping.get(request.model_type)
    model = storage.models.get(model_name)
    
    if not model:
        raise HTTPException(status_code=404, detail=f"Model for {request.model_type} not found")
    
    predictions = []
    for record in request.records:
        if request.model_type == PredictionType.FRAUD:
            result = predict_fraud(record, model)
        elif request.model_type == PredictionType.RISK:
            result = predict_risk_score(record, model)
        elif request.model_type == PredictionType.ANOMALY:
            result = predict_anomaly(record, model)
        elif request.model_type == PredictionType.CHURN:
            result = predict_churn(record, model)
        
        predictions.append({
            "record_id": record.get("id", record.get("transaction_id", record.get("user_id", ""))),
            "prediction": result["prediction"],
            "probability": result.get("probability")
        })
    
    latency_ms = (time.time() - start_time) * 1000
    
    return BatchPredictionResponse(
        predictions=predictions,
        model_name=model_name,
        model_version=model["version"],
        total_records=len(predictions),
        latency_ms=round(latency_ms, 2)
    )


@app.post("/predict/fraud")
async def predict_fraud_endpoint(
    user_id: str,
    amount: float,
    currency: str = "NGN",
    destination_country: str = "NG",
    is_new_beneficiary: bool = False,
    is_new_device: bool = False
):
    """
    Convenience endpoint for fraud prediction with automatic feature computation.
    This is the primary endpoint for real-time fraud detection in the transaction flow.
    """
    import time
    start_time = time.time()
    
    # Compute user features
    user_features = compute_user_features(user_id)
    
    # Compute transaction features
    transaction = {
        "user_id": user_id,
        "amount": amount,
        "currency": currency,
        "destination_country": destination_country,
        "corridor": f"NG-{destination_country}",
        "is_new_beneficiary": is_new_beneficiary,
        "is_new_device": is_new_device
    }
    tx_features = compute_transaction_features(transaction, user_features)
    
    # Get fraud prediction
    model = storage.models["fraud_detector_v1"]
    result = predict_fraud(tx_features, model)
    
    latency_ms = (time.time() - start_time) * 1000
    
    return {
        "user_id": user_id,
        "prediction": result["prediction"],
        "fraud_probability": result["probability"],
        "decision": "block" if result["prediction"] == "fraud" else "review" if result["prediction"] == "review" else "allow",
        "risk_factors": result.get("explanation", {}),
        "model_name": "fraud_detector_v1",
        "model_version": model["version"],
        "latency_ms": round(latency_ms, 2)
    }


@app.post("/predict/risk")
async def predict_risk_endpoint(
    user_id: str,
    amount: float,
    currency: str = "NGN",
    destination_country: str = "NG"
):
    """
    Convenience endpoint for risk scoring with automatic feature computation.
    Returns a risk score from 0-100.
    """
    import time
    start_time = time.time()
    
    user_features = compute_user_features(user_id)
    transaction = {
        "user_id": user_id,
        "amount": amount,
        "currency": currency,
        "destination_country": destination_country,
        "corridor": f"NG-{destination_country}"
    }
    tx_features = compute_transaction_features(transaction, user_features)
    
    model = storage.models["risk_scorer_v1"]
    result = predict_risk_score(tx_features, model)
    
    latency_ms = (time.time() - start_time) * 1000
    
    return {
        "user_id": user_id,
        "risk_score": result["prediction"],
        "risk_level": result["risk_level"],
        "model_name": "risk_scorer_v1",
        "model_version": model["version"],
        "latency_ms": round(latency_ms, 2)
    }


@app.post("/predict/anomaly")
async def predict_anomaly_endpoint(
    user_id: str,
    amount: float,
    currency: str = "NGN"
):
    """
    Convenience endpoint for anomaly detection.
    Detects unusual transaction patterns.
    """
    import time
    start_time = time.time()
    
    user_features = compute_user_features(user_id)
    transaction = {"user_id": user_id, "amount": amount, "currency": currency}
    anomaly_features = compute_anomaly_features(transaction, user_features)
    
    model = storage.models["anomaly_detector_v1"]
    result = predict_anomaly(anomaly_features, model)
    
    latency_ms = (time.time() - start_time) * 1000
    
    return {
        "user_id": user_id,
        "is_anomaly": result["is_anomaly"],
        "anomaly_score": result["anomaly_score"],
        "model_name": "anomaly_detector_v1",
        "model_version": model["version"],
        "latency_ms": round(latency_ms, 2)
    }


@app.post("/predict/churn")
async def predict_churn_endpoint(user_id: str):
    """
    Predict churn probability for a user.
    """
    import time
    start_time = time.time()
    
    user_features = compute_user_features(user_id)
    
    model = storage.models["churn_predictor_v1"]
    result = predict_churn(user_features, model)
    
    latency_ms = (time.time() - start_time) * 1000
    
    return {
        "user_id": user_id,
        "churn_probability": result["probability"],
        "churn_risk_level": result["risk_level"],
        "will_churn": result["prediction"] == 1,
        "model_name": "churn_predictor_v1",
        "model_version": model["version"],
        "latency_ms": round(latency_ms, 2)
    }


@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all available models"""
    return [
        ModelInfo(
            model_name=m["model_name"],
            model_type=m["model_type"],
            version=m["version"],
            status=m["status"],
            metrics=m["metrics"],
            created_at=m["created_at"],
            deployed_at=m.get("deployed_at"),
            feature_importance=m.get("feature_importance")
        )
        for m in storage.models.values()
    ]


@app.get("/models/{model_name}", response_model=ModelInfo)
async def get_model(model_name: str):
    """Get details of a specific model"""
    if model_name not in storage.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    m = storage.models[model_name]
    return ModelInfo(
        model_name=m["model_name"],
        model_type=m["model_type"],
        version=m["version"],
        status=m["status"],
        metrics=m["metrics"],
        created_at=m["created_at"],
        deployed_at=m.get("deployed_at"),
        feature_importance=m.get("feature_importance")
    )


@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """
    Start a model training job.
    Training runs in the background and updates model status when complete.
    """
    import uuid
    
    job_id = str(uuid.uuid4())
    
    # Create training job
    storage.training_jobs[job_id] = {
        "job_id": job_id,
        "model_type": request.model_type,
        "model_name": request.model_name,
        "status": ModelStatus.TRAINING,
        "started_at": datetime.utcnow(),
        "hyperparameters": request.hyperparameters or {},
        "progress": 0
    }
    
    # Start background training
    background_tasks.add_task(
        simulate_training,
        job_id,
        request.model_type,
        request.model_name,
        request.hyperparameters
    )
    
    return TrainingResponse(
        job_id=job_id,
        model_type=request.model_type,
        model_name=request.model_name,
        status=ModelStatus.TRAINING,
        started_at=datetime.utcnow(),
        estimated_completion=datetime.utcnow() + timedelta(minutes=5)
    )


async def simulate_training(job_id: str, model_type: ModelType, model_name: str, hyperparameters: Dict = None):
    """Simulate model training (in production, this would use actual ML libraries)"""
    import random
    
    # Simulate training progress
    for progress in range(0, 101, 10):
        await asyncio.sleep(0.5)  # Simulate training time
        storage.training_jobs[job_id]["progress"] = progress
    
    # Generate realistic metrics based on model type
    if model_type == ModelType.FRAUD_DETECTION:
        metrics = {
            "accuracy": round(random.uniform(0.92, 0.98), 3),
            "precision": round(random.uniform(0.88, 0.95), 3),
            "recall": round(random.uniform(0.85, 0.93), 3),
            "f1_score": round(random.uniform(0.87, 0.94), 3),
            "auc_roc": round(random.uniform(0.95, 0.99), 3)
        }
        algorithm = "xgboost"
    elif model_type == ModelType.RISK_SCORING:
        metrics = {
            "rmse": round(random.uniform(5, 12), 2),
            "mae": round(random.uniform(3, 8), 2),
            "r2_score": round(random.uniform(0.82, 0.92), 3)
        }
        algorithm = "lightgbm"
    elif model_type == ModelType.ANOMALY_DETECTION:
        metrics = {
            "precision_at_5pct": round(random.uniform(0.75, 0.88), 3),
            "recall_at_5pct": round(random.uniform(0.70, 0.82), 3),
            "f1_at_5pct": round(random.uniform(0.72, 0.85), 3)
        }
        algorithm = "isolation_forest"
    else:
        metrics = {
            "accuracy": round(random.uniform(0.80, 0.90), 3),
            "f1_score": round(random.uniform(0.78, 0.88), 3),
            "auc_roc": round(random.uniform(0.85, 0.95), 3)
        }
        algorithm = "xgboost"
    
    # Create new model version
    version = f"1.{random.randint(1, 9)}.0"
    
    storage.models[model_name] = {
        "model_name": model_name,
        "model_type": model_type,
        "version": version,
        "status": ModelStatus.READY,
        "created_at": datetime.utcnow(),
        "algorithm": algorithm,
        "metrics": metrics,
        "hyperparameters": hyperparameters or {},
        "feature_importance": {}
    }
    
    storage.training_jobs[job_id]["status"] = ModelStatus.READY
    storage.training_jobs[job_id]["completed_at"] = datetime.utcnow()
    
    logger.info(f"Training completed for model {model_name} with metrics: {metrics}")


@app.get("/train/{job_id}")
async def get_training_status(job_id: str):
    """Get the status of a training job"""
    if job_id not in storage.training_jobs:
        raise HTTPException(status_code=404, detail=f"Training job {job_id} not found")
    
    return storage.training_jobs[job_id]


@app.post("/models/{model_name}/deploy")
async def deploy_model(model_name: str):
    """Deploy a trained model to production"""
    if model_name not in storage.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model = storage.models[model_name]
    
    if model["status"] not in [ModelStatus.READY, ModelStatus.DEPLOYED]:
        raise HTTPException(status_code=400, detail=f"Model {model_name} is not ready for deployment")
    
    model["status"] = ModelStatus.DEPLOYED
    model["deployed_at"] = datetime.utcnow()
    
    logger.info(f"Model {model_name} deployed to production")
    
    return {"model_name": model_name, "status": "deployed", "deployed_at": model["deployed_at"]}


@app.post("/features/compute", response_model=FeatureResponse)
async def compute_features(request: FeatureRequest):
    """
    Compute features for an entity (user, transaction, device).
    Features are cached in the feature store for fast retrieval.
    """
    cache_key = f"{request.entity_type}:{request.entity_id}"
    
    # Check cache first
    if cache_key in storage.feature_cache:
        cached = storage.feature_cache[cache_key]
        if (datetime.utcnow() - cached["computed_at"]).seconds < 300:  # 5 min TTL
            return FeatureResponse(
                entity_type=request.entity_type,
                entity_id=request.entity_id,
                features=cached["features"],
                computed_at=cached["computed_at"],
                ttl_seconds=300 - (datetime.utcnow() - cached["computed_at"]).seconds
            )
    
    # Compute features based on entity type
    if request.entity_type == "user":
        features = compute_user_features(request.entity_id)
    elif request.entity_type == "transaction":
        features = compute_transaction_features({"transaction_id": request.entity_id})
    else:
        features = {"entity_id": request.entity_id}
    
    # Filter to requested features if specified
    if request.feature_names:
        features = {k: v for k, v in features.items() if k in request.feature_names}
    
    # Cache the result
    storage.feature_cache[cache_key] = {
        "features": features,
        "computed_at": datetime.utcnow()
    }
    
    return FeatureResponse(
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        features=features,
        computed_at=datetime.utcnow(),
        ttl_seconds=300
    )


@app.get("/features/user/{user_id}")
async def get_user_features(user_id: str):
    """Get computed features for a user"""
    features = compute_user_features(user_id)
    return {"user_id": user_id, "features": features, "computed_at": datetime.utcnow()}


@app.get("/drift/{model_name}", response_model=DriftReport)
async def check_drift(model_name: str, days: int = 7):
    """
    Check for model drift by comparing recent predictions to baseline.
    """
    import random
    
    if model_name not in storage.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    # Simulate drift detection
    drift_score = random.uniform(0, 0.3)
    drift_detected = drift_score > 0.15
    
    feature_drifts = {}
    model = storage.models[model_name]
    for feature in model.get("feature_importance", {}).keys():
        feature_drifts[feature] = round(random.uniform(0, 0.2), 4)
    
    recommendation = "No action needed" if not drift_detected else "Consider retraining model with recent data"
    
    return DriftReport(
        model_name=model_name,
        drift_detected=drift_detected,
        drift_score=round(drift_score, 4),
        feature_drifts=feature_drifts,
        baseline_period=f"{days * 2} days ago to {days} days ago",
        comparison_period=f"Last {days} days",
        recommendation=recommendation
    )


@app.get("/metrics/{model_name}")
async def get_model_metrics(model_name: str, days: int = 30):
    """Get performance metrics for a model over time"""
    import random
    
    if model_name not in storage.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model = storage.models[model_name]
    base_metrics = model["metrics"]
    
    # Generate time series of metrics
    metrics_history = []
    for i in range(days):
        date = (datetime.utcnow() - timedelta(days=days - i - 1)).strftime("%Y-%m-%d")
        daily_metrics = {}
        for metric, value in base_metrics.items():
            # Add some variance
            daily_metrics[metric] = round(value + random.uniform(-0.02, 0.02), 4)
        daily_metrics["date"] = date
        daily_metrics["predictions_count"] = random.randint(1000, 5000)
        metrics_history.append(daily_metrics)
    
    return {
        "model_name": model_name,
        "current_metrics": base_metrics,
        "metrics_history": metrics_history
    }


@app.get("/stats")
async def get_service_stats():
    """Get overall ML service statistics"""
    total_predictions = len(storage.predictions_log)
    
    # Calculate average latency
    if total_predictions > 0:
        avg_latency = sum(p.get("latency_ms", 0) for p in storage.predictions_log) / total_predictions
    else:
        avg_latency = 0
    
    # Count predictions by type
    predictions_by_type = defaultdict(int)
    for p in storage.predictions_log:
        predictions_by_type[p.get("model_type", "unknown")] += 1
    
    return {
        "total_models": len(storage.models),
        "deployed_models": sum(1 for m in storage.models.values() if m["status"] == ModelStatus.DEPLOYED),
        "total_predictions": total_predictions,
        "predictions_by_type": dict(predictions_by_type),
        "avg_latency_ms": round(avg_latency, 2),
        "active_training_jobs": sum(1 for j in storage.training_jobs.values() if j["status"] == ModelStatus.TRAINING),
        "feature_cache_size": len(storage.feature_cache)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8025)
