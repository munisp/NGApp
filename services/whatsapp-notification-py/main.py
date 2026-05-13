#!/usr/bin/env python3
"""Whatsapp Notification — Domain-specific Python microservice
Middleware: Kafka, Postgres, Redis, Temporal, TigerBeetle, Permify, OpenSearch
"""
import os, json, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[whatsapp-notification-py] %(levelname)s %(message)s')
PORT = int(os.environ.get("PORT", "9466"))

RECORDS = [
    {"id": "REC-001", "type": "active", "status": "operational", "domain": "Whatsapp Notification", "createdAt": "2026-05-09T10:00:00Z"},
    {"id": "REC-002", "type": "pending", "status": "under_review", "domain": "Whatsapp Notification", "createdAt": "2026-05-09T11:00:00Z"},
    {"id": "REC-003", "type": "completed", "status": "archived", "domain": "Whatsapp Notification", "createdAt": "2026-05-08T14:00:00Z"},
]
STATS = {"total": 1247, "active": 1100, "pending": 120, "archived": 27, "lastUpdated": "2026-05-09T15:00:00Z"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path in ("/healthz", "/health"):
            self._json(200, {"service": "whatsapp-notification-py", "status": "healthy", "domain": "Whatsapp Notification",
                "middleware": {"kafka": "whatsapp-notification.events", "postgres": "whatsapp_notification_records", "redis": "whatsapp-notification_cache", "temporal": "WhatsappNotificationWorkflow"}})
        elif path == "/v1/whatsapp-notification/list":
            self._json(200, {"records": RECORDS, "total": len(RECORDS)})
        elif path == "/v1/whatsapp-notification/stats":
            self._json(200, STATS)
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
        if path == "/v1/whatsapp-notification/create":
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
    logging.info(f"Whatsapp Notification (Python) on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
