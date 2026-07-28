"""Liveness Detection Python Client SDK."""

from .client import LivenessDetectionClient
from .auth import KeycloakAuth, AuthenticationError
from .models import (
    LivenessType,
    LivenessStatus,
    AntiSpoofingResult,
    FaceQuality,
    FaceMatching,
    LivenessCheckRequest,
    LivenessCheckResponse,
    LivenessCheckListResponse,
    HealthCheckResponse,
    ErrorResponse,
)
from .exceptions import (
    LivenessDetectionError,
    APIError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    RateLimitError,
    ServerError,
    TimeoutError,
    ConnectionError,
)

__version__ = "1.0.0"
__all__ = [
    # Client
    "LivenessDetectionClient",
    # Auth
    "KeycloakAuth",
    "AuthenticationError",
    # Models
    "LivenessType",
    "LivenessStatus",
    "AntiSpoofingResult",
    "FaceQuality",
    "FaceMatching",
    "LivenessCheckRequest",
    "LivenessCheckResponse",
    "LivenessCheckListResponse",
    "HealthCheckResponse",
    "ErrorResponse",
    # Exceptions
    "LivenessDetectionError",
    "APIError",
    "ValidationError",
    "NotFoundError",
    "UnauthorizedError",
    "ForbiddenError",
    "RateLimitError",
    "ServerError",
    "TimeoutError",
    "ConnectionError",
]
