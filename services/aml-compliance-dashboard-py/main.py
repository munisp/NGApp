#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8583))
SEED = [{"id": "DASH-2026-05", "period": "2026-05", "totalScreenings": 45230, "sanctionsHits": 3, "pepMatches": 12, "adverseMediaFlags": 7, "sarsFiled": 8, "ctrsFiled": 47, "casesOpened": 5, "casesClosed": 3, "falsePositiveRate": "94.2%", "avgScreeningTimeMs": 23, "avgCaseResolutionDays": 12, "complianceScore": 96, "nfiuFilingCompliance": "100%", "cbnCircularCompliance": "98%", "staffTrainingCompletion": "95%", "riskDistribution": {"low": 78, "medium": 15, "high": 5, "critical": 2}, "topRiskCategories": ["structuring", "trade_based_ml", "pep_activity"], "status": "on_track"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "aml-compliance-dashboard-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "aml-compliance-dashboard-py", "route": "/v1/aml-compliance-dashboard"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "aml-compliance-dashboard", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/aml-compliance-dashboard/list":
            self.wfile.write(json.dumps({"total": len(SEED), "compliance_metrics": SEED}).encode())
        elif self.path == "/v1/aml-compliance-dashboard/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "AML Compliance Dashboard"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"AML Compliance Dashboard on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
