"""Unified API Gateway Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import EventIntegration, EventType

EventIntegration.initialize("unified-api-gateway")

async def emit_api_request_received(request_id: str, endpoint: str, method: str, client_id: str) -> bool:
    return await EventIntegration.emit_event(
        "api.request.received", "request", request_id,
        {"endpoint": endpoint, "method": method, "client_id": client_id}
    )

async def emit_api_request_completed(request_id: str, status_code: int, latency_ms: int) -> bool:
    return await EventIntegration.emit_event(
        "api.request.completed", "request", request_id,
        {"status_code": status_code, "latency_ms": latency_ms}
    )

async def emit_api_rate_limit_exceeded(client_id: str, endpoint: str, limit: int, window_seconds: int) -> bool:
    return await EventIntegration.emit_event(
        "api.rate_limit.exceeded", "client", client_id,
        {"endpoint": endpoint, "limit": limit, "window_seconds": window_seconds}
    )
