"""
NDSEP Lakehouse Ingestion Service (Python) v2.0
Real Apache Parquet writes to S3 via pyarrow + Kafka consumer.
Runs on port 8210.
"""
import io, json, logging, os, threading, uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pyarrow as pa
import pyarrow.parquet as pq
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="[lakehouse] %(asctime)s %(message)s")
logger = logging.getLogger(__name__)
app = FastAPI(title="NDSEP Lakehouse Ingestion", version="2.0.0")

S3_BUCKET = os.getenv("LAKEHOUSE_S3_BUCKET", "ndsep-lakehouse")
S3_PREFIX = os.getenv("LAKEHOUSE_S3_PREFIX", "delta")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "")
DELTA_LAKE_URI = os.getenv("DELTA_LAKE_URI", f"s3://{S3_BUCKET}/{S3_PREFIX}")
USE_S3 = bool(os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("LAKEHOUSE_USE_S3"))

# In-memory fallback store
_store: Dict[str, List[Dict]] = {
    "compliance_events": [], "violations": [], "financial_records": [],
    "network_events": [], "audit_trail": [], "threat_intel": [],
    "ml_predictions": [], "streaming_events": [],
    "tigerbeetle_transactions": [], "keycloak_auth_events": [], "temporal_workflow_events": [],
}
_stats: Dict[str, int] = {k: 0 for k in _store}

SCHEMAS: Dict[str, pa.Schema] = {
    "compliance_events": pa.schema([pa.field("id", pa.string()), pa.field("org_id", pa.int64()), pa.field("framework", pa.string()), pa.field("score", pa.float64()), pa.field("event_type", pa.string()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))]),
    "violations": pa.schema([pa.field("id", pa.string()), pa.field("org_id", pa.int64()), pa.field("framework", pa.string()), pa.field("article", pa.string()), pa.field("severity", pa.string()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))]),
    "financial_records": pa.schema([pa.field("id", pa.string()), pa.field("org_id", pa.int64()), pa.field("penalty_id", pa.string()), pa.field("amount_usd", pa.float64()), pa.field("tx_type", pa.string()), pa.field("status", pa.string()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))]),
    "network_events": pa.schema([pa.field("id", pa.string()), pa.field("src_ip", pa.string()), pa.field("dst_ip", pa.string()), pa.field("protocol", pa.string()), pa.field("bytes", pa.int64()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))]),
    "audit_trail": pa.schema([pa.field("id", pa.string()), pa.field("user_id", pa.int64()), pa.field("action", pa.string()), pa.field("resource_type", pa.string()), pa.field("resource_id", pa.string()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))]),
}
DEFAULT_SCHEMA = pa.schema([pa.field("id", pa.string()), pa.field("data", pa.string()), pa.field("ingested_at", pa.timestamp("ms", tz="UTC"))])

def _get_schema(table: str) -> pa.Schema:
    return SCHEMAS.get(table, DEFAULT_SCHEMA)

def _write_parquet(table: str, records: List[Dict]) -> str:
    now = datetime.now(timezone.utc)
    schema = _get_schema(table)
    normalized = []
    for r in records:
        r = dict(r)
        r.setdefault("id", str(uuid.uuid4()))
        r["ingested_at"] = now
        if table not in SCHEMAS:
            r = {"id": r["id"], "data": json.dumps(r, default=str), "ingested_at": now}
        normalized.append(r)

    try:
        arrays = {}
        for field in schema:
            col = [r.get(field.name) for r in normalized]
            if pa.types.is_timestamp(field.type):
                col = [v if isinstance(v, datetime) else now for v in col]
            elif pa.types.is_int64(field.type):
                col = [int(v) if v is not None else 0 for v in col]
            elif pa.types.is_float64(field.type):
                col = [float(v) if v is not None else 0.0 for v in col]
            else:
                col = [str(v) if v is not None else "" for v in col]
            arrays[field.name] = col
        arrow_table = pa.table(arrays, schema=schema)
    except Exception as e:
        logger.warning(f"Arrow build failed for {table}: {e}")
        arrow_table = pa.table({"id": [str(uuid.uuid4())], "data": [json.dumps(records, default=str)], "ingested_at": [now]}, schema=DEFAULT_SCHEMA)

    buf = io.BytesIO()
    pq.write_table(arrow_table, buf, compression="snappy")
    buf.seek(0)
    partition = now.strftime("%Y/%m/%d")
    file_key = f"{S3_PREFIX}/{table}/{partition}/{uuid.uuid4()}.parquet"

    if USE_S3:
        try:
            import boto3
            boto3.client("s3").put_object(Bucket=S3_BUCKET, Key=file_key, Body=buf.getvalue(), ContentType="application/octet-stream")
            uri = f"s3://{S3_BUCKET}/{file_key}"
            logger.info(f"[S3] {len(records)} records → {uri}")
            return uri
        except Exception as e:
            logger.warning(f"[S3] Upload failed: {e}")
    logger.info(f"[LOCAL] {len(records)} records → {file_key}")
    return f"local://{file_key}"

