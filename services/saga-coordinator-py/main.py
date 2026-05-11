"""
Saga Coordinator — Dual-Write Prevention for TigerBeetle ↔ Postgres
Port: 8266
Language: Python (orchestration, compensating transactions, audit logging)
Middleware: Kafka, Redis, Postgres, TigerBeetle, Temporal, Dapr, OpenSearch, Lakehouse
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get("PORT", "8266"))

MIDDLEWARE = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": "saga.events,saga.compensations,saga.audit"},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "purpose": "saga-state,idempotency-keys"},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "saga_definitions,saga_executions,saga_steps,saga_audit"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "purpose": "financial-ledger-transactions"},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflow": "SagaCoordinatorWorkflow", "namespace": "saga_coordinator"},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "pubsub": "saga-events"},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "index": "saga-audit-*"},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "saga-admin"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "schema": "saga:execute,saga:compensate"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topic": "saga-stream"},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:4000"), "purpose": "cross-border-saga"},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "route": "/saga/*"},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "saga-protection"},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "saga_execution_history,compensation_events"},
}

SAGA_DEFINITIONS = [
    {"id": "SAGA-001", "name": "Account Opening Saga", "status": "active", "totalExecutions": 2800000, "successRate": 0.9992,
     "steps": [
         {"order": 1, "service": "core-banking-go", "action": "INSERT INTO accounts", "compensatingAction": "DELETE FROM accounts WHERE id = :id"},
         {"order": 2, "service": "tigerbeetle-adapter-rs", "action": "create_account(ledger=1)", "compensatingAction": "No-op (immutable)"},
         {"order": 3, "service": "keycloak-identity-py", "action": "create_user_with_role", "compensatingAction": "delete_user(:userId)"},
         {"order": 4, "service": "kafka-broker-go", "action": "publish(cdc.core-banking.accounts)", "compensatingAction": "publish(rollback)"},
     ]},
    {"id": "SAGA-002", "name": "Loan Disbursement Saga", "status": "active", "totalExecutions": 850000, "successRate": 0.9988,
     "steps": [
         {"order": 1, "service": "lending-engine-go", "action": "UPDATE loans SET status='disbursing'", "compensatingAction": "UPDATE loans SET status='approved'"},
         {"order": 2, "service": "tigerbeetle-adapter-rs", "action": "create_transfer(debit=GL-1200, credit=customer)", "compensatingAction": "create_transfer(reverse=true)"},
         {"order": 3, "service": "gl-engine-rs", "action": "post_journal", "compensatingAction": "reverse_journal(:journalId)"},
         {"order": 4, "service": "kafka-broker-go", "action": "publish(cdc.lending.disbursements)", "compensatingAction": "publish(rollback)"},
     ]},
    {"id": "SAGA-003", "name": "NIP Transfer Saga", "status": "active", "totalExecutions": 45200000, "successRate": 0.9997,
     "steps": [
         {"order": 1, "service": "tigerbeetle-adapter-rs", "action": "create_transfer(pending=true)", "compensatingAction": "void_pending_transfer"},
         {"order": 2, "service": "nibss-gateway-go", "action": "POST /nip/funds-transfer", "compensatingAction": "POST /nip/reversal"},
         {"order": 3, "service": "tigerbeetle-adapter-rs", "action": "post_pending_transfer", "compensatingAction": "void_pending_transfer"},
         {"order": 4, "service": "payments-hub-go", "action": "INSERT INTO transaction_log", "compensatingAction": "UPDATE status='reversed'"},
     ]},
    {"id": "SAGA-004", "name": "Fee Charge Saga", "status": "active", "totalExecutions": 12500000, "successRate": 0.9999,
     "steps": [
         {"order": 1, "service": "tigerbeetle-adapter-rs", "action": "create_transfer(debit=customer, credit=fee_income)", "compensatingAction": "reverse"},
         {"order": 2, "service": "billing-rating-rs", "action": "INSERT INTO fee_transactions", "compensatingAction": "DELETE"},
         {"order": 3, "service": "kafka-broker-go", "action": "publish(cdc.billing.charges)", "compensatingAction": "No-op"},
     ]},
    {"id": "SAGA-005", "name": "EOD Interest Accrual Saga", "status": "active", "totalExecutions": 365, "successRate": 1.0,
     "steps": [
         {"order": 1, "service": "batch-eod-engine-py", "action": "compute_daily_interest", "compensatingAction": "rollback_batch"},
         {"order": 2, "service": "tigerbeetle-adapter-rs", "action": "batch_create_transfers", "compensatingAction": "batch_void_transfers"},
         {"order": 3, "service": "gl-engine-rs", "action": "batch_post_journals", "compensatingAction": "batch_reverse_journals"},
         {"order": 4, "service": "reconciliation-engine-rs", "action": "run_eod_reconciliation", "compensatingAction": "flag_manual_review"},
     ]},
    {"id": "SAGA-006", "name": "FX Trade Execution Saga", "status": "active", "totalExecutions": 3500000, "successRate": 0.9994,
     "steps": [
         {"order": 1, "service": "tigerbeetle-adapter-rs", "action": "create_transfer(debit=source_ccy, credit=target_ccy)", "compensatingAction": "reverse"},
         {"order": 2, "service": "fx-rates-engine-rs", "action": "INSERT INTO fx_trades", "compensatingAction": "UPDATE status='cancelled'"},
         {"order": 3, "service": "treasury-go", "action": "update_position", "compensatingAction": "rollback_position"},
         {"order": 4, "service": "kafka-broker-go", "action": "publish(cdc.treasury.trades)", "compensatingAction": "No-op"},
     ]},
]

SAGA_EXECUTIONS = [
    {"id": "SEXE-001", "sagaId": "SAGA-003", "sagaName": "NIP Transfer Saga", "status": "completed", "currentStep": 4, "totalSteps": 4, "tenantId": "TEN-GTBANK", "durationMs": 165},
    {"id": "SEXE-002", "sagaId": "SAGA-004", "sagaName": "Fee Charge Saga", "status": "completed", "currentStep": 3, "totalSteps": 3, "tenantId": "TEN-FIRSTBANK", "durationMs": 88},
    {"id": "SEXE-003", "sagaId": "SAGA-001", "sagaName": "Account Opening Saga", "status": "completed", "currentStep": 4, "totalSteps": 4, "tenantId": "TEN-ZENITH", "durationMs": 420},
    {"id": "SEXE-004", "sagaId": "SAGA-002", "sagaName": "Loan Disbursement Saga", "status": "compensating", "currentStep": 2, "totalSteps": 4, "tenantId": "TEN-UBA", "durationMs": 1450, "compensationReason": "insufficient_funds on GL-1200-LOAN-ASSET"},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        routes = {
            "/healthz": lambda: {"status": "ok", "service": "saga-coordinator-py", "port": PORT, "middleware": MIDDLEWARE},
            "/v1/sagas": lambda: {"items": SAGA_DEFINITIONS, "total": len(SAGA_DEFINITIONS)},
            "/v1/saga-executions": lambda: {"items": SAGA_EXECUTIONS, "total": len(SAGA_EXECUTIONS)},
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Saga Coordinator (Python) listening on :{PORT}")
    server.serve_forever()
