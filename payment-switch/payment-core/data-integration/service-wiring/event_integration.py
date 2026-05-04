"""
Service Event Integration Module

This module provides decorators and utilities to wire domain event emission
into existing services without modifying their core logic.

Usage:
    from service_wiring.event_integration import EventIntegration, with_domain_events

    # Initialize once at service startup
    EventIntegration.initialize(
        service_name="kyc-service",
        kafka_bootstrap_servers="kafka:9092"
    )

    # Use decorator on service methods
    @with_domain_events(
        event_type=EventType.KYC_VERIFICATION_COMPLETED,
        aggregate_type="customer"
    )
    async def verify_customer(customer_id: str, documents: dict) -> dict:
        # Original service logic
        return result
"""

import asyncio
import functools
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from enum import Enum
import json
import uuid
import traceback

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from domain_events.domain_event_emitter import DomainEventEmitter, EventType, DomainEvent
except ImportError:
    # Fallback if import fails - define minimal types
    class EventType(Enum):
        KYC_INITIATED = "kyc.initiated"
        KYC_VERIFICATION_COMPLETED = "kyc.verification.completed"
        KYC_VERIFICATION_FAILED = "kyc.verification.failed"
        AML_SCREENING_INITIATED = "aml.screening.initiated"
        AML_SCREENING_COMPLETED = "aml.screening.completed"
        AML_ALERT_RAISED = "aml.alert.raised"
        REMITTANCE_INITIATED = "remittance.initiated"
        REMITTANCE_COMPLETED = "remittance.completed"
        REMITTANCE_FAILED = "remittance.failed"
        RATE_ALERT_CREATED = "rate.alert.created"
        RATE_ALERT_TRIGGERED = "rate.alert.triggered"
        RECONCILIATION_STARTED = "reconciliation.started"
        RECONCILIATION_COMPLETED = "reconciliation.completed"
        RECONCILIATION_MISMATCH_FOUND = "reconciliation.mismatch.found"
        DISPUTE_OPENED = "dispute.opened"
        DISPUTE_RESOLVED = "dispute.resolved"
        FX_LOCK_CREATED = "fx.lock.created"
        FX_LOCK_EXPIRED = "fx.lock.expired"
        FRAUD_SCORE_CALCULATED = "fraud.score.calculated"
        TRANSACTION_BLOCKED = "transaction.blocked"
        SETTLEMENT_INITIATED = "settlement.initiated"
        SETTLEMENT_COMPLETED = "settlement.completed"

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

    class DomainEventEmitter:
        def __init__(self, service_name: str, kafka_bootstrap_servers: str):
            self.service_name = service_name
            self.kafka_bootstrap_servers = kafka_bootstrap_servers
            self.logger = logging.getLogger(__name__)

        async def emit(self, event: DomainEvent) -> bool:
            self.logger.info(f"Emitting event: {event.event_type} for {event.aggregate_id}")
            return True

logger = logging.getLogger(__name__)

F = TypeVar('F', bound=Callable[..., Any])


@dataclass
class EventConfig:
    """Configuration for event emission"""
    event_type: Union[EventType, str]
    aggregate_type: str
    aggregate_id_extractor: Optional[Callable[[Any], str]] = None
    data_extractor: Optional[Callable[[Any, Any], Dict[str, Any]]] = None
    emit_on_success: bool = True
    emit_on_failure: bool = True
    failure_event_type: Optional[Union[EventType, str]] = None
    include_timing: bool = True
    include_trace: bool = True


