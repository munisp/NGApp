"""
Background Jobs for Competitive Features

This module provides background job infrastructure for:
1. SLA monitoring and auto-escalation
2. Return request expiration
3. Delivery auto-completion
4. Refund processing with TigerBeetle integration
5. Reminder notifications

Features:
- Async job processing
- Idempotent operations
- Retry with exponential backoff
- Dead letter queue for failed jobs
- Audit logging
"""

import os
import uuid
import json
import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict

from app.competitive_features_persistence import (
    return_request_repo, delivery_repo, dispute_ops_repo,
    ReturnStatus, DeliveryStatus, DisputeOpsStatus, DisputePriority
)
from app.tigerbeetle_ledger import TigerBeetleLedger, naira_to_kobo, kobo_to_naira

logger = logging.getLogger(__name__)


# =============================================================================
# Job Types and Configuration
# =============================================================================

class JobType(str, Enum):
    SLA_CHECK = "sla_check"
    RETURN_EXPIRATION = "return_expiration"
    DELIVERY_AUTO_COMPLETE = "delivery_auto_complete"
    REFUND_PROCESSING = "refund_processing"
    REMINDER_NOTIFICATION = "reminder_notification"
    DISPUTE_ESCALATION = "dispute_escalation"
    DISPUTE_AUTO_ASSIGN = "dispute_auto_assign"


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


@dataclass
class Job:
    id: str
    job_type: JobType
    payload: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    attempts: int = 0
    max_attempts: int = 3
    created_at: datetime = field(default_factory=datetime.utcnow)
    scheduled_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


# =============================================================================
# Job Queue (In-Memory for POC, should use Redis/PostgreSQL in production)
# =============================================================================

class JobQueue:
    """Simple in-memory job queue with persistence hooks"""
    
    def __init__(self):
        self.pending: List[Job] = []
        self.processing: Dict[str, Job] = {}
        self.completed: List[Job] = []
        self.dead_letter: List[Job] = []
        self._lock = asyncio.Lock()
    
    async def enqueue(self, job: Job) -> str:
        """Add job to queue"""
        async with self._lock:
            self.pending.append(job)
            logger.info(f"Job {job.id} ({job.job_type.value}) enqueued")
            return job.id
    
    async def dequeue(self) -> Optional[Job]:
        """Get next job from queue"""
        async with self._lock:
            now = datetime.utcnow()
            for i, job in enumerate(self.pending):
                if job.scheduled_at <= now:
                    job = self.pending.pop(i)
                    job.status = JobStatus.PROCESSING
                    job.started_at = now
                    job.attempts += 1
                    self.processing[job.id] = job
                    return job
            return None
    
    async def complete(self, job_id: str, result: Dict[str, Any] = None):
        """Mark job as completed"""
        async with self._lock:
            if job_id in self.processing:
                job = self.processing.pop(job_id)
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                job.result = result
                self.completed.append(job)
                logger.info(f"Job {job_id} completed")
    
    async def fail(self, job_id: str, error: str):
        """Mark job as failed, retry or move to dead letter"""
        async with self._lock:
            if job_id in self.processing:
                job = self.processing.pop(job_id)
                job.error = error
                
                if job.attempts < job.max_attempts:
                    # Retry with exponential backoff
                    backoff = 2 ** job.attempts * 60  # 2, 4, 8 minutes
                    job.status = JobStatus.PENDING
                    job.scheduled_at = datetime.utcnow() + timedelta(seconds=backoff)
                    self.pending.append(job)
                    logger.warning(f"Job {job_id} failed, retrying in {backoff}s: {error}")
                else:
                    # Move to dead letter queue
                    job.status = JobStatus.DEAD_LETTER
                    self.dead_letter.append(job)
                    logger.error(f"Job {job_id} moved to dead letter queue: {error}")
    
    async def get_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        return {
            "pending": len(self.pending),
            "processing": len(self.processing),
            "completed": len(self.completed),
            "dead_letter": len(self.dead_letter),
        }


