"""
Tiered KYC Service
Manages multi-tier KYC verification with different limits and requirements per tier.

Production-ready version with:
- Structured logging with correlation IDs
- Rate limiting
- Environment-driven CORS configuration
"""

import os
import sys

# Add common modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'common'))

from fastapi import FastAPI, HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
from decimal import Decimal

from property_transaction_kyc import router as property_kyc_router
from lakehouse_publisher import publish_kyc_to_lakehouse

# Import common modules for production readiness
try:
    from service_init import configure_service
    COMMON_MODULES_AVAILABLE = True
except ImportError:
    COMMON_MODULES_AVAILABLE = False
    import logging
    logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Tiered KYC Service",
    description="""
    Multi-tier KYC verification with progressive limits and requirements.
    
    Includes:
    - Standard KYC tiers (Tier 0-4) with progressive verification
    - Property Transaction KYC for high-value real estate purchases
    - Seller/Counterparty KYC (closed loop ecosystem)
    - Source of Funds verification
    - Bank statement validation (3-month requirement)
    - Income document verification (W-2, PAYE, etc.)
    - Purchase agreement validation
    """,
    version="2.0.0"
)

# Configure service with production-ready middleware
if COMMON_MODULES_AVAILABLE:
    logger = configure_service(app, "kyc-service")
else:
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    logger = logging.getLogger(__name__)

app.include_router(property_kyc_router)


class KYCTier(str, Enum):
    TIER_0 = "tier_0"  # Unverified
    TIER_1 = "tier_1"  # Basic - Phone + Email
    TIER_2 = "tier_2"  # Standard - ID + Selfie
    TIER_3 = "tier_3"  # Enhanced - Address + Income
    TIER_4 = "tier_4"  # Premium - Full verification