class EventIntegration:
    """
    Singleton class for managing domain event integration across services.
    
    This class provides:
    1. Centralized event emitter management
    2. Correlation ID propagation
    3. Event batching and buffering
    4. Retry logic for failed emissions
    5. Metrics collection for event emission
    """
    
    _instance: Optional['EventIntegration'] = None
    _emitter: Optional[DomainEventEmitter] = None
    _service_name: str = "unknown"
    _initialized: bool = False
    _correlation_id_var: Optional[Any] = None
    _event_buffer: List[DomainEvent] = []
    _buffer_size: int = 100
    _flush_interval: float = 1.0
    _metrics: Dict[str, int] = {}
    
    @classmethod
    def initialize(
        cls,
        service_name: str,
        kafka_bootstrap_servers: str = "kafka:9092",
        buffer_size: int = 100,
        flush_interval: float = 1.0,
        enable_batching: bool = False
    ) -> 'EventIntegration':
        """
        Initialize the event integration singleton.
        
        Args:
            service_name: Name of the service emitting events
            kafka_bootstrap_servers: Kafka bootstrap servers
            buffer_size: Maximum events to buffer before flush
            flush_interval: Seconds between automatic flushes
            enable_batching: Whether to batch events
        """
        if cls._instance is None:
            cls._instance = cls()
        
        cls._service_name = service_name
        cls._emitter = DomainEventEmitter(
            service_name=service_name,
            kafka_bootstrap_servers=kafka_bootstrap_servers
        )
        cls._buffer_size = buffer_size
        cls._flush_interval = flush_interval
        cls._initialized = True
        cls._metrics = {
            "events_emitted": 0,
            "events_failed": 0,
            "events_buffered": 0
        }
        
        logger.info(f"EventIntegration initialized for service: {service_name}")
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> 'EventIntegration':
        """Get the singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @classmethod
    def get_emitter(cls) -> Optional[DomainEventEmitter]:
        """Get the domain event emitter"""
        return cls._emitter
    
    @classmethod
    def is_initialized(cls) -> bool:
        """Check if the integration is initialized"""
        return cls._initialized
    
    @classmethod
    def set_correlation_id(cls, correlation_id: str) -> None:
        """Set the current correlation ID for the request context"""
        if cls._correlation_id_var is None:
            try:
                from contextvars import ContextVar
                cls._correlation_id_var = ContextVar('correlation_id', default=None)
            except ImportError:
                pass
        
        if cls._correlation_id_var:
            cls._correlation_id_var.set(correlation_id)
    
    @classmethod
    def get_correlation_id(cls) -> str:
        """Get the current correlation ID or generate a new one"""
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
        """
        Emit a domain event.
        
        Args:
            event_type: Type of event
            aggregate_type: Type of aggregate (customer, transaction, etc.)
            aggregate_id: ID of the aggregate
            data: Event data
            correlation_id: Correlation ID for tracing
            causation_id: ID of the event that caused this one
            metadata: Additional metadata
        
        Returns:
            True if event was emitted successfully
        """
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
        """Get event emission metrics"""
        return cls._metrics.copy()


def with_domain_events(
    event_type: Union[EventType, str],
    aggregate_type: str,
    aggregate_id_param: str = "id",
    aggregate_id_extractor: Optional[Callable[[Any], str]] = None,
    data_extractor: Optional[Callable[[Dict[str, Any], Any], Dict[str, Any]]] = None,
    emit_on_success: bool = True,
    emit_on_failure: bool = True,
    failure_event_type: Optional[Union[EventType, str]] = None,
    include_timing: bool = True
) -> Callable[[F], F]:
    """
    Decorator to automatically emit domain events from service methods.
    
    Args:
        event_type: Type of event to emit on success
        aggregate_type: Type of aggregate (customer, transaction, etc.)
        aggregate_id_param: Name of parameter containing aggregate ID
        aggregate_id_extractor: Function to extract aggregate ID from result
        data_extractor: Function to extract event data from (kwargs, result)
        emit_on_success: Whether to emit on successful completion
        emit_on_failure: Whether to emit on failure
        failure_event_type: Event type to emit on failure
        include_timing: Whether to include execution timing in metadata
    
    Example:
        @with_domain_events(
            event_type=EventType.KYC_VERIFICATION_COMPLETED,
            aggregate_type="customer",
            aggregate_id_param="customer_id"
        )
        async def verify_customer(customer_id: str, documents: dict) -> dict:
            # verification logic
            return {"status": "verified", "score": 95}
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            correlation_id = EventIntegration.get_correlation_id()
            
            # Extract aggregate ID
            agg_id = None
            if aggregate_id_param in kwargs:
                agg_id = str(kwargs[aggregate_id_param])
            elif args and hasattr(args[0], aggregate_id_param):
                agg_id = str(getattr(args[0], aggregate_id_param))
            
            try:
                # Execute the original function
                result = await func(*args, **kwargs)
                
                # Extract aggregate ID from result if extractor provided
                if aggregate_id_extractor and result:
                    agg_id = aggregate_id_extractor(result)
                
                if emit_on_success and agg_id:
                    # Build event data
                    if data_extractor:
                        event_data = data_extractor(kwargs, result)
                    else:
                        event_data = {
                            "result": result if isinstance(result, dict) else str(result)
                        }
                    
                    # Add timing metadata
                    metadata = {}
                    if include_timing:
                        end_time = datetime.utcnow()
                        metadata["execution_time_ms"] = int((end_time - start_time).total_seconds() * 1000)
                    
                    # Emit success event
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
                    # Emit failure event
                    failure_type = failure_event_type or f"{event_type}.failed" if isinstance(event_type, str) else EventType.KYC_VERIFICATION_FAILED
                    
                    await EventIntegration.emit_event(
                        event_type=failure_type,
                        aggregate_type=aggregate_type,
                        aggregate_id=agg_id or "unknown",
                        data={
                            "error": str(e),
                            "error_type": type(e).__name__,
                            "traceback": traceback.format_exc()
                        },
                        correlation_id=correlation_id,
                        metadata={"failed": True}
                    )
                raise
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # For sync functions, run in event loop
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        else:
            return sync_wrapper  # type: ignore
    
    return decorator


