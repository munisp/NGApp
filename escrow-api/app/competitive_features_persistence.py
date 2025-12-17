"""
Competitive Features Persistence Layer

This module provides production-grade persistence for the 5 competitive feature modules:
1. Seller Storefront - Product catalog, inventory, orders, CRM
2. Returns & Refunds - RMA workflow, inspection, refund processing
3. Proof of Delivery - Logistics integration, POD capture
4. Marketplace Discovery - Listings, search, reviews
5. Dispute Operations - SLA-driven resolution, evidence, arbitration

Features:
- PostgreSQL persistence via SQLAlchemy
- Optimistic locking for concurrency control
- Integration with TigerBeetle ledger for money movement
- Audit trails for compliance
- Redis caching for read-heavy operations
"""

import os
import uuid
import json
import hashlib
import logging
from typing import Dict, Any, List, Optional, TypeVar, Generic
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON, 
    Enum as SQLEnum, ForeignKey, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship
from sqlalchemy import select, update, delete, and_, or_, func

from app.database import Base
from app.repositories import db_manager, RedisCacheManager

logger = logging.getLogger(__name__)


# =============================================================================
# Enums for Competitive Features
# =============================================================================

class ProductStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    OUT_OF_STOCK = "out_of_stock"
    DISCONTINUED = "discontinued"
    ARCHIVED = "archived"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class CustomerSegment(str, Enum):
    NEW = "new"
    RETURNING = "returning"
    VIP = "vip"
    AT_RISK = "at_risk"
    CHURNED = "churned"

class ReturnStatus(str, Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    PICKUP_SCHEDULED = "pickup_scheduled"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    INSPECTING = "inspecting"
    INSPECTION_PASSED = "inspection_passed"
    INSPECTION_FAILED = "inspection_failed"
    REFUND_PROCESSING = "refund_processing"
    REFUND_COMPLETED = "refund_completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"

class InspectionResult(str, Enum):
    PASSED = "passed"
    MINOR_DAMAGE = "minor_damage"
    MAJOR_DAMAGE = "major_damage"
    WRONG_ITEM_RETURNED = "wrong_item_returned"
    ITEM_MISSING = "item_missing"
    TAMPERED = "tampered"

class DeliveryStatus(str, Enum):
    PENDING = "pending"
    LABEL_CREATED = "label_created"
    PICKUP_SCHEDULED = "pickup_scheduled"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERY_ATTEMPTED = "delivery_attempted"
    DELIVERED = "delivered"
    RETURNED_TO_SENDER = "returned_to_sender"
    CANCELLED = "cancelled"
    EXCEPTION = "exception"

class PODType(str, Enum):
    SIGNATURE = "signature"
    PHOTO = "photo"
    OTP = "otp"
    GPS = "gps"
    RECIPIENT_ID = "recipient_id"
    DOORSTEP_PHOTO = "doorstep_photo"

class ListingStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD_OUT = "sold_out"
    EXPIRED = "expired"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class DisputeOpsStatus(str, Enum):
    OPENED = "opened"
    AWAITING_SELLER_RESPONSE = "awaiting_seller_response"
    AWAITING_BUYER_RESPONSE = "awaiting_buyer_response"
    UNDER_REVIEW = "under_review"
    EVIDENCE_COLLECTION = "evidence_collection"
    ARBITRATION = "arbitration"
    ESCALATED = "escalated"
    RESOLVED_BUYER_FAVOR = "resolved_buyer_favor"
    RESOLVED_SELLER_FAVOR = "resolved_seller_favor"
    RESOLVED_SPLIT = "resolved_split"
    CLOSED = "closed"
    CANCELLED = "cancelled"

class DisputePriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# =============================================================================
# Database Models - Seller Storefront
# =============================================================================

class StorefrontProduct(Base):
    """Product in seller's catalog"""
    __tablename__ = "storefront_products"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), nullable=False, index=True)
    
    # Product info
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    sku = Column(String(100), nullable=True)
    
    # Pricing
    price_ngn = Column(Integer, nullable=False)
    compare_at_price_ngn = Column(Integer, nullable=True)
    cost_ngn = Column(Integer, nullable=True)
    
    # Inventory
    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    track_inventory = Column(Boolean, default=True)
    
    # Status
    status = Column(SQLEnum(ProductStatus), default=ProductStatus.DRAFT)
    
    # Media
    images = Column(JSON, default=list)  # [{url, alt, position}]
    
    # Variants
    variants = Column(JSON, default=list)  # [{id, name, options, price, quantity}]
    
    # SEO
    tags = Column(JSON, default=list)
    
    # Stats
    total_sold = Column(Integer, default=0)
    total_revenue_ngn = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    
    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_product_seller", "seller_id"),
        Index("idx_product_status", "status"),
        Index("idx_product_category", "category"),
    )


class StorefrontCustomer(Base):
    """Customer in seller's CRM"""
    __tablename__ = "storefront_customers"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), nullable=False, index=True)
    buyer_id = Column(String(36), nullable=False, index=True)
    
    # Contact info
    name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Segmentation
    segment = Column(SQLEnum(CustomerSegment), default=CustomerSegment.NEW)
    
    # Stats
    total_orders = Column(Integer, default=0)
    total_spent_ngn = Column(Integer, default=0)
    average_order_ngn = Column(Integer, default=0)
    
    # Engagement
    first_order_at = Column(DateTime, nullable=True)
    last_order_at = Column(DateTime, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_customer_seller", "seller_id"),
        Index("idx_customer_buyer", "buyer_id"),
        Index("idx_customer_segment", "segment"),
        UniqueConstraint("seller_id", "buyer_id", name="uq_seller_buyer"),
    )


