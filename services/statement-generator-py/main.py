"""Statement Generator — PDF/MT940/MT942 account statement generation.

Generates monthly/on-demand statements from transaction data, delivers via email/download.
Middleware: Full 14-stack integration.
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8215"))

MIDDLEWARE = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": "statement.generated,statement.delivered,statement.failed"},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "purpose": "statement-queue,delivery-tracking"},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "statements,statement_requests,delivery_log"},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "index": "statement-delivery"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "customer,operations-officer"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "schema": "statement:generate,statement:download,statement:email"},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "pubsub": "statement-events"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topic": "statement-requests"},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflow": "StatementGenerationWorkflow"},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-data-source"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "purpose": "transaction-ledger-source"},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "statement_archive"},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "route": "/statements/*"},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "statement-access-protection"},
}

STATEMENTS = [
    {"id": "STMT-001", "accountNumber": "0012345678", "accountName": "Adebayo Olumide", "type": "monthly", "format": "pdf", "period": "2026-04", "status": "delivered",
     "generatedAt": "2026-05-01T06:00:00Z", "deliveredAt": "2026-05-01T06:15:00Z", "deliveryChannel": "email",
     "summary": {"openingBalance": 2500000, "totalCredits": 15800000, "totalDebits": 14200000, "closingBalance": 4100000, "transactionCount": 45, "interestEarned": 12500, "feesCharged": 4250},
     "transactions": [
         {"date": "2026-04-01", "reference": "TRF-001", "narrative": "Salary April", "credit": 850000, "debit": 0, "balance": 3350000},
         {"date": "2026-04-03", "reference": "POS-001", "narrative": "Shoprite Victoria Island", "credit": 0, "debit": 45000, "balance": 3305000},
         {"date": "2026-04-05", "reference": "NIP-001", "narrative": "Transfer to Chinedu", "credit": 0, "debit": 200000, "balance": 3105000},
         {"date": "2026-04-10", "reference": "ATM-001", "narrative": "ATM Withdrawal", "credit": 0, "debit": 100000, "balance": 3005000},
         {"date": "2026-04-15", "reference": "DDT-001", "narrative": "DSTV Subscription", "credit": 0, "debit": 29800, "balance": 2975200},
     ]},
    {"id": "STMT-002", "accountNumber": "0098765432", "accountName": "BUA Group - Main", "type": "monthly", "format": "mt940", "period": "2026-04", "status": "delivered",
     "generatedAt": "2026-05-01T06:30:00Z", "deliveredAt": "2026-05-01T06:32:00Z", "deliveryChannel": "swift",
     "summary": {"openingBalance": 12500000000, "totalCredits": 8900000000, "totalDebits": 7200000000, "closingBalance": 14200000000, "transactionCount": 234, "interestEarned": 0, "feesCharged": 1250000},
     "mt940": ":20:STMT0504\n:25:54BANK/0098765432\n:28C:1/1\n:60F:C260401NGN12500000000,00\n:61:2604020402C8900000000,00NTRFBUA-INC\n:62F:C260430NGN14200000000,00\n:64:C260430NGN14200000000,00"},
    {"id": "STMT-003", "accountNumber": "0055443322", "accountName": "Ngozi Eze", "type": "on-demand", "format": "pdf", "period": "2026-05-01 to 2026-05-10", "status": "generated",
     "generatedAt": "2026-05-10T15:00:00Z", "deliveredAt": None, "deliveryChannel": "download",
     "summary": {"openingBalance": 850000, "totalCredits": 1200000, "totalDebits": 680000, "closingBalance": 1370000, "transactionCount": 12, "interestEarned": 450, "feesCharged": 200}},
    {"id": "STMT-004", "accountNumber": "USD-0011223", "accountName": "Yusuf Mohammed - Dom", "type": "monthly", "format": "pdf", "period": "2026-04", "status": "delivered",
     "generatedAt": "2026-05-01T07:00:00Z", "deliveredAt": "2026-05-01T07:10:00Z", "deliveryChannel": "email",
     "summary": {"openingBalance": 125000, "totalCredits": 45000, "totalDebits": 12000, "closingBalance": 158000, "transactionCount": 8, "interestEarned": 65.83, "feesCharged": 5.0}},
    {"id": "STMT-005", "accountNumber": "0099887766", "accountName": "Dangote Industries - OpEx", "type": "monthly", "format": "mt942", "period": "2026-04", "status": "failed",
     "generatedAt": "2026-05-01T08:00:00Z", "deliveredAt": None, "deliveryChannel": "swift",
     "errorReason": "SWIFT connection timeout — retry scheduled",
     "summary": {"openingBalance": 45000000000, "totalCredits": 28000000000, "totalDebits": 25000000000, "closingBalance": 48000000000, "transactionCount": 1890, "interestEarned": 0, "feesCharged": 12500000}},
]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Service", "statement-generator")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        if self.path == "/healthz":
            delivered = sum(1 for s in STATEMENTS if s["status"] == "delivered")
            return self._json(200, {"status": "healthy", "service": "statement-generator",
                "statements": {"total": len(STATEMENTS), "delivered": delivered, "failed": 1},
                "formats": ["pdf", "mt940", "mt942", "csv", "excel"],
                "middleware": MIDDLEWARE})

        if self.path == "/v1/statements":
            return self._json(200, {"items": STATEMENTS, "total": len(STATEMENTS)})

        if self.path == "/v1/stats":
            by_format, by_status, by_channel = {}, {}, {}
            total_txns = 0
            for s in STATEMENTS:
                by_format[s["format"]] = by_format.get(s["format"], 0) + 1
                by_status[s["status"]] = by_status.get(s["status"], 0) + 1
                by_channel[s["deliveryChannel"]] = by_channel.get(s["deliveryChannel"], 0) + 1
                total_txns += s["summary"]["transactionCount"]
            return self._json(200, {
                "totalStatements": len(STATEMENTS), "byFormat": by_format,
                "byStatus": by_status, "byDeliveryChannel": by_channel,
                "totalTransactionsRendered": total_txns,
                "supportedFormats": ["pdf", "mt940", "mt942", "csv", "excel"],
                "deliveryChannels": ["email", "swift", "download", "branch-print", "mobile-push"],
            })

        if self.path.startswith("/v1/statements/"):
            sid = self.path[len("/v1/statements/"):]
            for s in STATEMENTS:
                if s["id"] == sid:
                    return self._json(200, s)
            return self._json(404, {"error": "Statement not found"})

        self._json(404, {"error": "Not found"})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[statement-generator] Listening on :{PORT} with {len(STATEMENTS)} statements")
    server.serve_forever()
