"""
Analytics API Router
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.models.fraud_record import FraudRecord, Company
from app.schemas.fraud_schemas import CompanyStats, IndustryStats
from app.services.database import get_db

router = APIRouter()

@router.get("/industry", response_model=IndustryStats)
async def get_industry_stats(db: Session = Depends(get_db)):
    """Get industry-wide fraud statistics"""
    
    total_records = db.query(func.count(FraudRecord.id)).scalar()
    confirmed = db.query(func.count(FraudRecord.id)).filter(FraudRecord.is_confirmed == True).scalar()
    suspected = db.query(func.count(FraudRecord.id)).filter(FraudRecord.status == "SUSPECTED").scalar()
    investigating = db.query(func.count(FraudRecord.id)).filter(FraudRecord.status == "UNDER_INVESTIGATION").scalar()
    
    total_claimed = db.query(func.sum(FraudRecord.claimed_amount)).scalar() or 0.0
    total_loss = db.query(func.sum(FraudRecord.actual_loss)).scalar() or 0.0
    
    blacklisted = db.query(func.count(FraudRecord.id)).filter(FraudRecord.is_blacklisted == True).scalar()
    companies_count = db.query(func.count(Company.id)).filter(Company.is_active == True).scalar()
    
    # Top fraud types
    top_fraud_types = db.query(
        FraudRecord.fraud_type,
        func.count(FraudRecord.id).label("count")
    ).group_by(FraudRecord.fraud_type).order_by(func.count(FraudRecord.id).desc()).limit(10).all()
    
    return IndustryStats(
        total_fraud_records=total_records,
        confirmed_frauds=confirmed,
        suspected_frauds=suspected,
        under_investigation=investigating,
        total_claimed_amount=total_claimed,
        total_actual_loss=total_loss,
        blacklisted_customers=blacklisted,
        participating_companies=companies_count,
        top_fraud_types=[{"fraud_type": ft, "count": count} for ft, count in top_fraud_types]
    )

@router.get("/company/{company_id}", response_model=CompanyStats)
async def get_company_stats(company_id: str, db: Session = Depends(get_db)):
    """Get company-specific fraud statistics"""
    
    company = db.query(Company).filter(Company.company_id == company_id).first()
    if not company:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Company not found")
    
    total_reports = db.query(func.count(FraudRecord.id)).filter(
        FraudRecord.reporting_company_id == company_id
    ).scalar()
    
    confirmed = db.query(func.count(FraudRecord.id)).filter(
        FraudRecord.reporting_company_id == company_id,
        FraudRecord.is_confirmed == True
    ).scalar()
    
    total_loss = db.query(func.sum(FraudRecord.actual_loss)).filter(
        FraudRecord.reporting_company_id == company_id
    ).scalar() or 0.0
    
    avg_risk = db.query(func.avg(FraudRecord.risk_score)).filter(
        FraudRecord.reporting_company_id == company_id
    ).scalar() or 0.0
    
    return CompanyStats(
        company_id=company_id,
        company_name=company.company_name,
        total_reports=total_reports,
        confirmed_frauds=confirmed,
        total_loss=total_loss,
        avg_risk_score=float(avg_risk)
    )
