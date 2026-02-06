import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Dapr Service Integration", version="1.0.0")

DAPR_HTTP_PORT = int(os.getenv("DAPR_HTTP_PORT", "3500"))
DAPR_GRPC_PORT = int(os.getenv("DAPR_GRPC_PORT", "50001"))
DAPR_APP_ID = os.getenv("DAPR_APP_ID", "fintech-app")

STATE_STORES = {
    "statestore": {"type": "state.redis", "version": "v1"},
    "user-preferences": {"type": "state.redis", "version": "v1"},
    "session-store": {"type": "state.redis", "version": "v1"},
}

PUBSUB_COMPONENTS = {
    "pubsub-kafka": {"type": "pubsub.kafka", "version": "v1"},
    "pubsub-redis": {"type": "pubsub.redis", "version": "v1"},
}

BINDING_COMPONENTS = {
    "email-binding": {"type": "bindings.smtp", "version": "v1"},
    "sms-binding": {"type": "bindings.twilio.sms", "version": "v1"},
    "cron-binding": {"type": "bindings.cron", "version": "v1"},
    "storage-binding": {"type": "bindings.aws.s3", "version": "v1"},
}

SECRET_STORES = {
    "secret-store": {"type": "secretstores.kubernetes", "version": "v1"},
}

SERVICE_REGISTRY = {
    "backend-api": {"app_id": "backend-api", "port": 3000, "protocol": "http"},
    "kafka-service": {"app_id": "kafka-service", "port": 8081, "protocol": "http"},
    "redis-service": {"app_id": "redis-service", "port": 8082, "protocol": "http"},
    "temporal-service": {"app_id": "temporal-service", "port": 8085, "protocol": "http"},
    "tigerbeetle-service": {"app_id": "tigerbeetle-service", "port": 8083, "protocol": "http"},
    "permify-service": {"app_id": "permify-service", "port": 8089, "protocol": "http"},
    "lakehouse-service": {"app_id": "lakehouse-service", "port": 8090, "protocol": "http"},
    "keycloak-service": {"app_id": "keycloak-service", "port": 8091, "protocol": "http"},
}


@dataclass
class StateEntry:
    key: str
    value: dict
    etag: str
    metadata: dict = field(default_factory=dict)
    ttl: Optional[int] = None
    created_at: float = field(default_factory=time.time)


@dataclass
class PubSubMessage:
    topic: str
    data: dict
    pubsub_name: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    timestamp: float = field(default_factory=time.time)


state_data: dict[str, dict[str, StateEntry]] = {store: {} for store in STATE_STORES}
pubsub_messages: dict[str, list[PubSubMessage]] = {}
pubsub_subscriptions: dict[str, list[str]] = {}
invocation_log: list[dict] = []
connected = False


class StateSetRequest(BaseModel):
    store_name: str
    key: str
    value: dict
    metadata: dict = {}
    ttl: Optional[int] = None


class StateGetRequest(BaseModel):
    store_name: str
    key: str


class PublishRequest(BaseModel):
    pubsub_name: str
    topic: str
    data: dict
    metadata: dict = {}


class InvokeRequest(BaseModel):
    app_id: str
    method: str
    http_verb: str = "POST"
    data: dict = {}


class BindingRequest(BaseModel):
    binding_name: str
    operation: str
    data: dict = {}
    metadata: dict = {}


@app.on_event("startup")
async def startup():
    global connected
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"http://localhost:{DAPR_HTTP_PORT}/v1.0/healthz")
            if resp.status_code == 200:
                connected = True
                print(f"[Dapr] Connected to sidecar on port {DAPR_HTTP_PORT}")
    except Exception:
        connected = False
        print(f"[Dapr] Sidecar not available, running in local mode")


@app.get("/health")
async def health():
    return {
        "connected": connected,
        "app_id": DAPR_APP_ID,
        "http_port": DAPR_HTTP_PORT,
        "grpc_port": DAPR_GRPC_PORT,
        "state_stores": len(STATE_STORES),
        "pubsub_components": len(PUBSUB_COMPONENTS),
        "bindings": len(BINDING_COMPONENTS),
        "registered_services": len(SERVICE_REGISTRY),
    }


@app.post("/state/set")
async def state_set(req: StateSetRequest):
    if req.store_name not in STATE_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown state store: {req.store_name}")

    etag = uuid.uuid4().hex[:8]
    state_data[req.store_name][req.key] = StateEntry(
        key=req.key,
        value=req.value,
        etag=etag,
        metadata=req.metadata,
        ttl=req.ttl,
    )
    return {"status": "ok", "etag": etag}


@app.get("/state/get/{store_name}/{key}")
async def state_get(store_name: str, key: str):
    if store_name not in STATE_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown state store: {store_name}")

    entry = state_data[store_name].get(key)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Key {key} not found in {store_name}")

    if entry.ttl and (time.time() - entry.created_at) > entry.ttl:
        del state_data[store_name][key]
        raise HTTPException(status_code=404, detail=f"Key {key} expired")

    return {"key": entry.key, "value": entry.value, "etag": entry.etag}


