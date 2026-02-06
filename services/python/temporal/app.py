import asyncio
import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Temporal Workflow Service", version="1.0.0")


class WorkflowStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"


class WorkflowType(str, Enum):
    PAYMENT_PROCESS = "payment.process"
    PAYMENT_REFUND = "payment.refund"
    KYC_VERIFICATION = "kyc.verification"
    KYC_DOCUMENT_REVIEW = "kyc.document_review"
    ACCOUNT_ONBOARDING = "account.onboarding"
    ACCOUNT_CLOSURE = "account.closure"
    BNPL_APPLICATION = "bnpl.application"
    BNPL_COLLECTION = "bnpl.collection"
    TRANSFER_INTERNATIONAL = "transfer.international"
    TRANSFER_DOMESTIC = "transfer.domestic"
    LOAN_APPROVAL = "loan.approval"
    LOAN_DISBURSEMENT = "loan.disbursement"
    BILL_AUTOPAY = "bill.autopay"
    SAVINGS_CONTRIBUTION = "savings.scheduled_contribution"
    NOTIFICATION_BATCH = "notification.batch"
    REPORT_GENERATION = "report.generation"
    RECONCILIATION_DAILY = "reconciliation.daily"
    FRAUD_INVESTIGATION = "fraud.investigation"


WORKFLOW_CONFIGS = {
    WorkflowType.PAYMENT_PROCESS: {
        "task_queue": "payment-queue",
        "retry_max": 3,
        "timeout": "5m",
        "steps": ["validate_payment", "check_balance", "debit_account", "credit_account", "send_notification"],
    },
    WorkflowType.PAYMENT_REFUND: {
        "task_queue": "payment-queue",
        "retry_max": 5,
        "timeout": "10m",
        "steps": ["validate_refund", "reverse_debit", "reverse_credit", "update_ledger", "send_notification"],
    },
    WorkflowType.KYC_VERIFICATION: {
        "task_queue": "kyc-queue",
        "retry_max": 3,
        "timeout": "24h",
        "steps": ["collect_documents", "verify_identity", "check_sanctions", "check_pep", "risk_assessment", "decision"],
    },
    WorkflowType.KYC_DOCUMENT_REVIEW: {
        "task_queue": "kyc-queue",
        "retry_max": 2,
        "timeout": "48h",
        "steps": ["extract_data", "validate_document", "verify_authenticity", "manual_review_if_needed", "decision"],
    },
    WorkflowType.ACCOUNT_ONBOARDING: {
        "task_queue": "account-queue",
        "retry_max": 3,
        "timeout": "1h",
        "steps": ["create_user", "create_account", "setup_kyc", "create_ledger_account", "send_welcome"],
    },
    WorkflowType.ACCOUNT_CLOSURE: {
        "task_queue": "account-queue",
        "retry_max": 5,
        "timeout": "7d",
        "steps": ["check_pending_transactions", "settle_balances", "close_ledger", "archive_data", "send_confirmation"],
    },
    WorkflowType.BNPL_APPLICATION: {
        "task_queue": "bnpl-queue",
        "retry_max": 3,
        "timeout": "30m",
        "steps": ["check_eligibility", "credit_check", "calculate_terms", "create_plan", "send_approval"],
    },
    WorkflowType.BNPL_COLLECTION: {
        "task_queue": "bnpl-queue",
        "retry_max": 10,
        "timeout": "30d",
        "steps": ["check_due_date", "attempt_collection", "send_reminder", "escalate_if_failed", "update_status"],
    },
    WorkflowType.TRANSFER_INTERNATIONAL: {
        "task_queue": "transfer-queue",
        "retry_max": 5,
        "timeout": "72h",
        "steps": ["validate_transfer", "compliance_check", "fx_conversion", "initiate_swift", "confirm_receipt"],
    },
    WorkflowType.TRANSFER_DOMESTIC: {
        "task_queue": "transfer-queue",
        "retry_max": 3,
        "timeout": "30m",
        "steps": ["validate_transfer", "check_balance", "debit_source", "credit_destination", "send_notification"],
    },
    WorkflowType.LOAN_APPROVAL: {
        "task_queue": "loan-queue",
        "retry_max": 3,
        "timeout": "7d",
        "steps": ["collect_application", "credit_scoring", "risk_assessment", "underwriting", "decision", "send_result"],
    },
    WorkflowType.LOAN_DISBURSEMENT: {
        "task_queue": "loan-queue",
        "retry_max": 5,
        "timeout": "24h",
        "steps": ["verify_approval", "create_loan_account", "disburse_funds", "setup_repayment", "send_confirmation"],
    },
    WorkflowType.BILL_AUTOPAY: {
        "task_queue": "billing-queue",
        "retry_max": 5,
        "timeout": "24h",
        "steps": ["check_schedule", "validate_biller", "check_balance", "process_payment", "update_bill_status"],
    },
    WorkflowType.SAVINGS_CONTRIBUTION: {
        "task_queue": "savings-queue",
        "retry_max": 5,
        "timeout": "24h",
        "steps": ["check_schedule", "check_balance", "transfer_to_savings", "update_goal_progress", "send_notification"],
    },
    WorkflowType.NOTIFICATION_BATCH: {
        "task_queue": "notification-queue",
        "retry_max": 3,
        "timeout": "1h",
        "steps": ["collect_recipients", "prepare_templates", "send_batch", "track_delivery", "report_status"],
    },
    WorkflowType.REPORT_GENERATION: {
        "task_queue": "report-queue",
        "retry_max": 2,
        "timeout": "6h",
        "steps": ["collect_data", "aggregate_metrics", "generate_report", "store_report", "notify_requestor"],
    },
    WorkflowType.RECONCILIATION_DAILY: {
        "task_queue": "reconciliation-queue",
        "retry_max": 3,
        "timeout": "12h",
        "steps": ["fetch_transactions", "fetch_ledger_entries", "compare_records", "flag_discrepancies", "generate_report"],
    },
    WorkflowType.FRAUD_INVESTIGATION: {
        "task_queue": "fraud-queue",
        "retry_max": 2,
        "timeout": "48h",
        "steps": ["collect_evidence", "analyze_patterns", "check_related_accounts", "risk_scoring", "decision"],
    },
}


