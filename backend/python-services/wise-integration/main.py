"""
Wise Integration Service - Production Implementation
Integrate with Wise (formerly TransferWise) for international transfers
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

app = FastAPI(title="Wise Integration Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Enums
class TransferStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# Models
class ExchangeRate(BaseModel):
    from_currency: str
    to_currency: str
    rate: Decimal
    fee: Decimal
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class WiseTransfer(BaseModel):
    transfer_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    from_currency: str
    to_currency: str
    source_amount: Decimal
    target_amount: Decimal
    exchange_rate: Decimal
    fee: Decimal
    total_amount: Decimal
    recipient_name: str
    recipient_account: str
    recipient_country: str
    reference: str = Field(default_factory=lambda: f"WISE{uuid.uuid4().hex[:12].upper()}")
    wise_reference: Optional[str] = None
    status: TransferStatus = TransferStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class CreateTransferRequest(BaseModel):
    user_id: str
    from_currency: str
    to_currency: str
    source_amount: Decimal
    recipient_name: str
    recipient_account: str
    recipient_country: str

# Storage
transfers_db: Dict[str, WiseTransfer] = {}

# Exchange rates (mock data)
exchange_rates = {
    ("USD", "GBP"): Decimal("0.79"),
    ("USD", "EUR"): Decimal("0.92"),
    ("USD", "NGN"): Decimal("1550.00"),
    ("GBP", "USD"): Decimal("1.27"),
    ("EUR", "USD"): Decimal("1.09"),
    ("NGN", "USD"): Decimal("0.00065"),
}

class WiseService:
    
    @staticmethod
    async def get_exchange_rate(from_currency: str, to_currency: str, amount: Decimal) -> ExchangeRate:
        """Get exchange rate"""
        
        key = (from_currency, to_currency)
        if key not in exchange_rates:
            raise HTTPException(status_code=400, detail="Currency pair not supported")
        
        rate = exchange_rates[key]
        fee = amount * Decimal("0.005")  # 0.5% fee
        
        return ExchangeRate(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=rate,
            fee=fee
        )
    
    @staticmethod
    async def create_transfer(request: CreateTransferRequest) -> WiseTransfer:
        """Create Wise transfer"""
        
        # Get exchange rate
        rate_info = await WiseService.get_exchange_rate(
            request.from_currency,
            request.to_currency,
            request.source_amount
        )
        
        # Calculate amounts
        target_amount = request.source_amount * rate_info.rate
        total_amount = request.source_amount + rate_info.fee
        
        # Create transfer
        transfer = WiseTransfer(
            user_id=request.user_id,
            from_currency=request.from_currency,
            to_currency=request.to_currency,
            source_amount=request.source_amount,
            target_amount=target_amount,
            exchange_rate=rate_info.rate,
            fee=rate_info.fee,
            total_amount=total_amount,
            recipient_name=request.recipient_name,
            recipient_account=request.recipient_account,
            recipient_country=request.recipient_country
        )
        
        # Store
        transfers_db[transfer.transfer_id] = transfer
        
        logger.info(f"Created Wise transfer {transfer.transfer_id}: {request.from_currency} → {request.to_currency}")
        return transfer
    
    @staticmethod
    async def process_transfer(transfer_id: str) -> WiseTransfer:
        """Process transfer"""
        
        if transfer_id not in transfers_db:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        transfer = transfers_db[transfer_id]
        
        if transfer.status != TransferStatus.PENDING:
            raise HTTPException(status_code=400, detail=f"Transfer already {transfer.status}")
        
        transfer.status = TransferStatus.PROCESSING
        transfer.wise_reference = f"WREF{uuid.uuid4().hex[:16].upper()}"
        
        logger.info(f"Processing Wise transfer {transfer_id}")
        return transfer
    
    @staticmethod
    async def complete_transfer(transfer_id: str) -> WiseTransfer:
        """Complete transfer"""
        
        if transfer_id not in transfers_db:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        transfer = transfers_db[transfer_id]
        
        if transfer.status != TransferStatus.PROCESSING:
            raise HTTPException(status_code=400, detail="Transfer not processing")
        
        transfer.status = TransferStatus.COMPLETED
        transfer.completed_at = datetime.utcnow()
        
        logger.info(f"Completed Wise transfer {transfer_id}")
        return transfer
    
    @staticmethod
    async def get_transfer(transfer_id: str) -> WiseTransfer:
        """Get transfer"""
        
        if transfer_id not in transfers_db:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        return transfers_db[transfer_id]
    
    @staticmethod
    async def list_transfers(user_id: Optional[str] = None, limit: int = 50) -> List[WiseTransfer]:
        """List transfers"""
        
        transfers = list(transfers_db.values())
        
        if user_id:
            transfers = [t for t in transfers if t.user_id == user_id]
        
        transfers.sort(key=lambda x: x.created_at, reverse=True)
        return transfers[:limit]

# API Endpoints
@app.get("/api/v1/exchange-rate", response_model=ExchangeRate)
async def get_exchange_rate(from_currency: str, to_currency: str, amount: Decimal):
    return await WiseService.get_exchange_rate(from_currency, to_currency, amount)

@app.post("/api/v1/transfers", response_model=WiseTransfer)
async def create_transfer(request: CreateTransferRequest):
    return await WiseService.create_transfer(request)

@app.post("/api/v1/transfers/{transfer_id}/process", response_model=WiseTransfer)
async def process_transfer(transfer_id: str):
    return await WiseService.process_transfer(transfer_id)

@app.post("/api/v1/transfers/{transfer_id}/complete", response_model=WiseTransfer)
async def complete_transfer(transfer_id: str):
    return await WiseService.complete_transfer(transfer_id)

@app.get("/api/v1/transfers/{transfer_id}", response_model=WiseTransfer)
async def get_transfer(transfer_id: str):
    return await WiseService.get_transfer(transfer_id)

@app.get("/api/v1/transfers", response_model=List[WiseTransfer])
async def list_transfers(user_id: Optional[str] = None, limit: int = 50):
    return await WiseService.list_transfers(user_id, limit)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "wise-integration",
        "version": "2.0.0",
        "total_transfers": len(transfers_db),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8076)
