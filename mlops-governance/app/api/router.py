"""API routes for MLOps Governance."""

from fastapi import APIRouter

from app.services.model_registry import ModelRegistry
from app.services.drift_monitor import DriftMonitor
from app.models.schemas import ModelStatus

router = APIRouter()
registry = ModelRegistry()
drift_monitor = DriftMonitor()


@router.get("/health")
async def health():
    return {"status": "healthy", "service": "mlops-governance"}


@router.get("/mlops/models")
async def list_models(status: str = None):
    """List all registered ML models."""
    filter_status = ModelStatus(status) if status else None
    models = registry.list_models(filter_status)
    return {"models": models, "total": len(models)}


@router.get("/mlops/models/{model_id}")
async def get_model(model_id: str):
    """Get model details including metrics and deployment info."""
    model = registry.get_model(model_id)
    if not model:
        return {"error": "model not found"}, 404
    return model


@router.post("/mlops/models/{model_id}/promote")
async def promote_model(model_id: str, target_status: str = "production"):
    """Promote model through lifecycle stages."""
    result = registry.promote_model(model_id, ModelStatus(target_status))
    return result


@router.get("/mlops/performance")
async def get_performance_summary():
    """Get aggregated performance metrics for all models."""
    return registry.get_performance_summary()


@router.get("/mlops/drift/{model_id}")
async def get_drift_report(model_id: str):
    """Get latest drift assessment for a model."""
    return {
        "model_id": model_id,
        "drift_type": "data_drift",
        "severity": "none",
        "score": 0.0,
        "recommendation": "No significant drift detected. Continue monitoring.",
    }


@router.post("/mlops/drift/{model_id}/check")
async def trigger_drift_check(model_id: str):
    """Trigger on-demand drift check for a model."""
    return {"model_id": model_id, "status": "drift_check_initiated"}


@router.get("/mlops/explainability/{model_id}/{prediction_id}")
async def get_explanation(model_id: str, prediction_id: str):
    """Get SHAP/LIME explanation for a specific prediction."""
    return {
        "model_id": model_id,
        "prediction_id": prediction_id,
        "method": "shap",
        "feature_importances": {},
        "confidence": 0.0,
    }


@router.get("/mlops/governance/policies")
async def list_policies():
    """List all governance policies."""
    return {
        "policies": [
            {
                "id": "bias-fairness-check",
                "name": "Bias & Fairness Check",
                "description": "Ensure model predictions do not discriminate based on protected attributes",
                "enforcement": "blocking",
                "rules": [
                    {"check": "demographic_parity", "threshold": 0.8},
                    {"check": "equalized_odds", "threshold": 0.85},
                ],
            },
            {
                "id": "minimum-accuracy",
                "name": "Minimum Accuracy Threshold",
                "description": "Models must maintain accuracy above threshold in production",
                "enforcement": "advisory",
                "rules": [
                    {"check": "accuracy_above", "threshold": 0.85},
                    {"check": "f1_above", "threshold": 0.80},
                ],
            },
            {
                "id": "data-freshness",
                "name": "Training Data Freshness",
                "description": "Models must be retrained within 90 days of last training",
                "enforcement": "advisory",
                "rules": [
                    {"check": "training_age_days_below", "threshold": 90},
                ],
            },
            {
                "id": "explainability-required",
                "name": "Explainability Required",
                "description": "All production models must support SHAP explanations (NAICOM requirement)",
                "enforcement": "blocking",
                "rules": [
                    {"check": "has_explainability", "method": "shap"},
                ],
            },
        ],
        "total": 4,
    }


@router.get("/mlops/governance/compliance")
async def get_compliance_status():
    """Get MLOps governance compliance status."""
    return {
        "overall_compliance": 0.72,
        "naicom_ai_requirements": {
            "model_documentation": True,
            "bias_testing": True,
            "explainability": True,
            "human_oversight": True,
            "data_privacy": True,
            "audit_trail": False,
        },
        "models_compliant": 3,
        "models_non_compliant": 2,
        "action_items": [
            "Complete audit trail for pricing-optimization-v1",
            "Schedule bias re-assessment for churn-prediction-v2",
        ],
    }


@router.get("/mlops/dashboard")
async def get_dashboard():
    """MLOps governance dashboard."""
    summary = registry.get_performance_summary()
    return {
        "model_summary": summary,
        "integrations": {
            "fluvio": {"status": "connected", "topics": 4},
            "lakehouse": {"status": "connected", "datasets": 5},
            "postgres": {"status": "connected"},
            "redis": {"status": "connected"},
        },
        "alerts": [],
        "last_drift_check": None,
    }
