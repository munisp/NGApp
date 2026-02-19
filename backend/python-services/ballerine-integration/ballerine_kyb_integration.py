"""
Ballerine KYB Integration Service
For agent hierarchy and business verification
Port: 8025
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import asyncio
import httpx
import os

from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, Float, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agent_user:agent_password@localhost/ballerine_db")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=20, max_overflow=40)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Ballerine Configuration
BALLERINE_API_URL = os.getenv("BALLERINE_API_URL", "https://api.ballerine.io/v1")
BALLERINE_API_KEY = os.getenv("BALLERINE_API_KEY", "")
BALLERINE_WORKFLOW_ID = os.getenv("BALLERINE_WORKFLOW_ID", "kyb-verification")

# ==================== DATABASE MODELS ====================

class BallerineVerification(Base):
    __tablename__ = "ballerine_verifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    verification_id = Column(String(100), unique=True, nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    business_name = Column(String(500))
    business_registration_number = Column(String(200))
    country = Column(String(2))
    
    # Ballerine workflow
    ballerine_workflow_id = Column(String(200), index=True)
    ballerine_case_id = Column(String(200))
    
    # Verification status
    status = Column(String(50), default="pending", index=True)
    risk_level = Column(String(20))
    verification_result = Column(JSONB)
    
    # Documents verified
    documents_verified = Column(JSONB)
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# ==================== PYDANTIC MODELS ====================

class VerificationRequest(BaseModel):
    agent_id: str
    business_name: str
    business_registration_number: str
    country: str
    documents: Optional[List[Dict[str, Any]]] = []

# ==================== HELPER FUNCTIONS ====================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def create_ballerine_workflow(data: Dict) -> Dict:
    """Create verification workflow in Ballerine"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BALLERINE_API_URL}/workflows",
                json={
                    "workflowDefinitionId": BALLERINE_WORKFLOW_ID,
                    "context": {
                        "entity": {
                            "type": "business",
                            "data": {
                                "companyName": data["business_name"],
                                "registrationNumber": data["business_registration_number"],
                                "country": data["country"]
                            }
                        },
                        "documents": data.get("documents", [])
                    }
                },
                headers={"Authorization": f"Bearer {BALLERINE_API_KEY}"},
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ballerine workflow creation failed: {str(e)}")

async def get_ballerine_workflow_status(workflow_id: str) -> Dict:
    """Get workflow status from Ballerine"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BALLERINE_API_URL}/workflows/{workflow_id}",
                headers={"Authorization": f"Bearer {BALLERINE_API_KEY}"},
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ==================== FASTAPI APP ====================

app = FastAPI(
    title="Ballerine KYB Integration Service",
    description="Agent business verification via Ballerine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "service": "ballerine-integration",
        "version": "1.0.0",
        "port": 8025,
        "ballerine_configured": bool(BALLERINE_API_KEY),
        "features": [
            "kyb_verification",
            "document_verification",
            "risk_assessment",
            "agent_onboarding"
        ]
    }

@app.post("/verify")
async def create_verification(
    request: VerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create KYB verification for agent"""
    
    verification = BallerineVerification(
        verification_id=f"VER-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
        agent_id=request.agent_id,
        business_name=request.business_name,
        business_registration_number=request.business_registration_number,
        country=request.country,
        status="pending"
    )
    
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    # Create Ballerine workflow
    if BALLERINE_API_KEY:
        try:
            workflow_data = await create_ballerine_workflow({
                "business_name": request.business_name,
                "business_registration_number": request.business_registration_number,
                "country": request.country,
                "documents": request.documents
            })
            
            verification.ballerine_workflow_id = workflow_data.get("id")
            verification.ballerine_case_id = workflow_data.get("caseId")
            verification.status = "processing"
            db.commit()
        except Exception as e:
            verification.status = "failed"
            db.commit()
            raise
    
    return {
        "verification_id": verification.verification_id,
        "status": verification.status,
        "ballerine_workflow_id": verification.ballerine_workflow_id
    }

@app.get("/verify/{verification_id}")
async def get_verification(verification_id: str, db: Session = Depends(get_db)):
    """Get verification status"""
    
    verification = db.query(BallerineVerification).filter(
        BallerineVerification.verification_id == verification_id
    ).first()
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    # Update from Ballerine if workflow exists
    if verification.ballerine_workflow_id and BALLERINE_API_KEY:
        workflow_status = await get_ballerine_workflow_status(verification.ballerine_workflow_id)
        
        if workflow_status.get("status") == "completed":
            verification.status = "completed"
            verification.completed_at = datetime.utcnow()
            verification.verification_result = workflow_status
            verification.risk_level = workflow_status.get("riskLevel", "medium")
            db.commit()
    
    return {
        "verification_id": verification.verification_id,
        "agent_id": verification.agent_id,
        "business_name": verification.business_name,
        "status": verification.status,
        "risk_level": verification.risk_level,
        "verification_result": verification.verification_result,
        "started_at": verification.started_at.isoformat(),
        "completed_at": verification.completed_at.isoformat() if verification.completed_at else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8025)
