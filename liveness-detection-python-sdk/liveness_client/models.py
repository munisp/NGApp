"""Data models for Liveness Detection Service."""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class LivenessType(str, Enum):
    """Liveness detection type."""
    PASSIVE = "passive"
    ACTIVE = "active"


class LivenessStatus(str, Enum):
    """Liveness check status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVIEW_REQUIRED = "review_required"


class AntiSpoofingResult(BaseModel):
    """Anti-spoofing detection results."""
    is_photo: bool = Field(..., description="Whether a printed photo was detected")
    is_video: bool = Field(..., description="Whether a video replay was detected")
    is_mask: bool = Field(..., description="Whether a mask was detected")
    is_deepfake: bool = Field(..., description="Whether a deepfake was detected")
    texture_score: float = Field(..., ge=0.0, le=1.0, description="Texture analysis score")
    color_score: float = Field(..., ge=0.0, le=1.0, description="Color analysis score")
    reflection_score: float = Field(..., ge=0.0, le=1.0, description="Reflection analysis score")
    depth_score: float = Field(..., ge=0.0, le=1.0, description="Depth analysis score")


class FaceQuality(BaseModel):
    """Face quality metrics."""
    brightness: float = Field(..., ge=0.0, le=1.0, description="Brightness score")
    sharpness: float = Field(..., ge=0.0, le=1.0, description="Sharpness score")
    frontal_score: float = Field(..., ge=0.0, le=1.0, description="Frontal face score")


class FaceMatching(BaseModel):
    """Face matching results."""
    match_found: bool = Field(..., description="Whether a face match was found")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Face similarity score")
    match_confidence: str = Field(..., description="Match confidence level (low/medium/high)")


class LivenessCheckRequest(BaseModel):
    """Request model for liveness check."""
    customer_id: str = Field(..., description="Customer ID")
    liveness_type: LivenessType = Field(..., description="Type of liveness check")
    
    class Config:
        use_enum_values = True


class LivenessCheckResponse(BaseModel):
    """Response model for liveness check."""
    check_id: str = Field(..., description="Unique check ID")
    customer_id: str = Field(..., description="Customer ID")
    liveness_type: str = Field(..., description="Type of liveness check")
    is_live: bool = Field(..., description="Whether liveness was detected")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall confidence score")
    anti_spoofing: AntiSpoofingResult = Field(..., description="Anti-spoofing results")
    face_quality: FaceQuality = Field(..., description="Face quality metrics")
    face_matching: Optional[FaceMatching] = Field(None, description="Face matching results")
    status: LivenessStatus = Field(..., description="Check status")
    checked_at: datetime = Field(..., description="Timestamp of check")
    checked_by: str = Field(..., description="User who performed the check")
    notes: Optional[str] = Field(None, description="Additional notes")


class LivenessCheckListResponse(BaseModel):
    """Response model for list of liveness checks."""
    checks: list[LivenessCheckResponse] = Field(..., description="List of liveness checks")
    total: int = Field(..., description="Total number of checks")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(..., description="Offset for pagination")


class HealthCheckResponse(BaseModel):
    """Response model for health check."""
    status: str = Field(..., description="Service health status")
    timestamp: Optional[datetime] = Field(None, description="Timestamp of health check")
    version: Optional[str] = Field(None, description="Service version")


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
