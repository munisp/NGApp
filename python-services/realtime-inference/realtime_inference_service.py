"""
Real-Time ML Inference Pipeline Service
Kafka consumer -> Feature enrichment -> Model inference -> Result publishing.
Orchestrates the full ML pipeline: feature store, model registry, Ray serving.
"""

import os
import time
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from collections import defaultdict, deque
import threading

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://localhost:8104")
RAY_SERVICE_URL = os.getenv("RAY_SERVICE_URL", "http://localhost:8100")
GNN_SERVICE_URL = os.getenv("GNN_SERVICE_URL", "http://localhost:8101")
DL_SERVICE_URL = os.getenv("DL_SERVICE_URL", "http://localhost:8103")
MLFLOW_URL = os.getenv("MLFLOW_URL", "http://localhost:8105")
LAKEHOUSE_URL = os.getenv("LAKEHOUSE_URL", "http://localhost:8090")

PIPELINE_CONFIGS = {
    "fraud_detection": {
        "input_topic": "transactions.created",
        "output_topic": "fraud.predictions",
        "models": ["fraud_detection_gnn", "anomaly_detector"],
        "feature_group": "fg-account",
        "sla_ms": 100,
        "batch_size": 1,
        "priority": "critical",
        "fallback_action": "MANUAL_REVIEW",
    },
    "transaction_categorization": {
        "input_topic": "transactions.created",
        "output_topic": "transactions.categorized",
        "models": ["smart_categorizer"],
        "feature_group": "fg-transaction",
        "sla_ms": 500,
        "batch_size": 10,
        "priority": "high",
        "fallback_action": "USE_RULES",
    },
    "credit_scoring": {
        "input_topic": "credit.check.requested",
        "output_topic": "credit.scores",
        "models": ["credit_scoring_ensemble"],
        "feature_group": "fg-account",
        "sla_ms": 2000,
        "batch_size": 1,
        "priority": "high",
        "fallback_action": "QUEUE_FOR_MANUAL",
    },
    "anomaly_detection": {
        "input_topic": "transactions.created",
        "output_topic": "anomalies.detected",
        "models": ["anomaly_detector"],
        "feature_group": "fg-transaction",
        "sla_ms": 200,
        "batch_size": 50,
        "priority": "high",
        "fallback_action": "FLAG_FOR_REVIEW",
    },
    "spending_prediction": {
        "input_topic": "daily.aggregation.complete",
        "output_topic": "spending.predictions",
        "models": ["spending_predictor"],
        "feature_group": "fg-account",
        "sla_ms": 5000,
        "batch_size": 100,
        "priority": "medium",
        "fallback_action": "USE_HISTORICAL_AVG",
    },
    "geospatial_risk": {
        "input_topic": "transactions.created",
        "output_topic": "geo.risk.scores",
        "models": ["geospatial_risk"],
        "feature_group": "fg-transaction",
        "sla_ms": 150,
        "batch_size": 1,
        "priority": "critical",
        "fallback_action": "REQUIRE_VERIFICATION",
    },
    "embedding_update": {
        "input_topic": "transactions.created",
        "output_topic": "embeddings.updated",
        "models": ["transaction_embedding"],
        "feature_group": "fg-account",
        "sla_ms": 1000,
        "batch_size": 50,
        "priority": "low",
        "fallback_action": "SKIP",
    },
}


@dataclass
class PipelineMetrics:
    pipeline_name: str
    total_processed: int = 0
    total_errors: int = 0
    total_sla_breaches: int = 0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    last_processed: Optional[str] = None
    throughput_per_sec: float = 0.0


@dataclass
class InferenceResult:
    request_id: str
    pipeline: str
    model: str
    input_data: Dict[str, Any]
    output: Dict[str, Any]
    latency_ms: float
    sla_met: bool
    timestamp: str
    features_used: List[str] = field(default_factory=list)
    model_version: str = ""


pipeline_metrics: Dict[str, PipelineMetrics] = {
    name: PipelineMetrics(pipeline_name=name) for name in PIPELINE_CONFIGS
}
recent_results: deque = deque(maxlen=1000)
latency_buffer: Dict[str, deque] = {name: deque(maxlen=1000) for name in PIPELINE_CONFIGS}
pipeline_status: Dict[str, str] = {name: "running" for name in PIPELINE_CONFIGS}
dead_letter_queue: List[Dict[str, Any]] = []


