"""
Service Event Integration Module for Python Services

This module provides decorators and utilities to wire domain event emission
into existing Python services without modifying their core logic.

Usage:
    from common.events_integration import EventIntegration, with_domain_events, EventType

    # Initialize once at service startup
    EventIntegration.initialize(
        service_name="payment-gateway",
        kafka_bootstrap_servers="kafka:9092"
    )

    # Use decorator on service methods
    @with_domain_events(
        event_type=EventType.TRANSACTION_COMPLETED,
        aggregate_type="transaction"
    )
    async def process_payment(transaction_id: str, amount: float) -> dict:
        # Original service logic
        return result
"""

import asyncio
import functools
import json
import logging
import os
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

logger = logging.getLogger(__name__)

F = TypeVar('F', bound=Callable[..., Any])


class EventType(Enum):
    # Transaction Events
    TRANSACTION_INITIATED = "transaction.initiated"
    TRANSACTION_COMPLETED = "transaction.completed"
    TRANSACTION_FAILED = "transaction.failed"
    TRANSACTION_BLOCKED = "transaction.blocked"
    TRANSACTION_REFUNDED = "transaction.refunded"
    
    # Payment Events
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_COMPLETED = "payment.completed"
    PAYMENT_FAILED = "payment.failed"
    
    # P2P Events
    P2P_TRANSFER_INITIATED = "p2p.transfer.initiated"
    P2P_TRANSFER_COMPLETED = "p2p.transfer.completed"
    P2P_TRANSFER_FAILED = "p2p.transfer.failed"
    
    # QR Events
    QR_CODE_GENERATED = "qr.code.generated"
    QR_PAYMENT_INITIATED = "qr.payment.initiated"
    QR_PAYMENT_COMPLETED = "qr.payment.completed"
    
    # POS Events
    POS_TRANSACTION_INITIATED = "pos.transaction.initiated"
    POS_TRANSACTION_COMPLETED = "pos.transaction.completed"
    POS_TERMINAL_REGISTERED = "pos.terminal.registered"
    
    # VPA Events
    VPA_CREATED = "vpa.created"
    VPA_LINKED = "vpa.linked"
    VPA_PAYMENT_RECEIVED = "vpa.payment.received"
    
    # Settlement Events
    SETTLEMENT_INITIATED = "settlement.initiated"
    SETTLEMENT_COMPLETED = "settlement.completed"
    SETTLEMENT_FAILED = "settlement.failed"
    BATCH_SETTLEMENT_STARTED = "batch.settlement.started"
    BATCH_SETTLEMENT_COMPLETED = "batch.settlement.completed"
    
    # Offline Payment Events
    OFFLINE_TRANSACTION_CREATED = "offline.transaction.created"
    OFFLINE_TRANSACTION_SYNCED = "offline.transaction.synced"
    
    # Subscription Events
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_RENEWED = "subscription.renewed"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"
    SUBSCRIPTION_PAYMENT_FAILED = "subscription.payment.failed"
    
    # Invoice Events
    INVOICE_CREATED = "invoice.created"
    INVOICE_SENT = "invoice.sent"
    INVOICE_PAID = "invoice.paid"
    INVOICE_OVERDUE = "invoice.overdue"
    
    # Payroll Events
    PAYROLL_BATCH_CREATED = "payroll.batch.created"
    PAYROLL_BATCH_PROCESSED = "payroll.batch.processed"
    PAYROLL_DISBURSEMENT_COMPLETED = "payroll.disbursement.completed"
    
    # Notification Events
    NOTIFICATION_SENT = "notification.sent"
    NOTIFICATION_FAILED = "notification.failed"
    NOTIFICATION_DELIVERED = "notification.delivered"
    
    # KYC Events
    KYC_INITIATED = "kyc.initiated"
    KYC_VERIFICATION_COMPLETED = "kyc.verification.completed"
    KYC_VERIFICATION_FAILED = "kyc.verification.failed"
    
    # Fraud Events
    FRAUD_SCORE_CALCULATED = "fraud.score.calculated"
    FRAUD_ALERT_RAISED = "fraud.alert.raised"
    FRAUD_REVIEW_COMPLETED = "fraud.review.completed"
    
    # Biometric Events
    BIOMETRIC_ENROLLED = "biometric.enrolled"
    BIOMETRIC_VERIFIED = "biometric.verified"
    BIOMETRIC_FAILED = "biometric.failed"
    
    # Workflow Events
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"
    WORKFLOW_STEP_COMPLETED = "workflow.step.completed"
    
    # Approval Events
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_GRANTED = "approval.granted"
    APPROVAL_REJECTED = "approval.rejected"
    
    # Corporate Events
    CORPORATE_ONBOARDING_STARTED = "corporate.onboarding.started"
    CORPORATE_ONBOARDING_COMPLETED = "corporate.onboarding.completed"
    
    # ERP Events
    ERP_SYNC_STARTED = "erp.sync.started"
    ERP_SYNC_COMPLETED = "erp.sync.completed"
    ERP_SYNC_FAILED = "erp.sync.failed"
    
    # Social Graph Events
    SOCIAL_CONNECTION_CREATED = "social.connection.created"
    SOCIAL_RECOMMENDATION_GENERATED = "social.recommendation.generated"
    
    # Analytics Events
    ANALYTICS_REPORT_GENERATED = "analytics.report.generated"
    ANALYTICS_INSIGHT_DISCOVERED = "analytics.insight.discovered"


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
        return json.dumps(self.to_dict())