@app.delete("/state/delete/{store_name}/{key}")
async def state_delete(store_name: str, key: str):
    if store_name not in STATE_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown state store: {store_name}")
    if key in state_data[store_name]:
        del state_data[store_name][key]
    return {"status": "deleted"}


@app.post("/state/transaction")
async def state_transaction(store_name: str, operations: list[dict]):
    if store_name not in STATE_STORES:
        raise HTTPException(status_code=400, detail=f"Unknown state store: {store_name}")

    for op in operations:
        op_type = op.get("operation")
        key = op.get("request", {}).get("key")
        value = op.get("request", {}).get("value")

        if op_type == "upsert" and key:
            etag = uuid.uuid4().hex[:8]
            state_data[store_name][key] = StateEntry(key=key, value=value or {}, etag=etag)
        elif op_type == "delete" and key:
            state_data[store_name].pop(key, None)

    return {"status": "ok", "operations": len(operations)}


@app.post("/pubsub/publish")
async def publish(req: PublishRequest):
    if req.pubsub_name not in PUBSUB_COMPONENTS:
        raise HTTPException(status_code=400, detail=f"Unknown pubsub: {req.pubsub_name}")

    msg = PubSubMessage(topic=req.topic, data=req.data, pubsub_name=req.pubsub_name)
    if req.topic not in pubsub_messages:
        pubsub_messages[req.topic] = []
    pubsub_messages[req.topic].append(msg)

    if len(pubsub_messages[req.topic]) > 10000:
        pubsub_messages[req.topic] = pubsub_messages[req.topic][-5000:]

    return {"status": "published", "id": msg.id}


@app.post("/pubsub/subscribe")
async def subscribe(pubsub_name: str, topic: str):
    key = f"{pubsub_name}:{topic}"
    if key not in pubsub_subscriptions:
        pubsub_subscriptions[key] = []
    pubsub_subscriptions[key].append(DAPR_APP_ID)
    return {"status": "subscribed"}


@app.get("/pubsub/messages/{topic}")
async def get_messages(topic: str, limit: int = 50):
    messages = pubsub_messages.get(topic, [])
    return [
        {"id": m.id, "data": m.data, "timestamp": m.timestamp, "pubsub": m.pubsub_name}
        for m in messages[-limit:]
    ]


@app.post("/invoke")
async def invoke_service(req: InvokeRequest):
    if req.app_id not in SERVICE_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Service {req.app_id} not registered")

    service = SERVICE_REGISTRY[req.app_id]
    invocation = {
        "id": uuid.uuid4().hex[:12],
        "app_id": req.app_id,
        "method": req.method,
        "http_verb": req.http_verb,
        "timestamp": time.time(),
        "target_port": service["port"],
    }
    invocation_log.append(invocation)

    if len(invocation_log) > 10000:
        invocation_log.pop(0)

    if connected:
        try:
            import httpx
            url = f"http://localhost:{DAPR_HTTP_PORT}/v1.0/invoke/{req.app_id}/method/{req.method}"
            async with httpx.AsyncClient(timeout=10) as client:
                if req.http_verb == "GET":
                    resp = await client.get(url)
                else:
                    resp = await client.post(url, json=req.data)
                return {"status_code": resp.status_code, "data": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text}
        except Exception as e:
            return {"status": "invoked_locally", "invocation_id": invocation["id"], "note": str(e)}

    return {"status": "invoked_locally", "invocation_id": invocation["id"]}


@app.post("/bindings/invoke")
async def invoke_binding(req: BindingRequest):
    if req.binding_name not in BINDING_COMPONENTS:
        raise HTTPException(status_code=400, detail=f"Unknown binding: {req.binding_name}")

    return {
        "status": "invoked",
        "binding": req.binding_name,
        "operation": req.operation,
        "type": BINDING_COMPONENTS[req.binding_name]["type"],
    }


@app.get("/services")
async def list_services():
    return SERVICE_REGISTRY


@app.get("/components")
async def list_components():
    return {
        "state_stores": STATE_STORES,
        "pubsub": PUBSUB_COMPONENTS,
        "bindings": BINDING_COMPONENTS,
        "secret_stores": SECRET_STORES,
    }


@app.get("/metrics")
async def get_metrics():
    total_state = sum(len(s) for s in state_data.values())
    total_messages = sum(len(m) for m in pubsub_messages.values())

    return {
        "state_entries": total_state,
        "pubsub_messages": total_messages,
        "subscriptions": len(pubsub_subscriptions),
        "invocations": len(invocation_log),
        "connected": connected,
        "components": {
            "state_stores": len(STATE_STORES),
            "pubsub": len(PUBSUB_COMPONENTS),
            "bindings": len(BINDING_COMPONENTS),
            "secrets": len(SECRET_STORES),
        },
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DAPR_SERVICE_PORT", "8092"))
    uvicorn.run(app, host="0.0.0.0", port=port)
