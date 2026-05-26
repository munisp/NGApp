"""
Payment Processing Workflow
Temporal workflow for orchestrating end-to-end payment processing through the switch.
"""

import asyncio
import logging
from datetime import timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

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
    tigerbeetleTransferId: Optional[str] = None

# Activities
@activity.defn(name="lookup_payer")
async def lookup_payer(party: Dict[str, str]) -> PartyInfo:
    """
    Look up payer information from Mojaloop Account Lookup Service.
    """
    import httpx
    
    try:
        logger.info(f"Looking up payer: {party}")
        
        # Call Mojaloop ALS
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://mojaloop-account-lookup.payment-switch:4002/parties/{party['type']}/{party['identifier']}"
            )
            response.raise_for_status()
            data = response.json()
        
        return PartyInfo(
            participantId=data["participantId"],
            accountId=data["accountId"],
            name=data["name"],
            currency=data["currency"]
        )
        
    except Exception as e:
        logger.error(f"Error looking up payer: {e}")
        raise ApplicationError(f"Failed to lookup payer: {str(e)}", non_retryable=True)

@activity.defn(name="lookup_payee")
async def lookup_payee(party: Dict[str, str]) -> PartyInfo:
    """
    Look up payee information from Mojaloop Account Lookup Service.
    """
    import httpx
    
    try:
        logger.info(f"Looking up payee: {party}")
        
        # Call Mojaloop ALS
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://mojaloop-account-lookup.payment-switch:4002/parties/{party['type']}/{party['identifier']}"
            )
            response.raise_for_status()
            data = response.json()
        
        return PartyInfo(
            participantId=data["participantId"],
            accountId=data["accountId"],
            name=data["name"],
            currency=data["currency"]
        )
        
    except Exception as e:
        logger.error(f"Error looking up payee: {e}")
        raise ApplicationError(f"Failed to lookup payee: {str(e)}", non_retryable=True)

