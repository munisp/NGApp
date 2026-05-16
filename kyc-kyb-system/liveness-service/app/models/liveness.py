from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Float, JSON, Enum as SQLEnum, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
import uuid

Base = declarative_base()

class LivenessType(str, Enum):
    ACTIVE = "active"
    PASSIVE = "passive"

class LivenessStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"

class SpoofingType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    MASK = "mask"
    DEEPFAKE = "deepfake"
    NONE = "none"

class LivenessCheck(Base):
    __tablename__ = "liveness_checks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), nullable=True)
    liveness_type = Column(SQLEnum(LivenessType), nullable=False)
    video_path = Column(String(500), nullable=True)
    image_path = Column(String(500), nullable=True)
    liveness_score = Column(Float, nullable=True)
    face_match_score = Column(Float, nullable=True)
    is_live = Column(Boolean, default=False)
    spoofing_detected = Column(Boolean, default=False)
    spoofing_type = Column(SQLEnum(SpoofingType), nullable=True)
    status = Column(SQLEnum(LivenessStatus), default=LivenessStatus.PENDING)
    metadata = Column(JSON, nullable=True)
    error_message = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LivenessRequest(BaseModel):
    customer_id: str
    document_id: Optional[str] = None
    liveness_type: LivenessType = LivenessType.PASSIVE

class LivenessResponse(BaseModel):
    id: str
    customer_id: str
    document_id: Optional[str]
    liveness_type: LivenessType
    liveness_score: Optional[float]
    face_match_score: Optional[float]
    is_live: bool
    spoofing_detected: bool
    spoofing_type: Optional[SpoofingType]
    status: LivenessStatus
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True
