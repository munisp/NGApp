#!/usr/bin/env python3
"""Soil Analysis — Domain-specific Python microservice
Middleware: Kafka, Postgres, Redis, Temporal, TigerBeetle, Permify, OpenSearch
"""
import os, json, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[soil-analysis-py] %(levelname)s %(message)s')
PORT = int(os.environ.get("PORT", "9455"))

RECORDS = [
    {"id": "AGR-001", "type": "crop_assessment", "farmer": "COOP-KADUNA-001", "crop": "maize", "hectares": 50, "yieldEstimate": 4.5, "season": "2026A"},
    {"id": "AGR-002", "type": "insurance_claim", "farmer": "COOP-KANO-015", "crop": "rice", "lossPercent": 45, "cause": "flood", "status": "under_assessment"},
    {"id": "AGR-003", "type": "price_index", "commodity": "maize", "price": 420000, "unit": "per_ton", "market": "Lagos", "date": "2026-05-09"},
]
STATS = {"totalFarmers": 45000, "activePolicies": 12500, "pendingClaims": 89, "avgYield": 4.2, "totalHectares": 250000}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path in ("/healthz", "/health"):
            self._json(200, {"service": "soil-analysis-py", "status": "healthy", "domain": "Soil Analysis",
                "middleware": {"kafka": "soil-analysis.events", "postgres": "soil_analysis_records", "redis": "soil-analysis_cache", "temporal": "SoilAnalysisWorkflow"}})
        elif path == "/v1/soil-analysis/list":
            self._json(200, {"records": RECORDS, "total": len(RECORDS)})
        elif path == "/v1/soil-analysis/stats":
            self._json(200, STATS)
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
        if path == "/v1/soil-analysis/create":
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
    logging.info(f"Soil Analysis (Python) on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
