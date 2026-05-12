import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "SOC-001",
    "controlId": "CC6.1",
    "category": "logical_access",
    "title": "Logical Access Security",
    "evidenceType": "automated_test",
    "result": "passed",
    "collectedAt": "2026-05-09T06:00:00Z",
    "period": "Q2 2026",
    "artifacts": [
      "access_control_matrix.xlsx",
      "rbac_config.json",
      "mfa_enrollment_report.pdf"
    ],
    "auditor": "Deloitte Nigeria",
    "status": "collected"
  },
  {
    "id": "SOC-002",
    "controlId": "CC7.2",
    "category": "system_operations",
    "title": "System Monitoring",
    "evidenceType": "log_export",
    "result": "passed",
    "collectedAt": "2026-05-09T06:00:00Z",
    "period": "Q2 2026",
    "artifacts": [
      "monitoring_dashboard.png",
      "alert_config.json",
      "incident_log.csv"
    ],
    "auditor": "Deloitte Nigeria",
    "status": "collected"
  },
  {
    "id": "SOC-003",
    "controlId": "CC8.1",
    "category": "change_management",
    "title": "Change Management Process",
    "evidenceType": "process_review",
    "result": "passed",
    "collectedAt": "2026-05-09T06:00:00Z",
    "period": "Q2 2026",
    "artifacts": [
      "change_log.csv",
      "approval_workflow.json",
      "deployment_records.xlsx"
    ],
    "auditor": "Deloitte Nigeria",
    "status": "collected"
  },
  {
    "id": "SOC-004",
    "controlId": "CC6.3",
    "category": "encryption",
    "title": "Encryption at Rest and Transit",
    "evidenceType": "automated_test",
    "result": "warning",
    "collectedAt": "2026-05-09T06:00:00Z",
    "period": "Q2 2026",
    "artifacts": [
      "encryption_config.json",
      "tls_scan_report.pdf"
    ],
    "auditor": "Deloitte Nigeria",
    "status": "collected"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.soc2.evidence.collector.py"
    ]
  },
  "redis": {
    "url": "redis://redis:6379/0"
  },
  "postgres": {
    "url": "postgresql://postgres:54bank@postgres:5432/banking"
  },
  "opensearch": {
    "url": "https://opensearch:9200"
  },
  "keycloak": {
    "issuer": "https://auth.54bank.app/realms/54bank"
  },
  "permify": {
    "endpoint": "permify:3476"
  },
  "dapr": {
    "appId": "soc2-evidence-collector-py"
  },
  "fluvio": {
    "endpoint": "fluvio:9003"
  },
  "temporal": {
    "namespace": "54bank-security"
  },
  "mojaloop": {
    "hub": "mojaloop:4000"
  },
  "tigerbeetle": {
    "cluster": "tigerbeetle:3000",
    "ledger": 27
  },
  "lakehouse": {
    "endpoint": "lakehouse:8080"
  },
  "apisix": {
    "admin": "apisix:9180"
  },
  "openappsec": {
    "endpoint": "openappsec:8090"
  }
}""")

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "soc2-evidence-collector-py", "status": "healthy", "version": "1.0.0", "description": "Automated SOC 2 Type II evidence gathering, control testing, audit trail, compliance dashboard", "middleware": MIDDLEWARE})
        elif self.path == "/v1/soc2-evidence/list":
            self._json(200, {"total": len(ITEMS), "evidence_items": ITEMS})
        elif self.path == "/v1/soc2-evidence/stats":
            status_map = {}
            for item in ITEMS:
                s = item.get("status", "unknown")
                status_map[s] = status_map.get(s, 0) + 1
            self._json(200, {"total": len(ITEMS), "byStatus": status_map})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        ITEMS.append(body)
        self._json(201, body)

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8528"))
    print(f"SOC 2 Evidence Collector listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
