"""
Observability and Reliability Service for EscrowProtect
TIER 3: Reliability and Observability

Provides:
- Structured logging with correlation IDs
- Metrics collection and alerting
- Health checks and circuit breakers
- Retry logic with exponential backoff
- Dead letter queues for failed operations
"""

import uuid
import time
import logging
import functools
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import json

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("escrow_platform")

class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class CircuitState(str, Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered

@dataclass
class Metric:
    """Single metric data point"""
    name: str
    type: MetricType
    value: float
    tags: Dict[str, str] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class Alert:
    """Alert triggered by metric threshold"""
    id: str
    name: str
    severity: AlertSeverity
    message: str
    metric_name: str
    metric_value: float
    threshold: float
    tags: Dict[str, str] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    acknowledged: bool = False
    resolved: bool = False

@dataclass
class DeadLetterItem:
    """Failed operation stored for retry"""
    id: str
    operation: str
    payload: Dict[str, Any]
    error: str
    retry_count: int = 0
    max_retries: int = 3
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_retry_at: Optional[str] = None
    next_retry_at: Optional[str] = None

class CorrelationContext:
    """Thread-local correlation context for request tracing"""
    _context: Dict[str, str] = {}
    
    @classmethod
    def set_correlation_id(cls, correlation_id: str = None):
        cls._context["correlation_id"] = correlation_id or str(uuid.uuid4())
    
    @classmethod
    def get_correlation_id(cls) -> str:
        return cls._context.get("correlation_id", str(uuid.uuid4()))
    
    @classmethod
    def set_escrow_id(cls, escrow_id: str):
        cls._context["escrow_id"] = escrow_id
    
    @classmethod
    def get_escrow_id(cls) -> Optional[str]:
        return cls._context.get("escrow_id")
    
    @classmethod
    def clear(cls):
        cls._context.clear()
    
    @classmethod
    def get_context(cls) -> Dict[str, str]:
        return cls._context.copy()

class StructuredLogger:
    """
    Structured logger with correlation ID support.
    
    All logs include:
    - correlation_id: Request trace ID
    - escrow_id: If applicable
    - timestamp: ISO format
    - Additional context
    """
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _format_message(self, message: str, **kwargs) -> str:
        context = CorrelationContext.get_context()
        log_data = {
            "message": message,
            "correlation_id": context.get("correlation_id", "unknown"),
            "timestamp": datetime.utcnow().isoformat(),
            **context,
            **kwargs
        }
        return json.dumps(log_data)
    
    def info(self, message: str, **kwargs):
        self.logger.info(self._format_message(message, **kwargs))
    
    def warning(self, message: str, **kwargs):
        self.logger.warning(self._format_message(message, **kwargs))
    
    def error(self, message: str, **kwargs):
        self.logger.error(self._format_message(message, **kwargs))
    
    def debug(self, message: str, **kwargs):
        self.logger.debug(self._format_message(message, **kwargs))

class MetricsCollector:
    """
    Collects and aggregates metrics.
    
    Metrics tracked:
    - escrow_created_total: Counter of escrows created
    - escrow_completed_total: Counter of completed escrows
    - escrow_disputed_total: Counter of disputes
    - payment_amount_ngn: Histogram of payment amounts
    - api_request_duration_seconds: Timer for API latency
    - webhook_delivery_failures: Counter of failed webhooks
    - fraud_alerts_total: Counter of fraud alerts
    """
    
    def __init__(self):
        self.metrics: List[Metric] = []
        self.counters: Dict[str, float] = {}
        self.gauges: Dict[str, float] = {}
        self.histograms: Dict[str, List[float]] = {}
        self.alert_thresholds: Dict[str, Dict[str, Any]] = {}
        self.alerts: List[Alert] = []
    
    def increment(self, name: str, value: float = 1.0, tags: Dict[str, str] = None):
        """Increment a counter metric"""
        key = f"{name}:{json.dumps(tags or {}, sort_keys=True)}"
        self.counters[key] = self.counters.get(key, 0) + value
        
        metric = Metric(
            name=name,
            type=MetricType.COUNTER,
            value=self.counters[key],
            tags=tags or {}
        )
        self.metrics.append(metric)
        self._check_thresholds(name, self.counters[key], tags)
    
    def gauge(self, name: str, value: float, tags: Dict[str, str] = None):
        """Set a gauge metric"""
        key = f"{name}:{json.dumps(tags or {}, sort_keys=True)}"
        self.gauges[key] = value
        
        metric = Metric(
            name=name,
            type=MetricType.GAUGE,
            value=value,
            tags=tags or {}
        )
        self.metrics.append(metric)
        self._check_thresholds(name, value, tags)
    
    def histogram(self, name: str, value: float, tags: Dict[str, str] = None):
        """Record a histogram value"""
        key = f"{name}:{json.dumps(tags or {}, sort_keys=True)}"
        if key not in self.histograms:
            self.histograms[key] = []
        self.histograms[key].append(value)
        
        metric = Metric(
            name=name,
            type=MetricType.HISTOGRAM,
            value=value,
            tags=tags or {}
        )
        self.metrics.append(metric)
    
    def timer(self, name: str):
        """Context manager for timing operations"""
        return TimerContext(self, name)
    
    def set_threshold(
        self,
        metric_name: str,
        threshold: float,
        severity: AlertSeverity,
        comparison: str = "gt"  # gt, lt, eq
    ):
        """Set alert threshold for a metric"""
        self.alert_thresholds[metric_name] = {
            "threshold": threshold,
            "severity": severity,
            "comparison": comparison
        }
    
    def _check_thresholds(self, name: str, value: float, tags: Dict[str, str] = None):
        """Check if metric exceeds threshold and create alert"""
        if name not in self.alert_thresholds:
            return
        
        config = self.alert_thresholds[name]
        threshold = config["threshold"]
        comparison = config["comparison"]
        
        triggered = False
        if comparison == "gt" and value > threshold:
            triggered = True
        elif comparison == "lt" and value < threshold:
            triggered = True
        elif comparison == "eq" and value == threshold:
            triggered = True
        
        if triggered:
            alert = Alert(
                id=str(uuid.uuid4()),
                name=f"{name}_threshold_exceeded",
                severity=config["severity"],
                message=f"Metric {name} value {value} exceeded threshold {threshold}",
                metric_name=name,
                metric_value=value,
                threshold=threshold,
                tags=tags or {}
            )
            self.alerts.append(alert)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of all metrics"""
        return {
            "counters": self.counters,
            "gauges": self.gauges,
            "histogram_counts": {k: len(v) for k, v in self.histograms.items()},
            "total_metrics": len(self.metrics),
            "active_alerts": len([a for a in self.alerts if not a.resolved])
        }
    
    def get_active_alerts(self) -> List[Alert]:
        """Get unresolved alerts"""
        return [a for a in self.alerts if not a.resolved]

class TimerContext:
    """Context manager for timing operations"""
    
    def __init__(self, collector: MetricsCollector, name: str):
        self.collector = collector
        self.name = name
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.collector.histogram(f"{self.name}_seconds", duration)

class CircuitBreaker:
    """
    Circuit breaker for external service calls.
    
    Prevents cascading failures by failing fast when
    a service is unhealthy.
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        half_open_requests: int = 3
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.half_open_successes = 0
    
    def can_execute(self) -> bool:
        """Check if request can be executed"""
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_successes = 0
                    return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            return True
        
        return False
    
    def record_success(self):
        """Record successful execution"""
        self.failure_count = 0
        self.success_count += 1
        
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_successes += 1
            if self.half_open_successes >= self.half_open_requests:
                self.state = CircuitState.CLOSED
    
    def record_failure(self):
        """Record failed execution"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
        
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
    
    def get_state(self) -> Dict[str, Any]:
        """Get circuit breaker state"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None
        }

