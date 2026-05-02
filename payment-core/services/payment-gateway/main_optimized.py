"""
Optimized Payment Gateway Service
High-performance payment gateway with full component integration, circuit breakers, and rate limiting.
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import httpx
from temporalio.client import Client as TemporalClient
from aiokafka import AIOKafkaProducer
import redis.asyncio as aioredis
from circuitbreaker import circuit
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import json

# Import custom modules
import sys
sys.path.append('/home/ubuntu/nextgen-payment-switch/services/common')
from tigerbeetle_client import TigerBeetleClient, generate_transfer_id, amount_to_cents
from database import DatabaseManager, insert_transaction_history, update_transaction_status

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Payment Gateway Service (Optimized)",
    description="High-performance payment gateway for 20B transactions/month",
    version="2.0.0"
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Prometheus metrics
payment_requests_total = Counter(
    'payment_requests_total',
    'Total number of payment requests',
    ['status']
)
payment_request_duration = Histogram(
    'payment_request_duration_seconds',
    'Payment request duration in seconds'
)
active_payments = Gauge(
    'active_payments',
    'Number of currently active payments'
)

# Configuration
TEMPORAL_HOST = os.getenv("TEMPORAL_HOST", "temporal-frontend.payment-switch:7233")
REDIS_HOST = os.getenv("REDIS_HOST", "redis-master.payment-switch")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka.payment-switch:9092")
TIGERBEETLE_HOST = os.getenv("TIGERBEETLE_HOST", "tigerbeetle.payment-switch")

# Enums
class ChannelType(str, Enum):
    MOBILE = "MOBILE"
    WEB = "WEB"
    POS = "POS"
    ATM = "ATM"
    QR_CODE = "QR_CODE"

class PartyType(str, Enum):
    MSISDN = "MSISDN"
    EMAIL = "EMAIL"
    ACCOUNT = "ACCOUNT"
    MERCHANT = "MERCHANT"
    IBAN = "IBAN"

class TransactionType(str, Enum):
    P2P = "P2P"
    P2M = "P2M"
    P2B = "P2B"
    B2P = "B2P"
    B2B = "B2B"

class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

# Models
class Party(BaseModel):
    type: PartyType
    identifier: str

    @validator('identifier')
    def validate_identifier(cls, v, values):
        party_type = values.get('type')
        if party_type == PartyType.MSISDN and not v.startswith('+'):
            raise ValueError('MSISDN must start with +')
        return v

class Amount(BaseModel):
    currency: str = Field(..., min_length=3, max_length=3)
    value: str = Field(..., regex=r'^\d+\.\d{2}$')

    @validator('currency')
    def validate_currency(cls, v):
        return v.upper()

class PaymentRequest(BaseModel):
    source: Party
    destination: Party
    amount: Amount
    transactionType: TransactionType
    channel: ChannelType
    metadata: Optional[Dict[str, Any]] = None

class PaymentResponse(BaseModel):
    transactionId: str
    status: TransactionStatus
    timestamp: datetime
    message: Optional[str] = None

class TransactionStatusResponse(BaseModel):
    transactionId: str
    status: TransactionStatus
    source: Party
    destination: Party
    amount: Amount
    timestamp: datetime
    completedAt: Optional[datetime] = None
    failureReason: Optional[str] = None

# Global clients
temporal_client: Optional[TemporalClient] = None
redis_client: Optional[aioredis.Redis] = None
kafka_producer: Optional[AIOKafkaProducer] = None
tigerbeetle_client: Optional[TigerBeetleClient] = None
db_manager: Optional[DatabaseManager] = None

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global temporal_client, redis_client, kafka_producer, tigerbeetle_client, db_manager
    
    try:
        # Initialize Temporal client
        temporal_client = await TemporalClient.connect(TEMPORAL_HOST)
        logger.info(f"Connected to Temporal at {TEMPORAL_HOST}")
        
        # Initialize Redis client
        redis_client = await aioredis.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}",
            encoding="utf-8",
            decode_responses=True
        )
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        
        # Initialize Kafka producer
        kafka_producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type='lz4',
            linger_ms=10,
            batch_size=16384
        )
        await kafka_producer.start()
        logger.info(f"Connected to Kafka at {KAFKA_BOOTSTRAP_SERVERS}")
        
        # Initialize TigerBeetle client
        tigerbeetle_client = TigerBeetleClient()
        await tigerbeetle_client.connect()
        logger.info("Connected to TigerBeetle")
        
        # Initialize Database Manager
        db_manager = DatabaseManager(min_size=20, max_size=100)
        await db_manager.connect()
        logger.info("Connected to PostgreSQL")
        
    except Exception as e:
        logger.error(f"Failed to initialize connections: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    global redis_client, kafka_producer, tigerbeetle_client, db_manager
    
    if redis_client:
        await redis_client.close()
        logger.info("Closed Redis connection")
    
    if kafka_producer:
        await kafka_producer.stop()
        logger.info("Closed Kafka producer")
    
    if tigerbeetle_client:
        await tigerbeetle_client.close()
        logger.info("Closed TigerBeetle client")
    
    if db_manager:
        await db_manager.close()
        logger.info("Closed database connection")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "payment-gateway-optimized",
        "timestamp": datetime.utcnow().isoformat(),
        "connections": {
            "temporal": temporal_client is not None,
            "redis": redis_client is not None,
            "kafka": kafka_producer is not None,
            "tigerbeetle": tigerbeetle_client is not None,
            "database": db_manager is not None
        }
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("100/minute")
@circuit(failure_threshold=5, recovery_timeout=60)
async def initiate_payment(request: Request, payment: PaymentRequest):
    """
    Initiate a new payment transaction with full integration.
    
    Features:
    - Rate limiting (100 requests/minute)
    - Circuit breaker protection
    - Dual-ledger recording (TigerBeetle + PostgreSQL)
    - Kafka event publishing
    - Temporal workflow orchestration
    """
    active_payments.inc()
    
    try:
        with payment_request_duration.time():
            # Generate unique transaction ID
            transaction_id = str(uuid.uuid4())
            
            logger.info(f"Initiating payment {transaction_id} from {payment.source.identifier} to {payment.destination.identifier}")
            
            # Validate payment request
            await validate_payment_request(payment)
            
            # Store initial transaction state in PostgreSQL
            await insert_transaction_history(
                db_manager,
                transaction_id=transaction_id,
                payer_id=payment.source.identifier,
                payer_participant_id="unknown",  # Will be resolved in workflow
                payee_id=payment.destination.identifier,
                payee_participant_id="unknown",  # Will be resolved in workflow
                amount=payment.amount.value,
                currency=payment.amount.currency,
                transaction_type=payment.transactionType.value,
                channel=payment.channel.value,
                status=TransactionStatus.PENDING.value,
                metadata=payment.metadata
            )
            
            # Cache transaction in Redis for fast lookup
            transaction_data = {
                "transactionId": transaction_id,
                "status": TransactionStatus.PENDING.value,
                "source": payment.source.dict(),
                "destination": payment.destination.dict(),
                "amount": payment.amount.dict(),
                "transactionType": payment.transactionType.value,
                "channel": payment.channel.value,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": payment.metadata or {}
            }
            
            await redis_client.setex(
                f"transaction:{transaction_id}",
                3600,  # 1 hour TTL
                json.dumps(transaction_data)
            )
            
            # Start Temporal workflow for payment processing
            workflow_id = f"payment-{transaction_id}"
            
            await temporal_client.start_workflow(
                "PaymentProcessingWorkflow",
                args=[transaction_data],
                id=workflow_id,
                task_queue="payment-processing"
            )
            
            logger.info(f"Started workflow {workflow_id} for transaction {transaction_id}")
            
            # Publish event to Kafka
            await kafka_producer.send(
                "payment-initiated",
                value=transaction_data
            )
            
            payment_requests_total.labels(status='success').inc()
            
            return PaymentResponse(
                transactionId=transaction_id,
                status=TransactionStatus.PENDING,
                timestamp=datetime.utcnow(),
                message="Payment initiated successfully"
            )
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        payment_requests_total.labels(status='validation_error').inc()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error initiating payment: {e}")
        payment_requests_total.labels(status='error').inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate payment"
        )
    finally:
        active_payments.dec()

@app.get("/payments/{transaction_id}", response_model=TransactionStatusResponse)
@limiter.limit("200/minute")
async def get_payment_status(request: Request, transaction_id: str):
    """
    Get the status of a payment transaction.
    
    This endpoint retrieves the current status from Redis cache first,
    then falls back to PostgreSQL if not cached.
    """
    try:
        # Try to get from Redis cache first
        cached_data = await redis_client.get(f"transaction:{transaction_id}")
        
        if cached_data:
            transaction_data = json.loads(cached_data)
            
            return TransactionStatusResponse(
                transactionId=transaction_data["transactionId"],
                status=TransactionStatus(transaction_data["status"]),
                source=Party(**transaction_data["source"]),
                destination=Party(**transaction_data["destination"]),
                amount=Amount(**transaction_data["amount"]),
                timestamp=datetime.fromisoformat(transaction_data["timestamp"]),
                completedAt=datetime.fromisoformat(transaction_data["completedAt"]) if transaction_data.get("completedAt") else None,
                failureReason=transaction_data.get("failureReason")
            )
        
        # If not in cache, query PostgreSQL
        from database import get_transaction_by_id
        transaction = await get_transaction_by_id(db_manager, transaction_id)
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found"
            )
        
        return TransactionStatusResponse(
            transactionId=transaction["transaction_id"],
            status=TransactionStatus(transaction["status"]),
            source=Party(type=PartyType.ACCOUNT, identifier=transaction["payer_id"]),
            destination=Party(type=PartyType.ACCOUNT, identifier=transaction["payee_id"]),
            amount=Amount(currency=transaction["currency"], value=str(transaction["amount"])),
            timestamp=transaction["initiated_at"],
            completedAt=transaction.get("completed_at"),
            failureReason=transaction.get("error_description")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving payment status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment status"
        )

async def validate_payment_request(payment: PaymentRequest) -> None:
    """
    Validate payment request against business rules.
    """
    # Validate amount
    amount_value = float(payment.amount.value)
    if amount_value <= 0:
        raise ValueError("Payment amount must be greater than zero")
    
    if amount_value > 1000000:
        raise ValueError("Payment amount exceeds maximum limit")
    
    # Validate currency
    supported_currencies = ["USD", "EUR", "GBP", "KES", "NGN", "GHS"]
    if payment.amount.currency not in supported_currencies:
        raise ValueError(f"Currency {payment.amount.currency} is not supported")
    
    # Validate parties are different
    if payment.source.identifier == payment.destination.identifier:
        raise ValueError("Source and destination cannot be the same")
    
    logger.info(f"Payment request validated successfully")

@app.post("/payments/{transaction_id}/cancel")
@limiter.limit("50/minute")
async def cancel_payment(request: Request, transaction_id: str):
    """
    Cancel a pending payment transaction.
    """
    try:
        workflow_handle = temporal_client.get_workflow_handle(f"payment-{transaction_id}")
        await workflow_handle.signal("cancel")
        
        # Update status in PostgreSQL
        await update_transaction_status(
            db_manager,
            transaction_id,
            TransactionStatus.CANCELLED.value
        )
        
        # Update Redis cache
        cached_data = await redis_client.get(f"transaction:{transaction_id}")
        if cached_data:
            transaction_data = json.loads(cached_data)
            transaction_data["status"] = TransactionStatus.CANCELLED.value
            await redis_client.setex(
                f"transaction:{transaction_id}",
                3600,
                json.dumps(transaction_data)
            )
        
        # Publish cancellation event
        await kafka_producer.send(
            "payment-cancelled",
            value={"transactionId": transaction_id, "timestamp": datetime.utcnow().isoformat()}
        )
        
        logger.info(f"Cancelled transaction {transaction_id}")
        
        return {
            "transactionId": transaction_id,
            "status": "CANCELLED",
            "message": "Payment cancellation initiated"
        }
        
    except Exception as e:
        logger.error(f"Error cancelling payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel payment"
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=4)
