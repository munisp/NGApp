import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

ITEMS = json.loads("""[
  {
    "id": "CBN-001",
    "circular": "CBN/DIR/GEN/CIR/04/010",
    "title": "Risk-Based Cybersecurity Framework",
    "category": "cybersecurity",
    "totalControls": 45,
    "passing": 38,
    "failing": 7,
    "complianceScore": 84.4,
    "lastAssessed": "2026-05-01T00:00:00Z",
    "nextAssessment": "2026-08-01T00:00:00Z",
    "status": "partial"
  },
  {
    "id": "CBN-002",
    "circular": "CBN/DIR/GEN/CIR/06/017",
    "title": "Guidelines on Operations of Electronic Payment",
    "category": "payments",
    "totalControls": 32,
    "passing": 30,
    "failing": 2,
    "complianceScore": 93.8,
    "lastAssessed": "2026-04-15T00:00:00Z",
    "nextAssessment": "2026-07-15T00:00:00Z",
    "status": "partial"
  },
  {
    "id": "CBN-003",
    "circular": "CBN/DIR/GEN/CIR/04/014",
    "title": "AML/CFT Regulations",
    "category": "aml_cft",
    "totalControls": 58,
    "passing": 52,
    "failing": 6,
    "complianceScore": 89.7,
    "lastAssessed": "2026-05-05T00:00:00Z",
    "nextAssessment": "2026-08-05T00:00:00Z",
    "status": "partial"
  },
  {
    "id": "CBN-004",
    "circular": "CBN/DIR/GEN/CIR/04/016",
    "title": "Customer Due Diligence",
    "category": "kyc",
    "totalControls": 25,
    "passing": 25,
    "failing": 0,
    "complianceScore": 100.0,
    "lastAssessed": "2026-05-08T00:00:00Z",
    "nextAssessment": "2026-08-08T00:00:00Z",
    "status": "compliant"
  },
  {
    "id": "CBN-005",
    "circular": "NDIC/ONSITE/GEN/VOL.1/001",
    "title": "NDIC Risk-Based Supervision",
    "category": "risk_management",
    "totalControls": 38,
    "passing": 34,
    "failing": 4,
    "complianceScore": 89.5,
    "lastAssessed": "2026-04-20T00:00:00Z",
    "nextAssessment": "2026-07-20T00:00:00Z",
    "status": "partial"
  }
]""")

MIDDLEWARE = json.loads("""{
  "kafka": {
    "broker": "kafka:9092",
    "topics": [
      "security.cbn.compliance.checker.py"
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
    "appId": "cbn-compliance-checker-py"
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
            self._json(200, {"service": "cbn-compliance-checker-py", "status": "healthy", "version": "1.0.0", "description": "CBN security circular compliance, automated gap analysis, remediation tracking, evidence collection", "middleware": MIDDLEWARE})
        elif self.path == "/v1/cbn-compliance/list":
            self._json(200, {"total": len(ITEMS), "compliance_checks": ITEMS})
        elif self.path == "/v1/cbn-compliance/stats":
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
    port = int(os.environ.get("PORT", "8524"))
    print(f"CBN Compliance Checker listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
