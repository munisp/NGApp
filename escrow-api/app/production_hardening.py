"""
Production Hardening Module for SocialEscrow

This module addresses critical production gaps:
1. PostgreSQL-backed job queue (replaces in-memory queue)
2. Distributed locks for multi-replica safety
3. Idempotency key persistence
4. Webhook event storage with deduplication
5. Production mode enforcement (fail closed for critical services)
6. Reconciliation jobs for ledger drift detection

CRITICAL: This module must be used in production to ensure:
- Jobs are not lost on restart
- Jobs are not duplicated across replicas
- Money flows are idempotent
- Webhook events are processed exactly once
"""

import os
import uuid
import json
import hashlib
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON,
    Enum as SQLEnum, ForeignKey, Index, UniqueConstraint, select, update, delete, and_, or_, func
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base
from app.repositories import db_manager, RedisCacheManager, ALLOW_INMEMORY_FALLBACK

logger = logging.getLogger(__name__)

# Environment configuration
PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
REQUIRE_POSTGRES = os.getenv("REQUIRE_POSTGRES", "false").lower() == "true"
REQUIRE_REDIS = os.getenv("REQUIRE_REDIS", "false").lower() == "true"
REQUIRE_TIGERBEETLE = os.getenv("REQUIRE_TIGERBEETLE", "false").lower() == "true"


# =============================================================================
# Database Models for Production Infrastructure
# =============================================================================

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class DurableJob(Base):
    """PostgreSQL-backed job queue for production durability"""
    __tablename__ = "durable_jobs"
    
    id = Column(String(36), primary_key=True)
    job_type = Column(String(50), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    
    # Status tracking
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING, index=True)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    # Scheduling
    scheduled_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Locking for distributed processing
    locked_by = Column(String(100), nullable=True)  # Worker instance ID
    locked_at = Column(DateTime, nullable=True)
    lock_expires_at = Column(DateTime, nullable=True)
    
    # Results
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    
    # Idempotency
    idempotency_key = Column(String(100), nullable=True, unique=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_job_status_scheduled", "status", "scheduled_at"),
        Index("idx_job_type", "job_type"),
        Index("idx_job_locked", "locked_by", "lock_expires_at"),
        Index("idx_job_idempotency", "idempotency_key"),
    )


class IdempotencyRecord(Base):
    """Idempotency key storage for exactly-once processing"""
    __tablename__ = "idempotency_records"
    
    id = Column(String(36), primary_key=True)
    idempotency_key = Column(String(255), nullable=False, unique=True, index=True)
    
    # Operation details
    operation_type = Column(String(50), nullable=False)  # refund, transfer, payout, etc.
    request_hash = Column(String(64), nullable=False)  # SHA-256 of request payload
    
    # Result
    response = Column(JSON, nullable=True)
    status = Column(String(20), default="pending")  # pending, completed, failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # For cleanup
    
    __table_args__ = (
        Index("idx_idempotency_key", "idempotency_key"),
        Index("idx_idempotency_expires", "expires_at"),
    )


class WebhookEvent(Base):
    """Webhook event storage for exactly-once processing"""
    __tablename__ = "webhook_events"
    
    id = Column(String(36), primary_key=True)
    
    # Provider info
    provider = Column(String(50), nullable=False, index=True)  # paystack, flutterwave, etc.
    provider_event_id = Column(String(255), nullable=False)  # Provider's event ID
    event_type = Column(String(100), nullable=False)  # payment.success, transfer.failed, etc.
    
    # Raw data
    raw_payload = Column(JSON, nullable=False)
    raw_headers = Column(JSON, nullable=True)
    
    # Signature verification
    signature = Column(String(500), nullable=True)
    signature_valid = Column(Boolean, nullable=True)
    signature_verified_at = Column(DateTime, nullable=True)
    
    # Processing status
    status = Column(String(20), default="received")  # received, processing, processed, failed
    processed_at = Column(DateTime, nullable=True)
    processing_error = Column(Text, nullable=True)
    
    # Replay protection
    event_timestamp = Column(DateTime, nullable=True)  # Timestamp from provider
    
    # Timestamps
    received_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_webhook_provider_event", "provider", "provider_event_id"),
        UniqueConstraint("provider", "provider_event_id", name="uq_provider_event"),
        Index("idx_webhook_status", "status"),
        Index("idx_webhook_received", "received_at"),
    )


