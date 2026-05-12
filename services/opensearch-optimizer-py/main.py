#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8571))
SEED = [{"id": "OS-001", "index": "transactions", "analyzers": ["ngram", "edge_ngram", "keyword"], "shards": 5, "replicas": 1, "avgQueryMs": 12, "searchTemplates": 8, "resultCacheEnabled": true, "cacheTTL": "30s", "status": "active"}, {"id": "OS-002", "index": "audit-logs", "analyzers": ["standard", "keyword"], "shards": 3, "replicas": 1, "avgQueryMs": 8, "searchTemplates": 5, "resultCacheEnabled": true, "cacheTTL": "60s", "status": "active"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "opensearch-optimizer-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "opensearch-optimizer-py", "route": "/v1/opensearch-optimizer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "opensearch-optimizer", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/opensearch-optimizer/list":
            self.wfile.write(json.dumps({"total": len(SEED), "index_configs": SEED}).encode())
        elif self.path == "/v1/opensearch-optimizer/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "OpenSearch Query Optimizer"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"OpenSearch Query Optimizer on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
