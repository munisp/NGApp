"""
SLO-Based Alerting and Anomaly Detection System
"""

import logging
import uuid
import math
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import statistics
from temporalio import activity

logger = logging.getLogger(__name__)


class SLOType(str, Enum):
    AVAILABILITY = "availability"
    LATENCY = "latency"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    SUCCESS_RATE = "success_rate"
    CUSTOM = "custom"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    FIRING = "firing"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"
    SILENCED = "silenced"


@dataclass
class SLODefinition:
    id: str
    name: str
    description: str
    slo_type: SLOType
    target: float
    window_minutes: int
    service: str
    metric_name: str
    threshold_warning: float
    threshold_critical: float
    enabled: bool = True
    labels: Dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ErrorBudget:
    slo_id: str
    total_budget: float
    consumed: float
    remaining: float
    burn_rate: float
    projected_exhaustion: Optional[datetime]
    window_start: datetime
    window_end: datetime


@dataclass
class Alert:
    id: str
    slo_id: str
    slo_name: str
    severity: AlertSeverity
    status: AlertStatus
    title: str
    description: str
    current_value: float
    threshold: float
    fired_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    labels: Dict[str, str] = field(default_factory=dict)
    annotations: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricDataPoint:
    timestamp: datetime
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class AnomalyDetectionResult:
    is_anomaly: bool
    score: float
    expected_value: float
    actual_value: float
    deviation: float
    confidence: float
    method: str
    timestamp: datetime


class MetricsStore:
    def __init__(self, max_points: int = 10000):
        self.metrics: Dict[str, deque] = {}
        self.max_points = max_points

    def record(self, metric_name: str, value: float, labels: Optional[Dict[str, str]] = None):
        if metric_name not in self.metrics:
            self.metrics[metric_name] = deque(maxlen=self.max_points)
        
        self.metrics[metric_name].append(MetricDataPoint(
            timestamp=datetime.now(),
            value=value,
            labels=labels or {}
        ))

    def query(
        self,
        metric_name: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None
    ) -> List[MetricDataPoint]:
        if metric_name not in self.metrics:
            return []

        points = list(self.metrics[metric_name])

        if start_time:
            points = [p for p in points if p.timestamp >= start_time]
        if end_time:
            points = [p for p in points if p.timestamp <= end_time]
        if labels:
            points = [p for p in points if all(p.labels.get(k) == v for k, v in labels.items())]

        return points

    def get_aggregated(
        self,
        metric_name: str,
        aggregation: str,
        window_minutes: int,
        labels: Optional[Dict[str, str]] = None
    ) -> Optional[float]:
        start_time = datetime.now() - timedelta(minutes=window_minutes)
        points = self.query(metric_name, start_time=start_time, labels=labels)

        if not points:
            return None

        values = [p.value for p in points]

        if aggregation == "avg":
            return statistics.mean(values)
        elif aggregation == "sum":
            return sum(values)
        elif aggregation == "min":
            return min(values)
        elif aggregation == "max":
            return max(values)
        elif aggregation == "count":
            return len(values)
        elif aggregation == "p50":
            return statistics.median(values)
        elif aggregation == "p95":
            return self._percentile(values, 95)
        elif aggregation == "p99":
            return self._percentile(values, 99)
        elif aggregation == "stddev":
            return statistics.stdev(values) if len(values) > 1 else 0

        return None

    def _percentile(self, values: List[float], percentile: int) -> float:
        sorted_values = sorted(values)
        index = (percentile / 100) * (len(sorted_values) - 1)
        lower = int(index)
        upper = lower + 1
        if upper >= len(sorted_values):
            return sorted_values[-1]
        weight = index - lower
        return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


