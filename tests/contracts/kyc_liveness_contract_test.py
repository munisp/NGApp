"""
Contract test: KYC Orchestrator -> Liveness Service

Verifies the API contract between the KYC orchestrator and the
liveness detection service. Ensures that:
1. Request format matches expected schema
2. Response format matches expected schema
3. Error responses follow platform conventions
"""
import pytest
from pydantic import BaseModel, ValidationError
from typing import Optional, Dict, Any
from enum import Enum
from datetime import datetime


class LivenessType(str, Enum):
    ACTIVE = "active"
    PASSIVE = "passive"


class SpoofingType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    MASK = "mask"
    DEEPFAKE = "deepfake"
    NONE = "none"


class LivenessStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class LivenessResponse(BaseModel):
    id: str
    customer_id: str
    document_id: Optional[str] = None
    liveness_type: LivenessType
    liveness_score: Optional[float] = None
    face_match_score: Optional[float] = None
    is_live: bool
    spoofing_detected: bool
    spoofing_type: Optional[SpoofingType] = None
    status: LivenessStatus
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class ErrorResponse(BaseModel):
    error: Dict[str, Any]


class TestLivenessServiceContract:
    """Contract tests for the Liveness Detection Service API."""

    def test_passive_liveness_response_schema(self):
        """Verify passive liveness response matches expected schema."""
        response_data = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "customer_id": "660e8400-e29b-41d4-a716-446655440001",
            "document_id": None,
            "liveness_type": "passive",
            "liveness_score": 0.87,
            "face_match_score": None,
            "is_live": True,
            "spoofing_detected": False,
            "spoofing_type": "none",
            "status": "passed",
            "metadata": {
                "detection_method": "tinyliveness_onnx",
                "texture_score": 0.75,
                "color_score": 0.82,
                "reflection_score": 0.90,
                "depth_score": 0.68,
            },
            "created_at": "2024-01-15T10:30:00",
        }
        result = LivenessResponse(**response_data)
        assert result.is_live is True
        assert result.status == LivenessStatus.PASSED
        assert result.metadata["detection_method"] == "tinyliveness_onnx"

    def test_failed_liveness_response_schema(self):
        """Verify failed liveness response schema."""
        response_data = {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "customer_id": "660e8400-e29b-41d4-a716-446655440001",
            "liveness_type": "passive",
            "liveness_score": 0.25,
            "is_live": False,
            "spoofing_detected": True,
            "spoofing_type": "photo",
            "status": "failed",
            "metadata": {"detection_method": "tinyliveness_onnx"},
            "created_at": "2024-01-15T10:31:00",
        }
        result = LivenessResponse(**response_data)
        assert result.is_live is False
        assert result.spoofing_type == SpoofingType.PHOTO

    def test_active_liveness_response_schema(self):
        """Verify active liveness with hybrid detection method."""
        response_data = {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "customer_id": "660e8400-e29b-41d4-a716-446655440001",
            "liveness_type": "active",
            "liveness_score": 0.72,
            "is_live": True,
            "spoofing_detected": False,
            "status": "passed",
            "metadata": {
                "detection_method": "hybrid_motion_tinyliveness",
                "avg_motion": 35.2,
                "motion_variance": 42.8,
                "frame_count": 150,
                "avg_ml_liveness": 0.91,
                "ml_frame_samples": 6,
            },
            "created_at": "2024-01-15T10:32:00",
        }
        result = LivenessResponse(**response_data)
        assert result.liveness_type == LivenessType.ACTIVE
        assert result.metadata["detection_method"] == "hybrid_motion_tinyliveness"

    def test_error_response_schema(self):
        """Verify error responses follow platform conventions."""
        error_data = {
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid image format",
                "details": {"field": "file", "accepted": ["jpg", "png"]},
            }
        }
        result = ErrorResponse(**error_data)
        assert result.error["code"] == "VALIDATION_ERROR"

    def test_liveness_score_bounds(self):
        """Verify liveness score is within expected bounds."""
        response_data = {
            "id": "test-id",
            "customer_id": "test-customer",
            "liveness_type": "passive",
            "liveness_score": 0.87,
            "is_live": True,
            "spoofing_detected": False,
            "status": "passed",
            "created_at": "2024-01-15T10:30:00",
        }
        result = LivenessResponse(**response_data)
        assert 0.0 <= result.liveness_score <= 1.0

    def test_spoofing_type_consistency(self):
        """If spoofing is detected, spoofing_type should not be NONE."""
        response_data = {
            "id": "test-id",
            "customer_id": "test-customer",
            "liveness_type": "passive",
            "liveness_score": 0.3,
            "is_live": False,
            "spoofing_detected": True,
            "spoofing_type": "photo",
            "status": "failed",
            "created_at": "2024-01-15T10:30:00",
        }
        result = LivenessResponse(**response_data)
        assert result.spoofing_detected is True
        assert result.spoofing_type != SpoofingType.NONE


class TestClaimsPolicyContract:
    """Contract tests: Claims -> Policy Service."""

    def test_policy_lookup_response(self):
        """Claims service expects policy data in this format."""
        policy_data = {
            "policy_id": "POL-2024-001",
            "customer_id": "CUST-001",
            "product_type": "motor",
            "status": "active",
            "premium": 150000.0,
            "currency": "NGN",
            "effective_date": "2024-01-01",
            "expiry_date": "2025-01-01",
            "coverage_amount": 5000000.0,
        }
        assert "policy_id" in policy_data
        assert "status" in policy_data
        assert policy_data["status"] in ["active", "expired", "cancelled", "suspended"]


class TestPaymentPolicyContract:
    """Contract tests: Payment -> Policy Service."""

    def test_premium_payment_event(self):
        """Payment service publishes events in this format."""
        event = {
            "event_type": "payment.processed",
            "payload": {
                "payment_id": "PAY-001",
                "policy_id": "POL-2024-001",
                "customer_id": "CUST-001",
                "amount": 150000.0,
                "currency": "NGN",
                "method": "bank_transfer",
                "status": "completed",
                "reference": "REF-20240115-001",
            },
        }
        payload = event["payload"]
        assert payload["amount"] > 0
        assert payload["currency"] in ["NGN", "USD", "GBP", "EUR"]
        assert payload["status"] in ["pending", "completed", "failed", "refunded"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
