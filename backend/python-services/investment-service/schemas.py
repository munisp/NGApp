"""
Investment Service Schemas
Pydantic schemas for investment service
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class InvestmentServiceBase(BaseModel):
    """Base schema for investment service"""
    # TODO: Add base fields
    pass

class InvestmentServiceCreate(InvestmentServiceBase):
    """Schema for creating investment service"""
    pass

class InvestmentServiceUpdate(BaseModel):
    """Schema for updating investment service"""
    # TODO: Add update fields (all optional)
    pass

class InvestmentServiceResponse(InvestmentServiceBase):
    """Schema for investment service response"""
    id: str
    created_at: datetime
    updated_at: datetime
    status: str
    
    class Config:
        from_attributes = True
