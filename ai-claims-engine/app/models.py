"""Claims AI data models."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClaimRequest(BaseModel):
    claim_id: str
    policy_id: str
    claimant_id: str
    amount: float
    currency: str = "NGN"
    category: str  # health, auto, property, life, crop
    description: str = ""
    evidence_count: int = 0
    days_since_policy_start: int = 0
    previous_claims: int = 0
    tenant_id: str = ""


class ClaimAssessment(BaseModel):
    claim_id: str
    fraud_score: float  # 0.0 - 1.0
    validity_score: float  # 0.0 - 1.0
    complexity: str  # simple, moderate, complex
    estimated_payout: float
    risk_flags: list[str] = []
    recommendation: str  # auto_approve, manual_review, auto_reject
    confidence: float
    processing_time_ms: int
    model_version: str = "3.0.0"


class ClaimDecision(BaseModel):
    claim_id: str
    decision: str  # approved, rejected, escalated
    amount_approved: float
    reason: str
    decided_by: str  # ai_engine, human_reviewer
    decided_at: datetime
    workflow_id: str = ""