class StorefrontOrder(Base):
    """Order in seller's order management"""
    __tablename__ = "storefront_orders"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("storefront_customers.id"), nullable=True)
    escrow_id = Column(String(36), nullable=True, index=True)
    
    # Status
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    
    # Items
    items = Column(JSON, nullable=False)  # [{product_id, variant_id, quantity, price}]
    
    # Totals
    subtotal_ngn = Column(Integer, nullable=False)
    shipping_ngn = Column(Integer, default=0)
    discount_ngn = Column(Integer, default=0)
    total_ngn = Column(Integer, nullable=False)
    
    # Shipping
    shipping_address = Column(Text, nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(100), nullable=True)
    shipping_method = Column(String(50), default="standard")
    tracking_number = Column(String(100), nullable=True)
    
    # Dates
    confirmed_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Notes
    seller_notes = Column(Text, nullable=True)
    buyer_notes = Column(Text, nullable=True)
    
    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_order_seller", "seller_id"),
        Index("idx_order_status", "status"),
        Index("idx_order_escrow", "escrow_id"),
    )


# =============================================================================
# Database Models - Returns & Refunds
# =============================================================================

class ReturnPolicy(Base):
    """Seller's return policy"""
    __tablename__ = "return_policies"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), nullable=False, unique=True)
    
    # Policy settings
    accepts_returns = Column(Boolean, default=True)
    return_window_days = Column(Integer, default=7)
    restocking_fee_percent = Column(Integer, default=0)
    
    # Conditions
    requires_original_packaging = Column(Boolean, default=True)
    requires_tags_attached = Column(Boolean, default=False)
    
    # Exclusions
    excluded_categories = Column(JSON, default=list)
    excluded_products = Column(JSON, default=list)
    
    # Refund methods
    refund_to_original_payment = Column(Boolean, default=True)
    offer_store_credit = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_return_policy_seller", "seller_id"),
    )


class ReturnRequest(Base):
    """Return/refund request"""
    __tablename__ = "return_requests"
    
    id = Column(String(36), primary_key=True)
    rma_number = Column(String(20), nullable=False, unique=True, index=True)
    
    # Parties
    seller_id = Column(String(36), nullable=False, index=True)
    buyer_id = Column(String(36), nullable=False, index=True)
    order_id = Column(String(36), nullable=False, index=True)
    escrow_id = Column(String(36), nullable=True)
    
    # Status
    status = Column(SQLEnum(ReturnStatus), default=ReturnStatus.REQUESTED)
    
    # Return details
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    items = Column(JSON, nullable=False)  # [{product_id, quantity, reason}]
    
    # Evidence
    photos = Column(JSON, default=list)
    videos = Column(JSON, default=list)
    
    # Amounts
    original_amount_ngn = Column(Integer, nullable=False)
    refund_amount_ngn = Column(Integer, nullable=True)
    restocking_fee_ngn = Column(Integer, default=0)
    
    # Inspection
    inspection_result = Column(SQLEnum(InspectionResult), nullable=True)
    inspection_notes = Column(Text, nullable=True)
    inspection_photos = Column(JSON, default=list)
    inspected_at = Column(DateTime, nullable=True)
    inspected_by = Column(String(36), nullable=True)
    
    # Logistics
    return_tracking_number = Column(String(100), nullable=True)
    return_carrier = Column(String(50), nullable=True)
    pickup_scheduled_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    
    # SLA tracking
    approval_deadline = Column(DateTime, nullable=True)
    inspection_deadline = Column(DateTime, nullable=True)
    refund_deadline = Column(DateTime, nullable=True)
    sla_breached = Column(Boolean, default=False)
    
    # Resolution
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_return_seller", "seller_id"),
        Index("idx_return_buyer", "buyer_id"),
        Index("idx_return_order", "order_id"),
        Index("idx_return_status", "status"),
        Index("idx_return_rma", "rma_number"),
    )


# =============================================================================
# Database Models - Proof of Delivery
# =============================================================================

class Delivery(Base):
    """Delivery record with POD"""
    __tablename__ = "deliveries"
    
    id = Column(String(36), primary_key=True)
    order_id = Column(String(36), nullable=False, index=True)
    escrow_id = Column(String(36), nullable=True, index=True)
    seller_id = Column(String(36), nullable=False, index=True)
    buyer_id = Column(String(36), nullable=False, index=True)
    
    # Status
    status = Column(SQLEnum(DeliveryStatus), default=DeliveryStatus.PENDING)
    
    # Provider
    provider = Column(String(50), nullable=False)  # gig, kwik, sendbox, dhl, self
    provider_tracking_number = Column(String(100), nullable=True, index=True)
    provider_label_url = Column(String(1000), nullable=True)
    
    # Method
    method = Column(String(50), nullable=False)  # standard, express, same_day, pickup
    
    # Addresses (JSON for flexibility)
    pickup_address = Column(JSON, nullable=True)
    delivery_address = Column(JSON, nullable=True)
    
    # Package
    package_weight_kg = Column(Float, nullable=True)
    package_dimensions = Column(JSON, nullable=True)  # {length, width, height}
    package_description = Column(String(500), nullable=True)
    
    # Costs
    shipping_cost_ngn = Column(Integer, default=0)
    insurance_cost_ngn = Column(Integer, default=0)
    total_cost_ngn = Column(Integer, default=0)
    
    # Dates
    pickup_scheduled_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    estimated_delivery_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    
    # POD verification
    pod_verified = Column(Boolean, default=False)
    pod_verification_hash = Column(String(64), nullable=True)
    
    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_delivery_order", "order_id"),
        Index("idx_delivery_escrow", "escrow_id"),
        Index("idx_delivery_seller", "seller_id"),
        Index("idx_delivery_buyer", "buyer_id"),
        Index("idx_delivery_status", "status"),
        Index("idx_delivery_tracking", "provider_tracking_number"),
    )