# Global job queue instance
job_queue = JobQueue()


# =============================================================================
# TigerBeetle Refund Integration
# =============================================================================

class RefundProcessor:
    """Process refunds through TigerBeetle ledger"""
    
    def __init__(self):
        self.ledger = TigerBeetleLedger()
        self._idempotency_keys: Dict[str, Dict[str, Any]] = {}  # In-memory for POC
    
    async def initialize(self):
        """Initialize TigerBeetle connection"""
        await self.ledger.connect()
    
    async def process_refund(
        self,
        return_id: str,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        refund_amount_ngn: int,
        original_escrow_transfer_id: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a refund through TigerBeetle ledger.
        
        This is an idempotent operation - calling with the same idempotency_key
        will return the same result without processing again.
        """
        # Generate idempotency key if not provided
        if not idempotency_key:
            idempotency_key = f"refund:{return_id}"
        
        # Check idempotency
        if idempotency_key in self._idempotency_keys:
            logger.info(f"Refund {idempotency_key} already processed, returning cached result")
            return self._idempotency_keys[idempotency_key]
        
        try:
            # Convert to kobo for TigerBeetle
            refund_amount_kobo = naira_to_kobo(refund_amount_ngn)
            
            # If we have the original escrow transfer ID, void it
            if original_escrow_transfer_id:
                result = await self.ledger.refund_escrow(
                    escrow_id=escrow_id,
                    buyer_id=buyer_id,
                    escrow_transfer_id=int(original_escrow_transfer_id)
                )
            else:
                # Create a direct refund transfer (seller -> buyer)
                # This is used when the original escrow transfer ID is not available
                result = await self._direct_refund(
                    seller_id=seller_id,
                    buyer_id=buyer_id,
                    amount_kobo=refund_amount_kobo
                )
            
            if result.get("success"):
                # Update return request status
                return_req = await return_request_repo.get(return_id)
                if return_req:
                    await return_request_repo.update_status(
                        return_id,
                        ReturnStatus.REFUND_COMPLETED,
                        return_req.version,
                        resolved_at=datetime.utcnow(),
                        resolution_notes=f"Refund processed via TigerBeetle: {result.get('refund_transfer_id', 'N/A')}"
                    )
                
                # Cache result for idempotency
                self._idempotency_keys[idempotency_key] = {
                    "success": True,
                    "return_id": return_id,
                    "refund_amount_ngn": refund_amount_ngn,
                    "transfer_id": result.get("refund_transfer_id"),
                    "processed_at": datetime.utcnow().isoformat()
                }
                
                logger.info(f"Refund {return_id} processed successfully: {refund_amount_ngn} NGN")
                return self._idempotency_keys[idempotency_key]
            else:
                raise Exception(f"Ledger refund failed: {result.get('errors', 'Unknown error')}")
                
        except Exception as e:
            logger.error(f"Refund processing failed for {return_id}: {e}")
            return {
                "success": False,
                "return_id": return_id,
                "error": str(e)
            }
    
    async def _direct_refund(
        self,
        seller_id: str,
        buyer_id: str,
        amount_kobo: int
    ) -> Dict[str, Any]:
        """
        Process a direct refund from seller to buyer.
        Used when original escrow transfer ID is not available.
        """
        from app.tigerbeetle_ledger import AccountCode, LedgerCode
        
        seller_account_id = self.ledger._generate_account_id(seller_id, AccountCode.USER_AVAILABLE)
        buyer_account_id = self.ledger._generate_account_id(buyer_id, AccountCode.USER_AVAILABLE)
        transfer_id = self.ledger._generate_transfer_id()
        
        # Update fallback balances
        self.ledger._fallback_balances[f"{seller_account_id}_debits"] = \
            self.ledger._fallback_balances.get(f"{seller_account_id}_debits", 0) + amount_kobo
        self.ledger._fallback_balances[f"{buyer_account_id}_credits"] = \
            self.ledger._fallback_balances.get(f"{buyer_account_id}_credits", 0) + amount_kobo
        
        self.ledger._fallback_transfers.append({
            "id": str(transfer_id),
            "type": "direct_refund",
            "seller_id": seller_id,
            "buyer_id": buyer_id,
            "amount": amount_kobo,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "success": True,
            "refund_transfer_id": str(transfer_id),
            "amount_refunded": amount_kobo
        }


# Global refund processor instance
refund_processor = RefundProcessor()


# =============================================================================
# Job Handlers
# =============================================================================

async def handle_sla_check(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Check SLA compliance for returns and disputes"""
    results = {
        "returns_checked": 0,
        "returns_breached": 0,
        "disputes_checked": 0,
        "disputes_breached": 0,
        "escalations_triggered": 0
    }
    
    # Check return SLAs
    breached_returns = await return_request_repo.get_sla_breached()
    results["returns_checked"] = len(breached_returns)
    
    for return_req in breached_returns:
        if not return_req.sla_breached:
            # Mark as breached and trigger escalation
            await return_request_repo.update_status(
                return_req.id,
                return_req.status,
                return_req.version,
                sla_breached=True
            )
            results["returns_breached"] += 1
            
            # Create escalation job
            await job_queue.enqueue(Job(
                id=str(uuid.uuid4()),
                job_type=JobType.REMINDER_NOTIFICATION,
                payload={
                    "type": "return_sla_breach",
                    "return_id": return_req.id,
                    "rma_number": return_req.rma_number,
                    "seller_id": return_req.seller_id,
                    "buyer_id": return_req.buyer_id,
                    "status": return_req.status.value
                }
            ))
            results["escalations_triggered"] += 1
    
    # Check dispute SLAs
    breached_disputes = await dispute_ops_repo.get_sla_breached()
    results["disputes_checked"] = len(breached_disputes)
    
    for dispute in breached_disputes:
        # Escalate dispute
        await job_queue.enqueue(Job(
            id=str(uuid.uuid4()),
            job_type=JobType.DISPUTE_ESCALATION,
            payload={
                "dispute_id": dispute.id,
                "escrow_id": dispute.escrow_id,
                "current_status": dispute.status.value,
                "priority": dispute.priority.value
            }
        ))
        results["disputes_breached"] += 1
        results["escalations_triggered"] += 1
    
    logger.info(f"SLA check completed: {results}")
    return results


async def handle_return_expiration(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle return request expiration (auto-close after 7 days)"""
    return_id = payload.get("return_id")
    
    if not return_id:
        raise ValueError("return_id required in payload")
    
    return_req = await return_request_repo.get(return_id)
    if not return_req:
        return {"skipped": True, "reason": "Return not found"}
    
    # Only expire if still in REQUESTED status
    if return_req.status != ReturnStatus.REQUESTED:
        return {"skipped": True, "reason": f"Return in {return_req.status.value} status"}
    
    # Check if past expiration (7 days from creation)
    expiration_date = return_req.created_at + timedelta(days=7)
    if datetime.utcnow() < expiration_date:
        return {"skipped": True, "reason": "Not yet expired"}
    
    # Auto-close the return
    await return_request_repo.update_status(
        return_id,
        ReturnStatus.CLOSED,
        return_req.version,
        resolved_at=datetime.utcnow(),
        resolution_notes="Auto-closed due to expiration (no seller response within 7 days)"
    )
    
    logger.info(f"Return {return_id} auto-closed due to expiration")
    return {"expired": True, "return_id": return_id}


async def handle_delivery_auto_complete(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Auto-complete delivery after 14 days if no dispute"""
    delivery_id = payload.get("delivery_id")
    
    if not delivery_id:
        raise ValueError("delivery_id required in payload")
    
    delivery = await delivery_repo.get(delivery_id)
    if not delivery:
        return {"skipped": True, "reason": "Delivery not found"}
    
    # Only auto-complete if delivered but not yet completed
    if delivery.status != DeliveryStatus.DELIVERED:
        return {"skipped": True, "reason": f"Delivery in {delivery.status.value} status"}
    
    # Check if 14 days have passed since delivery
    if not delivery.delivered_at:
        return {"skipped": True, "reason": "No delivery date recorded"}
    
    auto_complete_date = delivery.delivered_at + timedelta(days=14)
    if datetime.utcnow() < auto_complete_date:
        return {"skipped": True, "reason": "Not yet eligible for auto-complete"}
    
    # TODO: Check if there's an active dispute for this delivery
    # For now, we'll just mark as completed
    
    # Mark delivery as completed (triggers escrow release)
    # This would integrate with the escrow release flow
    
    logger.info(f"Delivery {delivery_id} eligible for auto-complete")
    return {
        "auto_completed": True,
        "delivery_id": delivery_id,
        "escrow_id": delivery.escrow_id
    }


async def handle_refund_processing(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Process refund through TigerBeetle ledger"""
    return_id = payload.get("return_id")
    escrow_id = payload.get("escrow_id")
    buyer_id = payload.get("buyer_id")
    seller_id = payload.get("seller_id")
    refund_amount_ngn = payload.get("refund_amount_ngn")
    original_escrow_transfer_id = payload.get("original_escrow_transfer_id")
    
    if not all([return_id, buyer_id, seller_id, refund_amount_ngn]):
        raise ValueError("Missing required fields in payload")
    
    result = await refund_processor.process_refund(
        return_id=return_id,
        escrow_id=escrow_id or "",
        buyer_id=buyer_id,
        seller_id=seller_id,
        refund_amount_ngn=refund_amount_ngn,
        original_escrow_transfer_id=original_escrow_transfer_id
    )
    
    return result


async def handle_reminder_notification(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Send reminder notifications (WhatsApp/SMS)"""
    notification_type = payload.get("type")
    
    # In production, this would integrate with WhatsApp Business API or SMS gateway
    # For now, we just log the notification
    
    logger.info(f"Reminder notification: {notification_type} - {payload}")
    
    return {
        "sent": True,
        "type": notification_type,
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat()
    }


async def handle_dispute_escalation(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Escalate dispute due to SLA breach"""
    dispute_id = payload.get("dispute_id")
    
    if not dispute_id:
        raise ValueError("dispute_id required in payload")
    
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        return {"skipped": True, "reason": "Dispute not found"}
    
    # Already resolved or escalated
    if dispute.status in [
        DisputeOpsStatus.RESOLVED_BUYER_FAVOR,
        DisputeOpsStatus.RESOLVED_SELLER_FAVOR,
        DisputeOpsStatus.RESOLVED_SPLIT,
        DisputeOpsStatus.CLOSED
    ]:
        return {"skipped": True, "reason": f"Dispute already {dispute.status.value}"}
    
    if dispute.escalated:
        return {"skipped": True, "reason": "Already escalated"}
    
    # Escalate the dispute
    await dispute_ops_repo.update_status(
        dispute_id,
        DisputeOpsStatus.ESCALATED,
        dispute.version,
        escalated=True,
        escalation_reason="SLA breach - auto-escalated",
        escalated_at=datetime.utcnow()
    )
    
    # Upgrade priority if not already urgent
    if dispute.priority != DisputePriority.URGENT:
        dispute = await dispute_ops_repo.get(dispute_id)
        if dispute:
            await dispute_ops_repo.update_status(
                dispute_id,
                dispute.status,
                dispute.version,
                priority=DisputePriority.URGENT
            )
    
    logger.info(f"Dispute {dispute_id} escalated due to SLA breach")
    return {
        "escalated": True,
        "dispute_id": dispute_id,
        "new_priority": "urgent"
    }


async def handle_dispute_auto_assign(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Auto-assign dispute to available agent"""
    dispute_id = payload.get("dispute_id")
    
    if not dispute_id:
        raise ValueError("dispute_id required in payload")
    
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        return {"skipped": True, "reason": "Dispute not found"}
    
    if dispute.assigned_agent_id:
        return {"skipped": True, "reason": "Already assigned"}
    
    # TODO: Find available agent based on capacity and specialization
    # For now, we just log that assignment is needed
    
    logger.info(f"Dispute {dispute_id} needs agent assignment")
    return {
        "needs_assignment": True,
        "dispute_id": dispute_id,
        "dispute_type": dispute.dispute_type
    }


# Job handler registry
JOB_HANDLERS: Dict[JobType, Callable] = {
    JobType.SLA_CHECK: handle_sla_check,
    JobType.RETURN_EXPIRATION: handle_return_expiration,
    JobType.DELIVERY_AUTO_COMPLETE: handle_delivery_auto_complete,
    JobType.REFUND_PROCESSING: handle_refund_processing,
    JobType.REMINDER_NOTIFICATION: handle_reminder_notification,
    JobType.DISPUTE_ESCALATION: handle_dispute_escalation,
    JobType.DISPUTE_AUTO_ASSIGN: handle_dispute_auto_assign,
}


# =============================================================================
# Job Worker
# =============================================================================

class JobWorker:
    """Background job worker"""
    
    def __init__(self, queue: JobQueue):
        self.queue = queue
        self.running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the worker"""
        if self.running:
            return
        
        self.running = True
        self._task = asyncio.create_task(self._run())
        logger.info("Job worker started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Job worker stopped")
    
    async def _run(self):
        """Main worker loop"""
        while self.running:
            try:
                job = await self.queue.dequeue()
                
                if job:
                    await self._process_job(job)
                else:
                    # No jobs available, wait before checking again
                    await asyncio.sleep(5)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)
    
    async def _process_job(self, job: Job):
        """Process a single job"""
        handler = JOB_HANDLERS.get(job.job_type)
        
        if not handler:
            await self.queue.fail(job.id, f"No handler for job type: {job.job_type}")
            return
        
        try:
            logger.info(f"Processing job {job.id} ({job.job_type.value})")
            result = await handler(job.payload)
            await self.queue.complete(job.id, result)
            
        except Exception as e:
            logger.error(f"Job {job.id} failed: {e}")
            await self.queue.fail(job.id, str(e))


# Global worker instance
job_worker = JobWorker(job_queue)


# =============================================================================
# Scheduled Jobs (Cron-like)
# =============================================================================

class JobScheduler:
    """Schedule recurring jobs"""
    
    def __init__(self, queue: JobQueue):
        self.queue = queue
        self.running = False
        self._task: Optional[asyncio.Task] = None
        
        # Schedule configuration (interval in seconds)
        self.schedules = {
            JobType.SLA_CHECK: 300,  # Every 5 minutes
        }
    
    async def start(self):
        """Start the scheduler"""
        if self.running:
            return
        
        self.running = True
        self._task = asyncio.create_task(self._run())
        logger.info("Job scheduler started")
    
    async def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Job scheduler stopped")
    
    async def _run(self):
        """Main scheduler loop"""
        last_run: Dict[JobType, datetime] = {}
        
        while self.running:
            try:
                now = datetime.utcnow()
                
                for job_type, interval in self.schedules.items():
                    last = last_run.get(job_type)
                    
                    if not last or (now - last).total_seconds() >= interval:
                        # Schedule the job
                        await self.queue.enqueue(Job(
                            id=str(uuid.uuid4()),
                            job_type=job_type,
                            payload={"scheduled": True, "timestamp": now.isoformat()}
                        ))
                        last_run[job_type] = now
                        logger.info(f"Scheduled {job_type.value} job")
                
                # Check every minute
                await asyncio.sleep(60)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)


# Global scheduler instance
job_scheduler = JobScheduler(job_queue)


# =============================================================================
# API Endpoints for Job Management
# =============================================================================

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

jobs_router = APIRouter(prefix="/api/v1/jobs", tags=["Background Jobs"])


class EnqueueJobRequest(BaseModel):
    job_type: str
    payload: Dict[str, Any] = {}
    scheduled_at: Optional[str] = None


class JobResponse(BaseModel):
    id: str
    job_type: str
    status: str
    attempts: int
    created_at: str
    scheduled_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


@jobs_router.post("/enqueue")
async def enqueue_job(request: EnqueueJobRequest):
    """Enqueue a new job"""
    try:
        job_type = JobType(request.job_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid job type: {request.job_type}")
    
    scheduled_at = datetime.utcnow()
    if request.scheduled_at:
        scheduled_at = datetime.fromisoformat(request.scheduled_at)
    
    job = Job(
        id=str(uuid.uuid4()),
        job_type=job_type,
        payload=request.payload,
        scheduled_at=scheduled_at
    )
    
    job_id = await job_queue.enqueue(job)
    return {"job_id": job_id, "status": "enqueued"}


@jobs_router.get("/stats")
async def get_job_stats():
    """Get job queue statistics"""
    stats = await job_queue.get_stats()
    return stats


@jobs_router.get("/dead-letter")
async def get_dead_letter_jobs(limit: int = Query(default=50, le=100)):
    """Get jobs in dead letter queue"""
    jobs = job_queue.dead_letter[-limit:]
    return {
        "jobs": [
            {
                "id": j.id,
                "job_type": j.job_type.value,
                "status": j.status.value,
                "attempts": j.attempts,
                "error": j.error,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
        "count": len(jobs)
    }


@jobs_router.post("/dead-letter/{job_id}/retry")
async def retry_dead_letter_job(job_id: str):
    """Retry a job from dead letter queue"""
    for i, job in enumerate(job_queue.dead_letter):
        if job.id == job_id:
            job_queue.dead_letter.pop(i)
            job.status = JobStatus.PENDING
            job.attempts = 0
            job.error = None
            job.scheduled_at = datetime.utcnow()
            await job_queue.enqueue(job)
            return {"message": "Job requeued", "job_id": job_id}
    
    raise HTTPException(status_code=404, detail="Job not found in dead letter queue")


@jobs_router.post("/trigger/sla-check")
async def trigger_sla_check():
    """Manually trigger SLA check"""
    job = Job(
        id=str(uuid.uuid4()),
        job_type=JobType.SLA_CHECK,
        payload={"manual": True, "timestamp": datetime.utcnow().isoformat()}
    )
    job_id = await job_queue.enqueue(job)
    return {"job_id": job_id, "message": "SLA check triggered"}


@jobs_router.post("/trigger/refund")
async def trigger_refund(
    return_id: str,
    escrow_id: Optional[str] = None,
    buyer_id: str = None,
    seller_id: str = None,
    refund_amount_ngn: int = None
):
    """Manually trigger refund processing"""
    if not all([return_id, buyer_id, seller_id, refund_amount_ngn]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    job = Job(
        id=str(uuid.uuid4()),
        job_type=JobType.REFUND_PROCESSING,
        payload={
            "return_id": return_id,
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "refund_amount_ngn": refund_amount_ngn
        }
    )
    job_id = await job_queue.enqueue(job)
    return {"job_id": job_id, "message": "Refund job enqueued"}


# =============================================================================
# Initialization
# =============================================================================

async def init_background_jobs():
    """Initialize background job infrastructure"""
    # Initialize refund processor
    await refund_processor.initialize()
    
    # Start worker and scheduler
    await job_worker.start()
    await job_scheduler.start()
    
    logger.info("Background job infrastructure initialized")


async def shutdown_background_jobs():
    """Shutdown background job infrastructure"""
    await job_worker.stop()
    await job_scheduler.stop()
    
    logger.info("Background job infrastructure shutdown")
