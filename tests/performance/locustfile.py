#!/usr/bin/env python3
"""
Performance Test Suite — Unified Insurance Platform
Uses Locust for load, stress, spike, and soak testing.

Stakeholder SLAs:
- Policy API: p99 < 500ms, p95 < 200ms
- Claims API: p99 < 800ms, p95 < 300ms
- Fraud Score: p99 < 2000ms, p95 < 1000ms
- Payment API: p99 < 1000ms, p95 < 400ms
- Underwriting: p99 < 3000ms, p95 < 1500ms

Run:
  locust -f locustfile.py --host=http://localhost:8080 --users=100 --spawn-rate=10 --run-time=5m
  locust -f locustfile.py --host=http://localhost:8080 --headless --users=500 --spawn-rate=50 --run-time=10m
"""

import os
import json
import uuid
import random
from datetime import datetime, timedelta
from locust import HttpUser, task, between, events, constant_pacing
from locust.runners import MasterRunner, WorkerRunner


# ── Authentication ────────────────────────────────────────────────────────────
AUTH_TOKEN = os.getenv("PLATFORM_API_KEY", "test-api-key")
AUTH_HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json",
}

# ── Test Data ─────────────────────────────────────────────────────────────────
POLICY_TYPES = ["Health", "Life", "Auto", "Property", "Travel"]
PAYMENT_METHODS = ["bank_transfer", "card", "mobile_money", "crypto"]
OCCUPATIONS = ["Engineer", "Teacher", "Doctor", "Farmer", "Trader", "Driver"]
CLAIM_DESCRIPTIONS = [
    "Hospitalization due to malaria",
    "Road traffic accident",
    "Property damage from flooding",
    "Surgical procedure",
    "Emergency medical evacuation",
]


