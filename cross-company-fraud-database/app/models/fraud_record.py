"""
Fraud Record Database Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class FraudSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class FraudStatus(str, enum.Enum):
    SUSPECTED = "SUSPECTED"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"

class FraudRecord(Base):
    """Cross-company fraud record"""
    __tablename__ = "fraud_records"

    id = Column(Integer, primary_key=True, index=True)
    
    # Customer identification
    customer_nin = Column(String(11), index=True, nullable=False)  # National ID Number
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20), index=True)
    customer_email = Column(String(320), index=True)
    customer_address = Column(Text)
    
    # Reporting company
    reporting_company_id = Column(String(50), index=True, nullable=False)
    reporting_company_name = Column(String(255), nullable=False)
    
    # Fraud details
    fraud_type = Column(String(100), nullable=False)  # e.g., "Multiple Claims", "Identity Fraud", "Staged Accident"
    fraud_category = Column(String(50), nullable=False)  # e.g., "Claim", "Policy", "Identity"
    severity = Column(Enum(FraudSeverity), default=FraudSeverity.MEDIUM, nullable=False)
    status = Column(Enum(FraudStatus), default=FraudStatus.SUSPECTED, nullable=False)
    
    # Financial impact
    claimed_amount = Column(Float, default=0.0)
    actual_loss = Column(Float, default=0.0)
    
    # Related entities
    policy_number = Column(String(100))
    claim_number = Column(String(100))
    incident_date = Column(DateTime)
    
    # Evidence and description
    description = Column(Text, nullable=False)
    evidence_urls = Column(Text)  # JSON array of URLs
    investigation_notes = Column(Text)
    
    # Flags
    is_confirmed = Column(Boolean, default=False)
    is_prosecuted = Column(Boolean, default=False)
    is_blacklisted = Column(Boolean, default=False)
    
    # Timestamps
    reported_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Cross-company tracking
    related_records = Column(Text)  # JSON array of related fraud record IDs from other companies
    total_fraud_count = Column(Integer, default=1)  # Number of fraud incidents across all companies
    
    # Risk score (0-100)
    risk_score = Column(Float, default=0.0)

class Company(Base):
    """Participating insurance company"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(String(50), unique=True, index=True, nullable=False)
    company_name = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=False)
    contact_email = Column(String(320))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_sync_at = Column(DateTime)

class FraudAlert(Base):
    """Real-time fraud alerts sent to companies"""
    __tablename__ = "fraud_alerts"

    id = Column(Integer, primary_key=True, index=True)
    fraud_record_id = Column(Integer, index=True, nullable=False)
    target_company_id = Column(String(50), index=True, nullable=False)
    alert_type = Column(String(50), nullable=False)  # e.g., "NEW_FRAUD", "UPDATED_FRAUD", "BLACKLIST_ADDED"
    severity = Column(Enum(FraudSeverity), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
