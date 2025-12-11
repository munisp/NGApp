"""
Transaction Service Database Models
"""

from sqlalchemy import Column, String, Numeric, DateTime, Enum as SQLEnum, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

class TransactionType(enum.Enum):
    TRANSFER = "transfer"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    PAYMENT = "payment"
    REFUND = "refund"
    FEE = "fee"

class TransactionStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class Transaction(Base):
    __tablename__ = "transactions"
    
    transaction_id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    type = Column(SQLEnum(TransactionType), nullable=False, index=True)
    status = Column(SQLEnum(TransactionStatus), nullable=False, index=True)
    
    source_account = Column(String(50), nullable=False, index=True)
    destination_account = Column(String(50), nullable=True, index=True)
    
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    
    fee = Column(Numeric(20, 2), nullable=False, default=0)
    total_amount = Column(Numeric(20, 2), nullable=False)
    
    description = Column(String(500), nullable=False)
    reference_number = Column(String(50), unique=True, nullable=False, index=True)
    
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    
    metadata = Column(JSON, nullable=True)
    error_message = Column(String(1000), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_user_status', 'user_id', 'status'),
        Index('idx_user_created', 'user_id', 'created_at'),
        Index('idx_status_created', 'status', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Transaction(id={self.transaction_id}, type={self.type.value}, status={self.status.value}, amount={self.amount} {self.currency})>"

class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    
    idempotency_key = Column(String(100), primary_key=True, index=True)
    transaction_id = Column(String(36), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    
    def __repr__(self):
        return f"<IdempotencyRecord(key={self.idempotency_key}, txn={self.transaction_id})>"
