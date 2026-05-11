"""
Mojaloop Cross-Border Corridor Service
Port: 8270
Language: Python (corridor routing, compliance checks, FX conversion)
Middleware: Kafka, Redis, Postgres, TigerBeetle, Temporal, Mojaloop, Dapr, OpenSearch, Lakehouse
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8270"))

MIDDLEWARE = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": "mojaloop.crossborder.transfers,mojaloop.crossborder.compliance,mojaloop.fx.rates"},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "purpose": "fx-rate-cache,corridor-routing-cache"},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "corridors,corridor_compliance,fx_rates,crossborder_transfers"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "purpose": "nostro-vostro-positions"},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflow": "CrossBorderTransferWorkflow", "namespace": "crossborder"},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "pubsub": "crossborder-events"},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "index": "crossborder-*"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "crossborder-operator"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "schema": "crossborder:transfer,crossborder:compliance"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topic": "crossborder-stream"},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:4000"), "role": "crossborder-gateway"},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "route": "/mojaloop/crossborder/*"},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "crossborder-protection"},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "crossborder_transfers,corridor_analytics,fx_rate_history"},
}

CORRIDORS = [
    {"id": "CORR-001", "name": "Nigeria -> Ghana", "region": "ECOWAS", "sourceCurrency": "NGN", "destCurrency": "GHS", "status": "active"},
    {"id": "CORR-002", "name": "Nigeria -> Kenya", "region": "PAN_AFRICAN", "sourceCurrency": "NGN", "destCurrency": "KES", "status": "active"},
    {"id": "CORR-003", "name": "Nigeria -> South Africa", "region": "SADC", "sourceCurrency": "NGN", "destCurrency": "ZAR", "status": "piloting"},
    {"id": "CORR-004", "name": "Nigeria -> UK", "region": "PAN_AFRICAN", "sourceCurrency": "NGN", "destCurrency": "GBP", "status": "active"},
    {"id": "CORR-005", "name": "Ghana -> Nigeria", "region": "ECOWAS", "sourceCurrency": "GHS", "destCurrency": "NGN", "status": "active"},
    {"id": "CORR-006", "name": "Kenya -> Nigeria", "region": "PAN_AFRICAN", "sourceCurrency": "KES", "destCurrency": "NGN", "status": "active"},
    {"id": "CORR-007", "name": "WAEMU Hub", "region": "WAEMU", "sourceCurrency": "NGN", "destCurrency": "XOF", "status": "piloting"},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status": "ok", "service": "mojaloop-crossborder-py", "port": PORT, "middleware": MIDDLEWARE},
            "/v1/corridors": lambda: {"items": CORRIDORS, "total": len(CORRIDORS)},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Mojaloop Cross-Border Corridors (Python) listening on :{PORT}")
    server.serve_forever()
