"""
Database configuration and models for SocialEscrow
Provides PostgreSQL persistence with SQLAlchemy
"""

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON, Enum as SQLEnum,
    ForeignKey, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum
from typing import Optional
import os

# Database URL - use SQLite for POC, PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./escrow.db")

# For PostgreSQL in production:
# DATABASE_URL = "postgresql+asyncpg://user:password@localhost/escrow"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

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
    CANCELLED = "cancelled"

class DisputeStatus(str, Enum):
    OPEN = "open"
    EVIDENCE_COLLECTION = "evidence_collection"
    UNDER_REVIEW = "under_review"
    RESOLVED_BUYER = "resolved_buyer"
    RESOLVED_SELLER = "resolved_seller"
    RESOLVED_SPLIT = "resolved_split"
    ESCALATED = "escalated"
    CLOSED = "closed"

class DisputeReason(str, Enum):
    NOT_RECEIVED = "not_received"
    WRONG_ITEM = "wrong_item"
    DAMAGED = "damaged"
    NOT_AS_DESCRIBED = "not_as_described"
    COUNTERFEIT = "counterfeit"
    PARTIAL_DELIVERY = "partial_delivery"
    LATE_DELIVERY = "late_delivery"
    OTHER = "other"

class LedgerEntryType(str, Enum):
    ESCROW_DEPOSIT = "escrow_deposit"
    ESCROW_RELEASE = "escrow_release"
    ESCROW_REFUND = "escrow_refund"
    PLATFORM_FEE = "platform_fee"
    INSURANCE_PREMIUM = "insurance_premium"
    INSURANCE_PAYOUT = "insurance_payout"
    DISPUTE_HOLD = "dispute_hold"
    DISPUTE_RELEASE = "dispute_release"
    ADJUSTMENT = "adjustment"

class FraudRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# ============================================
# User and Account Models
# ============================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    phone_verified = Column(Boolean, default=False)
    email = Column(String(255), unique=True, nullable=True)
    email_verified = Column(Boolean, default=False)
    name = Column(String(255), nullable=True)
    
    # KYC fields
    bvn_hash = Column(String(64), nullable=True)  # Hashed BVN
    nin_hash = Column(String(64), nullable=True)  # Hashed NIN
    kyc_level = Column(Integer, default=0)  # 0=none, 1=phone, 2=bvn, 3=full
    kyc_verified_at = Column(DateTime, nullable=True)
    
    # Risk scoring
    risk_score = Column(Float, default=0.0)
    risk_level = Column(SQLEnum(FraudRiskLevel), default=FraudRiskLevel.LOW)
    
    # Stats
    total_transactions = Column(Integer, default=0)
    successful_transactions = Column(Integer, default=0)
    disputed_transactions = Column(Integer, default=0)
    total_volume = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active_at = Column(DateTime, nullable=True)
    
    # Device fingerprinting
    device_fingerprints = Column(JSON, default=list)
    
    # Relationships
    escrows_as_buyer = relationship("Escrow", back_populates="buyer", foreign_keys="Escrow.buyer_id")
    escrows_as_seller = relationship("Escrow", back_populates="seller", foreign_keys="Escrow.seller_id")
    bank_accounts = relationship("BankAccount", back_populates="user")
    
    __table_args__ = (
        Index("idx_user_phone", "phone"),
        Index("idx_user_risk", "risk_level"),
    )

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    bank_code = Column(String(10), nullable=False)
    bank_name = Column(String(100), nullable=False)
    account_number_hash = Column(String(64), nullable=False)  # Hashed for security
    account_number_last4 = Column(String(4), nullable=False)
    account_name = Column(String(255), nullable=True)
    
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    verification_method = Column(String(50), nullable=True)  # paystack, flutterwave, manual
    
    is_primary = Column(Boolean, default=False)
    payout_count = Column(Integer, default=0)
    total_payout_amount = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="bank_accounts")
    
    __table_args__ = (
        Index("idx_bank_user", "user_id"),
        UniqueConstraint("user_id", "bank_code", "account_number_hash", name="uq_user_bank_account"),
    )

# ============================================
# Escrow Models
# ============================================

