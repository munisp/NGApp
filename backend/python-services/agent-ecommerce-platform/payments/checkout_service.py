"""
Checkout Service
Integrates shopping cart, orders, and payments
"""

from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from enum import Enum
import uuid

from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, String, DateTime, Numeric, Integer, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship

Base = declarative_base()

# ============================================================================
# ENUMS
# ============================================================================

class OrderStatus(str, Enum):
    """Order status"""
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class ShippingMethod(str, Enum):
    """Shipping methods"""
    STANDARD = "standard"
    EXPRESS = "express"
    OVERNIGHT = "overnight"
    PICKUP = "pickup"

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Order(Base):
    """Order model"""
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    
    # Customer info
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_email = Column(String(200), nullable=False)
    
    # Store info
    store_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Order amounts
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)
    
    # Discount
    coupon_code = Column(String(50))
    discount_percentage = Column(Numeric(5, 2))
    
    # Status
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING_PAYMENT, index=True)
    payment_status = Column(String(50))
    
    # Shipping
    shipping_method = Column(SQLEnum(ShippingMethod))
    shipping_address = Column(JSONB)
    billing_address = Column(JSONB)
    
    tracking_number = Column(String(100))
    estimated_delivery = Column(DateTime)
    
    # Notes
    customer_notes = Column(Text)
    internal_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    paid_at = Column(DateTime)
    shipped_at = Column(DateTime)
    delivered_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Relationships
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    """Order item model"""
    __tablename__ = "order_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Product info (snapshot at time of order)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(300), nullable=False)
    product_sku = Column(String(100))
    product_image_url = Column(String(500))
    
    # Pricing
    unit_price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    
    # Variant
    variant_id = Column(UUID(as_uuid=True))
    variant_options = Column(JSONB)
    customization = Column(JSONB)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="items")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CheckoutRequest(BaseModel):
    """Checkout request"""
    cart_id: str
    customer_id: str
    customer_email: EmailStr
    
    # Shipping
    shipping_method: ShippingMethod
    shipping_address: Dict[str, Any]
    billing_address: Optional[Dict[str, Any]] = None
    
    # Payment
    payment_method: str
    payment_token: Optional[str] = None
    
    # Notes
    customer_notes: Optional[str] = None

class CheckoutResponse(BaseModel):
    """Checkout response"""
    order_id: str
    order_number: str
    total_amount: Decimal
    payment_required: bool
    payment_url: Optional[str] = None
    status: OrderStatus

# ============================================================================
# CHECKOUT SERVICE
# ============================================================================