class AnomalyDetector:
    def __init__(self, metrics_store: MetricsStore):
        self.metrics_store = metrics_store
        self.baseline_window_hours = 24
        self.sensitivity = 2.0

    def detect(
        self,
        metric_name: str,
        current_value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> AnomalyDetectionResult:
        baseline_start = datetime.now() - timedelta(hours=self.baseline_window_hours)
        historical_points = self.metrics_store.query(
            metric_name,
            start_time=baseline_start,
            labels=labels
        )

        if len(historical_points) < 10:
            return AnomalyDetectionResult(
                is_anomaly=False,
                score=0,
                expected_value=current_value,
                actual_value=current_value,
                deviation=0,
                confidence=0,
                method="insufficient_data",
                timestamp=datetime.now()
            )

        values = [p.value for p in historical_points]
        mean = statistics.mean(values)
        stddev = statistics.stdev(values) if len(values) > 1 else 0

        if stddev == 0:
            z_score = 0
        else:
            z_score = abs(current_value - mean) / stddev

        is_anomaly = z_score > self.sensitivity
        confidence = min(1.0, z_score / (self.sensitivity * 2))

        return AnomalyDetectionResult(
            is_anomaly=is_anomaly,
            score=z_score,
            expected_value=mean,
            actual_value=current_value,
            deviation=current_value - mean,
            confidence=confidence,
            method="z_score",
            timestamp=datetime.now()
        )

    def detect_trend_anomaly(
        self,
        metric_name: str,
        window_minutes: int = 60,
        labels: Optional[Dict[str, str]] = None
    ) -> AnomalyDetectionResult:
        start_time = datetime.now() - timedelta(minutes=window_minutes)
        points = self.metrics_store.query(metric_name, start_time=start_time, labels=labels)

        if len(points) < 5:
            return AnomalyDetectionResult(
                is_anomaly=False,
                score=0,
                expected_value=0,
                actual_value=0,
                deviation=0,
                confidence=0,
                method="insufficient_data",
                timestamp=datetime.now()
            )

        values = [p.value for p in points]
        n = len(values)
        x_mean = (n - 1) / 2
        y_mean = statistics.mean(values)

        numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            slope = 0
        else:
            slope = numerator / denominator

        expected_change = slope * n
        actual_change = values[-1] - values[0] if values else 0

        stddev = statistics.stdev(values) if len(values) > 1 else 1
        normalized_slope = abs(slope * n) / stddev if stddev > 0 else 0

        is_anomaly = normalized_slope > self.sensitivity

        return AnomalyDetectionResult(
            is_anomaly=is_anomaly,
            score=normalized_slope,
            expected_value=expected_change,
            actual_value=actual_change,
            deviation=actual_change - expected_change,
            confidence=min(1.0, normalized_slope / (self.sensitivity * 2)),
            method="trend_analysis",
            timestamp=datetime.now()
        )


class SLOAlertingSystem:
    def __init__(self):
        self.slos: Dict[str, SLODefinition] = {}
        self.alerts: Dict[str, Alert] = {}
        self.metrics_store = MetricsStore()
        self.anomaly_detector = AnomalyDetector(self.metrics_store)
        self.alert_handlers: List[Callable[[Alert], None]] = []
        self._initialize_default_slos()

    def _initialize_default_slos(self):
        default_slos = [
            {
                "name": "Payment Success Rate",
                "description": "Percentage of successful payment transactions",
                "slo_type": SLOType.SUCCESS_RATE,
                "target": 99.5,
                "window_minutes": 60,
                "service": "payment-gateway",
                "metric_name": "payment_success_rate",
                "threshold_warning": 99.0,
                "threshold_critical": 98.0,
            },
            {
                "name": "Payment Latency P95",
                "description": "95th percentile payment processing latency",
                "slo_type": SLOType.LATENCY,
                "target": 500,
                "window_minutes": 15,
                "service": "payment-gateway",
                "metric_name": "payment_latency_p95",
                "threshold_warning": 750,
                "threshold_critical": 1000,
            },
            {
                "name": "Payout Completion Time",
                "description": "Time to complete payout transactions",
                "slo_type": SLOType.LATENCY,
                "target": 30000,
                "window_minutes": 60,
                "service": "payout-service",
                "metric_name": "payout_completion_time",
                "threshold_warning": 45000,
                "threshold_critical": 60000,
            },
            {
                "name": "Settlement Lag",
                "description": "Delay in settlement processing",
                "slo_type": SLOType.LATENCY,
                "target": 3600000,
                "window_minutes": 1440,
                "service": "settlement-service",
                "metric_name": "settlement_lag",
                "threshold_warning": 5400000,
                "threshold_critical": 7200000,
            },
            {
                "name": "Webhook Delivery Rate",
                "description": "Percentage of webhooks delivered successfully",
                "slo_type": SLOType.SUCCESS_RATE,
                "target": 99.9,
                "window_minutes": 60,
                "service": "webhook-service",
                "metric_name": "webhook_delivery_rate",
                "threshold_warning": 99.5,
                "threshold_critical": 99.0,
            },
            {
                "name": "API Availability",
                "description": "API uptime percentage",
                "slo_type": SLOType.AVAILABILITY,
                "target": 99.99,
                "window_minutes": 1440,
                "service": "api-gateway",
                "metric_name": "api_availability",
                "threshold_warning": 99.95,
                "threshold_critical": 99.9,
            },
            {
                "name": "Fraud Detection Latency",
                "description": "Time to complete fraud check",
                "slo_type": SLOType.LATENCY,
                "target": 100,
                "window_minutes": 15,
                "service": "fraud-service",
                "metric_name": "fraud_check_latency",
                "threshold_warning": 150,
                "threshold_critical": 200,
            },
            {
                "name": "Bank Success Rate",
                "description": "Success rate of bank API calls",
                "slo_type": SLOType.SUCCESS_RATE,
                "target": 98.0,
                "window_minutes": 60,
                "service": "bank-adapter",
                "metric_name": "bank_success_rate",
                "threshold_warning": 95.0,
                "threshold_critical": 90.0,
            },
        ]

        for slo_data in default_slos:
            self.add_slo(
                name=slo_data["name"],
                description=slo_data["description"],
                slo_type=slo_data["slo_type"],
                target=slo_data["target"],
                window_minutes=slo_data["window_minutes"],
                service=slo_data["service"],
                metric_name=slo_data["metric_name"],
                threshold_warning=slo_data["threshold_warning"],
                threshold_critical=slo_data["threshold_critical"]
            )

    def add_slo(
        self,
        name: str,
        description: str,
        slo_type: SLOType,
        target: float,
        window_minutes: int,
        service: str,
        metric_name: str,
        threshold_warning: float,
        threshold_critical: float,
        labels: Optional[Dict[str, str]] = None
    ) -> SLODefinition:
        slo = SLODefinition(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            slo_type=slo_type,
            target=target,
            window_minutes=window_minutes,
            service=service,
            metric_name=metric_name,
            threshold_warning=threshold_warning,
            threshold_critical=threshold_critical,
            labels=labels or {}
        )
        self.slos[slo.id] = slo
        return slo

    def record_metric(self, metric_name: str, value: float, labels: Optional[Dict[str, str]] = None):
        self.metrics_store.record(metric_name, value, labels)

    def evaluate_slo(self, slo_id: str) -> Optional[Dict[str, Any]]:
        slo = self.slos.get(slo_id)
        if not slo or not slo.enabled:
            return None

        aggregation = "avg"
        if slo.slo_type == SLOType.LATENCY:
            aggregation = "p95"
        elif slo.slo_type == SLOType.THROUGHPUT:
            aggregation = "sum"

        current_value = self.metrics_store.get_aggregated(
            slo.metric_name,
            aggregation,
            slo.window_minutes,
            slo.labels
        )

        if current_value is None:
            return None

        is_meeting_slo = self._check_slo_met(slo, current_value)
        severity = self._determine_severity(slo, current_value)

        if severity in [AlertSeverity.WARNING, AlertSeverity.ERROR, AlertSeverity.CRITICAL]:
            self._create_or_update_alert(slo, current_value, severity)
        else:
            self._resolve_alert(slo.id)

        error_budget = self._calculate_error_budget(slo, current_value)

        return {
            "slo_id": slo.id,
            "slo_name": slo.name,
            "current_value": current_value,
            "target": slo.target,
            "is_meeting_slo": is_meeting_slo,
            "severity": severity.value,
            "error_budget": {
                "total": error_budget.total_budget,
                "consumed": error_budget.consumed,
                "remaining": error_budget.remaining,
                "burn_rate": error_budget.burn_rate
            }
        }

    def _check_slo_met(self, slo: SLODefinition, current_value: float) -> bool:
        if slo.slo_type in [SLOType.SUCCESS_RATE, SLOType.AVAILABILITY]:
            return current_value >= slo.target
        elif slo.slo_type == SLOType.LATENCY:
            return current_value <= slo.target
        elif slo.slo_type == SLOType.ERROR_RATE:
            return current_value <= slo.target
        elif slo.slo_type == SLOType.THROUGHPUT:
            return current_value >= slo.target
        return True

    def _determine_severity(self, slo: SLODefinition, current_value: float) -> AlertSeverity:
        if slo.slo_type in [SLOType.SUCCESS_RATE, SLOType.AVAILABILITY]:
            if current_value < slo.threshold_critical:
                return AlertSeverity.CRITICAL
            elif current_value < slo.threshold_warning:
                return AlertSeverity.WARNING
        elif slo.slo_type == SLOType.LATENCY:
            if current_value > slo.threshold_critical:
                return AlertSeverity.CRITICAL
            elif current_value > slo.threshold_warning:
                return AlertSeverity.WARNING
        elif slo.slo_type == SLOType.ERROR_RATE:
            if current_value > slo.threshold_critical:
                return AlertSeverity.CRITICAL
            elif current_value > slo.threshold_warning:
                return AlertSeverity.WARNING

        return AlertSeverity.INFO

    def _calculate_error_budget(self, slo: SLODefinition, current_value: float) -> ErrorBudget:
        window_start = datetime.now() - timedelta(minutes=slo.window_minutes)
        window_end = datetime.now()

        if slo.slo_type in [SLOType.SUCCESS_RATE, SLOType.AVAILABILITY]:
            total_budget = 100 - slo.target
            consumed = max(0, slo.target - current_value)
        elif slo.slo_type == SLOType.LATENCY:
            total_budget = slo.threshold_critical - slo.target
            consumed = max(0, current_value - slo.target)
        else:
            total_budget = slo.target
            consumed = max(0, slo.target - current_value)

        remaining = max(0, total_budget - consumed)
        burn_rate = consumed / total_budget if total_budget > 0 else 0

        projected_exhaustion = None
        if burn_rate > 0 and remaining > 0:
            minutes_to_exhaustion = (remaining / burn_rate) * slo.window_minutes
            projected_exhaustion = datetime.now() + timedelta(minutes=minutes_to_exhaustion)

        return ErrorBudget(
            slo_id=slo.id,
            total_budget=total_budget,
            consumed=consumed,
            remaining=remaining,
            burn_rate=burn_rate,
            projected_exhaustion=projected_exhaustion,
            window_start=window_start,
            window_end=window_end
        )

    def _create_or_update_alert(self, slo: SLODefinition, current_value: float, severity: AlertSeverity):
        existing_alert = None
        for alert in self.alerts.values():
            if alert.slo_id == slo.id and alert.status == AlertStatus.FIRING:
                existing_alert = alert
                break

        if existing_alert:
            existing_alert.severity = severity
            existing_alert.current_value = current_value
        else:
            alert = Alert(
                id=str(uuid.uuid4()),
                slo_id=slo.id,
                slo_name=slo.name,
                severity=severity,
                status=AlertStatus.FIRING,
                title=f"SLO Violation: {slo.name}",
                description=f"{slo.name} is below target. Current: {current_value}, Target: {slo.target}",
                current_value=current_value,
                threshold=slo.target,
                fired_at=datetime.now(),
                labels=slo.labels
            )
            self.alerts[alert.id] = alert

            for handler in self.alert_handlers:
                try:
                    handler(alert)
                except Exception as e:
                    logger.error(f"Alert handler failed: {e}")

    def _resolve_alert(self, slo_id: str):
        for alert in self.alerts.values():
            if alert.slo_id == slo_id and alert.status == AlertStatus.FIRING:
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.now()

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        alert = self.alerts.get(alert_id)
        if alert and alert.status == AlertStatus.FIRING:
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_at = datetime.now()
            alert.acknowledged_by = acknowledged_by
            return True
        return False

    def get_active_alerts(self) -> List[Alert]:
        return [a for a in self.alerts.values() if a.status in [AlertStatus.FIRING, AlertStatus.ACKNOWLEDGED]]

    def detect_anomaly(self, metric_name: str, current_value: float) -> AnomalyDetectionResult:
        return self.anomaly_detector.detect(metric_name, current_value)

    def get_dashboard_data(self) -> Dict[str, Any]:
        slo_statuses = []
        for slo in self.slos.values():
            if slo.enabled:
                result = self.evaluate_slo(slo.id)
                if result:
                    slo_statuses.append(result)

        active_alerts = self.get_active_alerts()

        return {
            "slo_statuses": slo_statuses,
            "active_alerts": [
                {
                    "id": a.id,
                    "slo_name": a.slo_name,
                    "severity": a.severity.value,
                    "status": a.status.value,
                    "title": a.title,
                    "fired_at": a.fired_at.isoformat()
                }
                for a in active_alerts
            ],
            "summary": {
                "total_slos": len(self.slos),
                "slos_meeting_target": sum(1 for s in slo_statuses if s.get("is_meeting_slo", False)),
                "active_alerts_count": len(active_alerts),
                "critical_alerts": sum(1 for a in active_alerts if a.severity == AlertSeverity.CRITICAL)
            }
        }


class SLOAlertingActivities:
    def __init__(self):
        self.system = SLOAlertingSystem()

    @activity.defn(name="RecordMetric")
    async def record_metric(self, data: Dict[str, Any]) -> Dict[str, Any]:
        metric_name = data.get("metric_name")
        value = data.get("value")
        labels = data.get("labels")

        self.system.record_metric(metric_name, value, labels)

        return {"recorded": True, "metric_name": metric_name, "value": value}

    @activity.defn(name="EvaluateSLO")
    async def evaluate_slo(self, slo_id: str) -> Dict[str, Any]:
        result = self.system.evaluate_slo(slo_id)
        return result or {"error": "SLO not found or disabled"}

    @activity.defn(name="GetDashboardData")
    async def get_dashboard_data(self) -> Dict[str, Any]:
        return self.system.get_dashboard_data()

    @activity.defn(name="DetectAnomaly")
    async def detect_anomaly(self, data: Dict[str, Any]) -> Dict[str, Any]:
        metric_name = data.get("metric_name")
        current_value = data.get("value")

        result = self.system.detect_anomaly(metric_name, current_value)

        return {
            "is_anomaly": result.is_anomaly,
            "score": result.score,
            "expected_value": result.expected_value,
            "actual_value": result.actual_value,
            "deviation": result.deviation,
            "confidence": result.confidence,
            "method": result.method
        }

    @activity.defn(name="AcknowledgeAlert")
    async def acknowledge_alert(self, data: Dict[str, Any]) -> Dict[str, Any]:
        alert_id = data.get("alert_id")
        acknowledged_by = data.get("acknowledged_by")

        success = self.system.acknowledge_alert(alert_id, acknowledged_by)

        return {"success": success, "alert_id": alert_id}

    @activity.defn(name="GetActiveAlerts")
    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        alerts = self.system.get_active_alerts()
        return [
            {
                "id": a.id,
                "slo_id": a.slo_id,
                "slo_name": a.slo_name,
                "severity": a.severity.value,
                "status": a.status.value,
                "title": a.title,
                "description": a.description,
                "current_value": a.current_value,
                "threshold": a.threshold,
                "fired_at": a.fired_at.isoformat()
            }
            for a in alerts
        ]
