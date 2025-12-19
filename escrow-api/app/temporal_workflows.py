"""
Temporal Workflow Definitions for EscrowProtect Platform

This module contains the actual workflow definitions that orchestrate
the escrow lifecycle. These workflows are executed by Temporal workers.
"""

import asyncio
from datetime import timedelta
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# Temporal SDK imports (with graceful fallback)
try:
    from temporalio import workflow, activity
    from temporalio.common import RetryPolicy
    from temporalio.workflow import ParentClosePolicy
    TEMPORAL_SDK_AVAILABLE = True
except ImportError:
    TEMPORAL_SDK_AVAILABLE = False
    logger.warning("Temporal SDK not available - workflows will be stubs")
    
    # Create stub decorators
    class workflow:
        @staticmethod
        def defn(cls):
            return cls
        @staticmethod
        def run(fn):
            return fn
        @staticmethod
        def signal(fn):
            return fn
        @staticmethod
        def query(fn):
            return fn
    
    class activity:
        @staticmethod
        def defn(fn):
            return fn


class EscrowState(str, Enum):
    """Escrow workflow states"""
    CREATED = "created"
    PAYMENT_RECEIVED = "payment_received"
    SELLER_NOTIFIED = "seller_notified"
    SELLER_ACCEPTED = "seller_accepted"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    REFUNDED = "refunded"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass
class EscrowWorkflowInput:
    """Input for starting an escrow workflow"""
    escrow_id: str
    buyer_id: str
    seller_id: str
    amount_kobo: int
    fee_kobo: int
    currency: str = "NGN"
    description: str = ""
    seller_notification_timeout_hours: int = 48
    shipping_timeout_days: int = 7
    delivery_confirmation_timeout_days: int = 3


@dataclass
class EscrowWorkflowResult:
    """Result of escrow workflow completion"""
    escrow_id: str
    final_state: str
    buyer_id: str
    seller_id: str
    amount_released: int
    fee_collected: int
    completed_at: str
    timeline: List[Dict[str, Any]]


# =============================================================================
# ACTIVITIES - Individual steps in the workflow
# =============================================================================

@activity.defn
async def create_escrow_hold_activity(
    escrow_id: str,
    buyer_id: str,
    seller_id: str,
    amount_kobo: int,
    fee_kobo: int,
) -> Dict[str, Any]:
    """Create escrow hold in TigerBeetle"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    result = await tigerbeetle_money_flows.create_escrow_hold(
        escrow_id=escrow_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        amount_kobo=amount_kobo,
        fee_kobo=fee_kobo,
    )
    return result


@activity.defn
async def notify_seller_activity(
    escrow_id: str,
    seller_id: str,
    amount_kobo: int,
    description: str,
) -> Dict[str, Any]:
    """Send notification to seller about new escrow"""
    from app.middleware_integrations import production_kafka
    
    await production_kafka.publish("notifications.seller", {
        "type": "new_escrow",
        "escrow_id": escrow_id,
        "seller_id": seller_id,
        "amount_kobo": amount_kobo,
        "description": description,
    })
    
    return {"success": True, "notification_sent": True}


@activity.defn
async def release_to_seller_activity(
    escrow_id: str,
    seller_id: str,
    amount_kobo: int,
) -> Dict[str, Any]:
    """Release escrow funds to seller"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    result = await tigerbeetle_money_flows.release_escrow_to_seller(
        escrow_id=escrow_id,
        seller_id=seller_id,
        amount_kobo=amount_kobo,
    )
    return result


@activity.defn
async def refund_to_buyer_activity(
    escrow_id: str,
    buyer_id: str,
    amount_kobo: int,
    reason: str,
) -> Dict[str, Any]:
    """Refund escrow funds to buyer"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    result = await tigerbeetle_money_flows.refund_escrow_to_buyer(
        escrow_id=escrow_id,
        buyer_id=buyer_id,
        amount_kobo=amount_kobo,
        reason=reason,
    )
    return result


@activity.defn
async def collect_platform_fee_activity(
    escrow_id: str,
    fee_kobo: int,
) -> Dict[str, Any]:
    """Collect platform fee"""
    from app.middleware_integrations import tigerbeetle_money_flows
    
    result = await tigerbeetle_money_flows.collect_platform_fee(
        escrow_id=escrow_id,
        fee_amount_kobo=fee_kobo,
        fee_type="transaction_fee",
    )
    return result


@activity.defn
async def publish_event_activity(
    topic: str,
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Publish event to Kafka"""
    from app.middleware_integrations import production_kafka
    
    await production_kafka.publish(topic, event)
    return {"success": True, "topic": topic}


