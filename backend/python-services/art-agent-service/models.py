import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func, Enum, Text, Index
from sqlalchemy.orm import relationship, Mapped, declarative_base

# --- SQLAlchemy Base and Utility ---

Base = declarative_base()

def create_all_tables(engine):
    """Creates all tables defined in Base metadata."""
    Base.metadata.create_all(bind=engine)

# --- Enums ---

class AgentStatus(enum.Enum):
    """Possible statuses for an ArtAgent."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    DELETED = "deleted"

class ActivityAction(enum.Enum):
    """Possible actions for an ArtAgentActivityLog."""
    CREATED = "created"
    UPDATED = "updated"
    GENERATED_ART = "generated_art"
    FAILED_GENERATION = "failed_generation"
    DELETED = "deleted"

# --- SQLAlchemy Models ---

class ArtAgent(Base):
    """
    Represents an Art Agent, a service entity responsible for art generation.
    """
    __tablename__ = "art_agents"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    name: Mapped[str] = Column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = Column(Text, nullable=True)
    model_version: Mapped[str] = Column(String(50), nullable=False, default="v1.0")
    status: Mapped[AgentStatus] = Column(Enum(AgentStatus), nullable=False, default=AgentStatus.ACTIVE)
    is_public: Mapped[bool] = Column(Boolean, default=False)
    
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    activity_logs: Mapped[List["ArtAgentActivityLog"]] = relationship(
        "ArtAgentActivityLog", 
        back_populates="agent", 
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_art_agents_status_public", status, is_public),
    )

class ArtAgentActivityLog(Base):
    """
    Represents an activity log entry for an Art Agent.
    """
    __tablename__ = "art_agent_activity_logs"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = Column(Integer, ForeignKey("art_agents.id"), nullable=False)
    action: Mapped[ActivityAction] = Column(Enum(ActivityAction), nullable=False)
    details: Mapped[str] = Column(Text, nullable=True)
    timestamp: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    agent: Mapped["ArtAgent"] = relationship("ArtAgent", back_populates="activity_logs")

    __table_args__ = (
        Index("ix_activity_log_agent_action", agent_id, action),
    )

# --- Pydantic Schemas ---

# Base Schemas
class ArtAgentBase(BaseModel):
    """Base schema for ArtAgent, containing common fields."""
    name: str = Field(..., max_length=100, description="The name of the art agent.")
    description: Optional[str] = Field(None, description="A detailed description of the agent's capabilities.")
    model_version: str = Field("v1.0", max_length=50, description="The underlying model version used by the agent.")
    status: AgentStatus = Field(AgentStatus.ACTIVE, description="The current operational status of the agent.")
    is_public: bool = Field(False, description="Whether the agent is publicly accessible.")

    class Config:
        use_enum_values = True
        from_attributes = True

class ArtAgentActivityLogBase(BaseModel):
    """Base schema for ArtAgentActivityLog."""
    agent_id: int = Field(..., description="The ID of the agent associated with the activity.")
    action: ActivityAction = Field(..., description="The type of action performed.")
    details: Optional[str] = Field(None, description="Additional details about the activity.")

    class Config:
        use_enum_values = True
        from_attributes = True

# Create Schemas
class ArtAgentCreate(ArtAgentBase):
    """Schema for creating a new ArtAgent."""
    pass

class ArtAgentActivityLogCreate(ArtAgentActivityLogBase):
    """Schema for creating a new ArtAgentActivityLog entry."""
    pass

# Update Schemas
class ArtAgentUpdate(ArtAgentBase):
    """Schema for updating an existing ArtAgent. All fields are optional."""
    name: Optional[str] = Field(None, max_length=100, description="The name of the art agent.")
    status: Optional[AgentStatus] = Field(None, description="The current operational status of the agent.")
    model_version: Optional[str] = Field(None, max_length=50, description="The underlying model version used by the agent.")
    is_public: Optional[bool] = Field(None, description="Whether the agent is publicly accessible.")

# Response Schemas
class ArtAgentResponse(ArtAgentBase):
    """Schema for returning an ArtAgent object."""
    id: int = Field(..., description="The unique identifier of the agent.")
    created_at: datetime = Field(..., description="Timestamp of when the agent was created.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp of the last update.")
    
    # Nested relationship schema for logs (optional in response)
    activity_logs: List["ArtAgentActivityLogResponse"] = Field([], description="List of recent activity logs for the agent.")

class ArtAgentActivityLogResponse(ArtAgentActivityLogBase):
    """Schema for returning an ArtAgentActivityLog object."""
    id: int = Field(..., description="The unique identifier of the log entry.")
    timestamp: datetime = Field(..., description="Timestamp of the activity.")

# Update forward references for nested schemas
ArtAgentResponse.model_rebuild()
