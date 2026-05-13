#!/usr/bin/env python3
"""Load Test Runner — Domain-specific Python microservice
Middleware: Kafka, Postgres, Redis, Temporal, TigerBeetle, Permify, OpenSearch
"""
import os, json, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[load-test-runner-py] %(levelname)s %(message)s')
PORT = int(os.environ.get("PORT", "9437"))

RECORDS = [
    {"id": "TEST-001", "type": "load_test", "scenario": "peak_transfers", "vus": 10000, "tps": 2500, "p99Latency": "850ms", "errorRate": 0.1, "status": "passed"},
    {"id": "TEST-002", "type": "integration", "suite": "payment_flow", "total": 142, "passed": 141, "failed": 1, "duration": "4m30s"},
    {"id": "TEST-003", "type": "security_scan", "target": "api.54bank.app", "findings": 0, "severity": "none", "status": "clean"},
]
STATS = {"totalTests": 4521, "passRate": 99.8, "avgDuration": "12m", "lastRun": "2026-05-09T15:00:00Z"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path in ("/healthz", "/health"):
            self._json(200, {"service": "load-test-runner-py", "status": "healthy", "domain": "Load Test Runner",
                "middleware": {"kafka": "load-test-runner.events", "postgres": "load_test_runner_records", "redis": "load-test-runner_cache", "temporal": "LoadTestRunnerWorkflow"}})
        elif path == "/v1/load-test-runner/list":
            self._json(200, {"records": RECORDS, "total": len(RECORDS)})
        elif path == "/v1/load-test-runner/stats":
            self._json(200, STATS)
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
        if path == "/v1/load-test-runner/create":
            body["id"] = f"REC-{len(RECORDS)+1:03d}"
            body["status"] = "created"
            body["createdAt"] = datetime.utcnow().isoformat() + "Z"
            RECORDS.append(body)
            self._json(201, {"created": True, "record": body})
        else:
            self._json(404, {"error": "Not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args): pass

if __name__ == "__main__":
    logging.info(f"Load Test Runner (Python) on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
