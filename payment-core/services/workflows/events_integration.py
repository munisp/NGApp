"""Workflows Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_workflow_completed
)

EventIntegration.initialize("workflows-service")

async def emit_qr_payment_workflow_started(workflow_id: str, qr_code_id: str, payer_id: str, amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_STARTED, "workflow", workflow_id,
        {"workflow_type": "qr_payment", "qr_code_id": qr_code_id, "payer_id": payer_id, "amount": amount}
    )

async def emit_qr_payment_workflow_completed(workflow_id: str, payment_id: str, status: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_COMPLETED, "workflow", workflow_id,
        {"workflow_type": "qr_payment", "payment_id": payment_id, "status": status}
    )
