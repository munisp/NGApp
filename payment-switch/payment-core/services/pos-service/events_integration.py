"""POS Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_pos_transaction_completed
)

EventIntegration.initialize("pos-service")

async def emit_pos_transaction_initiated(transaction_id: str, terminal_id: str, merchant_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.POS_TRANSACTION_INITIATED, "transaction", transaction_id,
        {"terminal_id": terminal_id, "merchant_id": merchant_id, "amount": amount, "currency": currency}
    )

async def emit_pos_terminal_registered(terminal_id: str, merchant_id: str, location: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.POS_TERMINAL_REGISTERED, "terminal", terminal_id,
        {"merchant_id": merchant_id, "location": location}
    )
