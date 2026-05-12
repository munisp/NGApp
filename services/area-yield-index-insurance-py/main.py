import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8604"))
MW = {"kafka": {"status": "connected", "topics": ["area_yield_index_insurance.events", "area_yield_index_insurance.audit"]}, "dapr": {"status": "connected", "appId": "area-yield-index-insurance-py-sidecar"}, "fluvio": {"status": "connected", "topic": "area_yield_index_insurance-stream"}, "temporal": {"status": "connected", "namespace": "area_yield_index_insurance"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "area_yield_index_insurance"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "area_yield_index_insurance_authz"}, "redis": {"status": "connected", "prefix": "area_yield_index_insurance:"}, "mojaloop": {"status": "connected", "participant": "area_yield_index_insurance"}, "opensearch": {"status": "connected", "index": "area_yield_index_insurance-*"}, "openappsec": {"status": "connected", "policy": "area-yield-index-insurance-py-protection"}, "apisix": {"status": "connected", "upstream": "area_yield_index_insurance"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "area_yield_index_insurance_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Area Yield Index Insurance Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Area Yield Index Insurance Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Area Yield Index Insurance Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Area Yield Index Insurance Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "area-yield-index-insurance-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/area_yield_index_insurance/list"):
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
    print(f"area-yield-index-insurance-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
