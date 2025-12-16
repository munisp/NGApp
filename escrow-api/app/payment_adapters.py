"""
Payment Platform Adapters

This module provides a comprehensive payment abstraction layer supporting:
1. PSP (Payment Service Providers) - Paystack, Flutterwave, etc.
2. Switch/Gateway - Direct bank switch integration
3. Mobile Wallets - OPay, PalmPay, Kuda, etc.
4. Telco Money - MTN MoMo, Airtel Money, etc.
5. Internal Gateway - Custom payment gateway

Designed for Nigerian market with extensible architecture.
"""

import os
import json
import hmac
import hashlib
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Literal, Callable
from enum import Enum
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import uuid
import re

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class PaymentConfig:
    """Payment integration configuration"""
    
    # Paystack Configuration
    PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
    PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
    PAYSTACK_WEBHOOK_SECRET = os.getenv("PAYSTACK_WEBHOOK_SECRET", "")
    
    # Flutterwave Configuration
    FLUTTERWAVE_SECRET_KEY = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
    FLUTTERWAVE_PUBLIC_KEY = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "")
    FLUTTERWAVE_ENCRYPTION_KEY = os.getenv("FLUTTERWAVE_ENCRYPTION_KEY", "")
    FLUTTERWAVE_WEBHOOK_SECRET = os.getenv("FLUTTERWAVE_WEBHOOK_SECRET", "")
    
    # OPay Configuration
    OPAY_MERCHANT_ID = os.getenv("OPAY_MERCHANT_ID", "")
    OPAY_SECRET_KEY = os.getenv("OPAY_SECRET_KEY", "")
    OPAY_PUBLIC_KEY = os.getenv("OPAY_PUBLIC_KEY", "")
    
    # PalmPay Configuration
    PALMPAY_MERCHANT_ID = os.getenv("PALMPAY_MERCHANT_ID", "")
    PALMPAY_SECRET_KEY = os.getenv("PALMPAY_SECRET_KEY", "")
    
    # Kuda Configuration
    KUDA_API_KEY = os.getenv("KUDA_API_KEY", "")
    KUDA_EMAIL = os.getenv("KUDA_EMAIL", "")
    
    # MTN MoMo Configuration
    MTN_MOMO_API_KEY = os.getenv("MTN_MOMO_API_KEY", "")
    MTN_MOMO_USER_ID = os.getenv("MTN_MOMO_USER_ID", "")
    MTN_MOMO_SUBSCRIPTION_KEY = os.getenv("MTN_MOMO_SUBSCRIPTION_KEY", "")
    
    # Airtel Money Configuration
    AIRTEL_CLIENT_ID = os.getenv("AIRTEL_CLIENT_ID", "")
    AIRTEL_CLIENT_SECRET = os.getenv("AIRTEL_CLIENT_SECRET", "")
    
    # General Configuration
    DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "NGN")
    WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL", "https://app-eeeyetyo.fly.dev")


# =============================================================================
# Data Models
# =============================================================================

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    EXPIRED = "expired"


class PaymentMethod(str, Enum):
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    USSD = "ussd"
    QR = "qr"
    MOBILE_MONEY = "mobile_money"
    WALLET = "wallet"
    BANK_ACCOUNT = "bank_account"


class PaymentProvider(str, Enum):
    PAYSTACK = "paystack"
    FLUTTERWAVE = "flutterwave"
    OPAY = "opay"
    PALMPAY = "palmpay"
    KUDA = "kuda"
    MTN_MOMO = "mtn_momo"
    AIRTEL_MONEY = "airtel_money"
    INTERNAL = "internal"


@dataclass
class PaymentRequest:
    """Payment request model"""
    reference: str
    amount: float
    currency: str = "NGN"
    email: Optional[str] = None
    phone: Optional[str] = None
    customer_name: Optional[str] = None
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    callback_url: Optional[str] = None
    redirect_url: Optional[str] = None
    payment_methods: List[PaymentMethod] = field(default_factory=lambda: [PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER])
    idempotency_key: Optional[str] = None
    split_config: Optional[Dict[str, Any]] = None  # For split payments


@dataclass
class PaymentResponse:
    """Payment response model"""
    reference: str
    provider_reference: Optional[str]
    status: PaymentStatus
    amount: float
    fee: float = 0.0
    currency: str = "NGN"
    payment_method: Optional[PaymentMethod] = None
    provider: PaymentProvider = PaymentProvider.INTERNAL
    authorization_url: Optional[str] = None
    access_code: Optional[str] = None
    ussd_code: Optional[str] = None
    bank_details: Optional[Dict[str, Any]] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    message: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PayoutRequest:
    """Payout request model"""
    reference: str
    amount: float
    recipient_account: str
    recipient_bank_code: str
    recipient_name: str
    currency: str = "NGN"
    narration: str = ""
    idempotency_key: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PayoutResponse:
    """Payout response model"""
    reference: str
    provider_reference: Optional[str]
    status: PaymentStatus
    amount: float
    fee: float = 0.0
    currency: str = "NGN"
    provider: PaymentProvider = PaymentProvider.INTERNAL
    timestamp: datetime = field(default_factory=datetime.utcnow)
    message: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RefundRequest:
    """Refund request model"""
    original_reference: str
    amount: Optional[float] = None  # None = full refund
    reason: str = ""
    idempotency_key: Optional[str] = None


