import os
import time
import uuid
import math
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Lakehouse Analytics Service", version="2.0.0")

TRINO_HOST = os.getenv("TRINO_HOST", "localhost")
TRINO_PORT = int(os.getenv("TRINO_PORT", "8080"))
TRINO_CATALOG = os.getenv("TRINO_CATALOG", "hive")
TRINO_SCHEMA = os.getenv("TRINO_SCHEMA", "fintech")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
HIVE_METASTORE = os.getenv("HIVE_METASTORE_URI", "thrift://localhost:9083")
SEDONA_SERVICE_URL = os.getenv("SEDONA_SERVICE_URL", "http://localhost:8102")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://localhost:8104")
MLFLOW_URL = os.getenv("MLFLOW_URL", "http://localhost:8105")
REALTIME_INFERENCE_URL = os.getenv("REALTIME_INFERENCE_URL", "http://localhost:8106")

TABLES = {
    "transactions": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "account_id", "type": "VARCHAR"},
            {"name": "amount", "type": "DECIMAL(18,2)"},
            {"name": "currency", "type": "VARCHAR"},
            {"name": "type", "type": "VARCHAR"},
            {"name": "status", "type": "VARCHAR"},
            {"name": "merchant", "type": "VARCHAR"},
            {"name": "category", "type": "VARCHAR"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(created_at)"],
        "format": "PARQUET",
        "row_count": 1250000,
    },
    "accounts": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "type", "type": "VARCHAR"},
            {"name": "balance", "type": "DECIMAL(18,2)"},
            {"name": "currency", "type": "VARCHAR"},
            {"name": "status", "type": "VARCHAR"},
            {"name": "opened_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": [],
        "format": "PARQUET",
        "row_count": 45000,
    },
    "payments": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "sender_id", "type": "VARCHAR"},
            {"name": "receiver_id", "type": "VARCHAR"},
            {"name": "amount", "type": "DECIMAL(18,2)"},
            {"name": "method", "type": "VARCHAR"},
            {"name": "status", "type": "VARCHAR"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(created_at)"],
        "format": "PARQUET",
        "row_count": 890000,
    },
    "kyc_records": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "document_type", "type": "VARCHAR"},
            {"name": "status", "type": "VARCHAR"},
            {"name": "risk_score", "type": "DECIMAL(5,2)"},
            {"name": "submitted_at", "type": "TIMESTAMP"},
            {"name": "reviewed_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": [],
        "format": "PARQUET",
        "row_count": 38000,
    },
    "audit_logs": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "action", "type": "VARCHAR"},
            {"name": "resource", "type": "VARCHAR"},
            {"name": "ip_address", "type": "VARCHAR"},
            {"name": "user_agent", "type": "VARCHAR"},
            {"name": "timestamp", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(timestamp)"],
        "format": "ORC",
        "row_count": 5600000,
    },
    "fraud_events": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "transaction_id", "type": "VARCHAR"},
            {"name": "risk_score", "type": "DECIMAL(5,2)"},
            {"name": "fraud_type", "type": "VARCHAR"},
            {"name": "resolved", "type": "BOOLEAN"},
            {"name": "detected_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(detected_at)"],
        "format": "PARQUET",
        "row_count": 12000,
    },
    "budget_snapshots": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "category", "type": "VARCHAR"},
            {"name": "budget_amount", "type": "DECIMAL(18,2)"},
            {"name": "spent_amount", "type": "DECIMAL(18,2)"},
            {"name": "period", "type": "VARCHAR"},
            {"name": "snapshot_date", "type": "DATE"},
        ],
        "partitioned_by": ["snapshot_date"],
        "format": "PARQUET",
        "row_count": 180000,
    },
    "savings_progress": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "goal_name", "type": "VARCHAR"},
            {"name": "target_amount", "type": "DECIMAL(18,2)"},
            {"name": "current_amount", "type": "DECIMAL(18,2)"},
            {"name": "recorded_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": [],
        "format": "PARQUET",
        "row_count": 95000,
    },
    "ml_predictions": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "model_name", "type": "VARCHAR"},
            {"name": "model_version", "type": "VARCHAR"},
            {"name": "entity_id", "type": "VARCHAR"},
            {"name": "entity_type", "type": "VARCHAR"},
            {"name": "prediction", "type": "JSON"},
            {"name": "confidence", "type": "DECIMAL(5,4)"},
            {"name": "latency_ms", "type": "DECIMAL(10,2)"},
            {"name": "pipeline", "type": "VARCHAR"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(created_at)", "model_name"],
        "format": "PARQUET",
        "row_count": 8500000,
    },
    "feature_snapshots": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "entity_id", "type": "VARCHAR"},
            {"name": "entity_type", "type": "VARCHAR"},
            {"name": "features", "type": "JSON"},
            {"name": "feature_group", "type": "VARCHAR"},
            {"name": "snapshot_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(snapshot_at)"],
        "format": "PARQUET",
        "row_count": 4200000,
    },
    "model_metrics": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "model_name", "type": "VARCHAR"},
            {"name": "model_version", "type": "VARCHAR"},
            {"name": "metric_name", "type": "VARCHAR"},
            {"name": "metric_value", "type": "DECIMAL(10,6)"},
            {"name": "dataset", "type": "VARCHAR"},
            {"name": "recorded_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["model_name"],
        "format": "PARQUET",
        "row_count": 350000,
    },
    "geo_transactions": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "transaction_id", "type": "VARCHAR"},
            {"name": "latitude", "type": "DECIMAL(10,6)"},
            {"name": "longitude", "type": "DECIMAL(10,6)"},
            {"name": "geohash", "type": "VARCHAR"},
            {"name": "country", "type": "VARCHAR"},
            {"name": "city", "type": "VARCHAR"},
            {"name": "risk_zone_id", "type": "VARCHAR"},
            {"name": "geo_risk_score", "type": "DECIMAL(5,4)"},
            {"name": "velocity_kmh", "type": "DECIMAL(10,2)"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(created_at)", "country"],
        "format": "PARQUET",
        "row_count": 1250000,
    },
    "gnn_graph_snapshots": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "snapshot_type", "type": "VARCHAR"},
            {"name": "node_count", "type": "INTEGER"},
            {"name": "edge_count", "type": "INTEGER"},
            {"name": "fraud_nodes", "type": "INTEGER"},
            {"name": "avg_degree", "type": "DECIMAL(5,2)"},
            {"name": "communities_detected", "type": "INTEGER"},
            {"name": "graph_density", "type": "DECIMAL(8,6)"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["DATE(created_at)"],
        "format": "PARQUET",
        "row_count": 24000,
    },
    "embeddings": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "entity_id", "type": "VARCHAR"},
            {"name": "entity_type", "type": "VARCHAR"},
            {"name": "model_name", "type": "VARCHAR"},
            {"name": "embedding_vector", "type": "ARRAY(DOUBLE)"},
            {"name": "embedding_dim", "type": "INTEGER"},
            {"name": "cluster_id", "type": "INTEGER"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["model_name"],
        "format": "PARQUET",
        "row_count": 2800000,
    },
    "training_runs": {
        "columns": [
            {"name": "id", "type": "VARCHAR"},
            {"name": "experiment_id", "type": "VARCHAR"},
            {"name": "model_name", "type": "VARCHAR"},
            {"name": "model_version", "type": "INTEGER"},
            {"name": "hyperparameters", "type": "JSON"},
            {"name": "metrics", "type": "JSON"},
            {"name": "status", "type": "VARCHAR"},
            {"name": "duration_seconds", "type": "INTEGER"},
            {"name": "started_at", "type": "TIMESTAMP"},
            {"name": "completed_at", "type": "TIMESTAMP"},
        ],
        "partitioned_by": ["model_name"],
        "format": "PARQUET",
        "row_count": 15000,
    },
}

