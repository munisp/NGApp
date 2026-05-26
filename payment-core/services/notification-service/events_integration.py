"""Notification Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_notification_sent
)

EventIntegration.initialize("notification-service")

async def emit_notification_failed(notification_id: str, user_id: str, channel: str, error: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.NOTIFICATION_FAILED, "notification", notification_id,
        {"user_id": user_id, "channel": channel, "error": error}
    )

async def emit_notification_delivered(notification_id: str, user_id: str, channel: str, delivered_at: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.NOTIFICATION_DELIVERED, "notification", notification_id,
        {"user_id": user_id, "channel": channel, "delivered_at": delivered_at}
    )