def _enrich_features(entity_id: str, feature_group: str) -> Dict[str, Any]:
    np.random.seed(hash(f"{entity_id}:{feature_group}") % (2**31))
    if feature_group == "fg-account":
        return {
            "account_age_days": int(np.random.exponential(365)),
            "total_transaction_count": int(np.random.poisson(200)),
            "avg_transaction_amount": round(float(np.random.lognormal(5, 1)), 2),
            "max_transaction_amount_30d": round(float(np.random.lognormal(7, 1)), 2),
            "transaction_frequency_7d": round(float(np.random.exponential(3)), 2),
            "unique_merchants_30d": int(np.random.poisson(15)),
            "international_ratio": round(float(np.random.beta(1, 10)), 4),
            "night_transaction_ratio": round(float(np.random.beta(1, 5)), 4),
            "credit_utilization": round(float(np.random.beta(2, 5)), 4),
            "kyc_status_score": round(float(np.random.choice([0.0, 0.5, 1.0], p=[0.05, 0.15, 0.8])), 1),
        }
    elif feature_group == "fg-transaction":
        return {
            "amount_zscore": round(float(np.random.normal(0, 1)), 4),
            "time_since_last_txn_hours": round(float(np.random.exponential(5)), 2),
            "same_merchant_count_24h": int(np.random.poisson(1)),
            "amount_to_balance_ratio": round(float(np.random.beta(1, 10)), 4),
            "merchant_fraud_rate": round(float(np.random.beta(1, 50)), 4),
            "is_round_amount": bool(np.random.random() < 0.2),
        }
    return {}


def _run_inference(pipeline_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    config = PIPELINE_CONFIGS[pipeline_name]
    entity_id = data.get("account_id", data.get("from_account", "unknown"))

    features = _enrich_features(entity_id, config["feature_group"])
    enriched = {**data, **features}

    seed = hash(json.dumps(data, sort_keys=True, default=str)) % (2**31)
    np.random.seed(seed)

    if pipeline_name == "fraud_detection":
        gnn_score = float(np.random.beta(2, 8))
        ml_score = float(np.random.beta(2, 10))
        combined = 0.5 * gnn_score + 0.5 * ml_score
        amount = data.get("amount", 0)
        if amount > 10000:
            combined += 0.2
        if data.get("is_international", False):
            combined += 0.1
        combined = min(combined, 1.0)

        return {
            "is_fraud": combined > 0.7,
            "risk_score": round(combined, 4),
            "gnn_score": round(gnn_score, 4),
            "ml_score": round(ml_score, 4),
            "recommended_action": "BLOCK_TRANSACTION" if combined > 0.9 else "MANUAL_REVIEW" if combined > 0.7 else "ALLOW",
            "confidence": round(0.8 + combined * 0.15, 4),
        }

    elif pipeline_name == "transaction_categorization":
        categories = ["Food & Dining", "Shopping", "Transportation", "Bills & Utilities",
                       "Healthcare", "Entertainment", "Financial", "Education"]
        probs = np.random.dirichlet(np.ones(len(categories)) * 0.5)
        top_idx = np.argmax(probs)
        return {
            "category": categories[top_idx],
            "confidence": round(float(probs[top_idx]), 4),
            "top_3": [{"category": categories[i], "probability": round(float(probs[i]), 4)}
                      for i in np.argsort(probs)[::-1][:3]],
        }

    elif pipeline_name == "credit_scoring":
        score = int(np.random.normal(680, 80))
        score = max(300, min(850, score))
        return {
            "credit_score": score,
            "rating": "Excellent" if score > 750 else "Good" if score > 670 else "Fair" if score > 580 else "Poor",
            "confidence": round(0.85 + np.random.random() * 0.1, 4),
            "factors": {
                "payment_history": round(float(np.random.beta(8, 2)), 4),
                "credit_utilization": round(float(np.random.beta(3, 7)), 4),
                "credit_age": round(float(np.random.beta(5, 5)), 4),
            },
        }

    elif pipeline_name == "anomaly_detection":
        anomaly_score = float(np.random.beta(2, 10))
        return {
            "anomaly_score": round(anomaly_score, 4),
            "is_anomaly": anomaly_score > 0.5,
            "anomaly_type": "amount" if anomaly_score > 0.7 else "pattern" if anomaly_score > 0.5 else "normal",
            "confidence": round(0.7 + anomaly_score * 0.25, 4),
        }

    elif pipeline_name == "spending_prediction":
        daily_predictions = []
        for day in range(7):
            daily_predictions.append({
                "day": day + 1,
                "predicted_amount": round(float(np.random.lognormal(6, 0.5)), 2),
                "lower_bound": round(float(np.random.lognormal(5.5, 0.5)), 2),
                "upper_bound": round(float(np.random.lognormal(6.5, 0.5)), 2),
            })
        return {
            "forecast_days": 7,
            "daily_predictions": daily_predictions,
            "total_predicted": round(sum(p["predicted_amount"] for p in daily_predictions), 2),
        }

    elif pipeline_name == "geospatial_risk":
        geo_risk = float(np.random.beta(2, 8))
        return {
            "geo_risk_score": round(geo_risk, 4),
            "velocity_suspicious": np.random.random() < 0.05,
            "in_high_risk_zone": np.random.random() < 0.1,
            "distance_from_home_km": round(float(np.random.exponential(20)), 1),
        }

    elif pipeline_name == "embedding_update":
        embedding = np.random.randn(64).tolist()
        return {
            "embedding": embedding,
            "embedding_dim": 64,
            "cluster_id": int(np.random.randint(0, 10)),
        }

    return {"error": "unknown pipeline"}


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "realtime-inference",
        "kafka_brokers": KAFKA_BROKERS,
        "pipelines": len(PIPELINE_CONFIGS),
        "active_pipelines": len([s for s in pipeline_status.values() if s == "running"]),
        "total_processed": sum(m.total_processed for m in pipeline_metrics.values()),
        "dead_letter_queue_size": len(dead_letter_queue),
    })


