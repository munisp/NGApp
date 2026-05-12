import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "COR-001",
    "name": "Brute Force \u2192 Account Takeover",
    "mitreIds": [
      "T1110",
      "T1078"
    ],
    "killChainPhase": "initial_access",
    "triggerEvents": [
      "auth.failed",
      "auth.lockout",
      "auth.success_after_lockout"
    ],
    "correlationWindow": "15m",
    "triggered24h": 23,
    "truePositives": 18,
    "falsePositives": 5,
    "status": "active"
  },
  {
    "id": "COR-002",
    "name": "Credential Stuffing Campaign",
    "mitreIds": [
      "T1110.004"
    ],
    "killChainPhase": "initial_access",
    "triggerEvents": [
      "auth.failed_multi_user",
      "same_source_ip"
    ],
    "correlationWindow": "5m",
    "triggered24h": 8,
    "truePositives": 7,
    "falsePositives": 1,
    "status": "active"
  },
  {
    "id": "COR-003",
    "name": "Lateral Movement Detection",
    "mitreIds": [
      "T1021"
    ],
    "killChainPhase": "lateral_movement",
    "triggerEvents": [
      "service.auth_new_source",
      "service.privilege_escalation"
    ],
    "correlationWindow": "30m",
    "triggered24h": 3,
    "truePositives": 2,
    "falsePositives": 1,
    "status": "active"
  },
  {
    "id": "COR-004",
    "name": "Data Exfiltration Pattern",
    "mitreIds": [
      "T1048"
    ],
    "killChainPhase": "exfiltration",
    "triggerEvents": [
      "api.bulk_export",
      "egress.high_volume",
      "unusual_destination"
    ],
    "correlationWindow": "1h",
    "triggered24h": 1,
    "truePositives": 1,
    "falsePositives": 0,
    "status": "active"
  },
  {
    "id": "COR-005",
    "name": "Insider Threat Indicators",
    "mitreIds": [
      "T1078",
      "T1530"
    ],
    "killChainPhase": "collection",
    "triggerEvents": [
      "admin.after_hours",
      "bulk_pii_access",
      "export.customer_data"
    ],
    "correlationWindow": "24h",
    "triggered24h": 2,
    "truePositives": 0,
    "falsePositives": 2,
    "status": "active"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.event.correlator.py"
    ]
  },
  "redis": {
    "url": "redis://redis:6379/0"
  },
  "postgres": {
    "url": "postgresql://postgres:54bank@postgres:5432/banking"
  },
  "opensearch": {
    "url": "https://opensearch:9200"
  },
  "keycloak": {
    "issuer": "https://auth.54bank.app/realms/54bank"
  },
  "permify": {
    "endpoint": "permify:3476"
  },
  "dapr": {
    "appId": "event-correlator-py"
  },
  "fluvio": {
    "endpoint": "fluvio:9003"
  },
  "temporal": {
    "namespace": "54bank-security"
  },
  "mojaloop": {
    "hub": "mojaloop:4000"
  },
  "tigerbeetle": {
    "cluster": "tigerbeetle:3000",
    "ledger": 27
  },
  "lakehouse": {
    "endpoint": "lakehouse:8080"
  },
  "apisix": {
    "admin": "apisix:9180"
  },
  "openappsec": {
    "endpoint": "openappsec:8090"
  }
}""")

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "event-correlator-py", "status": "healthy", "version": "1.0.0", "description": "Cross-service event correlation, attack chain detection, kill chain mapping, MITRE ATT&CK framework", "middleware": MIDDLEWARE})
        elif self.path == "/v1/event-correlator/list":
            self._json(200, {"total": len(ITEMS), "correlation_rules": ITEMS})
        elif self.path == "/v1/event-correlator/stats":
            status_map = {}
            for item in ITEMS:
                s = item.get("status", "unknown")
                status_map[s] = status_map.get(s, 0) + 1
            self._json(200, {"total": len(ITEMS), "byStatus": status_map})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        ITEMS.append(body)
        self._json(201, body)

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8509"))
    print(f"Security Event Correlator listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
