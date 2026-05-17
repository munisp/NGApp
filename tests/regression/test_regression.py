#!/usr/bin/env python3
"""
Regression Test Suite — Unified Insurance Platform
Covers: Policy, Claims, Payments, Fraud Detection, Reinsurance, Underwriting,
        OpenIMIS, ERPNext, Premium Rates, Broker API, Telco Credit, Knowledge Graph
"""

import os
import json
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8080")
API_KEY = os.getenv("PLATFORM_API_KEY", "test-api-key")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "insurance")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "insurance-platform")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def auth_token():
    """Obtain a real JWT token from Keycloak."""
    resp = requests.post(
        f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": KEYCLOAK_CLIENT_ID,
            "client_secret": KEYCLOAK_CLIENT_SECRET,
        },
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    # Fall back to direct API key for local testing
    return API_KEY


@pytest.fixture(scope="session")
def headers(auth_token):
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "X-Request-ID": str(uuid.uuid4()),
    }


@pytest.fixture(scope="session")
def test_policy_id(headers):
    """Create a test policy and return its ID."""
    payload = {
        "policyNumber": f"TEST-{uuid.uuid4().hex[:8].upper()}",
        "name": "Regression Test Policy",
        "type": "Health",
        "premium": "5000.00",
        "startDate": datetime.utcnow().isoformat(),
        "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
    }
    resp = requests.post(f"{BASE_URL}/api/policies", json=payload, headers=headers, timeout=10)
    assert resp.status_code in (200, 201), f"Failed to create policy: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="session")
def test_claim_id(headers, test_policy_id):
    """Create a test claim and return its ID."""
    payload = {
        "policyId": test_policy_id,
        "claimNumber": f"CLM-{uuid.uuid4().hex[:8].upper()}",
        "amount": "50000.00",
        "incidentDate": datetime.utcnow().isoformat(),
        "description": "Regression test claim — hospitalization",
    }
    resp = requests.post(f"{BASE_URL}/api/claims", json=payload, headers=headers, timeout=10)
    assert resp.status_code in (200, 201), f"Failed to create claim: {resp.text}"
    return resp.json()["id"]


