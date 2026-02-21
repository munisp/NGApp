"""
Remitly Integration Service - Production Implementation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
from decimal import Decimal
import uvicorn
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Remitly Integration", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class TransferStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class RemitlyTransfer(BaseModel):
    transfer_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    from_currency: str
    to_currency: str
    amount: Decimal
    fee: Decimal
    total: Decimal
    recipient_name: str
    recipient_account: str
    reference: str = Field(default_factory=lambda: f"REM{uuid.uuid4().hex[:12].upper()}")
    status: TransferStatus = TransferStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CreateTransferRequest(BaseModel):
    user_id: str
    from_currency: str
    to_currency: str
    amount: Decimal
    recipient_name: str
    recipient_account: str

transfers_db: Dict[str, RemitlyTransfer] = {}

class RemitlyService:
    @staticmethod
    async def create_transfer(request: CreateTransferRequest) -> RemitlyTransfer:
        fee = request.amount * Decimal("0.01")
        transfer = RemitlyTransfer(
            user_id=request.user_id,
            from_currency=request.from_currency,
            to_currency=request.to_currency,
            amount=request.amount,
            fee=fee,
            total=request.amount + fee,
            recipient_name=request.recipient_name,
            recipient_account=request.recipient_account
        )
        transfers_db[transfer.transfer_id] = transfer
        logger.info(f"Created Remitly transfer {transfer.transfer_id}")
        return transfer

@app.post("/api/v1/transfers", response_model=RemitlyTransfer)
async def create_transfer(request: CreateTransferRequest):
    return await RemitlyService.create_transfer(request)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "remitly-integration", "version": "2.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8077)
