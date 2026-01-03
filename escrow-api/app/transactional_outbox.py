"""
Transactional Outbox Pattern for SocialEscrow Platform

This module implements the transactional outbox pattern to ensure
atomicity between database operations and event publishing.

The pattern works as follows:
1. Business logic writes to the main table AND the outbox table in a single transaction
2. A background worker polls the outbox table and publishes events to Kafka
3. After successful publish, the outbox entry is marked as processed

This ensures that events are never lost even if Kafka is temporarily unavailable.
"""

import asyncio
import json
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class OutboxEventStatus(str, Enum):
    """Status of outbox events"""
    PENDING = "pending"
    PROCESSING = "processing"
    PUBLISHED = "published"
    FAILED = "failed"


@dataclass
class OutboxEvent:
    """Represents an event in the outbox table"""
    id: str
    aggregate_type: str  # e.g., "escrow", "dispute", "transaction"
    aggregate_id: str    # e.g., escrow_id
    event_type: str      # e.g., "escrow.created", "escrow.released"
    payload: Dict[str, Any]
    status: OutboxEventStatus
    created_at: str
    processed_at: Optional[str] = None
    retry_count: int = 0
    last_error: Optional[str] = None


class TransactionalOutbox:
    """
    Implements the transactional outbox pattern.
    
    Usage:
    1. In your business logic, call `add_event()` within the same DB transaction
    2. The background worker will pick up events and publish to Kafka
    3. Events are guaranteed to be published at least once
    """
    
    def __init__(self):
        self.poll_interval = int(os.getenv("OUTBOX_POLL_INTERVAL", "5"))  # seconds
        self.batch_size = int(os.getenv("OUTBOX_BATCH_SIZE", "100"))
        self.max_retries = int(os.getenv("OUTBOX_MAX_RETRIES", "5"))
        
        self._running = False
        self._db_pool = None
        
        # In-memory store for development (use PostgreSQL in production)
        self._outbox_store: Dict[str, OutboxEvent] = {}
    
    async def init_db(self):
        """Initialize database connection and create outbox table"""
        try:
            import asyncpg
            
            database_url = os.getenv("DATABASE_URL")
            if database_url:
                self._db_pool = await asyncpg.create_pool(database_url)
                await self._create_outbox_table()
                logger.info("Outbox database initialized")
            else:
                logger.warning("DATABASE_URL not set - using in-memory outbox")
                
        except ImportError:
            logger.warning("asyncpg not available - using in-memory outbox")
        except Exception as e:
            logger.error(f"Failed to initialize outbox database: {e}")
    
    async def _create_outbox_table(self):
        """Create the outbox table if it doesn't exist"""
        if not self._db_pool:
            return
        
        async with self._db_pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox_events (
                    id VARCHAR(36) PRIMARY KEY,
                    aggregate_type VARCHAR(50) NOT NULL,
                    aggregate_id VARCHAR(100) NOT NULL,
                    event_type VARCHAR(100) NOT NULL,
                    payload JSONB NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    processed_at TIMESTAMP WITH TIME ZONE,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
                CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox_events(created_at);
                CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
            """)
    
    async def add_event(
        self,
        aggregate_type: str,
        aggregate_id: str,
        event_type: str,
        payload: Dict[str, Any],
        conn=None,  # Pass DB connection for transactional guarantee
    ) -> str:
        """
        Add an event to the outbox.
        
        IMPORTANT: Call this within the same database transaction as your
        business logic to ensure atomicity.
        
        Args:
            aggregate_type: Type of aggregate (e.g., "escrow")
            aggregate_id: ID of the aggregate (e.g., escrow_id)
            event_type: Type of event (e.g., "escrow.created")
            payload: Event payload
            conn: Database connection (for transactional guarantee)
        
        Returns:
            Event ID
        """
        event_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        event = OutboxEvent(
            id=event_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            event_type=event_type,
            payload=payload,
            status=OutboxEventStatus.PENDING,
            created_at=now,
        )
        
        if self._db_pool and conn:
            # Use provided connection for transactional guarantee
            await conn.execute("""
                INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, event_id, aggregate_type, aggregate_id, event_type, json.dumps(payload), 
                OutboxEventStatus.PENDING.value, now)
        elif self._db_pool:
            # Use pool connection (not transactional with business logic)
            async with self._db_pool.acquire() as pool_conn:
                await pool_conn.execute("""
                    INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, event_id, aggregate_type, aggregate_id, event_type, json.dumps(payload),
                    OutboxEventStatus.PENDING.value, now)
        else:
            # In-memory fallback
            self._outbox_store[event_id] = event
        
        logger.debug(f"Added outbox event: {event_id} ({event_type})")
        return event_id
    
    async def start_worker(self):
        """Start the background worker that publishes events"""
        self._running = True
        logger.info(f"Starting outbox worker (poll interval: {self.poll_interval}s)")
        
        while self._running:
            try:
                await self._process_pending_events()
            except Exception as e:
                logger.error(f"Outbox worker error: {e}")
            
            await asyncio.sleep(self.poll_interval)
    
    async def stop_worker(self):
        """Stop the background worker"""
        self._running = False
        logger.info("Outbox worker stopped")
    
    async def _process_pending_events(self):
        """Process pending events from the outbox"""
        events = await self._fetch_pending_events()
        
        if not events:
            return
        
        logger.debug(f"Processing {len(events)} pending outbox events")
        
        for event in events:
            await self._publish_event(event)
    
    async def _fetch_pending_events(self) -> List[OutboxEvent]:
        """Fetch pending events from the outbox"""
        if self._db_pool:
            async with self._db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, aggregate_type, aggregate_id, event_type, payload, 
                           status, created_at, processed_at, retry_count, last_error
                    FROM outbox_events
                    WHERE status = 'pending'
                    ORDER BY created_at ASC
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED
                """, self.batch_size)
                
                return [
                    OutboxEvent(
                        id=row["id"],
                        aggregate_type=row["aggregate_type"],
                        aggregate_id=row["aggregate_id"],
                        event_type=row["event_type"],
                        payload=json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"],
                        status=OutboxEventStatus(row["status"]),
                        created_at=str(row["created_at"]),
                        processed_at=str(row["processed_at"]) if row["processed_at"] else None,
                        retry_count=row["retry_count"],
                        last_error=row["last_error"],
                    )
                    for row in rows
                ]
        else:
            # In-memory fallback
            return [
                e for e in list(self._outbox_store.values())
                if e.status == OutboxEventStatus.PENDING
            ][:self.batch_size]
    
    async def _publish_event(self, event: OutboxEvent):
        """Publish a single event to Kafka"""
        try:
            # Mark as processing
            await self._update_event_status(event.id, OutboxEventStatus.PROCESSING)
            
            # Publish to Kafka
            from app.middleware_integrations import production_kafka
            
            await production_kafka.publish(event.event_type, {
                "event_id": event.id,
                "aggregate_type": event.aggregate_type,
                "aggregate_id": event.aggregate_id,
                "payload": event.payload,
                "created_at": event.created_at,
            })
            
            # Mark as published
            await self._update_event_status(
                event.id, 
                OutboxEventStatus.PUBLISHED,
                processed_at=datetime.utcnow().isoformat(),
            )
            
            logger.debug(f"Published outbox event: {event.id}")
            
        except Exception as e:
            logger.error(f"Failed to publish outbox event {event.id}: {e}")
            
            # Update retry count and status
            event.retry_count += 1
            
            if event.retry_count >= self.max_retries:
                await self._update_event_status(
                    event.id,
                    OutboxEventStatus.FAILED,
                    last_error=str(e),
                    retry_count=event.retry_count,
                )
            else:
                await self._update_event_status(
                    event.id,
                    OutboxEventStatus.PENDING,
                    last_error=str(e),
                    retry_count=event.retry_count,
                )
    
    async def _update_event_status(
        self,
        event_id: str,
        status: OutboxEventStatus,
        processed_at: Optional[str] = None,
        last_error: Optional[str] = None,
        retry_count: Optional[int] = None,
    ):
        """Update event status in the outbox"""
        if self._db_pool:
            async with self._db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE outbox_events
                    SET status = $2,
                        processed_at = COALESCE($3, processed_at),
                        last_error = COALESCE($4, last_error),
                        retry_count = COALESCE($5, retry_count)
                    WHERE id = $1
                """, event_id, status.value, processed_at, last_error, retry_count)
        else:
            # In-memory fallback
            if event_id in self._outbox_store:
                event = self._outbox_store[event_id]
                event.status = status
                if processed_at:
                    event.processed_at = processed_at
                if last_error:
                    event.last_error = last_error
                if retry_count is not None:
                    event.retry_count = retry_count
    
    # ==========================================================================
    # Convenience Methods for Common Events
    # ==========================================================================
    
    async def add_escrow_created_event(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount: float,
        fee: float,
        conn=None,
    ) -> str:
        """Add escrow.created event to outbox"""
        return await self.add_event(
            aggregate_type="escrow",
            aggregate_id=escrow_id,
            event_type="escrow.created",
            payload={
                "escrow_id": escrow_id,
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount": amount,
                "fee": fee,
                "created_at": datetime.utcnow().isoformat(),
            },
            conn=conn,
        )
    
    async def add_escrow_released_event(
        self,
        escrow_id: str,
        seller_id: str,
        payout_amount: float,
        conn=None,
    ) -> str:
        """Add escrow.released event to outbox"""
        return await self.add_event(
            aggregate_type="escrow",
            aggregate_id=escrow_id,
            event_type="escrow.released",
            payload={
                "escrow_id": escrow_id,
                "seller_id": seller_id,
                "payout_amount": payout_amount,
                "released_at": datetime.utcnow().isoformat(),
            },
            conn=conn,
        )
    
    async def add_escrow_refunded_event(
        self,
        escrow_id: str,
        buyer_id: str,
        refund_amount: float,
        reason: str,
        conn=None,
    ) -> str:
        """Add escrow.refunded event to outbox"""
        return await self.add_event(
            aggregate_type="escrow",
            aggregate_id=escrow_id,
            event_type="escrow.refunded",
            payload={
                "escrow_id": escrow_id,
                "buyer_id": buyer_id,
                "refund_amount": refund_amount,
                "reason": reason,
                "refunded_at": datetime.utcnow().isoformat(),
            },
            conn=conn,
        )
    
    async def add_dispute_opened_event(
        self,
        dispute_id: str,
        escrow_id: str,
        opener_id: str,
        reason: str,
        conn=None,
    ) -> str:
        """Add dispute.opened event to outbox"""
        return await self.add_event(
            aggregate_type="dispute",
            aggregate_id=dispute_id,
            event_type="dispute.opened",
            payload={
                "dispute_id": dispute_id,
                "escrow_id": escrow_id,
                "opener_id": opener_id,
                "reason": reason,
                "opened_at": datetime.utcnow().isoformat(),
            },
            conn=conn,
        )
    
    # ==========================================================================
    # Statistics and Monitoring
    # ==========================================================================
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get outbox statistics"""
        if self._db_pool:
            async with self._db_pool.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) FILTER (WHERE status = 'pending') as pending,
                        COUNT(*) FILTER (WHERE status = 'processing') as processing,
                        COUNT(*) FILTER (WHERE status = 'published') as published,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        COUNT(*) as total
                    FROM outbox_events
                """)
                
                return {
                    "pending": stats["pending"],
                    "processing": stats["processing"],
                    "published": stats["published"],
                    "failed": stats["failed"],
                    "total": stats["total"],
                }
        else:
            # In-memory fallback
            events = list(self._outbox_store.values())
            return {
                "pending": len([e for e in events if e.status == OutboxEventStatus.PENDING]),
                "processing": len([e for e in events if e.status == OutboxEventStatus.PROCESSING]),
                "published": len([e for e in events if e.status == OutboxEventStatus.PUBLISHED]),
                "failed": len([e for e in events if e.status == OutboxEventStatus.FAILED]),
                "total": len(events),
            }
    
    async def get_failed_events(self) -> List[OutboxEvent]:
        """Get failed events for manual review"""
        if self._db_pool:
            async with self._db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, aggregate_type, aggregate_id, event_type, payload,
                           status, created_at, processed_at, retry_count, last_error
                    FROM outbox_events
                    WHERE status = 'failed'
                    ORDER BY created_at DESC
                    LIMIT 100
                """)
                
                return [
                    OutboxEvent(
                        id=row["id"],
                        aggregate_type=row["aggregate_type"],
                        aggregate_id=row["aggregate_id"],
                        event_type=row["event_type"],
                        payload=json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"],
                        status=OutboxEventStatus(row["status"]),
                        created_at=str(row["created_at"]),
                        processed_at=str(row["processed_at"]) if row["processed_at"] else None,
                        retry_count=row["retry_count"],
                        last_error=row["last_error"],
                    )
                    for row in rows
                ]
        else:
            return [e for e in self._outbox_store.values() if e.status == OutboxEventStatus.FAILED]
    
    async def retry_failed_event(self, event_id: str) -> Dict[str, Any]:
        """Retry a failed event"""
        await self._update_event_status(event_id, OutboxEventStatus.PENDING, retry_count=0)
        return {"success": True, "event_id": event_id}
    
    async def cleanup_old_events(self, days: int = 30) -> int:
        """Clean up old published events"""
        if self._db_pool:
            async with self._db_pool.acquire() as conn:
                result = await conn.execute("""
                    DELETE FROM outbox_events
                    WHERE status = 'published'
                    AND processed_at < NOW() - INTERVAL '$1 days'
                """, days)
                
                deleted = int(result.split()[-1])
                logger.info(f"Cleaned up {deleted} old outbox events")
                return deleted
        else:
            # In-memory cleanup
            cutoff = datetime.utcnow() - timedelta(days=days)
            to_delete = [
                e.id for e in self._outbox_store.values()
                if e.status == OutboxEventStatus.PUBLISHED
                and e.processed_at
                and datetime.fromisoformat(e.processed_at) < cutoff
            ]
            for event_id in to_delete:
                del self._outbox_store[event_id]
            return len(to_delete)


# Global instance
transactional_outbox = TransactionalOutbox()


async def init_outbox():
    """Initialize the transactional outbox"""
    await transactional_outbox.init_db()


async def start_outbox_worker():
    """Start the outbox worker"""
    await transactional_outbox.start_worker()


if __name__ == "__main__":
    async def main():
        await init_outbox()
        await start_outbox_worker()
    
    asyncio.run(main())