@dataclass
class RefundResponse:
    """Refund response model"""
    reference: str
    original_reference: str
    status: PaymentStatus
    amount: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    message: str = ""


@dataclass
class WebhookEvent:
    """Webhook event model"""
    event_type: str
    reference: str
    provider: PaymentProvider
    status: PaymentStatus
    amount: float
    currency: str
    timestamp: datetime
    raw_payload: Dict[str, Any]
    signature_valid: bool = False


# =============================================================================
# Abstract Payment Adapter Interface
# =============================================================================

class PaymentAdapterInterface(ABC):
    """Abstract interface for payment adapters"""
    
    @property
    @abstractmethod
    def provider(self) -> PaymentProvider:
        """Get provider identifier"""
        pass
    
    @property
    @abstractmethod
    def supported_methods(self) -> List[PaymentMethod]:
        """Get supported payment methods"""
        pass
    
    @abstractmethod
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize a payment"""
        pass
    
    @abstractmethod
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify payment status"""
        pass
    
    @abstractmethod
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate a payout"""
        pass
    
    @abstractmethod
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify payout status"""
        pass
    
    @abstractmethod
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process a refund"""
        pass
    
    @abstractmethod
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        pass
    
    @abstractmethod
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse webhook payload"""
        pass


# =============================================================================
# Paystack Adapter
# =============================================================================

