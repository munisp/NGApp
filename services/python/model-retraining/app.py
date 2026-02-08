"""
Model Retraining Pipeline Service.
Automated model retraining via Ray + Temporal with performance degradation tracking.
"""
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

app = FastAPI(title="Model Retraining Pipeline", version="1.0.0")

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
RAY_SERVICE_URL = os.getenv("RAY_SERVICE_URL", "http://ray-cluster-service:8100")
TEMPORAL_ADDRESS = os.getenv("TEMPORAL_ADDRESS", "temporal:7233")
MLFLOW_URL = os.getenv("MLFLOW_URL", "http://mlflow-registry-service:8105")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://feature-store-service:8104")


class ModelStatus(str, Enum):
    TRAINING = "training"
    VALIDATING = "validating"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class RetrainingTrigger(str, Enum):
    SCHEDULED = "scheduled"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    NEW_ATTACK_PATTERN = "new_attack_pattern"
    MANUAL = "manual"
    DATA_DRIFT = "data_drift"


@dataclass
class ModelVersion:
    version_id: str
    model_type: str
    status: ModelStatus
    metrics: dict
    created_at: float
    deployed_at: Optional[float]
    training_duration_sec: float
    training_samples: int
    trigger: RetrainingTrigger


# In-memory storage
model_versions: dict = {}
training_jobs: dict = {}
performance_metrics: list = []
alerts: list = []


# Initialize with current production model
model_versions["v2.1.0"] = {
    "version_id": "v2.1.0",
    "model_type": "multi-branch-dnn",
    "status": ModelStatus.DEPLOYED.value,
    "metrics": {
        "precision": 0.94,
        "recall": 0.89,
        "f1_score": 0.91,
        "false_positive_rate": 0.001,
        "auc_roc": 0.96,
    },
    "created_at": time.time() - 86400 * 30,
    "deployed_at": time.time() - 86400 * 30,
    "training_duration_sec": 7200,
    "training_samples": 10_000_000_000,
    "trigger": RetrainingTrigger.SCHEDULED.value,
}


class RetrainingRequest(BaseModel):
    trigger: RetrainingTrigger
    reason: Optional[str] = None
    config_overrides: Optional[dict] = None


class PerformanceMetricRequest(BaseModel):
    timestamp: float
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    sample_size: int


class AlertThresholds(BaseModel):
    precision_min: float = 0.90
    recall_min: float = 0.85
    f1_min: float = 0.87
    fpr_max: float = 0.005


# Default thresholds
thresholds = AlertThresholds()


def check_performance_degradation(metrics: dict) -> tuple[bool, list]:
    """Check if model performance has degraded below thresholds."""
    issues = []
    
    if metrics.get("precision", 1.0) < thresholds.precision_min:
        issues.append(f"Precision {metrics['precision']:.3f} below threshold {thresholds.precision_min}")
    if metrics.get("recall", 1.0) < thresholds.recall_min:
        issues.append(f"Recall {metrics['recall']:.3f} below threshold {thresholds.recall_min}")
    if metrics.get("f1_score", 1.0) < thresholds.f1_min:
        issues.append(f"F1 score {metrics['f1_score']:.3f} below threshold {thresholds.f1_min}")
    if metrics.get("false_positive_rate", 0.0) > thresholds.fpr_max:
        issues.append(f"FPR {metrics['false_positive_rate']:.4f} above threshold {thresholds.fpr_max}")
    
    return len(issues) > 0, issues


