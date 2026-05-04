"""QR Code Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_qr_payment_completed
)

EventIntegration.initialize("qr-code-service")

async def emit_qr_code_generated(qr_code_id: str, merchant_id: str, amount: float, currency: str, qr_type: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.QR_CODE_GENERATED, "qr_code", qr_code_id,
        {"merchant_id": merchant_id, "amount": amount, "currency": currency, "qr_type": qr_type}
    )

async def emit_qr_payment_initiated(payment_id: str, qr_code_id: str, payer_id: str, amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.QR_PAYMENT_INITIATED, "payment", payment_id,
        {"qr_code_id": qr_code_id, "payer_id": payer_id, "amount": amount}
    )
