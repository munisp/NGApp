import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "AD-001",
    "name": "Login Behavior Classifier",
    "type": "isolation_forest",
    "features": [
      "login_hour",
      "geo_location",
      "device_type",
      "typing_speed",
      "session_duration"
    ],
    "accuracy": 96.5,
    "precision": 94.2,
    "recall": 92.8,
    "f1Score": 93.5,
    "trainingSize": 5000000,
    "anomalies24h": 234,
    "truePositives": 198,
    "status": "production"
  },
  {
    "id": "AD-002",
    "name": "Impossible Travel Detector",
    "type": "geo_velocity",
    "features": [
      "lat",
      "lon",
      "timestamp",
      "speed_kmh"
    ],
    "accuracy": 99.1,
    "precision": 97.8,
    "recall": 96.5,
    "f1Score": 97.1,
    "trainingSize": 2000000,
    "anomalies24h": 45,
    "truePositives": 42,
    "status": "production"
  },
  {
    "id": "AD-003",
    "name": "Credential Stuffing Detector",
    "type": "ensemble",
    "features": [
      "source_ip",
      "user_agent",
      "failure_rate",
      "attempt_velocity",
      "target_diversity"
    ],
    "accuracy": 98.3,
    "precision": 96.1,
    "recall": 95.7,
    "f1Score": 95.9,
    "trainingSize": 1000000,
    "anomalies24h": 8,
    "truePositives": 7,
    "status": "production"
  },
  {
    "id": "AD-004",
    "name": "Device Risk Scorer",
    "type": "gradient_boost",
    "features": [
      "fingerprint_stability",
      "vpn_detected",
      "tor_detected",
      "emulator_detected",
      "root_detected"
    ],
    "accuracy": 95.8,
    "precision": 93.5,
    "recall": 91.2,
    "f1Score": 92.3,
    "trainingSize": 3000000,
    "anomalies24h": 567,
    "truePositives": 489,
    "status": "production"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.anomaly.detector.py"
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
    "appId": "anomaly-detector-py"
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
            self._json(200, {"service": "anomaly-detector-py", "status": "healthy", "version": "1.0.0", "description": "ML-based login anomaly detection, credential stuffing detection, impossible travel, device risk scoring", "middleware": MIDDLEWARE})
        elif self.path == "/v1/anomaly-detector/list":
            self._json(200, {"total": len(ITEMS), "anomaly_models": ITEMS})
        elif self.path == "/v1/anomaly-detector/stats":
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
    port = int(os.environ.get("PORT", "8516"))
    print(f"Auth Anomaly Detector listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
