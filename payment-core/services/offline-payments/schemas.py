"""
Offline Payments Service - Pydantic Schemas
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from enum import Enum
from datetime import datetime


class SyncStatus(str, Enum):
    """Sync status."""
    PENDING = "PENDING"
    SYNCING = "SYNCING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


class OfflinePaymentRequest(BaseModel):
    """Offline payment request."""
    transaction_id: str = Field(..., min_length=1, max_length=100)
    payer_id: str = Field(..., min_length=1, max_length=100)
    payee_id: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    offline_signature: str = Field(..., description="Cryptographic signature")
    device_id: str = Field(..., min_length=1, max_length=100)
    timestamp: str
    
    @validator('currency')
    def validate_currency(cls, v):
        return v.upper()


class OfflinePaymentResponse(BaseModel):
    """Offline payment response."""
    transaction_id: str
    status: SyncStatus
    message: str
    synced_at: Optional[str] = None


class SyncRequest(BaseModel):
    """Sync request."""
    device_id: str = Field(..., min_length=1, max_length=100)
    transactions: List[OfflinePaymentRequest] = Field(..., min_items=1, max_items=100)


class SyncResponse(BaseModel):
    """Sync response."""
    device_id: str
    total_count: int
    synced_count: int
    failed_count: int
    timestamp: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    version: str
