"""
Customer Success Agent — monitors health scores, triggers retention playbooks,
generates intervention emails for at-risk accounts.
"""
import logging
from datetime import datetime, timezone
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cs-agent")

app = FastAPI(title="Customer Success Agent", version="1.0.0")


class HealthAlert(BaseModel):
    customer_id: str
    customer_name: str
    current_score: int
    previous_score: int
    tenant_id: str


class RetentionAction(BaseModel):
    customer_id: str
    action_type: str
    urgency: str
    details: dict


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "customer-success", "version": "1.0.0"}


@app.post("/analyze-health-drop")
async def analyze_health_drop(alert: HealthAlert):
    """Analyze why a customer's health score dropped and recommend interventions."""
    drop = alert.previous_score - alert.current_score
    urgency = "critical" if drop > 30 else "high" if drop > 15 else "medium"

    diagnosis = {
        "customer_id": alert.customer_id,
        "customer_name": alert.customer_name,
        "score_drop": drop,
        "urgency": urgency,
        "likely_causes": [],
        "recommended_actions": [],
        "retention_probability": 0.0,
        "email_draft": "",
    }

    if drop > 30:
        diagnosis["likely_causes"] = ["Major service disruption", "Unresolved support tickets", "Champion left company"]
        diagnosis["recommended_actions"] = [
            {"action": "executive_escalation", "description": "Immediate exec-to-exec outreach", "deadline_hours": 4},
            {"action": "service_credit", "description": "Offer 20% service credit for next quarter", "deadline_hours": 24},
            {"action": "dedicated_csm", "description": "Assign senior CSM for white-glove support", "deadline_hours": 48},
        ]
        diagnosis["retention_probability"] = 0.45
    elif drop > 15:
        diagnosis["likely_causes"] = ["Decreased usage", "Support ticket backlog", "Missing key features"]
        diagnosis["recommended_actions"] = [
            {"action": "check_in_call", "description": "Schedule 30-min check-in with primary contact", "deadline_hours": 24},
            {"action": "feature_roadmap", "description": "Share relevant upcoming features", "deadline_hours": 48},
            {"action": "training_session", "description": "Offer complimentary training for underused features", "deadline_hours": 72},
        ]
        diagnosis["retention_probability"] = 0.72
    else:
        diagnosis["likely_causes"] = ["Seasonal usage dip", "Team onboarding new members"]
        diagnosis["recommended_actions"] = [
            {"action": "nurture_email", "description": "Send helpful tips & best practices", "deadline_hours": 72},
        ]
        diagnosis["retention_probability"] = 0.89

    diagnosis["email_draft"] = f"""Hi {alert.customer_name} team,

I wanted to reach out personally because I noticed some changes in how your team has been using our platform recently. Your success is our top priority, and I want to make sure we're delivering the value you expect.

I'd love to schedule a quick 15-minute call to understand if there's anything we can improve or if your team's needs have evolved. We also have some exciting updates on our roadmap that I think would be particularly relevant for your use case.

Would any time this week work for a brief chat?

Best,
Your Customer Success Team"""

    logger.info(f"Health drop analyzed: {alert.customer_name} dropped {drop} points, urgency={urgency}")
    return diagnosis


@app.post("/generate-retention-playbook")
async def generate_playbook(action: RetentionAction):
    """Generate a step-by-step retention playbook for a specific customer."""
    playbook = {
        "customer_id": action.customer_id,
        "playbook_name": f"{action.urgency.title()} Retention — {action.action_type}",
        "steps": [
            {"day": 0, "action": "Internal review of account health metrics", "owner": "CSM"},
            {"day": 0, "action": "Pull all open support tickets and recent interactions", "owner": "CSM"},
            {"day": 1, "action": "Personalized outreach to primary stakeholder", "owner": "CSM"},
            {"day": 3, "action": "Follow-up with value demonstration call", "owner": "CSM + Solutions Engineer"},
            {"day": 7, "action": "Executive check-in if no response", "owner": "VP Customer Success"},
            {"day": 14, "action": "Reassess score and close or escalate", "owner": "CSM"},
        ],
        "success_criteria": "Health score returns to 70+ within 30 days",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    return playbook


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8092)
