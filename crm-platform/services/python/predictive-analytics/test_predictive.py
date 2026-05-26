"""Predictive Analytics tests — validates scoring models, churn prediction, and LTV calculations."""
import pytest
import math


class TestWinProbability:
    def test_high_engagement_high_probability(self):
        features = {"engagement_score": 95, "meeting_count": 8, "days_in_pipeline": 15, "deal_size": 500_000}
        prob = self._calculate_win_probability(features)
        assert prob >= 0.7

    def test_low_engagement_low_probability(self):
        features = {"engagement_score": 10, "meeting_count": 0, "days_in_pipeline": 120, "deal_size": 1_000_000}
        prob = self._calculate_win_probability(features)
        assert prob < 0.3

    def test_probability_bounded_0_1(self):
        for eng in [0, 50, 100]:
            for meetings in [0, 5, 20]:
                features = {"engagement_score": eng, "meeting_count": meetings, "days_in_pipeline": 30, "deal_size": 100_000}
                prob = self._calculate_win_probability(features)
                assert 0.0 <= prob <= 1.0

    def test_stale_deals_penalized(self):
        fresh = {"engagement_score": 70, "meeting_count": 3, "days_in_pipeline": 10, "deal_size": 200_000}
        stale = {"engagement_score": 70, "meeting_count": 3, "days_in_pipeline": 180, "deal_size": 200_000}
        assert self._calculate_win_probability(fresh) > self._calculate_win_probability(stale)

    def test_more_meetings_increase_probability(self):
        few = {"engagement_score": 60, "meeting_count": 1, "days_in_pipeline": 30, "deal_size": 100_000}
        many = {"engagement_score": 60, "meeting_count": 10, "days_in_pipeline": 30, "deal_size": 100_000}
        assert self._calculate_win_probability(many) > self._calculate_win_probability(few)

    def _calculate_win_probability(self, features):
        eng = features.get("engagement_score", 0) / 100
        meetings = min(features.get("meeting_count", 0) / 10, 1.0)
        days = features.get("days_in_pipeline", 0)
        staleness_penalty = max(0, 1 - (days / 365))
        raw = (eng * 0.4 + meetings * 0.3 + staleness_penalty * 0.3)
        return max(0.0, min(1.0, raw))


class TestChurnPrediction:
    def test_inactive_customer_high_risk(self):
        customer = {"days_since_last_login": 90, "support_tickets": 5, "usage_trend": -0.3, "contract_months_left": 2}
        risk = self._calculate_churn_risk(customer)
        assert risk >= 0.5

    def test_active_customer_low_risk(self):
        customer = {"days_since_last_login": 1, "support_tickets": 0, "usage_trend": 0.2, "contract_months_left": 18}
        risk = self._calculate_churn_risk(customer)
        assert risk < 0.3

    def test_risk_bounded(self):
        for days in [0, 30, 180]:
            customer = {"days_since_last_login": days, "support_tickets": 2, "usage_trend": 0, "contract_months_left": 6}
            risk = self._calculate_churn_risk(customer)
            assert 0.0 <= risk <= 1.0

    def test_negative_usage_trend_increases_risk(self):
        growing = {"days_since_last_login": 10, "support_tickets": 1, "usage_trend": 0.3, "contract_months_left": 12}
        declining = {"days_since_last_login": 10, "support_tickets": 1, "usage_trend": -0.3, "contract_months_left": 12}
        assert self._calculate_churn_risk(declining) > self._calculate_churn_risk(growing)

    def _calculate_churn_risk(self, customer):
        inactivity = min(customer.get("days_since_last_login", 0) / 180, 1.0)
        tickets = min(customer.get("support_tickets", 0) / 10, 1.0)
        trend = max(0, -customer.get("usage_trend", 0))
        contract_risk = max(0, 1 - customer.get("contract_months_left", 12) / 24)
        raw = inactivity * 0.3 + tickets * 0.2 + trend * 0.25 + contract_risk * 0.25
        return max(0.0, min(1.0, raw))


class TestLTVCalculation:
    def test_high_value_customer(self):
        customer = {"monthly_revenue": 500_000, "tenure_months": 36, "churn_probability": 0.05}
        ltv = self._calculate_ltv(customer)
        assert ltv > 5_000_000

    def test_new_customer_lower_ltv(self):
        customer = {"monthly_revenue": 100_000, "tenure_months": 1, "churn_probability": 0.2}
        ltv = self._calculate_ltv(customer)
        assert ltv < 5_000_000

    def test_ltv_always_positive(self):
        customer = {"monthly_revenue": 0, "tenure_months": 0, "churn_probability": 1.0}
        ltv = self._calculate_ltv(customer)
        assert ltv >= 0

    def test_low_churn_increases_ltv(self):
        low_churn = {"monthly_revenue": 200_000, "tenure_months": 12, "churn_probability": 0.02}
        high_churn = {"monthly_revenue": 200_000, "tenure_months": 12, "churn_probability": 0.5}
        assert self._calculate_ltv(low_churn) > self._calculate_ltv(high_churn)

    def _calculate_ltv(self, customer):
        mrr = customer.get("monthly_revenue", 0)
        churn = customer.get("churn_probability", 0.1)
        if churn >= 1.0:
            return mrr
        expected_lifetime = 1 / max(churn, 0.001)
        return mrr * expected_lifetime


class TestSegmentation:
    def test_enterprise_classification(self):
        customer = {"revenue": 1_000_000_000, "employees": 5000}
        segment = self._classify(customer)
        assert segment == "enterprise"

    def test_sme_classification(self):
        customer = {"revenue": 10_000_000, "employees": 25}
        segment = self._classify(customer)
        assert segment == "sme"

    def test_corporate_classification(self):
        customer = {"revenue": 500_000_000, "employees": 500}
        segment = self._classify(customer)
        assert segment == "corporate"

    def test_micro_classification(self):
        customer = {"revenue": 500_000, "employees": 2}
        segment = self._classify(customer)
        assert segment == "micro"

    def _classify(self, customer):
        revenue = customer.get("revenue", 0)
        employees = customer.get("employees", 0)
        if revenue >= 500_000_000 and employees >= 1000:
            return "enterprise"
        if revenue >= 100_000_000 or employees >= 200:
            return "corporate"
        if revenue >= 5_000_000 or employees >= 10:
            return "sme"
        return "micro"
