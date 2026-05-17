"""
Payment Gateway Idempotency Service
Ensures idempotent payment processing with Paystack, Flutterwave, and other gateways
"""

import hashlib
import hmac
import json
import httpx
import redis
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import uuid

logger = logging.getLogger(__name__)


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentGateway(str, Enum):
    PAYSTACK = "paystack"
    FLUTTERWAVE = "flutterwave"
    OPAY = "opay"
    KUDA = "kuda"
    PALMPAY = "palmpay"


@dataclass
class PaymentRequest:
    idempotency_key: str
    customer_id: str
    amount: float
    currency: str
    email: str
    reference: str
    gateway: PaymentGateway
    metadata: Optional[Dict[str, Any]] = None
    callback_url: Optional[str] = None


@dataclass
class PaymentResult:
    idempotency_key: str
    reference: str
    gateway_reference: Optional[str]
    status: PaymentStatus
    amount: float
    currency: str
    gateway: PaymentGateway
    gateway_response: Optional[Dict[str, Any]]
    authorization_url: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class IdempotentPaymentService:
    """
    Service for processing payments with idempotency guarantees.
    Prevents duplicate charges by tracking payment requests.
    """
    
    def __init__(
        self,
        redis_host: str = "redis",
        redis_port: int = 6379,
        redis_db: int = 4,
        paystack_secret_key: Optional[str] = None,
        flutterwave_secret_key: Optional[str] = None
    ):
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=True
        )
        self.key_prefix = "payment:idempotency:"
        self.ttl = 86400 * 30  # 30 days
        
        self.paystack_secret = paystack_secret_key
        self.flutterwave_secret = flutterwave_secret_key
        
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    def _get_key(self, idempotency_key: str) -> str:
        """Generate Redis key from idempotency key"""
        return f"{self.key_prefix}{idempotency_key}"
    
    def _generate_idempotency_key(
        self,
        customer_id: str,
        amount: float,
        reference: str
    ) -> str:
        """Generate idempotency key from payment details"""
        content = f"{customer_id}:{amount}:{reference}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_cached_payment(self, idempotency_key: str) -> Optional[PaymentResult]:
        """Retrieve cached payment result"""
        key = self._get_key(idempotency_key)
        cached = self.redis_client.get(key)
        
        if cached:
            data = json.loads(cached)
            return PaymentResult(
                idempotency_key=data["idempotency_key"],
                reference=data["reference"],
                gateway_reference=data.get("gateway_reference"),
                status=PaymentStatus(data["status"]),
                amount=data["amount"],
                currency=data["currency"],
                gateway=PaymentGateway(data["gateway"]),
                gateway_response=data.get("gateway_response"),
                authorization_url=data.get("authorization_url"),
                created_at=data.get("created_at"),
                completed_at=data.get("completed_at"),
                error_message=data.get("error_message")
            )
        return None
    
    def cache_payment(self, result: PaymentResult):
        """Cache payment result"""
        key = self._get_key(result.idempotency_key)
        data = {
            "idempotency_key": result.idempotency_key,
            "reference": result.reference,
            "gateway_reference": result.gateway_reference,
            "status": result.status.value,
            "amount": result.amount,
            "currency": result.currency,
            "gateway": result.gateway.value,
            "gateway_response": result.gateway_response,
            "authorization_url": result.authorization_url,
            "created_at": result.created_at,
            "completed_at": result.completed_at,
            "error_message": result.error_message
        }
        self.redis_client.setex(key, self.ttl, json.dumps(data))
    
    def is_processing(self, idempotency_key: str) -> bool:
        """Check if payment is currently being processed"""
        key = self._get_key(idempotency_key)
        lock_key = f"{key}:lock"
        return self.redis_client.exists(lock_key) == 1
    
    def acquire_lock(self, idempotency_key: str) -> bool:
        """Acquire processing lock for payment"""
        key = self._get_key(idempotency_key)
        lock_key = f"{key}:lock"
        acquired = self.redis_client.setnx(lock_key, "1")
        if acquired:
            self.redis_client.expire(lock_key, 300)  # 5 minute lock
        return acquired
    
    def release_lock(self, idempotency_key: str):
        """Release processing lock"""
        key = self._get_key(idempotency_key)
        lock_key = f"{key}:lock"
        self.redis_client.delete(lock_key)
    
    async def process_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Process payment with idempotency guarantee.
        Returns cached result if payment was already processed.
        """
        cached = self.get_cached_payment(request.idempotency_key)
        if cached:
            logger.info(f"Returning cached payment result for {request.idempotency_key[:8]}...")
            return cached
        
        if self.is_processing(request.idempotency_key):
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=None,
                status=PaymentStatus.PROCESSING,
                amount=request.amount,
                currency=request.currency,
                gateway=request.gateway,
                gateway_response=None,
                error_message="Payment is currently being processed"
            )
        
        if not self.acquire_lock(request.idempotency_key):
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=None,
                status=PaymentStatus.PROCESSING,
                amount=request.amount,
                currency=request.currency,
                gateway=request.gateway,
                gateway_response=None,
                error_message="Payment is currently being processed"
            )
        
        try:
            if request.gateway == PaymentGateway.PAYSTACK:
                result = await self._process_paystack(request)
            elif request.gateway == PaymentGateway.FLUTTERWAVE:
                result = await self._process_flutterwave(request)
            else:
                result = PaymentResult(
                    idempotency_key=request.idempotency_key,
                    reference=request.reference,
                    gateway_reference=None,
                    status=PaymentStatus.FAILED,
                    amount=request.amount,
                    currency=request.currency,
                    gateway=request.gateway,
                    gateway_response=None,
                    error_message=f"Unsupported gateway: {request.gateway.value}"
                )
            
            self.cache_payment(result)
            return result
            
        except Exception as e:
            logger.error(f"Payment processing error: {str(e)}")
            result = PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=None,
                status=PaymentStatus.FAILED,
                amount=request.amount,
                currency=request.currency,
                gateway=request.gateway,
                gateway_response=None,
                error_message=str(e)
            )
            self.cache_payment(result)
            return result
            
        finally:
            self.release_lock(request.idempotency_key)
    
    async def _process_paystack(self, request: PaymentRequest) -> PaymentResult:
        """Process payment through Paystack with idempotency key"""
        if not self.paystack_secret:
            raise ValueError("Paystack secret key not configured")
        
        payload = {
            "email": request.email,
            "amount": int(request.amount * 100),  # Paystack uses kobo
            "currency": request.currency,
            "reference": request.reference,
            "callback_url": request.callback_url,
            "metadata": request.metadata or {}
        }
        
        headers = {
            "Authorization": f"Bearer {self.paystack_secret}",
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotency_key  # Paystack supports idempotency keys
        }
        
        response = await self.http_client.post(
            "https://api.paystack.co/transaction/initialize",
            json=payload,
            headers=headers
        )
        
        data = response.json()
        
        if response.status_code == 200 and data.get("status"):
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=data["data"].get("reference"),
                status=PaymentStatus.PENDING,
                amount=request.amount,
                currency=request.currency,
                gateway=PaymentGateway.PAYSTACK,
                gateway_response=data,
                authorization_url=data["data"].get("authorization_url"),
                created_at=datetime.utcnow().isoformat()
            )
        else:
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=None,
                status=PaymentStatus.FAILED,
                amount=request.amount,
                currency=request.currency,
                gateway=PaymentGateway.PAYSTACK,
                gateway_response=data,
                error_message=data.get("message", "Payment initialization failed")
            )
    
    async def _process_flutterwave(self, request: PaymentRequest) -> PaymentResult:
        """Process payment through Flutterwave with idempotency"""
        if not self.flutterwave_secret:
            raise ValueError("Flutterwave secret key not configured")
        
        payload = {
            "tx_ref": request.reference,
            "amount": request.amount,
            "currency": request.currency,
            "redirect_url": request.callback_url,
            "customer": {
                "email": request.email
            },
            "meta": request.metadata or {},
            "customizations": {
                "title": "Insurance Premium Payment"
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.flutterwave_secret}",
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotency_key  # Custom header for tracking
        }
        
        response = await self.http_client.post(
            "https://api.flutterwave.com/v3/payments",
            json=payload,
            headers=headers
        )
        
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "success":
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=data["data"].get("id"),
                status=PaymentStatus.PENDING,
                amount=request.amount,
                currency=request.currency,
                gateway=PaymentGateway.FLUTTERWAVE,
                gateway_response=data,
                authorization_url=data["data"].get("link"),
                created_at=datetime.utcnow().isoformat()
            )
        else:
            return PaymentResult(
                idempotency_key=request.idempotency_key,
                reference=request.reference,
                gateway_reference=None,
                status=PaymentStatus.FAILED,
                amount=request.amount,
                currency=request.currency,
                gateway=PaymentGateway.FLUTTERWAVE,
                gateway_response=data,
                error_message=data.get("message", "Payment initialization failed")
            )
    
    async def verify_payment(
        self,
        reference: str,
        gateway: PaymentGateway
    ) -> PaymentResult:
        """Verify payment status from gateway"""
        if gateway == PaymentGateway.PAYSTACK:
            return await self._verify_paystack(reference)
        elif gateway == PaymentGateway.FLUTTERWAVE:
            return await self._verify_flutterwave(reference)
        else:
            raise ValueError(f"Unsupported gateway: {gateway.value}")
    
    async def _verify_paystack(self, reference: str) -> PaymentResult:
        """Verify Paystack payment"""
        headers = {
            "Authorization": f"Bearer {self.paystack_secret}"
        }
        
        response = await self.http_client.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers=headers
        )
        
        data = response.json()
        
        if response.status_code == 200 and data.get("status"):
            tx_data = data["data"]
            status = PaymentStatus.SUCCESS if tx_data["status"] == "success" else PaymentStatus.FAILED
            
            return PaymentResult(
                idempotency_key=tx_data.get("reference", reference),
                reference=reference,
                gateway_reference=str(tx_data.get("id")),
                status=status,
                amount=tx_data["amount"] / 100,  # Convert from kobo
                currency=tx_data["currency"],
                gateway=PaymentGateway.PAYSTACK,
                gateway_response=data,
                completed_at=tx_data.get("paid_at")
            )
        else:
            return PaymentResult(
                idempotency_key=reference,
                reference=reference,
                gateway_reference=None,
                status=PaymentStatus.FAILED,
                amount=0,
                currency="NGN",
                gateway=PaymentGateway.PAYSTACK,
                gateway_response=data,
                error_message=data.get("message", "Verification failed")
            )
    
    async def _verify_flutterwave(self, reference: str) -> PaymentResult:
        """Verify Flutterwave payment"""
        headers = {
            "Authorization": f"Bearer {self.flutterwave_secret}"
        }
        
        response = await self.http_client.get(
            f"https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref={reference}",
            headers=headers
        )
        
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "success":
            tx_data = data["data"]
            status = PaymentStatus.SUCCESS if tx_data["status"] == "successful" else PaymentStatus.FAILED
            
            return PaymentResult(
                idempotency_key=tx_data.get("tx_ref", reference),
                reference=reference,
                gateway_reference=str(tx_data.get("id")),
                status=status,
                amount=tx_data["amount"],
                currency=tx_data["currency"],
                gateway=PaymentGateway.FLUTTERWAVE,
                gateway_response=data,
                completed_at=tx_data.get("created_at")
            )
        else:
            return PaymentResult(
                idempotency_key=reference,
                reference=reference,
                gateway_reference=None,
                status=PaymentStatus.FAILED,
                amount=0,
                currency="NGN",
                gateway=PaymentGateway.FLUTTERWAVE,
                gateway_response=data,
                error_message=data.get("message", "Verification failed")
            )
    
    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        gateway: PaymentGateway
    ) -> bool:
        """Verify webhook signature from payment gateway"""
        if gateway == PaymentGateway.PAYSTACK:
            expected = hmac.new(
                self.paystack_secret.encode(),
                payload,
                hashlib.sha512
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        
        elif gateway == PaymentGateway.FLUTTERWAVE:
            return signature == self.flutterwave_secret
        
        return False
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()


def generate_payment_reference(prefix: str = "INS") -> str:
    """Generate unique payment reference"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"{prefix}-{timestamp}-{unique_id}"
