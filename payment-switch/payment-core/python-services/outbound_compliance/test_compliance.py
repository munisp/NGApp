"""Tests for outbound compliance services."""

import pytest
from datetime import datetime, timezone
from .sanctions_batch import (
    SanctionsBatchProcessor,
    SanctionsList,
    ScreeningDecision,
)
from .regulatory_reporting import RegulatoryReportingService


class TestSanctionsBatchProcessor:
    def setup_method(self):
        self.processor = SanctionsBatchProcessor()

    def test_seed_data_loaded(self):
        stats = self.processor.get_list_stats()
        assert stats["ofac_sdn"]["entries"] >= 1
        assert stats["un_consolidated"]["entries"] >= 1
        assert stats["cbn_watchlist"]["entries"] >= 1

    def test_screen_clean_name(self):
        result = self.processor.screen_name("John Smith", "NG")
        assert result.decision == ScreeningDecision.ALLOW
        assert result.highest_score < 0.75

    def test_screen_sanctioned_name_exact(self):
        result = self.processor.screen_name("Viktor Bout", "RU")
        assert result.decision in (ScreeningDecision.BLOCK, ScreeningDecision.ESCALATE)
        assert result.highest_score >= 0.75

    def test_screen_sanctioned_name_fuzzy(self):
        result = self.processor.screen_name("Victor But", "RU")
        # Should match via alias
        assert result.highest_score >= 0.70

    def test_screen_returns_matches(self):
        result = self.processor.screen_name("Wagner Group", "RU")
        assert len(result.matches) > 0
        assert result.matches[0]["list"] in [sl.value for sl in SanctionsList]

    def test_screen_timing(self):
        result = self.processor.screen_name("Random Person")
        assert result.processing_time_ms < 100  # Should be fast

    def test_ingest_new_list(self):
        entries = [
            {"id": "TEST-001", "name": "Test Entity One", "nationality": "NG"},
            {"id": "TEST-002", "name": "Test Entity Two", "nationality": "GH"},
        ]
        count = self.processor.ingest_list(SanctionsList.CBN_WATCHLIST, entries)
        assert count == 2

    def test_all_lists_checked(self):
        result = self.processor.screen_name("Any Name")
        assert len(result.lists_checked) == 7


class TestRegulatoryReporting:
    def setup_method(self):
        self.service = RegulatoryReportingService()

    def test_generate_daily_summary(self):
        transfers = [
            {"id": "TRF-001", "corridor": "NG-GH", "amount_ngn": 750000, "status": "completed", "participant_id": "P001", "latency_ms": 800, "total_fee_ngn": 1200, "fx_spread_ngn": 500, "fx_share_ngn": 25},
            {"id": "TRF-002", "corridor": "NG-GB", "amount_ngn": 18000000, "status": "completed", "participant_id": "P001", "latency_ms": 1200, "total_fee_ngn": 5400, "fx_spread_ngn": 18000, "fx_share_ngn": 900},
            {"id": "TRF-003", "corridor": "NG-GH", "amount_ngn": 500000, "status": "blocked", "participant_id": "P002", "latency_ms": 200, "total_fee_ngn": 0, "fx_spread_ngn": 0, "fx_share_ngn": 0},
            {"id": "TRF-004", "corridor": "NG-CN", "amount_ngn": 67500000, "status": "escalated", "participant_id": "P003", "latency_ms": 150, "total_fee_ngn": 0, "fx_spread_ngn": 0, "fx_share_ngn": 0},
        ]
        participants = [
            {"id": "P001", "name": "PayApp Nigeria", "tier": "Growth", "prefund_balance": 847000000},
            {"id": "P002", "name": "FinBeta", "tier": "Starter", "prefund_balance": 120000000},
            {"id": "P003", "name": "MoneyGo", "tier": "Enterprise", "prefund_balance": 2400000000},
        ]

        date = datetime(2024, 12, 15, tzinfo=timezone.utc)
        report = self.service.generate_daily_summary(date, transfers, participants)

        assert report.report_type == "daily_summary"
        assert report.summary["total_transfers"] == 4
        assert report.summary["total_volume_ngn"] == 750000 + 18000000 + 500000 + 67500000
        assert report.summary["success_count"] == 2
        assert report.compliance_summary["blocked_count"] == 1
        assert report.compliance_summary["escalated_count"] == 1
        assert len(report.corridor_metrics) >= 2  # NG-GH and NG-GB at minimum
        assert len(report.participant_metrics) == 3

    def test_generate_monthly_volume(self):
        transfers = [
            {"id": f"TRF-{i}", "corridor": "NG-GH", "amount_ngn": 500000, "status": "completed", "participant_id": "P001", "day": (i % 28) + 1, "total_fee_ngn": 1000, "fx_spread_ngn": 500, "fx_share_ngn": 25}
            for i in range(100)
        ]
        participants = [{"id": "P001", "name": "PayApp", "tier": "Growth", "prefund_balance": 500000000}]

        report = self.service.generate_monthly_volume(2024, 11, transfers, participants)
        assert report.report_type == "monthly_volume"
        assert report.summary["total_transfers"] == 100
        assert report.summary["total_volume_ngn"] == 50000000

    def test_report_serialization(self):
        transfers = [{"id": "TRF-001", "corridor": "NG-GH", "amount_ngn": 100000, "status": "completed", "participant_id": "P001", "total_fee_ngn": 500, "fx_spread_ngn": 100, "fx_share_ngn": 5}]
        participants = [{"id": "P001", "name": "Test", "tier": "Starter", "prefund_balance": 100000000}]

        date = datetime(2024, 12, 1, tzinfo=timezone.utc)
        report = self.service.generate_daily_summary(date, transfers, participants)
        json_str = self.service.to_json(report)

        import json
        parsed = json.loads(json_str)
        assert parsed["report_id"] == "CBN-DAILY-20241201"
        assert "compliance" in parsed
        assert "fx" in parsed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
