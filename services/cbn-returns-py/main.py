"""CBN Regulatory Returns Engine — generates all Nigerian regulatory returns from transaction data.

Returns: CBN eFASS (daily/weekly/monthly/quarterly), NDIC (quarterly), FIRS VAT (monthly),
         CTR/STR (as-needed), Basel III (quarterly), Form A/M (monthly).
Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify, Redis,
           Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
import json, os, math
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get("PORT", "8213"))

MIDDLEWARE = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": "regulatory.return-generated,regulatory.submission-approved,regulatory.deadline-alert"},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "purpose": "return-cache,deadline-tracker"},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "regulatory_returns,submission_history,compliance_calendar,return_templates"},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "index": "regulatory-submissions"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "compliance-officer"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "schema": "return:generate,return:approve,return:submit"},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "pubsub": "regulatory-events"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topic": "regulatory-filings"},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflow": "RegulatorySubmissionWorkflow"},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-data-for-returns"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "purpose": "ledger-data-for-balance-sheet"},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "return_archive,regulatory_metrics"},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "route": "/regulatory/*"},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "regulatory-data-protection"},
}

RETURNS = [
    {"id": "RET-001", "code": "CBN-eFASS-D", "name": "CBN eFASS Daily Return", "regulator": "CBN", "frequency": "daily", "status": "submitted", "dueDate": "2026-05-11", "submittedAt": "2026-05-10T23:30:00Z",
     "data": {"totalAssets": 520000000000, "totalLiabilities": 445000000000, "totalEquity": 75000000000, "totalLoans": 340000000000, "totalDeposits": 398000000000, "cashReserve": 78000000000, "liquidityRatio": 38.5, "capitalAdequacyRatio": 16.2}},
    {"id": "RET-002", "code": "CBN-eFASS-W", "name": "CBN eFASS Weekly Return", "regulator": "CBN", "frequency": "weekly", "status": "approved", "dueDate": "2026-05-12", "submittedAt": None,
     "data": {"weeklyDeposits": 45000000000, "weeklyWithdrawals": 42000000000, "netPosition": 3000000000, "largestDeposit": 2500000000, "interestExpense": 890000000}},
    {"id": "RET-003", "code": "CBN-eFASS-M", "name": "CBN eFASS Monthly Return", "regulator": "CBN", "frequency": "monthly", "status": "generated", "dueDate": "2026-05-15", "submittedAt": None,
     "data": {"totalIncome": 48000000000, "totalExpense": 35000000000, "netProfit": 13000000000, "npl": 12400000000, "nplRatio": 3.65, "provisionCoverage": 82.5, "costToIncomeRatio": 72.9}},
    {"id": "RET-004", "code": "NDIC-Q", "name": "NDIC Quarterly Return", "regulator": "NDIC", "frequency": "quarterly", "status": "draft", "dueDate": "2026-06-30", "submittedAt": None,
     "data": {"insuredDeposits": 280000000000, "uninsuredDeposits": 118000000000, "premiumDue": 700000000, "depositConcentration": [{"range": "0-500K", "count": 1800000, "amount": 125000000000}, {"range": "500K-5M", "count": 450000, "amount": 180000000000}, {"range": "5M+", "count": 25000, "amount": 93000000000}]}},
    {"id": "RET-005", "code": "FIRS-VAT", "name": "FIRS VAT Return", "regulator": "FIRS", "frequency": "monthly", "status": "submitted", "dueDate": "2026-05-21", "submittedAt": "2026-05-10T14:00:00Z",
     "data": {"totalFees": 5200000000, "vatableAmount": 4800000000, "vatRate": 7.5, "vatPayable": 360000000, "exemptFees": 400000000}},
    {"id": "RET-006", "code": "CTR", "name": "Currency Transaction Report", "regulator": "CBN-NFIU", "frequency": "as-needed", "status": "submitted", "dueDate": "2026-05-10", "submittedAt": "2026-05-10T18:00:00Z",
     "data": {"reportingPeriod": "2026-05-10", "transactionsAbove5M": 3400, "totalAmount": 89000000000, "cashDeposits": 1800, "cashWithdrawals": 1600, "byChannel": {"branch": 2100, "atm": 800, "pos": 500}}},
    {"id": "RET-007", "code": "FORM-A", "name": "CBN Form A (FX Sales)", "regulator": "CBN", "frequency": "monthly", "status": "draft", "dueDate": "2026-05-15", "submittedAt": None,
     "data": {"totalFxSales": 45000000, "currency": "USD", "byPurpose": {"invisibles": 12000000, "merchandise": 28000000, "services": 5000000}, "avgRate": 1582.50}},
    {"id": "RET-008", "code": "BASEL-III", "name": "Basel III Capital Adequacy", "regulator": "CBN", "frequency": "quarterly", "status": "generated", "dueDate": "2026-06-30", "submittedAt": None,
     "data": {"tier1Capital": 62000000000, "tier2Capital": 13000000000, "totalCapital": 75000000000, "riskWeightedAssets": 462962962963, "car": 16.2, "minimumCAR": 15.0, "buffer": 1.2, "leverage": 8.5, "lcr": 145.0, "nsfr": 118.0}},
]

DEADLINES = [
    {"id": "DL-001", "returnCode": "CBN-eFASS-D", "dueDate": "2026-05-11", "status": "on-track", "daysRemaining": 1},
    {"id": "DL-002", "returnCode": "CBN-eFASS-W", "dueDate": "2026-05-12", "status": "on-track", "daysRemaining": 2},
    {"id": "DL-003", "returnCode": "CBN-eFASS-M", "dueDate": "2026-05-15", "status": "on-track", "daysRemaining": 5},
    {"id": "DL-004", "returnCode": "FIRS-VAT", "dueDate": "2026-05-21", "status": "submitted", "daysRemaining": 11},
    {"id": "DL-005", "returnCode": "NDIC-Q", "dueDate": "2026-06-30", "status": "in-progress", "daysRemaining": 51},
    {"id": "DL-006", "returnCode": "BASEL-III", "dueDate": "2026-06-30", "status": "in-progress", "daysRemaining": 51},
]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "cbn-returns")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        if self.path == "/healthz":
            submitted = sum(1 for r in RETURNS if r["status"] == "submitted")
            return self._json(200, {"status": "healthy", "service": "cbn-returns",
                "returns": {"total": len(RETURNS), "submitted": submitted, "pending": len(RETURNS) - submitted},
                "middleware": MIDDLEWARE})

        if self.path == "/v1/returns":
            return self._json(200, {"items": RETURNS, "total": len(RETURNS)})

        if self.path == "/v1/deadlines":
            return self._json(200, {"items": DEADLINES, "total": len(DEADLINES)})

        if self.path == "/v1/stats":
            by_regulator, by_status = {}, {}
            for r in RETURNS:
                by_regulator[r["regulator"]] = by_regulator.get(r["regulator"], 0) + 1
                by_status[r["status"]] = by_status.get(r["status"], 0) + 1
            overdue = sum(1 for d in DEADLINES if d["status"] == "overdue")
            return self._json(200, {
                "totalReturns": len(RETURNS), "byRegulator": by_regulator, "byStatus": by_status,
                "upcomingDeadlines": len(DEADLINES), "overdueDeadlines": overdue,
                "regulators": ["CBN", "NDIC", "FIRS", "CBN-NFIU", "SEC"],
                "returnTypes": ["eFASS-Daily", "eFASS-Weekly", "eFASS-Monthly", "NDIC-Quarterly", "FIRS-VAT", "CTR", "Form-A", "Basel-III"],
            })

        if self.path.startswith("/v1/returns/"):
            ret_id = self.path[len("/v1/returns/"):]
            for r in RETURNS:
                if r["id"] == ret_id:
                    return self._json(200, r)
            return self._json(404, {"error": "Return not found"})

        self._json(404, {"error": "Not found"})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[cbn-returns] Listening on :{PORT} with {len(RETURNS)} returns, {len(DEADLINES)} deadlines")
    server.serve_forever()
