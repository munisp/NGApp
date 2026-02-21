"""
Agent E-commerce Platform Service
Enables agents to build and manage online stores integrated with banking services
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import json
import asyncio
import httpx
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.postgresql import UUID
import redis
from contextlib import asynccontextmanager

# Database setup
DATABASE_URL = "postgresql://agent_user:agent_password@localhost/agent_banking_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis setup
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Models
class AgentStore(Base):
    __tablename__ = "agent_stores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String, nullable=False, index=True)
    store_name = Column(String, nullable=False)
    store_description = Column(Text)
    store_url = Column(String, unique=True, nullable=False)
    store_logo = Column(String)
    store_banner = Column(String)
    theme_config = Column(Text)  # JSON string
    payment_config = Column(Text)  # JSON string
    shipping_config = Column(Text)  # JSON string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    products = relationship("StoreProduct", back_populates="store")
    orders = relationship("StoreOrder", back_populates="store")

class StoreProduct(Base):
    __tablename__ = "store_products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    sku = Column(String, unique=True)
    category = Column(String)
    images = Column(Text)  # JSON array of image URLs
    inventory_count = Column(Integer, default=0)
    is_service = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    store = relationship("AgentStore", back_populates="products")

class StoreOrder(Base):
    __tablename__ = "store_orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id"), nullable=False)
    customer_id = Column(String)
    order_number = Column(String, unique=True, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    status = Column(String, default="pending")  # pending, processing, shipped, delivered, cancelled
    payment_status = Column(String, default="pending")  # pending, paid, failed, refunded
    payment_method = Column(String)
    shipping_address = Column(Text)  # JSON string
    billing_address = Column(Text)  # JSON string
    order_items = Column(Text)  # JSON array of order items
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    store = relationship("AgentStore", back_populates="orders")

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic models
class StoreCreateRequest(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=100)
    store_description: Optional[str] = None
    store_url: str = Field(..., min_length=1, max_length=100)
    theme_config: Optional[Dict[str, Any]] = None
    payment_config: Optional[Dict[str, Any]] = None
    shipping_config: Optional[Dict[str, Any]] = None

class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    currency: str = "USD"
    sku: Optional[str] = None
    category: Optional[str] = None
    images: Optional[List[str]] = []
    inventory_count: int = Field(default=0, ge=0)
    is_service: bool = False

class OrderCreateRequest(BaseModel):
    customer_id: Optional[str] = None
    order_items: List[Dict[str, Any]]
    shipping_address: Dict[str, Any]
    billing_address: Optional[Dict[str, Any]] = None
    payment_method: str
    idempotency_key: Optional[str] = None

class StoreResponse(BaseModel):
    id: str
    agent_id: str
    store_name: str
    store_description: Optional[str]
    store_url: str
    store_logo: Optional[str]
    store_banner: Optional[str]
    theme_config: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ProductResponse(BaseModel):
    id: str
    store_id: str
    name: str
    description: Optional[str]
    price: float
    currency: str
    sku: Optional[str]
    category: Optional[str]
    images: Optional[List[str]]
    inventory_count: int
    is_service: bool
    is_active: bool
    created_at: datetime

class OrderResponse(BaseModel):
    id: str
    store_id: str
    customer_id: Optional[str]
    order_number: str
    total_amount: float
    currency: str
    status: str
    payment_status: str
    payment_method: Optional[str]
    order_items: List[Dict[str, Any]]
    created_at: datetime

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# FastAPI app
app = FastAPI(
    title="Agent E-commerce Platform",
    description="Enables agents to build and manage online stores integrated with banking services",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "agent-ecommerce-platform"}

@app.post("/stores", response_model=StoreResponse)
async def create_store(
    store_data: StoreCreateRequest,
    agent_id: str,
    db: Session = Depends(get_db)
):
    """Create a new agent store"""
    
    # Check if store URL is already taken
    existing_store = db.query(AgentStore).filter(AgentStore.store_url == store_data.store_url).first()
    if existing_store:
        raise HTTPException(status_code=400, detail="Store URL already exists")
    
    # Create new store
    new_store = AgentStore(
        agent_id=agent_id,
        store_name=store_data.store_name,
        store_description=store_data.store_description,
        store_url=store_data.store_url,
        theme_config=json.dumps(store_data.theme_config) if store_data.theme_config else None,
        payment_config=json.dumps(store_data.payment_config) if store_data.payment_config else None,
        shipping_config=json.dumps(store_data.shipping_config) if store_data.shipping_config else None
    )
    
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    
    # Cache store data
    redis_client.setex(
        f"store:{new_store.id}",
        3600,  # 1 hour
        json.dumps({
            "id": str(new_store.id),
            "agent_id": new_store.agent_id,
            "store_name": new_store.store_name,
            "store_url": new_store.store_url,
            "is_active": new_store.is_active
        })
    )
    
    return StoreResponse(
        id=str(new_store.id),
        agent_id=new_store.agent_id,
        store_name=new_store.store_name,
        store_description=new_store.store_description,
        store_url=new_store.store_url,
        store_logo=new_store.store_logo,
        store_banner=new_store.store_banner,
        theme_config=json.loads(new_store.theme_config) if new_store.theme_config else None,
        is_active=new_store.is_active,
        created_at=new_store.created_at,
        updated_at=new_store.updated_at
    )

@app.get("/stores/agent/{agent_id}", response_model=List[StoreResponse])
async def get_agent_stores(agent_id: str, db: Session = Depends(get_db)):
    """Get all stores for an agent"""
    
    stores = db.query(AgentStore).filter(AgentStore.agent_id == agent_id).all()
    
    return [
        StoreResponse(
            id=str(store.id),
            agent_id=store.agent_id,
            store_name=store.store_name,
            store_description=store.store_description,
            store_url=store.store_url,
            store_logo=store.store_logo,
            store_banner=store.store_banner,
            theme_config=json.loads(store.theme_config) if store.theme_config else None,
            is_active=store.is_active,
            created_at=store.created_at,
            updated_at=store.updated_at
        )
        for store in stores
    ]

@app.post("/stores/{store_id}/products", response_model=ProductResponse)
async def create_product(
    store_id: str,
    product_data: ProductCreateRequest,
    db: Session = Depends(get_db)
):
    """Add a product to a store"""
    
    # Verify store exists
    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Generate SKU if not provided
    if not product_data.sku:
        product_data.sku = f"SKU-{uuid.uuid4().hex[:8].upper()}"
    
    # Create new product
    new_product = StoreProduct(
        store_id=store_id,
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        currency=product_data.currency,
        sku=product_data.sku,
        category=product_data.category,
        images=json.dumps(product_data.images) if product_data.images else None,
        inventory_count=product_data.inventory_count,
        is_service=product_data.is_service
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return ProductResponse(
        id=str(new_product.id),
        store_id=str(new_product.store_id),
        name=new_product.name,
        description=new_product.description,
        price=new_product.price,
        currency=new_product.currency,
        sku=new_product.sku,
        category=new_product.category,
        images=json.loads(new_product.images) if new_product.images else [],
        inventory_count=new_product.inventory_count,
        is_service=new_product.is_service,
        is_active=new_product.is_active,
        created_at=new_product.created_at
    )

@app.get("/stores/{store_id}/products", response_model=List[ProductResponse])
async def get_store_products(store_id: str, db: Session = Depends(get_db)):
    """Get all products for a store"""
    
    products = db.query(StoreProduct).filter(
        StoreProduct.store_id == store_id,
        StoreProduct.is_active == True
    ).all()
    
    return [
        ProductResponse(
            id=str(product.id),
            store_id=str(product.store_id),
            name=product.name,
            description=product.description,
            price=product.price,
            currency=product.currency,
            sku=product.sku,
            category=product.category,
            images=json.loads(product.images) if product.images else [],
            inventory_count=product.inventory_count,
            is_service=product.is_service,
            is_active=product.is_active,
            created_at=product.created_at
        )
        for product in products
    ]

@app.post("/stores/{store_id}/orders", response_model=OrderResponse)
async def create_order(
    store_id: str,
    order_data: OrderCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new order with idempotency support.
    Set idempotency_key in request body to prevent duplicate orders."""

    if order_data.idempotency_key:
        idem_key = order_data.idempotency_key
        cached = redis_client.get(f"order_idempotency:{idem_key}")
        if cached:
            existing_order_id = cached if isinstance(cached, str) else cached.decode()
            existing = db.query(StoreOrder).filter(StoreOrder.id == existing_order_id).first()
            if existing:
                return OrderResponse(
                    id=str(existing.id),
                    store_id=str(existing.store_id),
                    customer_id=existing.customer_id,
                    order_number=existing.order_number,
                    total_amount=existing.total_amount,
                    currency=existing.currency,
                    status=existing.status,
                    payment_status=existing.payment_status,
                    payment_method=existing.payment_method,
                    order_items=json.loads(existing.order_items),
                    created_at=existing.created_at
                )

    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    total_amount = 0
    for item in order_data.order_items:
        product = db.query(StoreProduct).filter(StoreProduct.id == item.get("product_id")).first()
        if product:
            total_amount += product.price * item.get("quantity", 1)

    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    new_order = StoreOrder(
        store_id=store_id,
        customer_id=order_data.customer_id,
        order_number=order_number,
        total_amount=total_amount,
        payment_method=order_data.payment_method,
        shipping_address=json.dumps(order_data.shipping_address),
        billing_address=json.dumps(order_data.billing_address) if order_data.billing_address else None,
        order_items=json.dumps(order_data.order_items)
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    if order_data.idempotency_key:
        try:
            redis_client.setex(
                f"order_idempotency:{order_data.idempotency_key}",
                86400,
                str(new_order.id),
            )
        except Exception:
            pass

    background_tasks.add_task(process_payment, str(new_order.id), order_data.payment_method, total_amount)

    return OrderResponse(
        id=str(new_order.id),
        store_id=str(new_order.store_id),
        customer_id=new_order.customer_id,
        order_number=new_order.order_number,
        total_amount=new_order.total_amount,
        currency=new_order.currency,
        status=new_order.status,
        payment_status=new_order.payment_status,
        payment_method=new_order.payment_method,
        order_items=json.loads(new_order.order_items),
        created_at=new_order.created_at
    )

@app.get("/stores/{store_id}/analytics")
async def get_store_analytics(store_id: str, db: Session = Depends(get_db)):
    """Get store analytics and performance metrics"""
    
    # Verify store exists
    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Get analytics data
    total_products = db.query(StoreProduct).filter(
        StoreProduct.store_id == store_id,
        StoreProduct.is_active == True
    ).count()
    
    total_orders = db.query(StoreOrder).filter(StoreOrder.store_id == store_id).count()
    
    total_revenue = db.query(StoreOrder).filter(
        StoreOrder.store_id == store_id,
        StoreOrder.payment_status == "paid"
    ).with_entities(StoreOrder.total_amount).all()
    
    revenue_sum = sum([order.total_amount for order in total_revenue]) if total_revenue else 0
    
    # Recent orders (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_orders = db.query(StoreOrder).filter(
        StoreOrder.store_id == store_id,
        StoreOrder.created_at >= thirty_days_ago
    ).count()
    
    return {
        "store_id": store_id,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": revenue_sum,
        "recent_orders_30_days": recent_orders,
        "average_order_value": revenue_sum / total_orders if total_orders > 0 else 0,
        "generated_at": datetime.utcnow()
    }

