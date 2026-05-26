"""
OpenTelemetry setup for OG-RMM Python services.

Usage in each service:
    from otel_setup import init_otel, get_tracer
    init_otel("analytics-service")
    tracer = get_tracer("analytics-service")

    with tracer.start_as_current_span("process_telemetry") as span:
        span.set_attribute("well.id", well_id)
        span.set_attribute("data.points", len(data))
        # ... processing ...
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# OpenTelemetry imports — gracefully handle missing packages
try:
    from opentelemetry import trace, metrics
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ALWAYS_ON
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.prometheus import PrometheusMetricReader
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.propagate import set_global_textmap
    from opentelemetry.propagators.b3 import B3MultiFormat
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    logger.warning("[OTel] opentelemetry packages not installed — tracing disabled")

_tracer_provider: Optional[object] = None
_meter_provider: Optional[object] = None


def init_otel(service_name: str, service_version: str = "1.0.0") -> None:
    """Initialize OpenTelemetry for a Python service.
    
    Reads configuration from environment variables:
    - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP gRPC endpoint (default: otel-collector:4317)
    - OTEL_ENVIRONMENT: deployment environment (default: development)
    - OTEL_SAMPLE_RATE: sampling rate 0.0-1.0 (default: 1.0 in dev, 0.1 in prod)
    """
    global _tracer_provider, _meter_provider

    if not OTEL_AVAILABLE:
        logger.warning(f"[OTel] Skipping OTel init for {service_name} — packages not installed")
        return

    env = os.getenv("OTEL_ENVIRONMENT", "development")
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "otel-collector:4317")

    # Determine sampling rate
    default_sample_rate = 0.1 if env == "production" else 1.0
    try:
        sample_rate = float(os.getenv("OTEL_SAMPLE_RATE", str(default_sample_rate)))
    except ValueError:
        sample_rate = default_sample_rate

    # Build resource
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": env,
        "service.namespace": "og-rmm",
    })

    # Configure sampler
    sampler = ALWAYS_ON if sample_rate >= 1.0 else TraceIdRatioBased(sample_rate)

    # Configure trace exporter
    try:
        span_exporter = OTLPSpanExporter(
            endpoint=endpoint,
            insecure=True,
        )
        span_processor = BatchSpanProcessor(span_exporter)
    except Exception as e:
        logger.warning(f"[OTel] OTLP exporter unavailable ({e}) — using no-op")
        span_processor = None

    # Initialize TracerProvider
    tp = TracerProvider(resource=resource, sampler=sampler)
    if span_processor:
        tp.add_span_processor(span_processor)
    trace.set_tracer_provider(tp)
    _tracer_provider = tp

    # Configure metrics with Prometheus reader
    try:
        prometheus_reader = PrometheusMetricReader()
        mp = MeterProvider(resource=resource, metric_readers=[prometheus_reader])
        metrics.set_meter_provider(mp)
        _meter_provider = mp
    except Exception as e:
        logger.warning(f"[OTel] Prometheus metrics unavailable ({e})")

    # Set W3C + B3 propagation
    set_global_textmap(B3MultiFormat())

    # Auto-instrument common libraries
    try:
        RequestsInstrumentor().instrument()
    except Exception:
        pass

    logger.info(f"[OTel] Initialized for {service_name} (env={env}, sample_rate={sample_rate})")


def get_tracer(name: str) -> "trace.Tracer":
    """Get a named tracer. Returns a no-op tracer if OTel is not initialized."""
    if not OTEL_AVAILABLE:
        class NoOpTracer:
            def start_as_current_span(self, name, **kwargs):
                from contextlib import contextmanager
                @contextmanager
                def noop():
                    class NoOpSpan:
                        def set_attribute(self, *args): pass
                        def record_exception(self, *args): pass
                        def set_status(self, *args): pass
                    yield NoOpSpan()
                return noop()
        return NoOpTracer()
    return trace.get_tracer(name)


def get_meter(name: str) -> "metrics.Meter":
    """Get a named meter. Returns a no-op meter if OTel is not initialized."""
    if not OTEL_AVAILABLE:
        class NoOpMeter:
            def create_counter(self, *args, **kwargs): 
                class NoOpCounter:
                    def add(self, *args, **kwargs): pass
                return NoOpCounter()
            def create_histogram(self, *args, **kwargs):
                class NoOpHistogram:
                    def record(self, *args, **kwargs): pass
                return NoOpHistogram()
        return NoOpMeter()
    return metrics.get_meter(name)


def instrument_fastapi(app) -> None:
    """Auto-instrument a FastAPI application with OTel."""
    if not OTEL_AVAILABLE:
        return
    try:
        FastAPIInstrumentor.instrument_app(app)
        logger.info("[OTel] FastAPI instrumented")
    except Exception as e:
        logger.warning(f"[OTel] FastAPI instrumentation failed: {e}")


def instrument_sqlalchemy(engine) -> None:
    """Auto-instrument a SQLAlchemy engine with OTel."""
    if not OTEL_AVAILABLE:
        return
    try:
        SQLAlchemyInstrumentor().instrument(engine=engine)
        logger.info("[OTel] SQLAlchemy instrumented")
    except Exception as e:
        logger.warning(f"[OTel] SQLAlchemy instrumentation failed: {e}")


def shutdown() -> None:
    """Flush and shutdown all OTel providers."""
    global _tracer_provider, _meter_provider
    if _tracer_provider:
        try:
            _tracer_provider.shutdown()
        except Exception as e:
            logger.warning(f"[OTel] TracerProvider shutdown error: {e}")
    if _meter_provider:
        try:
            _meter_provider.shutdown()
        except Exception as e:
            logger.warning(f"[OTel] MeterProvider shutdown error: {e}")