class PaystackAdapter(PaymentAdapterInterface):
    """
    Paystack Payment Adapter
    
    Supports:
    - Card payments
    - Bank transfers
    - USSD
    - Payouts via transfer
    """
    
    def __init__(self):
        self.secret_key = PaymentConfig.PAYSTACK_SECRET_KEY
        self.public_key = PaymentConfig.PAYSTACK_PUBLIC_KEY
        self.webhook_secret = PaymentConfig.PAYSTACK_WEBHOOK_SECRET
        self.base_url = "https://api.paystack.co"
    
    @property
    def provider(self) -> PaymentProvider:
        return PaymentProvider.PAYSTACK
    
    @property
    def supported_methods(self) -> List[PaymentMethod]:
        return [PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER, PaymentMethod.USSD]
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }
    
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize Paystack payment"""
        logger.info(f"Initializing Paystack payment: {request.reference}")
        
        # In production: POST to {base_url}/transaction/initialize
        
        # Simulated response for POC
        access_code = f"ACK_{uuid.uuid4().hex[:12].upper()}"
        
        return PaymentResponse(
            reference=request.reference,
            provider_reference=access_code,
            status=PaymentStatus.PENDING,
            amount=request.amount,
            fee=request.amount * 0.015 + 100,  # 1.5% + 100 NGN
            currency=request.currency,
            provider=PaymentProvider.PAYSTACK,
            authorization_url=f"https://checkout.paystack.com/{access_code}",
            access_code=access_code,
            message="Payment initialized"
        )
    
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify Paystack payment"""
        logger.info(f"Verifying Paystack payment: {reference}")
        
        # In production: GET {base_url}/transaction/verify/{reference}
        
        return PaymentResponse(
            reference=reference,
            provider_reference=f"TXN_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,  # Would be from API
            fee=0,
            provider=PaymentProvider.PAYSTACK,
            payment_method=PaymentMethod.CARD,
            message="Payment verified"
        )
    
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate Paystack transfer"""
        logger.info(f"Initiating Paystack payout: {request.reference}")
        
        # In production:
        # 1. Create transfer recipient: POST {base_url}/transferrecipient
        # 2. Initiate transfer: POST {base_url}/transfer
        
        return PayoutResponse(
            reference=request.reference,
            provider_reference=f"TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PROCESSING,
            amount=request.amount,
            fee=10.75 if request.amount <= 5000 else 26.88 if request.amount <= 50000 else 53.75,
            provider=PaymentProvider.PAYSTACK,
            message="Transfer initiated"
        )
    
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify Paystack transfer"""
        logger.info(f"Verifying Paystack payout: {reference}")
        
        # In production: GET {base_url}/transfer/verify/{reference}
        
        return PayoutResponse(
            reference=reference,
            provider_reference=f"TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.PAYSTACK,
            message="Transfer completed"
        )
    
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process Paystack refund"""
        logger.info(f"Processing Paystack refund: {request.original_reference}")
        
        # In production: POST {base_url}/refund
        
        return RefundResponse(
            reference=f"REF_{uuid.uuid4().hex[:12].upper()}",
            original_reference=request.original_reference,
            status=PaymentStatus.REFUNDED,
            amount=request.amount or 0,
            message="Refund processed"
        )
    
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify Paystack webhook signature"""
        expected = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse Paystack webhook"""
        event = payload.get("event", "")
        data = payload.get("data", {})
        
        status_map = {
            "charge.success": PaymentStatus.SUCCESSFUL,
            "transfer.success": PaymentStatus.SUCCESSFUL,
            "transfer.failed": PaymentStatus.FAILED,
            "refund.processed": PaymentStatus.REFUNDED
        }
        
        return WebhookEvent(
            event_type=event,
            reference=data.get("reference", ""),
            provider=PaymentProvider.PAYSTACK,
            status=status_map.get(event, PaymentStatus.PENDING),
            amount=float(data.get("amount", 0)) / 100,  # Paystack uses kobo
            currency=data.get("currency", "NGN"),
            timestamp=datetime.fromisoformat(data.get("paid_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")),
            raw_payload=payload
        )


# =============================================================================
# Flutterwave Adapter
# =============================================================================

class FlutterwaveAdapter(PaymentAdapterInterface):
    """
    Flutterwave Payment Adapter
    
    Supports:
    - Card payments
    - Bank transfers
    - USSD
    - Mobile money
    - Payouts
    """
    
    def __init__(self):
        self.secret_key = PaymentConfig.FLUTTERWAVE_SECRET_KEY
        self.public_key = PaymentConfig.FLUTTERWAVE_PUBLIC_KEY
        self.encryption_key = PaymentConfig.FLUTTERWAVE_ENCRYPTION_KEY
        self.webhook_secret = PaymentConfig.FLUTTERWAVE_WEBHOOK_SECRET
        self.base_url = "https://api.flutterwave.com/v3"
    
    @property
    def provider(self) -> PaymentProvider:
        return PaymentProvider.FLUTTERWAVE
    
    @property
    def supported_methods(self) -> List[PaymentMethod]:
        return [PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER, PaymentMethod.USSD, PaymentMethod.MOBILE_MONEY]
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }
    
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize Flutterwave payment"""
        logger.info(f"Initializing Flutterwave payment: {request.reference}")
        
        # In production: POST {base_url}/payments
        
        return PaymentResponse(
            reference=request.reference,
            provider_reference=f"FLW_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PENDING,
            amount=request.amount,
            fee=request.amount * 0.014,  # 1.4%
            currency=request.currency,
            provider=PaymentProvider.FLUTTERWAVE,
            authorization_url=f"https://checkout.flutterwave.com/v3/hosted/pay/{uuid.uuid4().hex[:12]}",
            message="Payment initialized"
        )
    
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify Flutterwave payment"""
        logger.info(f"Verifying Flutterwave payment: {reference}")
        
        # In production: GET {base_url}/transactions/verify_by_reference?tx_ref={reference}
        
        return PaymentResponse(
            reference=reference,
            provider_reference=f"FLW_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.FLUTTERWAVE,
            payment_method=PaymentMethod.CARD,
            message="Payment verified"
        )
    
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate Flutterwave transfer"""
        logger.info(f"Initiating Flutterwave payout: {request.reference}")
        
        # In production: POST {base_url}/transfers
        
        return PayoutResponse(
            reference=request.reference,
            provider_reference=f"FLW_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PROCESSING,
            amount=request.amount,
            fee=10.75,
            provider=PaymentProvider.FLUTTERWAVE,
            message="Transfer initiated"
        )
    
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify Flutterwave transfer"""
        logger.info(f"Verifying Flutterwave payout: {reference}")
        
        return PayoutResponse(
            reference=reference,
            provider_reference=f"FLW_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.FLUTTERWAVE,
            message="Transfer completed"
        )
    
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process Flutterwave refund"""
        logger.info(f"Processing Flutterwave refund: {request.original_reference}")
        
        # In production: POST {base_url}/transactions/{id}/refund
        
        return RefundResponse(
            reference=f"FLW_REF_{uuid.uuid4().hex[:12].upper()}",
            original_reference=request.original_reference,
            status=PaymentStatus.REFUNDED,
            amount=request.amount or 0,
            message="Refund processed"
        )
    
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify Flutterwave webhook signature"""
        return signature == self.webhook_secret
    
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse Flutterwave webhook"""
        event = payload.get("event", "")
        data = payload.get("data", {})
        
        status_map = {
            "charge.completed": PaymentStatus.SUCCESSFUL,
            "transfer.completed": PaymentStatus.SUCCESSFUL,
            "transfer.failed": PaymentStatus.FAILED
        }
        
        return WebhookEvent(
            event_type=event,
            reference=data.get("tx_ref", ""),
            provider=PaymentProvider.FLUTTERWAVE,
            status=status_map.get(event, PaymentStatus.PENDING),
            amount=float(data.get("amount", 0)),
            currency=data.get("currency", "NGN"),
            timestamp=datetime.utcnow(),
            raw_payload=payload
        )


