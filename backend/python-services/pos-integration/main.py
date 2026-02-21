import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
"""
POS Integration Service - Gateway Entry Point
Port: 8126
Delegates to pos_service.py (core POS) and enhanced_pos_service.py (fraud/analytics)
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from typing import Optional, Dict, Any
from datetime import datetime
import os
import logging
import httpx
import uvicorn

logger = logging.getLogger(__name__)

app = FastAPI(
    title="POS Integration",
    description="POS Integration Gateway for Agent Banking Platform",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:5173,http://localhost:5174,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

apply_middleware(app)
setup_logging("pos-integration")
app.include_router(metrics_router)

POS_CORE_URL= os.getenv("POS_CORE_URL", "http://localhost:8016")
POS_ENHANCED_URL = os.getenv("POS_ENHANCED_URL", "http://localhost:8072")

stats = {
    "total_requests": 0,
    "start_time": datetime.now()
}


@app.get("/")
async def root():
    return {
        "service": "pos-integration",
        "description": "POS Integration Gateway",
        "version": "2.0.0",
        "port": 8126,
        "status": "operational",
        "upstream_services": {
            "pos_core": POS_CORE_URL,
            "pos_enhanced": POS_ENHANCED_URL
        }
    }


@app.get("/health")
async def health_check():
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    core_healthy = False
    enhanced_healthy = False

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{POS_CORE_URL}/health")
            core_healthy = resp.status_code == 200
        except Exception:
            pass
        try:
            resp = await client.get(f"{POS_ENHANCED_URL}/health")
            enhanced_healthy = resp.status_code == 200
        except Exception:
            pass

    return {
        "status": "healthy" if core_healthy else "degraded",
        "uptime_seconds": int(uptime),
        "total_requests": stats["total_requests"],
        "upstream": {
            "pos_core": "healthy" if core_healthy else "unreachable",
            "pos_enhanced": "healthy" if enhanced_healthy else "unreachable"
        }
    }


@app.post("/process-payment")
async def process_payment(request: Request):
    """Delegate payment processing to core POS service"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{POS_CORE_URL}/process-payment", json=body)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.post("/process-enhanced-payment")
async def process_enhanced_payment(request: Request):
    """Delegate enhanced payment (with fraud detection) to enhanced POS service"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{POS_ENHANCED_URL}/process-enhanced-payment", json=body)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/transaction/{transaction_id}/status")
async def get_transaction_status(transaction_id: str):
    """Get transaction status from core POS service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_CORE_URL}/transaction/{transaction_id}/status")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.post("/transaction/{transaction_id}/refund")
async def refund_transaction(transaction_id: str, refund_amount: Optional[float] = None, reason: str = ""):
    """Delegate refund to core POS service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=30.0) as client:
        params: Dict[str, Any] = {"reason": reason}
        if refund_amount is not None:
            params["refund_amount"] = refund_amount
        response = await client.post(
            f"{POS_CORE_URL}/transaction/{transaction_id}/refund",
            params=params
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.post("/device/register")
async def register_device(request: Request):
    """Register a POS device via core service"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{POS_CORE_URL}/device/register", json=body)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/devices")
async def get_devices(merchant_id: Optional[str] = None):
    """Get registered devices from core service"""
    stats["total_requests"] += 1
    params = {}
    if merchant_id:
        params["merchant_id"] = merchant_id
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_CORE_URL}/devices", params=params)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.post("/device/{device_id}/command")
async def send_device_command(device_id: str, request: Request):
    """Send command to POS device via core service"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(f"{POS_CORE_URL}/device/{device_id}/command", json=body)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/fraud-rules")
async def get_fraud_rules():
    """Get fraud detection rules from enhanced service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_ENHANCED_URL}/fraud-rules")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/analytics/{transaction_id}")
async def get_transaction_analytics(transaction_id: str):
    """Get transaction analytics from enhanced service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_ENHANCED_URL}/analytics/{transaction_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/exchange-rates")
async def get_exchange_rates():
    """Get current exchange rates from enhanced service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_ENHANCED_URL}/exchange-rates")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/supported-currencies")
async def get_supported_currencies():
    """Get supported currencies from enhanced service"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{POS_ENHANCED_URL}/supported-currencies")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.post("/convert-currency")
async def convert_currency(request: Request):
    """Convert currency via enhanced service"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{POS_ENHANCED_URL}/convert-currency", json=body)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@app.get("/stats")
async def get_statistics():
    """Get gateway statistics"""
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    return {
        "uptime_seconds": int(uptime),
        "total_requests": stats["total_requests"],
        "service": "pos-integration",
        "port": 8126,
        "status": "operational"
    }


from pos_sync import sync_manager
from dataclasses import asdict


