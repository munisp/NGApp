"""
Seller Verification with Visible Badge for EscrowProtect
Implements document verification, badge issuance, and continuous monitoring
for seller credibility in social commerce.
"""

import json
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class VerificationStatus(str, Enum):
    PENDING = "pending"
    DOCUMENT_SUBMITTED = "document_submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class DocumentType(str, Enum):
    NATIONAL_ID = "national_id"  # NIN
    DRIVERS_LICENSE = "drivers_license"
    INTERNATIONAL_PASSPORT = "international_passport"
    VOTERS_CARD = "voters_card"
    BVN = "bvn"
    CAC_CERTIFICATE = "cac_certificate"  # Business registration
    TIN = "tin"  # Tax ID
    UTILITY_BILL = "utility_bill"
    BANK_STATEMENT = "bank_statement"


class BadgeType(str, Enum):
    VERIFIED_SELLER = "verified_seller"
    VERIFIED_BUSINESS = "verified_business"
    TOP_SELLER = "top_seller"
    TRUSTED_SELLER = "trusted_seller"
    NEW_SELLER = "new_seller"


class VerificationLevel(str, Enum):
    NONE = "none"
    BASIC = "basic"  # Phone + email verified
    STANDARD = "standard"  # ID verified
    BUSINESS = "business"  # CAC + ID verified
    PREMIUM = "premium"  # Full verification + track record


# Database Models
class SellerVerification(Base):
    __tablename__ = "seller_verifications"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # Verification status
    status = Column(SQLEnum(VerificationStatus), default=VerificationStatus.PENDING)
    verification_level = Column(SQLEnum(VerificationLevel), default=VerificationLevel.NONE)
    
    # Personal info (encrypted in production)
    legal_name = Column(String(200))
    date_of_birth = Column(DateTime)
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100), default="Nigeria")
    
    # Business info (if applicable)
    business_name = Column(String(200))
    business_type = Column(String(100))
    cac_number = Column(String(50))
    tin_number = Column(String(50))
    business_address = Column(Text)
    
    # Contact verification
    phone_verified = Column(Boolean, default=False)
    phone_verified_at = Column(DateTime)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime)
    
    # ID verification
    id_document_type = Column(SQLEnum(DocumentType))
    id_document_number = Column(String(50))
    id_verified = Column(Boolean, default=False)
    id_verified_at = Column(DateTime)
    id_verification_provider = Column(String(50))  # dojah, smile_identity, etc.
    id_verification_reference = Column(String(100))
    
    # Address verification
    address_verified = Column(Boolean, default=False)
    address_verified_at = Column(DateTime)
    
    # BVN verification
    bvn_verified = Column(Boolean, default=False)
    bvn_verified_at = Column(DateTime)
    bvn_last_4 = Column(String(4))
    
    # Review
    reviewed_by = Column(String(36))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    rejection_reason = Column(Text)
    
    # Expiry
    verified_at = Column(DateTime)
    expires_at = Column(DateTime)
    
    # Risk flags
    risk_flags = Column(Text)  # JSON array
    is_flagged = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = relationship("VerificationDocument", back_populates="verification")
    badges = relationship("SellerBadge", back_populates="verification")


class VerificationDocument(Base):
    __tablename__ = "verification_documents"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    verification_id = Column(String(36), ForeignKey("seller_verifications.id"), nullable=False, index=True)
    
    document_type = Column(SQLEnum(DocumentType), nullable=False)
    document_number = Column(String(100))
    
    # File storage
    file_url = Column(String(500))
    file_hash = Column(String(64))
    
    # Extraction results
    extracted_name = Column(String(200))
    extracted_dob = Column(DateTime)
    extracted_address = Column(Text)
    extraction_confidence = Column(Float)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    verification_method = Column(String(50))  # ocr, api, manual
    verification_provider = Column(String(50))
    verification_reference = Column(String(100))
    
    # Status
    status = Column(String(20), default="pending")
    rejection_reason = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    verification = relationship("SellerVerification", back_populates="documents")


