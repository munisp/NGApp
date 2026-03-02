"""Pydantic models for KYC/KYB service."""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────

class StakeholderType(str, Enum):
    RETAIL_TRADER = "retail_trader"
    INSTITUTIONAL_INVESTOR = "institutional_investor"
    BROKER_DEALER = "broker_dealer"
    MARKET_MAKER = "market_maker"
    DIGITAL_ASSET_ISSUER = "digital_asset_issuer"
    API_CONSUMER = "api_consumer"
    EXCHANGE_MEMBER = "exchange_member"


class KYCStatus(str, Enum):
    PENDING = "pending"
    DOCUMENT_UPLOADED = "document_uploaded"
    OCR_PROCESSING = "ocr_processing"
    OCR_COMPLETE = "ocr_complete"
    LIVENESS_PENDING = "liveness_pending"
    LIVENESS_COMPLETE = "liveness_complete"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class KYBStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_UPLOADED = "documents_uploaded"
    PROCESSING = "processing"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class DocumentType(str, Enum):
    # KYC Documents
    NATIONAL_ID = "national_id"
    INTERNATIONAL_PASSPORT = "international_passport"
    DRIVERS_LICENSE = "drivers_license"
    VOTERS_CARD = "voters_card"
    NIN_SLIP = "nin_slip"
    BVN_PRINTOUT = "bvn_printout"
    UTILITY_BILL = "utility_bill"
    BANK_STATEMENT = "bank_statement"
    # KYB Documents
    CAC_CERTIFICATE = "cac_certificate"
    MEMORANDUM_OF_ASSOCIATION = "memorandum_of_association"
    ARTICLES_OF_ASSOCIATION = "articles_of_association"
    BOARD_RESOLUTION = "board_resolution"
    TAX_CLEARANCE = "tax_clearance"
    AUDITED_FINANCIALS = "audited_financials"
    SHAREHOLDER_REGISTER = "shareholder_register"
    DIRECTOR_ID = "director_id"


class LivenessChallenge(str, Enum):
    BLINK = "blink"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    SMILE = "smile"
    NOD = "nod"
    RAISE_EYEBROWS = "raise_eyebrows"


class LivenessResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    SPOOF_DETECTED = "spoof_detected"
    TIMEOUT = "timeout"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── OCR Models ─────────────────────────────────────────────────────────────────

class OCRField(BaseModel):
    field_name: str
    value: str
    confidence: float = Field(ge=0.0, le=1.0)
    bounding_box: Optional[list[list[int]]] = None


class OCRResult(BaseModel):
    document_type: DocumentType
    fields: list[OCRField]
    raw_text: str
    overall_confidence: float = Field(ge=0.0, le=1.0)
    processing_time_ms: int
    language_detected: str = "en"


# ── Document Verification Models ───────────────────────────────────────────────

class DocumentVerification(BaseModel):
    document_type: DocumentType
    is_authentic: bool
    confidence: float = Field(ge=0.0, le=1.0)
    tampering_detected: bool = False
    expiry_valid: bool = True
    face_detected: bool = False
    face_match_score: Optional[float] = None
    issues: list[str] = Field(default_factory=list)
    vlm_analysis: str = ""


# ── Liveness Models ────────────────────────────────────────────────────────────

class LivenessSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenges: list[LivenessChallenge]
    current_challenge_index: int = 0
    results: list[dict] = Field(default_factory=list)
    overall_result: Optional[LivenessResult] = None
    anti_spoof_score: float = 0.0
    face_quality_score: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class LivenessChallengeResponse(BaseModel):
    session_id: str
    challenge: LivenessChallenge
    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    anti_spoof_score: float = Field(ge=0.0, le=1.0)
    face_landmarks_detected: int = 0
    processing_time_ms: int = 0


# ── KYC Application Models ────────────────────────────────────────────────────

class KYCApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    stakeholder_type: StakeholderType
    status: KYCStatus = KYCStatus.PENDING
    # Personal Info
    full_name: str = ""
    date_of_birth: Optional[str] = None
    nationality: str = "Nigerian"
    phone_number: str = ""
    email: str = ""
    address: str = ""
    bvn: Optional[str] = None  # Bank Verification Number
    nin: Optional[str] = None  # National Identification Number
    # Documents
    documents: list[DocumentUpload] = Field(default_factory=list)
    ocr_results: list[OCRResult] = Field(default_factory=list)
    document_verifications: list[DocumentVerification] = Field(default_factory=list)
    # Liveness
    liveness_session: Optional[LivenessSession] = None
    selfie_match_score: Optional[float] = None
    # Risk
    risk_level: RiskLevel = RiskLevel.LOW
    risk_score: float = 0.0
    risk_factors: list[str] = Field(default_factory=list)
    # Review
    reviewer_id: Optional[str] = None
    reviewer_notes: str = ""
    rejection_reason: Optional[str] = None
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None


