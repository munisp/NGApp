import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8618"))
MW = {"kafka": {"status": "connected", "topics": ["agri_esg_impact.events", "agri_esg_impact.audit"]}, "dapr": {"status": "connected", "appId": "agri-esg-impact-py-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_esg_impact-stream"}, "temporal": {"status": "connected", "namespace": "agri_esg_impact"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_esg_impact"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_esg_impact_authz"}, "redis": {"status": "connected", "prefix": "agri_esg_impact:"}, "mojaloop": {"status": "connected", "participant": "agri_esg_impact"}, "opensearch": {"status": "connected", "index": "agri_esg_impact-*"}, "openappsec": {"status": "connected", "policy": "agri-esg-impact-py-protection"}, "apisix": {"status": "connected", "upstream": "agri_esg_impact"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_esg_impact_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Agriculture ESG Impact Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Agriculture ESG Impact Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Agriculture ESG Impact Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Agriculture ESG Impact Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "agri-esg-impact-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/agri_esg_impact/list"):
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
    print(f"agri-esg-impact-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