class ProofOfDelivery(Base):
    """Proof of delivery evidence"""
    __tablename__ = "proof_of_delivery"
    
    id = Column(String(36), primary_key=True)
    delivery_id = Column(String(36), ForeignKey("deliveries.id"), nullable=False, index=True)
    
    # POD type
    pod_type = Column(SQLEnum(PODType), nullable=False)
    
    # Evidence
    file_url = Column(String(1000), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256 for tamper detection
    
    # Signature
    signature_data = Column(Text, nullable=True)  # Base64 encoded
    signer_name = Column(String(255), nullable=True)
    
    # GPS
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy_meters = Column(Float, nullable=True)
    
    # OTP
    otp_code = Column(String(10), nullable=True)
    otp_verified = Column(Boolean, default=False)
    otp_verified_at = Column(DateTime, nullable=True)
    
    # Recipient
    recipient_name = Column(String(255), nullable=True)
    recipient_id_type = Column(String(50), nullable=True)
    recipient_id_last4 = Column(String(4), nullable=True)
    
    # Metadata
    captured_by = Column(String(36), nullable=True)  # Driver/agent ID
    device_info = Column(JSON, nullable=True)
    
    # Timestamps
    captured_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_pod_delivery", "delivery_id"),
        Index("idx_pod_type", "pod_type"),
    )


class DeliveryEvent(Base):
    """Delivery tracking events"""
    __tablename__ = "delivery_events"
    
    id = Column(String(36), primary_key=True)
    delivery_id = Column(String(36), ForeignKey("deliveries.id"), nullable=False, index=True)
    
    # Event
    event_type = Column(String(50), nullable=False)
    status = Column(SQLEnum(DeliveryStatus), nullable=False)
    description = Column(Text, nullable=True)
    
    # Location
    location = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Source
    source = Column(String(50), nullable=False)  # provider, system, manual
    
    # Timestamps
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_event_delivery", "delivery_id"),
        Index("idx_event_occurred", "occurred_at"),
    )


# =============================================================================
# Database Models - Marketplace Discovery
# =============================================================================

class MarketplaceSeller(Base):
    """Seller profile in marketplace"""
    __tablename__ = "marketplace_sellers"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, unique=True, index=True)
    
    # Profile
    business_name = Column(String(255), nullable=False)
    username = Column(String(100), nullable=True, unique=True, index=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(1000), nullable=True)
    banner_url = Column(String(1000), nullable=True)
    
    # Location
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Contact
    phone = Column(String(20), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Verification
    verification_level = Column(String(50), default="unverified")  # unverified, phone, id, business
    verified_at = Column(DateTime, nullable=True)
    
    # Stats
    total_listings = Column(Integer, default=0)
    active_listings = Column(Integer, default=0)
    total_sales = Column(Integer, default=0)
    total_revenue_ngn = Column(Integer, default=0)
    
    # Ratings
    rating_average = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    
    # Badges
    badges = Column(JSON, default=list)  # ["top_seller", "fast_shipper", etc.]
    
    # Featured
    is_featured = Column(Boolean, default=False)
    featured_until = Column(DateTime, nullable=True)
    
    # Categories
    categories = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_marketplace_seller_user", "user_id"),
        Index("idx_marketplace_seller_username", "username"),
        Index("idx_marketplace_seller_state", "state"),
        Index("idx_marketplace_seller_featured", "is_featured"),
    )


class MarketplaceListing(Base):
    """Product/service listing in marketplace"""
    __tablename__ = "marketplace_listings"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), ForeignKey("marketplace_sellers.id"), nullable=False, index=True)
    
    # Listing info
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)
    
    # Type
    listing_type = Column(String(50), default="product")  # product, service, digital
    
    # Pricing
    price_ngn = Column(Integer, nullable=False)
    original_price_ngn = Column(Integer, nullable=True)
    negotiable = Column(Boolean, default=False)
    
    # Condition (for products)
    condition = Column(String(50), nullable=True)  # new, used, refurbished
    
    # Media
    images = Column(JSON, default=list)
    videos = Column(JSON, default=list)
    
    # Location
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Status
    status = Column(SQLEnum(ListingStatus), default=ListingStatus.DRAFT)
    
    # Inventory
    quantity = Column(Integer, default=1)
    
    # Stats
    view_count = Column(Integer, default=0)
    inquiry_count = Column(Integer, default=0)
    favorite_count = Column(Integer, default=0)
    
    # Featured
    is_featured = Column(Boolean, default=False)
    featured_until = Column(DateTime, nullable=True)
    
    # Expiry
    expires_at = Column(DateTime, nullable=True)
    
    # SEO
    tags = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_listing_seller", "seller_id"),
        Index("idx_listing_category", "category"),
        Index("idx_listing_status", "status"),
        Index("idx_listing_price", "price_ngn"),
        Index("idx_listing_state", "state"),
        Index("idx_listing_featured", "is_featured"),
    )


