"""VPA Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_vpa_payment_received
)

EventIntegration.initialize("vpa-service")

async def emit_vpa_created(vpa_id: str, user_id: str, vpa_address: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.VPA_CREATED, "vpa", vpa_id,
        {"user_id": user_id, "vpa_address": vpa_address}
    )

async def emit_vpa_linked(vpa_id: str, user_id: str, bank_account_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.VPA_LINKED, "vpa", vpa_id,
        {"user_id": user_id, "bank_account_id": bank_account_id}
    )