class CheckoutService:
    """Checkout service orchestration"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def process_checkout(
        self,
        request: CheckoutRequest
    ) -> CheckoutResponse:
        """
        Process checkout flow:
        1. Validate cart
        2. Create order
        3. Process payment
        4. Update order status
        5. Clear cart
        """
        
        # 1. Get and validate cart
        from cart.shopping_cart import CartManager
        cart_manager = CartManager(self.db, None)
        
        cart = await cart_manager.get_cart(request.cart_id)
        if not cart:
            raise ValueError("Cart not found")
        
        if not cart.items:
            raise ValueError("Cart is empty")
        
        # 2. Create order
        order = await self._create_order_from_cart(cart, request)
        
        # 3. Process payment
        if order.total_amount > 0:
            payment_result = await self._process_payment(order, request)
            
            if payment_result["status"] == "succeeded":
                order.status = OrderStatus.PAID
                order.payment_status = "paid"
                order.paid_at = datetime.utcnow()
            elif payment_result["requires_action"]:
                # 3D Secure or additional verification required
                return CheckoutResponse(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    total_amount=order.total_amount,
                    payment_required=True,
                    payment_url=payment_result["action_url"],
                    status=order.status
                )
            else:
                order.status = OrderStatus.PENDING_PAYMENT
                order.payment_status = "failed"
        else:
            # Free order
            order.status = OrderStatus.PAID
            order.payment_status = "free"
            order.paid_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(order)
        
        # 4. Clear cart
        await cart_manager.clear_cart(request.cart_id)
        
        # 5. Send confirmation email
        await self._send_order_confirmation(order)
        
        return CheckoutResponse(
            order_id=str(order.id),
            order_number=order.order_number,
            total_amount=order.total_amount,
            payment_required=False,
            status=order.status
        )
    
    async def _create_order_from_cart(
        self,
        cart: Any,
        request: CheckoutRequest
    ) -> Order:
        """Create order from cart"""
        
        # Generate order number
        order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        
        # Use billing address if provided, otherwise use shipping address
        billing_address = request.billing_address or request.shipping_address
        
        # Create order
        order = Order(
            id=uuid.uuid4(),
            order_number=order_number,
            customer_id=uuid.UUID(request.customer_id),
            customer_email=request.customer_email,
            store_id=cart.store_id,
            subtotal=cart.subtotal,
            tax_amount=cart.tax_amount,
            shipping_amount=cart.shipping_amount,
            discount_amount=cart.discount_amount,
            total_amount=cart.total_amount,
            coupon_code=cart.coupon_code,
            discount_percentage=cart.discount_percentage,
            shipping_method=request.shipping_method,
            shipping_address=request.shipping_address,
            billing_address=billing_address,
            customer_notes=request.customer_notes,
            status=OrderStatus.PENDING_PAYMENT
        )
        
        self.db.add(order)
        
        # Create order items from cart items
        for cart_item in cart.items:
            order_item = OrderItem(
                id=uuid.uuid4(),
                order_id=order.id,
                product_id=cart_item.product_id,
                product_name=cart_item.product_name,
                product_sku=cart_item.product_sku,
                product_image_url=cart_item.product_image_url,
                unit_price=cart_item.unit_price,
                quantity=cart_item.quantity,
                subtotal=cart_item.subtotal,
                variant_id=cart_item.variant_id,
                variant_options=cart_item.variant_options,
                customization=cart_item.customization
            )
            self.db.add(order_item)
        
        self.db.flush()
        
        return order
    
    async def _process_payment(
        self,
        order: Order,
        request: CheckoutRequest
    ) -> Dict[str, Any]:
        """Process payment for order"""
        
        from payment_gateway import PaymentRequest, PaymentMethod, PaymentGateway
        from payment_service import payment_manager
        
        # Create payment request
        payment_request = PaymentRequest(
            order_id=str(order.id),
            amount=order.total_amount,
            currency="USD",
            payment_method=PaymentMethod(request.payment_method),
            customer_id=str(order.customer_id),
            customer_email=order.customer_email,
            payment_token=request.payment_token,
            billing_address=order.billing_address,
            metadata={
                "order_number": order.order_number,
                "store_id": str(order.store_id)
            },
            three_d_secure=True
        )
        
        # Determine gateway
        gateway = PaymentGateway.STRIPE
        if request.payment_method == "paypal":
            gateway = PaymentGateway.PAYPAL
        
        # Process payment
        response = await payment_manager.process_payment(gateway, payment_request)
        
        return {
            "status": response.status.value,
            "transaction_id": response.transaction_id,
            "requires_action": response.requires_action,
            "action_url": response.action_url
        }
    
    async def _send_order_confirmation(self, order: Order):
        """Send order confirmation email"""
        # Implement email sending via email service
        try:
            import requests
            email_service_url = os.getenv('EMAIL_SERVICE_URL', 'http://localhost:8001')
            requests.post(f"{email_service_url}/api/v1/email/send", json={
                "to": order.customer_email,
                "subject": f"Order Confirmation - {order.order_number}",
                "body": f"Thank you for your order! Order #{order.order_number} has been confirmed."
            }, timeout=5)
        except Exception as e:
            print(f"Failed to send order confirmation: {e}")
        print(f"Sending order confirmation to {order.customer_email} for order {order.order_number}")
    
    async def get_order(self, order_id: str) -> Optional[Order]:
        """Get order by ID"""
        return self.db.query(Order).filter(
            Order.id == uuid.UUID(order_id)
        ).first()
    
    async def get_order_by_number(self, order_number: str) -> Optional[Order]:
        """Get order by order number"""
        return self.db.query(Order).filter(
            Order.order_number == order_number
        ).first()
    
    async def update_order_status(
        self,
        order_id: str,
        status: OrderStatus,
        tracking_number: Optional[str] = None
    ):
        """Update order status"""
        order = await self.get_order(order_id)
        
        if not order:
            raise ValueError("Order not found")
        
        order.status = status
        order.updated_at = datetime.utcnow()
        
        if status == OrderStatus.SHIPPED:
            order.shipped_at = datetime.utcnow()
            if tracking_number:
                order.tracking_number = tracking_number
        
        elif status == OrderStatus.DELIVERED:
            order.delivered_at = datetime.utcnow()
        
        elif status == OrderStatus.CANCELLED:
            order.cancelled_at = datetime.utcnow()
        
        self.db.commit()
    
    async def cancel_order(self, order_id: str, reason: str):
        """Cancel order and refund if paid"""
        order = await self.get_order(order_id)
        
        if not order:
            raise ValueError("Order not found")
        
        if order.status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
            raise ValueError("Cannot cancel shipped or delivered orders")
        
        # If paid, process refund
        if order.status == OrderStatus.PAID:
            # Process refund through payment service
            try:
                import requests
                payment_service_url = os.getenv('PAYMENT_SERVICE_URL', 'http://localhost:8002')
                requests.post(f"{payment_service_url}/api/v1/payments/refund", json={
                    "order_id": str(order.id),
                    "amount": float(order.total_amount),
                    "reason": reason
                }, timeout=10)
            except Exception as e:
                print(f"Failed to process refund: {e}")
        
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.utcnow()
        order.internal_notes = f"Cancelled: {reason}"
        
        self.db.commit()

# ============================================================================
# USAGE EXAMPLE
# ============================================================================

async def example_checkout():
    """Example checkout flow"""
    from sqlalchemy.orm import Session
    
    # Assume we have a database session
    db: Session = ...
    
    checkout_service = CheckoutService(db)
    
    # Create checkout request
    request = CheckoutRequest(
        cart_id="cart-123",
        customer_id="cust-456",
        customer_email="customer@example.com",
        shipping_method=ShippingMethod.STANDARD,
        shipping_address={
            "name": "John Doe",
            "street": "123 Main St",
            "city": "New York",
            "state": "NY",
            "zip": "10001",
            "country": "US"
        },
        payment_method="credit_card",
        payment_token="tok_visa",
        customer_notes="Please ring doorbell"
    )
    
    # Process checkout
    response = await checkout_service.process_checkout(request)
    
    print(f"Order created: {response.order_number}")
    print(f"Status: {response.status}")
    print(f"Total: ${response.total_amount}")
    
    if response.payment_required:
        print(f"Complete payment at: {response.payment_url}")

