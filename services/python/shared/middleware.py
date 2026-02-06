import json
import time
import uuid
import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class TracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        corr_id = request.headers.get("X-Correlation-ID", f"corr-{uuid.uuid4().hex[:12]}")
        trace_id = request.headers.get("X-Trace-ID", f"trace-{uuid.uuid4().hex[:16]}")
        span_id = f"span-{uuid.uuid4().hex[:12]}"

        request.state.correlation_id = corr_id
        request.state.trace_id = trace_id
        request.state.span_id = span_id

        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Span-ID"] = span_id
        return response


class PrometheusMetrics:
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.request_count: dict[str, int] = defaultdict(int)
        self.error_count: dict[str, int] = defaultdict(int)
        self.latency_sum: dict[str, float] = defaultdict(float)
        self.latency_count: dict[str, int] = defaultdict(int)
        self.buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
        self.bucket_counts: dict[str, list[int]] = {}

    def record(self, method: str, path: str, status_code: int, duration_ms: float):
        key = f"{method}_{path}"
        self.request_count[key] += 1
        if status_code >= 400:
            self.error_count[key] += 1
        self.latency_sum[key] += duration_ms
        self.latency_count[key] += 1

        if key not in self.bucket_counts:
            self.bucket_counts[key] = [0] * (len(self.buckets) + 1)
        for i, b in enumerate(self.buckets):
            if duration_ms <= b:
                self.bucket_counts[key][i] += 1
        self.bucket_counts[key][-1] += 1

    def format_prometheus(self) -> str:
        lines = []
        for key, count in self.request_count.items():
            lines.append(f'http_requests_total{{service="{self.service_name}",endpoint="{key}"}} {count}')
        for key, count in self.error_count.items():
            lines.append(f'http_errors_total{{service="{self.service_name}",endpoint="{key}"}} {count}')
        for key, buckets in self.bucket_counts.items():
            for i, b in enumerate(self.buckets):
                lines.append(f'http_request_duration_ms_bucket{{service="{self.service_name}",endpoint="{key}",le="{b}"}} {buckets[i]}')
            lines.append(f'http_request_duration_ms_bucket{{service="{self.service_name}",endpoint="{key}",le="+Inf"}} {buckets[-1]}')
            lines.append(f'http_request_duration_ms_sum{{service="{self.service_name}",endpoint="{key}"}} {self.latency_sum[key]:.3f}')
            lines.append(f'http_request_duration_ms_count{{service="{self.service_name}",endpoint="{key}"}} {self.latency_count[key]}')
        return "\n".join(lines)


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, metrics: PrometheusMetrics):
        super().__init__(app)
        self.metrics = metrics

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        self.metrics.record(request.method, request.url.path, response.status_code, duration_ms)
        return response


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    name: str
    max_failures: int = 5
    timeout: float = 30.0
    _failures: int = 0
    _state: CircuitState = CircuitState.CLOSED
    _last_failure: float = 0

    async def execute(self, fn: Callable, *args, **kwargs):
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure > self.timeout:
                self._state = CircuitState.HALF_OPEN
            else:
                raise Exception(f"Circuit breaker {self.name} is open")

        try:
            if asyncio.iscoroutinefunction(fn):
                result = await fn(*args, **kwargs)
            else:
                result = fn(*args, **kwargs)
            self._failures = 0
            self._state = CircuitState.CLOSED
            return result
        except Exception as e:
            self._failures += 1
            self._last_failure = time.time()
            if self._failures >= self.max_failures:
                self._state = CircuitState.OPEN
            raise

    @property
    def state(self) -> str:
        return self._state.value


async def retry_with_backoff(fn: Callable, max_retries: int = 3, base_delay: float = 1.0, *args, **kwargs):
    last_error = None
    for i in range(max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(fn):
                return await fn(*args, **kwargs)
            return fn(*args, **kwargs)
        except Exception as e:
            last_error = e
            if i < max_retries:
                delay = base_delay * (2 ** i) + (time.time() % 1) * base_delay
                await asyncio.sleep(delay)
    raise last_error


class StructuredLogger:
    def __init__(self, service: str):
        self.service = service
        self._logger = logging.getLogger(service)
        if not self._logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(message)s'))
            self._logger.addHandler(handler)
            self._logger.setLevel(logging.DEBUG)

    def _log(self, level: str, msg: str, **fields):
        entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "level": level,
            "service": self.service,
            "message": msg,
            **fields,
        }
        self._logger.info(json.dumps(entry))

    def info(self, msg: str, **fields):
        self._log("info", msg, **fields)

    def error(self, msg: str, **fields):
        self._log("error", msg, **fields)

    def warn(self, msg: str, **fields):
        self._log("warn", msg, **fields)

    def debug(self, msg: str, **fields):
        self._log("debug", msg, **fields)


async def validate_jwt_token(keycloak_url: str, token: str) -> tuple[bool, str]:
    if not keycloak_url or not token:
        return False, ""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{keycloak_url}/auth/validate",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("valid", False), data.get("user_id", "")
    except Exception:
        pass
    return False, ""


class JWTAuthMiddleware(BaseHTTPMiddleware):
    SKIP_PATHS = {"/health", "/metrics", "/prometheus", "/ready", "/live", "/docs", "/openapi.json"}

    def __init__(self, app, keycloak_url: str = ""):
        super().__init__(app)
        self.keycloak_url = keycloak_url

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and self.keycloak_url:
            token = auth[7:]
            valid, user_id = await validate_jwt_token(self.keycloak_url, token)
            if valid:
                request.state.user_id = user_id

        return await call_next(request)


def readiness_check(checks: dict[str, Callable[[], bool]]):
    async def handler():
        results = {}
        all_ready = True
        for name, check in checks.items():
            try:
                ok = check()
                results[name] = ok
                if not ok:
                    all_ready = False
            except Exception:
                results[name] = False
                all_ready = False
        return {"ready": all_ready, "checks": results}
    return handler
