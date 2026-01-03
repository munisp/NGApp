"""
Payment Gateway Hardening for SocialEscrow
End-to-end Paystack/Flutterwave integration with reconciliation,
idempotency, retry logic, and clear wallet balance views.
"""

import hashlib
import hmac
import json
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Optional, List, Dict
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer, Index

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class PaymentProvider(str, Enum):
    PAYSTACK = "paystack"
    FLUTTERWAVE = "flutterwave"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    ABANDONED = "abandoned"
    REVERSED = "reversed"
    REFUNDED = "refunded"


class PayoutStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    REVERSED = "reversed"


class TransferRecipientType(str, Enum):
    NUBAN = "nuban"  # Nigerian bank account
    MOBILE_MONEY = "mobile_money"
    BARTER = "barter"


# Database Models
class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    __table_args__ = (
        Index("idx_payment_idempotency", "idempotency_key", unique=True),
    )
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # Idempotency
    idempotency_key = Column(String(100), unique=True, nullable=False)
    
    # References
    escrow_id = Column(String(36), ForeignKey("escrows.id"), index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    # Provider details
    provider = Column(SQLEnum(PaymentProvider), nullable=False)
    provider_reference = Column(String(100), unique=True, index=True)
    provider_transaction_id = Column(String(100))
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    fee = Column(Float, default=0.0)
    net_amount = Column(Float)
    
    # Status
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    status_message = Column(Text)
    
    # Payment method
    payment_method = Column(String(50))  # card, bank_transfer, ussd
    card_last4 = Column(String(4))
    card_brand = Column(String(20))
    bank_name = Column(String(100))
    
    # Metadata
    metadata_json = Column(Text)
    
    # Retry tracking
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime)
    
    # Reconciliation
    reconciled = Column(Boolean, default=False)
    reconciled_at = Column(DateTime)
    reconciliation_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)


class PayoutTransaction(Base):
    __tablename__ = "payout_transactions"
    __table_args__ = (
        Index("idx_payout_idempotency", "idempotency_key", unique=True),
    )
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # Idempotency
    idempotency_key = Column(String(100), unique=True, nullable=False)
    
    # References
    escrow_id = Column(String(36), ForeignKey("escrows.id"), index=True)
    user_id = Column(String(36), nullable=False, index=True)
    recipient_id = Column(String(36), ForeignKey("transfer_recipients.id"))
    
    # Provider details
    provider = Column(SQLEnum(PaymentProvider), nullable=False)
    provider_reference = Column(String(100), unique=True, index=True)
    provider_transfer_id = Column(String(100))
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    fee = Column(Float, default=0.0)
    net_amount = Column(Float)
    
    # Status
    status = Column(SQLEnum(PayoutStatus), default=PayoutStatus.PENDING)
    status_message = Column(Text)
    
    # Retry tracking
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime)
    
    # Reconciliation
    reconciled = Column(Boolean, default=False)
    reconciled_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)


class TransferRecipient(Base):
    __tablename__ = "transfer_recipients"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    # Provider recipient codes
    paystack_recipient_code = Column(String(100))
    flutterwave_recipient_id = Column(String(100))
    
    # Bank details
    recipient_type = Column(SQLEnum(TransferRecipientType), default=TransferRecipientType.NUBAN)
    bank_code = Column(String(10))
    bank_name = Column(String(100))
    account_number = Column(String(20))
    account_name = Column(String(200))
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WalletBalance(Base):
    __tablename__ = "wallet_balances"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # Balances
    available_balance = Column(Float, default=0.0)
    pending_balance = Column(Float, default=0.0)  # In escrow
    total_received = Column(Float, default=0.0)
    total_withdrawn = Column(Float, default=0.0)
    
    currency = Column(String(3), default="NGN")
    
    # Last activity
    last_credit_at = Column(DateTime)
    last_debit_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReconciliationLog(Base):
    __tablename__ = "reconciliation_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    provider = Column(SQLEnum(PaymentProvider), nullable=False)
    reconciliation_date = Column(DateTime, nullable=False)
    
    # Counts
    total_transactions = Column(Integer, default=0)
    matched_transactions = Column(Integer, default=0)
    unmatched_transactions = Column(Integer, default=0)
    
    # Amounts
    total_amount = Column(Float, default=0.0)
    matched_amount = Column(Float, default=0.0)
    discrepancy_amount = Column(Float, default=0.0)
    
    # Details
    unmatched_details = Column(Text)  # JSON
    
    # Status
    status = Column(String(20), default="completed")
    
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models
class InitiatePaymentRequest(BaseModel):
    escrow_id: str
    amount: float
    currency: str = "NGN"
    email: str
    callback_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class InitiatePayoutRequest(BaseModel):
    escrow_id: str
    user_id: str
    amount: float
    currency: str = "NGN"
    reason: Optional[str] = None


