"""
QR Payment Workflow

Temporal workflow for processing QR code-based payments with full platform integration.
"""

import asyncio
from datetime import timedelta
from typing import Dict, Optional
from dataclasses import dataclass
import logging

from temporalio import workflow, activity
from temporalio.common import RetryPolicy

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class QRPaymentRequest:
    """QR payment request."""
    qr_code_id: str
    qr_code_data: str
    payer_id: str
    payer_name: str
    payer_account_id: str
    merchant_id: str
    merchant_account_id: str
    amount: float
    currency: str
    pin: Optional[str] = None
    biometric_token: Optional[str] = None


@dataclass
class QRPaymentResult:
    """QR payment result."""
    transaction_id: str
    status: str
    message: str
    qr_code_id: str
    amount: float
    currency: str
    timestamp: str


# Activities

@activity.defn
async def verify_qr_code(qr_code_data: str) -> Dict:
    """
    Verify QR code signature and expiry.
    
    Args:
        qr_code_data: QR code data JSON
        
    Returns:
        Dict with verification result
    """
    import json
    from datetime import datetime
    
    try:
        qr_data = json.loads(qr_code_data)
        
        # Check expiry
        expires_at = datetime.fromisoformat(qr_data['expires_at'].replace('Z', '+00:00'))
        if datetime.now(expires_at.tzinfo) > expires_at:
            return {
                'valid': False,
                'reason': 'QR code has expired'
            }
        
        # Verify signature (simplified)
        # In production, verify using the actual signature algorithm
        if 'signature' not in qr_data:
            return {
                'valid': False,
                'reason': 'Missing signature'
            }
        
        return {
            'valid': True,
            'qr_code_id': qr_data['qr_code_id'],
            'merchant_id': qr_data['merchant_id'],
            'amount': qr_data['amount'],
            'currency': qr_data['currency']
        }
        
    except Exception as e:
        logger.error(f"QR code verification failed: {e}")
        return {
            'valid': False,
            'reason': f'Invalid QR code format: {str(e)}'
        }


@activity.defn
async def authenticate_payer(payer_id: str, pin: Optional[str], biometric_token: Optional[str]) -> Dict:
    """
    Authenticate payer using PIN or biometric.
    
    Args:
        payer_id: Payer ID
        pin: PIN (optional)
        biometric_token: Biometric authentication token (optional)
        
    Returns:
        Dict with authentication result
    """
    # In production, verify against stored credentials
    # For now, simulate authentication
    
    if pin:
        # Verify PIN
        # In production: hash and compare with stored hash
        if len(pin) >= 4:
            return {
                'authenticated': True,
                'method': 'pin'
            }
    
    if biometric_token:
        # Verify biometric token
        # In production: verify with biometric service
        return {
            'authenticated': True,
            'method': 'biometric'
        }
    
    return {
        'authenticated': False,
        'reason': 'No valid authentication method provided'
    }


@activity.defn
async def check_fraud_score(
    payer_id: str,
    merchant_id: str,
    amount: float,
    transaction_context: Dict
) -> Dict:
    """
    Check fraud score using AI fraud detection system.
    
    Args:
        payer_id: Payer ID
        merchant_id: Merchant ID
        amount: Transaction amount
        transaction_context: Additional context
        
    Returns:
        Dict with fraud score and decision
    """
    # In production, call the fraud detection service
    # For now, simulate fraud check
    
    # Simple rule-based check
    if amount > 100000:  # Large transaction
        fraud_score = 0.7
    elif amount > 50000:
        fraud_score = 0.4
    else:
        fraud_score = 0.1
    
    return {
        'fraud_score': fraud_score,
        'risk_level': 'high' if fraud_score > 0.6 else 'medium' if fraud_score > 0.3 else 'low',
        'approved': fraud_score < 0.8,
        'reason': 'Large transaction amount' if fraud_score > 0.6 else 'Normal transaction'
    }


@activity.defn
async def check_balance(account_id: str, amount: float) -> Dict:
    """
    Check if account has sufficient balance.
    
    Args:
        account_id: Account ID
        amount: Amount to check
        
    Returns:
        Dict with balance check result
    """
    import os
    from common.grpc_clients import LedgerServiceClient
    
    ledger_host = os.getenv('LEDGER_SERVICE_HOST', 'localhost')
    ledger_port = int(os.getenv('LEDGER_SERVICE_PORT', '50051'))
    
    try:
        async with LedgerServiceClient(ledger_host, ledger_port) as client:
            balance_result = await client.get_account_balance(account_id)
            
            if balance_result.get('success'):
                available_balance = float(balance_result.get('available_balance', 0))
                return {
                    'sufficient': available_balance >= amount,
                    'available_balance': available_balance,
                    'required_amount': amount
                }
            else:
                logger.error(f"Failed to get balance for account {account_id}: {balance_result.get('message')}")
                return {
                    'sufficient': False,
                    'available_balance': 0,
                    'required_amount': amount,
                    'error': balance_result.get('message', 'Failed to retrieve balance')
                }
    except Exception as e:
        logger.error(f"Error checking balance for account {account_id}: {e}")
        return {
            'sufficient': False,
            'available_balance': 0,
            'required_amount': amount,
            'error': str(e)
        }


