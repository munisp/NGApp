"""Invoicing Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_invoice_paid
)

EventIntegration.initialize("invoicing-service")

async def emit_invoice_created(invoice_id: str, customer_id: str, amount: float, currency: str, due_date: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.INVOICE_CREATED, "invoice", invoice_id,
        {"customer_id": customer_id, "amount": amount, "currency": currency, "due_date": due_date}
    )

async def emit_invoice_sent(invoice_id: str, customer_id: str, delivery_method: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.INVOICE_SENT, "invoice", invoice_id,
        {"customer_id": customer_id, "delivery_method": delivery_method}
    )

async def emit_invoice_overdue(invoice_id: str, customer_id: str, days_overdue: int, amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.INVOICE_OVERDUE, "invoice", invoice_id,
        {"customer_id": customer_id, "days_overdue": days_overdue, "amount": amount}
    )
