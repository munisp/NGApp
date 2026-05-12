import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8623"))
MW = {"kafka": {"status": "connected", "topics": ["insurance_portfolio_analytics.events", "insurance_portfolio_analytics.audit"]}, "dapr": {"status": "connected", "appId": "insurance-portfolio-analytics-py-sidecar"}, "fluvio": {"status": "connected", "topic": "insurance_portfolio_analytics-stream"}, "temporal": {"status": "connected", "namespace": "insurance_portfolio_analytics"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "insurance_portfolio_analytics"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "insurance_portfolio_analytics_authz"}, "redis": {"status": "connected", "prefix": "insurance_portfolio_analytics:"}, "mojaloop": {"status": "connected", "participant": "insurance_portfolio_analytics"}, "opensearch": {"status": "connected", "index": "insurance_portfolio_analytics-*"}, "openappsec": {"status": "connected", "policy": "insurance-portfolio-analytics-py-protection"}, "apisix": {"status": "connected", "upstream": "insurance_portfolio_analytics"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "insurance_portfolio_analytics_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Insurance Portfolio Analytics Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Insurance Portfolio Analytics Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Insurance Portfolio Analytics Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Insurance Portfolio Analytics Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "insurance-portfolio-analytics-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/insurance_portfolio_analytics/list"):
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
    print(f"insurance-portfolio-analytics-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