@app.post("/sync/prepare")
async def sync_prepare_event(request: Request):
    """Prepare a sync event for outbound synchronization"""
    stats["total_requests"] += 1
    body = await request.json()
    entity_id = body.get("entity_id", "")
    entity_type = body.get("entity_type", "")
    data = body.get("data", {})
    operation = body.get("operation", "update")
    event = await sync_manager.prepare_sync_event(entity_id, entity_type, data, operation)
    return {"sync_id": event.sync_id, "version": event.metadata.version}


@app.post("/sync/process")
async def sync_process_incoming(request: Request):
    """Process an incoming sync event"""
    stats["total_requests"] += 1
    body = await request.json()
    from pos_sync import SyncEvent, SyncMetadata
    from datetime import datetime as dt
    metadata = SyncMetadata(
        entity_id=body["metadata"]["entity_id"],
        entity_type=body["metadata"]["entity_type"],
        version=body["metadata"]["version"],
        timestamp=dt.fromisoformat(body["metadata"]["timestamp"]),
        source=body["metadata"]["source"],
        checksum=body["metadata"]["checksum"],
        operation=body["metadata"]["operation"],
    )
    event = SyncEvent(
        sync_id=body["sync_id"],
        metadata=metadata,
        data=body["data"],
        previous_version=body.get("previous_version"),
    )
    success, conflict = await sync_manager.process_incoming_event(event)
    result: Dict[str, Any] = {"success": success}
    if conflict:
        result["conflict"] = {
            "conflict_id": conflict.conflict_id,
            "conflict_type": conflict.conflict_type.value,
            "entity_id": conflict.entity_id,
        }
    return result


@app.get("/sync/stats")
async def sync_stats():
    """Get synchronization statistics"""
    stats["total_requests"] += 1
    return sync_manager.get_sync_stats()


@app.get("/sync/conflicts")
async def sync_conflicts():
    """Get unresolved sync conflicts"""
    stats["total_requests"] += 1
    conflicts = sync_manager.get_unresolved_conflicts()
    return [
        {
            "conflict_id": c.conflict_id,
            "conflict_type": c.conflict_type.value,
            "entity_id": c.entity_id,
            "entity_type": c.entity_type,
            "detected_at": c.detected_at.isoformat(),
        }
        for c in conflicts
    ]


TIGERBEETLE_SYNC_URL = os.getenv("TIGERBEETLE_SYNC_URL", "http://localhost:8085")


@app.post("/ledger/record-payment")
async def record_payment_to_ledger(request: Request):
    """Record a POS payment as a TigerBeetle double-entry transfer"""
    stats["total_requests"] += 1
    body = await request.json()
    transfer_data = {
        "debit_account_id": body.get("merchant_account_id", ""),
        "credit_account_id": body.get("settlement_account_id", ""),
        "amount": body.get("amount", 0),
        "currency": body.get("currency", "NGN"),
        "ledger_id": body.get("ledger_id", 1),
        "metadata": {
            "source": "pos",
            "transaction_id": body.get("transaction_id", ""),
            "terminal_id": body.get("terminal_id", ""),
            "payment_method": body.get("payment_method", ""),
        },
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{TIGERBEETLE_SYNC_URL}/api/v1/sync/transfers",
                json=transfer_data,
            )
            if resp.status_code in (200, 201):
                return {"ledger_recorded": True, "detail": resp.json()}
            return {"ledger_recorded": False, "status": resp.status_code, "detail": resp.text}
        except Exception as e:
            logger.warning(f"TigerBeetle ledger record failed: {e}")
            return {"ledger_recorded": False, "error": str(e)}


POS_MGMT_URL = os.getenv("POS_MGMT_URL", "http://localhost:8443")


@app.get("/management/terminals")
async def mgmt_list_terminals():
    """List terminals via POS management server"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{POS_MGMT_URL}/api/v1/terminals")
            return resp.json()
        except Exception as e:
            return {"error": str(e), "management_server": "unreachable"}


@app.post("/management/terminals/{terminal_id}/command")
async def mgmt_send_command(terminal_id: str, request: Request):
    """Send a command to a terminal via POS management server"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                f"{POS_MGMT_URL}/api/v1/terminals/{terminal_id}/command",
                json=body,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e), "management_server": "unreachable"}


@app.post("/management/updates/deploy")
async def mgmt_deploy_update(request: Request):
    """Deploy firmware/software update via POS management server"""
    stats["total_requests"] += 1
    body = await request.json()
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(f"{POS_MGMT_URL}/api/v1/updates/deploy", json=body)
            return resp.json()
        except Exception as e:
            return {"error": str(e), "management_server": "unreachable"}


@app.get("/management/health")
async def mgmt_health():
    """Check POS management server health"""
    stats["total_requests"] += 1
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{POS_MGMT_URL}/health")
            return resp.json()
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8126)