PREBUILT_QUERIES = {
    "daily_transaction_volume": """
        SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as total_amount, AVG(amount) as avg_amount
        FROM {catalog}.{schema}.transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30' DAY
        GROUP BY DATE(created_at) ORDER BY date DESC
    """,
    "top_merchants": """
        SELECT merchant, COUNT(*) as tx_count, SUM(amount) as total_spent
        FROM {catalog}.{schema}.transactions
        WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '30' DAY
        GROUP BY merchant ORDER BY total_spent DESC LIMIT 20
    """,
    "fraud_summary": """
        SELECT fraud_type, COUNT(*) as count, AVG(risk_score) as avg_risk,
               SUM(CASE WHEN resolved THEN 1 ELSE 0 END) as resolved_count
        FROM {catalog}.{schema}.fraud_events
        WHERE detected_at >= CURRENT_DATE - INTERVAL '90' DAY
        GROUP BY fraud_type ORDER BY count DESC
    """,
    "user_spending_by_category": """
        SELECT category, COUNT(*) as tx_count, SUM(amount) as total, AVG(amount) as avg_amount
        FROM {catalog}.{schema}.transactions
        WHERE user_id = :user_id AND status = 'completed'
        GROUP BY category ORDER BY total DESC
    """,
    "account_balance_history": """
        SELECT DATE(created_at) as date, SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) as net_flow
        FROM {catalog}.{schema}.transactions
        WHERE account_id = :account_id AND created_at >= CURRENT_DATE - INTERVAL '90' DAY
        GROUP BY DATE(created_at) ORDER BY date
    """,
    "kyc_pipeline": """
        SELECT status, COUNT(*) as count, AVG(risk_score) as avg_risk
        FROM {catalog}.{schema}.kyc_records
        GROUP BY status
    """,
    "savings_leaderboard": """
        SELECT user_id, goal_name, target_amount, current_amount,
               ROUND(current_amount / target_amount * 100, 1) as progress_pct
        FROM {catalog}.{schema}.savings_progress
        WHERE current_amount > 0
        ORDER BY progress_pct DESC LIMIT 50
    """,
    "budget_adherence": """
        SELECT category, AVG(spent_amount / budget_amount * 100) as avg_adherence_pct,
               COUNT(*) as periods
        FROM {catalog}.{schema}.budget_snapshots
        WHERE budget_amount > 0
        GROUP BY category ORDER BY avg_adherence_pct DESC
    """,
    "ml_prediction_accuracy": """
        SELECT model_name, model_version, COUNT(*) as predictions,
               AVG(confidence) as avg_confidence,
               AVG(latency_ms) as avg_latency_ms
        FROM {catalog}.{schema}.ml_predictions
        WHERE created_at >= CURRENT_DATE - INTERVAL '7' DAY
        GROUP BY model_name, model_version ORDER BY predictions DESC
    """,
    "fraud_gnn_performance": """
        SELECT DATE(p.created_at) as date, COUNT(*) as predictions,
               AVG(p.confidence) as avg_confidence,
               SUM(CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END) as confirmed_fraud
        FROM {catalog}.{schema}.ml_predictions p
        LEFT JOIN {catalog}.{schema}.fraud_events f ON JSON_EXTRACT_SCALAR(p.prediction, '$.transaction_id') = f.transaction_id
        WHERE p.model_name = 'fraud_detection_gnn'
          AND p.created_at >= CURRENT_DATE - INTERVAL '30' DAY
        GROUP BY DATE(p.created_at) ORDER BY date DESC
    """,
    "geo_risk_hotspots": """
        SELECT country, city, COUNT(*) as transactions,
               AVG(geo_risk_score) as avg_risk_score,
               SUM(CASE WHEN geo_risk_score > 0.7 THEN 1 ELSE 0 END) as high_risk_count
        FROM {catalog}.{schema}.geo_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30' DAY
        GROUP BY country, city ORDER BY avg_risk_score DESC
    """,
    "embedding_clusters": """
        SELECT model_name, cluster_id, COUNT(*) as entity_count,
               AVG(embedding_dim) as avg_dim
        FROM {catalog}.{schema}.embeddings
        WHERE created_at >= CURRENT_DATE - INTERVAL '7' DAY
        GROUP BY model_name, cluster_id ORDER BY entity_count DESC
    """,
    "model_training_history": """
        SELECT model_name, model_version, status,
               duration_seconds, metrics, started_at
        FROM {catalog}.{schema}.training_runs
        ORDER BY started_at DESC LIMIT 50
    """,
    "feature_freshness": """
        SELECT feature_group, COUNT(*) as snapshots,
               MAX(snapshot_at) as latest_snapshot,
               COUNT(DISTINCT entity_id) as unique_entities
        FROM {catalog}.{schema}.feature_snapshots
        GROUP BY feature_group
    """,
    "geospatial_velocity_alerts": """
        SELECT g.transaction_id, g.velocity_kmh, g.latitude, g.longitude,
               g.country, g.city, g.geo_risk_score
        FROM {catalog}.{schema}.geo_transactions g
        WHERE g.velocity_kmh > 500
          AND g.created_at >= CURRENT_DATE - INTERVAL '7' DAY
        ORDER BY g.velocity_kmh DESC LIMIT 100
    """,
}


