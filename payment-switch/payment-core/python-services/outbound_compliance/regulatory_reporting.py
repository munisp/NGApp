"""
Regulatory Reporting Service for Outbound Remittance.

Generates CBN-mandated reports:
- Daily Transaction Summary (all outbound flows)
- Monthly Volume Report (corridor-level)
- Sanctions Activity Report (blocks, escalations, false positives)
- FX Utilization Report (spread usage vs caps)
- Participant Activity Report (per-fintech usage)

Reports are generated as structured JSON and can be rendered to
PDF/Excel for CBN submission.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import json


@dataclass
class CorridorMetrics:
    """Metrics for a single corridor."""
    corridor_id: str
    corridor_name: str
    category: str
    transfer_count: int = 0
    volume_ngn: int = 0
    volume_dest: int = 0
    avg_amount_ngn: int = 0
    success_rate: float = 0.0
    avg_latency_ms: int = 0
    sanctions_blocks: int = 0
    sanctions_escalations: int = 0
    fx_spread_utilized_bps: int = 0
    fx_spread_cap_bps: int = 0


@dataclass
class ParticipantMetrics:
    """Metrics for a single participant (fintech/IMTO)."""
    participant_id: str
    participant_name: str
    tier: str
    transfer_count: int = 0
    volume_ngn: int = 0
    prefund_balance_ngn: int = 0
    fees_paid_ngn: int = 0
    corridors_used: list[str] = field(default_factory=list)
    compliance_flags: int = 0


@dataclass
class RegulatoryReport:
    """A single regulatory report."""
    report_id: str
    report_type: str
    title: str
    period_start: datetime
    period_end: datetime
    generated_at: datetime
    summary: dict
    corridor_metrics: list[CorridorMetrics]
    participant_metrics: list[ParticipantMetrics]
    compliance_summary: dict
    fx_summary: dict
    metadata: dict = field(default_factory=dict)


class RegulatoryReportingService:
    """
    Generates regulatory reports for CBN submission.
    
    In production:
    - Reads from OpenSearch/Lakehouse for historical data
    - Reads from PostgreSQL for participant/corridor config
    - Reads from TigerBeetle for financial truth (balances, postings)
    - Publishes reports to S3/MinIO for archival
    - Sends notification via Kafka when reports are ready
    """

    # 13 Nigerian corridors per architecture doc
    CORRIDORS = [
        ("NG-GH", "Nigeria → Ghana", "West Africa Labor", 150),
        ("NG-SN", "Nigeria → Senegal", "West Africa Labor", 200),
        ("NG-CI", "Nigeria → Côte d'Ivoire", "West Africa Labor", 200),
        ("NG-CM", "Nigeria → Cameroon", "West Africa Labor", 200),
        ("NG-GB", "Nigeria → United Kingdom", "Education", 100),
        ("NG-US", "Nigeria → United States", "Education", 100),
        ("NG-CA", "Nigeria → Canada", "Education", 120),
        ("NG-IN", "Nigeria → India", "Medical", 150),
        ("NG-TR", "Nigeria → Turkey", "Medical", 175),
        ("NG-CN", "Nigeria → China", "Premium Business", 80),
        ("NG-AE", "Nigeria → UAE", "Premium Business", 90),
        ("NG-KE", "Nigeria → Kenya", "General Personal", 150),
        ("NG-ZA", "Nigeria → South Africa", "General Personal", 130),
    ]

    def __init__(self):
        self._reports: list[RegulatoryReport] = []

    def generate_daily_summary(
        self,
        date: datetime,
        transfers: list[dict],
        participants: list[dict],
    ) -> RegulatoryReport:
        """
        Generate daily transaction summary for CBN.
        
        Required fields in transfers:
        - id, corridor, amount_ngn, status, participant_id, timestamp, latency_ms
        
        Required fields in participants:
        - id, name, tier, prefund_balance
        """
        corridor_metrics = self._compute_corridor_metrics(transfers)
        participant_metrics = self._compute_participant_metrics(transfers, participants)
        compliance_summary = self._compute_compliance_summary(transfers)
        fx_summary = self._compute_fx_summary(transfers)

        total_volume = sum(t.get("amount_ngn", 0) for t in transfers)
        total_fees = sum(t.get("total_fee_ngn", 0) for t in transfers)
        success_count = sum(1 for t in transfers if t.get("status") == "completed")

        report = RegulatoryReport(
            report_id=f"CBN-DAILY-{date.strftime('%Y%m%d')}",
            report_type="daily_summary",
            title=f"Daily Outbound Remittance Summary — {date.strftime('%d %B %Y')}",
            period_start=date.replace(hour=0, minute=0, second=0),
            period_end=date.replace(hour=23, minute=59, second=59),
            generated_at=datetime.now(timezone.utc),
            summary={
                "total_transfers": len(transfers),
                "total_volume_ngn": total_volume,
                "total_fees_ngn": total_fees,
                "success_count": success_count,
                "success_rate": round(success_count / max(len(transfers), 1) * 100, 2),
                "active_corridors": len(set(t.get("corridor") for t in transfers)),
                "active_participants": len(set(t.get("participant_id") for t in transfers)),
                "cbn_levy_collected_ngn": int(total_fees * 0.005),  # 50 bps levy
            },
            corridor_metrics=corridor_metrics,
            participant_metrics=participant_metrics,
            compliance_summary=compliance_summary,
            fx_summary=fx_summary,
            metadata={
                "platform_version": "1.0.0",
                "report_schema_version": "2024.1",
                "submission_deadline": date.replace(hour=10, minute=0, second=0).isoformat(),
            },
        )

        self._reports.append(report)
        return report

    def generate_monthly_volume(
        self,
        year: int,
        month: int,
        transfers: list[dict],
        participants: list[dict],
    ) -> RegulatoryReport:
        """Generate monthly volume report for CBN."""
        from datetime import date as date_type
        import calendar

        last_day = calendar.monthrange(year, month)[1]
        period_start = datetime(year, month, 1, tzinfo=timezone.utc)
        period_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

        corridor_metrics = self._compute_corridor_metrics(transfers)
        participant_metrics = self._compute_participant_metrics(transfers, participants)

        total_volume = sum(t.get("amount_ngn", 0) for t in transfers)

        report = RegulatoryReport(
            report_id=f"CBN-MONTHLY-{year}{month:02d}",
            report_type="monthly_volume",
            title=f"Monthly Outbound Remittance Report — {period_start.strftime('%B %Y')}",
            period_start=period_start,
            period_end=period_end,
            generated_at=datetime.now(timezone.utc),
            summary={
                "total_transfers": len(transfers),
                "total_volume_ngn": total_volume,
                "avg_daily_volume_ngn": total_volume // max(last_day, 1),
                "peak_daily_transfers": max(
                    (sum(1 for t in transfers if t.get("day") == d) for d in range(1, last_day + 1)),
                    default=0,
                ),
                "growth_vs_previous_month_pct": 0.0,  # Would compare to previous
            },
            corridor_metrics=corridor_metrics,
            participant_metrics=participant_metrics,
            compliance_summary=self._compute_compliance_summary(transfers),
            fx_summary=self._compute_fx_summary(transfers),
        )

        self._reports.append(report)
        return report

    def _compute_corridor_metrics(self, transfers: list[dict]) -> list[CorridorMetrics]:
        """Compute per-corridor metrics from transfer data."""
        corridor_data: dict[str, list[dict]] = {}
        for t in transfers:
            corridor = t.get("corridor", "unknown")
            if corridor not in corridor_data:
                corridor_data[corridor] = []
            corridor_data[corridor].append(t)

        metrics = []
        for corridor_id, name, category, spread_cap in self.CORRIDORS:
            txns = corridor_data.get(corridor_id, [])
            if not txns:
                continue
            volume = sum(t.get("amount_ngn", 0) for t in txns)
            success = sum(1 for t in txns if t.get("status") == "completed")
            latencies = [t.get("latency_ms", 0) for t in txns if t.get("latency_ms")]

            metrics.append(CorridorMetrics(
                corridor_id=corridor_id,
                corridor_name=name,
                category=category,
                transfer_count=len(txns),
                volume_ngn=volume,
                avg_amount_ngn=volume // max(len(txns), 1),
                success_rate=round(success / max(len(txns), 1) * 100, 2),
                avg_latency_ms=sum(latencies) // max(len(latencies), 1) if latencies else 0,
                sanctions_blocks=sum(1 for t in txns if t.get("status") == "blocked"),
                sanctions_escalations=sum(1 for t in txns if t.get("status") == "escalated"),
                fx_spread_cap_bps=spread_cap,
            ))

        return metrics

    def _compute_participant_metrics(
        self, transfers: list[dict], participants: list[dict]
    ) -> list[ParticipantMetrics]:
        """Compute per-participant metrics."""
        participant_map = {p.get("id"): p for p in participants}
        participant_txns: dict[str, list[dict]] = {}

        for t in transfers:
            pid = t.get("participant_id", "")
            if pid not in participant_txns:
                participant_txns[pid] = []
            participant_txns[pid].append(t)

        metrics = []
        for pid, txns in participant_txns.items():
            p_info = participant_map.get(pid, {})
            corridors_used = list(set(t.get("corridor", "") for t in txns))
            metrics.append(ParticipantMetrics(
                participant_id=pid,
                participant_name=p_info.get("name", pid),
                tier=p_info.get("tier", "unknown"),
                transfer_count=len(txns),
                volume_ngn=sum(t.get("amount_ngn", 0) for t in txns),
                prefund_balance_ngn=p_info.get("prefund_balance", 0),
                fees_paid_ngn=sum(t.get("total_fee_ngn", 0) for t in txns),
                corridors_used=corridors_used,
                compliance_flags=sum(1 for t in txns if t.get("status") in ("blocked", "escalated")),
            ))

        return metrics

    def _compute_compliance_summary(self, transfers: list[dict]) -> dict:
        """Compute compliance summary."""
        blocked = [t for t in transfers if t.get("status") == "blocked"]
        escalated = [t for t in transfers if t.get("status") == "escalated"]
        return {
            "total_screened": len(transfers),
            "blocked_count": len(blocked),
            "escalated_count": len(escalated),
            "block_rate_pct": round(len(blocked) / max(len(transfers), 1) * 100, 3),
            "escalation_rate_pct": round(len(escalated) / max(len(transfers), 1) * 100, 3),
            "false_positive_rate_pct": 0.0,  # Would be computed from manual review outcomes
            "lists_active": [sl.value for sl in [
                SanctionsList.OFAC_SDN, SanctionsList.OFAC_NON_SDN,
                SanctionsList.UN_CONSOLIDATED, SanctionsList.EU_SANCTIONS,
                SanctionsList.CBN_WATCHLIST, SanctionsList.INTERPOL_RED,
                SanctionsList.PEP,
            ]],
        }

    def _compute_fx_summary(self, transfers: list[dict]) -> dict:
        """Compute FX utilization summary."""
        return {
            "total_fx_volume_ngn": sum(t.get("amount_ngn", 0) for t in transfers),
            "total_spread_captured_ngn": sum(t.get("fx_spread_ngn", 0) for t in transfers),
            "avg_spread_bps": 120,  # Would be computed from actual spread data
            "corridors_at_cap": [],  # Would identify corridors where spread == max
            "revenue_share_paid_ngn": sum(t.get("fx_share_ngn", 0) for t in transfers),
        }

    def to_json(self, report: RegulatoryReport) -> str:
        """Serialize report to JSON for submission."""
        return json.dumps({
            "report_id": report.report_id,
            "report_type": report.report_type,
            "title": report.title,
            "period_start": report.period_start.isoformat(),
            "period_end": report.period_end.isoformat(),
            "generated_at": report.generated_at.isoformat(),
            "summary": report.summary,
            "corridor_count": len(report.corridor_metrics),
            "participant_count": len(report.participant_metrics),
            "compliance": report.compliance_summary,
            "fx": report.fx_summary,
        }, indent=2)


# Import for type usage
from .sanctions_batch import SanctionsList
