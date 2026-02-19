import uuid
import datetime
from typing import List, Optional, Any

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped
from pydantic import BaseModel, Field, ConfigDict

from .config import Base

# --- SQLAlchemy Models ---

class AgentTraining(Base):
    """
    SQLAlchemy model for an Agent Training session.
    """
    __tablename__ = "agent_training"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    training_name: Mapped[str] = Column(String(255), nullable=False, index=True)
    status: Mapped[str] = Column(String(50), nullable=False, default="PENDING", index=True)
    start_time: Mapped[Optional[datetime.datetime]] = Column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime.datetime]] = Column(DateTime, nullable=True)
    configuration: Mapped[dict] = Column(JSONB, nullable=False)
    metrics: Mapped[Optional[dict]] = Column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    logs: Mapped[List["AgentTrainingLog"]] = relationship("AgentTrainingLog", back_populates="training", cascade="all, delete-orphan")

    __table_args__ = (
        # Example of a composite index if needed, but simple indexes are sufficient for now
        # Index("idx_agent_training_agent_status", "agent_id", "status"),
    )

class AgentTrainingLog(Base):
    """
    SQLAlchemy model for logging events during an Agent Training session.
    """
    __tablename__ = "agent_training_log"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    training_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("agent_training.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp: Mapped[datetime.datetime] = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    level: Mapped[str] = Column(String(20), nullable=False) # e.g., INFO, WARNING, ERROR
    message: Mapped[str] = Column(Text, nullable=False)
    details: Mapped[Optional[dict]] = Column(JSONB, nullable=True)

    # Relationships
    training: Mapped["AgentTraining"] = relationship("AgentTraining", back_populates="logs")

# --- Pydantic Schemas ---

# Base Schemas
class AgentTrainingBase(BaseModel):
    """Base schema for AgentTraining."""
    agent_id: uuid.UUID = Field(..., description="ID of the agent being trained.")
    training_name: str = Field(..., max_length=255, description="A human-readable name for the training session.")
    configuration: dict[str, Any] = Field(..., description="JSON configuration for the training run (e.g., hyperparameters, dataset path).")

class AgentTrainingLogBase(BaseModel):
    """Base schema for AgentTrainingLog."""
    level: str = Field(..., max_length=20, description="Log level (e.g., 'INFO', 'WARNING', 'ERROR').")
    message: str = Field(..., description="The log message content.")
    details: Optional[dict[str, Any]] = Field(None, description="Optional JSON details for the log entry.")

# Create Schemas
class AgentTrainingCreate(AgentTrainingBase):
    """Schema for creating a new AgentTraining session."""
    pass

class AgentTrainingLogCreate(AgentTrainingLogBase):
    """Schema for creating a new AgentTrainingLog entry."""
    training_id: uuid.UUID = Field(..., description="ID of the associated training session.")

# Update Schemas
class AgentTrainingUpdate(BaseModel):
    """Schema for updating an existing AgentTraining session."""
    training_name: Optional[str] = Field(None, max_length=255, description="A human-readable name for the training session.")
    status: Optional[str] = Field(None, max_length=50, description="Current status of the training.")
    start_time: Optional[datetime.datetime] = Field(None, description="Timestamp when the training started.")
    end_time: Optional[datetime.datetime] = Field(None, description="Timestamp when the training finished.")
    configuration: Optional[dict[str, Any]] = Field(None, description="JSON configuration for the training run.")
    metrics: Optional[dict[str, Any]] = Field(None, description="JSON object storing final training metrics.")

# Response Schemas
class AgentTrainingLogResponse(AgentTrainingLogBase):
    """Response schema for an AgentTrainingLog entry."""
    id: uuid.UUID
    training_id: uuid.UUID
    timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class AgentTrainingResponse(AgentTrainingBase):
    """Response schema for an AgentTraining session."""
    id: uuid.UUID
    status: str
    start_time: Optional[datetime.datetime]
    end_time: Optional[datetime.datetime]
    metrics: Optional[dict[str, Any]]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    
    # Nested relationship response
    logs: List[AgentTrainingLogResponse] = Field(default_factory=list, description="List of log entries for this training session.")

    model_config = ConfigDict(from_attributes=True)

# Schema for listing training sessions (lighter response)
class AgentTrainingListResponse(BaseModel):
    """Schema for listing AgentTraining sessions (without logs)."""
    id: uuid.UUID
    agent_id: uuid.UUID
    training_name: str
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