class SellerBadge(Base):
    __tablename__ = "seller_badges"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    verification_id = Column(String(36), ForeignKey("seller_verifications.id"), index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    badge_type = Column(SQLEnum(BadgeType), nullable=False)
    badge_name = Column(String(100))
    badge_description = Column(Text)
    badge_icon_url = Column(String(500))
    
    # Display
    is_active = Column(Boolean, default=True)
    display_priority = Column(Integer, default=0)
    
    # Validity
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    
    # Criteria met
    criteria_json = Column(Text)  # JSON of criteria that earned this badge
    
    # Relationships
    verification = relationship("SellerVerification", back_populates="badges")


class VerificationAttempt(Base):
    __tablename__ = "verification_attempts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    attempt_type = Column(String(50))  # phone, email, id, bvn, address
    provider = Column(String(50))
    
    # Request/Response
    request_data = Column(Text)  # JSON (sanitized)
    response_data = Column(Text)  # JSON (sanitized)
    
    # Result
    success = Column(Boolean)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models
class StartVerificationRequest(BaseModel):
    legal_name: str
    date_of_birth: str  # YYYY-MM-DD
    phone: str
    email: str
    address: str
    city: str
    state: str


class SubmitDocumentRequest(BaseModel):
    document_type: DocumentType
    document_number: str
    file_url: str
    file_hash: str


class SubmitBusinessInfoRequest(BaseModel):
    business_name: str
    business_type: str
    cac_number: Optional[str] = None
    tin_number: Optional[str] = None
    business_address: str


class VerificationResponse(BaseModel):
    id: str
    user_id: str
    status: VerificationStatus
    verification_level: VerificationLevel
    phone_verified: bool
    email_verified: bool
    id_verified: bool
    badges: List[dict]
    
    class Config:
        from_attributes = True


# Verification Provider Clients
class DojahClient:
    """Dojah identity verification API client"""
    
    def __init__(self, app_id: str, secret_key: str):
        self.app_id = app_id
        self.secret_key = secret_key
        self.base_url = "https://api.dojah.io"
    
    async def verify_nin(self, nin: str) -> dict:
        """Verify Nigerian National ID Number"""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/kyc/nin",
                params={"nin": nin},
                headers={
                    "AppId": self.app_id,
                    "Authorization": self.secret_key,
                }
            )
            return response.json()
    
    async def verify_bvn(self, bvn: str) -> dict:
        """Verify Bank Verification Number"""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/kyc/bvn/full",
                params={"bvn": bvn},
                headers={
                    "AppId": self.app_id,
                    "Authorization": self.secret_key,
                }
            )
            return response.json()
    
    async def verify_drivers_license(self, license_number: str, dob: str) -> dict:
        """Verify driver's license"""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/kyc/dl",
                params={"license_number": license_number, "dob": dob},
                headers={
                    "AppId": self.app_id,
                    "Authorization": self.secret_key,
                }
            )
            return response.json()
    
    async def verify_cac(self, rc_number: str) -> dict:
        """Verify CAC business registration"""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/kyc/cac",
                params={"rc_number": rc_number},
                headers={
                    "AppId": self.app_id,
                    "Authorization": self.secret_key,
                }
            )
            return response.json()


class SmileIdentityClient:
    """Smile Identity verification API client"""
    
    def __init__(self, partner_id: str, api_key: str):
        self.partner_id = partner_id
        self.api_key = api_key
        self.base_url = "https://api.smileidentity.com/v1"
    
    async def verify_id_with_selfie(
        self,
        id_type: str,
        id_number: str,
        selfie_image: str,
        id_image: str
    ) -> dict:
        """Verify ID with selfie comparison"""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/id_verification",
                json={
                    "partner_id": self.partner_id,
                    "id_type": id_type,
                    "id_number": id_number,
                    "images": [
                        {"image_type_id": 0, "image": selfie_image},
                        {"image_type_id": 1, "image": id_image},
                    ],
                },
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            return response.json()


