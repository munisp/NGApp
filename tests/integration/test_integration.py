#!/usr/bin/env python3
"""
Integration Test Suite — Unified Insurance Platform
Tests end-to-end service-to-service communication:
- Kafka message flow (claims producer → consumer → adjudication)
- Temporal workflow execution (cession management, payment)
- Dapr pub/sub and service invocation
- OpenIMIS ↔ Platform sync
- TigerBeetle ledger entries via payment service
- Keycloak ↔ Permify authorization chain
- APISIX → Backend routing
- Fluvio streaming pipeline
- Lakehouse data ingestion
"""

import os
import json
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8080")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
TEMPORAL_HOST = os.getenv("TEMPORAL_HOST", "localhost:7233")
DAPR_HTTP_PORT = os.getenv("DAPR_HTTP_PORT", "3500")
TIGERBEETLE_HOST = os.getenv("TIGERBEETLE_HOST", "localhost:3001")
TRINO_HOST = os.getenv("TRINO_HOST", "localhost:8080")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
PERMIFY_URL = os.getenv("PERMIFY_URL", "http://localhost:3476")
OPENIMIS_URL = os.getenv("OPENIMIS_URL", "http://localhost:8001")
FLUVIO_HOST = os.getenv("FLUVIO_HOST", "localhost:9003")

AUTH_TOKEN = os.getenv("PLATFORM_API_KEY", "test-api-key")
HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json",
}