class RetryHandler:
    """
    Retry handler with exponential backoff.
    """
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt"""
        delay = self.base_delay * (self.exponential_base ** attempt)
        return min(delay, self.max_delay)
    
    async def execute_with_retry(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute function with retry logic"""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self.calculate_delay(attempt)
                    await asyncio.sleep(delay)
        
        raise last_exception

class DeadLetterQueue:
    """
    Dead letter queue for failed operations.
    
    Stores failed operations for later retry or manual intervention.
    """
    
    def __init__(self):
        self.items: Dict[str, DeadLetterItem] = {}
    
    def add(
        self,
        operation: str,
        payload: Dict[str, Any],
        error: str,
        max_retries: int = 3
    ) -> DeadLetterItem:
        """Add failed operation to queue"""
        item_id = str(uuid.uuid4())
        
        # Calculate next retry time with exponential backoff
        next_retry = datetime.utcnow() + timedelta(minutes=5)
        
        item = DeadLetterItem(
            id=item_id,
            operation=operation,
            payload=payload,
            error=error,
            max_retries=max_retries,
            next_retry_at=next_retry.isoformat()
        )
        
        self.items[item_id] = item
        return item
    
    def get_ready_for_retry(self) -> List[DeadLetterItem]:
        """Get items ready for retry"""
        now = datetime.utcnow()
        ready = []
        
        for item in self.items.values():
            if item.retry_count >= item.max_retries:
                continue
            
            if item.next_retry_at:
                next_retry = datetime.fromisoformat(item.next_retry_at)
                if now >= next_retry:
                    ready.append(item)
        
        return ready
    
    def mark_retried(self, item_id: str, success: bool):
        """Mark item as retried"""
        item = self.items.get(item_id)
        if not item:
            return
        
        item.retry_count += 1
        item.last_retry_at = datetime.utcnow().isoformat()
        
        if success:
            del self.items[item_id]
        else:
            # Calculate next retry with exponential backoff
            delay_minutes = 5 * (2 ** item.retry_count)
            item.next_retry_at = (datetime.utcnow() + timedelta(minutes=delay_minutes)).isoformat()
    
    def get_failed_permanently(self) -> List[DeadLetterItem]:
        """Get items that have exceeded max retries"""
        return [
            item for item in self.items.values()
            if item.retry_count >= item.max_retries
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        return {
            "total_items": len(self.items),
            "ready_for_retry": len(self.get_ready_for_retry()),
            "failed_permanently": len(self.get_failed_permanently()),
            "by_operation": self._count_by_operation()
        }
    
    def _count_by_operation(self) -> Dict[str, int]:
        """Count items by operation type"""
        counts = {}
        for item in self.items.values():
            counts[item.operation] = counts.get(item.operation, 0) + 1
        return counts

class HealthChecker:
    """
    Health check service for monitoring system components.
    """
    
    def __init__(self):
        self.checks: Dict[str, Callable] = {}
        self.last_results: Dict[str, Dict[str, Any]] = {}
    
    def register_check(self, name: str, check_func: Callable):
        """Register a health check"""
        self.checks[name] = check_func
    
    async def run_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        results = {}
        overall_healthy = True
        
        for name, check_func in self.checks.items():
            try:
                if asyncio.iscoroutinefunction(check_func):
                    result = await check_func()
                else:
                    result = check_func()
                
                results[name] = {
                    "healthy": result.get("healthy", True),
                    "message": result.get("message", "OK"),
                    "latency_ms": result.get("latency_ms", 0)
                }
                
                if not results[name]["healthy"]:
                    overall_healthy = False
                    
            except Exception as e:
                results[name] = {
                    "healthy": False,
                    "message": str(e),
                    "latency_ms": 0
                }
                overall_healthy = False
        
        self.last_results = results
        
        return {
            "healthy": overall_healthy,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": results
        }
    
    def get_last_results(self) -> Dict[str, Any]:
        """Get last health check results"""
        return {
            "checks": self.last_results,
            "timestamp": datetime.utcnow().isoformat()
        }


# Global instances
structured_logger = StructuredLogger("escrow_platform")
metrics_collector = MetricsCollector()
dead_letter_queue = DeadLetterQueue()
health_checker = HealthChecker()
retry_handler = RetryHandler()

# Circuit breakers for external services
circuit_breakers = {
    "paystack": CircuitBreaker("paystack"),
    "flutterwave": CircuitBreaker("flutterwave"),
    "whatsapp": CircuitBreaker("whatsapp"),
    "sms_gateway": CircuitBreaker("sms_gateway"),
    "bank_verification": CircuitBreaker("bank_verification")
}

# Set default alert thresholds
metrics_collector.set_threshold("fraud_alerts_total", 10, AlertSeverity.WARNING)
metrics_collector.set_threshold("webhook_delivery_failures", 5, AlertSeverity.ERROR)
metrics_collector.set_threshold("api_error_rate", 0.05, AlertSeverity.CRITICAL)