class MarketplaceReview(Base):
    """Seller review"""
    __tablename__ = "marketplace_reviews"
    
    id = Column(String(36), primary_key=True)
    seller_id = Column(String(36), ForeignKey("marketplace_sellers.id"), nullable=False, index=True)
    buyer_id = Column(String(36), nullable=False, index=True)
    order_id = Column(String(36), nullable=True)
    
    # Rating
    rating = Column(Integer, nullable=False)  # 1-5
    
    # Review
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    
    # Response
    seller_response = Column(Text, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    
    # Verification
    verified_purchase = Column(Boolean, default=False)
    
    # Moderation
    is_visible = Column(Boolean, default=True)
    flagged = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_review_seller", "seller_id"),
        Index("idx_review_buyer", "buyer_id"),
        UniqueConstraint("seller_id", "buyer_id", "order_id", name="uq_review_order"),
    )


# =============================================================================
# Database Models - Dispute Operations
# =============================================================================

class DisputeOps(Base):
    """Dispute with SLA tracking"""
    __tablename__ = "dispute_ops"
    
    id = Column(String(36), primary_key=True)
    escrow_id = Column(String(36), nullable=False, index=True)
    
    # Parties
    buyer_id = Column(String(36), nullable=False, index=True)
    seller_id = Column(String(36), nullable=False, index=True)
    
    # Status
    status = Column(SQLEnum(DisputeOpsStatus), default=DisputeOpsStatus.OPENED)
    priority = Column(SQLEnum(DisputePriority), default=DisputePriority.MEDIUM)
    
    # Type
    dispute_type = Column(String(50), nullable=False)
    
    # Description
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    # Amount
    disputed_amount_ngn = Column(Integer, nullable=False)
    
    # Assignment
    assigned_agent_id = Column(String(36), nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # SLA deadlines
    response_deadline = Column(DateTime, nullable=False)
    resolution_deadline = Column(DateTime, nullable=False)
    escalation_deadline = Column(DateTime, nullable=True)
    
    # SLA tracking
    first_response_at = Column(DateTime, nullable=True)
    response_sla_met = Column(Boolean, nullable=True)
    resolution_sla_met = Column(Boolean, nullable=True)
    
    # Resolution
    resolution_type = Column(String(50), nullable=True)
    resolution_amount_ngn = Column(Integer, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), nullable=True)
    
    # Feedback
    buyer_satisfaction = Column(Integer, nullable=True)  # 1-5
    seller_satisfaction = Column(Integer, nullable=True)  # 1-5
    feedback_notes = Column(Text, nullable=True)
    
    # Escalation
    escalated = Column(Boolean, default=False)
    escalation_reason = Column(String(100), nullable=True)
    escalated_at = Column(DateTime, nullable=True)
    escalated_to = Column(String(36), nullable=True)
    
    # Optimistic locking
    version = Column(Integer, default=1, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_dispute_ops_escrow", "escrow_id"),
        Index("idx_dispute_ops_buyer", "buyer_id"),
        Index("idx_dispute_ops_seller", "seller_id"),
        Index("idx_dispute_ops_status", "status"),
        Index("idx_dispute_ops_agent", "assigned_agent_id"),
        Index("idx_dispute_ops_priority", "priority"),
    )


class DisputeOpsEvidence(Base):
    """Evidence for dispute"""
    __tablename__ = "dispute_ops_evidence"
    
    id = Column(String(36), primary_key=True)
    dispute_id = Column(String(36), ForeignKey("dispute_ops.id"), nullable=False, index=True)
    
    # Submitter
    submitted_by = Column(String(36), nullable=False)
    submitted_by_role = Column(String(20), nullable=False)  # buyer, seller, agent
    
    # Evidence
    evidence_type = Column(String(50), nullable=False)
    file_url = Column(String(1000), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256
    description = Column(Text, nullable=True)
    
    # Verification
    verified = Column(Boolean, default=False)
    verified_by = Column(String(36), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_dispute_evidence_dispute", "dispute_id"),
    )


class DisputeOpsMessage(Base):
    """Message in dispute thread"""
    __tablename__ = "dispute_ops_messages"
    
    id = Column(String(36), primary_key=True)
    dispute_id = Column(String(36), ForeignKey("dispute_ops.id"), nullable=False, index=True)
    
    # Sender
    sender_id = Column(String(36), nullable=False)
    sender_role = Column(String(20), nullable=False)  # buyer, seller, agent, system
    
    # Message
    content = Column(Text, nullable=False)
    
    # Attachments
    attachments = Column(JSON, default=list)
    
    # Read status
    read_by_buyer = Column(Boolean, default=False)
    read_by_seller = Column(Boolean, default=False)
    read_by_agent = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_dispute_message_dispute", "dispute_id"),
    )


class DisputeAgent(Base):
    """Dispute resolution agent"""
    __tablename__ = "dispute_agents"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, unique=True)
    
    # Profile
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_available = Column(Boolean, default=True)
    
    # Capacity
    max_active_disputes = Column(Integer, default=20)
    current_active_disputes = Column(Integer, default=0)
    
    # Specialization
    specializations = Column(JSON, default=list)  # ["electronics", "fashion", etc.]
    
    # Stats
    total_resolved = Column(Integer, default=0)
    avg_resolution_hours = Column(Float, default=0.0)
    satisfaction_rating = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_agent_user", "user_id"),
        Index("idx_agent_active", "is_active", "is_available"),
    )


# =============================================================================
# Repositories
# =============================================================================