# Seller Verification Service
class SellerVerificationService:
    """Main seller verification service"""
    
    VERIFICATION_VALIDITY_DAYS = 365
    
    BADGE_CRITERIA = {
        BadgeType.VERIFIED_SELLER: {
            "id_verified": True,
            "phone_verified": True,
            "email_verified": True,
        },
        BadgeType.VERIFIED_BUSINESS: {
            "id_verified": True,
            "cac_verified": True,
        },
        BadgeType.TOP_SELLER: {
            "min_transactions": 100,
            "min_rating": 4.5,
            "min_success_rate": 95,
        },
        BadgeType.TRUSTED_SELLER: {
            "min_transactions": 50,
            "min_rating": 4.0,
            "min_success_rate": 90,
            "verified": True,
        },
    }
    
    def __init__(
        self,
        event_bus: EventBus,
        redis_client: Any,
        dojah_client: Optional[DojahClient] = None,
        smile_client: Optional[SmileIdentityClient] = None
    ):
        self.event_bus = event_bus
        self.redis = redis_client
        self.dojah = dojah_client
        self.smile = smile_client
    
    async def start_verification(
        self,
        db,
        user_id: str,
        request: StartVerificationRequest
    ) -> SellerVerification:
        """Start verification process for a seller"""
        
        # Check if verification already exists
        existing = db.query(SellerVerification).filter(
            SellerVerification.user_id == user_id
        ).first()
        
        if existing and existing.status == VerificationStatus.VERIFIED:
            raise ValueError("User already verified")
        
        if existing:
            verification = existing
        else:
            verification = SellerVerification(user_id=user_id)
            db.add(verification)
        
        # Update with provided info
        verification.legal_name = request.legal_name
        verification.date_of_birth = datetime.strptime(request.date_of_birth, "%Y-%m-%d")
        verification.address = request.address
        verification.city = request.city
        verification.state = request.state
        verification.status = VerificationStatus.PENDING
        
        db.commit()
        db.refresh(verification)
        
        # Issue "New Seller" badge
        await self._issue_badge(db, verification, BadgeType.NEW_SELLER)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="verification.started",
            data={
                "verification_id": verification.id,
                "user_id": user_id,
            }
        ))
        
        return verification
    
    async def submit_document(
        self,
        db,
        user_id: str,
        request: SubmitDocumentRequest
    ) -> VerificationDocument:
        """Submit a verification document"""
        
        verification = db.query(SellerVerification).filter(
            SellerVerification.user_id == user_id
        ).first()
        
        if not verification:
            raise ValueError("Verification not started")
        
        # Create document record
        document = VerificationDocument(
            verification_id=verification.id,
            document_type=request.document_type,
            document_number=request.document_number,
            file_url=request.file_url,
            file_hash=request.file_hash,
        )
        
        db.add(document)
        
        # Update verification status
        verification.status = VerificationStatus.DOCUMENT_SUBMITTED
        if request.document_type in [DocumentType.NATIONAL_ID, DocumentType.DRIVERS_LICENSE, DocumentType.INTERNATIONAL_PASSPORT]:
            verification.id_document_type = request.document_type
            verification.id_document_number = request.document_number
        
        db.commit()
        db.refresh(document)
        
        # Trigger async verification
        await self.event_bus.publish(Event(
            type="verification.document_submitted",
            data={
                "document_id": document.id,
                "verification_id": verification.id,
                "document_type": request.document_type.value,
            }
        ))
        
        return document
    
    async def verify_document(self, db, document_id: str) -> VerificationDocument:
        """Verify a submitted document using external providers"""
        
        document = db.query(VerificationDocument).filter(
            VerificationDocument.id == document_id
        ).first()
        
        if not document:
            raise ValueError("Document not found")
        
        verification = document.verification
        
        # Log attempt
        attempt = VerificationAttempt(
            user_id=verification.user_id,
            attempt_type=document.document_type.value,
            provider="dojah",
        )
        db.add(attempt)
        
        try:
            # Verify based on document type
            if document.document_type == DocumentType.NATIONAL_ID and self.dojah:
                result = await self.dojah.verify_nin(document.document_number)
                
                if result.get("entity"):
                    entity = result["entity"]
                    document.extracted_name = f"{entity.get('firstname', '')} {entity.get('surname', '')}".strip()
                    document.extracted_dob = datetime.strptime(entity.get("birthdate", ""), "%d-%m-%Y") if entity.get("birthdate") else None
                    document.is_verified = True
                    document.verified_at = datetime.utcnow()
                    document.verification_method = "api"
                    document.verification_provider = "dojah"
                    document.status = "verified"
                    
                    # Update verification record
                    verification.id_verified = True
                    verification.id_verified_at = datetime.utcnow()
                    verification.id_verification_provider = "dojah"
                    
                    attempt.success = True
                else:
                    document.status = "failed"
                    document.rejection_reason = result.get("error", "Verification failed")
                    attempt.success = False
                    attempt.error_message = result.get("error")
            
            elif document.document_type == DocumentType.BVN and self.dojah:
                result = await self.dojah.verify_bvn(document.document_number)
                
                if result.get("entity"):
                    entity = result["entity"]
                    document.extracted_name = f"{entity.get('first_name', '')} {entity.get('last_name', '')}".strip()
                    document.is_verified = True
                    document.verified_at = datetime.utcnow()
                    document.verification_method = "api"
                    document.verification_provider = "dojah"
                    document.status = "verified"
                    
                    verification.bvn_verified = True
                    verification.bvn_verified_at = datetime.utcnow()
                    verification.bvn_last_4 = document.document_number[-4:]
                    
                    attempt.success = True
                else:
                    document.status = "failed"
                    attempt.success = False
            
            elif document.document_type == DocumentType.CAC_CERTIFICATE and self.dojah:
                result = await self.dojah.verify_cac(document.document_number)
                
                if result.get("entity"):
                    entity = result["entity"]
                    document.extracted_name = entity.get("company_name", "")
                    document.is_verified = True
                    document.verified_at = datetime.utcnow()
                    document.verification_method = "api"
                    document.verification_provider = "dojah"
                    document.status = "verified"
                    
                    verification.cac_number = document.document_number
                    verification.business_name = entity.get("company_name")
                    
                    attempt.success = True
                else:
                    document.status = "failed"
                    attempt.success = False
            
            else:
                # Mark for manual review
                document.status = "pending_review"
                verification.status = VerificationStatus.UNDER_REVIEW
            
            attempt.response_data = json.dumps({"status": document.status})
            
        except Exception as e:
            document.status = "error"
            document.rejection_reason = str(e)
            attempt.success = False
            attempt.error_message = str(e)
        
        db.commit()
        db.refresh(document)
        
        # Check if all required verifications are complete
        await self._check_verification_complete(db, verification)
        
        return document
    
    async def _check_verification_complete(self, db, verification: SellerVerification):
        """Check if verification is complete and issue badges"""
        
        # Determine verification level
        if verification.id_verified and verification.bvn_verified:
            if verification.cac_number:
                verification.verification_level = VerificationLevel.BUSINESS
            else:
                verification.verification_level = VerificationLevel.STANDARD
        elif verification.phone_verified and verification.email_verified:
            verification.verification_level = VerificationLevel.BASIC
        
        # Check if fully verified
        if verification.id_verified:
            verification.status = VerificationStatus.VERIFIED
            verification.verified_at = datetime.utcnow()
            verification.expires_at = datetime.utcnow() + timedelta(days=self.VERIFICATION_VALIDITY_DAYS)
            
            # Issue verified seller badge
            await self._issue_badge(db, verification, BadgeType.VERIFIED_SELLER)
            
            # Issue business badge if applicable
            if verification.cac_number:
                await self._issue_badge(db, verification, BadgeType.VERIFIED_BUSINESS)
            
            # Publish event
            await self.event_bus.publish(Event(
                type="verification.completed",
                data={
                    "verification_id": verification.id,
                    "user_id": verification.user_id,
                    "verification_level": verification.verification_level.value,
                }
            ))
        
        db.commit()
    
    async def _issue_badge(
        self,
        db,
        verification: SellerVerification,
        badge_type: BadgeType
    ) -> SellerBadge:
        """Issue a badge to a seller"""
        
        # Check if badge already exists
        existing = db.query(SellerBadge).filter(
            SellerBadge.user_id == verification.user_id,
            SellerBadge.badge_type == badge_type,
            SellerBadge.is_active == True
        ).first()
        
        if existing:
            return existing
        
        badge_info = {
            BadgeType.VERIFIED_SELLER: {
                "name": "Verified Seller",
                "description": "Identity verified by EscrowProtect",
                "icon": "https://escrowprotect.ng/badges/verified-seller.svg",
                "priority": 10,
            },
            BadgeType.VERIFIED_BUSINESS: {
                "name": "Verified Business",
                "description": "Registered business verified by EscrowProtect",
                "icon": "https://escrowprotect.ng/badges/verified-business.svg",
                "priority": 9,
            },
            BadgeType.TOP_SELLER: {
                "name": "Top Seller",
                "description": "100+ successful transactions with 4.5+ rating",
                "icon": "https://escrowprotect.ng/badges/top-seller.svg",
                "priority": 8,
            },
            BadgeType.TRUSTED_SELLER: {
                "name": "Trusted Seller",
                "description": "50+ successful transactions with high satisfaction",
                "icon": "https://escrowprotect.ng/badges/trusted-seller.svg",
                "priority": 7,
            },
            BadgeType.NEW_SELLER: {
                "name": "New Seller",
                "description": "Recently joined EscrowProtect",
                "icon": "https://escrowprotect.ng/badges/new-seller.svg",
                "priority": 1,
            },
        }
        
        info = badge_info.get(badge_type, {})
        
        badge = SellerBadge(
            verification_id=verification.id,
            user_id=verification.user_id,
            badge_type=badge_type,
            badge_name=info.get("name", badge_type.value),
            badge_description=info.get("description", ""),
            badge_icon_url=info.get("icon", ""),
            display_priority=info.get("priority", 0),
            expires_at=datetime.utcnow() + timedelta(days=365) if badge_type == BadgeType.NEW_SELLER else None,
        )
        
        db.add(badge)
        db.commit()
        db.refresh(badge)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="badge.issued",
            data={
                "badge_id": badge.id,
                "user_id": verification.user_id,
                "badge_type": badge_type.value,
            }
        ))
        
        return badge
    
    async def get_seller_badges(self, db, user_id: str) -> List[SellerBadge]:
        """Get all active badges for a seller"""
        
        return db.query(SellerBadge).filter(
            SellerBadge.user_id == user_id,
            SellerBadge.is_active == True
        ).order_by(SellerBadge.display_priority.desc()).all()
    
    async def get_verification_status(self, db, user_id: str) -> dict:
        """Get verification status for display"""
        
        verification = db.query(SellerVerification).filter(
            SellerVerification.user_id == user_id
        ).first()
        
        if not verification:
            return {
                "status": "not_started",
                "verification_level": VerificationLevel.NONE.value,
                "badges": [],
            }
        
        badges = await self.get_seller_badges(db, user_id)
        
        return {
            "status": verification.status.value,
            "verification_level": verification.verification_level.value,
            "phone_verified": verification.phone_verified,
            "email_verified": verification.email_verified,
            "id_verified": verification.id_verified,
            "bvn_verified": verification.bvn_verified,
            "business_verified": verification.cac_number is not None,
            "verified_at": verification.verified_at.isoformat() if verification.verified_at else None,
            "expires_at": verification.expires_at.isoformat() if verification.expires_at else None,
            "badges": [
                {
                    "type": b.badge_type.value,
                    "name": b.badge_name,
                    "description": b.badge_description,
                    "icon_url": b.badge_icon_url,
                }
                for b in badges
            ],
        }
    
    async def check_and_update_badges(self, db, user_id: str, trust_score: dict):
        """Check if user qualifies for new badges based on trust score"""
        
        verification = db.query(SellerVerification).filter(
            SellerVerification.user_id == user_id
        ).first()
        
        if not verification:
            return
        
        # Check for Top Seller badge
        if (trust_score.get("total_transactions", 0) >= 100 and
            trust_score.get("average_rating", 0) >= 4.5 and
            trust_score.get("success_rate", 0) >= 95):
            await self._issue_badge(db, verification, BadgeType.TOP_SELLER)
        
        # Check for Trusted Seller badge
        elif (trust_score.get("total_transactions", 0) >= 50 and
              trust_score.get("average_rating", 0) >= 4.0 and
              trust_score.get("success_rate", 0) >= 90 and
              verification.status == VerificationStatus.VERIFIED):
            await self._issue_badge(db, verification, BadgeType.TRUSTED_SELLER)
        
        # Remove New Seller badge after 30 days or 10 transactions
        if trust_score.get("total_transactions", 0) >= 10:
            new_seller_badge = db.query(SellerBadge).filter(
                SellerBadge.user_id == user_id,
                SellerBadge.badge_type == BadgeType.NEW_SELLER,
                SellerBadge.is_active == True
            ).first()
            
            if new_seller_badge:
                new_seller_badge.is_active = False
                db.commit()


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/verification", tags=["verification"])


