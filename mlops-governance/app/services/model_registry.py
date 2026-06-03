"""Model Registry - tracks all ML models across the platform.

Manages model lifecycle: development → staging → production → deprecated.
Stores metadata, metrics, lineage, and approval workflows.
"""

from datetime import datetime, timezone
from typing import Optional

import structlog

from app.models.schemas import (
    ModelStatus,
    ModelType,
    RegisteredModel,
    ModelPerformanceMetrics,
)

logger = structlog.get_logger()

# Platform ML models registry
PLATFORM_MODELS = [
    {
        "id": "fraud-detection-v3",
        "name": "Insurance Fraud Detection",
        "version": "3.2.1",
        "model_type": ModelType.CLASSIFICATION,
        "status": ModelStatus.PRODUCTION,
        "description": "Detects fraudulent insurance claims using ensemble of XGBoost + Neural Network",
        "owner": "data-science-team",
        "framework": "xgboost",
        "metrics": {"accuracy": 0.94, "f1": 0.89, "auc_roc": 0.97, "false_positive_rate": 0.03},
        "input_schema": {"features": ["claim_amount", "policy_age_days", "time_to_claim", "claimant_history", "geo_risk"]},
        "output_schema": {"fraud_probability": "float", "risk_category": "str", "explanation": "list"},
        "training_data_ref": "lakehouse://ag-insurance/fraud/training_v3",
        "artifact_path": "s3://ag-models/fraud-detection/v3.2.1/",
        "fluvio_topic": "ml.fraud.predictions",
    },
    {
        "id": "churn-prediction-v2",
        "name": "Customer Churn Prediction",
        "version": "2.1.0",
        "model_type": ModelType.CLASSIFICATION,
        "status": ModelStatus.PRODUCTION,
        "description": "Predicts customer churn probability for proactive retention",
        "owner": "data-science-team",
        "framework": "sklearn",
        "metrics": {"accuracy": 0.87, "f1": 0.82, "auc_roc": 0.91},
        "input_schema": {"features": ["tenure_months", "premium_amount", "claims_count", "interactions", "payment_delays"]},
        "output_schema": {"churn_probability": "float", "risk_factors": "list"},
        "training_data_ref": "lakehouse://ag-insurance/churn/training_v2",
        "artifact_path": "s3://ag-models/churn-prediction/v2.1.0/",
        "fluvio_topic": "ml.churn.predictions",
    },
    {
        "id": "pricing-optimization-v1",
        "name": "Dynamic Premium Pricing",
        "version": "1.4.0",
        "model_type": ModelType.REGRESSION,
        "status": ModelStatus.PRODUCTION,
        "description": "Optimizes premium pricing based on risk factors and market conditions",
        "owner": "actuarial-team",
        "framework": "pytorch",
        "metrics": {"mae": 1250.0, "rmse": 2100.0, "r2": 0.89},
        "input_schema": {"features": ["age", "vehicle_value", "driving_history", "location", "coverage_type"]},
        "output_schema": {"suggested_premium": "float", "confidence_interval": "tuple"},
        "training_data_ref": "lakehouse://ag-insurance/pricing/training_v1",
        "artifact_path": "s3://ag-models/pricing-optimization/v1.4.0/",
        "fluvio_topic": "ml.pricing.predictions",
    },
    {
        "id": "claims-triage-v2",
        "name": "Claims Auto-Triage",
        "version": "2.0.3",
        "model_type": ModelType.CLASSIFICATION,
        "status": ModelStatus.PRODUCTION,
        "description": "Routes claims to appropriate handler (auto-approve, manual review, SIU)",
        "owner": "claims-team",
        "framework": "xgboost",
        "metrics": {"accuracy": 0.91, "f1": 0.88},
        "input_schema": {"features": ["claim_type", "amount", "documentation_quality", "history_score"]},
        "output_schema": {"route": "str", "confidence": "float", "sla_hours": "int"},
        "training_data_ref": "lakehouse://ag-insurance/claims/triage_v2",
        "artifact_path": "s3://ag-models/claims-triage/v2.0.3/",
        "fluvio_topic": "ml.claims.triage",
    },
    {
        "id": "document-ocr-v1",
        "name": "Insurance Document OCR",
        "version": "1.2.0",
        "model_type": ModelType.COMPUTER_VISION,
        "status": ModelStatus.STAGING,
        "description": "Extracts structured data from insurance documents (policies, claims forms, IDs)",
        "owner": "ai-platform-team",
        "framework": "pytorch",
        "metrics": {"accuracy": 0.93, "field_extraction_rate": 0.88},
        "input_schema": {"input": "image_bytes"},
        "output_schema": {"fields": "dict", "confidence_scores": "dict"},
        "training_data_ref": "lakehouse://ag-insurance/documents/ocr_training",
        "artifact_path": "s3://ag-models/document-ocr/v1.2.0/",
        "fluvio_topic": None,
    },
]


class ModelRegistry:
    """Central registry for all ML models on the platform."""

    def __init__(self, db_pool=None):
        self.db_pool = db_pool

    def list_models(self, status: Optional[ModelStatus] = None) -> list[dict]:
        """List all registered models, optionally filtered by status."""
        models = PLATFORM_MODELS
        if status:
            models = [m for m in models if m["status"] == status]
        return models

    def get_model(self, model_id: str) -> Optional[dict]:
        """Get a specific model by ID."""
        for model in PLATFORM_MODELS:
            if model["id"] == model_id:
                return model
        return None

    def promote_model(self, model_id: str, target_status: ModelStatus) -> dict:
        """Promote a model through the lifecycle (dev → staging → production)."""
        model = self.get_model(model_id)
        if model:
            logger.info(
                "model_promoted",
                model_id=model_id,
                from_status=model["status"].value,
                to_status=target_status.value,
            )
        return {"model_id": model_id, "new_status": target_status.value}

    def get_performance_summary(self) -> dict:
        """Get aggregated performance metrics for all production models."""
        prod_models = [m for m in PLATFORM_MODELS if m["status"] == ModelStatus.PRODUCTION]
        return {
            "total_models": len(PLATFORM_MODELS),
            "production_models": len(prod_models),
            "staging_models": len([m for m in PLATFORM_MODELS if m["status"] == ModelStatus.STAGING]),
            "avg_accuracy": sum(
                m["metrics"].get("accuracy", 0) for m in prod_models
            ) / max(len(prod_models), 1),
            "frameworks": list(set(m["framework"] for m in PLATFORM_MODELS)),
            "fluvio_connected": len([m for m in PLATFORM_MODELS if m.get("fluvio_topic")]),
        }