class KafkaEventEmitter:
    def __init__(self, service_name: str, kafka_bootstrap_servers: str):
        self.service_name = service_name
        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.producer = None
        self._initialized = False
        
    async def initialize(self):
        try:
            from aiokafka import AIOKafkaProducer
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='all',
                enable_idempotence=True
            )
            await self.producer.start()
            self._initialized = True
            logger.info(f"Kafka producer initialized for {self.service_name}")
        except ImportError:
            logger.warning("aiokafka not installed, using mock emitter")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            self._initialized = True
    
    async def emit(self, event: DomainEvent) -> bool:
        if not self._initialized:
            await self.initialize()
        
        try:
            if self.producer:
                await self.producer.send_and_wait(
                    topic="domain.events",
                    key=event.aggregate_id,
                    value=event.to_dict(),
                    headers=[
                        ("event_type", event.event_type.encode('utf-8')),
                        ("correlation_id", event.correlation_id.encode('utf-8')),
                        ("source_service", self.service_name.encode('utf-8'))
                    ]
                )
            logger.info(f"Emitted event: {event.event_type} for {event.aggregate_type}/{event.aggregate_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to emit event {event.event_type}: {e}")
            return False
    
    async def close(self):
        if self.producer:
            await self.producer.stop()


class EventIntegration:
    _instance: Optional['EventIntegration'] = None
    _emitter: Optional[KafkaEventEmitter] = None
    _service_name: str = "unknown"
    _initialized: bool = False
    _correlation_id_var = None
    _metrics: Dict[str, int] = {}
    
    @classmethod
    def initialize(
        cls,
        service_name: str,
        kafka_bootstrap_servers: str = None
    ) -> 'EventIntegration':
        if kafka_bootstrap_servers is None:
            kafka_bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        
        if cls._instance is None:
            cls._instance = cls()
        
        cls._service_name = service_name
        cls._emitter = KafkaEventEmitter(
            service_name=service_name,
            kafka_bootstrap_servers=kafka_bootstrap_servers
        )
        cls._initialized = True
        cls._metrics = {
            "events_emitted": 0,
            "events_failed": 0
        }
        
        logger.info(f"EventIntegration initialized for service: {service_name}")
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> 'EventIntegration':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @classmethod
    def is_initialized(cls) -> bool:
        return cls._initialized
    
    @classmethod
    def set_correlation_id(cls, correlation_id: str) -> None:
        try:
            from contextvars import ContextVar
            if cls._correlation_id_var is None:
                cls._correlation_id_var = ContextVar('correlation_id', default=None)
            cls._correlation_id_var.set(correlation_id)
        except Exception:
            pass
    
    @classmethod
    def get_correlation_id(cls) -> str:
        if cls._correlation_id_var:
            cid = cls._correlation_id_var.get()
            if cid:
                return cid
        return str(uuid.uuid4())
    
    @classmethod
    async def emit_event(
        cls,
        event_type: Union[EventType, str],
        aggregate_type: str,
        aggregate_id: str,
        data: Dict[str, Any],
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        if not cls._initialized or cls._emitter is None:
            logger.warning("EventIntegration not initialized, skipping event emission")
            return False
        
        event_type_str = event_type.value if isinstance(event_type, EventType) else event_type
        
        event = DomainEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type_str,
            timestamp=datetime.utcnow().isoformat() + "Z",
            version="1.0",
            source_service=cls._service_name,
            correlation_id=correlation_id or cls.get_correlation_id(),
            causation_id=causation_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            data=data,
            metadata=metadata or {}
        )
        
        try:
            success = await cls._emitter.emit(event)
            if success:
                cls._metrics["events_emitted"] += 1
            else:
                cls._metrics["events_failed"] += 1
            return success
        except Exception as e:
            logger.error(f"Failed to emit event: {e}")
            cls._metrics["events_failed"] += 1
            return False
    
    @classmethod
    def get_metrics(cls) -> Dict[str, int]:
        return cls._metrics.copy()


