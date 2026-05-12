import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "NDPR-001",
    "type": "dsar",
    "subject": "customer-12345",
    "requestType": "access",
    "status": "completed",
    "receivedAt": "2026-05-01T10:00:00Z",
    "completedAt": "2026-05-05T14:00:00Z",
    "responseTimeDays": 4,
    "slaDeadlineDays": 30,
    "dataCategories": [
      "personal",
      "financial",
      "transaction"
    ],
    "dpo": "Adaeze Okonkwo"
  },
  {
    "id": "NDPR-002",
    "type": "dsar",
    "subject": "customer-67890",
    "requestType": "erasure",
    "status": "in_progress",
    "receivedAt": "2026-05-07T08:00:00Z",
    "completedAt": "",
    "responseTimeDays": 0,
    "slaDeadlineDays": 30,
    "dataCategories": [
      "personal",
      "marketing"
    ],
    "dpo": "Adaeze Okonkwo"
  },
  {
    "id": "NDPR-003",
    "type": "consent",
    "subject": "all_customers",
    "requestType": "consent_audit",
    "status": "completed",
    "receivedAt": "2026-04-01T00:00:00Z",
    "completedAt": "2026-04-15T00:00:00Z",
    "responseTimeDays": 14,
    "slaDeadlineDays": 0,
    "dataCategories": [
      "marketing",
      "analytics",
      "third_party_sharing"
    ],
    "dpo": "Adaeze Okonkwo"
  },
  {
    "id": "NDPR-004",
    "type": "breach_notification",
    "subject": "incident-2026-001",
    "requestType": "nitda_notification",
    "status": "filed",
    "receivedAt": "2026-03-15T16:00:00Z",
    "completedAt": "2026-03-15T18:00:00Z",
    "responseTimeDays": 0,
    "slaDeadlineDays": 3,
    "dataCategories": [
      "personal"
    ],
    "dpo": "Adaeze Okonkwo"
  },
  {
    "id": "NDPR-005",
    "type": "data_inventory",
    "subject": "platform_audit",
    "requestType": "annual_review",
    "status": "in_progress",
    "receivedAt": "2026-01-01T00:00:00Z",
    "completedAt": "",
    "responseTimeDays": 0,
    "slaDeadlineDays": 365,
    "dataCategories": [
      "all"
    ],
    "dpo": "Adaeze Okonkwo"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.ndpr.compliance.py"
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
    "appId": "ndpr-compliance-py"
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
            self._json(200, {"service": "ndpr-compliance-py", "status": "healthy", "version": "1.0.0", "description": "Nigeria Data Protection Regulation, DSAR workflow, consent management, data inventory, DPO dashboard", "middleware": MIDDLEWARE})
        elif self.path == "/v1/ndpr-compliance/list":
            self._json(200, {"total": len(ITEMS), "ndpr_records": ITEMS})
        elif self.path == "/v1/ndpr-compliance/stats":
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
    port = int(os.environ.get("PORT", "8517"))
    print(f"NDPR Compliance Engine listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
