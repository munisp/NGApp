"""Exception classes for Liveness Detection Client."""

from typing import Optional, Dict, Any


class LivenessDetectionError(Exception):
    """Base exception for Liveness Detection Client."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        """
        Initialize exception.
        
        Args:
            message: Error message
            details: Additional error details
        """
        super().__init__(message)
        self.message = message
        self.details = details or {}


class APIError(LivenessDetectionError):
    """API request error."""
    
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize API error.
        
        Args:
            message: Error message
            status_code: HTTP status code
            details: Additional error details
        """
        super().__init__(message, details)
        self.status_code = status_code


class ValidationError(LivenessDetectionError):
    """Request validation error."""
    pass


class NotFoundError(LivenessDetectionError):
    """Resource not found error."""
    pass


class UnauthorizedError(LivenessDetectionError):
    """Authentication error."""
    pass


class ForbiddenError(LivenessDetectionError):
    """Authorization error (insufficient permissions)."""
    pass


class RateLimitError(LivenessDetectionError):
    """Rate limit exceeded error."""
    
    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize rate limit error.
        
        Args:
            message: Error message
            retry_after: Seconds to wait before retrying
            details: Additional error details
        """
        super().__init__(message, details)
        self.retry_after = retry_after


class ServerError(LivenessDetectionError):
    """Server error (5xx status codes)."""
    pass


class TimeoutError(LivenessDetectionError):
    """Request timeout error."""
    pass


class ConnectionError(LivenessDetectionError):
    """Connection error."""
    pass
