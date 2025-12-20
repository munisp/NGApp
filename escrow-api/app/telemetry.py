"""
OpenTelemetry Tracing for EscrowProtect Platform

Provides distributed tracing with correlation IDs across:
- FastAPI HTTP requests
- Kafka publish/consume
- Temporal workflow/activity spans
- Database operations
- TigerBeetle ledger operations

Exports traces to OpenTelemetry Collector (OTLP) and logs correlation IDs to OpenSearch.
"""

import os
import logging
import uuid
from typing import Any, Dict, Optional, Callable
from datetime import datetime
from functools import wraps
from contextvars import ContextVar
import json

logger = logging.getLogger(__name__)

# Configuration
OTEL_ENABLED = os.getenv("OTEL_ENABLED", "true").lower() == "true"
OTEL_EXPORTER_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
OTEL_SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "escrow-api")
OTEL_ENVIRONMENT = os.getenv("OTEL_ENVIRONMENT", "development")

# Context variables for trace propagation
current_trace_id: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)
current_span_id: ContextVar[Optional[str]] = ContextVar("span_id", default=None)
current_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)

# OpenTelemetry components (lazy initialized)
_tracer = None
_meter = None
_initialized = False


def generate_trace_id() -> str:
    """Generate a new trace ID"""
    return uuid.uuid4().hex


def generate_span_id() -> str:
    """Generate a new span ID"""
    return uuid.uuid4().hex[:16]


def get_correlation_id() -> str:
    """Get current correlation ID or generate new one"""
    cid = current_correlation_id.get()
    if not cid:
        cid = f"corr-{uuid.uuid4().hex[:12]}"
        current_correlation_id.set(cid)
    return cid


async def initialize_telemetry() -> bool:
    """Initialize OpenTelemetry SDK"""
    global _tracer, _meter, _initialized
    
    if _initialized:
        return True
    
    if not OTEL_ENABLED:
        logger.info("OpenTelemetry disabled via OTEL_ENABLED=false")
        _initialized = True
        return True
    
    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        
        # Create resource
        resource = Resource.create({
            SERVICE_NAME: OTEL_SERVICE_NAME,
            SERVICE_VERSION: "1.0.0",
            "deployment.environment": OTEL_ENVIRONMENT,
        })
        
        # Setup tracer
        tracer_provider = TracerProvider(resource=resource)
        otlp_exporter = OTLPSpanExporter(endpoint=OTEL_EXPORTER_ENDPOINT, insecure=True)
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(tracer_provider)
        _tracer = trace.get_tracer(__name__)
        
        # Setup meter
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=OTEL_EXPORTER_ENDPOINT, insecure=True),
            export_interval_millis=60000,
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)
        _meter = metrics.get_meter(__name__)
        
        _initialized = True
        logger.info(f"OpenTelemetry initialized, exporting to {OTEL_EXPORTER_ENDPOINT}")
        return True
        
    except ImportError as e:
        logger.warning(f"OpenTelemetry packages not installed: {e}")
        _initialized = True
        return True
    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}")
        _initialized = True
        return True