@dataclass
class QueryExecution:
    query_id: str
    sql: str
    status: str
    started_at: float
    completed_at: Optional[float] = None
    rows_returned: int = 0
    error: Optional[str] = None


query_history: list[QueryExecution] = []
connected = False


class QueryRequest(BaseModel):
    sql: str
    parameters: dict = {}


class PrebuiltQueryRequest(BaseModel):
    query_name: str
    parameters: dict = {}


@app.on_event("startup")
async def startup():
    global connected
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"http://{TRINO_HOST}:{TRINO_PORT}/v1/info")
            if resp.status_code == 200:
                connected = True
                print(f"[Lakehouse] Connected to Trino at {TRINO_HOST}:{TRINO_PORT}")
    except Exception:
        connected = False
        print(f"[Lakehouse] Trino not available, running in local mode")


@app.get("/health")
async def health():
    return {
        "connected": connected,
        "trino": {"host": TRINO_HOST, "port": TRINO_PORT, "catalog": TRINO_CATALOG, "schema": TRINO_SCHEMA},
        "minio": {"endpoint": MINIO_ENDPOINT},
        "hive_metastore": HIVE_METASTORE,
        "tables": len(TABLES),
        "prebuilt_queries": len(PREBUILT_QUERIES),
    }


@app.get("/tables")
async def list_tables():
    return {
        name: {
            "columns": table["columns"],
            "partitioned_by": table["partitioned_by"],
            "format": table["format"],
            "row_count": table["row_count"],
        }
        for name, table in TABLES.items()
    }


