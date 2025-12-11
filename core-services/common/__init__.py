"""
Common utilities for core services.

This module provides shared functionality across all microservices including:
- Circuit breaker pattern for resilient service calls
- Retry logic with exponential backoff
- Common error handling
"""

from .circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerError,
    CircuitBreakerRegistry,
    CircuitState,
    get_circuit_breaker,
    circuit_breaker,
)

__all__ = [
    "CircuitBreaker",
    "CircuitBreakerConfig",
    "CircuitBreakerError",
    "CircuitBreakerRegistry",
    "CircuitState",
    "get_circuit_breaker",
    "circuit_breaker",
]
