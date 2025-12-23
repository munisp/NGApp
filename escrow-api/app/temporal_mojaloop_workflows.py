"""
Temporal Workflows for Mojaloop Transfer Orchestration

Implements saga pattern for:
1. BuyerPaymentWorkflow - Inbound payment from buyer via Mojaloop
2. SellerPayoutWorkflow - Outbound payout to seller via Mojaloop
3. RefundWorkflow - Refund to buyer via Mojaloop

Each workflow has compensating transactions for failure scenarios.
"""

import asyncio
import logging
from datetime import timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import Temporal - graceful fallback if not available
try:
    from temporalio import workflow, activity
    from temporalio.common import RetryPolicy
    TEMPORAL_AVAILABLE = True
except ImportError:
    TEMPORAL_AVAILABLE = False
    logger.warning("temporalio package not installed - workflows will not be available")


# =============================================================================
# ACTIVITY DEFINITIONS
# =============================================================================

if TEMPORAL_AVAILABLE:
    @activity.defn
    async def lookup_party_activity(party_id_type: str, party_id_value: str) -> Dict[str, Any]:
        """Look up party via Mojaloop ALS"""
        from app.middleware_wiring import middleware_manager
        from app.mojaloop_adapter import PartyIdType
        
        party_type = PartyIdType[party_id_type]
        party = await middleware_manager.mojaloop.lookup_party(party_type, party_id_value)
        
        if party:
            return {
                "party_id_type": party.party_id_type.value,
                "party_id_value": party.party_id_value,
                "fsp_id": party.fsp_id,
                "name": party.name
            }
        return {}


    @activity.defn
    async def create_quote_activity(
        payer_data: Dict[str, Any],
        payee_data: Dict[str, Any],
        amount: str,
        currency: str,
        transaction_id: str
    ) -> Dict[str, Any]:
        """Create quote via Mojaloop"""
        from app.middleware_wiring import middleware_manager
        from app.mojaloop_adapter import Party, PartyIdType, Money
        
        payer = Party(
            party_id_type=PartyIdType[payer_data["party_id_type"]],
            party_id_value=payer_data["party_id_value"],
            fsp_id=payer_data.get("fsp_id")
        )
        
        payee = Party(
            party_id_type=PartyIdType[payee_data["party_id_type"]],
            party_id_value=payee_data["party_id_value"],
            fsp_id=payee_data.get("fsp_id")
        )
        
        quote = await middleware_manager.mojaloop.create_quote(
            payer=payer,
            payee=payee,
            amount=Money(amount=amount, currency=currency),
            transaction_id=transaction_id
        )
        
        return {
            "quote_id": quote.quote_id,
            "transaction_id": quote.transaction_id,
            "state": quote.state.value,
            "fees": quote.fees.amount if quote.fees else "0",
            "ilp_packet": quote.ilp_packet,
            "condition": quote.condition
        }


    @activity.defn
    async def reserve_escrow_funds_activity(
        escrow_id: str,
        buyer_id: str,
        amount_kobo: int,
        idempotency_key: str,
        timeout_seconds: int
    ) -> Dict[str, Any]:
        """Reserve funds in TigerBeetle escrow (pending transfer)"""
        from app.middleware_wiring import middleware_manager
        
        result = await middleware_manager.tigerbeetle_events.deposit_to_escrow(
            buyer_id=buyer_id,
            escrow_id=escrow_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key,
            timeout_seconds=timeout_seconds
        )
        
        return result


    @activity.defn
    async def initiate_mojaloop_transfer_activity(
        quote_data: Dict[str, Any],
        idempotency_key: str
    ) -> Dict[str, Any]:
        """Initiate transfer via Mojaloop"""
        from app.middleware_wiring import middleware_manager
        from app.mojaloop_adapter import Quote, Party, PartyIdType, Money, QuoteState
        
        # Reconstruct quote object
        quote = Quote(
            quote_id=quote_data["quote_id"],
            transaction_id=quote_data["transaction_id"],
            payer=Party(
                party_id_type=PartyIdType.MSISDN,
                party_id_value="",
                fsp_id=quote_data.get("payer_fsp")
            ),
            payee=Party(
                party_id_type=PartyIdType.MSISDN,
                party_id_value="",
                fsp_id=quote_data.get("payee_fsp")
            ),
            amount=Money(amount=quote_data.get("amount", "0")),
            state=QuoteState.ACCEPTED,
            ilp_packet=quote_data.get("ilp_packet"),
            condition=quote_data.get("condition")
        )
        
        transfer = await middleware_manager.mojaloop.initiate_transfer(
            quote=quote,
            idempotency_key=idempotency_key
        )
        
        return {
            "transfer_id": transfer.transfer_id,
            "state": transfer.state.value,
            "fulfilment": transfer.fulfilment
        }


    @activity.defn
    async def release_escrow_activity(
        escrow_id: str,
        seller_id: str,
        amount_kobo: int,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """Release escrow funds to seller"""
        from app.middleware_wiring import middleware_manager
        
        result = await middleware_manager.tigerbeetle_events.release_escrow(
            escrow_id=escrow_id,
            seller_id=seller_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key
        )
        
        return result


    @activity.defn
    async def refund_escrow_activity(
        escrow_id: str,
        buyer_id: str,
        amount_kobo: int,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """Refund escrow funds to buyer (compensating transaction)"""
        from app.middleware_wiring import middleware_manager
        
        result = await middleware_manager.tigerbeetle_events.refund_escrow(
            escrow_id=escrow_id,
            buyer_id=buyer_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key
        )
        
        return result


    @activity.defn
    async def emit_event_activity(event_type: str, data: Dict[str, Any]) -> bool:
        """Emit event to Kafka/Dapr"""
        from app.middleware_wiring import middleware_manager
        
        # Emit via Dapr pub/sub
        await middleware_manager.dapr.publish_event(
            pubsub_name="escrow-pubsub",
            topic=event_type,
            data=data
        )
        
        return True


    @activity.defn
    async def create_permify_relationship_activity(
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str
    ) -> bool:
        """Create authorization relationship in Permify"""
        from app.middleware_wiring import middleware_manager
        
        return await middleware_manager.permify.create_relationship(
            entity_type=entity_type,
            entity_id=entity_id,
            relation=relation,
            subject_type=subject_type,
            subject_id=subject_id
        )


    @activity.defn
    async def acquire_distributed_lock_activity(lock_name: str, timeout: int = 30) -> str:
        """Acquire distributed lock via Redis"""
        import uuid
        from app.middleware_wiring import middleware_manager
        
        if not middleware_manager.redis.connected:
            await middleware_manager.redis.connect()
        
        lock_key = f"lock:{lock_name}"
        lock_value = str(uuid.uuid4())
        
        acquired = await middleware_manager.redis._client.set(
            lock_key,
            lock_value,
            nx=True,
            ex=timeout
        )
        
        if not acquired:
            raise Exception(f"Failed to acquire lock: {lock_name}")
        
        return lock_value


    @activity.defn
    async def release_distributed_lock_activity(lock_name: str, lock_value: str) -> bool:
        """Release distributed lock"""
        from app.middleware_wiring import middleware_manager
        
        if not middleware_manager.redis.connected:
            return False
        
        lock_key = f"lock:{lock_name}"
        current = await middleware_manager.redis._client.get(lock_key)
        
        if current and current.decode() == lock_value:
            await middleware_manager.redis._client.delete(lock_key)
            return True
        
        return False


    # =============================================================================
    # WORKFLOW DEFINITIONS
    # =============================================================================

    @workflow.defn
    class BuyerPaymentWorkflow:
        """
        Saga workflow for processing buyer payment via Mojaloop.
        
        Steps:
        1. Acquire distributed lock
        2. Look up buyer's DFSP
        3. Create quote
        4. Reserve funds in TigerBeetle
        5. Initiate Mojaloop transfer
        6. Wait for callback
        7. Commit or compensate
        
        Compensation:
        - If Mojaloop transfer fails after TigerBeetle reserve: void pending transfer
        """
        
        def __init__(self):
            self._transfer_result = None
            self._callback_received = False
        
        @workflow.run
        async def run(self, params: Dict[str, Any]) -> Dict[str, Any]:
            escrow_id = params["escrow_id"]
            buyer_id = params["buyer_id"]
            seller_id = params["seller_id"]
            amount_kobo = params["amount_kobo"]
            buyer_phone = params["buyer_phone"]
            idempotency_key = params["idempotency_key"]
            
            lock_value = None
            tigerbeetle_reserved = False
            
            try:
                # Step 1: Acquire distributed lock
                lock_value = await workflow.execute_activity(
                    acquire_distributed_lock_activity,
                    args=[f"payment:{escrow_id}"],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 2: Look up buyer's DFSP
                buyer_party = await workflow.execute_activity(
                    lookup_party_activity,
                    args=["MSISDN", buyer_phone],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                if not buyer_party:
                    raise Exception(f"Buyer party not found: {buyer_phone}")
                
                # Step 3: Create quote
                # Our platform is the payee (receiving funds)
                payer_data = buyer_party
                payee_data = {
                    "party_id_type": "BUSINESS",
                    "party_id_value": "escrowprotect",
                    "fsp_id": "escrowprotect"
                }
                
                amount_naira = str(amount_kobo / 100)
                
                quote = await workflow.execute_activity(
                    create_quote_activity,
                    args=[payer_data, payee_data, amount_naira, "NGN", str(workflow.uuid4())],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 4: Reserve funds in TigerBeetle (pending transfer)
                reserve_result = await workflow.execute_activity(
                    reserve_escrow_funds_activity,
                    args=[escrow_id, buyer_id, amount_kobo, idempotency_key, 48 * 60 * 60],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                tigerbeetle_reserved = True
                
                # Step 5: Initiate Mojaloop transfer
                transfer_result = await workflow.execute_activity(
                    initiate_mojaloop_transfer_activity,
                    args=[quote, idempotency_key],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 6: Wait for callback (with timeout)
                # In production, this would wait for a signal from the callback handler
                await workflow.sleep(timedelta(seconds=5))  # Simulated wait
                
                # Step 7: Create Permify relationships
                await workflow.execute_activity(
                    create_permify_relationship_activity,
                    args=["escrow", escrow_id, "buyer", "user", buyer_id],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                await workflow.execute_activity(
                    create_permify_relationship_activity,
                    args=["escrow", escrow_id, "seller", "user", seller_id],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                # Step 8: Emit success event
                await workflow.execute_activity(
                    emit_event_activity,
                    args=["escrow.payment.completed", {
                        "escrow_id": escrow_id,
                        "buyer_id": buyer_id,
                        "amount_kobo": amount_kobo,
                        "mojaloop_transfer_id": transfer_result.get("transfer_id")
                    }],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                return {
                    "success": True,
                    "escrow_id": escrow_id,
                    "transfer_id": transfer_result.get("transfer_id"),
                    "tigerbeetle_transfer_id": reserve_result.get("transfer_id")
                }
                
            except Exception as e:
                # Compensation: refund if TigerBeetle was reserved
                if tigerbeetle_reserved:
                    try:
                        await workflow.execute_activity(
                            refund_escrow_activity,
                            args=[escrow_id, buyer_id, amount_kobo, f"{idempotency_key}-refund"],
                            start_to_close_timeout=timedelta(seconds=30),
                            retry_policy=RetryPolicy(maximum_attempts=5)
                        )
                    except Exception as refund_error:
                        workflow.logger.error(f"Compensation failed: {refund_error}")
                
                # Emit failure event
                await workflow.execute_activity(
                    emit_event_activity,
                    args=["escrow.payment.failed", {
                        "escrow_id": escrow_id,
                        "buyer_id": buyer_id,
                        "error": str(e)
                    }],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                raise
                
            finally:
                # Release lock
                if lock_value:
                    await workflow.execute_activity(
                        release_distributed_lock_activity,
                        args=[f"payment:{escrow_id}", lock_value],
                        start_to_close_timeout=timedelta(seconds=10)
                    )


    @workflow.defn
    class SellerPayoutWorkflow:
        """
        Saga workflow for processing seller payout via Mojaloop.
        
        Steps:
        1. Acquire distributed lock
        2. Release funds from TigerBeetle escrow
        3. Look up seller's DFSP
        4. Create quote for payout
        5. Initiate Mojaloop transfer
        6. Wait for callback
        7. Confirm or compensate
        
        Compensation:
        - If Mojaloop transfer fails after TigerBeetle release: 
          Hold funds in platform account and alert for manual resolution
        """
        
        @workflow.run
        async def run(self, params: Dict[str, Any]) -> Dict[str, Any]:
            escrow_id = params["escrow_id"]
            seller_id = params["seller_id"]
            amount_kobo = params["amount_kobo"]
            seller_phone = params["seller_phone"]
            idempotency_key = params["idempotency_key"]
            
            lock_value = None
            tigerbeetle_released = False
            
            try:
                # Step 1: Acquire distributed lock
                lock_value = await workflow.execute_activity(
                    acquire_distributed_lock_activity,
                    args=[f"payout:{escrow_id}"],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 2: Release funds from TigerBeetle escrow
                release_result = await workflow.execute_activity(
                    release_escrow_activity,
                    args=[escrow_id, seller_id, amount_kobo, idempotency_key],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                tigerbeetle_released = True
                
                # Step 3: Look up seller's DFSP
                seller_party = await workflow.execute_activity(
                    lookup_party_activity,
                    args=["MSISDN", seller_phone],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                if not seller_party:
                    raise Exception(f"Seller party not found: {seller_phone}")
                
                # Step 4: Create quote for payout
                # Our platform is the payer (sending funds)
                payer_data = {
                    "party_id_type": "BUSINESS",
                    "party_id_value": "escrowprotect",
                    "fsp_id": "escrowprotect"
                }
                payee_data = seller_party
                
                amount_naira = str(amount_kobo / 100)
                
                quote = await workflow.execute_activity(
                    create_quote_activity,
                    args=[payer_data, payee_data, amount_naira, "NGN", str(workflow.uuid4())],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 5: Initiate Mojaloop transfer
                transfer_result = await workflow.execute_activity(
                    initiate_mojaloop_transfer_activity,
                    args=[quote, idempotency_key],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 6: Wait for callback
                await workflow.sleep(timedelta(seconds=5))
                
                # Step 7: Emit success event
                await workflow.execute_activity(
                    emit_event_activity,
                    args=["escrow.payout.completed", {
                        "escrow_id": escrow_id,
                        "seller_id": seller_id,
                        "amount_kobo": amount_kobo,
                        "mojaloop_transfer_id": transfer_result.get("transfer_id")
                    }],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                return {
                    "success": True,
                    "escrow_id": escrow_id,
                    "transfer_id": transfer_result.get("transfer_id"),
                    "tigerbeetle_transfer_id": release_result.get("transfer_id")
                }
                
            except Exception as e:
                # Compensation is complex for payout failures after TigerBeetle release
                # We need to hold funds and alert for manual resolution
                if tigerbeetle_released:
                    await workflow.execute_activity(
                        emit_event_activity,
                        args=["escrow.payout.failed.manual_resolution_required", {
                            "escrow_id": escrow_id,
                            "seller_id": seller_id,
                            "amount_kobo": amount_kobo,
                            "error": str(e),
                            "action_required": "Manual payout or refund required"
                        }],
                        start_to_close_timeout=timedelta(seconds=10)
                    )
                
                raise
                
            finally:
                if lock_value:
                    await workflow.execute_activity(
                        release_distributed_lock_activity,
                        args=[f"payout:{escrow_id}", lock_value],
                        start_to_close_timeout=timedelta(seconds=10)
                    )


    @workflow.defn
    class RefundWorkflow:
        """
        Saga workflow for processing refund to buyer via Mojaloop.
        
        Steps:
        1. Acquire distributed lock
        2. Void/refund TigerBeetle escrow
        3. Look up buyer's DFSP
        4. Create quote for refund
        5. Initiate Mojaloop transfer
        6. Wait for callback
        7. Confirm completion
        """
        
        @workflow.run
        async def run(self, params: Dict[str, Any]) -> Dict[str, Any]:
            escrow_id = params["escrow_id"]
            buyer_id = params["buyer_id"]
            amount_kobo = params["amount_kobo"]
            buyer_phone = params["buyer_phone"]
            idempotency_key = params["idempotency_key"]
            reason = params.get("reason", "Escrow cancelled")
            
            lock_value = None
            
            try:
                # Step 1: Acquire distributed lock
                lock_value = await workflow.execute_activity(
                    acquire_distributed_lock_activity,
                    args=[f"refund:{escrow_id}"],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 2: Refund TigerBeetle escrow
                refund_result = await workflow.execute_activity(
                    refund_escrow_activity,
                    args=[escrow_id, buyer_id, amount_kobo, idempotency_key],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 3: Look up buyer's DFSP
                buyer_party = await workflow.execute_activity(
                    lookup_party_activity,
                    args=["MSISDN", buyer_phone],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                if not buyer_party:
                    raise Exception(f"Buyer party not found: {buyer_phone}")
                
                # Step 4: Create quote for refund
                payer_data = {
                    "party_id_type": "BUSINESS",
                    "party_id_value": "escrowprotect",
                    "fsp_id": "escrowprotect"
                }
                payee_data = buyer_party
                
                amount_naira = str(amount_kobo / 100)
                
                quote = await workflow.execute_activity(
                    create_quote_activity,
                    args=[payer_data, payee_data, amount_naira, "NGN", str(workflow.uuid4())],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 5: Initiate Mojaloop transfer
                transfer_result = await workflow.execute_activity(
                    initiate_mojaloop_transfer_activity,
                    args=[quote, idempotency_key],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
                
                # Step 6: Wait for callback
                await workflow.sleep(timedelta(seconds=5))
                
                # Step 7: Emit success event
                await workflow.execute_activity(
                    emit_event_activity,
                    args=["escrow.refund.completed", {
                        "escrow_id": escrow_id,
                        "buyer_id": buyer_id,
                        "amount_kobo": amount_kobo,
                        "reason": reason,
                        "mojaloop_transfer_id": transfer_result.get("transfer_id")
                    }],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                return {
                    "success": True,
                    "escrow_id": escrow_id,
                    "transfer_id": transfer_result.get("transfer_id"),
                    "tigerbeetle_transfer_id": refund_result.get("transfer_id")
                }
                
            except Exception as e:
                await workflow.execute_activity(
                    emit_event_activity,
                    args=["escrow.refund.failed", {
                        "escrow_id": escrow_id,
                        "buyer_id": buyer_id,
                        "error": str(e)
                    }],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                raise
                
            finally:
                if lock_value:
                    await workflow.execute_activity(
                        release_distributed_lock_activity,
                        args=[f"refund:{escrow_id}", lock_value],
                        start_to_close_timeout=timedelta(seconds=10)
                    )


# =============================================================================
# WORKER SETUP
# =============================================================================

async def run_mojaloop_workflow_worker():
    """Run Temporal worker for Mojaloop workflows"""
    if not TEMPORAL_AVAILABLE:
        logger.warning("Temporal not available - workflow worker not started")
        return
    
    import os
    from temporalio.client import Client
    from temporalio.worker import Worker
    
    temporal_address = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    
    try:
        client = await Client.connect(temporal_address)
        
        worker = Worker(
            client,
            task_queue="escrow-payments",
            workflows=[
                BuyerPaymentWorkflow,
                SellerPayoutWorkflow,
                RefundWorkflow
            ],
            activities=[
                lookup_party_activity,
                create_quote_activity,
                reserve_escrow_funds_activity,
                initiate_mojaloop_transfer_activity,
                release_escrow_activity,
                refund_escrow_activity,
                emit_event_activity,
                create_permify_relationship_activity,
                acquire_distributed_lock_activity,
                release_distributed_lock_activity
            ]
        )
        
        logger.info(f"Starting Mojaloop workflow worker on task queue 'escrow-payments'")
        await worker.run()
        
    except Exception as e:
        logger.error(f"Workflow worker failed: {e}")
        raise