class Span:
    """
    Lightweight span wrapper that works with or without OpenTelemetry.
    Provides consistent interface for tracing.
    """
    
    def __init__(
        self,
        name: str,
        kind: str = "internal",
        attributes: Optional[Dict[str, Any]] = None,
        parent_span_id: Optional[str] = None,
    ):
        self.name = name
        self.kind = kind
        self.attributes = attributes or {}
        self.trace_id = current_trace_id.get() or generate_trace_id()
        self.span_id = generate_span_id()
        self.parent_span_id = parent_span_id or current_span_id.get()
        self.correlation_id = get_correlation_id()
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        self.status = "ok"
        self.error: Optional[str] = None
        self._otel_span = None
        
        # Set context
        current_trace_id.set(self.trace_id)
        current_span_id.set(self.span_id)
    
    def set_attribute(self, key: str, value: Any) -> "Span":
        """Set span attribute"""
        self.attributes[key] = value
        if self._otel_span:
            try:
                self._otel_span.set_attribute(key, str(value) if not isinstance(value, (str, int, float, bool)) else value)
            except Exception:
                pass
        return self
    
    def set_status(self, status: str, error: Optional[str] = None) -> "Span":
        """Set span status"""
        self.status = status
        self.error = error
        return self
    
    def record_exception(self, exception: Exception) -> "Span":
        """Record exception in span"""
        self.status = "error"
        self.error = str(exception)
        if self._otel_span:
            try:
                self._otel_span.record_exception(exception)
            except Exception:
                pass
        return self
    
    def end(self) -> None:
        """End the span"""
        self.end_time = datetime.utcnow()
        if self._otel_span:
            try:
                self._otel_span.end()
            except Exception:
                pass
        
        # Log span completion
        duration_ms = (self.end_time - self.start_time).total_seconds() * 1000
        log_data = {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "correlation_id": self.correlation_id,
            "name": self.name,
            "kind": self.kind,
            "duration_ms": round(duration_ms, 2),
            "status": self.status,
            "attributes": self.attributes,
        }
        if self.error:
            log_data["error"] = self.error
        
        logger.debug(f"Span completed: {json.dumps(log_data)}")
    
    def __enter__(self) -> "Span":
        if _tracer:
            try:
                from opentelemetry.trace import SpanKind
                kind_map = {
                    "internal": SpanKind.INTERNAL,
                    "server": SpanKind.SERVER,
                    "client": SpanKind.CLIENT,
                    "producer": SpanKind.PRODUCER,
                    "consumer": SpanKind.CONSUMER,
                }
                self._otel_span = _tracer.start_span(
                    self.name,
                    kind=kind_map.get(self.kind, SpanKind.INTERNAL),
                    attributes=self.attributes,
                )
                self._otel_span.__enter__()
            except Exception:
                pass
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_val:
            self.record_exception(exc_val)
        self.end()
        if self._otel_span:
            try:
                self._otel_span.__exit__(exc_type, exc_val, exc_tb)
            except Exception:
                pass


def trace_span(
    name: str,
    kind: str = "internal",
    attributes: Optional[Dict[str, Any]] = None,
):
    """
    Decorator for tracing functions.
    
    Usage:
        @trace_span("create_escrow", kind="server", attributes={"escrow.type": "standard"})
        async def create_escrow(request: CreateEscrowRequest) -> EscrowResponse:
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            with Span(name, kind=kind, attributes=attributes or {}) as span:
                span.set_attribute("function", func.__name__)
                try:
                    result = await func(*args, **kwargs)
                    span.set_status("ok")
                    return result
                except Exception as e:
                    span.record_exception(e)
                    raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            with Span(name, kind=kind, attributes=attributes or {}) as span:
                span.set_attribute("function", func.__name__)
                try:
                    result = func(*args, **kwargs)
                    span.set_status("ok")
                    return result
                except Exception as e:
                    span.record_exception(e)
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# Specialized span creators for different operation types

def http_span(method: str, path: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for HTTP request"""
    attrs = {
        "http.method": method,
        "http.route": path,
        **(attributes or {}),
    }
    return Span(f"HTTP {method} {path}", kind="server", attributes=attrs)


