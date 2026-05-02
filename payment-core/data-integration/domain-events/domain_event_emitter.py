#!/usr/bin/env python3
"""
Domain Event Emitter for Lakehouse Integration
Standardized event emission for all payment platform services
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum

from kafka import KafkaProducer
from kafka.errors import KafkaError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EventType(Enum):
    KYC_INITIATED = "kyc.initiated"
    KYC_DOCUMENT_UPLOADED = "kyc.document.uploaded"
    KYC_VERIFICATION_COMPLETED = "kyc.verification.completed"
    KYC_VERIFICATION_FAILED = "kyc.verification.failed"
    KYC_EXPIRED = "kyc.expired"
    
    AML_SCREENING_INITIATED = "aml.screening.initiated"
    AML_SCREENING_COMPLETED = "aml.screening.completed"
    AML_MATCH_FOUND = "aml.match.found"
    AML_CLEARED = "aml.cleared"
    AML_ESCALATED = "aml.escalated"
    SANCTIONS_CHECK_COMPLETED = "sanctions.check.completed"
    
    REMITTANCE_INITIATED = "remittance.initiated"
    REMITTANCE_RATE_LOCKED = "remittance.rate.locked"
    REMITTANCE_CRYPTO_RECEIVED = "remittance.crypto.received"
    REMITTANCE_PAYOUT_INITIATED = "remittance.payout.initiated"
    REMITTANCE_PAYOUT_COMPLETED = "remittance.payout.completed"
    REMITTANCE_PAYOUT_FAILED = "remittance.payout.failed"
    REMITTANCE_COMPLETED = "remittance.completed"
    REMITTANCE_CANCELLED = "remittance.cancelled"
    
    RATE_ALERT_CREATED = "rate.alert.created"
    RATE_ALERT_TRIGGERED = "rate.alert.triggered"
    RATE_ALERT_EXPIRED = "rate.alert.expired"
    RATE_ALERT_CANCELLED = "rate.alert.cancelled"
    
    RECONCILIATION_STARTED = "reconciliation.started"
    RECONCILIATION_COMPLETED = "reconciliation.completed"
    RECONCILIATION_MISMATCH_FOUND = "reconciliation.mismatch.found"
    RECONCILIATION_MISMATCH_RESOLVED = "reconciliation.mismatch.resolved"
    
    DISPUTE_OPENED = "dispute.opened"
    DISPUTE_EVIDENCE_SUBMITTED = "dispute.evidence.submitted"
    DISPUTE_ESCALATED = "dispute.escalated"
    DISPUTE_RESOLVED = "dispute.resolved"
    DISPUTE_CLOSED = "dispute.closed"
    
    FX_LOCK_CREATED = "fx.lock.created"
    FX_LOCK_EXPIRED = "fx.lock.expired"
    FX_LOCK_EXECUTED = "fx.lock.executed"
    FX_HEDGE_CREATED = "fx.hedge.created"
    FX_EXPOSURE_ALERT = "fx.exposure.alert"
    FX_VOLATILITY_ALERT = "fx.volatility.alert"
    
    NOTIFICATION_SENT = "notification.sent"
    NOTIFICATION_DELIVERED = "notification.delivered"
    NOTIFICATION_FAILED = "notification.failed"
    WEBHOOK_DELIVERED = "webhook.delivered"
    WEBHOOK_FAILED = "webhook.failed"
    
    TRANSACTION_INITIATED = "transaction.initiated"
    TRANSACTION_AUTHORIZED = "transaction.authorized"
    TRANSACTION_CAPTURED = "transaction.captured"
    TRANSACTION_SETTLED = "transaction.settled"
    TRANSACTION_FAILED = "transaction.failed"
    TRANSACTION_REFUNDED = "transaction.refunded"
    
    FRAUD_SCORE_CALCULATED = "fraud.score.calculated"
    FRAUD_ALERT_TRIGGERED = "fraud.alert.triggered"
    FRAUD_CASE_OPENED = "fraud.case.opened"
    FRAUD_CASE_RESOLVED = "fraud.case.resolved"
    
    SETTLEMENT_BATCH_CREATED = "settlement.batch.created"
    SETTLEMENT_BATCH_PROCESSED = "settlement.batch.processed"
    SETTLEMENT_COMPLETED = "settlement.completed"
    SETTLEMENT_FAILED = "settlement.failed"


@dataclass
class DomainEvent:
    event_id: str
    event_type: str
    timestamp: str
    version: str
    source_service: str
    correlation_id: str
    causation_id: Optional[str]
    aggregate_type: str
    aggregate_id: str
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


class DomainEventEmitter:
    """Centralized domain event emitter for lakehouse integration"""
    
    def __init__(
        self,
        kafka_bootstrap_servers: str,
        service_name: str,
        topic_prefix: str = "domain.events",
        schema_registry_url: Optional[str] = None
    ):
        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.service_name = service_name
        self.topic_prefix = topic_prefix
        self.schema_registry_url = schema_registry_url
        self.producer: Optional[KafkaProducer] = None
        self.events_emitted = 0
        
    def initialize(self):
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                key_serializer=lambda k: str(k).encode('utf-8') if k else None,
                acks='all',
                retries=5,
                max_in_flight_requests_per_connection=1,
                compression_type='snappy',
                linger_ms=10,
                batch_size=16384
            )
            logger.info(f"Domain event emitter initialized for {self.service_name}")
        except Exception as e:
            logger.error(f"Failed to initialize domain event emitter: {e}")
            raise
    
    def emit(
        self,
        event_type: EventType,
        aggregate_type: str,
        aggregate_id: str,
        data: Dict[str, Any],
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> DomainEvent:
        event = DomainEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type.value,
            timestamp=datetime.utcnow().isoformat(),
            version="1.0",
            source_service=self.service_name,
            correlation_id=correlation_id or str(uuid.uuid4()),
            causation_id=causation_id,
            aggregate_type=aggregate_type,
            aggregate_id=str(aggregate_id),
            data=data,
            metadata=metadata or {}
        )
        
        topic = self._get_topic(event_type)
        
        try:
            future = self.producer.send(topic, key=event.aggregate_id, value=event.to_dict())
            future.get(timeout=10)
            self.events_emitted += 1
            logger.debug(f"Emitted {event_type.value} to {topic}")
            return event
        except KafkaError as e:
            logger.error(f"Failed to emit event {event_type.value}: {e}")
            raise
    
    def _get_topic(self, event_type: EventType) -> str:
        category = event_type.value.split('.')[0]
        return f"{self.topic_prefix}.{category}"
    
    def emit_kyc_completed(self, customer_id: str, verification_id: str, verification_type: str,
                           result: str, confidence_score: float, documents: List[str],
                           correlation_id: Optional[str] = None) -> DomainEvent:
        return self.emit(
            event_type=EventType.KYC_VERIFICATION_COMPLETED,
            aggregate_type="customer",
            aggregate_id=customer_id,
            data={
                "verification_id": verification_id,
                "verification_type": verification_type,
                "result": result,
                "confidence_score": confidence_score,
                "documents": documents,
                "verified_at": datetime.utcnow().isoformat()
            },
            correlation_id=correlation_id
        )
    
    def emit_aml_screening_completed(self, customer_id: str, screening_id: str, risk_score: float,
                                     matches: List[Dict[str, Any]], watchlists_checked: List[str],
                                     result: str, correlation_id: Optional[str] = None) -> DomainEvent:
        return self.emit(
            event_type=EventType.AML_SCREENING_COMPLETED,
            aggregate_type="customer",
            aggregate_id=customer_id,
            data={
                "screening_id": screening_id,
                "risk_score": risk_score,
                "matches_count": len(matches),
                "matches": matches,
                "watchlists_checked": watchlists_checked,
                "result": result,
                "screened_at": datetime.utcnow().isoformat()
            },
            correlation_id=correlation_id
        )
    
    def emit_remittance_completed(self, remittance_id: str, sender_id: str, recipient_id: str,
                                  source_currency: str, source_amount: float, destination_currency: str,
                                  destination_amount: float, exchange_rate: float, delivery_method: str,
                                  fees: Dict[str, float], corridor: str,
                                  correlation_id: Optional[str] = None) -> DomainEvent:
        return self.emit(
            event_type=EventType.REMITTANCE_COMPLETED,
            aggregate_type="remittance",
            aggregate_id=remittance_id,
            data={
                "sender_id": sender_id,
                "recipient_id": recipient_id,
                "source_currency": source_currency,
                "source_amount": source_amount,
                "destination_currency": destination_currency,
                "destination_amount": destination_amount,
                "exchange_rate": exchange_rate,
                "delivery_method": delivery_method,
                "fees": fees,
                "corridor": corridor,
                "completed_at": datetime.utcnow().isoformat()
            },
            correlation_id=correlation_id
        )
    
    def emit_fraud_score_calculated(self, transaction_id: str, customer_id: str, fraud_score: float,
                                    risk_factors: List[Dict[str, Any]], model_version: str,
                                    decision: str, correlation_id: Optional[str] = None) -> DomainEvent:
        return self.emit(
            event_type=EventType.FRAUD_SCORE_CALCULATED,
            aggregate_type="transaction",
            aggregate_id=transaction_id,
            data={
                "customer_id": customer_id,
                "fraud_score": fraud_score,
                "risk_factors": risk_factors,
                "model_version": model_version,
                "decision": decision,
                "calculated_at": datetime.utcnow().isoformat()
            },
            correlation_id=correlation_id
        )
    
    def flush(self):
        if self.producer:
            self.producer.flush()
    
    def close(self):
        if self.producer:
            self.producer.flush()
            self.producer.close()


def create_emitter(service_name: str) -> DomainEventEmitter:
    kafka_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
    emitter = DomainEventEmitter(kafka_bootstrap_servers=kafka_servers, service_name=service_name)
    emitter.initialize()
    return emitter
