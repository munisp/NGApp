"""
Circuit Breaker for Agent Management External Service Calls

Provides resilient external service calls for agent management:
- Keycloak authentication
- Permify authorization
- TigerBeetle ledger operations
- Kafka event publishing
- Fluvio streaming
- Dapr service invocation
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, Optional, TypeVar

import httpx

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class FailureMode(str, Enum):
    FAIL_OPEN = "fail_open"
    FAIL_CLOSED = "fail_closed"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    half_open_requests: int = 3
    failure_mode: FailureMode = FailureMode.FAIL_OPEN
    default_response: Optional[Dict[str, Any]] = None


@dataclass
class CircuitStats:
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    half_open_successes: int = 0
    total_calls: int = 0
    total_failures: int = 0


class CircuitBreaker:
    """Circuit breaker implementation for external service calls"""
    
    def __init__(self, name: str, config: CircuitBreakerConfig = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.stats = CircuitStats()
        self._lock = asyncio.Lock()
    
    @property
    def state(self) -> CircuitState:
        return self.stats.state
    
    async def _should_attempt_reset(self) -> bool:
        if self.stats.last_failure_time is None:
            return True
        elapsed = time.time() - self.stats.last_failure_time
        return elapsed >= self.config.recovery_timeout
    
    async def _transition_to(self, new_state: CircuitState):
        old_state = self.stats.state
        self.stats.state = new_state
        if new_state == CircuitState.HALF_OPEN:
            self.stats.half_open_successes = 0
        elif new_state == CircuitState.CLOSED:
            self.stats.failure_count = 0
        logger.info(f"Circuit breaker '{self.name}': {old_state} -> {new_state}")
    
    async def _record_success(self):
        async with self._lock:
            self.stats.success_count += 1
            self.stats.last_success_time = time.time()
            if self.stats.state == CircuitState.HALF_OPEN:
                self.stats.half_open_successes += 1
                if self.stats.half_open_successes >= self.config.half_open_requests:
                    await self._transition_to(CircuitState.CLOSED)
    
    async def _record_failure(self):
        async with self._lock:
            self.stats.failure_count += 1
            self.stats.total_failures += 1
            self.stats.last_failure_time = time.time()
            if self.stats.state == CircuitState.HALF_OPEN:
                await self._transition_to(CircuitState.OPEN)
            elif self.stats.failure_count >= self.config.failure_threshold:
                await self._transition_to(CircuitState.OPEN)
    
    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        self.stats.total_calls += 1
        
        async with self._lock:
            if self.stats.state == CircuitState.OPEN:
                if await self._should_attempt_reset():
                    await self._transition_to(CircuitState.HALF_OPEN)
                else:
                    if self.config.failure_mode == FailureMode.FAIL_CLOSED:
                        raise CircuitOpenError(f"Circuit breaker '{self.name}' is OPEN")
                    logger.warning(f"Circuit breaker '{self.name}' is OPEN, returning default")
                    return self.config.default_response
        
        try:
            result = await func(*args, **kwargs)
            await self._record_success()
            return result
        except Exception as e:
            await self._record_failure()
            if self.config.failure_mode == FailureMode.FAIL_CLOSED:
                raise
            logger.warning(f"Circuit breaker '{self.name}' caught error: {e}")
            return self.config.default_response
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "state": self.stats.state.value,
            "failure_count": self.stats.failure_count,
            "success_count": self.stats.success_count,
            "total_calls": self.stats.total_calls,
            "total_failures": self.stats.total_failures,
            "failure_mode": self.config.failure_mode.value
        }


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and fail_closed mode"""
    pass


class AgentCircuitBreakerRegistry:
    """Registry of circuit breakers for agent management services"""
    
    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
    
    def get_or_create(self, name: str, config: CircuitBreakerConfig = None) -> CircuitBreaker:
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(name, config)
        return self._breakers[name]
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        return {name: breaker.get_stats() for name, breaker in self._breakers.items()}


# Global registry
agent_circuit_registry = AgentCircuitBreakerRegistry()


# Pre-configured circuit breakers for agent management services

def get_keycloak_breaker() -> CircuitBreaker:
    """Keycloak authentication - FAIL CLOSED (critical for security)"""
    return agent_circuit_registry.get_or_create(
        "keycloak",
        CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=60.0,
            half_open_requests=2,
            failure_mode=FailureMode.FAIL_CLOSED,
            default_response=None
        )
    )


def get_permify_breaker() -> CircuitBreaker:
    """Permify authorization - FAIL CLOSED (critical for security)"""
    return agent_circuit_registry.get_or_create(
        "permify",
        CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=60.0,
            half_open_requests=2,
            failure_mode=FailureMode.FAIL_CLOSED,
            default_response=None
        )
    )


def get_tigerbeetle_breaker() -> CircuitBreaker:
    """TigerBeetle ledger - FAIL CLOSED (critical for money)"""
    return agent_circuit_registry.get_or_create(
        "tigerbeetle",
        CircuitBreakerConfig(
            failure_threshold=2,
            recovery_timeout=120.0,
            half_open_requests=1,
            failure_mode=FailureMode.FAIL_CLOSED,
            default_response=None
        )
    )


def get_kafka_breaker() -> CircuitBreaker:
    """Kafka event publishing - FAIL OPEN (events can be retried)"""
    return agent_circuit_registry.get_or_create(
        "kafka",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=30.0,
            half_open_requests=3,
            failure_mode=FailureMode.FAIL_OPEN,
            default_response={"published": False, "queued": True}
        )
    )


