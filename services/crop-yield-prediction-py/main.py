import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8609"))
MW = {"kafka": {"status": "connected", "topics": ["crop_yield_prediction.events", "crop_yield_prediction.audit"]}, "dapr": {"status": "connected", "appId": "crop-yield-prediction-py-sidecar"}, "fluvio": {"status": "connected", "topic": "crop_yield_prediction-stream"}, "temporal": {"status": "connected", "namespace": "crop_yield_prediction"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "crop_yield_prediction"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "crop_yield_prediction_authz"}, "redis": {"status": "connected", "prefix": "crop_yield_prediction:"}, "mojaloop": {"status": "connected", "participant": "crop_yield_prediction"}, "opensearch": {"status": "connected", "index": "crop_yield_prediction-*"}, "openappsec": {"status": "connected", "policy": "crop-yield-prediction-py-protection"}, "apisix": {"status": "connected", "upstream": "crop_yield_prediction"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "crop_yield_prediction_iceberg"}}

RECORDS = [
  {
    "id": "REC-001",
    "name": "Crop Yield Prediction Record 1",
    "category": "primary",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos"
  },
  {
    "id": "REC-002",
    "name": "Crop Yield Prediction Record 2",
    "category": "primary",
    "status": "active",
    "amount": 2500000,
    "region": "Kano"
  },
  {
    "id": "REC-003",
    "name": "Crop Yield Prediction Record 3",
    "category": "secondary",
    "status": "pending",
    "amount": 500000,
    "region": "Benue"
  },
  {
    "id": "REC-004",
    "name": "Crop Yield Prediction Record 4",
    "category": "secondary",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo"
  }
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "crop-yield-prediction-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/crop_yield_prediction/list"):
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
    print(f"crop-yield-prediction-py listening on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