class AddBankAccountRequest(BaseModel):
    bank_code: str
    account_number: str


# Payment Provider Clients
class PaystackClient:
    """Paystack API client with retry logic and idempotency"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.base_url = "https://api.paystack.co"
    
    def _get_headers(self, idempotency_key: Optional[str] = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Paystack webhook signature"""
        expected = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    
    async def initialize_transaction(
        self,
        email: str,
        amount: int,  # In kobo
        reference: str,
        callback_url: Optional[str] = None,
        metadata: Optional[dict] = None,
        idempotency_key: Optional[str] = None
    ) -> dict:
        """Initialize a payment transaction"""
        
        payload = {
            "email": email,
            "amount": amount,
            "reference": reference,
            "callback_url": callback_url,
            "metadata": metadata or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transaction/initialize",
                json=payload,
                headers=self._get_headers(idempotency_key)
            )
            return response.json()
    
    async def verify_transaction(self, reference: str) -> dict:
        """Verify a transaction status"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transaction/verify/{reference}",
                headers=self._get_headers()
            )
            return response.json()
    
    async def create_transfer_recipient(
        self,
        name: str,
        account_number: str,
        bank_code: str,
        recipient_type: str = "nuban"
    ) -> dict:
        """Create a transfer recipient"""
        
        payload = {
            "type": recipient_type,
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "NGN",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transferrecipient",
                json=payload,
                headers=self._get_headers()
            )
            return response.json()
    
    async def initiate_transfer(
        self,
        amount: int,  # In kobo
        recipient_code: str,
        reference: str,
        reason: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> dict:
        """Initiate a transfer/payout"""
        
        payload = {
            "source": "balance",
            "amount": amount,
            "recipient": recipient_code,
            "reference": reference,
            "reason": reason or "Escrow payout",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transfer",
                json=payload,
                headers=self._get_headers(idempotency_key)
            )
            return response.json()
    
    async def verify_transfer(self, reference: str) -> dict:
        """Verify a transfer status"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transfer/verify/{reference}",
                headers=self._get_headers()
            )
            return response.json()
    
    async def resolve_account(self, account_number: str, bank_code: str) -> dict:
        """Resolve/verify a bank account"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/bank/resolve",
                params={"account_number": account_number, "bank_code": bank_code},
                headers=self._get_headers()
            )
            return response.json()
    
    async def list_banks(self) -> dict:
        """List all supported banks"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/bank",
                headers=self._get_headers()
            )
            return response.json()
    
    async def get_balance(self) -> dict:
        """Get Paystack balance"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/balance",
                headers=self._get_headers()
            )
            return response.json()
    
    async def list_transactions(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: Optional[str] = None,
        per_page: int = 100
    ) -> dict:
        """List transactions for reconciliation"""
        
        params = {"perPage": per_page}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        if status:
            params["status"] = status
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transaction",
                params=params,
                headers=self._get_headers()
            )
            return response.json()


class FlutterwaveClient:
    """Flutterwave API client with retry logic and idempotency"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.base_url = "https://api.flutterwave.com/v3"
    
    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
    
    def verify_webhook_signature(self, signature: str, secret_hash: str) -> bool:
        """Verify Flutterwave webhook signature"""
        return hmac.compare_digest(signature, secret_hash)
    
    async def initialize_payment(
        self,
        tx_ref: str,
        amount: float,
        currency: str,
        email: str,
        redirect_url: Optional[str] = None,
        meta: Optional[dict] = None
    ) -> dict:
        """Initialize a payment"""
        
        payload = {
            "tx_ref": tx_ref,
            "amount": amount,
            "currency": currency,
            "redirect_url": redirect_url,
            "customer": {"email": email},
            "meta": meta or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payments",
                json=payload,
                headers=self._get_headers()
            )
            return response.json()
    
    async def verify_transaction(self, transaction_id: str) -> dict:
        """Verify a transaction"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transactions/{transaction_id}/verify",
                headers=self._get_headers()
            )
            return response.json()
    
    async def initiate_transfer(
        self,
        account_bank: str,
        account_number: str,
        amount: float,
        currency: str,
        reference: str,
        narration: Optional[str] = None
    ) -> dict:
        """Initiate a transfer/payout"""
        
        payload = {
            "account_bank": account_bank,
            "account_number": account_number,
            "amount": amount,
            "currency": currency,
            "reference": reference,
            "narration": narration or "Escrow payout",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transfers",
                json=payload,
                headers=self._get_headers()
            )
            return response.json()
    
    async def get_transfer(self, transfer_id: str) -> dict:
        """Get transfer status"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transfers/{transfer_id}",
                headers=self._get_headers()
            )
            return response.json()
    
    async def resolve_account(self, account_number: str, account_bank: str) -> dict:
        """Resolve/verify a bank account"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/accounts/resolve",
                json={"account_number": account_number, "account_bank": account_bank},
                headers=self._get_headers()
            )
            return response.json()
    
    async def get_banks(self, country: str = "NG") -> dict:
        """Get list of banks"""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/banks/{country}",
                headers=self._get_headers()
            )
            return response.json()


# Payment Gateway Service
class PaymentGatewayService:
    """Main payment gateway service with provider abstraction"""
    
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = [5, 30, 120]  # Exponential backoff
    
    def __init__(
        self,
        event_bus: EventBus,
        redis_client: Any,
        ledger_client: Any,
        paystack_client: Optional[PaystackClient] = None,
        flutterwave_client: Optional[FlutterwaveClient] = None,
        default_provider: PaymentProvider = PaymentProvider.PAYSTACK
    ):
        self.event_bus = event_bus
        self.redis = redis_client
        self.ledger = ledger_client
        self.paystack = paystack_client
        self.flutterwave = flutterwave_client
        self.default_provider = default_provider
    
    def _generate_reference(self, prefix: str = "EP") -> str:
        """Generate unique payment reference"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(100000, 999999)
        return f"{prefix}-{timestamp}-{suffix}"
    
    def _generate_idempotency_key(self, escrow_id: str, action: str) -> str:
        """Generate idempotency key"""
        return f"{escrow_id}:{action}:{datetime.utcnow().strftime('%Y%m%d')}"
    
    async def initiate_payment(
        self,
        db,
        user_id: str,
        request: InitiatePaymentRequest,
        provider: Optional[PaymentProvider] = None
    ) -> PaymentTransaction:
        """Initiate a payment transaction"""
        
        provider = provider or self.default_provider
        reference = self._generate_reference("PAY")
        idempotency_key = self._generate_idempotency_key(request.escrow_id, "payment")
        
        # Check for existing transaction with same idempotency key
        existing = db.query(PaymentTransaction).filter(
            PaymentTransaction.idempotency_key == idempotency_key
        ).first()
        
        if existing:
            return existing
        
        # Create transaction record
        transaction = PaymentTransaction(
            idempotency_key=idempotency_key,
            escrow_id=request.escrow_id,
            user_id=user_id,
            provider=provider,
            provider_reference=reference,
            amount=request.amount,
            currency=request.currency,
            metadata_json=json.dumps(request.metadata) if request.metadata else None,
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        # Initialize with provider
        try:
            if provider == PaymentProvider.PAYSTACK and self.paystack:
                result = await self.paystack.initialize_transaction(
                    email=request.email,
                    amount=int(request.amount * 100),  # Convert to kobo
                    reference=reference,
                    callback_url=request.callback_url,
                    metadata=request.metadata,
                    idempotency_key=idempotency_key
                )
                
                if result.get("status"):
                    transaction.status = PaymentStatus.PROCESSING
                    transaction.metadata_json = json.dumps({
                        **(request.metadata or {}),
                        "authorization_url": result["data"]["authorization_url"],
                        "access_code": result["data"]["access_code"],
                    })
                else:
                    transaction.status = PaymentStatus.FAILED
                    transaction.status_message = result.get("message", "Initialization failed")
            
            elif provider == PaymentProvider.FLUTTERWAVE and self.flutterwave:
                result = await self.flutterwave.initialize_payment(
                    tx_ref=reference,
                    amount=request.amount,
                    currency=request.currency,
                    email=request.email,
                    redirect_url=request.callback_url,
                    meta=request.metadata
                )
                
                if result.get("status") == "success":
                    transaction.status = PaymentStatus.PROCESSING
                    transaction.metadata_json = json.dumps({
                        **(request.metadata or {}),
                        "payment_link": result["data"]["link"],
                    })
                else:
                    transaction.status = PaymentStatus.FAILED
                    transaction.status_message = result.get("message", "Initialization failed")
            
            else:
                transaction.status = PaymentStatus.FAILED
                transaction.status_message = f"Provider {provider} not configured"
        
        except Exception as e:
            transaction.status = PaymentStatus.FAILED
            transaction.status_message = str(e)
        
        db.commit()
        db.refresh(transaction)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="payment.initiated",
            data={
                "transaction_id": transaction.id,
                "escrow_id": request.escrow_id,
                "amount": request.amount,
                "provider": provider.value,
                "status": transaction.status.value,
            }
        ))
        
        return transaction
    
    async def verify_payment(
        self,
        db,
        reference: str
    ) -> PaymentTransaction:
        """Verify a payment transaction"""
        
        transaction = db.query(PaymentTransaction).filter(
            PaymentTransaction.provider_reference == reference
        ).first()
        
        if not transaction:
            raise ValueError("Transaction not found")
        
        try:
            if transaction.provider == PaymentProvider.PAYSTACK and self.paystack:
                result = await self.paystack.verify_transaction(reference)
                
                if result.get("status") and result["data"]["status"] == "success":
                    transaction.status = PaymentStatus.SUCCESS
                    transaction.provider_transaction_id = str(result["data"]["id"])
                    transaction.fee = result["data"].get("fees", 0) / 100
                    transaction.net_amount = transaction.amount - transaction.fee
                    transaction.payment_method = result["data"].get("channel")
                    
                    if result["data"].get("authorization"):
                        auth = result["data"]["authorization"]
                        transaction.card_last4 = auth.get("last4")
                        transaction.card_brand = auth.get("brand")
                        transaction.bank_name = auth.get("bank")
                    
                    transaction.completed_at = datetime.utcnow()
                    
                    # Credit escrow account in ledger
                    await self._credit_escrow(transaction)
                
                elif result["data"]["status"] == "failed":
                    transaction.status = PaymentStatus.FAILED
                    transaction.status_message = result["data"].get("gateway_response", "Payment failed")
            
            elif transaction.provider == PaymentProvider.FLUTTERWAVE and self.flutterwave:
                result = await self.flutterwave.verify_transaction(
                    transaction.provider_transaction_id or reference
                )
                
                if result.get("status") == "success" and result["data"]["status"] == "successful":
                    transaction.status = PaymentStatus.SUCCESS
                    transaction.provider_transaction_id = str(result["data"]["id"])
                    transaction.fee = result["data"].get("app_fee", 0)
                    transaction.net_amount = transaction.amount - transaction.fee
                    transaction.payment_method = result["data"].get("payment_type")
                    transaction.completed_at = datetime.utcnow()
                    
                    await self._credit_escrow(transaction)
                
                elif result["data"]["status"] == "failed":
                    transaction.status = PaymentStatus.FAILED
                    transaction.status_message = result["data"].get("processor_response", "Payment failed")
        
        except Exception as e:
            transaction.status_message = str(e)
            transaction.retry_count += 1
            transaction.last_retry_at = datetime.utcnow()
        
        db.commit()
        db.refresh(transaction)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="payment.verified",
            data={
                "transaction_id": transaction.id,
                "escrow_id": transaction.escrow_id,
                "status": transaction.status.value,
            }
        ))
        
        return transaction
    
    async def _credit_escrow(self, transaction: PaymentTransaction):
        """Credit escrow account in TigerBeetle ledger"""
        
        await self.ledger.transfer(
            from_account=f"payment_gateway:{transaction.provider.value}",
            to_account=f"escrow:{transaction.escrow_id}",
            amount=int(transaction.net_amount * 100),
            reference=f"payment:{transaction.id}",
        )
    
    async def initiate_payout(
        self,
        db,
        request: InitiatePayoutRequest,
        provider: Optional[PaymentProvider] = None
    ) -> PayoutTransaction:
        """Initiate a payout to seller"""
        
        provider = provider or self.default_provider
        reference = self._generate_reference("PYT")
        idempotency_key = self._generate_idempotency_key(request.escrow_id, "payout")
        
        # Check for existing payout with same idempotency key
        existing = db.query(PayoutTransaction).filter(
            PayoutTransaction.idempotency_key == idempotency_key
        ).first()
        
        if existing:
            return existing
        
        # Get recipient
        recipient = db.query(TransferRecipient).filter(
            TransferRecipient.user_id == request.user_id,
            TransferRecipient.is_active == True
        ).first()
        
        if not recipient:
            raise ValueError("No active bank account found for user")
        
        # Create payout record
        payout = PayoutTransaction(
            idempotency_key=idempotency_key,
            escrow_id=request.escrow_id,
            user_id=request.user_id,
            recipient_id=recipient.id,
            provider=provider,
            provider_reference=reference,
            amount=request.amount,
            currency=request.currency,
        )
        
        db.add(payout)
        db.commit()
        db.refresh(payout)
        
        # Initiate with provider
        try:
            if provider == PaymentProvider.PAYSTACK and self.paystack:
                if not recipient.paystack_recipient_code:
                    # Create recipient first
                    result = await self.paystack.create_transfer_recipient(
                        name=recipient.account_name,
                        account_number=recipient.account_number,
                        bank_code=recipient.bank_code
                    )
                    if result.get("status"):
                        recipient.paystack_recipient_code = result["data"]["recipient_code"]
                        db.commit()
                    else:
                        raise ValueError("Failed to create transfer recipient")
                
                result = await self.paystack.initiate_transfer(
                    amount=int(request.amount * 100),
                    recipient_code=recipient.paystack_recipient_code,
                    reference=reference,
                    reason=request.reason,
                    idempotency_key=idempotency_key
                )
                
                if result.get("status"):
                    payout.status = PayoutStatus.QUEUED
                    payout.provider_transfer_id = str(result["data"]["id"])
                else:
                    payout.status = PayoutStatus.FAILED
                    payout.status_message = result.get("message", "Transfer failed")
            
            elif provider == PaymentProvider.FLUTTERWAVE and self.flutterwave:
                result = await self.flutterwave.initiate_transfer(
                    account_bank=recipient.bank_code,
                    account_number=recipient.account_number,
                    amount=request.amount,
                    currency=request.currency,
                    reference=reference,
                    narration=request.reason
                )
                
                if result.get("status") == "success":
                    payout.status = PayoutStatus.QUEUED
                    payout.provider_transfer_id = str(result["data"]["id"])
                else:
                    payout.status = PayoutStatus.FAILED
                    payout.status_message = result.get("message", "Transfer failed")
            
            else:
                payout.status = PayoutStatus.FAILED
                payout.status_message = f"Provider {provider} not configured"
        
        except Exception as e:
            payout.status = PayoutStatus.FAILED
            payout.status_message = str(e)
        
        db.commit()
        db.refresh(payout)
        
        # Debit escrow account in ledger
        if payout.status == PayoutStatus.QUEUED:
            await self.ledger.transfer(
                from_account=f"escrow:{request.escrow_id}",
                to_account=f"payout_pending:{payout.id}",
                amount=int(request.amount * 100),
                reference=f"payout:{payout.id}",
            )
        
        # Publish event
        await self.event_bus.publish(Event(
            type="payout.initiated",
            data={
                "payout_id": payout.id,
                "escrow_id": request.escrow_id,
                "user_id": request.user_id,
                "amount": request.amount,
                "status": payout.status.value,
            }
        ))
        
        return payout
    
    async def add_bank_account(
        self,
        db,
        user_id: str,
        request: AddBankAccountRequest
    ) -> TransferRecipient:
        """Add and verify a bank account"""
        
        # Verify account with Paystack
        if self.paystack:
            result = await self.paystack.resolve_account(
                request.account_number,
                request.bank_code
            )
            
            if not result.get("status"):
                raise ValueError("Could not verify bank account")
            
            account_name = result["data"]["account_name"]
        else:
            account_name = "Unknown"
        
        # Get bank name
        banks = await self.paystack.list_banks() if self.paystack else {"data": []}
        bank_name = next(
            (b["name"] for b in banks.get("data", []) if b["code"] == request.bank_code),
            "Unknown Bank"
        )
        
        # Create or update recipient
        recipient = db.query(TransferRecipient).filter(
            TransferRecipient.user_id == user_id,
            TransferRecipient.account_number == request.account_number,
            TransferRecipient.bank_code == request.bank_code
        ).first()
        
        if not recipient:
            recipient = TransferRecipient(
                user_id=user_id,
                bank_code=request.bank_code,
                bank_name=bank_name,
                account_number=request.account_number,
                account_name=account_name,
                is_verified=True,
                verified_at=datetime.utcnow(),
            )
            db.add(recipient)
        else:
            recipient.account_name = account_name
            recipient.is_verified = True
            recipient.verified_at = datetime.utcnow()
        
        db.commit()
        db.refresh(recipient)
        
        return recipient
    
    async def get_wallet_balance(self, db, user_id: str) -> WalletBalance:
        """Get user's wallet balance"""
        
        balance = db.query(WalletBalance).filter(
            WalletBalance.user_id == user_id
        ).first()
        
        if not balance:
            balance = WalletBalance(user_id=user_id)
            db.add(balance)
            db.commit()
            db.refresh(balance)
        
        return balance
    
    async def run_reconciliation(
        self,
        db,
        provider: PaymentProvider,
        date: datetime
    ) -> ReconciliationLog:
        """Run daily reconciliation with payment provider"""
        
        from_date = date.strftime("%Y-%m-%d")
        to_date = (date + timedelta(days=1)).strftime("%Y-%m-%d")
        
        log = ReconciliationLog(
            provider=provider,
            reconciliation_date=date,
        )
        
        try:
            if provider == PaymentProvider.PAYSTACK and self.paystack:
                result = await self.paystack.list_transactions(
                    from_date=from_date,
                    to_date=to_date,
                    status="success"
                )
                
                provider_transactions = {
                    t["reference"]: t for t in result.get("data", [])
                }
            else:
                provider_transactions = {}
            
            # Get our transactions for the same period
            our_transactions = db.query(PaymentTransaction).filter(
                PaymentTransaction.provider == provider,
                PaymentTransaction.created_at >= date,
                PaymentTransaction.created_at < date + timedelta(days=1)
            ).all()
            
            matched = 0
            unmatched = []
            total_amount = 0
            matched_amount = 0
            
            for txn in our_transactions:
                total_amount += txn.amount
                log.total_transactions += 1
                
                if txn.provider_reference in provider_transactions:
                    matched += 1
                    matched_amount += txn.amount
                    txn.reconciled = True
                    txn.reconciled_at = datetime.utcnow()
                else:
                    unmatched.append({
                        "reference": txn.provider_reference,
                        "amount": txn.amount,
                        "status": txn.status.value,
                    })
            
            log.matched_transactions = matched
            log.unmatched_transactions = len(unmatched)
            log.total_amount = total_amount
            log.matched_amount = matched_amount
            log.discrepancy_amount = total_amount - matched_amount
            log.unmatched_details = json.dumps(unmatched)
            log.status = "completed"
        
        except Exception as e:
            log.status = "failed"
            log.unmatched_details = json.dumps({"error": str(e)})
        
        db.add(log)
        db.commit()
        db.refresh(log)
        
        return log


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


