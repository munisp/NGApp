"""
Optimized Payment Processing Workflow
Temporal workflow with full TigerBeetle and PostgreSQL integration for high-performance transaction processing.
"""

import asyncio
import logging
from datetime import timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError
import httpx

# Import custom modules
import sys
sys.path.append('/home/ubuntu/nextgen-payment-switch/services/common')
from tigerbeetle_client import (
    TigerBeetleClient, Account, Transfer, AccountFlags, TransferFlags,
    generate_account_id, generate_transfer_id, amount_to_cents, cents_to_amount
)
from database import (
    DatabaseManager, update_transaction_status, upsert_account_balance,
    lookup_party, create_quote, insert_fraud_check
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Workflow and Activity definitions
@dataclass
class PaymentData:
    """Payment transaction data"""
    transactionId: str
    source: Dict[str, str]
    destination: Dict[str, str]
    amount: Dict[str, str]
    transactionType: str
    channel: str
    timestamp: str
    metadata: Dict[str, Any]

@dataclass
class PartyInfo:
    """Party information from account lookup"""
    participantId: str
    accountId: str
    tigerbeetleAccountId: int
    name: str
    currency: str

@dataclass
class Quote:
    """Payment quote with fees"""
    quoteId: str
    transferAmount: str
    payeeReceiveAmount: str
    fees: str
    commission: str
    expiration: str

@dataclass
class TransferResult:
    """Result of transfer execution"""
    transferId: str
    status: str
    completedAt: str
    tigerbeetleTransferId: int
    amount: int

# Activities with full integration

@activity.defn(name="lookup_payer_optimized")
async def lookup_payer(party: Dict[str, str]) -> PartyInfo:
    """
    Look up payer information from PostgreSQL party registry.
    """
    try:
        logger.info(f"Looking up payer: {party}")
        
        # Initialize database manager
        db = DatabaseManager()
        await db.connect()
        
        try:
            # Look up party in PostgreSQL
            party_record = await lookup_party(
                db,
                party["type"],
                party["identifier"]
            )
            
            if not party_record:
                raise ApplicationError(
                    f"Payer {party['identifier']} not found",
                    non_retryable=True
                )
            
            # Generate TigerBeetle account ID
            tigerbeetle_account_id = generate_account_id(
                party_record["participant_id"],
                party_record["account_id"]
            )
            
            return PartyInfo(
                participantId=party_record["participant_id"],
                accountId=party_record["account_id"],
                tigerbeetleAccountId=tigerbeetle_account_id,
                name=party_record.get("display_name", "Unknown"),
                currency="USD"  # Should come from party record
            )
        finally:
            await db.close()
        
    except ApplicationError:
        raise
    except Exception as e:
        logger.error(f"Error looking up payer: {e}")
        raise ApplicationError(f"Failed to lookup payer: {str(e)}", non_retryable=True)

@activity.defn(name="lookup_payee_optimized")
async def lookup_payee(party: Dict[str, str]) -> PartyInfo:
    """
    Look up payee information from PostgreSQL party registry.
    """
    try:
        logger.info(f"Looking up payee: {party}")
        
        # Initialize database manager
        db = DatabaseManager()
        await db.connect()
        
        try:
            # Look up party in PostgreSQL
            party_record = await lookup_party(
                db,
                party["type"],
                party["identifier"]
            )
            
            if not party_record:
                raise ApplicationError(
                    f"Payee {party['identifier']} not found",
                    non_retryable=True
                )
            
            # Generate TigerBeetle account ID
            tigerbeetle_account_id = generate_account_id(
                party_record["participant_id"],
                party_record["account_id"]
            )
            
            return PartyInfo(
                participantId=party_record["participant_id"],
                accountId=party_record["account_id"],
                tigerbeetleAccountId=tigerbeetle_account_id,
                name=party_record.get("display_name", "Unknown"),
                currency="USD"
            )
        finally:
            await db.close()
        
    except ApplicationError:
        raise
    except Exception as e:
        logger.error(f"Error looking up payee: {e}")
        raise ApplicationError(f"Failed to lookup payee: {str(e)}", non_retryable=True)

@activity.defn(name="request_quote_optimized")
async def request_quote(payment_data: PaymentData, payer: PartyInfo, payee: PartyInfo) -> Quote:
    """
    Request a quote and store in PostgreSQL.
    """
    try:
        logger.info(f"Requesting quote for transaction {payment_data.transactionId}")
        
        from datetime import datetime, timedelta
        from decimal import Decimal
        
        # Calculate fees (simple 1% fee for demonstration)
        amount = Decimal(payment_data.amount["value"])
        fee = amount * Decimal("0.01")
        payee_receive = amount - fee
        
        quote_id = f"quote-{payment_data.transactionId}"
        
        # Store quote in PostgreSQL
        db = DatabaseManager()
        await db.connect()
        
        try:
            await create_quote(
                db,
                quote_id=quote_id,
                transaction_id=payment_data.transactionId,
                payer_participant_id=payer.participantId,
                payee_participant_id=payee.participantId,
                amount=payment_data.amount["value"],
                currency=payment_data.amount["currency"],
                payee_receive_amount=str(payee_receive),
                payee_fee_amount=str(fee),
                expiration=(datetime.utcnow() + timedelta(minutes=5)).isoformat()
            )
        finally:
            await db.close()
        
        return Quote(
            quoteId=quote_id,
            transferAmount=payment_data.amount["value"],
            payeeReceiveAmount=str(payee_receive),
            fees=str(fee),
            commission="0.00",
            expiration=(datetime.utcnow() + timedelta(minutes=5)).isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error requesting quote: {e}")
        raise ApplicationError(f"Failed to request quote: {str(e)}")

@activity.defn(name="check_fraud_optimized")
async def check_fraud(payment_data: PaymentData, payer: PartyInfo, payee: PartyInfo) -> Dict[str, Any]:
    """
    Perform fraud detection and store results in PostgreSQL.
    """
    try:
        logger.info(f"Checking fraud for transaction {payment_data.transactionId}")
        
        # Call fraud detection service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://fraud-detection.payment-switch:8001/check",
                json={
                    "transactionId": payment_data.transactionId,
                    "payer": {
                        "id": payer.accountId,
                        "participantId": payer.participantId
                    },
                    "payee": {
                        "id": payee.accountId,
                        "participantId": payee.participantId
                    },
                    "amount": payment_data.amount,
                    "channel": payment_data.channel,
                    "timestamp": payment_data.timestamp
                },
                timeout=5.0
            )
            response.raise_for_status()
            result = response.json()
        
        # Store fraud check result in PostgreSQL
        db = DatabaseManager()
        await db.connect()
        
        try:
            await insert_fraud_check(
                db,
                transaction_id=payment_data.transactionId,
                risk_score=result["riskScore"],
                risk_level=result["riskLevel"],
                blocked=result["blocked"],
                rules_triggered=result["rulesTriggered"],
                reasons=result["reasons"],
                ml_score=result.get("mlScore"),
                gnn_score=result.get("gnnScore")
            )
        finally:
            await db.close()
        
        if result["blocked"]:
            raise ApplicationError(
                f"Transaction blocked by fraud detection: {', '.join(result['reasons'])}",
                non_retryable=True
            )
        
        return result
        
    except httpx.TimeoutException:
        logger.warning("Fraud check timed out, proceeding with transaction")
        return {"riskScore": 0.0, "status": "TIMEOUT"}
    except ApplicationError:
        raise
    except Exception as e:
        logger.error(f"Error checking fraud: {e}")
        return {"riskScore": 0.0, "status": "ERROR"}

@activity.defn(name="execute_transfer_tigerbeetle")
async def execute_transfer(
    transfer_id: str,
    payer: PartyInfo,
    payee: PartyInfo,
    amount: Dict[str, str]
) -> TransferResult:
    """
    Execute the transfer in TigerBeetle ledger and sync to PostgreSQL.
    """
    try:
        logger.info(f"Executing transfer {transfer_id} in TigerBeetle")
        
        from datetime import datetime
        
        # Initialize TigerBeetle client
        tb_client = TigerBeetleClient()
        await tb_client.connect()
        
        try:
            # Generate transfer ID
            tb_transfer_id = generate_transfer_id(transfer_id)
            
            # Convert amount to cents
            amount_cents = amount_to_cents(amount["value"])
            
            # Create transfer in TigerBeetle
            transfers = [
                Transfer(
                    id=tb_transfer_id,
                    debit_account_id=payer.tigerbeetleAccountId,
                    credit_account_id=payee.tigerbeetleAccountId,
                    amount=amount_cents,
                    ledger=1,
                    code=1,
                    flags=TransferFlags.NONE
                )
            ]
            
            result = await tb_client.create_transfers(transfers)
            
            if result:
                raise ApplicationError(f"TigerBeetle transfer failed: {result}")
            
            # Get updated balances
            payer_balance = await tb_client.get_account_balance(payer.tigerbeetleAccountId)
            payee_balance = await tb_client.get_account_balance(payee.tigerbeetleAccountId)
            
            # Sync balances to PostgreSQL
            db = DatabaseManager()
            await db.connect()
            
            try:
                await upsert_account_balance(
                    db,
                    account_id=payer.accountId,
                    tigerbeetle_account_id=str(payer.tigerbeetleAccountId),
                    participant_id=payer.participantId,
                    currency=amount["currency"],
                    available_balance=cents_to_amount(payer_balance["available_balance"]),
                    pending_balance=cents_to_amount(payer_balance["pending_balance"])
                )
                
                await upsert_account_balance(
                    db,
                    account_id=payee.accountId,
                    tigerbeetle_account_id=str(payee.tigerbeetleAccountId),
                    participant_id=payee.participantId,
                    currency=amount["currency"],
                    available_balance=cents_to_amount(payee_balance["available_balance"]),
                    pending_balance=cents_to_amount(payee_balance["pending_balance"])
                )
            finally:
                await db.close()
            
            return TransferResult(
                transferId=transfer_id,
                status="COMMITTED",
                completedAt=datetime.utcnow().isoformat(),
                tigerbeetleTransferId=tb_transfer_id,
                amount=amount_cents
            )
        finally:
            await tb_client.close()
        
    except ApplicationError:
        raise
    except Exception as e:
        logger.error(f"Error executing transfer: {e}")
        raise ApplicationError(f"Failed to execute transfer: {str(e)}")

@activity.defn(name="update_transaction_status_db")
async def update_status_in_db(
    transaction_id: str,
    status: str,
    error_code: str = None,
    error_description: str = None
) -> None:
    """
    Update transaction status in PostgreSQL.
    """
    try:
        logger.info(f"Updating transaction {transaction_id} status to {status}")
        
        db = DatabaseManager()
        await db.connect()
        
        try:
            await update_transaction_status(
                db,
                transaction_id,
                status,
                error_code,
                error_description
            )
        finally:
            await db.close()
        
    except Exception as e:
        logger.error(f"Error updating transaction status: {e}")
        # Don't fail the workflow if status update fails

# Workflow Definition
@workflow.defn(name="PaymentProcessingWorkflowOptimized")
class PaymentProcessingWorkflowOptimized:
    """
    Optimized workflow for processing payments with full TigerBeetle and PostgreSQL integration.
    """
    
    def __init__(self):
        self.status = "PENDING"
        self.payment_data: Optional[PaymentData] = None
        self.payer: Optional[PartyInfo] = None
        self.payee: Optional[PartyInfo] = None
        self.quote: Optional[Quote] = None
        self.transfer_result: Optional[TransferResult] = None
        self.cancelled = False
    
    @workflow.run
    async def run(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Main workflow execution"""
        
        self.payment_data = PaymentData(**payment_data)
        
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(seconds=30),
            maximum_attempts=3,
            backoff_coefficient=2.0
        )
        
        try:
            self.status = "PROCESSING"
            
            # Update status in database
            await workflow.execute_activity(
                update_status_in_db,
                args=[self.payment_data.transactionId, "PROCESSING"],
                start_to_close_timeout=timedelta(seconds=5)
            )
            
            # Step 1: Lookup parties
            workflow.logger.info("Step 1: Looking up parties")
            self.payer, self.payee = await asyncio.gather(
                workflow.execute_activity(
                    lookup_payer,
                    self.payment_data.source,
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=retry_policy
                ),
                workflow.execute_activity(
                    lookup_payee,
                    self.payment_data.destination,
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=retry_policy
                )
            )
            
            if self.cancelled:
                raise ApplicationError("Payment cancelled by user")
            
            # Step 2: Request quote
            workflow.logger.info("Step 2: Requesting quote")
            self.quote = await workflow.execute_activity(
                request_quote,
                args=[self.payment_data, self.payer, self.payee],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            # Step 3: Fraud detection
            workflow.logger.info("Step 3: Checking for fraud")
            fraud_result = await workflow.execute_activity(
                check_fraud,
                args=[self.payment_data, self.payer, self.payee],
                start_to_close_timeout=timedelta(seconds=5),
                retry_policy=RetryPolicy(maximum_attempts=1)
            )
            
            if self.cancelled:
                raise ApplicationError("Payment cancelled by user")
            
            # Step 4: Execute transfer in TigerBeetle
            workflow.logger.info("Step 4: Executing transfer in TigerBeetle")
            self.transfer_result = await workflow.execute_activity(
                execute_transfer,
                args=[self.payment_data.transactionId, self.payer, self.payee, self.payment_data.amount],
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry_policy
            )
            
            self.status = "COMPLETED"
            
            # Step 5: Update final status
            workflow.logger.info("Step 5: Updating final status")
            await workflow.execute_activity(
                update_status_in_db,
                args=[self.payment_data.transactionId, "COMPLETED"],
                start_to_close_timeout=timedelta(seconds=5)
            )
            
            return {
                "transactionId": self.payment_data.transactionId,
                "status": self.status,
                "transferId": self.transfer_result.transferId,
                "completedAt": self.transfer_result.completedAt,
                "tigerbeetleTransferId": self.transfer_result.tigerbeetleTransferId
            }
            
        except ApplicationError as e:
            self.status = "FAILED"
            workflow.logger.error(f"Payment failed: {e}")
            
            # Update status in database
            await workflow.execute_activity(
                update_status_in_db,
                args=[self.payment_data.transactionId, "FAILED", "WORKFLOW_ERROR", str(e)],
                start_to_close_timeout=timedelta(seconds=5)
            )
            
            raise
    
    @workflow.signal
    async def cancel(self):
        """Signal handler for cancellation"""
        workflow.logger.info("Received cancellation signal")
        self.cancelled = True
        self.status = "CANCELLED"
    
    @workflow.query
    def getStatus(self) -> Dict[str, Any]:
        """Query handler for status"""
        return {
            "transactionId": self.payment_data.transactionId if self.payment_data else None,
            "status": self.status,
            "payer": self.payer.__dict__ if self.payer else None,
            "payee": self.payee.__dict__ if self.payee else None,
            "quote": self.quote.__dict__ if self.quote else None,
            "transferResult": self.transfer_result.__dict__ if self.transfer_result else None
        }
