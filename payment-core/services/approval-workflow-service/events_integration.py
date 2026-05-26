"""Approval Workflow Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_approval_granted
)

EventIntegration.initialize("approval-workflow-service")

async def emit_approval_requested(request_id: str, requester_id: str, approval_type: str, amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.APPROVAL_REQUESTED, "approval", request_id,
        {"requester_id": requester_id, "approval_type": approval_type, "amount": amount}
    )

async def emit_approval_rejected(request_id: str, approver_id: str, reason: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.APPROVAL_REJECTED, "approval", request_id,
        {"approver_id": approver_id, "reason": reason}
    )