async def run_training_job(job_id: str, config: dict):
    """Simulate model training job (would use Ray in production)."""
    job = training_jobs[job_id]
    job["status"] = "training"
    job["started_at"] = time.time()
    
    # Simulate training time
    training_time = np.random.uniform(60, 180)  # 1-3 minutes for demo
    
    # In production: submit to Ray cluster
    print(f"[Ray] Submitting training job {job_id} to cluster")
    
    # Simulate training completion
    job["status"] = "validating"
    
    # Generate simulated metrics (slightly better than current)
    current_metrics = model_versions.get("v2.1.0", {}).get("metrics", {})
    new_metrics = {
        "precision": min(0.99, current_metrics.get("precision", 0.94) + np.random.uniform(0, 0.02)),
        "recall": min(0.99, current_metrics.get("recall", 0.89) + np.random.uniform(0, 0.03)),
        "f1_score": min(0.99, current_metrics.get("f1_score", 0.91) + np.random.uniform(0, 0.02)),
        "false_positive_rate": max(0.0001, current_metrics.get("false_positive_rate", 0.001) - np.random.uniform(0, 0.0003)),
        "auc_roc": min(0.99, current_metrics.get("auc_roc", 0.96) + np.random.uniform(0, 0.01)),
    }
    
    # Create new model version
    version_id = f"v2.{len(model_versions)}.0"
    model_versions[version_id] = {
        "version_id": version_id,
        "model_type": "multi-branch-dnn",
        "status": ModelStatus.VALIDATING.value,
        "metrics": new_metrics,
        "created_at": time.time(),
        "deployed_at": None,
        "training_duration_sec": training_time,
        "training_samples": config.get("training_samples", 1_000_000),
        "trigger": config.get("trigger", RetrainingTrigger.MANUAL.value),
    }
    
    job["status"] = "completed"
    job["completed_at"] = time.time()
    job["model_version"] = version_id
    job["metrics"] = new_metrics
    
    # Log to MLflow (simulated)
    print(f"[MLflow] Registered model version {version_id} with metrics: {new_metrics}")
    
    return version_id


@app.get("/health")
async def health():
    deployed_version = next((v for v in model_versions.values() if v["status"] == ModelStatus.DEPLOYED.value), None)
    
    return {
        "status": "healthy",
        "service": "model-retraining",
        "version": "1.0.0",
        "deployed_model": deployed_version["version_id"] if deployed_version else None,
        "total_versions": len(model_versions),
        "active_training_jobs": len([j for j in training_jobs.values() if j["status"] in ["pending", "training", "validating"]]),
        "performance_alerts": len([a for a in alerts if a["status"] == "active"]),
        "middleware": {
            "ray": RAY_SERVICE_URL,
            "temporal": TEMPORAL_ADDRESS,
            "mlflow": MLFLOW_URL,
        }
    }


@app.post("/retrain")
async def trigger_retraining(request: RetrainingRequest, background_tasks: BackgroundTasks):
    """Trigger model retraining."""
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    
    config = {
        "trigger": request.trigger.value,
        "reason": request.reason,
        "training_samples": 1_000_000,
        "epochs": 100,
        "learning_rate": 0.001,
        "batch_size": 4096,
    }
    if request.config_overrides:
        config.update(request.config_overrides)
    
    training_jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "config": config,
        "created_at": time.time(),
        "started_at": None,
        "completed_at": None,
        "model_version": None,
        "metrics": None,
    }
    
    # Start training in background
    background_tasks.add_task(run_training_job, job_id, config)
    
    # Publish to Kafka (simulated)
    print(f"[Kafka] Publishing retraining job: {job_id}, trigger={request.trigger.value}")
    
    return {
        "job_id": job_id,
        "status": "pending",
        "message": f"Retraining job submitted. Trigger: {request.trigger.value}",
    }


@app.get("/jobs")
async def list_training_jobs(status: Optional[str] = None, limit: int = 50):
    """List training jobs."""
    results = list(training_jobs.values())
    
    if status:
        results = [j for j in results if j["status"] == status]
    
    results.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "jobs": results[:limit],
        "total": len(results),
    }


@app.get("/jobs/{job_id}")
async def get_training_job(job_id: str):
    """Get training job details."""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return training_jobs[job_id]


@app.get("/models")
async def list_models(status: Optional[str] = None):
    """List model versions."""
    results = list(model_versions.values())
    
    if status:
        results = [m for m in results if m["status"] == status]
    
    results.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "models": results,
        "total": len(results),
        "deployed": next((m["version_id"] for m in results if m["status"] == ModelStatus.DEPLOYED.value), None),
    }


