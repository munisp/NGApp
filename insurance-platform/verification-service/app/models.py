from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class VerificationType(str, Enum):
    NIN = "NIN"
    CAC = "CAC"
    BVN = "BVN"
    DRIVERS_LICENSE = "DRIVERS_LICENSE"
    PASSPORT = "PASSPORT"


class NINVerificationRequest(BaseModel):
    nin: str = Field(..., min_length=11, max_length=11, description="National Identification Number")
    customer_id: str = Field(..., description="Customer UUID")
    first_name: Optional[str] = Field(None, description="First name for verification")
    last_name: Optional[str] = Field(None, description="Last name for verification")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD)")
    phone_number: Optional[str] = Field(None, description="Phone number for verification")


class NINVerificationResponse(BaseModel):
    verification_id: str
    nin: str
    customer_id: str
    status: VerificationStatus
    verified: bool
    verification_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime


class CACVerificationRequest(BaseModel):
    cac_number: str = Field(..., description="Corporate Affairs Commission registration number")
    company_name: str = Field(..., description="Company name")
    customer_id: str = Field(..., description="Customer UUID")


class CACVerificationResponse(BaseModel):
    verification_id: str
    cac_number: str
    customer_id: str
    status: VerificationStatus
    verified: bool
    verification_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime


class BulkNINVerificationRequest(BaseModel):
    verifications: list[NINVerificationRequest] = Field(..., max_length=1000)


class BulkNINVerificationResponse(BaseModel):
    batch_id: str
    total_count: int
    successful_count: int
    failed_count: int
    results: list[NINVerificationResponse]


class VerificationRecord(BaseModel):
    id: str
    customer_id: str
    verification_type: VerificationType
    identifier: str
    status: VerificationStatus
    verification_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class BiometricVerificationRequest(BaseModel):
    nin: str = Field(..., min_length=11, max_length=11)
    customer_id: str
    fingerprint_data: Optional[str] = Field(None, description="Base64 encoded fingerprint data")
    face_image: Optional[str] = Field(None, description="Base64 encoded face image")


class BiometricVerificationResponse(BaseModel):
    verification_id: str
    nin: str
    customer_id: str
    biometric_match: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    status: VerificationStatus
    verified_at: Optional[datetime] = None
    created_at: datetime


class VerificationEvent(BaseModel):
    event_id: str
    event_type: str
    verification_id: str
    customer_id: str
    verification_type: VerificationType
    status: VerificationStatus
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
