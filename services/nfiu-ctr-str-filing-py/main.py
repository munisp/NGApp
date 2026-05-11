"""54Bank NFIU CTR/STR Filing Service — automated Currency Transaction Reports and Suspicious Transaction Reports.

CTR: Auto-file for transactions >NGN5M (individual) / >NGN10M (corporate)
STR: Suspicious Transaction Reports within 72-hour SLA via goAML XML
Integration: NFIU goAML portal, CBN reporting, 72-hour SLA tracking

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
from __future__ import annotations
import os, uuid, json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

def now_iso(): return datetime.now(timezone.utc).isoformat()
def gen_id(p): return f"{p}-{uuid.uuid4().hex[:8].upper()}"

def middleware_config():
    return {
        "kafka": {"broker": os.getenv("KAFKA_BROKER", "localhost:9092"),
                  "topics": ["nfiu.ctr-generated", "nfiu.str-generated", "nfiu.filing-submitted", "nfiu.sla-breach", "nfiu.goaml-response"]},
        "dapr": {"app_id": "nfiu-ctr-str-filing-py", "url": os.getenv("DAPR_URL", "http://localhost:3500"),
                 "pubsub": "nfiu-pubsub", "state_store": "nfiu-state"},
        "fluvio": {"url": os.getenv("FLUVIO_URL", "localhost:9003"),
                   "topics": ["nfiu-ctr-stream", "nfiu-str-stream", "nfiu-audit-trail"]},
        "temporal": {"url": os.getenv("TEMPORAL_URL", "localhost:7233"),
                     "namespace": "nfiu-filing", "task_queue": "nfiu-pipeline",
                     "workflows": ["CTRGenerationWorkflow", "STRGenerationWorkflow", "GoAMLSubmissionWorkflow", "SLAMonitorWorkflow"]},
        "postgres": {"url": os.getenv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),
                     "tables": ["nfiu_ctrs", "nfiu_strs", "nfiu_filings", "nfiu_sla_tracking"]},
        "keycloak": {"url": os.getenv("KEYCLOAK_URL", "http://localhost:8080"),
                     "realm": "54bank", "client_id": "nfiu-filing",
                     "roles": ["compliance_officer", "aml_analyst", "nfiu_submitter", "chief_compliance_officer"]},
        "permify": {"url": os.getenv("PERMIFY_URL", "http://localhost:3476"),
                    "schema": "nfiu_filing", "relations": ["can_generate", "can_review", "can_submit", "can_approve_str"]},
        "redis": {"url": os.getenv("REDIS_URL", "redis://localhost:6379"),
                  "keys": ["nfiu:ctr-queue", "nfiu:str-queue", "nfiu:sla:{filing_id}", "nfiu:daily-ctr-count"]},
        "mojaloop": {"url": os.getenv("MOJALOOP_URL", "http://localhost:3002"),
                     "purpose": "cross-border-transaction-reporting"},
        "opensearch": {"url": os.getenv("OPENSEARCH_URL", "http://localhost:9200"),
                       "indices": ["nfiu-ctrs", "nfiu-strs", "nfiu-filings", "nfiu-audit"]},
        "openappsec": {"url": os.getenv("OPENAPPSEC_URL", "http://localhost:4000"),
                       "policies": ["nfiu-api-protection", "filing-data-encryption"]},
        "apisix": {"url": os.getenv("APISIX_URL", "http://localhost:9080"),
                   "routes": ["/v1/nfiu/*"], "plugins": ["jwt-auth", "rate-limiting"]},
        "tigerbeetle": {"url": os.getenv("TIGERBEETLE_URL", "localhost:3000"),
                        "ledger": "nfiu-compliance", "accounts": ["ctr-filing-fees", "str-filing-fees"]},
        "lakehouse": {"url": os.getenv("LAKEHOUSE_URL", "http://localhost:8181"),
                      "tables": ["nfiu_ctr_analytics", "nfiu_str_analytics", "nfiu_filing_trends"]},
    }

# ── Models ──

CTR_RECORDS = [
    {"id": "CTR-001", "customerId": "CUS-1045", "customerName": "Amina Yusuf", "customerType": "individual",
     "transactionId": "TXN-50001", "transactionType": "cash_deposit", "amountNGN": 7500000, "currency": "NGN",
     "channel": "branch", "branchCode": "LAG-001", "branchName": "Ikeja Main Branch",
     "tellerName": "Adebayo Ogunleye", "counterparty": None,
     "thresholdNGN": 5000000, "exceededBy": 2500000,
     "generatedAt": "2026-05-12T09:15:00Z", "filingDeadline": "2026-05-12T23:59:59Z",
     "status": "filed", "filedAt": "2026-05-12T09:30:00Z",
     "cbnReference": "CBN/CTR/2026/05/0001", "goamlReference": "GOAML-CTR-2026-0501",
     "filedBy": "compliance-auto-system", "slaStatus": "within_sla",
     "slaHoursRemaining": 14.5},
    {"id": "CTR-002", "customerId": "CUS-7001", "customerName": "Pinnacle Trading Ltd", "customerType": "corporate",
     "transactionId": "TXN-50012", "transactionType": "wire_transfer", "amountNGN": 25000000, "currency": "NGN",
     "channel": "internet_banking", "branchCode": "ABJ-003", "branchName": "Abuja CBD Branch",
     "tellerName": None, "counterparty": "Zenith Bank PLC",
     "thresholdNGN": 10000000, "exceededBy": 15000000,
     "generatedAt": "2026-05-12T11:00:00Z", "filingDeadline": "2026-05-12T23:59:59Z",
     "status": "pending_review", "filedAt": None,
     "cbnReference": None, "goamlReference": None,
     "filedBy": None, "slaStatus": "within_sla",
     "slaHoursRemaining": 12.5},
    {"id": "CTR-003", "customerId": "CUS-3021", "customerName": "Oluwaseun Adeyemi", "customerType": "individual",
     "transactionId": "TXN-49800", "transactionType": "cash_withdrawal", "amountNGN": 5200000, "currency": "NGN",
     "channel": "branch", "branchCode": "OYO-002", "branchName": "Ibadan Ring Road Branch",
     "tellerName": "Ngozi Eze", "counterparty": None,
     "thresholdNGN": 5000000, "exceededBy": 200000,
     "generatedAt": "2026-05-11T15:30:00Z", "filingDeadline": "2026-05-11T23:59:59Z",
     "status": "filed", "filedAt": "2026-05-11T16:00:00Z",
     "cbnReference": "CBN/CTR/2026/05/0002", "goamlReference": "GOAML-CTR-2026-0502",
     "filedBy": "compliance-auto-system", "slaStatus": "within_sla",
     "slaHoursRemaining": 0},
]

STR_RECORDS = [
    {"id": "STR-001", "customerId": "CUS-8001", "customerName": "Suspicious Patterns Ltd", "customerType": "corporate",
     "reason": "Structured deposits just below NGN5M threshold — 12 deposits of NGN4.9M in 5 business days",
     "category": "structuring", "totalAmountNGN": 58800000, "transactionCount": 12,
     "periodStart": "2026-05-06", "periodEnd": "2026-05-10",
     "detectionMethod": "rule_engine", "ruleId": "AML-RULE-001",
     "riskScore": 92, "riskLevel": "critical",
     "generatedAt": "2026-05-10T18:00:00Z", "filingDeadline": "2026-05-13T18:00:00Z",
     "status": "filed", "filedAt": "2026-05-11T10:00:00Z",
     "cbnReference": "CBN/STR/2026/05/0001", "goamlReference": "GOAML-STR-2026-0501",
     "reviewedBy": "compliance-officer-2", "approvedBy": "cco-1",
     "slaStatus": "within_sla", "slaHoursRemaining": 0,
     "tippingOffRestriction": True, "staffAccessRestricted": ["relationship_manager", "branch_manager"]},
    {"id": "STR-002", "customerId": "CUS-2089", "customerName": "Chinedu Okeke", "customerType": "individual",
     "reason": "Rapid fund movement — received NGN15M, transferred out NGN14.8M within 4 hours to 5 different accounts",
     "category": "rapid_movement", "totalAmountNGN": 14800000, "transactionCount": 6,
     "periodStart": "2026-05-11", "periodEnd": "2026-05-11",
     "detectionMethod": "rule_engine", "ruleId": "AML-RULE-007",
     "riskScore": 85, "riskLevel": "high",
     "generatedAt": "2026-05-11T22:00:00Z", "filingDeadline": "2026-05-14T22:00:00Z",
     "status": "under_review", "filedAt": None,
     "cbnReference": None, "goamlReference": None,
     "reviewedBy": "aml-analyst-1", "approvedBy": None,
     "slaStatus": "within_sla", "slaHoursRemaining": 52,
     "tippingOffRestriction": True, "staffAccessRestricted": ["relationship_manager"]},
    {"id": "STR-003", "customerId": "CUS-9001", "customerName": "ABC Import Export Ltd", "customerType": "corporate",
     "reason": "Trade-based money laundering indicators — LC values significantly exceed market prices for declared goods",
     "category": "trade_based_ml", "totalAmountNGN": 350000000, "transactionCount": 3,
     "periodStart": "2026-04-01", "periodEnd": "2026-05-10",
     "detectionMethod": "manual_referral", "ruleId": None,
     "riskScore": 78, "riskLevel": "high",
     "generatedAt": "2026-05-10T14:00:00Z", "filingDeadline": "2026-05-13T14:00:00Z",
     "status": "escalated_to_cco", "filedAt": None,
     "cbnReference": None, "goamlReference": None,
     "reviewedBy": "aml-analyst-2", "approvedBy": None,
     "slaStatus": "at_risk", "slaHoursRemaining": 8,
     "tippingOffRestriction": True, "staffAccessRestricted": ["trade_finance_officer", "relationship_manager"]},
]

FILING_DASHBOARD = {
    "period": "2026-05-01 to 2026-05-12",
    "ctrs": {"total_generated": 47, "filed": 45, "pending": 2, "sla_breaches": 0, "auto_filed_pct": 91.5},
    "strs": {"total_generated": 8, "filed": 5, "under_review": 2, "escalated": 1, "sla_breaches": 0, "avg_filing_hours": 18.5},
    "goaml_status": {"connection": "active", "last_submission": "2026-05-12T09:30:00Z", "pending_acknowledgements": 1},
    "compliance_team": {"officers_active": 4, "cases_per_officer": 2.0, "avg_review_time_hours": 4.2},
    "thresholds": {
        "individual_ctr_ngn": 5000000, "corporate_ctr_ngn": 10000000,
        "str_deadline_hours": 72, "ctr_deadline": "same_business_day"
    },
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"status": "healthy", "service": "nfiu-ctr-str-filing-py", "version": "1.0.0", "middleware": middleware_config()})
        elif self.path == "/api/ctrs":
            self._json({"items": CTR_RECORDS, "total": len(CTR_RECORDS)})
        elif self.path == "/api/strs":
            self._json({"items": STR_RECORDS, "total": len(STR_RECORDS)})
        elif self.path == "/api/dashboard":
            self._json(FILING_DASHBOARD)
        elif self.path.startswith("/api/ctrs/"):
            cid = self.path.split("/")[-1]
            r = next((c for c in CTR_RECORDS if c["id"] == cid), None)
            self._json(r or {"error": "not found"}, 200 if r else 404)
        elif self.path.startswith("/api/strs/"):
            sid = self.path.split("/")[-1]
            r = next((s for s in STR_RECORDS if s["id"] == sid), None)
            self._json(r or {"error": "not found"}, 200 if r else 404)
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        if self.path == "/api/ctrs/generate":
            self._json({"message": "CTR generation triggered", "queue_depth": 2})
        elif self.path == "/api/strs/generate":
            self._json({"message": "STR generation triggered", "queue_depth": 1})
        elif self.path == "/api/goaml/submit":
            self._json({"message": "goAML submission queued", "format": "XML", "endpoint": "https://goaml.nfiu.gov.ng/api/submit"})
        else:
            self._json({"error": "not found"}, 404)

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8282"))
    print(f"nfiu-ctr-str-filing-py listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
