"""ERP Integration Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_erp_sync_completed
)

EventIntegration.initialize("erp-integration-service")

async def emit_erp_sync_started(sync_id: str, erp_system: str, sync_type: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.ERP_SYNC_STARTED, "erp_sync", sync_id,
        {"erp_system": erp_system, "sync_type": sync_type}
    )

async def emit_erp_sync_failed(sync_id: str, erp_system: str, error: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.ERP_SYNC_FAILED, "erp_sync", sync_id,
        {"erp_system": erp_system, "error": error}
    )
