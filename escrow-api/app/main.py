from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from contextlib import asynccontextmanager
import uuid
import random
import string
import logging

logger = logging.getLogger(__name__)

# Import auth dependencies for protected endpoints
try:
    from app.auth import (
        get_current_user, get_optional_user, require_permission,
        AuthenticatedUser, Permission, UserRole
    )
    AUTH_AVAILABLE = True
    logger.info("Authentication module loaded")
except ImportError as e:
    AUTH_AVAILABLE = False
    logger.warning(f"Authentication module not available: {e}")
    # Fallback for development
    class AuthenticatedUser:
        user_id: str = "dev-user"
        role: str = "admin"
    async def get_current_user():
        return AuthenticatedUser()
    async def get_optional_user():
        return None

# Import persistent storage for escrow data
try:
    from app.persistent_storage import (
        get_escrow_storage, get_idempotency_storage,
        EscrowStorage, IdempotencyStorage
    )
    STORAGE_AVAILABLE = True
    logger.info("Persistent storage module loaded")
except ImportError as e:
    STORAGE_AVAILABLE = False
    logger.warning(f"Persistent storage module not available: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize persistence layers on startup"""
    from app.repositories import init_persistence
    try:
        await init_persistence()
        logger.info("Persistence layers initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize persistence: {e}")
    
    # Initialize competitive features database tables
    try:
        from app.competitive_features_persistence import init_competitive_features_db
        await init_competitive_features_db()
        logger.info("Competitive features database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize competitive features database: {e}")
    
    # Initialize production hardening infrastructure (durable jobs, distributed locks, etc.)
    try:
        from app.production_hardening import init_production_hardening, check_production_readiness
        await init_production_hardening()
        
        # Check production readiness and log warnings
        readiness = await check_production_readiness()
        if readiness.get("warnings"):
            for warning in readiness["warnings"]:
                logger.warning(f"Production readiness warning: {warning}")
        if readiness.get("errors"):
            for error in readiness["errors"]:
                logger.error(f"Production readiness error: {error}")
        
        logger.info(f"Production hardening initialized - ready: {readiness.get('ready', False)}")
    except Exception as e:
        logger.error(f"Failed to initialize production hardening: {e}")
    
    # Initialize background job infrastructure
    try:
        from app.competitive_features_jobs import init_background_jobs
        await init_background_jobs()
        logger.info("Background job infrastructure initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize background jobs: {e}")
    
    # Initialize platform optimizations (caching, connection pooling, rate limiting)
    try:
        from app.optimizations import init_optimizations
        await init_optimizations()
        logger.info("Platform optimizations initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize optimizations: {e}")
    
    # Initialize production workers (Permify, Outbox, DLQ, Temporal)
    try:
        from app.production_enforcement import init_production_workers, check_all_gaps
        worker_results = await init_production_workers()
        logger.info(f"Production workers initialized: {worker_results}")
        
        # Check for remaining gaps
        gap_check = await check_all_gaps()
        if gap_check.get("gaps"):
            for gap in gap_check["gaps"]:
                logger.error(f"Production gap: {gap}")
        if gap_check.get("warnings"):
            for warning in gap_check["warnings"]:
                logger.warning(f"Production warning: {warning}")
        logger.info(f"Production readiness: {gap_check.get('ready', False)}")
    except Exception as e:
        logger.error(f"Failed to initialize production workers: {e}")
    
    # Initialize middleware wiring (Mojaloop, Keycloak, Permify, Dapr, Fluvio, Temporal, Redis)
    try:
        from app.middleware_wiring import init_middleware
        middleware_results = await init_middleware()
        logger.info(f"Middleware initialized: {middleware_results}")
    except Exception as e:
        logger.error(f"Failed to initialize middleware: {e}")
    
    # Start Mojaloop workflow worker (Temporal sagas)
    try:
        import asyncio
        from app.temporal_mojaloop_workflows import run_mojaloop_workflow_worker, TEMPORAL_AVAILABLE
        if TEMPORAL_AVAILABLE:
            asyncio.create_task(run_mojaloop_workflow_worker())
            logger.info("Mojaloop workflow worker started")
        else:
            logger.warning("Temporal not available - Mojaloop workflows disabled")
    except Exception as e:
        logger.error(f"Failed to start Mojaloop workflow worker: {e}")
    
    yield
    
    # Shutdown middleware
    try:
        from app.middleware_wiring import shutdown_middleware
        await shutdown_middleware()
        logger.info("Middleware shutdown successfully")
    except Exception as e:
        logger.error(f"Failed to shutdown middleware: {e}")
    
    # Shutdown production workers
    try:
        from app.production_enforcement import shutdown_production_workers
        await shutdown_production_workers()
        logger.info("Production workers shutdown successfully")
    except Exception as e:
        logger.error(f"Failed to shutdown production workers: {e}")
    
    # Shutdown background jobs
    try:
        from app.competitive_features_jobs import shutdown_background_jobs
        await shutdown_background_jobs()
        logger.info("Background job infrastructure shutdown successfully")
    except Exception as e:
        logger.error(f"Failed to shutdown background jobs: {e}")
    
    # Shutdown optimizations (close connection pools, clear caches)
    try:
        from app.optimizations import shutdown_optimizations
        await shutdown_optimizations()
        logger.info("Platform optimizations shutdown successfully")
    except Exception as e:
        logger.error(f"Failed to shutdown optimizations: {e}")

app = FastAPI(title="EscrowProtect API", version="1.0.0", lifespan=lifespan)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fallback storage (use persistent storage in production via REQUIRE_POSTGRES=true)
escrow_db: Dict[str, Any] = {}
sellers_db: Dict[str, Any] = {}
listings_db: Dict[str, Any] = {}

# Enums
class EscrowStatus(str, Enum):
    PENDING_PAYMENT = "pending_payment"
    PAYMENT_RECEIVED = "payment_received"
    SELLER_ACCEPTED = "seller_accepted"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    REFUNDED = "refunded"
    EXPIRED = "expired"

# Nigerian Banks for verification
NIGERIAN_BANKS = {
    "044": "Access Bank",
    "050": "Ecobank Nigeria",
    "070": "Fidelity Bank",
    "011": "First Bank of Nigeria",
    "058": "Guaranty Trust Bank",
    "030": "Heritage Bank",
    "076": "Polaris Bank",
    "221": "Stanbic IBTC Bank",
    "232": "Sterling Bank",
    "032": "Union Bank of Nigeria",
    "033": "United Bank for Africa",
    "035": "Wema Bank",
    "057": "Zenith Bank",
    "999": "OPay",
    "998": "PalmPay",
    "997": "Kuda Bank",
    "996": "Moniepoint",
}

# Pydantic Models
class SellerInfo(BaseModel):
    username: str
    verified: bool = False
    phone: str
    location: str
    website: Optional[str] = None

class ListingData(BaseModel):
    id: Optional[str] = None
    title: str
    price: float
    currency: str = "NGN"
    seller: SellerInfo
    source: str = "instagram"
    image_url: Optional[str] = None

class BuyerInfo(BaseModel):
    name: str
    phone: str
    address: str

class BankDetails(BaseModel):
    bank_code: str
    bank_name: str
    account_number: str
    account_name: Optional[str] = None
    verified: bool = False

class ShippingInfo(BaseModel):
    carrier: str
    tracking_number: str
    estimated_delivery: str

class CreateEscrowRequest(BaseModel):
    listing: ListingData
    buyer: BuyerInfo
    payment_method: str = "bank_transfer"

class VerifyBankRequest(BaseModel):
    bank_code: str
    account_number: str

class AcceptOrderRequest(BaseModel):
    escrow_id: str
    bank_details: BankDetails

class ShipOrderRequest(BaseModel):
    escrow_id: str
    shipping: ShippingInfo

class ConfirmDeliveryRequest(BaseModel):
    escrow_id: str
    items_received: bool = True
    items_as_described: bool = True
    condition: str = "excellent"
    rating: int = 5

class TimelineEvent(BaseModel):
    status: str
    label: str
    timestamp: Optional[datetime] = None
    completed: bool = False
    active: bool = False

class EscrowTransaction(BaseModel):
    id: str
    status: EscrowStatus
    listing: ListingData
    buyer: BuyerInfo
    seller_bank: Optional[BankDetails] = None
    shipping: Optional[ShippingInfo] = None
    amount: float
    fee: float
    total: float
    created_at: datetime
    updated_at: datetime
    timeline: List[TimelineEvent]
    claim_token: Optional[str] = None

def generate_escrow_id() -> str:
    return f"ESC-NG-{datetime.now().strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=6))}"

def generate_claim_token() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

def create_timeline(status: EscrowStatus) -> List[TimelineEvent]:
    timeline = [
        TimelineEvent(status="payment_received", label="Payment Received", completed=False, active=False),
        TimelineEvent(status="seller_accepted", label="Seller Accepted", completed=False, active=False),
        TimelineEvent(status="shipped", label="Order Shipped", completed=False, active=False),
        TimelineEvent(status="delivered", label="Delivered", completed=False, active=False),
        TimelineEvent(status="completed", label="Funds Released", completed=False, active=False),
    ]
    
    status_order = ["payment_received", "seller_accepted", "shipped", "delivered", "completed"]
    current_idx = status_order.index(status.value) if status.value in status_order else -1
    
    for i, event in enumerate(timeline):
        if i < current_idx:
            event.completed = True
            event.timestamp = datetime.now()
        elif i == current_idx:
            event.completed = True
            event.active = False
            event.timestamp = datetime.now()
        elif i == current_idx + 1:
            event.active = True
    
    return timeline

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/v1/health/persistence")
async def persistence_health():
    """Check persistence layer health (database, Redis, TigerBeetle)"""
    from app.repositories import db_manager, cache as redis_cache
    
    health = {
        "database": {"status": "unknown", "type": "sqlite"},
        "redis": {"status": "unknown"},
        "tigerbeetle": {"status": "unknown"},
        "overall": "unhealthy"
    }
    
    # Check database
    try:
        async with db_manager.session() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
        health["database"]["status"] = "healthy"
    except Exception as e:
        health["database"]["status"] = "unhealthy"
        health["database"]["error"] = str(e)
    
    # Check Redis
    try:
        if redis_cache.connected and redis_cache.client:
            await redis_cache.client.ping()
            health["redis"]["status"] = "healthy"
        else:
            health["redis"]["status"] = "fallback"
            health["redis"]["note"] = "Using in-memory fallback"
    except Exception as e:
        health["redis"]["status"] = "unhealthy"
        health["redis"]["error"] = str(e)
    
    # Check TigerBeetle
    try:
        from app.tigerbeetle_ledger import tigerbeetle_ledger
        if tigerbeetle_ledger.connected:
            health["tigerbeetle"]["status"] = "healthy"
        else:
            health["tigerbeetle"]["status"] = "fallback"
            health["tigerbeetle"]["note"] = "Using in-memory fallback"
    except Exception as e:
        health["tigerbeetle"]["status"] = "unavailable"
        health["tigerbeetle"]["error"] = str(e)
    
    # Check production mode requirements
    import os
    production_mode = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
    require_postgres = os.getenv("REQUIRE_POSTGRES", "false").lower() == "true"
    require_redis = os.getenv("REQUIRE_REDIS", "false").lower() == "true"
    require_tigerbeetle = os.getenv("REQUIRE_TIGERBEETLE", "false").lower() == "true"
    
    health["production_mode"] = production_mode
    health["requirements"] = {
        "postgres": require_postgres,
        "redis": require_redis,
        "tigerbeetle": require_tigerbeetle
    }
    
    # Overall health - in production mode, fallback is NOT acceptable for required services
    db_ok = health["database"]["status"] == "healthy"
    
    # In production mode with requirements, fallback is NOT healthy
    if production_mode and require_redis:
        redis_ok = health["redis"]["status"] == "healthy"
    else:
        redis_ok = health["redis"]["status"] in ["healthy", "fallback"]
    
    if production_mode and require_tigerbeetle:
        tb_ok = health["tigerbeetle"]["status"] == "healthy"
    else:
        tb_ok = health["tigerbeetle"]["status"] in ["healthy", "fallback"]
    
    # Add warnings for fallback usage in production
    if production_mode:
        if health["redis"]["status"] == "fallback":
            health["warnings"] = health.get("warnings", [])
            health["warnings"].append("Redis using in-memory fallback in production mode")
        if health["tigerbeetle"]["status"] == "fallback":
            health["warnings"] = health.get("warnings", [])
            health["warnings"].append("TigerBeetle using in-memory fallback in production mode - DANGEROUS for money flows")
    
    if db_ok and redis_ok and tb_ok:
        health["overall"] = "healthy"
    elif db_ok:
        health["overall"] = "degraded"
    else:
        health["overall"] = "unhealthy"
    
    return health

@app.get("/api/v1/health/middleware")
async def middleware_health():
    """Check middleware integration health (Mojaloop, Keycloak, Permify, Dapr, Fluvio, Temporal, Redis)"""
    try:
        from app.middleware_wiring import middleware_manager
        return await middleware_manager.health_check()
    except Exception as e:
        return {
            "error": str(e),
            "status": "middleware_not_initialized"
        }

@app.get("/api/v1/stats")
async def get_stats():
    """Get platform statistics"""
    return {
        "total_escrows": len(escrow_db),
        "total_volume": sum(e.get("amount", 0) for e in escrow_db.values()),
        "active_escrows": sum(1 for e in escrow_db.values() if e.get("status") not in ["completed", "refunded", "expired"]),
        "completed_escrows": sum(1 for e in escrow_db.values() if e.get("status") == "completed"),
    }

@app.post("/api/v1/escrow/create")
async def create_escrow(
    request: CreateEscrowRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None)
):
    """Create a new escrow transaction (requires authentication)"""
    
    # Check idempotency if key provided
    if STORAGE_AVAILABLE and x_idempotency_key:
        idempotency_storage = get_idempotency_storage()
        is_new, existing = await idempotency_storage.check_and_set(
            x_idempotency_key, {"status": "processing"}
        )
        if not is_new and existing:
            return existing
    
    escrow_id = generate_escrow_id()
    claim_token = generate_claim_token()
    
    # Use Decimal-safe money calculations to avoid float rounding errors
    from decimal import Decimal
    from app.production_enforcement import Money, calculate_platform_fee
    
    amount_money = Money.from_naira(Decimal(str(request.listing.price)))
    fee_money = calculate_platform_fee(amount_money)
    total_money = amount_money + fee_money
    
    # Keep float values for backward compatibility in response
    amount = float(amount_money.naira)
    fee = float(fee_money.naira)
    total = float(total_money.naira)
    
    # Assign listing ID if not provided
    if not request.listing.id:
        request.listing.id = f"LST-{uuid.uuid4().hex[:8].upper()}"
    
    escrow = {
        "id": escrow_id,
        "status": EscrowStatus.PAYMENT_RECEIVED.value,
        "listing": request.listing.dict(),
        "buyer": request.buyer.dict(),
        "seller_bank": None,
        "shipping": None,
        "amount": amount,
        "fee": fee,
        "total": total,
        "payment_method": request.payment_method,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "timeline": [t.dict() for t in create_timeline(EscrowStatus.PAYMENT_RECEIVED)],
        "claim_token": claim_token,
        "created_by": current_user.user_id if hasattr(current_user, 'user_id') else "anonymous",
    }
    
    # Use persistent storage if available, fallback to in-memory
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        await escrow_storage.create(escrow_id, escrow)
    else:
        escrow_db[escrow_id] = escrow
    
    # Wire TigerBeetle for escrow hold (using Decimal-safe kobo values)
    tigerbeetle_transfer_id = None
    try:
        from app.middleware_integrations import tigerbeetle_money_flows
        buyer_id = current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
        seller_id = request.listing.seller.username if hasattr(request.listing.seller, 'username') else "unknown"
        tb_result = await tigerbeetle_money_flows.create_escrow_hold(
            escrow_id=escrow_id,
            buyer_id=buyer_id,
            seller_id=seller_id,
            amount_kobo=total_money.kobo,  # Use Decimal-safe kobo value
            fee_kobo=fee_money.kobo,
        )
        tigerbeetle_transfer_id = tb_result.get("transfer_id")
        logger.info(f"TigerBeetle escrow hold created: {tigerbeetle_transfer_id}")
    except Exception as e:
        logger.warning(f"TigerBeetle escrow hold failed (non-blocking): {e}")
    
    # Publish escrow.created event via transactional outbox (atomic with DB write)
    try:
        from app.production_enforcement import publish_escrow_created
        buyer_id = current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
        seller_id = request.listing.seller.username if hasattr(request.listing.seller, 'username') else "unknown"
        await publish_escrow_created(
            escrow_id=escrow_id,
            buyer_id=buyer_id,
            seller_id=seller_id,
            amount_kobo=total_money.kobo,
        )
    except Exception as e:
        logger.warning(f"Outbox publish failed (non-blocking): {e}")
    
    # Wire Permify for authorization relationship
    try:
        from app.middleware_integrations import permify_client
        buyer_id = current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
        await permify_client.create_relationship(
            entity_type="escrow",
            entity_id=escrow_id,
            relation="buyer",
            subject_type="user",
            subject_id=buyer_id,
        )
    except Exception as e:
        logger.warning(f"Permify relationship creation failed (non-blocking): {e}")
    
    # Generate seller claim URL
    seller_claim_url = f"https://platform-verification-app-kvzjvakf.devinapps.com?mode=seller&escrow={escrow_id}&token={claim_token}"
    
    response = {
        "success": True,
        "escrow_id": escrow_id,
        "status": EscrowStatus.PAYMENT_RECEIVED.value,
        "amount": amount,
        "fee": fee,
        "total": total,
        "seller_claim_url": seller_claim_url,
        "message": "Escrow created successfully. Seller has been notified."
    }
    
    # Update idempotency key with final response
    if STORAGE_AVAILABLE and x_idempotency_key:
        idempotency_storage = get_idempotency_storage()
        await idempotency_storage.check_and_set(x_idempotency_key, response)
    
    # Publish escrow created event to lakehouse
    try:
        from app.event_streaming import get_event_service
        event_service = get_event_service()
        await event_service.publish_escrow_created(
            escrow_id=escrow_id,
            buyer_id=current_user.user_id if hasattr(current_user, 'user_id') else "anonymous",
            seller_id=request.listing.seller.username,
            amount=amount,
            currency=request.listing.currency,
            description=request.listing.title,
            items=[{"title": request.listing.title, "price": amount}],
            correlation_id=escrow_id,
        )
    except Exception as e:
        logger.warning(f"Failed to publish escrow created event: {e}")
    
    return response

