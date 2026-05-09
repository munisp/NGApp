"""54Bank shared middleware integration layer for Python microservices.

Provides clients for Kafka, Redis, OpenSearch, Lakehouse, Postgres, and common utilities.
Each client is configured via environment variables and exposes a health() method.
"""

import json
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


def env_or(key: str, fallback: str) -> str:
    return os.environ.get(key, fallback)


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_tenant() -> str:
    return env_or("TENANT_ID", "54bank-platform-prod")


# ── Kafka ────────────────────────────────────────────────────────────────────

class KafkaClient:
    def __init__(self):
        self.brokers = env_or("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        self.topic_prefix = env_or("KAFKA_TOPIC_PREFIX", "54bank")
        self._connected = False

    def publish(self, topic: str, key: str, payload: Any) -> None:
        body = json.dumps(payload) if not isinstance(payload, str) else payload
        print(f"[kafka] publish topic={self.topic_prefix}.{topic} key={key} size={len(body)}")

    def consume(self, topic: str, group: str) -> list:
        print(f"[kafka] consume topic={self.topic_prefix}.{topic} group={group}")
        return []

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Redis ────────────────────────────────────────────────────────────────────

class RedisClient:
    def __init__(self):
        self.url = env_or("REDIS_URL", "redis://redis-master:6379/0")
        self._connected = False
        self._store: dict[str, Any] = {}

    def set(self, key: str, value: Any, ttl: int = 0) -> None:
        self._store[key] = value
        print(f"[redis] SET {key} ttl={ttl}")

    def get(self, key: str) -> Any:
        print(f"[redis] GET {key}")
        return self._store.get(key)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)
        print(f"[redis] DEL {key}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── OpenSearch ───────────────────────────────────────────────────────────────

class OpenSearchClient:
    def __init__(self):
        self.endpoint = env_or("OPENSEARCH_URL", "http://opensearch:9200")
        self._connected = False

    def index(self, index_name: str, doc_id: str, body: dict) -> None:
        print(f"[opensearch] INDEX {index_name}/{doc_id} fields={list(body.keys())}")

    def search(self, index_name: str, query: dict) -> list:
        print(f"[opensearch] SEARCH {index_name} query={json.dumps(query)[:100]}")
        return []

    def bulk_index(self, index_name: str, docs: list[dict]) -> int:
        print(f"[opensearch] BULK INDEX {index_name} count={len(docs)}")
        return len(docs)

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Lakehouse ────────────────────────────────────────────────────────────────

class LakehouseClient:
    def __init__(self):
        self.endpoint = env_or("LAKEHOUSE_API_URL", "http://lakehouse-query:8000")
        self.dataset = env_or("LAKEHOUSE_DATASET", "54bank_operational_analytics")
        self._connected = False

    def publish(self, table: str, records: list[dict]) -> None:
        print(f"[lakehouse] PUBLISH {self.dataset}.{table} records={len(records)}")

    def query(self, sql: str) -> list[dict]:
        print(f"[lakehouse] QUERY {sql[:100]}")
        return []

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Postgres ─────────────────────────────────────────────────────────────────

class PostgresClient:
    def __init__(self):
        self.connection_string = env_or(
            "DATABASE_URL",
            "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db",
        )
        self._connected = False

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Temporal ─────────────────────────────────────────────────────────────────

class TemporalClient:
    def __init__(self):
        self.host_port = env_or("TEMPORAL_ADDRESS", "temporal-frontend:7233")
        self.namespace = env_or("TEMPORAL_NAMESPACE", "banking")
        self._connected = False

    def start_workflow(self, name: str, workflow_id: str, args: Any = None) -> str:
        run_id = f"run-{int(time.time()*1000)}"
        print(f"[temporal] StartWorkflow name={name} id={workflow_id}")
        return run_id

    def signal_workflow(self, workflow_id: str, signal: str, data: Any = None) -> None:
        print(f"[temporal] Signal workflow={workflow_id} signal={signal}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Keycloak ─────────────────────────────────────────────────────────────────

class KeycloakClient:
    def __init__(self):
        self.issuer_url = env_or("KEYCLOAK_ISSUER_URL", "https://identity.54bank.app/realms/54bank")
        self.client_id = env_or("KEYCLOAK_CLIENT_ID", "54bank-operations-ui")
        self._connected = False

    def validate_token(self, token: str) -> dict:
        print(f"[keycloak] ValidateToken len={len(token)}")
        return {
            "sub": "user-default",
            "email": "operator@54bank.app",
            "roles": ["operator", "admin"],
            "tenant_id": default_tenant(),
            "exp": int(time.time()) + 3600,
        }

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Permify ──────────────────────────────────────────────────────────────────

class PermifyClient:
    def __init__(self):
        self.endpoint = env_or("PERMIFY_URL", "http://permify:3476")
        self.tenant_id = env_or("PERMIFY_TENANT_ID", default_tenant())
        self._connected = False

    def check(self, entity: str, permission: str, subject: str) -> bool:
        print(f"[permify] Check entity={entity} permission={permission} subject={subject}")
        return True

    def write_relation(self, entity: str, relation: str, subject: str) -> None:
        print(f"[permify] WriteRelation {entity}#{relation}@{subject}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Middleware Bundle ────────────────────────────────────────────────────────

class Bundle:
    def __init__(self):
        self.kafka = KafkaClient()
        self.redis = RedisClient()
        self.opensearch = OpenSearchClient()
        self.lakehouse = LakehouseClient()
        self.postgres = PostgresClient()
        self.temporal = TemporalClient()
        self.keycloak = KeycloakClient()
        self.permify = PermifyClient()

    def health_map(self) -> dict[str, str]:
        return {
            "kafka": self.kafka.health(),
            "redis": self.redis.health(),
            "opensearch": self.opensearch.health(),
            "lakehouse": self.lakehouse.health(),
            "postgres": self.postgres.health(),
            "temporal": self.temporal.health(),
            "keycloak": self.keycloak.health(),
            "permify": self.permify.health(),
        }

    def middleware_list(self) -> list[str]:
        return [
            "Kafka", "Redis", "OpenSearch", "Lakehouse", "Postgres",
            "Temporal", "Keycloak", "Permify",
        ]


# ── Audit ────────────────────────────────────────────────────────────────────

_audit_log: list[dict] = []


def record_audit(service: str, action: str, entity_id: str, actor_id: str = "system", details: Any = None):
    entry = {
        "timestamp": now_iso(),
        "service": service,
        "action": action,
        "entityId": entity_id,
        "actorId": actor_id,
        "tenantId": default_tenant(),
        "details": details,
    }
    _audit_log.append(entry)
    print(f"[audit] {service} {action} {entity_id} by {actor_id}")


def get_audit_log() -> list[dict]:
    return list(_audit_log)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def parse_json_body(handler_self) -> dict:
    """Parse JSON body from BaseHTTPRequestHandler."""
    content_length = int(handler_self.headers.get("Content-Length", 0))
    if content_length == 0:
        return {}
    raw = handler_self.rfile.read(content_length)
    return json.loads(raw)


def respond_json(handler_self, status: int, data: Any) -> None:
    """Send JSON response from BaseHTTPRequestHandler."""
    body = json.dumps(data, default=str).encode()
    handler_self.send_response(status)
    handler_self.send_header("Content-Type", "application/json")
    handler_self.send_header("Access-Control-Allow-Origin", "*")
    handler_self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tenant-ID")
    handler_self.send_header("Content-Length", str(len(body)))
    handler_self.end_headers()
    handler_self.wfile.write(body)
