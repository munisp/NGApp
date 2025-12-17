"""
Seller Storefront & Catalog System

Provides sellers with a complete business operating system:
- Product catalog with inventory management
- Pricing and variants
- Order management
- Customer CRM
- Messaging automation
- Analytics dashboard

This makes EscrowProtect the seller's "home base" rather than just an escrow layer.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/storefront", tags=["Seller Storefront"])


# ============================================
# ENUMS
# ============================================

class ProductStatus(str, Enum):
    """Product listing status"""
    DRAFT = "draft"
    ACTIVE = "active"
    OUT_OF_STOCK = "out_of_stock"
    PAUSED = "paused"
    ARCHIVED = "archived"


class OrderStatus(str, Enum):
    """Order status in seller's view"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    DISPUTED = "disputed"


class CustomerSegment(str, Enum):
    """Customer segmentation for CRM"""
    NEW = "new"
    RETURNING = "returning"
    VIP = "vip"
    AT_RISK = "at_risk"
    CHURNED = "churned"


class MessageTemplateType(str, Enum):
    """Types of automated messages"""
    ORDER_CONFIRMATION = "order_confirmation"
    SHIPPING_UPDATE = "shipping_update"
    DELIVERY_CONFIRMATION = "delivery_confirmation"
    REVIEW_REQUEST = "review_request"
    ABANDONED_CART = "abandoned_cart"
    RESTOCK_ALERT = "restock_alert"
    PROMOTION = "promotion"
    FOLLOW_UP = "follow_up"


# ============================================
# DATA MODELS
# ============================================

@dataclass
class ProductVariant:
    """Product variant (size, color, etc.)"""
    variant_id: str
    name: str  # e.g., "Large", "Red", "32GB"
    sku: str
    price_ngn: int
    compare_at_price_ngn: Optional[int] = None  # Original price for showing discounts
    inventory_quantity: int = 0
    weight_kg: Optional[float] = None
    is_active: bool = True


@dataclass
class ProductImage:
    """Product image"""
    image_id: str
    url: str
    alt_text: str
    position: int = 0
    is_primary: bool = False


@dataclass
class Product:
    """Product in seller's catalog"""
    product_id: str
    seller_id: str
    title: str
    description: str
    category: str
    status: ProductStatus
    variants: List[ProductVariant]
    images: List[ProductImage]
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    
    # Pricing (for single-variant products)
    base_price_ngn: int = 0
    compare_at_price_ngn: Optional[int] = None
    
    # Inventory
    track_inventory: bool = True
    total_inventory: int = 0
    low_stock_threshold: int = 5
    
    # Shipping
    weight_kg: float = 0.5
    requires_shipping: bool = True
    
    # SEO
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    
    # Analytics
    view_count: int = 0
    order_count: int = 0
    conversion_rate: float = 0.0


@dataclass
class Customer:
    """Customer in seller's CRM"""
    customer_id: str
    seller_id: str
    name: str
    phone: str
    email: Optional[str]
    whatsapp: Optional[str]
    segment: CustomerSegment
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    
    # Stats
    total_orders: int = 0
    total_spent_ngn: int = 0
    average_order_value_ngn: int = 0
    last_order_date: Optional[datetime] = None
    
    # Engagement
    accepts_marketing: bool = True
    last_contacted: Optional[datetime] = None
    notes: str = ""
    tags: List[str] = field(default_factory=list)
    
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Order:
    """Order in seller's order management"""
    order_id: str
    seller_id: str
    customer_id: str
    escrow_id: Optional[str]  # Link to escrow transaction
    
    status: OrderStatus
    
    # Items
    items: List[Dict[str, Any]]  # [{product_id, variant_id, quantity, price}]
    
    # Totals
    subtotal_ngn: int
    shipping_ngn: int
    
    # Shipping (required fields)
    shipping_address: str
    shipping_city: str
    shipping_state: str
    
    # Optional totals
    discount_ngn: int = 0
    total_ngn: int = 0
    
    # Shipping (optional fields)
    shipping_method: str = "standard"
    tracking_number: Optional[str] = None
    
    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    confirmed_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Notes
    seller_notes: str = ""
    buyer_notes: str = ""


