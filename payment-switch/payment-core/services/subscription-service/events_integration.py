"""Subscription Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_subscription_created
)

EventIntegration.initialize("subscription-service")

async def emit_subscription_renewed(subscription_id: str, customer_id: str, amount: float, next_billing_date: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SUBSCRIPTION_RENEWED, "subscription", subscription_id,
        {"customer_id": customer_id, "amount": amount, "next_billing_date": next_billing_date}
    )

async def emit_subscription_cancelled(subscription_id: str, customer_id: str, reason: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SUBSCRIPTION_CANCELLED, "subscription", subscription_id,
        {"customer_id": customer_id, "reason": reason}
    )

async def emit_subscription_payment_failed(subscription_id: str, customer_id: str, error: str, retry_count: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.SUBSCRIPTION_PAYMENT_FAILED, "subscription", subscription_id,
        {"customer_id": customer_id, "error": error, "retry_count": retry_count}
    )