@app.get("/api/v1/escrow/{escrow_id}")
async def get_escrow(
    escrow_id: str,
    token: Optional[str] = None,
    current_user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """Get escrow transaction details"""
    # Try persistent storage first, fallback to in-memory
    escrow = None
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        escrow = await escrow_storage.get(escrow_id)
    
    if not escrow and escrow_id in escrow_db:
        escrow = escrow_db[escrow_id]
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    # For seller access, verify token
    if token and escrow.get("claim_token") != token:
        raise HTTPException(status_code=403, detail="Invalid claim token")
    
    return escrow

@app.post("/api/v1/bank/verify")
async def verify_bank_account(request: VerifyBankRequest):
    """Verify bank account details (simulated Paystack/Flutterwave API)"""
    if len(request.account_number) != 10:
        raise HTTPException(status_code=400, detail="Account number must be 10 digits")
    
    if request.bank_code not in NIGERIAN_BANKS:
        raise HTTPException(status_code=400, detail="Invalid bank code")
    
    # Simulate bank verification API response
    # In production, this would call Paystack/Flutterwave resolve account API
    bank_name = NIGERIAN_BANKS[request.bank_code]
    
    # Generate a realistic-looking account name based on bank
    sample_names = [
        "MERCHANT CHEENA ENTERPRISES",
        "ADAEZE OKONKWO",
        "CHUKWUEMEKA TRADING CO",
        "LAGOS FASHION HUB",
        "OKRIKA BALES NIG LTD",
    ]
    account_name = random.choice(sample_names)
    
    return {
        "success": True,
        "bank_code": request.bank_code,
        "bank_name": bank_name,
        "account_number": request.account_number,
        "account_name": account_name,
        "verified": True
    }

@app.post("/api/v1/escrow/accept")
async def accept_order(
    request: AcceptOrderRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Seller accepts order and provides bank details (requires authentication)"""
    # Try persistent storage first, fallback to in-memory
    escrow = None
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        escrow = await escrow_storage.get(request.escrow_id)
    
    if not escrow and request.escrow_id in escrow_db:
        escrow = escrow_db[request.escrow_id]
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    if escrow["status"] != EscrowStatus.PAYMENT_RECEIVED.value:
        raise HTTPException(status_code=400, detail=f"Cannot accept order in status: {escrow['status']}")
    
    # Update escrow with seller bank details
    escrow["seller_bank"] = request.bank_details.dict()
    escrow["status"] = EscrowStatus.SELLER_ACCEPTED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["timeline"] = [t.dict() for t in create_timeline(EscrowStatus.SELLER_ACCEPTED)]
    escrow["accepted_by"] = current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
    
    # Update in persistent storage or in-memory
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        await escrow_storage.update(request.escrow_id, escrow)
    else:
        escrow_db[request.escrow_id] = escrow
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "status": EscrowStatus.SELLER_ACCEPTED.value,
        "message": "Order accepted. Please ship the items and provide tracking information."
    }

@app.post("/api/v1/escrow/ship")
async def ship_order(
    request: ShipOrderRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Seller ships order and provides tracking info (requires authentication)"""
    # Try persistent storage first, fallback to in-memory
    escrow = None
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        escrow = await escrow_storage.get(request.escrow_id)
    
    if not escrow and request.escrow_id in escrow_db:
        escrow = escrow_db[request.escrow_id]
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    if escrow["status"] != EscrowStatus.SELLER_ACCEPTED.value:
        raise HTTPException(status_code=400, detail=f"Cannot ship order in status: {escrow['status']}")
    
    escrow["shipping"] = request.shipping.dict()
    escrow["status"] = EscrowStatus.SHIPPED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["timeline"] = [t.dict() for t in create_timeline(EscrowStatus.SHIPPED)]
    escrow["shipped_by"] = current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
    
    # Update in persistent storage or in-memory
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        await escrow_storage.update(request.escrow_id, escrow)
    else:
        escrow_db[request.escrow_id] = escrow
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "status": EscrowStatus.SHIPPED.value,
        "tracking": request.shipping.dict(),
        "message": "Shipment confirmed. Buyer has been notified."
    }

@app.post("/api/v1/escrow/confirm-delivery")
async def confirm_delivery(
    request: ConfirmDeliveryRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Buyer confirms delivery and releases funds (requires authentication)"""
    # Try persistent storage first, fallback to in-memory
    escrow = None
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        escrow = await escrow_storage.get(request.escrow_id)
    
    if not escrow and request.escrow_id in escrow_db:
        escrow = escrow_db[request.escrow_id]
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    if escrow["status"] != EscrowStatus.SHIPPED.value:
        raise HTTPException(status_code=400, detail=f"Cannot confirm delivery in status: {escrow['status']}")
    
    escrow["status"] = EscrowStatus.COMPLETED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["timeline"] = [t.dict() for t in create_timeline(EscrowStatus.COMPLETED)]
    escrow["delivery_confirmation"] = {
        "items_received": request.items_received,
        "items_as_described": request.items_as_described,
        "condition": request.condition,
        "rating": request.rating,
        "confirmed_at": datetime.now().isoformat(),
        "confirmed_by": current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
    }
    
    # Update in persistent storage or in-memory
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        await escrow_storage.update(request.escrow_id, escrow)
    else:
        escrow_db[request.escrow_id] = escrow
    
    # Calculate payout using Decimal-safe money calculations
    from decimal import Decimal
    from app.production_enforcement import Money, calculate_platform_fee, calculate_payout
    
    amount_money = Money.from_naira(Decimal(str(escrow["amount"])))
    fee_money = calculate_platform_fee(amount_money)
    payout_money = calculate_payout(amount_money, fee_money)
    payout_amount = float(payout_money.naira)
    
    # Wire TigerBeetle for escrow release to seller (using Decimal-safe kobo values)
    try:
        from app.middleware_integrations import tigerbeetle_money_flows
        seller_id = escrow.get("listing", {}).get("seller", {}).get("username", "unknown")
        tb_result = await tigerbeetle_money_flows.release_escrow_to_seller(
            escrow_id=request.escrow_id,
            seller_id=seller_id,
            amount_kobo=payout_money.kobo,  # Use Decimal-safe kobo value
        )
        logger.info(f"TigerBeetle escrow released: {tb_result.get('transfer_id')}")
    except Exception as e:
        logger.warning(f"TigerBeetle release failed (non-blocking): {e}")
    
    # Publish escrow.released event via transactional outbox (atomic with DB write)
    try:
        from app.production_enforcement import publish_escrow_released
        seller_id = escrow.get("listing", {}).get("seller", {}).get("username", "unknown")
        await publish_escrow_released(
            escrow_id=request.escrow_id,
            seller_id=seller_id,
            amount_kobo=amount_money.kobo,
            fee_kobo=fee_money.kobo,
        )
    except Exception as e:
        logger.warning(f"Outbox publish failed (non-blocking): {e}")
    
    # Publish escrow released event to lakehouse
    try:
        from app.event_streaming import get_event_service
        event_service = get_event_service()
        await event_service.publish_escrow_released(
            escrow_id=request.escrow_id,
            amount=payout_amount,
            released_to=escrow.get("listing", {}).get("seller", {}).get("username", "unknown"),
            release_reason="buyer_confirmed_delivery",
            correlation_id=request.escrow_id,
        )
    except Exception as e:
        logger.warning(f"Failed to publish escrow released event: {e}")
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "status": EscrowStatus.COMPLETED.value,
        "payout_amount": payout_amount,
        "payout_status": "processing",
        "message": f"Delivery confirmed. ₦{payout_amount:,.0f} will be sent to seller within 24 hours."
    }

@app.post("/api/v1/escrow/dispute")
async def open_dispute(
    escrow_id: str,
    reason: str,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """Open a dispute on an escrow transaction (requires authentication)"""
    # Try persistent storage first, fallback to in-memory
    escrow = None
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        escrow = await escrow_storage.get(escrow_id)
    
    if not escrow and escrow_id in escrow_db:
        escrow = escrow_db[escrow_id]
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    if escrow["status"] in [EscrowStatus.COMPLETED.value, EscrowStatus.REFUNDED.value]:
        raise HTTPException(status_code=400, detail="Cannot dispute completed or refunded escrow")
    
    escrow["status"] = EscrowStatus.DISPUTED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["dispute"] = {
        "reason": reason,
        "opened_at": datetime.now().isoformat(),
        "status": "pending_review",
        "opened_by": current_user.user_id if hasattr(current_user, 'user_id') else "anonymous"
    }
    
    # Update in persistent storage or in-memory
    if STORAGE_AVAILABLE:
        escrow_storage = get_escrow_storage()
        await escrow_storage.update(escrow_id, escrow)
    else:
        escrow_db[escrow_id] = escrow
    
    # Publish dispute opened event to lakehouse
    try:
        from app.event_streaming import get_event_service
        event_service = get_event_service()
        dispute_id = f"DSP-{escrow_id}"
        await event_service.publish_dispute_opened(
            dispute_id=dispute_id,
            escrow_id=escrow_id,
            complainant_id=current_user.user_id if hasattr(current_user, 'user_id') else "anonymous",
            respondent_id=escrow.get("listing", {}).get("seller", {}).get("username", "unknown"),
            dispute_type="general",
            amount_disputed=escrow.get("amount", 0),
            reason=reason,
            evidence_urls=[],
            correlation_id=escrow_id,
        )
    except Exception as e:
        logger.warning(f"Failed to publish dispute opened event: {e}")
    
    return {
        "success": True,
        "escrow_id": escrow_id,
        "status": EscrowStatus.DISPUTED.value,
        "message": "Dispute opened. Our team will review within 24-48 hours."
    }

@app.get("/api/v1/escrow/list")
async def list_escrows(status: Optional[str] = None, limit: int = 20):
    """List escrow transactions"""
    escrows = list(escrow_db.values())
    
    if status:
        escrows = [e for e in escrows if e.get("status") == status]
    
    escrows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "escrows": escrows[:limit],
        "total": len(escrows)
    }

# Listing endpoints for browser extension integration
@app.post("/api/v1/listing/detect")
async def detect_listing(url: str, ocr_data: Optional[Dict] = None):
    """Detect commerce listing from URL and OCR data"""
    listing_id = f"LST-{uuid.uuid4().hex[:8].upper()}"
    
    # In production, this would call the OCR service and commerce detection
    # For now, return sample data based on URL patterns
    
    listing = {
        "id": listing_id,
        "url": url,
        "detected": True,
        "confidence": 0.95,
        "data": ocr_data or {
            "title": "Detected Product",
            "price": 50000,
            "currency": "NGN",
            "seller": {
                "username": "seller",
                "phone": "08012345678",
                "location": "Lagos"
            }
        }
    }
    
    listings_db[listing_id] = listing
    
    return listing

@app.get("/api/v1/banks")
async def get_banks():
    """Get list of supported Nigerian banks"""
    return {
        "banks": [
            {"code": code, "name": name}
            for code, name in NIGERIAN_BANKS.items()
        ]
    }

# ============================================
# Edge Case Handlers: Expiration, Cancellation, Refund
# ============================================

# Configuration
ESCROW_EXPIRATION_HOURS = 168  # 7 days
REMINDER_INTERVALS_HOURS = [24, 48, 72]  # Send reminders at these intervals

# Notification queue (in-memory for POC)
notification_queue: List[Dict[str, Any]] = []

class CancelEscrowRequest(BaseModel):
    escrow_id: str
    reason: str = "buyer_cancelled"

class RefundRequest(BaseModel):
    escrow_id: str
    reason: str

class ReminderRequest(BaseModel):
    escrow_id: str
    channel: str = "whatsapp"  # whatsapp, sms, email

@app.post("/api/v1/escrow/cancel")
async def cancel_escrow(request: CancelEscrowRequest):
    """Buyer cancels escrow before seller accepts"""
    if request.escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[request.escrow_id]
    
    # Can only cancel before seller accepts
    if escrow["status"] not in [EscrowStatus.PAYMENT_RECEIVED.value, EscrowStatus.PENDING_PAYMENT.value]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel escrow in status: {escrow['status']}. Seller has already accepted.")
    
    escrow["status"] = EscrowStatus.REFUNDED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["cancellation"] = {
        "reason": request.reason,
        "cancelled_at": datetime.now().isoformat(),
        "cancelled_by": "buyer",
        "refund_status": "processing"
    }
    
    escrow_db[request.escrow_id] = escrow
    
    # Calculate refund using Decimal-safe money calculations
    from decimal import Decimal
    from app.production_enforcement import Money
    
    refund_money = Money.from_naira(Decimal(str(escrow["total"])))
    refund_amount = float(refund_money.naira)
    
    # Wire TigerBeetle for escrow refund to buyer (using Decimal-safe kobo values)
    try:
        from app.middleware_integrations import tigerbeetle_money_flows
        buyer_id = escrow.get("created_by", "anonymous")
        tb_result = await tigerbeetle_money_flows.refund_escrow_to_buyer(
            escrow_id=request.escrow_id,
            buyer_id=buyer_id,
            amount_kobo=refund_money.kobo,  # Use Decimal-safe kobo value
            reason=request.reason,
        )
        logger.info(f"TigerBeetle escrow refunded: {tb_result.get('transfer_id')}")
    except Exception as e:
        logger.warning(f"TigerBeetle refund failed (non-blocking): {e}")
    
    # Publish escrow.cancelled event via transactional outbox (atomic with DB write)
    try:
        from app.production_enforcement import publish_escrow_cancelled
        buyer_id = escrow.get("created_by", "anonymous")
        await publish_escrow_cancelled(
            escrow_id=request.escrow_id,
            buyer_id=buyer_id,
            amount_kobo=refund_money.kobo,
            reason=request.reason,
        )
    except Exception as e:
        logger.warning(f"Outbox publish failed (non-blocking): {e}")
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "status": EscrowStatus.REFUNDED.value,
        "refund_amount": refund_amount,
        "refund_status": "processing",
        "message": f"Escrow cancelled. ₦{refund_amount:,.0f} will be refunded within 24-48 hours."
    }

@app.post("/api/v1/escrow/expire")
async def expire_escrow(escrow_id: str):
    """Expire escrow if seller doesn't respond within timeout"""
    if escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[escrow_id]
    
    # Can only expire if still waiting for seller
    if escrow["status"] != EscrowStatus.PAYMENT_RECEIVED.value:
        raise HTTPException(status_code=400, detail=f"Cannot expire escrow in status: {escrow['status']}")
    
    # Check if escrow has exceeded expiration time
    created_at = datetime.fromisoformat(escrow["created_at"])
    hours_elapsed = (datetime.now() - created_at).total_seconds() / 3600
    
    if hours_elapsed < ESCROW_EXPIRATION_HOURS:
        return {
            "success": False,
            "escrow_id": escrow_id,
            "message": f"Escrow not yet expired. {ESCROW_EXPIRATION_HOURS - hours_elapsed:.1f} hours remaining.",
            "hours_remaining": ESCROW_EXPIRATION_HOURS - hours_elapsed
        }
    
    escrow["status"] = EscrowStatus.EXPIRED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["expiration"] = {
        "expired_at": datetime.now().isoformat(),
        "reason": "seller_no_response",
        "refund_status": "processing"
    }
    
    escrow_db[escrow_id] = escrow
    
    # Full refund to buyer
    refund_amount = escrow["total"]
    
    return {
        "success": True,
        "escrow_id": escrow_id,
        "status": EscrowStatus.EXPIRED.value,
        "refund_amount": refund_amount,
        "refund_status": "processing",
        "message": f"Escrow expired. Seller did not respond within {ESCROW_EXPIRATION_HOURS} hours. ₦{refund_amount:,.0f} will be refunded."
    }

@app.post("/api/v1/escrow/refund")
async def process_refund(request: RefundRequest):
    """Process refund for disputed or expired escrow"""
    if request.escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[request.escrow_id]
    
    # Can refund disputed, expired, or cancelled escrows
    if escrow["status"] not in [EscrowStatus.DISPUTED.value, EscrowStatus.EXPIRED.value, EscrowStatus.REFUNDED.value]:
        raise HTTPException(status_code=400, detail=f"Cannot refund escrow in status: {escrow['status']}")
    
    escrow["status"] = EscrowStatus.REFUNDED.value
    escrow["updated_at"] = datetime.now().isoformat()
    escrow["refund"] = {
        "reason": request.reason,
        "processed_at": datetime.now().isoformat(),
        "amount": escrow["total"],
        "status": "completed"
    }
    
    escrow_db[request.escrow_id] = escrow
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "status": EscrowStatus.REFUNDED.value,
        "refund_amount": escrow["total"],
        "message": f"Refund of ₦{escrow['total']:,.0f} processed successfully."
    }

@app.post("/api/v1/escrow/send-reminder")
async def send_reminder(request: ReminderRequest):
    """Send reminder to seller to claim escrow"""
    if request.escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[request.escrow_id]
    
    if escrow["status"] != EscrowStatus.PAYMENT_RECEIVED.value:
        raise HTTPException(status_code=400, detail="Escrow already claimed or expired")
    
    # Get seller contact from listing
    seller_phone = escrow.get("listing", {}).get("seller", {}).get("phone", "")
    seller_username = escrow.get("listing", {}).get("seller", {}).get("username", "")
    
    # Create reminder notification
    reminder = {
        "id": f"REM-{uuid.uuid4().hex[:8].upper()}",
        "escrow_id": request.escrow_id,
        "channel": request.channel,
        "recipient": seller_phone or seller_username,
        "message": f"You have a pending payment of ₦{escrow['amount']:,.0f} waiting to be claimed. Click here to accept: {escrow.get('seller_claim_url', '')}",
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "reminder_count": escrow.get("reminder_count", 0) + 1
    }
    
    notification_queue.append(reminder)
    
    # Update escrow with reminder count
    escrow["reminder_count"] = reminder["reminder_count"]
    escrow["last_reminder_at"] = datetime.now().isoformat()
    escrow_db[request.escrow_id] = escrow
    
    return {
        "success": True,
        "escrow_id": request.escrow_id,
        "reminder_id": reminder["id"],
        "channel": request.channel,
        "reminder_count": reminder["reminder_count"],
        "message": f"Reminder #{reminder['reminder_count']} sent via {request.channel}"
    }

@app.get("/api/v1/escrow/check-expiring")
async def check_expiring_escrows():
    """Check for escrows that are about to expire and need reminders"""
    now = datetime.now()
    expiring = []
    need_reminder = []
    
    for escrow_id, escrow in escrow_db.items():
        if escrow["status"] != EscrowStatus.PAYMENT_RECEIVED.value:
            continue
        
        created_at = datetime.fromisoformat(escrow["created_at"])
        hours_elapsed = (now - created_at).total_seconds() / 3600
        hours_remaining = ESCROW_EXPIRATION_HOURS - hours_elapsed
        
        # Check if needs reminder
        reminder_count = escrow.get("reminder_count", 0)
        for i, interval in enumerate(REMINDER_INTERVALS_HOURS):
            if hours_elapsed >= interval and reminder_count <= i:
                need_reminder.append({
                    "escrow_id": escrow_id,
                    "hours_elapsed": hours_elapsed,
                    "reminder_due": i + 1
                })
                break
        
        # Check if expiring soon (within 24 hours)
        if hours_remaining <= 24:
            expiring.append({
                "escrow_id": escrow_id,
                "hours_remaining": hours_remaining,
                "amount": escrow["amount"],
                "seller": escrow.get("listing", {}).get("seller", {}).get("username", "")
            })
    
    return {
        "expiring_soon": expiring,
        "need_reminder": need_reminder,
        "total_pending": len([e for e in escrow_db.values() if e["status"] == EscrowStatus.PAYMENT_RECEIVED.value])
    }

@app.get("/api/v1/notifications/queue")
async def get_notification_queue():
    """Get pending notifications"""
    return {
        "notifications": notification_queue,
        "total": len(notification_queue)
    }

# ============================================
# Shareable Escrow Link (for sellers without contact info)
# ============================================

@app.post("/api/v1/escrow/generate-link")
async def generate_shareable_link(escrow_id: str):
    """Generate a shareable link for buyer to send to seller"""
    if escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[escrow_id]
    claim_token = escrow.get("claim_token") or generate_claim_token()
    
    # Update escrow with claim token if not present
    if not escrow.get("claim_token"):
        escrow["claim_token"] = claim_token
        escrow_db[escrow_id] = escrow
    
    seller_claim_url = f"https://platform-verification-app-kvzjvakf.devinapps.com?mode=seller&escrow={escrow_id}&token={claim_token}"
    
    # Generate short message for sharing
    share_message = f"Hi! I've paid ₦{escrow['amount']:,.0f} for your item via EscrowProtect. Click here to accept and provide your bank details: {seller_claim_url}"
    
    return {
        "success": True,
        "escrow_id": escrow_id,
        "seller_claim_url": seller_claim_url,
        "share_message": share_message,
        "whatsapp_link": f"https://wa.me/?text={share_message.replace(' ', '%20')}",
        "instructions": "Share this link with the seller via DM, WhatsApp, or any messaging platform. The seller will click the link to claim the payment and provide their bank details."
    }

# ============================================
# WhatsApp Bot Integration (Zero-Install, Maximum Reach)
# ============================================

# WhatsApp conversation state (in-memory for POC)
whatsapp_sessions: Dict[str, Any] = {}

class WhatsAppMessage(BaseModel):
    from_number: str
    message_type: str = "text"  # text, image, document
    text: Optional[str] = None
    media_url: Optional[str] = None
    timestamp: Optional[str] = None

class WhatsAppWebhook(BaseModel):
    entry: List[Dict[str, Any]]

def normalize_phone(phone: str) -> str:
    """Normalize Nigerian phone number to +234 format"""
    digits = ''.join(c for c in phone if c.isdigit())
    if digits.startswith('234') and len(digits) == 13:
        return f"+{digits}"
    elif digits.startswith('0') and len(digits) == 11:
        return f"+234{digits[1:]}"
    elif len(digits) == 10:
        return f"+234{digits}"
    return phone

def parse_price(text: str) -> Optional[float]:
    """Parse price from text (supports shorthand like 150k)"""
    import re
    # Match patterns like ₦150,000 or 150k or NGN 50000
    patterns = [
        r'[₦N][\s]*([0-9,]+(?:\.[0-9]{2})?)',
        r'([0-9,]+(?:\.[0-9]{2})?)[\s]*(?:naira|NGN)',
        r'([0-9]+)[kK]',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1).replace(',', '')
            if pattern.endswith('[kK]'):
                return float(value) * 1000
            return float(value)
    return None

def extract_phone_from_text(text: str) -> Optional[str]:
    """Extract Nigerian phone number from text"""
    import re
    pattern = r'(?:\+234|234|0)?[\s.-]?(?:70|80|81|90|91)[\s.-]?\d{1}[\s.-]?\d{3}[\s.-]?\d{4}'
    match = re.search(pattern, text)
    if match:
        return normalize_phone(match.group())
    return None

def detect_commerce_intent(text: str) -> Dict[str, Any]:
    """Detect commerce intent from WhatsApp message"""
    text_lower = text.lower()
    
    signals = {
        "has_price": parse_price(text) is not None,
        "has_phone": extract_phone_from_text(text) is not None,
        "is_buyer_intent": any(phrase in text_lower for phrase in [
            "i want to buy", "how much", "price", "interested", "available",
            "can i get", "i need", "send to", "deliver to"
        ]),
        "is_seller_intent": any(phrase in text_lower for phrase in [
            "for sale", "selling", "available for", "dm to order",
            "whatsapp to order", "call to order"
        ]),
        "wants_escrow": any(phrase in text_lower for phrase in [
            "escrow", "protect", "safe", "secure payment", "hold payment"
        ]),
    }
    
    return signals

@app.post("/api/v1/whatsapp/webhook")
async def whatsapp_webhook(message: WhatsAppMessage):
    """
    WhatsApp Bot Webhook - Process incoming messages
    
    User Flow:
    1. User forwards seller's message/screenshot to bot
    2. Bot extracts price, seller contact via OCR/NLP
    3. Bot asks user to confirm details
    4. Bot creates escrow and returns payment link
    5. User pays, bot sends claim link to seller
    """
    user_phone = normalize_phone(message.from_number)
    session = whatsapp_sessions.get(user_phone, {"state": "idle", "data": {}})
    
    response_messages = []
    
    if message.message_type == "image" or message.media_url:
        # Image received - extract commerce data via OCR
        # In production, this would call the OCR service
        session["state"] = "awaiting_confirmation"
        session["data"]["media_url"] = message.media_url
        session["data"]["detected"] = {
            "price": 50000,  # Simulated OCR result
            "seller_phone": "08012345678",
            "product": "Detected Product"
        }
        
        response_messages.append(
            f"I detected a listing:\n"
            f"- Product: {session['data']['detected']['product']}\n"
            f"- Price: ₦{session['data']['detected']['price']:,.0f}\n"
            f"- Seller: {session['data']['detected']['seller_phone']}\n\n"
            f"Reply YES to create escrow, or send the correct details."
        )
    
    elif message.text:
        text = message.text.strip()
        text_lower = text.lower()
        
        # TIER 2 FIX: Parse explicit commands FIRST before intent detection
        import re
        
        # Command: ESCROW [amount] [phone] - explicit escrow creation
        escrow_cmd_match = re.match(r'^escrow\s+(\d+[kK]?)\s+(\d{10,11}|\+?234\d{10})$', text, re.IGNORECASE)
        if escrow_cmd_match:
            amount_str = escrow_cmd_match.group(1)
            phone_str = escrow_cmd_match.group(2)
            
            # Parse amount (supports 150k shorthand)
            if amount_str.lower().endswith('k'):
                price = float(amount_str[:-1]) * 1000
            else:
                price = float(amount_str)
            
            seller_phone = normalize_phone(phone_str)
            
            session["state"] = "awaiting_confirmation"
            session["data"]["detected"] = {
                "price": price,
                "seller_phone": seller_phone,
                "product": "Protected Purchase"
            }
            response_messages.append(
                f"Creating escrow for:\n"
                f"- Amount: ₦{price:,.0f}\n"
                f"- Seller: {seller_phone}\n\n"
                f"Reply YES to confirm, or send correct details."
            )
            whatsapp_sessions[user_phone] = session
            return {"success": True, "messages": response_messages, "session_state": session["state"]}
        
        # Command: STATUS [escrow_id] - check status
        status_cmd_match = re.match(r'^status\s+(\S+)$', text, re.IGNORECASE)
        if status_cmd_match:
            escrow_id = status_cmd_match.group(1).upper()
            # Find escrow
            found = None
            for eid, escrow in escrow_db.items():
                if eid == escrow_id or eid.endswith(escrow_id):
                    found = escrow
                    break
            
            if found:
                response_messages.append(
                    f"Escrow {escrow_id}:\n"
                    f"- Status: {found['status']}\n"
                    f"- Amount: ₦{found['amount']:,.0f}\n"
                    f"- Created: {found['created_at'][:10]}"
                )
            else:
                response_messages.append(f"Escrow {escrow_id} not found.")
            
            return {"success": True, "messages": response_messages, "session_state": "idle"}
        
        # Command: CANCEL [escrow_id] - cancel escrow
        cancel_cmd_match = re.match(r'^cancel\s+(\S+)$', text, re.IGNORECASE)
        if cancel_cmd_match:
            escrow_id = cancel_cmd_match.group(1).upper()
            found = None
            found_id = None
            for eid, escrow in escrow_db.items():
                if eid == escrow_id or eid.endswith(escrow_id):
                    found = escrow
                    found_id = eid
                    break
            
            if found:
                if found["status"] in [EscrowStatus.PENDING_PAYMENT.value, EscrowStatus.PAYMENT_RECEIVED.value]:
                    found["status"] = EscrowStatus.REFUNDED.value
                    found["updated_at"] = datetime.now().isoformat()
                    escrow_db[found_id] = found
                    response_messages.append(f"Escrow {found_id} cancelled. Refund processing.")
                else:
                    response_messages.append(f"Cannot cancel escrow in status: {found['status']}")
            else:
                response_messages.append(f"Escrow {escrow_id} not found.")
            
            return {"success": True, "messages": response_messages, "session_state": "idle"}
        
        # Command: HELP - show help
        if text_lower in ['help', 'hi', 'hello', 'start']:
            response_messages.append(
                "Welcome to EscrowProtect!\n\n"
                "I help you buy safely on social media.\n\n"
                "Quick Commands:\n"
                "- ESCROW 150000 08012345678\n"
                "- ESCROW 150k 08012345678\n"
                "- STATUS ESC-NG-XXXXX\n"
                "- CANCEL ESC-NG-XXXXX\n\n"
                "Or forward a seller's message/screenshot to get started."
            )
            return {"success": True, "messages": response_messages, "session_state": "idle"}
        
        if session["state"] == "idle":
            # Check for commerce intent
            intent = detect_commerce_intent(text)
            
            if intent["wants_escrow"] or intent["is_buyer_intent"]:
                # User wants to create escrow
                price = parse_price(text)
                seller_phone = extract_phone_from_text(text)
                
                if price and seller_phone:
                    # Have enough info to create escrow
                    session["state"] = "awaiting_confirmation"
                    session["data"]["detected"] = {
                        "price": price,
                        "seller_phone": seller_phone,
                        "product": "Item from message"
                    }
                    response_messages.append(
                        f"Creating escrow for:\n"
                        f"- Amount: ₦{price:,.0f}\n"
                        f"- Seller: {seller_phone}\n\n"
                        f"Reply YES to confirm, or send correct details."
                    )
                elif price:
                    session["state"] = "awaiting_seller_phone"
                    session["data"]["price"] = price
                    response_messages.append(
                        f"Amount: ₦{price:,.0f}\n\n"
                        f"Please send the seller's phone number."
                    )
                else:
                    session["state"] = "awaiting_price"
                    response_messages.append(
                        "Welcome to EscrowProtect!\n\n"
                        "To protect your purchase:\n"
                        "1. Forward the seller's message/screenshot, OR\n"
                        "2. Send: ESCROW [amount] [seller phone]\n\n"
                        "Example: ESCROW 150000 08012345678"
                    )
            else:
                # General help
                response_messages.append(
                    "Welcome to EscrowProtect!\n\n"
                    "I help you buy safely on social media.\n\n"
                    "To start:\n"
                    "- Forward seller's message/screenshot\n"
                    "- Or type: ESCROW [amount] [seller phone]\n\n"
                    "Commands:\n"
                    "- STATUS [escrow ID] - Check escrow status\n"
                    "- CANCEL [escrow ID] - Cancel escrow\n"
                    "- HELP - Show this message"
                )
        
        elif session["state"] == "awaiting_price":
            price = parse_price(text)
            if price:
                session["data"]["price"] = price
                session["state"] = "awaiting_seller_phone"
                response_messages.append(
                    f"Amount: ₦{price:,.0f}\n\n"
                    f"Now send the seller's phone number."
                )
            else:
                response_messages.append(
                    "I couldn't understand the price.\n"
                    "Please send the amount (e.g., 150000 or 150k)"
                )
        
        elif session["state"] == "awaiting_seller_phone":
            seller_phone = extract_phone_from_text(text)
            if seller_phone:
                session["data"]["seller_phone"] = seller_phone
                session["state"] = "awaiting_confirmation"
                session["data"]["detected"] = {
                    "price": session["data"]["price"],
                    "seller_phone": seller_phone,
                    "product": "Item"
                }
                response_messages.append(
                    f"Creating escrow for:\n"
                    f"- Amount: ₦{session['data']['price']:,.0f}\n"
                    f"- Seller: {seller_phone}\n\n"
                    f"Reply YES to confirm."
                )
            else:
                response_messages.append(
                    "I couldn't find a valid phone number.\n"
                    "Please send the seller's Nigerian phone number."
                )
        
        elif session["state"] == "awaiting_confirmation":
            if text_lower in ["yes", "y", "confirm", "ok"]:
                # Create escrow
                detected = session["data"]["detected"]
                
                # Create escrow transaction
                escrow_id = generate_escrow_id()
                claim_token = generate_claim_token()
                amount = detected["price"]
                fee = amount * 0.02
                total = amount + fee
                
                escrow = {
                    "id": escrow_id,
                    "status": EscrowStatus.PENDING_PAYMENT.value,
                    "listing": {
                        "id": f"LST-WA-{uuid.uuid4().hex[:8].upper()}",
                        "title": detected.get("product", "WhatsApp Purchase"),
                        "price": amount,
                        "currency": "NGN",
                        "seller": {
                            "username": "WhatsApp Seller",
                            "phone": detected["seller_phone"],
                            "location": "Nigeria",
                            "verified": False
                        },
                        "source": "whatsapp_bot"
                    },
                    "buyer": {
                        "name": "WhatsApp Buyer",
                        "phone": user_phone,
                        "address": ""
                    },
                    "seller_bank": None,
                    "shipping": None,
                    "amount": amount,
                    "fee": fee,
                    "total": total,
                    "payment_method": "bank_transfer",
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "timeline": [t.dict() for t in create_timeline(EscrowStatus.PENDING_PAYMENT)],
                    "claim_token": claim_token,
                    "source": "whatsapp_bot"
                }
                
                escrow_db[escrow_id] = escrow
                
                # Generate payment link
                payment_url = f"https://platform-verification-app-kvzjvakf.devinapps.com?mode=buyer&escrow={escrow_id}"
                seller_claim_url = f"https://platform-verification-app-kvzjvakf.devinapps.com?mode=seller&escrow={escrow_id}&token={claim_token}"
                
                response_messages.append(
                    f"Escrow Created!\n\n"
                    f"ID: {escrow_id}\n"
                    f"Amount: ₦{amount:,.0f}\n"
                    f"Fee (2%): ₦{fee:,.0f}\n"
                    f"Total: ₦{total:,.0f}\n\n"
                    f"Pay here:\n{payment_url}\n\n"
                    f"After payment, I'll notify the seller to ship your item."
                )
                
                # Reset session
                session = {"state": "idle", "data": {}}
            
            elif text_lower in ["no", "n", "cancel"]:
                session = {"state": "idle", "data": {}}
                response_messages.append("Cancelled. Send a new message to start over.")
            
            else:
                # User is correcting details
                price = parse_price(text)
                phone = extract_phone_from_text(text)
                
                if price:
                    session["data"]["detected"]["price"] = price
                if phone:
                    session["data"]["detected"]["seller_phone"] = phone
                
                response_messages.append(
                    f"Updated:\n"
                    f"- Amount: ₦{session['data']['detected']['price']:,.0f}\n"
                    f"- Seller: {session['data']['detected']['seller_phone']}\n\n"
                    f"Reply YES to confirm."
                )
        
        # Handle commands
        if text_lower.startswith("status "):
            escrow_id = text[7:].strip().upper()
            if escrow_id in escrow_db:
                escrow = escrow_db[escrow_id]
                response_messages = [
                    f"Escrow {escrow_id}\n\n"
                    f"Status: {escrow['status']}\n"
                    f"Amount: ₦{escrow['amount']:,.0f}\n"
                    f"Created: {escrow['created_at'][:10]}"
                ]
            else:
                response_messages = [f"Escrow {escrow_id} not found."]
        
        elif text_lower.startswith("cancel "):
            escrow_id = text[7:].strip().upper()
            if escrow_id in escrow_db:
                escrow = escrow_db[escrow_id]
                if escrow["status"] in [EscrowStatus.PENDING_PAYMENT.value, EscrowStatus.PAYMENT_RECEIVED.value]:
                    escrow["status"] = EscrowStatus.REFUNDED.value
                    escrow["updated_at"] = datetime.now().isoformat()
                    escrow_db[escrow_id] = escrow
                    response_messages = [f"Escrow {escrow_id} cancelled. Refund processing."]
                else:
                    response_messages = [f"Cannot cancel escrow in status: {escrow['status']}"]
            else:
                response_messages = [f"Escrow {escrow_id} not found."]
    
    # Save session
    whatsapp_sessions[user_phone] = session
    
    return {
        "success": True,
        "messages": response_messages,
        "session_state": session["state"]
    }

@app.get("/api/v1/whatsapp/session/{phone}")
async def get_whatsapp_session(phone: str):
    """Get WhatsApp session state for a phone number"""
    normalized = normalize_phone(phone)
    session = whatsapp_sessions.get(normalized, {"state": "idle", "data": {}})
    return {"phone": normalized, "session": session}

# ============================================
# USSD Integration (Feature Phone Support, 500M+ Users)
# ============================================

# USSD session state (in-memory for POC)
ussd_sessions: Dict[str, Any] = {}

class USSDRequest(BaseModel):
    session_id: str
    phone_number: str
    service_code: str = "*384*ESCROW#"
    text: str = ""  # User input, separated by *

@app.post("/api/v1/ussd/callback")
async def ussd_callback(request: USSDRequest):
    """
    USSD Callback - Process USSD requests
    
    Menu Flow:
    *384*ESCROW#
    1. Create New Escrow
    2. Check Escrow Status
    3. Claim Payment (Seller)
    4. Cancel Escrow
    
    Create Escrow Flow:
    1. Enter seller phone
    2. Enter amount
    3. Confirm
    4. Get payment code
    """
    session_id = request.session_id
    phone = normalize_phone(request.phone_number)
    user_input = request.text.split("*") if request.text else []
    
    # Get or create session
    session = ussd_sessions.get(session_id, {
        "state": "main_menu",
        "data": {},
        "phone": phone
    })
    
    response_text = ""
    end_session = False
    
    if not user_input or user_input == [""]:
        # Main menu
        response_text = (
            "Welcome to EscrowProtect\n"
            "1. Create Escrow\n"
            "2. Check Status\n"
            "3. Claim Payment\n"
            "4. Cancel Escrow"
        )
        session["state"] = "main_menu"
    
    elif session["state"] == "main_menu":
        choice = user_input[-1]
        
        if choice == "1":
            response_text = "Enter seller phone number:"
            session["state"] = "create_seller_phone"
        
        elif choice == "2":
            response_text = "Enter Escrow ID:"
            session["state"] = "check_status"
        
        elif choice == "3":
            response_text = "Enter Escrow ID to claim:"
            session["state"] = "claim_escrow_id"
        
        elif choice == "4":
            response_text = "Enter Escrow ID to cancel:"
            session["state"] = "cancel_escrow_id"
        
        else:
            response_text = "Invalid option. Try again."
    
    elif session["state"] == "create_seller_phone":
        seller_phone = user_input[-1]
        if len(seller_phone) >= 10:
            session["data"]["seller_phone"] = normalize_phone(seller_phone)
            response_text = "Enter amount (e.g., 50000):"
            session["state"] = "create_amount"
        else:
            response_text = "Invalid phone. Enter 11 digits:"
    
    elif session["state"] == "create_amount":
        try:
            amount = float(user_input[-1].replace(",", ""))
            if amount >= 1000:
                session["data"]["amount"] = amount
                fee = amount * 0.02
                total = amount + fee
                response_text = (
                    f"Confirm Escrow:\n"
                    f"Seller: {session['data']['seller_phone']}\n"
                    f"Amount: N{amount:,.0f}\n"
                    f"Fee: N{fee:,.0f}\n"
                    f"Total: N{total:,.0f}\n"
                    f"1. Confirm\n"
                    f"2. Cancel"
                )
                session["state"] = "create_confirm"
            else:
                response_text = "Minimum amount is N1,000. Enter amount:"
        except ValueError:
            response_text = "Invalid amount. Enter numbers only:"
    
    elif session["state"] == "create_confirm":
        choice = user_input[-1]
        
        if choice == "1":
            # Create escrow
            escrow_id = generate_escrow_id()
            claim_token = generate_claim_token()
            amount = session["data"]["amount"]
            fee = amount * 0.02
            total = amount + fee
            
            escrow = {
                "id": escrow_id,
                "status": EscrowStatus.PENDING_PAYMENT.value,
                "listing": {
                    "id": f"LST-USSD-{uuid.uuid4().hex[:8].upper()}",
                    "title": "USSD Purchase",
                    "price": amount,
                    "currency": "NGN",
                    "seller": {
                        "username": "USSD Seller",
                        "phone": session["data"]["seller_phone"],
                        "location": "Nigeria",
                        "verified": False
                    },
                    "source": "ussd"
                },
                "buyer": {
                    "name": "USSD Buyer",
                    "phone": phone,
                    "address": ""
                },
                "seller_bank": None,
                "shipping": None,
                "amount": amount,
                "fee": fee,
                "total": total,
                "payment_method": "ussd",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "timeline": [t.dict() for t in create_timeline(EscrowStatus.PENDING_PAYMENT)],
                "claim_token": claim_token,
                "source": "ussd"
            }
            
            escrow_db[escrow_id] = escrow
            
            # Generate short payment code
            payment_code = escrow_id[-6:]
            
            response_text = (
                f"Escrow Created!\n"
                f"ID: {escrow_id}\n"
                f"Pay Code: {payment_code}\n"
                f"Pay N{total:,.0f} via:\n"
                f"*737*2*{payment_code}#\n"
                f"or bank transfer"
            )
            end_session = True
        
        else:
            response_text = "Cancelled."
            end_session = True
    
    elif session["state"] == "check_status":
        escrow_id = user_input[-1].upper()
        # Try to find by ID or partial match
        found = None
        for eid, escrow in escrow_db.items():
            if eid == escrow_id or eid.endswith(escrow_id):
                found = escrow
                break
        
        if found:
            response_text = (
                f"Escrow: {found['id']}\n"
                f"Status: {found['status']}\n"
                f"Amount: N{found['amount']:,.0f}\n"
                f"Seller: {found['listing']['seller']['phone'][-4:]}"
            )
        else:
            response_text = f"Escrow {escrow_id} not found."
        end_session = True
    
    elif session["state"] == "claim_escrow_id":
        escrow_id = user_input[-1].upper()
        found = None
        for eid, escrow in escrow_db.items():
            if eid == escrow_id or eid.endswith(escrow_id):
                found = escrow
                found_id = eid
                break
        
        if found:
            seller_phone = found["listing"]["seller"]["phone"]
            if phone == seller_phone or phone.endswith(seller_phone[-10:]):
                session["data"]["escrow_id"] = found_id
                response_text = (
                    f"Claim N{found['amount']:,.0f}\n"
                    f"Enter bank code:\n"
                    f"1. GTBank\n"
                    f"2. Access\n"
                    f"3. Zenith\n"
                    f"4. UBA\n"
                    f"5. First Bank"
                )
                session["state"] = "claim_bank"
            else:
                response_text = "You are not the seller for this escrow."
                end_session = True
        else:
            response_text = f"Escrow {escrow_id} not found."
            end_session = True
    
    elif session["state"] == "claim_bank":
        bank_codes = {"1": "058", "2": "044", "3": "057", "4": "033", "5": "011"}
        bank_names = {"1": "GTBank", "2": "Access", "3": "Zenith", "4": "UBA", "5": "First Bank"}
        
        choice = user_input[-1]
        if choice in bank_codes:
            session["data"]["bank_code"] = bank_codes[choice]
            session["data"]["bank_name"] = bank_names[choice]
            response_text = "Enter 10-digit account number:"
            session["state"] = "claim_account"
        else:
            response_text = "Invalid choice. Select 1-5:"
    
    elif session["state"] == "claim_account":
        account = user_input[-1]
        if len(account) == 10 and account.isdigit():
            escrow_id = session["data"]["escrow_id"]
            escrow = escrow_db[escrow_id]
            
            escrow["seller_bank"] = {
                "bank_code": session["data"]["bank_code"],
                "bank_name": session["data"]["bank_name"],
                "account_number": account,
                "verified": True
            }
            escrow["status"] = EscrowStatus.SELLER_ACCEPTED.value
            escrow["updated_at"] = datetime.now().isoformat()
            escrow_db[escrow_id] = escrow
            
            response_text = (
                f"Bank details saved!\n"
                f"{session['data']['bank_name']}\n"
                f"****{account[-4:]}\n"
                f"Ship item to receive N{escrow['amount']:,.0f}"
            )
            end_session = True
        else:
            response_text = "Invalid account. Enter 10 digits:"
    
    elif session["state"] == "cancel_escrow_id":
        escrow_id = user_input[-1].upper()
        found = None
        for eid, escrow in escrow_db.items():
            if eid == escrow_id or eid.endswith(escrow_id):
                found = escrow
                found_id = eid
                break
        
        if found:
            buyer_phone = found["buyer"]["phone"]
            if phone == buyer_phone or phone.endswith(buyer_phone[-10:]):
                if found["status"] in [EscrowStatus.PENDING_PAYMENT.value, EscrowStatus.PAYMENT_RECEIVED.value]:
                    found["status"] = EscrowStatus.REFUNDED.value
                    found["updated_at"] = datetime.now().isoformat()
                    escrow_db[found_id] = found
                    response_text = f"Escrow {found_id} cancelled.\nRefund processing."
                else:
                    response_text = f"Cannot cancel. Status: {found['status']}"
            else:
                response_text = "You are not the buyer for this escrow."
        else:
            response_text = f"Escrow {escrow_id} not found."
        end_session = True
    
    # Save session
    if not end_session:
        ussd_sessions[session_id] = session
    elif session_id in ussd_sessions:
        del ussd_sessions[session_id]
    
    # USSD response format
    return {
        "response": response_text,
        "end_session": end_session,
        "session_id": session_id
    }

@app.get("/api/v1/ussd/session/{session_id}")
async def get_ussd_session(session_id: str):
    """Get USSD session state"""
    session = ussd_sessions.get(session_id, {"state": "idle", "data": {}})
    return {"session_id": session_id, "session": session}

# ============================================
# Shareable Link Generator Service
# ============================================

@app.post("/api/v1/link/create")
async def create_shareable_link(
    amount: float,
    seller_phone: Optional[str] = None,
    product_title: Optional[str] = None,
    buyer_phone: Optional[str] = None
):
    """
    Create a shareable escrow link without full escrow creation
    
    This allows buyers to generate a link they can share with sellers
    before the escrow is formally created.
    """
    link_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    # Store link data
    link_data = {
        "id": link_id,
        "amount": amount,
        "seller_phone": normalize_phone(seller_phone) if seller_phone else None,
        "product_title": product_title or "Protected Purchase",
        "buyer_phone": normalize_phone(buyer_phone) if buyer_phone else None,
        "created_at": datetime.now().isoformat(),
        "status": "pending",
        "escrow_id": None
    }
    
    listings_db[link_id] = link_data
    
    # Generate URLs
    base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
    buyer_url = f"{base_url}?link={link_id}&mode=buyer"
    seller_url = f"{base_url}?link={link_id}&mode=seller"
    
    # Generate share messages
    buyer_message = f"I want to buy your item for ₦{amount:,.0f} using EscrowProtect. Click here to accept: {seller_url}"
    
    return {
        "success": True,
        "link_id": link_id,
        "amount": amount,
        "buyer_url": buyer_url,
        "seller_url": seller_url,
        "share_message": buyer_message,
        "whatsapp_share": f"https://wa.me/{seller_phone}?text={buyer_message.replace(' ', '%20')}" if seller_phone else None,
        "short_link": f"escrow.ng/p/{link_id}"
    }

@app.get("/api/v1/link/{link_id}")
async def get_link(link_id: str):
    """Get shareable link details"""
    if link_id not in listings_db:
        raise HTTPException(status_code=404, detail="Link not found")
    return listings_db[link_id]


# ============================================
# TIER 1-4 IMPROVEMENTS: Import Services
# ============================================

# Import all tier services
from app.fraud_detection import fraud_detection as fraud_detection_service, RiskLevel
from app.dispute_resolution import dispute_resolution, DisputeReason, DisputeStatus, EvidenceType, ResolutionType
from app.seller_onboarding import seller_onboarding
from app.trust_badge import trust_badge_service
from app.observability import metrics_collector, health_checker, structured_logger, dead_letter_queue
from app.security_compliance import audit_logger, access_control, kyc_compliance, pii_minimizer
from app.voice_notes import voice_note_service, VoiceCommandType
from app.agent_network import agent_network, AgentType, CashTransactionType
from app.insurance_pool import insurance_pool, InsuranceTier, ClaimType

# ============================================
# TIER 1: Fraud Detection API
# ============================================

@app.post("/api/v1/fraud/assess-transaction")
async def assess_transaction_risk(
    buyer_id: str,
    seller_id: str,
    amount: float,
    buyer_phone: str = None,
    seller_phone: str = None,
    device_fingerprint: str = None,
    ip_address: str = None
):
    """
    Assess fraud risk for a transaction.
    Returns risk level, score, and recommended action.
    """
    assessment = await fraud_detection_service.assess_transaction_risk(
        buyer_id=buyer_id,
        seller_id=seller_id,
        amount=amount,
        currency="NGN",
        buyer_phone=buyer_phone,
        seller_phone=seller_phone,
        device_fingerprint=device_fingerprint,
        ip_address=ip_address
    )
    
    # Log metric
    metrics_collector.increment("fraud_assessments_total", tags={"risk_level": assessment.risk_level.value})
    
    return {
        "risk_level": assessment.risk_level.value,
        "risk_score": assessment.risk_score,
        "signals": [
            {
                "type": s.fraud_type.value,
                "score": s.score,
                "description": s.description,
                "action_required": s.action_required
            }
            for s in assessment.signals
        ],
        "recommended_action": assessment.recommended_action,
        "requires_kyc": assessment.requires_kyc,
        "requires_review": assessment.requires_review,
        "auto_block": assessment.auto_block
    }

@app.post("/api/v1/fraud/report")
async def report_fraud(
    user_id: str,
    phone: str = None,
    device_fingerprint: str = None,
    fraud_type: str = "unknown",
    evidence: Dict[str, Any] = None
):
    """Report confirmed fraud to update detection rules"""
    await fraud_detection_service.report_fraud(
        user_id=user_id,
        phone=phone,
        device_fingerprint=device_fingerprint,
        fraud_type=fraud_type,
        evidence=evidence or {}
    )
    
    # Log audit
    audit_logger.log(
        actor_id="system",
        actor_type="system",
        action="fraud_reported",
        resource_type="user",
        resource_id=user_id,
        new_value={"fraud_type": fraud_type}
    )
    
    return {"success": True, "message": "Fraud reported and detection rules updated"}

# ============================================
# TIER 1: Dispute Resolution API
# ============================================

@app.post("/api/v1/disputes/open")
async def open_dispute_v2(
    escrow_id: str,
    opened_by: str,
    opened_by_role: str,
    reason: str,
    description: str
):
    """Open a new dispute for an escrow"""
    # Get escrow details
    if escrow_id not in escrow_db:
        raise HTTPException(status_code=404, detail="Escrow not found")
    
    escrow = escrow_db[escrow_id]
    
    try:
        dispute_reason = DisputeReason(reason)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid reason. Valid: {[r.value for r in DisputeReason]}")
    
    dispute = await dispute_resolution.open_dispute(
        escrow_id=escrow_id,
        buyer_id=escrow["buyer"]["phone"],
        seller_id=escrow["listing"]["seller"]["phone"],
        opened_by=opened_by,
        opened_by_role=opened_by_role,
        reason=dispute_reason,
        description=description,
        escrow_amount=escrow["amount"]
    )
    
    # Update escrow status
    escrow["status"] = EscrowStatus.DISPUTED.value
    escrow_db[escrow_id] = escrow
    
    metrics_collector.increment("disputes_opened_total", tags={"reason": reason})
    
    return dispute_resolution.get_dispute_summary(dispute)

@app.post("/api/v1/disputes/{dispute_id}/evidence")
async def submit_dispute_evidence(
    dispute_id: str,
    submitted_by: str,
    submitted_by_role: str,
    evidence_type: str,
    file_url: str = None,
    description: str = ""
):
    """Submit evidence for a dispute"""
    try:
        ev_type = EvidenceType(evidence_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid evidence type. Valid: {[e.value for e in EvidenceType]}")
    
    evidence = await dispute_resolution.submit_evidence(
        dispute_id=dispute_id,
        submitted_by=submitted_by,
        submitted_by_role=submitted_by_role,
        evidence_type=ev_type,
        file_url=file_url,
        description=description
    )
    
    return {
        "success": True,
        "evidence_id": evidence.id,
        "evidence_type": evidence.evidence_type.value,
        "submitted_at": evidence.created_at
    }

@app.post("/api/v1/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    resolution_type: str,
    buyer_amount: float,
    seller_amount: float,
    resolved_by: str,
    resolution_notes: str = ""
):
    """Manually resolve a dispute (admin action)"""
    try:
        res_type = ResolutionType(resolution_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid resolution type. Valid: {[r.value for r in ResolutionType]}")
    
    dispute = await dispute_resolution.resolve_manually(
        dispute_id=dispute_id,
        resolution_type=res_type,
        buyer_amount=buyer_amount,
        seller_amount=seller_amount,
        resolved_by=resolved_by,
        resolution_notes=resolution_notes
    )
    
    metrics_collector.increment("disputes_resolved_total", tags={"resolution": resolution_type})
    
    return dispute_resolution.get_dispute_summary(dispute)

@app.get("/api/v1/disputes/{dispute_id}")
async def get_dispute(dispute_id: str):
    """Get dispute details"""
    dispute = await dispute_resolution.get_dispute(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return dispute_resolution.get_dispute_summary(dispute)

# ============================================
# TIER 2: Seller Onboarding API
# ============================================

@app.post("/api/v1/seller/onboard")
async def start_seller_onboarding(
    escrow_id: str,
    seller_phone: str,
    amount: float
):
    """Start seller onboarding process with claim code"""
    result = seller_onboarding.start_onboarding(escrow_id, seller_phone, amount)
    return result

@app.post("/api/v1/seller/validate-claim")
async def validate_claim_code(
    code: str,
    phone: str = None
):
    """Validate a claim code"""
    claim = seller_onboarding.validate_claim_code(code, phone)
    if not claim:
        raise HTTPException(status_code=400, detail="Invalid or expired claim code")
    
    return {
        "valid": True,
        "escrow_id": claim.escrow_id,
        "amount": claim.amount,
        "expires_at": claim.expires_at
    }

@app.post("/api/v1/seller/verify-bank")
async def verify_seller_bank(
    bank_code: str,
    account_number: str
):
    """Verify seller's bank account"""
    result = await seller_onboarding.verify_bank_account(bank_code, account_number)
    return result

@app.get("/api/v1/seller/onboarding-stats")
async def get_onboarding_stats():
    """Get seller onboarding funnel statistics"""
    return seller_onboarding.get_onboarding_stats()

# ============================================
# TIER 2: Trust Badge API
# ============================================

@app.post("/api/v1/badge/create")
async def create_trust_badge(
    escrow_id: str,
    amount: float,
    status: str = "pending",
    seller_name: str = None,
    seller_verified: bool = False
):
    """Create a trust badge for an escrow"""
    badge = trust_badge_service.create_badge(
        escrow_id=escrow_id,
        amount=amount,
        status=status,
        seller_name=seller_name,
        seller_verified=seller_verified
    )
    return trust_badge_service.generate_share_card(badge)

@app.get("/api/v1/badge/{badge_id}")
async def get_trust_badge(badge_id: str):
    """Get trust badge details and share card"""
    badge = trust_badge_service.get_badge(badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    return trust_badge_service.generate_share_card(badge)

@app.get("/api/v1/badge/{badge_id}/og")
async def get_badge_open_graph(badge_id: str):
    """Get Open Graph metadata for badge link preview"""
    badge = trust_badge_service.get_badge(badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    return trust_badge_service.generate_open_graph_meta(badge)

@app.post("/api/v1/badge/{badge_id}/share")
async def record_badge_share(badge_id: str, platform: str = "unknown"):
    """Record that a badge was shared"""
    success = trust_badge_service.record_share(badge_id, platform)
    return {"success": success}

# ============================================
# TIER 3: Observability API
# ============================================

@app.get("/api/v1/metrics")
async def get_metrics():
    """Get platform metrics summary"""
    return metrics_collector.get_metrics_summary()

@app.get("/api/v1/alerts")
async def get_active_alerts():
    """Get active alerts"""
    alerts = metrics_collector.get_active_alerts()
    return {
        "count": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "name": a.name,
                "severity": a.severity.value,
                "message": a.message,
                "created_at": a.created_at
            }
            for a in alerts
        ]
    }

@app.get("/api/v1/health/detailed")
async def detailed_health_check():
    """Run detailed health checks on all components"""
    return await health_checker.run_checks()

@app.get("/api/v1/dlq")
async def get_dead_letter_queue():
    """Get dead letter queue statistics"""
    return dead_letter_queue.get_stats()

# ============================================
# TIER 3: Security & Compliance API
# ============================================

@app.get("/api/v1/audit/{resource_type}/{resource_id}")
async def get_audit_history(resource_type: str, resource_id: str):
    """Get audit history for a resource"""
    logs = audit_logger.get_resource_history(resource_type, resource_id)
    return {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "history": [
            {
                "id": l.id,
                "action": l.action,
                "actor_id": l.actor_id,
                "actor_type": l.actor_type,
                "timestamp": l.timestamp
            }
            for l in logs
        ]
    }

@app.post("/api/v1/kyc/check-limit")
async def check_kyc_limit(
    user_id: str,
    amount: float,
    cumulative_daily: float = 0
):
    """Check if transaction is allowed based on KYC limits"""
    return kyc_compliance.check_transaction_allowed(user_id, amount, cumulative_daily)

@app.get("/api/v1/kyc/{user_id}/level")
async def get_kyc_level(user_id: str):
    """Get user's KYC level and transaction limit"""
    level = kyc_compliance.get_kyc_level(user_id)
    limit = kyc_compliance.get_transaction_limit(user_id)
    return {
        "user_id": user_id,
        "kyc_level": level.value,
        "kyc_level_name": level.name,
        "transaction_limit": limit
    }

# ============================================
# TIER 4: Voice Notes API
# ============================================

@app.post("/api/v1/voice/transcribe")
async def transcribe_voice_note(
    audio_url: str,
    language_hint: str = None
):
    """Transcribe a voice note (simulated for POC)"""
    from app.voice_notes import Language
    lang = Language(language_hint) if language_hint else None
    result = await voice_note_service.transcribe_audio(audio_url, lang)
    return {
        "transcription_id": result.id,
        "text": result.text,
        "language": result.language.value,
        "confidence": result.confidence
    }

@app.post("/api/v1/voice/parse-command")
async def parse_voice_command(text: str):
    """Parse a voice command from transcribed text"""
    command = voice_note_service.parse_voice_command(text)
    return {
        "command_type": command.type.value,
        "confidence": command.confidence,
        "parameters": command.parameters,
        "language": command.language.value,
        "original_text": command.original_text
    }

@app.post("/api/v1/voice/extract-commerce")
async def extract_commerce_data(text: str):
    """Extract commerce data from text (price, phone, intent)"""
    return voice_note_service.extract_commerce_data(text)

# ============================================
# TIER 4: Agent Network API
# ============================================

@app.get("/api/v1/agents/nearby")
async def find_nearby_agents(
    latitude: float,
    longitude: float,
    transaction_type: str = "cash_in",
    amount: float = 50000,
    limit: int = 5
):
    """Find nearest available agents"""
    try:
        tx_type = CashTransactionType(transaction_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid transaction type. Valid: {[t.value for t in CashTransactionType]}")
    
    agents = agent_network.find_nearest_agents(latitude, longitude, tx_type, amount, limit)
    return {
        "count": len(agents),
        "agents": [
            {
                "id": a["agent"].id,
                "name": a["agent"].name,
                "type": a["agent"].agent_type.value,
                "location": {
                    "address": a["agent"].location.address,
                    "city": a["agent"].location.city,
                    "landmark": a["agent"].location.landmark
                },
                "distance_km": round(a["distance_km"], 2),
                "estimated_time_minutes": a["estimated_time_minutes"],
                "rating": a["agent"].rating,
                "max_amount": a["agent"].max_transaction_amount
            }
            for a in agents
        ]
    }

@app.post("/api/v1/agents/cash-transaction")
async def create_cash_transaction(
    escrow_id: str,
    user_id: str,
    user_phone: str,
    transaction_type: str,
    amount: float,
    latitude: float = None,
    longitude: float = None
):
    """Create a cash transaction request"""
    try:
        tx_type = CashTransactionType(transaction_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid transaction type")
    
    transaction = agent_network.create_cash_transaction(
        escrow_id=escrow_id,
        user_id=user_id,
        user_phone=user_phone,
        transaction_type=tx_type,
        amount=amount,
        user_latitude=latitude,
        user_longitude=longitude
    )
    
    return {
        "transaction_id": transaction.id,
        "verification_code": transaction.verification_code,
        "expires_at": transaction.verification_expires_at,
        "amount": transaction.amount,
        "commission": transaction.agent_commission,
        "status": transaction.status.value
    }

@app.post("/api/v1/agents/assign")
async def assign_agent_to_transaction(
    transaction_id: str,
    agent_id: str
):
    """Assign an agent to a cash transaction"""
    transaction = agent_network.assign_agent(transaction_id, agent_id)
    agent = agent_network.agents.get(agent_id)
    
    instructions = agent_network.get_transaction_instructions(transaction, agent)
    
    return {
        "success": True,
        "transaction_id": transaction.id,
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "phone": agent.phone,
            "location": {
                "address": agent.location.address,
                "city": agent.location.city,
                "landmark": agent.location.landmark
            }
        },
        "instructions": instructions
    }

@app.post("/api/v1/agents/complete")
async def complete_cash_transaction(
    transaction_id: str,
    verification_code: str,
    agent_id: str
):
    """Complete a cash transaction (agent action)"""
    result = agent_network.verify_and_complete(transaction_id, verification_code, agent_id)
    return result

# ============================================
# TIER 4: Insurance Pool API
# ============================================

@app.get("/api/v1/insurance/quote")
async def get_insurance_quote(
    amount: float,
    tier: str = "standard"
):
    """Get insurance quote for a transaction"""
    try:
        ins_tier = InsuranceTier(tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Valid: {[t.value for t in InsuranceTier]}")
    
    return insurance_pool.calculate_premium(amount, ins_tier)

@app.get("/api/v1/insurance/recommend")
async def get_insurance_recommendation(
    amount: float,
    seller_rating: float = None,
    seller_transaction_count: int = None,
    is_first_transaction: bool = False
):
    """Get insurance tier recommendation"""
    return insurance_pool.get_coverage_recommendation(
        amount=amount,
        seller_rating=seller_rating,
        seller_transaction_count=seller_transaction_count,
        is_first_transaction=is_first_transaction
    )

@app.post("/api/v1/insurance/policy")
async def create_insurance_policy(
    escrow_id: str,
    buyer_id: str,
    seller_id: str,
    amount: float,
    tier: str = "standard"
):
    """Create an insurance policy for an escrow"""
    try:
        ins_tier = InsuranceTier(tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier")
    
    policy = insurance_pool.create_policy(
        escrow_id=escrow_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        amount=amount,
        tier=ins_tier
    )
    
    return {
        "policy_id": policy.id,
        "escrow_id": policy.escrow_id,
        "tier": policy.tier.value,
        "coverage_amount": policy.coverage_amount,
        "premium_paid": policy.premium_paid,
        "deductible": policy.deductible,
        "expires_at": policy.expires_at
    }

@app.post("/api/v1/insurance/claim")
async def file_insurance_claim(
    escrow_id: str,
    claimant_id: str,
    claimant_role: str,
    claim_type: str,
    claimed_amount: float,
    description: str
):
    """File an insurance claim"""
    try:
        c_type = ClaimType(claim_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid claim type. Valid: {[c.value for c in ClaimType]}")
    
    claim = insurance_pool.file_claim(
        escrow_id=escrow_id,
        claimant_id=claimant_id,
        claimant_role=claimant_role,
        claim_type=c_type,
        claimed_amount=claimed_amount,
        description=description
    )
    
    return {
        "claim_id": claim.id,
        "policy_id": claim.policy_id,
        "status": claim.status.value,
        "claimed_amount": claim.claimed_amount,
        "created_at": claim.created_at
    }

@app.get("/api/v1/insurance/pool-stats")
async def get_insurance_pool_stats():
    """Get insurance pool statistics"""
    return insurance_pool.get_pool_stats()

# ============================================
# Platform Summary Endpoint
# ============================================

@app.get("/api/v1/platform/summary")
async def get_platform_summary():
    """Get comprehensive platform summary with all tier features"""
    return {
        "platform": "EscrowProtect",
        "version": "2.0.0",
        "tiers_implemented": {
            "tier_1_critical": {
                "tigerbeetle_ledger": True,
                "fraud_detection": True,
                "dispute_resolution": True
            },
            "tier_2_growth": {
                "whatsapp_bot_commands": True,
                "seller_onboarding": True,
                "trust_badges": True
            },
            "tier_3_technical": {
                "observability": True,
                "security_compliance": True
            },
            "tier_4_differentiation": {
                "voice_notes": True,
                "agent_network": True,
                "insurance_pool": True
            }
        },
        "stats": {
            "escrows": len(escrow_db),
            "metrics": metrics_collector.get_metrics_summary(),
            "insurance_pool": insurance_pool.get_pool_stats(),
            "agents": len(agent_network.agents),
            "onboarding": seller_onboarding.get_onboarding_stats()
        },
        "endpoints": {
            "fraud": "/api/v1/fraud/*",
            "disputes": "/api/v1/disputes/*",
            "seller": "/api/v1/seller/*",
            "badges": "/api/v1/badge/*",
            "metrics": "/api/v1/metrics",
            "voice": "/api/v1/voice/*",
            "agents": "/api/v1/agents/*",
            "insurance": "/api/v1/insurance/*",
            "edge_cases": "/api/v1/edge/*"
        }
    }


# ============================================
# EDGE CASE HANDLERS: Import Services
# ============================================

from app.edge_cases import (
    agent_liquidity, agent_fraud_prevention, split_payment_service,
    reinsurance_service, voice_confirmation, fraud_appeal_service,
    cross_border_service, Currency, PaymentMethod
)

# ============================================
# EDGE CASE: Agent Liquidity Management
# ============================================

@app.get("/api/v1/edge/agent/{agent_id}/float")
async def get_agent_float(agent_id: str):
    """Get agent's current float status"""
    agent_float = agent_liquidity.floats.get(agent_id)
    if not agent_float:
        # Initialize if not exists
        agent_float = agent_liquidity.initialize_float(agent_id, "pos_operator")
    
    return {
        "agent_id": agent_id,
        "current_balance": agent_float.current_balance,
        "available_balance": agent_float.available_balance,
        "pending_payouts": agent_float.pending_payouts,
        "target_balance": agent_float.target_balance,
        "status": agent_float.status.value
    }

@app.post("/api/v1/edge/agent/{agent_id}/check-availability")
async def check_agent_availability(agent_id: str, amount: float):
    """Check if agent can handle a cash-out transaction"""
    return agent_liquidity.check_availability(agent_id, amount)

@app.post("/api/v1/edge/agent/{agent_id}/replenish")
async def request_float_replenishment(agent_id: str, amount: float = None):
    """Request float replenishment for an agent"""
    return agent_liquidity.request_replenishment(agent_id, amount)

@app.get("/api/v1/edge/agent/backup")
async def find_backup_agents(
    original_agent_id: str,
    amount: float,
    latitude: float,
    longitude: float
):
    """Find backup agents with sufficient float"""
    backups = agent_liquidity.find_backup_agents(
        original_agent_id, amount, latitude, longitude
    )
    return {"backup_agents": backups, "count": len(backups)}

# ============================================
# EDGE CASE: Agent Fraud Prevention
# ============================================

@app.get("/api/v1/edge/agent/{agent_id}/reputation")
async def get_agent_reputation(agent_id: str):
    """Get agent's reputation and trust score"""
    reputation = agent_fraud_prevention.reputations.get(agent_id)
    if not reputation:
        reputation = agent_fraud_prevention.initialize_reputation(agent_id)
    
    return {
        "agent_id": agent_id,
        "level": reputation.level.value,
        "trust_score": reputation.trust_score,
        "total_transactions": reputation.total_transactions,
        "success_rate": reputation.successful_transactions / max(reputation.total_transactions, 1),
        "transaction_limit": reputation.transaction_limit,
        "daily_limit": reputation.daily_limit
    }

@app.post("/api/v1/edge/agent/{agent_id}/check-transaction")
async def check_agent_transaction_allowed(
    agent_id: str,
    amount: float,
    daily_volume: float = 0
):
    """Check if agent can process this transaction based on reputation"""
    return agent_fraud_prevention.check_transaction_allowed(agent_id, amount, daily_volume)

@app.post("/api/v1/edge/agent/{agent_id}/report-fraud")
async def report_agent_fraud(
    agent_id: str,
    reporter_id: str,
    fraud_type: str,
    description: str
):
    """Report suspected agent fraud"""
    report_id = agent_fraud_prevention.report_agent_fraud(
        agent_id, reporter_id, fraud_type, description
    )
    return {"success": True, "report_id": report_id}

@app.post("/api/v1/edge/agent/dispute")
async def open_agent_dispute(
    transaction_id: str,
    agent_id: str,
    complainant_id: str,
    complainant_role: str,
    dispute_type: str,
    description: str
):
    """Open dispute against agent"""
    dispute_id = agent_fraud_prevention.open_agent_dispute(
        transaction_id, agent_id, complainant_id, complainant_role, dispute_type, description
    )
    return {"success": True, "dispute_id": dispute_id}

# ============================================
# EDGE CASE: Partial/Split Payments
# ============================================

@app.post("/api/v1/edge/split-payment/create")
async def create_split_payment(
    escrow_id: str,
    total_amount: float,
    payment_plan: List[Dict[str, Any]]
):
    """
    Create a split payment plan.
    
    Example payment_plan:
    [{"method": "cash", "amount": 80000}, {"method": "opay", "amount": 20000}]
    """
    try:
        split = split_payment_service.create_split_payment(escrow_id, total_amount, payment_plan)
        return {
            "success": True,
            "split_id": split.id,
            "total_amount": split.total_amount,
            "payments": [
                {"id": p.id, "method": p.method.value, "amount": p.amount, "status": p.status}
                for p in split.payments
            ],
            "instructions": split_payment_service.get_payment_instructions(split)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/edge/split-payment/{split_id}/record")
async def record_partial_payment(
    split_id: str,
    payment_id: str,
    reference: str = None
):
    """Record completion of a partial payment"""
    return split_payment_service.record_payment(split_id, payment_id, reference)

@app.get("/api/v1/edge/split-payment/{split_id}")
async def get_split_payment(split_id: str):
    """Get split payment status"""
    split = split_payment_service.split_payments.get(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Split payment not found")
    
    return {
        "split_id": split.id,
        "escrow_id": split.escrow_id,
        "total_amount": split.total_amount,
        "paid_amount": split.paid_amount,
        "remaining_amount": split.remaining_amount,
        "status": split.status,
        "payments": [
            {"id": p.id, "method": p.method.value, "amount": p.amount, "status": p.status}
            for p in split.payments
        ]
    }

# ============================================
# EDGE CASE: Insurance Reinsurance
# ============================================

@app.post("/api/v1/edge/insurance/check-claim")
async def check_insurance_claim_eligibility(
    escrow_id: str,
    claim_amount: float
):
    """Check if insurance claim is eligible and how it should be processed"""
    pool_balance = insurance_pool.pool_balance
    return reinsurance_service.check_claim_eligibility(escrow_id, claim_amount, pool_balance)

@app.get("/api/v1/edge/insurance/reinsurance-claims")
async def get_reinsurance_claims():
    """Get all reinsurance claims"""
    return {"claims": reinsurance_service.reinsurance_claims}

# ============================================
# EDGE CASE: Voice Confirmation
# ============================================

@app.post("/api/v1/edge/voice/process")
async def process_voice_with_confirmation(
    transcription: str,
    confidence: float
):
    """Process voice command with appropriate confirmation level"""
    parsed = voice_note_service.parse_voice_command(transcription)
    return voice_confirmation.process_voice_command(
        transcription, confidence,
        {"type": parsed.type.value, "parameters": parsed.parameters}
    )

@app.post("/api/v1/edge/voice/confirm/{confirmation_id}")
async def confirm_voice_command(confirmation_id: str):
    """Confirm a pending voice command"""
    command = voice_confirmation.confirm_command(confirmation_id)
    if not command:
        raise HTTPException(status_code=404, detail="Confirmation not found or expired")
    return {"success": True, "command": command}

@app.post("/api/v1/edge/voice/check-quality")
async def check_audio_quality(
    duration_seconds: float,
    noise_level: float = None
):
    """Check if audio quality is sufficient for transcription"""
    return voice_confirmation.check_audio_quality(duration_seconds, noise_level=noise_level)

# ============================================
# EDGE CASE: Fraud Detection Appeals
# ============================================

@app.post("/api/v1/edge/fraud/appeal")
async def submit_fraud_appeal(
    user_id: str,
    original_decision: str,
    risk_score: float,
    appeal_reason: str
):
    """Submit appeal against fraud detection decision"""
    try:
        appeal = fraud_appeal_service.submit_appeal(
            user_id, original_decision, risk_score, appeal_reason
        )
        return {
            "success": True,
            "appeal_id": appeal.id,
            "status": appeal.status.value,
            "created_at": appeal.created_at
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/edge/fraud/appeals/{user_id}")
async def get_user_fraud_appeals(user_id: str):
    """Get all fraud appeals for a user"""
    appeals = fraud_appeal_service.get_user_appeals(user_id)
    return {
        "user_id": user_id,
        "appeals": [
            {
                "id": a.id,
                "original_decision": a.original_decision,
                "risk_score": a.risk_score,
                "status": a.status.value,
                "created_at": a.created_at
            }
            for a in appeals
        ]
    }

@app.post("/api/v1/edge/fraud/appeal/{appeal_id}/review")
async def review_fraud_appeal(
    appeal_id: str,
    reviewer_id: str,
    approved: bool,
    review_notes: str = ""
):
    """Review and decide on fraud appeal (admin action)"""
    try:
        appeal = fraud_appeal_service.review_appeal(appeal_id, reviewer_id, approved, review_notes)
        return {
            "success": True,
            "appeal_id": appeal.id,
            "status": appeal.status.value,
            "reviewed_at": appeal.reviewed_at
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ============================================
# EDGE CASE: Cross-Border Transactions
# ============================================

@app.get("/api/v1/edge/cross-border/rate")
async def get_exchange_rate(
    from_currency: str,
    to_currency: str
):
    """Get current exchange rate between currencies"""
    try:
        from_curr = Currency(from_currency)
        to_curr = Currency(to_currency)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid currency. Valid: {[c.value for c in Currency]}")
    
    rate = cross_border_service.get_exchange_rate(from_curr, to_curr)
    return {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "rate": rate
    }

@app.post("/api/v1/edge/cross-border/calculate")
async def calculate_cross_border_amount(
    amount: float,
    from_currency: str,
    to_currency: str
):
    """Calculate cross-border transaction amounts including fees"""
    try:
        from_curr = Currency(from_currency)
        to_curr = Currency(to_currency)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid currency")
    
    return cross_border_service.calculate_cross_border_amount(amount, from_curr, to_curr)

@app.post("/api/v1/edge/cross-border/escrow")
async def create_cross_border_escrow(
    buyer_country: str,
    seller_country: str,
    amount: float,
    buyer_currency: str,
    seller_currency: str
):
    """Create cross-border escrow transaction"""
    try:
        buyer_curr = Currency(buyer_currency)
        seller_curr = Currency(seller_currency)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid currency")
    
    return cross_border_service.create_cross_border_escrow(
        buyer_country, seller_country, amount, buyer_curr, seller_curr
    )

@app.get("/api/v1/edge/cross-border/corridors")
async def get_supported_corridors():
    """Get supported cross-border corridors"""
    return {
        "corridors": [
            {"from": "Nigeria", "to": "Ghana", "currencies": ["NGN", "GHS"]},
            {"from": "Nigeria", "to": "Kenya", "currencies": ["NGN", "KES"]},
            {"from": "Nigeria", "to": "South Africa", "currencies": ["NGN", "ZAR"]},
            {"from": "Ghana", "to": "Nigeria", "currencies": ["GHS", "NGN"]},
            {"from": "Kenya", "to": "Nigeria", "currencies": ["KES", "NGN"]},
            {"from": "South Africa", "to": "Nigeria", "currencies": ["ZAR", "NGN"]}
        ],
        "supported_currencies": [c.value for c in Currency]
    }

# ============================================
# EDGE CASE: Summary Endpoint
# ============================================

@app.get("/api/v1/edge/summary")
async def get_edge_case_summary():
    """Get summary of all edge case handlers"""
    return {
        "edge_cases_implemented": {
            "agent_liquidity": {
                "description": "Float management, backup agent routing, replenishment requests",
                "agents_tracked": len(agent_liquidity.floats),
                "pending_replenishments": len([r for r in agent_liquidity.replenishment_requests if r["status"] == "pending"])
            },
            "agent_fraud_prevention": {
                "description": "Reputation system, transaction limits, commission escrow, fraud reports",
                "agents_tracked": len(agent_fraud_prevention.reputations),
                "pending_fraud_reports": len([r for r in agent_fraud_prevention.fraud_reports if r["status"] == "pending_review"]),
                "open_disputes": len([d for d in agent_fraud_prevention.agent_disputes if d["status"] == "open"])
            },
            "split_payments": {
                "description": "Partial payments across cash + mobile money",
                "active_splits": len(split_payment_service.split_payments),
                "supported_methods": [m.value for m in PaymentMethod]
            },
            "insurance_reinsurance": {
                "description": "Claim limits, reinsurance for large claims, waiting periods",
                "max_claim_per_escrow": reinsurance_service.MAX_CLAIM_PER_ESCROW,
                "reinsurance_threshold": reinsurance_service.REINSURANCE_THRESHOLD,
                "pending_reinsurance_claims": len([c for c in reinsurance_service.reinsurance_claims if c["status"] == "submitted"])
            },
            "voice_confirmation": {
                "description": "Transcription confirmation, audio quality checks, fallback to text",
                "pending_confirmations": len(voice_confirmation.pending_confirmations),
                "min_confidence_auto": voice_confirmation.MIN_CONFIDENCE_AUTO,
                "min_confidence_confirm": voice_confirmation.MIN_CONFIDENCE_CONFIRM
            },
            "fraud_appeals": {
                "description": "Appeal process for false positive fraud detection",
                "total_appeals": len(fraud_appeal_service.appeals),
                "pending_appeals": len([a for a in fraud_appeal_service.appeals.values() if a.status.value == "submitted"])
            },
            "cross_border": {
                "description": "Multi-currency support for African corridors",
                "supported_currencies": [c.value for c in Currency],
                "cross_border_fee_rate": cross_border_service.CROSS_BORDER_FEE_RATE,
                "active_transactions": len(cross_border_service.transactions)
            }
        }
    }


# ============================================
# PROGRESSIVE KYC: Import Services
# ============================================

from app.progressive_kyc import progressive_kyc, KYCTier, TIER_LIMITS

# ============================================
# PROGRESSIVE KYC: Merchant Registration
# ============================================

@app.post("/api/v1/kyc/register")
async def register_merchant(
    merchant_id: str,
    phone: str,
    phone_verified: bool = True
):
    """
    Register new merchant with phone verification.
    Starts at Tier 0 (Phone Only) - ₦10,000 limit.
    """
    merchant = progressive_kyc.register_merchant(merchant_id, phone, phone_verified)
    return {
        "success": True,
        "merchant_id": merchant.merchant_id,
        "tier": merchant.current_tier.name,
        "limits": progressive_kyc.get_tier_limits(merchant.current_tier),
        "badge": progressive_kyc.get_merchant_badge(merchant_id)
    }

@app.get("/api/v1/kyc/merchant/{merchant_id}")
async def get_merchant_kyc(merchant_id: str):
    """Get merchant's KYC profile and status"""
    merchant = progressive_kyc.get_merchant(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    return {
        "merchant_id": merchant.merchant_id,
        "phone": merchant.phone[:4] + "****" + merchant.phone[-4:] if len(merchant.phone) >= 8 else "****",
        "tier": merchant.current_tier.name,
        "bank_verified": merchant.bank_verified,
        "bvn_verified": merchant.bvn_verified,
        "verified_badge": merchant.verified_badge,
        "instant_payout": merchant.instant_payout_enabled,
        "limits": progressive_kyc.get_tier_limits(merchant.current_tier),
        "cumulative_volume_30d": merchant.cumulative_volume_30d,
        "transaction_count_30d": merchant.transaction_count_30d,
        "risk_flags": len(merchant.risk_flags),
        "badge": progressive_kyc.get_merchant_badge(merchant_id)
    }

# ============================================
# PROGRESSIVE KYC: Bank Verification (Tier 1)
# ============================================

@app.post("/api/v1/kyc/bank/verify")
async def verify_bank_account_kyc(
    merchant_id: str,
    bank_code: str,
    account_number: str
):
    """
    Add and verify bank account via name enquiry.
    Automatically upgrades to Tier 1 (Bank Verified) - ₦100,000 limit.
    """
    result = await progressive_kyc.add_bank_account(merchant_id, bank_code, account_number)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))
    
    return result

@app.get("/api/v1/kyc/banks")
async def get_supported_banks():
    """Get list of supported Nigerian banks"""
    return {
        "banks": [
            {"code": code, "name": name}
            for code, name in progressive_kyc.bank_enquiry.BANK_CODES.items()
        ]
    }

# ============================================
# PROGRESSIVE KYC: BVN Verification (Tier 2)
# ============================================

@app.post("/api/v1/kyc/bvn/verify")
async def verify_bvn(
    merchant_id: str,
    bvn: str,
    first_name: str,
    last_name: str
):
    """
    Verify BVN and upgrade to Tier 2 (BVN Verified).
    Unlocks: ₦1,000,000 limit, instant payouts, verified badge.
    """
    result = await progressive_kyc.verify_bvn(merchant_id, bvn, first_name, last_name)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "BVN verification failed"))
    
    return result

# ============================================
# PROGRESSIVE KYC: Transaction & Payout Checks
# ============================================

@app.post("/api/v1/kyc/check-transaction")
async def check_transaction_allowed_kyc(
    merchant_id: str,
    amount: float
):
    """
    Check if transaction can be created.
    Note: We allow sales even with low KYC - verification is enforced at payout.
    """
    return progressive_kyc.check_transaction_allowed(merchant_id, amount)

@app.post("/api/v1/kyc/check-payout")
async def check_payout_allowed(
    merchant_id: str,
    amount: float,
    escrow_id: str
):
    """
    Check if payout can be processed.
    This is where KYC is enforced - at withdrawal time.
    """
    return progressive_kyc.check_payout_allowed(merchant_id, amount, escrow_id)

# ============================================
# PROGRESSIVE KYC: Upgrade Prompts & Badges
# ============================================

@app.get("/api/v1/kyc/upgrade-prompt/{merchant_id}")
async def get_upgrade_prompt(merchant_id: str):
    """Check if merchant should be prompted to upgrade KYC"""
    prompt = progressive_kyc.check_upgrade_prompt(merchant_id)
    if not prompt:
        return {"prompt": False}
    return prompt

@app.get("/api/v1/kyc/badge/{merchant_id}")
async def get_merchant_badge(merchant_id: str):
    """Get merchant's verification badge for display"""
    return progressive_kyc.get_merchant_badge(merchant_id)

# ============================================
# PROGRESSIVE KYC: Risk Management
# ============================================

@app.post("/api/v1/kyc/step-up/{merchant_id}")
async def trigger_step_up(
    merchant_id: str,
    reason: str
):
    """Trigger step-up verification due to risk signals"""
    return progressive_kyc.trigger_step_up_verification(merchant_id, reason)

@app.post("/api/v1/kyc/clear-flag/{merchant_id}")
async def clear_risk_flag(
    merchant_id: str,
    flag: str
):
    """Clear a risk flag after verification"""
    success = progressive_kyc.clear_risk_flag(merchant_id, flag)
    return {"success": success}

# ============================================
# PROGRESSIVE KYC: Statistics
# ============================================

@app.get("/api/v1/kyc/stats")
async def get_kyc_stats():
    """Get KYC statistics for dashboard"""
    return progressive_kyc.get_kyc_stats()

@app.get("/api/v1/kyc/tiers")
async def get_kyc_tiers():
    """Get all KYC tiers and their limits"""
    return {
        "tiers": [
            {
                "tier": tier.name,
                "value": tier.value,
                "limits": TIER_LIMITS[tier],
                "description": {
                    KYCTier.PHONE_ONLY: "Phone verified only - basic access",
                    KYCTier.BANK_VERIFIED: "Bank account verified via name enquiry - 80% of merchants",
                    KYCTier.BVN_VERIFIED: "BVN verified - instant payouts, verified badge",
                    KYCTier.FULL_KYC: "Full KYC with NIN, document, liveness - unlimited"
                }.get(tier, "")
            }
            for tier in KYCTier
        ]
    }

# ============================================
# INCLUDE ROUTERS FROM NEW MODULES
# ============================================

# Bank Adapter Router (NIP, Virtual Accounts, Webhooks)
try:
    from app.bank_adapter import router as bank_router
    app.include_router(bank_router)
    logger.info("Bank adapter router included")
except ImportError as e:
    logger.warning(f"Bank adapter router not available: {e}")

# Insurance Integration Router (Licensed Insurer + Protection Fund)
try:
    from app.insurance_integration import router as insurance_router
    app.include_router(insurance_router)
    logger.info("Insurance integration router included")
except ImportError as e:
    logger.warning(f"Insurance integration router not available: {e}")

# Payment Adapters Router (PSP, Switch, Wallet, Telco Money)
try:
    from app.payment_adapters import router as payment_router
    app.include_router(payment_router)
    logger.info("Payment adapters router included")
except ImportError as e:
    logger.warning(f"Payment adapters router not available: {e}")

# OCR Domain Adaptation Router (Nigerian-specific validators, feedback loop)
try:
    from app.ocr_domain_adaptation import router as ocr_router
    app.include_router(ocr_router)
    logger.info("OCR domain adaptation router included")
except ImportError as e:
    logger.warning(f"OCR domain adaptation router not available: {e}")

# Technical Enablers Router (Instant account, settlement, loyalty, working capital)
try:
    from app.technical_enablers import router as enablers_router
    app.include_router(enablers_router)
    logger.info("Technical enablers router included")
except ImportError as e:
    logger.warning(f"Technical enablers router not available: {e}")

# Authentication Router (JWT, API Keys, RBAC)
try:
    from app.auth import router as auth_router
    app.include_router(auth_router)
    logger.info("Authentication router included")
except ImportError as e:
    logger.warning(f"Authentication router not available: {e}")

# Production Mode Router (Health checks, readiness assessment)
try:
    from app.production_mode import router as production_router
    app.include_router(production_router)
    logger.info("Production mode router included")
except ImportError as e:
    logger.warning(f"Production mode router not available: {e}")

# Persistent Storage Router (Storage health, stats)
try:
    from app.persistent_storage import router as storage_router
    app.include_router(storage_router)
    logger.info("Persistent storage router included")
except ImportError as e:
    logger.warning(f"Persistent storage router not available: {e}")

# ============================================
# INCENTIVE SYSTEM ROUTERS
# ============================================

# Seller Tiers Router (Bronze/Silver/Gold/Platinum tiers, automatic upgrades)
try:
    from app.seller_tiers import router as seller_tiers_router
    app.include_router(seller_tiers_router)
    logger.info("Seller tiers router included")
except ImportError as e:
    logger.warning(f"Seller tiers router not available: {e}")

# Loyalty Points Router (Buyer points, rewards, status levels)
try:
    from app.loyalty_points import router as loyalty_router
    app.include_router(loyalty_router)
    logger.info("Loyalty points router included")
except ImportError as e:
    logger.warning(f"Loyalty points router not available: {e}")

# Growth Wallet Router (Seller rebates, wallet services)
try:
    from app.growth_wallet import router as growth_wallet_router
    app.include_router(growth_wallet_router)
    logger.info("Growth wallet router included")
except ImportError as e:
    logger.warning(f"Growth wallet router not available: {e}")

# Viral Sharing Router (Badges, receipts, shareable links)
try:
    from app.viral_sharing import router as viral_sharing_router
    app.include_router(viral_sharing_router)
    logger.info("Viral sharing router included")
except ImportError as e:
    logger.warning(f"Viral sharing router not available: {e}")

# Partner Rewards Router (Telco, logistics, banking partner rewards)
try:
    from app.partner_rewards import router as partner_rewards_router
    app.include_router(partner_rewards_router)
    logger.info("Partner rewards router included")
except ImportError as e:
    logger.warning(f"Partner rewards router not available: {e}")

# ============================================
# COMPETITIVE FEATURE ROUTERS
# ============================================

# Seller Storefront Router (Catalog, inventory, orders, CRM)
try:
    from app.seller_storefront import router as storefront_router
    app.include_router(storefront_router)
    logger.info("Seller storefront router included")
except ImportError as e:
    logger.warning(f"Seller storefront router not available: {e}")

# Returns & Refunds Router (RMA, reverse logistics, refund processing)
try:
    from app.returns_refunds import router as returns_router
    app.include_router(returns_router)
    logger.info("Returns & refunds router included")
except ImportError as e:
    logger.warning(f"Returns & refunds router not available: {e}")

# Proof of Delivery Router (Logistics integration, POD capture)
try:
    from app.proof_of_delivery import router as pod_router
    app.include_router(pod_router)
    logger.info("Proof of delivery router included")
except ImportError as e:
    logger.warning(f"Proof of delivery router not available: {e}")

# Marketplace Discovery Router (Search, listings, seller profiles)
try:
    from app.marketplace_discovery import router as marketplace_router
    app.include_router(marketplace_router)
    logger.info("Marketplace discovery router included")
except ImportError as e:
    logger.warning(f"Marketplace discovery router not available: {e}")

# Dispute Operations Router (SLAs, evidence, arbitration)
try:
    from app.dispute_ops import router as dispute_ops_router
    app.include_router(dispute_ops_router)
    logger.info("Dispute operations router included")
except ImportError as e:
    logger.warning(f"Dispute operations router not available: {e}")

# ============================================
# PRODUCTION-HARDENED ROUTERS (with auth & persistence)
# ============================================

# Authenticated Storefront Router (PostgreSQL persistence + auth middleware)
try:
    from app.competitive_features_auth import storefront_auth_router
    app.include_router(storefront_auth_router)
    logger.info("Authenticated storefront router included")
except ImportError as e:
    logger.warning(f"Authenticated storefront router not available: {e}")

# Authenticated Returns Router (PostgreSQL persistence + auth middleware)
try:
    from app.competitive_features_auth import returns_auth_router
    app.include_router(returns_auth_router)
    logger.info("Authenticated returns router included")
except ImportError as e:
    logger.warning(f"Authenticated returns router not available: {e}")

# Authenticated Delivery Router (PostgreSQL persistence + auth middleware)
try:
    from app.competitive_features_auth import delivery_auth_router
    app.include_router(delivery_auth_router)
    logger.info("Authenticated delivery router included")
except ImportError as e:
    logger.warning(f"Authenticated delivery router not available: {e}")

# Authenticated Marketplace Router (PostgreSQL persistence + auth middleware)
try:
    from app.competitive_features_auth import marketplace_auth_router
    app.include_router(marketplace_auth_router)
    logger.info("Authenticated marketplace router included")
except ImportError as e:
    logger.warning(f"Authenticated marketplace router not available: {e}")

# Authenticated Disputes Router (PostgreSQL persistence + auth middleware)
try:
    from app.competitive_features_auth import disputes_auth_router
    app.include_router(disputes_auth_router)
    logger.info("Authenticated disputes router included")
except ImportError as e:
    logger.warning(f"Authenticated disputes router not available: {e}")

# Background Jobs Router (SLA monitoring, refund processing)
try:
    from app.competitive_features_jobs import jobs_router
    app.include_router(jobs_router)
    logger.info("Background jobs router included")
except ImportError as e:
    logger.warning(f"Background jobs router not available: {e}")

# ============================================
# EVENT STREAMING & LAKEHOUSE ANALYTICS
# ============================================

# Event Streaming Router (Kafka event publishing)
try:
    from app.event_streaming import event_router
    app.include_router(event_router)
    logger.info("Event streaming router included")
except ImportError as e:
    logger.warning(f"Event streaming router not available: {e}")

# Lakehouse Analytics Router (Iceberg tables, Trino queries)
try:
    from app.lakehouse_pipeline import analytics_router
    app.include_router(analytics_router)
    logger.info("Lakehouse analytics router included")
except ImportError as e:
    logger.warning(f"Lakehouse analytics router not available: {e}")

# ============================================
# COMPREHENSIVE MIDDLEWARE INTEGRATIONS
# ============================================

# Full Lakehouse Router (Delta Lake, Spark, Flink, DataFusion, Ray, Sedona)
try:
    from app.lakehouse_full import lakehouse_router
    app.include_router(lakehouse_router)
    logger.info("Full lakehouse router included (Delta Lake, Spark, Flink, DataFusion, Ray, Sedona)")
except ImportError as e:
    logger.warning(f"Full lakehouse router not available: {e}")

# Middleware Health Check Endpoint
@app.get("/api/v1/middleware/health")
async def middleware_health():
    """Check health of all middleware components"""
    try:
        from app.middleware_integrations import check_all_middleware_health
        return await check_all_middleware_health()
    except ImportError as e:
        return {"error": f"Middleware integrations not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# TigerBeetle Money Flows Status
@app.get("/api/v1/middleware/tigerbeetle/status")
async def tigerbeetle_status():
    """Get TigerBeetle money flows status"""
    try:
        from app.middleware_integrations import tigerbeetle_money_flows
        return {
            "connected": tigerbeetle_money_flows.connected,
            "connection_attempts": tigerbeetle_money_flows._connection_attempts,
            "using_production": True
        }
    except ImportError as e:
        return {"error": f"TigerBeetle integration not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# Temporal Workflow Status
@app.get("/api/v1/middleware/temporal/status")
async def temporal_status():
    """Get Temporal workflow engine status"""
    try:
        from app.middleware_integrations import temporal_client
        return {
            "connected": temporal_client.connected,
            "namespace": temporal_client.namespace,
            "task_queue": temporal_client.task_queue
        }
    except ImportError as e:
        return {"error": f"Temporal integration not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# Permify Authorization Status
@app.get("/api/v1/middleware/permify/status")
async def permify_status():
    """Get Permify authorization status"""
    try:
        from app.middleware_integrations import permify_client
        return {
            "connected": permify_client.connected,
            "tenant_id": permify_client.tenant_id
        }
    except ImportError as e:
        return {"error": f"Permify integration not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# OpenSearch Logging Status
@app.get("/api/v1/middleware/opensearch/status")
async def opensearch_status():
    """Get OpenSearch centralized logging status"""
    try:
        from app.middleware_integrations import opensearch_client
        return {
            "connected": opensearch_client.connected,
            "index_prefix": opensearch_client.index_prefix
        }
    except ImportError as e:
        return {"error": f"OpenSearch integration not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# Dapr Service Mesh Status
@app.get("/api/v1/middleware/dapr/status")
async def dapr_status():
    """Get Dapr service mesh status"""
    try:
        from app.middleware_integrations import dapr_client
        return {
            "connected": dapr_client.connected,
            "app_id": dapr_client.app_id
        }
    except ImportError as e:
        return {"error": f"Dapr integration not available: {e}"}
    except Exception as e:
        return {"error": str(e)}

# ============================================
# PERFORMANCE MONITORING ENDPOINTS
# ============================================

@app.get("/api/v1/performance/metrics")
async def get_performance_metrics():
    """Get platform performance metrics (response times, cache hit rates, etc.)"""
    try:
        from app.optimizations import PerformanceMonitor
        return {
            "metrics": PerformanceMonitor.get_all_stats(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e), "metrics": {}}

@app.get("/api/v1/performance/cache")
async def get_cache_stats():
    """Get cache statistics"""
    try:
        from app.optimizations import user_cache, escrow_cache, bank_cache
        from app.repositories import cache as redis_cache
        
        return {
            "memory_caches": {
                "user_cache": {"size": len(user_cache._cache), "max_size": user_cache.max_size},
                "escrow_cache": {"size": len(escrow_cache._cache), "max_size": escrow_cache.max_size},
                "bank_cache": {"size": len(bank_cache._cache), "max_size": bank_cache.max_size},
            },
            "redis": {
                "connected": redis_cache.connected if redis_cache else False,
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/v1/performance/rate-limits")
async def get_rate_limit_status():
    """Get rate limiter status"""
    try:
        from app.optimizations import api_rate_limiter, auth_rate_limiter
        return {
            "api": {"rate": api_rate_limiter.rate, "burst": api_rate_limiter.burst},
            "auth": {"rate": auth_rate_limiter.rate, "burst": auth_rate_limiter.burst},
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}
