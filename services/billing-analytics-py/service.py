from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Iterable


@dataclass
class AccrualPoint:
    tenant_id: str
    billing_period: str
    accrued_amount: float


def detect_spikes(points: Iterable[AccrualPoint], spike_ratio: float = 1.4) -> list[dict[str, object]]:
    series = list(points)
    if len(series) < 2:
        return []

    baseline = mean(point.accrued_amount for point in series[:-1])
    latest = series[-1]
    if baseline <= 0:
        return []

    if latest.accrued_amount >= baseline * spike_ratio:
        return [
            {
                "tenantId": latest.tenant_id,
                "billingPeriod": latest.billing_period,
                "baseline": round(baseline, 2),
                "latest": round(latest.accrued_amount, 2),
                "severity": "warning" if latest.accrued_amount < baseline * 2 else "critical",
                "destinations": ["Lakehouse", "OpenSearch", "Temporal"],
            }
        ]
    return []


if __name__ == "__main__":
    sample = [
        AccrualPoint("54bank-platform-prod", "2026-03", 7_500_000),
        AccrualPoint("54bank-platform-prod", "2026-04", 8_100_000),
        AccrualPoint("54bank-platform-prod", "2026-05", 12_900_000),
    ]
    print({
        "service": "billing-analytics-python",
        "alerts": detect_spikes(sample),
        "notes": "Reference worker for lakehouse exports, OpenSearch enrichment, and billing anomaly analytics.",
    })
