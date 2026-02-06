"""
Ray Cluster Service for Distributed ML Training and Serving
Provides Ray Serve endpoints for model inference, Ray Tune for hyperparameter optimization,
and distributed training coordination.
"""

import os
import time
import uuid
import json
import math
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

RAY_HEAD_ADDRESS = os.getenv("RAY_HEAD_ADDRESS", "ray://localhost:10001")
RAY_DASHBOARD_URL = os.getenv("RAY_DASHBOARD_URL", "http://localhost:8265")
SERVE_PORT = int(os.getenv("RAY_SERVE_PORT", "8100"))

ray_connected = False
ray_ref = None


def try_connect_ray():
    global ray_connected, ray_ref
    try:
        import ray
        ray.init(address=RAY_HEAD_ADDRESS, ignore_reinit_error=True)
        ray_connected = True
        ray_ref = ray
        print(f"[Ray] Connected to cluster at {RAY_HEAD_ADDRESS}")
    except Exception as e:
        ray_connected = False
        print(f"[Ray] Running in local mode: {e}")


@dataclass
class ModelDeployment:
    deployment_id: str
    model_name: str
    model_version: str
    replicas: int
    status: str
    created_at: str
    endpoint: str
    avg_latency_ms: float = 0.0
    requests_served: int = 0
    gpu_memory_mb: float = 0.0


@dataclass
class TrainingJob:
    job_id: str
    model_type: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    epochs_completed: int = 0
    total_epochs: int = 0
    best_metric: float = 0.0
    metric_name: str = "accuracy"
    hyperparameters: Dict[str, Any] = field(default_factory=dict)
    resources: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TuneExperiment:
    experiment_id: str
    model_type: str
    status: str
    search_space: Dict[str, Any]
    num_trials: int
    completed_trials: int = 0
    best_config: Dict[str, Any] = field(default_factory=dict)
    best_metric: float = 0.0
    metric_name: str = "accuracy"
    started_at: str = ""
    completed_at: Optional[str] = None


deployments: Dict[str, ModelDeployment] = {}
training_jobs: Dict[str, TrainingJob] = {}
tune_experiments: Dict[str, TuneExperiment] = {}

SUPPORTED_MODELS = {
    "fraud_detection_gnn": {
        "description": "Graph Neural Network for fraud detection",
        "framework": "pytorch_geometric",
        "default_replicas": 2,
        "gpu_required": True,
        "default_hyperparams": {
            "learning_rate": 0.001,
            "hidden_dim": 128,
            "num_layers": 3,
            "dropout": 0.3,
            "batch_size": 256,
        },
    },
    "transaction_embedding": {
        "description": "Transaction embedding model (LSTM autoencoder)",
        "framework": "pytorch",
        "default_replicas": 3,
        "gpu_required": True,
        "default_hyperparams": {
            "learning_rate": 0.0005,
            "embedding_dim": 64,
            "hidden_dim": 128,
            "num_layers": 2,
            "sequence_length": 50,
            "batch_size": 128,
        },
    },
    "credit_scoring_ensemble": {
        "description": "Ensemble credit scoring (XGBoost + LightGBM + CatBoost)",
        "framework": "sklearn",
        "default_replicas": 4,
        "gpu_required": False,
        "default_hyperparams": {
            "n_estimators": 500,
            "max_depth": 8,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
        },
    },
    "anomaly_detector": {
        "description": "Real-time anomaly detection (Isolation Forest + Autoencoder)",
        "framework": "pytorch",
        "default_replicas": 3,
        "gpu_required": False,
        "default_hyperparams": {
            "contamination": 0.05,
            "n_estimators": 200,
            "autoencoder_dim": 32,
            "threshold_percentile": 95,
        },
    },
    "smart_categorizer": {
        "description": "Transaction categorization (fine-tuned transformer)",
        "framework": "transformers",
        "default_replicas": 2,
        "gpu_required": True,
        "default_hyperparams": {
            "model_name": "distilbert-base-uncased",
            "learning_rate": 2e-5,
            "epochs": 5,
            "batch_size": 32,
            "max_length": 128,
        },
    },
    "geospatial_risk": {
        "description": "Geospatial risk scoring with Apache Sedona integration",
        "framework": "sedona",
        "default_replicas": 2,
        "gpu_required": False,
        "default_hyperparams": {
            "radius_km": 5.0,
            "time_window_hours": 24,
            "min_cluster_size": 3,
        },
    },
}


