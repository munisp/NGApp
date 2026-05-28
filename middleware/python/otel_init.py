"""
OpenTelemetry + Sentry initialization for Python microservices.

Usage:
    from otel_init import init_observability
    app = FastAPI()
    init_observability(app, service_name="openstef-service")
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def init_observability(app: "FastAPI", service_name: str = "og-rmm-python") -> None:  # type: ignore[name-defined]
    """Initialize OpenTelemetry tracing and Sentry error monitoring."""
    _init_otel(app, service_name)
    _init_sentry(service_name)


def _init_otel(app: "FastAPI", service_name: str) -> None:  # type: ignore[name-defined]
    if os.getenv("OTEL_ENABLED", "").lower() != "true":
        logger.info("OpenTelemetry disabled (set OTEL_ENABLED=true)")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        resource = Resource.create({"service.name": service_name, "service.version": "56.0.0"})
        provider = TracerProvider(resource=resource)
        endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry initialized: endpoint=%s service=%s", endpoint, service_name)
    except ImportError:
        logger.warning("OpenTelemetry packages not installed — skipping")
    except Exception as e:
        logger.error("OpenTelemetry init failed: %s", e)


def _init_sentry(service_name: str) -> None:
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        logger.info("Sentry DSN not configured — error monitoring disabled")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENVIRONMENT", "development"),
            release=f"{service_name}@56.0.0",
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            integrations=[FastApiIntegration()],
        )
        logger.info("Sentry error monitoring initialized for %s", service_name)
    except ImportError:
        logger.warning("sentry-sdk not installed — skipping")
    except Exception as e:
        logger.error("Sentry init failed: %s", e)
