"""
Integration test suite for all 12 middleware services.
Run with: pytest tests/integration_test.py -v
Requires: docker-compose.services.yml running
"""

import os
import time

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


class TestHealthChecks:
    @pytest.mark.parametrize("service", BASE_URLS.keys())
    def test_health_endpoint(self, client, service):
        resp = client.get(f"{BASE_URLS[service]}/health")
        assert resp.status_code == 200 or resp.status_code == 503
        data = resp.json()
        assert isinstance(data, dict)


class TestKafkaService:
    url = BASE_URLS["kafka"]

    def test_list_topics(self, client):
        resp = client.get(f"{self.url}/topics")
        assert resp.status_code == 200
        topics = resp.json()
        assert isinstance(topics, list)
        assert len(topics) > 0

    def test_produce_message(self, client):
        resp = client.post(f"{self.url}/produce", json={
            "topic": "transactions.created",
            "key": "tx-001",
            "value": {"amount": 100.00, "currency": "USD"},
            "headers": {"source": "test"}
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "produced"

    def test_get_dlq(self, client):
        resp = client.get(f"{self.url}/dlq")
        assert resp.status_code == 200

    def test_get_metrics(self, client):
        resp = client.get(f"{self.url}/metrics")
        assert resp.status_code == 200


class TestRedisService:
    url = BASE_URLS["redis"]

    def test_cache_set_get(self, client):
        client.post(f"{self.url}/cache/set", json={
            "namespace": "test", "key": "k1", "value": "v1", "ttl_seconds": 60, "tags": ["test"]
        })
        resp = client.get(f"{self.url}/cache/get", params={"namespace": "test", "key": "k1"})
        assert resp.status_code == 200
        assert resp.json()["found"] is True
        assert resp.json()["value"] == "v1"

    def test_session_management(self, client):
        client.post(f"{self.url}/session/set", json={
            "session_id": "sess-1", "data": {"user": "test"}, "ttl_seconds": 300
        })
        resp = client.get(f"{self.url}/session/get", params={"id": "sess-1"})
        assert resp.status_code == 200
        assert resp.json()["found"] is True

    def test_rate_limiting(self, client):
        resp = client.post(f"{self.url}/ratelimit/check", json={
            "identifier": "test-user", "max_requests": 10, "window_seconds": 60
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "allowed" in data

    def test_distributed_lock(self, client):
        resp = client.post(f"{self.url}/lock/acquire", json={
            "resource": "test-lock", "ttl_seconds": 30
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "acquired" in data
        if data["acquired"]:
            client.post(f"{self.url}/lock/release", json={
                "resource": "test-lock", "lock_id": data["lock_id"]
            })

    def test_pubsub(self, client):
        resp = client.post(f"{self.url}/pubsub/publish", json={
            "channel": "test-channel", "message": "hello"
        })
        assert resp.status_code == 200

    def test_stats(self, client):
        resp = client.get(f"{self.url}/stats")
        assert resp.status_code == 200


class TestTigerBeetleService:
    url = BASE_URLS["tigerbeetle"]

    def test_create_account(self, client):
        resp = client.post(f"{self.url}/accounts/create", json={
            "id": "test-acct-1", "ledger": 1, "code": 100
        })
        assert resp.status_code == 200

    def test_lookup_account(self, client):
        client.post(f"{self.url}/accounts/create", json={"id": "lookup-acct", "ledger": 1, "code": 100})
        resp = client.get(f"{self.url}/accounts/lookup", params={"id": "lookup-acct"})
        assert resp.status_code == 200

    def test_create_transfer(self, client):
        client.post(f"{self.url}/accounts/create", json={"id": "src-acct", "ledger": 1, "code": 100})
        client.post(f"{self.url}/accounts/create", json={"id": "dst-acct", "ledger": 1, "code": 100})
        resp = client.post(f"{self.url}/transfers/create", json={
            "debit_account_id": "src-acct", "credit_account_id": "dst-acct", "amount": 5000, "ledger": 1, "code": 1
        })
        assert resp.status_code == 200

    def test_two_phase_transfer(self, client):
        resp = client.post(f"{self.url}/transfers/two-phase", json={
            "debit_account_id": "src-acct", "credit_account_id": "dst-acct", "amount": 1000, "ledger": 1, "code": 1, "timeout": 300
        })
        assert resp.status_code == 200
        if "pending_id" in resp.json():
            pid = resp.json()["pending_id"]
            client.post(f"{self.url}/transfers/confirm", json={"pending_id": pid})

    def test_get_balance(self, client):
        resp = client.get(f"{self.url}/balances", params={"account_id": "src-acct"})
        assert resp.status_code == 200

    def test_reconcile(self, client):
        resp = client.post(f"{self.url}/ledger/reconcile")
        assert resp.status_code == 200


class TestAPISIXService:
    url = BASE_URLS["apisix"]

    def test_list_routes(self, client):
        resp = client.get(f"{self.url}/routes")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_route(self, client):
        resp = client.post(f"{self.url}/routes", json={
            "id": "test-route", "uri": "/test/*", "upstream_id": "backend-api",
            "methods": ["GET"], "plugins": {}
        })
        assert resp.status_code == 200

    def test_list_upstreams(self, client):
        resp = client.get(f"{self.url}/upstreams")
        assert resp.status_code == 200

    def test_list_plugins(self, client):
        resp = client.get(f"{self.url}/plugins")
        assert resp.status_code == 200


class TestTemporalService:
    url = BASE_URLS["temporal"]

    def test_start_workflow(self, client):
        resp = client.post(f"{self.url}/workflows/start", json={
            "workflow_type": "payment.process",
            "input_data": {"amount": 100, "currency": "USD"}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "workflow_id" in data

    def test_list_workflows(self, client):
        resp = client.get(f"{self.url}/workflows")
        assert resp.status_code == 200

    def test_list_task_queues(self, client):
        resp = client.get(f"{self.url}/task-queues")
        assert resp.status_code == 200


class TestFluvioService:
    url = BASE_URLS["fluvio"]

    def test_list_topics(self, client):
        resp = client.get(f"{self.url}/topics")
        assert resp.status_code == 200

    def test_produce(self, client):
        resp = client.post(f"{self.url}/produce", json={
            "topic": "transaction-stream", "key": "tx-1", "value": {"test": True}
        })
        assert resp.status_code == 200

    def test_smart_modules(self, client):
        resp = client.get(f"{self.url}/smartmodules")
        assert resp.status_code == 200


class TestOpenAppSecService:
    url = BASE_URLS["openappsec"]

    def test_scan_clean(self, client):
        resp = client.post(f"{self.url}/scan", json={
            "method": "GET", "path": "/api/accounts", "body": "", "headers": {}
        })
        assert resp.status_code == 200
        assert resp.json()["blocked"] is False

    def test_scan_sqli(self, client):
        resp = client.post(f"{self.url}/scan", json={
            "method": "POST", "path": "/api/login",
            "body": "username=admin' OR 1=1--", "headers": {}
        })
        assert resp.status_code == 200
        assert resp.json()["blocked"] is True

    def test_list_policies(self, client):
        resp = client.get(f"{self.url}/policies")
        assert resp.status_code == 200

    def test_list_threats(self, client):
        resp = client.get(f"{self.url}/threats")
        assert resp.status_code == 200


class TestKubernetesService:
    url = BASE_URLS["kubernetes"]

    def test_list_namespaces(self, client):
        resp = client.get(f"{self.url}/namespaces")
        assert resp.status_code == 200

    def test_list_deployments(self, client):
        resp = client.get(f"{self.url}/deployments")
        assert resp.status_code == 200

    def test_list_pods(self, client):
        resp = client.get(f"{self.url}/pods")
        assert resp.status_code == 200

    def test_cluster_metrics(self, client):
        resp = client.get(f"{self.url}/metrics/cluster")
        assert resp.status_code == 200

    def test_list_nodes(self, client):
        resp = client.get(f"{self.url}/nodes")
        assert resp.status_code == 200


class TestPermifyService:
    url = BASE_URLS["permify"]

    def test_get_schema(self, client):
        resp = client.get(f"{self.url}/schema")
        assert resp.status_code == 200

    def test_check_permission(self, client):
        resp = client.post(f"{self.url}/permissions/check", json={
            "entity_type": "account", "entity_id": "acct-checking-1",
            "permission": "view", "subject_type": "user", "subject_id": "user-1"
        })
        assert resp.status_code == 200
        assert "allowed" in resp.json()

    def test_list_relationships(self, client):
        resp = client.get(f"{self.url}/relationships")
        assert resp.status_code == 200


class TestLakehouseService:
    url = BASE_URLS["lakehouse"]

    def test_list_tables(self, client):
        resp = client.get(f"{self.url}/tables")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    def test_list_prebuilt_queries(self, client):
        resp = client.get(f"{self.url}/queries/prebuilt")
        assert resp.status_code == 200

    def test_execute_query(self, client):
        resp = client.post(f"{self.url}/query", json={
            "sql": "SELECT 1 as test"
        })
        assert resp.status_code == 200

    def test_storage_buckets(self, client):
        resp = client.get(f"{self.url}/storage/buckets")
        assert resp.status_code == 200


class TestKeycloakService:
    url = BASE_URLS["keycloak"]

    def test_login(self, client):
        resp = client.post(f"{self.url}/auth/login", json={
            "username": "john.doe", "password": "User123!"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    def test_register(self, client):
        resp = client.post(f"{self.url}/auth/register", json={
            "username": f"test-{int(time.time())}", "email": f"test-{int(time.time())}@test.com",
            "password": "TestPass123!", "first_name": "Test", "last_name": "User"
        })
        assert resp.status_code == 200

    def test_token_refresh(self, client):
        login = client.post(f"{self.url}/auth/login", json={
            "username": "john.doe", "password": "User123!"
        })
        if login.status_code == 200:
            refresh = login.json()["refresh_token"]
            resp = client.post(f"{self.url}/auth/refresh", json={"refresh_token": refresh})
            assert resp.status_code == 200

    def test_userinfo(self, client):
        login = client.post(f"{self.url}/auth/login", json={
            "username": "john.doe", "password": "User123!"
        })
        if login.status_code == 200:
            token = login.json()["access_token"]
            resp = client.get(f"{self.url}/auth/userinfo", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200

    def test_list_users(self, client):
        resp = client.get(f"{self.url}/users")
        assert resp.status_code == 200

    def test_list_roles(self, client):
        resp = client.get(f"{self.url}/roles")
        assert resp.status_code == 200

    def test_openid_config(self, client):
        resp = client.get(f"{self.url}/.well-known/openid-configuration")
        assert resp.status_code == 200
        data = resp.json()
        assert "issuer" in data
        assert "authorization_endpoint" in data


class TestDaprService:
    url = BASE_URLS["dapr"]

    def test_state_set_get(self, client):
        client.post(f"{self.url}/state/set", json={
            "store_name": "statestore", "key": "test-key", "value": {"data": "test"}
        })
        resp = client.get(f"{self.url}/state/get/statestore/test-key")
        assert resp.status_code == 200

    def test_pubsub_publish(self, client):
        resp = client.post(f"{self.url}/pubsub/publish", json={
            "pubsub_name": "pubsub-kafka", "topic": "test-topic", "data": {"msg": "hello"}
        })
        assert resp.status_code == 200

    def test_service_invoke(self, client):
        resp = client.post(f"{self.url}/invoke", json={
            "app_id": "backend-api", "method": "health", "http_method": "GET"
        })
        assert resp.status_code == 200

    def test_list_components(self, client):
        resp = client.get(f"{self.url}/components")
        assert resp.status_code == 200


class TestEndToEndWorkflows:
    def test_payment_flow(self, client):
        login = client.post(f"{BASE_URLS['keycloak']}/auth/login", json={
            "username": "john.doe", "password": "User123!"
        })
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        perm = client.post(f"{BASE_URLS['permify']}/permissions/check", json={
            "entity_type": "account", "entity_id": "acct-checking-1",
            "permission": "view", "subject_type": "user", "subject_id": "user-1"
        })
        assert perm.status_code == 200

        scan = client.post(f"{BASE_URLS['openappsec']}/scan", json={
            "method": "POST", "path": "/api/payments",
            "body": '{"amount": 100}', "headers": {}
        })
        assert scan.status_code == 200
        assert scan.json()["blocked"] is False

        wf = client.post(f"{BASE_URLS['temporal']}/workflows/start", json={
            "workflow_type": "payment.process",
            "input_data": {"amount": 100, "currency": "USD", "from": "acct-1", "to": "acct-2"}
        })
        assert wf.status_code == 200

        client.post(f"{BASE_URLS['kafka']}/produce", json={
            "topic": "payments.initiated",
            "key": wf.json()["workflow_id"],
            "value": {"amount": 100, "status": "initiated"}
        })

        client.post(f"{BASE_URLS['redis']}/cache/set", json={
            "namespace": "payments", "key": wf.json()["workflow_id"],
            "value": "processing", "ttl_seconds": 300
        })

    def test_kyc_flow(self, client):
        wf = client.post(f"{BASE_URLS['temporal']}/workflows/start", json={
            "workflow_type": "kyc.verification",
            "input_data": {"user_id": "user-1", "document_type": "passport"}
        })
        assert wf.status_code == 200

        client.post(f"{BASE_URLS['kafka']}/produce", json={
            "topic": "kyc.submitted",
            "key": "user-1",
            "value": {"workflow_id": wf.json()["workflow_id"]}
        })

    def test_account_onboarding_flow(self, client):
        reg = client.post(f"{BASE_URLS['keycloak']}/auth/register", json={
            "username": f"newuser-{int(time.time())}",
            "email": f"newuser-{int(time.time())}@test.com",
            "password": "SecurePass123!",
            "first_name": "New", "last_name": "User"
        })
        assert reg.status_code == 200
        user_id = reg.json()["user_id"]

        wf = client.post(f"{BASE_URLS['temporal']}/workflows/start", json={
            "workflow_type": "account.onboarding",
            "input_data": {"user_id": user_id}
        })
        assert wf.status_code == 200

        client.post(f"{BASE_URLS['permify']}/relationships/write", json={
            "entity_type": "account", "entity_id": f"acct-{user_id}",
            "relation": "owner", "subject_type": "user", "subject_id": user_id
        })
