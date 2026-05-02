"""Fraud Detection Service Event Integration"""
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

async def emit_fraud_review_completed(review_id: str, alert_id: str, reviewer_id: str, decision: str, notes: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.FRAUD_REVIEW_COMPLETED, "review", review_id,
        {"alert_id": alert_id, "reviewer_id": reviewer_id, "decision": decision, "notes": notes}
    )
