"""Fraud Detection Service Event Integration (Duplicate service folder)"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_fraud_score_calculated
)

EventIntegration.initialize("fraud-detection-service")

async def emit_fraud_alert_raised(alert_id: str, transaction_id: str, risk_score: float, risk_factors: list, action_taken: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.FRAUD_ALERT_RAISED, "alert", alert_id,
        {"transaction_id": transaction_id, "risk_score": risk_score, "risk_factors": risk_factors, "action_taken": action_taken}
    )
