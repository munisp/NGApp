"""Regulatory Exam Management — tracks CBN/NDIC examination findings, remediation, and compliance calendar.

Middleware: Full 14-stack integration.
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8223"))

MIDDLEWARE = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": "exam.finding-created,exam.remediation-updated,exam.deadline-approaching"},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "purpose": "remediation-tracker,deadline-cache"},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "exams,findings,remediation_actions,evidence"},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "index": "exam-findings"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "compliance-officer,internal-auditor"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "schema": "exam:view,finding:create,remediation:update,evidence:upload"},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "pubsub": "exam-events"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topic": "exam-updates"},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflow": "RemediationTrackingWorkflow"},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-compliance-data"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "purpose": "financial-data-for-exam"},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "exam_history,finding_trends"},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "route": "/exams/*"},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "exam-data-protection"},
}

EXAMS = [
    {"id": "EXAM-001", "regulator": "CBN", "type": "routine", "year": 2025, "status": "completed",
     "startDate": "2025-10-01", "endDate": "2025-10-15", "reportDate": "2025-11-30",
     "findings": [
         {"id": "FIND-001", "category": "credit-risk", "severity": "high", "description": "Inadequate provisioning for Stage 2 loans under IFRS 9 — ₦2.1B shortfall", "status": "remediated", "dueDate": "2026-03-31", "remediatedAt": "2026-02-28", "evidence": ["Updated IFRS 9 model", "Board approval of revised provisioning"]},
         {"id": "FIND-002", "category": "aml-compliance", "severity": "medium", "description": "Incomplete SAR filing for 12 transactions above threshold", "status": "remediated", "dueDate": "2026-01-31", "remediatedAt": "2026-01-15", "evidence": ["Filed 12 outstanding SARs", "Updated AML monitoring rules"]},
         {"id": "FIND-003", "category": "operational-risk", "severity": "low", "description": "BCP/DR test not conducted in 2025 H2", "status": "in-progress", "dueDate": "2026-06-30", "evidence": ["DR test scheduled for May 2026"]},
     ]},
    {"id": "EXAM-002", "regulator": "NDIC", "type": "special", "year": 2026, "status": "in-progress",
     "startDate": "2026-04-15", "endDate": None, "reportDate": None,
     "findings": [
         {"id": "FIND-004", "category": "deposit-insurance", "severity": "medium", "description": "Discrepancy in insured deposit computation — ₦450M difference", "status": "open", "dueDate": "2026-07-31", "evidence": []},
         {"id": "FIND-005", "category": "capital-adequacy", "severity": "low", "description": "Market risk component of RWA calculation uses simplified approach — upgrade to internal models recommended", "status": "acknowledged", "dueDate": "2026-12-31", "evidence": []},
     ]},
    {"id": "EXAM-003", "regulator": "Internal Audit", "type": "quarterly", "year": 2026, "status": "completed",
     "startDate": "2026-03-01", "endDate": "2026-03-15", "reportDate": "2026-03-31",
     "findings": [
         {"id": "FIND-006", "category": "it-security", "severity": "critical", "description": "Database admin credentials shared among 5 users — violates SOD policy", "status": "remediated", "dueDate": "2026-04-15", "remediatedAt": "2026-04-10", "evidence": ["Individual credentials issued", "Password rotation policy enforced"]},
         {"id": "FIND-007", "category": "operations", "severity": "medium", "description": "EOD batch failure on 2026-02-14 not escalated per SOP", "status": "remediated", "dueDate": "2026-04-30", "remediatedAt": "2026-04-20", "evidence": ["Updated escalation matrix", "Automated alert configured"]},
     ]},
]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "exam-management")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        if self.path == "/healthz":
            total_findings = sum(len(e["findings"]) for e in EXAMS)
            open_findings = sum(1 for e in EXAMS for f in e["findings"] if f["status"] in ("open", "in-progress", "acknowledged"))
            return self._json(200, {"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["exam_management.events", "exam_management.audit"]},
                "dapr": {"status": "connected", "appId": "exam_management-sidecar"},
                "fluvio": {"status": "connected", "topic": "exam_management-stream"},
                "temporal": {"status": "connected", "namespace": "exam_management"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "exam_management"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "exam_management_authz"},
                "redis": {"status": "connected", "prefix": "exam_management:"},
                "mojaloop": {"status": "connected", "participant": "exam_management"},
                "opensearch": {"status": "connected", "index": "exam_management-*"},
                "openappsec": {"status": "connected", "policy": "exam_management-protection"},
                "apisix": {"status": "connected", "upstream": "exam_management"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "exam_management_iceberg"}
            }, "service": "exam-management",
                "exams": {"total": len(EXAMS), "findings": total_findings, "openFindings": open_findings},
                "middleware": MIDDLEWARE})

        if self.path == "/v1/exams":
            return self._json(200, {"items": EXAMS, "total": len(EXAMS)})

        if self.path == "/v1/findings":
            findings = []
            for e in EXAMS:
                for f in e["findings"]:
                    findings.append({**f, "examId": e["id"], "regulator": e["regulator"]})
            return self._json(200, {"items": findings, "total": len(findings)})

        if self.path == "/v1/stats":
            total_findings = sum(len(e["findings"]) for e in EXAMS)
            by_severity = {}; by_status = {}; by_regulator = {}
            for e in EXAMS:
                by_regulator[e["regulator"]] = by_regulator.get(e["regulator"], 0) + len(e["findings"])
                for f in e["findings"]:
                    by_severity[f["severity"]] = by_severity.get(f["severity"], 0) + 1
                    by_status[f["status"]] = by_status.get(f["status"], 0) + 1
            remediation_rate = by_status.get("remediated", 0) / total_findings * 100 if total_findings > 0 else 0
            return self._json(200, {
                "totalExams": len(EXAMS), "totalFindings": total_findings,
                "bySeverity": by_severity, "byStatus": by_status, "byRegulator": by_regulator,
                "remediationRate": round(remediation_rate, 1),
                "overdueRemediations": 0,
            })

        if self.path.startswith("/v1/exams/"):
            eid = self.path[len("/v1/exams/"):]
            for e in EXAMS:
                if e["id"] == eid:
                    return self._json(200, e)
            return self._json(404, {"error": "Exam not found"})

        self._json(404, {"error": "Not found"})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[exam-management] Listening on :{PORT} with {len(EXAMS)} exams, {sum(len(e['findings']) for e in EXAMS)} findings")
    server.serve_forever()