class DocumentUpload(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_type: DocumentType
    filename: str
    file_size: int = 0
    mime_type: str = "image/jpeg"
    storage_path: str = ""
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    ocr_processed: bool = False
    verified: bool = False


# Fix forward reference
KYCApplication.model_rebuild()


# ── KYB Application Models ────────────────────────────────────────────────────

class KYBApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    stakeholder_type: StakeholderType
    status: KYBStatus = KYBStatus.PENDING
    # Business Info
    business_name: str = ""
    registration_number: str = ""  # CAC RC Number
    tax_id: str = ""  # TIN
    business_type: str = ""  # LLC, PLC, etc.
    incorporation_date: Optional[str] = None
    registered_address: str = ""
    business_address: str = ""
    industry: str = ""
    annual_revenue: Optional[str] = None
    employee_count: Optional[int] = None
    website: Optional[str] = None
    # Directors & Shareholders
    directors: list[DirectorInfo] = Field(default_factory=list)
    shareholders: list[ShareholderInfo] = Field(default_factory=list)
    ultimate_beneficial_owners: list[UBOInfo] = Field(default_factory=list)
    # Documents
    documents: list[DocumentUpload] = Field(default_factory=list)
    ocr_results: list[OCRResult] = Field(default_factory=list)
    document_verifications: list[DocumentVerification] = Field(default_factory=list)
    # Compliance
    aml_screening_passed: bool = False
    sanctions_screening_passed: bool = False
    pep_screening_passed: bool = False
    adverse_media_clear: bool = False
    # Risk
    risk_level: RiskLevel = RiskLevel.LOW
    risk_score: float = 0.0
    risk_factors: list[str] = Field(default_factory=list)
    # Review
    reviewer_id: Optional[str] = None
    reviewer_notes: str = ""
    rejection_reason: Optional[str] = None
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None


class DirectorInfo(BaseModel):
    full_name: str
    position: str = "Director"
    nationality: str = "Nigerian"
    id_number: str = ""
    id_type: DocumentType = DocumentType.NATIONAL_ID
    kyc_application_id: Optional[str] = None
    kyc_status: KYCStatus = KYCStatus.PENDING


class ShareholderInfo(BaseModel):
    name: str
    is_corporate: bool = False
    ownership_percentage: float = 0.0
    nationality: str = "Nigerian"
    id_number: str = ""


class UBOInfo(BaseModel):
    """Ultimate Beneficial Owner."""
    full_name: str
    ownership_percentage: float = 0.0
    nationality: str = "Nigerian"
    date_of_birth: Optional[str] = None
    address: str = ""
    pep_status: bool = False
    sanctions_match: bool = False


# Fix forward references
KYBApplication.model_rebuild()


# ── API Request/Response Models ────────────────────────────────────────────────

class CreateKYCRequest(BaseModel):
    account_id: str
    stakeholder_type: StakeholderType
    full_name: str
    email: str
    phone_number: str
    date_of_birth: Optional[str] = None
    nationality: str = "Nigerian"
    address: str = ""
    bvn: Optional[str] = None
    nin: Optional[str] = None


class CreateKYBRequest(BaseModel):
    account_id: str
    stakeholder_type: StakeholderType
    business_name: str
    registration_number: str
    tax_id: str = ""
    business_type: str = ""
    incorporation_date: Optional[str] = None
    registered_address: str = ""
    business_address: str = ""
    industry: str = ""
    annual_revenue: Optional[str] = None
    employee_count: Optional[int] = None
    website: Optional[str] = None
    directors: list[DirectorInfo] = Field(default_factory=list)
    shareholders: list[ShareholderInfo] = Field(default_factory=list)


class ReviewDecision(BaseModel):
    reviewer_id: str
    decision: str  # "approve" or "reject"
    notes: str = ""
    rejection_reason: Optional[str] = None


class OnboardingStatus(BaseModel):
    application_id: str
    application_type: str  # "kyc" or "kyb"
    status: str
    stakeholder_type: StakeholderType
    progress_percentage: int
    steps_completed: list[str]
    steps_remaining: list[str]
    risk_level: RiskLevel
    created_at: datetime
    updated_at: datetime
