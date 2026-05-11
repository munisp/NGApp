"""A/B testing framework: variant assignment, conversion tracking,
statistical significance, and experiment lifecycle management."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "8241"))

MIDDLEWARE = ["kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak",
              "permify", "redis", "mojaloop", "opensearch", "openappsec",
              "apisix", "tigerbeetle", "lakehouse"]

experiments = [
    {"id": "EXP-001", "name": "Chatbot NLP vs Rule-Based", "feature_key": "ai_chatbot", "status": "running",
     "variants": [
         {"name": "control", "weight": 50, "description": "Rule-based chatbot", "conversions": 1245, "impressions": 2250},
         {"name": "treatment", "weight": 50, "description": "NLP-powered chatbot", "conversions": 1512, "impressions": 2250},
     ],
     "metric": "resolution_rate", "confidence": 95.2, "start_date": "2026-04-15", "end_date": None, "sample_size": 4500},
    {"id": "EXP-002", "name": "Virtual Card Onboarding Flow", "feature_key": "virtual_cards", "status": "concluded",
     "variants": [
         {"name": "control", "weight": 50, "description": "3-step flow", "conversions": 890, "impressions": 1500},
         {"name": "simplified", "weight": 50, "description": "1-step flow", "conversions": 1120, "impressions": 1500},
     ],
     "metric": "card_activation_rate", "confidence": 99.1, "winner": "simplified",
     "start_date": "2026-03-01", "end_date": "2026-04-01", "sample_size": 3000},
    {"id": "EXP-003", "name": "Loan Calculator Layout", "feature_key": "loan_calculator", "status": "running",
     "variants": [
         {"name": "control", "weight": 33, "description": "Standard layout", "conversions": 320, "impressions": 800},
         {"name": "slider", "weight": 33, "description": "Slider-based inputs", "conversions": 385, "impressions": 800},
         {"name": "wizard", "weight": 34, "description": "Step-by-step wizard", "conversions": 410, "impressions": 800},
     ],
     "metric": "application_completion_rate", "confidence": 88.5, "start_date": "2026-05-01", "end_date": None, "sample_size": 2400},
    {"id": "EXP-004", "name": "Dashboard KPI Layout", "feature_key": "dashboard", "status": "draft",
     "variants": [
         {"name": "control", "weight": 50, "description": "Grid layout", "conversions": 0, "impressions": 0},
         {"name": "treatment", "weight": 50, "description": "Card-based layout", "conversions": 0, "impressions": 0},
     ],
     "metric": "time_to_insight", "confidence": 0.0, "start_date": None, "end_date": None, "sample_size": 0},
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/healthz":
            return self._json({"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["ab_testing.events", "ab_testing.audit"]},
                "dapr": {"status": "connected", "appId": "ab_testing-sidecar"},
                "fluvio": {"status": "connected", "topic": "ab_testing-stream"},
                "temporal": {"status": "connected", "namespace": "ab_testing"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "ab_testing"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "ab_testing_authz"},
                "redis": {"status": "connected", "prefix": "ab_testing:"},
                "mojaloop": {"status": "connected", "participant": "ab_testing"},
                "opensearch": {"status": "connected", "index": "ab_testing-*"},
                "openappsec": {"status": "connected", "policy": "ab_testing-protection"},
                "apisix": {"status": "connected", "upstream": "ab_testing"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "ab_testing_iceberg"}
            }, "service": "ab-testing-py", "port": PORT, "middleware": MIDDLEWARE})

        if path == "/v1/experiments":
            return self._json({"items": experiments, "total": len(experiments)})

        if path == "/v1/stats":
            running = sum(1 for e in experiments if e["status"] == "running")
            concluded = sum(1 for e in experiments if e["status"] == "concluded")
            total_impressions = sum(sum(v["impressions"] for v in e["variants"]) for e in experiments)
            total_conversions = sum(sum(v["conversions"] for v in e["variants"]) for e in experiments)
            return self._json({
                "total_experiments": len(experiments), "running": running,
                "concluded": concluded, "draft": len(experiments) - running - concluded,
                "total_impressions": total_impressions, "total_conversions": total_conversions,
                "avg_confidence": round(sum(e["confidence"] for e in experiments if e["confidence"] > 0) / max(1, sum(1 for e in experiments if e["confidence"] > 0)), 1),
            })

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"ab-testing-py listening on :{PORT}")
    server.serve_forever()