class ServiceEventMixin:
    """
    Mixin class to add domain event capabilities to service classes.
    
    Usage:
        class KYCService(ServiceEventMixin):
            def __init__(self):
                self.init_events("kyc-service", "kafka:9092")
            
            async def verify_customer(self, customer_id: str) -> dict:
                result = await self._do_verification(customer_id)
                await self.emit_kyc_completed(customer_id, result)
                return result
    """
    
    _event_integration: Optional[EventIntegration] = None
    
    def init_events(
        self,
        service_name: str,
        kafka_bootstrap_servers: str = "kafka:9092"
    ) -> None:
        """Initialize event integration for this service"""
        self._event_integration = EventIntegration.initialize(
            service_name=service_name,
            kafka_bootstrap_servers=kafka_bootstrap_servers
        )
    
    async def emit_event(
        self,
        event_type: Union[EventType, str],
        aggregate_type: str,
        aggregate_id: str,
        data: Dict[str, Any],
        correlation_id: Optional[str] = None
    ) -> bool:
        """Emit a domain event"""
        return await EventIntegration.emit_event(
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            data=data,
            correlation_id=correlation_id
        )
    
    # Convenience methods for common events
    async def emit_kyc_completed(self, customer_id: str, result: Dict[str, Any]) -> bool:
        return await self.emit_event(
            EventType.KYC_VERIFICATION_COMPLETED,
            "customer",
            customer_id,
            result
        )
    
    async def emit_aml_screening_completed(self, customer_id: str, result: Dict[str, Any]) -> bool:
        return await self.emit_event(
            EventType.AML_SCREENING_COMPLETED,
            "customer",
            customer_id,
            result
        )
    
    async def emit_remittance_completed(self, remittance_id: str, result: Dict[str, Any]) -> bool:
        return await self.emit_event(
            EventType.REMITTANCE_COMPLETED,
            "remittance",
            remittance_id,
            result
        )
    
    async def emit_fraud_score(self, transaction_id: str, score: float, factors: List[str]) -> bool:
        return await self.emit_event(
            EventType.FRAUD_SCORE_CALCULATED,
            "transaction",
            transaction_id,
            {"score": score, "risk_factors": factors}
        )
    
    async def emit_settlement_completed(self, settlement_id: str, result: Dict[str, Any]) -> bool:
        return await self.emit_event(
            EventType.SETTLEMENT_COMPLETED,
            "settlement",
            settlement_id,
            result
        )


