"""Social Graph Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import EventIntegration, EventType

EventIntegration.initialize("social-graph-service")

async def emit_social_connection_created(connection_id: str, user_id: str, connected_user_id: str, connection_type: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SOCIAL_CONNECTION_CREATED, "connection", connection_id,
        {"user_id": user_id, "connected_user_id": connected_user_id, "connection_type": connection_type}
    )

async def emit_social_recommendation_generated(recommendation_id: str, user_id: str, recommended_users: list, algorithm: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SOCIAL_RECOMMENDATION_GENERATED, "recommendation", recommendation_id,
        {"user_id": user_id, "recommended_users": recommended_users, "algorithm": algorithm}
    )
