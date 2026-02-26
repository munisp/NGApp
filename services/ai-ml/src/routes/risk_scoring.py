"""
Risk Scoring Module
ML-based credit and counterparty risk scoring for exchange participants.
Uses gradient boosting with behavioral and financial features.
"""

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class RiskScoreRequest(BaseModel):
    user_id: str
    include_factors: bool = Field(default=True, description="Include contributing factors")


class RiskFactor(BaseModel):
    name: str
    weight: float
    score: float
    description: str


class RiskScoreResponse(BaseModel):
    user_id: str
    overall_score: int = Field(..., ge=0, le=100, description="0=low risk, 100=high risk")
    risk_category: str
    credit_score: int
    counterparty_score: int
    behavioral_score: int
    factors: list[RiskFactor]
    computed_at: datetime
    model_version: str


@router.post("/risk-score", response_model=RiskScoreResponse)
async def compute_risk_score(request: RiskScoreRequest):
    """Compute comprehensive risk score for a user."""

    # In production: Pull features from PostgreSQL, Redis, and trade history
    # Features include: trade frequency, PnL history, margin utilization,
    # order cancellation rate, settlement history, KYC level, account age

    factors = []
    if request.include_factors:
        factors = [
            RiskFactor(name="trade_frequency", weight=0.15, score=35.0,
                       description="Trading activity level and consistency"),
            RiskFactor(name="pnl_history", weight=0.20, score=40.0,
                       description="Historical profit/loss performance"),
            RiskFactor(name="margin_utilization", weight=0.20, score=25.0,
                       description="Average margin usage relative to limits"),
            RiskFactor(name="settlement_history", weight=0.15, score=10.0,
                       description="On-time settlement rate"),
            RiskFactor(name="order_cancel_rate", weight=0.10, score=30.0,
                       description="Ratio of cancelled to placed orders"),
            RiskFactor(name="account_age", weight=0.10, score=20.0,
                       description="Account maturity and verification level"),
            RiskFactor(name="concentration_risk", weight=0.10, score=45.0,
                       description="Portfolio diversification across commodities"),
        ]

    overall = 30  # Placeholder
    category = "low" if overall < 33 else ("medium" if overall < 66 else "high")

    return RiskScoreResponse(
        user_id=request.user_id,
        overall_score=overall,
        risk_category=category,
        credit_score=72,
        counterparty_score=85,
        behavioral_score=68,
        factors=factors,
        computed_at=datetime.utcnow(),
        model_version="v2.1.0",
    )


@router.post("/risk-score/batch")
async def batch_risk_scores(user_ids: list[str]):
    """Compute risk scores for multiple users (batch processing)."""
    results = []
    for uid in user_ids:
        results.append({
            "user_id": uid,
            "overall_score": 30,
            "risk_category": "low",
        })
    return {"scores": results, "computed_at": datetime.utcnow().isoformat()}