@dataclass
class MessageTemplate:
    """Automated message template"""
    template_id: str
    seller_id: str
    template_type: MessageTemplateType
    name: str
    content: str  # Supports variables like {{customer_name}}, {{order_id}}
    is_active: bool = True
    send_via: str = "whatsapp"  # whatsapp, sms, both
    delay_hours: int = 0  # Delay after trigger event


@dataclass
class StorefrontSettings:
    """Seller's storefront settings"""
    seller_id: str
    store_name: str
    store_description: str
    logo_url: Optional[str]
    banner_url: Optional[str]
    
    # Contact
    phone: str
    whatsapp: str
    email: Optional[str]
    instagram: Optional[str]
    
    # Location
    city: str
    state: str
    address: Optional[str]
    
    # Business
    business_hours: str = "Mon-Sat 9am-6pm"
    accepts_returns: bool = True
    return_policy: str = "Returns accepted within 7 days"
    
    # Appearance
    primary_color: str = "#4F46E5"
    
    # Features
    show_reviews: bool = True
    show_sold_count: bool = True
    enable_chat: bool = True
    
    created_at: datetime = field(default_factory=datetime.utcnow)


# ============================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================

products_db: Dict[str, Product] = {}
customers_db: Dict[str, Customer] = {}
orders_db: Dict[str, Order] = {}
templates_db: Dict[str, MessageTemplate] = {}
settings_db: Dict[str, StorefrontSettings] = {}


# ============================================
# STOREFRONT ENGINE
# ============================================

