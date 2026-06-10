"""Settlement Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_settlement_completed
)

EventIntegration.initialize("settlement-service")

async def emit_settlement_initiated(settlement_id: str, merchant_id: str, total_amount: float, transaction_count: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.SETTLEMENT_INITIATED, "settlement", settlement_id,
        {"merchant_id": merchant_id, "total_amount": total_amount, "transaction_count": transaction_count}
    )

async def emit_settlement_failed(settlement_id: str, error: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SETTLEMENT_FAILED, "settlement", settlement_id,
        {"error": error}
    )

async def emit_batch_settlement_started(batch_id: str, merchant_count: int, total_amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.BATCH_SETTLEMENT_STARTED, "batch", batch_id,
        {"merchant_count": merchant_count, "total_amount": total_amount}
    )

async def emit_batch_settlement_completed(batch_id: str, successful_count: int, failed_count: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.BATCH_SETTLEMENT_COMPLETED, "batch", batch_id,
        {"successful_count": successful_count, "failed_count": failed_count}
    )
