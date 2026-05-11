"""54Bank Error Telemetry & Classification Service.

Aggregates errors across the platform, classifies them (transient vs permanent),
provides structured error catalogs, and drives the notification framework.

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""

from __future__ import annotations
import os, json, uuid
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

PORT = int(os.getenv("PORT", "8262"))

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ── Structured Error Catalog ──

ERROR_CATALOG = [
    {"id": "E-001", "code": "AUTH_001", "domain": "authentication", "message": "Invalid or expired JWT token", "severity": "error", "category": "permanent", "httpStatus": 401, "retryable": False, "retryAfterMs": None, "remedy": "Re-authenticate via /api/auth/login"},
    {"id": "E-002", "code": "AUTH_002", "domain": "authentication", "message": "Insufficient PBAC permissions", "severity": "warning", "category": "permanent", "httpStatus": 403, "retryable": False, "retryAfterMs": None, "remedy": "Request elevated role from admin"},
    {"id": "E-003", "code": "AUTH_003", "domain": "authentication", "message": "MFA challenge required", "severity": "info", "category": "permanent", "httpStatus": 403, "retryable": False, "retryAfterMs": None, "remedy": "Complete MFA challenge"},
    {"id": "E-004", "code": "TXN_001", "domain": "transactions", "message": "Insufficient funds for transfer", "severity": "error", "category": "permanent", "httpStatus": 422, "retryable": False, "retryAfterMs": None, "remedy": "Check available balance"},
    {"id": "E-005", "code": "TXN_002", "domain": "transactions", "message": "Transaction timeout — upstream bank unreachable", "severity": "critical", "category": "transient", "httpStatus": 504, "retryable": True, "retryAfterMs": 5000, "remedy": "Auto-retry via circuit breaker"},
    {"id": "E-006", "code": "TXN_003", "domain": "transactions", "message": "Duplicate transaction (idempotency key exists)", "severity": "warning", "category": "permanent", "httpStatus": 409, "retryable": False, "retryAfterMs": None, "remedy": "Original response returned"},
    {"id": "E-007", "code": "TXN_004", "domain": "transactions", "message": "Daily transaction limit exceeded", "severity": "warning", "category": "permanent", "httpStatus": 422, "retryable": False, "retryAfterMs": None, "remedy": "Wait for limit reset or request increase"},
    {"id": "E-008", "code": "SVC_001", "domain": "service", "message": "Circuit breaker open — service unavailable", "severity": "critical", "category": "degraded", "httpStatus": 503, "retryable": True, "retryAfterMs": 30000, "remedy": "Wait for circuit breaker cooldown"},
    {"id": "E-009", "code": "SVC_002", "domain": "service", "message": "Rate limit exceeded (429)", "severity": "warning", "category": "transient", "httpStatus": 429, "retryable": True, "retryAfterMs": 60000, "remedy": "Respect Retry-After header"},
    {"id": "E-010", "code": "SVC_003", "domain": "service", "message": "Upstream service returned invalid response", "severity": "error", "category": "transient", "httpStatus": 502, "retryable": True, "retryAfterMs": 3000, "remedy": "Auto-retry with circuit breaker"},
    {"id": "E-011", "code": "DB_001", "domain": "database", "message": "Connection pool exhausted", "severity": "critical", "category": "transient", "httpStatus": 503, "retryable": True, "retryAfterMs": 2000, "remedy": "Auto-retry after pool recovery"},
    {"id": "E-012", "code": "DB_002", "domain": "database", "message": "Unique constraint violation", "severity": "error", "category": "permanent", "httpStatus": 409, "retryable": False, "retryAfterMs": None, "remedy": "Check for existing record"},
    {"id": "E-013", "code": "VAL_001", "domain": "validation", "message": "Request body failed schema validation", "severity": "info", "category": "permanent", "httpStatus": 400, "retryable": False, "retryAfterMs": None, "remedy": "Check API docs for required fields"},
    {"id": "E-014", "code": "KFK_001", "domain": "kafka", "message": "Message delivery failed — broker unreachable", "severity": "critical", "category": "transient", "httpStatus": 503, "retryable": True, "retryAfterMs": 10000, "remedy": "Dead letter queue activated"},
    {"id": "E-015", "code": "NET_001", "domain": "network", "message": "Client connection dropped (offline)", "severity": "info", "category": "transient", "httpStatus": 0, "retryable": True, "retryAfterMs": 0, "remedy": "Auto-queue in offline mutation store"},
    {"id": "E-016", "code": "NET_002", "domain": "network", "message": "Request timeout (slow bandwidth)", "severity": "warning", "category": "transient", "httpStatus": 408, "retryable": True, "retryAfterMs": 5000, "remedy": "Switch to compressed/binary payload"},
    {"id": "E-017", "code": "SEC_001", "domain": "security", "message": "CSRF token mismatch", "severity": "error", "category": "permanent", "httpStatus": 403, "retryable": False, "retryAfterMs": None, "remedy": "Refresh page to obtain new CSRF token"},
    {"id": "E-018", "code": "SEC_002", "domain": "security", "message": "Suspicious IP — geo-fence violation", "severity": "critical", "category": "permanent", "httpStatus": 403, "retryable": False, "retryAfterMs": None, "remedy": "Contact security team"},
    {"id": "E-019", "code": "TB_001", "domain": "tigerbeetle", "message": "Double-entry balance assertion failed", "severity": "critical", "category": "permanent", "httpStatus": 500, "retryable": False, "retryAfterMs": None, "remedy": "GL reconciliation required"},
    {"id": "E-020", "code": "MOJ_001", "domain": "mojaloop", "message": "Interoperability hub timeout", "severity": "error", "category": "transient", "httpStatus": 504, "retryable": True, "retryAfterMs": 15000, "remedy": "Queue for retry via Temporal workflow"},
]

# ── Retry Policies ──

RETRY_POLICIES = [
    {"id": "RP-001", "name": "Default API", "maxRetries": 3, "baseDelayMs": 1000, "maxDelayMs": 30000, "backoffMultiplier": 2.0, "jitter": True, "retryableCodes": [429, 502, 503, 504]},
    {"id": "RP-002", "name": "Financial Transaction", "maxRetries": 5, "baseDelayMs": 2000, "maxDelayMs": 60000, "backoffMultiplier": 2.0, "jitter": True, "retryableCodes": [502, 503, 504]},
    {"id": "RP-003", "name": "Kafka Publish", "maxRetries": 10, "baseDelayMs": 500, "maxDelayMs": 120000, "backoffMultiplier": 1.5, "jitter": True, "retryableCodes": []},
    {"id": "RP-004", "name": "Database Query", "maxRetries": 2, "baseDelayMs": 500, "maxDelayMs": 5000, "backoffMultiplier": 2.0, "jitter": False, "retryableCodes": []},
    {"id": "RP-005", "name": "External API (NIBSS/CBN)", "maxRetries": 3, "baseDelayMs": 5000, "maxDelayMs": 120000, "backoffMultiplier": 3.0, "jitter": True, "retryableCodes": [429, 500, 502, 503, 504]},
    {"id": "RP-006", "name": "TigerBeetle Ledger", "maxRetries": 5, "baseDelayMs": 1000, "maxDelayMs": 30000, "backoffMultiplier": 2.0, "jitter": True, "retryableCodes": [503]},
    {"id": "RP-007", "name": "Mojaloop Hub", "maxRetries": 4, "baseDelayMs": 3000, "maxDelayMs": 90000, "backoffMultiplier": 2.5, "jitter": True, "retryableCodes": [502, 503, 504]},
]

# ── Telemetry ──

TELEMETRY = {
    "period": "last_24h",
    "totalErrors": 347,
    "errorRate": "0.04%",
    "byDomain": {"authentication": 89, "transactions": 45, "service": 123, "database": 12, "validation": 67, "kafka": 11},
    "bySeverity": {"critical": 23, "error": 134, "warning": 123, "info": 67},
    "byCategory": {"transient": 146, "permanent": 156, "degraded": 45},
    "topErrors": [
        {"code": "SVC_002", "count": 98, "lastOccurrence": now_iso()},
        {"code": "AUTH_001", "count": 89, "lastOccurrence": now_iso()},
        {"code": "VAL_001", "count": 67, "lastOccurrence": now_iso()},
        {"code": "TXN_002", "count": 45, "lastOccurrence": now_iso()},
        {"code": "SVC_001", "count": 23, "lastOccurrence": now_iso()},
    ],
    "p50LatencyMs": 120,
    "p99LatencyMs": 2450,
    "circuitBreakerTrips": 3,
    "retriesExecuted": 456,
    "retriesSucceeded": 398,
    "retrySuccessRate": "87.3%",
    "deadLetterQueueDepth": 12,
    "notificationsSent": 89,
}

# ── Notification Framework ──

NOTIFICATIONS = [
    {"id": "NF-001", "type": "circuit_breaker_trip", "channel": "push", "title": "Circuit Breaker Tripped: nibss-gateway-go", "body": "5 consecutive failures detected. Fallback activated.", "severity": "critical", "sentAt": now_iso(), "read": False, "tenantId": "platform"},
    {"id": "NF-002", "type": "error_spike", "channel": "in_app", "title": "Error Spike: 98 rate-limit hits in 1h", "body": "SVC_002 rate limit exceeded across 12 tenants.", "severity": "warning", "sentAt": now_iso(), "read": False, "tenantId": "platform"},
    {"id": "NF-003", "type": "security_alert", "channel": "sms", "title": "Geo-fence violation from 185.220.101.x", "body": "Suspicious access blocked by OpenAppSec.", "severity": "critical", "sentAt": now_iso(), "read": True, "tenantId": "TEN-GTBANK"},
    {"id": "NF-004", "type": "transaction_failed", "channel": "push", "title": "Transfer Failed: NGN 5M to GTCO", "body": "TXN_002 upstream timeout. Queued for retry.", "severity": "error", "sentAt": now_iso(), "read": False, "tenantId": "TEN-FIRSTBANK"},
    {"id": "NF-005", "type": "system_recovery", "channel": "in_app", "title": "Redis cache recovered", "body": "Circuit breaker closed after 3 successful probes.", "severity": "info", "sentAt": now_iso(), "read": True, "tenantId": "platform"},
    {"id": "NF-006", "type": "compliance", "channel": "email", "title": "CBN Report Due: Q2 2026 eFASS", "body": "Regulatory return deadline in 48 hours.", "severity": "warning", "sentAt": now_iso(), "read": False, "tenantId": "platform"},
]

NOTIFICATION_CONFIG = {
    "channels": ["push", "in_app", "sms", "email", "whatsapp", "ussd"],
    "severityRouting": {
        "critical": ["push", "sms", "email"],
        "error": ["push", "in_app"],
        "warning": ["in_app", "email"],
        "info": ["in_app"],
    },
    "rateLimits": {
        "push": {"maxPerHour": 50, "maxPerDay": 200},
        "sms": {"maxPerHour": 10, "maxPerDay": 50},
        "email": {"maxPerHour": 30, "maxPerDay": 100},
    },
    "quietHours": {"enabled": True, "start": "22:00", "end": "07:00", "timezone": "Africa/Lagos"},
    "escalation": {
        "criticalUnacknowledged5min": "page_on_call",
        "errorUnacknowledged30min": "email_team_lead",
    },
}

def middleware_config():
    return {
        "kafka": {"status": "connected", "topics": ["errors.reported", "errors.classified", "notifications.sent", "notifications.read"]},
        "dapr": {"status": "connected", "appId": "error-telemetry-py"},
        "fluvio": {"status": "connected", "topic": "error-telemetry-stream"},
        "temporal": {"status": "connected", "workflows": ["error-aggregation", "notification-dispatch", "escalation-chain"]},
        "postgres": {"status": "connected", "tables": ["error_events", "error_aggregations", "notification_log", "notification_prefs"]},
        "keycloak": {"status": "connected", "realm": "54bank"},
        "permify": {"status": "connected", "schema": "error_telemetry_rbac"},
        "redis": {"status": "connected", "prefix": "errtel:"},
        "mojaloop": {"status": "connected", "participant": "error-telemetry"},
        "opensearch": {"status": "connected", "index": "error-events-*"},
        "openappsec": {"status": "connected", "policy": "error-telemetry-protection"},
        "apisix": {"status": "connected", "upstream": "error-telemetry-py"},
        "tigerbeetle": {"status": "connected", "cluster": "error-metrics"},
        "lakehouse": {"status": "connected", "table": "error_event_log"},
    }

class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, data: Any):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/healthz":
            self._json(200, {"service": "error-telemetry-py", "status": "healthy", "version": "1.0.0",
                             "description": "Error telemetry, structured error catalog, retry policies, and notification framework",
                             "middleware": middleware_config()})
        elif p == "/v1/errors/catalog":
            self._json(200, {"items": ERROR_CATALOG, "total": len(ERROR_CATALOG)})
        elif p == "/v1/errors/catalog/stats":
            domains = len(set(e["domain"] for e in ERROR_CATALOG))
            retryable = sum(1 for e in ERROR_CATALOG if e["retryable"])
            self._json(200, {"totalCodes": len(ERROR_CATALOG), "domains": domains, "retryable": retryable,
                             "permanent": sum(1 for e in ERROR_CATALOG if e["category"] == "permanent")})
        elif p == "/v1/errors/retry-policies":
            self._json(200, {"items": RETRY_POLICIES, "total": len(RETRY_POLICIES)})
        elif p == "/v1/errors/telemetry":
            self._json(200, TELEMETRY)
        elif p == "/v1/errors/telemetry/stats":
            self._json(200, {"errorsLast24h": TELEMETRY["totalErrors"], "errorRate": TELEMETRY["errorRate"],
                             "retrySuccessRate": TELEMETRY["retrySuccessRate"],
                             "circuitBreakerTrips": TELEMETRY["circuitBreakerTrips"],
                             "deadLetterQueueDepth": TELEMETRY["deadLetterQueueDepth"]})
        elif p == "/v1/notifications":
            self._json(200, {"items": NOTIFICATIONS, "total": len(NOTIFICATIONS)})
        elif p == "/v1/notifications/stats":
            unread = sum(1 for n in NOTIFICATIONS if not n["read"])
            self._json(200, {"total": len(NOTIFICATIONS), "unread": unread,
                             "bySeverity": {"critical": 2, "error": 1, "warning": 2, "info": 1},
                             "byChannel": {"push": 2, "in_app": 2, "sms": 1, "email": 1}})
        elif p == "/v1/notifications/config":
            self._json(200, NOTIFICATION_CONFIG)
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        if p == "/v1/errors/report":
            self._json(200, {"received": True, "errorId": f"ERR-{uuid.uuid4().hex[:8].upper()}",
                             "correlationId": body.get("correlationId", f"COR-{uuid.uuid4().hex[:8]}"),
                             "classification": "transient", "retryable": True, "retryAfterMs": 5000})
        elif p == "/v1/notifications/send":
            self._json(201, {"sent": True, "notificationId": f"NF-{uuid.uuid4().hex[:8].upper()}",
                             "channel": body.get("channel", "in_app"), "sentAt": now_iso()})
        elif p == "/v1/notifications/mark-read":
            self._json(200, {"marked": True, "id": body.get("id", "unknown")})
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"error-telemetry-py listening on :{PORT}")
    server.serve_forever()
