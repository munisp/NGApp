"""
Settlement Service - Pydantic Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum
from datetime import datetime
from decimal import Decimal


class SettlementStatus(str, Enum):
    """Settlement status."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class SettlementModel(str, Enum):
    """Settlement model."""
    DEFERRED_NET = "DEFERRED_NET"  # Net settlement at end of window
    IMMEDIATE_GROSS = "IMMEDIATE_GROSS"  # Real-time gross settlement
    MULTILATERAL_NET = "MULTILATERAL_NET"  # Multilateral netting


class ParticipantType(str, Enum):
    """Participant type."""
    DFSP = "DFSP"  # Digital Financial Service Provider
    BANK = "BANK"
    MOBILE_MONEY = "MOBILE_MONEY"
    PAYMENT_GATEWAY = "PAYMENT_GATEWAY"


class Participant(BaseModel):
    """Participant information."""
    participantId: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    type: ParticipantType
    currency: str = Field(..., min_length=3, max_length=3)
    accountNumber: Optional[str] = Field(None, max_length=50)
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class SettlementWindow(BaseModel):
    """Settlement window."""
    windowId: str
    startTime: datetime
    endTime: Optional[datetime] = None
    status: SettlementStatus
    currency: str = Field(..., min_length=3, max_length=3)
    totalTransactions: int = Field(0, ge=0)
    totalAmount: Decimal = Field(Decimal("0.00"), ge=0)
    settlementModel: SettlementModel = SettlementModel.DEFERRED_NET
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class ParticipantPosition(BaseModel):
    """Participant position in settlement."""
    participantId: str
    currency: str
    netPosition: Decimal  # Positive = owes, Negative = owed
    debitAmount: Decimal = Field(..., ge=0)
    creditAmount: Decimal = Field(..., ge=0)
    transactionCount: int = Field(0, ge=0)
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class SettlementRequest(BaseModel):
    """Settlement request."""
    windowId: str = Field(..., min_length=1, max_length=100)
    participants: List[str] = Field(..., min_items=2)
    currency: str = Field(..., min_length=3, max_length=3)
    settlementModel: SettlementModel = SettlementModel.DEFERRED_NET
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class SettlementResponse(BaseModel):
    """Settlement response."""
    settlementId: str
    windowId: str
    status: SettlementStatus
    currency: str
    totalAmount: Decimal
    participantCount: int
    timestamp: str
    message: str


class CreateWindowRequest(BaseModel):
    """Create settlement window request."""
    currency: str = Field(..., min_length=3, max_length=3)
    settlementModel: SettlementModel = SettlementModel.DEFERRED_NET
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        return v.upper()


class CreateWindowResponse(BaseModel):
    """Create settlement window response."""
    windowId: str
    startTime: str
    currency: str
    settlementModel: SettlementModel
    status: SettlementStatus
    message: str


class CloseWindowRequest(BaseModel):
    """Close settlement window request."""
    windowId: str = Field(..., min_length=1, max_length=100)
    force: bool = Field(False, description="Force close even if transactions pending")


class CloseWindowResponse(BaseModel):
    """Close settlement window response."""
    windowId: str
    endTime: str
    status: SettlementStatus
    totalTransactions: int
    totalAmount: Decimal
    message: str


class GetPositionsRequest(BaseModel):
    """Get participant positions request."""
    windowId: Optional[str] = None
    participantId: Optional[str] = None
    currency: Optional[str] = None
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency code."""
        if v:
            return v.upper()
        return v


class GetPositionsResponse(BaseModel):
    """Get participant positions response."""
    positions: List[ParticipantPosition]
    windowId: Optional[str] = None
    timestamp: str


class ReconciliationRequest(BaseModel):
    """Reconciliation request."""
    windowId: str = Field(..., min_length=1, max_length=100)
    participantId: Optional[str] = None


class ReconciliationResponse(BaseModel):
    """Reconciliation response."""
    windowId: str
    participantId: Optional[str] = None
    status: str
    discrepancies: List[Dict[str, Any]] = []
    totalDiscrepancyAmount: Decimal = Decimal("0.00")
    timestamp: str
    message: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    mojaloop_connected: bool
    tigerbeetle_connected: bool
    version: str


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: str
    settlement_id: Optional[str] = None
    window_id: Optional[str] = None
    timestamp: str
