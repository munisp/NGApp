#!/usr/bin/env python3
"""
Implement remaining service routers and schemas
"""

import os
from pathlib import Path

# Offline Payments Schemas
offline_payments_schemas = '''"""
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
'''

# Offline Payments Routers
offline_payments_routers = '''"""
Offline Payments Service - API Routers
"""

import logging
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, BackgroundTasks

from .schemas import (
    OfflinePaymentRequest,
    OfflinePaymentResponse,
    SyncRequest,
    SyncResponse,
    HealthResponse,
    SyncStatus
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/offline", tags=["Offline Payments"])

# In-memory storage
offline_transactions = {}


@router.post("/sync", response_model=SyncResponse)
async def sync_offline_payments(
    request: SyncRequest,
    background_tasks: BackgroundTasks
):
    """
    Sync offline payments to the main ledger.
    
    Args:
        request: Sync request with offline transactions
        
    Returns:
        SyncResponse with sync results
    """
    synced_count = 0
    failed_count = 0
    
    try:
        for txn in request.transactions:
            try:
                # Verify signature
                if not verify_offline_signature(txn.offline_signature, txn.transaction_id):
                    logger.warning(f"Invalid signature for transaction {txn.transaction_id}")
                    failed_count += 1
                    continue
                
                # Store transaction
                offline_transactions[txn.transaction_id] = {
                    "status": SyncStatus.SYNCED,
                    "data": txn.dict(),
                    "synced_at": datetime.utcnow().isoformat()
                }
                
                synced_count += 1
                logger.info(f"Synced offline transaction {txn.transaction_id}")
                
            except Exception as e:
                logger.error(f"Failed to sync transaction {txn.transaction_id}: {e}")
                failed_count += 1
        
        return SyncResponse(
            device_id=request.device_id,
            total_count=len(request.transactions),
            synced_count=synced_count,
            failed_count=failed_count,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit", response_model=OfflinePaymentResponse)
async def submit_offline_payment(request: OfflinePaymentRequest):
    """
    Submit a single offline payment.
    
    Args:
        request: Offline payment request
        
    Returns:
        OfflinePaymentResponse
    """
    try:
        # Verify signature
        if not verify_offline_signature(request.offline_signature, request.transaction_id):
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Store transaction
        offline_transactions[request.transaction_id] = {
            "status": SyncStatus.SYNCED,
            "data": request.dict(),
            "synced_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Submitted offline payment {request.transaction_id}")
        
        return OfflinePaymentResponse(
            transaction_id=request.transaction_id,
            status=SyncStatus.SYNCED,
            message="Offline payment submitted successfully",
            synced_at=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0"
    )


def verify_offline_signature(signature: str, transaction_id: str) -> bool:
    """Verify offline transaction signature."""
    # In production, implement proper cryptographic verification
    return len(signature) > 10
'''

# Fraud Detection Schemas
fraud_detection_schemas = '''"""
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
'''

# Fraud Detection Routers
fraud_detection_routers = '''"""
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
'''

# Write files
def write_file(path, content):
    """Write content to file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f"Created: {path}")

# Offline Payments
write_file(
    "/home/ubuntu/nextgen-payment-switch/services/offline-payments/schemas.py",
    offline_payments_schemas
)
write_file(
    "/home/ubuntu/nextgen-payment-switch/services/offline-payments/routers.py",
    offline_payments_routers
)

# Fraud Detection
write_file(
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection/schemas.py",
    fraud_detection_schemas
)
write_file(
    "/home/ubuntu/nextgen-payment-switch/services/fraud-detection/routers.py",
    fraud_detection_routers
)

print("\nAll router and schema files created successfully!")