@activity.defn
async def log_to_opensearch_activity(
    escrow_id: str,
    event_type: str,
    details: Dict[str, Any],
) -> Dict[str, Any]:
    """Log event to OpenSearch"""
    from app.middleware_integrations import opensearch_client
    
    await opensearch_client.log_escrow_event(
        escrow_id=escrow_id,
        event_type=event_type,
        details=details,
    )
    return {"success": True}


@activity.defn
async def check_authorization_activity(
    user_id: str,
    escrow_id: str,
    permission: str,
) -> bool:
    """Check user authorization via Permify"""
    from app.middleware_integrations import permify_client
    
    return await permify_client.check_permission(
        entity_type="escrow",
        entity_id=escrow_id,
        permission=permission,
        subject_type="user",
        subject_id=user_id,
    )


@activity.defn
async def update_escrow_status_activity(
    escrow_id: str,
    status: str,
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """Update escrow status in database"""
    try:
        from app.repositories import get_escrow_repository
        repo = get_escrow_repository()
        await repo.update_status(escrow_id, status, metadata)
        return {"success": True, "status": status}
    except Exception as e:
        logger.error(f"Failed to update escrow status: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# WORKFLOW DEFINITION
# =============================================================================

@workflow.defn
class EscrowLifecycleWorkflow:
    """
    Main escrow lifecycle workflow.
    
    This workflow orchestrates the entire escrow process:
    1. Create escrow hold (TigerBeetle)
    2. Notify seller
    3. Wait for seller acceptance (with timeout)
    4. Wait for shipping confirmation
    5. Wait for delivery confirmation
    6. Release funds to seller OR refund to buyer
    """
    
    def __init__(self):
        self._state = EscrowState.CREATED
        self._timeline: List[Dict[str, Any]] = []
        self._seller_accepted = False
        self._shipped = False
        self._delivered = False
        self._disputed = False
        self._cancelled = False
        self._input: Optional[EscrowWorkflowInput] = None
    
    @workflow.run
    async def run(self, input: EscrowWorkflowInput) -> EscrowWorkflowResult:
        """Main workflow execution"""
        self._input = input
        self._add_timeline_event("workflow_started", "Escrow workflow initiated")
        
        # Retry policy for activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=5,
        ) if TEMPORAL_SDK_AVAILABLE else None
        
        try:
            # Step 1: Create escrow hold in TigerBeetle
            self._state = EscrowState.PAYMENT_RECEIVED
            self._add_timeline_event("escrow_hold_created", "Funds held in escrow")
            
            if TEMPORAL_SDK_AVAILABLE:
                await workflow.execute_activity(
                    create_escrow_hold_activity,
                    args=[input.escrow_id, input.buyer_id, input.seller_id, 
                          input.amount_kobo, input.fee_kobo],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=retry_policy,
                )
            
            # Step 2: Notify seller
            self._state = EscrowState.SELLER_NOTIFIED
            self._add_timeline_event("seller_notified", "Seller notification sent")
            
            if TEMPORAL_SDK_AVAILABLE:
                await workflow.execute_activity(
                    notify_seller_activity,
                    args=[input.escrow_id, input.seller_id, input.amount_kobo, input.description],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=retry_policy,
                )
            
            # Step 3: Wait for seller acceptance (with timeout)
            seller_timeout = timedelta(hours=input.seller_notification_timeout_hours)
            
            if TEMPORAL_SDK_AVAILABLE:
                try:
                    await workflow.wait_condition(
                        lambda: self._seller_accepted or self._cancelled,
                        timeout=seller_timeout,
                    )
                except asyncio.TimeoutError:
                    # Seller didn't respond - auto-refund
                    return await self._handle_timeout("seller_timeout")
            
            if self._cancelled:
                return await self._handle_cancellation()
            
            self._state = EscrowState.SELLER_ACCEPTED
            self._add_timeline_event("seller_accepted", "Seller accepted the order")
            
            # Step 4: Wait for shipping (with timeout)
            shipping_timeout = timedelta(days=input.shipping_timeout_days)
            
            if TEMPORAL_SDK_AVAILABLE:
                try:
                    await workflow.wait_condition(
                        lambda: self._shipped or self._cancelled or self._disputed,
                        timeout=shipping_timeout,
                    )
                except asyncio.TimeoutError:
                    return await self._handle_timeout("shipping_timeout")
            
            if self._cancelled:
                return await self._handle_cancellation()
            if self._disputed:
                return await self._handle_dispute()
            
            self._state = EscrowState.SHIPPED
            self._add_timeline_event("shipped", "Order shipped")
            
            # Step 5: Wait for delivery confirmation (with timeout)
            delivery_timeout = timedelta(days=input.delivery_confirmation_timeout_days)
            
            if TEMPORAL_SDK_AVAILABLE:
                try:
                    await workflow.wait_condition(
                        lambda: self._delivered or self._disputed,
                        timeout=delivery_timeout,
                    )
                except asyncio.TimeoutError:
                    # Auto-release after delivery timeout (buyer didn't dispute)
                    self._delivered = True
            
            if self._disputed:
                return await self._handle_dispute()
            
            # Step 6: Release funds to seller
            self._state = EscrowState.COMPLETED
            self._add_timeline_event("funds_released", "Funds released to seller")
            
            payout_amount = input.amount_kobo - input.fee_kobo
            
            if TEMPORAL_SDK_AVAILABLE:
                await workflow.execute_activity(
                    release_to_seller_activity,
                    args=[input.escrow_id, input.seller_id, payout_amount],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=retry_policy,
                )
                
                await workflow.execute_activity(
                    collect_platform_fee_activity,
                    args=[input.escrow_id, input.fee_kobo],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=retry_policy,
                )
            
            # Publish completion event
            if TEMPORAL_SDK_AVAILABLE:
                await workflow.execute_activity(
                    publish_event_activity,
                    args=["escrow.completed", {
                        "escrow_id": input.escrow_id,
                        "buyer_id": input.buyer_id,
                        "seller_id": input.seller_id,
                        "amount_released": payout_amount,
                        "fee_collected": input.fee_kobo,
                    }],
                    start_to_close_timeout=timedelta(seconds=30),
                )
            
            from datetime import datetime
            return EscrowWorkflowResult(
                escrow_id=input.escrow_id,
                final_state=self._state.value,
                buyer_id=input.buyer_id,
                seller_id=input.seller_id,
                amount_released=payout_amount,
                fee_collected=input.fee_kobo,
                completed_at=datetime.utcnow().isoformat(),
                timeline=self._timeline,
            )
            
        except Exception as e:
            logger.error(f"Workflow failed: {e}")
            self._add_timeline_event("workflow_error", str(e))
            raise
    
    @workflow.signal
    def seller_accept(self):
        """Signal: Seller accepts the order"""
        self._seller_accepted = True
        self._add_timeline_event("signal_seller_accept", "Seller acceptance signal received")
    
    @workflow.signal
    def mark_shipped(self, tracking_number: str = None):
        """Signal: Order has been shipped"""
        self._shipped = True
        self._add_timeline_event("signal_shipped", f"Shipping signal received. Tracking: {tracking_number}")
    
    @workflow.signal
    def confirm_delivery(self):
        """Signal: Buyer confirms delivery"""
        self._delivered = True
        self._add_timeline_event("signal_delivered", "Delivery confirmation signal received")
    
    @workflow.signal
    def open_dispute(self, reason: str = None):
        """Signal: Dispute opened"""
        self._disputed = True
        self._add_timeline_event("signal_dispute", f"Dispute signal received. Reason: {reason}")
    
    @workflow.signal
    def cancel(self, reason: str = None):
        """Signal: Cancellation requested"""
        self._cancelled = True
        self._add_timeline_event("signal_cancel", f"Cancellation signal received. Reason: {reason}")
    
    @workflow.query
    def get_state(self) -> str:
        """Query: Get current workflow state"""
        return self._state.value
    
    @workflow.query
    def get_timeline(self) -> List[Dict[str, Any]]:
        """Query: Get workflow timeline"""
        return self._timeline
    
    def _add_timeline_event(self, event_type: str, description: str):
        """Add event to timeline"""
        from datetime import datetime
        self._timeline.append({
            "event_type": event_type,
            "description": description,
            "timestamp": datetime.utcnow().isoformat(),
            "state": self._state.value,
        })
    
    async def _handle_timeout(self, timeout_type: str) -> EscrowWorkflowResult:
        """Handle timeout - refund to buyer"""
        self._state = EscrowState.EXPIRED
        self._add_timeline_event(timeout_type, f"Timeout: {timeout_type}")
        
        if TEMPORAL_SDK_AVAILABLE:
            await workflow.execute_activity(
                refund_to_buyer_activity,
                args=[self._input.escrow_id, self._input.buyer_id, 
                      self._input.amount_kobo, timeout_type],
                start_to_close_timeout=timedelta(seconds=30),
            )
        
        from datetime import datetime
        return EscrowWorkflowResult(
            escrow_id=self._input.escrow_id,
            final_state=self._state.value,
            buyer_id=self._input.buyer_id,
            seller_id=self._input.seller_id,
            amount_released=0,
            fee_collected=0,
            completed_at=datetime.utcnow().isoformat(),
            timeline=self._timeline,
        )
    
    async def _handle_cancellation(self) -> EscrowWorkflowResult:
        """Handle cancellation - refund to buyer"""
        self._state = EscrowState.CANCELLED
        self._add_timeline_event("cancelled", "Escrow cancelled")
        
        if TEMPORAL_SDK_AVAILABLE:
            await workflow.execute_activity(
                refund_to_buyer_activity,
                args=[self._input.escrow_id, self._input.buyer_id, 
                      self._input.amount_kobo, "buyer_cancelled"],
                start_to_close_timeout=timedelta(seconds=30),
            )
        
        from datetime import datetime
        return EscrowWorkflowResult(
            escrow_id=self._input.escrow_id,
            final_state=self._state.value,
            buyer_id=self._input.buyer_id,
            seller_id=self._input.seller_id,
            amount_released=0,
            fee_collected=0,
            completed_at=datetime.utcnow().isoformat(),
            timeline=self._timeline,
        )
    
    async def _handle_dispute(self) -> EscrowWorkflowResult:
        """Handle dispute - funds held pending resolution"""
        self._state = EscrowState.DISPUTED
        self._add_timeline_event("disputed", "Dispute opened - funds held pending resolution")
        
        # Publish dispute event
        if TEMPORAL_SDK_AVAILABLE:
            await workflow.execute_activity(
                publish_event_activity,
                args=["escrow.disputed", {
                    "escrow_id": self._input.escrow_id,
                    "buyer_id": self._input.buyer_id,
                    "seller_id": self._input.seller_id,
                    "amount_kobo": self._input.amount_kobo,
                }],
                start_to_close_timeout=timedelta(seconds=30),
            )
        
        from datetime import datetime
        return EscrowWorkflowResult(
            escrow_id=self._input.escrow_id,
            final_state=self._state.value,
            buyer_id=self._input.buyer_id,
            seller_id=self._input.seller_id,
            amount_released=0,
            fee_collected=0,
            completed_at=datetime.utcnow().isoformat(),
            timeline=self._timeline,
        )


# =============================================================================
# WORKER SETUP
# =============================================================================

async def run_temporal_worker():
    """Run Temporal worker to execute workflows"""
    if not TEMPORAL_SDK_AVAILABLE:
        logger.warning("Temporal SDK not available - worker not started")
        return
    
    from temporalio.client import Client
    from temporalio.worker import Worker
    import os
    
    temporal_address = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    namespace = os.getenv("TEMPORAL_NAMESPACE", "escrow")
    task_queue = os.getenv("TEMPORAL_TASK_QUEUE", "escrow-workflows")
    
    try:
        client = await Client.connect(temporal_address, namespace=namespace)
        
        worker = Worker(
            client,
            task_queue=task_queue,
            workflows=[EscrowLifecycleWorkflow],
            activities=[
                create_escrow_hold_activity,
                notify_seller_activity,
                release_to_seller_activity,
                refund_to_buyer_activity,
                collect_platform_fee_activity,
                publish_event_activity,
                log_to_opensearch_activity,
                check_authorization_activity,
                update_escrow_status_activity,
            ],
        )
        
        logger.info(f"Starting Temporal worker on task queue: {task_queue}")
        await worker.run()
        
    except Exception as e:
        logger.error(f"Failed to start Temporal worker: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_temporal_worker())
