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

apply_middleware(app)
setup_logging("pos-integration")
app.include_router(metrics_router)

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

POS_CORE_URL = os.getenv("POS_CORE_URL", "http://localhost:8016")
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8126)