def with_domain_events(
    event_type: Union[EventType, str],
    aggregate_type: str,
    aggregate_id_param: str = "id",
    aggregate_id_extractor: Optional[Callable[[Any], str]] = None,
    data_extractor: Optional[Callable[[Dict[str, Any], Any], Dict[str, Any]]] = None,
    emit_on_success: bool = True,
    emit_on_failure: bool = True,
    failure_event_type: Optional[Union[EventType, str]] = None
) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            correlation_id = EventIntegration.get_correlation_id()
            
            agg_id = None
            if aggregate_id_param in kwargs:
                agg_id = str(kwargs[aggregate_id_param])
            elif args and len(args) > 0:
                agg_id = str(args[0])
            
            try:
                result = await func(*args, **kwargs)
                
                if aggregate_id_extractor and result:
                    agg_id = aggregate_id_extractor(result)
                
                if emit_on_success and agg_id:
                    if data_extractor:
                        event_data = data_extractor(kwargs, result)
                    else:
                        event_data = {"result": result if isinstance(result, dict) else str(result)}
                    
                    end_time = datetime.utcnow()
                    metadata = {"execution_time_ms": int((end_time - start_time).total_seconds() * 1000)}
                    
                    await EventIntegration.emit_event(
                        event_type=event_type,
                        aggregate_type=aggregate_type,
                        aggregate_id=agg_id,
                        data=event_data,
                        correlation_id=correlation_id,
                        metadata=metadata
                    )
                
                return result
                
            except Exception as e:
                if emit_on_failure and agg_id:
                    failure_type = failure_event_type or f"{event_type.value if isinstance(event_type, EventType) else event_type}.failed"
                    
                    await EventIntegration.emit_event(
                        event_type=failure_type,
                        aggregate_type=aggregate_type,
                        aggregate_id=agg_id or "unknown",
                        data={"error": str(e), "error_type": type(e).__name__},
                        correlation_id=correlation_id,
                        metadata={"failed": True}
                    )
                raise
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Convenience functions for common event types

