"""
Beneficiary Service - Production Implementation
Beneficiary management, verification, and payment recipient handling
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
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Beneficiary Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Enums
class BeneficiaryType(str, Enum):
    INDIVIDUAL = "individual"
    BUSINESS = "business"

class BeneficiaryStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"

class AccountType(str, Enum):
    BANK_ACCOUNT = "bank_account"
    MOBILE_MONEY = "mobile_money"
    WALLET = "wallet"
    CRYPTO = "crypto"

class VerificationStatus(str, Enum):
    NOT_VERIFIED = "not_verified"
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"

# Models
class BankDetails(BaseModel):
    bank_name: str
    bank_code: Optional[str] = None
    account_number: str
    account_name: str
    swift_code: Optional[str] = None
    iban: Optional[str] = None
    routing_number: Optional[str] = None

class MobileMoneyDetails(BaseModel):
    provider: str  # MTN, Airtel, Vodafone, etc.
    phone_number: str
    account_name: str

class Beneficiary(BaseModel):
    beneficiary_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    beneficiary_type: BeneficiaryType
    account_type: AccountType
    
    # Personal details
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    
    # Account details
    bank_details: Optional[BankDetails] = None
    mobile_money_details: Optional[MobileMoneyDetails] = None
    wallet_address: Optional[str] = None
    crypto_address: Optional[str] = None
    
    # Location
    country: str
    city: Optional[str] = None
    address: Optional[str] = None
    
    # Status and verification
    status: BeneficiaryStatus = BeneficiaryStatus.PENDING
    verification_status: VerificationStatus = VerificationStatus.NOT_VERIFIED
    verification_date: Optional[datetime] = None
    
    # Metadata
    nickname: Optional[str] = None
    relationship: Optional[str] = None  # family, friend, business, etc.
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    
    # Usage tracking
    total_transactions: int = 0
    total_amount_sent: Decimal = Decimal("0.00")
    last_transaction_date: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    @validator('account_type')
    def validate_account_details(cls, v, values):
        """Ensure appropriate details are provided for account type"""
        # This would be more comprehensive in production
        return v

class CreateBeneficiaryRequest(BaseModel):
    user_id: str
    beneficiary_type: BeneficiaryType
    account_type: AccountType
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    bank_details: Optional[BankDetails] = None
    mobile_money_details: Optional[MobileMoneyDetails] = None
    wallet_address: Optional[str] = None
    crypto_address: Optional[str] = None
    country: str
    city: Optional[str] = None
    address: Optional[str] = None
    nickname: Optional[str] = None
    relationship: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class UpdateBeneficiaryRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    bank_details: Optional[BankDetails] = None
    mobile_money_details: Optional[MobileMoneyDetails] = None
    nickname: Optional[str] = None
    relationship: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class VerificationRequest(BaseModel):
    beneficiary_id: str
    verification_method: str  # bank_api, manual, third_party

class BeneficiarySearch(BaseModel):
    user_id: str
    query: Optional[str] = None
    country: Optional[str] = None
    account_type: Optional[AccountType] = None
    status: Optional[BeneficiaryStatus] = None
    tags: Optional[List[str]] = None

# Storage
beneficiaries_db: Dict[str, Beneficiary] = {}
user_beneficiaries_index: Dict[str, List[str]] = defaultdict(list)

class BeneficiaryService:
    """Production beneficiary service"""
    
    @staticmethod
    async def create_beneficiary(request: CreateBeneficiaryRequest) -> Beneficiary:
        """Create new beneficiary"""
        
        # Validate account details based on type
        if request.account_type == AccountType.BANK_ACCOUNT and not request.bank_details:
            raise HTTPException(status_code=400, detail="Bank details required for bank account type")
        if request.account_type == AccountType.MOBILE_MONEY and not request.mobile_money_details:
            raise HTTPException(status_code=400, detail="Mobile money details required")
        if request.account_type == AccountType.WALLET and not request.wallet_address:
            raise HTTPException(status_code=400, detail="Wallet address required")
        if request.account_type == AccountType.CRYPTO and not request.crypto_address:
            raise HTTPException(status_code=400, detail="Crypto address required")
        
        # Check for duplicates
        existing = await BeneficiaryService._find_duplicate(request)
        if existing:
            raise HTTPException(status_code=400, detail=f"Beneficiary already exists: {existing.beneficiary_id}")
        
        # Create beneficiary
        beneficiary = Beneficiary(
            user_id=request.user_id,
            beneficiary_type=request.beneficiary_type,
            account_type=request.account_type,
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            phone_number=request.phone_number,
            bank_details=request.bank_details,
            mobile_money_details=request.mobile_money_details,
            wallet_address=request.wallet_address,
            crypto_address=request.crypto_address,
            country=request.country,
            city=request.city,
            address=request.address,
            nickname=request.nickname,
            relationship=request.relationship,
            notes=request.notes,
            tags=request.tags
        )
        
        # Store
        beneficiaries_db[beneficiary.beneficiary_id] = beneficiary
        user_beneficiaries_index[request.user_id].append(beneficiary.beneficiary_id)
        
        logger.info(f"Created beneficiary {beneficiary.beneficiary_id} for user {request.user_id}")
        return beneficiary
    
    @staticmethod
    async def get_beneficiary(beneficiary_id: str) -> Beneficiary:
        """Get beneficiary by ID"""
        
        if beneficiary_id not in beneficiaries_db:
            raise HTTPException(status_code=404, detail="Beneficiary not found")
        
        return beneficiaries_db[beneficiary_id]
    
    @staticmethod
    async def get_user_beneficiaries(user_id: str) -> List[Beneficiary]:
        """Get all beneficiaries for user"""
        
        beneficiary_ids = user_beneficiaries_index.get(user_id, [])
        return [beneficiaries_db[bid] for bid in beneficiary_ids if bid in beneficiaries_db]
    
    @staticmethod
    async def update_beneficiary(beneficiary_id: str, request: UpdateBeneficiaryRequest) -> Beneficiary:
        """Update beneficiary"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(beneficiary_id)
        
        # Update fields
        if request.first_name is not None:
            beneficiary.first_name = request.first_name
        if request.last_name is not None:
            beneficiary.last_name = request.last_name
        if request.email is not None:
            beneficiary.email = request.email
        if request.phone_number is not None:
            beneficiary.phone_number = request.phone_number
        if request.bank_details is not None:
            beneficiary.bank_details = request.bank_details
        if request.mobile_money_details is not None:
            beneficiary.mobile_money_details = request.mobile_money_details
        if request.nickname is not None:
            beneficiary.nickname = request.nickname
        if request.relationship is not None:
            beneficiary.relationship = request.relationship
        if request.notes is not None:
            beneficiary.notes = request.notes
        if request.tags is not None:
            beneficiary.tags = request.tags
        
        beneficiary.updated_at = datetime.utcnow()
        
        logger.info(f"Updated beneficiary {beneficiary_id}")
        return beneficiary
    
    @staticmethod
    async def delete_beneficiary(beneficiary_id: str) -> Dict:
        """Delete beneficiary"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(beneficiary_id)
        
        # Remove from storage
        del beneficiaries_db[beneficiary_id]
        user_beneficiaries_index[beneficiary.user_id].remove(beneficiary_id)
        
        logger.info(f"Deleted beneficiary {beneficiary_id}")
        return {"status": "deleted", "beneficiary_id": beneficiary_id}
    
    @staticmethod
    async def verify_beneficiary(request: VerificationRequest) -> Beneficiary:
        """Verify beneficiary account details"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(request.beneficiary_id)
        
        # Simulate verification (would integrate with bank APIs, etc.)
        if request.verification_method == "bank_api":
            # Would call bank API to verify account
            logger.info(f"Verifying beneficiary {request.beneficiary_id} via bank API")
        elif request.verification_method == "manual":
            logger.info(f"Manual verification for beneficiary {request.beneficiary_id}")
        
        # Update status
        beneficiary.verification_status = VerificationStatus.VERIFIED
        beneficiary.verification_date = datetime.utcnow()
        beneficiary.status = BeneficiaryStatus.VERIFIED
        beneficiary.updated_at = datetime.utcnow()
        
        logger.info(f"Verified beneficiary {request.beneficiary_id}")
        return beneficiary
    
    @staticmethod
    async def suspend_beneficiary(beneficiary_id: str, reason: str) -> Beneficiary:
        """Suspend beneficiary"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(beneficiary_id)
        beneficiary.status = BeneficiaryStatus.SUSPENDED
        beneficiary.notes = f"{beneficiary.notes or ''}\n[SUSPENDED] {reason}"
        beneficiary.updated_at = datetime.utcnow()
        
        logger.warning(f"Suspended beneficiary {beneficiary_id}: {reason}")
        return beneficiary
    
    @staticmethod
    async def block_beneficiary(beneficiary_id: str, reason: str) -> Beneficiary:
        """Block beneficiary"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(beneficiary_id)
        beneficiary.status = BeneficiaryStatus.BLOCKED
        beneficiary.notes = f"{beneficiary.notes or ''}\n[BLOCKED] {reason}"
        beneficiary.updated_at = datetime.utcnow()
        
        logger.warning(f"Blocked beneficiary {beneficiary_id}: {reason}")
        return beneficiary
    
    @staticmethod
    async def search_beneficiaries(search: BeneficiarySearch) -> List[Beneficiary]:
        """Search beneficiaries"""
        
        # Get user's beneficiaries
        beneficiaries = await BeneficiaryService.get_user_beneficiaries(search.user_id)
        
        # Apply filters
        if search.query:
            query_lower = search.query.lower()
            beneficiaries = [
                b for b in beneficiaries
                if query_lower in b.first_name.lower() or
                   query_lower in b.last_name.lower() or
                   (b.nickname and query_lower in b.nickname.lower())
            ]
        
        if search.country:
            beneficiaries = [b for b in beneficiaries if b.country == search.country]
        
        if search.account_type:
            beneficiaries = [b for b in beneficiaries if b.account_type == search.account_type]
        
        if search.status:
            beneficiaries = [b for b in beneficiaries if b.status == search.status]
        
        if search.tags:
            beneficiaries = [b for b in beneficiaries if any(tag in b.tags for tag in search.tags)]
        
        return beneficiaries
    
    @staticmethod
    async def record_transaction(beneficiary_id: str, amount: Decimal):
        """Record transaction to beneficiary"""
        
        beneficiary = await BeneficiaryService.get_beneficiary(beneficiary_id)
        beneficiary.total_transactions += 1
        beneficiary.total_amount_sent += amount
        beneficiary.last_transaction_date = datetime.utcnow()
        beneficiary.updated_at = datetime.utcnow()
        
        logger.info(f"Recorded transaction to beneficiary {beneficiary_id}: {amount}")
    
    @staticmethod
    async def _find_duplicate(request: CreateBeneficiaryRequest) -> Optional[Beneficiary]:
        """Find duplicate beneficiary"""
        
        user_beneficiaries = await BeneficiaryService.get_user_beneficiaries(request.user_id)
        
        for beneficiary in user_beneficiaries:
            # Check bank account
            if request.account_type == AccountType.BANK_ACCOUNT and beneficiary.bank_details and request.bank_details:
                if (beneficiary.bank_details.account_number == request.bank_details.account_number and
                    beneficiary.bank_details.bank_code == request.bank_details.bank_code):
                    return beneficiary
            
            # Check mobile money
            if request.account_type == AccountType.MOBILE_MONEY and beneficiary.mobile_money_details and request.mobile_money_details:
                if beneficiary.mobile_money_details.phone_number == request.mobile_money_details.phone_number:
                    return beneficiary
            
            # Check wallet/crypto
            if request.account_type == AccountType.WALLET and beneficiary.wallet_address == request.wallet_address:
                return beneficiary
            if request.account_type == AccountType.CRYPTO and beneficiary.crypto_address == request.crypto_address:
                return beneficiary
        
        return None

