"""
Reconciliation Service - Settlement reconciliation for payment corridors

Features:
- Compare transaction-service records vs TigerBeetle ledger
- Compare internal records vs corridor provider statements
- Detect and surface discrepancies
- Generate reconciliation reports
- Raise exceptions for manual resolution
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
import logging
import uuid
import os
from lakehouse_publisher import publish_reconciliation_to_lakehouse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Reconciliation Service",
    description="Settlement reconciliation for payment corridors",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Enums and Constants ====================

class ReconciliationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class DiscrepancyType(str, Enum):
    MISSING_IN_LEDGER = "missing_in_ledger"
    MISSING_IN_PROVIDER = "missing_in_provider"
    AMOUNT_MISMATCH = "amount_mismatch"
    STATUS_MISMATCH = "status_mismatch"
    DUPLICATE_TRANSACTION = "duplicate_transaction"
    CURRENCY_MISMATCH = "currency_mismatch"


class DiscrepancySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CorridorType(str, Enum):
    MOJALOOP = "mojaloop"
    PAPSS = "papss"
    UPI = "upi"
    PIX = "pix"
    NIBSS = "nibss"
    INTERNAL = "internal"


# ==================== Request/Response Models ====================

class ReconciliationRequest(BaseModel):
    """Request to start a reconciliation job"""
    corridor: CorridorType
    start_date: date
    end_date: date
    include_pending: bool = False


class TransactionRecord(BaseModel):
    """Internal transaction record"""
    transaction_id: str
    reference: str
    amount: float
    currency: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    corridor: str
    metadata: Optional[Dict[str, Any]] = None


class LedgerRecord(BaseModel):
    """TigerBeetle ledger record"""
    ledger_id: str
    transaction_id: str
    debit_account: str
    credit_account: str
    amount: float
    currency: str
    timestamp: datetime
    pending: bool = False


class ProviderRecord(BaseModel):
    """External provider settlement record"""
    provider_reference: str
    internal_reference: Optional[str] = None
    amount: float
    currency: str
    status: str
    settlement_date: datetime
    provider_metadata: Optional[Dict[str, Any]] = None


class Discrepancy(BaseModel):
    """Reconciliation discrepancy"""
    id: str
    type: DiscrepancyType
    severity: DiscrepancySeverity
    transaction_id: Optional[str] = None
    internal_amount: Optional[float] = None
    external_amount: Optional[float] = None
    internal_status: Optional[str] = None
    external_status: Optional[str] = None
    description: str
    recommended_action: str
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None


class ReconciliationReport(BaseModel):
    """Reconciliation report"""
    id: str
    corridor: CorridorType
    start_date: date
    end_date: date
    status: ReconciliationStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    # Counts
    total_internal_records: int = 0
    total_ledger_records: int = 0
    total_provider_records: int = 0
    matched_records: int = 0
    
    # Amounts
    total_internal_amount: float = 0.0
    total_ledger_amount: float = 0.0
    total_provider_amount: float = 0.0
    
    # Discrepancies
    discrepancies: List[Discrepancy] = []
    discrepancy_count: int = 0
    critical_discrepancies: int = 0
    
    # Summary
    reconciliation_rate: float = 0.0
    amount_variance: float = 0.0


class ResolveDiscrepancyRequest(BaseModel):
    """Request to resolve a discrepancy"""
    discrepancy_id: str
    resolution_notes: str
    resolved_by: str
    action_taken: str


# ==================== In-Memory Storage (Replace with DB in production) ====================

reconciliation_jobs: Dict[str, ReconciliationReport] = {}
all_discrepancies: Dict[str, Discrepancy] = {}

# Mock data for demonstration
mock_internal_transactions: List[TransactionRecord] = []
mock_ledger_records: List[LedgerRecord] = []
mock_provider_records: Dict[str, List[ProviderRecord]] = {}


# ==================== Helper Functions ====================

def generate_mock_data(corridor: CorridorType, start_date: date, end_date: date):
    """Generate mock data for reconciliation testing"""
    import random
    
    # Generate internal transactions
    transactions = []
    for i in range(100):
        txn_date = start_date + timedelta(days=random.randint(0, (end_date - start_date).days))
        transactions.append(TransactionRecord(
            transaction_id=f"TXN-{uuid.uuid4().hex[:8].upper()}",
            reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
            amount=random.uniform(1000, 500000),
            currency="NGN",
            status=random.choice(["completed", "completed", "completed", "pending", "failed"]),
            created_at=datetime.combine(txn_date, datetime.min.time()),
            completed_at=datetime.combine(txn_date, datetime.min.time()) if random.random() > 0.1 else None,
            corridor=corridor.value
        ))
    
    # Generate ledger records (95% match rate)
    ledger_records = []
    for txn in transactions[:95]:
        ledger_records.append(LedgerRecord(
            ledger_id=f"LED-{uuid.uuid4().hex[:8].upper()}",
            transaction_id=txn.transaction_id,
            debit_account="WALLET-001",
            credit_account="SETTLEMENT-001",
            amount=txn.amount if random.random() > 0.05 else txn.amount * 1.01,  # 5% amount mismatch
            currency=txn.currency,
            timestamp=txn.created_at,
            pending=txn.status == "pending"
        ))
    
    # Generate provider records (90% match rate)
    provider_records = []
    for txn in transactions[:90]:
        provider_records.append(ProviderRecord(
            provider_reference=f"PRV-{uuid.uuid4().hex[:8].upper()}",
            internal_reference=txn.reference,
            amount=txn.amount if random.random() > 0.03 else txn.amount * 0.99,  # 3% amount mismatch
            currency=txn.currency,
            status="settled" if txn.status == "completed" else txn.status,
            settlement_date=txn.created_at
        ))
    
    return transactions, ledger_records, provider_records


def compare_records(
    internal: List[TransactionRecord],
    ledger: List[LedgerRecord],
    provider: List[ProviderRecord]
) -> List[Discrepancy]:
    """Compare records and identify discrepancies"""
    discrepancies = []
    
    # Create lookup maps
    internal_by_id = {t.transaction_id: t for t in internal}
    ledger_by_txn = {l.transaction_id: l for l in ledger}
    provider_by_ref = {p.internal_reference: p for p in provider if p.internal_reference}
    
    # Check internal vs ledger
    for txn_id, txn in internal_by_id.items():
        if txn_id not in ledger_by_txn:
            discrepancies.append(Discrepancy(
                id=str(uuid.uuid4()),
                type=DiscrepancyType.MISSING_IN_LEDGER,
                severity=DiscrepancySeverity.HIGH,
                transaction_id=txn_id,
                internal_amount=txn.amount,
                description=f"Transaction {txn_id} exists in internal records but not in ledger",
                recommended_action="Investigate missing ledger entry and create if valid"
            ))
        else:
            ledger_rec = ledger_by_txn[txn_id]
            if abs(txn.amount - ledger_rec.amount) > 0.01:
                discrepancies.append(Discrepancy(
                    id=str(uuid.uuid4()),
                    type=DiscrepancyType.AMOUNT_MISMATCH,
                    severity=DiscrepancySeverity.CRITICAL if abs(txn.amount - ledger_rec.amount) > 1000 else DiscrepancySeverity.MEDIUM,
                    transaction_id=txn_id,
                    internal_amount=txn.amount,
                    external_amount=ledger_rec.amount,
                    description=f"Amount mismatch: internal={txn.amount:.2f}, ledger={ledger_rec.amount:.2f}",
                    recommended_action="Verify correct amount and adjust ledger if needed"
                ))
    
    # Check internal vs provider
    for txn in internal:
        if txn.reference not in provider_by_ref and txn.status == "completed":
            discrepancies.append(Discrepancy(
                id=str(uuid.uuid4()),
                type=DiscrepancyType.MISSING_IN_PROVIDER,
                severity=DiscrepancySeverity.HIGH,
                transaction_id=txn.transaction_id,
                internal_amount=txn.amount,
                internal_status=txn.status,
                description=f"Completed transaction {txn.transaction_id} not found in provider settlement",
                recommended_action="Contact provider to verify settlement status"
            ))
        elif txn.reference in provider_by_ref:
            prov_rec = provider_by_ref[txn.reference]
            if abs(txn.amount - prov_rec.amount) > 0.01:
                discrepancies.append(Discrepancy(
                    id=str(uuid.uuid4()),
                    type=DiscrepancyType.AMOUNT_MISMATCH,
                    severity=DiscrepancySeverity.CRITICAL if abs(txn.amount - prov_rec.amount) > 1000 else DiscrepancySeverity.MEDIUM,
                    transaction_id=txn.transaction_id,
                    internal_amount=txn.amount,
                    external_amount=prov_rec.amount,
                    description=f"Provider amount mismatch: internal={txn.amount:.2f}, provider={prov_rec.amount:.2f}",
                    recommended_action="Reconcile with provider and adjust if needed"
                ))
    
    return discrepancies


# ==================== API Endpoints ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "reconciliation-service"}


@app.post("/reconcile", response_model=ReconciliationReport)
async def start_reconciliation(
    request: ReconciliationRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a reconciliation job for a specific corridor and date range.
    
    This compares:
    1. Internal transaction records
    2. TigerBeetle ledger entries
    3. External provider settlement statements
    """
    job_id = str(uuid.uuid4())
    
    report = ReconciliationReport(
        id=job_id,
        corridor=request.corridor,
        start_date=request.start_date,
        end_date=request.end_date,
        status=ReconciliationStatus.IN_PROGRESS,
        started_at=datetime.utcnow()
    )
    
    reconciliation_jobs[job_id] = report
    
    # Run reconciliation (in production, this would be a background task)
    # For demo, we'll run it synchronously with mock data
    internal, ledger, provider = generate_mock_data(
        request.corridor, request.start_date, request.end_date
    )
    
    # Compare records
    discrepancies = compare_records(internal, ledger, provider)
    
    # Store discrepancies
    for d in discrepancies:
        all_discrepancies[d.id] = d
    
    # Update report
    report.total_internal_records = len(internal)
    report.total_ledger_records = len(ledger)
    report.total_provider_records = len(provider)
    report.matched_records = len(internal) - len([d for d in discrepancies if d.type == DiscrepancyType.MISSING_IN_LEDGER])
    
    report.total_internal_amount = sum(t.amount for t in internal)
    report.total_ledger_amount = sum(l.amount for l in ledger)
    report.total_provider_amount = sum(p.amount for p in provider)
    
    report.discrepancies = discrepancies
    report.discrepancy_count = len(discrepancies)
    report.critical_discrepancies = len([d for d in discrepancies if d.severity == DiscrepancySeverity.CRITICAL])
    
    report.reconciliation_rate = report.matched_records / report.total_internal_records if report.total_internal_records > 0 else 0
    report.amount_variance = abs(report.total_internal_amount - report.total_ledger_amount)
    
    report.status = ReconciliationStatus.COMPLETED
    report.completed_at = datetime.utcnow()
    
    logger.info(f"Reconciliation completed: {job_id}, discrepancies={len(discrepancies)}")
    
    # Publish reconciliation event to lakehouse (fire-and-forget)
    await publish_reconciliation_to_lakehouse(
        reconciliation_id=job_id,
        event_type="completed",
        recon_data={
            "corridor": request.corridor.value,
            "date": request.start_date.isoformat(),
            "total_transactions": report.total_internal_records,
            "matched_count": report.matched_records,
            "unmatched_count": report.discrepancy_count,
            "discrepancy_amount": report.amount_variance,
            "status": report.status.value,
            "settlement_amount": report.total_provider_amount
        }
    )
    
    return report


