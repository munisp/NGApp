"""
Event Streaming Module for SocialEscrow Platform

Provides Kafka-based event publishing for real-time data streaming to the lakehouse.
All business events (transactions, escrows, disputes, etc.) are published as structured
events for analytics, ML training, and compliance reporting.

Architecture:
    Backend API → Kafka Topics → Lakehouse (Iceberg Tables)
                              → Real-time Analytics (Flink/Spark)
                              → ML Feature Store
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from enum import Enum
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import hashlib
import uuid

logger = logging.getLogger(__name__)

# =============================================================================
# EVENT TYPES AND SCHEMAS
# =============================================================================

class EventType(str, Enum):
    # Escrow Events
    ESCROW_CREATED = "escrow.created"
    ESCROW_FUNDED = "escrow.funded"
    ESCROW_RELEASED = "escrow.released"
    ESCROW_REFUNDED = "escrow.refunded"
    ESCROW_DISPUTED = "escrow.disputed"
    ESCROW_EXPIRED = "escrow.expired"
    
    # Transaction Events
    TRANSACTION_INITIATED = "transaction.initiated"
    TRANSACTION_COMPLETED = "transaction.completed"
    TRANSACTION_FAILED = "transaction.failed"
    TRANSACTION_REVERSED = "transaction.reversed"
    
    # User Events
    USER_REGISTERED = "user.registered"
    USER_KYC_SUBMITTED = "user.kyc_submitted"
    USER_KYC_VERIFIED = "user.kyc_verified"
    USER_KYC_REJECTED = "user.kyc_rejected"
    USER_TIER_UPGRADED = "user.tier_upgraded"
    
    # Seller Events
    SELLER_ONBOARDED = "seller.onboarded"
    SELLER_VERIFIED = "seller.verified"
    SELLER_TIER_CHANGED = "seller.tier_changed"
    SELLER_PAYOUT_REQUESTED = "seller.payout_requested"
    SELLER_PAYOUT_COMPLETED = "seller.payout_completed"
    
    # Dispute Events
    DISPUTE_OPENED = "dispute.opened"
    DISPUTE_EVIDENCE_SUBMITTED = "dispute.evidence_submitted"
    DISPUTE_ESCALATED = "dispute.escalated"
    DISPUTE_RESOLVED = "dispute.resolved"
    
    # Return Events
    RETURN_REQUESTED = "return.requested"
    RETURN_APPROVED = "return.approved"
    RETURN_REJECTED = "return.rejected"
    RETURN_SHIPPED = "return.shipped"
    RETURN_RECEIVED = "return.received"
    RETURN_REFUNDED = "return.refunded"
    
    # Delivery Events
    DELIVERY_INITIATED = "delivery.initiated"
    DELIVERY_PICKED_UP = "delivery.picked_up"
    DELIVERY_IN_TRANSIT = "delivery.in_transit"
    DELIVERY_DELIVERED = "delivery.delivered"
    DELIVERY_FAILED = "delivery.failed"
    
    # Risk Events
    RISK_ASSESSMENT_COMPLETED = "risk.assessment_completed"
    RISK_ALERT_TRIGGERED = "risk.alert_triggered"
    FRAUD_DETECTED = "fraud.detected"
    
    # Agent Events
    AGENT_TRANSACTION_INITIATED = "agent.transaction_initiated"
    AGENT_TRANSACTION_COMPLETED = "agent.transaction_completed"
    AGENT_FLOAT_REPLENISHED = "agent.float_replenished"
    
    # Platform Events
    WEBHOOK_RECEIVED = "webhook.received"
    WEBHOOK_PROCESSED = "webhook.processed"
    SLA_BREACH = "sla.breach"
    RECONCILIATION_COMPLETED = "reconciliation.completed"


@dataclass
class EventMetadata:
    """Standard metadata for all events"""
    event_id: str
    event_type: str
    event_version: str
    timestamp: str
    source: str
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    @classmethod
    def create(
        cls,
        event_type: EventType,
        correlation_id: str = None,
        causation_id: str = None,
        tenant_id: str = None,
        user_id: str = None,
        session_id: str = None,
    ) -> "EventMetadata":
        return cls(
            event_id=str(uuid.uuid4()),
            event_type=event_type.value,
            event_version="1.0",
            timestamp=datetime.now(timezone.utc).isoformat(),
            source="escrow-api",
            correlation_id=correlation_id or str(uuid.uuid4()),
            causation_id=causation_id,
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
        )


@dataclass
class BaseEvent:
    """Base class for all events"""
    metadata: EventMetadata
    payload: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "metadata": asdict(self.metadata),
            "payload": self.payload,
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)
    
    @property
    def partition_key(self) -> str:
        """Key for Kafka partitioning - ensures related events go to same partition"""
        return self.metadata.correlation_id or self.metadata.event_id


# =============================================================================
# EVENT SCHEMAS FOR SPECIFIC DOMAINS
# =============================================================================

class EscrowEventPayload:
    """Schema for escrow-related events"""
    
    @staticmethod
    def created(
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount: float,
        currency: str,
        description: str,
        items: List[Dict[str, Any]] = None,
        delivery_method: str = None,
        expiry_date: str = None,
    ) -> Dict[str, Any]:
        return {
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "amount": amount,
            "currency": currency,
            "description": description,
            "items": items or [],
            "delivery_method": delivery_method,
            "expiry_date": expiry_date,
        }
    
    @staticmethod
    def funded(
        escrow_id: str,
        amount: float,
        payment_method: str,
        payment_reference: str,
        funded_at: str,
    ) -> Dict[str, Any]:
        return {
            "escrow_id": escrow_id,
            "amount": amount,
            "payment_method": payment_method,
            "payment_reference": payment_reference,
            "funded_at": funded_at,
        }
    
    @staticmethod
    def released(
        escrow_id: str,
        amount: float,
        released_to: str,
        released_at: str,
        release_reason: str = "delivery_confirmed",
    ) -> Dict[str, Any]:
        return {
            "escrow_id": escrow_id,
            "amount": amount,
            "released_to": released_to,
            "released_at": released_at,
            "release_reason": release_reason,
        }


class TransactionEventPayload:
    """Schema for transaction-related events"""
    
    @staticmethod
    def initiated(
        transaction_id: str,
        escrow_id: str,
        amount: float,
        currency: str,
        from_account: str,
        to_account: str,
        transaction_type: str,
    ) -> Dict[str, Any]:
        return {
            "transaction_id": transaction_id,
            "escrow_id": escrow_id,
            "amount": amount,
            "currency": currency,
            "from_account": from_account,
            "to_account": to_account,
            "transaction_type": transaction_type,
        }
    
    @staticmethod
    def completed(
        transaction_id: str,
        escrow_id: str,
        amount: float,
        currency: str,
        completed_at: str,
        ledger_entry_id: str = None,
    ) -> Dict[str, Any]:
        return {
            "transaction_id": transaction_id,
            "escrow_id": escrow_id,
            "amount": amount,
            "currency": currency,
            "completed_at": completed_at,
            "ledger_entry_id": ledger_entry_id,
        }


class RiskEventPayload:
    """Schema for risk-related events"""
    
    @staticmethod
    def assessment_completed(
        assessment_id: str,
        entity_type: str,
        entity_id: str,
        risk_score: float,
        risk_level: str,
        factors: List[Dict[str, Any]],
        recommendation: str,
    ) -> Dict[str, Any]:
        return {
            "assessment_id": assessment_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "factors": factors,
            "recommendation": recommendation,
        }
    
    @staticmethod
    def fraud_detected(
        alert_id: str,
        entity_type: str,
        entity_id: str,
        fraud_type: str,
        confidence: float,
        indicators: List[str],
        action_taken: str,
    ) -> Dict[str, Any]:
        return {
            "alert_id": alert_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "fraud_type": fraud_type,
            "confidence": confidence,
            "indicators": indicators,
            "action_taken": action_taken,
        }


class DisputeEventPayload:
    """Schema for dispute-related events"""
    
    @staticmethod
    def opened(
        dispute_id: str,
        escrow_id: str,
        complainant_id: str,
        respondent_id: str,
        dispute_type: str,
        amount_disputed: float,
        reason: str,
        evidence_urls: List[str] = None,
    ) -> Dict[str, Any]:
        return {
            "dispute_id": dispute_id,
            "escrow_id": escrow_id,
            "complainant_id": complainant_id,
            "respondent_id": respondent_id,
            "dispute_type": dispute_type,
            "amount_disputed": amount_disputed,
            "reason": reason,
            "evidence_urls": evidence_urls or [],
        }
    
    @staticmethod
    def resolved(
        dispute_id: str,
        escrow_id: str,
        resolution: str,
        winner_id: str,
        amount_awarded: float,
        resolved_by: str,
        resolution_notes: str = None,
    ) -> Dict[str, Any]:
        return {
            "dispute_id": dispute_id,
            "escrow_id": escrow_id,
            "resolution": resolution,
            "winner_id": winner_id,
            "amount_awarded": amount_awarded,
            "resolved_by": resolved_by,
            "resolution_notes": resolution_notes,
        }


# =============================================================================
# KAFKA PRODUCER
# =============================================================================

class EventPublisher(ABC):
    """Abstract base class for event publishers"""
    
    @abstractmethod
    async def publish(self, event: BaseEvent, topic: str = None) -> bool:
        pass
    
    @abstractmethod
    async def publish_batch(self, events: List[BaseEvent], topic: str = None) -> int:
        pass
    
    @abstractmethod
    async def close(self):
        pass


class KafkaEventPublisher(EventPublisher):
    """
    Kafka-based event publisher for production use.
    
    Publishes events to Kafka topics for consumption by:
    - Lakehouse ingestion (Iceberg tables)
    - Real-time analytics (Flink/Spark Streaming)
    - ML feature pipelines
    - Audit logging
    """
    
    def __init__(
        self,
        bootstrap_servers: str = None,
        client_id: str = "escrow-api",
        acks: str = "all",
        retries: int = 3,
        compression_type: str = "gzip",
    ):
        self.bootstrap_servers = bootstrap_servers or os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
        )
        self.client_id = client_id
        self.acks = acks
        self.retries = retries
        self.compression_type = compression_type
        self._producer = None
        self._initialized = False
        
        # Topic mapping
        self.topic_mapping = {
            # Escrow events
            EventType.ESCROW_CREATED: "escrow-events",
            EventType.ESCROW_FUNDED: "escrow-events",
            EventType.ESCROW_RELEASED: "escrow-events",
            EventType.ESCROW_REFUNDED: "escrow-events",
            EventType.ESCROW_DISPUTED: "escrow-events",
            EventType.ESCROW_EXPIRED: "escrow-events",
            
            # Transaction events
            EventType.TRANSACTION_INITIATED: "transaction-events",
            EventType.TRANSACTION_COMPLETED: "transaction-events",
            EventType.TRANSACTION_FAILED: "transaction-events",
            EventType.TRANSACTION_REVERSED: "transaction-events",
            
            # User events
            EventType.USER_REGISTERED: "user-events",
            EventType.USER_KYC_SUBMITTED: "user-events",
            EventType.USER_KYC_VERIFIED: "user-events",
            EventType.USER_KYC_REJECTED: "user-events",
            EventType.USER_TIER_UPGRADED: "user-events",
            
            # Dispute events
            EventType.DISPUTE_OPENED: "dispute-events",
            EventType.DISPUTE_EVIDENCE_SUBMITTED: "dispute-events",
            EventType.DISPUTE_ESCALATED: "dispute-events",
            EventType.DISPUTE_RESOLVED: "dispute-events",
            
            # Risk events
            EventType.RISK_ASSESSMENT_COMPLETED: "risk-events",
            EventType.RISK_ALERT_TRIGGERED: "risk-events",
            EventType.FRAUD_DETECTED: "risk-events",
            
            # Platform events
            EventType.WEBHOOK_RECEIVED: "platform-events",
            EventType.WEBHOOK_PROCESSED: "platform-events",
            EventType.SLA_BREACH: "platform-events",
            EventType.RECONCILIATION_COMPLETED: "platform-events",
        }
    
    async def _ensure_initialized(self):
        """Lazy initialization of Kafka producer"""
        if self._initialized:
            return
        
        try:
            from aiokafka import AIOKafkaProducer
            
            self._producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                client_id=self.client_id,
                acks=self.acks,
                compression_type=self.compression_type,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
            )
            await self._producer.start()
            self._initialized = True
            logger.info(f"Kafka producer initialized: {self.bootstrap_servers}")
        except ImportError:
            logger.warning("aiokafka not installed, using in-memory fallback")
            self._producer = None
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            self._producer = None
            self._initialized = True
    
    def _get_topic(self, event: BaseEvent, override_topic: str = None) -> str:
        """Determine the topic for an event"""
        if override_topic:
            return override_topic
        
        event_type = EventType(event.metadata.event_type)
        return self.topic_mapping.get(event_type, "escrow-events")
    
    async def publish(self, event: BaseEvent, topic: str = None) -> bool:
        """Publish a single event to Kafka"""
        await self._ensure_initialized()
        
        target_topic = self._get_topic(event, topic)
        
        if self._producer is None:
            # Fallback: log event for debugging
            logger.info(f"[EVENT] {target_topic}: {event.to_json()}")
            return True
        
        try:
            await self._producer.send_and_wait(
                target_topic,
                value=event.to_dict(),
                key=event.partition_key,
            )
            logger.debug(f"Published event {event.metadata.event_id} to {target_topic}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish event {event.metadata.event_id}: {e}")
            return False
    
    async def publish_batch(self, events: List[BaseEvent], topic: str = None) -> int:
        """Publish multiple events to Kafka"""
        await self._ensure_initialized()
        
        if not events:
            return 0
        
        if self._producer is None:
            # Fallback: log events
            for event in events:
                target_topic = self._get_topic(event, topic)
                logger.info(f"[EVENT] {target_topic}: {event.to_json()}")
            return len(events)
        
        published = 0
        batch = self._producer.create_batch()
        
        for event in events:
            target_topic = self._get_topic(event, topic)
            try:
                await self._producer.send_and_wait(
                    target_topic,
                    value=event.to_dict(),
                    key=event.partition_key,
                )
                published += 1
            except Exception as e:
                logger.error(f"Failed to publish event {event.metadata.event_id}: {e}")
        
        logger.info(f"Published {published}/{len(events)} events")
        return published
    
    async def close(self):
        """Close the Kafka producer"""
        if self._producer:
            await self._producer.stop()
            self._producer = None
            self._initialized = False
            logger.info("Kafka producer closed")


class InMemoryEventPublisher(EventPublisher):
    """
    In-memory event publisher for development/testing.
    Stores events in memory and can be queried for testing.
    """
    
    def __init__(self):
        self.events: List[Dict[str, Any]] = []
        self.events_by_topic: Dict[str, List[Dict[str, Any]]] = {}
    
    async def publish(self, event: BaseEvent, topic: str = None) -> bool:
        target_topic = topic or "default"
        event_dict = event.to_dict()
        event_dict["_topic"] = target_topic
        event_dict["_published_at"] = datetime.now(timezone.utc).isoformat()
        
        self.events.append(event_dict)
        
        if target_topic not in self.events_by_topic:
            self.events_by_topic[target_topic] = []
        self.events_by_topic[target_topic].append(event_dict)
        
        logger.debug(f"[IN-MEMORY] Published event to {target_topic}")
        return True
    
    async def publish_batch(self, events: List[BaseEvent], topic: str = None) -> int:
        for event in events:
            await self.publish(event, topic)
        return len(events)
    
    async def close(self):
        pass
    
    def get_events(self, topic: str = None) -> List[Dict[str, Any]]:
        """Get events, optionally filtered by topic"""
        if topic:
            return self.events_by_topic.get(topic, [])
        return self.events
    
    def clear(self):
        """Clear all stored events"""
        self.events.clear()
        self.events_by_topic.clear()


# =============================================================================
# EVENT SERVICE (SINGLETON)
# =============================================================================

class EventService:
    """
    Central event service for publishing domain events.
    
    Usage:
        event_service = get_event_service()
        await event_service.publish_escrow_created(escrow_id, buyer_id, seller_id, amount, currency, description)
    """
    
    def __init__(self, publisher: EventPublisher = None):
        self._publisher = publisher
    
    @property
    def publisher(self) -> EventPublisher:
        if self._publisher is None:
            # Auto-initialize based on environment
            kafka_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
            if kafka_servers:
                self._publisher = KafkaEventPublisher(bootstrap_servers=kafka_servers)
            else:
                self._publisher = InMemoryEventPublisher()
                logger.info("Using in-memory event publisher (KAFKA_BOOTSTRAP_SERVERS not set)")
        return self._publisher
    
    # -------------------------------------------------------------------------
    # Escrow Events
    # -------------------------------------------------------------------------
    
    async def publish_escrow_created(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount: float,
        currency: str,
        description: str,
        items: List[Dict[str, Any]] = None,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.ESCROW_CREATED,
            correlation_id=correlation_id or escrow_id,
            user_id=buyer_id,
        )
        payload = EscrowEventPayload.created(
            escrow_id, buyer_id, seller_id, amount, currency, description, items
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def publish_escrow_funded(
        self,
        escrow_id: str,
        amount: float,
        payment_method: str,
        payment_reference: str,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.ESCROW_FUNDED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = EscrowEventPayload.funded(
            escrow_id, amount, payment_method, payment_reference,
            datetime.now(timezone.utc).isoformat()
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def publish_escrow_released(
        self,
        escrow_id: str,
        amount: float,
        released_to: str,
        release_reason: str = "delivery_confirmed",
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.ESCROW_RELEASED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = EscrowEventPayload.released(
            escrow_id, amount, released_to,
            datetime.now(timezone.utc).isoformat(),
            release_reason
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    # -------------------------------------------------------------------------
    # Transaction Events
    # -------------------------------------------------------------------------
    
    async def publish_transaction_initiated(
        self,
        transaction_id: str,
        escrow_id: str,
        amount: float,
        currency: str,
        from_account: str,
        to_account: str,
        transaction_type: str,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.TRANSACTION_INITIATED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = TransactionEventPayload.initiated(
            transaction_id, escrow_id, amount, currency, from_account, to_account, transaction_type
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def publish_transaction_completed(
        self,
        transaction_id: str,
        escrow_id: str,
        amount: float,
        currency: str,
        ledger_entry_id: str = None,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.TRANSACTION_COMPLETED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = TransactionEventPayload.completed(
            transaction_id, escrow_id, amount, currency,
            datetime.now(timezone.utc).isoformat(),
            ledger_entry_id
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    # -------------------------------------------------------------------------
    # Risk Events
    # -------------------------------------------------------------------------
    
    async def publish_risk_assessment(
        self,
        assessment_id: str,
        entity_type: str,
        entity_id: str,
        risk_score: float,
        risk_level: str,
        factors: List[Dict[str, Any]],
        recommendation: str,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.RISK_ASSESSMENT_COMPLETED,
            correlation_id=correlation_id or entity_id,
        )
        payload = RiskEventPayload.assessment_completed(
            assessment_id, entity_type, entity_id, risk_score, risk_level, factors, recommendation
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def publish_fraud_detected(
        self,
        alert_id: str,
        entity_type: str,
        entity_id: str,
        fraud_type: str,
        confidence: float,
        indicators: List[str],
        action_taken: str,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.FRAUD_DETECTED,
            correlation_id=correlation_id or entity_id,
        )
        payload = RiskEventPayload.fraud_detected(
            alert_id, entity_type, entity_id, fraud_type, confidence, indicators, action_taken
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    # -------------------------------------------------------------------------
    # Dispute Events
    # -------------------------------------------------------------------------
    
    async def publish_dispute_opened(
        self,
        dispute_id: str,
        escrow_id: str,
        complainant_id: str,
        respondent_id: str,
        dispute_type: str,
        amount_disputed: float,
        reason: str,
        evidence_urls: List[str] = None,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.DISPUTE_OPENED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = DisputeEventPayload.opened(
            dispute_id, escrow_id, complainant_id, respondent_id,
            dispute_type, amount_disputed, reason, evidence_urls
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def publish_dispute_resolved(
        self,
        dispute_id: str,
        escrow_id: str,
        resolution: str,
        winner_id: str,
        amount_awarded: float,
        resolved_by: str,
        resolution_notes: str = None,
        correlation_id: str = None,
    ) -> bool:
        metadata = EventMetadata.create(
            EventType.DISPUTE_RESOLVED,
            correlation_id=correlation_id or escrow_id,
        )
        payload = DisputeEventPayload.resolved(
            dispute_id, escrow_id, resolution, winner_id, amount_awarded, resolved_by, resolution_notes
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    # -------------------------------------------------------------------------
    # Generic Event Publishing
    # -------------------------------------------------------------------------
    
    async def publish_event(
        self,
        event_type: EventType,
        payload: Dict[str, Any],
        correlation_id: str = None,
        user_id: str = None,
        tenant_id: str = None,
    ) -> bool:
        """Publish a generic event with custom payload"""
        metadata = EventMetadata.create(
            event_type,
            correlation_id=correlation_id,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        event = BaseEvent(metadata=metadata, payload=payload)
        return await self.publisher.publish(event)
    
    async def close(self):
        """Close the event publisher"""
        await self.publisher.close()


# Singleton instance
_event_service: Optional[EventService] = None


def get_event_service() -> EventService:
    """Get the singleton event service instance"""
    global _event_service
    if _event_service is None:
        _event_service = EventService()
    return _event_service


async def init_event_service(publisher: EventPublisher = None) -> EventService:
    """Initialize the event service with a specific publisher"""
    global _event_service
    _event_service = EventService(publisher)
    return _event_service


# =============================================================================
# FASTAPI ROUTER FOR EVENT MANAGEMENT
# =============================================================================

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

event_router = APIRouter(prefix="/api/v1/events", tags=["Events"])


class EventStatsResponse(BaseModel):
    kafka_connected: bool
    events_published: int
    topics: List[str]


@event_router.get("/stats")
async def get_event_stats() -> EventStatsResponse:
    """Get event publishing statistics"""
    service = get_event_service()
    publisher = service.publisher
    
    if isinstance(publisher, InMemoryEventPublisher):
        return EventStatsResponse(
            kafka_connected=False,
            events_published=len(publisher.events),
            topics=list(publisher.events_by_topic.keys()),
        )
    elif isinstance(publisher, KafkaEventPublisher):
        return EventStatsResponse(
            kafka_connected=publisher._initialized and publisher._producer is not None,
            events_published=-1,  # Kafka doesn't track this
            topics=list(publisher.topic_mapping.values()),
        )
    
    return EventStatsResponse(
        kafka_connected=False,
        events_published=0,
        topics=[],
    )


@event_router.get("/recent")
async def get_recent_events(limit: int = 100):
    """Get recent events (only available with in-memory publisher)"""
    service = get_event_service()
    publisher = service.publisher
    
    if isinstance(publisher, InMemoryEventPublisher):
        events = publisher.get_events()[-limit:]
        return {"events": events, "count": len(events)}
    
    raise HTTPException(
        status_code=400,
        detail="Recent events only available with in-memory publisher"
    )
