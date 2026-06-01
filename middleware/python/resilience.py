"""
Circuit breaker and retry utilities for OG-RMM Python services.

Usage:
    from resilience import CircuitBreaker, with_retry

    cb = CircuitBreaker("upstream-api", failure_threshold=5)
    result = await cb.execute(lambda: http_client.get("/api/data"))

    result = await with_retry(lambda: http_client.post("/api/ingest", data), max_retries=3)
"""

import asyncio
import logging
import time
from enum import Enum
from typing import Any, Awaitable, Callable, Optional, TypeVar

import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitOpenError(Exception):
    def __init__(self, name: str):
        super().__init__(f"Circuit breaker '{name}' is OPEN — request rejected")
        self.name = name


class CircuitBreaker:
    """Thread-safe circuit breaker for async service calls."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        reset_timeout_secs: float = 30.0,
        half_open_max_probes: int = 1,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout_secs
        self.half_open_max_probes = half_open_max_probes
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._last_failure_time = 0.0
        self._half_open_probes = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    async def execute(self, fn: Callable[[], Awaitable[T]]) -> T:
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if time.monotonic() - self._last_failure_time >= self.reset_timeout:
                    self._transition(CircuitState.HALF_OPEN)
                else:
                    raise CircuitOpenError(self.name)

            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_probes >= self.half_open_max_probes:
                    raise CircuitOpenError(self.name)
                self._half_open_probes += 1

        try:
            result = await fn()
        except Exception:
            async with self._lock:
                self._failures += 1
                self._last_failure_time = time.monotonic()
                if self._state == CircuitState.HALF_OPEN:
                    self._transition(CircuitState.OPEN)
                    self._half_open_probes = 0
                elif self._failures >= self.failure_threshold:
                    self._transition(CircuitState.OPEN)
            raise

        async with self._lock:
            if self._state in (CircuitState.HALF_OPEN, CircuitState.OPEN):
                self._transition(CircuitState.CLOSED)
            self._failures = 0
            self._half_open_probes = 0

        return result

    def _transition(self, to: CircuitState) -> None:
        if self._state == to:
            return
        logger.info(f"[circuit-breaker] {self.name}: {self._state.value} → {to.value}")
        self._state = to


RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    base_delay: float = 0.2,
    max_delay: float = 5.0,
    jitter: bool = True,
) -> T:
    """Execute an async function with exponential-backoff retry."""
    import random

    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            last_err = e
            if attempt == max_retries:
                break
            if not _is_retryable(e):
                raise

            delay = min(base_delay * (2 ** attempt), max_delay)
            if jitter:
                delay *= 0.5 + random.random() * 0.5
            logger.debug(
                f"Retrying after error (attempt {attempt + 1}/{max_retries}): {e}, delay={delay:.2f}s"
            )
            await asyncio.sleep(delay)

    raise last_err  # type: ignore[misc]


def _is_retryable(err: Exception) -> bool:
    if isinstance(err, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
        return True
    if isinstance(err, httpx.HTTPStatusError):
        return err.response.status_code in RETRYABLE_STATUS_CODES
    if isinstance(err, (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout)):
        return True
    return False


class ResilientHTTPClient:
    """HTTP client with circuit breaker + retry for inter-service calls."""

    def __init__(
        self,
        base_url: str,
        service_name: str,
        timeout: float = 10.0,
        max_retries: int = 3,
        circuit_breaker_threshold: int = 5,
    ):
        self.base_url = base_url.rstrip("/")
        self.service_name = service_name
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
        )
        self.cb = CircuitBreaker(service_name, failure_threshold=circuit_breaker_threshold)
        self.max_retries = max_retries

    async def get(self, path: str, **kwargs: Any) -> httpx.Response:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> httpx.Response:
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> httpx.Response:
        return await self._request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> httpx.Response:
        return await self._request("DELETE", path, **kwargs)

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        async def _do() -> httpx.Response:
            resp = await self.client.request(method, path, **kwargs)
            resp.raise_for_status()
            return resp

        return await self.cb.execute(
            lambda: with_retry(_do, max_retries=self.max_retries)
        )

    async def health_check(self) -> bool:
        try:
            resp = await self.client.get("/health", timeout=3.0)
            return resp.is_success
        except Exception:
            return False

    async def close(self) -> None:
        await self.client.aclose()
