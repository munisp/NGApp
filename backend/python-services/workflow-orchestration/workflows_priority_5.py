"""
Top 5 Priority Workflow Implementations
Based on prioritization analysis - highest business impact workflows
"""

from temporalio import workflow
from temporalio.common import RetryPolicy
from datetime import timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum

# ============================================================================
# Additional Data Classes for Priority Workflows
# ============================================================================

@dataclass
class P2PTransferInput:
    """Input for P2P transfer workflow"""
    transaction_id: str
    sender_id: str
    recipient_id: str
    amount: float
    currency: str = "NGN"
    note: Optional[str] = None
    agent_id: Optional[str] = None

@dataclass
class BillPaymentInput:
    """Input for bill payment workflow"""
    transaction_id: str
    customer_id: str
    agent_id: str
    biller_id: str
    biller_name: str
    account_number: str
    amount: float
    currency: str = "NGN"
    bill_type: str  # electricity, water, internet, cable_tv, etc.

@dataclass
class AirtimeDataInput:
    """Input for airtime/data purchase workflow"""
    transaction_id: str
    customer_id: str
    agent_id: str
    telco_provider: str  # MTN, Airtel, Glo, 9mobile
    phone_number: str
    product_type: str  # airtime, data
    product_id: Optional[str] = None  # For data bundles
    amount: float
    currency: str = "NGN"

@dataclass
class FloatManagementInput:
    """Input for float management workflow"""
    operation_id: str
    agent_id: str
    operation_type: str  # rebalance, deposit, withdrawal, transfer
    amount: float
    currency: str = "NGN"
    source_agent_id: Optional[str] = None  # For transfers
    target_agent_id: Optional[str] = None  # For transfers
    reason: Optional[str] = None

@dataclass
class SavingsAccountInput:
    """Input for savings account workflow"""
    account_id: str
    customer_id: str
    operation_type: str  # open, deposit, withdraw, close
    amount: Optional[float] = None
    account_type: str = "regular"  # regular, fixed, target
    interest_rate: Optional[float] = None
    term_months: Optional[int] = None
    target_amount: Optional[float] = None
    withdrawal_frequency: Optional[str] = None

# ============================================================================
# PRIORITY 1: P2P Transfer Workflow (Score: 8.25)
# User Story 4: P2P Money Transfer
# ============================================================================

