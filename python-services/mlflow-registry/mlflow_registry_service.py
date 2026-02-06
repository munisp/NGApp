"""
MLflow Model Registry Service
Model versioning, experiment tracking, model lifecycle management,
A/B testing support, and model deployment coordination.
"""

import os
import time
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from collections import defaultdict

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
ARTIFACT_STORE = os.getenv("ARTIFACT_STORE", "/data/mlflow/artifacts")
RAY_SERVICE_URL = os.getenv("RAY_SERVICE_URL", "http://localhost:8100")


@dataclass
class Experiment:
    experiment_id: str
    name: str
    description: str
    created_at: str
    tags: Dict[str, str] = field(default_factory=dict)
    runs: List[str] = field(default_factory=list)


@dataclass
class Run:
    run_id: str
    experiment_id: str
    status: str
    started_at: str
    ended_at: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    metric_history: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    tags: Dict[str, str] = field(default_factory=dict)
    artifacts: List[str] = field(default_factory=list)
    model_name: Optional[str] = None


@dataclass
class RegisteredModel:
    name: str
    description: str
    created_at: str
    updated_at: str
    tags: Dict[str, str] = field(default_factory=dict)
    versions: List[str] = field(default_factory=list)
    latest_version: int = 0


@dataclass
class ModelVersion:
    version_id: str
    model_name: str
    version: int
    run_id: str
    status: str
    stage: str
    created_at: str
    description: str = ""
    metrics: Dict[str, float] = field(default_factory=dict)
    source: str = ""
    tags: Dict[str, str] = field(default_factory=dict)


experiments: Dict[str, Experiment] = {}
runs: Dict[str, Run] = {}
registered_models: Dict[str, RegisteredModel] = {}
model_versions: Dict[str, ModelVersion] = {}
ab_tests: Dict[str, Dict[str, Any]] = {}


def _seed_registry():
    now = datetime.utcnow().isoformat()

    model_configs = [
        ("fraud_detection_gnn", "GNN-based fraud detection model", {
            "accuracy": 0.9421, "precision": 0.8876, "recall": 0.9134,
            "f1": 0.9003, "auc_roc": 0.9567, "false_positive_rate": 0.034,
        }),
        ("credit_scoring_ensemble", "Ensemble credit scoring (XGBoost+LightGBM+CatBoost)", {
            "rmse": 28.45, "mae": 21.32, "r2": 0.8923,
            "accuracy_within_50": 0.9245, "ks_statistic": 0.7834,
        }),
        ("transaction_embedding", "LSTM Autoencoder for transaction embeddings", {
            "reconstruction_loss": 0.0234, "embedding_quality": 0.8712,
            "cluster_silhouette": 0.6543, "anomaly_detection_auc": 0.9123,
        }),
        ("smart_categorizer", "Transformer-based transaction categorizer", {
            "accuracy": 0.9156, "macro_f1": 0.8834, "top3_accuracy": 0.9789,
            "avg_confidence": 0.8923,
        }),
        ("anomaly_detector", "Isolation Forest + Autoencoder anomaly detection", {
            "precision_at_5pct": 0.8234, "recall_at_5pct": 0.7456,
            "auc_roc": 0.9345, "avg_detection_time_ms": 12.5,
        }),
        ("geospatial_risk", "Geospatial risk scoring with Sedona", {
            "accuracy": 0.8756, "precision": 0.8234, "recall": 0.8567,
            "geo_accuracy_km": 2.34, "velocity_detection_rate": 0.9123,
        }),
        ("spending_predictor", "RNN spending pattern predictor", {
            "mape": 0.1234, "rmse": 45.67, "mae": 32.12,
            "r2": 0.8456, "directional_accuracy": 0.7834,
        }),
        ("tax_optimizer", "Tax optimization with LLM deduction detection", {
            "deduction_precision": 0.8912, "deduction_recall": 0.8234,
            "savings_accuracy": 0.9023, "compliance_score": 0.9567,
        }),
    ]

    for model_name, description, best_metrics in model_configs:
        exp_id = f"exp-{model_name}"
        experiments[exp_id] = Experiment(
            experiment_id=exp_id, name=f"{model_name}_experiments",
            description=f"Experiments for {description}",
            created_at=now, tags={"model_type": model_name},
        )

        registered_models[model_name] = RegisteredModel(
            name=model_name, description=description,
            created_at=now, updated_at=now,
            tags={"domain": "fintech", "team": "ml-platform"},
        )

        for v in range(1, 4):
            run_id = f"run-{model_name}-v{v}"
            noise = {k: round(val + np.random.normal(0, val * 0.05), 4)
                     for k, val in best_metrics.items()}
            if v == 3:
                noise = best_metrics

            metric_hist = {}
            for metric_name, final_val in noise.items():
                history = []
                for epoch in range(50):
                    progress = epoch / 49
                    value = final_val * (0.5 + 0.5 * (1 - np.exp(-3 * progress)))
                    value += np.random.normal(0, final_val * 0.02)
                    history.append({"step": epoch, "value": round(float(value), 4),
                                    "timestamp": (datetime.utcnow() - timedelta(hours=50-epoch)).isoformat()})
                metric_hist[metric_name] = history

            runs[run_id] = Run(
                run_id=run_id, experiment_id=exp_id, status="FINISHED",
                started_at=(datetime.utcnow() - timedelta(days=30-v*10)).isoformat(),
                ended_at=(datetime.utcnow() - timedelta(days=29-v*10)).isoformat(),
                parameters={"learning_rate": 0.001 / v, "epochs": 50, "batch_size": 128 * v},
                metrics=noise, metric_history=metric_hist,
                tags={"version": str(v)},
                artifacts=[f"model_{model_name}_v{v}.pt", f"config_{model_name}_v{v}.json"],
                model_name=model_name,
            )
            experiments[exp_id].runs.append(run_id)

            ver_id = f"ver-{model_name}-{v}"
            stage = "Production" if v == 3 else "Archived" if v == 1 else "Staging"
            model_versions[ver_id] = ModelVersion(
                version_id=ver_id, model_name=model_name, version=v,
                run_id=run_id, status="READY", stage=stage,
                created_at=(datetime.utcnow() - timedelta(days=30-v*10)).isoformat(),
                description=f"Version {v} of {model_name}",
                metrics=noise, source=f"s3://mlflow/{model_name}/v{v}",
            )
            registered_models[model_name].versions.append(ver_id)
            registered_models[model_name].latest_version = v


