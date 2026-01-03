"""
Kafka Dead Letter Queue (DLQ) Consumer for SocialEscrow Platform

This module processes failed events from the DLQ, providing:
- Manual review interface
- Automatic retry logic
- Event archival
- Alerting for critical failures
"""

import asyncio
import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class DLQEventStatus(str, Enum):
    """Status of DLQ events"""
    PENDING = "pending"
    RETRYING = "retrying"
    RESOLVED = "resolved"
    ARCHIVED = "archived"
    FAILED_PERMANENTLY = "failed_permanently"


@dataclass
class DLQEvent:
    """Represents an event in the Dead Letter Queue"""
    id: str
    original_topic: str
    event_data: Dict[str, Any]
    error_message: str
    error_type: str
    retry_count: int
    max_retries: int
    first_failure_at: str
    last_failure_at: str
    status: DLQEventStatus = DLQEventStatus.PENDING
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None


class DLQConsumer:
    """
    Consumes and processes events from the Kafka Dead Letter Queue.
    
    Features:
    - Automatic retry with exponential backoff
    - Manual review interface
    - Event archival after max retries
    - Alerting for critical events
    """
    
    def __init__(self):
        self.kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.dlq_topic = os.getenv("KAFKA_DLQ_TOPIC", "escrow.dlq")
        self.consumer_group = os.getenv("KAFKA_DLQ_CONSUMER_GROUP", "escrow-dlq-processor")
        self.max_retries = int(os.getenv("DLQ_MAX_RETRIES", "5"))
        self.retry_delay_base = int(os.getenv("DLQ_RETRY_DELAY_BASE", "60"))  # seconds
        
        self._consumer = None
        self._running = False
        self._event_handlers: Dict[str, Callable] = {}
        
        # In-memory store for DLQ events (should be PostgreSQL in production)
        self._dlq_store: Dict[str, DLQEvent] = {}
    
    async def connect(self) -> bool:
        """Connect to Kafka and subscribe to DLQ topic"""
        try:
            from aiokafka import AIOKafkaConsumer
            
            self._consumer = AIOKafkaConsumer(
                self.dlq_topic,
                bootstrap_servers=self.kafka_bootstrap,
                group_id=self.consumer_group,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            
            await self._consumer.start()
            logger.info(f"DLQ consumer connected to {self.dlq_topic}")
            return True
            
        except ImportError:
            logger.warning("aiokafka not available - DLQ consumer disabled")
            return False
        except Exception as e:
            logger.error(f"Failed to connect DLQ consumer: {e}")
            return False
    
    def register_handler(self, topic: str, handler: Callable):
        """Register a handler for retrying events from a specific topic"""
        self._event_handlers[topic] = handler
        logger.info(f"Registered DLQ handler for topic: {topic}")
    
    async def start_consuming(self):
        """Start consuming DLQ events"""
        if not self._consumer:
            if not await self.connect():
                return
        
        self._running = True
        logger.info("Starting DLQ consumer loop")
        
        try:
            async for message in self._consumer:
                if not self._running:
                    break
                
                await self._process_dlq_message(message)
                
        except Exception as e:
            logger.error(f"DLQ consumer error: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop the DLQ consumer"""
        self._running = False
        if self._consumer:
            await self._consumer.stop()
            logger.info("DLQ consumer stopped")
    
    async def _process_dlq_message(self, message):
        """Process a single DLQ message"""
        try:
            event_data = message.value
            event_id = event_data.get("event_id", str(message.offset))
            original_topic = event_data.get("original_topic", "unknown")
            
            # Create or update DLQ event record
            if event_id in self._dlq_store:
                dlq_event = self._dlq_store[event_id]
                dlq_event.retry_count += 1
                dlq_event.last_failure_at = datetime.utcnow().isoformat()
            else:
                dlq_event = DLQEvent(
                    id=event_id,
                    original_topic=original_topic,
                    event_data=event_data.get("payload", event_data),
                    error_message=event_data.get("error_message", "Unknown error"),
                    error_type=event_data.get("error_type", "unknown"),
                    retry_count=event_data.get("retry_count", 0),
                    max_retries=self.max_retries,
                    first_failure_at=event_data.get("failed_at", datetime.utcnow().isoformat()),
                    last_failure_at=datetime.utcnow().isoformat(),
                )
                self._dlq_store[event_id] = dlq_event
            
            # Check if we should retry
            if dlq_event.retry_count < dlq_event.max_retries:
                await self._attempt_retry(dlq_event)
            else:
                await self._mark_permanently_failed(dlq_event)
                
        except Exception as e:
            logger.error(f"Error processing DLQ message: {e}")
    
    async def _attempt_retry(self, dlq_event: DLQEvent):
        """Attempt to retry processing the event"""
        dlq_event.status = DLQEventStatus.RETRYING
        
        # Calculate exponential backoff delay
        delay = self.retry_delay_base * (2 ** dlq_event.retry_count)
        logger.info(f"Retrying DLQ event {dlq_event.id} after {delay}s (attempt {dlq_event.retry_count + 1})")
        
        await asyncio.sleep(min(delay, 3600))  # Max 1 hour delay
        
        # Get handler for original topic
        handler = self._event_handlers.get(dlq_event.original_topic)
        
        if handler:
            try:
                await handler(dlq_event.event_data)
                dlq_event.status = DLQEventStatus.RESOLVED
                dlq_event.resolved_at = datetime.utcnow().isoformat()
                dlq_event.resolution_notes = "Auto-resolved via retry"
                logger.info(f"DLQ event {dlq_event.id} resolved successfully")
            except Exception as e:
                logger.warning(f"Retry failed for DLQ event {dlq_event.id}: {e}")
                dlq_event.error_message = str(e)
        else:
            logger.warning(f"No handler registered for topic: {dlq_event.original_topic}")
    
    async def _mark_permanently_failed(self, dlq_event: DLQEvent):
        """Mark event as permanently failed after max retries"""
        dlq_event.status = DLQEventStatus.FAILED_PERMANENTLY
        logger.error(f"DLQ event {dlq_event.id} permanently failed after {dlq_event.retry_count} retries")
        
        # Send alert for critical events
        await self._send_alert(dlq_event)
    
    async def _send_alert(self, dlq_event: DLQEvent):
        """Send alert for permanently failed events"""
        try:
            from app.middleware_integrations import production_kafka
            
            await production_kafka.publish("alerts.dlq_failure", {
                "event_id": dlq_event.id,
                "original_topic": dlq_event.original_topic,
                "error_message": dlq_event.error_message,
                "retry_count": dlq_event.retry_count,
                "first_failure_at": dlq_event.first_failure_at,
                "severity": "high",
                "requires_manual_review": True,
            })
        except Exception as e:
            logger.error(f"Failed to send DLQ alert: {e}")
    
    # ==========================================================================
    # Manual Review Interface
    # ==========================================================================
    
    def get_pending_events(self) -> List[DLQEvent]:
        """Get all pending DLQ events for manual review"""
        return [
            e for e in self._dlq_store.values()
            if e.status in [DLQEventStatus.PENDING, DLQEventStatus.FAILED_PERMANENTLY]
        ]
    
    def get_event(self, event_id: str) -> Optional[DLQEvent]:
        """Get a specific DLQ event"""
        return self._dlq_store.get(event_id)
    
    async def manually_retry(self, event_id: str, admin_user: str) -> Dict[str, Any]:
        """Manually retry a DLQ event"""
        event = self._dlq_store.get(event_id)
        if not event:
            return {"success": False, "error": "Event not found"}
        
        event.retry_count = 0  # Reset retry count for manual retry
        event.status = DLQEventStatus.PENDING
        
        await self._attempt_retry(event)
        
        return {
            "success": event.status == DLQEventStatus.RESOLVED,
            "status": event.status.value,
            "retried_by": admin_user,
        }
    
    async def manually_resolve(
        self,
        event_id: str,
        admin_user: str,
        resolution_notes: str,
    ) -> Dict[str, Any]:
        """Manually resolve a DLQ event without retrying"""
        event = self._dlq_store.get(event_id)
        if not event:
            return {"success": False, "error": "Event not found"}
        
        event.status = DLQEventStatus.RESOLVED
        event.resolved_by = admin_user
        event.resolved_at = datetime.utcnow().isoformat()
        event.resolution_notes = resolution_notes
        
        return {"success": True, "status": event.status.value}
    
    async def archive_event(self, event_id: str, admin_user: str) -> Dict[str, Any]:
        """Archive a DLQ event"""
        event = self._dlq_store.get(event_id)
        if not event:
            return {"success": False, "error": "Event not found"}
        
        event.status = DLQEventStatus.ARCHIVED
        event.resolved_by = admin_user
        event.resolved_at = datetime.utcnow().isoformat()
        
        return {"success": True, "status": event.status.value}
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get DLQ statistics"""
        events = list(self._dlq_store.values())
        
        return {
            "total_events": len(events),
            "pending": len([e for e in events if e.status == DLQEventStatus.PENDING]),
            "retrying": len([e for e in events if e.status == DLQEventStatus.RETRYING]),
            "resolved": len([e for e in events if e.status == DLQEventStatus.RESOLVED]),
            "failed_permanently": len([e for e in events if e.status == DLQEventStatus.FAILED_PERMANENTLY]),
            "archived": len([e for e in events if e.status == DLQEventStatus.ARCHIVED]),
            "by_topic": self._count_by_topic(events),
        }
    
    def _count_by_topic(self, events: List[DLQEvent]) -> Dict[str, int]:
        """Count events by original topic"""
        counts = {}
        for event in events:
            topic = event.original_topic
            counts[topic] = counts.get(topic, 0) + 1
        return counts


# Global instance
dlq_consumer = DLQConsumer()


# =============================================================================
# Event Handlers for Retry
# =============================================================================

async def handle_escrow_created_retry(event_data: Dict[str, Any]):
    """Retry handler for escrow.created events"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    escrow_id = event_data.get("escrow_id")
    buyer_id = event_data.get("buyer_id")
    seller_id = event_data.get("seller_id")
    amount = event_data.get("amount", 0)
    fee = event_data.get("fee", 0)
    
    await tigerbeetle_money_flows.create_escrow_hold(
        escrow_id=escrow_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        amount_kobo=int(amount * 100),
        fee_kobo=int(fee * 100),
    )


async def handle_escrow_released_retry(event_data: Dict[str, Any]):
    """Retry handler for escrow.released events"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    escrow_id = event_data.get("escrow_id")
    seller_id = event_data.get("seller_id")
    payout_amount = event_data.get("payout_amount", 0)
    
    await tigerbeetle_money_flows.release_escrow_to_seller(
        escrow_id=escrow_id,
        seller_id=seller_id,
        amount_kobo=int(payout_amount * 100),
    )


async def handle_escrow_refunded_retry(event_data: Dict[str, Any]):
    """Retry handler for escrow.cancelled events"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    escrow_id = event_data.get("escrow_id")
    buyer_id = event_data.get("buyer_id")
    refund_amount = event_data.get("refund_amount", 0)
    reason = event_data.get("reason", "retry")
    
    await tigerbeetle_money_flows.refund_escrow_to_buyer(
        escrow_id=escrow_id,
        buyer_id=buyer_id,
        amount_kobo=int(refund_amount * 100),
        reason=reason,
    )


def register_default_handlers():
    """Register default retry handlers"""
    dlq_consumer.register_handler("escrow.created", handle_escrow_created_retry)
    dlq_consumer.register_handler("escrow.released", handle_escrow_released_retry)
    dlq_consumer.register_handler("escrow.cancelled", handle_escrow_refunded_retry)


async def start_dlq_consumer():
    """Start the DLQ consumer with default handlers"""
    register_default_handlers()
    await dlq_consumer.start_consuming()


if __name__ == "__main__":
    asyncio.run(start_dlq_consumer())