class StorefrontEngine:
    """Core engine for seller storefront operations"""
    
    # ============================================
    # PRODUCT MANAGEMENT
    # ============================================
    
    @staticmethod
    def create_product(
        seller_id: str,
        title: str,
        description: str,
        category: str,
        base_price_ngn: int,
        images: List[Dict[str, str]] = None,
        variants: List[Dict[str, Any]] = None,
        tags: List[str] = None,
        track_inventory: bool = True,
        initial_quantity: int = 0
    ) -> Product:
        """Create a new product"""
        product_id = f"prod_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        
        # Create images
        product_images = []
        if images:
            for i, img in enumerate(images):
                product_images.append(ProductImage(
                    image_id=f"img_{uuid.uuid4().hex[:8]}",
                    url=img.get("url", ""),
                    alt_text=img.get("alt_text", title),
                    position=i,
                    is_primary=(i == 0)
                ))
        
        # Create variants
        product_variants = []
        if variants:
            for var in variants:
                product_variants.append(ProductVariant(
                    variant_id=f"var_{uuid.uuid4().hex[:8]}",
                    name=var.get("name", "Default"),
                    sku=var.get("sku", f"SKU-{uuid.uuid4().hex[:6].upper()}"),
                    price_ngn=var.get("price_ngn", base_price_ngn),
                    compare_at_price_ngn=var.get("compare_at_price_ngn"),
                    inventory_quantity=var.get("inventory_quantity", 0)
                ))
        else:
            # Single variant product
            product_variants.append(ProductVariant(
                variant_id=f"var_{uuid.uuid4().hex[:8]}",
                name="Default",
                sku=f"SKU-{uuid.uuid4().hex[:6].upper()}",
                price_ngn=base_price_ngn,
                inventory_quantity=initial_quantity
            ))
        
        product = Product(
            product_id=product_id,
            seller_id=seller_id,
            title=title,
            description=description,
            category=category,
            status=ProductStatus.DRAFT,
            variants=product_variants,
            images=product_images,
            tags=tags or [],
            created_at=now,
            updated_at=now,
            base_price_ngn=base_price_ngn,
            track_inventory=track_inventory,
            total_inventory=sum(v.inventory_quantity for v in product_variants)
        )
        
        products_db[product_id] = product
        logger.info(f"Created product {product_id} for seller {seller_id}")
        return product
    
    @staticmethod
    def update_product(product_id: str, updates: Dict[str, Any]) -> Product:
        """Update a product"""
        if product_id not in products_db:
            raise ValueError(f"Product {product_id} not found")
        
        product = products_db[product_id]
        
        for key, value in updates.items():
            if hasattr(product, key) and key not in ["product_id", "seller_id", "created_at"]:
                setattr(product, key, value)
        
        product.updated_at = datetime.utcnow()
        return product
    
    @staticmethod
    def update_inventory(product_id: str, variant_id: str, quantity_change: int) -> ProductVariant:
        """Update inventory for a variant"""
        if product_id not in products_db:
            raise ValueError(f"Product {product_id} not found")
        
        product = products_db[product_id]
        
        for variant in product.variants:
            if variant.variant_id == variant_id:
                variant.inventory_quantity += quantity_change
                if variant.inventory_quantity < 0:
                    variant.inventory_quantity = 0
                
                # Update total inventory
                product.total_inventory = sum(v.inventory_quantity for v in product.variants)
                
                # Check if out of stock
                if product.total_inventory == 0 and product.status == ProductStatus.ACTIVE:
                    product.status = ProductStatus.OUT_OF_STOCK
                
                product.updated_at = datetime.utcnow()
                return variant
        
        raise ValueError(f"Variant {variant_id} not found")
    
    @staticmethod
    def get_seller_products(
        seller_id: str,
        status: Optional[ProductStatus] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Product]:
        """Get products for a seller"""
        products = [p for p in products_db.values() if p.seller_id == seller_id]
        
        if status:
            products = [p for p in products if p.status == status]
        
        if category:
            products = [p for p in products if p.category == category]
        
        if search:
            search_lower = search.lower()
            products = [p for p in products if search_lower in p.title.lower() or search_lower in p.description.lower()]
        
        # Sort by updated_at descending
        products.sort(key=lambda p: p.updated_at, reverse=True)
        
        return products[offset:offset + limit]
    
    @staticmethod
    def get_low_stock_products(seller_id: str) -> List[Product]:
        """Get products with low stock"""
        return [
            p for p in products_db.values()
            if p.seller_id == seller_id
            and p.track_inventory
            and p.total_inventory <= p.low_stock_threshold
            and p.status == ProductStatus.ACTIVE
        ]
    
    # ============================================
    # CUSTOMER CRM
    # ============================================
    
    @staticmethod
    def create_or_update_customer(
        seller_id: str,
        phone: str,
        name: str,
        email: Optional[str] = None,
        whatsapp: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None
    ) -> Customer:
        """Create or update a customer"""
        # Check if customer exists by phone
        existing = None
        for c in customers_db.values():
            if c.seller_id == seller_id and c.phone == phone:
                existing = c
                break
        
        if existing:
            # Update existing customer
            if name:
                existing.name = name
            if email:
                existing.email = email
            if whatsapp:
                existing.whatsapp = whatsapp
            if address:
                existing.address = address
            if city:
                existing.city = city
            if state:
                existing.state = state
            return existing
        
        # Create new customer
        customer_id = f"cust_{uuid.uuid4().hex[:12]}"
        customer = Customer(
            customer_id=customer_id,
            seller_id=seller_id,
            name=name,
            phone=phone,
            email=email,
            whatsapp=whatsapp or phone,
            segment=CustomerSegment.NEW,
            address=address,
            city=city,
            state=state
        )
        
        customers_db[customer_id] = customer
        logger.info(f"Created customer {customer_id} for seller {seller_id}")
        return customer
    
    @staticmethod
    def update_customer_stats(customer_id: str, order_amount_ngn: int):
        """Update customer stats after an order"""
        if customer_id not in customers_db:
            return
        
        customer = customers_db[customer_id]
        customer.total_orders += 1
        customer.total_spent_ngn += order_amount_ngn
        customer.average_order_value_ngn = customer.total_spent_ngn // customer.total_orders
        customer.last_order_date = datetime.utcnow()
        
        # Update segment
        if customer.total_orders >= 10 or customer.total_spent_ngn >= 500000:
            customer.segment = CustomerSegment.VIP
        elif customer.total_orders >= 2:
            customer.segment = CustomerSegment.RETURNING
    
    @staticmethod
    def get_seller_customers(
        seller_id: str,
        segment: Optional[CustomerSegment] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Customer]:
        """Get customers for a seller"""
        customers = [c for c in customers_db.values() if c.seller_id == seller_id]
        
        if segment:
            customers = [c for c in customers if c.segment == segment]
        
        if search:
            search_lower = search.lower()
            customers = [c for c in customers if 
                        search_lower in c.name.lower() or 
                        search_lower in c.phone or
                        (c.email and search_lower in c.email.lower())]
        
        # Sort by total_spent descending
        customers.sort(key=lambda c: c.total_spent_ngn, reverse=True)
        
        return customers[offset:offset + limit]
    
    @staticmethod
    def identify_at_risk_customers(seller_id: str, days_inactive: int = 60) -> List[Customer]:
        """Identify customers who haven't ordered recently"""
        cutoff = datetime.utcnow() - timedelta(days=days_inactive)
        at_risk = []
        
        for customer in customers_db.values():
            if customer.seller_id == seller_id:
                if customer.last_order_date and customer.last_order_date < cutoff:
                    if customer.segment != CustomerSegment.CHURNED:
                        customer.segment = CustomerSegment.AT_RISK
                        at_risk.append(customer)
        
        return at_risk
    
    # ============================================
    # ORDER MANAGEMENT
    # ============================================
    
    @staticmethod
    def create_order(
        seller_id: str,
        customer_id: str,
        items: List[Dict[str, Any]],
        shipping_address: str,
        shipping_city: str,
        shipping_state: str,
        shipping_ngn: int = 0,
        discount_ngn: int = 0,
        escrow_id: Optional[str] = None,
        buyer_notes: str = ""
    ) -> Order:
        """Create a new order"""
        order_id = f"ord_{uuid.uuid4().hex[:12]}"
        
        # Calculate subtotal
        subtotal = 0
        for item in items:
            subtotal += item.get("price_ngn", 0) * item.get("quantity", 1)
        
        total = subtotal + shipping_ngn - discount_ngn
        
        order = Order(
            order_id=order_id,
            seller_id=seller_id,
            customer_id=customer_id,
            escrow_id=escrow_id,
            status=OrderStatus.PENDING,
            items=items,
            subtotal_ngn=subtotal,
            shipping_ngn=shipping_ngn,
            discount_ngn=discount_ngn,
            total_ngn=total,
            shipping_address=shipping_address,
            shipping_city=shipping_city,
            shipping_state=shipping_state,
            buyer_notes=buyer_notes
        )
        
        orders_db[order_id] = order
        
        # Update customer stats
        StorefrontEngine.update_customer_stats(customer_id, total)
        
        # Update product stats
        for item in items:
            product_id = item.get("product_id")
            if product_id and product_id in products_db:
                products_db[product_id].order_count += 1
                # Decrease inventory
                variant_id = item.get("variant_id")
                if variant_id:
                    try:
                        StorefrontEngine.update_inventory(
                            product_id, 
                            variant_id, 
                            -item.get("quantity", 1)
                        )
                    except ValueError:
                        pass
        
        logger.info(f"Created order {order_id} for seller {seller_id}")
        return order
    
    @staticmethod
    def update_order_status(order_id: str, new_status: OrderStatus, tracking_number: Optional[str] = None) -> Order:
        """Update order status"""
        if order_id not in orders_db:
            raise ValueError(f"Order {order_id} not found")
        
        order = orders_db[order_id]
        order.status = new_status
        now = datetime.utcnow()
        
        if new_status == OrderStatus.CONFIRMED:
            order.confirmed_at = now
        elif new_status == OrderStatus.SHIPPED:
            order.shipped_at = now
            if tracking_number:
                order.tracking_number = tracking_number
        elif new_status == OrderStatus.DELIVERED:
            order.delivered_at = now
        elif new_status == OrderStatus.COMPLETED:
            order.completed_at = now
        
        return order
    
    @staticmethod
    def get_seller_orders(
        seller_id: str,
        status: Optional[OrderStatus] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Order]:
        """Get orders for a seller"""
        orders = [o for o in orders_db.values() if o.seller_id == seller_id]
        
        if status:
            orders = [o for o in orders if o.status == status]
        
        if date_from:
            orders = [o for o in orders if o.created_at >= date_from]
        
        if date_to:
            orders = [o for o in orders if o.created_at <= date_to]
        
        # Sort by created_at descending
        orders.sort(key=lambda o: o.created_at, reverse=True)
        
        return orders[offset:offset + limit]
    
    # ============================================
    # MESSAGE TEMPLATES
    # ============================================
    
    @staticmethod
    def create_message_template(
        seller_id: str,
        template_type: MessageTemplateType,
        name: str,
        content: str,
        send_via: str = "whatsapp",
        delay_hours: int = 0
    ) -> MessageTemplate:
        """Create a message template"""
        template_id = f"tmpl_{uuid.uuid4().hex[:12]}"
        
        template = MessageTemplate(
            template_id=template_id,
            seller_id=seller_id,
            template_type=template_type,
            name=name,
            content=content,
            send_via=send_via,
            delay_hours=delay_hours
        )
        
        templates_db[template_id] = template
        return template
    
    @staticmethod
    def get_default_templates() -> List[Dict[str, Any]]:
        """Get default message templates"""
        return [
            {
                "type": MessageTemplateType.ORDER_CONFIRMATION,
                "name": "Order Confirmation",
                "content": "Hi {{customer_name}}! 🎉 Your order #{{order_id}} has been confirmed. Total: ₦{{total}}. We'll notify you when it ships. Thank you for shopping with us!",
                "delay_hours": 0
            },
            {
                "type": MessageTemplateType.SHIPPING_UPDATE,
                "name": "Shipping Update",
                "content": "Hi {{customer_name}}! Your order #{{order_id}} has been shipped! 📦 Tracking: {{tracking_number}}. Expected delivery: {{delivery_date}}",
                "delay_hours": 0
            },
            {
                "type": MessageTemplateType.DELIVERY_CONFIRMATION,
                "name": "Delivery Confirmation",
                "content": "Hi {{customer_name}}! Your order #{{order_id}} has been delivered! ✅ Please confirm receipt in the app. If you have any issues, let us know within 24 hours.",
                "delay_hours": 0
            },
            {
                "type": MessageTemplateType.REVIEW_REQUEST,
                "name": "Review Request",
                "content": "Hi {{customer_name}}! How was your experience with your recent order? We'd love to hear your feedback! Leave a review: {{review_link}}",
                "delay_hours": 48
            },
            {
                "type": MessageTemplateType.ABANDONED_CART,
                "name": "Abandoned Cart",
                "content": "Hi {{customer_name}}! You left some items in your cart. Complete your order now and get free delivery! 🛒 {{cart_link}}",
                "delay_hours": 2
            },
            {
                "type": MessageTemplateType.RESTOCK_ALERT,
                "name": "Restock Alert",
                "content": "Hi {{customer_name}}! Good news! {{product_name}} is back in stock. Get yours before it sells out again! {{product_link}}",
                "delay_hours": 0
            }
        ]
    
    @staticmethod
    def render_template(template: MessageTemplate, variables: Dict[str, str]) -> str:
        """Render a template with variables"""
        content = template.content
        for key, value in variables.items():
            content = content.replace(f"{{{{{key}}}}}", str(value))
        return content
    
    # ============================================
    # STOREFRONT SETTINGS
    # ============================================
    
    @staticmethod
    def create_or_update_settings(
        seller_id: str,
        store_name: str,
        store_description: str,
        phone: str,
        whatsapp: str,
        city: str,
        state: str,
        **kwargs
    ) -> StorefrontSettings:
        """Create or update storefront settings"""
        if seller_id in settings_db:
            settings = settings_db[seller_id]
            settings.store_name = store_name
            settings.store_description = store_description
            settings.phone = phone
            settings.whatsapp = whatsapp
            settings.city = city
            settings.state = state
            for key, value in kwargs.items():
                if hasattr(settings, key):
                    setattr(settings, key, value)
            return settings
        
        settings = StorefrontSettings(
            seller_id=seller_id,
            store_name=store_name,
            store_description=store_description,
            phone=phone,
            whatsapp=whatsapp,
            city=city,
            state=state,
            **{k: v for k, v in kwargs.items() if k in StorefrontSettings.__dataclass_fields__}
        )
        
        settings_db[seller_id] = settings
        return settings
    
    # ============================================
    # ANALYTICS
    # ============================================
    
    @staticmethod
    def get_seller_analytics(seller_id: str, days: int = 30) -> Dict[str, Any]:
        """Get seller analytics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get orders in period
        orders = [o for o in orders_db.values() 
                 if o.seller_id == seller_id and o.created_at >= cutoff]
        
        # Get products
        products = [p for p in products_db.values() if p.seller_id == seller_id]
        
        # Get customers
        customers = [c for c in customers_db.values() if c.seller_id == seller_id]
        
        # Calculate metrics
        total_revenue = sum(o.total_ngn for o in orders if o.status not in [OrderStatus.CANCELLED, OrderStatus.REFUNDED])
        total_orders = len([o for o in orders if o.status not in [OrderStatus.CANCELLED, OrderStatus.REFUNDED]])
        avg_order_value = total_revenue // total_orders if total_orders > 0 else 0
        
        # Order status breakdown
        status_breakdown = {}
        for status in OrderStatus:
            status_breakdown[status.value] = len([o for o in orders if o.status == status])
        
        # Top products
        product_sales = {}
        for order in orders:
            for item in order.items:
                pid = item.get("product_id")
                if pid:
                    if pid not in product_sales:
                        product_sales[pid] = {"quantity": 0, "revenue": 0}
                    product_sales[pid]["quantity"] += item.get("quantity", 1)
                    product_sales[pid]["revenue"] += item.get("price_ngn", 0) * item.get("quantity", 1)
        
        top_products = sorted(product_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]
        
        # Customer segments
        segment_breakdown = {}
        for segment in CustomerSegment:
            segment_breakdown[segment.value] = len([c for c in customers if c.segment == segment])
        
        return {
            "period_days": days,
            "revenue": {
                "total_ngn": total_revenue,
                "average_order_value_ngn": avg_order_value
            },
            "orders": {
                "total": total_orders,
                "status_breakdown": status_breakdown
            },
            "products": {
                "total_active": len([p for p in products if p.status == ProductStatus.ACTIVE]),
                "low_stock": len(StorefrontEngine.get_low_stock_products(seller_id)),
                "top_products": [
                    {
                        "product_id": pid,
                        "title": products_db.get(pid, Product(
                            product_id=pid, seller_id=seller_id, title="Unknown",
                            description="", category="", status=ProductStatus.ARCHIVED,
                            variants=[], images=[], tags=[], created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )).title,
                        "quantity_sold": data["quantity"],
                        "revenue_ngn": data["revenue"]
                    }
                    for pid, data in top_products
                ]
            },
            "customers": {
                "total": len(customers),
                "segment_breakdown": segment_breakdown,
                "new_this_period": len([c for c in customers if c.created_at >= cutoff])
            }
        }


# ============================================
# PYDANTIC MODELS FOR API
# ============================================

class CreateProductRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=5000)
    category: str = Field(..., min_length=1, max_length=100)
    base_price_ngn: int = Field(..., ge=100)
    images: Optional[List[Dict[str, str]]] = None
    variants: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    track_inventory: bool = True
    initial_quantity: int = 0


class UpdateProductRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    base_price_ngn: Optional[int] = None
    status: Optional[ProductStatus] = None
    tags: Optional[List[str]] = None


class UpdateInventoryRequest(BaseModel):
    variant_id: str
    quantity_change: int


class CreateCustomerRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CreateOrderRequest(BaseModel):
    customer_id: str
    items: List[Dict[str, Any]]
    shipping_address: str
    shipping_city: str
    shipping_state: str
    shipping_ngn: int = 0
    discount_ngn: int = 0
    escrow_id: Optional[str] = None
    buyer_notes: str = ""


class UpdateOrderStatusRequest(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None


class CreateTemplateRequest(BaseModel):
    template_type: MessageTemplateType
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=1000)
    send_via: str = "whatsapp"
    delay_hours: int = 0


class StorefrontSettingsRequest(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=200)
    store_description: str = Field(..., max_length=1000)
    phone: str
    whatsapp: str
    city: str
    state: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    business_hours: str = "Mon-Sat 9am-6pm"
    accepts_returns: bool = True
    return_policy: str = "Returns accepted within 7 days"
    primary_color: str = "#4F46E5"


# ============================================
# API ENDPOINTS
# ============================================

# Product endpoints
@router.post("/products/{seller_id}")
async def create_product(seller_id: str, request: CreateProductRequest):
    """Create a new product"""
    product = StorefrontEngine.create_product(
        seller_id=seller_id,
        title=request.title,
        description=request.description,
        category=request.category,
        base_price_ngn=request.base_price_ngn,
        images=request.images,
        variants=request.variants,
        tags=request.tags,
        track_inventory=request.track_inventory,
        initial_quantity=request.initial_quantity
    )
    return {"product": product.__dict__}


@router.get("/products/{seller_id}")
async def get_products(
    seller_id: str,
    status: Optional[ProductStatus] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get seller's products"""
    products = StorefrontEngine.get_seller_products(
        seller_id=seller_id,
        status=status,
        category=category,
        search=search,
        limit=limit,
        offset=offset
    )
    return {
        "products": [p.__dict__ for p in products],
        "count": len(products)
    }


