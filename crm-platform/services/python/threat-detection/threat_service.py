"""Threat Detection Service — Real-time security threat monitoring and response."""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.getenv("PORT", "8103"))

THREATS = [
    {
        "id": "THR-001", "type": "brute_force", "severity": "critical",
        "source_ip": "185.220.101.42", "target": "auth-service",
        "tenant_id": "acme-bank", "status": "blocked",
        "description": "1,247 failed login attempts in 5 minutes from single IP",
        "detected_at": "2026-05-04T18:30:00Z",
        "mitigation": "IP blocked via WAF rule, rate limiting applied",
        "indicators": {"failed_attempts": 1247, "time_window": "5min", "unique_accounts": 342},
    },
    {
        "id": "THR-002", "type": "sql_injection", "severity": "high",
        "source_ip": "103.45.67.89", "target": "api-gateway",
        "tenant_id": "acme-bank", "status": "blocked",
        "description": "SQL injection attempt detected in search parameter",
        "detected_at": "2026-05-04T17:45:00Z",
        "mitigation": "Request blocked by WAF, pattern added to blocklist",
        "indicators": {"payload": "' OR 1=1; DROP TABLE--", "endpoint": "/api/v1/customers/search"},
    },
    {
        "id": "THR-003", "type": "data_exfiltration", "severity": "critical",
        "source_ip": "10.0.15.42", "target": "customer-db",
        "tenant_id": "acme-bank", "status": "investigating",
        "description": "Unusual data export pattern: 45,000 records queried in 10 minutes",
        "detected_at": "2026-05-04T16:00:00Z",
        "mitigation": "Access temporarily suspended, security team notified",
        "indicators": {"records_accessed": 45000, "normal_rate": 500, "user": "service-account-report"},
    },
    {
        "id": "THR-004", "type": "xss", "severity": "medium",
        "source_ip": "192.168.1.100", "target": "web-frontend",
        "tenant_id": "acme-bank", "status": "resolved",
        "description": "Reflected XSS attempt in form field",
        "detected_at": "2026-05-04T14:20:00Z",
        "mitigation": "Input sanitized, CSP headers enforced",
        "indicators": {"payload": "<script>alert('xss')</script>", "field": "company_name"},
    },
    {
        "id": "THR-005", "type": "privilege_escalation", "severity": "high",
        "source_ip": "10.0.8.15", "target": "rbac-service",
        "tenant_id": "acme-bank", "status": "open",
        "description": "User attempted to access admin endpoints without proper role",
        "detected_at": "2026-05-04T19:10:00Z",
        "mitigation": "Request denied, incident logged, user flagged for review",
        "indicators": {"user_id": "usr-4521", "role": "viewer", "attempted_action": "DELETE /api/v1/tenants"},
    },
]

WAF_RULES = [
    {"id": "WAF-001", "name": "SQL Injection Protection", "type": "block", "hits_24h": 342, "status": "active"},
    {"id": "WAF-002", "name": "XSS Prevention", "type": "block", "hits_24h": 89, "status": "active"},
    {"id": "WAF-003", "name": "Rate Limiting", "type": "rate_limit", "hits_24h": 1247, "status": "active"},
    {"id": "WAF-004", "name": "Geo Blocking", "type": "block", "hits_24h": 56, "status": "active"},
    {"id": "WAF-005", "name": "Bot Detection", "type": "challenge", "hits_24h": 2840, "status": "active"},
]


class ThreatHandler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/health":
            self._send(200, {"status": "healthy", "service": "threat-detection"})
        elif path == "/api/v1/threats":
            severity = params.get("severity", [None])[0]
            status = params.get("status", [None])[0]
            filtered = THREATS
            if severity:
                filtered = [t for t in filtered if t["severity"] == severity]
            if status:
                filtered = [t for t in filtered if t["status"] == status]
            self._send(200, {"threats": filtered, "total": len(filtered)})
        elif path.startswith("/api/v1/threats/"):
            tid = path.split("/")[-1]
            match = next((t for t in THREATS if t["id"] == tid), None)
            if match:
                self._send(200, match)
            else:
                self._send(404, {"error": "Threat not found"})
        elif path == "/api/v1/waf/rules":
            self._send(200, {"rules": WAF_RULES})
        elif path == "/api/v1/stats":
            self._send(200, {
                "total_threats": len(THREATS),
                "blocked": sum(1 for t in THREATS if t["status"] == "blocked"),
                "investigating": sum(1 for t in THREATS if t["status"] == "investigating"),
                "open": sum(1 for t in THREATS if t["status"] == "open"),
                "resolved": sum(1 for t in THREATS if t["status"] == "resolved"),
                "waf_blocks_24h": sum(r["hits_24h"] for r in WAF_RULES),
                "top_threat_type": "brute_force",
                "avg_response_time": "1.2 minutes",
            })
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if parsed.path == "/api/v1/threats/mitigate":
            tid = body.get("threat_id")
            action = body.get("action", "block")
            for t in THREATS:
                if t["id"] == tid:
                    t["status"] = "blocked" if action == "block" else "investigating"
            self._send(200, {"status": "mitigated", "threat_id": tid, "action": action})
        elif parsed.path == "/api/v1/waf/rules":
            self._send(201, {"status": "created", "rule": body})
        elif parsed.path == "/api/v1/scan":
            self._send(200, {
                "scan_id": "scan-" + str(hash(str(body)) % 10000),
                "status": "running",
                "target": body.get("target", "all"),
                "estimated_time": "5 minutes",
            })
        else:
            self._send(404, {"error": "Not found"})

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Threat Detection Service starting on port {PORT}")
    server = HTTPServer(("0.0.0.0", PORT), ThreatHandler)
    server.serve_forever()