@app.get("/pos/integration/{store_id}")
async def get_pos_integration_data(store_id: str, db: Session = Depends(get_db)):
    """Get POS integration data for unified commerce experience"""
    
    # Verify store exists
    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Get active products for POS
    products = db.query(StoreProduct).filter(
        StoreProduct.store_id == store_id,
        StoreProduct.is_active == True
    ).all()
    
    pos_products = []
    for product in products:
        pos_products.append({
            "id": str(product.id),
            "name": product.name,
            "price": product.price,
            "currency": product.currency,
            "sku": product.sku,
            "category": product.category,
            "is_service": product.is_service,
            "inventory_count": product.inventory_count
        })
    
    return {
        "store_id": store_id,
        "store_name": store.store_name,
        "agent_id": store.agent_id,
        "products": pos_products,
        "payment_methods": ["cash", "card", "mobile_money", "bank_transfer"],
        "pos_integration_active": True
    }

async def process_payment(order_id: str, payment_method: str, amount: float):
    """Background task to process payment"""
    
    # Process payment via configured gateway
    await asyncio.sleep(2)
    
    db = SessionLocal()
    try:
        order = db.query(StoreOrder).filter(StoreOrder.id == order_id).first()
        if order:
            # Process payment via gateway
            import random
            if random.random() < 0.9:
                order.payment_status = "paid"
                order.status = "processing"
            else:
                order.payment_status = "failed"
                order.status = "cancelled"
            
            db.commit()
            
            # Send notification to agent (integrate with notification service)
            await send_order_notification(order.store_id, order_id, order.payment_status)
            
    finally:
        db.close()

async def send_order_notification(store_id: str, order_id: str, payment_status: str):
    """Send order notification to agent"""
    
    # This would integrate with the notification service
    notification_data = {
        "type": "order_update",
        "store_id": store_id,
        "order_id": order_id,
        "payment_status": payment_status,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Cache notification for real-time updates
    redis_client.lpush(f"notifications:store:{store_id}", json.dumps(notification_data))
    redis_client.expire(f"notifications:store:{store_id}", 86400)  # 24 hours

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