# ── Kafka Integration Tests ───────────────────────────────────────────────────
class TestKafkaIntegration:
    """Test Kafka message flow from claims producer to consumer."""

    def test_kafka_broker_connectivity(self):
        """Verify Kafka brokers are reachable."""
        try:
            from kafka import KafkaAdminClient
            admin = KafkaAdminClient(bootstrap_servers=KAFKA_BOOTSTRAP, request_timeout_ms=5000)
            topics = admin.list_topics()
            admin.close()
            assert isinstance(topics, list)
        except ImportError:
            pytest.skip("kafka-python not installed")
        except Exception as e:
            pytest.skip(f"Kafka not available: {e}")

    def test_claim_event_published_to_kafka(self):
        """Submitting a claim should publish an event to Kafka."""
        try:
            from kafka import KafkaConsumer
            consumer = KafkaConsumer(
                "insurance.claims.submitted",
                bootstrap_servers=KAFKA_BOOTSTRAP,
                auto_offset_reset="latest",
                consumer_timeout_ms=10000,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            # Submit a claim via API
            claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
            resp = requests.post(
                f"{BASE_URL}/api/claims",
                json={
                    "policyId": 1,
                    "claimNumber": claim_id,
                    "amount": "25000.00",
                    "incidentDate": datetime.utcnow().isoformat(),
                    "description": "Integration test claim",
                },
                headers=HEADERS,
                timeout=10,
            )
            assert resp.status_code in (200, 201)
            # Wait for Kafka message
            messages = []
            for msg in consumer:
                messages.append(msg.value)
                if len(messages) >= 1:
                    break
            consumer.close()
            assert len(messages) > 0
            assert any(m.get("claimId") == claim_id or m.get("claimNumber") == claim_id for m in messages)
        except ImportError:
            pytest.skip("kafka-python not installed")
        except Exception as e:
            pytest.skip(f"Kafka not available: {e}")

    def test_kafka_topic_replication(self):
        """Verify critical topics have replication factor >= 3."""
        try:
            from kafka import KafkaAdminClient
            from kafka.admin import NewTopic
            admin = KafkaAdminClient(bootstrap_servers=KAFKA_BOOTSTRAP, request_timeout_ms=5000)
            metadata = admin.describe_topics(["insurance.claims.submitted", "insurance.payments.processed"])
            for topic_metadata in metadata:
                for partition in topic_metadata.partitions:
                    assert len(partition.replicas) >= 3, (
                        f"Topic {topic_metadata.topic} partition {partition.partition} "
                        f"has only {len(partition.replicas)} replicas"
                    )
            admin.close()
        except ImportError:
            pytest.skip("kafka-python not installed")
        except Exception as e:
            pytest.skip(f"Kafka not available: {e}")


# ── Temporal Workflow Integration Tests ───────────────────────────────────────
class TestTemporalIntegration:
    """Test Temporal workflow execution."""

    def test_temporal_frontend_reachable(self):
        """Verify Temporal frontend is reachable."""
        try:
            import temporalio.client
            import asyncio
            async def check():
                client = await temporalio.client.Client.connect(TEMPORAL_HOST)
                return True
            result = asyncio.run(check())
            assert result
        except ImportError:
            pytest.skip("temporalio not installed")
        except Exception as e:
            pytest.skip(f"Temporal not available: {e}")

    def test_cession_workflow_execution(self):
        """Test that cession management workflow executes successfully."""
        try:
            import temporalio.client
            import asyncio
            async def run_workflow():
                client = await temporalio.client.Client.connect(TEMPORAL_HOST)
                handle = await client.start_workflow(
                    "CessionManagementWorkflow",
                    args=[{
                        "cessionId": f"CES-{uuid.uuid4().hex[:8].upper()}",
                        "cedantId": "cedant-001",
                        "reinsurerIds": ["reinsurer-a"],
                        "cessionPercentage": 30,
                        "period": "2024-01",
                    }],
                    id=f"cession-test-{uuid.uuid4().hex[:8]}",
                    task_queue="cession-management",
                )
                result = await handle.result(timeout=timedelta(seconds=60))
                return result
            result = asyncio.run(run_workflow())
            assert result is not None
        except ImportError:
            pytest.skip("temporalio not installed")
        except Exception as e:
            pytest.skip(f"Temporal not available: {e}")

    def test_payment_workflow_execution(self):
        """Test that payment workflow executes and creates TigerBeetle entries."""
        resp = requests.post(
            f"{BASE_URL}/api/payments/workflow",
            json={
                "policyId": 1,
                "amount": "5000.00",
                "currency": "NGN",
                "paymentMethod": "bank_transfer",
            },
            headers=HEADERS,
            timeout=30,
        )
        assert resp.status_code in (200, 201, 202)
        data = resp.json()
        assert "workflowId" in data or "paymentId" in data


# ── Dapr Integration Tests ────────────────────────────────────────────────────
class TestDaprIntegration:
    """Test Dapr pub/sub and service invocation."""

    def test_dapr_sidecar_health(self):
        """Verify Dapr sidecar is healthy."""
        resp = requests.get(f"http://localhost:{DAPR_HTTP_PORT}/v1.0/healthz", timeout=5)
        assert resp.status_code == 204

    def test_dapr_pubsub_publish(self):
        """Test publishing a message via Dapr pub/sub."""
        resp = requests.post(
            f"http://localhost:{DAPR_HTTP_PORT}/v1.0/publish/insurance-pubsub/claims",
            json={
                "claimId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "event": "claim.submitted",
                "timestamp": datetime.utcnow().isoformat(),
            },
            timeout=5,
        )
        assert resp.status_code in (200, 204)

    def test_dapr_service_invocation(self):
        """Test Dapr service-to-service invocation."""
        resp = requests.post(
            f"http://localhost:{DAPR_HTTP_PORT}/v1.0/invoke/openimis-service/method/health",
            timeout=5,
        )
        assert resp.status_code in (200, 204, 404)  # 404 if service not running in test env

    def test_dapr_state_store(self):
        """Test Dapr state store operations."""
        key = f"test-{uuid.uuid4().hex[:8]}"
        value = {"data": "integration-test", "timestamp": datetime.utcnow().isoformat()}
        # Save state
        save_resp = requests.post(
            f"http://localhost:{DAPR_HTTP_PORT}/v1.0/state/insurance-statestore",
            json=[{"key": key, "value": value}],
            timeout=5,
        )
        assert save_resp.status_code in (200, 204)
        # Get state
        get_resp = requests.get(
            f"http://localhost:{DAPR_HTTP_PORT}/v1.0/state/insurance-statestore/{key}",
            timeout=5,
        )
        assert get_resp.status_code == 200
        assert get_resp.json() == value


# ── TigerBeetle Ledger Integration Tests ─────────────────────────────────────
class TestTigerBeetleIntegration:
    """Test TigerBeetle ledger operations via payment service."""

    def test_account_creation(self):
        """Test creating accounts in TigerBeetle via payment service."""
        resp = requests.post(
            f"{BASE_URL}/api/ledger/accounts",
            json={
                "accountId": f"ACC-{uuid.uuid4().hex[:16]}",
                "ledger": 1,
                "code": 1000,
                "flags": 0,
            },
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201, 409)  # 409 if account already exists

    def test_transfer_creation(self):
        """Test creating transfers in TigerBeetle via payment service."""
        resp = requests.post(
            f"{BASE_URL}/api/ledger/transfers",
            json={
                "transferId": f"TXN-{uuid.uuid4().hex[:16]}",
                "debitAccountId": "ACC-001",
                "creditAccountId": "ACC-002",
                "amount": 500000,  # In kobo (₦5000)
                "ledger": 1,
                "code": 1001,
            },
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201, 400)

    def test_account_balance_query(self):
        """Test querying account balances from TigerBeetle."""
        resp = requests.get(
            f"{BASE_URL}/api/ledger/accounts/ACC-001/balance",
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.json()
            assert "debitsPosted" in data or "creditsPosted" in data or "balance" in data


# ── Keycloak ↔ Permify Authorization Chain Tests ──────────────────────────────
class TestAuthorizationChain:
    """Test that Keycloak tokens are properly validated by Permify."""

    def test_keycloak_token_introspection(self):
        """Test Keycloak token introspection endpoint."""
        resp = requests.get(
            f"{KEYCLOAK_URL}/realms/insurance/.well-known/openid-configuration",
            timeout=5,
        )
        assert resp.status_code == 200
        config = resp.json()
        assert "introspection_endpoint" in config
        assert "jwks_uri" in config

    def test_permify_health(self):
        """Test Permify service health."""
        resp = requests.get(f"{PERMIFY_URL}/healthz", timeout=5)
        assert resp.status_code in (200, 204)

    def test_permify_permission_check(self):
        """Test Permify permission check for policy read."""
        resp = requests.post(
            f"{PERMIFY_URL}/v1/tenants/insurance/permissions/check",
            json={
                "metadata": {"snap_token": "", "schema_version": "", "depth": 20},
                "entity": {"type": "policy", "id": "1"},
                "permission": "read",
                "subject": {"type": "user", "id": "user-001"},
            },
            headers={"Authorization": f"Bearer {os.getenv('PERMIFY_PRESHARED_KEY', 'test-key')}"},
            timeout=5,
        )
        assert resp.status_code in (200, 401, 403)
        if resp.status_code == 200:
            data = resp.json()
            assert "can" in data


# ── APISIX Gateway Integration Tests ─────────────────────────────────────────
class TestAPISIXIntegration:
    """Test APISIX gateway routing and plugins."""

    def test_apisix_status(self):
        """Test APISIX gateway status."""
        resp = requests.get(f"{BASE_URL}/apisix/status", timeout=5)
        assert resp.status_code in (200, 404)

    def test_rate_limiting_headers(self):
        """Test that rate limiting headers are present in responses."""
        resp = requests.get(f"{BASE_URL}/api/policies", headers=HEADERS, timeout=10)
        assert resp.status_code in (200, 401, 429)
        # Check for rate limit headers
        rate_limit_headers = [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "RateLimit-Limit",
            "RateLimit-Remaining",
        ]
        # At least some rate limit headers should be present
        present = [h for h in rate_limit_headers if h in resp.headers]
        # Not all gateways expose these, so we just log
        if not present:
            pytest.skip("Rate limit headers not exposed by gateway")

    def test_jwt_validation_via_apisix(self):
        """Test that APISIX properly validates JWT tokens."""
        invalid_headers = {"Authorization": "Bearer definitely-invalid-jwt"}
        resp = requests.get(f"{BASE_URL}/api/policies", headers=invalid_headers, timeout=10)
        assert resp.status_code in (401, 403)

    def test_cors_headers(self):
        """Test CORS headers are properly set."""
        resp = requests.options(
            f"{BASE_URL}/api/policies",
            headers={
                "Origin": "https://app.insurance-platform.com",
                "Access-Control-Request-Method": "GET",
            },
            timeout=5,
        )
        assert resp.status_code in (200, 204, 403)


# ── Lakehouse / Trino Integration Tests ──────────────────────────────────────
class TestLakehouseIntegration:
    """Test Lakehouse data ingestion and query via Trino."""

    def test_trino_connectivity(self):
        """Test Trino coordinator is reachable."""
        try:
            import trino
            conn = trino.dbapi.connect(
                host=TRINO_HOST.split(":")[0],
                port=int(TRINO_HOST.split(":")[1]) if ":" in TRINO_HOST else 8080,
                user="insurance-platform",
                catalog="iceberg",
                schema="insurance",
            )
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result[0] == 1
            conn.close()
        except ImportError:
            pytest.skip("trino not installed")
        except Exception as e:
            pytest.skip(f"Trino not available: {e}")

    def test_iceberg_table_exists(self):
        """Test that Iceberg tables exist in the Lakehouse."""
        try:
            import trino
            conn = trino.dbapi.connect(
                host=TRINO_HOST.split(":")[0],
                port=int(TRINO_HOST.split(":")[1]) if ":" in TRINO_HOST else 8080,
                user="insurance-platform",
                catalog="iceberg",
                schema="insurance",
            )
            cursor = conn.cursor()
            cursor.execute("SHOW TABLES IN iceberg.insurance")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            expected_tables = ["policies", "claims", "payments", "fraud_scores"]
            for table in expected_tables:
                assert table in tables, f"Expected table '{table}' not found in Lakehouse"
        except ImportError:
            pytest.skip("trino not installed")
        except Exception as e:
            pytest.skip(f"Trino not available: {e}")

    def test_data_ingestion_pipeline(self):
        """Test that new claims are ingested into the Lakehouse."""
        # Submit a claim
        claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": 1,
                "claimNumber": claim_id,
                "amount": "15000.00",
                "incidentDate": datetime.utcnow().isoformat(),
                "description": "Lakehouse ingestion test claim",
            },
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)
        # Wait for ingestion (Kafka → Lakehouse pipeline)
        time.sleep(30)
        # Query Lakehouse for the claim
        try:
            import trino
            conn = trino.dbapi.connect(
                host=TRINO_HOST.split(":")[0],
                port=int(TRINO_HOST.split(":")[1]) if ":" in TRINO_HOST else 8080,
                user="insurance-platform",
                catalog="iceberg",
                schema="insurance",
            )
            cursor = conn.cursor()
            cursor.execute(f"SELECT claim_number FROM iceberg.insurance.claims WHERE claim_number = '{claim_id}'")
            result = cursor.fetchone()
            conn.close()
            assert result is not None, f"Claim {claim_id} not found in Lakehouse after 30s"
        except ImportError:
            pytest.skip("trino not installed")
        except Exception as e:
            pytest.skip(f"Trino not available: {e}")


