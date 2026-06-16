"""
NDSEP Dapr Bindings Service (Python)
Service mesh orchestration using Dapr sidecar pattern.
Handles pub/sub, state management, and service invocation.
Runs on port 8220.
"""
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="[dapr-bindings] %(asctime)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="NDSEP Dapr Bindings", version="1.0.0")

DAPR_HTTP_PORT = os.getenv("DAPR_HTTP_PORT", "3500")
DAPR_GRPC_PORT = os.getenv("DAPR_GRPC_PORT", "50001")
APP_ID = os.getenv("APP_ID", "ndsep-orchestration")

# In-memory state store (Dapr state store would be used in production)
_state: Dict[str, Any] = {}
_pubsub_log: List[Dict] = []

# Dapr component definitions
DAPR_COMPONENTS = [
    {"name": "kafka-pubsub",    "type": "pubsub.kafka",    "version": "v1", "topics": 30},
    {"name": "redis-state",     "type": "state.redis",     "version": "v1", "keys": 0},
    {"name": "redis-lock",      "type": "lock.redis",      "version": "v1"},
    {"name": "s3-binding",      "type": "bindings.aws.s3", "version": "v1"},
    {"name": "postgres-binding","type": "bindings.postgresql","version": "v1"},
    {"name": "cron-binding",    "type": "bindings.cron",   "version": "v1"},
]

class PublishRequest(BaseModel):
    pubsub_name: str = "kafka-pubsub"
    topic: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, str]] = None

class StateRequest(BaseModel):
    store_name: str = "redis-state"
    key: str
    value: Any
    ttl_seconds: Optional[int] = None

class InvokeRequest(BaseModel):
    app_id: str
    method: str
    data: Optional[Dict[str, Any]] = None
    http_verb: str = "POST"

@app.get("/health")
def health():
    return {
        "service": "dapr-bindings",
        "status": "healthy",
        "app_id": APP_ID,
        "dapr_http_port": DAPR_HTTP_PORT,
        "dapr_grpc_port": DAPR_GRPC_PORT,
        "components": len(DAPR_COMPONENTS),
        "state_keys": len(_state),
        "pubsub_events": len(_pubsub_log),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/dapr/publish")
def publish_event(req: PublishRequest):
    event_id = str(uuid.uuid4())
    entry = {
        "id": event_id,
        "pubsub_name": req.pubsub_name,
        "topic": req.topic,
        "data": req.data,
        "metadata": req.metadata or {},
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    _pubsub_log.append(entry)
    logger.info(f"PUBLISH pubsub={req.pubsub_name} topic={req.topic} id={event_id}")
    return {"ok": True, "event_id": event_id, "topic": req.topic}

@app.post("/dapr/state/set")
def set_state(req: StateRequest):
    _state[req.key] = {
        "value": req.value,
        "store": req.store_name,
        "set_at": datetime.now(timezone.utc).isoformat(),
        "ttl_seconds": req.ttl_seconds,
    }
    logger.info(f"STATE_SET key={req.key} store={req.store_name}")
    return {"ok": True, "key": req.key}

@app.get("/dapr/state/{key}")
def get_state(key: str):
    if key not in _state:
        raise HTTPException(status_code=404, detail=f"Key {key!r} not found")
    return {"key": key, **_state[key]}

@app.post("/dapr/invoke")
def invoke_service(req: InvokeRequest):
    logger.info(f"INVOKE app_id={req.app_id} method={req.method}")
    return {
        "ok": True,
        "app_id": req.app_id,
        "method": req.method,
        "status": "invoked",
        "note": f"Dapr sidecar would route to {req.app_id}/{req.method}",
        "invoked_at": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/dapr/components")
def list_components():
    return {"components": DAPR_COMPONENTS, "total": len(DAPR_COMPONENTS)}

@app.get("/dapr/pubsub/log")
def pubsub_log(limit: int = 50):
    return {"events": _pubsub_log[-limit:], "total": len(_pubsub_log)}

# Dapr subscription endpoint (receives events from Dapr runtime)
@app.get("/dapr/subscribe")
def dapr_subscribe():
    return [
        {"pubsubname": "kafka-pubsub", "topic": "ndsep.violation.detected",   "route": "/events/violation"},
        {"pubsubname": "kafka-pubsub", "topic": "ndsep.penalty.issued",        "route": "/events/penalty"},
        {"pubsubname": "kafka-pubsub", "topic": "ndsep.transfer.requested",    "route": "/events/transfer"},
        {"pubsubname": "kafka-pubsub", "topic": "ndsep.incident.created",      "route": "/events/incident"},
        {"pubsubname": "kafka-pubsub", "topic": "ndsep.ml.risk_score_updated", "route": "/events/risk"},
    ]

@app.post("/events/violation")
async def handle_violation(request: Request):
    body = await request.json()
    logger.info(f"EVENT violation: {body}")
    return {"status": "SUCCESS"}

@app.post("/events/penalty")
async def handle_penalty(request: Request):
    body = await request.json()
    logger.info(f"EVENT penalty: {body}")
    return {"status": "SUCCESS"}

@app.post("/events/transfer")
async def handle_transfer(request: Request):
    body = await request.json()
    logger.info(f"EVENT transfer: {body}")
    return {"status": "SUCCESS"}

@app.post("/events/incident")
async def handle_incident(request: Request):
    body = await request.json()
    logger.info(f"EVENT incident: {body}")
    return {"status": "SUCCESS"}

@app.post("/events/risk")
async def handle_risk(request: Request):
    body = await request.json()
    logger.info(f"EVENT risk: {body}")
    return {"status": "SUCCESS"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8220"))
    logger.info(f"NDSEP Dapr Bindings starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
