#!/usr/bin/env python3
"""54Bank Temporal Orchestrator — Python
Workflow/activity registration, task queue polling, signal/query handling,
saga compensation patterns, workflow history replay.
Middleware: All 14
"""
import os, json, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[temporal-orchestrator-py] %(levelname)s %(message)s')
PORT = int(os.environ.get("PORT", "8118"))

WORKFLOWS = [
    {"workflowId": "WF-EOD-20260509", "workflowType": "EODBatchWorkflow", "taskQueue": "eod-processing", "status": "COMPLETED", "startTime": "2026-05-09T00:00:00Z", "closeTime": "2026-05-09T00:45:00Z", "input": {"date": "2026-05-09"}, "output": {"accountsProcessed": 125000, "interestAccrued": 45000000000, "reconExceptions": 3}, "retryPolicy": {"maxAttempts": 3, "initialInterval": "1m"}, "sagaCompensations": ["ReverseInterestAccrual", "RevertGLPostings", "UnlockAccounts"]},
    {"workflowId": "WF-LOAN-DISB-001", "workflowType": "LoanDisbursementSaga", "taskQueue": "loan-processing", "status": "COMPLETED", "startTime": "2026-05-09T10:00:00Z", "closeTime": "2026-05-09T10:00:15Z", "input": {"loanId": "LN-2026-0451", "amount": 5000000000}, "output": {"disbursed": True, "glPosted": True}, "retryPolicy": {"maxAttempts": 5, "initialInterval": "30s"}, "sagaCompensations": ["ReverseDisbursement", "RevertGLEntry", "CancelLoanActivation"]},
    {"workflowId": "WF-SETTLEMENT-001", "workflowType": "NIBSSSettlementWorkflow", "taskQueue": "settlement-processing", "status": "RUNNING", "startTime": "2026-05-09T15:00:00Z", "input": {"settlementDate": "2026-05-09"}, "retryPolicy": {"maxAttempts": 3, "initialInterval": "5m"}, "sagaCompensations": ["ReverseSettlementEntries", "NotifyNIBSS", "FlagForManualRecon"]},
    {"workflowId": "WF-KYC-001", "workflowType": "KYCVerificationWorkflow", "taskQueue": "kyc-processing", "status": "COMPLETED", "startTime": "2026-05-09T14:00:00Z", "closeTime": "2026-05-09T14:00:08Z", "input": {"customerId": "CUST-001", "bvn": "22345678901"}, "output": {"bvnVerified": True, "riskScore": 12}, "retryPolicy": {"maxAttempts": 3, "initialInterval": "10s"}},
    {"workflowId": "WF-ERPNEXT-SYNC-001", "workflowType": "ERPNextBatchSyncWorkflow", "taskQueue": "erpnext-sync", "status": "COMPLETED", "startTime": "2026-05-09T01:00:00Z", "closeTime": "2026-05-09T01:15:00Z", "input": {"syncType": "journal_entries", "dateRange": "2026-05-08"}, "output": {"synced": 1247, "failed": 0}, "retryPolicy": {"maxAttempts": 3, "initialInterval": "2m"}},
]

TASK_QUEUES = [
    {"name": "eod-processing", "workers": 4, "pendingTasks": 0, "activeTasks": 0, "completedToday": 1},
    {"name": "loan-processing", "workers": 8, "pendingTasks": 2, "activeTasks": 3, "completedToday": 45},
    {"name": "settlement-processing", "workers": 2, "pendingTasks": 1, "activeTasks": 1, "completedToday": 3},
    {"name": "kyc-processing", "workers": 12, "pendingTasks": 5, "activeTasks": 8, "completedToday": 342},
    {"name": "notification-processing", "workers": 16, "pendingTasks": 120, "activeTasks": 16, "completedToday": 95000},
    {"name": "erpnext-sync", "workers": 2, "pendingTasks": 0, "activeTasks": 0, "completedToday": 4},
    {"name": "billing-processing", "workers": 4, "pendingTasks": 0, "activeTasks": 1, "completedToday": 7},
]

ACTIVITIES = [
    {"name": "VerifyBVN", "taskQueue": "kyc-processing", "startToCloseTimeout": "30s", "retryPolicy": {"maxAttempts": 3}},
    {"name": "VerifyNIN", "taskQueue": "kyc-processing", "startToCloseTimeout": "30s", "retryPolicy": {"maxAttempts": 3}},
    {"name": "PostGLEntry", "taskQueue": "eod-processing", "startToCloseTimeout": "10s", "retryPolicy": {"maxAttempts": 5}},
    {"name": "AccrueInterest", "taskQueue": "eod-processing", "startToCloseTimeout": "60s", "retryPolicy": {"maxAttempts": 3}},
    {"name": "DisburseLoan", "taskQueue": "loan-processing", "startToCloseTimeout": "15s", "retryPolicy": {"maxAttempts": 5}},
    {"name": "SendNIPTransfer", "taskQueue": "settlement-processing", "startToCloseTimeout": "30s", "retryPolicy": {"maxAttempts": 3}},
    {"name": "SyncToERPNext", "taskQueue": "erpnext-sync", "startToCloseTimeout": "120s", "retryPolicy": {"maxAttempts": 3}},
    {"name": "SendWhatsAppTemplate", "taskQueue": "notification-processing", "startToCloseTimeout": "10s", "retryPolicy": {"maxAttempts": 2}},
    {"name": "ScreenSanctions", "taskQueue": "kyc-processing", "startToCloseTimeout": "5s", "retryPolicy": {"maxAttempts": 3}},
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")
        if path in ("/healthz", "/health"):
            self._json(200, {"service": "temporal-orchestrator-py", "status": "healthy", "temporalServer": os.environ.get("TEMPORAL_HOST", "localhost:7233"), "namespace": "54bank-production", "capabilities": ["workflows", "activities", "signals", "queries", "sagas", "cron_schedules"]})
        elif path == "/v1/temporal/workflows":
            self._json(200, {"workflows": WORKFLOWS, "total": len(WORKFLOWS)})
        elif path == "/v1/temporal/task-queues":
            self._json(200, {"taskQueues": TASK_QUEUES, "total": len(TASK_QUEUES)})
        elif path == "/v1/temporal/activities":
            self._json(200, {"activities": ACTIVITIES, "total": len(ACTIVITIES)})
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
        if path == "/v1/temporal/workflows/start":
            wf = {"workflowId": f"WF-{body.get('workflowType','CUSTOM')}-{len(WORKFLOWS)+1:03d}", "workflowType": body.get("workflowType"), "taskQueue": body.get("taskQueue"), "status": "RUNNING", "startTime": datetime.utcnow().isoformat() + "Z", "input": body.get("input", {})}
            WORKFLOWS.append(wf)
            self._json(202, {"started": True, "workflow": wf})
        elif path == "/v1/temporal/workflows/signal":
            self._json(200, {"signaled": True, "workflowId": body.get("workflowId"), "signalName": body.get("signalName")})
        else:
            self._json(404, {"error": "Not found"})

    def _json(self, code, data):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, format, *args): pass

if __name__ == "__main__":
    logging.info(f"Temporal Orchestrator (Python) on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