@dataclass
class WorkflowExecution:
    workflow_id: str
    run_id: str
    workflow_type: str
    status: WorkflowStatus
    start_time: float
    end_time: Optional[float] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    current_step: int = 0
    total_steps: int = 0
    input_data: dict = field(default_factory=dict)


active_workflows: dict[str, WorkflowExecution] = {}
workflow_history: list[WorkflowExecution] = []
connected = False

TEMPORAL_ADDRESS = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
TEMPORAL_NAMESPACE = os.getenv("TEMPORAL_NAMESPACE", "fintech")


class StartWorkflowRequest(BaseModel):
    workflow_type: WorkflowType
    workflow_id: Optional[str] = None
    input_data: dict = {}


class SignalRequest(BaseModel):
    signal_name: str
    input_data: dict = {}


@app.on_event("startup")
async def startup():
    global connected
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"http://{TEMPORAL_ADDRESS.replace(':7233', ':8233')}/api/v1/namespaces")
            if resp.status_code == 200:
                connected = True
                print(f"[Temporal] Connected to {TEMPORAL_ADDRESS}, namespace: {TEMPORAL_NAMESPACE}")
    except Exception:
        connected = False
        print(f"[Temporal] Server not available at {TEMPORAL_ADDRESS}, running in local mode")


@app.get("/health")
async def health():
    return {
        "connected": connected,
        "address": TEMPORAL_ADDRESS,
        "namespace": TEMPORAL_NAMESPACE,
        "active_workflows": len(active_workflows),
        "completed_workflows": len(workflow_history),
    }


@app.post("/workflows/start")
async def start_workflow(req: StartWorkflowRequest):
    config = WORKFLOW_CONFIGS.get(req.workflow_type)
    if not config:
        raise HTTPException(status_code=400, detail=f"Unknown workflow type: {req.workflow_type}")

    workflow_id = req.workflow_id or f"{req.workflow_type.value}-{uuid.uuid4().hex[:8]}"
    run_id = f"run-{uuid.uuid4().hex[:12]}"

    execution = WorkflowExecution(
        workflow_id=workflow_id,
        run_id=run_id,
        workflow_type=req.workflow_type.value,
        status=WorkflowStatus.RUNNING,
        start_time=time.time(),
        total_steps=len(config["steps"]),
        input_data=req.input_data,
    )

    active_workflows[workflow_id] = execution
    print(f"[Temporal] Started workflow {req.workflow_type.value}: {workflow_id}")

    asyncio.create_task(_simulate_workflow(workflow_id, config))

    return {
        "workflow_id": workflow_id,
        "run_id": run_id,
        "status": execution.status.value,
        "task_queue": config["task_queue"],
        "steps": config["steps"],
    }