_seed_registry()


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "mlflow-registry",
        "tracking_uri": MLFLOW_TRACKING_URI,
        "experiments": len(experiments),
        "runs": len(runs),
        "registered_models": len(registered_models),
        "model_versions": len(model_versions),
        "ab_tests": len(ab_tests),
    })


@app.route("/experiments")
def list_experiments():
    return jsonify({
        "total": len(experiments),
        "experiments": [asdict(e) for e in experiments.values()],
    })


@app.route("/experiments/<exp_id>")
def get_experiment(exp_id):
    if exp_id not in experiments:
        return jsonify({"error": "Experiment not found"}), 404
    exp = experiments[exp_id]
    exp_runs = [asdict(runs[rid]) for rid in exp.runs if rid in runs]
    return jsonify({**asdict(exp), "runs_detail": exp_runs})


@app.route("/experiments", methods=["POST"])
def create_experiment():
    data = request.get_json()
    exp_id = f"exp-{uuid.uuid4().hex[:8]}"
    exp = Experiment(
        experiment_id=exp_id, name=data.get("name", ""),
        description=data.get("description", ""),
        created_at=datetime.utcnow().isoformat(),
        tags=data.get("tags", {}),
    )
    experiments[exp_id] = exp
    return jsonify(asdict(exp))


@app.route("/runs/<run_id>")
def get_run(run_id):
    if run_id not in runs:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(asdict(runs[run_id]))


@app.route("/runs", methods=["POST"])
def create_run():
    data = request.get_json()
    exp_id = data.get("experiment_id")
    if exp_id and exp_id not in experiments:
        return jsonify({"error": "Experiment not found"}), 404

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    run = Run(
        run_id=run_id, experiment_id=exp_id or "",
        status="RUNNING", started_at=datetime.utcnow().isoformat(),
        parameters=data.get("parameters", {}),
        tags=data.get("tags", {}),
        model_name=data.get("model_name"),
    )
    runs[run_id] = run
    if exp_id and exp_id in experiments:
        experiments[exp_id].runs.append(run_id)
    return jsonify(asdict(run))


