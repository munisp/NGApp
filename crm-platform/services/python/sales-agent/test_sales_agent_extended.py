"""Extended sales agent tests."""
import pytest
import json


class TestLeadScoring:
    """Test lead scoring algorithms."""

    def test_basic_lead_score(self):
        lead = {
            "company_size": "enterprise",
            "industry": "banking",
            "engagement_score": 85,
            "budget_range": "high",
        }
        score = 0
        if lead["company_size"] == "enterprise":
            score += 30
        if lead["industry"] in ["banking", "telco", "commodity"]:
            score += 20
        if lead["engagement_score"] > 70:
            score += 25
        if lead["budget_range"] == "high":
            score += 25
        assert score == 100

    def test_lead_priority_ranking(self):
        leads = [
            {"name": "Dangote", "score": 89, "value": 2400000000},
            {"name": "MTN", "score": 72, "value": 1800000000},
            {"name": "Shoprite", "score": 55, "value": 900000000},
            {"name": "First Bank", "score": 91, "value": 3200000000},
        ]
        ranked = sorted(leads, key=lambda x: x["score"], reverse=True)
        assert ranked[0]["name"] == "First Bank"
        assert ranked[-1]["name"] == "Shoprite"

    def test_engagement_decay(self):
        initial_score = 100
        days_inactive = 30
        decay_rate = 0.02
        current_score = initial_score * (1 - decay_rate) ** days_inactive
        assert current_score < initial_score
        assert current_score > 0

    def test_multi_signal_scoring(self):
        signals = {
            "email_opens": 15,
            "page_visits": 42,
            "demo_requests": 2,
            "content_downloads": 8,
            "meeting_attended": True,
        }
        weights = {
            "email_opens": 1,
            "page_visits": 0.5,
            "demo_requests": 15,
            "content_downloads": 3,
            "meeting_attended": 20,
        }
        score = 0
        for signal, value in signals.items():
            if isinstance(value, bool):
                score += weights[signal] * (1 if value else 0)
            else:
                score += min(value * weights[signal], 30)  # cap each at 30
            
        assert score > 50


class TestOutreachGeneration:
    """Test AI outreach generation."""

    def test_email_template_variables(self):
        template = "Dear {name}, regarding {company}'s {vertical} needs..."
        variables = {"name": "John", "company": "Dangote", "vertical": "commodity"}
        result = template.format(**variables)
        assert "John" in result
        assert "Dangote" in result
        assert "commodity" in result

    def test_personalization_scoring(self):
        email = {
            "has_name": True,
            "has_company": True,
            "has_vertical_ref": True,
            "has_pain_point": True,
            "has_cta": True,
        }
        score = sum(1 for v in email.values() if v) / len(email) * 100
        assert score == 100.0

    def test_follow_up_cadence(self):
        cadence = [
            {"day": 0, "type": "initial_email"},
            {"day": 3, "type": "follow_up_1"},
            {"day": 7, "type": "linkedin_connect"},
            {"day": 10, "type": "follow_up_2"},
            {"day": 14, "type": "phone_call"},
            {"day": 21, "type": "break_up_email"},
        ]
        assert len(cadence) == 6
        assert cadence[0]["day"] == 0
        assert cadence[-1]["type"] == "break_up_email"


class TestPipelineManagement:
    """Test pipeline management logic."""

    def test_stage_progression(self):
        stages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]
        deal = {"stage": "qualification"}
        current_idx = stages.index(deal["stage"])
        next_stage = stages[current_idx + 1]
        assert next_stage == "proposal"

    def test_pipeline_value(self):
        deals = [
            {"value": 5000000, "stage": "negotiation", "probability": 0.8},
            {"value": 3000000, "stage": "proposal", "probability": 0.5},
            {"value": 8000000, "stage": "qualification", "probability": 0.2},
        ]
        total_pipeline = sum(d["value"] for d in deals)
        weighted = sum(d["value"] * d["probability"] for d in deals)
        assert total_pipeline == 16000000
        assert weighted == 7100000.0

    def test_deal_aging(self):
        deals = [
            {"name": "Deal A", "days_in_stage": 15, "stage": "proposal"},
            {"name": "Deal B", "days_in_stage": 45, "stage": "proposal"},
            {"name": "Deal C", "days_in_stage": 5, "stage": "negotiation"},
        ]
        avg_stage_days = {"proposal": 20, "negotiation": 14}
        stale = [d for d in deals if d["days_in_stage"] > avg_stage_days.get(d["stage"], 30)]
        assert len(stale) == 1
        assert stale[0]["name"] == "Deal B"

    def test_quota_attainment(self):
        quota = 10000000
        closed = 7500000
        pipeline_weighted = 3500000
        attainment = (closed / quota) * 100
        coverage = (closed + pipeline_weighted) / quota
        assert attainment == 75.0
        assert coverage > 1.0


class TestTerritoryManagement:
    """Test territory and assignment logic."""

    def test_round_robin_assignment(self):
        reps = ["Alice", "Bob", "Charlie"]
        leads = [f"Lead-{i}" for i in range(9)]
        assignments = {}
        for i, lead in enumerate(leads):
            assignments[lead] = reps[i % len(reps)]
        assert assignments["Lead-0"] == "Alice"
        assert assignments["Lead-1"] == "Bob"
        assert assignments["Lead-2"] == "Charlie"
        assert assignments["Lead-3"] == "Alice"

    def test_territory_capacity(self):
        territories = {
            "Lagos": {"rep": "Alice", "accounts": 45, "capacity": 50},
            "Abuja": {"rep": "Bob", "accounts": 50, "capacity": 50},
            "Port Harcourt": {"rep": "Charlie", "accounts": 30, "capacity": 50},
        }
        available = {k: v for k, v in territories.items() if v["accounts"] < v["capacity"]}
        assert "Lagos" in available
        assert "Port Harcourt" in available
        assert "Abuja" not in available
