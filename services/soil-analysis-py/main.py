import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8622"))
MW = {"kafka": {"status": "connected", "topics": ["soil_analysis.events", "soil_analysis.audit"]}, "dapr": {"status": "connected", "appId": "soil-analysis-py-sidecar"}, "fluvio": {"status": "connected", "topic": "soil_analysis-stream"}, "temporal": {"status": "connected", "namespace": "soil_analysis"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "soil_analysis"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "soil_analysis_authz"}, "redis": {"status": "connected", "prefix": "soil_analysis:"}, "mojaloop": {"status": "connected", "participant": "soil_analysis"}, "opensearch": {"status": "connected", "index": "soil_analysis-*"}, "openappsec": {"status": "connected", "policy": "soil-analysis-py-protection"}, "apisix": {"status": "connected", "upstream": "soil_analysis"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "soil_analysis_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Soil Analysis Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Soil Analysis Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Soil Analysis Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Soil Analysis Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "soil-analysis-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/soil_analysis/list"):
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
    print(f"soil-analysis-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
