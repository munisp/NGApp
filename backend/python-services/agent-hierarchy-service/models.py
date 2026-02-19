from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

# Define the base class for declarative class definitions
Base = declarative_base()

# --- SQLAlchemy Models ---

class AgentHierarchy(Base):
    """
    SQLAlchemy model for the main Agent Hierarchy structure.
    Represents a node in the hierarchy, which is an agent.
    """
    __tablename__ = "agent_hierarchy"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    
    # Core Agent Information
    agent_id = Column(PG_UUID(as_uuid=True), nullable=False, unique=True, index=True, comment="The unique ID of the agent this node represents.")
    name = Column(String(255), nullable=False, comment="A human-readable name for the agent.")
    
    # Hierarchy Information
    parent_id = Column(PG_UUID(as_uuid=True), ForeignKey("agent_hierarchy.id", ondelete="SET NULL"), nullable=True, index=True, comment="The ID of the parent agent in the hierarchy.")
    level = Column(String(50), nullable=False, comment="The hierarchical level or role of the agent (e.g., 'Team Lead', 'Manager', 'Individual Contributor').")
    
    # Metadata
    is_active = Column(Boolean, default=True, nullable=False, comment="Flag to indicate if the agent is currently active in the hierarchy.")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    parent = relationship("AgentHierarchy", remote_side=[id], backref="children")
    
    # Activity Log relationship
    activity_logs = relationship("AgentHierarchyActivityLog", back_populates="agent_node", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_agent_hierarchy_level", level),
        # Constraint to ensure an agent_id is unique
        # UniqueConstraint('agent_id', name='uq_agent_hierarchy_agent_id') # Already covered by unique=True on agent_id
    )

class AgentHierarchyActivityLog(Base):
    """
    SQLAlchemy model for logging activities related to the Agent Hierarchy.
    """
    __tablename__ = "agent_hierarchy_activity_log"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    
    # Foreign Key to the AgentHierarchy node
    agent_hierarchy_id = Column(PG_UUID(as_uuid=True), ForeignKey("agent_hierarchy.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Log details
    action = Column(String(100), nullable=False, comment="The action performed (e.g., 'CREATE', 'UPDATE_PARENT', 'DEACTIVATE').")
    details = Column(Text, nullable=True, comment="Detailed description of the change, possibly including old and new values.")
    performed_by = Column(String(255), nullable=True, comment="Identifier of the user or system that performed the action.")
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    agent_node = relationship("AgentHierarchy", back_populates="activity_logs")

    __table_args__ = (
        Index("idx_activity_log_action", action),
    )

# --- Pydantic Schemas ---

# Base Schema for common fields
class AgentHierarchyBase(BaseModel):
    """Base Pydantic schema for AgentHierarchy."""
    agent_id: UUID = Field(..., description="The unique ID of the agent this node represents.")
    name: str = Field(..., max_length=255, description="A human-readable name for the agent.")
    parent_id: Optional[UUID] = Field(None, description="The ID of the parent agent in the hierarchy.")
    level: str = Field(..., max_length=50, description="The hierarchical level or role of the agent.")
    is_active: bool = Field(True, description="Flag to indicate if the agent is currently active.")

# Schema for creating a new agent node
class AgentHierarchyCreate(AgentHierarchyBase):
    """Pydantic schema for creating a new AgentHierarchy node."""
    pass

# Schema for updating an existing agent node
class AgentHierarchyUpdate(AgentHierarchyBase):
    """Pydantic schema for updating an existing AgentHierarchy node."""
    agent_id: Optional[UUID] = Field(None, description="The unique ID of the agent (optional for update).")
    name: Optional[str] = Field(None, max_length=255, description="A human-readable name for the agent (optional for update).")
    level: Optional[str] = Field(None, max_length=50, description="The hierarchical level or role of the agent (optional for update).")
    is_active: Optional[bool] = Field(None, description="Flag to indicate if the agent is currently active (optional for update).")

# Schema for AgentHierarchyActivityLog response
class AgentHierarchyActivityLogResponse(BaseModel):
    """Pydantic schema for responding with an AgentHierarchyActivityLog entry."""
    id: UUID
    agent_hierarchy_id: UUID
    action: str
    details: Optional[str]
    performed_by: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

# Schema for AgentHierarchy response
class AgentHierarchyResponse(AgentHierarchyBase):
    """Pydantic schema for responding with an AgentHierarchy node."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Nested children relationship (optional for a simple response, but useful for full hierarchy retrieval)
    # children: List["AgentHierarchyResponse"] = [] # Self-referencing is complex, omit for simple CRUD response
    
    class Config:
        from_attributes = True

# Forward reference for self-referencing model (needed if children were included)
# AgentHierarchyResponse.model_rebuild()

# Schema for a full response including activity logs
class AgentHierarchyFullResponse(AgentHierarchyResponse):
    """Pydantic schema for a full response including activity logs."""
    activity_logs: List[AgentHierarchyActivityLogResponse] = Field(default_factory=list)

# Schema for a simplified response without nested data, for list views
class AgentHierarchyListResponse(BaseModel):
    """Pydantic schema for a list view of AgentHierarchy nodes."""
    id: UUID
    agent_id: UUID
    name: str
    parent_id: Optional[UUID]
    level: str
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True