@app.get("/jobs", response_model=List[ReconciliationReport])
async def list_reconciliation_jobs(
    corridor: Optional[CorridorType] = None,
    status: Optional[ReconciliationStatus] = None,
    limit: int = 50
):
    """List reconciliation jobs with optional filters"""
    jobs = list(reconciliation_jobs.values())
    
    if corridor:
        jobs = [j for j in jobs if j.corridor == corridor]
    if status:
        jobs = [j for j in jobs if j.status == status]
    
    return sorted(jobs, key=lambda x: x.started_at, reverse=True)[:limit]


@app.get("/jobs/{job_id}", response_model=ReconciliationReport)
async def get_reconciliation_job(job_id: str):
    """Get details of a specific reconciliation job"""
    if job_id not in reconciliation_jobs:
        raise HTTPException(status_code=404, detail="Reconciliation job not found")
    return reconciliation_jobs[job_id]


@app.get("/discrepancies", response_model=List[Discrepancy])
async def list_discrepancies(
    severity: Optional[DiscrepancySeverity] = None,
    type: Optional[DiscrepancyType] = None,
    resolved: Optional[bool] = None,
    limit: int = 100
):
    """List all discrepancies with optional filters"""
    discrepancies = list(all_discrepancies.values())
    
    if severity:
        discrepancies = [d for d in discrepancies if d.severity == severity]
    if type:
        discrepancies = [d for d in discrepancies if d.type == type]
    if resolved is not None:
        discrepancies = [d for d in discrepancies if d.resolved == resolved]
    
    return discrepancies[:limit]


