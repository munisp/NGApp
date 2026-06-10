"""
Compliance & Analytics Services for Domestic Payments
CBN Reporting, Transaction Monitoring, Volume Forecasting, Revenue Analytics
Uses: PostgreSQL, OpenSearch, Kafka, Lakehouse (Iceberg), Temporal
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import json
import math
import random


# ============================================================
# 5. CBN Regulatory Reporting Automation
# ============================================================

class ReportType(Enum):
    BOP_RETURN = "BALANCE_OF_PAYMENTS_RETURN"
    DAILY_SUMMARY = "DAILY_TRANSACTION_SUMMARY"
    STR_FILING = "SUSPICIOUS_TRANSACTION_REPORT"
    CTR_FILING = "CURRENCY_TRANSACTION_REPORT"
    MONTHLY_STATS = "MONTHLY_STATISTICS"
    QUARTERLY_COMPLIANCE = "QUARTERLY_COMPLIANCE"


class ReportStatus(Enum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    GENERATED = "GENERATED"
    SUBMITTED = "SUBMITTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


@dataclass
class RegulatoryReport:
    id: str
    report_type: ReportType
    period_start: datetime
    period_end: datetime
    status: ReportStatus
    generated_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    file_format: str = "XML"  # XML for CBN, JSON for NFIU
    file_size_bytes: int = 0
    record_count: int = 0
    total_amount: float = 0.0
    submitted_by: Optional[str] = None
    cbn_reference: Optional[str] = None
    notes: str = ""

    # Middleware integration
    kafka_topic: str = "nibss-regulatory-reporting"
    postgres_table: str = "regulatory_reports"
    opensearch_index: str = "nibss-regulatory-reports"
    lakehouse_table: str = "regulatory.reports"


class CBNReportingEngine:
    """Automated generation of CBN-mandated regulatory reports."""

    def __init__(self):
        self.reports: list[RegulatoryReport] = []
        # Temporal workflow for long-running report generation
        self.temporal_namespace = "nibss-regulatory"
        self.temporal_task_queue = "regulatory-reporting"
        # Lakehouse for source data
        self.lakehouse_catalog = "nibss_analytics"

    def generate_daily_summary(self, date: datetime) -> RegulatoryReport:
        """Generate CBN daily transaction summary."""
        report = RegulatoryReport(
            id=f"RPT-DAILY-{date.strftime('%Y%m%d')}",
            report_type=ReportType.DAILY_SUMMARY,
            period_start=date.replace(hour=0, minute=0, second=0),
            period_end=date.replace(hour=23, minute=59, second=59),
            status=ReportStatus.GENERATED,
            generated_at=datetime.now(),
            file_format="XML",
            record_count=random.randint(500000, 2000000),
            total_amount=random.uniform(50e9, 200e9),
            file_size_bytes=random.randint(5000000, 50000000),
        )
        self.reports.append(report)
        return report

    def generate_str_filing(self, transaction_id: str, reason: str) -> RegulatoryReport:
        """Generate NFIU Suspicious Transaction Report."""
        report = RegulatoryReport(
            id=f"STR-{transaction_id}",
            report_type=ReportType.STR_FILING,
            period_start=datetime.now(),
            period_end=datetime.now(),
            status=ReportStatus.GENERATED,
            generated_at=datetime.now(),
            file_format="JSON",
            record_count=1,
            notes=reason,
        )
        self.reports.append(report)
        return report

    def generate_ctr_filing(self, date: datetime) -> RegulatoryReport:
        """Generate Currency Transaction Report (transactions > ₦5M)."""
        report = RegulatoryReport(
            id=f"CTR-{date.strftime('%Y%m%d')}",
            report_type=ReportType.CTR_FILING,
            period_start=date.replace(hour=0, minute=0, second=0),
            period_end=date.replace(hour=23, minute=59, second=59),
            status=ReportStatus.GENERATED,
            generated_at=datetime.now(),
            file_format="XML",
            record_count=random.randint(1000, 5000),
            total_amount=random.uniform(10e9, 50e9),
        )
        self.reports.append(report)
        return report

    def generate_monthly_stats(self, year: int, month: int) -> RegulatoryReport:
        """Generate CBN monthly statistics report."""
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
        else:
            end = datetime(year, month + 1, 1) - timedelta(seconds=1)

        report = RegulatoryReport(
            id=f"MSTAT-{year}{month:02d}",
            report_type=ReportType.MONTHLY_STATS,
            period_start=start,
            period_end=end,
            status=ReportStatus.GENERATED,
            generated_at=datetime.now(),
            file_format="XML",
            record_count=random.randint(10000000, 50000000),
            total_amount=random.uniform(500e9, 5000e9),
        )
        self.reports.append(report)
        return report


# ============================================================
# 7. Transaction Monitoring Rules Engine
# ============================================================

class RuleSeverity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RuleAction(Enum):
    ALERT = "ALERT"
    FLAG = "FLAG"
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"
    STR_FILE = "STR_FILE"


@dataclass
class MonitoringRule:
    id: str
    name: str
    description: str
    category: str  # STRUCTURING, VELOCITY, GEOGRAPHIC, BEHAVIORAL, AMOUNT
    condition_type: str  # THRESHOLD, PATTERN, AGGREGATE, SEQUENCE
    parameters: dict = field(default_factory=dict)
    severity: RuleSeverity = RuleSeverity.MEDIUM
    action: RuleAction = RuleAction.ALERT
    is_active: bool = True
    hit_count: int = 0
    false_positive_rate: float = 0.0
    last_triggered: Optional[datetime] = None

    # Middleware
    kafka_alert_topic: str = "nibss-monitoring-alerts"
    fluvio_stream: str = "nibss-tx-monitoring"


@dataclass
class MonitoringAlert:
    id: str
    rule_id: str
    rule_name: str
    transaction_id: str
    severity: str
    action: str
    details: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    reviewed: bool = False
    reviewed_by: Optional[str] = None
    disposition: Optional[str] = None  # TRUE_POSITIVE, FALSE_POSITIVE, INCONCLUSIVE


class TransactionMonitoringEngine:
    """Configurable rules engine for transaction monitoring."""

    def __init__(self):
        self.rules = self._default_rules()
        self.alerts: list[MonitoringAlert] = []
        # Fluvio for real-time stream processing
        self.fluvio_consumer_group = "tx-monitoring-engine"
        # OpenSearch for alert indexing
        self.opensearch_alert_index = "nibss-monitoring-alerts"

    def _default_rules(self) -> list[MonitoringRule]:
        return [
            MonitoringRule(
                id="MON-001", name="Structuring Detection",
                description="Multiple transactions just below ₦10M threshold within 24h",
                category="STRUCTURING", condition_type="AGGREGATE",
                parameters={"threshold": 10_000_000_00, "window_hours": 24, "min_count": 3, "amount_band_pct": 5},
                severity=RuleSeverity.CRITICAL, action=RuleAction.BLOCK,
            ),
            MonitoringRule(
                id="MON-002", name="Rapid Velocity",
                description="More than 20 transactions from same BVN in 10 minutes",
                category="VELOCITY", condition_type="THRESHOLD",
                parameters={"max_count": 20, "window_minutes": 10},
                severity=RuleSeverity.HIGH, action=RuleAction.FLAG,
            ),
            MonitoringRule(
                id="MON-003", name="CTR Threshold",
                description="Single transaction exceeds ₦5M (Cash Transaction Report required)",
                category="AMOUNT", condition_type="THRESHOLD",
                parameters={"threshold": 5_000_000_00},
                severity=RuleSeverity.MEDIUM, action=RuleAction.STR_FILE,
            ),
            MonitoringRule(
                id="MON-004", name="New Account High Value",
                description="Account less than 30 days old transacting > ₦1M",
                category="BEHAVIORAL", condition_type="PATTERN",
                parameters={"account_age_days": 30, "amount_threshold": 1_000_000_00},
                severity=RuleSeverity.HIGH, action=RuleAction.FLAG,
            ),
            MonitoringRule(
                id="MON-005", name="Round Amount Pattern",
                description="3+ consecutive round-amount transfers (₦1M, ₦2M, etc.)",
                category="BEHAVIORAL", condition_type="SEQUENCE",
                parameters={"min_consecutive": 3, "round_threshold": 100_000_00},
                severity=RuleSeverity.MEDIUM, action=RuleAction.ALERT,
            ),
            MonitoringRule(
                id="MON-006", name="Cross-Border Velocity",
                description="More than 5 cross-border transfers in 1 hour from same sender",
                category="VELOCITY", condition_type="THRESHOLD",
                parameters={"max_count": 5, "window_minutes": 60, "type": "cross_border"},
                severity=RuleSeverity.HIGH, action=RuleAction.ESCALATE,
            ),
            MonitoringRule(
                id="MON-007", name="Dormant Account Activity",
                description="Account inactive for 6+ months suddenly receives > ₦5M",
                category="BEHAVIORAL", condition_type="PATTERN",
                parameters={"dormant_months": 6, "amount_threshold": 5_000_000_00},
                severity=RuleSeverity.HIGH, action=RuleAction.FLAG,
            ),
            MonitoringRule(
                id="MON-008", name="Fan-Out Pattern",
                description="Single sender distributes to 10+ unique recipients in 1 hour",
                category="BEHAVIORAL", condition_type="AGGREGATE",
                parameters={"min_recipients": 10, "window_minutes": 60},
                severity=RuleSeverity.HIGH, action=RuleAction.FLAG,
            ),
        ]

    def evaluate_transaction(self, tx: dict) -> list[MonitoringAlert]:
        """Evaluate a transaction against all active rules."""
        triggered = []
        amount = tx.get("amount", 0)

        for rule in self.rules:
            if not rule.is_active:
                continue

            hit = False
            if rule.category == "AMOUNT" and rule.condition_type == "THRESHOLD":
                hit = amount >= rule.parameters.get("threshold", 0)
            elif rule.category == "STRUCTURING":
                threshold = rule.parameters.get("threshold", 10_000_000_00)
                band = rule.parameters.get("amount_band_pct", 5) / 100
                hit = threshold * (1 - band) <= amount < threshold

            if hit:
                rule.hit_count += 1
                rule.last_triggered = datetime.now()
                alert = MonitoringAlert(
                    id=f"ALERT-{rule.id}-{len(self.alerts)+1}",
                    rule_id=rule.id,
                    rule_name=rule.name,
                    transaction_id=tx.get("id", ""),
                    severity=rule.severity.value,
                    action=rule.action.value,
                    details={"amount": amount, "rule_params": rule.parameters},
                )
                triggered.append(alert)
                self.alerts.append(alert)

        return triggered


# ============================================================
# 8. Audit Trail & Compliance Logs
# ============================================================

@dataclass
class AuditEntry:
    id: str
    timestamp: datetime
    actor: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: str
    details: dict = field(default_factory=dict)
    ip_address: str = ""
    device_id: str = ""
    session_id: str = ""
    outcome: str = "SUCCESS"  # SUCCESS, FAILURE, DENIED

    # 7-year retention in Lakehouse
    lakehouse_table: str = "compliance.audit_trail"
    opensearch_index: str = "nibss-audit-trail"


class AuditTrailService:
    """Immutable audit logging with 7-year retention."""

    def __init__(self):
        self.entries: list[AuditEntry] = []
        self.retention_years = 7
        # PostgreSQL for hot storage (90 days)
        self.postgres_table = "audit_trail"
        # Lakehouse for cold storage (7 years)
        self.lakehouse_catalog = "nibss_compliance"
        # Kafka for event streaming
        self.kafka_topic = "nibss-audit-events"

    def log(self, actor: str, role: str, action: str,
            resource_type: str, resource_id: str, **kwargs) -> AuditEntry:
        entry = AuditEntry(
            id=f"AUD-{len(self.entries)+1:08d}",
            timestamp=datetime.now(),
            actor=actor,
            actor_role=role,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=kwargs.get("details", {}),
            ip_address=kwargs.get("ip_address", ""),
            device_id=kwargs.get("device_id", ""),
            outcome=kwargs.get("outcome", "SUCCESS"),
        )
        self.entries.append(entry)
        return entry


# ============================================================
# 19. Corridor Analytics
# ============================================================

@dataclass
class CorridorMetrics:
    corridor: str  # e.g., "NIP-P2P", "NIP-P2B", "NEFT"
    period: str    # "daily", "weekly", "monthly"
    total_transactions: int = 0
    total_volume: float = 0.0
    avg_transaction_value: float = 0.0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    peak_hour: int = 0
    peak_hour_tps: float = 0.0
    growth_rate_pct: float = 0.0  # vs previous period
    failure_rate_pct: float = 0.0
    top_error_code: str = ""


class CorridorAnalyticsEngine:
    """Analytics for domestic payment corridors."""

    def __init__(self):
        # Source data from Lakehouse Iceberg tables
        self.lakehouse_catalog = "nibss_analytics"
        self.lakehouse_database = "domestic_payments"
        # OpenSearch for search queries
        self.opensearch_index = "nibss-corridor-analytics"
        # Redis for caching computed metrics
        self.redis_cache_prefix = "nibss:corridor:metrics"
        self.redis_cache_ttl = 300  # 5 minutes

    def compute_corridor_metrics(self, corridor: str, period: str) -> CorridorMetrics:
        """Compute metrics for a specific corridor and period."""
        # In production: query Lakehouse Iceberg tables
        base_txns = {"NIP-P2P": 2500000, "NIP-P2B": 1800000, "NEFT": 150000,
                      "NACS": 25000, "NDD": 45000, "NQR": 350000, "USSD": 900000}
        base = base_txns.get(corridor, 100000)

        return CorridorMetrics(
            corridor=corridor,
            period=period,
            total_transactions=base + random.randint(-base // 10, base // 10),
            total_volume=base * random.uniform(15000, 85000),
            avg_transaction_value=random.uniform(15000, 85000),
            success_rate=random.uniform(98.5, 99.9),
            avg_latency_ms=random.uniform(100, 3000),
            peak_hour=random.randint(9, 17),
            peak_hour_tps=random.uniform(500, 5000),
            growth_rate_pct=random.uniform(-5, 25),
            failure_rate_pct=random.uniform(0.1, 1.5),
            top_error_code="51" if corridor == "NIP-P2P" else "96",
        )


# ============================================================
# 20. Predictive Volume Forecasting
# ============================================================

@dataclass
class VolumeForecast:
    product: str
    forecast_date: datetime
    predicted_transactions: int
    predicted_volume: float
    confidence_interval_low: int
    confidence_interval_high: int
    confidence_pct: float
    model_version: str
    features_used: list = field(default_factory=list)
    predicted_peak_hour: int = 0
    predicted_peak_tps: float = 0.0
    recommended_prefund: float = 0.0


class VolumeForecaster:
    """ML-based volume prediction for prefund optimization."""

    def __init__(self):
        self.model_version = "prophet-ng-v1.3"
        # Lakehouse for historical data
        self.lakehouse_source = "domestic_payments.transaction_history"
        # Redis for caching predictions
        self.redis_cache_prefix = "nibss:forecast"
        self.redis_cache_ttl = 3600

    def forecast(self, product: str, target_date: datetime) -> VolumeForecast:
        """Generate volume forecast for a specific product and date."""
        day_of_week = target_date.weekday()
        is_month_end = target_date.day >= 25
        is_salary_day = target_date.day in [25, 26, 27, 28, 29, 30]

        base_volumes = {
            "NIP": 3_500_000, "NEFT": 180_000, "NACS": 30_000,
            "NDD": 50_000, "NQR": 400_000, "USSD": 1_200_000,
        }
        base = base_volumes.get(product, 100_000)

        # Day-of-week adjustment
        dow_multiplier = [0.85, 1.0, 1.05, 1.1, 1.15, 0.7, 0.5][day_of_week]
        # Month-end salary spike
        salary_multiplier = 1.6 if is_salary_day else 1.0
        # Seasonal adjustment
        seasonal = 1.0 + 0.1 * math.sin(2 * math.pi * target_date.timetuple().tm_yday / 365)

        predicted = int(base * dow_multiplier * salary_multiplier * seasonal)
        margin = int(predicted * 0.1)

        avg_value = {"NIP": 45000, "NEFT": 250000, "NACS": 850000,
                     "NDD": 35000, "NQR": 5500, "USSD": 8000}.get(product, 50000)

        return VolumeForecast(
            product=product,
            forecast_date=target_date,
            predicted_transactions=predicted,
            predicted_volume=predicted * avg_value,
            confidence_interval_low=predicted - margin,
            confidence_interval_high=predicted + margin,
            confidence_pct=92.5,
            model_version=self.model_version,
            features_used=["day_of_week", "month_end", "salary_day", "seasonal", "trend"],
            predicted_peak_hour=13 if is_salary_day else 11,
            predicted_peak_tps=predicted / 86400 * 3.5,  # Peak is ~3.5x average
            recommended_prefund=predicted * avg_value * 1.2,  # 20% buffer
        )


# ============================================================
# 18. Revenue Analytics Dashboard
# ============================================================

@dataclass
class RevenueBreakdown:
    product: str
    period: str
    total_fee_revenue: float
    transaction_count: int
    avg_fee_per_tx: float
    fee_revenue_growth_pct: float
    top_contributing_bank: str
    top_contributing_bank_pct: float


class RevenueAnalyticsEngine:
    """Fee revenue analytics across all domestic payment products."""

    def __init__(self):
        self.lakehouse_source = "domestic_payments.fee_ledger"
        self.opensearch_index = "nibss-revenue-analytics"
        self.redis_cache_prefix = "nibss:revenue"
        # TigerBeetle as source of truth for fee accounts
        self.tigerbeetle_fee_accounts = {
            "NIP": 0xFEE0_0001,
            "NEFT": 0xFEE0_0002,
            "NACS": 0xFEE0_0003,
            "NDD": 0xFEE0_0004,
            "BVN": 0xFEE0_0005,
            "NQR": 0xFEE0_0006,
        }

    def get_revenue_breakdown(self, period: str = "monthly") -> list[RevenueBreakdown]:
        """Get fee revenue breakdown by product."""
        products = {
            "NIP": (3_500_000, 25.0), "NEFT": (180_000, 15.0),
            "NACS": (30_000, 50.0), "NDD": (50_000, 20.0),
            "BVN": (500_000, 50.0), "NQR": (400_000, 12.0),
            "PayDirect": (200_000, 35.0), "e-BillsPay": (350_000, 30.0),
        }
        banks = ["Access Bank", "GTBank", "Zenith Bank", "First Bank", "UBA"]
        result = []
        for product, (count, avg_fee) in products.items():
            result.append(RevenueBreakdown(
                product=product,
                period=period,
                total_fee_revenue=count * avg_fee,
                transaction_count=count,
                avg_fee_per_tx=avg_fee,
                fee_revenue_growth_pct=random.uniform(-5, 30),
                top_contributing_bank=random.choice(banks),
                top_contributing_bank_pct=random.uniform(15, 35),
            ))
        return result


# ============================================================
# Tests
# ============================================================

def test_cbn_reporting():
    engine = CBNReportingEngine()
    report = engine.generate_daily_summary(datetime(2026, 5, 1))
    assert report.status == ReportStatus.GENERATED
    assert report.record_count > 0
    print(f"Daily summary: {report.record_count:,} records, ₦{report.total_amount/1e9:.1f}B")

def test_monitoring_rules():
    engine = TransactionMonitoringEngine()
    alerts = engine.evaluate_transaction({
        "id": "TX-001", "amount": 15_000_000_00, "bvn": "12345678901"
    })
    # Should trigger CTR threshold rule
    assert any(a.rule_id == "MON-003" for a in alerts)

def test_volume_forecast():
    forecaster = VolumeForecaster()
    forecast = forecaster.forecast("NIP", datetime(2026, 5, 25))  # Salary day
    assert forecast.predicted_transactions > 3_000_000  # Higher due to salary day

def test_corridor_analytics():
    engine = CorridorAnalyticsEngine()
    metrics = engine.compute_corridor_metrics("NIP-P2P", "daily")
    assert metrics.success_rate > 95.0

if __name__ == "__main__":
    test_cbn_reporting()
    test_monitoring_rules()
    test_volume_forecast()
    test_corridor_analytics()
    print("All compliance analytics tests passed!")
