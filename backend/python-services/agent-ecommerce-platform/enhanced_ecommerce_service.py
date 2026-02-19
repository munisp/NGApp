"""
Enhanced E-commerce Platform Service
Adds WhatsApp commerce, social selling, marketing tools, and advanced analytics
Version 3.0.0
"""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, validator, HttpUrl
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import json
import asyncio
import httpx
import boto3
from botocore.exceptions import ClientError
import hashlib
import os
import qrcode
from io import BytesIO
import base64

from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, Text, ForeignKey, Numeric, Index, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import redis
from contextlib import asynccontextmanager

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agent_user:agent_password@localhost/agent_ecommerce_db")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=20, max_overflow=40)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis setup
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True
)

# AWS S3 setup
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION", "us-east-1")
)
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "agent-ecommerce-media")

# WhatsApp Business API configuration
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com/v18.0")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")

# ==================== NEW DATABASE MODELS ====================

class WhatsAppCatalog(Base):
    """WhatsApp Business Catalog integration"""
    __tablename__ = "whatsapp_catalogs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    catalog_id = Column(String(100), unique=True, nullable=False)  # WhatsApp catalog ID
    catalog_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    last_synced = Column(DateTime)
    sync_status = Column(String(50), default="pending")  # pending, syncing, synced, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SocialMediaIntegration(Base):
    """Social media platform integrations"""
    __tablename__ = "social_media_integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(50), nullable=False)  # facebook, instagram, tiktok, twitter
    platform_user_id = Column(String(200))
    platform_username = Column(String(200))
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    auto_post_products = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MarketingCampaign(Base):
    """Marketing campaigns and promotions"""
    __tablename__ = "marketing_campaigns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_name = Column(String(200), nullable=False)
    campaign_type = Column(String(50), nullable=False)  # discount, flash_sale, bogo, free_shipping
    discount_type = Column(String(50))  # percentage, fixed_amount
    discount_value = Column(Numeric(10, 2))
    min_purchase_amount = Column(Numeric(10, 2))
    max_discount_amount = Column(Numeric(10, 2))
    coupon_code = Column(String(50), unique=True, index=True)
    usage_limit = Column(Integer)
    usage_count = Column(Integer, default=0)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    applicable_products = Column(JSONB)  # List of product IDs
    applicable_categories = Column(JSONB)  # List of categories
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CustomerReview(Base):
    """Product reviews and ratings"""
    __tablename__ = "customer_reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), index=True)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    review_title = Column(String(200))
    review_text = Column(Text)
    is_verified_purchase = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class StoreAnalytics(Base):
    """Daily analytics snapshots"""
    __tablename__ = "store_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("agent_stores.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    total_views = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    total_orders = Column(Integer, default=0)
    total_revenue = Column(Numeric(12, 2), default=0)
    avg_order_value = Column(Numeric(10, 2), default=0)
    conversion_rate = Column(Numeric(5, 2), default=0)
    cart_abandonment_rate = Column(Numeric(5, 2), default=0)
    top_products = Column(JSONB)
    traffic_sources = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)

class WishlistItem(Base):
    """Customer wishlists"""
    __tablename__ = "wishlist_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"))
    added_at = Column(DateTime, default=datetime.utcnow, index=True)

# ==================== PYDANTIC MODELS ====================

class WhatsAppCatalogCreate(BaseModel):
    catalog_name: str
    auto_sync: bool = True

class WhatsAppCatalogResponse(BaseModel):
    id: str
    store_id: str
    catalog_id: str
    catalog_name: str
    is_active: bool
    sync_status: str
    last_synced: Optional[datetime]
    
    class Config:
        from_attributes = True

class SocialMediaConnect(BaseModel):
    platform: Literal["facebook", "instagram", "tiktok", "twitter"]
    access_token: str
    platform_user_id: Optional[str] = None
    platform_username: Optional[str] = None
    auto_post_products: bool = False

