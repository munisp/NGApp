"""
health.py — Health endpoint for the Flink Streaming service.
Runs a lightweight HTTP server on HEALTH_PORT (default 8112)
so k8s liveness/readiness probes can verify the process is alive.
"""
import os
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

START_TIME = time.time()
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8112"))


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            payload = {
                "status": "ok",
                "service": "flink-streaming",
                "uptime_s": int(time.time() - START_TIME),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress access logs


def start_health_server():
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
