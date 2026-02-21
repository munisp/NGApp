"""
Bank Verification Service - Production Implementation
Verify bank accounts and resolve account names
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
import uvicorn
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Bank Verification Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Enums
class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    FAILED = "failed"
    PENDING = "pending"

# Models
class BankInfo(BaseModel):
    bank_code: str
    bank_name: str
    logo_url: Optional[str] = None

class VerificationRequest(BaseModel):
    account_number: str
    bank_code: str

class VerificationResult(BaseModel):
    verification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_number: str
    bank_code: str
    bank_name: str
    account_name: Optional[str] = None
    status: VerificationStatus
    verified_at: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None

# Storage
banks_db: Dict[str, BankInfo] = {
    "044": BankInfo(bank_code="044", bank_name="Access Bank"),
    "063": BankInfo(bank_code="063", bank_name="Diamond Bank"),
    "050": BankInfo(bank_code="050", bank_name="Ecobank"),
    "084": BankInfo(bank_code="084", bank_name="Enterprise Bank"),
    "070": BankInfo(bank_code="070", bank_name="Fidelity Bank"),
    "011": BankInfo(bank_code="011", bank_name="First Bank"),
    "214": BankInfo(bank_code="214", bank_name="FCMB"),
    "058": BankInfo(bank_code="058", bank_name="GTBank"),
    "030": BankInfo(bank_code="030", bank_name="Heritage Bank"),
    "301": BankInfo(bank_code="301", bank_name="Jaiz Bank"),
    "082": BankInfo(bank_code="082", bank_name="Keystone Bank"),
    "526": BankInfo(bank_code="526", bank_name="Parallex Bank"),
    "076": BankInfo(bank_code="076", bank_name="Polaris Bank"),
    "101": BankInfo(bank_code="101", bank_name="Providus Bank"),
    "221": BankInfo(bank_code="221", bank_name="Stanbic IBTC"),
    "068": BankInfo(bank_code="068", bank_name="Standard Chartered"),
    "232": BankInfo(bank_code="232", bank_name="Sterling Bank"),
    "100": BankInfo(bank_code="100", bank_name="Suntrust Bank"),
    "032": BankInfo(bank_code="032", bank_name="Union Bank"),
    "033": BankInfo(bank_code="033", bank_name="UBA"),
    "215": BankInfo(bank_code="215", bank_name="Unity Bank"),
    "035": BankInfo(bank_code="035", bank_name="Wema Bank"),
    "057": BankInfo(bank_code="057", bank_name="Zenith Bank"),
}

verifications_db: Dict[str, VerificationResult] = {}

class BankVerificationService:
    
    @staticmethod
    async def get_banks() -> List[BankInfo]:
        """Get list of banks"""
        return list(banks_db.values())
    
    @staticmethod
    async def get_bank(bank_code: str) -> BankInfo:
        """Get bank by code"""
        
        if bank_code not in banks_db:
            raise HTTPException(status_code=404, detail="Bank not found")
        
        return banks_db[bank_code]
    
    @staticmethod
    async def verify_account(request: VerificationRequest) -> VerificationResult:
        """Verify bank account"""
        
        # Validate bank
        if request.bank_code not in banks_db:
            raise HTTPException(status_code=404, detail="Bank not found")
        
        bank = banks_db[request.bank_code]
        
        # Validate account number format
        if not request.account_number.isdigit():
            raise HTTPException(status_code=400, detail="Invalid account number format")
        
        if len(request.account_number) != 10:
            raise HTTPException(status_code=400, detail="Account number must be 10 digits")
        
        # Simulate verification (in production, call actual bank API)
        # For demo, generate account name based on account number
        account_name = f"JOHN DOE {request.account_number[-4:]}"
        
        result = VerificationResult(
            account_number=request.account_number,
            bank_code=request.bank_code,
            bank_name=bank.bank_name,
            account_name=account_name,
            status=VerificationStatus.VERIFIED
        )
        
        # Store
        verifications_db[result.verification_id] = result
        
        logger.info(f"Verified account {request.account_number} at {bank.bank_name}")
        return result
    
    @staticmethod
    async def get_verification(verification_id: str) -> VerificationResult:
        """Get verification result"""
        
        if verification_id not in verifications_db:
            raise HTTPException(status_code=404, detail="Verification not found")
        
        return verifications_db[verification_id]
    
    @staticmethod
    async def list_verifications(limit: int = 50) -> List[VerificationResult]:
        """List verifications"""
        
        verifications = list(verifications_db.values())
        verifications.sort(key=lambda x: x.verified_at, reverse=True)
        return verifications[:limit]

# API Endpoints
@app.get("/api/v1/banks", response_model=List[BankInfo])
async def get_banks():
    return await BankVerificationService.get_banks()

@app.get("/api/v1/banks/{bank_code}", response_model=BankInfo)
async def get_bank(bank_code: str):
    return await BankVerificationService.get_bank(bank_code)

@app.post("/api/v1/verify", response_model=VerificationResult)
async def verify_account(request: VerificationRequest):
    return await BankVerificationService.verify_account(request)

@app.get("/api/v1/verifications/{verification_id}", response_model=VerificationResult)
async def get_verification(verification_id: str):
    return await BankVerificationService.get_verification(verification_id)

@app.get("/api/v1/verifications", response_model=List[VerificationResult])
async def list_verifications(limit: int = 50):
    return await BankVerificationService.list_verifications(limit)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "bank-verification",
        "version": "2.0.0",
        "total_banks": len(banks_db),
        "total_verifications": len(verifications_db),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8075)