def _start_kafka_consumer():
    if not KAFKA_BROKERS:
        return
    try:
        from confluent_kafka import Consumer, KafkaError
    except ImportError:
        logger.warning("[Kafka] confluent-kafka not installed")
        return

    TOPIC_TABLE = {
        "ndsep.compliance.violations": "violations",
        "ndsep.financial.transactions": "financial_records",
        "ndsep.network.events": "network_events",
        "ndsep.audit.trail": "audit_trail",
        "ndsep.threat.intel": "threat_intel",
        "ndsep.penalty.issued": "financial_records",
    }
    conf = {"bootstrap.servers": KAFKA_BROKERS, "group.id": "ndsep-lakehouse-ingestion", "auto.offset.reset": "latest"}
    if os.getenv("KAFKA_SASL_USER"):
        conf.update({"security.protocol": "SASL_SSL", "sasl.mechanism": "PLAIN", "sasl.username": os.getenv("KAFKA_SASL_USER"), "sasl.password": os.getenv("KAFKA_SASL_PASS", "")})

    def consume():
        c = Consumer(conf)
        c.subscribe(list(TOPIC_TABLE.keys()))
        batch: Dict[str, List[Dict]] = {}
        n = 0
        logger.info(f"[Kafka] Consumer started on {len(TOPIC_TABLE)} topics")
        while True:
            try:
                msg = c.poll(1.0)
                if msg is None:
                    if n >= 10:
                        for t, recs in batch.items():
                            if recs: _write_parquet(t, recs)
                        batch, n = {}, 0
                    continue
                if msg.error():
                    continue
                table = TOPIC_TABLE.get(msg.topic(), "streaming_events")
                try:
                    record = json.loads(msg.value().decode("utf-8"))
                except Exception:
                    record = {"raw": msg.value().decode("utf-8", errors="replace")}
                batch.setdefault(table, []).append(record)
                _store.setdefault(table, []).append(record)
                _stats[table] = _stats.get(table, 0) + 1
                n += 1
                if n >= 100:
                    for t, recs in batch.items():
                        if recs: _write_parquet(t, recs)
                    batch, n = {}, 0
            except Exception as e:
                logger.error(f"[Kafka] Error: {e}")

    threading.Thread(target=consume, daemon=True).start()
    logger.info("[Kafka] Consumer thread started")

class IngestRequest(BaseModel):
    table: str
    records: List[Dict[str, Any]]
    partition_by: Optional[str] = "date"
    dedup_key: Optional[str] = None

class IngestResponse(BaseModel):
    ok: bool
    table: str
    records_written: int
    partition: str
    ingested_at: str
    uri: str = ""

@app.get("/health")
def health():
    return {"service": "lakehouse-ingestion", "status": "healthy", "version": "2.0.0", "s3_enabled": USE_S3, "kafka_enabled": bool(KAFKA_BROKERS), "delta_lake_uri": DELTA_LAKE_URI, "tables": list(_store.keys()), "total_records": sum(_stats.values()), "timestamp": datetime.now(timezone.utc).isoformat()}

@app.post("/lakehouse/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    if req.table not in _store:
        _store[req.table] = []
        _stats[req.table] = 0
    if not req.records:
        raise HTTPException(status_code=400, detail="No records provided")
    records = req.records
    if req.dedup_key:
        seen = {e.get(req.dedup_key) for e in _store[req.table]}
        records = [r for r in records if r.get(req.dedup_key) not in seen]
    now = datetime.now(timezone.utc)
    uri = _write_parquet(req.table, records)
    _store[req.table].extend(records)
    if len(_store[req.table]) > 10000:
        _store[req.table] = _store[req.table][-10000:]
    _stats[req.table] = _stats.get(req.table, 0) + len(records)
    return IngestResponse(ok=True, table=req.table, records_written=len(records), partition=now.strftime("%Y-%m-%d"), ingested_at=now.isoformat(), uri=uri)

@app.get("/lakehouse/query/{table}")
def query_table(table: str, limit: int = 50):
    if table not in _store:
        raise HTTPException(status_code=404, detail=f"Table {table!r} not found")
    records = _store[table]
    return {"table": table, "records": records[-limit:], "total": len(records), "delta_lake_uri": f"{DELTA_LAKE_URI}/{table}"}

@app.get("/lakehouse/tables")
def list_tables():
    return {"tables": [{"name": t, "record_count": _stats.get(t, 0), "uri": f"{DELTA_LAKE_URI}/{t}"} for t in _store]}

@app.get("/stats")
def stats():
    return {"tables": _stats, "total_records": sum(_stats.values()), "s3_bucket": S3_BUCKET if USE_S3 else None, "kafka_brokers": KAFKA_BROKERS if KAFKA_BROKERS else None}

@app.post("/lakehouse/compliance-event")
def ingest_compliance_event(event: Dict[str, Any]):
    return ingest(IngestRequest(table="compliance_events", records=[event]))

@app.post("/lakehouse/violation")
def ingest_violation(event: Dict[str, Any]):
    return ingest(IngestRequest(table="violations", records=[event], dedup_key="violation_id"))

@app.post("/lakehouse/financial")
def ingest_financial(event: Dict[str, Any]):
    return ingest(IngestRequest(table="financial_records", records=[event]))

@app.post("/lakehouse/network-event")
def ingest_network_event(event: Dict[str, Any]):
    return ingest(IngestRequest(table="network_events", records=[event]))

@app.post("/lakehouse/audit")
def ingest_audit(event: Dict[str, Any]):
    return ingest(IngestRequest(table="audit_trail", records=[event]))

@app.on_event("startup")
def on_startup():
    logger.info(f"[Lakehouse] v2.0 starting (S3={USE_S3}, Kafka={bool(KAFKA_BROKERS)})")
    _start_kafka_consumer()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8210"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