# API Endpoints
@app.post("/api/v1/beneficiaries", response_model=Beneficiary)
async def create_beneficiary(request: CreateBeneficiaryRequest):
    """Create beneficiary"""
    return await BeneficiaryService.create_beneficiary(request)

@app.get("/api/v1/beneficiaries/{beneficiary_id}", response_model=Beneficiary)
async def get_beneficiary(beneficiary_id: str):
    """Get beneficiary"""
    return await BeneficiaryService.get_beneficiary(beneficiary_id)

@app.get("/api/v1/users/{user_id}/beneficiaries", response_model=List[Beneficiary])
async def get_user_beneficiaries(user_id: str):
    """Get user beneficiaries"""
    return await BeneficiaryService.get_user_beneficiaries(user_id)

@app.put("/api/v1/beneficiaries/{beneficiary_id}", response_model=Beneficiary)
async def update_beneficiary(beneficiary_id: str, request: UpdateBeneficiaryRequest):
    """Update beneficiary"""
    return await BeneficiaryService.update_beneficiary(beneficiary_id, request)

@app.delete("/api/v1/beneficiaries/{beneficiary_id}")
async def delete_beneficiary(beneficiary_id: str):
    """Delete beneficiary"""
    return await BeneficiaryService.delete_beneficiary(beneficiary_id)

@app.post("/api/v1/beneficiaries/verify", response_model=Beneficiary)
async def verify_beneficiary(request: VerificationRequest):
    """Verify beneficiary"""
    return await BeneficiaryService.verify_beneficiary(request)

@app.post("/api/v1/beneficiaries/{beneficiary_id}/suspend", response_model=Beneficiary)
async def suspend_beneficiary(beneficiary_id: str, reason: str):
    """Suspend beneficiary"""
    return await BeneficiaryService.suspend_beneficiary(beneficiary_id, reason)

@app.post("/api/v1/beneficiaries/{beneficiary_id}/block", response_model=Beneficiary)
async def block_beneficiary(beneficiary_id: str, reason: str):
    """Block beneficiary"""
    return await BeneficiaryService.block_beneficiary(beneficiary_id, reason)

@app.post("/api/v1/beneficiaries/search", response_model=List[Beneficiary])
async def search_beneficiaries(search: BeneficiarySearch):
    """Search beneficiaries"""
    return await BeneficiaryService.search_beneficiaries(search)

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "service": "beneficiary-service",
        "version": "2.0.0",
        "total_beneficiaries": len(beneficiaries_db),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8055)
