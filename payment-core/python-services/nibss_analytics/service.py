"""NIBSS Analytics & Regulatory Reporting Service.

Python service for merchant analytics, PayDirect collection reporting,
NEFT settlement reconciliation, NDD mandate compliance, and regulatory filings.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import json


# ======================== Merchant Analytics ========================

class MerchantCategory(str, Enum):
    RETAIL = "RETAIL"
    FOOD_BEVERAGE = "FOOD_BEVERAGE"
    ECOMMERCE = "ECOMMERCE"
    MARKET = "MARKET"
    FUEL = "FUEL"
    HEALTHCARE = "HEALTHCARE"
    TRANSPORT = "TRANSPORT"


@dataclass
class MerchantAnalytics:
    """Analytics for a single merchant."""
    merchant_id: str
    merchant_name: str
    category: str
    total_transactions: int
    total_volume: float
    avg_transaction_value: float
    success_rate: float
    peak_hour: int  # 0-23
    peak_day: str  # MON-SUN
    monthly_growth_pct: float
    chargeback_rate: float


@dataclass
class CategoryBreakdown:
    """Analytics aggregated by merchant category."""
    category: str
    merchant_count: int
    total_transactions: int
    total_volume: float
    avg_success_rate: float
    top_merchant: str


class MerchantAnalyticsService:
    """Generates analytics for mCash+ merchant registry."""

    def __init__(self):
        self._analytics = self._generate_seed_analytics()

    def _generate_seed_analytics(self) -> list[MerchantAnalytics]:
        return [
            MerchantAnalytics(
                merchant_id="MERCH-001", merchant_name="ShopRite Ikeja",
                category="RETAIL", total_transactions=12500, total_volume=185_000_000,
                avg_transaction_value=14_800, success_rate=99.2,
                peak_hour=14, peak_day="SAT", monthly_growth_pct=8.5,
                chargeback_rate=0.02,
            ),
            MerchantAnalytics(
                merchant_id="MERCH-002", merchant_name="Chicken Republic VI",
                category="FOOD_BEVERAGE", total_transactions=8200, total_volume=28_000_000,
                avg_transaction_value=3_415, success_rate=98.8,
                peak_hour=13, peak_day="FRI", monthly_growth_pct=12.3,
                chargeback_rate=0.01,
            ),
            MerchantAnalytics(
                merchant_id="MERCH-003", merchant_name="Jumia Nigeria",
                category="ECOMMERCE", total_transactions=45000, total_volume=2_500_000_000,
                avg_transaction_value=55_556, success_rate=97.5,
                peak_hour=20, peak_day="SUN", monthly_growth_pct=15.7,
                chargeback_rate=0.08,
            ),
            MerchantAnalytics(
                merchant_id="MERCH-004", merchant_name="Balogun Market Traders",
                category="MARKET", total_transactions=3200, total_volume=15_000_000,
                avg_transaction_value=4_688, success_rate=96.5,
                peak_hour=11, peak_day="WED", monthly_growth_pct=22.0,
                chargeback_rate=0.05,
            ),
            MerchantAnalytics(
                merchant_id="MERCH-005", merchant_name="Ibadan Fuel Station",
                category="FUEL", total_transactions=1800, total_volume=42_000_000,
                avg_transaction_value=23_333, success_rate=99.5,
                peak_hour=8, peak_day="MON", monthly_growth_pct=-5.2,
                chargeback_rate=0.00,
            ),
        ]

    def get_all_analytics(self) -> list[dict]:
        return [
            {
                "merchant_id": a.merchant_id,
                "merchant_name": a.merchant_name,
                "category": a.category,
                "total_transactions": a.total_transactions,
                "total_volume": a.total_volume,
                "avg_transaction_value": a.avg_transaction_value,
                "success_rate": a.success_rate,
                "peak_hour": a.peak_hour,
                "peak_day": a.peak_day,
                "monthly_growth_pct": a.monthly_growth_pct,
                "chargeback_rate": a.chargeback_rate,
            }
            for a in self._analytics
        ]

    def get_category_breakdown(self) -> list[dict]:
        categories: dict[str, list[MerchantAnalytics]] = {}
        for a in self._analytics:
            categories.setdefault(a.category, []).append(a)

        result = []
        for cat, merchants in categories.items():
            result.append({
                "category": cat,
                "merchant_count": len(merchants),
                "total_transactions": sum(m.total_transactions for m in merchants),
                "total_volume": sum(m.total_volume for m in merchants),
                "avg_success_rate": sum(m.success_rate for m in merchants) / len(merchants),
                "top_merchant": max(merchants, key=lambda m: m.total_volume).merchant_name,
            })
        return sorted(result, key=lambda x: x["total_volume"], reverse=True)


# ======================== Regulatory Reporting ========================

class ReportType(str, Enum):
    CBN_BOP_RETURN = "CBN_BOP_RETURN"
    NFIU_STR = "NFIU_STR"
    NACS_CLEARING = "NACS_CLEARING"
    NEFT_SETTLEMENT = "NEFT_SETTLEMENT"
    NDD_MANDATE_COMPLIANCE = "NDD_MANDATE_COMPLIANCE"
    NIBSS_DAILY_POSITION = "NIBSS_DAILY_POSITION"


@dataclass
class RegulatoryReport:
    """A regulatory report."""
    id: str
    report_type: str
    title: str
    period: str
    status: str  # DRAFT, SUBMITTED, ACCEPTED, REJECTED
    generated_at: str
    submitted_at: Optional[str] = None
    regulator: str = ""
    summary: dict = field(default_factory=dict)


class RegulatoryReportingService:
    """Generates regulatory reports for CBN, NFIU, and NIBSS."""

    def __init__(self):
        self._reports = self._generate_seed_reports()

    def _generate_seed_reports(self) -> list[RegulatoryReport]:
        return [
            RegulatoryReport(
                id="RPT-001", report_type="CBN_BOP_RETURN",
                title="Balance of Payments Return — April 2026",
                period="2026-04", status="SUBMITTED",
                generated_at="2026-05-01T00:00:00Z",
                submitted_at="2026-05-01T09:00:00Z",
                regulator="Central Bank of Nigeria",
                summary={
                    "total_inflows": 45_000_000_000,
                    "total_outflows": 38_000_000_000,
                    "net_position": 7_000_000_000,
                    "corridors_reported": 12,
                    "participant_count": 15,
                },
            ),
            RegulatoryReport(
                id="RPT-002", report_type="NFIU_STR",
                title="Suspicious Transaction Reports — April 2026",
                period="2026-04", status="ACCEPTED",
                generated_at="2026-05-01T00:00:00Z",
                submitted_at="2026-05-01T10:00:00Z",
                regulator="Nigerian Financial Intelligence Unit",
                summary={
                    "total_strs_filed": 23,
                    "total_value_flagged": 850_000_000,
                    "categories": {
                        "structuring": 8,
                        "velocity_anomaly": 6,
                        "sanctions_proximity": 5,
                        "unusual_pattern": 4,
                    },
                },
            ),
            RegulatoryReport(
                id="RPT-003", report_type="NACS_CLEARING",
                title="NACS Cheque Clearing Report — May 1, 2026",
                period="2026-05-01", status="SUBMITTED",
                generated_at="2026-05-01T23:59:00Z",
                submitted_at="2026-05-02T08:00:00Z",
                regulator="NIBSS",
                summary={
                    "cheques_presented": 45,
                    "cheques_cleared": 38,
                    "cheques_returned": 7,
                    "total_value_presented": 1_580_000_000,
                    "total_value_cleared": 1_330_000_000,
                    "return_rate_pct": 15.6,
                },
            ),
            RegulatoryReport(
                id="RPT-004", report_type="NEFT_SETTLEMENT",
                title="NEFT Settlement Reconciliation — May 1, 2026",
                period="2026-05-01", status="ACCEPTED",
                generated_at="2026-05-01T23:59:00Z",
                submitted_at="2026-05-02T07:00:00Z",
                regulator="NIBSS",
                summary={
                    "total_batches": 12,
                    "total_items": 2850,
                    "total_volume": 450_000_000,
                    "settled_volume": 445_000_000,
                    "failed_volume": 5_000_000,
                    "settlement_rate_pct": 98.9,
                    "clearing_sessions": {"MORNING": 4, "AFTERNOON": 5, "EVENING": 3},
                },
            ),
            RegulatoryReport(
                id="RPT-005", report_type="NDD_MANDATE_COMPLIANCE",
                title="NDD Mandate Compliance Report — April 2026",
                period="2026-04", status="DRAFT",
                generated_at="2026-05-02T00:00:00Z",
                regulator="NIBSS / CBN",
                summary={
                    "active_mandates": 12500,
                    "mandates_executed": 11800,
                    "execution_success_rate": 94.4,
                    "failed_debits": 700,
                    "total_debited": 2_500_000_000,
                    "mandate_types": {"FIXED": 8000, "VARIABLE": 3500, "GSI": 1000},
                    "gsi_recoveries": 850_000_000,
                },
            ),
            RegulatoryReport(
                id="RPT-006", report_type="NIBSS_DAILY_POSITION",
                title="NIBSS Daily Net Position — May 2, 2026",
                period="2026-05-02", status="SUBMITTED",
                generated_at="2026-05-02T23:59:00Z",
                submitted_at="2026-05-03T06:00:00Z",
                regulator="NIBSS",
                summary={
                    "nip_volume": 8_500_000_000,
                    "nip_count": 125_000,
                    "neft_volume": 450_000_000,
                    "neft_count": 2850,
                    "nacs_volume": 1_330_000_000,
                    "nacs_count": 38,
                    "net_debit_position": -2_100_000_000,
                    "net_credit_position": 2_100_000_000,
                },
            ),
        ]

    def list_reports(self) -> list[dict]:
        return [
            {
                "id": r.id,
                "report_type": r.report_type,
                "title": r.title,
                "period": r.period,
                "status": r.status,
                "generated_at": r.generated_at,
                "submitted_at": r.submitted_at,
                "regulator": r.regulator,
                "summary": r.summary,
            }
            for r in self._reports
        ]

    def get_report(self, report_id: str) -> Optional[dict]:
        for r in self._reports:
            if r.id == report_id:
                return {
                    "id": r.id,
                    "report_type": r.report_type,
                    "title": r.title,
                    "period": r.period,
                    "status": r.status,
                    "generated_at": r.generated_at,
                    "submitted_at": r.submitted_at,
                    "regulator": r.regulator,
                    "summary": r.summary,
                }
        return None


# ======================== PayDirect Analytics ========================

class PayDirectAnalyticsService:
    """Analytics for PayDirect corporate collections."""

    def __init__(self):
        self._collections_analytics = self._generate_seed_analytics()

    def _generate_seed_analytics(self) -> list[dict]:
        return [
            {
                "collector_code": "FIRS",
                "collector_name": "Federal Inland Revenue Service",
                "category": "GOVERNMENT",
                "monthly_volume": [
                    {"month": "2026-01", "amount": 3_200_000_000, "count": 9500},
                    {"month": "2026-02", "amount": 3_500_000_000, "count": 10200},
                    {"month": "2026-03", "amount": 4_800_000_000, "count": 14500},
                    {"month": "2026-04", "amount": 3_900_000_000, "count": 11200},
                ],
                "top_payment_channels": [
                    {"channel": "internet_banking", "pct": 45},
                    {"channel": "mobile_app", "pct": 30},
                    {"channel": "USSD", "pct": 15},
                    {"channel": "bank_branch", "pct": 10},
                ],
                "avg_payment_value": 350_000,
                "peak_collection_day": 21,  # day of month
            },
            {
                "collector_code": "LIRS",
                "collector_name": "Lagos State Internal Revenue Service",
                "category": "GOVERNMENT",
                "monthly_volume": [
                    {"month": "2026-01", "amount": 900_000_000, "count": 6800},
                    {"month": "2026-02", "amount": 1_100_000_000, "count": 7500},
                    {"month": "2026-03", "amount": 1_500_000_000, "count": 9200},
                    {"month": "2026-04", "amount": 1_200_000_000, "count": 7800},
                ],
                "top_payment_channels": [
                    {"channel": "internet_banking", "pct": 50},
                    {"channel": "mobile_app", "pct": 35},
                    {"channel": "USSD", "pct": 15},
                ],
                "avg_payment_value": 145_000,
                "peak_collection_day": 15,
            },
            {
                "collector_code": "UNILAG",
                "collector_name": "University of Lagos",
                "category": "EDUCATION",
                "monthly_volume": [
                    {"month": "2026-01", "amount": 3_200_000_000, "count": 15000},
                    {"month": "2026-02", "amount": 800_000_000, "count": 4200},
                    {"month": "2026-03", "amount": 500_000_000, "count": 2800},
                    {"month": "2026-04", "amount": 600_000_000, "count": 3500},
                ],
                "top_payment_channels": [
                    {"channel": "internet_banking", "pct": 60},
                    {"channel": "mobile_app", "pct": 40},
                ],
                "avg_payment_value": 185_000,
                "peak_collection_day": 5,
            },
        ]

    def get_collection_analytics(self) -> list[dict]:
        return self._collections_analytics

    def get_collection_summary(self) -> dict:
        total_volume = sum(
            sum(m["amount"] for m in c["monthly_volume"])
            for c in self._collections_analytics
        )
        total_count = sum(
            sum(m["count"] for m in c["monthly_volume"])
            for c in self._collections_analytics
        )
        return {
            "total_collectors": len(self._collections_analytics),
            "total_volume_ytd": total_volume,
            "total_transactions_ytd": total_count,
            "avg_monthly_volume": total_volume / 4,
            "top_category": "GOVERNMENT",
        }