class MarketingCampaignCreate(BaseModel):
    campaign_name: str
    campaign_type: Literal["discount", "flash_sale", "bogo", "free_shipping"]
    discount_type: Optional[Literal["percentage", "fixed_amount"]] = None
    discount_value: Optional[Decimal] = None
    min_purchase_amount: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    coupon_code: Optional[str] = None
    usage_limit: Optional[int] = None
    start_date: datetime
    end_date: datetime
    applicable_products: Optional[List[str]] = None
    applicable_categories: Optional[List[str]] = None

class MarketingCampaignResponse(BaseModel):
    id: str
    store_id: str
    campaign_name: str
    campaign_type: str
    discount_type: Optional[str]
    discount_value: Optional[Decimal]
    coupon_code: Optional[str]
    usage_count: int
    usage_limit: Optional[int]
    start_date: datetime
    end_date: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class CustomerReviewCreate(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    
    @validator('rating')
    def validate_rating(cls, v):
        if v < 1 or v > 5:
            raise ValueError('Rating must be between 1 and 5')
        return v

class CustomerReviewResponse(BaseModel):
    id: str
    product_id: str
    customer_id: Optional[str]
    rating: int
    review_title: Optional[str]
    review_text: Optional[str]
    is_verified_purchase: bool
    is_approved: bool
    helpful_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class StoreAnalyticsResponse(BaseModel):
    date: datetime
    total_views: int
    unique_visitors: int
    total_orders: int
    total_revenue: Decimal
    avg_order_value: Decimal
    conversion_rate: Decimal
    cart_abandonment_rate: Decimal
    top_products: Optional[Dict[str, Any]]
    traffic_sources: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True

class StorefrontTheme(BaseModel):
    """Storefront customization"""
    primary_color: str = "#667eea"
    secondary_color: str = "#764ba2"
    font_family: str = "Inter"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    layout: Literal["grid", "list", "masonry"] = "grid"
    show_reviews: bool = True
    show_related_products: bool = True
    enable_wishlist: bool = True

# ==================== HELPER FUNCTIONS ====================

async def sync_whatsapp_catalog(store_id: str, catalog_id: str, db: Session):
    """Sync products to WhatsApp Business catalog"""
    try:
        # Fetch store products
        from comprehensive_ecommerce_service import Product, ProductVariant, ProductImage
        
        products = db.query(Product).filter(
            Product.store_id == store_id,
            Product.is_active == True
        ).all()
        
        catalog_items = []
        for product in products:
            # Get primary image
            primary_image = db.query(ProductImage).filter(
                ProductImage.product_id == product.id,
                ProductImage.is_primary == True
            ).first()
            
            item = {
                "retailer_id": str(product.id),
                "name": product.name,
                "description": product.description or "",
                "price": float(product.base_price),
                "currency": product.currency,
                "url": f"https://store.example.com/product/{product.id}",
                "image_url": primary_image.image_url if primary_image else "",
                "availability": "in stock" if any(v.inventory_count > 0 for v in product.variants) else "out of stock"
            }
            catalog_items.append(item)
        
        # Send to WhatsApp Business API
        if WHATSAPP_TOKEN and WHATSAPP_PHONE_ID:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{WHATSAPP_API_URL}/{catalog_id}/items",
                    headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
                    json={"items": catalog_items}
                )
                
                if response.status_code == 200:
                    # Update sync status
                    catalog = db.query(WhatsAppCatalog).filter(
                        WhatsAppCatalog.catalog_id == catalog_id
                    ).first()
                    if catalog:
                        catalog.sync_status = "synced"
                        catalog.last_synced = datetime.utcnow()
                        db.commit()
                    return True
                else:
                    raise Exception(f"WhatsApp API error: {response.text}")
        
        return False
    except Exception as e:
        print(f"WhatsApp sync error: {str(e)}")
        catalog = db.query(WhatsAppCatalog).filter(
            WhatsAppCatalog.catalog_id == catalog_id
        ).first()
        if catalog:
            catalog.sync_status = "failed"
            db.commit()
        return False

