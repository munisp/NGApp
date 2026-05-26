"""Payment Gateway Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_payment_completed, emit_transaction_completed
)

EventIntegration.initialize("payment-gateway")

async def emit_payment_initiated(payment_id: str, amount: float, currency: str, method: str, merchant_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYMENT_INITIATED, "payment", payment_id,
        {"amount": amount, "currency": currency, "method": method, "merchant_id": merchant_id}
    )

async def emit_payment_failed(payment_id: str, error: str, error_code: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYMENT_FAILED, "payment", payment_id,
        {"error": error, "error_code": error_code}
    )