async def _simulate_workflow(workflow_id: str, config: dict):
    execution = active_workflows.get(workflow_id)
    if not execution:
        return

    steps = config["steps"]
    for i, step in enumerate(steps):
        if workflow_id not in active_workflows:
            return
        execution.current_step = i + 1
        await asyncio.sleep(0.5)

    if workflow_id in active_workflows:
        execution.status = WorkflowStatus.COMPLETED
        execution.end_time = time.time()
        execution.result = {"completed_steps": steps}
        del active_workflows[workflow_id]
        workflow_history.append(execution)
        if len(workflow_history) > 10000:
            workflow_history.pop(0)


@app.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    execution = active_workflows.get(workflow_id)
    if not execution:
        for hist in reversed(workflow_history):
            if hist.workflow_id == workflow_id:
                execution = hist
                break

    if not execution:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    config = WORKFLOW_CONFIGS.get(WorkflowType(execution.workflow_type), {})
    steps = config.get("steps", [])

    return {
        "workflow_id": execution.workflow_id,
        "run_id": execution.run_id,
        "workflow_type": execution.workflow_type,
        "status": execution.status.value,
        "start_time": execution.start_time,
        "end_time": execution.end_time,
        "current_step": execution.current_step,
        "total_steps": execution.total_steps,
        "current_step_name": steps[execution.current_step - 1] if execution.current_step > 0 and steps else None,
        "result": execution.result,
        "error": execution.error,
    }


@app.post("/workflows/{workflow_id}/signal")
async def signal_workflow(workflow_id: str, req: SignalRequest):
    if workflow_id not in active_workflows:
        raise HTTPException(status_code=404, detail=f"Active workflow {workflow_id} not found")

    print(f"[Temporal] Signal {req.signal_name} sent to {workflow_id}")
    return {"status": "signaled", "signal": req.signal_name}


@app.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    execution = active_workflows.get(workflow_id)
    if not execution:
        raise HTTPException(status_code=404, detail=f"Active workflow {workflow_id} not found")

    execution.status = WorkflowStatus.CANCELLED
    execution.end_time = time.time()
    del active_workflows[workflow_id]
    workflow_history.append(execution)

    return {"status": "cancelled"}


@app.get("/workflows")
async def list_workflows(status: Optional[str] = None, limit: int = 50):
    results = []

    for execution in active_workflows.values():
        if not status or execution.status.value == status:
            results.append({
                "workflow_id": execution.workflow_id,
                "workflow_type": execution.workflow_type,
                "status": execution.status.value,
                "start_time": execution.start_time,
                "current_step": execution.current_step,
                "total_steps": execution.total_steps,
            })

    for execution in reversed(workflow_history[-limit:]):
        if not status or execution.status.value == status:
            results.append({
                "workflow_id": execution.workflow_id,
                "workflow_type": execution.workflow_type,
                "status": execution.status.value,
                "start_time": execution.start_time,
                "end_time": execution.end_time,
            })

    return results[:limit]


@app.get("/task-queues")
async def list_task_queues():
    queues = set()
    for config in WORKFLOW_CONFIGS.values():
        queues.add(config["task_queue"])
    return sorted(queues)


@app.get("/metrics")
async def get_metrics():
    status_counts: dict[str, int] = {}
    for execution in active_workflows.values():
        status_counts[execution.status.value] = status_counts.get(execution.status.value, 0) + 1
    for execution in workflow_history:
        status_counts[execution.status.value] = status_counts.get(execution.status.value, 0) + 1

    type_counts: dict[str, int] = {}
    for execution in list(active_workflows.values()) + workflow_history:
        type_counts[execution.workflow_type] = type_counts.get(execution.workflow_type, 0) + 1

    durations = [
        e.end_time - e.start_time
        for e in workflow_history
        if e.end_time and e.status == WorkflowStatus.COMPLETED
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0

    return {
        "active_workflows": len(active_workflows),
        "completed_workflows": len([w for w in workflow_history if w.status == WorkflowStatus.COMPLETED]),
        "failed_workflows": len([w for w in workflow_history if w.status == WorkflowStatus.FAILED]),
        "cancelled_workflows": len([w for w in workflow_history if w.status == WorkflowStatus.CANCELLED]),
        "status_counts": status_counts,
        "type_counts": type_counts,
        "avg_duration_seconds": avg_duration,
        "task_queues": len(set(c["task_queue"] for c in WORKFLOW_CONFIGS.values())),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("TEMPORAL_SERVICE_PORT", "8085"))
    uvicorn.run(app, host="0.0.0.0", port=port)
