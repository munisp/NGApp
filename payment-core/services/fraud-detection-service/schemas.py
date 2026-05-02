"""
Fraud Detection Service - Pydantic Schemas
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from enum import Enum
from datetime import datetime


class RiskLevel(str, Enum):
    """Risk level enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LocationSchema(BaseModel):
    """Location schema."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    country: Optional[str] = Field(None, description="Country code")
    city: Optional[str] = Field(None, description="City name")


class TransactionRequest(BaseModel):
    """Transaction scoring request."""
    transaction_id: str = Field(..., min_length=1, max_length=100)
    payer_id: str = Field(..., min_length=1, max_length=100)
    payee_id: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0, description="Transaction amount")
    currency: str = Field(..., min_length=3, max_length=3, description="ISO 4217 currency code")
    channel: str = Field(..., description="Transaction channel: POS, ATM, WEB, MOBILE, QR")
    merchant_id: Optional[str] = Field(None, max_length=100)
    device_id: Optional[str] = Field(None, max_length=100)
    location: Optional[LocationSchema] = None
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    
    @validator('channel')
    def validate_channel(cls, v):
        """Validate channel."""
        allowed_channels = ['POS', 'ATM', 'WEB', 'MOBILE', 'QR']
        if v not in allowed_channels:
            raise ValueError(f"Channel must be one of {allowed_channels}")
        return v
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class FraudScoreResponse(BaseModel):
    """Fraud score response."""
    transaction_id: str
    fraud_score: float = Field(..., ge=0, le=1, description="Overall fraud score (0-1)")
    risk_level: RiskLevel
    gnn_score: float = Field(..., ge=0, le=1, description="GNN model score")
    ml_score: float = Field(..., ge=0, le=1, description="ML model score")
    rule_score: float = Field(..., ge=0, le=1, description="Rule-based score")
    explanation: List[str] = Field(..., description="Explanation of the score")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    features: Optional[Dict] = Field(None, description="Extracted features")


class BatchScoreRequest(BaseModel):
    """Batch scoring request."""
    transactions: List[TransactionRequest] = Field(..., min_items=1, max_items=100)


class BatchScoreResponse(BaseModel):
    """Batch scoring response."""
    results: List[FraudScoreResponse]
    total_count: int
    success_count: int
    failure_count: int
    total_processing_time_ms: float


class ModelStatsResponse(BaseModel):
    """Model statistics response."""
    gnn_model_loaded: bool
    gnn_model_version: str
    ml_model_loaded: bool
    ml_model_version: str
    total_requests: int
    avg_processing_time_ms: float
    cache_hit_rate: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    redis_connected: bool
    models_loaded: bool
    version: str


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: str
    transaction_id: Optional[str] = None
    timestamp: str