def db_span(operation: str, table: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for database operation"""
    attrs = {
        "db.system": "postgresql",
        "db.operation": operation,
        "db.sql.table": table,
        **(attributes or {}),
    }
    return Span(f"DB {operation} {table}", kind="client", attributes=attrs)


def kafka_producer_span(topic: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for Kafka produce"""
    attrs = {
        "messaging.system": "kafka",
        "messaging.destination": topic,
        "messaging.operation": "publish",
        **(attributes or {}),
    }
    return Span(f"Kafka publish {topic}", kind="producer", attributes=attrs)


def kafka_consumer_span(topic: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for Kafka consume"""
    attrs = {
        "messaging.system": "kafka",
        "messaging.destination": topic,
        "messaging.operation": "receive",
        **(attributes or {}),
    }
    return Span(f"Kafka consume {topic}", kind="consumer", attributes=attrs)


def temporal_workflow_span(workflow_type: str, workflow_id: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for Temporal workflow"""
    attrs = {
        "temporal.workflow_type": workflow_type,
        "temporal.workflow_id": workflow_id,
        **(attributes or {}),
    }
    return Span(f"Temporal workflow {workflow_type}", kind="internal", attributes=attrs)


def temporal_activity_span(activity_type: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for Temporal activity"""
    attrs = {
        "temporal.activity_type": activity_type,
        **(attributes or {}),
    }
    return Span(f"Temporal activity {activity_type}", kind="internal", attributes=attrs)


def tigerbeetle_span(operation: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
    """Create span for TigerBeetle ledger operation"""
    attrs = {
        "ledger.system": "tigerbeetle",
        "ledger.operation": operation,
        **(attributes or {}),
    }
    return Span(f"TigerBeetle {operation}", kind="client", attributes=attrs)


# Trace context propagation for Kafka messages

def inject_trace_context(headers: Dict[str, str]) -> Dict[str, str]:
    """Inject trace context into message headers"""
    headers["X-Trace-Id"] = current_trace_id.get() or generate_trace_id()
    headers["X-Span-Id"] = current_span_id.get() or generate_span_id()
    headers["X-Correlation-Id"] = get_correlation_id()
    return headers


def extract_trace_context(headers: Dict[str, str]) -> None:
    """Extract trace context from message headers"""
    if "X-Trace-Id" in headers:
        current_trace_id.set(headers["X-Trace-Id"])
    if "X-Span-Id" in headers:
        current_span_id.set(headers["X-Span-Id"])
    if "X-Correlation-Id" in headers:
        current_correlation_id.set(headers["X-Correlation-Id"])


# FastAPI middleware

async def telemetry_middleware(request, call_next):
    """FastAPI middleware for automatic request tracing"""
    # Extract or generate trace context
    trace_id = request.headers.get("X-Trace-Id") or generate_trace_id()
    correlation_id = request.headers.get("X-Correlation-Id") or f"corr-{uuid.uuid4().hex[:12]}"
    
    current_trace_id.set(trace_id)
    current_correlation_id.set(correlation_id)
    
    with http_span(request.method, request.url.path, {
        "http.url": str(request.url),
        "http.host": request.headers.get("host", ""),
        "http.user_agent": request.headers.get("user-agent", ""),
    }) as span:
        try:
            response = await call_next(request)
            span.set_attribute("http.status_code", response.status_code)
            if response.status_code >= 400:
                span.set_status("error")
            
            # Add trace headers to response
            response.headers["X-Trace-Id"] = trace_id
            response.headers["X-Correlation-Id"] = correlation_id
            
            return response
        except Exception as e:
            span.record_exception(e)
            raise


# Metrics

class Metrics:
    """Metrics collection for observability"""
    
    def __init__(self):
        self._counters: Dict[str, Any] = {}
        self._histograms: Dict[str, Any] = {}
        self._gauges: Dict[str, Any] = {}
    
    def counter(self, name: str, value: int = 1, labels: Optional[Dict[str, str]] = None) -> None:
        """Increment counter metric"""
        if _meter:
            try:
                if name not in self._counters:
                    self._counters[name] = _meter.create_counter(name)
                self._counters[name].add(value, labels or {})
            except Exception:
                pass
    
    def histogram(self, name: str, value: float, labels: Optional[Dict[str, str]] = None) -> None:
        """Record histogram metric"""
        if _meter:
            try:
                if name not in self._histograms:
                    self._histograms[name] = _meter.create_histogram(name)
                self._histograms[name].record(value, labels or {})
            except Exception:
                pass
    
    def gauge(self, name: str, value: float, labels: Optional[Dict[str, str]] = None) -> None:
        """Set gauge metric"""
        if _meter:
            try:
                if name not in self._gauges:
                    self._gauges[name] = _meter.create_up_down_counter(name)
                self._gauges[name].add(value, labels or {})
            except Exception:
                pass


metrics = Metrics()


# Health check

async def telemetry_health() -> Dict[str, Any]:
    """Get telemetry health status"""
    return {
        "enabled": OTEL_ENABLED,
        "initialized": _initialized,
        "exporter_endpoint": OTEL_EXPORTER_ENDPOINT if OTEL_ENABLED else None,
        "service_name": OTEL_SERVICE_NAME,
        "environment": OTEL_ENVIRONMENT,
        "tracer_available": _tracer is not None,
        "meter_available": _meter is not None,
    }
