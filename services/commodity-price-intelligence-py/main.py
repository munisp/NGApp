import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8599"))
MW = {"kafka": {"status": "connected", "topics": ["commodity_price_intelligence.events", "commodity_price_intelligence.audit"]}, "dapr": {"status": "connected", "appId": "commodity-price-intelligence-py-sidecar"}, "fluvio": {"status": "connected", "topic": "commodity_price_intelligence-stream"}, "temporal": {"status": "connected", "namespace": "commodity_price_intelligence"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "commodity_price_intelligence"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "commodity_price_intelligence_authz"}, "redis": {"status": "connected", "prefix": "commodity_price_intelligence:"}, "mojaloop": {"status": "connected", "participant": "commodity_price_intelligence"}, "opensearch": {"status": "connected", "index": "commodity_price_intelligence-*"}, "openappsec": {"status": "connected", "policy": "commodity-price-intelligence-py-protection"}, "apisix": {"status": "connected", "upstream": "commodity_price_intelligence"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "commodity_price_intelligence_iceberg"}}

RECORDS = [
  {
    "id": "PRC-001",
    "commodity": "maize",
    "market": "Dawanau (Kano)",
    "pricePerKg": 450,
    "pricePerTonne": 450000,
    "trend": "rising",
    "change7dPct": 3.2,
    "volumeTonnes": 500,
    "grade": "Grade 1",
    "source": "NCX"
  },
  {
    "id": "PRC-002",
    "commodity": "rice_paddy",
    "market": "Ofada (Ogun)",
    "pricePerKg": 780,
    "pricePerTonne": 780000,
    "trend": "stable",
    "change7dPct": 0.5,
    "volumeTonnes": 200,
    "grade": "Grade A",
    "source": "AFEX"
  },
  {
    "id": "PRC-003",
    "commodity": "soybean",
    "market": "Makurdi (Benue)",
    "pricePerKg": 650,
    "pricePerTonne": 650000,
    "trend": "falling",
    "change7dPct": -2.1,
    "volumeTonnes": 120,
    "grade": "Grade A",
    "source": "NCX"
  },
  {
    "id": "PRC-004",
    "commodity": "cocoa",
    "market": "Ikom (Cross River)",
    "pricePerKg": 4500,
    "pricePerTonne": 4500000,
    "trend": "rising",
    "change7dPct": 5.8,
    "volumeTonnes": 30,
    "grade": "Export",
    "source": "SABEX"
  },
  {
    "id": "PRC-005",
    "commodity": "groundnut",
    "market": "Kano Central",
    "pricePerKg": 950,
    "pricePerTonne": 950000,
    "trend": "stable",
    "change7dPct": 1.0,
    "volumeTonnes": 300,
    "grade": "Grade 1",
    "source": "NCX"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "commodity-price-intelligence-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/commodity_price_intelligence/list"):
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
    print(f"commodity-price-intelligence-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
