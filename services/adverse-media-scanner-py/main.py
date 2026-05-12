#!/usr/bin/env python3
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8579))
SEED = [{"id": "AMS-001", "customerId": "CUS-3021", "customerName": "ABC Import Export", "scanDate": "2026-05-13", "sources": ["premium_times", "punch_ng", "this_day", "vanguard", "reuters", "bloomberg"], "totalArticles": 156, "relevantArticles": 3, "sentiment": "negative", "categories": ["fraud_allegation", "regulatory_action", "court_proceedings"], "riskImpact": "high", "articles": [{"title": "EFCC probes import company for over-invoicing scheme", "source": "Premium Times", "date": "2026-03-15", "sentiment": "negative", "relevance": 0.92}], "status": "flagged"}, {"id": "AMS-002", "customerId": "CUS-2089", "customerName": "BUA Group Holdings", "scanDate": "2026-05-13", "sources": ["premium_times", "punch_ng", "business_day", "financial_times"], "totalArticles": 234, "relevantArticles": 0, "sentiment": "neutral", "categories": [], "riskImpact": "none", "articles": [], "status": "clear"}, {"id": "AMS-003", "customerId": "CUS-1045", "customerName": "Adeola Fashola", "scanDate": "2026-05-13", "sources": ["premium_times", "channels_tv", "guardian_ng", "daily_trust"], "totalArticles": 45, "relevantArticles": 1, "sentiment": "mixed", "categories": ["political_exposure"], "riskImpact": "medium", "articles": [{"title": "Family members of former Lagos officials under scrutiny", "source": "Guardian NG", "date": "2026-04-20", "sentiment": "negative", "relevance": 0.67}], "status": "review_needed"}]
MW = {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "adverse-media-scanner-py", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "adverse-media-scanner-py", "route": "/v1/adverse-media-scanner"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if self.path == "/healthz":
            self.wfile.write(json.dumps({"service": "adverse-media-scanner", "status": "healthy", "version": "1.0.0", "middleware": MW}).encode())
        elif self.path == "/v1/adverse-media-scanner/list":
            self.wfile.write(json.dumps({"total": len(SEED), "media_scans": SEED}).encode())
        elif self.path == "/v1/adverse-media-scanner/stats":
            self.wfile.write(json.dumps({"total": len(SEED), "active": len(SEED), "service": "Adverse Media Deep Scanner"}).encode())
        else:
            self.send_response(404)
            self.wfile.write(b'{"error":"not found"}')
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    print(f"Adverse Media Deep Scanner on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
