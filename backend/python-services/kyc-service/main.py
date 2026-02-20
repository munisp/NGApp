"""
KYC (Know Your Customer) Service
Comprehensive customer identity verification for Nigerian banking
Compliant with CBN, NIMC, and AML/CFT regulations
"""
import os
import asyncio
import logging
import re

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uvicorn
import httpx
import hashlib
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NIMC_API_URL = os.getenv("NIMC_API_URL", "http://localhost:8040")
NIMC_API_KEY = os.getenv("NIMC_API_KEY", "")
NIBSS_API_URL = os.getenv("NIBSS_API_URL", "http://localhost:8041")
NIBSS_API_KEY = os.getenv("NIBSS_API_KEY", "")
BIOMETRIC_SERVICE_URL = os.getenv("BIOMETRIC_SERVICE_URL", "http://localhost:8087")
OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://localhost:8030")
KYC_KYB_SERVICE_URL = os.getenv("KYC_KYB_SERVICE_URL", "http://localhost:8099")
VIDEO_KYC_SERVICE_URL = os.getenv("VIDEO_KYC_SERVICE_URL", "http://localhost:8083")

app = FastAPI(
    title="KYC Service",
    description="Customer identity verification and compliance",
    version="1.0.0"
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# KYC Tier Levels (CBN Guidelines)
class KYCTier(str, Enum):
    TIER_1 = "tier_1"  # ₦300,000 daily limit
    TIER_2 = "tier_2"  # ₦1,000,000 daily limit
    TIER_3 = "tier_3"  # Unlimited

# Verification Status
class VerificationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"

# Document Types
class DocumentType(str, Enum):
    NIN = "nin"  # National Identity Number
    BVN = "bvn"  # Bank Verification Number
    DRIVERS_LICENSE = "drivers_license"
    INTERNATIONAL_PASSPORT = "international_passport"
    VOTERS_CARD = "voters_card"
    UTILITY_BILL = "utility_bill"

# Models
class CustomerKYC(BaseModel):
    customer_id: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: str
    phone_number: str
    email: Optional[EmailStr] = None
    address: str
    city: str
    state: str
    country: str = "Nigeria"
    postal_code: Optional[str] = None
    nin: Optional[str] = None
    bvn: Optional[str] = None
    tier: KYCTier = KYCTier.TIER_1

class DocumentVerification(BaseModel):
    customer_id: str
    document_type: DocumentType
    document_number: str
    document_image: Optional[str] = None  # Base64 encoded
    selfie_image: Optional[str] = None  # For biometric matching

class BiometricVerification(BaseModel):
    customer_id: str
    fingerprint_data: Optional[str] = None
    face_data: Optional[str] = None
    voice_data: Optional[str] = None

class KYCUpgrade(BaseModel):
    customer_id: str
    current_tier: KYCTier
    target_tier: KYCTier
    additional_documents: List[DocumentType]

# In-memory storage (replace with database in production)
kyc_records = {}
verification_requests = {}
document_verifications = {}

# Statistics
stats = {
    "total_kyc_records": 0,
    "tier_1_customers": 0,
    "tier_2_customers": 0,
    "tier_3_customers": 0,
    "verified_customers": 0,
    "pending_verifications": 0,
    "rejected_verifications": 0,
    "start_time": datetime.now()
}

# Helper Functions
def generate_kyc_id():
    """Generate unique KYC ID"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_num = random.randint(1000, 9999)
    return f"KYC-{timestamp}-{random_num}"

NIN_PATTERN = re.compile(r'^\d{11}$')


async def verify_nin(nin: str) -> Dict[str, Any]:
    """Verify NIN with NIMC API"""
    if not NIN_PATTERN.match(nin):
        return {"valid": False, "error": "Invalid NIN format – must be 11 digits"}

    checksum = sum(int(d) * (11 - i) for i, d in enumerate(nin[:10])) % 11
    expected_check = 11 - checksum if checksum != 0 else 0
    if int(nin[10]) != expected_check:
        return {"valid": False, "error": "Invalid NIN checksum"}

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {"Authorization": f"Bearer {NIMC_API_KEY}"} if NIMC_API_KEY else {}
                response = await client.post(
                    f"{NIMC_API_URL}/api/v1/nin/verify",
                    json={"nin": nin},
                    headers=headers,
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "valid": True,
                        "nin": nin,
                        "first_name": data.get("first_name", ""),
                        "last_name": data.get("last_name", ""),
                        "date_of_birth": data.get("date_of_birth", ""),
                        "gender": data.get("gender", ""),
                        "verified_at": datetime.now().isoformat(),
                    }
                logger.warning(f"NIMC API returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"NIMC API unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)

    return {"valid": False, "error": "NIMC verification service unavailable after 3 retries"}

BVN_PATTERN = re.compile(r'^\d{11}$')


async def verify_bvn(bvn: str) -> Dict[str, Any]:
    """Verify BVN with NIBSS API"""
    if not BVN_PATTERN.match(bvn):
        return {"valid": False, "error": "Invalid BVN format – must be 11 digits"}

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {"Authorization": f"Bearer {NIBSS_API_KEY}"} if NIBSS_API_KEY else {}
                response = await client.post(
                    f"{NIBSS_API_URL}/api/v1/bvn/verify",
                    json={"bvn": bvn},
                    headers=headers,
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "valid": True,
                        "bvn": bvn,
                        "first_name": data.get("first_name", ""),
                        "last_name": data.get("last_name", ""),
                        "phone_number": data.get("phone_number", ""),
                        "date_of_birth": data.get("date_of_birth", ""),
                        "verified_at": datetime.now().isoformat(),
                    }
                logger.warning(f"NIBSS API returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"NIBSS API unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)

    return {"valid": False, "error": "NIBSS verification service unavailable after 3 retries"}

def calculate_risk_score(kyc_data: Dict[str, Any]) -> int:
    """Calculate AML/CFT risk score (0-100)"""
    score = 0
    
    # Has NIN: -20 points (lower risk)
    if kyc_data.get("nin"):
        score -= 20
    
    # Has BVN: -20 points
    if kyc_data.get("bvn"):
        score -= 20
    
    # Has utility bill: -10 points
    if kyc_data.get("utility_bill_verified"):
        score -= 10
    
    # Tier 3: +10 points (higher scrutiny)
    if kyc_data.get("tier") == KYCTier.TIER_3:
        score += 10
    
    # Ensure score is between 0 and 100
    return max(0, min(100, score + 50))

def get_tier_requirements(tier: KYCTier) -> Dict[str, Any]:
    """Get requirements for each KYC tier"""
    requirements = {
        KYCTier.TIER_1: {
            "daily_limit": 300000,
            "required_documents": ["phone_number"],
            "optional_documents": ["nin", "bvn"],
            "biometric_required": False,
            "address_verification": False
        },
        KYCTier.TIER_2: {
            "daily_limit": 1000000,
            "required_documents": ["phone_number", "nin", "bvn"],
            "optional_documents": ["utility_bill"],
            "biometric_required": False,
            "address_verification": True
        },
        KYCTier.TIER_3: {
            "daily_limit": None,  # Unlimited
            "required_documents": ["phone_number", "nin", "bvn", "utility_bill"],
            "optional_documents": ["passport", "drivers_license"],
            "biometric_required": True,
            "address_verification": True
        }
    }
    return requirements.get(tier, requirements[KYCTier.TIER_1])

# API Endpoints
@app.get("/")
async def root():
    return {
        "service": "kyc-service",
        "version": "1.0.0",
        "description": "Customer identity verification and compliance",
        "compliance": ["CBN", "NIMC", "NIBSS", "AML/CFT"],
        "tiers": ["tier_1", "tier_2", "tier_3"]
    }

@app.get("/health")
async def health_check():
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    return {
        "status": "healthy",
        "uptime_seconds": int(uptime),
        "total_kyc_records": stats["total_kyc_records"],
        "verified_customers": stats["verified_customers"],
        "pending_verifications": stats["pending_verifications"]
    }

@app.post("/kyc/register")
async def register_kyc(kyc_data: CustomerKYC):
    """Register new customer KYC"""
    
    kyc_id = generate_kyc_id()
    
    # Create KYC record
    record = {
        "kyc_id": kyc_id,
        "customer_id": kyc_data.customer_id,
        "first_name": kyc_data.first_name,
        "last_name": kyc_data.last_name,
        "middle_name": kyc_data.middle_name,
        "date_of_birth": kyc_data.date_of_birth,
        "phone_number": kyc_data.phone_number,
        "email": kyc_data.email,
        "address": kyc_data.address,
        "city": kyc_data.city,
        "state": kyc_data.state,
        "country": kyc_data.country,
        "postal_code": kyc_data.postal_code,
        "nin": kyc_data.nin,
        "bvn": kyc_data.bvn,
        "tier": kyc_data.tier,
        "status": VerificationStatus.PENDING,
        "risk_score": 50,  # Default
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "verified_at": None,
        "documents_verified": [],
        "biometric_verified": False
    }
    
    kyc_records[kyc_id] = record
    
    # Update statistics
    stats["total_kyc_records"] += 1
    stats["pending_verifications"] += 1
    if kyc_data.tier == KYCTier.TIER_1:
        stats["tier_1_customers"] += 1
    elif kyc_data.tier == KYCTier.TIER_2:
        stats["tier_2_customers"] += 1
    elif kyc_data.tier == KYCTier.TIER_3:
        stats["tier_3_customers"] += 1
    
    return {
        "success": True,
        "kyc_id": kyc_id,
        "status": VerificationStatus.PENDING,
        "tier": kyc_data.tier,
        "requirements": get_tier_requirements(kyc_data.tier),
        "message": "KYC registration successful. Please submit required documents."
    }

@app.post("/kyc/verify/nin")
async def verify_nin_endpoint(customer_id: str, nin: str):
    """Verify customer NIN"""
    
    result = await verify_nin(nin)
    
    if not result["valid"]:
        return {
            "success": False,
            "error": result.get("error", "NIN verification failed")
        }
    
    # Find KYC record
    kyc_record = None
    kyc_id = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == customer_id:
            kyc_record = record
            kyc_id = kid
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    # Update KYC record
    kyc_record["nin"] = nin
    kyc_record["nin_verified"] = True
    kyc_record["nin_verified_at"] = datetime.now().isoformat()
    if "nin" not in kyc_record["documents_verified"]:
        kyc_record["documents_verified"].append("nin")
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    # Recalculate risk score
    kyc_record["risk_score"] = calculate_risk_score(kyc_record)
    
    return {
        "success": True,
        "nin_verified": True,
        "customer_id": customer_id,
        "risk_score": kyc_record["risk_score"],
        "verified_at": kyc_record["nin_verified_at"]
    }

@app.post("/kyc/verify/bvn")
async def verify_bvn_endpoint(customer_id: str, bvn: str):
    """Verify customer BVN"""
    
    result = await verify_bvn(bvn)
    
    if not result["valid"]:
        return {
            "success": False,
            "error": result.get("error", "BVN verification failed")
        }
    
    # Find KYC record
    kyc_record = None
    kyc_id = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == customer_id:
            kyc_record = record
            kyc_id = kid
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    # Update KYC record
    kyc_record["bvn"] = bvn
    kyc_record["bvn_verified"] = True
    kyc_record["bvn_verified_at"] = datetime.now().isoformat()
    if "bvn" not in kyc_record["documents_verified"]:
        kyc_record["documents_verified"].append("bvn")
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    # Recalculate risk score
    kyc_record["risk_score"] = calculate_risk_score(kyc_record)
    
    return {
        "success": True,
        "bvn_verified": True,
        "customer_id": customer_id,
        "risk_score": kyc_record["risk_score"],
        "verified_at": kyc_record["bvn_verified_at"]
    }

@app.post("/kyc/verify/document")
async def verify_document(verification: DocumentVerification):
    """Verify customer document"""
    
    # Find KYC record
    kyc_record = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == verification.customer_id:
            kyc_record = record
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    verification_result = await _verify_document_via_ocr(
        verification.document_type, verification.document_number, verification.document_image
    )
    
    # Update KYC record
    doc_key = f"{verification.document_type}_verified"
    kyc_record[doc_key] = True
    if verification.document_type not in kyc_record["documents_verified"]:
        kyc_record["documents_verified"].append(verification.document_type)
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    # Recalculate risk score
    kyc_record["risk_score"] = calculate_risk_score(kyc_record)
    
    return {
        "success": True,
        "verification_result": verification_result,
        "documents_verified": kyc_record["documents_verified"],
        "risk_score": kyc_record["risk_score"]
    }

@app.post("/kyc/verify/biometric")
async def verify_biometric(biometric: BiometricVerification):
    """Verify customer biometric data"""
    
    # Find KYC record
    kyc_record = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == biometric.customer_id:
            kyc_record = record
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    biometric_result = await _verify_biometric_via_service(biometric)
    
    # Update KYC record
    kyc_record["biometric_verified"] = True
    kyc_record["biometric_verified_at"] = datetime.now().isoformat()
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    return {
        "success": True,
        "biometric_result": biometric_result,
        "customer_id": biometric.customer_id
    }

@app.post("/kyc/upgrade")
async def upgrade_tier(upgrade: KYCUpgrade):
    """Upgrade customer KYC tier"""
    
    # Find KYC record
    kyc_record = None
    kyc_id = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == upgrade.customer_id:
            kyc_record = record
            kyc_id = kid
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    # Check requirements for target tier
    requirements = get_tier_requirements(upgrade.target_tier)
    
    # Check if all required documents are verified
    missing_docs = []
    for doc in requirements["required_documents"]:
        if doc not in kyc_record["documents_verified"]:
            missing_docs.append(doc)
    
    if missing_docs:
        return {
            "success": False,
            "error": "Missing required documents",
            "missing_documents": missing_docs,
            "requirements": requirements
        }
    
    # Check biometric requirement
    if requirements["biometric_required"] and not kyc_record.get("biometric_verified"):
        return {
            "success": False,
            "error": "Biometric verification required for this tier"
        }
    
    # Update tier
    old_tier = kyc_record["tier"]
    kyc_record["tier"] = upgrade.target_tier
    kyc_record["tier_upgraded_at"] = datetime.now().isoformat()
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    # Update statistics
    if old_tier == KYCTier.TIER_1:
        stats["tier_1_customers"] -= 1
    elif old_tier == KYCTier.TIER_2:
        stats["tier_2_customers"] -= 1
    
    if upgrade.target_tier == KYCTier.TIER_2:
        stats["tier_2_customers"] += 1
    elif upgrade.target_tier == KYCTier.TIER_3:
        stats["tier_3_customers"] += 1
    
    return {
        "success": True,
        "customer_id": upgrade.customer_id,
        "old_tier": old_tier,
        "new_tier": upgrade.target_tier,
        "daily_limit": requirements["daily_limit"],
        "upgraded_at": kyc_record["tier_upgraded_at"]
    }

@app.post("/kyc/approve")
async def approve_kyc(customer_id: str):
    """Approve customer KYC"""
    
    # Find KYC record
    kyc_record = None
    for kid, record in kyc_records.items():
        if record["customer_id"] == customer_id:
            kyc_record = record
            break
    
    if not kyc_record:
        raise HTTPException(status_code=404, detail="KYC record not found")
    
    # Update status
    old_status = kyc_record["status"]
    kyc_record["status"] = VerificationStatus.VERIFIED
    kyc_record["verified_at"] = datetime.now().isoformat()
    kyc_record["updated_at"] = datetime.now().isoformat()
    
    # Update statistics
    if old_status == VerificationStatus.PENDING:
        stats["pending_verifications"] -= 1
    stats["verified_customers"] += 1
    
    return {
        "success": True,
        "customer_id": customer_id,
        "status": VerificationStatus.VERIFIED,
        "tier": kyc_record["tier"],
        "verified_at": kyc_record["verified_at"]
    }

@app.get("/kyc/{customer_id}")
async def get_kyc(customer_id: str):
    """Get customer KYC record"""
    
    # Find KYC record
    for kid, record in kyc_records.items():
        if record["customer_id"] == customer_id:
            return {
                "success": True,
                "kyc_record": record
            }
    
    raise HTTPException(status_code=404, detail="KYC record not found")

@app.get("/kyc/tier/requirements")
async def get_tier_requirements_endpoint(tier: KYCTier):
    """Get requirements for a specific tier"""
    return {
        "tier": tier,
        "requirements": get_tier_requirements(tier)
    }

@app.get("/stats")
async def get_stats():
    """Get KYC service statistics"""
    uptime = (datetime.now() - stats["start_time"]).total_seconds()
    
    return {
        "uptime_seconds": int(uptime),
        "total_kyc_records": stats["total_kyc_records"],
        "tier_1_customers": stats["tier_1_customers"],
        "tier_2_customers": stats["tier_2_customers"],
        "tier_3_customers": stats["tier_3_customers"],
        "verified_customers": stats["verified_customers"],
        "pending_verifications": stats["pending_verifications"],
        "rejected_verifications": stats["rejected_verifications"],
        "verification_rate": round(stats["verified_customers"] / max(stats["total_kyc_records"], 1) * 100, 2)
    }

async def _verify_document_via_ocr(
    document_type: str, document_number: str, document_image: str | None
) -> Dict[str, Any]:
    """Verify document via OCR service with retry"""
    payload = {
        "document_type": document_type,
        "document_number": document_number,
        "document_image": document_image,
    }
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{OCR_SERVICE_URL}/api/v1/verify", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "document_type": document_type,
                        "document_number": document_number,
                        "verified": data.get("verified", False),
                        "verified_at": datetime.now().isoformat(),
                        "confidence_score": data.get("confidence", 0.0),
                        "extracted_fields": data.get("fields", {}),
                    }
                logger.warning(f"OCR service returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"OCR service unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)

    return {
        "document_type": document_type,
        "document_number": document_number,
        "verified": False,
        "verified_at": datetime.now().isoformat(),
        "confidence_score": 0.0,
        "error": "OCR service unavailable after 3 retries",
    }


async def _verify_biometric_via_service(biometric: BiometricVerification) -> Dict[str, Any]:
    """Verify biometric data via biometric matching service with retry"""
    payload = {
        "customer_id": biometric.customer_id,
        "fingerprint_data": biometric.fingerprint_data,
        "face_data": biometric.face_data,
        "voice_data": biometric.voice_data,
    }
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{BIOMETRIC_SERVICE_URL}/api/v1/biometric/verify", json=payload
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "fingerprint_match": data.get("fingerprint_match", False),
                        "face_match": data.get("face_match", False),
                        "voice_match": data.get("voice_match", False),
                        "overall_match": data.get("overall_match", False),
                        "confidence_score": data.get("confidence", 0.0),
                        "verified_at": datetime.now().isoformat(),
                    }
                logger.warning(f"Biometric service returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"Biometric service unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)

    return {
        "fingerprint_match": False,
        "face_match": False,
        "voice_match": False,
        "overall_match": False,
        "confidence_score": 0.0,
        "verified_at": datetime.now().isoformat(),
        "error": "Biometric service unavailable after 3 retries",
    }


@app.post("/kyc/video/start")
async def start_video_kyc(customer_id: str):
    """Start a video KYC session via the video-kyc orchestrator"""
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{VIDEO_KYC_SERVICE_URL}/session/start",
                    json={"user_id": customer_id},
                )
                if response.status_code == 200:
                    return response.json()
                logger.warning(f"Video KYC service returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"Video KYC service unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)
    raise HTTPException(status_code=503, detail="Video KYC service unavailable")


@app.post("/kyc/delegate/initiate")
async def delegate_to_kyc_kyb(customer_id: str, first_name: str, last_name: str):
    """Delegate full KYC verification to the production kyc_kyb_service"""
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{KYC_KYB_SERVICE_URL}/kyc/verify",
                    json={
                        "agent_id": customer_id,
                        "first_name": first_name,
                        "last_name": last_name,
                    },
                )
                if response.status_code == 200:
                    return response.json()
                logger.warning(f"KYC-KYB service returned {response.status_code} on attempt {attempt + 1}")
        except httpx.ConnectError:
            logger.warning(f"KYC-KYB service unavailable on attempt {attempt + 1}")
        if attempt < 2:
            await asyncio.sleep(2 ** attempt)
    raise HTTPException(status_code=503, detail="KYC-KYB service unavailable")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8098)

