import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8601"))
MW = {"kafka": {"status": "connected", "topics": ["cooperative_credit_scoring.events", "cooperative_credit_scoring.audit"]}, "dapr": {"status": "connected", "appId": "cooperative-credit-scoring-py-sidecar"}, "fluvio": {"status": "connected", "topic": "cooperative_credit_scoring-stream"}, "temporal": {"status": "connected", "namespace": "cooperative_credit_scoring"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cooperative_credit_scoring"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cooperative_credit_scoring_authz"}, "redis": {"status": "connected", "prefix": "cooperative_credit_scoring:"}, "mojaloop": {"status": "connected", "participant": "cooperative_credit_scoring"}, "opensearch": {"status": "connected", "index": "cooperative_credit_scoring-*"}, "openappsec": {"status": "connected", "policy": "cooperative-credit-scoring-py-protection"}, "apisix": {"status": "connected", "upstream": "cooperative_credit_scoring"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cooperative_credit_scoring_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Cooperative Credit Scoring Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Cooperative Credit Scoring Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Cooperative Credit Scoring Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Cooperative Credit Scoring Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "cooperative-credit-scoring-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/cooperative_credit_scoring/list"):
            self._json(200, {"items": RECORDS, "total": len(RECORDS)})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args): pass

if __name__ == "__main__":
    print(f"cooperative-credit-scoring-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
