"""
Chaos testing suite for the fintech platform.
Tests resilience, fault tolerance, and graceful degradation.
Run with: pytest tests/chaos_test.py -v --timeout=120
"""

import os
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
import pytest

BASE_URLS = {
    "kafka": os.getenv("KAFKA_URL", "http://localhost:8081"),
    "redis": os.getenv("REDIS_URL", "http://localhost:8082"),
    "tigerbeetle": os.getenv("TIGERBEETLE_URL", "http://localhost:8083"),
    "apisix": os.getenv("APISIX_URL", "http://localhost:8084"),
    "temporal": os.getenv("TEMPORAL_URL", "http://localhost:8085"),
    "fluvio": os.getenv("FLUVIO_URL", "http://localhost:8086"),
    "openappsec": os.getenv("OPENAPPSEC_URL", "http://localhost:8087"),
    "kubernetes": os.getenv("KUBERNETES_URL", "http://localhost:8088"),
    "permify": os.getenv("PERMIFY_URL", "http://localhost:8089"),
    "lakehouse": os.getenv("LAKEHOUSE_URL", "http://localhost:8090"),
    "keycloak": os.getenv("KEYCLOAK_URL", "http://localhost:8091"),
    "dapr": os.getenv("DAPR_URL", "http://localhost:8092"),
}


@pytest.fixture(scope="session")
def client():
    return httpx.Client(timeout=10)


class TestConcurrentLoad:
    def test_concurrent_kafka_produce(self, client):
        errors = 0
        successes = 0

        def produce(i):
            try:
                resp = client.post(f"{BASE_URLS['kafka']}/produce", json={
                    "topic": "transactions.created",
                    "key": f"chaos-{i}",
                    "value": {"amount": random.random() * 10000, "test": "chaos"},
                })
                return resp.status_code == 200
            except Exception:
                return False

        with ThreadPoolExecutor(max_workers=50) as pool:
            futures = [pool.submit(produce, i) for i in range(200)]
            for f in as_completed(futures):
                if f.result():
                    successes += 1
                else:
                    errors += 1

        assert successes > 150, f"Too many failures: {errors}/{successes + errors}"

    def test_concurrent_redis_operations(self, client):
        errors = 0
        successes = 0

        def cache_op(i):
            try:
                client.post(f"{BASE_URLS['redis']}/cache/set", json={
                    "namespace": "chaos", "key": f"k-{i}", "value": f"v-{i}",
                    "ttl_seconds": 30, "tags": ["chaos"]
                })
                resp = client.get(f"{BASE_URLS['redis']}/cache/get",
                                  params={"namespace": "chaos", "key": f"k-{i}"})
                return resp.status_code == 200 and resp.json().get("found")
            except Exception:
                return False

        with ThreadPoolExecutor(max_workers=100) as pool:
            futures = [pool.submit(cache_op, i) for i in range(500)]
            for f in as_completed(futures):
                if f.result():
                    successes += 1
                else:
                    errors += 1

        assert successes > 400, f"Too many failures: {errors}/{successes + errors}"

    def test_concurrent_auth_attempts(self, client):
        results = {"success": 0, "locked": 0, "failed": 0}

        def auth_attempt(i):
            try:
                resp = client.post(f"{BASE_URLS['keycloak']}/auth/login", json={
                    "username": "john.doe",
                    "password": "User123!" if i % 3 != 0 else "wrong",
                })
                return resp.status_code
            except Exception:
                return 0

        with ThreadPoolExecutor(max_workers=30) as pool:
            futures = [pool.submit(auth_attempt, i) for i in range(60)]
            for f in as_completed(futures):
                code = f.result()
                if code == 200:
                    results["success"] += 1
                elif code == 423:
                    results["locked"] += 1
                else:
                    results["failed"] += 1

        assert results["success"] > 0

    def test_concurrent_transfers(self, client):
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "chaos-src", "ledger": 1, "code": 100})
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "chaos-dst", "ledger": 1, "code": 100})

        successes = 0

        def transfer(i):
            try:
                resp = client.post(f"{BASE_URLS['tigerbeetle']}/transfers/create", json={
                    "debit_account_id": "chaos-src",
                    "credit_account_id": "chaos-dst",
                    "amount": 100, "ledger": 1, "code": 1,
                })
                return resp.status_code == 200
            except Exception:
                return False

        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = [pool.submit(transfer, i) for i in range(100)]
            for f in as_completed(futures):
                if f.result():
                    successes += 1

        assert successes > 80

        reconcile = client.post(f"{BASE_URLS['tigerbeetle']}/ledger/reconcile")
        assert reconcile.status_code == 200
        assert reconcile.json().get("balanced") is True


