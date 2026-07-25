"""Pydantic models for MLOps Governance."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ModelStatus(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class ModelType(str, Enum):
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    NLP = "nlp"
    COMPUTER_VISION = "computer_vision"
    RECOMMENDATION = "recommendation"
    ANOMALY_DETECTION = "anomaly_detection"


class DriftType(str, Enum):
    DATA_DRIFT = "data_drift"
    CONCEPT_DRIFT = "concept_drift"
    PREDICTION_DRIFT = "prediction_drift"
    FEATURE_DRIFT = "feature_drift"


class DriftSeverity(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RegisteredModel(BaseModel):
    id: str
    name: str
    version: str
    model_type: ModelType
    status: ModelStatus
    description: str
    owner: str
    framework: str  # pytorch, sklearn, xgboost, tensorflow
    metrics: dict  # accuracy, f1, auc, etc.
    input_schema: dict
    output_schema: dict
    training_data_ref: str  # lakehouse path
    artifact_path: str
    fluvio_topic: Optional[str] = None
    created_at: datetime
    deployed_at: Optional[datetime] = None
    last_prediction_at: Optional[datetime] = None


class DriftReport(BaseModel):
    model_id: str
    drift_type: DriftType
    severity: DriftSeverity
    score: float  # 0.0 = no drift, 1.0 = complete drift
    features_affected: list[str]
    baseline_period: str
    current_period: str
    recommendation: str
    detected_at: datetime


class ModelExplainability(BaseModel):
    model_id: str
    prediction_id: str
    method: str  # shap, lime, permutation_importance
    feature_importances: dict[str, float]
    decision_path: list[str]
    confidence: float
    generated_at: datetime


class GovernancePolicy(BaseModel):
    id: str
    name: str
    description: str
    rules: list[dict]
    enforcement: str  # advisory, blocking
    applicable_models: list[str]
    active: bool = True


class ModelPerformanceMetrics(BaseModel):
    model_id: str
    period: str
    total_predictions: int
    avg_latency_ms: float
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_roc: Optional[float] = None
    false_positive_rate: Optional[float] = None
    data_drift_score: float = 0.0
