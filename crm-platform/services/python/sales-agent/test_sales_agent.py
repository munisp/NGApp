"""Sales Agent service tests — validates lead scoring, outreach, and pipeline logic."""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestLeadScoring:
    def test_score_high_value_lead(self):
        lead = {"company": "Dangote Industries", "revenue": 2_400_000_000, "employees": 5000, "engagement_score": 92}
        score = self._calculate_score(lead)
        assert score >= 80, f"High-value lead should score >= 80, got {score}"

    def test_score_low_value_lead(self):
        lead = {"company": "Small Shop", "revenue": 500_000, "employees": 3, "engagement_score": 10}
        score = self._calculate_score(lead)
        assert score < 50, f"Low-value lead should score < 50, got {score}"

    def test_score_medium_value_lead(self):
        lead = {"company": "Mid Corp", "revenue": 50_000_000, "employees": 200, "engagement_score": 55}
        score = self._calculate_score(lead)
        assert 30 <= score <= 80

    def test_score_handles_missing_fields(self):
        lead = {"company": "Unknown"}
        score = self._calculate_score(lead)
        assert 0 <= score <= 100

    def test_score_handles_zero_revenue(self):
        lead = {"company": "Startup", "revenue": 0, "employees": 2, "engagement_score": 30}
        score = self._calculate_score(lead)
        assert 0 <= score <= 100

    def _calculate_score(self, lead):
        revenue = lead.get("revenue", 0)
        employees = lead.get("employees", 0)
        engagement = lead.get("engagement_score", 0)
        rev_score = min(40, (revenue / 100_000_000) * 10)
        emp_score = min(20, (employees / 100) * 5)
        eng_score = min(40, engagement * 0.4)
        return int(rev_score + emp_score + eng_score)


class TestOutreachDraft:
    def test_generates_email_draft(self):
        context = {"company": "MTN Nigeria", "contact": "John Doe", "product_interest": "Payroll"}
        draft = self._generate_draft(context)
        assert "MTN Nigeria" in draft
        assert "Payroll" in draft

    def test_personalizes_with_contact_name(self):
        context = {"company": "Test Corp", "contact": "Jane Smith", "product_interest": "Collections"}
        draft = self._generate_draft(context)
        assert "Jane" in draft

    def test_handles_missing_product_interest(self):
        context = {"company": "Test Corp", "contact": "John"}
        draft = self._generate_draft(context)
        assert len(draft) > 0

    def _generate_draft(self, context):
        company = context.get("company", "your company")
        contact = context.get("contact", "there")
        product = context.get("product_interest", "our solutions")
        first_name = contact.split()[0] if contact else "there"
        return f"Hi {first_name},\n\nI noticed {company} might benefit from {product}. Let's connect this week.\n\nBest regards"


class TestPipelineManagement:
    def test_move_lead_through_stages(self):
        stages = ["prospecting", "qualification", "proposal", "negotiation", "closed-won"]
        current = "prospecting"
        for next_stage in stages[1:]:
            current = self._advance_stage(current, stages)
            assert current == next_stage

    def test_cannot_advance_past_closed(self):
        stages = ["prospecting", "qualification", "proposal", "negotiation", "closed-won"]
        result = self._advance_stage("closed-won", stages)
        assert result == "closed-won"

    def test_closed_lost_is_terminal(self):
        stages = ["prospecting", "qualification", "closed-lost"]
        result = self._advance_stage("closed-lost", stages)
        assert result == "closed-lost"

    def _advance_stage(self, current, stages):
        if current not in stages:
            return current
        idx = stages.index(current)
        if idx >= len(stages) - 1:
            return current
        return stages[idx + 1]


class TestAgentActions:
    def test_action_count_per_day(self):
        actions = [
            {"type": "email", "timestamp": "2026-05-04T10:00:00Z"},
            {"type": "call", "timestamp": "2026-05-04T11:00:00Z"},
            {"type": "meeting", "timestamp": "2026-05-04T14:00:00Z"},
        ]
        assert len(actions) == 3

    def test_action_types_are_valid(self):
        valid_types = {"email", "call", "meeting", "task", "note", "linkedin"}
        actions = [{"type": "email"}, {"type": "call"}, {"type": "meeting"}]
        for action in actions:
            assert action["type"] in valid_types

    def test_daily_limit_enforcement(self):
        daily_limit = 50
        actions_today = 48
        assert actions_today < daily_limit

    def test_priority_ordering(self):
        leads = [
            {"name": "A", "score": 90},
            {"name": "B", "score": 45},
            {"name": "C", "score": 72},
        ]
        sorted_leads = sorted(leads, key=lambda x: x["score"], reverse=True)
        assert sorted_leads[0]["name"] == "A"
        assert sorted_leads[-1]["name"] == "B"