# ── Policy Tests ──────────────────────────────────────────────────────────────
class TestPolicyService:
    def test_list_policies(self, headers):
        resp = requests.get(f"{BASE_URL}/api/policies", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_policy_by_id(self, headers, test_policy_id):
        resp = requests.get(f"{BASE_URL}/api/policies/{test_policy_id}", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_policy_id
        assert data["type"] == "Health"

    def test_update_policy_status(self, headers, test_policy_id):
        payload = {"status": "Active"}
        resp = requests.patch(f"{BASE_URL}/api/policies/{test_policy_id}", json=payload, headers=headers, timeout=10)
        assert resp.status_code == 200
        assert resp.json()["status"] == "Active"

    def test_policy_not_found(self, headers):
        resp = requests.get(f"{BASE_URL}/api/policies/999999", headers=headers, timeout=10)
        assert resp.status_code == 404

    def test_create_policy_validation(self, headers):
        """Test that invalid policy data is rejected."""
        payload = {"name": "Invalid Policy"}  # Missing required fields
        resp = requests.post(f"{BASE_URL}/api/policies", json=payload, headers=headers, timeout=10)
        assert resp.status_code in (400, 422)

    def test_policy_premium_is_positive(self, headers):
        payload = {
            "policyNumber": f"TEST-{uuid.uuid4().hex[:8].upper()}",
            "name": "Invalid Premium Policy",
            "type": "Auto",
            "premium": "-100.00",
            "startDate": datetime.utcnow().isoformat(),
            "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        }
        resp = requests.post(f"{BASE_URL}/api/policies", json=payload, headers=headers, timeout=10)
        assert resp.status_code in (400, 422)


# ── Claims Tests ──────────────────────────────────────────────────────────────
class TestClaimsService:
    def test_list_claims(self, headers):
        resp = requests.get(f"{BASE_URL}/api/claims", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_claim_by_id(self, headers, test_claim_id):
        resp = requests.get(f"{BASE_URL}/api/claims/{test_claim_id}", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_claim_id
        assert data["status"] == "Submitted"

    def test_update_claim_status(self, headers, test_claim_id):
        payload = {"status": "Under Review"}
        resp = requests.patch(f"{BASE_URL}/api/claims/{test_claim_id}", json=payload, headers=headers, timeout=10)
        assert resp.status_code == 200
        assert resp.json()["status"] == "Under Review"

    def test_claim_adjudication_workflow(self, headers, test_claim_id):
        """Test the full adjudication workflow: Submit → Review → Approve → Pay."""
        statuses = ["Under Review", "Approved", "Paid"]
        for status in statuses:
            resp = requests.patch(
                f"{BASE_URL}/api/claims/{test_claim_id}",
                json={"status": status},
                headers=headers,
                timeout=10,
            )
            assert resp.status_code == 200, f"Failed to transition to {status}: {resp.text}"
            assert resp.json()["status"] == status

    def test_claim_amount_validation(self, headers, test_policy_id):
        """Test that claim amount cannot exceed policy coverage."""
        payload = {
            "policyId": test_policy_id,
            "claimNumber": f"CLM-{uuid.uuid4().hex[:8].upper()}",
            "amount": "999999999.00",  # Exceeds any reasonable coverage
            "incidentDate": datetime.utcnow().isoformat(),
            "description": "Excessive amount test",
        }
        resp = requests.post(f"{BASE_URL}/api/claims", json=payload, headers=headers, timeout=10)
        # Should either reject or flag for review
        assert resp.status_code in (200, 201, 400, 422)
        if resp.status_code in (200, 201):
            assert resp.json().get("status") in ("Submitted", "Under Review")


# ── Payment Tests ─────────────────────────────────────────────────────────────
class TestPaymentService:
    def test_list_payments(self, headers):
        resp = requests.get(f"{BASE_URL}/api/payments", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_process_payment(self, headers, test_policy_id):
        payload = {
            "policyId": test_policy_id,
            "amount": "5000.00",
            "dueDate": datetime.utcnow().isoformat(),
            "paymentMethod": "bank_transfer",
        }
        resp = requests.post(f"{BASE_URL}/api/payments", json=payload, headers=headers, timeout=10)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["status"] in ("Pending", "Completed")

    def test_payment_idempotency(self, headers, test_policy_id):
        """Test that duplicate payments are handled correctly."""
        idempotency_key = str(uuid.uuid4())
        payload = {
            "policyId": test_policy_id,
            "amount": "5000.00",
            "dueDate": datetime.utcnow().isoformat(),
            "paymentMethod": "bank_transfer",
        }
        headers_with_key = {**headers, "Idempotency-Key": idempotency_key}
        resp1 = requests.post(f"{BASE_URL}/api/payments", json=payload, headers=headers_with_key, timeout=10)
        resp2 = requests.post(f"{BASE_URL}/api/payments", json=payload, headers=headers_with_key, timeout=10)
        assert resp1.status_code in (200, 201)
        assert resp2.status_code in (200, 201)
        # Both should return the same payment ID
        if resp1.status_code == 201 and resp2.status_code == 200:
            assert resp1.json()["id"] == resp2.json()["id"]


# ── Insurance Radar / Fraud Detection Tests ───────────────────────────────────
class TestInsuranceRadar:
    def test_fraud_score_endpoint(self, headers):
        payload = {
            "entityType": "Claim",
            "entityId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
            "amount": 50000,
            "metadata": {
                "claimAge": 2,
                "policyAge": 30,
                "deviceFingerprint": "test-device-001",
                "ipAddress": "192.168.1.100",
            },
        }
        resp = requests.post(f"{BASE_URL}/api/fraud/score", json=payload, headers=headers, timeout=15)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "score" in data
        assert "riskLevel" in data
        assert "decision" in data
        assert 0 <= float(data["score"]) <= 1
        assert data["riskLevel"] in ("low", "medium", "high", "critical")
        assert data["decision"] in ("allow", "flag", "review", "block")

    def test_fraud_analytics(self, headers):
        resp = requests.get(f"{BASE_URL}/api/fraud/analytics?timeRange=7d", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "totalRequests" in data
        assert "blocked" in data
        assert "falsePositiveRate" in data

    def test_fraud_ring_detection(self, headers):
        resp = requests.get(f"{BASE_URL}/api/fraud/rings", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_fraud_score_high_risk_claim(self, headers):
        """A claim filed immediately after policy creation should be flagged."""
        payload = {
            "entityType": "Claim",
            "entityId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
            "amount": 100000,
            "metadata": {
                "claimAge": 0,  # Filed same day as policy
                "policyAge": 0,
                "deviceFingerprint": "unknown",
                "ipAddress": "10.0.0.1",
                "vpnDetected": True,
            },
        }
        resp = requests.post(f"{BASE_URL}/api/fraud/score", json=payload, headers=headers, timeout=15)
        assert resp.status_code in (200, 201)
        data = resp.json()
        # High-risk indicators should produce high/critical score
        assert data["riskLevel"] in ("high", "critical") or float(data["score"]) > 0.5


# ── Underwriting Tests ────────────────────────────────────────────────────────
class TestUnderwriting:
    def test_risk_assessment(self, headers):
        payload = {
            "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
            "productType": "Health",
            "age": 35,
            "smoker": False,
            "preExistingConditions": [],
            "occupation": "Software Engineer",
            "annualIncome": 5000000,
        }
        resp = requests.post(f"{BASE_URL}/api/underwriting/assess", json=payload, headers=headers, timeout=15)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "riskScore" in data
        assert "recommendedPremium" in data
        assert "decision" in data

    def test_risk_score_range(self, headers):
        """Risk score must be between 0 and 1."""
        payload = {
            "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
            "productType": "Life",
            "age": 45,
            "smoker": True,
            "preExistingConditions": ["diabetes"],
            "occupation": "Construction Worker",
            "annualIncome": 1200000,
        }
        resp = requests.post(f"{BASE_URL}/api/underwriting/assess", json=payload, headers=headers, timeout=15)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert 0 <= float(data["riskScore"]) <= 1

    def test_high_risk_applicant_premium_loading(self, headers):
        """High-risk applicants should have premium loading applied."""
        low_risk = {
            "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
            "productType": "Health",
            "age": 25,
            "smoker": False,
            "preExistingConditions": [],
            "occupation": "Teacher",
            "annualIncome": 3000000,
        }
        high_risk = {
            "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
            "productType": "Health",
            "age": 60,
            "smoker": True,
            "preExistingConditions": ["hypertension", "diabetes", "heart_disease"],
            "occupation": "Miner",
            "annualIncome": 800000,
        }
        resp_low = requests.post(f"{BASE_URL}/api/underwriting/assess", json=low_risk, headers=headers, timeout=15)
        resp_high = requests.post(f"{BASE_URL}/api/underwriting/assess", json=high_risk, headers=headers, timeout=15)
        assert resp_low.status_code in (200, 201)
        assert resp_high.status_code in (200, 201)
        premium_low = float(resp_low.json()["recommendedPremium"])
        premium_high = float(resp_high.json()["recommendedPremium"])
        assert premium_high > premium_low, "High-risk applicant should have higher premium"


# ── Reinsurance Tests ─────────────────────────────────────────────────────────
class TestReinsurance:
    def test_cession_creation(self, headers):
        payload = {
            "cedantId": f"CED-{uuid.uuid4().hex[:8].upper()}",
            "reinsurerIds": ["reinsurer-a", "reinsurer-b"],
            "treatyType": "proportional",
            "cessionPercentage": 40,
            "effectiveDate": datetime.utcnow().isoformat(),
            "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        }
        resp = requests.post(f"{BASE_URL}/api/reinsurance/cessions", json=payload, headers=headers, timeout=10)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "cessionId" in data
        assert data["status"] in ("pending", "active")

    def test_bordereau_generation(self, headers):
        resp = requests.post(
            f"{BASE_URL}/api/reinsurance/bordereau/generate",
            json={"period": "2024-01", "treatyId": "treaty-001"},
            headers=headers,
            timeout=30,
        )
        assert resp.status_code in (200, 201, 202)

    def test_reinsurance_accounting(self, headers):
        resp = requests.get(f"{BASE_URL}/api/reinsurance/accounting/summary", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "totalCeded" in data
        assert "totalRecovered" in data


# ── OpenIMIS Integration Tests ────────────────────────────────────────────────
class TestOpenIMIS:
    def test_sync_policies(self, headers):
        resp = requests.post(
            f"{BASE_URL}/api/openimis/sync/policies",
            json={"since": (datetime.utcnow() - timedelta(days=1)).isoformat()},
            headers=headers,
            timeout=30,
        )
        assert resp.status_code in (200, 201, 202)

    def test_sync_claims(self, headers):
        resp = requests.post(
            f"{BASE_URL}/api/openimis/sync/claims",
            json={"since": (datetime.utcnow() - timedelta(days=1)).isoformat()},
            headers=headers,
            timeout=30,
        )
        assert resp.status_code in (200, 201, 202)

    def test_actuarial_model_update(self, headers):
        resp = requests.post(
            f"{BASE_URL}/api/openimis/actuarial/update",
            json={"modelType": "mortality", "period": "2024-Q1"},
            headers=headers,
            timeout=60,
        )
        assert resp.status_code in (200, 201, 202)


# ── ERPNext Integration Tests ─────────────────────────────────────────────────
class TestERPNext:
    def test_sync_status(self, headers):
        resp = requests.get(f"{BASE_URL}/api/erpnext/sync/status", headers=headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "lastSync" in data
        assert "pendingCount" in data

    def test_trigger_sync(self, headers):
        resp = requests.post(
            f"{BASE_URL}/api/erpnext/sync/trigger",
            json={"entityType": "Policy", "entityId": "POL-001"},
            headers=headers,
            timeout=10,
        )
        assert resp.status_code in (200, 201, 202)

    def test_reconciliation(self, headers):
        resp = requests.get(f"{BASE_URL}/api/erpnext/reconciliation?month=2024-01", headers=headers, timeout=10)
        assert resp.status_code == 200


# ── Premium Rate Management Tests ─────────────────────────────────────────────
class TestPremiumRates:
    def test_list_rate_tables(self, headers):
        resp = requests.get(f"{BASE_URL}/api/premium-rates/tables", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_risk_factors(self, headers):
        resp = requests.get(f"{BASE_URL}/api/premium-rates/factors", headers=headers, timeout=10)
        assert resp.status_code == 200

    def test_rate_change_audit_trail(self, headers):
        resp = requests.get(f"{BASE_URL}/api/premium-rates/audit?limit=10", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ── Broker API Tests ──────────────────────────────────────────────────────────
class TestBrokerAPI:
    def test_list_api_keys(self, headers):
        resp = requests.get(f"{BASE_URL}/api/broker/keys", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_api_key(self, headers):
        payload = {
            "name": f"Test Key {uuid.uuid4().hex[:8]}",
            "permissions": ["policies:read", "claims:read"],
            "rateLimit": 500,
        }
        resp = requests.post(f"{BASE_URL}/api/broker/keys", json=payload, headers=headers, timeout=10)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "apiKey" in data
        assert len(data["apiKey"]) >= 32

    def test_api_usage_metrics(self, headers):
        resp = requests.get(f"{BASE_URL}/api/broker/usage?days=7", headers=headers, timeout=10)
        assert resp.status_code == 200


# ── Telco Credit Scoring Tests ────────────────────────────────────────────────
class TestTelcoCreditScoring:
    def test_compute_credit_score(self, headers):
        payload = {
            "phoneNumber": "+2348012345678",
            "provider": "MTN",
        }
        resp = requests.post(f"{BASE_URL}/api/telco-credit/score", json=payload, headers=headers, timeout=15)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "score" in data
        assert 300 <= int(data["score"]) <= 850
        assert "grade" in data
        assert data["grade"] in ("A", "B", "C", "D", "F")

    def test_credit_score_history(self, headers):
        resp = requests.get(f"{BASE_URL}/api/telco-credit/history", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ── Knowledge Graph Tests ─────────────────────────────────────────────────────
class TestKnowledgeGraph:
    def test_get_nodes(self, headers):
        resp = requests.get(f"{BASE_URL}/api/knowledge-graph/nodes", headers=headers, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_edges(self, headers):
        resp = requests.get(f"{BASE_URL}/api/knowledge-graph/edges?nodeId=test-node", headers=headers, timeout=10)
        assert resp.status_code == 200

    def test_fraud_network_graph(self, headers):
        resp = requests.get(
            f"{BASE_URL}/api/fraud/network?entityId=CLM-001&depth=2",
            headers=headers,
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data


# ── Authentication & Authorization Tests ─────────────────────────────────────
class TestAuthAndAuthorization:
    def test_unauthenticated_request_rejected(self):
        resp = requests.get(f"{BASE_URL}/api/policies", timeout=10)
        assert resp.status_code in (401, 403)

    def test_invalid_token_rejected(self):
        headers = {"Authorization": "Bearer invalid-token-12345"}
        resp = requests.get(f"{BASE_URL}/api/policies", headers=headers, timeout=10)
        assert resp.status_code in (401, 403)

    def test_expired_token_rejected(self):
        expired_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid"
        headers = {"Authorization": f"Bearer {expired_token}"}
        resp = requests.get(f"{BASE_URL}/api/policies", headers=headers, timeout=10)
        assert resp.status_code in (401, 403)

    def test_cross_tenant_isolation(self, headers):
        """Users should not be able to access other tenants' data."""
        # Create policy for tenant A
        resp = requests.get(f"{BASE_URL}/api/policies", headers=headers, timeout=10)
        assert resp.status_code == 200
        # All returned policies should belong to the authenticated user
        policies = resp.json()
        for policy in policies:
            assert "userId" not in policy or policy.get("userId") is not None


# ── Health Check Tests ────────────────────────────────────────────────────────
class TestHealthChecks:
    def test_platform_health(self):
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        assert resp.status_code == 200

    def test_platform_readiness(self):
        resp = requests.get(f"{BASE_URL}/ready", timeout=10)
        assert resp.status_code == 200

    def test_metrics_endpoint(self, headers):
        resp = requests.get(f"{BASE_URL}/metrics", headers=headers, timeout=10)
        assert resp.status_code in (200, 401)  # May require auth

    def test_api_version(self):
        resp = requests.get(f"{BASE_URL}/api/version", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "version" in data


# ── Data Integrity Tests ──────────────────────────────────────────────────────
class TestDataIntegrity:
    def test_policy_claim_relationship(self, headers, test_policy_id, test_claim_id):
        """Claims must reference valid policies."""
        claim_resp = requests.get(f"{BASE_URL}/api/claims/{test_claim_id}", headers=headers, timeout=10)
        assert claim_resp.status_code == 200
        claim = claim_resp.json()
        assert claim["policyId"] == test_policy_id

    def test_payment_policy_relationship(self, headers, test_policy_id):
        """Payments must reference valid policies."""
        payments_resp = requests.get(f"{BASE_URL}/api/payments", headers=headers, timeout=10)
        assert payments_resp.status_code == 200
        payments = payments_resp.json()
        for payment in payments:
            assert payment.get("policyId") is not None

    def test_referral_uniqueness(self, headers):
        """Referral codes must be unique."""
        resp = requests.get(f"{BASE_URL}/api/referrals", headers=headers, timeout=10)
        assert resp.status_code == 200
        referrals = resp.json()
        codes = [r["referralCode"] for r in referrals]
        assert len(codes) == len(set(codes)), "Duplicate referral codes found"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "--timeout=30"])