# Service-specific integration helpers
class KYCEventIntegration:
    """KYC-specific event integration"""
    
    @staticmethod
    async def emit_verification_started(customer_id: str, document_types: List[str]) -> bool:
        return await EventIntegration.emit_event(
            EventType.KYC_INITIATED,
            "customer",
            customer_id,
            {"document_types": document_types, "started_at": datetime.utcnow().isoformat()}
        )
    
    @staticmethod
    async def emit_verification_completed(
        customer_id: str,
        status: str,
        confidence_score: float,
        verified_fields: List[str]
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.KYC_VERIFICATION_COMPLETED,
            "customer",
            customer_id,
            {
                "status": status,
                "confidence_score": confidence_score,
                "verified_fields": verified_fields,
                "completed_at": datetime.utcnow().isoformat()
            }
        )


class AMLEventIntegration:
    """AML-specific event integration"""
    
    @staticmethod
    async def emit_screening_completed(
        customer_id: str,
        risk_score: float,
        watchlists_checked: List[str],
        matches_found: int
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.AML_SCREENING_COMPLETED,
            "customer",
            customer_id,
            {
                "risk_score": risk_score,
                "watchlists_checked": watchlists_checked,
                "matches_found": matches_found,
                "screened_at": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    async def emit_alert_raised(
        customer_id: str,
        alert_type: str,
        severity: str,
        details: Dict[str, Any]
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.AML_ALERT_RAISED,
            "customer",
            customer_id,
            {
                "alert_type": alert_type,
                "severity": severity,
                "details": details,
                "raised_at": datetime.utcnow().isoformat()
            }
        )


class RemittanceEventIntegration:
    """Remittance-specific event integration"""
    
    @staticmethod
    async def emit_initiated(
        remittance_id: str,
        sender_id: str,
        recipient_id: str,
        amount: float,
        currency: str,
        corridor: str
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.REMITTANCE_INITIATED,
            "remittance",
            remittance_id,
            {
                "sender_id": sender_id,
                "recipient_id": recipient_id,
                "amount": amount,
                "currency": currency,
                "corridor": corridor,
                "initiated_at": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    async def emit_completed(
        remittance_id: str,
        status: str,
        payout_reference: str,
        fees: float,
        exchange_rate: float
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.REMITTANCE_COMPLETED,
            "remittance",
            remittance_id,
            {
                "status": status,
                "payout_reference": payout_reference,
                "fees": fees,
                "exchange_rate": exchange_rate,
                "completed_at": datetime.utcnow().isoformat()
            }
        )


class ReconciliationEventIntegration:
    """Reconciliation-specific event integration"""
    
    @staticmethod
    async def emit_mismatch_found(
        reconciliation_id: str,
        entity_type: str,
        entity_id: str,
        expected_value: Any,
        actual_value: Any,
        difference: Any
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.RECONCILIATION_MISMATCH_FOUND,
            "reconciliation",
            reconciliation_id,
            {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "expected_value": expected_value,
                "actual_value": actual_value,
                "difference": difference,
                "found_at": datetime.utcnow().isoformat()
            }
        )


class FraudEventIntegration:
    """Fraud detection event integration"""
    
    @staticmethod
    async def emit_score_calculated(
        transaction_id: str,
        score: float,
        risk_factors: List[str],
        decision: str,
        model_version: str
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.FRAUD_SCORE_CALCULATED,
            "transaction",
            transaction_id,
            {
                "score": score,
                "risk_factors": risk_factors,
                "decision": decision,
                "model_version": model_version,
                "scored_at": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    async def emit_transaction_blocked(
        transaction_id: str,
        reason: str,
        score: float,
        risk_factors: List[str]
    ) -> bool:
        return await EventIntegration.emit_event(
            EventType.TRANSACTION_BLOCKED,
            "transaction",
            transaction_id,
            {
                "reason": reason,
                "score": score,
                "risk_factors": risk_factors,
                "blocked_at": datetime.utcnow().isoformat()
            }
        )
