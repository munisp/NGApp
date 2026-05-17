"""
Cross-Company Fraud Database Service

Centralized fraud database shared across Nigerian insurance companies
to detect customers filing fraudulent claims with multiple insurers.

Business Requirement: BR-FRAUD-004 - Cross-Company Fraud Database
"""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import uvicorn
import logging

from app.api import fraud_router, company_router, analytics_router
from app.models import fraud_record
from app.services.database import engine, get_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables
fraud_record.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Cross-Company Fraud Database",
    description="Shared fraud database for Nigerian insurance industry",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key authentication
VALID_API_KEYS = {
    "COMPANY_A_KEY": "Company A Insurance",
    "COMPANY_B_KEY": "Company B Insurance",
    "COMPANY_C_KEY": "Company C Insurance",
    # In production, load from secure environment variables
}

async def verify_api_key(x_api_key: str = Header(...)):
    """Verify company API key"""
    if x_api_key not in VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return VALID_API_KEYS[x_api_key]

# Include routers
app.include_router(
    fraud_router.router,
    prefix="/api/v1/fraud",
    tags=["Fraud Records"],
    dependencies=[Depends(verify_api_key)]
)

app.include_router(
    company_router.router,
    prefix="/api/v1/companies",
    tags=["Companies"],
    dependencies=[Depends(verify_api_key)]
)

app.include_router(
    analytics_router.router,
    prefix="/api/v1/analytics",
    tags=["Analytics"],
    dependencies=[Depends(verify_api_key)]
)

@app.get("/")
async def root():
    return {
        "service": "Cross-Company Fraud Database",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Test database connection
        db.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8011,
        reload=True,
        log_level="info"
    )