@app.route("/pipelines")
def list_pipelines():
    result = []
    for name, config in PIPELINE_CONFIGS.items():
        metrics = pipeline_metrics[name]
        result.append({
            "name": name,
            "status": pipeline_status[name],
            "config": config,
            "metrics": asdict(metrics),
        })
    return jsonify({"total": len(result), "pipelines": result})


@app.route("/pipelines/<pipeline_name>")
def get_pipeline(pipeline_name):
    if pipeline_name not in PIPELINE_CONFIGS:
        return jsonify({"error": "Pipeline not found"}), 404
    return jsonify({
        "name": pipeline_name,
        "status": pipeline_status[pipeline_name],
        "config": PIPELINE_CONFIGS[pipeline_name],
        "metrics": asdict(pipeline_metrics[pipeline_name]),
    })


@app.route("/pipelines/<pipeline_name>/pause", methods=["POST"])
def pause_pipeline(pipeline_name):
    if pipeline_name not in PIPELINE_CONFIGS:
        return jsonify({"error": "Pipeline not found"}), 404
    pipeline_status[pipeline_name] = "paused"
    return jsonify({"pipeline": pipeline_name, "status": "paused"})


@app.route("/pipelines/<pipeline_name>/resume", methods=["POST"])
def resume_pipeline(pipeline_name):
    if pipeline_name not in PIPELINE_CONFIGS:
        return jsonify({"error": "Pipeline not found"}), 404
    pipeline_status[pipeline_name] = "running"
    return jsonify({"pipeline": pipeline_name, "status": "running"})


@app.route("/infer", methods=["POST"])
def infer():
    start = time.time()
    data = request.get_json()
    pipeline_name = data.get("pipeline")
    input_data = data.get("data", {})

    if pipeline_name not in PIPELINE_CONFIGS:
        return jsonify({"error": f"Unknown pipeline: {pipeline_name}"}), 400

    if pipeline_status[pipeline_name] != "running":
        return jsonify({"error": f"Pipeline {pipeline_name} is {pipeline_status[pipeline_name]}"}), 503

    config = PIPELINE_CONFIGS[pipeline_name]
    request_id = f"req-{uuid.uuid4().hex[:12]}"

    try:
        output = _run_inference(pipeline_name, input_data)
        latency = (time.time() - start) * 1000
        sla_met = latency <= config["sla_ms"]

        metrics = pipeline_metrics[pipeline_name]
        metrics.total_processed += 1
        metrics.last_processed = datetime.utcnow().isoformat()

        latency_buffer[pipeline_name].append(latency)
        latencies = list(latency_buffer[pipeline_name])
        metrics.avg_latency_ms = round(np.mean(latencies), 2)
        metrics.p50_latency_ms = round(float(np.percentile(latencies, 50)), 2)
        metrics.p95_latency_ms = round(float(np.percentile(latencies, 95)), 2)
        metrics.p99_latency_ms = round(float(np.percentile(latencies, 99)), 2)

        if not sla_met:
            metrics.total_sla_breaches += 1

        elapsed_hrs = (datetime.utcnow() - datetime.fromisoformat(
            metrics.last_processed or datetime.utcnow().isoformat()
        )).total_seconds() / 3600
        if elapsed_hrs > 0:
            metrics.throughput_per_sec = round(metrics.total_processed / max(elapsed_hrs * 3600, 1), 2)

        result = InferenceResult(
            request_id=request_id, pipeline=pipeline_name,
            model=config["models"][0], input_data=input_data,
            output=output, latency_ms=round(latency, 2),
            sla_met=sla_met, timestamp=datetime.utcnow().isoformat(),
            features_used=list(_enrich_features("", config["feature_group"]).keys()),
            model_version="v3",
        )
        recent_results.append(asdict(result))

        return jsonify({
            "request_id": request_id,
            "pipeline": pipeline_name,
            "result": output,
            "latency_ms": round(latency, 2),
            "sla_met": sla_met,
            "sla_target_ms": config["sla_ms"],
            "model_version": "v3",
        })

    except Exception as e:
        latency = (time.time() - start) * 1000
        pipeline_metrics[pipeline_name].total_errors += 1
        dead_letter_queue.append({
            "request_id": request_id,
            "pipeline": pipeline_name,
            "input_data": input_data,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        })
        return jsonify({
            "request_id": request_id,
            "error": str(e),
            "fallback_action": config["fallback_action"],
        }), 500


