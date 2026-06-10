"""
Fraud Detection Service - API Routers
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException

from .schemas import (
    FraudCheckRequest,
    FraudCheckResponse,
    HealthResponse,
    RiskLevel
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fraud", tags=["Fraud Detection"])


@router.post("/check", response_model=FraudCheckResponse)
async def check_fraud(request: FraudCheckRequest):
    """
    Check transaction for fraud.
    
    Args:
        request: Fraud check request
        
    Returns:
        FraudCheckResponse with fraud assessment
    """
    try:
        # Calculate fraud score based on rules
        fraud_score = 0.0
        rules_triggered = []
        
        # Rule 1: Large amount
        if request.amount > 10000:
            fraud_score += 0.3
            rules_triggered.append("LARGE_AMOUNT")
        
        # Rule 2: High velocity
        # In production, check transaction history
        
        # Rule 3: Unusual channel
        if request.channel not in ["MOBILE", "WEB", "POS"]:
            fraud_score += 0.2
            rules_triggered.append("UNUSUAL_CHANNEL")
        
        # Determine risk level
        if fraud_score < 0.3:
            risk_level = RiskLevel.LOW
            recommendation = "APPROVE"
        elif fraud_score < 0.6:
            risk_level = RiskLevel.MEDIUM
            recommendation = "REVIEW"
        elif fraud_score < 0.8:
            risk_level = RiskLevel.HIGH
            recommendation = "BLOCK"
        else:
            risk_level = RiskLevel.CRITICAL
            recommendation = "BLOCK_AND_ALERT"
        
        logger.info(f"Fraud check for {request.transaction_id}: {risk_level.value}")
        
        return FraudCheckResponse(
            transaction_id=request.transaction_id,
            risk_level=risk_level,
            fraud_score=min(fraud_score, 1.0),
            rules_triggered=rules_triggered,
            recommendation=recommendation
        )
        
    except Exception as e:
        logger.error(f"Fraud check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0"
    )
