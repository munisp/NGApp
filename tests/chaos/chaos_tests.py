#!/usr/bin/env python3
"""
Chaos Engineering Test Suite — Unified Insurance Platform
Tests platform resilience under:
- Pod failures (kill random pods)
- Network partitions (simulate split-brain)
- Latency injection (slow network)
- CPU/Memory stress
- Kafka broker failures
- Database connection failures
- TigerBeetle node failures
- Temporal worker failures
- Redis sentinel failover
- Keycloak node failures

Uses Chaos Mesh CRDs + direct Kubernetes API for fault injection.
"""

import os
import json
import time
import uuid
import pytest
import requests
import subprocess
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8080")
CHAOS_MESH_URL = os.getenv("CHAOS_MESH_URL", "http://chaos-mesh.chaos-testing.svc.cluster.local:2333")
KUBECTL = os.getenv("KUBECTL_PATH", "kubectl")
AUTH_TOKEN = os.getenv("PLATFORM_API_KEY", "test-api-key")
HEADERS = {"Authorization": f"Bearer {AUTH_TOKEN}", "Content-Type": "application/json"}

# ── Chaos Mesh CRD Helpers ────────────────────────────────────────────────────

def apply_chaos(manifest: Dict) -> bool:
    """Apply a Chaos Mesh manifest via kubectl."""
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        import yaml
        yaml.dump(manifest, f)
        fname = f.name
    result = subprocess.run([KUBECTL, "apply", "-f", fname], capture_output=True, text=True)
    os.unlink(fname)
    return result.returncode == 0


def delete_chaos(name: str, namespace: str, kind: str) -> bool:
    """Delete a Chaos Mesh experiment."""
    result = subprocess.run(
        [KUBECTL, "delete", kind.lower(), name, "-n", namespace],
        capture_output=True, text=True,
    )
    return result.returncode == 0