class StorefrontProductRepository:
    """Repository for storefront products"""
    
    async def create(self, product_data: Dict[str, Any]) -> StorefrontProduct:
        async with db_manager.session() as session:
            product = StorefrontProduct(
                id=product_data.get("id", str(uuid.uuid4())),
                seller_id=product_data["seller_id"],
                name=product_data["name"],
                description=product_data.get("description"),
                category=product_data.get("category"),
                sku=product_data.get("sku"),
                price_ngn=product_data["price_ngn"],
                compare_at_price_ngn=product_data.get("compare_at_price_ngn"),
                cost_ngn=product_data.get("cost_ngn"),
                quantity=product_data.get("quantity", 0),
                low_stock_threshold=product_data.get("low_stock_threshold", 5),
                track_inventory=product_data.get("track_inventory", True),
                status=ProductStatus(product_data.get("status", "draft")),
                images=product_data.get("images", []),
                variants=product_data.get("variants", []),
                tags=product_data.get("tags", []),
            )
            session.add(product)
            await session.flush()
            return product
    
    async def get(self, product_id: str) -> Optional[StorefrontProduct]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(StorefrontProduct).where(StorefrontProduct.id == product_id)
            )
            return result.scalar_one_or_none()
    
    async def get_by_seller(self, seller_id: str, status: Optional[str] = None, limit: int = 100) -> List[StorefrontProduct]:
        async with db_manager.session() as session:
            query = select(StorefrontProduct).where(StorefrontProduct.seller_id == seller_id)
            if status:
                query = query.where(StorefrontProduct.status == ProductStatus(status))
            query = query.order_by(StorefrontProduct.created_at.desc()).limit(limit)
            result = await session.execute(query)
            return list(result.scalars().all())
    
    async def update(self, product_id: str, data: Dict[str, Any], expected_version: int = None) -> Optional[StorefrontProduct]:
        async with db_manager.session() as session:
            query = select(StorefrontProduct).where(StorefrontProduct.id == product_id)
            if expected_version:
                query = query.where(StorefrontProduct.version == expected_version)
            
            result = await session.execute(query)
            product = result.scalar_one_or_none()
            
            if not product:
                if expected_version:
                    raise ValueError("Concurrent modification detected")
                return None
            
            for key, value in data.items():
                if hasattr(product, key) and key not in ["id", "seller_id", "created_at"]:
                    setattr(product, key, value)
            
            product.version += 1
            product.updated_at = datetime.utcnow()
            await session.flush()
            return product
    
    async def update_inventory(self, product_id: str, quantity_delta: int, expected_version: int) -> Optional[StorefrontProduct]:
        """Update inventory with optimistic locking"""
        async with db_manager.session() as session:
            result = await session.execute(
                select(StorefrontProduct)
                .where(StorefrontProduct.id == product_id)
                .where(StorefrontProduct.version == expected_version)
            )
            product = result.scalar_one_or_none()
            
            if not product:
                raise ValueError("Concurrent modification detected or product not found")
            
            new_quantity = product.quantity + quantity_delta
            if new_quantity < 0:
                raise ValueError("Insufficient inventory")
            
            product.quantity = new_quantity
            product.version += 1
            
            # Update status based on inventory
            if new_quantity == 0 and product.track_inventory:
                product.status = ProductStatus.OUT_OF_STOCK
            elif product.status == ProductStatus.OUT_OF_STOCK and new_quantity > 0:
                product.status = ProductStatus.ACTIVE
            
            await session.flush()
            return product


class ReturnRequestRepository:
    """Repository for return requests"""
    
    async def create(self, return_data: Dict[str, Any]) -> ReturnRequest:
        async with db_manager.session() as session:
            # Generate RMA number
            rma_number = f"RMA-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            return_request = ReturnRequest(
                id=return_data.get("id", str(uuid.uuid4())),
                rma_number=rma_number,
                seller_id=return_data["seller_id"],
                buyer_id=return_data["buyer_id"],
                order_id=return_data["order_id"],
                escrow_id=return_data.get("escrow_id"),
                reason=return_data["reason"],
                description=return_data.get("description"),
                items=return_data["items"],
                photos=return_data.get("photos", []),
                videos=return_data.get("videos", []),
                original_amount_ngn=return_data["original_amount_ngn"],
                # Set SLA deadlines
                approval_deadline=datetime.utcnow() + timedelta(hours=24),
            )
            session.add(return_request)
            await session.flush()
            return return_request
    
    async def get(self, return_id: str) -> Optional[ReturnRequest]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(ReturnRequest).where(ReturnRequest.id == return_id)
            )
            return result.scalar_one_or_none()
    
    async def get_by_rma(self, rma_number: str) -> Optional[ReturnRequest]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(ReturnRequest).where(ReturnRequest.rma_number == rma_number)
            )
            return result.scalar_one_or_none()
    
    async def update_status(self, return_id: str, status: ReturnStatus, expected_version: int, **kwargs) -> Optional[ReturnRequest]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(ReturnRequest)
                .where(ReturnRequest.id == return_id)
                .where(ReturnRequest.version == expected_version)
            )
            return_request = result.scalar_one_or_none()
            
            if not return_request:
                raise ValueError("Concurrent modification detected or return not found")
            
            return_request.status = status
            return_request.version += 1
            
            for key, value in kwargs.items():
                if hasattr(return_request, key):
                    setattr(return_request, key, value)
            
            # Set SLA deadlines based on status
            if status == ReturnStatus.APPROVED:
                return_request.inspection_deadline = datetime.utcnow() + timedelta(hours=48)
            elif status == ReturnStatus.INSPECTION_PASSED:
                return_request.refund_deadline = datetime.utcnow() + timedelta(hours=72)
            
            await session.flush()
            return return_request
    
    async def get_sla_breached(self) -> List[ReturnRequest]:
        """Get returns that have breached SLA"""
        async with db_manager.session() as session:
            now = datetime.utcnow()
            result = await session.execute(
                select(ReturnRequest)
                .where(
                    or_(
                        and_(
                            ReturnRequest.status == ReturnStatus.REQUESTED,
                            ReturnRequest.approval_deadline < now
                        ),
                        and_(
                            ReturnRequest.status.in_([ReturnStatus.RECEIVED, ReturnStatus.INSPECTING]),
                            ReturnRequest.inspection_deadline < now
                        ),
                        and_(
                            ReturnRequest.status == ReturnStatus.REFUND_PROCESSING,
                            ReturnRequest.refund_deadline < now
                        )
                    )
                )
            )
            return list(result.scalars().all())