@app.get("/models/{version_id}")
async def get_model(version_id: str):
    """Get model version details."""
    if version_id not in model_versions:
        raise HTTPException(status_code=404, detail="Model version not found")
    return model_versions[version_id]


@app.post("/models/{version_id}/deploy")
async def deploy_model(version_id: str):
    """Deploy a model version to production."""
    if version_id not in model_versions:
        raise HTTPException(status_code=404, detail="Model version not found")
    
    model = model_versions[version_id]
    
    if model["status"] not in [ModelStatus.VALIDATING.value, ModelStatus.ROLLED_BACK.value]:
        raise HTTPException(status_code=400, detail=f"Cannot deploy model in status: {model['status']}")
    
    # Undeploy current production model
    for v in model_versions.values():
        if v["status"] == ModelStatus.DEPLOYED.value:
            v["status"] = ModelStatus.ROLLED_BACK.value
    
    # Deploy new model
    model["status"] = ModelStatus.DEPLOYED.value
    model["deployed_at"] = time.time()
    
    # Publish to Kafka (simulated)
    print(f"[Kafka] Model deployed: {version_id}")
    
    return {
        "version_id": version_id,
        "status": "deployed",
        "deployed_at": model["deployed_at"],
        "metrics": model["metrics"],
    }


@app.post("/models/{version_id}/rollback")
async def rollback_model(version_id: str):
    """Rollback to a previous model version."""
    if version_id not in model_versions:
        raise HTTPException(status_code=404, detail="Model version not found")
    
    # Undeploy current
    for v in model_versions.values():
        if v["status"] == ModelStatus.DEPLOYED.value:
            v["status"] = ModelStatus.ROLLED_BACK.value
    
    # Deploy specified version
    model_versions[version_id]["status"] = ModelStatus.DEPLOYED.value
    model_versions[version_id]["deployed_at"] = time.time()
    
    return {
        "version_id": version_id,
        "status": "deployed",
        "message": f"Rolled back to {version_id}",
    }


@app.post("/metrics")
async def report_performance_metrics(request: PerformanceMetricRequest, background_tasks: BackgroundTasks):
    """Report model performance metrics for monitoring."""
    metrics = request.dict()
    performance_metrics.append(metrics)
    
    # Check for degradation
    degraded, issues = check_performance_degradation(metrics)
    
    if degraded:
        alert = {
            "alert_id": f"alert_{uuid.uuid4().hex[:8]}",
            "type": "performance_degradation",
            "issues": issues,
            "metrics": metrics,
            "created_at": time.time(),
            "status": "active",
        }
        alerts.append(alert)
        
        # Auto-trigger retraining
        background_tasks.add_task(
            trigger_retraining,
            RetrainingRequest(
                trigger=RetrainingTrigger.PERFORMANCE_DEGRADATION,
                reason="; ".join(issues),
            ),
            background_tasks,
        )
        
        return {
            "status": "alert",
            "message": "Performance degradation detected. Retraining triggered.",
            "issues": issues,
        }
    
    return {"status": "ok", "message": "Metrics recorded"}


@app.get("/metrics")
async def get_performance_metrics(limit: int = 100):
    """Get recent performance metrics."""
    return {
        "metrics": performance_metrics[-limit:],
        "total": len(performance_metrics),
    }


@app.get("/alerts")
async def list_alerts(status: str = "active"):
    """List performance alerts."""
    results = [a for a in alerts if a["status"] == status]
    return {
        "alerts": results,
        "total": len(results),
    }


@app.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert."""
    alert = next((a for a in alerts if a["alert_id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert["status"] = "resolved"
    alert["resolved_at"] = time.time()
    
    return alert


@app.get("/thresholds")
async def get_thresholds():
    """Get current alert thresholds."""
    return thresholds.dict()


@app.put("/thresholds")
async def update_thresholds(new_thresholds: AlertThresholds):
    """Update alert thresholds."""
    global thresholds
    thresholds = new_thresholds
    return thresholds.dict()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MODEL_RETRAINING_PORT", "8143"))
    uvicorn.run(app, host="0.0.0.0", port=port)