@router.get("/products/{seller_id}/{product_id}")
async def get_product(seller_id: str, product_id: str):
    """Get a specific product"""
    if product_id not in products_db:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = products_db[product_id]
    if product.seller_id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {"product": product.__dict__}


@router.put("/products/{seller_id}/{product_id}")
async def update_product(seller_id: str, product_id: str, request: UpdateProductRequest):
    """Update a product"""
    if product_id not in products_db:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if products_db[product_id].seller_id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates = {k: v for k, v in request.dict().items() if v is not None}
    product = StorefrontEngine.update_product(product_id, updates)
    return {"product": product.__dict__}


@router.post("/products/{seller_id}/{product_id}/inventory")
async def update_inventory(seller_id: str, product_id: str, request: UpdateInventoryRequest):
    """Update product inventory"""
    if product_id not in products_db:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if products_db[product_id].seller_id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        variant = StorefrontEngine.update_inventory(
            product_id, request.variant_id, request.quantity_change
        )
        return {"variant": variant.__dict__, "product_total_inventory": products_db[product_id].total_inventory}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/products/{seller_id}/alerts/low-stock")
async def get_low_stock_products(seller_id: str):
    """Get products with low stock"""
    products = StorefrontEngine.get_low_stock_products(seller_id)
    return {"products": [p.__dict__ for p in products], "count": len(products)}