@activity.defn
async def execute_ledger_transfer(
    payer_account_id: str,
    merchant_account_id: str,
    amount: float,
    currency: str,
    transaction_id: str
) -> Dict:
    """
    Execute transfer in TigerBeetle ledger.
    
    Args:
        payer_account_id: Payer's account ID
        merchant_account_id: Merchant's account ID
        amount: Transfer amount
        currency: Currency code
        transaction_id: Transaction ID
        
    Returns:
        Dict with transfer result
    """
    # In production, call TigerBeetle client
    # For now, simulate transfer
    
    logger.info(f"Executing ledger transfer: {payer_account_id} -> {merchant_account_id}, amount: {amount}")
    
    try:
        # Simulate TigerBeetle transfer
        # In production:
        # transfer = {
        #     'id': int(transaction_id, 16),
        #     'debit_account_id': int(payer_account_id),
        #     'credit_account_id': int(merchant_account_id),
        #     'amount': int(amount * 100),  # Convert to cents
        #     'ledger': 1,
        #     'code': 1,
        #     'flags': 0
        # }
        # result = tigerbeetle_client.create_transfers([transfer])
        
        return {
            'success': True,
            'transfer_id': transaction_id,
            'timestamp': '2025-01-15T10:30:00Z'
        }
        
    except Exception as e:
        logger.error(f"Ledger transfer failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@activity.defn
async def record_transaction(transaction_data: Dict) -> Dict:
    """
    Record transaction in PostgreSQL.
    
    Args:
        transaction_data: Transaction data
        
    Returns:
        Dict with recording result
    """
    # In production, insert into PostgreSQL
    logger.info(f"Recording transaction: {transaction_data['transaction_id']}")
    
    return {
        'recorded': True,
        'transaction_id': transaction_data['transaction_id']
    }


@activity.defn
async def send_notification(
    recipient_id: str,
    notification_type: str,
    data: Dict
) -> Dict:
    """
    Send notification via Kafka.
    
    Args:
        recipient_id: Recipient ID
        notification_type: Type of notification
        data: Notification data
        
    Returns:
        Dict with notification result
    """
    # In production, send via Kafka
    logger.info(f"Sending {notification_type} notification to {recipient_id}")
    
    return {
        'sent': True,
        'notification_id': f"notif_{recipient_id}_{notification_type}"
    }


@activity.defn
async def settle_transaction(
    payer_bank_id: str,
    merchant_bank_id: str,
    amount: float,
    currency: str,
    transaction_id: str
) -> Dict:
    """
    Initiate instant settlement between banks.
    
    Args:
        payer_bank_id: Payer's bank ID
        merchant_bank_id: Merchant's bank ID
        amount: Settlement amount
        currency: Currency code
        transaction_id: Transaction ID
        
    Returns:
        Dict with settlement result
    """
    # In production, call instant settlement service
    logger.info(f"Initiating settlement: {payer_bank_id} -> {merchant_bank_id}, amount: {amount}")
    
    return {
        'settled': True,
        'settlement_id': f"settle_{transaction_id}",
        'timestamp': '2025-01-15T10:30:05Z'
    }


# Workflow

@workflow.defn
class QRPaymentWorkflow:
    """
    QR Payment Workflow
    
    Orchestrates the complete QR payment process with full platform integration.
    """
    
    @workflow.run
    async def run(self, request: QRPaymentRequest) -> QRPaymentResult:
        """
        Execute QR payment workflow.
        
        Args:
            request: QR payment request
            
        Returns:
            QRPaymentResult
        """
        transaction_id = f"txn_qr_{request.qr_code_id}_{workflow.now().timestamp()}"
        
        # Define retry policy
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            maximum_interval=timedelta(seconds=10),
            maximum_attempts=3,
        )
        
        try:
            # Step 1: Verify QR code
            qr_verification = await workflow.execute_activity(
                verify_qr_code,
                request.qr_code_data,
                start_to_close_timeout=timedelta(seconds=5),
                retry_policy=retry_policy,
            )
            
            if not qr_verification['valid']:
                return QRPaymentResult(
                    transaction_id=transaction_id,
                    status='FAILED',
                    message=qr_verification['reason'],
                    qr_code_id=request.qr_code_id,
                    amount=request.amount,
                    currency=request.currency,
                    timestamp=workflow.now().isoformat()
                )
            
            # Step 2: Authenticate payer
            auth_result = await workflow.execute_activity(
                authenticate_payer,
                args=[request.payer_id, request.pin, request.biometric_token],
                start_to_close_timeout=timedelta(seconds=5),
                retry_policy=retry_policy,
            )
            
            if not auth_result['authenticated']:
                return QRPaymentResult(
                    transaction_id=transaction_id,
                    status='FAILED',
                    message='Authentication failed',
                    qr_code_id=request.qr_code_id,
                    amount=request.amount,
                    currency=request.currency,
                    timestamp=workflow.now().isoformat()
                )
            
            # Step 3: Check fraud score
            fraud_check = await workflow.execute_activity(
                check_fraud_score,
                args=[
                    request.payer_id,
                    request.merchant_id,
                    request.amount,
                    {'qr_code_id': request.qr_code_id}
                ],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy,
            )
            
            if not fraud_check['approved']:
                return QRPaymentResult(
                    transaction_id=transaction_id,
                    status='BLOCKED',
                    message=f"Transaction blocked: {fraud_check['reason']}",
                    qr_code_id=request.qr_code_id,
                    amount=request.amount,
                    currency=request.currency,
                    timestamp=workflow.now().isoformat()
                )
            
            # Step 4: Check balance
            balance_check = await workflow.execute_activity(
                check_balance,
                args=[request.payer_account_id, request.amount],
                start_to_close_timeout=timedelta(seconds=5),
                retry_policy=retry_policy,
            )
            
            if not balance_check['sufficient']:
                return QRPaymentResult(
                    transaction_id=transaction_id,
                    status='FAILED',
                    message='Insufficient balance',
                    qr_code_id=request.qr_code_id,
                    amount=request.amount,
                    currency=request.currency,
                    timestamp=workflow.now().isoformat()
                )
            
            # Step 5: Execute ledger transfer
            transfer_result = await workflow.execute_activity(
                execute_ledger_transfer,
                args=[
                    request.payer_account_id,
                    request.merchant_account_id,
                    request.amount,
                    request.currency,
                    transaction_id
                ],
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy,
            )
            
            if not transfer_result['success']:
                return QRPaymentResult(
                    transaction_id=transaction_id,
                    status='FAILED',
                    message='Ledger transfer failed',
                    qr_code_id=request.qr_code_id,
                    amount=request.amount,
                    currency=request.currency,
                    timestamp=workflow.now().isoformat()
                )
            
            # Step 6: Record transaction
            await workflow.execute_activity(
                record_transaction,
                {
                    'transaction_id': transaction_id,
                    'qr_code_id': request.qr_code_id,
                    'payer_id': request.payer_id,
                    'merchant_id': request.merchant_id,
                    'amount': request.amount,
                    'currency': request.currency,
                    'status': 'SUCCESS'
                },
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=retry_policy,
            )
            
            # Step 7: Send notifications (parallel)
            await asyncio.gather(
                workflow.execute_activity(
                    send_notification,
                    args=[request.payer_id, 'payment_success', {'transaction_id': transaction_id}],
                    start_to_close_timeout=timedelta(seconds=5),
                ),
                workflow.execute_activity(
                    send_notification,
                    args=[request.merchant_id, 'payment_received', {'transaction_id': transaction_id}],
                    start_to_close_timeout=timedelta(seconds=5),
                ),
            )
            
            # Step 8: Initiate settlement (async)
            workflow.execute_activity(
                settle_transaction,
                args=[
                    'bank_001',  # Payer's bank
                    'bank_002',  # Merchant's bank
                    request.amount,
                    request.currency,
                    transaction_id
                ],
                start_to_close_timeout=timedelta(seconds=30),
            )
            
            return QRPaymentResult(
                transaction_id=transaction_id,
                status='SUCCESS',
                message='Payment successful',
                qr_code_id=request.qr_code_id,
                amount=request.amount,
                currency=request.currency,
                timestamp=workflow.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"QR payment workflow failed: {e}")
            return QRPaymentResult(
                transaction_id=transaction_id,
                status='ERROR',
                message=f'Workflow error: {str(e)}',
                qr_code_id=request.qr_code_id,
                amount=request.amount,
                currency=request.currency,
                timestamp=workflow.now().isoformat()
            )
