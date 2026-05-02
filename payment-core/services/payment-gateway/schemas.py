"""
Payment Gateway Service - Pydantic Schemas
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator
from enum import Enum
from datetime import datetime


class ChannelType(str, Enum):
    """Payment channel type."""
    MOBILE = "MOBILE"
    WEB = "WEB"
    POS = "POS"
    ATM = "ATM"
    QR_CODE = "QR_CODE"
    API = "API"
    USSD = "USSD"


class PartyType(str, Enum):
    """Party identifier type."""
    MSISDN = "MSISDN"
    EMAIL = "EMAIL"
    ACCOUNT = "ACCOUNT"
    MERCHANT = "MERCHANT"
    IBAN = "IBAN"
    VPA = "VPA"  # Virtual Payment Address


class TransactionType(str, Enum):
    """Transaction type."""
    P2P = "P2P"  # Person to Person
    P2M = "P2M"  # Person to Merchant
    P2B = "P2B"  # Person to Business
    B2P = "B2P"  # Business to Person
    B2B = "B2B"  # Business to Business
    REFUND = "REFUND"
    REVERSAL = "REVERSAL"


class TransactionStatus(str, Enum):
    """Transaction status."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMEOUT = "TIMEOUT"


class Party(BaseModel):
    """Party information."""
    type: PartyType
    identifier: str = Field(..., min_length=1, max_length=100)
    name: Optional[str] = Field(None, max_length=200)
    
    @validator('identifier')
    def validate_identifier(cls, v, values):
        """Validate identifier based on party type."""
        party_type = values.get('type')
        if party_type == PartyType.MSISDN:
            if not v.startswith('+'):
                raise ValueError('MSISDN must start with +')
            if not v[1:].isdigit():
                raise ValueError('MSISDN must contain only digits after +')
        elif party_type == PartyType.EMAIL:
            if '@' not in v:
                raise ValueError('Invalid email format')
        elif party_type == PartyType.IBAN:
            if len(v) < 15 or len(v) > 34:
                raise ValueError('IBAN must be 15-34 characters')
        return v


class Amount(BaseModel):
    """Amount with currency."""
    currency: str = Field(..., min_length=3, max_length=3, description="ISO 4217 currency code")
    value: str = Field(..., regex=r'^\d+(\.\d{1,2})?$', description="Amount value")
    
    @validator('currency')
    def validate_currency(cls, v):
        """Validate and normalize currency."""
        return v.upper()
    
    @validator('value')
    def validate_value(cls, v):
        """Validate amount value."""
        amount = float(v)
        if amount <= 0:
            raise ValueError('Amount must be greater than 0')
        if amount > 999999999.99:
            raise ValueError('Amount exceeds maximum limit')
        return v


class PaymentRequest(BaseModel):
    """Payment request."""
    source: Party
    destination: Party
    amount: Amount
    transactionType: TransactionType
    channel: ChannelType
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    reference: Optional[str] = Field(None, max_length=100, description="External reference")
    description: Optional[str] = Field(None, max_length=500, description="Payment description")
    
    @validator('metadata')
    def validate_metadata(cls, v):
        """Validate metadata size."""
        if v and len(str(v)) > 10000:
            raise ValueError('Metadata too large')
        return v


class PaymentResponse(BaseModel):
    """Payment response."""
    transactionId: str
    status: TransactionStatus
    message: str
    timestamp: str
    workflowId: Optional[str] = None
    estimatedCompletionTime: Optional[str] = None


class TransactionStatusRequest(BaseModel):
    """Transaction status query request."""
    transactionId: str = Field(..., min_length=1, max_length=100)


class TransactionStatusResponse(BaseModel):
    """Transaction status response."""
    transactionId: str
    status: TransactionStatus
    source: Party
    destination: Party
    amount: Amount
    transactionType: TransactionType
    channel: ChannelType
    createdAt: str
    updatedAt: str
    completedAt: Optional[str] = None
    failureReason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class RefundRequest(BaseModel):
    """Refund request."""
    originalTransactionId: str = Field(..., min_length=1, max_length=100)
    amount: Optional[Amount] = Field(None, description="Partial refund amount (full if not specified)")
    reason: str = Field(..., min_length=1, max_length=500)
    metadata: Optional[Dict[str, Any]] = None


class RefundResponse(BaseModel):
    """Refund response."""
    refundId: str
    originalTransactionId: str
    status: TransactionStatus
    amount: Amount
    message: str
    timestamp: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    temporal_connected: bool
    redis_connected: bool
    version: str


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: str
    transaction_id: Optional[str] = None
    timestamp: str