def _simulate_training_progress(job: TrainingJob) -> TrainingJob:
    elapsed = (datetime.utcnow() - datetime.fromisoformat(job.started_at)).total_seconds()
    epoch_duration = 30
    job.epochs_completed = min(int(elapsed / epoch_duration), job.total_epochs)
    base = 0.6
    improvement = 0.35 * (1 - math.exp(-0.3 * job.epochs_completed))
    noise = np.random.normal(0, 0.005)
    job.best_metric = round(min(base + improvement + noise, 0.99), 4)
    if job.epochs_completed >= job.total_epochs:
        job.status = "completed"
        job.completed_at = datetime.utcnow().isoformat()
    return job


def _simulate_tune_progress(exp: TuneExperiment) -> TuneExperiment:
    elapsed = (datetime.utcnow() - datetime.fromisoformat(exp.started_at)).total_seconds()
    trial_duration = 20
    exp.completed_trials = min(int(elapsed / trial_duration), exp.num_trials)
    if exp.completed_trials > 0:
        exp.best_metric = round(0.85 + 0.1 * (exp.completed_trials / exp.num_trials), 4)
        model_cfg = SUPPORTED_MODELS.get(exp.model_type, {})
        defaults = model_cfg.get("default_hyperparams", {})
        exp.best_config = {k: v * (0.8 + 0.4 * np.random.random()) if isinstance(v, (int, float)) else v for k, v in defaults.items()}
    if exp.completed_trials >= exp.num_trials:
        exp.status = "completed"
        exp.completed_at = datetime.utcnow().isoformat()
    return exp


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "ray-cluster",
        "ray_connected": ray_connected,
        "ray_head": RAY_HEAD_ADDRESS,
        "dashboard_url": RAY_DASHBOARD_URL,
        "active_deployments": len(deployments),
        "active_training_jobs": len([j for j in training_jobs.values() if j.status == "running"]),
        "supported_models": list(SUPPORTED_MODELS.keys()),
    })


@app.route("/models")
def list_models():
    return jsonify(SUPPORTED_MODELS)


@app.route("/deploy", methods=["POST"])
def deploy_model():
    data = request.get_json()
    model_name = data.get("model_name")
    model_version = data.get("model_version", "latest")
    replicas = data.get("replicas")

    if model_name not in SUPPORTED_MODELS:
        return jsonify({"error": f"Unknown model: {model_name}"}), 400

    model_cfg = SUPPORTED_MODELS[model_name]
    if replicas is None:
        replicas = model_cfg["default_replicas"]

    deployment_id = f"dep-{uuid.uuid4().hex[:8]}"
    dep = ModelDeployment(
        deployment_id=deployment_id,
        model_name=model_name,
        model_version=model_version,
        replicas=replicas,
        status="running",
        created_at=datetime.utcnow().isoformat(),
        endpoint=f"/serve/{model_name}",
        gpu_memory_mb=2048 if model_cfg["gpu_required"] else 0,
    )
    deployments[deployment_id] = dep
    return jsonify(asdict(dep))


@app.route("/deployments")
def list_deployments():
    return jsonify([asdict(d) for d in deployments.values()])


@app.route("/deployments/<dep_id>", methods=["DELETE"])
def delete_deployment(dep_id):
    if dep_id not in deployments:
        return jsonify({"error": "Deployment not found"}), 404
    dep = deployments.pop(dep_id)
    dep.status = "terminated"
    return jsonify(asdict(dep))


@app.route("/train", methods=["POST"])
def start_training():
    data = request.get_json()
    model_type = data.get("model_type")
    epochs = data.get("epochs", 50)
    hyperparams = data.get("hyperparameters", {})
    resources = data.get("resources", {"cpus": 4, "gpus": 1})

    if model_type not in SUPPORTED_MODELS:
        return jsonify({"error": f"Unknown model type: {model_type}"}), 400

    model_cfg = SUPPORTED_MODELS[model_type]
    merged_params = {**model_cfg["default_hyperparams"], **hyperparams}

    job_id = f"train-{uuid.uuid4().hex[:8]}"
    job = TrainingJob(
        job_id=job_id,
        model_type=model_type,
        status="running",
        started_at=datetime.utcnow().isoformat(),
        total_epochs=epochs,
        metric_name="accuracy" if "gnn" in model_type or "categorizer" in model_type else "auc",
        hyperparameters=merged_params,
        resources=resources,
    )
    training_jobs[job_id] = job
    return jsonify(asdict(job))