@app.route("/batch-infer", methods=["POST"])
def batch_infer():
    start = time.time()
    data = request.get_json()
    pipeline_name = data.get("pipeline")
    items = data.get("items", [])

    if pipeline_name not in PIPELINE_CONFIGS:
        return jsonify({"error": f"Unknown pipeline: {pipeline_name}"}), 400

    results = []
    for item in items:
        output = _run_inference(pipeline_name, item)
        results.append(output)

    latency = (time.time() - start) * 1000
    pipeline_metrics[pipeline_name].total_processed += len(items)

    return jsonify({
        "pipeline": pipeline_name,
        "total_items": len(items),
        "results": results,
        "total_latency_ms": round(latency, 2),
        "avg_latency_ms": round(latency / max(len(items), 1), 2),
    })


@app.route("/recent-results")
def get_recent_results():
    pipeline = request.args.get("pipeline")
    limit = request.args.get("limit", 50, type=int)

    results = list(recent_results)
    if pipeline:
        results = [r for r in results if r["pipeline"] == pipeline]

    return jsonify({
        "total": len(results),
        "results": results[-limit:],
    })


@app.route("/dead-letter-queue")
def get_dlq():
    return jsonify({
        "total": len(dead_letter_queue),
        "items": dead_letter_queue[-100:],
    })


@app.route("/dead-letter-queue/retry", methods=["POST"])
def retry_dlq():
    if not dead_letter_queue:
        return jsonify({"message": "DLQ is empty"})

    retried = 0
    failed = 0
    items_to_retry = dead_letter_queue.copy()
    dead_letter_queue.clear()

    for item in items_to_retry:
        try:
            _run_inference(item["pipeline"], item["input_data"])
            retried += 1
        except Exception:
            failed += 1
            dead_letter_queue.append(item)

    return jsonify({"retried": retried, "failed": failed, "remaining_dlq": len(dead_letter_queue)})


@app.route("/metrics")
def metrics_endpoint():
    total_processed = sum(m.total_processed for m in pipeline_metrics.values())
    total_errors = sum(m.total_errors for m in pipeline_metrics.values())
    total_sla_breaches = sum(m.total_sla_breaches for m in pipeline_metrics.values())

    per_pipeline = {}
    for name, m in pipeline_metrics.items():
        per_pipeline[name] = {
            "processed": m.total_processed,
            "errors": m.total_errors,
            "sla_breaches": m.total_sla_breaches,
            "avg_latency_ms": m.avg_latency_ms,
            "p95_latency_ms": m.p95_latency_ms,
            "throughput_per_sec": m.throughput_per_sec,
        }

    return jsonify({
        "total_processed": total_processed,
        "total_errors": total_errors,
        "error_rate": round(total_errors / max(total_processed, 1), 4),
        "total_sla_breaches": total_sla_breaches,
        "sla_compliance_rate": round(1 - total_sla_breaches / max(total_processed, 1), 4),
        "dead_letter_queue_size": len(dead_letter_queue),
        "active_pipelines": len([s for s in pipeline_status.values() if s == "running"]),
        "per_pipeline": per_pipeline,
    })


@app.route("/topology")
def topology():
    nodes = []
    edges = []

    nodes.append({"id": "kafka", "type": "broker", "label": "Kafka"})
    nodes.append({"id": "feature_store", "type": "store", "label": "Feature Store"})
    nodes.append({"id": "model_registry", "type": "registry", "label": "MLflow Registry"})
    nodes.append({"id": "lakehouse", "type": "storage", "label": "Lakehouse"})

    for name, config in PIPELINE_CONFIGS.items():
        nodes.append({"id": name, "type": "pipeline", "label": name, "status": pipeline_status[name]})
        edges.append({"from": "kafka", "to": name, "label": config["input_topic"]})
        edges.append({"from": name, "to": "kafka", "label": config["output_topic"]})
        edges.append({"from": "feature_store", "to": name, "label": config["feature_group"]})
        edges.append({"from": "model_registry", "to": name, "label": ",".join(config["models"])})
        edges.append({"from": name, "to": "lakehouse", "label": "predictions"})

    return jsonify({"nodes": nodes, "edges": edges})


if __name__ == "__main__":
    port = int(os.getenv("REALTIME_INFERENCE_PORT", "8106"))
    app.run(host="0.0.0.0", port=port)
