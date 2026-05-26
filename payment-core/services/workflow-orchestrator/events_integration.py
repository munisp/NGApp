"""Workflow Orchestrator Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_workflow_completed
)

EventIntegration.initialize("workflow-orchestrator-service")

async def emit_workflow_started(workflow_id: str, workflow_type: str, initiator_id: str, input_data: dict) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_STARTED, "workflow", workflow_id,
        {"workflow_type": workflow_type, "initiator_id": initiator_id, "input_data": input_data}
    )

async def emit_workflow_failed(workflow_id: str, workflow_type: str, error: str, failed_step: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_FAILED, "workflow", workflow_id,
        {"workflow_type": workflow_type, "error": error, "failed_step": failed_step}
    )

async def emit_workflow_step_completed(workflow_id: str, step_name: str, step_output: dict, duration_ms: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_STEP_COMPLETED, "workflow", workflow_id,
        {"step_name": step_name, "step_output": step_output, "duration_ms": duration_ms}
    )