class Escrow(Base):
    __tablename__ = "escrows"
    
    id = Column(String(36), primary_key=True)
    
    # Parties
    buyer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    seller_id = Column(String(36), ForeignKey("users.id"), nullable=True)  # May be null initially
    
    # Status
    status = Column(SQLEnum(EscrowStatus), default=EscrowStatus.PENDING_PAYMENT, index=True)
    
    # Amounts
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    platform_fee = Column(Float, nullable=False)
    insurance_fee = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    # Listing details
    listing_id = Column(String(36), nullable=True)
    listing_title = Column(String(500), nullable=True)
    listing_source = Column(String(50), nullable=True)  # instagram, whatsapp, ussd, etc.
    listing_url = Column(String(1000), nullable=True)
    
    # Seller details (before seller claims)
    seller_phone = Column(String(20), nullable=True)
    seller_username = Column(String(100), nullable=True)
    
    # Payment details
    payment_method = Column(String(50), nullable=True)
    payment_reference = Column(String(100), nullable=True, unique=True)
    payment_provider = Column(String(50), nullable=True)
    payment_confirmed_at = Column(DateTime, nullable=True)
    
    # Payout details
    payout_bank_account_id = Column(String(36), ForeignKey("bank_accounts.id"), nullable=True)
    payout_reference = Column(String(100), nullable=True)
    payout_completed_at = Column(DateTime, nullable=True)
    
    # Shipping
    shipping_carrier = Column(String(100), nullable=True)
    shipping_tracking = Column(String(100), nullable=True)
    shipping_estimated_delivery = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    
    # Delivery confirmation
    delivery_confirmed = Column(Boolean, default=False)
    delivery_rating = Column(Integer, nullable=True)
    delivery_feedback = Column(Text, nullable=True)
    
    # Tokens
    claim_token = Column(String(64), nullable=True, index=True)
    
    # Idempotency
    idempotency_key = Column(String(100), nullable=True, unique=True)
    
    # Risk assessment
    risk_score = Column(Float, default=0.0)
    risk_flags = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    buyer = relationship("User", back_populates="escrows_as_buyer", foreign_keys=[buyer_id])
    seller = relationship("User", back_populates="escrows_as_seller", foreign_keys=[seller_id])
    payout_bank_account = relationship("BankAccount")
    ledger_entries = relationship("LedgerEntry", back_populates="escrow")
    disputes = relationship("Dispute", back_populates="escrow")
    timeline_events = relationship("EscrowTimeline", back_populates="escrow")
    
    __table_args__ = (
        Index("idx_escrow_buyer", "buyer_id"),
        Index("idx_escrow_seller", "seller_id"),
        Index("idx_escrow_status", "status"),
        Index("idx_escrow_created", "created_at"),
        CheckConstraint("amount > 0", name="ck_escrow_amount_positive"),
    )

class EscrowTimeline(Base):
    __tablename__ = "escrow_timeline"
    
    id = Column(String(36), primary_key=True)
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=False)
    
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, default=dict)
    actor_id = Column(String(36), nullable=True)  # User who triggered the event
    actor_type = Column(String(20), nullable=True)  # buyer, seller, system, admin
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    escrow = relationship("Escrow", back_populates="timeline_events")
    
    __table_args__ = (
        Index("idx_timeline_escrow", "escrow_id"),
    )

# ============================================
# Double-Entry Ledger
# ============================================

class LedgerEntry(Base):
    """
    Double-entry ledger for all financial transactions.
    Every transaction creates two entries: debit and credit.
    """
    __tablename__ = "ledger_entries"
    
    id = Column(String(36), primary_key=True)
    
    # Transaction reference
    transaction_id = Column(String(36), nullable=False, index=True)  # Groups debit/credit pairs
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=True)
    
    # Entry type
    entry_type = Column(SQLEnum(LedgerEntryType), nullable=False)
    
    # Account (simplified: user_id or "platform" or "insurance_pool")
    account_id = Column(String(36), nullable=False, index=True)
    account_type = Column(String(20), nullable=False)  # user, platform, insurance, escrow_hold
    
    # Amount (positive = credit, negative = debit)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    
    # Balance after this entry
    balance_after = Column(Float, nullable=False)
    
    # Reference
    reference = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # Idempotency
    idempotency_key = Column(String(100), nullable=True, unique=True)
    
    # Extra data
    extra_data = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    escrow = relationship("Escrow", back_populates="ledger_entries")
    
    __table_args__ = (
        Index("idx_ledger_transaction", "transaction_id"),
        Index("idx_ledger_account", "account_id"),
        Index("idx_ledger_created", "created_at"),
    )

class AccountBalance(Base):
    """
    Current balance for each account.
    Updated atomically with ledger entries.
    """
    __tablename__ = "account_balances"
    
    id = Column(String(36), primary_key=True)
    account_id = Column(String(36), nullable=False, unique=True)
    account_type = Column(String(20), nullable=False)
    
    available_balance = Column(Float, default=0.0)
    pending_balance = Column(Float, default=0.0)  # In escrow
    total_balance = Column(Float, default=0.0)
    
    currency = Column(String(3), default="NGN")
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_balance_account", "account_id"),
    )

# ============================================
# Dispute Resolution
# ============================================