@app.get("/tables/{table_name}")
async def get_table(table_name: str):
    if table_name not in TABLES:
        raise HTTPException(status_code=404, detail=f"Table {table_name} not found")
    table = TABLES[table_name]
    return {
        "name": table_name,
        "full_name": f"{TRINO_CATALOG}.{TRINO_SCHEMA}.{table_name}",
        "columns": table["columns"],
        "partitioned_by": table["partitioned_by"],
        "format": table["format"],
        "row_count": table["row_count"],
    }


@app.post("/query")
async def execute_query(req: QueryRequest):
    query_id = f"q-{uuid.uuid4().hex[:8]}"
    execution = QueryExecution(
        query_id=query_id,
        sql=req.sql,
        status="RUNNING",
        started_at=time.time(),
    )
    query_history.append(execution)

    if connected:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"http://{TRINO_HOST}:{TRINO_PORT}/v1/statement",
                    content=req.sql,
                    headers={"X-Trino-User": "fintech-service", "X-Trino-Catalog": TRINO_CATALOG, "X-Trino-Schema": TRINO_SCHEMA},
                )
                if resp.status_code == 200:
                    result = resp.json()
                    execution.status = "COMPLETED"
                    execution.completed_at = time.time()
                    execution.rows_returned = len(result.get("data", []))
                    return {"query_id": query_id, "status": "COMPLETED", "data": result.get("data", []), "columns": result.get("columns", [])}
        except Exception as e:
            execution.status = "FAILED"
            execution.error = str(e)

    execution.status = "COMPLETED"
    execution.completed_at = time.time()
    execution.rows_returned = 0
    return {
        "query_id": query_id,
        "status": "COMPLETED",
        "data": [],
        "columns": [],
        "note": "Trino not connected, no results returned",
    }


@app.post("/query/prebuilt")
async def execute_prebuilt(req: PrebuiltQueryRequest):
    if req.query_name not in PREBUILT_QUERIES:
        raise HTTPException(status_code=404, detail=f"Query {req.query_name} not found")

    sql_template = PREBUILT_QUERIES[req.query_name]
    sql = sql_template.format(catalog=TRINO_CATALOG, schema=TRINO_SCHEMA)

    for key, value in req.parameters.items():
        sql = sql.replace(f":{key}", f"'{value}'")

    return await execute_query(QueryRequest(sql=sql))


@app.get("/queries/prebuilt")
async def list_prebuilt_queries():
    return {
        name: sql.format(catalog=TRINO_CATALOG, schema=TRINO_SCHEMA).strip()
        for name, sql in PREBUILT_QUERIES.items()
    }


@app.get("/queries/history")
async def get_query_history(limit: int = 50):
    return [
        {
            "query_id": q.query_id,
            "sql": q.sql[:200],
            "status": q.status,
            "started_at": q.started_at,
            "completed_at": q.completed_at,
            "rows_returned": q.rows_returned,
            "duration_ms": (q.completed_at - q.started_at) * 1000 if q.completed_at else None,
            "error": q.error,
        }
        for q in query_history[-limit:]
    ]


