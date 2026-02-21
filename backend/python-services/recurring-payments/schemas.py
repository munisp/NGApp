"""
Recurring Payments Schemas
Pydantic schemas for recurring payments
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class RecurringPaymentsBase(BaseModel):
    """Base schema for recurring payments"""
    # TODO: Add base fields
    pass

class RecurringPaymentsCreate(RecurringPaymentsBase):
    """Schema for creating recurring payments"""
    pass

class RecurringPaymentsUpdate(BaseModel):
    """Schema for updating recurring payments"""
    # TODO: Add update fields (all optional)
    pass

class RecurringPaymentsResponse(RecurringPaymentsBase):
    """Schema for recurring payments response"""
    id: str
    created_at: datetime
    updated_at: datetime
    status: str
    
    class Config:
        from_attributes = True
