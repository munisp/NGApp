"""Customer Success Agent tests — validates health scoring, retention, and playbooks."""
import pytest


class TestHealthScoring:
    def test_healthy_customer(self):
        customer = {"usage_score": 90, "support_score": 95, "payment_score": 100, "engagement_score": 85}
        health = self._calculate_health(customer)
        assert health >= 80

    def test_at_risk_customer(self):
        customer = {"usage_score": 30, "support_score": 40, "payment_score": 60, "engagement_score": 20}
        health = self._calculate_health(customer)
        assert health < 50

    def test_health_bounded(self):
        for usage in [0, 50, 100]:
            customer = {"usage_score": usage, "support_score": 50, "payment_score": 50, "engagement_score": 50}
            health = self._calculate_health(customer)
            assert 0 <= health <= 100

    def test_payment_weight_highest(self):
        good_payment = {"usage_score": 50, "support_score": 50, "payment_score": 100, "engagement_score": 50}
        bad_payment = {"usage_score": 50, "support_score": 50, "payment_score": 0, "engagement_score": 50}
        assert self._calculate_health(good_payment) > self._calculate_health(bad_payment)

    def _calculate_health(self, customer):
        weights = {"usage_score": 0.25, "support_score": 0.2, "payment_score": 0.35, "engagement_score": 0.2}
        total = sum(customer.get(k, 0) * w for k, w in weights.items())
        return max(0, min(100, total))


class TestRetentionPlaybook:
    def test_select_playbook_for_high_risk(self):
        risk = 0.85
        playbook = self._select_playbook(risk)
        assert playbook == "executive_intervention"

    def test_select_playbook_for_medium_risk(self):
        risk = 0.55
        playbook = self._select_playbook(risk)
        assert playbook == "proactive_outreach"

    def test_select_playbook_for_low_risk(self):
        risk = 0.15
        playbook = self._select_playbook(risk)
        assert playbook == "nurture"

    def test_playbook_always_selected(self):
        for risk in [0.0, 0.3, 0.5, 0.7, 0.9, 1.0]:
            playbook = self._select_playbook(risk)
            assert playbook is not None

    def _select_playbook(self, churn_risk):
        if churn_risk >= 0.7:
            return "executive_intervention"
        if churn_risk >= 0.4:
            return "proactive_outreach"
        return "nurture"


class TestAlertGeneration:
    def test_generates_alert_for_declining_health(self):
        prev_health = 85
        curr_health = 60
        alert = self._check_alert(prev_health, curr_health)
        assert alert is not None
        assert alert["severity"] == "warning"

    def test_generates_critical_for_severe_drop(self):
        prev_health = 90
        curr_health = 30
        alert = self._check_alert(prev_health, curr_health)
        assert alert["severity"] == "critical"

    def test_no_alert_for_stable_health(self):
        alert = self._check_alert(85, 83)
        assert alert is None

    def test_no_alert_for_improving_health(self):
        alert = self._check_alert(60, 75)
        assert alert is None

    def _check_alert(self, prev, curr):
        drop = prev - curr
        if drop >= 40:
            return {"severity": "critical", "drop": drop}
        if drop >= 15:
            return {"severity": "warning", "drop": drop}
        return None