def get_fluvio_breaker() -> CircuitBreaker:
    """Fluvio streaming - FAIL OPEN (can fall back to Kafka)"""
    return agent_circuit_registry.get_or_create(
        "fluvio",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=30.0,
            half_open_requests=3,
            failure_mode=FailureMode.FAIL_OPEN,
            default_response={"streamed": False, "fallback": "kafka"}
        )
    )


def get_dapr_breaker() -> CircuitBreaker:
    """Dapr service invocation - FAIL OPEN with retry"""
    return agent_circuit_registry.get_or_create(
        "dapr",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=30.0,
            half_open_requests=3,
            failure_mode=FailureMode.FAIL_OPEN,
            default_response={"invoked": False, "retry": True}
        )
    )


def get_temporal_breaker() -> CircuitBreaker:
    """Temporal workflow - FAIL CLOSED (workflows must complete)"""
    return agent_circuit_registry.get_or_create(
        "temporal",
        CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=60.0,
            half_open_requests=2,
            failure_mode=FailureMode.FAIL_CLOSED,
            default_response=None
        )
    )


def get_lakehouse_breaker() -> CircuitBreaker:
    """Lakehouse analytics - FAIL OPEN (analytics not critical)"""
    return agent_circuit_registry.get_or_create(
        "lakehouse",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=30.0,
            half_open_requests=3,
            failure_mode=FailureMode.FAIL_OPEN,
            default_response={"recorded": False, "deferred": True}
        )
    )


def get_redis_breaker() -> CircuitBreaker:
    """Redis cache - FAIL OPEN (can work without cache)"""
    return agent_circuit_registry.get_or_create(
        "redis",
        CircuitBreakerConfig(
            failure_threshold=5,
            recovery_timeout=15.0,
            half_open_requests=3,
            failure_mode=FailureMode.FAIL_OPEN,
            default_response={"cached": False}
        )
    )


class ResilientAgentClient:
    """HTTP client with circuit breaker protection for agent services"""
    
    def __init__(
        self,
        base_url: str,
        circuit_breaker: CircuitBreaker,
        timeout: float = 30.0
    ):
        self.base_url = base_url
        self.circuit_breaker = circuit_breaker
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def get(self, path: str, **kwargs) -> Dict[str, Any]:
        async def _request():
            client = await self._get_client()
            response = await client.get(path, **kwargs)
            response.raise_for_status()
            return response.json()
        return await self.circuit_breaker.call(_request)
    
    async def post(self, path: str, json: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        async def _request():
            client = await self._get_client()
            response = await client.post(path, json=json, **kwargs)
            response.raise_for_status()
            return response.json()
        return await self.circuit_breaker.call(_request)
    
    async def put(self, path: str, json: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        async def _request():
            client = await self._get_client()
            response = await client.put(path, json=json, **kwargs)
            response.raise_for_status()
            return response.json()
        return await self.circuit_breaker.call(_request)
    
    async def delete(self, path: str, **kwargs) -> Dict[str, Any]:
        async def _request():
            client = await self._get_client()
            response = await client.delete(path, **kwargs)
            response.raise_for_status()
            return response.json()
        return await self.circuit_breaker.call(_request)


# Factory functions for resilient clients

def create_keycloak_client(base_url: str) -> ResilientAgentClient:
    """Create Keycloak client with fail-closed circuit breaker"""
    return ResilientAgentClient(
        base_url=base_url,
        circuit_breaker=get_keycloak_breaker(),
        timeout=10.0
    )


def create_permify_client(base_url: str) -> ResilientAgentClient:
    """Create Permify client with fail-closed circuit breaker"""
    return ResilientAgentClient(
        base_url=base_url,
        circuit_breaker=get_permify_breaker(),
        timeout=10.0
    )


def create_tigerbeetle_client(base_url: str) -> ResilientAgentClient:
    """Create TigerBeetle client with fail-closed circuit breaker"""
    return ResilientAgentClient(
        base_url=base_url,
        circuit_breaker=get_tigerbeetle_breaker(),
        timeout=30.0
    )


def create_dapr_client(base_url: str) -> ResilientAgentClient:
    """Create Dapr client with fail-open circuit breaker"""
    return ResilientAgentClient(
        base_url=base_url,
        circuit_breaker=get_dapr_breaker(),
        timeout=30.0
    )


def create_lakehouse_client(base_url: str) -> ResilientAgentClient:
    """Create Lakehouse client with fail-open circuit breaker"""
    return ResilientAgentClient(
        base_url=base_url,
        circuit_breaker=get_lakehouse_breaker(),
        timeout=30.0
    )


# Health check endpoint for circuit breaker status
async def get_circuit_breaker_health() -> Dict[str, Any]:
    """Get health status of all circuit breakers"""
    stats = agent_circuit_registry.get_all_stats()
    
    # Determine overall health
    critical_breakers = ["keycloak", "permify", "tigerbeetle", "temporal"]
    critical_open = any(
        stats.get(name, {}).get("state") == "open"
        for name in critical_breakers
    )
    
    return {
        "healthy": not critical_open,
        "circuit_breakers": stats,
        "critical_services_available": not critical_open,
        "timestamp": datetime.utcnow().isoformat()
    }
