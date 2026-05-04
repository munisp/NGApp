#!/usr/bin/env python3
"""
Temporal Workflow for POS Payment Processing
Orchestrates the end-to-end payment flow including fraud detection, ledger operations, and bank settlement
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from temporalio import workflow, activity
from temporalio.common import RetryPolicy
import logging

logger = logging.getLogger(__name__)

@dataclass
class POSPaymentRequest:
    """POS payment request data"""
    transaction_id: str
    terminal_id: str
    merchant_id: str
    card_number_masked: str
    amount: int
    currency: str
    timestamp: str
    fraud_score: float
    risk_level: str
    bank_code: str
    location: Optional[dict] = None

@dataclass
class PaymentResult:
    """Payment processing result"""
    transaction_id: str
    status: str  # success, failed, pending
    bank_reference: Optional[str] = None
    ledger_transaction_id: Optional[str] = None
    error_message: Optional[str] = None

# Activity definitions

@activity.defn
async def validate_fraud_score(request: POSPaymentRequest) -> bool:
    """
    Validate fraud score and determine if transaction should proceed
    """
    logger.info(f"Validating fraud score for transaction {request.transaction_id}: {request.fraud_score}")
    
    # Block high-risk transactions
    if request.risk_level == "high":
        logger.warning(f"Transaction {request.transaction_id} blocked due to high fraud risk")
        return False
    
    # Manual review for medium-risk transactions above threshold
    if request.risk_level == "medium" and request.fraud_score > 0.6:
        logger.info(f"Transaction {request.transaction_id} requires manual review")
        # In production, this would trigger a manual review workflow
        return True
    
    return True

@activity.defn
async def create_ledger_transaction(request: POSPaymentRequest) -> str:
    """
    Create a transaction in TigerBeetle ledger
    """
    logger.info(f"Creating ledger transaction for {request.transaction_id}")
    
    # In production, this would call the TigerBeetle client
    # For now, simulate the operation
    await asyncio.sleep(0.05)  # Simulate ledger operation
    
    ledger_txn_id = f"ledger-{request.transaction_id}"
    logger.info(f"Ledger transaction created: {ledger_txn_id}")
    
    return ledger_txn_id

@activity.defn
async def process_bank_payment(request: POSPaymentRequest) -> dict:
    """
    Process payment through the bank adapter
    """
    logger.info(f"Processing bank payment for transaction {request.transaction_id} via {request.bank_code}")
    
    # In production, this would call the BankAdapter service
    # For now, simulate the operation
    await asyncio.sleep(0.1)  # Simulate bank API call
    
    bank_response = {
        "bank_reference": f"{request.bank_code}-{request.transaction_id[:8]}",
        "status": "success",
        "response_code": "00",
        "response_message": "Transaction successful"
    }
    
    logger.info(f"Bank payment processed: {bank_response['bank_reference']}")
    
    return bank_response

@activity.defn
async def update_transaction_status(
    transaction_id: str,
    status: str,
    bank_reference: Optional[str] = None,
    ledger_transaction_id: Optional[str] = None
) -> None:
    """
    Update transaction status in PostgreSQL
    """
    logger.info(f"Updating transaction status: {transaction_id} -> {status}")
    
    # In production, this would update PostgreSQL
    await asyncio.sleep(0.02)  # Simulate database operation
    
    logger.info(f"Transaction status updated successfully")

@activity.defn
async def send_notification(transaction_id: str, status: str, merchant_id: str) -> None:
    """
    Send notification to merchant about transaction status
    """
    logger.info(f"Sending notification for transaction {transaction_id} to merchant {merchant_id}")
    
    # In production, this would send via Kafka or webhook
    await asyncio.sleep(0.01)  # Simulate notification
    
    logger.info(f"Notification sent successfully")

@activity.defn
async def initiate_reconciliation(transaction_id: str, bank_code: str, amount: int) -> None:
    """
    Initiate reconciliation process for the transaction
    """
    logger.info(f"Initiating reconciliation for transaction {transaction_id}")
    
    # In production, this would publish to reconciliation topic
    await asyncio.sleep(0.01)  # Simulate reconciliation initiation
    
    logger.info(f"Reconciliation initiated successfully")

@activity.defn
async def handle_fraud_alert(request: POSPaymentRequest) -> None:
    """
    Handle fraud alert for high-risk transactions
    """
    logger.warning(f"Fraud alert triggered for transaction {request.transaction_id}")
    
    # In production, this would:
    # 1. Send alert to fraud monitoring system
    # 2. Create incident in OpenCTI
    # 3. Notify security team
    await asyncio.sleep(0.01)
    
    logger.info(f"Fraud alert handled")

@activity.defn
async def reverse_ledger_transaction(ledger_transaction_id: str) -> None:
    """
    Reverse a ledger transaction in case of failure
    """
    logger.info(f"Reversing ledger transaction: {ledger_transaction_id}")
    
    # In production, this would call TigerBeetle to reverse the transaction
    await asyncio.sleep(0.05)
    
    logger.info(f"Ledger transaction reversed successfully")

# Workflow definition

@workflow.defn
class POSPaymentWorkflow:
    """
    Workflow for processing POS payments
    """
    
    @workflow.run
    async def run(self, request: POSPaymentRequest) -> PaymentResult:
        """
        Execute the POS payment workflow
        """
        workflow.logger.info(f"Starting POS payment workflow for transaction {request.transaction_id}")
        
        # Retry policy for activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(seconds=10),
            maximum_attempts=3,
            backoff_coefficient=2.0
        )
        
        ledger_transaction_id: Optional[str] = None
        
        try:
            # Step 1: Validate fraud score
            is_valid = await workflow.execute_activity(
                validate_fraud_score,
                request,
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            if not is_valid:
                # Handle fraud alert
                await workflow.execute_activity(
                    handle_fraud_alert,
                    request,
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                # Update status
                await workflow.execute_activity(
                    update_transaction_status,
                    args=[request.transaction_id, "blocked", None, None],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                return PaymentResult(
                    transaction_id=request.transaction_id,
                    status="blocked",
                    error_message="Transaction blocked due to high fraud risk"
                )
            
            # Step 2: Create ledger transaction
            ledger_transaction_id = await workflow.execute_activity(
                create_ledger_transaction,
                request,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=retry_policy
            )
            
            # Step 3: Process bank payment
            bank_response = await workflow.execute_activity(
                process_bank_payment,
                request,
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=retry_policy
            )
            
            # Step 4: Update transaction status
            await workflow.execute_activity(
                update_transaction_status,
                args=[
                    request.transaction_id,
                    bank_response["status"],
                    bank_response["bank_reference"],
                    ledger_transaction_id
                ],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            # Step 5: Send notification to merchant
            await workflow.execute_activity(
                send_notification,
                args=[request.transaction_id, bank_response["status"], request.merchant_id],
                start_to_close_timeout=timedelta(seconds=10)
            )
            
            # Step 6: Initiate reconciliation
            await workflow.execute_activity(
                initiate_reconciliation,
                args=[request.transaction_id, request.bank_code, request.amount],
                start_to_close_timeout=timedelta(seconds=10)
            )
            
            workflow.logger.info(f"POS payment workflow completed successfully for {request.transaction_id}")
            
            return PaymentResult(
                transaction_id=request.transaction_id,
                status=bank_response["status"],
                bank_reference=bank_response["bank_reference"],
                ledger_transaction_id=ledger_transaction_id
            )
            
        except Exception as e:
            workflow.logger.error(f"POS payment workflow failed for {request.transaction_id}: {e}")
            
            # Compensating transaction: Reverse ledger transaction if created
            if ledger_transaction_id:
                try:
                    await workflow.execute_activity(
                        reverse_ledger_transaction,
                        ledger_transaction_id,
                        start_to_close_timeout=timedelta(seconds=30)
                    )
                except Exception as reverse_error:
                    workflow.logger.error(f"Failed to reverse ledger transaction: {reverse_error}")
            
            # Update status to failed
            await workflow.execute_activity(
                update_transaction_status,
                args=[request.transaction_id, "failed", None, ledger_transaction_id],
                start_to_close_timeout=timedelta(seconds=10)
            )
            
            return PaymentResult(
                transaction_id=request.transaction_id,
                status="failed",
                ledger_transaction_id=ledger_transaction_id,
                error_message=str(e)
            )

# Workflow for reconciliation

@workflow.defn
class ReconciliationWorkflow:
    """
    Workflow for daily reconciliation with banks
    """
    
    @workflow.run
    async def run(self, bank_code: str, date: str) -> dict:
        """
        Execute daily reconciliation for a specific bank
        """
        workflow.logger.info(f"Starting reconciliation workflow for {bank_code} on {date}")
        
        # In production, this would:
        # 1. Fetch all transactions for the bank on the given date
        # 2. Request reconciliation report from the bank
        # 3. Compare and identify discrepancies
        # 4. Generate reconciliation report
        # 5. Store results in Lakehouse
        
        return {
            "bank_code": bank_code,
            "date": date,
            "status": "completed",
            "total_transactions": 1000,
            "matched": 995,
            "unmatched": 5
        }