@app.route("/runs/<run_id>/log-metrics", methods=["POST"])
def log_metrics(run_id):
    if run_id not in runs:
        return jsonify({"error": "Run not found"}), 404
    data = request.get_json()
    metrics_data = data.get("metrics", {})
    step = data.get("step", 0)

    run = runs[run_id]
    for name, value in metrics_data.items():
        run.metrics[name] = value
        if name not in run.metric_history:
            run.metric_history[name] = []
        run.metric_history[name].append({
            "step": step, "value": value,
            "timestamp": datetime.utcnow().isoformat(),
        })

    return jsonify({"run_id": run_id, "metrics_logged": len(metrics_data)})


@app.route("/runs/<run_id>/finish", methods=["POST"])
def finish_run(run_id):
    if run_id not in runs:
        return jsonify({"error": "Run not found"}), 404
    run = runs[run_id]
    run.status = "FINISHED"
    run.ended_at = datetime.utcnow().isoformat()
    return jsonify(asdict(run))


@app.route("/models")
def list_models():
    return jsonify({
        "total": len(registered_models),
        "models": [asdict(m) for m in registered_models.values()],
    })


@app.route("/models/<model_name>")
def get_model(model_name):
    if model_name not in registered_models:
        return jsonify({"error": "Model not found"}), 404
    model = registered_models[model_name]
    versions = [asdict(model_versions[vid]) for vid in model.versions if vid in model_versions]
    return jsonify({**asdict(model), "versions_detail": versions})


@app.route("/models", methods=["POST"])
def register_model():
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "name required"}), 400
    if name in registered_models:
        return jsonify({"error": f"Model {name} already exists"}), 409

    now = datetime.utcnow().isoformat()
    model = RegisteredModel(
        name=name, description=data.get("description", ""),
        created_at=now, updated_at=now,
        tags=data.get("tags", {}),
    )
    registered_models[name] = model
    return jsonify(asdict(model))


@app.route("/models/<model_name>/versions", methods=["POST"])
def create_model_version(model_name):
    if model_name not in registered_models:
        return jsonify({"error": "Model not found"}), 404

    data = request.get_json()
    model = registered_models[model_name]
    model.latest_version += 1
    version = model.latest_version

    ver_id = f"ver-{model_name}-{version}"
    mv = ModelVersion(
        version_id=ver_id, model_name=model_name, version=version,
        run_id=data.get("run_id", ""), status="READY",
        stage=data.get("stage", "None"),
        created_at=datetime.utcnow().isoformat(),
        description=data.get("description", f"Version {version}"),
        metrics=data.get("metrics", {}),
        source=data.get("source", f"s3://mlflow/{model_name}/v{version}"),
    )
    model_versions[ver_id] = mv
    model.versions.append(ver_id)
    model.updated_at = datetime.utcnow().isoformat()
    return jsonify(asdict(mv))


@app.route("/models/<model_name>/versions/<int:version>/transition", methods=["POST"])
def transition_stage(model_name, version):
    ver_id = f"ver-{model_name}-{version}"
    if ver_id not in model_versions:
        return jsonify({"error": "Version not found"}), 404

    data = request.get_json()
    new_stage = data.get("stage")
    if new_stage not in ["None", "Staging", "Production", "Archived"]:
        return jsonify({"error": "Invalid stage"}), 400

    if new_stage == "Production":
        for vid, mv in model_versions.items():
            if mv.model_name == model_name and mv.stage == "Production":
                mv.stage = "Archived"

    model_versions[ver_id].stage = new_stage
    return jsonify(asdict(model_versions[ver_id]))


