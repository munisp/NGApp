"""Batch Processing Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import EventIntegration, EventType

EventIntegration.initialize("batch-processing-service")

async def emit_batch_started(batch_id: str, batch_type: str, record_count: int) -> bool:
    return await EventIntegration.emit_event(
        "batch.processing.started", "batch", batch_id,
        {"batch_type": batch_type, "record_count": record_count}
    )

async def emit_batch_completed(batch_id: str, successful_count: int, failed_count: int, duration_ms: int) -> bool:
    return await EventIntegration.emit_event(
        "batch.processing.completed", "batch", batch_id,
        {"successful_count": successful_count, "failed_count": failed_count, "duration_ms": duration_ms}
    )

async def emit_batch_failed(batch_id: str, error: str, processed_count: int) -> bool:
    return await EventIntegration.emit_event(
        "batch.processing.failed", "batch", batch_id,
        {"error": error, "processed_count": processed_count}
    )