@router.post("/initiate")
async def initiate_payment(
    request: InitiatePaymentRequest,
    user_id: str = Query(...),
    provider: Optional[PaymentProvider] = None,
    db: Session = Depends(get_db),
):
    """Initiate a payment transaction"""
    from app.main import get_payment_gateway_service
    service = get_payment_gateway_service()
    
    transaction = await service.initiate_payment(db, user_id, request, provider)
    
    metadata = json.loads(transaction.metadata_json) if transaction.metadata_json else {}
    
    return {
        "transaction_id": transaction.id,
        "reference": transaction.provider_reference,
        "status": transaction.status.value,
        "authorization_url": metadata.get("authorization_url") or metadata.get("payment_link"),
    }


@router.get("/verify/{reference}")
async def verify_payment(
    reference: str,
    db: Session = Depends(get_db),
):
    """Verify a payment transaction"""
    try:
        from app.main import get_payment_gateway_service
        service = get_payment_gateway_service()
        transaction = await service.verify_payment(db, reference)
        return {
            "transaction_id": transaction.id,
            "status": transaction.status.value,
            "amount": transaction.amount,
            "fee": transaction.fee,
            "net_amount": transaction.net_amount,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/payout")
async def initiate_payout(
    request: InitiatePayoutRequest,
    provider: Optional[PaymentProvider] = None,
    db: Session = Depends(get_db),
):
    """Initiate a payout to seller"""
    try:
        from app.main import get_payment_gateway_service
        service = get_payment_gateway_service()
        payout = await service.initiate_payout(db, request, provider)
        return {
            "payout_id": payout.id,
            "reference": payout.provider_reference,
            "status": payout.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bank-accounts")
async def add_bank_account(
    request: AddBankAccountRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Add and verify a bank account"""
    try:
        from app.main import get_payment_gateway_service
        service = get_payment_gateway_service()
        recipient = await service.add_bank_account(db, user_id, request)
        return {
            "recipient_id": recipient.id,
            "account_name": recipient.account_name,
            "bank_name": recipient.bank_name,
            "is_verified": recipient.is_verified,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wallet/{user_id}")
async def get_wallet_balance(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get user's wallet balance"""
    from app.main import get_payment_gateway_service
    service = get_payment_gateway_service()
    balance = await service.get_wallet_balance(db, user_id)
    return {
        "available_balance": balance.available_balance,
        "pending_balance": balance.pending_balance,
        "total_received": balance.total_received,
        "total_withdrawn": balance.total_withdrawn,
        "currency": balance.currency,
    }


@router.post("/webhook/paystack")
async def paystack_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle Paystack webhook"""
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    
    from app.main import get_payment_gateway_service
    service = get_payment_gateway_service()
    
    if service.paystack and not service.paystack.verify_webhook_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    data = json.loads(payload)
    event = data.get("event")
    
    if event == "charge.success":
        reference = data["data"]["reference"]
        await service.verify_payment(db, reference)
    
    elif event == "transfer.success":
        reference = data["data"]["reference"]
        payout = db.query(PayoutTransaction).filter(
            PayoutTransaction.provider_reference == reference
        ).first()
        if payout:
            payout.status = PayoutStatus.SUCCESS
            payout.completed_at = datetime.utcnow()
            db.commit()
    
    elif event == "transfer.failed":
        reference = data["data"]["reference"]
        payout = db.query(PayoutTransaction).filter(
            PayoutTransaction.provider_reference == reference
        ).first()
        if payout:
            payout.status = PayoutStatus.FAILED
            payout.status_message = data["data"].get("reason", "Transfer failed")
            db.commit()
    
    return {"status": "ok"}


@router.get("/banks")
async def list_banks():
    """List supported banks"""
    from app.main import get_payment_gateway_service
    service = get_payment_gateway_service()
    
    if service.paystack:
        result = await service.paystack.list_banks()
        return result.get("data", [])
    
    return []