@app.get("/discrepancies/{discrepancy_id}", response_model=Discrepancy)
async def get_discrepancy(discrepancy_id: str):
    """Get details of a specific discrepancy"""
    if discrepancy_id not in all_discrepancies:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    return all_discrepancies[discrepancy_id]


@app.post("/discrepancies/{discrepancy_id}/resolve")
async def resolve_discrepancy(discrepancy_id: str, request: ResolveDiscrepancyRequest):
    """Resolve a discrepancy with notes"""
    if discrepancy_id not in all_discrepancies:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    
    discrepancy = all_discrepancies[discrepancy_id]
    discrepancy.resolved = True
    discrepancy.resolved_at = datetime.utcnow()
    discrepancy.resolved_by = request.resolved_by
    discrepancy.resolution_notes = f"{request.action_taken}: {request.resolution_notes}"
    
    logger.info(f"Discrepancy resolved: {discrepancy_id} by {request.resolved_by}")
    
    return {"message": "Discrepancy resolved", "discrepancy": discrepancy}


@app.get("/summary")
async def get_reconciliation_summary():
    """Get overall reconciliation summary"""
    total_jobs = len(reconciliation_jobs)
    completed_jobs = len([j for j in reconciliation_jobs.values() if j.status == ReconciliationStatus.COMPLETED])
    
    total_discrepancies = len(all_discrepancies)
    unresolved = len([d for d in all_discrepancies.values() if not d.resolved])
    critical = len([d for d in all_discrepancies.values() if d.severity == DiscrepancySeverity.CRITICAL and not d.resolved])
    
    return {
        "total_reconciliation_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "total_discrepancies": total_discrepancies,
        "unresolved_discrepancies": unresolved,
        "critical_unresolved": critical,
        "resolution_rate": (total_discrepancies - unresolved) / total_discrepancies if total_discrepancies > 0 else 1.0
    }


@app.post("/schedule/daily")
async def schedule_daily_reconciliation(corridor: CorridorType):
    """Schedule daily reconciliation for a corridor (called by cron)"""
    yesterday = date.today() - timedelta(days=1)
    
    request = ReconciliationRequest(
        corridor=corridor,
        start_date=yesterday,
        end_date=yesterday
    )
    
    # In production, this would add to a job queue
    logger.info(f"Scheduled daily reconciliation for {corridor} on {yesterday}")
    
    return {
        "message": f"Daily reconciliation scheduled for {corridor}",
        "date": yesterday.isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