@router.post("/start")
async def start_verification(
    request: StartVerificationRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Start seller verification process"""
    try:
        from app.main import get_verification_service
        service = get_verification_service()
        verification = await service.start_verification(db, user_id, request)
        return {"verification_id": verification.id, "status": verification.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/documents")
async def submit_document(
    request: SubmitDocumentRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Submit verification document"""
    try:
        from app.main import get_verification_service
        service = get_verification_service()
        document = await service.submit_document(db, user_id, request)
        return {"document_id": document.id, "status": document.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/business")
async def submit_business_info(
    request: SubmitBusinessInfoRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Submit business information for verification"""
    verification = db.query(SellerVerification).filter(
        SellerVerification.user_id == user_id
    ).first()
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not started")
    
    verification.business_name = request.business_name
    verification.business_type = request.business_type
    verification.cac_number = request.cac_number
    verification.tin_number = request.tin_number
    verification.business_address = request.business_address
    
    db.commit()
    
    return {"status": "submitted"}


@router.get("/status")
async def get_verification_status(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get verification status and badges"""
    from app.main import get_verification_service
    service = get_verification_service()
    return await service.get_verification_status(db, user_id)


@router.get("/badges/{user_id}")
async def get_seller_badges(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get seller's badges for public display"""
    from app.main import get_verification_service
    service = get_verification_service()
    badges = await service.get_seller_badges(db, user_id)
    
    return [
        {
            "type": b.badge_type.value,
            "name": b.badge_name,
            "description": b.badge_description,
            "icon_url": b.badge_icon_url,
            "issued_at": b.issued_at.isoformat(),
        }
        for b in badges
    ]
