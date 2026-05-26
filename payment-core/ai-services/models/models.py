#!/usr/bin/env python3
"""
Data Models for AI Telephony Service
"""

from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field

class Customer(BaseModel):
    """Customer model"""
    id: str
    name: str
    phone_number: str
    email: Optional[str] = None
    preferred_language: Optional[str] = None
    usual_locations: List[str] = Field(default_factory=list)
    risk_profile: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Transaction(BaseModel):
    """Transaction model"""
    id: str
    customer_id: str
    amount: float
    currency: str
    merchant: str
    location: str
    timestamp: datetime
    channel: str
    status: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class FraudCase(BaseModel):
    """Fraud case model"""
    id: str
    customer_id: str
    transaction_id: str
    risk_score: float
    triggered_rules: List[str] = Field(default_factory=list)
    status: str
    action: str
    verification_result: Optional[str] = None
    resolution: Optional[str] = None
    call_id: Optional[str] = None
    call_duration: Optional[int] = None
    call_recording_url: Optional[str] = None
    investigation_case_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class VerificationCall(BaseModel):
    """Verification call model"""
    id: str
    fraud_case_id: str
    customer_id: str
    phone_number: str
    status: str
    direction: str
    language: str
    conversation_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    recording_url: Optional[str] = None
    result: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CallSession(BaseModel):
    """Call session model"""
    id: str
    call_id: str
    conversation_id: str
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ConversationState(BaseModel):
    """Conversation state model"""
    id: str
    type: str
    language: str
    context: Dict[str, Any] = Field(default_factory=dict)
    messages: List[Dict[str, str]] = Field(default_factory=list)
    current_step: str
    verification_result: Optional[str] = None
    entities: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class FraudInvestigation(BaseModel):
    """Fraud investigation model"""
    id: str
    fraud_case_id: str
    customer_id: str
    transaction_id: str
    status: str
    priority: str
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class TransactionReview(BaseModel):
    """Transaction review model"""
    id: str
    fraud_case_id: str
    customer_id: str
    transaction_id: str
    status: str
    priority: str
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class MLPrediction(BaseModel):
    """ML prediction model"""
    id: str
    model_id: str
    transaction_id: str
    prediction: bool
    probability: float
    features: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class FraudDetectionRule(BaseModel):
    """Fraud detection rule model"""
    id: str
    name: str
    description: str
    condition: str
    enabled: bool
    risk_score: float
    weight: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