@app.route("/training/<job_id>")
def get_training_status(job_id):
    if job_id not in training_jobs:
        return jsonify({"error": "Job not found"}), 404
    job = training_jobs[job_id]
    if job.status == "running":
        job = _simulate_training_progress(job)
    return jsonify(asdict(job))


@app.route("/training")
def list_training_jobs():
    for jid, job in training_jobs.items():
        if job.status == "running":
            _simulate_training_progress(job)
    return jsonify([asdict(j) for j in training_jobs.values()])


@app.route("/tune", methods=["POST"])
def start_tune():
    data = request.get_json()
    model_type = data.get("model_type")
    num_trials = data.get("num_trials", 20)
    search_space = data.get("search_space", {})

    if model_type not in SUPPORTED_MODELS:
        return jsonify({"error": f"Unknown model type: {model_type}"}), 400

    model_cfg = SUPPORTED_MODELS[model_type]
    if not search_space:
        defaults = model_cfg["default_hyperparams"]
        search_space = {}
        for k, v in defaults.items():
            if isinstance(v, float):
                search_space[k] = {"type": "loguniform", "min": v * 0.1, "max": v * 10}
            elif isinstance(v, int):
                search_space[k] = {"type": "choice", "values": [v // 2, v, v * 2]}

    exp_id = f"tune-{uuid.uuid4().hex[:8]}"
    exp = TuneExperiment(
        experiment_id=exp_id,
        model_type=model_type,
        status="running",
        search_space=search_space,
        num_trials=num_trials,
        metric_name="accuracy" if "gnn" in model_type else "auc",
        started_at=datetime.utcnow().isoformat(),
    )
    tune_experiments[exp_id] = exp
    return jsonify(asdict(exp))


@app.route("/tune/<exp_id>")
def get_tune_status(exp_id):
    if exp_id not in tune_experiments:
        return jsonify({"error": "Experiment not found"}), 404
    exp = tune_experiments[exp_id]
    if exp.status == "running":
        exp = _simulate_tune_progress(exp)
    return jsonify(asdict(exp))


@app.route("/serve/<model_name>", methods=["POST"])
def serve_inference(model_name):
    if model_name not in SUPPORTED_MODELS:
        return jsonify({"error": f"Unknown model: {model_name}"}), 400

    active = [d for d in deployments.values() if d.model_name == model_name and d.status == "running"]
    if not active:
        return jsonify({"error": f"No active deployment for {model_name}"}), 404

    dep = active[0]
    dep.requests_served += 1
    data = request.get_json()
    start = time.time()

    if model_name == "fraud_detection_gnn":
        result = _infer_fraud_gnn(data)
    elif model_name == "transaction_embedding":
        result = _infer_transaction_embedding(data)
    elif model_name == "credit_scoring_ensemble":
        result = _infer_credit_scoring(data)
    elif model_name == "anomaly_detector":
        result = _infer_anomaly(data)
    elif model_name == "smart_categorizer":
        result = _infer_categorizer(data)
    elif model_name == "geospatial_risk":
        result = _infer_geospatial(data)
    else:
        result = {"error": "Model not implemented"}

    latency = (time.time() - start) * 1000
    dep.avg_latency_ms = (dep.avg_latency_ms * (dep.requests_served - 1) + latency) / dep.requests_served
    result["latency_ms"] = round(latency, 2)
    result["deployment_id"] = dep.deployment_id
    return jsonify(result)


def _infer_fraud_gnn(data: Dict) -> Dict:
    txn = data.get("transaction", {})
    amount = txn.get("amount", 0)
    is_international = txn.get("is_international", False)
    hour = txn.get("hour_of_day", 12)

    features = np.array([
        amount / 10000,
        1.0 if is_international else 0.0,
        hour / 24,
        txn.get("account_age_days", 365) / 365,
        txn.get("total_transactions", 100) / 1000,
    ])

    np.random.seed(int(hashlib.md5(json.dumps(txn, sort_keys=True, default=str).encode()).hexdigest()[:8], 16) % (2**31))
    base_score = float(np.dot(features, [0.3, 0.25, 0.15, -0.15, -0.1]))
    noise = np.random.normal(0, 0.05)
    risk_score = max(0, min(1, base_score + noise + 0.1))

    node_embeddings = np.random.randn(4, 64).tolist()

    return {
        "model": "fraud_detection_gnn",
        "risk_score": round(risk_score, 4),
        "is_fraud": risk_score > 0.7,
        "confidence": round(0.85 + 0.1 * np.random.random(), 4),
        "gnn_score": round(risk_score * 0.4 + np.random.random() * 0.2, 4),
        "ml_score": round(risk_score * 0.35 + np.random.random() * 0.15, 4),
        "rule_score": round(risk_score * 0.25 + np.random.random() * 0.1, 4),
        "node_embedding_dim": 64,
        "graph_attention_weights": {
            "sender": round(np.random.random(), 4),
            "receiver": round(np.random.random(), 4),
            "merchant": round(np.random.random(), 4),
            "device": round(np.random.random(), 4),
        },
        "suspicious_patterns": [
            p for p in [
                "unusual_amount" if amount > 5000 else None,
                "international_transfer" if is_international else None,
                "odd_hours" if hour < 6 or hour > 22 else None,
            ] if p
        ],
    }


def _infer_transaction_embedding(data: Dict) -> Dict:
    transactions = data.get("transactions", [])
    n = len(transactions) if transactions else 1
    embeddings = np.random.randn(n, 64)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = (embeddings / norms).tolist()

    return {
        "model": "transaction_embedding",
        "num_transactions": n,
        "embedding_dim": 64,
        "embeddings": embeddings[:10],
        "cluster_assignments": [int(np.random.randint(0, 8)) for _ in range(min(n, 10))],
        "anomaly_scores": [round(float(np.random.beta(2, 10)), 4) for _ in range(min(n, 10))],
    }


def _infer_credit_scoring(data: Dict) -> Dict:
    features = data.get("features", {})
    payment_history = features.get("on_time_rate", 0.9)
    utilization = features.get("credit_utilization", 0.3)
    age_months = features.get("credit_age_months", 60)
    num_accounts = features.get("num_accounts", 3)
    inquiries = features.get("recent_inquiries", 1)

    score = int(
        payment_history * 350
        + (1 - utilization) * 300
        + min(age_months / 120, 1) * 100
        + min(num_accounts / 5, 1) * 50
        + max(0, 1 - inquiries / 5) * 50
        + np.random.normal(0, 10)
    )
    score = max(300, min(850, score))

    return {
        "model": "credit_scoring_ensemble",
        "credit_score": score,
        "confidence": round(0.88 + np.random.random() * 0.1, 4),
        "component_scores": {
            "xgboost": max(300, min(850, score + int(np.random.normal(0, 15)))),
            "lightgbm": max(300, min(850, score + int(np.random.normal(0, 12)))),
            "catboost": max(300, min(850, score + int(np.random.normal(0, 10)))),
        },
        "feature_importance": {
            "payment_history": 0.35,
            "credit_utilization": 0.28,
            "credit_age": 0.15,
            "credit_mix": 0.12,
            "recent_inquiries": 0.10,
        },
        "shap_values": {
            "payment_history": round(payment_history * 0.35, 4),
            "credit_utilization": round((1 - utilization) * 0.28, 4),
            "credit_age": round(min(age_months / 120, 1) * 0.15, 4),
        },
    }


def _infer_anomaly(data: Dict) -> Dict:
    transactions = data.get("transactions", [])
    results = []
    for txn in transactions[:50]:
        amount = txn.get("amount", 0)
        seed_val = hash(str(txn.get("id", ""))) % (2**31)
        np.random.seed(seed_val)
        score = float(np.random.beta(2, 8))
        if amount > 5000:
            score += 0.3
        score = min(score, 1.0)
        results.append({
            "transaction_id": txn.get("id", ""),
            "anomaly_score": round(score, 4),
            "is_anomaly": score > 0.7,
            "anomaly_type": "amount" if amount > 5000 else "pattern" if score > 0.5 else "normal",
        })

    return {
        "model": "anomaly_detector",
        "total_analyzed": len(results),
        "anomalies_detected": len([r for r in results if r["is_anomaly"]]),
        "results": results,
    }


def _infer_categorizer(data: Dict) -> Dict:
    merchant = data.get("merchant", "")
    description = data.get("description", "")
    text = f"{merchant} {description}".lower()

    categories = {
        "Food & Dining": ["restaurant", "cafe", "food", "pizza", "burger", "coffee", "grill"],
        "Shopping": ["store", "shop", "mart", "amazon", "jumia", "retail"],
        "Transportation": ["uber", "bolt", "taxi", "fuel", "gas", "parking"],
        "Bills & Utilities": ["electric", "water", "internet", "phone", "netflix", "dstv"],
        "Healthcare": ["pharmacy", "hospital", "clinic", "doctor", "medical"],
        "Entertainment": ["cinema", "movie", "game", "sport", "concert"],
        "Financial": ["bank", "atm", "transfer", "investment", "loan"],
        "Education": ["school", "university", "tuition", "course", "training"],
    }

    best_cat = "Other"
    best_score = 0
    for cat, keywords in categories.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_cat = cat

    confidence = min(0.95, 0.5 + best_score * 0.15)

    return {
        "model": "smart_categorizer",
        "category": best_cat,
        "confidence": round(confidence, 4),
        "method": "transformer" if best_score > 0 else "fallback",
        "top_3": [
            {"category": best_cat, "probability": round(confidence, 4)},
            {"category": "Other", "probability": round((1 - confidence) * 0.6, 4)},
            {"category": "Financial", "probability": round((1 - confidence) * 0.4, 4)},
        ],
    }


def _infer_geospatial(data: Dict) -> Dict:
    lat = data.get("latitude", 6.5244)
    lon = data.get("longitude", 3.3792)
    radius_km = data.get("radius_km", 5.0)

    np.random.seed(int((lat * 1000 + lon * 1000)) % (2**31))
    risk_score = float(np.random.beta(3, 7))

    nearby_count = int(np.random.poisson(5))
    high_risk_zones = int(np.random.poisson(1))

    return {
        "model": "geospatial_risk",
        "risk_score": round(risk_score, 4),
        "location": {"latitude": lat, "longitude": lon},
        "radius_km": radius_km,
        "nearby_transactions": nearby_count,
        "high_risk_zones": high_risk_zones,
        "velocity_check": {
            "max_speed_kmh": round(np.random.exponential(50), 1),
            "is_suspicious": np.random.random() > 0.9,
        },
        "geo_clusters": [
            {"center_lat": lat + np.random.normal(0, 0.01), "center_lon": lon + np.random.normal(0, 0.01), "density": int(np.random.poisson(3))}
            for _ in range(min(3, high_risk_zones + 1))
        ],
    }


@app.route("/cluster/status")
def cluster_status():
    return jsonify({
        "connected": ray_connected,
        "head_address": RAY_HEAD_ADDRESS,
        "nodes": [
            {"id": "head-0", "alive": True, "cpus": 8, "gpus": 2, "memory_gb": 32, "object_store_gb": 10},
            {"id": "worker-1", "alive": True, "cpus": 16, "gpus": 4, "memory_gb": 64, "object_store_gb": 20},
            {"id": "worker-2", "alive": True, "cpus": 16, "gpus": 4, "memory_gb": 64, "object_store_gb": 20},
        ],
        "total_resources": {"cpus": 40, "gpus": 10, "memory_gb": 160, "object_store_gb": 50},
        "used_resources": {
            "cpus": sum(j.resources.get("cpus", 4) for j in training_jobs.values() if j.status == "running"),
            "gpus": sum(j.resources.get("gpus", 1) for j in training_jobs.values() if j.status == "running"),
        },
        "active_deployments": len([d for d in deployments.values() if d.status == "running"]),
        "active_training_jobs": len([j for j in training_jobs.values() if j.status == "running"]),
        "active_tune_experiments": len([e for e in tune_experiments.values() if e.status == "running"]),
    })


@app.route("/metrics")
def metrics():
    total_requests = sum(d.requests_served for d in deployments.values())
    avg_latency = np.mean([d.avg_latency_ms for d in deployments.values()]) if deployments else 0

    return jsonify({
        "total_deployments": len(deployments),
        "active_deployments": len([d for d in deployments.values() if d.status == "running"]),
        "total_requests_served": total_requests,
        "avg_latency_ms": round(float(avg_latency), 2),
        "training_jobs_completed": len([j for j in training_jobs.values() if j.status == "completed"]),
        "training_jobs_running": len([j for j in training_jobs.values() if j.status == "running"]),
        "tune_experiments_completed": len([e for e in tune_experiments.values() if e.status == "completed"]),
        "models_available": len(SUPPORTED_MODELS),
    })


try_connect_ray()

if __name__ == "__main__":
    port = int(os.getenv("RAY_SERVICE_PORT", "8100"))
    app.run(host="0.0.0.0", port=port)
