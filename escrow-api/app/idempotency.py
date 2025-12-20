"""
End-to-End Idempotency for Money Operations

This module provides idempotency guarantees for all money-moving operations:
- Escrow creation
- Payment capture
- Escrow release
- Refund processing
- Webhook callbacks

Uses PostgreSQL with unique constraints keyed by (operation, idempotency_key, actor).
Ties to TigerBeetle transfer IDs to prevent duplicate ledger movements.
"""

import os
import json
import hashlib
import logging
from typing import Any, Dict, Optional, Callable, TypeVar, Generic
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import wraps
import asyncio
import uuid

logger = logging.getLogger(__name__)

# Configuration
IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
IDEMPOTENCY_TTL_HOURS = int(os.getenv("IDEMPOTENCY_TTL_HOURS", "24"))
REQUIRE_IDEMPOTENCY_IN_PRODUCTION = os.getenv("PRODUCTION_MODE", "false").lower() == "true"


class IdempotencyStatus(str, Enum):
    """Status of an idempotent operation"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OperationType(str, Enum):
    """Types of idempotent operations"""
    ESCROW_CREATE = "escrow_create"
    ESCROW_CAPTURE = "escrow_capture"
    ESCROW_RELEASE = "escrow_release"
    ESCROW_REFUND = "escrow_refund"
    WEBHOOK_CALLBACK = "webhook_callback"
    BANK_TRANSFER = "bank_transfer"
    FEE_COLLECTION = "fee_collection"
    INSURANCE_CLAIM = "insurance_claim"


@dataclass
class IdempotencyRecord:
    """Record of an idempotent operation"""
    id: str
    operation: OperationType
    idempotency_key: str
    actor_id: str
    status: IdempotencyStatus
    request_hash: str
    response_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    tigerbeetle_transfer_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    expires_at: str = field(default_factory=lambda: (datetime.utcnow() + timedelta(hours=IDEMPOTENCY_TTL_HOURS)).isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class IdempotencyStore:
    """
    PostgreSQL-backed idempotency store with unique constraints.
    
    Schema:
    CREATE TABLE idempotency_records (
        id UUID PRIMARY KEY,
        operation VARCHAR(50) NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        actor_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        response_data JSONB,
        error_message TEXT,
        tigerbeetle_transfer_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        UNIQUE(operation, idempotency_key, actor_id)
    );
    CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
    """
    
    def __init__(self):
        self._engine = None
        self._initialized = False
        self._in_memory_store: Dict[str, IdempotencyRecord] = {}
        
    async def initialize(self) -> bool:
        """Initialize database connection and create table if needed"""
        database_url = os.getenv("DATABASE_URL")
        
        if not database_url:
            if REQUIRE_IDEMPOTENCY_IN_PRODUCTION:
                raise RuntimeError("DATABASE_URL required for idempotency in production mode")
            logger.warning("Using fallback idempotency store - set DATABASE_URL for production")
            return True
        
        try:
            from sqlalchemy.ext.asyncio import create_async_engine
            from sqlalchemy import text
            
            async_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
            self._engine = create_async_engine(async_url, pool_size=5, max_overflow=10)
            
            async with self._engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS idempotency_records (
                        id UUID PRIMARY KEY,
                        operation VARCHAR(50) NOT NULL,
                        idempotency_key VARCHAR(255) NOT NULL,
                        actor_id VARCHAR(255) NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        request_hash VARCHAR(64) NOT NULL,
                        response_data JSONB,
                        error_message TEXT,
                        tigerbeetle_transfer_id VARCHAR(255),
                        created_at TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP NOT NULL,
                        expires_at TIMESTAMP NOT NULL,
                        CONSTRAINT uq_idempotency UNIQUE(operation, idempotency_key, actor_id)
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
                    ON idempotency_records(expires_at)
                """))
            
            self._initialized = True
            logger.info("Idempotency store initialized with PostgreSQL")
            return True
            
        except ImportError:
            logger.warning("sqlalchemy/asyncpg not installed, using fallback store")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize idempotency store: {e}")
            if REQUIRE_IDEMPOTENCY_IN_PRODUCTION:
                raise
            return True
    
    def _make_key(self, operation: OperationType, idempotency_key: str, actor_id: str) -> str:
        """Create composite key for in-memory store"""
        return f"{operation.value}:{idempotency_key}:{actor_id}"
    
    async def get(
        self, 
        operation: OperationType, 
        idempotency_key: str, 
        actor_id: str
    ) -> Optional[IdempotencyRecord]:
        """Get existing idempotency record"""
        if self._engine:
            try:
                from sqlalchemy import text
                
                async with self._engine.connect() as conn:
                    result = await conn.execute(
                        text("""
                            SELECT id, operation, idempotency_key, actor_id, status,
                                   request_hash, response_data, error_message,
                                   tigerbeetle_transfer_id, created_at, updated_at, expires_at
                            FROM idempotency_records
                            WHERE operation = :operation 
                              AND idempotency_key = :key 
                              AND actor_id = :actor
                              AND expires_at > NOW()
                        """),
                        {"operation": operation.value, "key": idempotency_key, "actor": actor_id}
                    )
                    row = result.fetchone()
                    if row:
                        return IdempotencyRecord(
                            id=str(row[0]),
                            operation=OperationType(row[1]),
                            idempotency_key=row[2],
                            actor_id=row[3],
                            status=IdempotencyStatus(row[4]),
                            request_hash=row[5],
                            response_data=row[6],
                            error_message=row[7],
                            tigerbeetle_transfer_id=row[8],
                            created_at=row[9].isoformat() if row[9] else None,
                            updated_at=row[10].isoformat() if row[10] else None,
                            expires_at=row[11].isoformat() if row[11] else None,
                        )
            except Exception as e:
                logger.error(f"Failed to get idempotency record: {e}")
        
        # Fallback to in-memory
        key = self._make_key(operation, idempotency_key, actor_id)
        record = self._in_memory_store.get(key)
        if record and datetime.fromisoformat(record.expires_at) > datetime.utcnow():
            return record
        return None
    
    async def create(
        self,
        operation: OperationType,
        idempotency_key: str,
        actor_id: str,
        request_hash: str,
    ) -> IdempotencyRecord:
        """Create new idempotency record (or raise if exists)"""
        record = IdempotencyRecord(
            id=str(uuid.uuid4()),
            operation=operation,
            idempotency_key=idempotency_key,
            actor_id=actor_id,
            status=IdempotencyStatus.PROCESSING,
            request_hash=request_hash,
        )
        
        if self._engine:
            try:
                from sqlalchemy import text
                
                async with self._engine.begin() as conn:
                    await conn.execute(
                        text("""
                            INSERT INTO idempotency_records 
                            (id, operation, idempotency_key, actor_id, status, request_hash,
                             created_at, updated_at, expires_at)
                            VALUES (:id, :operation, :key, :actor, :status, :hash,
                                    :created, :updated, :expires)
                        """),
                        {
                            "id": record.id,
                            "operation": operation.value,
                            "key": idempotency_key,
                            "actor": actor_id,
                            "status": record.status.value,
                            "hash": request_hash,
                            "created": datetime.fromisoformat(record.created_at),
                            "updated": datetime.fromisoformat(record.updated_at),
                            "expires": datetime.fromisoformat(record.expires_at),
                        }
                    )
                return record
            except Exception as e:
                if "uq_idempotency" in str(e).lower() or "unique" in str(e).lower():
                    existing = await self.get(operation, idempotency_key, actor_id)
                    if existing:
                        raise IdempotencyConflictError(existing)
                raise
        
        # Fallback to in-memory
        key = self._make_key(operation, idempotency_key, actor_id)
        if key in self._in_memory_store:
            existing = self._in_memory_store[key]
            if datetime.fromisoformat(existing.expires_at) > datetime.utcnow():
                raise IdempotencyConflictError(existing)
        
        self._in_memory_store[key] = record
        return record
    
    async def complete(
        self,
        record: IdempotencyRecord,
        response_data: Dict[str, Any],
        tigerbeetle_transfer_id: Optional[str] = None,
    ) -> IdempotencyRecord:
        """Mark operation as completed with response"""
        record.status = IdempotencyStatus.COMPLETED
        record.response_data = response_data
        record.tigerbeetle_transfer_id = tigerbeetle_transfer_id
        record.updated_at = datetime.utcnow().isoformat()
        
        if self._engine:
            try:
                from sqlalchemy import text
                
                async with self._engine.begin() as conn:
                    await conn.execute(
                        text("""
                            UPDATE idempotency_records
                            SET status = :status, response_data = :response,
                                tigerbeetle_transfer_id = :tb_id, updated_at = :updated
                            WHERE id = :id
                        """),
                        {
                            "id": record.id,
                            "status": record.status.value,
                            "response": json.dumps(response_data),
                            "tb_id": tigerbeetle_transfer_id,
                            "updated": datetime.fromisoformat(record.updated_at),
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to complete idempotency record: {e}")
        
        # Update in-memory
        key = self._make_key(record.operation, record.idempotency_key, record.actor_id)
        self._in_memory_store[key] = record
        
        return record
    
    async def fail(
        self,
        record: IdempotencyRecord,
        error_message: str,
    ) -> IdempotencyRecord:
        """Mark operation as failed"""
        record.status = IdempotencyStatus.FAILED
        record.error_message = error_message
        record.updated_at = datetime.utcnow().isoformat()
        
        if self._engine:
            try:
                from sqlalchemy import text
                
                async with self._engine.begin() as conn:
                    await conn.execute(
                        text("""
                            UPDATE idempotency_records
                            SET status = :status, error_message = :error, updated_at = :updated
                            WHERE id = :id
                        """),
                        {
                            "id": record.id,
                            "status": record.status.value,
                            "error": error_message,
                            "updated": datetime.fromisoformat(record.updated_at),
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to mark idempotency record as failed: {e}")
        
        # Update in-memory
        key = self._make_key(record.operation, record.idempotency_key, record.actor_id)
        self._in_memory_store[key] = record
        
        return record
    
    async def cleanup_expired(self) -> int:
        """Remove expired records"""
        if self._engine:
            try:
                from sqlalchemy import text
                
                async with self._engine.begin() as conn:
                    result = await conn.execute(
                        text("DELETE FROM idempotency_records WHERE expires_at < NOW()")
                    )
                    return result.rowcount
            except Exception as e:
                logger.error(f"Failed to cleanup expired records: {e}")
        
        # Cleanup in-memory
        now = datetime.utcnow()
        expired_keys = [
            k for k, v in self._in_memory_store.items()
            if datetime.fromisoformat(v.expires_at) < now
        ]
        for key in expired_keys:
            del self._in_memory_store[key]
        return len(expired_keys)


class IdempotencyConflictError(Exception):
    """Raised when an idempotent operation is already in progress or completed"""
    def __init__(self, existing_record: IdempotencyRecord):
        self.existing_record = existing_record
        super().__init__(f"Operation already {existing_record.status.value}")


# Global store instance
idempotency_store = IdempotencyStore()


def compute_request_hash(request_data: Dict[str, Any]) -> str:
    """Compute deterministic hash of request data"""
    normalized = json.dumps(request_data, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode()).hexdigest()


T = TypeVar('T')


def idempotent(
    operation: OperationType,
    get_key: Callable[..., str],
    get_actor: Callable[..., str],
    get_request_data: Callable[..., Dict[str, Any]],
):
    """
    Decorator for idempotent operations.
    
    Usage:
        @idempotent(
            operation=OperationType.ESCROW_CREATE,
            get_key=lambda request, **kw: request.idempotency_key,
            get_actor=lambda request, **kw: request.buyer_id,
            get_request_data=lambda request, **kw: request.dict(),
        )
        async def create_escrow(request: CreateEscrowRequest) -> EscrowResponse:
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Extract idempotency parameters
            idempotency_key = get_key(*args, **kwargs)
            actor_id = get_actor(*args, **kwargs)
            request_data = get_request_data(*args, **kwargs)
            request_hash = compute_request_hash(request_data)
            
            # Check for existing record
            existing = await idempotency_store.get(operation, idempotency_key, actor_id)
            
            if existing:
                # Verify request hash matches
                if existing.request_hash != request_hash:
                    raise ValueError(
                        f"Idempotency key reused with different request data. "
                        f"Key: {idempotency_key}"
                    )
                
                # Return cached response if completed
                if existing.status == IdempotencyStatus.COMPLETED:
                    logger.info(f"Returning cached response for {operation.value}:{idempotency_key}")
                    return existing.response_data
                
                # If still processing, wait and retry
                if existing.status == IdempotencyStatus.PROCESSING:
                    # Wait a bit and check again
                    await asyncio.sleep(1)
                    existing = await idempotency_store.get(operation, idempotency_key, actor_id)
                    if existing and existing.status == IdempotencyStatus.COMPLETED:
                        return existing.response_data
                    raise IdempotencyConflictError(existing)
                
                # If failed, allow retry
                if existing.status == IdempotencyStatus.FAILED:
                    logger.info(f"Retrying failed operation {operation.value}:{idempotency_key}")
            
            # Create new record
            try:
                record = await idempotency_store.create(
                    operation=operation,
                    idempotency_key=idempotency_key,
                    actor_id=actor_id,
                    request_hash=request_hash,
                )
            except IdempotencyConflictError:
                raise
            
            # Execute operation
            try:
                result = await func(*args, **kwargs)
                
                # Extract TigerBeetle transfer ID if present
                tb_transfer_id = None
                if isinstance(result, dict):
                    tb_transfer_id = result.get("tigerbeetle_transfer_id") or result.get("escrow_transfer_id")
                
                # Mark as completed
                await idempotency_store.complete(
                    record=record,
                    response_data=result if isinstance(result, dict) else {"result": result},
                    tigerbeetle_transfer_id=tb_transfer_id,
                )
                
                return result
                
            except Exception as e:
                # Mark as failed
                await idempotency_store.fail(record, str(e))
                raise
        
        return wrapper
    return decorator


# FastAPI middleware for extracting idempotency key from headers
async def get_idempotency_key(request) -> Optional[str]:
    """Extract idempotency key from request headers"""
    return request.headers.get(IDEMPOTENCY_KEY_HEADER)


# Health check endpoint data
async def idempotency_health() -> Dict[str, Any]:
    """Get idempotency store health status"""
    return {
        "initialized": idempotency_store._initialized,
        "using_postgres": idempotency_store._engine is not None,
        "in_memory_records": len(idempotency_store._in_memory_store),
        "ttl_hours": IDEMPOTENCY_TTL_HOURS,
    }
