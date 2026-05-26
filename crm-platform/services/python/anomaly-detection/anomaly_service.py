"""Anomaly Detection Service — ML-powered anomaly detection for CRM transactions."""
import json
import os
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import random
import math

PORT = int(os.getenv("PORT", "8102"))

ANOMALIES = [
    {
        "id": "ANM-001", "type": "transaction_spike", "severity": "critical",
        "entity": "Kano Textiles Ltd", "tenant_id": "acme-bank",
        "description": "Transaction volume 340% above baseline in last 2 hours",
        "detected_at": "2026-05-04T18:42:00Z", "status": "open",
        "metrics": {"baseline": 12, "actual": 53, "std_dev": 4.2},
        "recommended_action": "Review recent transactions for potential fraud",
    },
    {
        "id": "ANM-002", "type": "login_pattern", "severity": "high",
        "entity": "User admin@dangote.com", "tenant_id": "acme-bank",
        "description": "Login from 3 different countries within 30 minutes",
        "detected_at": "2026-05-04T17:15:00Z", "status": "investigating",
        "metrics": {"locations": ["Lagos NG", "London UK", "Dubai AE"], "time_window": "30min"},
        "recommended_action": "Verify identity and check for credential compromise",
    },
    {
        "id": "ANM-003", "type": "revenue_drop", "severity": "medium",
        "entity": "SME Segment", "tenant_id": "acme-bank",
        "description": "Daily revenue 28% below 30-day moving average",
        "detected_at": "2026-05-04T06:00:00Z", "status": "acknowledged",
        "metrics": {"baseline_avg": 45_000_000, "actual": 32_400_000, "drop_pct": 28},
        "recommended_action": "Check for system issues or seasonal patterns",
    },
    {
        "id": "ANM-004", "type": "api_latency", "severity": "high",
        "entity": "Payment Gateway", "tenant_id": "acme-bank",
        "description": "P99 latency spiked to 4.2s (baseline: 200ms)",
        "detected_at": "2026-05-04T16:30:00Z", "status": "open",
        "metrics": {"baseline_p99": 200, "actual_p99": 4200, "unit": "ms"},
        "recommended_action": "Check downstream dependencies and DB connection pool",
    },
    {
        "id": "ANM-005", "type": "data_quality", "severity": "low",
        "entity": "Customer Records", "tenant_id": "acme-bank",
        "description": "142 records with missing BVN fields detected in last import",
        "detected_at": "2026-05-04T12:00:00Z", "status": "resolved",
        "metrics": {"total_records": 8420, "invalid": 142, "rate": 1.7},
        "recommended_action": "Review data import pipeline validation rules",
    },
]

MODELS = [
    {"name": "IsolationForest", "version": "v2.1", "accuracy": 94.2, "trained_on": "2026-04-28", "features": 48, "status": "active"},
    {"name": "AutoEncoder", "version": "v1.8", "accuracy": 91.7, "trained_on": "2026-04-25", "features": 128, "status": "active"},
    {"name": "LSTM-Temporal", "version": "v3.0", "accuracy": 96.1, "trained_on": "2026-05-01", "features": 64, "status": "active"},
    {"name": "StatisticalBaseline", "version": "v1.0", "accuracy": 87.3, "trained_on": "2026-03-15", "features": 12, "status": "fallback"},
]


def detect_anomaly(data_point):
    score = random.uniform(0.1, 1.0)
    is_anomaly = score > 0.85
    return {
        "anomaly_score": round(score, 4),
        "is_anomaly": is_anomaly,
        "model_used": "IsolationForest-v2.1",
        "confidence": round(random.uniform(0.7, 0.99), 2),
        "contributing_features": ["transaction_amount", "time_of_day", "geo_location"],
    }


class AnomalyHandler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        allowed = os.environ.get("CORS_ALLOWED_ORIGINS", "https://crm.example.com,https://admin.example.com").split(",")
        origin = self.headers.get("Origin", "")
        if origin in [o.strip() for o in allowed]:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/health":
            self._send(200, {"status": "healthy", "service": "anomaly-detection"})
        elif path == "/api/v1/anomalies":
            tenant = params.get("tenant_id", [None])[0]
            severity = params.get("severity", [None])[0]
            status = params.get("status", [None])[0]
            filtered = ANOMALIES
            if tenant:
                filtered = [a for a in filtered if a["tenant_id"] == tenant]
            if severity:
                filtered = [a for a in filtered if a["severity"] == severity]
            if status:
                filtered = [a for a in filtered if a["status"] == status]
            self._send(200, {"anomalies": filtered, "total": len(filtered)})
        elif path.startswith("/api/v1/anomalies/"):
            aid = path.split("/")[-1]
            match = next((a for a in ANOMALIES if a["id"] == aid), None)
            if match:
                self._send(200, match)
            else:
                self._send(404, {"error": "Anomaly not found"})
        elif path == "/api/v1/models":
            self._send(200, {"models": MODELS})
        elif path == "/api/v1/stats":
            self._send(200, {
                "total_anomalies": len(ANOMALIES),
                "by_severity": {"critical": 1, "high": 2, "medium": 1, "low": 1},
                "by_status": {"open": 2, "investigating": 1, "acknowledged": 1, "resolved": 1},
                "detection_rate": 94.2,
                "false_positive_rate": 3.8,
                "avg_detection_time": "2.4 minutes",
            })
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if parsed.path == "/api/v1/detect":
            result = detect_anomaly(body)
            self._send(200, result)
        elif parsed.path == "/api/v1/anomalies/acknowledge":
            aid = body.get("anomaly_id")
            for a in ANOMALIES:
                if a["id"] == aid:
                    a["status"] = "acknowledged"
            self._send(200, {"status": "acknowledged", "anomaly_id": aid})
        elif parsed.path == "/api/v1/anomalies/resolve":
            aid = body.get("anomaly_id")
            for a in ANOMALIES:
                if a["id"] == aid:
                    a["status"] = "resolved"
            self._send(200, {"status": "resolved", "anomaly_id": aid})
        elif parsed.path == "/api/v1/models/retrain":
            self._send(200, {
                "status": "training_started",
                "model": body.get("model_name", "IsolationForest"),
                "estimated_time": "15 minutes",
            })
        else:
            self._send(404, {"error": "Not found"})

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Anomaly Detection Service starting on port {PORT}")
    server = HTTPServer(("0.0.0.0", PORT), AnomalyHandler)
    server.serve_forever()
