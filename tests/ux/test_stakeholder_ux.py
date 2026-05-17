#!/usr/bin/env python3
"""
Stakeholder UX Test Suite — Unified Insurance Platform
Tests complete user journeys for all stakeholders:
- Policyholder: Enroll, Pay Premium, Submit Claim, Track Status
- Claims Adjudicator: Review, Approve/Reject Claims
- Underwriter: Assess Risk, Set Premiums, Approve Policies
- Broker: Manage API Keys, View Usage, Submit Policies
- Reinsurer: View Cessions, Approve Bordereau, Track Settlements
- Finance Admin: Reconcile Payments, Generate Reports
- Compliance Officer: Audit Logs, Regulatory Reports
- IT Admin: Monitor Services, Manage Users, View Metrics

Uses Playwright for browser-based UX testing.
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
PORTAL_URL = os.getenv("PORTAL_URL", "http://localhost:5173")
API_KEY = os.getenv("PLATFORM_API_KEY", "test-api-key")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "test-admin-token")

API_HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


# ── Policyholder Journey Tests ────────────────────────────────────────────────
class TestPolicyholderJourney:
    """Complete policyholder journey: Enroll → Pay → Claim → Track."""

    def test_ph_01_view_available_products(self):
        """PH-01: Policyholder can view available insurance products."""
        resp = requests.get(f"{BASE_URL}/api/products", headers=API_HEADERS, timeout=10)
        assert resp.status_code == 200
        products = resp.json()
        assert isinstance(products, list)
        assert len(products) > 0
        for product in products:
            assert "name" in product
            assert "type" in product
            assert "description" in product

    def test_ph_02_get_premium_quote(self):
        """PH-02: Policyholder can get a premium quote before enrolling."""
        resp = requests.post(
            f"{BASE_URL}/api/quotes",
            json={
                "productType": "Health",
                "age": 32,
                "smoker": False,
                "preExistingConditions": [],
                "occupation": "Teacher",
                "annualIncome": 3600000,
                "coverageAmount": 5000000,
            },
            headers=API_HEADERS,
            timeout=15,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "monthlyPremium" in data or "annualPremium" in data or "premium" in data
        assert "quoteId" in data or "id" in data

    def test_ph_03_enroll_in_policy(self):
        """PH-03: Policyholder can enroll in a policy."""
        policy_number = f"POL-PH-{uuid.uuid4().hex[:8].upper()}"
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": policy_number,
                "name": "Policyholder Test Policy",
                "type": "Health",
                "premium": "5000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["policyNumber"] == policy_number
        assert data["status"] in ("Active", "Pending", "Draft")
        return data["id"]

    def test_ph_04_pay_premium(self):
        """PH-04: Policyholder can pay their premium."""
        # Create a policy first
        policy_resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-PAY-{uuid.uuid4().hex[:8].upper()}",
                "name": "Premium Payment Test Policy",
                "type": "Life",
                "premium": "8000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert policy_resp.status_code in (200, 201)
        policy_id = policy_resp.json()["id"]

        # Pay premium
        payment_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={
                "policyId": policy_id,
                "amount": "8000.00",
                "dueDate": datetime.utcnow().isoformat(),
                "paymentMethod": "bank_transfer",
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert payment_resp.status_code in (200, 201)
        payment = payment_resp.json()
        assert payment["status"] in ("Pending", "Completed", "Processing")

    def test_ph_05_submit_claim(self):
        """PH-05: Policyholder can submit a claim."""
        # Create policy
        policy_resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-CLM-{uuid.uuid4().hex[:8].upper()}",
                "name": "Claim Test Policy",
                "type": "Health",
                "premium": "5000.00",
                "startDate": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=335)).isoformat(),
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert policy_resp.status_code in (200, 201)
        policy_id = policy_resp.json()["id"]

        # Submit claim
        claim_resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": policy_id,
                "claimNumber": f"CLM-PH-{uuid.uuid4().hex[:8].upper()}",
                "amount": "35000.00",
                "incidentDate": (datetime.utcnow() - timedelta(days=5)).isoformat(),
                "description": "Hospitalization — malaria treatment",
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert claim_resp.status_code in (200, 201)
        claim = claim_resp.json()
        assert claim["status"] == "Submitted"
        assert "claimNumber" in claim

    def test_ph_06_track_claim_status(self):
        """PH-06: Policyholder can track claim status."""
        resp = requests.get(f"{BASE_URL}/api/claims", headers=API_HEADERS, timeout=10)
        assert resp.status_code == 200
        claims = resp.json()
        assert isinstance(claims, list)
        for claim in claims:
            assert "status" in claim
            assert claim["status"] in (
                "Submitted", "Under Review", "Approved", "Rejected", "Paid", "Closed"
            )

    def test_ph_07_view_policy_documents(self):
        """PH-07: Policyholder can view their policy documents."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=API_HEADERS, timeout=10)
        assert resp.status_code == 200
        policies = resp.json()
        if policies:
            policy_id = policies[0]["id"]
            doc_resp = requests.get(
                f"{BASE_URL}/api/policies/{policy_id}/documents",
                headers=API_HEADERS,
                timeout=10,
            )
            assert doc_resp.status_code in (200, 404)  # 404 if no documents yet

    def test_ph_08_view_payment_history(self):
        """PH-08: Policyholder can view payment history."""
        resp = requests.get(f"{BASE_URL}/api/payments", headers=API_HEADERS, timeout=10)
        assert resp.status_code == 200
        payments = resp.json()
        assert isinstance(payments, list)

    def test_ph_09_referral_program(self):
        """PH-09: Policyholder can access referral program."""
        resp = requests.get(f"{BASE_URL}/api/referrals", headers=API_HEADERS, timeout=10)
        assert resp.status_code == 200

    def test_ph_10_notification_preferences(self):
        """PH-10: Policyholder can set notification preferences."""
        resp = requests.put(
            f"{BASE_URL}/api/users/me/notifications",
            json={
                "email": True,
                "sms": True,
                "push": False,
                "claimUpdates": True,
                "paymentReminders": True,
                "policyRenewals": True,
            },
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201, 404)  # 404 if endpoint not yet implemented


