"""
Unified Transaction Timeline - Single view of transaction lifecycle
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from temporalio import activity

logger = logging.getLogger(__name__)


class TimelineEventType(str, Enum):
    INITIATED = "initiated"
    VALIDATED = "validated"
    FRAUD_CHECK = "fraud_check"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    SETTLED = "settled"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    REVERSED = "reversed"
    NOTIFICATION_SENT = "notification_sent"
    WEBHOOK_DELIVERED = "webhook_delivered"
    MANUAL_REVIEW = "manual_review"
    ESCALATED = "escalated"
    RESOLVED = "resolved"


class EventStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    PENDING = "pending"
    SKIPPED = "skipped"


class ActorType(str, Enum):
    CUSTOMER = "customer"
    MERCHANT = "merchant"
    SYSTEM = "system"
    ADMIN = "admin"
    PROVIDER = "provider"
    SUPPORT = "support"


@dataclass
class TimelineActor:
    type: ActorType
    id: str
    name: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelineEvent:
    id: str
    transaction_id: str
    event_type: TimelineEventType
    status: EventStatus
    actor: TimelineActor
    timestamp: datetime
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    duration_ms: Optional[int] = None
    parent_event_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransactionTimeline:
    transaction_id: str
    events: List[TimelineEvent]
    current_status: str
    created_at: datetime
    updated_at: datetime
    total_duration_ms: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelineFilter:
    transaction_id: Optional[str] = None
    customer_id: Optional[str] = None
    merchant_id: Optional[str] = None
    event_types: Optional[List[TimelineEventType]] = None
    status: Optional[EventStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = 100
    offset: int = 0


@dataclass
class ExceptionNotification:
    id: str
    transaction_id: str
    event_id: str
    exception_type: str
    message: str
    severity: str
    notified_at: datetime
    channels: List[str]
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None


class TransactionTimelineService:
    def __init__(self):
        self.timelines: Dict[str, TransactionTimeline] = {}
        self.events: Dict[str, List[TimelineEvent]] = {}
        self.notifications: List[ExceptionNotification] = []
        self.event_handlers: Dict[str, List[callable]] = {}

    def on(self, event: str, handler: callable):
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)

    def emit(self, event: str, data: Any):
        handlers = self.event_handlers.get(event, [])
        for handler in handlers:
            try:
                handler(data)
            except Exception as e:
                logger.error(f"Event handler error: {e}")

    def create_timeline(self, transaction_id: str, metadata: Optional[Dict[str, Any]] = None) -> TransactionTimeline:
        now = datetime.now()
        timeline = TransactionTimeline(
            transaction_id=transaction_id,
            events=[],
            current_status="initiated",
            created_at=now,
            updated_at=now,
            total_duration_ms=0,
            metadata=metadata or {}
        )
        self.timelines[transaction_id] = timeline
        self.events[transaction_id] = []
        logger.info(f"Created timeline for transaction: {transaction_id}")
        return timeline

    def add_event(
        self,
        transaction_id: str,
        event_type: TimelineEventType,
        status: EventStatus,
        actor: TimelineActor,
        description: str,
        details: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        parent_event_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TimelineEvent:
        if transaction_id not in self.timelines:
            self.create_timeline(transaction_id)

        event = TimelineEvent(
            id=str(uuid.uuid4()),
            transaction_id=transaction_id,
            event_type=event_type,
            status=status,
            actor=actor,
            timestamp=datetime.now(),
            description=description,
            details=details or {},
            duration_ms=duration_ms,
            parent_event_id=parent_event_id,
            metadata=metadata or {}
        )

        self.events[transaction_id].append(event)
        self.timelines[transaction_id].events.append(event)
        self.timelines[transaction_id].updated_at = datetime.now()

        if event_type in [TimelineEventType.COMPLETED, TimelineEventType.FAILED, 
                          TimelineEventType.REFUNDED, TimelineEventType.REVERSED]:
            self.timelines[transaction_id].current_status = event_type.value

        if duration_ms:
            self.timelines[transaction_id].total_duration_ms += duration_ms

        self.emit("eventAdded", event)

        if status == EventStatus.FAILURE:
            self._create_exception_notification(event)

        logger.info(f"Added event {event_type.value} to transaction {transaction_id}")
        return event

    def _create_exception_notification(self, event: TimelineEvent):
        notification = ExceptionNotification(
            id=str(uuid.uuid4()),
            transaction_id=event.transaction_id,
            event_id=event.id,
            exception_type=event.event_type.value,
            message=event.description,
            severity="high" if event.event_type in [TimelineEventType.FAILED, TimelineEventType.DISPUTED] else "medium",
            notified_at=datetime.now(),
            channels=["email", "webhook", "dashboard"]
        )
        self.notifications.append(notification)
        self.emit("exceptionNotification", notification)
        logger.warning(f"Exception notification created for transaction {event.transaction_id}")

    def get_timeline(self, transaction_id: str) -> Optional[TransactionTimeline]:
        return self.timelines.get(transaction_id)

    def get_events(self, transaction_id: str) -> List[TimelineEvent]:
        return self.events.get(transaction_id, [])

    def query_timelines(self, filter: TimelineFilter) -> List[TransactionTimeline]:
        results = []

        for timeline in self.timelines.values():
            if filter.transaction_id and timeline.transaction_id != filter.transaction_id:
                continue

            if filter.start_date and timeline.created_at < filter.start_date:
                continue

            if filter.end_date and timeline.created_at > filter.end_date:
                continue

            if filter.customer_id:
                customer_match = any(
                    e.actor.type == ActorType.CUSTOMER and e.actor.id == filter.customer_id
                    for e in timeline.events
                )
                if not customer_match:
                    continue

            if filter.merchant_id:
                merchant_match = any(
                    e.actor.type == ActorType.MERCHANT and e.actor.id == filter.merchant_id
                    for e in timeline.events
                )
                if not merchant_match:
                    continue

            results.append(timeline)

        offset = filter.offset
        limit = filter.limit
        return results[offset:offset + limit]

    def get_transaction_summary(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        timeline = self.timelines.get(transaction_id)
        if not timeline:
            return None

        events = self.events.get(transaction_id, [])

        event_summary = {}
        for event in events:
            event_summary[event.event_type.value] = {
                "status": event.status.value,
                "timestamp": event.timestamp.isoformat(),
                "duration_ms": event.duration_ms
            }

        failed_events = [e for e in events if e.status == EventStatus.FAILURE]

        return {
            "transaction_id": transaction_id,
            "current_status": timeline.current_status,
            "created_at": timeline.created_at.isoformat(),
            "updated_at": timeline.updated_at.isoformat(),
            "total_duration_ms": timeline.total_duration_ms,
            "event_count": len(events),
            "events": event_summary,
            "has_failures": len(failed_events) > 0,
            "failure_count": len(failed_events),
            "metadata": timeline.metadata
        }

    def get_customer_timeline(self, customer_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        customer_timelines = []

        for timeline in self.timelines.values():
            customer_events = [
                e for e in timeline.events
                if e.actor.type == ActorType.CUSTOMER and e.actor.id == customer_id
            ]
            if customer_events:
                customer_timelines.append({
                    "transaction_id": timeline.transaction_id,
                    "status": timeline.current_status,
                    "created_at": timeline.created_at.isoformat(),
                    "event_count": len(timeline.events)
                })

        customer_timelines.sort(key=lambda x: x["created_at"], reverse=True)
        return customer_timelines[:limit]

    def get_pending_exceptions(self) -> List[ExceptionNotification]:
        return [n for n in self.notifications if not n.acknowledged]

    def acknowledge_exception(self, notification_id: str, acknowledged_by: str) -> bool:
        for notification in self.notifications:
            if notification.id == notification_id:
                notification.acknowledged = True
                notification.acknowledged_by = acknowledged_by
                notification.acknowledged_at = datetime.now()
                self.emit("exceptionAcknowledged", notification)
                return True
        return False

    def initiate_self_serve_refund(
        self,
        transaction_id: str,
        customer_id: str,
        reason: str,
        amount: Optional[float] = None
    ) -> Dict[str, Any]:
        timeline = self.timelines.get(transaction_id)
        if not timeline:
            return {"success": False, "error": "Transaction not found"}

        if timeline.current_status not in ["completed", "settled"]:
            return {"success": False, "error": "Transaction not eligible for refund"}

        refund_event = self.add_event(
            transaction_id=transaction_id,
            event_type=TimelineEventType.REFUNDED,
            status=EventStatus.PENDING,
            actor=TimelineActor(type=ActorType.CUSTOMER, id=customer_id),
            description=f"Self-serve refund initiated: {reason}",
            details={"reason": reason, "amount": amount, "self_serve": True}
        )

        return {
            "success": True,
            "refund_event_id": refund_event.id,
            "status": "pending_review"
        }

    def get_support_case_context(self, transaction_id: str) -> Dict[str, Any]:
        timeline = self.timelines.get(transaction_id)
        if not timeline:
            return {"error": "Transaction not found"}

        events = self.events.get(transaction_id, [])
        related_notifications = [
            n for n in self.notifications
            if n.transaction_id == transaction_id
        ]

        return {
            "transaction_id": transaction_id,
            "timeline": {
                "status": timeline.current_status,
                "created_at": timeline.created_at.isoformat(),
                "total_duration_ms": timeline.total_duration_ms,
                "events": [
                    {
                        "type": e.event_type.value,
                        "status": e.status.value,
                        "timestamp": e.timestamp.isoformat(),
                        "description": e.description,
                        "actor": {"type": e.actor.type.value, "id": e.actor.id}
                    }
                    for e in events
                ]
            },
            "exceptions": [
                {
                    "id": n.id,
                    "type": n.exception_type,
                    "message": n.message,
                    "severity": n.severity,
                    "acknowledged": n.acknowledged
                }
                for n in related_notifications
            ],
            "metadata": timeline.metadata
        }

    def get_stats(self) -> Dict[str, Any]:
        total_timelines = len(self.timelines)
        total_events = sum(len(events) for events in self.events.values())

        status_counts: Dict[str, int] = {}
        for timeline in self.timelines.values():
            status = timeline.current_status
            status_counts[status] = status_counts.get(status, 0) + 1

        event_type_counts: Dict[str, int] = {}
        for events in self.events.values():
            for event in events:
                event_type = event.event_type.value
                event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1

        pending_exceptions = len([n for n in self.notifications if not n.acknowledged])

        return {
            "total_timelines": total_timelines,
            "total_events": total_events,
            "by_status": status_counts,
            "by_event_type": event_type_counts,
            "pending_exceptions": pending_exceptions,
            "total_notifications": len(self.notifications)
        }


class TransactionTimelineActivities:
    def __init__(self):
        self.service = TransactionTimelineService()

    @activity.defn(name="CreateTransactionTimeline")
    async def create_timeline(self, data: Dict[str, Any]) -> Dict[str, Any]:
        transaction_id = data.get("transaction_id")
        metadata = data.get("metadata")

        timeline = self.service.create_timeline(transaction_id, metadata)

        return {
            "transaction_id": timeline.transaction_id,
            "created_at": timeline.created_at.isoformat()
        }

    @activity.defn(name="AddTimelineEvent")
    async def add_event(self, data: Dict[str, Any]) -> Dict[str, Any]:
        actor = TimelineActor(
            type=ActorType(data.get("actor_type", "system")),
            id=data.get("actor_id", "system"),
            name=data.get("actor_name")
        )

        event = self.service.add_event(
            transaction_id=data.get("transaction_id"),
            event_type=TimelineEventType(data.get("event_type")),
            status=EventStatus(data.get("status", "success")),
            actor=actor,
            description=data.get("description", ""),
            details=data.get("details"),
            duration_ms=data.get("duration_ms"),
            parent_event_id=data.get("parent_event_id"),
            metadata=data.get("metadata")
        )

        return {
            "event_id": event.id,
            "transaction_id": event.transaction_id,
            "event_type": event.event_type.value,
            "timestamp": event.timestamp.isoformat()
        }

    @activity.defn(name="GetTransactionTimeline")
    async def get_timeline(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        return self.service.get_transaction_summary(transaction_id)

    @activity.defn(name="GetCustomerTimeline")
    async def get_customer_timeline(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        customer_id = data.get("customer_id")
        limit = data.get("limit", 50)
        return self.service.get_customer_timeline(customer_id, limit)

    @activity.defn(name="InitiateSelfServeRefund")
    async def initiate_refund(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.service.initiate_self_serve_refund(
            transaction_id=data.get("transaction_id"),
            customer_id=data.get("customer_id"),
            reason=data.get("reason"),
            amount=data.get("amount")
        )

    @activity.defn(name="GetSupportCaseContext")
    async def get_support_context(self, transaction_id: str) -> Dict[str, Any]:
        return self.service.get_support_case_context(transaction_id)

    @activity.defn(name="AcknowledgeException")
    async def acknowledge_exception(self, data: Dict[str, Any]) -> Dict[str, Any]:
        success = self.service.acknowledge_exception(
            notification_id=data.get("notification_id"),
            acknowledged_by=data.get("acknowledged_by")
        )
        return {"success": success}

    @activity.defn(name="GetTimelineStats")
    async def get_stats(self) -> Dict[str, Any]:
        return self.service.get_stats()
