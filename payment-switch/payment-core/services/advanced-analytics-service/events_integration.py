"""Advanced Analytics Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_analytics_report_generated
)

EventIntegration.initialize("advanced-analytics-service")

async def emit_analytics_insight_discovered(insight_id: str, insight_type: str, confidence: float, data: dict) -> bool:
    return await EventIntegration.emit_event(
        EventType.ANALYTICS_INSIGHT_DISCOVERED, "insight", insight_id,
        {"insight_type": insight_type, "confidence": confidence, "data": data}
    )

async def emit_analytics_query_executed(query_id: str, query_type: str, execution_time_ms: int, rows_returned: int) -> bool:
    return await EventIntegration.emit_event(
        "analytics.query.executed", "query", query_id,
        {"query_type": query_type, "execution_time_ms": execution_time_ms, "rows_returned": rows_returned}
    )