class VerificationStatus(str, Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class DocumentType(str, Enum):
    # Identity Documents
    NATIONAL_ID = "national_id"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    VOTERS_CARD = "voters_card"
    NIN_SLIP = "nin_slip"
    BVN = "bvn"
    
    # Address Verification
    UTILITY_BILL = "utility_bill"
    
    # Financial Documents
    BANK_STATEMENT = "bank_statement"
    BANK_STATEMENT_3_MONTHS = "bank_statement_3_months"  # NEW: 3-month requirement
    
    # Income Documents (W-2 equivalents)
    EMPLOYMENT_LETTER = "employment_letter"
    TAX_CERTIFICATE = "tax_certificate"
    W2_FORM = "w2_form"  # NEW: US W-2
    PAYE_RECORD = "paye_record"  # NEW: Nigeria PAYE
    PAYSLIP = "payslip"  # NEW: Monthly payslip
    TAX_RETURN = "tax_return"  # NEW: Annual tax return
    BUSINESS_REGISTRATION = "business_registration"  # NEW: For business owners
    AUDITED_ACCOUNTS = "audited_accounts"  # NEW: Business financial statements
    
    # Property Transaction Documents
    PURCHASE_AGREEMENT = "purchase_agreement"  # NEW: Signed purchase agreement
    DEED_OF_ASSIGNMENT = "deed_of_assignment"  # NEW: Property deed
    CERTIFICATE_OF_OCCUPANCY = "certificate_of_occupancy"  # NEW: C of O (Nigeria)
    SURVEY_PLAN = "survey_plan"  # NEW: Property survey
    GOVERNORS_CONSENT = "governors_consent"  # NEW: Governor's consent (Nigeria)
    PROPERTY_VALUATION = "property_valuation"  # NEW: Property valuation report
    
    # Source of Funds Documents
    SOURCE_OF_FUNDS_DECLARATION = "source_of_funds_declaration"  # NEW
    GIFT_DECLARATION = "gift_declaration"  # NEW: For gift-funded purchases
    LOAN_AGREEMENT = "loan_agreement"  # NEW: For loan-funded purchases
    
    # Biometric
    SELFIE = "selfie"
    LIVENESS_CHECK = "liveness_check"


class RejectionReason(str, Enum):
    BLURRY_IMAGE = "blurry_image"
    EXPIRED_DOCUMENT = "expired_document"
    MISMATCH_INFO = "mismatch_info"
    FRAUDULENT_DOCUMENT = "fraudulent_document"
    INCOMPLETE_INFO = "incomplete_info"
    FAILED_LIVENESS = "failed_liveness"
    SANCTIONS_MATCH = "sanctions_match"
    OTHER = "other"


# Tier Configuration
TIER_CONFIG = {
    KYCTier.TIER_0: {
        "name": "Unverified",
        "requirements": [],
        "limits": {
            "daily_transaction": Decimal("0"),
            "monthly_transaction": Decimal("0"),
            "single_transaction": Decimal("0"),
            "wallet_balance": Decimal("0")
        },
        "features": []
    },
    KYCTier.TIER_1: {
        "name": "Basic",
        "requirements": ["phone_verified", "email_verified"],
        "limits": {
            "daily_transaction": Decimal("50000"),
            "monthly_transaction": Decimal("200000"),
            "single_transaction": Decimal("20000"),
            "wallet_balance": Decimal("100000")
        },
        "features": ["domestic_transfer", "airtime_purchase", "bill_payment"]
    },
    KYCTier.TIER_2: {
        "name": "Standard",
        "requirements": ["phone_verified", "email_verified", "id_document", "selfie", "bvn_verified"],
        "limits": {
            "daily_transaction": Decimal("500000"),
            "monthly_transaction": Decimal("3000000"),
            "single_transaction": Decimal("200000"),
            "wallet_balance": Decimal("1000000")
        },
        "features": ["domestic_transfer", "airtime_purchase", "bill_payment", "virtual_card", "international_transfer_limited"]
    },
    KYCTier.TIER_3: {
        "name": "Enhanced",
        "requirements": ["phone_verified", "email_verified", "id_document", "selfie", "bvn_verified", "address_proof", "liveness_check"],
        "limits": {
            "daily_transaction": Decimal("2000000"),
            "monthly_transaction": Decimal("10000000"),
            "single_transaction": Decimal("1000000"),
            "wallet_balance": Decimal("5000000")
        },
        "features": ["domestic_transfer", "airtime_purchase", "bill_payment", "virtual_card", "international_transfer", "savings"]
    },
    KYCTier.TIER_4: {
        "name": "Premium",
        "requirements": ["phone_verified", "email_verified", "id_document", "selfie", "bvn_verified", "address_proof", "liveness_check", "income_proof", "enhanced_due_diligence"],
        "limits": {
            "daily_transaction": Decimal("10000000"),
            "monthly_transaction": Decimal("50000000"),
            "single_transaction": Decimal("5000000"),
            "wallet_balance": Decimal("20000000")
        },
        "features": ["domestic_transfer", "airtime_purchase", "bill_payment", "virtual_card", "international_transfer", "savings", "investments", "business_payments"]
    }
}


# Models
class KYCProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    current_tier: KYCTier = KYCTier.TIER_0
    target_tier: Optional[KYCTier] = None
    
    # Personal Info
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    
    # Contact Info
    phone: Optional[str] = None
    phone_verified: bool = False
    email: Optional[str] = None
    email_verified: bool = False
    
    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "NG"
    postal_code: Optional[str] = None
    
    # Identity
    bvn: Optional[str] = None
    bvn_verified: bool = False
    nin: Optional[str] = None
    nin_verified: bool = False
    
    # Verification Status
    id_document_status: VerificationStatus = VerificationStatus.PENDING
    selfie_status: VerificationStatus = VerificationStatus.PENDING
    address_proof_status: VerificationStatus = VerificationStatus.PENDING
    liveness_status: VerificationStatus = VerificationStatus.PENDING
    income_proof_status: VerificationStatus = VerificationStatus.PENDING
    
    # Metadata
    risk_score: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_verification_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None


class KYCDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    document_type: DocumentType
    document_number: Optional[str] = None
    issuing_country: str = "NG"
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: str
    file_hash: Optional[str] = None
    status: VerificationStatus = VerificationStatus.PENDING
    rejection_reason: Optional[RejectionReason] = None
    rejection_notes: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class KYCVerificationRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    requested_tier: KYCTier
    status: VerificationStatus = VerificationStatus.PENDING
    documents: List[str] = []
    notes: List[Dict[str, Any]] = []
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class BVNVerificationResult(BaseModel):
    bvn: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: str
    phone: str
    is_valid: bool
    match_score: float


class LivenessCheckResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    is_live: bool
    confidence_score: float
    face_match_score: float
    checks_passed: List[str] = []
    checks_failed: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


# In-memory storage
profiles_db: Dict[str, KYCProfile] = {}
documents_db: Dict[str, KYCDocument] = {}
verification_requests_db: Dict[str, KYCVerificationRequest] = {}
liveness_checks_db: Dict[str, LivenessCheckResult] = {}


def get_tier_limits(tier: KYCTier) -> Dict[str, Decimal]:
    """Get transaction limits for a tier."""
    return TIER_CONFIG[tier]["limits"]


def get_tier_requirements(tier: KYCTier) -> List[str]:
    """Get requirements for a tier."""
    return TIER_CONFIG[tier]["requirements"]


def check_tier_eligibility(profile: KYCProfile, target_tier: KYCTier) -> Dict[str, Any]:
    """Check if a profile meets requirements for a tier."""
    requirements = get_tier_requirements(target_tier)
    met = []
    missing = []
    
    for req in requirements:
        if req == "phone_verified" and profile.phone_verified:
            met.append(req)
        elif req == "email_verified" and profile.email_verified:
            met.append(req)
        elif req == "id_document" and profile.id_document_status == VerificationStatus.APPROVED:
            met.append(req)
        elif req == "selfie" and profile.selfie_status == VerificationStatus.APPROVED:
            met.append(req)
        elif req == "bvn_verified" and profile.bvn_verified:
            met.append(req)
        elif req == "address_proof" and profile.address_proof_status == VerificationStatus.APPROVED:
            met.append(req)
        elif req == "liveness_check" and profile.liveness_status == VerificationStatus.APPROVED:
            met.append(req)
        elif req == "income_proof" and profile.income_proof_status == VerificationStatus.APPROVED:
            met.append(req)
        elif req == "enhanced_due_diligence":
            # EDD is manual review
            met.append(req) if profile.risk_score < 50 else missing.append(req)
        else:
            missing.append(req)
    
    return {
        "eligible": len(missing) == 0,
        "requirements_met": met,
        "requirements_missing": missing,
        "progress": len(met) / len(requirements) * 100 if requirements else 100
    }


# Profile Endpoints
@app.post("/profiles", response_model=KYCProfile)
async def create_profile(user_id: str):
    """Create a new KYC profile."""
    if any(p.user_id == user_id for p in profiles_db.values()):
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    profile = KYCProfile(user_id=user_id)
    profiles_db[profile.id] = profile
    return profile


@app.get("/profiles/{user_id}", response_model=KYCProfile)
async def get_profile(user_id: str):
    """Get KYC profile for a user."""
    for profile in profiles_db.values():
        if profile.user_id == user_id:
            return profile
    raise HTTPException(status_code=404, detail="Profile not found")


@app.put("/profiles/{user_id}")
async def update_profile(
    user_id: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    middle_name: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    gender: Optional[str] = None,
    nationality: Optional[str] = None,
    address_line1: Optional[str] = None,
    address_line2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None
):
    """Update KYC profile information."""
    profile = await get_profile(user_id)
    
    if first_name:
        profile.first_name = first_name
    if last_name:
        profile.last_name = last_name
    if middle_name:
        profile.middle_name = middle_name
    if date_of_birth:
        profile.date_of_birth = date_of_birth
    if gender:
        profile.gender = gender
    if nationality:
        profile.nationality = nationality
    if address_line1:
        profile.address_line1 = address_line1
    if address_line2:
        profile.address_line2 = address_line2
    if city:
        profile.city = city
    if state:
        profile.state = state
    if postal_code:
        profile.postal_code = postal_code
    
    profile.updated_at = datetime.utcnow()
    return profile


@app.get("/profiles/{user_id}/limits")
async def get_user_limits(user_id: str):
    """Get transaction limits for a user based on their KYC tier."""
    profile = await get_profile(user_id)
    limits = get_tier_limits(profile.current_tier)
    tier_config = TIER_CONFIG[profile.current_tier]
    
    return {
        "tier": profile.current_tier,
        "tier_name": tier_config["name"],
        "limits": limits,
        "features": tier_config["features"]
    }


@app.get("/profiles/{user_id}/eligibility/{target_tier}")
async def check_eligibility(user_id: str, target_tier: KYCTier):
    """Check eligibility for a specific tier."""
    profile = await get_profile(user_id)
    return check_tier_eligibility(profile, target_tier)


# Verification Endpoints
@app.post("/profiles/{user_id}/verify-phone")
async def verify_phone(user_id: str, phone: str, otp: str):
    """Verify phone number with OTP."""
    profile = await get_profile(user_id)
    
    # In production, verify OTP against sent code
    if len(otp) == 6 and otp.isdigit():
        profile.phone = phone
        profile.phone_verified = True
        profile.updated_at = datetime.utcnow()
        
        # Auto-upgrade to Tier 1 if eligible
        eligibility = check_tier_eligibility(profile, KYCTier.TIER_1)
        if eligibility["eligible"] and profile.current_tier == KYCTier.TIER_0:
            profile.current_tier = KYCTier.TIER_1
        
        return {"verified": True, "current_tier": profile.current_tier}
    
    raise HTTPException(status_code=400, detail="Invalid OTP")


@app.post("/profiles/{user_id}/verify-email")
async def verify_email(user_id: str, email: str, token: str):
    """Verify email address."""
    profile = await get_profile(user_id)
    
    # In production, verify token
    if len(token) >= 6:
        profile.email = email
        profile.email_verified = True
        profile.updated_at = datetime.utcnow()
        
        # Auto-upgrade to Tier 1 if eligible
        eligibility = check_tier_eligibility(profile, KYCTier.TIER_1)
        if eligibility["eligible"] and profile.current_tier == KYCTier.TIER_0:
            profile.current_tier = KYCTier.TIER_1
        
        return {"verified": True, "current_tier": profile.current_tier}
    
    raise HTTPException(status_code=400, detail="Invalid token")


@app.post("/profiles/{user_id}/verify-bvn")
async def verify_bvn(user_id: str, bvn: str):
    """Verify BVN (Bank Verification Number)."""
    profile = await get_profile(user_id)
    
    if len(bvn) != 11 or not bvn.isdigit():
        raise HTTPException(status_code=400, detail="Invalid BVN format")
    
    # Simulate BVN verification (in production, call NIBSS or provider)
    result = BVNVerificationResult(
        bvn=bvn,
        first_name=profile.first_name or "John",
        last_name=profile.last_name or "Doe",
        date_of_birth=profile.date_of_birth or "1990-01-01",
        phone=profile.phone or "",
        is_valid=True,
        match_score=0.95
    )
    
    if result.is_valid and result.match_score >= 0.8:
        profile.bvn = bvn
        profile.bvn_verified = True
        profile.updated_at = datetime.utcnow()
        
        return {
            "verified": True,
            "match_score": result.match_score,
            "current_tier": profile.current_tier
        }
    
    raise HTTPException(status_code=400, detail="BVN verification failed")


# Document Endpoints
@app.post("/documents", response_model=KYCDocument)
async def upload_document(
    user_id: str,
    document_type: DocumentType,
    file_url: str,
    document_number: Optional[str] = None,
    issue_date: Optional[str] = None,
    expiry_date: Optional[str] = None
):
    """Upload a KYC document."""
    document = KYCDocument(
        user_id=user_id,
        document_type=document_type,
        document_number=document_number,
        file_url=file_url,
        issue_date=issue_date,
        expiry_date=expiry_date
    )
    
    documents_db[document.id] = document
    return document


@app.get("/documents/{document_id}", response_model=KYCDocument)
async def get_document(document_id: str):
    """Get document details."""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    return documents_db[document_id]


@app.get("/profiles/{user_id}/documents", response_model=List[KYCDocument])
async def get_user_documents(user_id: str):
    """Get all documents for a user."""
    return [d for d in documents_db.values() if d.user_id == user_id]


@app.put("/documents/{document_id}/review")
async def review_document(
    document_id: str,
    status: VerificationStatus,
    reviewer_id: str,
    rejection_reason: Optional[RejectionReason] = None,
    rejection_notes: Optional[str] = None
):
    """Review and approve/reject a document."""
    if document_id not in documents_db:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents_db[document_id]
    document.status = status
    document.verified_by = reviewer_id
    document.verified_at = datetime.utcnow()
    
    if status == VerificationStatus.REJECTED:
        document.rejection_reason = rejection_reason
        document.rejection_notes = rejection_notes
    
    # Update profile status based on document type
    profile = None
    for p in profiles_db.values():
        if p.user_id == document.user_id:
            profile = p
            break
    
    if profile:
        if document.document_type in [DocumentType.NATIONAL_ID, DocumentType.PASSPORT, DocumentType.DRIVERS_LICENSE, DocumentType.VOTERS_CARD]:
            profile.id_document_status = status
        elif document.document_type == DocumentType.SELFIE:
            profile.selfie_status = status
        elif document.document_type in [DocumentType.UTILITY_BILL, DocumentType.BANK_STATEMENT]:
            profile.address_proof_status = status
        elif document.document_type in [DocumentType.EMPLOYMENT_LETTER, DocumentType.TAX_CERTIFICATE]:
            profile.income_proof_status = status
        elif document.document_type == DocumentType.LIVENESS_CHECK:
            profile.liveness_status = status
        
        profile.updated_at = datetime.utcnow()
        profile.last_verification_at = datetime.utcnow()
    
    return document


# Liveness Check Endpoints
@app.post("/profiles/{user_id}/liveness-check")
async def perform_liveness_check(
    user_id: str,
    selfie_url: str,
    video_url: Optional[str] = None
):
    """Perform liveness check."""
    profile = await get_profile(user_id)
    
    # Simulate liveness check (in production, use provider like Smile ID, Onfido)
    result = LivenessCheckResult(
        user_id=user_id,
        is_live=True,
        confidence_score=0.92,
        face_match_score=0.88,
        checks_passed=["blink_detection", "head_movement", "face_match"],
        checks_failed=[]
    )
    
    liveness_checks_db[result.id] = result
    
    if result.is_live and result.confidence_score >= 0.8:
        profile.liveness_status = VerificationStatus.APPROVED
        profile.updated_at = datetime.utcnow()
        
        return {
            "passed": True,
            "result": result,
            "current_tier": profile.current_tier
        }
    
    profile.liveness_status = VerificationStatus.REJECTED
    return {
        "passed": False,
        "result": result,
        "message": "Liveness check failed"
    }


# Tier Upgrade Endpoints
@app.post("/profiles/{user_id}/request-upgrade")
async def request_tier_upgrade(user_id: str, target_tier: KYCTier):
    """Request upgrade to a higher tier."""
    profile = await get_profile(user_id)
    
    if target_tier.value <= profile.current_tier.value:
        raise HTTPException(status_code=400, detail="Target tier must be higher than current tier")
    
    eligibility = check_tier_eligibility(profile, target_tier)
    
    if not eligibility["eligible"]:
        return {
            "can_upgrade": False,
            "missing_requirements": eligibility["requirements_missing"],
            "progress": eligibility["progress"]
        }
    
    # Create verification request
    request = KYCVerificationRequest(
        user_id=user_id,
        requested_tier=target_tier
    )
    verification_requests_db[request.id] = request
    
    return {
        "can_upgrade": True,
        "request_id": request.id,
        "status": "pending_review"
    }


@app.put("/verification-requests/{request_id}/approve")
async def approve_upgrade_request(request_id: str, reviewer_id: str):
    """Approve a tier upgrade request."""
    if request_id not in verification_requests_db:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request = verification_requests_db[request_id]
    
    profile = None
    for p in profiles_db.values():
        if p.user_id == request.user_id:
            profile = p
            break
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    request.status = VerificationStatus.APPROVED
    request.assigned_to = reviewer_id
    request.completed_at = datetime.utcnow()
    request.updated_at = datetime.utcnow()
    
    profile.current_tier = request.requested_tier
    profile.updated_at = datetime.utcnow()
    profile.last_verification_at = datetime.utcnow()
    
    # Set next review date based on tier
    if request.requested_tier in [KYCTier.TIER_3, KYCTier.TIER_4]:
        profile.next_review_at = datetime.utcnow() + timedelta(days=365)
    
    return {
        "approved": True,
        "new_tier": profile.current_tier,
        "limits": get_tier_limits(profile.current_tier)
    }


# Tier Information Endpoints
@app.get("/tiers")
async def list_tiers():
    """List all KYC tiers and their requirements."""
    return {
        tier.value: {
            "name": config["name"],
            "requirements": config["requirements"],
            "limits": {k: str(v) for k, v in config["limits"].items()},
            "features": config["features"]
        }
        for tier, config in TIER_CONFIG.items()
    }


@app.get("/tiers/{tier}")
async def get_tier_info(tier: KYCTier):
    """Get detailed information about a specific tier."""
    config = TIER_CONFIG[tier]
    return {
        "tier": tier,
        "name": config["name"],
        "requirements": config["requirements"],
        "limits": {k: str(v) for k, v in config["limits"].items()},
        "features": config["features"]
    }


# Admin Endpoints
@app.get("/verification-requests", response_model=List[KYCVerificationRequest])
async def list_verification_requests(
    status: Optional[VerificationStatus] = None,
    limit: int = Query(default=50, le=200)
):
    """List verification requests for review."""
    requests = list(verification_requests_db.values())
    
    if status:
        requests = [r for r in requests if r.status == status]
    
    requests.sort(key=lambda x: x.created_at, reverse=True)
    return requests[:limit]


@app.get("/stats")
async def get_kyc_stats():
    """Get KYC statistics."""
    profiles = list(profiles_db.values())
    
    return {
        "total_profiles": len(profiles),
        "by_tier": {
            tier.value: len([p for p in profiles if p.current_tier == tier])
            for tier in KYCTier
        },
        "verification_status": {
            "pending": len([p for p in profiles if p.id_document_status == VerificationStatus.PENDING]),
            "approved": len([p for p in profiles if p.id_document_status == VerificationStatus.APPROVED]),
            "rejected": len([p for p in profiles if p.id_document_status == VerificationStatus.REJECTED])
        },
        "pending_requests": len([r for r in verification_requests_db.values() if r.status == VerificationStatus.PENDING])
    }


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "kyc",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8015)
