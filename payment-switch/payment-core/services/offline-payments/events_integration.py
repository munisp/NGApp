"""Offline Payments Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_offline_transaction_synced
)

EventIntegration.initialize("offline-payments-service")

async def emit_offline_transaction_created(transaction_id: str, user_id: str, amount: float, currency: str, offline_timestamp: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.OFFLINE_TRANSACTION_CREATED, "transaction", transaction_id,
        {"user_id": user_id, "amount": amount, "currency": currency, "offline_timestamp": offline_timestamp}
    )