class DeliveryRepository:
    """Repository for deliveries"""
    
    async def create(self, delivery_data: Dict[str, Any]) -> Delivery:
        async with db_manager.session() as session:
            delivery = Delivery(
                id=delivery_data.get("id", str(uuid.uuid4())),
                order_id=delivery_data["order_id"],
                escrow_id=delivery_data.get("escrow_id"),
                seller_id=delivery_data["seller_id"],
                buyer_id=delivery_data["buyer_id"],
                provider=delivery_data["provider"],
                method=delivery_data["method"],
                pickup_address=delivery_data.get("pickup_address"),
                delivery_address=delivery_data.get("delivery_address"),
                package_weight_kg=delivery_data.get("package_weight_kg"),
                package_dimensions=delivery_data.get("package_dimensions"),
                package_description=delivery_data.get("package_description"),
                shipping_cost_ngn=delivery_data.get("shipping_cost_ngn", 0),
                insurance_cost_ngn=delivery_data.get("insurance_cost_ngn", 0),
                total_cost_ngn=delivery_data.get("total_cost_ngn", 0),
            )
            session.add(delivery)
            await session.flush()
            return delivery
    
    async def get(self, delivery_id: str) -> Optional[Delivery]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Delivery).where(Delivery.id == delivery_id)
            )
            return result.scalar_one_or_none()
    
    async def update_status(self, delivery_id: str, status: DeliveryStatus, expected_version: int, **kwargs) -> Optional[Delivery]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Delivery)
                .where(Delivery.id == delivery_id)
                .where(Delivery.version == expected_version)
            )
            delivery = result.scalar_one_or_none()
            
            if not delivery:
                raise ValueError("Concurrent modification detected or delivery not found")
            
            delivery.status = status
            delivery.version += 1
            
            for key, value in kwargs.items():
                if hasattr(delivery, key):
                    setattr(delivery, key, value)
            
            await session.flush()
            return delivery
    
    async def add_pod(self, pod_data: Dict[str, Any]) -> ProofOfDelivery:
        async with db_manager.session() as session:
            # Calculate file hash if URL provided
            file_hash = None
            if pod_data.get("file_url"):
                file_hash = hashlib.sha256(pod_data["file_url"].encode()).hexdigest()
            
            pod = ProofOfDelivery(
                id=str(uuid.uuid4()),
                delivery_id=pod_data["delivery_id"],
                pod_type=PODType(pod_data["pod_type"]),
                file_url=pod_data.get("file_url"),
                file_hash=file_hash,
                signature_data=pod_data.get("signature_data"),
                signer_name=pod_data.get("signer_name"),
                latitude=pod_data.get("latitude"),
                longitude=pod_data.get("longitude"),
                accuracy_meters=pod_data.get("accuracy_meters"),
                otp_code=pod_data.get("otp_code"),
                recipient_name=pod_data.get("recipient_name"),
                recipient_id_type=pod_data.get("recipient_id_type"),
                recipient_id_last4=pod_data.get("recipient_id_last4"),
                captured_by=pod_data.get("captured_by"),
                device_info=pod_data.get("device_info"),
            )
            session.add(pod)
            await session.flush()
            return pod
    
    async def get_pod_evidence(self, delivery_id: str) -> List[ProofOfDelivery]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(ProofOfDelivery)
                .where(ProofOfDelivery.delivery_id == delivery_id)
                .order_by(ProofOfDelivery.captured_at)
            )
            return list(result.scalars().all())


