#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8564))
SEED = [{"id": "DB-001", "service": "jwt-validator-rs", "baseImage": "gcr.io/distroless/cc", "imageSizeMB": 2.1, "previousSizeMB": 82.4, "reductionPct": "97.4%", "pullTimeMs": 340, "status": "active"}, {"id": "DB-002", "service": "api-key-enforcer-go", "baseImage": "gcr.io/distroless/static", "imageSizeMB": 1.8, "previousSizeMB": 45.2, "reductionPct": "96.0%", "pullTimeMs": 280, "status": "active"}, {"id": "DB-003", "service": "anomaly-detector-py", "baseImage": "gcr.io/distroless/python3", "imageSizeMB": 12.3, "previousSizeMB": 156.7, "reductionPct": "92.1%", "pullTimeMs": 890, "status": "active"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "distroless-builder-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "distroless-builder-py", "route": "/v1/distroless-builder"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "distroless-builder", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/distroless-builder/list":
            self.wfile.write(json.dumps({"total": len(SEED), "image_configs": SEED}).encode())
        elif self.path == "/v1/distroless-builder/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "Distroless Docker Image Builder"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"Distroless Docker Image Builder on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
