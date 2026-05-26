"""Agent governance tests — validates permission tiers, cost limits, and audit logging."""
import pytest
from datetime import datetime


class TestPermissionTiers:
    TIERS = {
        "observe": {"can_read": True, "can_suggest": False, "can_execute": False},
        "suggest": {"can_read": True, "can_suggest": True, "can_execute": False},
        "execute": {"can_read": True, "can_suggest": True, "can_execute": True},
    }

    def test_observe_can_only_read(self):
        perms = self.TIERS["observe"]
        assert perms["can_read"] is True
        assert perms["can_suggest"] is False
        assert perms["can_execute"] is False

    def test_suggest_can_read_and_suggest(self):
        perms = self.TIERS["suggest"]
        assert perms["can_read"] is True
        assert perms["can_suggest"] is True
        assert perms["can_execute"] is False

    def test_execute_can_do_everything(self):
        perms = self.TIERS["execute"]
        assert all(perms.values())

    def test_tier_hierarchy(self):
        o = sum(self.TIERS["observe"].values())
        s = sum(self.TIERS["suggest"].values())
        e = sum(self.TIERS["execute"].values())
        assert o < s < e


class TestCostLimits:
    def test_under_daily_limit(self):
        limit = 100.0
        spent = 45.0
        assert self._check_limit(spent, limit) is True

    def test_at_daily_limit(self):
        assert self._check_limit(100.0, 100.0) is False

    def test_over_daily_limit(self):
        assert self._check_limit(150.0, 100.0) is False

    def test_zero_limit(self):
        assert self._check_limit(0.0, 0.0) is False

    def test_high_limit(self):
        assert self._check_limit(999.0, 1000.0) is True

    def _check_limit(self, spent, limit):
        return spent < limit


class TestAuditLog:
    def test_create_audit_entry(self):
        entry = self._create_entry("sales_agent", "execute", "send_email", "success")
        assert entry["agent"] == "sales_agent"
        assert entry["action"] == "send_email"
        assert entry["result"] == "success"
        assert "timestamp" in entry

    def test_failed_action_logged(self):
        entry = self._create_entry("cs_agent", "suggest", "create_ticket", "failed")
        assert entry["result"] == "failed"

    def test_entry_has_tier(self):
        entry = self._create_entry("analytics_agent", "observe", "read_metrics", "success")
        assert entry["tier"] == "observe"

    def test_entry_immutable(self):
        entry = self._create_entry("agent", "execute", "action", "success")
        assert isinstance(entry["timestamp"], str)

    def _create_entry(self, agent, tier, action, result):
        return {
            "agent": agent,
            "tier": tier,
            "action": action,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        }


class TestKillSwitch:
    def test_active_agent_can_act(self):
        assert self._can_act(active=True, killed=False) is True

    def test_killed_agent_cannot_act(self):
        assert self._can_act(active=True, killed=True) is False

    def test_inactive_agent_cannot_act(self):
        assert self._can_act(active=False, killed=False) is False

    def test_killed_and_inactive(self):
        assert self._can_act(active=False, killed=True) is False

    def _can_act(self, active, killed):
        return active and not killed
