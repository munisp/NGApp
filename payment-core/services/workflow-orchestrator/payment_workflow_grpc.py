"""
Optimized Payment Workflow with gRPC Integration
Uses high-performance Go services for ledger and party operations
"""

import asyncio
from datetime import timedelta
from typing import Dict, Any
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

# Import gRPC clients
from services.common.grpc_clients import (
    get_ledger_client,
    get_party_client,
    get_account_client
)


# Activity definitions
@activity.defn(name="validate_payment")
async def validate_payment_activity(payment_request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate payment request
    """
    # Basic validation
    required_fields = ["transaction_id", "payer", "payee", "amount", "currency"]
    for field in required_fields:
        if field not in payment_request:
            return {
                "valid": False,
                "error": f"Missing required field: {field}"
            }
    
    # Validate amount
    try:
        amount = float(payment_request["amount"])
        if amount <= 0:
            return {
                "valid": False,
                "error": "Amount must be greater than zero"
            }
    except ValueError:
        return {
            "valid": False,
            "error": "Invalid amount format"
        }
    
    return {
        "valid": True,
        "validated_amount": str(amount)
    }


@activity.defn(name="lookup_parties_grpc")
async def lookup_parties_activity(payer: Dict, payee: Dict) -> Dict[str, Any]:
    """
    Look up payer and payee information using gRPC Party Service
    """
    party_client = await get_party_client()
    
    try:
        # Lookup payer
        payer_response = await party_client.lookup_party(
            party_type=payer["id_type"],
            party_identifier=payer["id_value"]
        )
        
        if not payer_response["success"]:
            return {
                "success": False,
                "error": f"Payer not found: {payer['id_value']}"
            }
        
        # Lookup payee
        payee_response = await party_client.lookup_party(
            party_type=payee["id_type"],
            party_identifier=payee["id_value"]
        )
        
        if not payee_response["success"]:
            return {
                "success": False,
                "error": f"Payee not found: {payee['id_value']}"
            }
        
        return {
            "success": True,
            "payer_info": payer_response["party_info"],
            "payee_info": payee_response["party_info"]
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Party lookup failed: {str(e)}"
        }


@activity.defn(name="check_balance_grpc")
async def check_balance_activity(account_id: str, required_amount: str) -> Dict[str, Any]:
    """
    Check account balance using gRPC Ledger Service
    """
    ledger_client = await get_ledger_client()
    
    try:
        balance_response = await ledger_client.get_account_balance(account_id)
        
        if not balance_response["success"]:
            return {
                "sufficient": False,
                "error": "Failed to retrieve balance"
            }
        
        balance = balance_response["balance"]
        available_balance = float(balance["available_balance"])
        required = float(required_amount)
        
        return {
            "sufficient": available_balance >= required,
            "available_balance": balance["available_balance"],
            "required_amount": required_amount
        }
    except Exception as e:
        return {
            "sufficient": False,
            "error": f"Balance check failed: {str(e)}"
        }


@activity.defn(name="check_fraud")
async def check_fraud_activity(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check for fraud using the fraud detection service
    """
    # This would integrate with the fraud detection service
    # For now, return a simple check
    return {
        "blocked": False,
        "risk_score": 0.1,
        "risk_level": "LOW"
    }


@activity.defn(name="record_transaction_grpc")
async def record_transaction_activity(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record transaction in database using gRPC Account Service
    """
    account_client = await get_account_client()
    
    try:
        response = await account_client.record_transaction(
            transaction_id=transaction_data["transaction_id"],
            payer_id=transaction_data["payer_id"],
            payer_participant_id=transaction_data["payer_participant_id"],
            payee_id=transaction_data["payee_id"],
            payee_participant_id=transaction_data["payee_participant_id"],
            amount=transaction_data["amount"],
            currency=transaction_data["currency"],
            transaction_type=transaction_data.get("transaction_type", "TRANSFER"),
            channel=transaction_data.get("channel", "WEB"),
            status="PENDING",
            metadata=transaction_data.get("metadata", {})
        )
        
        return {
            "success": response["success"],
            "message": response["message"]
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to record transaction: {str(e)}"
        }


@activity.defn(name="execute_transfer_grpc")
async def execute_transfer_activity(transfer_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute transfer in TigerBeetle using gRPC Ledger Service
    """
    ledger_client = await get_ledger_client()
    
    try:
        response = await ledger_client.create_transfer(
            transfer_id=transfer_data["transfer_id"],
            transaction_id=transfer_data["transaction_id"],
            debit_account_id=transfer_data["debit_account_id"],
            credit_account_id=transfer_data["credit_account_id"],
            amount=transfer_data["amount"],
            currency=transfer_data["currency"],
            ledger=1,
            code=1,
            flags=0
        )
        
        if response["success"]:
            # Sync balances to PostgreSQL
            await ledger_client.sync_balance_to_postgres(
                account_id=transfer_data["debit_account_id"],
                participant_id=transfer_data["payer_participant_id"],
                currency=transfer_data["currency"]
            )
            await ledger_client.sync_balance_to_postgres(
                account_id=transfer_data["credit_account_id"],
                participant_id=transfer_data["payee_participant_id"],
                currency=transfer_data["currency"]
            )
        
        return {
            "success": response["success"],
            "tigerbeetle_transfer_id": response.get("tigerbeetle_transfer_id"),
            "completed_at": response.get("completed_at")
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Transfer execution failed: {str(e)}"
        }


@activity.defn(name="update_transaction_status_grpc")
async def update_transaction_status_activity(
    transaction_id: str,
    status: str,
    error_code: str = None,
    error_description: str = None
) -> Dict[str, Any]:
    """
    Update transaction status using gRPC Account Service
    """
    account_client = await get_account_client()
    
    try:
        response = await account_client.update_transaction_status(
            transaction_id=transaction_id,
            status=status,
            error_code=error_code,
            error_description=error_description
        )
        
        return {
            "success": response["success"],
            "message": response["message"]
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to update transaction status: {str(e)}"
        }


@activity.defn(name="send_notification")
async def send_notification_activity(notification_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send notification to parties
    """
    # This would integrate with a notification service
    return {
        "success": True,
        "message": "Notification sent"
    }


# Workflow definition
@workflow.defn(name="payment_processing_workflow_grpc")
class PaymentProcessingWorkflowGRPC:
    """
    Optimized payment processing workflow with gRPC integration
    """

    @workflow.run
    async def run(self, payment_request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the payment processing workflow
        
        Args:
            payment_request: Payment request data
            
        Returns:
            Payment result
        """
        transaction_id = payment_request["transaction_id"]
        
        # Retry policy for activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(seconds=30),
            maximum_attempts=3,
            backoff_coefficient=2.0
        )
        
        try:
            # Step 1: Validate payment request
            workflow.logger.info(f"Validating payment request {transaction_id}")
            validation_result = await workflow.execute_activity(
                validate_payment_activity,
                payment_request,
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "FAILED",
                    "error": validation_result["error"]
                }
            
            # Step 2: Lookup parties using gRPC
            workflow.logger.info(f"Looking up parties for transaction {transaction_id}")
            parties_result = await workflow.execute_activity(
                lookup_parties_activity,
                args=[payment_request["payer"], payment_request["payee"]],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            if not parties_result["success"]:
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "FAILED",
                    "error": parties_result["error"]
                }
            
            payer_info = parties_result["payer_info"]
            payee_info = parties_result["payee_info"]
            
            # Step 3: Check payer balance using gRPC
            workflow.logger.info(f"Checking balance for transaction {transaction_id}")
            balance_result = await workflow.execute_activity(
                check_balance_activity,
                args=[payer_info["account_id"], payment_request["amount"]],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            if not balance_result["sufficient"]:
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "FAILED",
                    "error": "Insufficient balance"
                }
            
            # Step 4: Fraud check
            workflow.logger.info(f"Checking fraud for transaction {transaction_id}")
            fraud_result = await workflow.execute_activity(
                check_fraud_activity,
                {
                    "transaction_id": transaction_id,
                    "payer_id": payer_info["participant_id"],
                    "payee_id": payee_info["participant_id"],
                    "amount": payment_request["amount"],
                    "currency": payment_request["currency"]
                },
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry_policy
            )
            
            if fraud_result["blocked"]:
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "BLOCKED",
                    "error": "Transaction blocked by fraud detection"
                }
            
            # Step 5: Record transaction using gRPC
            workflow.logger.info(f"Recording transaction {transaction_id}")
            record_result = await workflow.execute_activity(
                record_transaction_activity,
                {
                    "transaction_id": transaction_id,
                    "payer_id": payment_request["payer"]["id_value"],
                    "payer_participant_id": payer_info["participant_id"],
                    "payee_id": payment_request["payee"]["id_value"],
                    "payee_participant_id": payee_info["participant_id"],
                    "amount": payment_request["amount"],
                    "currency": payment_request["currency"],
                    "transaction_type": payment_request.get("transaction_type", "TRANSFER"),
                    "channel": payment_request.get("channel", "WEB"),
                    "metadata": payment_request.get("metadata", {})
                },
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy
            )
            
            if not record_result["success"]:
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "FAILED",
                    "error": record_result.get("error", "Failed to record transaction")
                }
            
            # Step 6: Execute transfer using gRPC
            workflow.logger.info(f"Executing transfer for transaction {transaction_id}")
            transfer_result = await workflow.execute_activity(
                execute_transfer_activity,
                {
                    "transfer_id": f"TXF-{transaction_id}",
                    "transaction_id": transaction_id,
                    "debit_account_id": payer_info["account_id"],
                    "credit_account_id": payee_info["account_id"],
                    "amount": payment_request["amount"],
                    "currency": payment_request["currency"],
                    "payer_participant_id": payer_info["participant_id"],
                    "payee_participant_id": payee_info["participant_id"]
                },
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=retry_policy
            )
            
            if not transfer_result["success"]:
                # Update transaction status to FAILED
                await workflow.execute_activity(
                    update_transaction_status_activity,
                    args=[transaction_id, "FAILED", "TRANSFER_FAILED", transfer_result.get("error")],
                    start_to_close_timeout=timedelta(seconds=10)
                )
                
                return {
                    "success": False,
                    "transaction_id": transaction_id,
                    "status": "FAILED",
                    "error": transfer_result.get("error", "Transfer failed")
                }
            
            # Step 7: Update transaction status to COMPLETED
            workflow.logger.info(f"Updating transaction status for {transaction_id}")
            await workflow.execute_activity(
                update_transaction_status_activity,
                args=[transaction_id, "COMPLETED", None, None],
                start_to_close_timeout=timedelta(seconds=10)
            )
            
            # Step 8: Send notifications
            workflow.logger.info(f"Sending notifications for transaction {transaction_id}")
            await workflow.execute_activity(
                send_notification_activity,
                {
                    "transaction_id": transaction_id,
                    "payer": payer_info,
                    "payee": payee_info,
                    "amount": payment_request["amount"],
                    "currency": payment_request["currency"],
                    "status": "COMPLETED"
                },
                start_to_close_timeout=timedelta(seconds=10)
            )
            
            return {
                "success": True,
                "transaction_id": transaction_id,
                "status": "COMPLETED",
                "tigerbeetle_transfer_id": transfer_result["tigerbeetle_transfer_id"],
                "completed_at": transfer_result["completed_at"],
                "payer": payer_info,
                "payee": payee_info,
                "amount": payment_request["amount"],
                "currency": payment_request["currency"]
            }
            
        except Exception as e:
            workflow.logger.error(f"Workflow error for transaction {transaction_id}: {str(e)}")
            
            # Update transaction status to FAILED
            try:
                await workflow.execute_activity(
                    update_transaction_status_activity,
                    args=[transaction_id, "FAILED", "WORKFLOW_ERROR", str(e)],
                    start_to_close_timeout=timedelta(seconds=10)
                )
            except Exception:
                pass
            
            return {
                "success": False,
                "transaction_id": transaction_id,
                "status": "FAILED",
                "error": str(e)
            }