async def emit_transaction_completed(transaction_id: str, amount: float, currency: str, status: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.TRANSACTION_COMPLETED,
        "transaction",
        transaction_id,
        {"amount": amount, "currency": currency, "status": status, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_payment_completed(payment_id: str, amount: float, currency: str, method: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYMENT_COMPLETED,
        "payment",
        payment_id,
        {"amount": amount, "currency": currency, "method": method, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_p2p_transfer_completed(transfer_id: str, sender_id: str, recipient_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.P2P_TRANSFER_COMPLETED,
        "transfer",
        transfer_id,
        {"sender_id": sender_id, "recipient_id": recipient_id, "amount": amount, "currency": currency, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_qr_payment_completed(payment_id: str, qr_code_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.QR_PAYMENT_COMPLETED,
        "payment",
        payment_id,
        {"qr_code_id": qr_code_id, "amount": amount, "currency": currency, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_pos_transaction_completed(transaction_id: str, terminal_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.POS_TRANSACTION_COMPLETED,
        "transaction",
        transaction_id,
        {"terminal_id": terminal_id, "amount": amount, "currency": currency, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_settlement_completed(settlement_id: str, total_amount: float, transaction_count: int, status: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.SETTLEMENT_COMPLETED,
        "settlement",
        settlement_id,
        {"total_amount": total_amount, "transaction_count": transaction_count, "status": status, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_subscription_created(subscription_id: str, customer_id: str, plan_id: str, amount: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.SUBSCRIPTION_CREATED,
        "subscription",
        subscription_id,
        {"customer_id": customer_id, "plan_id": plan_id, "amount": amount, "created_at": datetime.utcnow().isoformat()}
    )

async def emit_invoice_paid(invoice_id: str, customer_id: str, amount: float, currency: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.INVOICE_PAID,
        "invoice",
        invoice_id,
        {"customer_id": customer_id, "amount": amount, "currency": currency, "paid_at": datetime.utcnow().isoformat()}
    )

async def emit_payroll_completed(batch_id: str, total_amount: float, employee_count: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.PAYROLL_BATCH_PROCESSED,
        "payroll",
        batch_id,
        {"total_amount": total_amount, "employee_count": employee_count, "processed_at": datetime.utcnow().isoformat()}
    )

async def emit_notification_sent(notification_id: str, user_id: str, channel: str, template_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.NOTIFICATION_SENT,
        "notification",
        notification_id,
        {"user_id": user_id, "channel": channel, "template_id": template_id, "sent_at": datetime.utcnow().isoformat()}
    )

async def emit_fraud_score_calculated(transaction_id: str, score: float, risk_level: str, factors: List[str]) -> bool:
    return await EventIntegration.emit_event(
        EventType.FRAUD_SCORE_CALCULATED,
        "transaction",
        transaction_id,
        {"score": score, "risk_level": risk_level, "factors": factors, "scored_at": datetime.utcnow().isoformat()}
    )

async def emit_biometric_verified(user_id: str, biometric_type: str, confidence: float) -> bool:
    return await EventIntegration.emit_event(
        EventType.BIOMETRIC_VERIFIED,
        "user",
        user_id,
        {"biometric_type": biometric_type, "confidence": confidence, "verified_at": datetime.utcnow().isoformat()}
    )

async def emit_workflow_completed(workflow_id: str, workflow_type: str, duration_ms: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.WORKFLOW_COMPLETED,
        "workflow",
        workflow_id,
        {"workflow_type": workflow_type, "duration_ms": duration_ms, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_approval_granted(approval_id: str, request_id: str, approver_id: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.APPROVAL_GRANTED,
        "approval",
        approval_id,
        {"request_id": request_id, "approver_id": approver_id, "granted_at": datetime.utcnow().isoformat()}
    )

async def emit_offline_transaction_synced(transaction_id: str, original_timestamp: str, sync_delay_ms: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.OFFLINE_TRANSACTION_SYNCED,
        "transaction",
        transaction_id,
        {"original_timestamp": original_timestamp, "sync_delay_ms": sync_delay_ms, "synced_at": datetime.utcnow().isoformat()}
    )

async def emit_vpa_payment_received(vpa_id: str, payment_id: str, amount: float, currency: str, sender_vpa: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.VPA_PAYMENT_RECEIVED,
        "vpa",
        vpa_id,
        {"payment_id": payment_id, "amount": amount, "currency": currency, "sender_vpa": sender_vpa, "received_at": datetime.utcnow().isoformat()}
    )

async def emit_erp_sync_completed(sync_id: str, erp_system: str, records_synced: int) -> bool:
    return await EventIntegration.emit_event(
        EventType.ERP_SYNC_COMPLETED,
        "erp_sync",
        sync_id,
        {"erp_system": erp_system, "records_synced": records_synced, "completed_at": datetime.utcnow().isoformat()}
    )

async def emit_analytics_report_generated(report_id: str, report_type: str, time_range: str) -> bool:
    return await EventIntegration.emit_event(
        EventType.ANALYTICS_REPORT_GENERATED,
        "report",
        report_id,
        {"report_type": report_type, "time_range": time_range, "generated_at": datetime.utcnow().isoformat()}
    )
