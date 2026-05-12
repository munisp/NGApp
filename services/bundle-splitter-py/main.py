#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8557))
SEED = [{"id": "BS-001", "chunk": "core-banking", "routes": 45, "sizeKB": 234, "loadTimeMs": 120, "lazyLoaded": true, "preloadHint": "prefetch", "status": "active"}, {"id": "BS-002", "chunk": "security-hardening", "routes": 37, "sizeKB": 189, "loadTimeMs": 95, "lazyLoaded": true, "preloadHint": "none", "status": "active"}, {"id": "BS-003", "chunk": "ai-ml", "routes": 11, "sizeKB": 312, "loadTimeMs": 145, "lazyLoaded": true, "preloadHint": "none", "status": "active"}, {"id": "BS-004", "chunk": "trade-finance", "routes": 28, "sizeKB": 178, "loadTimeMs": 89, "lazyLoaded": true, "preloadHint": "prefetch", "status": "active"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "bundle-splitter-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "bundle-splitter-py", "route": "/v1/bundle-splitter"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "bundle-splitter", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/bundle-splitter/list":
            self.wfile.write(json.dumps({"total": len(SEED), "split_configs": SEED}).encode())
        elif self.path == "/v1/bundle-splitter/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "Code Bundle Split Analyzer"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"Code Bundle Split Analyzer on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
