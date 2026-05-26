"""Instant Settlement Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import EventIntegration, EventType

EventIntegration.initialize("instant-settlement-service")

async def emit_instant_settlement_initiated(settlement_id: str, merchant_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        "instant.settlement.initiated", "settlement", settlement_id,
        {"merchant_id": merchant_id, "amount": amount, "currency": currency}
    )

async def emit_instant_settlement_completed(settlement_id: str, merchant_id: str, amount: float, latency_ms: int) -> bool:
    return await EventIntegration.emit_event(
        "instant.settlement.completed", "settlement", settlement_id,
        {"merchant_id": merchant_id, "amount": amount, "latency_ms": latency_ms}
    )

async def emit_instant_settlement_failed(settlement_id: str, error: str, retry_count: int) -> bool:
    return await EventIntegration.emit_event(
        "instant.settlement.failed", "settlement", settlement_id,
        {"error": error, "retry_count": retry_count}
    )
