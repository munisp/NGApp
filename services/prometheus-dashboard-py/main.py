#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8570))
SEED = [{"id": "PD-001", "dashboard": "API Latency", "panels": ["P50", "P95", "P99", "Error Rate", "RPS"], "refreshInterval": "5s", "alertRules": 3, "dataSourceRetention": "30d", "status": "active"}, {"id": "PD-002", "dashboard": "Cache Performance", "panels": ["Hit Rate", "Miss Rate", "Evictions", "Memory", "Latency"], "refreshInterval": "10s", "alertRules": 2, "dataSourceRetention": "30d", "status": "active"}, {"id": "PD-003", "dashboard": "DB Performance", "panels": ["Query Time", "Connection Pool", "Replication Lag", "IOPS", "Cache Ratio"], "refreshInterval": "10s", "alertRules": 4, "dataSourceRetention": "30d", "status": "active"}, {"id": "PD-004", "dashboard": "Kafka Streaming", "panels": ["Consumer Lag", "Throughput", "Partition Balance", "Error Rate"], "refreshInterval": "5s", "alertRules": 3, "dataSourceRetention": "30d", "status": "active"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "prometheus-dashboard-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "prometheus-dashboard-py", "route": "/v1/prometheus-dashboard"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "prometheus-dashboard", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/prometheus-dashboard/list":
            self.wfile.write(json.dumps({"total": len(SEED), "dashboard_panels": SEED}).encode())
        elif self.path == "/v1/prometheus-dashboard/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "Prometheus/Grafana Performance Dashboard"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"Prometheus/Grafana Performance Dashboard on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
