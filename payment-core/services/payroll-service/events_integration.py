"""Payroll Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events,
    emit_payroll_completed
)

EventIntegration.initialize("payroll-service")

async def emit_payroll_batch_created(batch_id: str, company_id: str, employee_count: int, total_amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYROLL_BATCH_CREATED, "payroll", batch_id,
        {"company_id": company_id, "employee_count": employee_count, "total_amount": total_amount}
    )

async def emit_payroll_disbursement_completed(disbursement_id: str, employee_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYROLL_DISBURSEMENT_COMPLETED, "disbursement", disbursement_id,
        {"employee_id": employee_id, "amount": amount, "currency": currency}
    )