def wait_for_chaos_active(name: str, namespace: str, kind: str, timeout: int = 30) -> bool:
    """Wait for a Chaos experiment to become active."""
    start = time.time()
    while time.time() - start < timeout:
        result = subprocess.run(
            [KUBECTL, "get", kind.lower(), name, "-n", namespace, "-o", "json"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            status = data.get("status", {})
            if status.get("conditions"):
                for cond in status["conditions"]:
                    if cond.get("type") == "AllInjected" and cond.get("status") == "True":
                        return True
        time.sleep(2)
    return False


def platform_is_healthy(timeout: int = 10) -> bool:
    """Check if the platform is responding to health checks."""
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=timeout)
        return resp.status_code == 200
    except Exception:
        return False


def api_responds(endpoint: str, timeout: int = 10) -> bool:
    """Check if a specific API endpoint responds."""
    try:
        resp = requests.get(f"{BASE_URL}{endpoint}", headers=HEADERS, timeout=timeout)
        return resp.status_code in (200, 201, 400, 401, 403, 404)
    except Exception:
        return False


# ── Pod Failure Tests ─────────────────────────────────────────────────────────
class TestPodFailures:
    """Test platform resilience when pods are killed."""

    def test_kafka_broker_failure_resilience(self):
        """Platform must remain functional when one Kafka broker fails."""
        # Verify platform is healthy before chaos
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"kafka-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "kafka"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["kafka"],
                    "labelSelectors": {"app": "kafka"},
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            # Wait for chaos to be injected
            time.sleep(10)

            # Platform should still respond during broker failure
            for _ in range(6):  # Check every 10 seconds for 60 seconds
                assert api_responds("/api/policies"), "Platform API failed during Kafka broker failure"
                time.sleep(10)

            # Submit a claim during chaos — should succeed with remaining brokers
            resp = requests.post(
                f"{BASE_URL}/api/claims",
                json={
                    "policyId": 1,
                    "claimNumber": f"CLM-CHAOS-{uuid.uuid4().hex[:8].upper()}",
                    "amount": "15000.00",
                    "incidentDate": datetime.utcnow().isoformat(),
                    "description": "Chaos test claim during Kafka failure",
                },
                headers=HEADERS,
                timeout=30,
            )
            assert resp.status_code in (200, 201, 202, 503), (
                f"Unexpected response during Kafka failure: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "kafka", "PodChaos")
            # Wait for recovery
            time.sleep(30)
            assert platform_is_healthy(timeout=60), "Platform did not recover after Kafka broker failure"

    def test_redis_sentinel_failover(self):
        """Platform must handle Redis sentinel failover gracefully."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"redis-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "redis"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["redis"],
                    "labelSelectors": {"app": "redis", "role": "master"},
                },
                "duration": "120s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(15)  # Wait for sentinel to elect new master

            # Platform should still respond after Redis failover
            for _ in range(3):
                assert api_responds("/api/policies"), "Platform API failed during Redis failover"
                time.sleep(10)

        finally:
            delete_chaos(chaos_name, "redis", "PodChaos")
            time.sleep(30)
            assert platform_is_healthy(timeout=60), "Platform did not recover after Redis failover"

    def test_temporal_worker_failure(self):
        """Temporal workflows must continue when a worker pod fails."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"temporal-worker-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "temporal"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["temporal"],
                    "labelSelectors": {"app": "temporal", "component": "worker"},
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # Submit a payment workflow — should be picked up by remaining workers
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
            assert resp.status_code in (200, 201, 202), (
                f"Payment workflow failed during Temporal worker failure: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "temporal", "PodChaos")
            time.sleep(30)

    def test_keycloak_node_failure(self):
        """Authentication must work when one Keycloak node fails."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"keycloak-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "keycloak"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["keycloak"],
                    "labelSelectors": {"app": "keycloak"},
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(15)

            # Authentication should still work with remaining Keycloak nodes
            keycloak_url = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
            resp = requests.get(
                f"{keycloak_url}/realms/insurance/.well-known/openid-configuration",
                timeout=10,
            )
            assert resp.status_code == 200, (
                f"Keycloak OIDC config unavailable during node failure: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "keycloak", "PodChaos")
            time.sleep(30)

    def test_permify_pod_failure(self):
        """Authorization must work when one Permify pod fails."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"permify-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "permify"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["permify"],
                    "labelSelectors": {"app": "permify"},
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # API calls should still work (APISIX caches auth decisions)
            assert api_responds("/api/policies"), "API failed during Permify pod failure"

        finally:
            delete_chaos(chaos_name, "permify", "PodChaos")
            time.sleep(30)


# ── Network Chaos Tests ───────────────────────────────────────────────────────
class TestNetworkChaos:
    """Test platform resilience under network failures."""

    def test_network_latency_injection(self):
        """Platform must handle high network latency gracefully."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"network-latency-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "NetworkChaos",
            "metadata": {"name": chaos_name, "namespace": "insurance-platform"},
            "spec": {
                "action": "delay",
                "mode": "all",
                "selector": {
                    "namespaces": ["insurance-platform"],
                },
                "delay": {
                    "latency": "200ms",
                    "correlation": "25",
                    "jitter": "50ms",
                },
                "duration": "120s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # API should still respond, just slower
            start = time.time()
            resp = requests.get(f"{BASE_URL}/api/policies", headers=HEADERS, timeout=30)
            elapsed = time.time() - start

            assert resp.status_code in (200, 401, 403), (
                f"API failed under network latency: {resp.status_code}"
            )
            # Response time should be within acceptable bounds even with latency
            assert elapsed < 10, f"API too slow under 200ms latency: {elapsed:.2f}s"

        finally:
            delete_chaos(chaos_name, "insurance-platform", "NetworkChaos")
            time.sleep(10)

    def test_network_partition_between_services(self):
        """Platform must handle network partition between services."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"network-partition-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "NetworkChaos",
            "metadata": {"name": chaos_name, "namespace": "insurance-platform"},
            "spec": {
                "action": "partition",
                "mode": "one",
                "selector": {
                    "namespaces": ["insurance-platform"],
                    "labelSelectors": {"app": "fraud-detection"},
                },
                "direction": "both",
                "target": {
                    "selector": {
                        "namespaces": ["insurance-platform"],
                        "labelSelectors": {"app": "claims-service"},
                    },
                    "mode": "all",
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # Claims should still be accepted (fraud check may be degraded gracefully)
            resp = requests.post(
                f"{BASE_URL}/api/claims",
                json={
                    "policyId": 1,
                    "claimNumber": f"CLM-PARTITION-{uuid.uuid4().hex[:8].upper()}",
                    "amount": "20000.00",
                    "incidentDate": datetime.utcnow().isoformat(),
                    "description": "Network partition test claim",
                },
                headers=HEADERS,
                timeout=30,
            )
            # Should accept claim even if fraud check is unavailable (fail-open)
            assert resp.status_code in (200, 201, 202, 503), (
                f"Claims failed during network partition: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "insurance-platform", "NetworkChaos")
            time.sleep(10)

    def test_packet_loss_resilience(self):
        """Platform must handle packet loss gracefully."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"packet-loss-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "NetworkChaos",
            "metadata": {"name": chaos_name, "namespace": "kafka"},
            "spec": {
                "action": "loss",
                "mode": "all",
                "selector": {
                    "namespaces": ["kafka"],
                    "labelSelectors": {"app": "kafka"},
                },
                "loss": {
                    "loss": "20",
                    "correlation": "25",
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # Platform should handle 20% packet loss with retries
            for _ in range(3):
                assert api_responds("/api/policies"), "API failed under 20% packet loss"
                time.sleep(5)

        finally:
            delete_chaos(chaos_name, "kafka", "NetworkChaos")
            time.sleep(10)


# ── Resource Stress Tests ─────────────────────────────────────────────────────
class TestResourceStress:
    """Test platform resilience under CPU/Memory stress."""

    def test_cpu_stress_on_fraud_service(self):
        """Fraud detection must remain functional under CPU stress."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"cpu-stress-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "StressChaos",
            "metadata": {"name": chaos_name, "namespace": "insurance-platform"},
            "spec": {
                "mode": "one",
                "selector": {
                    "namespaces": ["insurance-platform"],
                    "labelSelectors": {"app": "fraud-detection"},
                },
                "stressors": {
                    "cpu": {
                        "workers": 4,
                        "load": 80,
                    }
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            # Fraud score should still be returned (may be slower)
            resp = requests.post(
                f"{BASE_URL}/api/fraud/score",
                json={
                    "entityType": "Claim",
                    "entityId": f"CLM-{uuid.uuid4().hex[:8].upper()}",
                    "amount": 50000,
                    "metadata": {"claimAge": 5, "policyAge": 30},
                },
                headers=HEADERS,
                timeout=30,  # Allow more time under stress
            )
            assert resp.status_code in (200, 201, 503), (
                f"Fraud service failed under CPU stress: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "insurance-platform", "StressChaos")
            time.sleep(10)

    def test_memory_stress_on_underwriting(self):
        """Underwriting service must handle memory pressure."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"mem-stress-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "StressChaos",
            "metadata": {"name": chaos_name, "namespace": "insurance-platform"},
            "spec": {
                "mode": "one",
                "selector": {
                    "namespaces": ["insurance-platform"],
                    "labelSelectors": {"app": "underwriting-service"},
                },
                "stressors": {
                    "memory": {
                        "workers": 4,
                        "size": "512MB",
                    }
                },
                "duration": "60s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(10)

            resp = requests.post(
                f"{BASE_URL}/api/underwriting/assess",
                json={
                    "applicantId": f"APP-{uuid.uuid4().hex[:8].upper()}",
                    "productType": "Health",
                    "age": 35,
                    "smoker": False,
                    "preExistingConditions": [],
                    "occupation": "Engineer",
                    "annualIncome": 5000000,
                },
                headers=HEADERS,
                timeout=30,
            )
            assert resp.status_code in (200, 201, 503), (
                f"Underwriting failed under memory stress: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "insurance-platform", "StressChaos")
            time.sleep(10)


# ── TigerBeetle Chaos Tests ───────────────────────────────────────────────────
class TestTigerBeetleChaos:
    """Test TigerBeetle cluster resilience."""

    def test_tigerbeetle_node_failure_quorum(self):
        """TigerBeetle must maintain quorum with 1 of 3 nodes failed."""
        assert platform_is_healthy(), "Platform not healthy before chaos test"

        chaos_name = f"tb-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "tigerbeetle"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["tigerbeetle"],
                    "labelSelectors": {"app": "tigerbeetle"},
                },
                "duration": "120s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(15)

            # Payments should still work with 2 of 3 TigerBeetle nodes
            resp = requests.post(
                f"{BASE_URL}/api/payments",
                json={
                    "policyId": 1,
                    "amount": "5000.00",
                    "dueDate": datetime.utcnow().isoformat(),
                    "paymentMethod": "bank_transfer",
                },
                headers=HEADERS,
                timeout=30,
            )
            assert resp.status_code in (200, 201, 202), (
                f"Payment failed during TigerBeetle node failure: {resp.status_code}"
            )

        finally:
            delete_chaos(chaos_name, "tigerbeetle", "PodChaos")
            time.sleep(60)  # TigerBeetle needs time to catch up
            assert platform_is_healthy(timeout=120), "Platform did not recover after TigerBeetle failure"


# ── Recovery Tests ────────────────────────────────────────────────────────────
class TestRecovery:
    """Test that the platform recovers correctly after failures."""

    def test_data_consistency_after_pod_restart(self):
        """Data must be consistent after a pod restart."""
        # Create a policy
        policy_number = f"POL-RECOVERY-{uuid.uuid4().hex[:8].upper()}"
        resp = requests.post(
            f"{BASE_URL}/api/policies",
            json={
                "policyNumber": policy_number,
                "name": "Recovery Test Policy",
                "type": "Health",
                "premium": "5000.00",
                "startDate": datetime.utcnow().isoformat(),
                "expiryDate": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            },
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code in (200, 201)
        policy_id = resp.json()["id"]

        # Kill the API pod
        chaos_name = f"api-pod-kill-{uuid.uuid4().hex[:8]}"
        chaos_manifest = {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {"name": chaos_name, "namespace": "insurance-platform"},
            "spec": {
                "action": "pod-kill",
                "mode": "one",
                "selector": {
                    "namespaces": ["insurance-platform"],
                    "labelSelectors": {"app": "api-gateway"},
                },
                "duration": "30s",
            },
        }

        try:
            if not apply_chaos(chaos_manifest):
                pytest.skip("Chaos Mesh not available")

            time.sleep(40)  # Wait for pod to restart

            # Wait for API to be available again
            for _ in range(12):
                if platform_is_healthy():
                    break
                time.sleep(5)
            else:
                pytest.fail("Platform did not recover within 60 seconds")

            # Verify the policy still exists with correct data
            resp = requests.get(
                f"{BASE_URL}/api/policies/{policy_id}",
                headers=HEADERS,
                timeout=10,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["policyNumber"] == policy_number
            assert data["type"] == "Health"

        finally:
            delete_chaos(chaos_name, "insurance-platform", "PodChaos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x", "--timeout=300"])
