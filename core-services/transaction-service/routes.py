"""
API routes for transaction-service with idempotency support

All money-moving endpoints use idempotency keys to prevent duplicate transactions
when clients retry failed requests (critical for offline-first architecture).
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import uuid
import logging

from .models import TransactionServiceModel
from .service import TransactionServiceService
from .database import get_db
from .idempotency import IdempotencyService
from .lakehouse_publisher import publish_transaction_to_lakehouse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


# ==================== Request/Response Schemas ====================

class TransferRequest(BaseModel):
    """Request schema for money transfer"""
    recipient_name: str = Field(..., min_length=1, max_length=200)
    recipient_phone: str = Field(..., min_length=10, max_length=20)
    recipient_bank: Optional[str] = None
    recipient_account: Optional[str] = None
    amount: float = Field(..., gt=0)
    source_currency: str = Field(..., min_length=3, max_length=3)
    destination_currency: str = Field(..., min_length=3, max_length=3)
    exchange_rate: Optional[float] = None
    fee: Optional[float] = 0.0
    delivery_method: str = Field(default="bank_transfer")
    note: Optional[str] = None


class TransferResponse(BaseModel):
    """Response schema for money transfer"""
    transaction_id: str
    status: str
    amount: float
    currency: str
    fee: float
    total_amount: float
    recipient_name: str
    reference_number: str
    created_at: str
    is_duplicate: bool = False
    message: str = "Transfer initiated successfully"


class TransactionStatusResponse(BaseModel):
    """Response schema for transaction status"""
    transaction_id: str
    status: str
    amount: float
    currency: str
    fee: float
    recipient_name: Optional[str] = None
    reference_number: str
    created_at: str
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


# ==================== Helper Functions ====================

def get_user_id_from_request(request: Request) -> str:
    """Extract user ID from request (from auth token in production)."""
    user_id = request.headers.get("X-User-ID", "anonymous")
    return user_id


# ==================== Money-Moving Endpoints (with Idempotency) ====================

@router.post("/transfer", response_model=TransferResponse)
async def create_transfer(
    transfer: TransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
):
    """
    Create a money transfer with idempotency support.
    
    If Idempotency-Key header is provided:
    - First request: Process transfer and store result
    - Duplicate request: Return stored result without reprocessing
    """
    user_id = get_user_id_from_request(request)
    
    if not idempotency_key:
        idempotency_key = str(uuid.uuid4())
    
    # Check for duplicate request
    idempotency_service = IdempotencyService(db)
    existing = await idempotency_service.check_idempotency(idempotency_key, user_id)
    
    if existing:
        logger.info(f"Duplicate transfer request: {idempotency_key}")
        response_data = existing.get("response", {})
        return TransferResponse(
            transaction_id=existing["transaction_id"],
            status=response_data.get("status", "completed"),
            amount=response_data.get("amount", transfer.amount),
            currency=response_data.get("currency", transfer.source_currency),
            fee=response_data.get("fee", transfer.fee or 0),
            total_amount=response_data.get("total_amount", transfer.amount + (transfer.fee or 0)),
            recipient_name=response_data.get("recipient_name", transfer.recipient_name),
            reference_number=response_data.get("reference_number", ""),
            created_at=existing["created_at"],
            is_duplicate=True,
            message="Duplicate request - returning original result"
        )
    
    # Process new transfer
    try:
        service = TransactionServiceService()
        fee = transfer.fee or 0.0
        total_amount = transfer.amount + fee
        
        transaction_data = {
            "user_id": user_id,
            "transaction_type": "transfer",
            "amount": transfer.amount,
            "currency": transfer.source_currency,
            "destination_currency": transfer.destination_currency,
            "exchange_rate": transfer.exchange_rate,
            "fee": fee,
            "total_amount": total_amount,
            "recipient_name": transfer.recipient_name,
            "recipient_phone": transfer.recipient_phone,
            "recipient_bank": transfer.recipient_bank,
            "recipient_account": transfer.recipient_account,
            "delivery_method": transfer.delivery_method,
            "note": transfer.note,
            "status": "pending",
            "idempotency_key": idempotency_key
        }
        
        result = await service.create(transaction_data)
        transaction_id = result.get("id", str(uuid.uuid4()))
        reference_number = result.get("reference_number", f"TXN{transaction_id[:8].upper()}")
        created_at = result.get("created_at", "")
        
        response_data = {
            "transaction_id": transaction_id,
            "status": "pending",
            "amount": transfer.amount,
            "currency": transfer.source_currency,
            "fee": fee,
            "total_amount": total_amount,
            "recipient_name": transfer.recipient_name,
            "reference_number": reference_number,
            "created_at": created_at
        }
        
        await idempotency_service.store_idempotency(
            idempotency_key=idempotency_key,
            user_id=user_id,
            transaction_id=transaction_id,
            response_data=response_data
        )
        
        # Publish transaction event to lakehouse for analytics (fire-and-forget)
        await publish_transaction_to_lakehouse(
            transaction_id=transaction_id,
            user_id=user_id,
            event_type="created",
            transaction_data=transaction_data
        )
        
        return TransferResponse(**response_data, is_duplicate=False)
        
    except Exception as e:
        logger.error(f"Transfer failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")


@router.get("/transfer/{transaction_id}", response_model=TransactionStatusResponse)
async def get_transfer_status(transaction_id: str, request: Request):
    """Get the status of a transfer by transaction ID."""
    service = TransactionServiceService()
    result = await service.get(transaction_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return TransactionStatusResponse(
        transaction_id=result.get("id", transaction_id),
        status=result.get("status", "unknown"),
        amount=result.get("amount", 0),
        currency=result.get("currency", "NGN"),
        fee=result.get("fee", 0),
        recipient_name=result.get("recipient_name"),
        reference_number=result.get("reference_number", ""),
        created_at=result.get("created_at", ""),
        updated_at=result.get("updated_at"),
        completed_at=result.get("completed_at")
    )


@router.get("/history")
async def get_transaction_history(
    request: Request,
    skip: int = 0,
    limit: int = 50
):
    """Get transaction history for the authenticated user."""
    user_id = get_user_id_from_request(request)
    service = TransactionServiceService()
    return await service.list(skip, limit)


# ==================== Legacy Endpoints ====================

@router.post("/", response_model=TransactionServiceModel)
async def create(data: dict):
    service = TransactionServiceService()
    return await service.create(data)


@router.get("/{id}", response_model=TransactionServiceModel)
async def get(id: str):
    service = TransactionServiceService()
    result = await service.get(id)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result


@router.get("/", response_model=List[TransactionServiceModel])
async def list_all(skip: int = 0, limit: int = 100):
    service = TransactionServiceService()
    return await service.list(skip, limit)


@router.put("/{id}", response_model=TransactionServiceModel)
async def update(id: str, data: dict):
    service = TransactionServiceService()
    return await service.update(id, data)


@router.delete("/{id}")
async def delete(id: str):
    service = TransactionServiceService()
    await service.delete(id)
    return {"message": "Deleted successfully"}


# ==================== Idempotency Management ====================

@router.post("/idempotency/cleanup")
async def cleanup_expired_idempotency(db: Session = Depends(get_db)):
    """Clean up expired idempotency records (call via cron job)."""
    idempotency_service = IdempotencyService(db)
    count = await idempotency_service.cleanup_expired()
    return {"message": f"Cleaned up {count} expired idempotency records"}