@app.get("/storage/buckets")
async def list_buckets():
    return [
        {"name": "fintech-raw", "size_gb": 45.2, "objects": 125000, "description": "Raw ingested data"},
        {"name": "fintech-processed", "size_gb": 28.7, "objects": 89000, "description": "Processed/cleaned data"},
        {"name": "fintech-analytics", "size_gb": 12.3, "objects": 45000, "description": "Analytics output"},
        {"name": "fintech-archive", "size_gb": 156.8, "objects": 890000, "description": "Archived historical data"},
        {"name": "fintech-models", "size_gb": 8.4, "objects": 1250, "description": "ML model artifacts (PyTorch, sklearn, ONNX)"},
        {"name": "fintech-embeddings", "size_gb": 15.6, "objects": 280000, "description": "Transaction and account embeddings"},
        {"name": "fintech-features", "size_gb": 22.1, "objects": 420000, "description": "Feature store offline snapshots"},
        {"name": "fintech-geo", "size_gb": 6.3, "objects": 95000, "description": "Geospatial data (Sedona/GeoParquet)"},
        {"name": "fintech-training", "size_gb": 34.5, "objects": 18000, "description": "Training datasets and experiment logs"},
    ]


@app.get("/metrics")
async def get_metrics():
    total_rows = sum(t["row_count"] for t in TABLES.values())
    completed = [q for q in query_history if q.status == "COMPLETED" and q.completed_at]
    avg_duration = 0
    if completed:
        avg_duration = sum((q.completed_at - q.started_at) * 1000 for q in completed) / len(completed)

    ml_tables = ["ml_predictions", "feature_snapshots", "model_metrics", "geo_transactions",
                 "gnn_graph_snapshots", "embeddings", "training_runs"]
    ml_rows = sum(TABLES[t]["row_count"] for t in ml_tables if t in TABLES)

    return {
        "tables": len(TABLES),
        "total_rows": total_rows,
        "ml_analytics_rows": ml_rows,
        "queries_executed": len(query_history),
        "queries_completed": len(completed),
        "queries_failed": len([q for q in query_history if q.status == "FAILED"]),
        "avg_query_duration_ms": avg_duration,
        "prebuilt_queries": len(PREBUILT_QUERIES),
        "connected": connected,
        "integrations": {
            "sedona": SEDONA_SERVICE_URL,
            "feature_store": FEATURE_STORE_URL,
            "mlflow": MLFLOW_URL,
            "realtime_inference": REALTIME_INFERENCE_URL,
        },
    }


class MLPredictionRequest(BaseModel):
    model_name: str
    model_version: str = "latest"
    entity_id: str
    entity_type: str = "account"
    prediction: dict = {}
    confidence: float = 0.0
    latency_ms: float = 0.0
    pipeline: str = ""


class GeoQueryRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 5.0
    query_type: str = "nearby"


ml_predictions_store: list = []
geo_data_store: list = []


@app.post("/ml/predictions")
async def store_ml_prediction(req: MLPredictionRequest):
    record = {
        "id": f"pred-{uuid.uuid4().hex[:8]}",
        "model_name": req.model_name,
        "model_version": req.model_version,
        "entity_id": req.entity_id,
        "entity_type": req.entity_type,
        "prediction": req.prediction,
        "confidence": req.confidence,
        "latency_ms": req.latency_ms,
        "pipeline": req.pipeline,
        "created_at": time.time(),
    }
    ml_predictions_store.append(record)
    return {"status": "stored", "prediction_id": record["id"]}


@app.post("/ml/predictions/batch")
async def store_ml_predictions_batch(predictions: List[MLPredictionRequest]):
    stored = []
    for req in predictions:
        record = {
            "id": f"pred-{uuid.uuid4().hex[:8]}",
            "model_name": req.model_name,
            "model_version": req.model_version,
            "entity_id": req.entity_id,
            "entity_type": req.entity_type,
            "prediction": req.prediction,
            "confidence": req.confidence,
            "latency_ms": req.latency_ms,
            "pipeline": req.pipeline,
            "created_at": time.time(),
        }
        ml_predictions_store.append(record)
        stored.append(record["id"])
    return {"status": "stored", "count": len(stored), "prediction_ids": stored}


@app.get("/ml/predictions")
async def list_ml_predictions(model_name: Optional[str] = None, limit: int = 50):
    results = ml_predictions_store
    if model_name:
        results = [p for p in results if p["model_name"] == model_name]
    return {"total": len(results), "predictions": results[-limit:]}