# =============================================================================
# OPay Adapter
# =============================================================================

class OPayAdapter(PaymentAdapterInterface):
    """
    OPay Payment Adapter
    
    Supports:
    - OPay wallet payments
    - Bank transfers
    - USSD
    """
    
    def __init__(self):
        self.merchant_id = PaymentConfig.OPAY_MERCHANT_ID
        self.secret_key = PaymentConfig.OPAY_SECRET_KEY
        self.public_key = PaymentConfig.OPAY_PUBLIC_KEY
        self.base_url = "https://cashierapi.opayweb.com/api/v3"
    
    @property
    def provider(self) -> PaymentProvider:
        return PaymentProvider.OPAY
    
    @property
    def supported_methods(self) -> List[PaymentMethod]:
        return [PaymentMethod.WALLET, PaymentMethod.BANK_TRANSFER, PaymentMethod.USSD]
    
    def _generate_signature(self, data: str) -> str:
        return hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha512
        ).hexdigest()
    
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize OPay payment"""
        logger.info(f"Initializing OPay payment: {request.reference}")
        
        # In production: POST {base_url}/cashier/initialize
        
        return PaymentResponse(
            reference=request.reference,
            provider_reference=f"OPAY_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PENDING,
            amount=request.amount,
            fee=request.amount * 0.01,  # 1%
            currency=request.currency,
            provider=PaymentProvider.OPAY,
            authorization_url=f"https://cashier.opayweb.com/gateway?orderNo={request.reference}",
            message="Payment initialized"
        )
    
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify OPay payment"""
        logger.info(f"Verifying OPay payment: {reference}")
        
        # In production: POST {base_url}/cashier/status
        
        return PaymentResponse(
            reference=reference,
            provider_reference=f"OPAY_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.OPAY,
            payment_method=PaymentMethod.WALLET,
            message="Payment verified"
        )
    
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate OPay transfer"""
        logger.info(f"Initiating OPay payout: {request.reference}")
        
        # In production: POST {base_url}/transfer/toBank
        
        return PayoutResponse(
            reference=request.reference,
            provider_reference=f"OPAY_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PROCESSING,
            amount=request.amount,
            fee=10,
            provider=PaymentProvider.OPAY,
            message="Transfer initiated"
        )
    
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify OPay transfer"""
        return PayoutResponse(
            reference=reference,
            provider_reference=f"OPAY_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.OPAY,
            message="Transfer completed"
        )
    
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process OPay refund"""
        return RefundResponse(
            reference=f"OPAY_REF_{uuid.uuid4().hex[:12].upper()}",
            original_reference=request.original_reference,
            status=PaymentStatus.REFUNDED,
            amount=request.amount or 0,
            message="Refund processed"
        )
    
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify OPay webhook signature"""
        expected = self._generate_signature(payload.decode())
        return hmac.compare_digest(expected, signature)
    
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse OPay webhook"""
        return WebhookEvent(
            event_type=payload.get("event", ""),
            reference=payload.get("orderNo", ""),
            provider=PaymentProvider.OPAY,
            status=PaymentStatus.SUCCESSFUL if payload.get("status") == "SUCCESS" else PaymentStatus.FAILED,
            amount=float(payload.get("amount", 0)),
            currency=payload.get("currency", "NGN"),
            timestamp=datetime.utcnow(),
            raw_payload=payload
        )


# =============================================================================
# MTN MoMo Adapter
# =============================================================================

class MTNMoMoAdapter(PaymentAdapterInterface):
    """
    MTN Mobile Money Adapter
    
    Supports:
    - Mobile money collections
    - Mobile money disbursements
    """
    
    def __init__(self):
        self.api_key = PaymentConfig.MTN_MOMO_API_KEY
        self.user_id = PaymentConfig.MTN_MOMO_USER_ID
        self.subscription_key = PaymentConfig.MTN_MOMO_SUBSCRIPTION_KEY
        self.base_url = "https://sandbox.momodeveloper.mtn.com"  # Use production URL in prod
    
    @property
    def provider(self) -> PaymentProvider:
        return PaymentProvider.MTN_MOMO
    
    @property
    def supported_methods(self) -> List[PaymentMethod]:
        return [PaymentMethod.MOBILE_MONEY]
    
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize MTN MoMo collection"""
        logger.info(f"Initializing MTN MoMo payment: {request.reference}")
        
        # In production: POST {base_url}/collection/v1_0/requesttopay
        
        return PaymentResponse(
            reference=request.reference,
            provider_reference=f"MOMO_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PENDING,
            amount=request.amount,
            fee=0,  # MTN MoMo typically no fee for collections
            currency=request.currency,
            provider=PaymentProvider.MTN_MOMO,
            message="Payment request sent to customer phone"
        )
    
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify MTN MoMo payment"""
        logger.info(f"Verifying MTN MoMo payment: {reference}")
        
        # In production: GET {base_url}/collection/v1_0/requesttopay/{referenceId}
        
        return PaymentResponse(
            reference=reference,
            provider_reference=f"MOMO_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.MTN_MOMO,
            payment_method=PaymentMethod.MOBILE_MONEY,
            message="Payment verified"
        )
    
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate MTN MoMo disbursement"""
        logger.info(f"Initiating MTN MoMo payout: {request.reference}")
        
        # In production: POST {base_url}/disbursement/v1_0/transfer
        
        return PayoutResponse(
            reference=request.reference,
            provider_reference=f"MOMO_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.PROCESSING,
            amount=request.amount,
            fee=0,
            provider=PaymentProvider.MTN_MOMO,
            message="Disbursement initiated"
        )
    
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify MTN MoMo disbursement"""
        return PayoutResponse(
            reference=reference,
            provider_reference=f"MOMO_TRF_{uuid.uuid4().hex[:12].upper()}",
            status=PaymentStatus.SUCCESSFUL,
            amount=0,
            provider=PaymentProvider.MTN_MOMO,
            message="Disbursement completed"
        )
    
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process MTN MoMo refund (via disbursement)"""
        return RefundResponse(
            reference=f"MOMO_REF_{uuid.uuid4().hex[:12].upper()}",
            original_reference=request.original_reference,
            status=PaymentStatus.REFUNDED,
            amount=request.amount or 0,
            message="Refund processed via disbursement"
        )
    
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify MTN MoMo webhook"""
        # MTN MoMo uses different verification
        return True  # Simplified for POC
    
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse MTN MoMo webhook"""
        return WebhookEvent(
            event_type="payment",
            reference=payload.get("externalId", ""),
            provider=PaymentProvider.MTN_MOMO,
            status=PaymentStatus.SUCCESSFUL if payload.get("status") == "SUCCESSFUL" else PaymentStatus.FAILED,
            amount=float(payload.get("amount", 0)),
            currency=payload.get("currency", "NGN"),
            timestamp=datetime.utcnow(),
            raw_payload=payload
        )


