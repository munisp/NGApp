from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Float, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
import uuid

Base = declarative_base()

class DocumentType(str, Enum):
    NATIONAL_ID = "national_id"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    UTILITY_BILL = "utility_bill"
    CAC_CERTIFICATE = "cac_certificate"
    BANK_STATEMENT = "bank_statement"

class OCREngine(str, Enum):
    PADDLEOCR = "paddleocr"
    VLM = "vlm"
    DOCLING = "docling"

class VerificationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    VERIFIED = "verified"
    REJECTED = "rejected"
    FAILED = "failed"

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    document_type = Column(SQLEnum(DocumentType), nullable=False)
    document_number = Column(String(100), nullable=True)
    file_path = Column(String(500), nullable=False)
    ocr_engine = Column(SQLEnum(OCREngine), nullable=False)
    extracted_data = Column(JSON, nullable=True)
    confidence_score = Column(Float, nullable=True)
    verification_status = Column(SQLEnum(VerificationStatus), default=VerificationStatus.PENDING)
    verified_by = Column(UUID(as_uuid=True), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    fraud_indicators = Column(JSON, nullable=True)
    authenticity_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DocumentRequest(BaseModel):
    customer_id: str
    document_type: DocumentType
    ocr_engine: Optional[OCREngine] = OCREngine.PADDLEOCR

class DocumentResponse(BaseModel):
    id: str
    customer_id: str
    document_type: DocumentType
    document_number: Optional[str]
    ocr_engine: OCREngine
    extracted_data: Optional[Dict[str, Any]]
    confidence_score: Optional[float]
    verification_status: VerificationStatus
    authenticity_score: Optional[float]
    fraud_indicators: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExtractedData(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    lga: Optional[str] = None
    nin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None
    rc_number: Optional[str] = None
    registration_date: Optional[str] = None
    company_type: Optional[str] = None
    raw_text: Optional[str] = None
