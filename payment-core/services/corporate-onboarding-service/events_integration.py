"""Corporate Onboarding Service Event Integration"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.events_integration import (
    EventIntegration, EventType, with_domain_events
)

EventIntegration.initialize("corporate-onboarding-service")

async def emit_corporate_onboarding_started(onboarding_id: str, company_name: str, company_type: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.CORPORATE_ONBOARDING_STARTED, "onboarding", onboarding_id,
        {"company_name": company_name, "company_type": company_type}
    )

async def emit_corporate_onboarding_completed(onboarding_id: str, company_id: str, merchant_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.CORPORATE_ONBOARDING_COMPLETED, "onboarding", onboarding_id,
        {"company_id": company_id, "merchant_id": merchant_id}
    )