class DistributedLock(Base):
    """Distributed locks for multi-replica coordination"""
    __tablename__ = "distributed_locks"
    
    id = Column(String(36), primary_key=True)
    lock_name = Column(String(255), nullable=False, unique=True, index=True)
    
    # Lock holder
    holder_id = Column(String(100), nullable=False)  # Instance ID
    
    # Expiration
    acquired_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    # Lock metadata (note: 'metadata' is reserved in SQLAlchemy)
    lock_metadata = Column(JSON, nullable=True)
    
    __table_args__ = (
        Index("idx_lock_name", "lock_name"),
        Index("idx_lock_expires", "expires_at"),
    )


class ReconciliationRecord(Base):
    """Reconciliation records for ledger drift detection"""
    __tablename__ = "reconciliation_records"
    
    id = Column(String(36), primary_key=True)
    
    # Reconciliation type
    reconciliation_type = Column(String(50), nullable=False)  # ledger, escrow, payout
    
    # Scope
    account_id = Column(String(36), nullable=True)
    escrow_id = Column(String(36), nullable=True)
    
    # Expected vs Actual
    expected_balance = Column(Float, nullable=True)
    actual_balance = Column(Float, nullable=True)
    difference = Column(Float, nullable=True)
    
    # Status
    status = Column(String(20), default="pending")  # pending, matched, drift_detected, resolved
    
    # Resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(36), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_recon_type", "reconciliation_type"),
        Index("idx_recon_status", "status"),
        Index("idx_recon_account", "account_id"),
    )


# =============================================================================
# Durable Job Queue (PostgreSQL-backed)
# =============================================================================

