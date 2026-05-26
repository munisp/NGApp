"""
Prometheus metrics instrumentation for Python payment services.
Provides standardized metrics across all Python services.
"""

from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client import CollectorRegistry, multiprocess, REGISTRY
from functools import wraps
import time
import os
from typing import Optional, Callable, Any


# Check if running in multiprocess mode
def _get_registry():
    """Get the appropriate registry for the environment."""
    if 'prometheus_multiproc_dir' in os.environ:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return registry
    return REGISTRY


# Transaction metrics
TRANSACTION_TOTAL = Counter(
    'payment_switch_transactions_total',
    'Total number of transactions processed',
    ['status', 'type', 'currency', 'service']
)

TRANSACTION_DURATION = Histogram(
    'payment_switch_transaction_duration_seconds',
    'Transaction processing duration in seconds',
    ['status', 'type', 'service'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
)

TRANSACTION_AMOUNT = Histogram(
    'payment_switch_transaction_amount',
    'Transaction amount distribution',
    ['currency', 'type'],
    buckets=[1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
)

TRANSACTIONS_IN_FLIGHT = Gauge(
    'payment_switch_transactions_in_flight',
    'Number of transactions currently being processed',
    ['type', 'service']
)

# API metrics
API_REQUEST_TOTAL = Counter(
    'payment_switch_api_requests_total',
    'Total number of API requests',
    ['method', 'endpoint', 'status', 'service']
)

API_REQUEST_DURATION = Histogram(
    'payment_switch_api_request_duration_seconds',
    'API request duration in seconds',
    ['method', 'endpoint', 'service'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
)

# Fraud detection metrics
FRAUD_SCORE = Histogram(
    'payment_switch_fraud_score',
    'Fraud score distribution',
    ['decision'],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

FRAUD_ALERTS = Gauge(
    'payment_switch_fraud_alerts_open',
    'Number of open fraud alerts'
)

FRAUD_ALERTS_CRITICAL = Gauge(
    'payment_switch_fraud_alerts_critical',
    'Number of critical fraud alerts'
)

FRAUD_DECISIONS = Counter(
    'payment_switch_fraud_decisions_total',
    'Total fraud decisions made',
    ['decision', 'model']
)

# KYC metrics
KYC_VERIFICATIONS = Counter(
    'payment_switch_kyc_verifications_total',
    'Total KYC verifications',
    ['status', 'type', 'provider']
)

KYC_VERIFICATION_DURATION = Histogram(
    'payment_switch_kyc_verification_duration_seconds',
    'KYC verification duration in seconds',
    ['type', 'provider'],
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

# Settlement metrics
SETTLEMENTS_PENDING = Gauge(
    'payment_switch_settlements_pending',
    'Number of pending settlements'
)

SETTLEMENTS_COMPLETED = Counter(
    'payment_switch_settlements_completed_total',
    'Total number of completed settlements',
    ['status']
)

SETTLEMENT_AMOUNT = Histogram(
    'payment_switch_settlement_amount',
    'Settlement amount distribution',
    ['currency'],
    buckets=[1e6, 1e7, 1e8, 1e9, 1e10]
)

# External service metrics
EXTERNAL_SERVICE_REQUESTS = Counter(
    'payment_switch_external_service_requests_total',
    'Total requests to external services',
    ['service', 'operation', 'status']
)

EXTERNAL_SERVICE_LATENCY = Histogram(
    'payment_switch_external_service_latency_seconds',
    'External service latency in seconds',
    ['service', 'operation'],
    buckets=[0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
)

# Database metrics
DB_QUERY_DURATION = Histogram(
    'payment_switch_db_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
)

DB_CONNECTIONS = Gauge(
    'payment_switch_db_connections',
    'Database connection pool status',
    ['state']
)

# Cache metrics
CACHE_HITS = Counter(
    'payment_switch_cache_hits_total',
    'Total cache hits',
    ['cache_name']
)

CACHE_MISSES = Counter(
    'payment_switch_cache_misses_total',
    'Total cache misses',
    ['cache_name']
)

# Kafka metrics
KAFKA_MESSAGES_PRODUCED = Counter(
    'payment_switch_kafka_messages_produced_total',
    'Total Kafka messages produced',
    ['topic']
)

KAFKA_MESSAGES_CONSUMED = Counter(
    'payment_switch_kafka_messages_consumed_total',
    'Total Kafka messages consumed',
    ['topic', 'consumer_group']
)

KAFKA_CONSUMER_LAG = Gauge(
    'payment_switch_kafka_consumer_lag',
    'Kafka consumer lag',
    ['topic', 'partition', 'consumer_group']
)

# Service info
SERVICE_INFO = Info(
    'payment_switch_service',
    'Service information'
)


def record_transaction(status: str, tx_type: str, currency: str, service: str,
                       duration: float, amount: float):
    """Record a transaction metric."""
    TRANSACTION_TOTAL.labels(status=status, type=tx_type, currency=currency, service=service).inc()
    TRANSACTION_DURATION.labels(status=status, type=tx_type, service=service).observe(duration)
    TRANSACTION_AMOUNT.labels(currency=currency, type=tx_type).observe(amount)


def record_api_request(method: str, endpoint: str, status: int, service: str, duration: float):
    """Record an API request metric."""
    API_REQUEST_TOTAL.labels(method=method, endpoint=endpoint, status=str(status), service=service).inc()
    API_REQUEST_DURATION.labels(method=method, endpoint=endpoint, service=service).observe(duration)


def record_fraud_score(score: float, decision: str, model: str = "default"):
    """Record a fraud score metric."""
    FRAUD_SCORE.labels(decision=decision).observe(score)
    FRAUD_DECISIONS.labels(decision=decision, model=model).inc()


def record_kyc_verification(status: str, verification_type: str, provider: str, duration: float):
    """Record a KYC verification metric."""
    KYC_VERIFICATIONS.labels(status=status, type=verification_type, provider=provider).inc()
    KYC_VERIFICATION_DURATION.labels(type=verification_type, provider=provider).observe(duration)


def record_external_service_call(service: str, operation: str, status: str, duration: float):
    """Record an external service call metric."""
    EXTERNAL_SERVICE_REQUESTS.labels(service=service, operation=operation, status=status).inc()
    EXTERNAL_SERVICE_LATENCY.labels(service=service, operation=operation).observe(duration)


def record_db_query(operation: str, table: str, duration: float):
    """Record a database query metric."""
    DB_QUERY_DURATION.labels(operation=operation, table=table).observe(duration)


def record_cache_access(cache_name: str, hit: bool):
    """Record a cache access metric."""
    if hit:
        CACHE_HITS.labels(cache_name=cache_name).inc()
    else:
        CACHE_MISSES.labels(cache_name=cache_name).inc()


def record_kafka_produce(topic: str):
    """Record a Kafka message production."""
    KAFKA_MESSAGES_PRODUCED.labels(topic=topic).inc()


def record_kafka_consume(topic: str, consumer_group: str):
    """Record a Kafka message consumption."""
    KAFKA_MESSAGES_CONSUMED.labels(topic=topic, consumer_group=consumer_group).inc()


def set_service_info(name: str, version: str, environment: str):
    """Set service information."""
    SERVICE_INFO.info({
        'name': name,
        'version': version,
        'environment': environment
    })


def track_in_flight(tx_type: str, service: str):
    """Context manager to track in-flight transactions."""
    class InFlightTracker:
        def __enter__(self):
            TRANSACTIONS_IN_FLIGHT.labels(type=tx_type, service=service).inc()
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            TRANSACTIONS_IN_FLIGHT.labels(type=tx_type, service=service).dec()
            return False
    
    return InFlightTracker()


def timed(metric_name: str = None, labels: dict = None):
    """Decorator to time function execution."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                if metric_name and labels:
                    # Custom metric recording would go here
                    pass
        return wrapper
    return decorator


def get_metrics():
    """Get metrics in Prometheus format."""
    return generate_latest(_get_registry())


def get_content_type():
    """Get the content type for Prometheus metrics."""
    return CONTENT_TYPE_LATEST


# FastAPI integration
def setup_metrics_endpoint(app):
    """Set up /metrics endpoint for FastAPI app."""
    from fastapi import Response
    
    @app.get("/metrics")
    async def metrics():
        return Response(
            content=get_metrics(),
            media_type=get_content_type()
        )


# Flask integration
def setup_flask_metrics(app):
    """Set up /metrics endpoint for Flask app."""
    from flask import Response as FlaskResponse
    
    @app.route('/metrics')
    def metrics():
        return FlaskResponse(
            get_metrics(),
            mimetype=get_content_type()
        )


# Middleware for automatic request tracking
class PrometheusMiddleware:
    """ASGI middleware for automatic request metrics."""
    
    def __init__(self, app, service_name: str):
        self.app = app
        self.service_name = service_name
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        status_code = 500
        
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.time() - start_time
            method = scope.get("method", "UNKNOWN")
            path = scope.get("path", "/")
            record_api_request(method, path, status_code, self.service_name, duration)
