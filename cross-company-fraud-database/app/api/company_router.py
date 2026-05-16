"""
Company Management API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.models.fraud_record import Company
from app.services.database import get_db

router = APIRouter()

@router.get("/list")
async def list_companies(db: Session = Depends(get_db)):
    """List all participating companies"""
    companies = db.query(Company).filter(Company.is_active == True).all()
    return companies

@router.get("/{company_id}")
async def get_company(company_id: str, db: Session = Depends(get_db)):
    """Get company details"""
    company = db.query(Company).filter(Company.company_id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company