# =============================================================================
# Internal Gateway Adapter
# =============================================================================

class InternalGatewayAdapter(PaymentAdapterInterface):
    """
    Internal Payment Gateway
    
    For custom payment processing when using own bank/MFB.
    Routes to bank adapter for actual processing.
    """
    
    def __init__(self):
        self._transactions: Dict[str, PaymentResponse] = {}
        self._payouts: Dict[str, PayoutResponse] = {}
    
    @property
    def provider(self) -> PaymentProvider:
        return PaymentProvider.INTERNAL
    
    @property
    def supported_methods(self) -> List[PaymentMethod]:
        return [PaymentMethod.BANK_TRANSFER, PaymentMethod.BANK_ACCOUNT]
    
    async def initialize_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initialize internal payment via virtual account"""
        logger.info(f"Initializing internal payment: {request.reference}")
        
        # Import bank adapter
        from app.bank_adapter import bank_service
        
        # Create virtual account for this payment
        va = await bank_service.create_escrow_virtual_account(
            escrow_id=request.reference,
            buyer_name=request.customer_name or "Customer",
            amount=request.amount
        )
        
        response = PaymentResponse(
            reference=request.reference,
            provider_reference=va.virtual_account_number,
            status=PaymentStatus.PENDING,
            amount=request.amount,
            fee=0,  # No fee for internal
            currency=request.currency,
            provider=PaymentProvider.INTERNAL,
            bank_details={
                "account_number": va.virtual_account_number,
                "account_name": va.account_name,
                "bank_name": va.bank_name,
                "bank_code": va.bank_code,
                "amount": request.amount,
                "expires_at": va.expires_at.isoformat() if va.expires_at else None
            },
            message="Transfer to the account details provided"
        )
        
        self._transactions[request.reference] = response
        return response
    
    async def verify_payment(self, reference: str) -> PaymentResponse:
        """Verify internal payment"""
        logger.info(f"Verifying internal payment: {reference}")
        
        from app.bank_adapter import bank_service
        
        status = await bank_service.get_escrow_funding_status(reference)
        
        if status.get("status") == "found" and status.get("is_fully_funded"):
            return PaymentResponse(
                reference=reference,
                provider_reference=status.get("virtual_account"),
                status=PaymentStatus.SUCCESSFUL,
                amount=status.get("amount_received", 0),
                provider=PaymentProvider.INTERNAL,
                payment_method=PaymentMethod.BANK_TRANSFER,
                message="Payment confirmed"
            )
        
        return PaymentResponse(
            reference=reference,
            provider_reference=status.get("virtual_account"),
            status=PaymentStatus.PENDING,
            amount=status.get("amount_received", 0),
            provider=PaymentProvider.INTERNAL,
            message=f"Awaiting payment. Received: {status.get('amount_received', 0)} / {status.get('amount_expected', 0)}"
        )
    
    async def initiate_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Initiate internal payout"""
        logger.info(f"Initiating internal payout: {request.reference}")
        
        from app.bank_adapter import bank_service
        
        response = await bank_service.payout_to_seller(
            escrow_id=request.reference,
            seller_account=request.recipient_account,
            seller_bank_code=request.recipient_bank_code,
            seller_name=request.recipient_name,
            amount=request.amount,
            idempotency_key=request.idempotency_key
        )
        
        payout_response = PayoutResponse(
            reference=request.reference,
            provider_reference=response.transaction_id,
            status=PaymentStatus.SUCCESSFUL if response.status.value == "successful" else PaymentStatus.PROCESSING,
            amount=request.amount,
            fee=response.fee,
            provider=PaymentProvider.INTERNAL,
            message=response.message
        )
        
        self._payouts[request.reference] = payout_response
        return payout_response
    
    async def verify_payout(self, reference: str) -> PayoutResponse:
        """Verify internal payout"""
        if reference in self._payouts:
            return self._payouts[reference]
        
        return PayoutResponse(
            reference=reference,
            provider_reference=None,
            status=PaymentStatus.PENDING,
            amount=0,
            provider=PaymentProvider.INTERNAL,
            message="Payout not found"
        )
    
    async def refund(self, request: RefundRequest) -> RefundResponse:
        """Process internal refund"""
        logger.info(f"Processing internal refund: {request.original_reference}")
        
        # In production, this would call bank_service.refund_to_buyer
        
        return RefundResponse(
            reference=f"INT_REF_{uuid.uuid4().hex[:12].upper()}",
            original_reference=request.original_reference,
            status=PaymentStatus.REFUNDED,
            amount=request.amount or 0,
            message="Refund processed"
        )
    
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify internal webhook"""
        from app.bank_adapter import bank_service
        return bank_service.core_banking.verify_webhook_signature(payload, signature)
    
    async def parse_webhook(self, payload: Dict[str, Any]) -> WebhookEvent:
        """Parse internal webhook"""
        return WebhookEvent(
            event_type="credit_notification",
            reference=payload.get("reference", ""),
            provider=PaymentProvider.INTERNAL,
            status=PaymentStatus.SUCCESSFUL,
            amount=float(payload.get("amount", 0)),
            currency=payload.get("currency", "NGN"),
            timestamp=datetime.utcnow(),
            raw_payload=payload
        )


# =============================================================================
# Unified Payment Service
# =============================================================================

class PaymentService:
    """
    Unified Payment Service
    
    Routes payments to appropriate provider based on:
    - User preference
    - Payment method
    - Amount
    - Availability
    """
    
    def __init__(self):
        self.adapters: Dict[PaymentProvider, PaymentAdapterInterface] = {
            PaymentProvider.PAYSTACK: PaystackAdapter(),
            PaymentProvider.FLUTTERWAVE: FlutterwaveAdapter(),
            PaymentProvider.OPAY: OPayAdapter(),
            PaymentProvider.MTN_MOMO: MTNMoMoAdapter(),
            PaymentProvider.INTERNAL: InternalGatewayAdapter(),
        }
        
        # Idempotency tracking
        self._idempotency_cache: Dict[str, Any] = {}
        
        # Transaction log
        self._transaction_log: List[Dict[str, Any]] = []
    
    def get_adapter(self, provider: PaymentProvider) -> PaymentAdapterInterface:
        """Get adapter for provider"""
        adapter = self.adapters.get(provider)
        if not adapter:
            raise ValueError(f"Unsupported provider: {provider}")
        return adapter
    
    def get_available_providers(self) -> List[Dict[str, Any]]:
        """Get list of available payment providers"""
        providers = []
        for provider, adapter in self.adapters.items():
            providers.append({
                "provider": provider.value,
                "name": provider.value.replace("_", " ").title(),
                "supported_methods": [m.value for m in adapter.supported_methods]
            })
        return providers
    
    async def initialize_payment(
        self,
        provider: PaymentProvider,
        request: PaymentRequest
    ) -> PaymentResponse:
        """Initialize payment with specified provider"""
        
        # Check idempotency
        if request.idempotency_key and request.idempotency_key in self._idempotency_cache:
            logger.info(f"Returning cached response for idempotency key: {request.idempotency_key}")
            return self._idempotency_cache[request.idempotency_key]
        
        adapter = self.get_adapter(provider)
        response = await adapter.initialize_payment(request)
        
        # Cache for idempotency
        if request.idempotency_key:
            self._idempotency_cache[request.idempotency_key] = response
        
        # Log transaction
        self._transaction_log.append({
            "type": "payment_init",
            "provider": provider.value,
            "reference": request.reference,
            "amount": request.amount,
            "status": response.status.value,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return response
    
    async def verify_payment(
        self,
        provider: PaymentProvider,
        reference: str
    ) -> PaymentResponse:
        """Verify payment status"""
        adapter = self.get_adapter(provider)
        return await adapter.verify_payment(reference)
    
    async def initiate_payout(
        self,
        provider: PaymentProvider,
        request: PayoutRequest
    ) -> PayoutResponse:
        """Initiate payout with specified provider"""
        
        # Check idempotency
        if request.idempotency_key and request.idempotency_key in self._idempotency_cache:
            return self._idempotency_cache[request.idempotency_key]
        
        adapter = self.get_adapter(provider)
        response = await adapter.initiate_payout(request)
        
        # Cache for idempotency
        if request.idempotency_key:
            self._idempotency_cache[request.idempotency_key] = response
        
        # Log transaction
        self._transaction_log.append({
            "type": "payout_init",
            "provider": provider.value,
            "reference": request.reference,
            "amount": request.amount,
            "status": response.status.value,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return response
    
    async def verify_payout(
        self,
        provider: PaymentProvider,
        reference: str
    ) -> PayoutResponse:
        """Verify payout status"""
        adapter = self.get_adapter(provider)
        return await adapter.verify_payout(reference)
    
    async def refund(
        self,
        provider: PaymentProvider,
        request: RefundRequest
    ) -> RefundResponse:
        """Process refund"""
        adapter = self.get_adapter(provider)
        return await adapter.refund(request)
    
    async def process_webhook(
        self,
        provider: PaymentProvider,
        payload: bytes,
        signature: str
    ) -> Dict[str, Any]:
        """Process webhook from provider"""
        adapter = self.get_adapter(provider)
        
        # Verify signature
        if not adapter.verify_webhook(payload, signature):
            logger.warning(f"Invalid webhook signature from {provider}")
            return {"status": "error", "message": "Invalid signature"}
        
        # Parse webhook
        payload_dict = json.loads(payload)
        event = await adapter.parse_webhook(payload_dict)
        event.signature_valid = True
        
        # Log event
        self._transaction_log.append({
            "type": "webhook",
            "provider": provider.value,
            "event_type": event.event_type,
            "reference": event.reference,
            "status": event.status.value,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "status": "success",
            "event_type": event.event_type,
            "reference": event.reference,
            "payment_status": event.status.value,
            "amount": event.amount
        }
    
    def get_transaction_log(
        self,
        limit: int = 100,
        provider: Optional[PaymentProvider] = None
    ) -> List[Dict[str, Any]]:
        """Get transaction log"""
        log = self._transaction_log
        if provider:
            log = [t for t in log if t.get("provider") == provider.value]
        return log[-limit:]
    
    async def get_best_provider(
        self,
        amount: float,
        payment_method: PaymentMethod,
        prefer_internal: bool = True
    ) -> PaymentProvider:
        """Get best provider for given criteria"""
        
        # If internal is preferred and supports the method
        if prefer_internal and payment_method in self.adapters[PaymentProvider.INTERNAL].supported_methods:
            return PaymentProvider.INTERNAL
        
        # Find providers that support the method
        for provider, adapter in self.adapters.items():
            if payment_method in adapter.supported_methods:
                return provider
        
        # Default to Paystack
        return PaymentProvider.PAYSTACK


# =============================================================================
# Singleton Instance
# =============================================================================

payment_service = PaymentService()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/payments", tags=["Payment Integration"])


class InitializePaymentRequest(BaseModel):
    provider: str
    reference: str
    amount: float
    currency: str = "NGN"
    email: Optional[str] = None
    phone: Optional[str] = None
    customer_name: Optional[str] = None
    description: str = ""
    callback_url: Optional[str] = None
    redirect_url: Optional[str] = None
    payment_methods: List[str] = ["card", "bank_transfer"]
    idempotency_key: Optional[str] = None
    metadata: Dict[str, Any] = {}


class InitiatePayoutRequest(BaseModel):
    provider: str
    reference: str
    amount: float
    recipient_account: str
    recipient_bank_code: str
    recipient_name: str
    currency: str = "NGN"
    narration: str = ""
    idempotency_key: Optional[str] = None


class RefundPaymentRequest(BaseModel):
    provider: str
    original_reference: str
    amount: Optional[float] = None
    reason: str = ""
    idempotency_key: Optional[str] = None


@router.get("/providers")
async def get_providers():
    """Get available payment providers"""
    return {"providers": payment_service.get_available_providers()}


@router.post("/initialize")
async def initialize_payment(request: InitializePaymentRequest):
    """Initialize a payment"""
    try:
        provider = PaymentProvider(request.provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")
    
    payment_methods = []
    for method in request.payment_methods:
        try:
            payment_methods.append(PaymentMethod(method))
        except ValueError:
            pass
    
    payment_request = PaymentRequest(
        reference=request.reference,
        amount=request.amount,
        currency=request.currency,
        email=request.email,
        phone=request.phone,
        customer_name=request.customer_name,
        description=request.description,
        callback_url=request.callback_url,
        redirect_url=request.redirect_url,
        payment_methods=payment_methods,
        idempotency_key=request.idempotency_key,
        metadata=request.metadata
    )
    
    response = await payment_service.initialize_payment(provider, payment_request)
    
    return {
        "reference": response.reference,
        "provider_reference": response.provider_reference,
        "status": response.status.value,
        "amount": response.amount,
        "fee": response.fee,
        "currency": response.currency,
        "provider": response.provider.value,
        "authorization_url": response.authorization_url,
        "access_code": response.access_code,
        "ussd_code": response.ussd_code,
        "bank_details": response.bank_details,
        "message": response.message
    }


@router.get("/verify/{provider}/{reference}")
async def verify_payment(provider: str, reference: str):
    """Verify payment status"""
    try:
        provider_enum = PaymentProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    response = await payment_service.verify_payment(provider_enum, reference)
    
    return {
        "reference": response.reference,
        "provider_reference": response.provider_reference,
        "status": response.status.value,
        "amount": response.amount,
        "fee": response.fee,
        "payment_method": response.payment_method.value if response.payment_method else None,
        "message": response.message
    }


@router.post("/payout")
async def initiate_payout(request: InitiatePayoutRequest):
    """Initiate a payout"""
    try:
        provider = PaymentProvider(request.provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")
    
    payout_request = PayoutRequest(
        reference=request.reference,
        amount=request.amount,
        recipient_account=request.recipient_account,
        recipient_bank_code=request.recipient_bank_code,
        recipient_name=request.recipient_name,
        currency=request.currency,
        narration=request.narration,
        idempotency_key=request.idempotency_key
    )
    
    response = await payment_service.initiate_payout(provider, payout_request)
    
    return {
        "reference": response.reference,
        "provider_reference": response.provider_reference,
        "status": response.status.value,
        "amount": response.amount,
        "fee": response.fee,
        "message": response.message
    }


@router.get("/payout/verify/{provider}/{reference}")
async def verify_payout(provider: str, reference: str):
    """Verify payout status"""
    try:
        provider_enum = PaymentProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    response = await payment_service.verify_payout(provider_enum, reference)
    
    return {
        "reference": response.reference,
        "provider_reference": response.provider_reference,
        "status": response.status.value,
        "amount": response.amount,
        "fee": response.fee,
        "message": response.message
    }


@router.post("/refund")
async def refund_payment(request: RefundPaymentRequest):
    """Process a refund"""
    try:
        provider = PaymentProvider(request.provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {request.provider}")
    
    refund_request = RefundRequest(
        original_reference=request.original_reference,
        amount=request.amount,
        reason=request.reason,
        idempotency_key=request.idempotency_key
    )
    
    response = await payment_service.refund(provider, refund_request)
    
    return {
        "reference": response.reference,
        "original_reference": response.original_reference,
        "status": response.status.value,
        "amount": response.amount,
        "message": response.message
    }


@router.post("/webhook/{provider}")
async def payment_webhook(
    provider: str,
    request: Request,
    x_paystack_signature: str = Header(None, alias="X-Paystack-Signature"),
    verif_hash: str = Header(None, alias="verif-hash"),
    x_signature: str = Header(None, alias="X-Signature")
):
    """Handle payment webhooks"""
    try:
        provider_enum = PaymentProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    payload = await request.body()
    
    # Get appropriate signature header
    signature = x_paystack_signature or verif_hash or x_signature or ""
    
    result = await payment_service.process_webhook(provider_enum, payload, signature)
    
    return result


@router.get("/transactions")
async def get_transactions(
    limit: int = 100,
    provider: Optional[str] = None
):
    """Get transaction log"""
    provider_enum = None
    if provider:
        try:
            provider_enum = PaymentProvider(provider)
        except ValueError:
            pass
    
    return {"transactions": payment_service.get_transaction_log(limit, provider_enum)}


@router.get("/best-provider")
async def get_best_provider(
    amount: float,
    payment_method: str = "bank_transfer",
    prefer_internal: bool = True
):
    """Get recommended provider for given criteria"""
    try:
        method = PaymentMethod(payment_method)
    except ValueError:
        method = PaymentMethod.BANK_TRANSFER
    
    provider = await payment_service.get_best_provider(amount, method, prefer_internal)
    
    return {
        "recommended_provider": provider.value,
        "amount": amount,
        "payment_method": method.value,
        "prefer_internal": prefer_internal
    }
