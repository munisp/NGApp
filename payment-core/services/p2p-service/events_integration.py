"""P2P Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_p2p_transfer_completed
)

EventIntegration.initialize("p2p-service")

async def emit_p2p_transfer_initiated(transfer_id: str, sender_id: str, recipient_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.P2P_TRANSFER_INITIATED, "transfer", transfer_id,
        {"sender_id": sender_id, "recipient_id": recipient_id, "amount": amount, "currency": currency}
    )

async def emit_p2p_transfer_failed(transfer_id: str, error: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.P2P_TRANSFER_FAILED, "transfer", transfer_id,
        {"error": error}
    )
