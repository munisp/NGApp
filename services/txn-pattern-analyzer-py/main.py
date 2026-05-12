#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8581))
SEED = [{"id": "TPA-001", "customerId": "CUS-1045", "customerName": "Suspicious Transfers Ltd", "period": "2026-04", "patternsDetected": ["structuring", "velocity_spike", "geographic_anomaly"], "anomalyScore": 0.89, "baselineDeviation": "3.2\u03c3", "peakTransactionHour": 14, "unusualCounterparties": 3, "crossBorderRatio": 0.45, "cashRatio": 0.78, "roundAmountRatio": 0.67, "velocityIndex": 4.2, "networkRiskScore": 72, "recommendation": "escalate_to_investigation", "status": "flagged"}, {"id": "TPA-002", "customerId": "CUS-4567", "customerName": "Ngozi Okafor", "period": "2026-04", "patternsDetected": [], "anomalyScore": 0.08, "baselineDeviation": "0.3\u03c3", "peakTransactionHour": 10, "unusualCounterparties": 0, "crossBorderRatio": 0.0, "cashRatio": 0.15, "roundAmountRatio": 0.12, "velocityIndex": 1.1, "networkRiskScore": 5, "recommendation": "no_action", "status": "normal"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "txn-pattern-analyzer-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "txn-pattern-analyzer-py", "route": "/v1/txn-pattern-analyzer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "txn-pattern-analyzer", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/txn-pattern-analyzer/list":
            self.wfile.write(json.dumps({"total": len(SEED), "pattern_analyses": SEED}).encode())
        elif self.path == "/v1/txn-pattern-analyzer/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "Transaction Pattern Analyzer"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"Transaction Pattern Analyzer on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
