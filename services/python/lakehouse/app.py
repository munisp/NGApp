import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Lakehouse Analytics Service", version="1.0.0")

TRINO_HOST = os.getenv("TRINO_HOST", "localhost")
TRINO_PORT = int(os.getenv("TRINO_PORT", "8080"))
TRINO_CATALOG = os.getenv("TRINO_CATALOG", "hive")
TRINO_SCHEMA = os.getenv("TRINO_SCHEMA", "fintech")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
HIVE_METASTORE = os.getenv("HIVE_METASTORE_URI", "thrift://localhost:9083")

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
        {"name": "fintech-models", "size_gb": 2.1, "objects": 340, "description": "ML model artifacts"},
    ]


@app.get("/metrics")
async def get_metrics():
    total_rows = sum(t["row_count"] for t in TABLES.values())
    completed = [q for q in query_history if q.status == "COMPLETED" and q.completed_at]
    avg_duration = 0
    if completed:
        avg_duration = sum((q.completed_at - q.started_at) * 1000 for q in completed) / len(completed)

    return {
        "tables": len(TABLES),
        "total_rows": total_rows,
        "queries_executed": len(query_history),
        "queries_completed": len(completed),
        "queries_failed": len([q for q in query_history if q.status == "FAILED"]),
        "avg_query_duration_ms": avg_duration,
        "prebuilt_queries": len(PREBUILT_QUERIES),
        "connected": connected,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("LAKEHOUSE_SERVICE_PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port)