# ── Base User ─────────────────────────────────────────────────────────────────
class InsurancePlatformUser(HttpUser):
    """Standard insurance platform user — mix of all operations."""
    wait_time = between(1, 3)
    weight = 60  # 60% of virtual users

    def on_start(self):
        """Set up auth headers."""
        self.client.headers.update(AUTH_HEADERS)
        # Create a test policy for this user session
        self._policy_id = self._create_policy()
        self._claim_ids = []

    def _create_policy(self) -> int:
        """Create a policy and return its ID."""
        resp = self.client.post(
            "/api/policies",
            json={
                "policyNumber": f"POL-{uuid.uuid4().hex[:8].upper()}",
                "name": f"Load Test Policy {uuid.uuid4().hex[:6]}",
                "type": random.choice(POLICY_TYPES),
                "premium": str(random.randint(1000, 50000)),
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            name="/api/policies [POST]",
        )
        if resp.status_code in (200, 201):
            return resp.json().get("id", 1)
        return 1

    @task(10)
    def list_policies(self):
        """List policies — most common read operation."""
        self.client.get("/api/policies", name="/api/policies [GET]")

    @task(5)
    def get_policy(self):
        """Get a specific policy."""
        self.client.get(
            f"/api/policies/{self._policy_id}",
            name="/api/policies/:id [GET]",
        )

    @task(3)
    def list_claims(self):
        """List claims."""
        self.client.get("/api/claims", name="/api/claims [GET]")

    @task(2)
    def submit_claim(self):
        """Submit a new claim."""
        resp = self.client.post(
            "/api/claims",
            json={
                "policyId": self._policy_id,
                "claimNumber": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "amount": str(random.randint(5000, 100000)),
                "incidentDate": (datetime.utcnow() - timedelta(days=random.randint(1, 30))).isoformat(),
                "description": random.choice(CLAIM_DESCRIPTIONS),
            },
            name="/api/claims [POST]",
        )
        if resp.status_code in (200, 201):
            self._claim_ids.append(resp.json().get("id"))

    @task(2)
    def get_claim(self):
        """Get a specific claim."""
        if self._claim_ids:
            claim_id = random.choice(self._claim_ids)
            self.client.get(
                f"/api/claims/{claim_id}",
                name="/api/claims/:id [GET]",
            )

    @task(1)
    def list_payments(self):
        """List payments."""
        self.client.get("/api/payments", name="/api/payments [GET]")

    @task(1)
    def process_payment(self):
        """Process a premium payment."""
        self.client.post(
            "/api/payments",
            json={
                "policyId": self._policy_id,
                "amount": str(random.randint(1000, 10000)),
                "dueDate": datetime.utcnow().isoformat(),
                "paymentMethod": random.choice(PAYMENT_METHODS),
            },
            name="/api/payments [POST]",
        )

    @task(1)
    def check_fraud_score(self):
        """Check fraud score for a claim."""
        self.client.post(
            "/api/fraud/score",
            json={
                "entityType": "Claim",
                "entityId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "amount": random.randint(5000, 500000),
                "metadata": {
                    "claimAge": random.randint(0, 365),
                    "policyAge": random.randint(0, 1000),
                    "deviceFingerprint": f"device-{uuid.uuid4().hex[:8]}",
                    "ipAddress": f"192.168.{random.randint(1, 254)}.{random.randint(1, 254)}",
                },
            },
            name="/api/fraud/score [POST]",
        )


# ── Underwriter User ──────────────────────────────────────────────────────────
class UnderwriterUser(HttpUser):
    """Underwriter — heavy on risk assessment and premium calculations."""
    wait_time = between(2, 5)
    weight = 20  # 20% of virtual users

    def on_start(self):
        self.client.headers.update(AUTH_HEADERS)

    @task(5)
    def assess_risk(self):
        """Perform risk assessment."""
        self.client.post(
            "/api/underwriting/assess",
            json={
                "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
                "productType": random.choice(POLICY_TYPES),
                "age": random.randint(18, 70),
                "smoker": random.choice([True, False]),
                "preExistingConditions": random.sample(
                    ["diabetes", "hypertension", "asthma", "heart_disease"], k=random.randint(0, 2)
                ),
                "occupation": random.choice(OCCUPATIONS),
                "annualIncome": random.randint(500000, 20000000),
            },
            name="/api/underwriting/assess [POST]",
        )

    @task(3)
    def get_premium_rates(self):
        """Get premium rate tables."""
        self.client.get("/api/premium-rates/tables", name="/api/premium-rates/tables [GET]")

    @task(2)
    def get_risk_factors(self):
        """Get risk factor configurations."""
        self.client.get("/api/premium-rates/factors", name="/api/premium-rates/factors [GET]")

    @task(1)
    def get_fraud_analytics(self):
        """Get fraud analytics dashboard."""
        self.client.get(
            "/api/fraud/analytics?timeRange=7d",
            name="/api/fraud/analytics [GET]",
        )


# ── Broker API User ───────────────────────────────────────────────────────────
class BrokerAPIUser(HttpUser):
    """Broker API user — API key management and usage metrics."""
    wait_time = between(1, 2)
    weight = 10  # 10% of virtual users

    def on_start(self):
        self.client.headers.update(AUTH_HEADERS)

    @task(5)
    def list_api_keys(self):
        """List broker API keys."""
        self.client.get("/api/broker/keys", name="/api/broker/keys [GET]")

    @task(3)
    def get_api_usage(self):
        """Get API usage metrics."""
        self.client.get("/api/broker/usage?days=7", name="/api/broker/usage [GET]")

    @task(2)
    def list_policies_via_broker(self):
        """List policies via broker API."""
        self.client.get("/api/policies?limit=50", name="/api/policies [GET broker]")

    @task(1)
    def get_telco_credit_score(self):
        """Get telco credit score."""
        phone_numbers = ["+2348012345678", "+2349087654321", "+2347011223344"]
        self.client.post(
            "/api/telco-credit/score",
            json={
                "phoneNumber": random.choice(phone_numbers),
                "provider": random.choice(["MTN", "Airtel", "Glo", "9mobile"]),
            },
            name="/api/telco-credit/score [POST]",
        )


# ── Admin User ────────────────────────────────────────────────────────────────
class AdminUser(HttpUser):
    """Admin user — reinsurance, ERPNext, knowledge graph operations."""
    wait_time = between(3, 8)
    weight = 10  # 10% of virtual users

    def on_start(self):
        self.client.headers.update({
            **AUTH_HEADERS,
            "Authorization": f"Bearer {os.getenv('ADMIN_TOKEN', AUTH_TOKEN)}",
        })

    @task(3)
    def get_erpnext_sync_status(self):
        """Get ERPNext sync status."""
        self.client.get("/api/erpnext/sync/status", name="/api/erpnext/sync/status [GET]")

    @task(2)
    def get_reinsurance_accounting(self):
        """Get reinsurance accounting summary."""
        self.client.get(
            "/api/reinsurance/accounting/summary",
            name="/api/reinsurance/accounting/summary [GET]",
        )

    @task(2)
    def get_knowledge_graph_nodes(self):
        """Get knowledge graph nodes."""
        self.client.get("/api/knowledge-graph/nodes", name="/api/knowledge-graph/nodes [GET]")

    @task(1)
    def get_fraud_rings(self):
        """Get fraud ring detection results."""
        self.client.get("/api/fraud/rings", name="/api/fraud/rings [GET]")

    @task(1)
    def get_openimis_loss_ratio(self):
        """Get OpenIMIS loss ratio analytics."""
        self.client.get(
            "/api/openimis/analytics/loss-ratio?period=2024-Q1",
            name="/api/openimis/analytics/loss-ratio [GET]",
        )


# ── Spike Test User ───────────────────────────────────────────────────────────
class SpikeTestUser(HttpUser):
    """Spike test user — simulates sudden traffic burst."""
    wait_time = constant_pacing(0.1)  # 10 RPS per user
    weight = 0  # Only used in spike test scenarios

    def on_start(self):
        self.client.headers.update(AUTH_HEADERS)

    @task
    def rapid_policy_list(self):
        """Rapid policy list requests to simulate spike."""
        self.client.get("/api/policies", name="/api/policies [SPIKE]")


# ── Event Hooks for SLA Monitoring ───────────────────────────────────────────
SLA_THRESHOLDS = {
    "/api/policies [GET]": {"p95": 200, "p99": 500},
    "/api/policies [POST]": {"p95": 300, "p99": 800},
    "/api/claims [GET]": {"p95": 300, "p99": 800},
    "/api/claims [POST]": {"p95": 400, "p99": 1000},
    "/api/fraud/score [POST]": {"p95": 1000, "p99": 2000},
    "/api/payments [POST]": {"p95": 400, "p99": 1000},
    "/api/underwriting/assess [POST]": {"p95": 1500, "p99": 3000},
}

sla_violations = []


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Monitor SLA compliance for each request."""
    if exception:
        return
    if name in SLA_THRESHOLDS:
        # This is a simplified check; real p95/p99 requires aggregation
        p99_threshold = SLA_THRESHOLDS[name]["p99"]
        if response_time > p99_threshold:
            sla_violations.append({
                "endpoint": name,
                "response_time": response_time,
                "threshold": p99_threshold,
                "timestamp": datetime.utcnow().isoformat(),
            })


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Report SLA violations at end of test."""
    if sla_violations:
        print(f"\n⚠️  SLA VIOLATIONS ({len(sla_violations)} total):")
        for v in sla_violations[:20]:  # Show first 20
            print(f"  {v['endpoint']}: {v['response_time']:.0f}ms > {v['threshold']}ms")
    else:
        print("\n✅ All SLA thresholds met!")

    # Write violations to file for CI/CD
    with open("/tmp/sla_violations.json", "w") as f:
        json.dump(sla_violations, f, indent=2)