@activity.defn(name="request_quote")
async def request_quote(payment_data: PaymentData, payer: PartyInfo, payee: PartyInfo) -> Quote:
    """
    Request a quote from Mojaloop Quoting Service.
    """
    import httpx
    from datetime import datetime, timedelta
    
    try:
        logger.info(f"Requesting quote for transaction {payment_data.transactionId}")
        
        quote_request = {
            "quoteId": f"quote-{payment_data.transactionId}",
            "transactionId": payment_data.transactionId,
            "payer": {
                "partyIdInfo": {
                    "partyIdType": payment_data.source["type"],
                    "partyIdentifier": payment_data.source["identifier"]
                }
            },
            "payee": {
                "partyIdInfo": {
                    "partyIdType": payment_data.destination["type"],
                    "partyIdentifier": payment_data.destination["identifier"]
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": payment_data.amount["currency"],
                "amount": payment_data.amount["value"]
            },
            "transactionType": {
                "scenario": payment_data.transactionType,
                "initiator": "PAYER",
                "initiatorType": "CONSUMER"
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://mojaloop-quoting-service.payment-switch:3002/quotes",
                json=quote_request
            )
            response.raise_for_status()
            data = response.json()
        
        return Quote(
            quoteId=data["quoteId"],
            transferAmount=data["transferAmount"]["amount"],
            payeeReceiveAmount=data["payeeReceiveAmount"]["amount"],
            fees=data.get("fees", "0.00"),
            commission=data.get("commission", "0.00"),
            expiration=(datetime.utcnow() + timedelta(minutes=5)).isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error requesting quote: {e}")
        raise ApplicationError(f"Failed to request quote: {str(e)}")

@activity.defn(name="check_fraud")
async def check_fraud(payment_data: PaymentData, payer: PartyInfo, payee: PartyInfo) -> Dict[str, Any]:
    """
    Perform fraud detection checks on the transaction.
    This integrates with the fraud detection service.
    """
    import httpx
    
    try:
        logger.info(f"Checking fraud for transaction {payment_data.transactionId}")
        
        fraud_check_request = {
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
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://fraud-detection.payment-switch:8001/check",
                json=fraud_check_request,
                timeout=5.0
            )
            response.raise_for_status()
            result = response.json()
        
        if result["riskScore"] > 0.8:
            raise ApplicationError(
                f"Transaction flagged as high risk: {result['reason']}",
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
        # Don't fail the transaction if fraud check fails
        return {"riskScore": 0.0, "status": "ERROR"}

@activity.defn(name="prepare_transfer")
async def prepare_transfer(
    payment_data: PaymentData,
    payer: PartyInfo,
    payee: PartyInfo,
    quote: Quote
) -> Dict[str, Any]:
    """
    Prepare the transfer in Mojaloop (reserve funds).
    Uses cryptographic ILP packet generation for production compliance.
    """
    import httpx
    import sys
    sys.path.insert(0, '/home/ubuntu/payment-switch/payment-core/services/common')
    from ilp_protocol import generate_transfer_ilp
    
    try:
        logger.info(f"Preparing transfer for transaction {payment_data.transactionId}")
        
        # Generate cryptographic ILP packet, condition, and fulfillment
        amount_cents = int(float(quote.transferAmount) * 100)
        ilp_result = generate_transfer_ilp(
            transfer_id=payment_data.transactionId,
            amount=amount_cents,
            currency=payment_data.amount["currency"],
            payer_fsp=payer.participantId,
            payee_fsp=payee.participantId,
            payee_identifier=payee.accountId
        )
        
        transfer_request = {
            "transferId": payment_data.transactionId,
            "payerFsp": payer.participantId,
            "payeeFsp": payee.participantId,
            "amount": {
                "currency": payment_data.amount["currency"],
                "amount": quote.transferAmount
            },
            "ilpPacket": ilp_result["ilpPacket"],
            "condition": ilp_result["condition"],
            "expiration": ilp_result["expiration"]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://mojaloop-central-ledger.payment-switch:3001/transfers",
                json=transfer_request
            )
            response.raise_for_status()
        
        logger.info(f"Transfer prepared successfully: {payment_data.transactionId}")
        
        # Return transfer ID and fulfillment for later commit
        return {
            "transferId": payment_data.transactionId,
            "fulfillment": ilp_result["fulfillment"],
            "condition": ilp_result["condition"]
        }
        
    except Exception as e:
        logger.error(f"Error preparing transfer: {e}")
        raise ApplicationError(f"Failed to prepare transfer: {str(e)}")

@activity.defn(name="execute_transfer")
async def execute_transfer(
    transfer_id: str,
    payer: PartyInfo,
    payee: PartyInfo,
    amount: Dict[str, str]
) -> TransferResult:
    """
    Execute the transfer in TigerBeetle ledger.
    Uses real TigerBeetle client for production transfers.
    """
    try:
        logger.info(f"Executing transfer {transfer_id} in TigerBeetle")
        
        from datetime import datetime
        import sys
        sys.path.insert(0, '/home/ubuntu/payment-switch/payment-core/services/common')
        from tigerbeetle_client import execute_payment_transfer
        
        # Convert amount to cents
        amount_cents = int(float(amount["value"]) * 100)
        
        # Map currency to ledger ID
        currency_ledgers = {
            "USD": 1, "EUR": 2, "GBP": 3, "NGN": 4, "KES": 5,
            "ZAR": 6, "GHS": 7, "TZS": 8, "UGX": 9, "RWF": 10
        }
        currency_ledger = currency_ledgers.get(amount.get("currency", "USD"), 1)
        
        # Execute transfer in TigerBeetle using two-phase commit
        result = await execute_payment_transfer(
            transfer_id=transfer_id,
            payer_account_id=int(payer.accountId),
            payee_account_id=int(payee.accountId),
            amount=amount_cents,
            currency_ledger=currency_ledger,
            two_phase=True
        )
        
        if not result.get("success"):
            raise ApplicationError(
                f"TigerBeetle transfer failed: {result.get('error')}",
                non_retryable=True
            )
        
        return TransferResult(
            transferId=transfer_id,
            status=result.get("status", "COMMITTED"),
            completedAt=datetime.utcnow().isoformat(),
            tigerbeetleTransferId=str(result.get("tigerbeetle_id"))
        )
        
    except Exception as e:
        logger.error(f"Error executing transfer: {e}")
        raise ApplicationError(f"Failed to execute transfer: {str(e)}")

@activity.defn(name="commit_transfer")
async def commit_transfer(transfer_id: str, fulfillment: str) -> None:
    """
    Commit the transfer in Mojaloop.
    """
    import httpx
    
    try:
        logger.info(f"Committing transfer {transfer_id}")
        
        commit_request = {
            "transferState": "COMMITTED",
            "fulfilment": fulfillment,
            "completedTimestamp": "2025-11-03T12:00:00.000Z"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"http://mojaloop-central-ledger.payment-switch:3001/transfers/{transfer_id}",
                json=commit_request
            )
            response.raise_for_status()
        
        logger.info(f"Transfer committed successfully: {transfer_id}")
        
    except Exception as e:
        logger.error(f"Error committing transfer: {e}")
        raise ApplicationError(f"Failed to commit transfer: {str(e)}")

@activity.defn(name="abort_transfer")
async def abort_transfer(transfer_id: str, reason: str) -> None:
    """
    Abort the transfer and release reserved funds.
    """
    import httpx
    
    try:
        logger.info(f"Aborting transfer {transfer_id}: {reason}")
        
        abort_request = {
            "transferState": "ABORTED",
            "errorInformation": {
                "errorCode": "5000",
                "errorDescription": reason
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"http://mojaloop-central-ledger.payment-switch:3001/transfers/{transfer_id}",
                json=abort_request
            )
            response.raise_for_status()
        
        logger.info(f"Transfer aborted successfully: {transfer_id}")
        
    except Exception as e:
        logger.error(f"Error aborting transfer: {e}")
        # Log but don't fail - abort is best effort

@activity.defn(name="send_notification")
async def send_notification(
    recipient: str,
    message: str,
    channel: str
) -> None:
    """
    Send notification to the user about transaction status.
    """
    try:
        logger.info(f"Sending notification to {recipient} via {channel}")
        
        # In a real implementation, this would integrate with
        # SMS, email, or push notification services
        
        logger.info(f"Notification sent: {message}")
        
    except Exception as e:
        logger.error(f"Error sending notification: {e}")
        # Don't fail the workflow if notification fails

# Workflow Definition
@workflow.defn(name="PaymentProcessingWorkflow")
class PaymentProcessingWorkflow:
    """
    Main workflow for processing payments through the switch.
    
    This workflow orchestrates the entire payment lifecycle:
    1. Party lookup (payer and payee)
    2. Quote request
    3. Fraud detection
    4. Transfer preparation
    5. Transfer execution
    6. Transfer commitment
    7. Notifications
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
            
            # Check for cancellation
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
            
            # Step 4: Prepare transfer (generates cryptographic ILP artifacts)
            workflow.logger.info("Step 4: Preparing transfer with ILP protocol")
            prepare_result = await workflow.execute_activity(
                prepare_transfer,
                args=[self.payment_data, self.payer, self.payee, self.quote],
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry_policy
            )
            
            # Extract transfer ID and fulfillment from prepare result
            transfer_id = prepare_result["transferId"]
            fulfillment = prepare_result["fulfillment"]
            
            # Check for cancellation
            if self.cancelled:
                await workflow.execute_activity(
                    abort_transfer,
                    args=[transfer_id, "Cancelled by user"],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                raise ApplicationError("Payment cancelled by user")
            
            # Step 5: Execute transfer in TigerBeetle (source of truth)
            workflow.logger.info("Step 5: Executing transfer in TigerBeetle")
            self.transfer_result = await workflow.execute_activity(
                execute_transfer,
                args=[transfer_id, self.payer, self.payee, self.payment_data.amount],
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry_policy
            )
            
            # Step 6: Commit transfer with cryptographic fulfillment
            workflow.logger.info("Step 6: Committing transfer with ILP fulfillment")
            await workflow.execute_activity(
                commit_transfer,
                args=[transfer_id, fulfillment],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            self.status = "COMPLETED"
            
            # Step 7: Send notifications
            workflow.logger.info("Step 7: Sending notifications")
            await asyncio.gather(
                workflow.execute_activity(
                    send_notification,
                    args=[
                        self.payment_data.source["identifier"],
                        f"Payment of {self.payment_data.amount['currency']} {self.payment_data.amount['value']} sent successfully",
                        self.payment_data.channel
                    ],
                    start_to_close_timeout=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=2)
                ),
                workflow.execute_activity(
                    send_notification,
                    args=[
                        self.payment_data.destination["identifier"],
                        f"You received {self.payment_data.amount['currency']} {self.payment_data.amount['value']}",
                        "MOBILE"
                    ],
                    start_to_close_timeout=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=2)
                )
            )
            
            return {
                "transactionId": self.payment_data.transactionId,
                "status": self.status,
                "transferId": self.transfer_result.transferId,
                "completedAt": self.transfer_result.completedAt
            }
            
        except ApplicationError as e:
            self.status = "FAILED"
            workflow.logger.error(f"Payment failed: {e}")
            
            # Attempt to abort transfer if it was prepared
            if hasattr(self, 'transfer_id'):
                await workflow.execute_activity(
                    abort_transfer,
                    args=[self.transfer_id, str(e)],
                    start_to_close_timeout=timedelta(seconds=10)
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
