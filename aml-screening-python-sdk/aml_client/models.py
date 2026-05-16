"""Data models for AML Screening Service."""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class EntityType(str, Enum):
    """Entity type for screening."""
    INDIVIDUAL = "individual"
    ENTITY = "entity"


class RiskLevel(str, Enum):
    """Risk level classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ScreeningStatus(str, Enum):
    """Screening status."""
    PENDING = "pending"
    COMPLETED = "completed"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    REJECTED = "rejected"


class SanctionsList(str, Enum):
    """Sanctions list type."""
    UN = "UN"
    OFAC = "OFAC"
    EU = "EU"
    UK = "UK"


class PEPLevel(str, Enum):
    """PEP (Politically Exposed Person) level."""
    NOT_PEP = "not_pep"
    PEP_LEVEL_1 = "pep_level_1"  # Direct PEP
    PEP_LEVEL_2 = "pep_level_2"  # Family member
    PEP_LEVEL_3 = "pep_level_3"  # Close associate


class AdverseMediaType(str, Enum):
    """Type of adverse media."""
    FINANCIAL_CRIME = "financial_crime"
    CORRUPTION = "corruption"
    FRAUD = "fraud"
    MONEY_LAUNDERING = "money_laundering"
    TERRORISM = "terrorism"
    ORGANIZED_CRIME = "organized_crime"
    OTHER = "other"


# Request Models

class SanctionsScreeningRequest(BaseModel):
    """Request model for sanctions screening."""
    entity_type: EntityType = Field(..., description="Type of entity")
    name: str = Field(..., min_length=1, description="Entity name")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (for individuals)")
    nationality: Optional[str] = Field(None, description="Nationality")
    country: Optional[str] = Field(None, description="Country of residence/registration")
    identification_number: Optional[str] = Field(None, description="ID number (passport, NIN, etc.)")
    
    class Config:
        use_enum_values = True


class PEPCheckRequest(BaseModel):
    """Request model for PEP check."""
    name: str = Field(..., min_length=1, description="Individual name")
    date_of_birth: Optional[str] = Field(None, description="Date of birth")
    nationality: Optional[str] = Field(None, description="Nationality")
    position: Optional[str] = Field(None, description="Current/former position")
    
    class Config:
        use_enum_values = True


class AdverseMediaCheckRequest(BaseModel):
    """Request model for adverse media check."""
    entity_type: EntityType = Field(..., description="Type of entity")
    name: str = Field(..., min_length=1, description="Entity name")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (for individuals)")
    country: Optional[str] = Field(None, description="Country")
    comprehensive: bool = Field(False, description="Perform comprehensive search")
    
    class Config:
        use_enum_values = True


class ComprehensiveScreeningRequest(BaseModel):
    """Request model for comprehensive AML screening."""
    customer_id: str = Field(..., description="Customer ID")
    entity_type: EntityType = Field(..., description="Type of entity")
    name: str = Field(..., min_length=1, description="Entity name")
    date_of_birth: Optional[str] = Field(None, description="Date of birth")
    nationality: Optional[str] = Field(None, description="Nationality")
    country: Optional[str] = Field(None, description="Country")
    identification_number: Optional[str] = Field(None, description="ID number")
    
    class Config:
        use_enum_values = True


# Response Models

class SanctionsMatch(BaseModel):
    """Sanctions match details."""
    list_name: str = Field(..., description="Sanctions list name")
    match_name: str = Field(..., description="Matched name")
    match_score: float = Field(..., ge=0.0, le=1.0, description="Match score")
    date_of_birth: Optional[str] = Field(None, description="Date of birth")
    nationality: Optional[str] = Field(None, description="Nationality")
    aliases: List[str] = Field(default_factory=list, description="Known aliases")
    reason: str = Field(..., description="Reason for listing")
    listed_date: Optional[str] = Field(None, description="Date added to list")


class SanctionsScreeningResponse(BaseModel):
    """Response model for sanctions screening."""
    screening_id: str = Field(..., description="Unique screening ID")
    entity_type: str = Field(..., description="Type of entity")
    name: str = Field(..., description="Entity name")
    matches_found: bool = Field(..., description="Whether matches were found")
    total_matches: int = Field(..., ge=0, description="Total number of matches")
    matches: List[SanctionsMatch] = Field(default_factory=list, description="List of matches")
    risk_level: RiskLevel = Field(..., description="Overall risk level")
    screened_at: datetime = Field(..., description="Timestamp of screening")
    screened_by: str = Field(..., description="User who performed screening")


class PEPMatch(BaseModel):
    """PEP match details."""
    name: str = Field(..., description="Matched name")
    match_score: float = Field(..., ge=0.0, le=1.0, description="Match score")
    pep_level: PEPLevel = Field(..., description="PEP level")
    position: str = Field(..., description="Position/role")
    country: str = Field(..., description="Country")
    start_date: Optional[str] = Field(None, description="Start date of position")
    end_date: Optional[str] = Field(None, description="End date of position")
    is_current: bool = Field(..., description="Whether position is current")
    source: str = Field(..., description="Information source")


class PEPCheckResponse(BaseModel):
    """Response model for PEP check."""
    check_id: str = Field(..., description="Unique check ID")
    name: str = Field(..., description="Individual name")
    is_pep: bool = Field(..., description="Whether individual is a PEP")
    pep_level: Optional[PEPLevel] = Field(None, description="PEP level if applicable")
    matches: List[PEPMatch] = Field(default_factory=list, description="List of PEP matches")
    risk_level: RiskLevel = Field(..., description="Risk level")
    checked_at: datetime = Field(..., description="Timestamp of check")
    checked_by: str = Field(..., description="User who performed check")


class AdverseMediaMention(BaseModel):
    """Adverse media mention details."""
    title: str = Field(..., description="Article/mention title")
    source: str = Field(..., description="Media source")
    published_date: str = Field(..., description="Publication date")
    url: Optional[str] = Field(None, description="URL to article")
    snippet: str = Field(..., description="Relevant snippet")
    media_type: AdverseMediaType = Field(..., description="Type of adverse media")
    severity: str = Field(..., description="Severity level (low/medium/high)")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Relevance score")


class AdverseMediaCheckResponse(BaseModel):
    """Response model for adverse media check."""
    check_id: str = Field(..., description="Unique check ID")
    entity_type: str = Field(..., description="Type of entity")
    name: str = Field(..., description="Entity name")
    mentions_found: bool = Field(..., description="Whether mentions were found")
    total_mentions: int = Field(..., ge=0, description="Total number of mentions")
    mentions: List[AdverseMediaMention] = Field(default_factory=list, description="List of mentions")
    risk_level: RiskLevel = Field(..., description="Overall risk level")
    checked_at: datetime = Field(..., description="Timestamp of check")
    checked_by: str = Field(..., description="User who performed check")


class ComprehensiveScreeningResponse(BaseModel):
    """Response model for comprehensive AML screening."""
    screening_id: str = Field(..., description="Unique screening ID")
    customer_id: str = Field(..., description="Customer ID")
    entity_type: str = Field(..., description="Type of entity")
    name: str = Field(..., description="Entity name")
    
    # Sanctions screening results
    sanctions_matches: int = Field(..., ge=0, description="Number of sanctions matches")
    sanctions_risk: RiskLevel = Field(..., description="Sanctions risk level")
    
    # PEP check results
    is_pep: bool = Field(..., description="Whether entity is a PEP")
    pep_level: Optional[PEPLevel] = Field(None, description="PEP level if applicable")
    pep_risk: RiskLevel = Field(..., description="PEP risk level")
    
    # Adverse media results
    adverse_media_mentions: int = Field(..., ge=0, description="Number of adverse media mentions")
    adverse_media_risk: RiskLevel = Field(..., description="Adverse media risk level")
    
    # Overall assessment
    overall_risk_level: RiskLevel = Field(..., description="Overall risk level")
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Overall risk score")
    recommendation: str = Field(..., description="Recommendation (approve/review/reject)")
    status: ScreeningStatus = Field(..., description="Screening status")
    
    screened_at: datetime = Field(..., description="Timestamp of screening")
    screened_by: str = Field(..., description="User who performed screening")
    notes: Optional[str] = Field(None, description="Additional notes")


class ScreeningListResponse(BaseModel):
    """Response model for list of screenings."""
    screenings: List[ComprehensiveScreeningResponse] = Field(..., description="List of screenings")
    total: int = Field(..., description="Total number of screenings")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(..., description="Offset for pagination")


class HealthCheckResponse(BaseModel):
    """Response model for health check."""
    status: str = Field(..., description="Service health status")
    timestamp: Optional[datetime] = Field(None, description="Timestamp of health check")
    version: Optional[str] = Field(None, description="Service version")


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
