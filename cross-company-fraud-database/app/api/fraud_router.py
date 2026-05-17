"""
Fraud Records API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime

from app.models.fraud_record import FraudRecord, FraudAlert, FraudSeverity as DBFraudSeverity
from app.schemas.fraud_schemas import (
    FraudRecordCreate, FraudRecordUpdate, FraudRecordResponse,
    FraudCheckRequest, FraudCheckResponse
)
from app.services.database import get_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/report", response_model=FraudRecordResponse, status_code=201)
async def report_fraud(
    fraud_data: FraudRecordCreate,
    db: Session = Depends(get_db)
):
    """Report a new fraud case"""
    try:
        # Check if customer already has fraud records
        existing_records = db.query(FraudRecord).filter(
            FraudRecord.customer_nin == fraud_data.customer_nin
        ).all()
        
        fraud_count = len(existing_records) + 1
        
        # Calculate risk score based on fraud history
        risk_score = min(fraud_count * 20, 100)  # 20 points per fraud, max 100
        
        # Create new fraud record
        fraud_record = FraudRecord(
            **fraud_data.dict(),
            total_fraud_count=fraud_count,
            risk_score=risk_score
        )
        
        db.add(fraud_record)
        db.commit()
        db.refresh(fraud_record)
        
        # Create alerts for other companies if this is a repeat offender
        if fraud_count > 1:
            companies = db.query(FraudRecord.reporting_company_id).distinct().all()
            for (company_id,) in companies:
                if company_id != fraud_data.reporting_company_id:
                    alert = FraudAlert(
                        fraud_record_id=fraud_record.id,
                        target_company_id=company_id,
                        alert_type="REPEAT_OFFENDER",
                        severity=DBFraudSeverity[fraud_data.severity.value],
                        message=f"Customer {fraud_data.customer_name} (NIN: {fraud_data.customer_nin}) has {fraud_count} fraud records across companies"
                    )
                    db.add(alert)
            db.commit()
        
        logger.info(f"Fraud reported: {fraud_record.id} by {fraud_data.reporting_company_name}")
        return fraud_record
        
    except Exception as e:
        logger.error(f"Error reporting fraud: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to report fraud: {str(e)}")

@router.get("/check", response_model=FraudCheckResponse)
async def check_fraud(
    customer_nin: str,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Check if a customer has fraud records"""
    try:
        # Build query with multiple identifiers
        conditions = [FraudRecord.customer_nin == customer_nin]
        
        if customer_phone:
            conditions.append(FraudRecord.customer_phone == customer_phone)
        if customer_email:
            conditions.append(FraudRecord.customer_email == customer_email)
        
        records = db.query(FraudRecord).filter(or_(*conditions)).all()
        
        if not records:
            return FraudCheckResponse(
                is_flagged=False,
                fraud_count=0,
                total_claimed_amount=0.0,
                total_actual_loss=0.0,
                risk_score=0.0,
                risk_level="NONE",
                blacklisted=False,
                records=[]
            )
        
        # Calculate aggregates
        fraud_count = len(records)
        total_claimed = sum(r.claimed_amount for r in records)
        total_loss = sum(r.actual_loss for r in records)
        avg_risk_score = sum(r.risk_score for r in records) / fraud_count
        blacklisted = any(r.is_blacklisted for r in records)
        
        # Determine risk level
        if avg_risk_score >= 80:
            risk_level = "CRITICAL"
        elif avg_risk_score >= 60:
            risk_level = "HIGH"
        elif avg_risk_score >= 40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
        
        return FraudCheckResponse(
            is_flagged=True,
            fraud_count=fraud_count,
            total_claimed_amount=total_claimed,
            total_actual_loss=total_loss,
            risk_score=avg_risk_score,
            risk_level=risk_level,
            blacklisted=blacklisted,
            records=[FraudRecordResponse.from_orm(r) for r in records]
        )
        
    except Exception as e:
        logger.error(f"Error checking fraud: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check fraud: {str(e)}")

@router.get("/records", response_model=List[FraudRecordResponse])
async def list_fraud_records(
    skip: int = 0,
    limit: int = 100,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    company_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List fraud records with filters"""
    query = db.query(FraudRecord)
    
    if severity:
        query = query.filter(FraudRecord.severity == severity)
    if status:
        query = query.filter(FraudRecord.status == status)
    if company_id:
        query = query.filter(FraudRecord.reporting_company_id == company_id)
    
    records = query.offset(skip).limit(limit).all()
    return records

@router.get("/records/{record_id}", response_model=FraudRecordResponse)
async def get_fraud_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    """Get specific fraud record"""
    record = db.query(FraudRecord).filter(FraudRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Fraud record not found")
    return record

@router.patch("/records/{record_id}", response_model=FraudRecordResponse)
async def update_fraud_record(
    record_id: int,
    updates: FraudRecordUpdate,
    db: Session = Depends(get_db)
):
    """Update fraud record"""
    record = db.query(FraudRecord).filter(FraudRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Fraud record not found")
    
    update_data = updates.dict(exclude_unset=True)
    
    # Update confirmed_at timestamp if status changes to CONFIRMED
    if updates.status == "CONFIRMED" and not record.is_confirmed:
        update_data["confirmed_at"] = datetime.utcnow()
        update_data["is_confirmed"] = True
    
    for field, value in update_data.items():
        setattr(record, field, value)
    
    db.commit()
    db.refresh(record)
    
    logger.info(f"Fraud record updated: {record_id}")
    return record

@router.get("/blacklist", response_model=List[FraudRecordResponse])
async def get_blacklist(
    db: Session = Depends(get_db)
):
    """Get all blacklisted customers"""
    records = db.query(FraudRecord).filter(FraudRecord.is_blacklisted == True).all()
    return records

@router.post("/blacklist/{record_id}")
async def add_to_blacklist(
    record_id: int,
    db: Session = Depends(get_db)
):
    """Add customer to blacklist"""
    record = db.query(FraudRecord).filter(FraudRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Fraud record not found")
    
    record.is_blacklisted = True
    db.commit()
    
    # Create alerts for all companies
    companies = db.query(FraudRecord.reporting_company_id).distinct().all()
    for (company_id,) in companies:
        alert = FraudAlert(
            fraud_record_id=record.id,
            target_company_id=company_id,
            alert_type="BLACKLIST_ADDED",
            severity=record.severity,
            message=f"Customer {record.customer_name} (NIN: {record.customer_nin}) has been blacklisted"
        )
        db.add(alert)
    db.commit()
    
    logger.info(f"Customer blacklisted: {record.customer_nin}")
    return {"message": "Customer added to blacklist", "record_id": record_id}
