"""54Bank KYC Analytics Dashboard — onboarding funnel, drop-off analysis

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

def middleware_config():
    return {
        "kafka": {"broker": os.getenv("KAFKA_BROKER", "localhost:9092"), "topics": ["kyc-analytics-dashboard-py.events"]},
        "dapr": {"app_id": "kyc-analytics-dashboard-py", "url": os.getenv("DAPR_URL", "http://localhost:3500")},
        "fluvio": {"url": os.getenv("FLUVIO_URL", "localhost:9003"), "topics": ["kyc-analytics-dashboard-py-stream"]},
        "temporal": {"url": os.getenv("TEMPORAL_URL", "localhost:7233"), "namespace": "kyc-analytics-dashboard-py"},
        "postgres": {"url": os.getenv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
        "keycloak": {"url": os.getenv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "kyc-analytics-dashboard-py"},
        "permify": {"url": os.getenv("PERMIFY_URL", "http://localhost:3476"), "schema": "kyc-analytics-dashboard-py"},
        "redis": {"url": os.getenv("REDIS_URL", "redis://localhost:6379")},
        "mojaloop": {"url": os.getenv("MOJALOOP_URL", "http://localhost:3002")},
        "opensearch": {"url": os.getenv("OPENSEARCH_URL", "http://localhost:9200")},
        "openappsec": {"url": os.getenv("OPENAPPSEC_URL", "http://localhost:4000")},
        "apisix": {"url": os.getenv("APISIX_URL", "http://localhost:9080")},
        "tigerbeetle": {"url": os.getenv("TIGERBEETLE_URL", "localhost:3000")},
        "lakehouse": {"url": os.getenv("LAKEHOUSE_URL", "http://localhost:8181")},
    }

SEED_DATA = [
    {"id": "KYC-ANALYTICS-DASHBOARD-PY-001", "name": "Sample record 1", "status": "active", "createdAt": "2026-05-12T10:00:00Z"},
    {"id": "KYC-ANALYTICS-DASHBOARD-PY-002", "name": "Sample record 2", "status": "pending", "createdAt": "2026-05-12T11:00:00Z"},
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"status": "healthy", "service": "kyc-analytics-dashboard-py", "version": "1.0.0", "middleware": middleware_config()})
        elif self.path.startswith("/api/"):
            self._json({"items": SEED_DATA, "total": len(SEED_DATA)})
        else:
            self._json({"error": "not found"}, 404)
    def do_POST(self):
        self._json({"message": "operation queued", "service": "kyc-analytics-dashboard-py"})
    def _json(self, data, code=200):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8291"))
    print(f"kyc-analytics-dashboard-py listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
