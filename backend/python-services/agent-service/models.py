import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Enum, Float, Boolean, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

# --- SQLAlchemy Base and Model Definitions ---

Base = declarative_base()

class AgentStatus(enum.Enum):
    """Status of an agent."""
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class KYCStatus(enum.Enum):
    """Status of Know Your Customer (KYC) verification."""
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"

class Agent(Base):
    """
    SQLAlchemy model for an Agent.
    Includes hierarchy (manager_id), basic info, and KYC status.
    """
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True, nullable=False)
    last_name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, nullable=True)
    
    status = Column(Enum(AgentStatus), default=AgentStatus.ONBOARDING, nullable=False)
    kyc_status = Column(Enum(KYCStatus), default=KYCStatus.PENDING, nullable=False)
    
    # Hierarchy
    manager_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    manager = relationship("Agent", remote_side=[id], backref="subordinates")

    # Relationships
    kyc_records = relationship("KYCRecord", back_populates="agent", cascade="all, delete-orphan")
    performance_metrics = relationship("PerformanceMetric", back_populates="agent", cascade="all, delete-orphan")
    territory_assignments = relationship("TerritoryAssignment", back_populates="agent", cascade="all, delete-orphan")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class KYCRecord(Base):
    """
    SQLAlchemy model for KYC (Know Your Customer) records.
    Stores details about the verification process.
    """
    __tablename__ = "kyc_records"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    document_type = Column(String, nullable=False) # e.g., 'Passport', 'Driver_License'
    document_number = Column(String, nullable=False)
    verification_date = Column(DateTime, server_default=func.now())
    expiry_date = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_details = Column(Text, nullable=True) # JSON or text field for detailed results

    agent = relationship("Agent", back_populates="kyc_records")

    __table_args__ = (
        UniqueConstraint('agent_id', 'document_type', name='_agent_document_uc'),
    )

class PerformanceMetric(Base):
    """
    SQLAlchemy model for Agent Performance Tracking.
    Stores periodic or transactional performance data.
    """
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    metric_date = Column(DateTime, index=True, nullable=False)
    sales_volume = Column(Float, default=0.0, nullable=False)
    customer_satisfaction_score = Column(Float, default=0.0, nullable=False)
    leads_converted = Column(Integer, default=0, nullable=False)
    
    agent = relationship("Agent", back_populates="performance_metrics")

    __table_args__ = (
        UniqueConstraint('agent_id', 'metric_date', name='_agent_metric_date_uc'),
    )

class Territory(Base):
    """
    SQLAlchemy model for a geographical Territory.
    """
    __tablename__ = "territories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    region = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    assignments = relationship("TerritoryAssignment", back_populates="territory", cascade="all, delete-orphan")

class TerritoryAssignment(Base):
    """
    SQLAlchemy model for assigning an Agent to a Territory.
    Allows for many-to-many relationship with additional data (e.g., start/end date).
    """
    __tablename__ = "territory_assignments"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=False)
    
    start_date = Column(DateTime, server_default=func.now())
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    agent = relationship("Agent", back_populates="territory_assignments")
    territory = relationship("Territory", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint('agent_id', 'territory_id', name='_agent_territory_uc'),
    )

# --- Pydantic Schemas (DTOs) ---

# Base Schemas for common fields
class AgentBase(BaseModel):
    first_name: str = Field(..., example="Jane")
    last_name: str = Field(..., example="Doe")
    email: str = Field(..., example="jane.doe@example.com")
    phone_number: Optional[str] = Field(None, example="+15551234567")
    manager_id: Optional[int] = Field(None, example=1)

class AgentCreate(AgentBase):
    """Schema for creating a new Agent."""
    pass

class AgentUpdate(AgentBase):
    """Schema for updating an existing Agent."""
    status: Optional[AgentStatus] = Field(None, example=AgentStatus.ACTIVE)
    kyc_status: Optional[KYCStatus] = Field(None, example=KYCStatus.VERIFIED)
    
    # Override fields to be optional for update
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None

class AgentInDB(AgentBase):
    """Base schema for Agent data retrieved from DB."""
    id: int
    status: AgentStatus
    kyc_status: KYCStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# KYC Schemas
class KYCRecordBase(BaseModel):
    document_type: str = Field(..., example="Passport")
    document_number: str = Field(..., example="A1234567")
    expiry_date: Optional[datetime] = Field(None, example="2028-12-31T00:00:00")
    verification_details: Optional[str] = Field(None, example="OCR successful, face match 99%")

class KYCRecordCreate(KYCRecordBase):
    """Schema for creating a new KYC record."""
    pass

class KYCRecordInDB(KYCRecordBase):
    """Schema for KYC record data retrieved from DB."""
    id: int
    agent_id: int
    verification_date: datetime
    is_verified: bool

    class Config:
        from_attributes = True

# Performance Schemas
class PerformanceMetricBase(BaseModel):
    metric_date: datetime = Field(..., example="2025-10-01T00:00:00")
    sales_volume: float = Field(..., example=15000.50)
    customer_satisfaction_score: float = Field(..., example=4.7)
    leads_converted: int = Field(..., example=15)

class PerformanceMetricCreate(PerformanceMetricBase):
    """Schema for creating a new Performance Metric."""
    pass

class PerformanceMetricInDB(PerformanceMetricBase):
    """Schema for Performance Metric data retrieved from DB."""
    id: int
    agent_id: int

    class Config:
        from_attributes = True

# Territory Schemas
class TerritoryBase(BaseModel):
    name: str = Field(..., example="North-East Region")
    region: str = Field(..., example="USA")
    description: Optional[str] = Field(None, example="Covers all states north of Virginia and east of Ohio.")

class TerritoryCreate(TerritoryBase):
    """Schema for creating a new Territory."""
    pass

class TerritoryInDB(TerritoryBase):
    """Schema for Territory data retrieved from DB."""
    id: int

    class Config:
        from_attributes = True

# Territory Assignment Schemas
class TerritoryAssignmentBase(BaseModel):
    territory_id: int = Field(..., example=1)
    start_date: Optional[datetime] = Field(None, example="2025-01-01T00:00:00")
    end_date: Optional[datetime] = Field(None, example="2025-12-31T00:00:00")
    is_active: bool = Field(True, example=True)

class TerritoryAssignmentCreate(TerritoryAssignmentBase):
    """Schema for creating a new Territory Assignment."""
    pass

class TerritoryAssignmentInDB(TerritoryAssignmentBase):
    """Schema for Territory Assignment data retrieved from DB."""
    id: int
    agent_id: int
    
    class Config:
        from_attributes = True

# Full Agent Response Schema (includes relationships)
class AgentResponse(AgentInDB):
    """Full response schema for an Agent, including related data."""
    manager: Optional["AgentInDB"] = None
    subordinates: List["AgentInDB"] = []
    kyc_records: List[KYCRecordInDB] = []
    performance_metrics: List[PerformanceMetricInDB] = []
    territory_assignments: List[TerritoryAssignmentInDB] = []

# Update forward references for recursive models
AgentResponse.model_rebuild()
AgentInDB.model_rebuild()
