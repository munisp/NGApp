"""
Complete Payment Service
FastAPI integration with database, webhooks, and order management
"""

from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy import Column, String, DateTime, Numeric, Integer, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime
import uuid
import os
import logging

from payment_gateway import (
    PaymentManager,
    StripeGateway,
    PayPalGateway,
    PaymentGateway,
    PaymentRequest,
    PaymentResponse,
    RefundRequest,
    RefundResponse,
    PaymentStatus,
    PaymentMethod
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup
Base = declarative_base()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/ecommerce")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Payment(Base):
    """Payment record"""
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Payment details
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    
    # Gateway info
    gateway = Column(SQLEnum(PaymentGateway), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    transaction_id = Column(String(200), unique=True, index=True)
    
    # Customer info
    customer_email = Column(String(200))
    billing_address = Column(JSONB)
    
    # Payment metadata
    metadata = Column(JSONB)
    receipt_url = Column(String(500))
    failure_reason = Column(Text)
    
    # 3D Secure
    requires_action = Column(Boolean, default=False)
    action_url = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    refunds = relationship("Refund", back_populates="payment", cascade="all, delete-orphan")
    events = relationship("PaymentEvent", back_populates="payment", cascade="all, delete-orphan")

class Refund(Base):
    """Refund record"""
    __tablename__ = "refunds"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Refund details
    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Gateway info
    refund_transaction_id = Column(String(200), unique=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    payment = relationship("Payment", back_populates="refunds")

class PaymentEvent(Base):
    """Payment event log"""
    __tablename__ = "payment_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False)
    event_data = Column(JSONB)
    
    # Source
    source = Column(String(50))  # webhook, api, system
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    payment = relationship("Payment", back_populates="events")

# Create tables
Base.metadata.create_all(bind=engine)

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="E-commerce Payment Service",
    description="Complete payment processing with Stripe and PayPal",
    version="1.0.0"
)

# Initialize payment manager
payment_manager = PaymentManager()

# Register Stripe
if os.getenv("STRIPE_SECRET_KEY"):
    stripe_gateway = StripeGateway(
        api_key=os.getenv("STRIPE_SECRET_KEY"),
        webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET")
    )
    payment_manager.register_gateway(PaymentGateway.STRIPE, stripe_gateway)
    logger.info("Stripe gateway registered")

# Register PayPal
if os.getenv("PAYPAL_CLIENT_ID"):
    paypal_gateway = PayPalGateway(
        client_id=os.getenv("PAYPAL_CLIENT_ID"),
        client_secret=os.getenv("PAYPAL_CLIENT_SECRET"),
        mode=os.getenv("PAYPAL_MODE", "sandbox")
    )
    payment_manager.register_gateway(PaymentGateway.PAYPAL, paypal_gateway)
    logger.info("PayPal gateway registered")

# ============================================================================
# DATABASE DEPENDENCY
# ============================================================================

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# PAYMENT ENDPOINTS
# ============================================================================

@app.post("/payments/create", response_model=Dict[str, Any])
async def create_payment(
    request: PaymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create a new payment
    
    This endpoint processes a payment through the specified gateway (Stripe or PayPal).
    It creates a payment record in the database and returns the payment status.
    """
    try:
        # Determine gateway
        gateway = PaymentGateway.STRIPE  # Default to Stripe
        if request.payment_method == PaymentMethod.PAYPAL:
            gateway = PaymentGateway.PAYPAL
        
        # Process payment through gateway
        response = await payment_manager.process_payment(gateway, request)
        
        # Create payment record
        payment = Payment(
            id=uuid.uuid4(),
            order_id=uuid.UUID(request.order_id),
            customer_id=uuid.UUID(request.customer_id),
            amount=request.amount,
            currency=request.currency,
            status=response.status,
            gateway=gateway,
            payment_method=request.payment_method,
            transaction_id=response.transaction_id,
            customer_email=request.customer_email,
            billing_address=request.billing_address,
            metadata=request.metadata,
            receipt_url=response.receipt_url,
            failure_reason=response.failure_reason,
            requires_action=response.requires_action,
            action_url=response.action_url
        )
        
        if response.status == PaymentStatus.SUCCEEDED:
            payment.completed_at = datetime.utcnow()
        
        db.add(payment)
        
        # Log event
        event = PaymentEvent(
            id=uuid.uuid4(),
            payment_id=payment.id,
            event_type="payment.created",
            event_data={
                "gateway": gateway.value,
                "amount": float(request.amount),
                "status": response.status.value
            },
            source="api"
        )
        db.add(event)
        
        db.commit()
        db.refresh(payment)
        
        # Send notification in background
        background_tasks.add_task(
            send_payment_notification,
            payment.id,
            payment.customer_email,
            response.status
        )
        
        logger.info(f"Payment created: {payment.id}, status: {response.status}")
        
        return {
            "payment_id": str(payment.id),
            "transaction_id": response.transaction_id,
            "status": response.status.value,
            "amount": float(response.amount),
            "currency": response.currency,
            "receipt_url": response.receipt_url,
            "requires_action": response.requires_action,
            "action_url": response.action_url,
            "created_at": payment.created_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Payment creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/payments/{payment_id}", response_model=Dict[str, Any])
async def get_payment(payment_id: str, db: Session = Depends(get_db)):
    """Get payment details"""
    try:
        payment = db.query(Payment).filter(
            Payment.id == uuid.UUID(payment_id)
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return {
            "payment_id": str(payment.id),
            "order_id": str(payment.order_id),
            "customer_id": str(payment.customer_id),
            "amount": float(payment.amount),
            "currency": payment.currency,
            "status": payment.status.value,
            "gateway": payment.gateway.value,
            "payment_method": payment.payment_method.value,
            "transaction_id": payment.transaction_id,
            "receipt_url": payment.receipt_url,
            "failure_reason": payment.failure_reason,
            "requires_action": payment.requires_action,
            "action_url": payment.action_url,
            "created_at": payment.created_at.isoformat(),
            "updated_at": payment.updated_at.isoformat(),
            "completed_at": payment.completed_at.isoformat() if payment.completed_at else None
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment ID")
    except Exception as e:
        logger.error(f"Get payment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/payments/{payment_id}/refund", response_model=Dict[str, Any])
async def refund_payment(
    payment_id: str,
    refund_request: RefundRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Refund a payment (full or partial)"""
    try:
        # Get payment
        payment = db.query(Payment).filter(
            Payment.id == uuid.UUID(payment_id)
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment.status != PaymentStatus.SUCCEEDED:
            raise HTTPException(
                status_code=400,
                detail="Can only refund succeeded payments"
            )
        
        # Process refund through gateway
        refund_request.payment_id = payment.transaction_id
        refund_response = await payment_manager.refund_payment(
            payment.gateway,
            refund_request
        )
        
        # Create refund record
        refund = Refund(
            id=uuid.uuid4(),
            payment_id=payment.id,
            amount=refund_response.amount,
            reason=refund_request.reason,
            status=refund_response.status,
            refund_transaction_id=refund_response.refund_id
        )
        
        if refund_response.status == PaymentStatus.REFUNDED:
            refund.completed_at = datetime.utcnow()
            
            # Update payment status
            total_refunded = sum(r.amount for r in payment.refunds) + refund.amount
            if total_refunded >= payment.amount:
                payment.status = PaymentStatus.REFUNDED
            else:
                payment.status = PaymentStatus.PARTIALLY_REFUNDED
        
        db.add(refund)
        
        # Log event
        event = PaymentEvent(
            id=uuid.uuid4(),
            payment_id=payment.id,
            event_type="payment.refunded",
            event_data={
                "refund_id": str(refund.id),
                "amount": float(refund.amount),
                "status": refund.status.value
            },
            source="api"
        )
        db.add(event)
        
        db.commit()
        db.refresh(refund)
        
        # Send notification
        background_tasks.add_task(
            send_refund_notification,
            payment.id,
            payment.customer_email,
            refund.amount
        )
        
        logger.info(f"Refund created: {refund.id}, amount: {refund.amount}")
        
        return {
            "refund_id": str(refund.id),
            "payment_id": str(payment.id),
            "amount": float(refund.amount),
            "status": refund.status.value,
            "created_at": refund.created_at.isoformat()
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment ID")
    except Exception as e:
        logger.error(f"Refund failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/payments/{payment_id}/refunds", response_model=List[Dict[str, Any]])
async def get_refunds(payment_id: str, db: Session = Depends(get_db)):
    """Get all refunds for a payment"""
    try:
        payment = db.query(Payment).filter(
            Payment.id == uuid.UUID(payment_id)
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        refunds = []
        for refund in payment.refunds:
            refunds.append({
                "refund_id": str(refund.id),
                "amount": float(refund.amount),
                "reason": refund.reason,
                "status": refund.status.value,
                "created_at": refund.created_at.isoformat(),
                "completed_at": refund.completed_at.isoformat() if refund.completed_at else None
            })
        
        return refunds
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment ID")
    except Exception as e:
        logger.error(f"Get refunds failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/payments", response_model=Dict[str, Any])
async def list_payments(
    customer_id: Optional[str] = None,
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List payments with filters"""
    try:
        query = db.query(Payment)
        
        if customer_id:
            query = query.filter(Payment.customer_id == uuid.UUID(customer_id))
        
        if order_id:
            query = query.filter(Payment.order_id == uuid.UUID(order_id))
        
        if status:
            query = query.filter(Payment.status == PaymentStatus(status))
        
        total = query.count()
        
        payments = query.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()
        
        results = []
        for payment in payments:
            results.append({
                "payment_id": str(payment.id),
                "order_id": str(payment.order_id),
                "amount": float(payment.amount),
                "currency": payment.currency,
                "status": payment.status.value,
                "gateway": payment.gateway.value,
                "payment_method": payment.payment_method.value,
                "created_at": payment.created_at.isoformat()
            })
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "payments": results
        }
        
    except Exception as e:
        logger.error(f"List payments failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WEBHOOK ENDPOINTS
# ============================================================================

@app.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    try:
        payload = await request.body()
        signature = request.headers.get("stripe-signature")
        
        # Verify webhook
        stripe_gateway = payment_manager.gateways.get(PaymentGateway.STRIPE)
        if not stripe_gateway:
            raise HTTPException(status_code=400, detail="Stripe not configured")
        
        if not await stripe_gateway.verify_webhook(payload, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse event
        import json
        event = json.loads(payload)
        
        logger.info(f"Stripe webhook received: {event['type']}")
        
        # Handle different event types
        if event["type"] == "payment_intent.succeeded":
            transaction_id = event["data"]["object"]["id"]
            await handle_payment_succeeded(transaction_id, db, background_tasks)
        
        elif event["type"] == "payment_intent.payment_failed":
            transaction_id = event["data"]["object"]["id"]
            await handle_payment_failed(transaction_id, db, background_tasks)
        
        elif event["type"] == "charge.refunded":
            transaction_id = event["data"]["object"]["payment_intent"]
            await handle_payment_refunded(transaction_id, db, background_tasks)
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Stripe webhook failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/webhooks/paypal")
async def paypal_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle PayPal webhooks"""
    try:
        payload = await request.json()
        
        logger.info(f"PayPal webhook received: {payload.get('event_type')}")
        
        # Handle different event types
        event_type = payload.get("event_type")
        
        if event_type == "PAYMENT.CAPTURE.COMPLETED":
            transaction_id = payload["resource"]["id"]
            await handle_payment_succeeded(transaction_id, db, background_tasks)
        
        elif event_type == "PAYMENT.CAPTURE.DENIED":
            transaction_id = payload["resource"]["id"]
            await handle_payment_failed(transaction_id, db, background_tasks)
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"PayPal webhook failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WEBHOOK HANDLERS
# ============================================================================

async def handle_payment_succeeded(
    transaction_id: str,
    db: Session,
    background_tasks: BackgroundTasks
):
    """Handle successful payment"""
    payment = db.query(Payment).filter(
        Payment.transaction_id == transaction_id
    ).first()
    
    if payment and payment.status != PaymentStatus.SUCCEEDED:
        payment.status = PaymentStatus.SUCCEEDED
        payment.completed_at = datetime.utcnow()
        
        # Log event
        event = PaymentEvent(
            id=uuid.uuid4(),
            payment_id=payment.id,
            event_type="payment.succeeded",
            event_data={"transaction_id": transaction_id},
            source="webhook"
        )
        db.add(event)
        
        db.commit()
        
        # Send notification
        background_tasks.add_task(
            send_payment_notification,
            payment.id,
            payment.customer_email,
            PaymentStatus.SUCCEEDED
        )
        
        logger.info(f"Payment succeeded: {payment.id}")

async def handle_payment_failed(
    transaction_id: str,
    db: Session,
    background_tasks: BackgroundTasks
):
    """Handle failed payment"""
    payment = db.query(Payment).filter(
        Payment.transaction_id == transaction_id
    ).first()
    
    if payment and payment.status != PaymentStatus.FAILED:
        payment.status = PaymentStatus.FAILED
        
        # Log event
        event = PaymentEvent(
            id=uuid.uuid4(),
            payment_id=payment.id,
            event_type="payment.failed",
            event_data={"transaction_id": transaction_id},
            source="webhook"
        )
        db.add(event)
        
        db.commit()
        
        # Send notification
        background_tasks.add_task(
            send_payment_notification,
            payment.id,
            payment.customer_email,
            PaymentStatus.FAILED
        )
        
        logger.info(f"Payment failed: {payment.id}")

async def handle_payment_refunded(
    transaction_id: str,
    db: Session,
    background_tasks: BackgroundTasks
):
    """Handle refunded payment"""
    payment = db.query(Payment).filter(
        Payment.transaction_id == transaction_id
    ).first()
    
    if payment:
        payment.status = PaymentStatus.REFUNDED
        
        # Log event
        event = PaymentEvent(
            id=uuid.uuid4(),
            payment_id=payment.id,
            event_type="payment.refunded",
            event_data={"transaction_id": transaction_id},
            source="webhook"
        )
        db.add(event)
        
        db.commit()
        
        logger.info(f"Payment refunded: {payment.id}")

# ============================================================================
# NOTIFICATION FUNCTIONS
# ============================================================================

async def send_payment_notification(
    payment_id: uuid.UUID,
    customer_email: str,
    status: PaymentStatus
):
    """Send payment notification email"""
    # In production, integrate with email service
    logger.info(f"Sending payment notification to {customer_email}: {status.value}")
    # Implement email sending via email service
    try:
        import requests
        email_service_url = os.getenv('EMAIL_SERVICE_URL', 'http://localhost:8001')
        requests.post(f"{email_service_url}/api/v1/email/send", json={
            "to": customer_email,
            "subject": f"Payment {status.value}",
            "body": f"Your payment for order {payment_id} is {status.value}"
        }, timeout=5)
    except Exception as e:
        logger.error(f"Failed to send payment notification: {e}")

async def send_refund_notification(
    payment_id: uuid.UUID,
    customer_email: str,
    amount: Decimal
):
    """Send refund notification email"""
    # In production, integrate with email service
    logger.info(f"Sending refund notification to {customer_email}: ${amount}")
    # Implement email sending via email service
    try:
        import requests
        email_service_url = os.getenv('EMAIL_SERVICE_URL', 'http://localhost:8001')
        requests.post(f"{email_service_url}/api/v1/email/send", json={
            "to": customer_email,
            "subject": "Refund Processed",
            "body": f"Your refund of ${amount} for payment {payment_id} has been processed"
        }, timeout=5)
    except Exception as e:
        logger.error(f"Failed to send refund notification: {e}")

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "payment-service",
        "version": "1.0.0",
        "gateways": {
            "stripe": "STRIPE" in [g.name for g in payment_manager.gateways.keys()],
            "paypal": "PAYPAL" in [g.name for g in payment_manager.gateways.keys()]
        }
    }

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