async def send_whatsapp_order_confirmation(phone_number: str, order_details: Dict):
    """Send order confirmation via WhatsApp"""
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        return False
    
    try:
        message = f"""
🎉 Order Confirmed!

Order ID: {order_details['order_id']}
Total: {order_details['currency']} {order_details['total']}

Items:
{chr(10).join([f"• {item['name']} x{item['quantity']}" for item in order_details['items']])}

Delivery Address:
{order_details['delivery_address']}

Thank you for your order! We'll notify you when it's shipped.
        """.strip()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_API_URL}/{WHATSAPP_PHONE_ID}/messages",
                headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_number,
                    "type": "text",
                    "text": {"body": message}
                }
            )
            return response.status_code == 200
    except Exception as e:
        print(f"WhatsApp message error: {str(e)}")
        return False

def generate_store_qr_code(store_url: str) -> str:
    """Generate QR code for store URL"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(store_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def calculate_campaign_discount(
    cart_total: Decimal,
    campaign: MarketingCampaign
) -> Decimal:
    """Calculate discount amount based on campaign rules"""
    if not campaign.is_active:
        return Decimal(0)
    
    now = datetime.utcnow()
    if now < campaign.start_date or now > campaign.end_date:
        return Decimal(0)
    
    if campaign.usage_limit and campaign.usage_count >= campaign.usage_limit:
        return Decimal(0)
    
    if campaign.min_purchase_amount and cart_total < campaign.min_purchase_amount:
        return Decimal(0)
    
    discount = Decimal(0)
    if campaign.discount_type == "percentage":
        discount = cart_total * (campaign.discount_value / 100)
    elif campaign.discount_type == "fixed_amount":
        discount = campaign.discount_value
    
    if campaign.max_discount_amount:
        discount = min(discount, campaign.max_discount_amount)
    
    return discount

def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== FASTAPI APP ====================

app = FastAPI(
    title="Enhanced E-commerce Platform",
    description="E-commerce with WhatsApp, social media, marketing, and advanced analytics",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Create tables on startup"""
    Base.metadata.create_all(bind=engine)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "enhanced-ecommerce-platform",
        "version": "3.0.0",
        "features": [
            "whatsapp_commerce",
            "social_media_integration",
            "marketing_campaigns",
            "customer_reviews",
            "advanced_analytics",
            "wishlist",
            "storefront_customization"
        ]
    }

# ==================== WHATSAPP COMMERCE ENDPOINTS ====================