@app.route("/models/<model_name>/compare", methods=["POST"])
def compare_versions(model_name):
    if model_name not in registered_models:
        return jsonify({"error": "Model not found"}), 404

    data = request.get_json()
    version_ids = data.get("versions", [])

    comparisons = []
    for vid in version_ids:
        full_vid = f"ver-{model_name}-{vid}" if not vid.startswith("ver-") else vid
        mv = model_versions.get(full_vid)
        if mv:
            comparisons.append(asdict(mv))

    if len(comparisons) < 2:
        all_versions = [asdict(model_versions[vid]) for vid in registered_models[model_name].versions]
        comparisons = all_versions[-3:]

    all_metrics = set()
    for c in comparisons:
        all_metrics.update(c.get("metrics", {}).keys())

    metric_comparison = {}
    for metric in all_metrics:
        values = [c["metrics"].get(metric) for c in comparisons if metric in c.get("metrics", {})]
        if values:
            metric_comparison[metric] = {
                "values": values,
                "best": max(values) if metric not in ["rmse", "mae", "mape", "false_positive_rate", "reconstruction_loss"] else min(values),
                "improvement": round((values[-1] - values[0]) / max(abs(values[0]), 1e-8) * 100, 2) if len(values) > 1 else 0,
            }

    return jsonify({
        "model_name": model_name,
        "versions": comparisons,
        "metric_comparison": metric_comparison,
    })


@app.route("/ab-tests", methods=["POST"])
def create_ab_test():
    data = request.get_json()
    test_id = f"ab-{uuid.uuid4().hex[:8]}"

    ab_tests[test_id] = {
        "test_id": test_id,
        "model_name": data.get("model_name"),
        "control_version": data.get("control_version"),
        "treatment_version": data.get("treatment_version"),
        "traffic_split": data.get("traffic_split", 0.5),
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
        "metrics": {"control": {}, "treatment": {}},
        "total_requests": {"control": 0, "treatment": 0},
    }
    return jsonify(ab_tests[test_id])


@app.route("/ab-tests/<test_id>")
def get_ab_test(test_id):
    if test_id not in ab_tests:
        return jsonify({"error": "A/B test not found"}), 404

    test = ab_tests[test_id]
    np.random.seed(hash(test_id) % (2**31))
    test["total_requests"]["control"] += int(np.random.poisson(100))
    test["total_requests"]["treatment"] += int(np.random.poisson(100))
    test["metrics"]["control"] = {
        "accuracy": round(0.90 + np.random.normal(0, 0.01), 4),
        "latency_ms": round(15 + np.random.normal(0, 2), 2),
        "error_rate": round(0.02 + np.random.normal(0, 0.005), 4),
    }
    test["metrics"]["treatment"] = {
        "accuracy": round(0.93 + np.random.normal(0, 0.01), 4),
        "latency_ms": round(18 + np.random.normal(0, 2), 2),
        "error_rate": round(0.015 + np.random.normal(0, 0.005), 4),
    }

    return jsonify(test)


@app.route("/ab-tests")
def list_ab_tests():
    return jsonify({"total": len(ab_tests), "tests": list(ab_tests.values())})


@app.route("/dashboard")
def dashboard():
    total_runs = len(runs)
    finished_runs = len([r for r in runs.values() if r.status == "FINISHED"])
    production_models = len([mv for mv in model_versions.values() if mv.stage == "Production"])
    staging_models = len([mv for mv in model_versions.values() if mv.stage == "Staging"])

    recent_runs = sorted(
        [asdict(r) for r in runs.values()],
        key=lambda r: r["started_at"], reverse=True,
    )[:10]

    model_health = []
    for model_name, model in registered_models.items():
        prod_versions = [model_versions[vid] for vid in model.versions
                         if vid in model_versions and model_versions[vid].stage == "Production"]
        if prod_versions:
            prod = prod_versions[0]
            model_health.append({
                "model_name": model_name,
                "production_version": prod.version,
                "metrics": prod.metrics,
                "last_updated": prod.created_at,
            })

    return jsonify({
        "total_experiments": len(experiments),
        "total_runs": total_runs,
        "finished_runs": finished_runs,
        "registered_models": len(registered_models),
        "production_models": production_models,
        "staging_models": staging_models,
        "total_versions": len(model_versions),
        "active_ab_tests": len([t for t in ab_tests.values() if t["status"] == "running"]),
        "recent_runs": recent_runs,
        "model_health": model_health,
    })


@app.route("/metrics")
def metrics_endpoint():
    return jsonify({
        "experiments": len(experiments),
        "runs": len(runs),
        "models": len(registered_models),
        "versions": len(model_versions),
        "production_versions": len([mv for mv in model_versions.values() if mv.stage == "Production"]),
        "ab_tests": len(ab_tests),
    })


if __name__ == "__main__":
    port = int(os.getenv("MLFLOW_REGISTRY_PORT", "8105"))
    app.run(host="0.0.0.0", port=port)
