"""
Fraud Detection Service - Pydantic Schemas
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class RiskLevel(str, Enum):
    """Risk level."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FraudCheckRequest(BaseModel):
    """Fraud check request."""
    transaction_id: str = Field(..., min_length=1, max_length=100)
    payer_id: str
    payee_id: str
    amount: float = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    channel: str
    timestamp: str


class FraudCheckResponse(BaseModel):
    """Fraud check response."""
    transaction_id: str
    risk_level: RiskLevel
    fraud_score: float = Field(..., ge=0, le=1)
    rules_triggered: List[str]
    recommendation: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    version: str