class Dispute(Base):
    __tablename__ = "disputes"
    
    id = Column(String(36), primary_key=True)
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=False)
    
    # Status
    status = Column(SQLEnum(DisputeStatus), default=DisputeStatus.OPEN, index=True)
    reason = Column(SQLEnum(DisputeReason), nullable=False)
    
    # Parties
    opened_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    opened_by_role = Column(String(20), nullable=False)  # buyer or seller
    
    # Description
    description = Column(Text, nullable=False)
    
    # Resolution
    resolution = Column(Text, nullable=True)
    resolution_type = Column(String(50), nullable=True)  # full_refund, partial_refund, release_to_seller, split
    resolution_amount_buyer = Column(Float, nullable=True)
    resolution_amount_seller = Column(Float, nullable=True)
    resolved_by = Column(String(36), nullable=True)  # Admin or system
    resolved_at = Column(DateTime, nullable=True)
    
    # Deadlines
    evidence_deadline = Column(DateTime, nullable=True)
    review_deadline = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    escrow = relationship("Escrow", back_populates="disputes")
    evidence = relationship("DisputeEvidence", back_populates="dispute")
    messages = relationship("DisputeMessage", back_populates="dispute")
    
    __table_args__ = (
        Index("idx_dispute_escrow", "escrow_id"),
        Index("idx_dispute_status", "status"),
    )

class DisputeEvidence(Base):
    __tablename__ = "dispute_evidence"
    
    id = Column(String(36), primary_key=True)
    dispute_id = Column(String(36), ForeignKey("disputes.id"), nullable=False)
    
    submitted_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    submitted_by_role = Column(String(20), nullable=False)
    
    evidence_type = Column(String(50), nullable=False)  # photo, video, document, screenshot, tracking
    file_url = Column(String(1000), nullable=True)
    description = Column(Text, nullable=True)
    
    # Verification
    verified = Column(Boolean, default=False)
    verification_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dispute = relationship("Dispute", back_populates="evidence")
    
    __table_args__ = (
        Index("idx_evidence_dispute", "dispute_id"),
    )

class DisputeMessage(Base):
    __tablename__ = "dispute_messages"
    
    id = Column(String(36), primary_key=True)
    dispute_id = Column(String(36), ForeignKey("disputes.id"), nullable=False)
    
    sender_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    sender_role = Column(String(20), nullable=False)  # buyer, seller, admin, system
    
    message = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dispute = relationship("Dispute", back_populates="messages")
    
    __table_args__ = (
        Index("idx_message_dispute", "dispute_id"),
    )

# ============================================
# Fraud Detection
# ============================================

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"
    
    id = Column(String(36), primary_key=True)
    
    # Target
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=True)
    
    # Alert details
    alert_type = Column(String(50), nullable=False)
    risk_level = Column(SQLEnum(FraudRiskLevel), nullable=False)
    risk_score = Column(Float, nullable=False)
    
    # Detection details
    detection_method = Column(String(50), nullable=False)  # rule, ml, manual
    detection_rule = Column(String(100), nullable=True)
    
    # Evidence
    evidence = Column(JSON, default=dict)
    description = Column(Text, nullable=True)
    
    # Resolution
    status = Column(String(20), default="open")  # open, investigating, resolved, false_positive
    resolved_by = Column(String(36), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Action taken
    action_taken = Column(String(50), nullable=True)  # none, block_transaction, suspend_user, require_kyc
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_fraud_user", "user_id"),
        Index("idx_fraud_escrow", "escrow_id"),
        Index("idx_fraud_status", "status"),
    )

class FraudPattern(Base):
    """Known fraud patterns for detection"""
    __tablename__ = "fraud_patterns"
    
    id = Column(String(36), primary_key=True)
    
    pattern_type = Column(String(50), nullable=False)  # fake_alert, impersonation, velocity, device
    pattern_name = Column(String(100), nullable=False)
    
    # Pattern definition
    pattern_config = Column(JSON, nullable=False)
    
    # Thresholds
    risk_score_contribution = Column(Float, default=0.0)
    auto_block = Column(Boolean, default=False)
    require_review = Column(Boolean, default=True)
    
    enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================
# Audit Log
# ============================================

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True)
    
    # Actor
    actor_id = Column(String(36), nullable=True)
    actor_type = Column(String(20), nullable=False)  # user, admin, system, webhook
    actor_ip = Column(String(45), nullable=True)
    
    # Action
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(36), nullable=True)
    
    # Details
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    extra_data = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index("idx_audit_actor", "actor_id"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_created", "created_at"),
    )

# ============================================
# Database initialization
# ============================================

async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    """Get database session"""
    async with async_session() as session:
        yield session
