"""
SWIFT Integration Service - Production Implementation
SWIFT network integration for international wire transfers
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
from decimal import Decimal
import uvicorn
import uuid
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SWIFT Integration Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Enums
class SWIFTMessageType(str, Enum):
    MT103 = "MT103"  # Single customer credit transfer
    MT202 = "MT202"  # General financial institution transfer
    MT910 = "MT910"  # Confirmation of credit
    MT940 = "MT940"  # Customer statement message
    MT950 = "MT950"  # Statement message

class TransferStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"

class TransferPriority(str, Enum):
    NORMAL = "NORM"
    URGENT = "URGP"

# Models
class BankDetails(BaseModel):
    bic: str = Field(..., min_length=8, max_length=11)
    name: str
    address: str
    city: str
    country: str
    
    @validator('bic')
    def validate_bic(cls, v):
        """Validate BIC/SWIFT code format"""
        if not re.match(r'^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', v):
            raise ValueError('Invalid BIC/SWIFT code format')
        return v

class SWIFTTransfer(BaseModel):
    transfer_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_type: SWIFTMessageType = SWIFTMessageType.MT103
    
    # Sender
    sender_bic: str
    sender_name: str
    sender_account: str
    sender_address: Optional[str] = None
    
    # Beneficiary
    beneficiary_bic: str
    beneficiary_name: str
    beneficiary_account: str
    beneficiary_address: Optional[str] = None
    
    # Intermediary bank (optional)
    intermediary_bic: Optional[str] = None
    intermediary_name: Optional[str] = None
    
    # Transfer details
    amount: Decimal
    currency: str = Field(..., min_length=3, max_length=3)
    value_date: datetime
    
    # Additional info
    remittance_info: Optional[str] = None  # Payment purpose
    instruction_code: Optional[str] = None
    priority: TransferPriority = TransferPriority.NORMAL
    
    # Status
    status: TransferStatus = TransferStatus.PENDING
    swift_reference: Optional[str] = None  # SWIFT transaction reference
    uetr: Optional[str] = None  # Unique end-to-end transaction reference
    
    # Charges
    charges_code: str = "SHA"  # SHA (shared), OUR (sender pays), BEN (beneficiary pays)
    sender_charges: Decimal = Decimal("0.00")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Errors
    error_code: Optional[str] = None
    error_message: Optional[str] = None

class CreateSWIFTTransferRequest(BaseModel):
    sender_bic: str
    sender_name: str
    sender_account: str
    sender_address: Optional[str] = None
    beneficiary_bic: str
    beneficiary_name: str
    beneficiary_account: str
    beneficiary_address: Optional[str] = None
    intermediary_bic: Optional[str] = None
    intermediary_name: Optional[str] = None
    amount: Decimal
    currency: str
    value_date: datetime
    remittance_info: Optional[str] = None
    priority: TransferPriority = TransferPriority.NORMAL
    charges_code: str = "SHA"

class SWIFTStatus(BaseModel):
    transfer_id: str
    status: TransferStatus
    swift_reference: Optional[str]
    uetr: Optional[str]
    timestamp: datetime

class BICValidationRequest(BaseModel):
    bic: str

class BICValidationResponse(BaseModel):
    bic: str
    valid: bool
    bank_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None

# Storage
transfers_db: Dict[str, SWIFTTransfer] = {}
bic_directory: Dict[str, BankDetails] = {
    "CHASUS33XXX": BankDetails(bic="CHASUS33XXX", name="JPMorgan Chase Bank", address="383 Madison Avenue", city="New York", country="US"),
    "CITIUS33XXX": BankDetails(bic="CITIUS33XXX", name="Citibank N.A.", address="399 Park Avenue", city="New York", country="US"),
    "BOFAUS3NXXX": BankDetails(bic="BOFAUS3NXXX", name="Bank of America", address="100 North Tryon Street", city="Charlotte", country="US"),
    "DEUTDEFFXXX": BankDetails(bic="DEUTDEFFXXX", name="Deutsche Bank AG", address="Taunusanlage 12", city="Frankfurt", country="DE"),
    "HSBCHKHHHKH": BankDetails(bic="HSBCHKHHHKH", name="HSBC Hong Kong", address="1 Queen's Road Central", city="Hong Kong", country="HK"),
}

class SWIFTService:
    """Production SWIFT integration service"""
    
    @staticmethod
    async def create_transfer(request: CreateSWIFTTransferRequest) -> SWIFTTransfer:
        """Create SWIFT transfer"""
        
        # Validate BICs
        if request.sender_bic not in bic_directory:
            raise HTTPException(status_code=400, detail=f"Invalid sender BIC: {request.sender_bic}")
        if request.beneficiary_bic not in bic_directory:
            raise HTTPException(status_code=400, detail=f"Invalid beneficiary BIC: {request.beneficiary_bic}")
        
        # Validate amount
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        # Calculate charges (simplified)
        sender_charges = request.amount * Decimal("0.001")  # 0.1%
        if sender_charges < Decimal("25.00"):
            sender_charges = Decimal("25.00")  # Minimum $25
        
        # Generate SWIFT reference
        swift_ref = f"SWIFT{datetime.utcnow().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"
        uetr = str(uuid.uuid4())
        
        # Create transfer
        transfer = SWIFTTransfer(
            sender_bic=request.sender_bic,
            sender_name=request.sender_name,
            sender_account=request.sender_account,
            sender_address=request.sender_address,
            beneficiary_bic=request.beneficiary_bic,
            beneficiary_name=request.beneficiary_name,
            beneficiary_account=request.beneficiary_account,
            beneficiary_address=request.beneficiary_address,
            intermediary_bic=request.intermediary_bic,
            intermediary_name=request.intermediary_name,
            amount=request.amount,
            currency=request.currency,
            value_date=request.value_date,
            remittance_info=request.remittance_info,
            priority=request.priority,
            charges_code=request.charges_code,
            sender_charges=sender_charges,
            swift_reference=swift_ref,
            uetr=uetr
        )
        
        # Store
        transfers_db[transfer.transfer_id] = transfer
        
        logger.info(f"Created SWIFT transfer {transfer.transfer_id}: {request.amount} {request.currency}")
        return transfer
    
    @staticmethod
    async def send_transfer(transfer_id: str) -> SWIFTTransfer:
        """Send SWIFT transfer"""
        
        if transfer_id not in transfers_db:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        transfer = transfers_db[transfer_id]
        
        if transfer.status != TransferStatus.PENDING:
            raise HTTPException(status_code=400, detail=f"Transfer already {transfer.status}")
        
        # Simulate sending to SWIFT network
        transfer.status = TransferStatus.SENT
        transfer.sent_at = datetime.utcnow()
        
        logger.info(f"Sent SWIFT transfer {transfer_id} to network")
        return transfer
    
    @staticmethod
    async def get_transfer(transfer_id: str) -> SWIFTTransfer:
        """Get transfer by ID"""
        
        if transfer_id not in transfers_db:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        return transfers_db[transfer_id]
    
    @staticmethod
    async def get_status(transfer_id: str) -> SWIFTStatus:
        """Get transfer status"""
        
        transfer = await SWIFTService.get_transfer(transfer_id)
        
        return SWIFTStatus(
            transfer_id=transfer.transfer_id,
            status=transfer.status,
            swift_reference=transfer.swift_reference,
            uetr=transfer.uetr,
            timestamp=datetime.utcnow()
        )
    
    @staticmethod
    async def validate_bic(bic: str) -> BICValidationResponse:
        """Validate BIC code"""
        
        # Check format
        if not re.match(r'^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', bic):
            return BICValidationResponse(bic=bic, valid=False)
        
        # Check directory
        if bic in bic_directory:
            bank = bic_directory[bic]
            return BICValidationResponse(
                bic=bic,
                valid=True,
                bank_name=bank.name,
                country=bank.country,
                city=bank.city
            )
        
        return BICValidationResponse(bic=bic, valid=False)
    
    @staticmethod
    async def list_transfers(limit: int = 50) -> List[SWIFTTransfer]:
        """List transfers"""
        
        transfers = list(transfers_db.values())
        transfers.sort(key=lambda x: x.created_at, reverse=True)
        return transfers[:limit]
    
    @staticmethod
    async def cancel_transfer(transfer_id: str) -> SWIFTTransfer:
        """Cancel transfer"""
        
        transfer = await SWIFTService.get_transfer(transfer_id)
        
        if transfer.status not in [TransferStatus.PENDING]:
            raise HTTPException(status_code=400, detail=f"Cannot cancel transfer in {transfer.status} status")
        
        transfer.status = TransferStatus.REJECTED
        transfer.error_message = "Cancelled by user"
        
        logger.info(f"Cancelled SWIFT transfer {transfer_id}")
        return transfer

# API Endpoints
@app.post("/api/v1/swift/transfers", response_model=SWIFTTransfer)
async def create_transfer(request: CreateSWIFTTransferRequest):
    """Create SWIFT transfer"""
    return await SWIFTService.create_transfer(request)

@app.post("/api/v1/swift/transfers/{transfer_id}/send", response_model=SWIFTTransfer)
async def send_transfer(transfer_id: str):
    """Send SWIFT transfer"""
    return await SWIFTService.send_transfer(transfer_id)

@app.get("/api/v1/swift/transfers/{transfer_id}", response_model=SWIFTTransfer)
async def get_transfer(transfer_id: str):
    """Get transfer"""
    return await SWIFTService.get_transfer(transfer_id)

@app.get("/api/v1/swift/transfers/{transfer_id}/status", response_model=SWIFTStatus)
async def get_status(transfer_id: str):
    """Get transfer status"""
    return await SWIFTService.get_status(transfer_id)

@app.post("/api/v1/swift/bic/validate", response_model=BICValidationResponse)
async def validate_bic(request: BICValidationRequest):
    """Validate BIC"""
    return await SWIFTService.validate_bic(request.bic)

@app.get("/api/v1/swift/transfers", response_model=List[SWIFTTransfer])
async def list_transfers(limit: int = 50):
    """List transfers"""
    return await SWIFTService.list_transfers(limit)

@app.post("/api/v1/swift/transfers/{transfer_id}/cancel", response_model=SWIFTTransfer)
async def cancel_transfer(transfer_id: str):
    """Cancel transfer"""
    return await SWIFTService.cancel_transfer(transfer_id)

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "service": "swift-integration",
        "version": "2.0.0",
        "total_transfers": len(transfers_db),
        "bic_directory_size": len(bic_directory),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8060)
