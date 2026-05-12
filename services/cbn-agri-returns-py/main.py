import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8612"))
MW = {"kafka": {"status": "connected", "topics": ["cbn_agri_returns.events", "cbn_agri_returns.audit"]}, "dapr": {"status": "connected", "appId": "cbn-agri-returns-py-sidecar"}, "fluvio": {"status": "connected", "topic": "cbn_agri_returns-stream"}, "temporal": {"status": "connected", "namespace": "cbn_agri_returns"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cbn_agri_returns"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cbn_agri_returns_authz"}, "redis": {"status": "connected", "prefix": "cbn_agri_returns:"}, "mojaloop": {"status": "connected", "participant": "cbn_agri_returns"}, "opensearch": {"status": "connected", "index": "cbn_agri_returns-*"}, "openappsec": {"status": "connected", "policy": "cbn-agri-returns-py-protection"}, "apisix": {"status": "connected", "upstream": "cbn_agri_returns"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cbn_agri_returns_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "CBN Agricultural Returns Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "CBN Agricultural Returns Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "CBN Agricultural Returns Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "CBN Agricultural Returns Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "cbn-agri-returns-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/cbn_agri_returns/list"):
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
    print(f"cbn-agri-returns-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