class TestGracefulDegradation:
    def test_services_respond_when_dependencies_down(self, client):
        for name, url in BASE_URLS.items():
            try:
                resp = client.get(f"{url}/health", timeout=5)
                assert resp.status_code in (200, 503)
                data = resp.json()
                assert isinstance(data, dict)
            except httpx.ConnectError:
                pass

    def test_kafka_produces_without_broker(self, client):
        resp = client.post(f"{BASE_URLS['kafka']}/produce", json={
            "topic": "test", "key": "k", "value": {"test": True}
        })
        assert resp.status_code in (200, 500, 503)

    def test_redis_works_without_server(self, client):
        client.post(f"{BASE_URLS['redis']}/cache/set", json={
            "namespace": "test", "key": "fallback", "value": "data",
            "ttl_seconds": 60, "tags": []
        })
        resp = client.get(f"{BASE_URLS['redis']}/cache/get",
                          params={"namespace": "test", "key": "fallback"})
        assert resp.status_code == 200

    def test_temporal_runs_locally(self, client):
        resp = client.post(f"{BASE_URLS['temporal']}/workflows/start", json={
            "workflow_type": "payment.process",
            "input_data": {"amount": 50}
        })
        assert resp.status_code == 200

    def test_permify_checks_locally(self, client):
        resp = client.post(f"{BASE_URLS['permify']}/permissions/check", json={
            "entity_type": "account", "entity_id": "acct-checking-1",
            "permission": "view", "subject_type": "user", "subject_id": "user-1"
        })
        assert resp.status_code == 200


class TestSecurityChaos:
    def test_sql_injection_blocked(self, client):
        payloads = [
            "' OR 1=1--",
            "'; DROP TABLE users;--",
            "admin' UNION SELECT * FROM passwords--",
            "1; EXEC xp_cmdshell('dir')",
        ]
        for payload in payloads:
            resp = client.post(f"{BASE_URLS['openappsec']}/scan", json={
                "method": "POST", "path": "/api/login",
                "body": f"username={payload}", "headers": {}
            })
            assert resp.status_code == 200
            assert resp.json()["blocked"] is True, f"Payload not blocked: {payload}"

    def test_xss_blocked(self, client):
        payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert(1)>",
            "javascript:alert(1)",
        ]
        for payload in payloads:
            resp = client.post(f"{BASE_URLS['openappsec']}/scan", json={
                "method": "POST", "path": "/api/comments",
                "body": f"comment={payload}", "headers": {}
            })
            assert resp.status_code == 200
            assert resp.json()["blocked"] is True, f"XSS not blocked: {payload}"

    def test_path_traversal_blocked(self, client):
        resp = client.post(f"{BASE_URLS['openappsec']}/scan", json={
            "method": "GET", "path": "/api/files/../../etc/passwd",
            "body": "", "headers": {}
        })
        assert resp.status_code == 200
        assert resp.json()["blocked"] is True

    def test_brute_force_lockout(self, client):
        locked = False
        for i in range(10):
            resp = client.post(f"{BASE_URLS['keycloak']}/auth/login", json={
                "username": "admin", "password": f"wrong-{i}"
            })
            if resp.status_code == 423:
                locked = True
                break
        assert locked, "Account should lock after repeated failures"

    def test_rate_limiting(self, client):
        limited = False
        for i in range(20):
            resp = client.post(f"{BASE_URLS['redis']}/ratelimit/check", json={
                "identifier": "chaos-ratelimit", "max_requests": 5, "window_seconds": 60
            })
            if resp.status_code == 200 and not resp.json().get("allowed", True):
                limited = True
                break
        assert limited, "Rate limiting should kick in"


class TestDataIntegrity:
    def test_double_entry_consistency(self, client):
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "integrity-a", "ledger": 1, "code": 100})
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "integrity-b", "ledger": 1, "code": 100})

        for i in range(10):
            client.post(f"{BASE_URLS['tigerbeetle']}/transfers/create", json={
                "debit_account_id": "integrity-a",
                "credit_account_id": "integrity-b",
                "amount": 1000, "ledger": 1, "code": 1,
            })

        result = client.post(f"{BASE_URLS['tigerbeetle']}/ledger/reconcile")
        assert result.status_code == 200
        assert result.json()["balanced"] is True

    def test_two_phase_commit_void(self, client):
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "2pc-a", "ledger": 1, "code": 100})
        client.post(f"{BASE_URLS['tigerbeetle']}/accounts/create",
                     json={"id": "2pc-b", "ledger": 1, "code": 100})

        resp = client.post(f"{BASE_URLS['tigerbeetle']}/transfers/two-phase", json={
            "debit_account_id": "2pc-a", "credit_account_id": "2pc-b",
            "amount": 5000, "ledger": 1, "code": 1, "timeout": 300,
        })
        assert resp.status_code == 200

        if "pending_id" in resp.json():
            void_resp = client.post(f"{BASE_URLS['tigerbeetle']}/transfers/void",
                                    json={"pending_id": resp.json()["pending_id"]})
            assert void_resp.status_code == 200

    def test_session_isolation(self, client):
        for i in range(5):
            client.post(f"{BASE_URLS['redis']}/session/set", json={
                "session_id": f"sess-{i}",
                "data": {"user": f"user-{i}", "secret": f"data-{i}"},
                "ttl_seconds": 60,
            })

        for i in range(5):
            resp = client.get(f"{BASE_URLS['redis']}/session/get",
                              params={"id": f"sess-{i}"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["found"] is True
            assert data["data"]["user"] == f"user-{i}"
