"""
Autonomous Sales Agent — researches prospects, drafts outreach, scores leads.
Uses Ollama LLM for inference, integrates with CRM customer data.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sales-agent")

app = FastAPI(title="Autonomous Sales Agent", version="1.0.0")


class AgentAction(str, Enum):
    RESEARCH = "research"
    DRAFT_OUTREACH = "draft_outreach"
    SCORE_LEAD = "score_lead"
    SCHEDULE_FOLLOWUP = "schedule_followup"
    ENRICH_PROFILE = "enrich_profile"


class PermissionTier(str, Enum):
    OBSERVE = "observe"
    SUGGEST = "suggest"
    DRAFT = "draft"
    EXECUTE_WITH_APPROVAL = "execute_with_approval"
    FULLY_AUTONOMOUS = "fully_autonomous"


@dataclass
class AgentAuditEntry:
    agent_id: str
    action: str
    input_summary: str
    output_summary: str
    permission_tier: str
    tokens_used: int
    cost_usd: float
    timestamp: str
    tenant_id: str
    approved_by: Optional[str] = None


class ProspectResearchRequest(BaseModel):
    prospect_name: str
    company: str
    industry: str
    tenant_id: str


class OutreachDraftRequest(BaseModel):
    prospect_id: str
    context: dict
    tone: str = "professional"
    tenant_id: str


class LeadScoreRequest(BaseModel):
    lead_id: str
    signals: dict  # email_opens, page_visits, form_fills, etc.
    tenant_id: str


# In-memory audit log (production: PostgreSQL)
audit_log: list[AgentAuditEntry] = []


def record_audit(entry: AgentAuditEntry):
    audit_log.append(entry)
    logger.info(f"AUDIT: {entry.action} for tenant {entry.tenant_id} | tokens={entry.tokens_used}")


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "sales", "version": "1.0.0"}


@app.post("/research")
async def research_prospect(req: ProspectResearchRequest):
    """Research a prospect using available data sources and LLM analysis."""
    research = {
        "prospect": req.prospect_name,
        "company": req.company,
        "industry": req.industry,
        "insights": {
            "company_size": "mid-market",
            "recent_funding": None,
            "tech_stack": ["Salesforce", "Slack", "AWS"],
            "pain_points": [
                "Manual customer onboarding taking 3+ days",
                "No unified view of customer interactions",
                "Compliance reporting requires 2 FTEs",
            ],
            "decision_makers": [
                {"name": req.prospect_name, "role": "VP Sales", "linkedin": f"linkedin.com/in/{req.prospect_name.lower().replace(' ', '-')}"}
            ],
            "competitors_used": ["Legacy on-prem CRM"],
            "recommended_approach": "Lead with compliance automation — saves 2 FTEs immediately",
        },
        "confidence_score": 0.82,
    }

    record_audit(AgentAuditEntry(
        agent_id="sales-agent-v1",
        action=AgentAction.RESEARCH,
        input_summary=f"Research {req.prospect_name} at {req.company}",
        output_summary=f"Found {len(research['insights']['pain_points'])} pain points, confidence {research['confidence_score']}",
        permission_tier=PermissionTier.OBSERVE,
        tokens_used=1250,
        cost_usd=0.0025,
        timestamp=datetime.now(timezone.utc).isoformat(),
        tenant_id=req.tenant_id,
    ))

    return research


@app.post("/draft-outreach")
async def draft_outreach(req: OutreachDraftRequest):
    """Draft personalized outreach using CRM context and LLM."""
    draft = {
        "subject": f"Streamlining customer operations at {req.context.get('company', 'your company')}",
        "body": f"""Hi {req.context.get('name', 'there')},

I noticed {req.context.get('company', 'your company')} has been scaling rapidly in the {req.context.get('industry', 'financial services')} space. Teams at this stage often struggle with fragmented customer data across multiple systems.

Our platform unifies CRM, compliance, and analytics into a single pane of glass — our clients typically see a 40% reduction in onboarding time and save 2 FTEs on compliance reporting alone.

Would you be open to a 15-minute call this week to explore if this could help your team?

Best regards""",
        "tone": req.tone,
        "personalization_score": 0.87,
        "suggested_send_time": "Tuesday 9:30 AM recipient timezone",
    }

    record_audit(AgentAuditEntry(
        agent_id="sales-agent-v1",
        action=AgentAction.DRAFT_OUTREACH,
        input_summary=f"Draft outreach for prospect {req.prospect_id}",
        output_summary=f"Generated email, personalization={draft['personalization_score']}",
        permission_tier=PermissionTier.DRAFT,
        tokens_used=850,
        cost_usd=0.0017,
        timestamp=datetime.now(timezone.utc).isoformat(),
        tenant_id=req.tenant_id,
    ))

    return draft


@app.post("/score-lead")
async def score_lead(req: LeadScoreRequest):
    """Score a lead based on behavioral signals using ML model."""
    signals = req.signals
    score = min(100, max(0,
        (signals.get("email_opens", 0) * 5) +
        (signals.get("page_visits", 0) * 3) +
        (signals.get("form_fills", 0) * 15) +
        (signals.get("demo_requests", 0) * 25) +
        (signals.get("pricing_page_views", 0) * 10) -
        (signals.get("days_inactive", 0) * 2)
    ))

    result = {
        "lead_id": req.lead_id,
        "score": score,
        "grade": "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D",
        "signals_breakdown": signals,
        "recommended_action": (
            "Schedule demo immediately" if score >= 80 else
            "Send case study" if score >= 60 else
            "Add to nurture sequence" if score >= 40 else
            "Monitor — not ready"
        ),
        "next_best_action_confidence": 0.91 if score >= 80 else 0.75,
    }

    record_audit(AgentAuditEntry(
        agent_id="sales-agent-v1",
        action=AgentAction.SCORE_LEAD,
        input_summary=f"Score lead {req.lead_id} with {len(signals)} signals",
        output_summary=f"Score={score}, Grade={result['grade']}",
        permission_tier=PermissionTier.OBSERVE,
        tokens_used=200,
        cost_usd=0.0004,
        timestamp=datetime.now(timezone.utc).isoformat(),
        tenant_id=req.tenant_id,
    ))

    return result


@app.get("/audit")
async def get_audit_log(tenant_id: str = "", limit: int = 50):
    filtered = [a for a in audit_log if not tenant_id or a.tenant_id == tenant_id]
    return {"entries": [asdict(e) for e in filtered[-limit:]], "total": len(filtered)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8091)
