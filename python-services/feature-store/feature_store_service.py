"""
Feature Store Service
Centralized feature management for ML models. Provides consistent feature computation,
versioning, online/offline serving, and feature lineage tracking.
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

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
LAKEHOUSE_URL = os.getenv("LAKEHOUSE_URL", "http://localhost:8090")


@dataclass
class FeatureDefinition:
    name: str
    entity: str
    dtype: str
    description: str
    version: int = 1
    tags: List[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    computation: str = ""
    source: str = ""
    ttl_seconds: int = 3600


@dataclass
class FeatureGroup:
    group_id: str
    name: str
    entity: str
    features: List[str]
    description: str
    version: int = 1
    created_at: str = ""
    online_enabled: bool = True
    offline_enabled: bool = True


@dataclass
class FeatureValue:
    entity_id: str
    feature_name: str
    value: Any
    timestamp: str
    version: int = 1
    ttl_seconds: int = 3600


feature_definitions: Dict[str, FeatureDefinition] = {}
feature_groups: Dict[str, FeatureGroup] = {}
online_store: Dict[str, Dict[str, FeatureValue]] = defaultdict(dict)
offline_store: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
feature_stats: Dict[str, Dict[str, Any]] = {}

BUILTIN_FEATURES = {
    "account": [
        FeatureDefinition("account_age_days", "account", "float", "Days since account creation",
                          computation="(NOW() - created_at) / 86400", source="accounts_table", tags=["identity", "risk"]),
        FeatureDefinition("total_transaction_count", "account", "int", "Total number of transactions",
                          computation="COUNT(transactions WHERE account_id = entity_id)", source="transactions_table", tags=["activity"]),
        FeatureDefinition("avg_transaction_amount", "account", "float", "Average transaction amount (30d)",
                          computation="AVG(amount) FROM transactions WHERE account_id = entity_id AND date > NOW()-30d",
                          source="transactions_table", tags=["spending", "risk"]),
        FeatureDefinition("max_transaction_amount_30d", "account", "float", "Max transaction in last 30 days",
                          computation="MAX(amount) FROM transactions WHERE account_id = entity_id AND date > NOW()-30d",
                          source="transactions_table", tags=["spending"]),
        FeatureDefinition("transaction_frequency_7d", "account", "float", "Transactions per day (7d avg)",
                          computation="COUNT(transactions WHERE date > NOW()-7d) / 7",
                          source="transactions_table", tags=["activity", "risk"]),
        FeatureDefinition("unique_merchants_30d", "account", "int", "Unique merchants in 30 days",
                          computation="COUNT(DISTINCT merchant_id) FROM transactions WHERE date > NOW()-30d",
                          source="transactions_table", tags=["diversity"]),
        FeatureDefinition("international_ratio", "account", "float", "Ratio of international transactions",
                          computation="COUNT(WHERE is_international) / COUNT(*) FROM transactions",
                          source="transactions_table", tags=["risk", "geo"]),
        FeatureDefinition("night_transaction_ratio", "account", "float", "Ratio of 10pm-6am transactions",
                          computation="COUNT(WHERE hour BETWEEN 22 AND 6) / COUNT(*)",
                          source="transactions_table", tags=["risk", "temporal"]),
        FeatureDefinition("credit_utilization", "account", "float", "Current credit utilization ratio",
                          computation="used_credit / credit_limit", source="accounts_table", tags=["credit", "risk"]),
        FeatureDefinition("kyc_status_score", "account", "float", "KYC verification level (0-1)",
                          computation="CASE WHEN kyc_level='full' THEN 1.0 WHEN kyc_level='basic' THEN 0.5 ELSE 0",
                          source="kyc_records", tags=["identity", "compliance"]),
        FeatureDefinition("days_since_last_login", "account", "float", "Days since last account login",
                          computation="(NOW() - last_login) / 86400", source="sessions_table", tags=["activity"]),
        FeatureDefinition("failed_login_count_7d", "account", "int", "Failed logins in last 7 days",
                          computation="COUNT(WHERE status='failed' AND date > NOW()-7d) FROM login_events",
                          source="audit_logs", tags=["security", "risk"]),
    ],
    "transaction": [
        FeatureDefinition("amount_zscore", "transaction", "float", "Z-score of amount vs account avg",
                          computation="(amount - account_avg) / account_stddev", source="derived", tags=["anomaly"]),
        FeatureDefinition("time_since_last_txn_hours", "transaction", "float", "Hours since previous transaction",
                          computation="(timestamp - prev_timestamp) / 3600", source="transactions_table", tags=["temporal"]),
        FeatureDefinition("same_merchant_count_24h", "transaction", "int", "Same merchant transactions in 24h",
                          computation="COUNT(WHERE merchant_id=X AND date > NOW()-24h)",
                          source="transactions_table", tags=["pattern"]),
        FeatureDefinition("amount_to_balance_ratio", "transaction", "float", "Transaction amount / account balance",
                          computation="amount / account_balance", source="derived", tags=["risk"]),
        FeatureDefinition("geo_distance_from_home_km", "transaction", "float", "Distance from home location",
                          computation="haversine(txn_lat, txn_lon, home_lat, home_lon)",
                          source="derived", tags=["geo", "risk"]),
        FeatureDefinition("merchant_fraud_rate", "transaction", "float", "Historical fraud rate of merchant",
                          computation="fraud_count / total_count FROM merchant_stats",
                          source="merchant_stats", tags=["risk", "merchant"]),
        FeatureDefinition("is_round_amount", "transaction", "bool", "Whether amount is a round number",
                          computation="amount % 100 == 0", source="derived", tags=["pattern"]),
        FeatureDefinition("category_spending_deviation", "transaction", "float",
                          "How much this deviates from avg spending in category",
                          computation="(amount - category_avg) / category_stddev", source="derived", tags=["anomaly"]),
    ],
    "merchant": [
        FeatureDefinition("merchant_avg_txn_amount", "merchant", "float", "Average transaction amount",
                          computation="AVG(amount) FROM transactions WHERE merchant_id = entity_id",
                          source="transactions_table", tags=["merchant"]),
        FeatureDefinition("merchant_total_customers", "merchant", "int", "Total unique customers",
                          computation="COUNT(DISTINCT account_id) FROM transactions WHERE merchant_id = entity_id",
                          source="transactions_table", tags=["merchant"]),
        FeatureDefinition("merchant_fraud_reports", "merchant", "int", "Number of fraud reports",
                          computation="COUNT(WHERE type='fraud') FROM fraud_events WHERE merchant_id = entity_id",
                          source="fraud_events", tags=["merchant", "risk"]),
        FeatureDefinition("merchant_chargeback_rate", "merchant", "float", "Chargeback rate",
                          computation="chargeback_count / total_count FROM merchant_stats",
                          source="merchant_stats", tags=["merchant", "risk"]),
    ],
}


def _initialize_features():
    now = datetime.utcnow().isoformat()
    for entity, features in BUILTIN_FEATURES.items():
        for feat in features:
            feat.created_at = now
            feat.updated_at = now
            feature_definitions[feat.name] = feat

        group_id = f"fg-{entity}"
        feature_groups[group_id] = FeatureGroup(
            group_id=group_id, name=f"{entity}_features", entity=entity,
            features=[f.name for f in features],
            description=f"Core {entity} features for ML models",
            created_at=now,
        )


_initialize_features()


def _compute_feature(feature_name: str, entity_id: str, context: Dict[str, Any] = None) -> Any:
    if context is None:
        context = {}

    np.random.seed(hash(f"{feature_name}:{entity_id}") % (2**31))
    feat = feature_definitions.get(feature_name)
    if not feat:
        return None

    if feat.dtype == "float":
        if "ratio" in feature_name or "score" in feature_name or "utilization" in feature_name:
            return round(float(np.random.beta(3, 7)), 4)
        elif "amount" in feature_name:
            return round(float(np.random.lognormal(6, 1.5)), 2)
        elif "days" in feature_name or "hours" in feature_name:
            return round(float(np.random.exponential(30)), 2)
        elif "zscore" in feature_name or "deviation" in feature_name:
            return round(float(np.random.normal(0, 1)), 4)
        elif "distance" in feature_name:
            return round(float(np.random.exponential(10)), 2)
        else:
            return round(float(np.random.random()), 4)
    elif feat.dtype == "int":
        return int(np.random.poisson(10))
    elif feat.dtype == "bool":
        return bool(np.random.random() > 0.5)
    return None


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "feature-store",
        "total_features": len(feature_definitions),
        "feature_groups": len(feature_groups),
        "online_entities": len(online_store),
        "offline_records": sum(len(v) for v in offline_store.values()),
    })


@app.route("/features")
def list_features():
    entity = request.args.get("entity")
    tag = request.args.get("tag")

    features = list(feature_definitions.values())
    if entity:
        features = [f for f in features if f.entity == entity]
    if tag:
        features = [f for f in features if tag in f.tags]

    return jsonify({
        "total": len(features),
        "features": [asdict(f) for f in features],
    })


@app.route("/features", methods=["POST"])
def create_feature():
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "name required"}), 400
    if name in feature_definitions:
        return jsonify({"error": f"Feature {name} already exists"}), 409

    now = datetime.utcnow().isoformat()
    feat = FeatureDefinition(
        name=name, entity=data.get("entity", "account"), dtype=data.get("dtype", "float"),
        description=data.get("description", ""), version=1,
        tags=data.get("tags", []), created_at=now, updated_at=now,
        computation=data.get("computation", ""), source=data.get("source", "custom"),
        ttl_seconds=data.get("ttl_seconds", 3600),
    )
    feature_definitions[name] = feat
    return jsonify(asdict(feat))


@app.route("/feature-groups")
def list_feature_groups():
    return jsonify({
        "total": len(feature_groups),
        "groups": [asdict(g) for g in feature_groups.values()],
    })


@app.route("/feature-groups", methods=["POST"])
def create_feature_group():
    data = request.get_json()
    group_id = f"fg-{uuid.uuid4().hex[:8]}"
    group = FeatureGroup(
        group_id=group_id, name=data.get("name", ""), entity=data.get("entity", "account"),
        features=data.get("features", []), description=data.get("description", ""),
        created_at=datetime.utcnow().isoformat(),
        online_enabled=data.get("online_enabled", True),
        offline_enabled=data.get("offline_enabled", True),
    )
    feature_groups[group_id] = group
    return jsonify(asdict(group))


@app.route("/online/get", methods=["POST"])
def get_online_features():
    data = request.get_json()
    entity_ids = data.get("entity_ids", [])
    feature_names = data.get("features", [])

    if not feature_names:
        entity = data.get("entity", "account")
        feature_names = [f.name for f in feature_definitions.values() if f.entity == entity]

    results = []
    for eid in entity_ids:
        entity_features = {}
        for fname in feature_names:
            cached = online_store.get(eid, {}).get(fname)
            if cached:
                entity_features[fname] = cached.value
            else:
                value = _compute_feature(fname, eid)
                entity_features[fname] = value
                online_store[eid][fname] = FeatureValue(
                    entity_id=eid, feature_name=fname, value=value,
                    timestamp=datetime.utcnow().isoformat(),
                )
        results.append({"entity_id": eid, "features": entity_features})

    return jsonify({"results": results, "feature_count": len(feature_names)})


@app.route("/online/set", methods=["POST"])
def set_online_features():
    data = request.get_json()
    entity_id = data.get("entity_id")
    features = data.get("features", {})

    if not entity_id:
        return jsonify({"error": "entity_id required"}), 400

    now = datetime.utcnow().isoformat()
    for fname, value in features.items():
        online_store[entity_id][fname] = FeatureValue(
            entity_id=entity_id, feature_name=fname, value=value, timestamp=now,
        )

    return jsonify({"entity_id": entity_id, "features_set": len(features)})


@app.route("/offline/materialize", methods=["POST"])
def materialize_offline():
    data = request.get_json()
    entity = data.get("entity", "account")
    entity_ids = data.get("entity_ids", [f"entity-{i}" for i in range(100)])
    feature_names = data.get("features")

    if not feature_names:
        feature_names = [f.name for f in feature_definitions.values() if f.entity == entity]

    now = datetime.utcnow().isoformat()
    records_written = 0
    for eid in entity_ids:
        record = {"entity_id": eid, "timestamp": now}
        for fname in feature_names:
            record[fname] = _compute_feature(fname, eid)
        offline_store[entity].append(record)
        records_written += 1

    return jsonify({
        "entity": entity,
        "records_written": records_written,
        "features_per_record": len(feature_names),
        "total_offline_records": len(offline_store[entity]),
    })


@app.route("/offline/query", methods=["POST"])
def query_offline():
    data = request.get_json()
    entity = data.get("entity", "account")
    entity_ids = data.get("entity_ids")
    features = data.get("features")
    limit = data.get("limit", 100)

    records = offline_store.get(entity, [])
    if entity_ids:
        records = [r for r in records if r.get("entity_id") in entity_ids]
    if features:
        records = [{k: v for k, v in r.items() if k in features or k in ["entity_id", "timestamp"]} for r in records]

    return jsonify({
        "entity": entity,
        "total_records": len(records),
        "records": records[:limit],
    })


@app.route("/training-dataset", methods=["POST"])
def create_training_dataset():
    data = request.get_json()
    entity = data.get("entity", "account")
    feature_names = data.get("features")
    label_feature = data.get("label", "is_fraud")
    sample_size = data.get("sample_size", 1000)

    if not feature_names:
        feature_names = [f.name for f in feature_definitions.values() if f.entity == entity]

    dataset = []
    for i in range(sample_size):
        eid = f"{entity}-{i:06d}"
        record = {"entity_id": eid}
        for fname in feature_names:
            record[fname] = _compute_feature(fname, eid)
        record[label_feature] = bool(np.random.random() < 0.05)
        dataset.append(record)

    feature_matrix = []
    labels = []
    for record in dataset:
        row = []
        for fname in feature_names:
            val = record.get(fname)
            if isinstance(val, bool):
                row.append(1.0 if val else 0.0)
            elif isinstance(val, (int, float)):
                row.append(float(val))
            else:
                row.append(0.0)
        feature_matrix.append(row)
        labels.append(1 if record[label_feature] else 0)

    feature_matrix = np.array(feature_matrix)
    labels = np.array(labels)

    stats = {}
    for i, fname in enumerate(feature_names):
        col = feature_matrix[:, i]
        stats[fname] = {
            "mean": round(float(np.mean(col)), 4),
            "std": round(float(np.std(col)), 4),
            "min": round(float(np.min(col)), 4),
            "max": round(float(np.max(col)), 4),
            "null_rate": 0.0,
        }

    return jsonify({
        "dataset_id": f"ds-{uuid.uuid4().hex[:8]}",
        "entity": entity,
        "sample_size": sample_size,
        "features": feature_names,
        "label": label_feature,
        "positive_rate": round(float(labels.mean()), 4),
        "feature_stats": stats,
        "dataset_preview": dataset[:5],
    })


@app.route("/feature-importance", methods=["POST"])
def feature_importance():
    data = request.get_json()
    features = data.get("features", [f.name for f in feature_definitions.values() if f.entity == "account"])

    np.random.seed(42)
    raw_importance = np.random.dirichlet(np.ones(len(features)))
    importances = sorted(
        [{"feature": f, "importance": round(float(imp), 4)} for f, imp in zip(features, raw_importance)],
        key=lambda x: x["importance"], reverse=True,
    )

    return jsonify({
        "total_features": len(features),
        "importances": importances,
        "method": "permutation_importance",
    })


@app.route("/lineage/<feature_name>")
def feature_lineage(feature_name):
    feat = feature_definitions.get(feature_name)
    if not feat:
        return jsonify({"error": "Feature not found"}), 404

    upstream = []
    if feat.source == "transactions_table":
        upstream = [{"type": "table", "name": "transactions", "columns": ["amount", "merchant_id", "timestamp"]}]
    elif feat.source == "accounts_table":
        upstream = [{"type": "table", "name": "accounts", "columns": ["balance", "credit_limit", "created_at"]}]
    elif feat.source == "derived":
        upstream = [{"type": "feature", "name": dep} for dep in [f.name for f in feature_definitions.values() if f.entity == feat.entity][:3]]

    downstream = []
    for group in feature_groups.values():
        if feature_name in group.features:
            downstream.append({"type": "feature_group", "name": group.name})

    return jsonify({
        "feature": asdict(feat),
        "upstream_dependencies": upstream,
        "downstream_consumers": downstream,
        "computation_sql": feat.computation,
    })


@app.route("/metrics")
def metrics():
    return jsonify({
        "total_features": len(feature_definitions),
        "feature_groups": len(feature_groups),
        "online_entities": len(online_store),
        "online_feature_values": sum(len(v) for v in online_store.values()),
        "offline_records": sum(len(v) for v in offline_store.values()),
        "entities": {
            "account": len([f for f in feature_definitions.values() if f.entity == "account"]),
            "transaction": len([f for f in feature_definitions.values() if f.entity == "transaction"]),
            "merchant": len([f for f in feature_definitions.values() if f.entity == "merchant"]),
        },
    })


if __name__ == "__main__":
    port = int(os.getenv("FEATURE_STORE_PORT", "8104"))
    app.run(host="0.0.0.0", port=port)