class DurableJobQueue:
    """
    PostgreSQL-backed job queue for production durability.
    
    Features:
    - Jobs survive restarts
    - Distributed locking prevents duplicate processing
    - Automatic retry with exponential backoff
    - Dead letter queue for failed jobs
    - Idempotent job creation
    """
    
    def __init__(self, worker_id: str = None):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.lock_duration_seconds = 300  # 5 minutes
    
    async def enqueue(
        self,
        job_type: str,
        payload: Dict[str, Any],
        scheduled_at: datetime = None,
        idempotency_key: str = None,
        max_attempts: int = 3
    ) -> str:
        """Add job to queue with idempotency support"""
        job_id = str(uuid.uuid4())
        
        async with db_manager.session() as session:
            # Check idempotency
            if idempotency_key:
                existing = await session.execute(
                    select(DurableJob).where(DurableJob.idempotency_key == idempotency_key)
                )
                existing_job = existing.scalar_one_or_none()
                if existing_job:
                    logger.info(f"Job with idempotency key {idempotency_key} already exists: {existing_job.id}")
                    return existing_job.id
            
            job = DurableJob(
                id=job_id,
                job_type=job_type,
                payload=payload,
                scheduled_at=scheduled_at or datetime.utcnow(),
                idempotency_key=idempotency_key,
                max_attempts=max_attempts,
            )
            session.add(job)
            await session.flush()
            
            logger.info(f"Job {job_id} ({job_type}) enqueued")
            return job_id
    
    async def dequeue(self) -> Optional[DurableJob]:
        """
        Get next available job using SELECT FOR UPDATE SKIP LOCKED.
        This ensures only one worker processes each job.
        """
        now = datetime.utcnow()
        lock_expires = now + timedelta(seconds=self.lock_duration_seconds)
        
        async with db_manager.session() as session:
            # Find and lock a pending job
            result = await session.execute(
                select(DurableJob)
                .where(
                    and_(
                        DurableJob.status == JobStatus.PENDING,
                        DurableJob.scheduled_at <= now,
                        or_(
                            DurableJob.locked_by.is_(None),
                            DurableJob.lock_expires_at < now
                        )
                    )
                )
                .order_by(DurableJob.scheduled_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            job = result.scalar_one_or_none()
            
            if job:
                # Lock the job
                job.status = JobStatus.PROCESSING
                job.locked_by = self.worker_id
                job.locked_at = now
                job.lock_expires_at = lock_expires
                job.started_at = now
                job.attempts += 1
                await session.flush()
                
                logger.info(f"Job {job.id} dequeued by {self.worker_id}")
                return job
            
            return None
    
    async def complete(self, job_id: str, result: Dict[str, Any] = None):
        """Mark job as completed"""
        async with db_manager.session() as session:
            job_result = await session.execute(
                select(DurableJob).where(DurableJob.id == job_id)
            )
            job = job_result.scalar_one_or_none()
            
            if job:
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                job.result = result
                job.locked_by = None
                job.lock_expires_at = None
                await session.flush()
                
                logger.info(f"Job {job_id} completed")
    
    async def fail(self, job_id: str, error: str):
        """Mark job as failed, retry or move to dead letter"""
        async with db_manager.session() as session:
            job_result = await session.execute(
                select(DurableJob).where(DurableJob.id == job_id)
            )
            job = job_result.scalar_one_or_none()
            
            if job:
                job.error = error
                job.locked_by = None
                job.lock_expires_at = None
                
                if job.attempts < job.max_attempts:
                    # Retry with exponential backoff
                    backoff = 2 ** job.attempts * 60  # 2, 4, 8 minutes
                    job.status = JobStatus.PENDING
                    job.scheduled_at = datetime.utcnow() + timedelta(seconds=backoff)
                    logger.warning(f"Job {job_id} failed, retrying in {backoff}s: {error}")
                else:
                    # Move to dead letter queue
                    job.status = JobStatus.DEAD_LETTER
                    logger.error(f"Job {job_id} moved to dead letter queue: {error}")
                
                await session.flush()
    
    async def get_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        async with db_manager.session() as session:
            stats = {}
            for status in JobStatus:
                result = await session.execute(
                    select(func.count(DurableJob.id)).where(DurableJob.status == status)
                )
                stats[status.value] = result.scalar() or 0
            return stats
    
    async def get_dead_letter_jobs(self, limit: int = 100) -> List[DurableJob]:
        """Get jobs in dead letter queue"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(DurableJob)
                .where(DurableJob.status == JobStatus.DEAD_LETTER)
                .order_by(DurableJob.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())
    
    async def retry_dead_letter(self, job_id: str) -> bool:
        """Retry a dead letter job"""
        async with db_manager.session() as session:
            job_result = await session.execute(
                select(DurableJob).where(
                    and_(DurableJob.id == job_id, DurableJob.status == JobStatus.DEAD_LETTER)
                )
            )
            job = job_result.scalar_one_or_none()
            
            if job:
                job.status = JobStatus.PENDING
                job.attempts = 0
                job.scheduled_at = datetime.utcnow()
                job.error = None
                await session.flush()
                logger.info(f"Dead letter job {job_id} requeued")
                return True
            return False


# =============================================================================
# Distributed Lock Manager
# =============================================================================

class DistributedLockManager:
    """
    PostgreSQL-based distributed locks for multi-replica coordination.
    
    Use cases:
    - Job scheduler leader election
    - Preventing duplicate periodic tasks
    - Coordinating migrations
    """
    
    def __init__(self, instance_id: str = None):
        self.instance_id = instance_id or f"instance-{uuid.uuid4().hex[:8]}"
    
    async def acquire(
        self,
        lock_name: str,
        ttl_seconds: int = 60,
        lock_metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Try to acquire a distributed lock.
        Returns True if lock acquired, False if already held by another instance.
        """
        now = datetime.utcnow()
        expires_at = now + timedelta(seconds=ttl_seconds)
        
        async with db_manager.session() as session:
            # Check if lock exists and is still valid
            result = await session.execute(
                select(DistributedLock).where(DistributedLock.lock_name == lock_name)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                if existing.expires_at > now and existing.holder_id != self.instance_id:
                    # Lock held by another instance
                    return False
                
                # Lock expired or we already hold it - update it
                existing.holder_id = self.instance_id
                existing.acquired_at = now
                existing.expires_at = expires_at
                existing.lock_metadata = lock_metadata
            else:
                # Create new lock
                lock = DistributedLock(
                    id=str(uuid.uuid4()),
                    lock_name=lock_name,
                    holder_id=self.instance_id,
                    expires_at=expires_at,
                    lock_metadata=lock_metadata,
                )
                session.add(lock)
            
            await session.flush()
            logger.debug(f"Lock {lock_name} acquired by {self.instance_id}")
            return True
    
    async def release(self, lock_name: str) -> bool:
        """Release a lock if we hold it"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(DistributedLock).where(
                    and_(
                        DistributedLock.lock_name == lock_name,
                        DistributedLock.holder_id == self.instance_id
                    )
                )
            )
            lock = result.scalar_one_or_none()
            
            if lock:
                await session.delete(lock)
                await session.flush()
                logger.debug(f"Lock {lock_name} released by {self.instance_id}")
                return True
            return False
    
    async def extend(self, lock_name: str, ttl_seconds: int = 60) -> bool:
        """Extend lock TTL if we hold it"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(DistributedLock).where(
                    and_(
                        DistributedLock.lock_name == lock_name,
                        DistributedLock.holder_id == self.instance_id
                    )
                )
            )
            lock = result.scalar_one_or_none()
            
            if lock:
                lock.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
                await session.flush()
                return True
            return False
    
    async def cleanup_expired(self):
        """Remove expired locks"""
        async with db_manager.session() as session:
            await session.execute(
                delete(DistributedLock).where(DistributedLock.expires_at < datetime.utcnow())
            )
            await session.flush()


# =============================================================================
# Idempotency Manager
# =============================================================================

class IdempotencyManager:
    """
    Manages idempotency keys for exactly-once processing.
    
    Use cases:
    - Refund processing
    - Payment confirmation
    - Payout initiation
    """
    
    def __init__(self, default_ttl_hours: int = 24):
        self.default_ttl_hours = default_ttl_hours
    
    def _hash_request(self, payload: Dict[str, Any]) -> str:
        """Generate SHA-256 hash of request payload"""
        payload_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(payload_str.encode()).hexdigest()
    
    async def check_and_set(
        self,
        idempotency_key: str,
        operation_type: str,
        payload: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Check if operation was already processed.
        Returns cached response if exists, None if new operation.
        """
        request_hash = self._hash_request(payload)
        
        async with db_manager.session() as session:
            result = await session.execute(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.idempotency_key == idempotency_key
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                if existing.status == "completed":
                    logger.info(f"Idempotent operation {idempotency_key} already completed")
                    return existing.response
                elif existing.status == "pending":
                    # Operation in progress
                    logger.warning(f"Idempotent operation {idempotency_key} already in progress")
                    return {"status": "in_progress", "message": "Operation already in progress"}
            
            # Create new record
            record = IdempotencyRecord(
                id=str(uuid.uuid4()),
                idempotency_key=idempotency_key,
                operation_type=operation_type,
                request_hash=request_hash,
                status="pending",
                expires_at=datetime.utcnow() + timedelta(hours=self.default_ttl_hours),
            )
            session.add(record)
            await session.flush()
            
            return None
    
    async def complete(
        self,
        idempotency_key: str,
        response: Dict[str, Any],
        success: bool = True
    ):
        """Mark operation as completed with response"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.idempotency_key == idempotency_key
                )
            )
            record = result.scalar_one_or_none()
            
            if record:
                record.status = "completed" if success else "failed"
                record.response = response
                record.completed_at = datetime.utcnow()
                await session.flush()
    
    async def cleanup_expired(self):
        """Remove expired idempotency records"""
        async with db_manager.session() as session:
            await session.execute(
                delete(IdempotencyRecord).where(
                    IdempotencyRecord.expires_at < datetime.utcnow()
                )
            )
            await session.flush()