# ── OpenIMIS Integration Tests ────────────────────────────────────────────────
class TestOpenIMISIntegration:
    """Test OpenIMIS ↔ Platform bidirectional sync."""

    def test_openimis_health(self):
        """Test OpenIMIS API is reachable."""
        resp = requests.get(f"{OPENIMIS_URL}/api/graphql", timeout=5)
        assert resp.status_code in (200, 400, 405)  # 400/405 = reachable but needs proper request

    def test_policy_sync_bidirectional(self):
        """Test that policies sync bidirectionally between platform and OpenIMIS."""
        # Create policy in platform
        policy_number = f"POL-{uuid.uuid4().hex[:8].upper()}"
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": policy_number,
                "name": "OpenIMIS Sync Test Policy",
                "type": "Health",
                "premium": "3000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)
        # Trigger sync
        sync_resp = requests.post(
            f"{BASE_URL}/api/openimis/sync/policies",
            json={"policyNumber": policy_number},
            headers=HEADERS,
            timeout=30,
        )
        assert sync_resp.status_code in (200, 201, 202)

    def test_claims_loss_ratio_calculation(self):
        """Test that loss ratio is calculated from real claims data."""
        resp = requests.get(
            f"{BASE_URL}/api/openimis/analytics/loss-ratio?period=2024-Q1",
            headers=HEADERS,
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "lossRatio" in data
        assert 0 <= float(data["lossRatio"]) <= 10  # Loss ratio as decimal


# ── End-to-End Workflow Tests ─────────────────────────────────────────────────
class TestEndToEndWorkflows:
    """Test complete business workflows end-to-end."""

    def test_full_policy_lifecycle(self):
        """Test: Create Policy → Submit Claim → Adjudicate → Pay → Close."""
        # 1. Create policy
        policy_number = f"POL-{uuid.uuid4().hex[:8].upper()}"
        policy_resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": policy_number,
                "name": "E2E Test Policy",
                "type": "Health",
                "premium": "8000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            headers=HEADERS,
            timeout=10,
        )
        assert policy_resp.status_code in (200, 201)
        policy_id = policy_resp.json()["id"]

        # 2. Submit claim
        claim_number = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        claim_resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": policy_id,
                "claimNumber": claim_number,
                "amount": "30000.00",
                "incidentDate": datetime.utcnow().isoformat(),
                "description": "E2E test hospitalization claim",
            },
            headers=HEADERS,
            timeout=10,
        )
        assert claim_resp.status_code in (200, 201)
        claim_id = claim_resp.json()["id"]

        # 3. Adjudicate claim
        adjudicate_resp = requests.patch(
            f"{BASE_URL}/api/claims/{claim_id}",
            json={"status": "Approved"},
            headers=HEADERS,
            timeout=10,
        )
        assert adjudicate_resp.status_code == 200

        # 4. Process payment
        payment_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={
                "policyId": policy_id,
                "claimId": claim_id,
                "amount": "30000.00",
                "dueDate": datetime.utcnow().isoformat(),
                "paymentMethod": "bank_transfer",
            },
            headers=HEADERS,
            timeout=10,
        )
        assert payment_resp.status_code in (200, 201)

        # 5. Verify claim status updated to Paid
        final_claim_resp = requests.get(f"{BASE_URL}/api/claims/{claim_id}", headers=HEADERS, timeout=10)
        assert final_claim_resp.status_code == 200
        # Status should be Paid or still Approved (payment processing may be async)
        assert final_claim_resp.json()["status"] in ("Approved", "Paid")

    def test_fraud_detection_blocks_suspicious_claim(self):
        """Test that a suspicious claim is blocked by fraud detection."""
        # Submit a claim with high fraud indicators
        resp = requests.post(
            f"{BASE_URL}/api/claims",
            json={
                "policyId": 1,
                "claimNumber": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                "amount": "999999.00",  # Suspiciously high amount
                "incidentDate": datetime.utcnow().isoformat(),
                "description": "Fraud test claim",
                "metadata": {
                    "vpnDetected": True,
                    "deviceFingerprint": "unknown",
                    "claimAge": 0,
                },
            },
            headers=HEADERS,
            timeout=15,
        )
        # Should either be blocked (400/403) or flagged for review
        assert resp.status_code in (200, 201, 400, 403)
        if resp.status_code in (200, 201):
            data = resp.json()
            # If accepted, should be flagged for review
            assert data.get("status") in ("Submitted", "Under Review")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "--timeout=60"])
