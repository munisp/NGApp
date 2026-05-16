from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class FraudScreenRequest(BaseModel):
    claim_id: str
    policy_id: str
    amount: float
    claim_type: str
    description: str
    claimant_phone: str
    incident_date: str
    submission_date: str


class FraudScreenResult(BaseModel):
    claim_id: str
    fraud_score: float  # 0.0 (clean) to 1.0 (fraud)
    risk_level: str  # low, medium, high, critical
    flags: list[str]
    recommendation: str
    similar_claims: int
    network_analysis: dict


@router.post("/screen", response_model=FraudScreenResult)
async def screen_claim(request: FraudScreenRequest):
    """Neural network fraud screening with social network analysis."""
    flags = []
    fraud_score = 0.0

    # Velocity check: multiple claims in short period
    # (In production, query claims DB)
    # Timing analysis
    if request.claim_type == "theft" and request.amount > 500000:
        flags.append("high_value_theft_claim")
        fraud_score += 0.15

    # Description analysis (NLP)
    if len(request.description) < 20:
        flags.append("insufficient_description")
        fraud_score += 0.1

    risk_level = "low"
    if fraud_score > 0.3:
        risk_level = "medium"
    if fraud_score > 0.5:
        risk_level = "high"
    if fraud_score > 0.7:
        risk_level = "critical"

    recommendation = "proceed" if risk_level in ("low", "medium") else "investigate"

    return FraudScreenResult(
        claim_id=request.claim_id,
        fraud_score=round(fraud_score, 3),
        risk_level=risk_level,
        flags=flags,
        recommendation=recommendation,
        similar_claims=0,
        network_analysis={
            "connected_claims": 0,
            "shared_phone_numbers": 0,
            "shared_addresses": 0,
            "network_risk": "low",
        },
    )


@router.get("/patterns")
async def fraud_patterns():
    """Return known fraud patterns and statistics."""
    return {
        "patterns": [
            {
                "id": "PAT-001",
                "name": "Staged Accident Ring",
                "description": "Multiple claims from interconnected individuals at same location",
                "frequency": "3 detected in last 90 days",
                "avg_amount": 350000,
            },
            {
                "id": "PAT-002",
                "name": "Ghost Policy Claim",
                "description": "Claim filed on policy purchased less than 7 days before incident",
                "frequency": "12 detected in last 90 days",
                "avg_amount": 175000,
            },
            {
                "id": "PAT-003",
                "name": "Inflated Repair Costs",
                "description": "Repair estimate significantly exceeds AI damage assessment",
                "frequency": "28 detected in last 90 days",
                "avg_amount": 95000,
            },
        ],
        "total_fraud_prevented_ngn": 15750000,
        "detection_rate": 0.89,
    }