@workflow.defn
class P2PTransferWorkflow:
    """
    Workflow for peer-to-peer money transfers
    Priority: #3 | Score: 8.25
    Estimate: 2-3 days
    
    Steps:
    1. Validate sender account and balance
    2. Validate recipient account
    3. Check transaction limits
    4. Fraud detection check
    5. Request sender PIN authorization
    6. Process transfer in ledger
    7. Calculate and credit agent commission (if applicable)
    8. Generate receipt
    9. Send notifications to both parties
    10. Update analytics
    """
    
    @workflow.run
    async def run(self, input: P2PTransferInput) -> Dict[str, Any]:
        """Execute P2P transfer workflow"""
        
        # Step 1: Validate sender account and balance
        sender_validation = await workflow.execute_activity(
            validate_sender_account,
            {
                "customer_id": input.sender_id,
                "amount": input.amount,
                "currency": input.currency
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not sender_validation["valid"]:
            return {
                "status": "failed",
                "reason": sender_validation.get("reason", "Sender validation failed")
            }
        
        # Step 2: Validate recipient account
        recipient_validation = await workflow.execute_activity(
            validate_recipient_account,
            {"customer_id": input.recipient_id},
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not recipient_validation["valid"]:
            return {
                "status": "failed",
                "reason": recipient_validation.get("reason", "Recipient validation failed")
            }
        
        # Step 3: Check transaction limits
        limits_check = await workflow.execute_activity(
            check_p2p_transaction_limits,
            {
                "customer_id": input.sender_id,
                "amount": input.amount,
                "currency": input.currency
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not limits_check["within_limits"]:
            return {
                "status": "failed",
                "reason": "Transaction exceeds limits"
            }
        
        # Step 4: Fraud detection check
        fraud_check = await workflow.execute_activity(
            check_p2p_fraud,
            {
                "transaction_id": input.transaction_id,
                "sender_id": input.sender_id,
                "recipient_id": input.recipient_id,
                "amount": input.amount
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if fraud_check["is_fraudulent"]:
            return {
                "status": "blocked",
                "reason": "Transaction flagged as potentially fraudulent"
            }
        
        # Step 5: Request sender PIN authorization
        pin_verification = await workflow.execute_activity(
            verify_sender_pin,
            {
                "customer_id": input.sender_id,
                "transaction_id": input.transaction_id
            },
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=1)
        )
        
        if not pin_verification["verified"]:
            return {
                "status": "failed",
                "reason": "PIN verification failed"
            }
        
        # Step 6: Process transfer in ledger
        ledger_result = await workflow.execute_activity(
            process_p2p_ledger_transaction,
            {
                "transaction_id": input.transaction_id,
                "sender_id": input.sender_id,
                "recipient_id": input.recipient_id,
                "amount": input.amount,
                "currency": input.currency,
                "note": input.note
            },
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=1)
            )
        )
        
        if not ledger_result["success"]:
            return {
                "status": "failed",
                "reason": "Ledger transaction failed"
            }
        
        # Step 7: Calculate and credit agent commission (if applicable)
        if input.agent_id:
            commission_result = await workflow.execute_activity(
                calculate_p2p_commission,
                {
                    "transaction_id": input.transaction_id,
                    "agent_id": input.agent_id,
                    "amount": input.amount
                },
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
        
        # Step 8: Generate receipt
        receipt = await workflow.execute_activity(
            generate_p2p_receipt,
            {
                "transaction_id": input.transaction_id,
                "sender_id": input.sender_id,
                "recipient_id": input.recipient_id,
                "amount": input.amount,
                "ledger_id": ledger_result["ledger_id"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Step 9: Send notifications
        await workflow.execute_activity(
            send_p2p_notifications,
            {
                "transaction_id": input.transaction_id,
                "sender_id": input.sender_id,
                "recipient_id": input.recipient_id,
                "amount": input.amount,
                "receipt_url": receipt["receipt_url"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 10: Update analytics
        await workflow.execute_activity(
            update_p2p_analytics,
            {
                "transaction_id": input.transaction_id,
                "sender_id": input.sender_id,
                "recipient_id": input.recipient_id,
                "amount": input.amount,
                "agent_id": input.agent_id
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        return {
            "status": "completed",
            "transaction_id": input.transaction_id,
            "ledger_id": ledger_result["ledger_id"],
            "receipt_url": receipt["receipt_url"],
            "amount": input.amount,
            "sender_id": input.sender_id,
            "recipient_id": input.recipient_id
        }

# ============================================================================
# PRIORITY 2: Bill Payment Workflow (Score: 8.45)
# User Story 5: Bill Payment Services
# ============================================================================

@workflow.defn
class BillPaymentWorkflow:
    """
    Workflow for utility bill payments
    Priority: #1 | Score: 8.45
    Estimate: 3-4 days
    
    Steps:
    1. Validate customer account and balance
    2. Validate biller and account number
    3. Fetch bill details from biller
    4. Check transaction limits
    5. Fraud detection check
    6. Request customer PIN authorization
    7. Process payment in ledger
    8. Submit payment to biller
    9. Receive payment confirmation
    10. Calculate and credit agent commission
    11. Generate receipt
    12. Send notifications
    13. Update analytics
    """
    
    @workflow.run
    async def run(self, input: BillPaymentInput) -> Dict[str, Any]:
        """Execute bill payment workflow"""
        
        # Step 1: Validate customer account and balance
        customer_validation = await workflow.execute_activity(
            validate_customer_account,
            {
                "customer_id": input.customer_id,
                "amount": input.amount,
                "currency": input.currency
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not customer_validation["valid"]:
            return {
                "status": "failed",
                "reason": customer_validation.get("reason", "Customer validation failed")
            }
        
        # Step 2: Validate biller and account number
        biller_validation = await workflow.execute_activity(
            validate_biller_account,
            {
                "biller_id": input.biller_id,
                "account_number": input.account_number,
                "bill_type": input.bill_type
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not biller_validation["valid"]:
            return {
                "status": "failed",
                "reason": biller_validation.get("reason", "Biller validation failed")
            }
        
        # Step 3: Fetch bill details from biller
        bill_details = await workflow.execute_activity(
            fetch_bill_details,
            {
                "biller_id": input.biller_id,
                "account_number": input.account_number,
                "bill_type": input.bill_type
            },
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Verify amount matches bill
        if bill_details.get("amount_due") and abs(bill_details["amount_due"] - input.amount) > 0.01:
            return {
                "status": "failed",
                "reason": f"Amount mismatch. Bill amount: {bill_details['amount_due']}"
            }
        
        # Step 4: Check transaction limits
        limits_check = await workflow.execute_activity(
            check_transaction_limits,
            {
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "bill_payment"
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not limits_check["within_limits"]:
            return {
                "status": "failed",
                "reason": "Transaction exceeds limits"
            }
        
        # Step 5: Fraud detection check
        fraud_check = await workflow.execute_activity(
            check_fraud,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "bill_payment",
                "biller_id": input.biller_id
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if fraud_check["is_fraudulent"]:
            return {
                "status": "blocked",
                "reason": "Transaction flagged as potentially fraudulent"
            }
        
        # Step 6: Request customer PIN authorization
        pin_verification = await workflow.execute_activity(
            verify_customer_pin,
            {
                "customer_id": input.customer_id,
                "transaction_id": input.transaction_id
            },
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=1)
        )
        
        if not pin_verification["verified"]:
            return {
                "status": "failed",
                "reason": "PIN verification failed"
            }
        
        # Step 7: Process payment in ledger
        ledger_result = await workflow.execute_activity(
            process_ledger_transaction,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "bill_payment",
                "metadata": {
                    "biller_id": input.biller_id,
                    "account_number": input.account_number,
                    "bill_type": input.bill_type
                }
            },
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=1)
            )
        )
        
        if not ledger_result["success"]:
            return {
                "status": "failed",
                "reason": "Ledger transaction failed"
            }
        
        # Step 8: Submit payment to biller
        biller_submission = await workflow.execute_activity(
            submit_bill_payment,
            {
                "transaction_id": input.transaction_id,
                "biller_id": input.biller_id,
                "account_number": input.account_number,
                "amount": input.amount,
                "bill_type": input.bill_type
            },
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=5)
            )
        )
        
        # Step 9: Receive payment confirmation
        if not biller_submission["success"]:
            # Initiate refund workflow
            await workflow.execute_activity(
                initiate_refund,
                {
                    "transaction_id": input.transaction_id,
                    "ledger_id": ledger_result["ledger_id"],
                    "reason": "Biller payment failed"
                },
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
            
            return {
                "status": "failed",
                "reason": "Biller payment failed, refund initiated"
            }
        
        # Step 10: Calculate and credit agent commission
        commission_result = await workflow.execute_activity(
            calculate_and_credit_commission,
            {
                "transaction_id": input.transaction_id,
                "agent_id": input.agent_id,
                "amount": input.amount,
                "transaction_type": "bill_payment"
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 11: Generate receipt
        receipt = await workflow.execute_activity(
            generate_receipt,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "bill_payment",
                "biller_name": input.biller_name,
                "account_number": input.account_number,
                "ledger_id": ledger_result["ledger_id"],
                "biller_reference": biller_submission["reference"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Step 12: Send notifications
        await workflow.execute_activity(
            send_transaction_notifications,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "agent_id": input.agent_id,
                "transaction_type": "bill_payment",
                "amount": input.amount,
                "receipt_url": receipt["receipt_url"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 13: Update analytics
        await workflow.execute_activity(
            update_transaction_analytics,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "agent_id": input.agent_id,
                "transaction_type": "bill_payment",
                "amount": input.amount,
                "biller_id": input.biller_id
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        return {
            "status": "completed",
            "transaction_id": input.transaction_id,
            "ledger_id": ledger_result["ledger_id"],
            "biller_reference": biller_submission["reference"],
            "receipt_url": receipt["receipt_url"],
            "commission": commission_result.get("commission_amount", 0),
            "amount": input.amount
        }

# ============================================================================
# PRIORITY 3: Airtime & Data Purchase Workflow (Score: 8.35)
# User Story 6: Airtime & Data Top-Up
# ============================================================================

@workflow.defn
class AirtimeDataPurchaseWorkflow:
    """
    Workflow for airtime and data bundle purchases
    Priority: #2 | Score: 8.35
    Estimate: 2-3 days
    
    Steps:
    1. Validate customer account and balance
    2. Validate telco provider and phone number
    3. Fetch available products (for data)
    4. Check transaction limits
    5. Fraud detection check
    6. Request customer PIN authorization
    7. Process payment in ledger
    8. Submit purchase to telco provider
    9. Receive confirmation and voucher code
    10. Calculate and credit agent commission
    11. Generate receipt
    12. Send notifications with voucher details
    13. Update analytics
    """
    
    @workflow.run
    async def run(self, input: AirtimeDataInput) -> Dict[str, Any]:
        """Execute airtime/data purchase workflow"""
        
        # Step 1: Validate customer account and balance
        customer_validation = await workflow.execute_activity(
            validate_customer_account,
            {
                "customer_id": input.customer_id,
                "amount": input.amount,
                "currency": input.currency
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not customer_validation["valid"]:
            return {
                "status": "failed",
                "reason": customer_validation.get("reason", "Customer validation failed")
            }
        
        # Step 2: Validate telco provider and phone number
        telco_validation = await workflow.execute_activity(
            validate_telco_phone,
            {
                "telco_provider": input.telco_provider,
                "phone_number": input.phone_number
            },
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not telco_validation["valid"]:
            return {
                "status": "failed",
                "reason": telco_validation.get("reason", "Phone number validation failed")
            }
        
        # Step 3: Fetch available products (for data bundles)
        if input.product_type == "data" and input.product_id:
            product_details = await workflow.execute_activity(
                fetch_data_product_details,
                {
                    "telco_provider": input.telco_provider,
                    "product_id": input.product_id
                },
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
            
            # Verify amount matches product price
            if abs(product_details["price"] - input.amount) > 0.01:
                return {
                    "status": "failed",
                    "reason": f"Amount mismatch. Product price: {product_details['price']}"
                }
        
        # Step 4: Check transaction limits
        limits_check = await workflow.execute_activity(
            check_transaction_limits,
            {
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "airtime_data"
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not limits_check["within_limits"]:
            return {
                "status": "failed",
                "reason": "Transaction exceeds limits"
            }
        
        # Step 5: Fraud detection check
        fraud_check = await workflow.execute_activity(
            check_fraud,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "airtime_data",
                "phone_number": input.phone_number
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if fraud_check["is_fraudulent"]:
            return {
                "status": "blocked",
                "reason": "Transaction flagged as potentially fraudulent"
            }
        
        # Step 6: Request customer PIN authorization
        pin_verification = await workflow.execute_activity(
            verify_customer_pin,
            {
                "customer_id": input.customer_id,
                "transaction_id": input.transaction_id
            },
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=1)
        )
        
        if not pin_verification["verified"]:
            return {
                "status": "failed",
                "reason": "PIN verification failed"
            }
        
        # Step 7: Process payment in ledger
        ledger_result = await workflow.execute_activity(
            process_ledger_transaction,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "airtime_data",
                "metadata": {
                    "telco_provider": input.telco_provider,
                    "phone_number": input.phone_number,
                    "product_type": input.product_type,
                    "product_id": input.product_id
                }
            },
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=1)
            )
        )
        
        if not ledger_result["success"]:
            return {
                "status": "failed",
                "reason": "Ledger transaction failed"
            }
        
        # Step 8: Submit purchase to telco provider
        telco_purchase = await workflow.execute_activity(
            submit_telco_purchase,
            {
                "transaction_id": input.transaction_id,
                "telco_provider": input.telco_provider,
                "phone_number": input.phone_number,
                "product_type": input.product_type,
                "product_id": input.product_id,
                "amount": input.amount
            },
            start_to_close_timeout=timedelta(minutes=3),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=5)
            )
        )
        
        # Step 9: Handle telco response
        if not telco_purchase["success"]:
            # Initiate refund
            await workflow.execute_activity(
                initiate_refund,
                {
                    "transaction_id": input.transaction_id,
                    "ledger_id": ledger_result["ledger_id"],
                    "reason": "Telco purchase failed"
                },
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
            
            return {
                "status": "failed",
                "reason": "Telco purchase failed, refund initiated"
            }
        
        # Step 10: Calculate and credit agent commission
        commission_result = await workflow.execute_activity(
            calculate_and_credit_commission,
            {
                "transaction_id": input.transaction_id,
                "agent_id": input.agent_id,
                "amount": input.amount,
                "transaction_type": "airtime_data"
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 11: Generate receipt
        receipt = await workflow.execute_activity(
            generate_receipt,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "amount": input.amount,
                "transaction_type": "airtime_data",
                "telco_provider": input.telco_provider,
                "phone_number": input.phone_number,
                "product_type": input.product_type,
                "ledger_id": ledger_result["ledger_id"],
                "telco_reference": telco_purchase["reference"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Step 12: Send notifications
        await workflow.execute_activity(
            send_transaction_notifications,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "agent_id": input.agent_id,
                "transaction_type": "airtime_data",
                "amount": input.amount,
                "receipt_url": receipt["receipt_url"],
                "voucher_code": telco_purchase.get("voucher_code")
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 13: Update analytics
        await workflow.execute_activity(
            update_transaction_analytics,
            {
                "transaction_id": input.transaction_id,
                "customer_id": input.customer_id,
                "agent_id": input.agent_id,
                "transaction_type": "airtime_data",
                "amount": input.amount,
                "telco_provider": input.telco_provider
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        return {
            "status": "completed",
            "transaction_id": input.transaction_id,
            "ledger_id": ledger_result["ledger_id"],
            "telco_reference": telco_purchase["reference"],
            "voucher_code": telco_purchase.get("voucher_code"),
            "receipt_url": receipt["receipt_url"],
            "commission": commission_result.get("commission_amount", 0),
            "amount": input.amount
        }

# ============================================================================
# PRIORITY 4: Float Management Workflow (Score: 7.75)
# User Story 18: Agent Float Management
# ============================================================================

@workflow.defn
class FloatManagementWorkflow:
    """
    Workflow for agent cash float management and rebalancing
    Priority: #4 | Score: 7.75
    Estimate: 4-5 days
    
    Steps:
    1. Validate agent account
    2. Check current float balance
    3. Validate operation type and amount
    4. Check float limits and thresholds
    5. Request authorization (for large amounts)
    6. Process float operation in ledger
    7. Update float tracking system
    8. Update agent cash availability
    9. Generate float report
    10. Send notifications
    11. Update analytics and alerts
    """
    
    @workflow.run
    async def run(self, input: FloatManagementInput) -> Dict[str, Any]:
        """Execute float management workflow"""
        
        # Step 1: Validate agent account
        agent_validation = await workflow.execute_activity(
            validate_agent_account,
            {"agent_id": input.agent_id},
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not agent_validation["valid"]:
            return {
                "status": "failed",
                "reason": agent_validation.get("reason", "Agent validation failed")
            }
        
        # Step 2: Check current float balance
        float_balance = await workflow.execute_activity(
            get_agent_float_balance,
            {"agent_id": input.agent_id},
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 3: Validate operation type and amount
        operation_validation = await workflow.execute_activity(
            validate_float_operation,
            {
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "current_balance": float_balance["balance"],
                "source_agent_id": input.source_agent_id,
                "target_agent_id": input.target_agent_id
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not operation_validation["valid"]:
            return {
                "status": "failed",
                "reason": operation_validation.get("reason", "Operation validation failed")
            }
        
        # Step 4: Check float limits and thresholds
        limits_check = await workflow.execute_activity(
            check_float_limits,
            {
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "current_balance": float_balance["balance"]
            },
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not limits_check["within_limits"]:
            return {
                "status": "failed",
                "reason": limits_check.get("reason", "Operation exceeds limits")
            }
        
        # Step 5: Request authorization (for large amounts)
        if limits_check.get("requires_authorization"):
            # Wait for manual authorization
            workflow.logger.info(f"Waiting for authorization for operation {input.operation_id}")
            
            authorization = await workflow.wait_condition(
                lambda: workflow.get_signal("float_operation_authorized"),
                timeout=timedelta(hours=24)
            )
            
            if not authorization:
                return {
                    "status": "failed",
                    "reason": "Authorization timeout"
                }
        
        # Step 6: Process float operation in ledger
        ledger_result = await workflow.execute_activity(
            process_float_ledger_operation,
            {
                "operation_id": input.operation_id,
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "currency": input.currency,
                "source_agent_id": input.source_agent_id,
                "target_agent_id": input.target_agent_id,
                "reason": input.reason
            },
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=1)
            )
        )
        
        if not ledger_result["success"]:
            return {
                "status": "failed",
                "reason": "Ledger operation failed"
            }
        
        # Step 7: Update float tracking system
        float_update = await workflow.execute_activity(
            update_float_tracking,
            {
                "operation_id": input.operation_id,
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "previous_balance": float_balance["balance"],
                "new_balance": ledger_result["new_balance"],
                "ledger_id": ledger_result["ledger_id"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 8: Update agent cash availability
        await workflow.execute_activity(
            update_agent_cash_availability,
            {
                "agent_id": input.agent_id,
                "new_balance": ledger_result["new_balance"],
                "operation_type": input.operation_type
            },
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 9: Generate float report
        report = await workflow.execute_activity(
            generate_float_report,
            {
                "operation_id": input.operation_id,
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "previous_balance": float_balance["balance"],
                "new_balance": ledger_result["new_balance"],
                "ledger_id": ledger_result["ledger_id"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Step 10: Send notifications
        await workflow.execute_activity(
            send_float_notifications,
            {
                "operation_id": input.operation_id,
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "new_balance": ledger_result["new_balance"],
                "report_url": report["report_url"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 11: Update analytics and check for alerts
        await workflow.execute_activity(
            update_float_analytics,
            {
                "operation_id": input.operation_id,
                "agent_id": input.agent_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "new_balance": ledger_result["new_balance"]
            },
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Check if rebalancing is needed
        if ledger_result["new_balance"] < float_balance.get("min_threshold", 0):
            await workflow.execute_activity(
                trigger_float_rebalance_alert,
                {
                    "agent_id": input.agent_id,
                    "current_balance": ledger_result["new_balance"],
                    "min_threshold": float_balance.get("min_threshold", 0)
                },
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2)
            )
        
        return {
            "status": "completed",
            "operation_id": input.operation_id,
            "operation_type": input.operation_type,
            "amount": input.amount,
            "previous_balance": float_balance["balance"],
            "new_balance": ledger_result["new_balance"],
            "ledger_id": ledger_result["ledger_id"],
            "report_url": report["report_url"]
        }

# ============================================================================
# PRIORITY 5: Savings Account Workflow (Score: 7.55)
# User Story 11: Savings Account Management
# ============================================================================

@workflow.defn
class SavingsAccountWorkflow:
    """
    Workflow for savings account management
    Priority: #5 | Score: 7.55
    Estimate: 4-5 days
    
    Steps:
    1. Validate customer account
    2. Validate operation type and parameters
    3. Check account status and eligibility
    4. Calculate interest (if applicable)
    5. Check regulatory compliance
    6. Request customer authorization
    7. Process account operation in ledger
    8. Update savings account records
    9. Schedule interest payments (if applicable)
    10. Generate account statement
    11. Send notifications
    12. Update analytics
    """
    
    @workflow.run
    async def run(self, input: SavingsAccountInput) -> Dict[str, Any]:
        """Execute savings account workflow"""
        
        # Step 1: Validate customer account
        customer_validation = await workflow.execute_activity(
            validate_customer_account,
            {"customer_id": input.customer_id},
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not customer_validation["valid"]:
            return {
                "status": "failed",
                "reason": customer_validation.get("reason", "Customer validation failed")
            }
        
        # Step 2: Validate operation type and parameters
        operation_validation = await workflow.execute_activity(
            validate_savings_operation,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "account_type": input.account_type,
                "interest_rate": input.interest_rate,
                "term_months": input.term_months
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not operation_validation["valid"]:
            return {
                "status": "failed",
                "reason": operation_validation.get("reason", "Operation validation failed")
            }
        
        # Step 3: Check account status and eligibility
        if input.operation_type != "open":
            account_status = await workflow.execute_activity(
                check_savings_account_status,
                {"account_id": input.account_id},
                start_to_close_timeout=timedelta(seconds=20),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
            
            if not account_status["active"]:
                return {
                    "status": "failed",
                    "reason": "Account is not active"
                }
        
        # Step 4: Calculate interest (if applicable)
        interest_calculation = None
        if input.operation_type in ["withdraw", "close"]:
            interest_calculation = await workflow.execute_activity(
                calculate_savings_interest,
                {
                    "account_id": input.account_id,
                    "account_type": input.account_type,
                    "interest_rate": input.interest_rate,
                    "term_months": input.term_months
                },
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )
        
        # Step 5: Check regulatory compliance
        compliance_check = await workflow.execute_activity(
            check_savings_compliance,
            {
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "account_type": input.account_type
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        if not compliance_check["compliant"]:
            return {
                "status": "failed",
                "reason": compliance_check.get("reason", "Compliance check failed")
            }
        
        # Step 6: Request customer authorization
        if input.operation_type in ["withdraw", "close"]:
            authorization = await workflow.execute_activity(
                request_savings_authorization,
                {
                    "customer_id": input.customer_id,
                    "account_id": input.account_id,
                    "operation_type": input.operation_type,
                    "amount": input.amount
                },
                start_to_close_timeout=timedelta(minutes=3),
                retry_policy=RetryPolicy(maximum_attempts=1)
            )
            
            if not authorization["authorized"]:
                return {
                    "status": "failed",
                    "reason": "Authorization failed"
                }
        
        # Step 7: Process account operation in ledger
        ledger_result = await workflow.execute_activity(
            process_savings_ledger_operation,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "interest_amount": interest_calculation.get("interest_amount", 0) if interest_calculation else 0,
                "account_type": input.account_type
            },
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=1)
            )
        )
        
        if not ledger_result["success"]:
            return {
                "status": "failed",
                "reason": "Ledger operation failed"
            }
        
        # Step 8: Update savings account records
        account_update = await workflow.execute_activity(
            update_savings_account,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "new_balance": ledger_result["new_balance"],
                "account_type": input.account_type,
                "interest_rate": input.interest_rate,
                "term_months": input.term_months,
                "target_amount": input.target_amount,
                "withdrawal_frequency": input.withdrawal_frequency
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 9: Schedule interest payments (if applicable)
        if input.operation_type == "open" and input.interest_rate:
            await workflow.execute_activity(
                schedule_interest_payments,
                {
                    "account_id": input.account_id,
                    "interest_rate": input.interest_rate,
                    "account_type": input.account_type,
                    "term_months": input.term_months
                },
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=2)
            )
        
        # Step 10: Generate account statement
        statement = await workflow.execute_activity(
            generate_savings_statement,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "interest_amount": interest_calculation.get("interest_amount", 0) if interest_calculation else 0,
                "new_balance": ledger_result["new_balance"],
                "ledger_id": ledger_result["ledger_id"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # Step 11: Send notifications
        await workflow.execute_activity(
            send_savings_notifications,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "new_balance": ledger_result["new_balance"],
                "statement_url": statement["statement_url"]
            },
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # Step 12: Update analytics
        await workflow.execute_activity(
            update_savings_analytics,
            {
                "account_id": input.account_id,
                "customer_id": input.customer_id,
                "operation_type": input.operation_type,
                "amount": input.amount,
                "account_type": input.account_type,
                "new_balance": ledger_result["new_balance"]
            },
            start_to_close_timeout=timedelta(seconds=20),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        return {
            "status": "completed",
            "account_id": input.account_id,
            "operation_type": input.operation_type,
            "amount": input.amount,
            "interest_amount": interest_calculation.get("interest_amount", 0) if interest_calculation else 0,
            "new_balance": ledger_result["new_balance"],
            "ledger_id": ledger_result["ledger_id"],
            "statement_url": statement["statement_url"]
        }

# ============================================================================
# Activity Function Stubs for Priority Workflows
# These will be implemented in activities_priority_5.py
# ============================================================================

# P2P Transfer Activities
@activity.defn
async def validate_sender_account(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate sender account and balance"""
    pass

@activity.defn
async def validate_recipient_account(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate recipient account"""
    pass

@activity.defn
async def check_p2p_transaction_limits(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check P2P transaction limits"""
    pass

@activity.defn
async def check_p2p_fraud(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check P2P transaction for fraud"""
    pass

@activity.defn
async def verify_sender_pin(params: Dict[str, Any]) -> Dict[str, Any]:
    """Verify sender PIN"""
    pass

@activity.defn
async def process_p2p_ledger_transaction(params: Dict[str, Any]) -> Dict[str, Any]:
    """Process P2P transfer in ledger"""
    pass

@activity.defn
async def calculate_p2p_commission(params: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate P2P commission"""
    pass

@activity.defn
async def generate_p2p_receipt(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate P2P receipt"""
    pass

@activity.defn
async def send_p2p_notifications(params: Dict[str, Any]) -> Dict[str, Any]:
    """Send P2P notifications"""
    pass

@activity.defn
async def update_p2p_analytics(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update P2P analytics"""
    pass

# Bill Payment Activities
@activity.defn
async def validate_biller_account(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate biller and account number"""
    pass

@activity.defn
async def fetch_bill_details(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch bill details from biller"""
    pass

@activity.defn
async def submit_bill_payment(params: Dict[str, Any]) -> Dict[str, Any]:
    """Submit payment to biller"""
    pass

@activity.defn
async def initiate_refund(params: Dict[str, Any]) -> Dict[str, Any]:
    """Initiate refund for failed transaction"""
    pass

# Airtime/Data Activities
@activity.defn
async def validate_telco_phone(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate telco provider and phone number"""
    pass

@activity.defn
async def fetch_data_product_details(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch data product details"""
    pass

@activity.defn
async def submit_telco_purchase(params: Dict[str, Any]) -> Dict[str, Any]:
    """Submit purchase to telco provider"""
    pass

# Float Management Activities
@activity.defn
async def validate_agent_account(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate agent account"""
    pass

@activity.defn
async def get_agent_float_balance(params: Dict[str, Any]) -> Dict[str, Any]:
    """Get agent float balance"""
    pass

@activity.defn
async def validate_float_operation(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate float operation"""
    pass

@activity.defn
async def check_float_limits(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check float limits"""
    pass

@activity.defn
async def process_float_ledger_operation(params: Dict[str, Any]) -> Dict[str, Any]:
    """Process float operation in ledger"""
    pass

@activity.defn
async def update_float_tracking(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update float tracking system"""
    pass

@activity.defn
async def update_agent_cash_availability(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update agent cash availability"""
    pass

@activity.defn
async def generate_float_report(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate float report"""
    pass

@activity.defn
async def send_float_notifications(params: Dict[str, Any]) -> Dict[str, Any]:
    """Send float notifications"""
    pass

@activity.defn
async def update_float_analytics(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update float analytics"""
    pass

@activity.defn
async def trigger_float_rebalance_alert(params: Dict[str, Any]) -> Dict[str, Any]:
    """Trigger float rebalance alert"""
    pass

# Savings Account Activities
@activity.defn
async def validate_savings_operation(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate savings operation"""
    pass

@activity.defn
async def check_savings_account_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check savings account status"""
    pass

@activity.defn
async def calculate_savings_interest(params: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate savings interest"""
    pass

@activity.defn
async def check_savings_compliance(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check savings compliance"""
    pass

@activity.defn
async def request_savings_authorization(params: Dict[str, Any]) -> Dict[str, Any]:
    """Request savings authorization"""
    pass

@activity.defn
async def process_savings_ledger_operation(params: Dict[str, Any]) -> Dict[str, Any]:
    """Process savings operation in ledger"""
    pass

@activity.defn
async def update_savings_account(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update savings account records"""
    pass

@activity.defn
async def schedule_interest_payments(params: Dict[str, Any]) -> Dict[str, Any]:
    """Schedule interest payments"""
    pass

@activity.defn
async def generate_savings_statement(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate savings statement"""
    pass

@activity.defn
async def send_savings_notifications(params: Dict[str, Any]) -> Dict[str, Any]:
    """Send savings notifications"""
    pass

@activity.defn
async def update_savings_analytics(params: Dict[str, Any]) -> Dict[str, Any]:
    """Update savings analytics"""
    pass