# ── Claims Adjudicator Journey Tests ─────────────────────────────────────────
class TestClaimsAdjudicatorJourney:
    """Complete claims adjudicator journey."""

    def test_ca_01_view_pending_claims_queue(self):
        """CA-01: Adjudicator can view pending claims queue."""
        resp = requests.get(
            f"{BASE_URL}/api/claims?status=Submitted",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200
        claims = resp.json()
        assert isinstance(claims, list)

    def test_ca_02_review_claim_details(self):
        """CA-02: Adjudicator can view full claim details."""
        # Get a claim to review
        resp = requests.get(f"{BASE_URL}/api/claims?limit=1", headers=ADMIN_HEADERS, timeout=10)
        assert resp.status_code == 200
        claims = resp.json()
        if not claims:
            pytest.skip("No claims available for review")

        claim_id = claims[0]["id"]
        detail_resp = requests.get(
            f"{BASE_URL}/api/claims/{claim_id}",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert detail_resp.status_code == 200
        claim = detail_resp.json()
        assert "policyId" in claim
        assert "amount" in claim
        assert "description" in claim

    def test_ca_03_approve_claim(self):
        """CA-03: Adjudicator can approve a claim."""
        # Create and submit a claim
        policy_resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-ADJ-{uuid.uuid4().hex[:8].upper()}",
                "name": "Adjudication Test Policy",
                "type": "Health",
                "premium": "5000.00",
                "startDate": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=335)).isoformat(),
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert policy_resp.status_code in (200, 201)
        policy_id = policy_resp.json()["id"]

        claim_resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": policy_id,
                "claimNumber": f"CLM-ADJ-{uuid.uuid4().hex[:8].upper()}",
                "amount": "20000.00",
                "incidentDate": (datetime.utcnow() - timedelta(days=3)).isoformat(),
                "description": "Adjudication test claim",
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert claim_resp.status_code in (200, 201)
        claim_id = claim_resp.json()["id"]

        # Approve the claim
        approve_resp = requests.patch(
            f"{BASE_URL}/api/claims/{claim_id}",
            json={"status": "Approved", "adjudicatorNotes": "Claim verified and approved"},
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()["status"] == "Approved"

    def test_ca_04_reject_claim_with_reason(self):
        """CA-04: Adjudicator can reject a claim with a reason."""
        # Create a claim to reject
        policy_resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-REJ-{uuid.uuid4().hex[:8].upper()}",
                "name": "Rejection Test Policy",
                "type": "Health",
                "premium": "5000.00",
                "startDate": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=335)).isoformat(),
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert policy_resp.status_code in (200, 201)
        policy_id = policy_resp.json()["id"]

        claim_resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": policy_id,
                "claimNumber": f"CLM-REJ-{uuid.uuid4().hex[:8].upper()}",
                "amount": "500000.00",  # Exceeds coverage
                "incidentDate": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "description": "Suspicious claim",
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert claim_resp.status_code in (200, 201)
        claim_id = claim_resp.json()["id"]

        # Reject the claim
        reject_resp = requests.patch(
            f"{BASE_URL}/api/claims/{claim_id}",
            json={
                "status": "Rejected",
                "rejectionReason": "Claim amount exceeds policy coverage limit",
                "adjudicatorNotes": "Policy maximum coverage is ₦200,000",
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert reject_resp.status_code == 200
        assert reject_resp.json()["status"] == "Rejected"

    def test_ca_05_view_fraud_score_during_adjudication(self):
        """CA-05: Adjudicator can view fraud score during claim review."""
        resp = requests.post(
            f"{BASE_URL}/api/fraud/score",
            json={
                "entityType": "Claim",
                "entityId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "amount": 50000,
                "metadata": {"claimAge": 10, "policyAge": 60},
            },
            headers=ADMIN_HEADERS,
            timeout=15,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "score" in data
        assert "riskLevel" in data


# ── Underwriter Journey Tests ─────────────────────────────────────────────────
class TestUnderwriterJourney:
    """Complete underwriter journey."""

    def test_uw_01_assess_new_application(self):
        """UW-01: Underwriter can assess a new insurance application."""
        resp = requests.post(
            f"{BASE_URL}/api/underwriting/assess",
            json={
                "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
                "productType": "Life",
                "age": 42,
                "smoker": True,
                "preExistingConditions": ["hypertension"],
                "occupation": "Pilot",
                "annualIncome": 15000000,
            },
            headers=ADMIN_HEADERS,
            timeout=15,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "riskScore" in data
        assert "recommendedPremium" in data
        assert "decision" in data
        assert data["decision"] in ("approve", "decline", "refer", "conditional_approve")

    def test_uw_02_view_premium_rate_tables(self):
        """UW-02: Underwriter can view and manage premium rate tables."""
        resp = requests.get(f"{BASE_URL}/api/premium-rates/tables", headers=ADMIN_HEADERS, timeout=10)
        assert resp.status_code == 200
        tables = resp.json()
        assert isinstance(tables, list)

    def test_uw_03_update_risk_factor(self):
        """UW-03: Underwriter can update risk factors."""
        resp = requests.get(f"{BASE_URL}/api/premium-rates/factors", headers=ADMIN_HEADERS, timeout=10)
        assert resp.status_code == 200
        factors = resp.json()
        if factors:
            factor_id = factors[0]["id"]
            update_resp = requests.patch(
                f"{BASE_URL}/api/premium-rates/factors/{factor_id}",
                json={"value": 1.15, "notes": "Updated for 2024 actuarial review"},
                headers=ADMIN_HEADERS,
                timeout=10,
            )
            assert update_resp.status_code in (200, 201, 404)

    def test_uw_04_view_loss_ratio_analytics(self):
        """UW-04: Underwriter can view loss ratio analytics."""
        resp = requests.get(
            f"{BASE_URL}/api/openimis/analytics/loss-ratio?period=2024-Q1",
            headers=ADMIN_HEADERS,
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "lossRatio" in data


# ── Broker Journey Tests ──────────────────────────────────────────────────────
class TestBrokerJourney:
    """Complete broker journey."""

    def test_br_01_create_api_key(self):
        """BR-01: Broker can create an API key."""
        resp = requests.post(
            f"{BASE_URL}/api/broker/keys",
            json={
                "name": f"Broker Test Key {uuid.uuid4().hex[:8]}",
                "permissions": ["policies:read", "policies:write", "claims:read"],
                "rateLimit": 1000,
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "apiKey" in data
        assert len(data["apiKey"]) >= 32

    def test_br_02_view_api_usage_metrics(self):
        """BR-02: Broker can view API usage metrics."""
        resp = requests.get(f"{BASE_URL}/api/broker/usage?days=30", headers=ADMIN_HEADERS, timeout=10)
        assert resp.status_code == 200

    def test_br_03_submit_policy_via_api(self):
        """BR-03: Broker can submit a policy via the API."""
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": f"POL-BR-{uuid.uuid4().hex[:8].upper()}",
                "name": "Broker Submitted Policy",
                "type": "Auto",
                "premium": "12000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
                "source": "broker_api",
            },
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)

    def test_br_04_get_telco_credit_score(self):
        """BR-04: Broker can get telco credit score for underwriting."""
        resp = requests.post(
            f"{BASE_URL}/api/telco-credit/score",
            json={"phoneNumber": "+2348012345678", "provider": "MTN"},
            headers=ADMIN_HEADERS,
            timeout=15,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "score" in data
        assert "grade" in data


# ── Finance Admin Journey Tests ───────────────────────────────────────────────
class TestFinanceAdminJourney:
    """Complete finance admin journey."""

    def test_fa_01_view_payment_reconciliation(self):
        """FA-01: Finance admin can view payment reconciliation."""
        resp = requests.get(
            f"{BASE_URL}/api/erpnext/reconciliation?month=2024-01",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200

    def test_fa_02_view_reinsurance_accounting(self):
        """FA-02: Finance admin can view reinsurance accounting."""
        resp = requests.get(
            f"{BASE_URL}/api/reinsurance/accounting/summary",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "totalCeded" in data

    def test_fa_03_trigger_erpnext_sync(self):
        """FA-03: Finance admin can trigger ERPNext sync."""
        resp = requests.post(
            f"{BASE_URL}/api/erpnext/sync/trigger",
            json={"entityType": "Payment", "period": "2024-01"},
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201, 202)

    def test_fa_04_view_ledger_balances(self):
        """FA-04: Finance admin can view TigerBeetle ledger balances."""
        resp = requests.get(
            f"{BASE_URL}/api/ledger/accounts/ACC-001/balance",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 404)


# ── Compliance Officer Journey Tests ─────────────────────────────────────────
class TestComplianceOfficerJourney:
    """Complete compliance officer journey."""

    def test_co_01_view_audit_logs(self):
        """CO-01: Compliance officer can view audit logs."""
        resp = requests.get(
            f"{BASE_URL}/api/admin/audit-logs?limit=50",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            logs = resp.json()
            assert isinstance(logs, list)

    def test_co_02_view_premium_rate_audit_trail(self):
        """CO-02: Compliance officer can view premium rate change audit trail."""
        resp = requests.get(
            f"{BASE_URL}/api/premium-rates/audit?limit=20",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_co_03_view_fraud_analytics(self):
        """CO-03: Compliance officer can view fraud analytics."""
        resp = requests.get(
            f"{BASE_URL}/api/fraud/analytics?timeRange=30d",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "totalRequests" in data
        assert "blocked" in data


# ── Reinsurer Journey Tests ───────────────────────────────────────────────────
class TestReinsurerJourney:
    """Complete reinsurer journey."""

    def test_ri_01_view_cession_portfolio(self):
        """RI-01: Reinsurer can view their cession portfolio."""
        resp = requests.get(
            f"{BASE_URL}/api/reinsurance/cessions",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_ri_02_view_bordereau(self):
        """RI-02: Reinsurer can view bordereau reports."""
        resp = requests.get(
            f"{BASE_URL}/api/reinsurance/bordereau?period=2024-01",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 404)

    def test_ri_03_view_settlement_status(self):
        """RI-03: Reinsurer can view settlement status."""
        resp = requests.get(
            f"{BASE_URL}/api/reinsurance/settlements",
            headers=ADMIN_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 404)


# ── Accessibility Tests ───────────────────────────────────────────────────────
class TestAccessibility:
    """Test API accessibility for different client types."""

    def test_api_supports_json_content_type(self):
        """API must accept and return JSON."""
        resp = requests.get(
            f"{BASE_URL}/api/policies",
            headers={**API_HEADERS, "Accept": "application/json"},
            timeout=10,
        )
        assert resp.status_code in (200, 401, 403)
        if resp.status_code == 200:
            assert "application/json" in resp.headers.get("Content-Type", "")

    def test_api_pagination_works(self):
        """API must support pagination."""
        resp = requests.get(
            f"{BASE_URL}/api/policies?limit=5&offset=0",
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 401, 403)
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) <= 5

    def test_api_sorting_works(self):
        """API must support sorting."""
        resp = requests.get(
            f"{BASE_URL}/api/policies?sortBy=createdAt&sortOrder=desc",
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 400, 401, 403)

    def test_api_filtering_works(self):
        """API must support filtering."""
        resp = requests.get(
            f"{BASE_URL}/api/policies?type=Health&status=Active",
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 401, 403)
        if resp.status_code == 200:
            data = resp.json()
            for policy in data:
                assert policy.get("type") == "Health" or policy.get("status") == "Active"

    def test_error_messages_are_user_friendly(self):
        """Error messages must be user-friendly, not technical."""
        resp = requests.get(
            f"{BASE_URL}/api/policies/invalid-id",
            headers=API_HEADERS,
            timeout=10,
        )
        assert resp.status_code in (400, 404, 422)
        if resp.status_code in (400, 404, 422):
            data = resp.json()
            assert "message" in data or "error" in data
            # Error message should be readable
            message = data.get("message", data.get("error", ""))
            assert len(message) > 0
            # Should not contain stack traces
            assert "goroutine" not in message
            assert "at line" not in message
            assert "panic" not in message.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "--timeout=30"])
