import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "SIEM-001",
    "name": "Splunk HEC Pipeline",
    "format": "splunk_hec",
    "destination": "https://splunk.54bank.app:8088",
    "eventsExported24h": 12000000,
    "avgLatencyMs": 45,
    "errorRate": 0.001,
    "batchSize": 1000,
    "compressionEnabled": true,
    "status": "active"
  },
  {
    "id": "SIEM-002",
    "name": "QRadar LEEF Pipeline",
    "format": "leef",
    "destination": "syslog://qradar.54bank.app:514",
    "eventsExported24h": 12000000,
    "avgLatencyMs": 12,
    "errorRate": 0.0005,
    "batchSize": 500,
    "compressionEnabled": false,
    "status": "active"
  },
  {
    "id": "SIEM-003",
    "name": "Elastic ECS Pipeline",
    "format": "ecs",
    "destination": "https://elastic.54bank.app:9200",
    "eventsExported24h": 12000000,
    "avgLatencyMs": 30,
    "errorRate": 0.002,
    "batchSize": 2000,
    "compressionEnabled": true,
    "status": "active"
  },
  {
    "id": "SIEM-004",
    "name": "CEF Syslog Pipeline",
    "format": "cef",
    "destination": "syslog://siem.54bank.app:6514",
    "eventsExported24h": 12000000,
    "avgLatencyMs": 8,
    "errorRate": 0.0001,
    "batchSize": 100,
    "compressionEnabled": false,
    "status": "standby"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.siem.exporter.py"
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
    "appId": "siem-exporter-py"
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
            self._json(200, {"service": "siem-exporter-py", "status": "healthy", "version": "1.0.0", "description": "Splunk HEC, QRadar LEEF, Elastic ECS, CEF export pipelines, real-time streaming, batch export", "middleware": MIDDLEWARE})
        elif self.path == "/v1/siem-exporter/list":
            self._json(200, {"total": len(ITEMS), "export_pipelines": ITEMS})
        elif self.path == "/v1/siem-exporter/stats":
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
    port = int(os.environ.get("PORT", "8523"))
    print(f"SIEM Exporter listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