@app.post("/stores/{store_id}/whatsapp/catalog", response_model=WhatsAppCatalogResponse)
async def create_whatsapp_catalog(
    store_id: str,
    catalog_data: WhatsAppCatalogCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create WhatsApp Business catalog for store"""
    
    # Generate catalog ID
    catalog_id = f"catalog_{uuid.uuid4().hex[:12]}"
    
    new_catalog = WhatsAppCatalog(
        store_id=store_id,
        catalog_id=catalog_id,
        catalog_name=catalog_data.catalog_name,
        sync_status="pending"
    )
    
    db.add(new_catalog)
    db.commit()
    db.refresh(new_catalog)
    
    # Sync products in background
    if catalog_data.auto_sync:
        background_tasks.add_task(sync_whatsapp_catalog, store_id, catalog_id, db)
    
    return WhatsAppCatalogResponse(
        id=str(new_catalog.id),
        store_id=str(new_catalog.store_id),
        catalog_id=new_catalog.catalog_id,
        catalog_name=new_catalog.catalog_name,
        is_active=new_catalog.is_active,
        sync_status=new_catalog.sync_status,
        last_synced=new_catalog.last_synced
    )

@app.post("/stores/{store_id}/whatsapp/sync")
async def sync_catalog_to_whatsapp(
    store_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Manually sync products to WhatsApp catalog"""
    
    catalog = db.query(WhatsAppCatalog).filter(
        WhatsAppCatalog.store_id == store_id,
        WhatsAppCatalog.is_active == True
    ).first()
    
    if not catalog:
        raise HTTPException(status_code=404, detail="WhatsApp catalog not found")
    
    catalog.sync_status = "syncing"
    db.commit()
    
    background_tasks.add_task(sync_whatsapp_catalog, store_id, catalog.catalog_id, db)
    
    return {"message": "Sync started", "catalog_id": catalog.catalog_id}

# ==================== SOCIAL MEDIA INTEGRATION ENDPOINTS ====================

@app.post("/stores/{store_id}/social-media/connect")
async def connect_social_media(
    store_id: str,
    social_data: SocialMediaConnect,
    db: Session = Depends(get_db)
):
    """Connect social media platform"""
    
    # Check if already connected
    existing = db.query(SocialMediaIntegration).filter(
        SocialMediaIntegration.store_id == store_id,
        SocialMediaIntegration.platform == social_data.platform
    ).first()
    
    if existing:
        # Update existing connection
        existing.access_token = social_data.access_token
        existing.platform_user_id = social_data.platform_user_id
        existing.platform_username = social_data.platform_username
        existing.auto_post_products = social_data.auto_post_products
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Social media connection updated", "platform": social_data.platform}
    
    # Create new connection
    new_integration = SocialMediaIntegration(
        store_id=store_id,
        platform=social_data.platform,
        platform_user_id=social_data.platform_user_id,
        platform_username=social_data.platform_username,
        access_token=social_data.access_token,
        auto_post_products=social_data.auto_post_products
    )
    
    db.add(new_integration)
    db.commit()
    
    return {"message": "Social media connected successfully", "platform": social_data.platform}

@app.get("/stores/{store_id}/social-media")
async def get_social_media_connections(
    store_id: str,
    db: Session = Depends(get_db)
):
    """Get all social media connections for store"""
    
    connections = db.query(SocialMediaIntegration).filter(
        SocialMediaIntegration.store_id == store_id
    ).all()
    
    return [{
        "platform": conn.platform,
        "platform_username": conn.platform_username,
        "is_active": conn.is_active,
        "auto_post_products": conn.auto_post_products,
        "connected_at": conn.created_at
    } for conn in connections]

# ==================== MARKETING CAMPAIGN ENDPOINTS ====================

@app.post("/stores/{store_id}/campaigns", response_model=MarketingCampaignResponse)
async def create_marketing_campaign(
    store_id: str,
    campaign_data: MarketingCampaignCreate,
    db: Session = Depends(get_db)
):
    """Create marketing campaign"""
    
    # Generate coupon code if not provided
    if not campaign_data.coupon_code:
        campaign_data.coupon_code = f"{campaign_data.campaign_type.upper()}{uuid.uuid4().hex[:8].upper()}"
    
    new_campaign = MarketingCampaign(
        store_id=store_id,
        campaign_name=campaign_data.campaign_name,
        campaign_type=campaign_data.campaign_type,
        discount_type=campaign_data.discount_type,
        discount_value=campaign_data.discount_value,
        min_purchase_amount=campaign_data.min_purchase_amount,
        max_discount_amount=campaign_data.max_discount_amount,
        coupon_code=campaign_data.coupon_code,
        usage_limit=campaign_data.usage_limit,
        start_date=campaign_data.start_date,
        end_date=campaign_data.end_date,
        applicable_products=campaign_data.applicable_products,
        applicable_categories=campaign_data.applicable_categories
    )
    
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    
    return MarketingCampaignResponse(
        id=str(new_campaign.id),
        store_id=str(new_campaign.store_id),
        campaign_name=new_campaign.campaign_name,
        campaign_type=new_campaign.campaign_type,
        discount_type=new_campaign.discount_type,
        discount_value=new_campaign.discount_value,
        coupon_code=new_campaign.coupon_code,
        usage_count=new_campaign.usage_count,
        usage_limit=new_campaign.usage_limit,
        start_date=new_campaign.start_date,
        end_date=new_campaign.end_date,
        is_active=new_campaign.is_active
    )

@app.get("/stores/{store_id}/campaigns")
async def get_campaigns(
    store_id: str,
    active_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get all marketing campaigns for store"""
    
    query = db.query(MarketingCampaign).filter(
        MarketingCampaign.store_id == store_id
    )
    
    if active_only:
        now = datetime.utcnow()
        query = query.filter(
            MarketingCampaign.is_active == True,
            MarketingCampaign.start_date <= now,
            MarketingCampaign.end_date >= now
        )
    
    campaigns = query.all()
    
    return [MarketingCampaignResponse(
        id=str(c.id),
        store_id=str(c.store_id),
        campaign_name=c.campaign_name,
        campaign_type=c.campaign_type,
        discount_type=c.discount_type,
        discount_value=c.discount_value,
        coupon_code=c.coupon_code,
        usage_count=c.usage_count,
        usage_limit=c.usage_limit,
        start_date=c.start_date,
        end_date=c.end_date,
        is_active=c.is_active
    ) for c in campaigns]

@app.post("/stores/{store_id}/campaigns/{campaign_id}/apply")
async def apply_campaign_discount(
    store_id: str,
    campaign_id: str,
    cart_total: Decimal,
    db: Session = Depends(get_db)
):
    """Calculate discount for a campaign"""
    
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.store_id == store_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    discount = calculate_campaign_discount(cart_total, campaign)
    
    return {
        "campaign_id": str(campaign.id),
        "campaign_name": campaign.campaign_name,
        "cart_total": cart_total,
        "discount_amount": discount,
        "final_total": cart_total - discount
    }

# ==================== CUSTOMER REVIEW ENDPOINTS ====================

@app.post("/products/{product_id}/reviews", response_model=CustomerReviewResponse)
async def create_product_review(
    product_id: str,
    review_data: CustomerReviewCreate,
    customer_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create product review"""
    
    new_review = CustomerReview(
        product_id=product_id,
        customer_id=customer_id,
        rating=review_data.rating,
        review_title=review_data.review_title,
        review_text=review_data.review_text,
        is_approved=False  # Requires manual approval
    )
    
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    
    return CustomerReviewResponse(
        id=str(new_review.id),
        product_id=str(new_review.product_id),
        customer_id=str(new_review.customer_id) if new_review.customer_id else None,
        rating=new_review.rating,
        review_title=new_review.review_title,
        review_text=new_review.review_text,
        is_verified_purchase=new_review.is_verified_purchase,
        is_approved=new_review.is_approved,
        helpful_count=new_review.helpful_count,
        created_at=new_review.created_at
    )

@app.get("/products/{product_id}/reviews")
async def get_product_reviews(
    product_id: str,
    approved_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get product reviews"""
    
    query = db.query(CustomerReview).filter(
        CustomerReview.product_id == product_id
    )
    
    if approved_only:
        query = query.filter(CustomerReview.is_approved == True)
    
    reviews = query.order_by(CustomerReview.created_at.desc()).all()
    
    # Calculate average rating
    avg_rating = db.query(func.avg(CustomerReview.rating)).filter(
        CustomerReview.product_id == product_id,
        CustomerReview.is_approved == True
    ).scalar() or 0
    
    return {
        "product_id": product_id,
        "average_rating": float(avg_rating),
        "total_reviews": len(reviews),
        "reviews": [CustomerReviewResponse(
            id=str(r.id),
            product_id=str(r.product_id),
            customer_id=str(r.customer_id) if r.customer_id else None,
            rating=r.rating,
            review_title=r.review_title,
            review_text=r.review_text,
            is_verified_purchase=r.is_verified_purchase,
            is_approved=r.is_approved,
            helpful_count=r.helpful_count,
            created_at=r.created_at
        ) for r in reviews]
    }

# ==================== ANALYTICS ENDPOINTS ====================

@app.get("/stores/{store_id}/analytics/dashboard")
async def get_analytics_dashboard(
    store_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics dashboard"""
    
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    analytics = db.query(StoreAnalytics).filter(
        StoreAnalytics.store_id == store_id,
        StoreAnalytics.date >= start_date,
        StoreAnalytics.date <= end_date
    ).all()
    
    # Aggregate metrics
    total_revenue = sum(a.total_revenue for a in analytics)
    total_orders = sum(a.total_orders for a in analytics)
    total_visitors = sum(a.unique_visitors for a in analytics)
    avg_conversion_rate = sum(a.conversion_rate for a in analytics) / len(analytics) if analytics else 0
    
    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "summary": {
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "total_visitors": total_visitors,
            "avg_order_value": total_revenue / total_orders if total_orders > 0 else 0,
            "conversion_rate": avg_conversion_rate
        },
        "daily_analytics": [StoreAnalyticsResponse(
            date=a.date,
            total_views=a.total_views,
            unique_visitors=a.unique_visitors,
            total_orders=a.total_orders,
            total_revenue=a.total_revenue,
            avg_order_value=a.avg_order_value,
            conversion_rate=a.conversion_rate,
            cart_abandonment_rate=a.cart_abandonment_rate,
            top_products=a.top_products,
            traffic_sources=a.traffic_sources
        ) for a in analytics]
    }

# ==================== STOREFRONT CUSTOMIZATION ENDPOINTS ====================

@app.post("/stores/{store_id}/theme")
async def update_storefront_theme(
    store_id: str,
    theme: StorefrontTheme,
    db: Session = Depends(get_db)
):
    """Update storefront theme and customization"""
    
    from comprehensive_ecommerce_service import AgentStore
    
    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store.theme_config = theme.dict()
    db.commit()
    
    return {"message": "Theme updated successfully", "theme": theme.dict()}

@app.get("/stores/{store_id}/qr-code")
async def get_store_qr_code(
    store_id: str,
    db: Session = Depends(get_db)
):
    """Generate QR code for store URL"""
    
    from comprehensive_ecommerce_service import AgentStore
    
    store = db.query(AgentStore).filter(AgentStore.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_url = f"https://shop.example.com/{store.store_url}"
    qr_code_data = generate_store_qr_code(store_url)
    
    return {
        "store_id": str(store.id),
        "store_url": store_url,
        "qr_code": qr_code_data
    }

# ==================== WISHLIST ENDPOINTS ====================

@app.post("/customers/{customer_id}/wishlist")
async def add_to_wishlist(
    customer_id: str,
    product_id: str,
    variant_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Add product to customer wishlist"""
    
    # Check if already in wishlist
    existing = db.query(WishlistItem).filter(
        WishlistItem.customer_id == customer_id,
        WishlistItem.product_id == product_id,
        WishlistItem.variant_id == variant_id if variant_id else True
    ).first()
    
    if existing:
        return {"message": "Product already in wishlist"}
    
    wishlist_item = WishlistItem(
        customer_id=customer_id,
        product_id=product_id,
        variant_id=variant_id
    )
    
    db.add(wishlist_item)
    db.commit()
    
    return {"message": "Product added to wishlist"}

@app.get("/customers/{customer_id}/wishlist")
async def get_wishlist(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """Get customer wishlist"""
    
    wishlist_items = db.query(WishlistItem).filter(
        WishlistItem.customer_id == customer_id
    ).order_by(WishlistItem.added_at.desc()).all()
    
    return [{
        "product_id": str(item.product_id),
        "variant_id": str(item.variant_id) if item.variant_id else None,
        "added_at": item.added_at
    } for item in wishlist_items]

@app.delete("/customers/{customer_id}/wishlist/{product_id}")
async def remove_from_wishlist(
    customer_id: str,
    product_id: str,
    db: Session = Depends(get_db)
):
    """Remove product from wishlist"""
    
    wishlist_item = db.query(WishlistItem).filter(
        WishlistItem.customer_id == customer_id,
        WishlistItem.product_id == product_id
    ).first()
    
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    
    db.delete(wishlist_item)
    db.commit()
    
    return {"message": "Product removed from wishlist"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)

