"""
Shopping Cart Implementation
Complete cart functionality with persistence and validation
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import json
import redis
from sqlalchemy import Column, String, DateTime, Numeric, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship

Base = declarative_base()

# ============================================================================
# DATABASE MODELS
# ============================================================================

class ShoppingCart(Base):
    """Shopping cart database model"""
    __tablename__ = "shopping_carts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    store_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(String(100), index=True)  # For guest carts
    
    # Cart metadata
    subtotal = Column(Numeric(12, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), default=0)
    
    # Coupon/discount
    coupon_code = Column(String(50))
    discount_percentage = Column(Numeric(5, 2))
    
    # Status
    is_active = Column(Boolean, default=True)
    is_abandoned = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    """Cart item database model"""
    __tablename__ = "cart_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id = Column(UUID(as_uuid=True), ForeignKey("shopping_carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Product snapshot (in case product changes)
    product_name = Column(String(300), nullable=False)
    product_sku = Column(String(100))
    product_image_url = Column(String(500))
    
    # Pricing
    unit_price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    subtotal = Column(Numeric(12, 2), nullable=False)
    
    # Variant/customization
    variant_id = Column(UUID(as_uuid=True))
    variant_options = Column(JSONB)  # {size: "L", color: "Red"}
    customization = Column(JSONB)  # Custom options
    
    # Availability
    is_available = Column(Boolean, default=True)
    availability_message = Column(String(200))
    
    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    cart = relationship("ShoppingCart", back_populates="items")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CartItemRequest(BaseModel):
    """Request to add/update cart item"""
    product_id: str
    quantity: int = Field(gt=0, le=100)
    variant_id: Optional[str] = None
    variant_options: Optional[Dict[str, Any]] = None
    customization: Optional[Dict[str, Any]] = None
    
    @validator('quantity')
    def validate_quantity(cls, v):
        if v < 1:
            raise ValueError('Quantity must be at least 1')
        if v > 100:
            raise ValueError('Quantity cannot exceed 100')
        return v

class CartItemResponse(BaseModel):
    """Cart item response"""
    id: str
    product_id: str
    product_name: str
    product_sku: Optional[str]
    product_image_url: Optional[str]
    unit_price: Decimal
    quantity: int
    subtotal: Decimal
    variant_id: Optional[str]
    variant_options: Optional[Dict[str, Any]]
    customization: Optional[Dict[str, Any]]
    is_available: bool
    availability_message: Optional[str]
    added_at: datetime
    
    class Config:
        from_attributes = True

class CartSummary(BaseModel):
    """Cart summary"""
    subtotal: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    item_count: int
    coupon_code: Optional[str]
    discount_percentage: Optional[Decimal]

class CartResponse(BaseModel):
    """Complete cart response"""
    id: str
    customer_id: str
    store_id: str
    items: List[CartItemResponse]
    summary: CartSummary
    is_abandoned: bool
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    
    class Config:
        from_attributes = True

class ApplyCouponRequest(BaseModel):
    """Apply coupon request"""
    coupon_code: str

# ============================================================================
# CART MANAGER
# ============================================================================

class CartManager:
    """Shopping cart business logic"""
    
    CART_EXPIRY_HOURS = 24
    ABANDONED_CART_HOURS = 2
    
    def __init__(self, db: Session, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client
    
    async def get_or_create_cart(
        self,
        customer_id: str,
        store_id: str,
        session_id: Optional[str] = None
    ) -> ShoppingCart:
        """Get existing cart or create new one"""
        # Try to find active cart
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.customer_id == customer_id,
            ShoppingCart.store_id == store_id,
            ShoppingCart.is_active == True,
            ShoppingCart.expires_at > datetime.utcnow()
        ).first()
        
        if cart:
            # Update last activity
            cart.last_activity_at = datetime.utcnow()
            self.db.commit()
            return cart
        
        # Create new cart
        cart = ShoppingCart(
            id=uuid.uuid4(),
            customer_id=customer_id,
            store_id=store_id,
            session_id=session_id,
            expires_at=datetime.utcnow() + timedelta(hours=self.CART_EXPIRY_HOURS)
        )
        
        self.db.add(cart)
        self.db.commit()
        self.db.refresh(cart)
        
        return cart
    
    async def add_item(
        self,
        cart_id: str,
        product_id: str,
        quantity: int,
        unit_price: Decimal,
        product_name: str,
        product_sku: Optional[str] = None,
        product_image_url: Optional[str] = None,
        variant_id: Optional[str] = None,
        variant_options: Optional[Dict] = None,
        customization: Optional[Dict] = None
    ) -> CartItem:
        """Add item to cart"""
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if not cart:
            raise ValueError("Cart not found")
        
        # Check if item already exists
        existing_item = self.db.query(CartItem).filter(
            CartItem.cart_id == cart_id,
            CartItem.product_id == product_id,
            CartItem.variant_id == variant_id
        ).first()
        
        if existing_item:
            # Update quantity
            existing_item.quantity += quantity
            existing_item.subtotal = existing_item.unit_price * existing_item.quantity
            existing_item.updated_at = datetime.utcnow()
            item = existing_item
        else:
            # Create new item
            item = CartItem(
                id=uuid.uuid4(),
                cart_id=cart_id,
                product_id=product_id,
                product_name=product_name,
                product_sku=product_sku,
                product_image_url=product_image_url,
                unit_price=unit_price,
                quantity=quantity,
                subtotal=unit_price * quantity,
                variant_id=variant_id,
                variant_options=variant_options,
                customization=customization
            )
            self.db.add(item)
        
        # Update cart totals
        await self._recalculate_cart(cart)
        
        self.db.commit()
        self.db.refresh(item)
        
        # Invalidate cache
        await self._invalidate_cart_cache(cart_id)
        
        return item
    
    async def update_item_quantity(
        self,
        cart_id: str,
        item_id: str,
        quantity: int
    ) -> CartItem:
        """Update item quantity"""
        item = self.db.query(CartItem).filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart_id
        ).first()
        
        if not item:
            raise ValueError("Cart item not found")
        
        if quantity <= 0:
            # Remove item
            self.db.delete(item)
        else:
            # Update quantity
            item.quantity = quantity
            item.subtotal = item.unit_price * quantity
            item.updated_at = datetime.utcnow()
        
        # Update cart totals
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        await self._recalculate_cart(cart)
        
        self.db.commit()
        
        # Invalidate cache
        await self._invalidate_cart_cache(cart_id)
        
        return item
    
    async def remove_item(self, cart_id: str, item_id: str):
        """Remove item from cart"""
        item = self.db.query(CartItem).filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart_id
        ).first()
        
        if item:
            self.db.delete(item)
            
            # Update cart totals
            cart = self.db.query(ShoppingCart).filter(
                ShoppingCart.id == cart_id
            ).first()
            await self._recalculate_cart(cart)
            
            self.db.commit()
            
            # Invalidate cache
            await self._invalidate_cart_cache(cart_id)
    
    async def clear_cart(self, cart_id: str):
        """Clear all items from cart"""
        self.db.query(CartItem).filter(
            CartItem.cart_id == cart_id
        ).delete()
        
        # Reset cart totals
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if cart:
            cart.subtotal = 0
            cart.tax_amount = 0
            cart.shipping_amount = 0
            cart.discount_amount = 0
            cart.total_amount = 0
            cart.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        # Invalidate cache
        await self._invalidate_cart_cache(cart_id)
    
    async def apply_coupon(
        self,
        cart_id: str,
        coupon_code: str,
        discount_percentage: Decimal
    ):
        """Apply coupon to cart"""
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if not cart:
            raise ValueError("Cart not found")
        
        cart.coupon_code = coupon_code
        cart.discount_percentage = discount_percentage
        
        # Recalculate with discount
        await self._recalculate_cart(cart)
        
        self.db.commit()
        
        # Invalidate cache
        await self._invalidate_cart_cache(cart_id)
    
    async def remove_coupon(self, cart_id: str):
        """Remove coupon from cart"""
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if not cart:
            raise ValueError("Cart not found")
        
        cart.coupon_code = None
        cart.discount_percentage = None
        cart.discount_amount = 0
        
        # Recalculate without discount
        await self._recalculate_cart(cart)
        
        self.db.commit()
        
        # Invalidate cache
        await self._invalidate_cart_cache(cart_id)
    
    async def get_cart(self, cart_id: str) -> Optional[ShoppingCart]:
        """Get cart with items"""
        # Try cache first
        if self.redis:
            cached = await self._get_cart_from_cache(cart_id)
            if cached:
                return cached
        
        # Get from database
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if cart and self.redis:
            # Cache it
            await self._cache_cart(cart)
        
        return cart
    
    async def mark_as_abandoned(self, cart_id: str):
        """Mark cart as abandoned"""
        cart = self.db.query(ShoppingCart).filter(
            ShoppingCart.id == cart_id
        ).first()
        
        if cart:
            cart.is_abandoned = True
            cart.updated_at = datetime.utcnow()
            self.db.commit()
    
    async def check_abandoned_carts(self):
        """Check for abandoned carts"""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.ABANDONED_CART_HOURS)
        
        abandoned_carts = self.db.query(ShoppingCart).filter(
            ShoppingCart.is_active == True,
            ShoppingCart.is_abandoned == False,
            ShoppingCart.last_activity_at < cutoff_time
        ).all()
        
        for cart in abandoned_carts:
            await self.mark_as_abandoned(cart.id)
        
        return abandoned_carts
    
    async def _recalculate_cart(self, cart: ShoppingCart):
        """Recalculate cart totals"""
        # Get all items
        items = self.db.query(CartItem).filter(
            CartItem.cart_id == cart.id
        ).all()
        
        # Calculate subtotal
        subtotal = sum(item.subtotal for item in items)
        
        # Calculate discount
        discount_amount = Decimal(0)
        if cart.discount_percentage:
            discount_amount = subtotal * (cart.discount_percentage / 100)
        
        # Calculate tax (example: 10%)
        tax_rate = Decimal('0.10')
        tax_amount = (subtotal - discount_amount) * tax_rate
        
        # Calculate shipping (example: flat rate or free over threshold)
        shipping_amount = Decimal('10.00')
        if subtotal > 100:
            shipping_amount = Decimal('0.00')  # Free shipping
        
        # Calculate total
        total_amount = subtotal - discount_amount + tax_amount + shipping_amount
        
        # Update cart
        cart.subtotal = subtotal
        cart.discount_amount = discount_amount
        cart.tax_amount = tax_amount
        cart.shipping_amount = shipping_amount
        cart.total_amount = total_amount
        cart.updated_at = datetime.utcnow()
    
    async def _cache_cart(self, cart: ShoppingCart):
        """Cache cart in Redis"""
        if not self.redis:
            return
        
        cache_key = f"cart:{cart.id}"
        cache_data = {
            "id": str(cart.id),
            "customer_id": str(cart.customer_id),
            "store_id": str(cart.store_id),
            "subtotal": float(cart.subtotal),
            "total_amount": float(cart.total_amount),
            "updated_at": cart.updated_at.isoformat()
        }
        
        self.redis.setex(
            cache_key,
            3600,  # 1 hour TTL
            json.dumps(cache_data)
        )
    
    async def _get_cart_from_cache(self, cart_id: str) -> Optional[Dict]:
        """Get cart from Redis cache"""
        if not self.redis:
            return None
        
        cache_key = f"cart:{cart_id}"
        cached = self.redis.get(cache_key)
        
        if cached:
            return json.loads(cached)
        
        return None
    
    async def _invalidate_cart_cache(self, cart_id: str):
        """Invalidate cart cache"""
        if not self.redis:
            return
        
        cache_key = f"cart:{cart_id}"
        self.redis.delete(cache_key)