# Customer endpoints
@router.post("/customers/{seller_id}")
async def create_customer(seller_id: str, request: CreateCustomerRequest):
    """Create or update a customer"""
    customer = StorefrontEngine.create_or_update_customer(
        seller_id=seller_id,
        phone=request.phone,
        name=request.name,
        email=request.email,
        whatsapp=request.whatsapp,
        address=request.address,
        city=request.city,
        state=request.state
    )
    return {"customer": customer.__dict__}


@router.get("/customers/{seller_id}")
async def get_customers(
    seller_id: str,
    segment: Optional[CustomerSegment] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get seller's customers"""
    customers = StorefrontEngine.get_seller_customers(
        seller_id=seller_id,
        segment=segment,
        search=search,
        limit=limit,
        offset=offset
    )
    return {
        "customers": [c.__dict__ for c in customers],
        "count": len(customers)
    }


@router.get("/customers/{seller_id}/at-risk")
async def get_at_risk_customers(seller_id: str, days_inactive: int = Query(60, ge=7, le=365)):
    """Get customers at risk of churning"""
    customers = StorefrontEngine.identify_at_risk_customers(seller_id, days_inactive)
    return {"customers": [c.__dict__ for c in customers], "count": len(customers)}


# Order endpoints
@router.post("/orders/{seller_id}")
async def create_order(seller_id: str, request: CreateOrderRequest):
    """Create a new order"""
    order = StorefrontEngine.create_order(
        seller_id=seller_id,
        customer_id=request.customer_id,
        items=request.items,
        shipping_address=request.shipping_address,
        shipping_city=request.shipping_city,
        shipping_state=request.shipping_state,
        shipping_ngn=request.shipping_ngn,
        discount_ngn=request.discount_ngn,
        escrow_id=request.escrow_id,
        buyer_notes=request.buyer_notes
    )
    return {"order": order.__dict__}


@router.get("/orders/{seller_id}")
async def get_orders(
    seller_id: str,
    status: Optional[OrderStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get seller's orders"""
    orders = StorefrontEngine.get_seller_orders(
        seller_id=seller_id,
        status=status,
        limit=limit,
        offset=offset
    )
    return {
        "orders": [o.__dict__ for o in orders],
        "count": len(orders)
    }


@router.put("/orders/{seller_id}/{order_id}/status")
async def update_order_status(seller_id: str, order_id: str, request: UpdateOrderStatusRequest):
    """Update order status"""
    if order_id not in orders_db:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if orders_db[order_id].seller_id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    order = StorefrontEngine.update_order_status(
        order_id, request.status, request.tracking_number
    )
    return {"order": order.__dict__}


# Template endpoints
@router.post("/templates/{seller_id}")
async def create_template(seller_id: str, request: CreateTemplateRequest):
    """Create a message template"""
    template = StorefrontEngine.create_message_template(
        seller_id=seller_id,
        template_type=request.template_type,
        name=request.name,
        content=request.content,
        send_via=request.send_via,
        delay_hours=request.delay_hours
    )
    return {"template": template.__dict__}


@router.get("/templates/{seller_id}")
async def get_templates(seller_id: str):
    """Get seller's message templates"""
    templates = [t for t in templates_db.values() if t.seller_id == seller_id]
    return {"templates": [t.__dict__ for t in templates]}


@router.get("/templates/defaults")
async def get_default_templates():
    """Get default message templates"""
    return {"templates": StorefrontEngine.get_default_templates()}


# Settings endpoints
@router.post("/settings/{seller_id}")
async def update_settings(seller_id: str, request: StorefrontSettingsRequest):
    """Create or update storefront settings"""
    settings = StorefrontEngine.create_or_update_settings(
        seller_id=seller_id,
        store_name=request.store_name,
        store_description=request.store_description,
        phone=request.phone,
        whatsapp=request.whatsapp,
        city=request.city,
        state=request.state,
        logo_url=request.logo_url,
        banner_url=request.banner_url,
        email=request.email,
        instagram=request.instagram,
        business_hours=request.business_hours,
        accepts_returns=request.accepts_returns,
        return_policy=request.return_policy,
        primary_color=request.primary_color
    )
    return {"settings": settings.__dict__}


@router.get("/settings/{seller_id}")
async def get_settings(seller_id: str):
    """Get storefront settings"""
    if seller_id not in settings_db:
        raise HTTPException(status_code=404, detail="Settings not found")
    return {"settings": settings_db[seller_id].__dict__}


# Analytics endpoints
@router.get("/analytics/{seller_id}")
async def get_analytics(seller_id: str, days: int = Query(30, ge=1, le=365)):
    """Get seller analytics"""
    analytics = StorefrontEngine.get_seller_analytics(seller_id, days)
    return {"analytics": analytics}


# Public storefront endpoint (for buyers)
@router.get("/public/{seller_id}")
async def get_public_storefront(seller_id: str):
    """Get public storefront view for buyers"""
    if seller_id not in settings_db:
        raise HTTPException(status_code=404, detail="Storefront not found")
    
    settings = settings_db[seller_id]
    products = StorefrontEngine.get_seller_products(seller_id, status=ProductStatus.ACTIVE)
    
    return {
        "store": {
            "name": settings.store_name,
            "description": settings.store_description,
            "logo_url": settings.logo_url,
            "banner_url": settings.banner_url,
            "city": settings.city,
            "state": settings.state,
            "business_hours": settings.business_hours,
            "accepts_returns": settings.accepts_returns,
            "return_policy": settings.return_policy,
            "whatsapp": settings.whatsapp,
            "instagram": settings.instagram
        },
        "products": [
            {
                "product_id": p.product_id,
                "title": p.title,
                "description": p.description,
                "category": p.category,
                "price_ngn": p.base_price_ngn,
                "images": [img.__dict__ for img in p.images],
                "variants": [v.__dict__ for v in p.variants if v.is_active],
                "in_stock": p.total_inventory > 0
            }
            for p in products
        ],
        "product_count": len(products)
    }