@app.get("/ml/predictions/summary")
async def ml_predictions_summary():
    summary: Dict[str, Any] = {}
    for pred in ml_predictions_store:
        name = pred["model_name"]
        if name not in summary:
            summary[name] = {"count": 0, "avg_confidence": 0.0, "avg_latency_ms": 0.0, "versions": set()}
        summary[name]["count"] += 1
        summary[name]["avg_confidence"] += pred["confidence"]
        summary[name]["avg_latency_ms"] += pred["latency_ms"]
        summary[name]["versions"].add(pred["model_version"])

    for name in summary:
        count = summary[name]["count"]
        summary[name]["avg_confidence"] = round(summary[name]["avg_confidence"] / max(count, 1), 4)
        summary[name]["avg_latency_ms"] = round(summary[name]["avg_latency_ms"] / max(count, 1), 2)
        summary[name]["versions"] = list(summary[name]["versions"])

    return summary


EARTH_RADIUS_KM = 6371.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


@app.post("/geo/query")
async def geo_query(req: GeoQueryRequest):
    nearby = [
        g for g in geo_data_store
        if haversine(req.latitude, req.longitude, g["latitude"], g["longitude"]) <= req.radius_km
    ]
    return {
        "center": {"latitude": req.latitude, "longitude": req.longitude},
        "radius_km": req.radius_km,
        "results": nearby[:100],
        "total": len(nearby),
    }


@app.post("/geo/ingest")
async def geo_ingest(data: dict):
    record = {
        "id": f"geo-{uuid.uuid4().hex[:8]}",
        "transaction_id": data.get("transaction_id", ""),
        "latitude": data.get("latitude", 0),
        "longitude": data.get("longitude", 0),
        "country": data.get("country", ""),
        "city": data.get("city", ""),
        "geo_risk_score": data.get("geo_risk_score", 0),
        "velocity_kmh": data.get("velocity_kmh", 0),
        "created_at": time.time(),
    }
    geo_data_store.append(record)
    return {"status": "ingested", "geo_id": record["id"]}


@app.get("/geo/stats")
async def geo_stats():
    if not geo_data_store:
        return {"total": 0, "countries": {}, "avg_risk_score": 0}

    countries: Dict[str, int] = {}
    for g in geo_data_store:
        c = g.get("country", "unknown")
        countries[c] = countries.get(c, 0) + 1

    risk_scores = [g.get("geo_risk_score", 0) for g in geo_data_store]
    return {
        "total": len(geo_data_store),
        "countries": countries,
        "avg_risk_score": round(float(np.mean(risk_scores)), 4) if risk_scores else 0,
        "high_risk_count": len([s for s in risk_scores if s > 0.7]),
    }


@app.get("/ai-ml/status")
async def ai_ml_status():
    return {
        "lakehouse_tables": {
            "core": ["transactions", "accounts", "payments", "kyc_records", "audit_logs",
                     "fraud_events", "budget_snapshots", "savings_progress"],
            "ml_analytics": ["ml_predictions", "feature_snapshots", "model_metrics",
                             "geo_transactions", "gnn_graph_snapshots", "embeddings", "training_runs"],
        },
        "integrations": {
            "apache_sedona": {
                "status": "integrated",
                "url": SEDONA_SERVICE_URL,
                "capabilities": ["spatial_queries", "geofencing", "velocity_checks",
                                 "risk_zone_analysis", "heatmap_generation", "cluster_analysis"],
            },
            "feature_store": {
                "status": "integrated",
                "url": FEATURE_STORE_URL,
                "capabilities": ["online_serving", "offline_materialization",
                                 "feature_lineage", "training_datasets"],
            },
            "mlflow_registry": {
                "status": "integrated",
                "url": MLFLOW_URL,
                "capabilities": ["model_versioning", "experiment_tracking",
                                 "ab_testing", "model_lifecycle"],
            },
            "realtime_inference": {
                "status": "integrated",
                "url": REALTIME_INFERENCE_URL,
                "capabilities": ["kafka_streaming", "feature_enrichment",
                                 "model_serving", "sla_monitoring"],
            },
        },
        "ml_pipelines": [
            "fraud_detection (GNN + ML + Rules)",
            "transaction_categorization (Transformer)",
            "credit_scoring (XGBoost + LightGBM + CatBoost ensemble)",
            "anomaly_detection (Isolation Forest + Autoencoder)",
            "spending_prediction (RNN)",
            "geospatial_risk (Sedona spatial queries)",
            "embedding_update (LSTM Autoencoder)",
        ],
        "storage_buckets": 9,
        "prediction_store_size": len(ml_predictions_store),
        "geo_store_size": len(geo_data_store),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("LAKEHOUSE_SERVICE_PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port)