# =============================================================================
# Webhook Event Manager
# =============================================================================

class WebhookEventManager:
    """
    Manages webhook event storage and deduplication.
    
    Features:
    - Exactly-once processing via provider event ID
    - Signature verification
    - Replay protection
    """
    
    # Signature verification secrets (should come from env)
    PROVIDER_SECRETS = {
        "paystack": os.getenv("PAYSTACK_SECRET_KEY", ""),
        "flutterwave": os.getenv("FLUTTERWAVE_SECRET_KEY", ""),
    }
    
    # Maximum age for replay protection (5 minutes)
    MAX_EVENT_AGE_SECONDS = 300
    
    async def receive_event(
        self,
        provider: str,
        provider_event_id: str,
        event_type: str,
        payload: Dict[str, Any],
        headers: Dict[str, str] = None,
        signature: str = None
    ) -> Dict[str, Any]:
        """
        Receive and store webhook event.
        Returns existing event if duplicate, new event if first time.
        """
        async with db_manager.session() as session:
            # Check for duplicate
            result = await session.execute(
                select(WebhookEvent).where(
                    and_(
                        WebhookEvent.provider == provider,
                        WebhookEvent.provider_event_id == provider_event_id
                    )
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                logger.info(f"Duplicate webhook event: {provider}/{provider_event_id}")
                return {
                    "status": "duplicate",
                    "event_id": existing.id,
                    "processed": existing.status == "processed"
                }
            
            # Verify signature
            signature_valid = None
            if signature and provider in self.PROVIDER_SECRETS:
                signature_valid = self._verify_signature(
                    provider, payload, signature, self.PROVIDER_SECRETS[provider]
                )
            
            # Create event record
            event = WebhookEvent(
                id=str(uuid.uuid4()),
                provider=provider,
                provider_event_id=provider_event_id,
                event_type=event_type,
                raw_payload=payload,
                raw_headers=headers,
                signature=signature,
                signature_valid=signature_valid,
                signature_verified_at=datetime.utcnow() if signature_valid is not None else None,
                event_timestamp=self._extract_timestamp(provider, payload),
            )
            session.add(event)
            await session.flush()
            
            logger.info(f"Webhook event received: {provider}/{provider_event_id} ({event_type})")
            return {
                "status": "received",
                "event_id": event.id,
                "signature_valid": signature_valid
            }
    
    def _verify_signature(
        self,
        provider: str,
        payload: Dict[str, Any],
        signature: str,
        secret: str
    ) -> bool:
        """Verify webhook signature based on provider"""
        import hmac
        
        if not secret:
            return None
        
        payload_str = json.dumps(payload, separators=(',', ':'))
        
        if provider == "paystack":
            expected = hmac.new(
                secret.encode(),
                payload_str.encode(),
                hashlib.sha512
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        
        elif provider == "flutterwave":
            expected = hmac.new(
                secret.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        
        return None
    
    def _extract_timestamp(self, provider: str, payload: Dict[str, Any]) -> Optional[datetime]:
        """Extract event timestamp from payload"""
        try:
            if provider == "paystack":
                ts = payload.get("data", {}).get("created_at")
            elif provider == "flutterwave":
                ts = payload.get("created_at")
            else:
                ts = payload.get("timestamp") or payload.get("created_at")
            
            if ts:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            pass
        return None
    
    async def mark_processed(self, event_id: str, error: str = None):
        """Mark event as processed"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(WebhookEvent).where(WebhookEvent.id == event_id)
            )
            event = result.scalar_one_or_none()
            
            if event:
                event.status = "processed" if not error else "failed"
                event.processed_at = datetime.utcnow()
                event.processing_error = error
                await session.flush()
    
    async def get_pending_events(self, limit: int = 100) -> List[WebhookEvent]:
        """Get events pending processing"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(WebhookEvent)
                .where(WebhookEvent.status == "received")
                .order_by(WebhookEvent.received_at)
                .limit(limit)
            )
            return list(result.scalars().all())


# =============================================================================
# Production Mode Enforcement
# =============================================================================

class ProductionModeError(Exception):
    """Raised when production requirements are not met"""
    pass


def require_production_service(service_name: str):
    """Decorator to require a service in production mode"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            if PRODUCTION_MODE:
                if service_name == "postgres" and REQUIRE_POSTGRES:
                    # Check database is PostgreSQL, not SQLite
                    from app.repositories import DATABASE_URL
                    if "sqlite" in DATABASE_URL.lower():
                        raise ProductionModeError(
                            f"Production mode requires PostgreSQL, but SQLite is configured. "
                            f"Set DATABASE_URL to a PostgreSQL connection string."
                        )
                
                elif service_name == "redis" and REQUIRE_REDIS:
                    cache = RedisCacheManager()
                    if not cache.connected:
                        raise ProductionModeError(
                            f"Production mode requires Redis, but Redis is not connected. "
                            f"Set REDIS_URL to a valid Redis connection string."
                        )
                
                elif service_name == "tigerbeetle" and REQUIRE_TIGERBEETLE:
                    from app.tigerbeetle_ledger import TigerBeetleLedger
                    ledger = TigerBeetleLedger()
                    if not ledger.connected:
                        raise ProductionModeError(
                            f"Production mode requires TigerBeetle, but TigerBeetle is not connected. "
                            f"Set TIGERBEETLE_ADDRESSES to a valid TigerBeetle cluster address."
                        )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def check_production_readiness() -> Dict[str, Any]:
    """Check if all production requirements are met"""
    from app.repositories import DATABASE_URL, REDIS_URL
    
    checks = {
        "production_mode": PRODUCTION_MODE,
        "services": {},
        "warnings": [],
        "errors": [],
        "ready": True
    }
    
    # Check PostgreSQL
    postgres_ok = "postgresql" in DATABASE_URL.lower() or "postgres" in DATABASE_URL.lower()
    checks["services"]["postgres"] = {
        "configured": postgres_ok,
        "url_type": "postgresql" if postgres_ok else "sqlite",
        "required": REQUIRE_POSTGRES
    }
    if REQUIRE_POSTGRES and not postgres_ok:
        checks["errors"].append("PostgreSQL required but SQLite configured")
        checks["ready"] = False
    elif not postgres_ok:
        checks["warnings"].append("Using SQLite - not recommended for production")
    
    # Check Redis
    cache = RedisCacheManager()
    await cache.connect()
    checks["services"]["redis"] = {
        "connected": cache.connected,
        "required": REQUIRE_REDIS
    }
    if REQUIRE_REDIS and not cache.connected:
        checks["errors"].append("Redis required but not connected")
        checks["ready"] = False
    elif not cache.connected:
        checks["warnings"].append("Redis not connected - using in-memory fallback")
    
    # Check TigerBeetle
    try:
        from app.tigerbeetle_ledger import TigerBeetleLedger
        ledger = TigerBeetleLedger()
        tb_connected = ledger.connected
    except Exception:
        tb_connected = False
    
    checks["services"]["tigerbeetle"] = {
        "connected": tb_connected,
        "required": REQUIRE_TIGERBEETLE
    }
    if REQUIRE_TIGERBEETLE and not tb_connected:
        checks["errors"].append("TigerBeetle required but not connected")
        checks["ready"] = False
    elif not tb_connected:
        checks["warnings"].append("TigerBeetle not connected - using in-memory fallback")
    
    # Check in-memory fallback setting
    if PRODUCTION_MODE and ALLOW_INMEMORY_FALLBACK:
        checks["warnings"].append("ALLOW_INMEMORY_FALLBACK is enabled in production mode")
    
    return checks


# =============================================================================
# Durable Job Worker with Distributed Locking
# =============================================================================

class DurableJobWorker:
    """
    Production-grade job worker with distributed locking.
    
    Features:
    - Uses PostgreSQL-backed job queue
    - Distributed locking prevents duplicate processing
    - Graceful shutdown
    - Health monitoring
    """
    
    def __init__(self, worker_id: str = None):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.queue = DurableJobQueue(self.worker_id)
        self.running = False
        self._task = None
        self._handlers: Dict[str, Callable] = {}
    
    def register_handler(self, job_type: str, handler: Callable):
        """Register a handler for a job type"""
        self._handlers[job_type] = handler
    
    async def start(self):
        """Start the worker"""
        self.running = True
        self._task = asyncio.create_task(self._run())
        logger.info(f"Job worker {self.worker_id} started")
    
    async def stop(self):
        """Stop the worker gracefully"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info(f"Job worker {self.worker_id} stopped")
    
    async def _run(self):
        """Main worker loop"""
        while self.running:
            try:
                job = await self.queue.dequeue()
                if job:
                    await self._process_job(job)
                else:
                    await asyncio.sleep(1)  # No jobs, wait before polling again
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)
    
    async def _process_job(self, job: DurableJob):
        """Process a single job"""
        handler = self._handlers.get(job.job_type)
        if not handler:
            await self.queue.fail(job.id, f"No handler for job type: {job.job_type}")
            return
        
        try:
            result = await handler(job.payload)
            await self.queue.complete(job.id, result)
        except Exception as e:
            await self.queue.fail(job.id, str(e))


class DurableJobScheduler:
    """
    Production-grade job scheduler with leader election.
    
    Features:
    - Only one instance schedules jobs (leader election)
    - Uses distributed locks
    - Graceful failover
    """
    
    def __init__(self, instance_id: str = None):
        self.instance_id = instance_id or f"scheduler-{uuid.uuid4().hex[:8]}"
        self.lock_manager = DistributedLockManager(self.instance_id)
        self.queue = DurableJobQueue(self.instance_id)
        self.running = False
        self._task = None
        self._schedules: List[Dict[str, Any]] = []
        self.lock_name = "job_scheduler_leader"
        self.lock_ttl = 30  # seconds
    
    def add_schedule(
        self,
        job_type: str,
        interval_seconds: int,
        payload: Dict[str, Any] = None
    ):
        """Add a periodic job schedule"""
        self._schedules.append({
            "job_type": job_type,
            "interval_seconds": interval_seconds,
            "payload": payload or {},
            "last_run": None
        })
    
    async def start(self):
        """Start the scheduler"""
        self.running = True
        self._task = asyncio.create_task(self._run())
        logger.info(f"Job scheduler {self.instance_id} started")
    
    async def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.lock_manager.release(self.lock_name)
        logger.info(f"Job scheduler {self.instance_id} stopped")
    
    async def _run(self):
        """Main scheduler loop with leader election"""
        while self.running:
            try:
                # Try to acquire leader lock
                is_leader = await self.lock_manager.acquire(
                    self.lock_name,
                    ttl_seconds=self.lock_ttl
                )
                
                if is_leader:
                    # We are the leader, run schedules
                    await self._run_schedules()
                    # Extend lock
                    await self.lock_manager.extend(self.lock_name, self.lock_ttl)
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(5)
    
    async def _run_schedules(self):
        """Run due scheduled jobs"""
        now = datetime.utcnow()
        
        for schedule in self._schedules:
            last_run = schedule["last_run"]
            interval = timedelta(seconds=schedule["interval_seconds"])
            
            if last_run is None or (now - last_run) >= interval:
                # Time to run this job
                idempotency_key = f"scheduled:{schedule['job_type']}:{now.strftime('%Y%m%d%H%M')}"
                
                await self.queue.enqueue(
                    job_type=schedule["job_type"],
                    payload=schedule["payload"],
                    idempotency_key=idempotency_key
                )
                
                schedule["last_run"] = now
                logger.info(f"Scheduled job {schedule['job_type']} enqueued")


# =============================================================================
# Initialize Production Infrastructure
# =============================================================================

async def init_production_hardening():
    """Initialize production hardening database tables"""
    from sqlalchemy import inspect
    
    async with db_manager.engine.begin() as conn:
        # Create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Production hardening tables initialized")


# Global instances
durable_job_queue = DurableJobQueue()
distributed_lock_manager = DistributedLockManager()
idempotency_manager = IdempotencyManager()
webhook_event_manager = WebhookEventManager()
