"""
Pydantic schemas for fraud records
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class FraudSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class FraudStatus(str, Enum):
    SUSPECTED = "SUSPECTED"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"

class FraudRecordCreate(BaseModel):
    customer_nin: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    customer_address: Optional[str] = None
    reporting_company_id: str
    reporting_company_name: str
    fraud_type: str
    fraud_category: str
    severity: FraudSeverity = FraudSeverity.MEDIUM
    status: FraudStatus = FraudStatus.SUSPECTED
    claimed_amount: float = 0.0
    actual_loss: float = 0.0
    policy_number: Optional[str] = None
    claim_number: Optional[str] = None
    incident_date: Optional[datetime] = None
    description: str
    evidence_urls: Optional[str] = None
    investigation_notes: Optional[str] = None

class FraudRecordUpdate(BaseModel):
    status: Optional[FraudStatus] = None
    severity: Optional[FraudSeverity] = None
    actual_loss: Optional[float] = None
    investigation_notes: Optional[str] = None
    is_confirmed: Optional[bool] = None
    is_prosecuted: Optional[bool] = None
    is_blacklisted: Optional[bool] = None

class FraudRecordResponse(BaseModel):
    id: int
    customer_nin: str
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    reporting_company_id: str
    reporting_company_name: str
    fraud_type: str
    fraud_category: str
    severity: FraudSeverity
    status: FraudStatus
    claimed_amount: float
    actual_loss: float
    policy_number: Optional[str]
    claim_number: Optional[str]
    incident_date: Optional[datetime]
    description: str
    is_confirmed: bool
    is_blacklisted: bool
    reported_at: datetime
    total_fraud_count: int
    risk_score: float

    class Config:
        from_attributes = True

class FraudCheckRequest(BaseModel):
    customer_nin: str
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None

class FraudCheckResponse(BaseModel):
    is_flagged: bool
    fraud_count: int
    total_claimed_amount: float
    total_actual_loss: float
    risk_score: float
    risk_level: str
    blacklisted: bool
    records: List[FraudRecordResponse]

class CompanyStats(BaseModel):
    company_id: str
    company_name: str
    total_reports: int
    confirmed_frauds: int
    total_loss: float
    avg_risk_score: float

class IndustryStats(BaseModel):
    total_fraud_records: int
    confirmed_frauds: int
    suspected_frauds: int
    under_investigation: int
    total_claimed_amount: float
    total_actual_loss: float
    blacklisted_customers: int
    participating_companies: int
    top_fraud_types: List[dict]
