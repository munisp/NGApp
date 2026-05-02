"""Biometric Auth Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_biometric_verified
)

EventIntegration.initialize("biometric-auth-service")

async def emit_biometric_enrolled(user_id: str, biometric_type: str, device_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.BIOMETRIC_ENROLLED, "user", user_id,
        {"biometric_type": biometric_type, "device_id": device_id}
    )

async def emit_biometric_failed(user_id: str, biometric_type: str, reason: str, attempt_count: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.BIOMETRIC_FAILED, "user", user_id,
        {"biometric_type": biometric_type, "reason": reason, "attempt_count": attempt_count}
    )