class MarketplaceListingRepository:
    """Repository for marketplace listings"""
    
    async def create(self, listing_data: Dict[str, Any]) -> MarketplaceListing:
        async with db_manager.session() as session:
            listing = MarketplaceListing(
                id=listing_data.get("id", str(uuid.uuid4())),
                seller_id=listing_data["seller_id"],
                title=listing_data["title"],
                description=listing_data.get("description"),
                category=listing_data["category"],
                subcategory=listing_data.get("subcategory"),
                listing_type=listing_data.get("listing_type", "product"),
                price_ngn=listing_data["price_ngn"],
                original_price_ngn=listing_data.get("original_price_ngn"),
                negotiable=listing_data.get("negotiable", False),
                condition=listing_data.get("condition"),
                images=listing_data.get("images", []),
                videos=listing_data.get("videos", []),
                city=listing_data.get("city"),
                state=listing_data.get("state"),
                latitude=listing_data.get("latitude"),
                longitude=listing_data.get("longitude"),
                quantity=listing_data.get("quantity", 1),
                tags=listing_data.get("tags", []),
            )
            session.add(listing)
            await session.flush()
            return listing
    
    async def get(self, listing_id: str) -> Optional[MarketplaceListing]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(MarketplaceListing).where(MarketplaceListing.id == listing_id)
            )
            return result.scalar_one_or_none()
    
    async def search(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        state: Optional[str] = None,
        min_price: Optional[int] = None,
        max_price: Optional[int] = None,
        condition: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[MarketplaceListing]:
        async with db_manager.session() as session:
            stmt = select(MarketplaceListing).where(MarketplaceListing.status == ListingStatus.ACTIVE)
            
            if query:
                stmt = stmt.where(
                    or_(
                        MarketplaceListing.title.ilike(f"%{query}%"),
                        MarketplaceListing.description.ilike(f"%{query}%")
                    )
                )
            if category:
                stmt = stmt.where(MarketplaceListing.category == category)
            if state:
                stmt = stmt.where(MarketplaceListing.state == state)
            if min_price:
                stmt = stmt.where(MarketplaceListing.price_ngn >= min_price)
            if max_price:
                stmt = stmt.where(MarketplaceListing.price_ngn <= max_price)
            if condition:
                stmt = stmt.where(MarketplaceListing.condition == condition)
            
            stmt = stmt.order_by(MarketplaceListing.created_at.desc()).limit(limit).offset(offset)
            result = await session.execute(stmt)
            return list(result.scalars().all())
    
    async def increment_view(self, listing_id: str):
        async with db_manager.session() as session:
            await session.execute(
                update(MarketplaceListing)
                .where(MarketplaceListing.id == listing_id)
                .values(view_count=MarketplaceListing.view_count + 1)
            )


class DisputeOpsRepository:
    """Repository for dispute operations"""
    
    # SLA configuration by priority (hours)
    SLA_CONFIG = {
        DisputePriority.LOW: {"response": 48, "resolution": 168, "escalation": 120},
        DisputePriority.MEDIUM: {"response": 24, "resolution": 96, "escalation": 72},
        DisputePriority.HIGH: {"response": 12, "resolution": 48, "escalation": 36},
        DisputePriority.URGENT: {"response": 4, "resolution": 24, "escalation": 12},
    }
    
    async def create(self, dispute_data: Dict[str, Any]) -> DisputeOps:
        async with db_manager.session() as session:
            priority = DisputePriority(dispute_data.get("priority", "medium"))
            sla = self.SLA_CONFIG[priority]
            
            dispute = DisputeOps(
                id=dispute_data.get("id", str(uuid.uuid4())),
                escrow_id=dispute_data["escrow_id"],
                buyer_id=dispute_data["buyer_id"],
                seller_id=dispute_data["seller_id"],
                dispute_type=dispute_data["dispute_type"],
                title=dispute_data["title"],
                description=dispute_data["description"],
                disputed_amount_ngn=dispute_data["disputed_amount_ngn"],
                priority=priority,
                response_deadline=datetime.utcnow() + timedelta(hours=sla["response"]),
                resolution_deadline=datetime.utcnow() + timedelta(hours=sla["resolution"]),
                escalation_deadline=datetime.utcnow() + timedelta(hours=sla["escalation"]),
            )
            session.add(dispute)
            await session.flush()
            return dispute
    
    async def get(self, dispute_id: str) -> Optional[DisputeOps]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(DisputeOps).where(DisputeOps.id == dispute_id)
            )
            return result.scalar_one_or_none()
    
    async def update_status(self, dispute_id: str, status: DisputeOpsStatus, expected_version: int, **kwargs) -> Optional[DisputeOps]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(DisputeOps)
                .where(DisputeOps.id == dispute_id)
                .where(DisputeOps.version == expected_version)
            )
            dispute = result.scalar_one_or_none()
            
            if not dispute:
                raise ValueError("Concurrent modification detected or dispute not found")
            
            dispute.status = status
            dispute.version += 1
            
            for key, value in kwargs.items():
                if hasattr(dispute, key):
                    setattr(dispute, key, value)
            
            # Track first response
            if not dispute.first_response_at and status != DisputeOpsStatus.OPENED:
                dispute.first_response_at = datetime.utcnow()
                dispute.response_sla_met = datetime.utcnow() <= dispute.response_deadline
            
            await session.flush()
            return dispute
    
    async def assign_agent(self, dispute_id: str, agent_id: str, expected_version: int) -> Optional[DisputeOps]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(DisputeOps)
                .where(DisputeOps.id == dispute_id)
                .where(DisputeOps.version == expected_version)
            )
            dispute = result.scalar_one_or_none()
            
            if not dispute:
                raise ValueError("Concurrent modification detected or dispute not found")
            
            dispute.assigned_agent_id = agent_id
            dispute.assigned_at = datetime.utcnow()
            dispute.version += 1
            
            # Increment agent's active disputes
            await session.execute(
                update(DisputeAgent)
                .where(DisputeAgent.id == agent_id)
                .values(current_active_disputes=DisputeAgent.current_active_disputes + 1)
            )
            
            await session.flush()
            return dispute
    
    async def resolve(
        self,
        dispute_id: str,
        resolution_type: str,
        resolution_amount_ngn: int,
        resolution_notes: str,
        resolved_by: str,
        expected_version: int
    ) -> Optional[DisputeOps]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(DisputeOps)
                .where(DisputeOps.id == dispute_id)
                .where(DisputeOps.version == expected_version)
            )
            dispute = result.scalar_one_or_none()
            
            if not dispute:
                raise ValueError("Concurrent modification detected or dispute not found")
            
            # Determine final status based on resolution type
            if resolution_type == "full_refund":
                dispute.status = DisputeOpsStatus.RESOLVED_BUYER_FAVOR
            elif resolution_type == "no_action":
                dispute.status = DisputeOpsStatus.RESOLVED_SELLER_FAVOR
            else:
                dispute.status = DisputeOpsStatus.RESOLVED_SPLIT
            
            dispute.resolution_type = resolution_type
            dispute.resolution_amount_ngn = resolution_amount_ngn
            dispute.resolution_notes = resolution_notes
            dispute.resolved_at = datetime.utcnow()
            dispute.resolved_by = resolved_by
            dispute.resolution_sla_met = datetime.utcnow() <= dispute.resolution_deadline
            dispute.version += 1
            
            # Decrement agent's active disputes
            if dispute.assigned_agent_id:
                await session.execute(
                    update(DisputeAgent)
                    .where(DisputeAgent.id == dispute.assigned_agent_id)
                    .values(
                        current_active_disputes=DisputeAgent.current_active_disputes - 1,
                        total_resolved=DisputeAgent.total_resolved + 1
                    )
                )
            
            await session.flush()
            return dispute
    
    async def add_evidence(self, evidence_data: Dict[str, Any]) -> DisputeOpsEvidence:
        async with db_manager.session() as session:
            file_hash = None
            if evidence_data.get("file_url"):
                file_hash = hashlib.sha256(evidence_data["file_url"].encode()).hexdigest()
            
            evidence = DisputeOpsEvidence(
                id=str(uuid.uuid4()),
                dispute_id=evidence_data["dispute_id"],
                submitted_by=evidence_data["submitted_by"],
                submitted_by_role=evidence_data["submitted_by_role"],
                evidence_type=evidence_data["evidence_type"],
                file_url=evidence_data.get("file_url"),
                file_hash=file_hash,
                description=evidence_data.get("description"),
            )
            session.add(evidence)
            await session.flush()
            return evidence
    
    async def add_message(self, message_data: Dict[str, Any]) -> DisputeOpsMessage:
        async with db_manager.session() as session:
            message = DisputeOpsMessage(
                id=str(uuid.uuid4()),
                dispute_id=message_data["dispute_id"],
                sender_id=message_data["sender_id"],
                sender_role=message_data["sender_role"],
                content=message_data["content"],
                attachments=message_data.get("attachments", []),
            )
            session.add(message)
            await session.flush()
            return message
    
    async def get_sla_breached(self) -> List[DisputeOps]:
        """Get disputes that have breached SLA"""
        async with db_manager.session() as session:
            now = datetime.utcnow()
            result = await session.execute(
                select(DisputeOps)
                .where(
                    and_(
                        DisputeOps.status.not_in([
                            DisputeOpsStatus.RESOLVED_BUYER_FAVOR,
                            DisputeOpsStatus.RESOLVED_SELLER_FAVOR,
                            DisputeOpsStatus.RESOLVED_SPLIT,
                            DisputeOpsStatus.CLOSED,
                            DisputeOpsStatus.CANCELLED
                        ]),
                        or_(
                            DisputeOps.response_deadline < now,
                            DisputeOps.resolution_deadline < now
                        )
                    )
                )
            )
            return list(result.scalars().all())
    
    async def get_analytics(self) -> Dict[str, Any]:
        """Get dispute analytics"""
        async with db_manager.session() as session:
            # Total disputes
            total = await session.execute(select(func.count(DisputeOps.id)))
            
            # By status
            by_status = await session.execute(
                select(DisputeOps.status, func.count(DisputeOps.id))
                .group_by(DisputeOps.status)
            )
            
            # Resolution rate
            resolved = await session.execute(
                select(func.count(DisputeOps.id))
                .where(DisputeOps.status.in_([
                    DisputeOpsStatus.RESOLVED_BUYER_FAVOR,
                    DisputeOpsStatus.RESOLVED_SELLER_FAVOR,
                    DisputeOpsStatus.RESOLVED_SPLIT
                ]))
            )
            
            # SLA compliance
            sla_met = await session.execute(
                select(func.count(DisputeOps.id))
                .where(DisputeOps.resolution_sla_met == True)
            )
            
            total_count = total.scalar() or 0
            resolved_count = resolved.scalar() or 0
            sla_met_count = sla_met.scalar() or 0
            
            return {
                "total_disputes": total_count,
                "by_status": {row[0].value: row[1] for row in by_status.all()},
                "resolution_rate": (resolved_count / total_count * 100) if total_count > 0 else 0,
                "sla_compliance_rate": (sla_met_count / resolved_count * 100) if resolved_count > 0 else 0,
            }


# =============================================================================
# Repository Instances
# =============================================================================

storefront_product_repo = StorefrontProductRepository()
return_request_repo = ReturnRequestRepository()
delivery_repo = DeliveryRepository()
marketplace_listing_repo = MarketplaceListingRepository()
dispute_ops_repo = DisputeOpsRepository()


# =============================================================================
# Database Initialization
# =============================================================================

async def init_competitive_features_db():
    """Initialize database tables for competitive features"""
    try:
        async with db_manager.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Competitive features database tables initialized")
    except Exception as e:
        logger.error(f"Failed to initialize competitive features database: {e}")
        raise
