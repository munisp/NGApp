"""NEXCOM Exchange KYC/KYB Service.

Open-source identity verification service using:
- PaddleOCR for document text extraction
- Docling for structured document parsing
- VLM for document authenticity verification
- MediaPipe for face liveness detection
- Challenge-response anti-spoofing protocol
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add service root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.schemas import (
    CreateKYBRequest,
    CreateKYCRequest,
    DocumentType,
    KYBApplication,
    KYBStatus,
    KYCApplication,
    KYCStatus,
    LivenessChallenge,
    LivenessResult,
    OnboardingStatus,
    ReviewDecision,
    RiskLevel,
    StakeholderType,
)
from ocr.paddle_ocr import PaddleOCREngine
from document.docling_parser import DoclingParser, VLMDocumentVerifier
from liveness.detector import LivenessDetector
from kyb.screening import KYBScreeningEngine, StakeholderOnboarding

app = FastAPI(
    title="NEXCOM KYC/KYB Service",
    description="Open-source identity verification with PaddleOCR, Docling, VLM & liveness detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service instances ──────────────────────────────────────────────────────────
ocr_engine = PaddleOCREngine()
doc_parser = DoclingParser()
doc_verifier = VLMDocumentVerifier()
liveness_detector = LivenessDetector()
kyb_screener = KYBScreeningEngine()
onboarding = StakeholderOnboarding()

# ── In-memory stores (production: PostgreSQL) ──────────────────────────────────
kyc_applications: dict[str, KYCApplication] = {}
kyb_applications: dict[str, KYBApplication] = {}
liveness_sessions: dict[str, dict] = {}  # session_id -> LivenessSession dict

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/kyc-uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Seed data ──────────────────────────────────────────────────────────────────
def _seed_data() -> None:
    """Seed demo KYC/KYB applications for testing."""
    # Seed KYC applications
    kyc_seeds = [
        {
            "id": "kyc-001",
            "account_id": "ACC-001",
            "stakeholder_type": StakeholderType.RETAIL_TRADER,
            "status": KYCStatus.APPROVED,
            "full_name": "Adeyemi Oluwaseun",
            "email": "adeyemi@example.com",
            "phone_number": "+234-801-234-5678",
            "date_of_birth": "1990-03-15",
            "nationality": "Nigerian",
            "address": "42 Marina Road, Lagos Island, Lagos",
            "bvn": "22345678901",
            "nin": "12345678901",
            "risk_level": RiskLevel.LOW,
            "risk_score": 0.1,
            "approved_at": datetime(2025, 6, 15),
        },
        {
            "id": "kyc-002",
            "account_id": "ACC-002",
            "stakeholder_type": StakeholderType.INSTITUTIONAL_INVESTOR,
            "status": KYCStatus.UNDER_REVIEW,
            "full_name": "Chukwuma Nnamdi",
            "email": "chukwuma@capital.ng",
            "phone_number": "+234-802-345-6789",
            "date_of_birth": "1985-11-22",
            "nationality": "Nigerian",
            "address": "15 Broad Street, Victoria Island, Lagos",
            "bvn": "33456789012",
            "nin": "23456789012",
            "risk_level": RiskLevel.MEDIUM,
            "risk_score": 0.25,
        },
        {
            "id": "kyc-003",
            "account_id": "ACC-003",
            "stakeholder_type": StakeholderType.RETAIL_TRADER,
            "status": KYCStatus.LIVENESS_COMPLETE,
            "full_name": "Fatima Abubakar",
            "email": "fatima@gmail.com",
            "phone_number": "+234-803-456-7890",
            "date_of_birth": "1995-07-08",
            "nationality": "Nigerian",
            "address": "78 Independence Way, Kaduna",
            "nin": "34567890123",
            "risk_level": RiskLevel.LOW,
            "risk_score": 0.05,
        },
        {
            "id": "kyc-004",
            "account_id": "ACC-004",
            "stakeholder_type": StakeholderType.API_CONSUMER,
            "status": KYCStatus.DOCUMENT_UPLOADED,
            "full_name": "Emeka Okafor",
            "email": "emeka@fintech.ng",
            "phone_number": "+234-804-567-8901",
            "nationality": "Nigerian",
            "address": "22 Allen Avenue, Ikeja, Lagos",
            "risk_level": RiskLevel.LOW,
            "risk_score": 0.08,
        },
        {
            "id": "kyc-005",
            "account_id": "ACC-005",
            "stakeholder_type": StakeholderType.RETAIL_TRADER,
            "status": KYCStatus.REJECTED,
            "full_name": "Ibrahim Musa",
            "email": "ibrahim@mail.com",
            "phone_number": "+234-805-678-9012",
            "nationality": "Nigerian",
            "address": "5 Ahmadu Bello Way, Abuja",
            "risk_level": RiskLevel.HIGH,
            "risk_score": 0.7,
            "risk_factors": ["Document tampering detected", "Liveness check failed"],
            "rejection_reason": "Failed document verification and liveness check",
        },
    ]

    for seed in kyc_seeds:
        app_obj = KYCApplication(**{
            **seed,
            "created_at": datetime(2025, 5, 1),
            "updated_at": datetime(2025, 6, 15),
        })
        kyc_applications[seed["id"]] = app_obj

    # Seed KYB applications
    kyb_seeds = [
        {
            "id": "kyb-001",
            "account_id": "ACC-BRK-001",
            "stakeholder_type": StakeholderType.BROKER_DEALER,
            "status": KYBStatus.APPROVED,
            "business_name": "Stanbic Securities Ltd",
            "registration_number": "RC-1234567",
            "tax_id": "TIN-98765432",
            "business_type": "Private Limited Company",
            "incorporation_date": "2015-03-20",
            "registered_address": "42 Marina Road, Lagos Island",
            "business_address": "42 Marina Road, Lagos Island",
            "industry": "Securities Trading",
            "annual_revenue": "2,500,000,000",
            "employee_count": 150,
            "website": "https://stanbicsecurities.ng",
            "aml_screening_passed": True,
            "sanctions_screening_passed": True,
            "pep_screening_passed": True,
            "adverse_media_clear": True,
            "risk_level": RiskLevel.LOW,
            "risk_score": 0.1,
            "approved_at": datetime(2025, 4, 10),
        },
        {
            "id": "kyb-002",
            "account_id": "ACC-MM-001",
            "stakeholder_type": StakeholderType.MARKET_MAKER,
            "status": KYBStatus.UNDER_REVIEW,
            "business_name": "Optiver Africa Trading",
            "registration_number": "RC-2345678",
            "tax_id": "TIN-87654321",
            "business_type": "Foreign Subsidiary",
            "incorporation_date": "2020-08-15",
            "registered_address": "15 Broad Street, Victoria Island",
            "business_address": "15 Broad Street, Victoria Island",
            "industry": "Market Making",
            "annual_revenue": "5,000,000,000",
            "employee_count": 45,
            "risk_level": RiskLevel.MEDIUM,
            "risk_score": 0.3,
        },
        {
            "id": "kyb-003",
            "account_id": "ACC-ISS-001",
            "stakeholder_type": StakeholderType.DIGITAL_ASSET_ISSUER,
            "status": KYBStatus.PROCESSING,
            "business_name": "Dangote Commodities Digital",
            "registration_number": "RC-3456789",
            "tax_id": "TIN-76543210",
            "business_type": "Public Limited Company",
            "incorporation_date": "2022-01-10",
            "registered_address": "1 Alfred Rewane Road, Ikoyi",
            "business_address": "1 Alfred Rewane Road, Ikoyi",
            "industry": "Commodity Trading",
            "annual_revenue": "50,000,000,000",
            "employee_count": 500,
            "risk_level": RiskLevel.LOW,
            "risk_score": 0.05,
        },
    ]

    for seed in kyb_seeds:
        app_obj = KYBApplication(**{
            **seed,
            "created_at": datetime(2025, 3, 1),
            "updated_at": datetime(2025, 4, 10),
        })
        kyb_applications[seed["id"]] = app_obj


_seed_data()


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH & STATUS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "kyc-kyb",
        "version": "1.0.0",
        "engines": {
            "paddleocr": "available" if ocr_engine._initialized and ocr_engine._ocr else "fallback_mock",
            "docling": "available" if doc_parser._initialized and doc_parser._converter else "fallback_mock",
            "mediapipe": "available" if liveness_detector._initialized and liveness_detector._face_mesh else "fallback_mock",
            "vlm_verifier": "available",
            "kyb_screener": "available",
        },
        "stats": {
            "kyc_applications": len(kyc_applications),
            "kyb_applications": len(kyb_applications),
            "active_liveness_sessions": len(liveness_sessions),
        },
    }


@app.get("/api/v1/kyc/stats")
async def kyc_stats():
    """Dashboard statistics for KYC/KYB operations."""
    kyc_by_status = {}
    for app_obj in kyc_applications.values():
        status = app_obj.status.value
        kyc_by_status[status] = kyc_by_status.get(status, 0) + 1

    kyb_by_status = {}
    for app_obj in kyb_applications.values():
        status = app_obj.status.value
        kyb_by_status[status] = kyb_by_status.get(status, 0) + 1

    kyc_by_type = {}
    for app_obj in kyc_applications.values():
        st = app_obj.stakeholder_type.value
        kyc_by_type[st] = kyc_by_type.get(st, 0) + 1

    return {
        "success": True,
        "data": {
            "total_kyc": len(kyc_applications),
            "total_kyb": len(kyb_applications),
            "kyc_by_status": kyc_by_status,
            "kyb_by_status": kyb_by_status,
            "kyc_by_stakeholder": kyc_by_type,
            "pending_review": sum(
                1 for a in kyc_applications.values() if a.status == KYCStatus.UNDER_REVIEW
            ) + sum(
                1 for a in kyb_applications.values() if a.status == KYBStatus.UNDER_REVIEW
            ),
            "approved_today": 0,
            "rejection_rate": round(
                sum(1 for a in kyc_applications.values() if a.status == KYCStatus.REJECTED)
                / max(len(kyc_applications), 1) * 100, 1
            ),
            "avg_processing_time": "2.5 hours",
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# ONBOARDING REQUIREMENTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/onboarding/requirements/{stakeholder_type}")
async def get_onboarding_requirements(stakeholder_type: str):
    """Get onboarding requirements for a specific stakeholder type."""
    reqs = onboarding.get_requirements(stakeholder_type)
    return {"success": True, "data": reqs}


@app.get("/api/v1/onboarding/stakeholder-types")
async def list_stakeholder_types():
    """List all available stakeholder types and their descriptions."""
    types = [
        {
            "id": "retail_trader",
            "name": "Individual Trader",
            "description": "Personal trading account for commodity futures, options, and digital assets",
            "kyb_required": False,
            "estimated_time": "15-30 minutes",
        },
        {
            "id": "institutional_investor",
            "name": "Institutional Investor",
            "description": "Fund, pension, or investment company seeking market access",
            "kyb_required": False,
            "estimated_time": "1-2 business days",
        },
        {
            "id": "broker_dealer",
            "name": "Broker/Dealer",
            "description": "Licensed broker providing market access to clients",
            "kyb_required": True,
            "estimated_time": "5-10 business days",
        },
        {
            "id": "market_maker",
            "name": "Market Maker",
            "description": "Liquidity provider with continuous two-sided quotes",
            "kyb_required": True,
            "estimated_time": "5-10 business days",
        },
        {
            "id": "digital_asset_issuer",
            "name": "Asset Issuer",
            "description": "Commodity owner tokenizing assets for fractional trading",
            "kyb_required": True,
            "estimated_time": "3-5 business days",
        },
        {
            "id": "api_consumer",
            "name": "API/Fintech Partner",
            "description": "Developer or fintech integrating via NEXCOM API",
            "kyb_required": False,
            "estimated_time": "1-2 business days",
        },
        {
            "id": "exchange_member",
            "name": "Exchange Member",
            "description": "Full trading seat holder with direct market access",
            "kyb_required": True,
            "estimated_time": "10-15 business days",
        },
    ]
    return {"success": True, "data": types}


# ══════════════════════════════════════════════════════════════════════════════
# KYC APPLICATIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/kyc/applications")
async def list_kyc_applications(
    status: Optional[str] = None,
    stakeholder_type: Optional[str] = None,
):
    """List all KYC applications with optional filters."""
    apps = list(kyc_applications.values())
    if status:
        apps = [a for a in apps if a.status.value == status]
    if stakeholder_type:
        apps = [a for a in apps if a.stakeholder_type.value == stakeholder_type]

    return {
        "success": True,
        "data": [_serialize_kyc(a) for a in apps],
        "total": len(apps),
    }


@app.get("/api/v1/kyc/applications/{application_id}")
async def get_kyc_application(application_id: str):
    app_obj = kyc_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYC application not found")
    return {"success": True, "data": _serialize_kyc(app_obj)}


@app.post("/api/v1/kyc/applications")
async def create_kyc_application(req: CreateKYCRequest):
    """Create a new KYC application."""
    app_id = f"kyc-{str(uuid.uuid4())[:8]}"
    app_obj = KYCApplication(
        id=app_id,
        account_id=req.account_id,
        stakeholder_type=req.stakeholder_type,
        full_name=req.full_name,
        email=req.email,
        phone_number=req.phone_number,
        date_of_birth=req.date_of_birth,
        nationality=req.nationality,
        address=req.address,
        bvn=req.bvn,
        nin=req.nin,
    )
    kyc_applications[app_id] = app_obj
    return {"success": True, "data": _serialize_kyc(app_obj)}


@app.post("/api/v1/kyc/applications/{application_id}/documents")
async def upload_kyc_document(
    application_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a document for KYC verification.

    Runs PaddleOCR for text extraction and VLM for authenticity verification.
    """
    app_obj = kyc_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYC application not found")

    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, f"{application_id}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc_type = DocumentType(document_type)

    # Run PaddleOCR
    ocr_result = ocr_engine.extract_document_fields(file_path, doc_type)
    app_obj.ocr_results.append(ocr_result)

    # Run VLM document verification
    verification = doc_verifier.verify_document(file_path, doc_type, ocr_result.raw_text)
    app_obj.document_verifications.append(verification)

    # Update status
    app_obj.status = KYCStatus.OCR_COMPLETE
    app_obj.updated_at = datetime.utcnow()

    return {
        "success": True,
        "data": {
            "ocr_result": {
                "fields": [{"field_name": f.field_name, "value": f.value, "confidence": f.confidence} for f in ocr_result.fields],
                "overall_confidence": ocr_result.overall_confidence,
                "processing_time_ms": ocr_result.processing_time_ms,
            },
            "verification": {
                "is_authentic": verification.is_authentic,
                "confidence": verification.confidence,
                "tampering_detected": verification.tampering_detected,
                "face_detected": verification.face_detected,
                "issues": verification.issues,
                "vlm_analysis": verification.vlm_analysis,
            },
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# LIVENESS DETECTION
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/kyc/applications/{application_id}/liveness/start")
async def start_liveness_session(application_id: str, num_challenges: int = 3):
    """Start a new liveness verification session with random challenges."""
    app_obj = kyc_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYC application not found")

    session = liveness_detector.create_session(num_challenges)
    liveness_sessions[session.session_id] = session.model_dump()

    app_obj.status = KYCStatus.LIVENESS_PENDING
    app_obj.updated_at = datetime.utcnow()

    return {
        "success": True,
        "data": {
            "session_id": session.session_id,
            "challenges": [c.value for c in session.challenges],
            "current_challenge": session.challenges[0].value,
            "total_challenges": len(session.challenges),
            "instructions": _get_challenge_instructions(session.challenges[0]),
        },
    }


@app.post("/api/v1/kyc/liveness/{session_id}/verify")
async def verify_liveness_frame(
    session_id: str,
    file: UploadFile = File(...),
):
    """Submit a frame for liveness challenge verification."""
    session_data = liveness_sessions.get(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Liveness session not found")

    session = LivenessSession(**session_data)

    # Save frame
    frame_path = os.path.join(UPLOAD_DIR, f"liveness_{session_id}_{uuid.uuid4()}.jpg")
    contents = await file.read()
    with open(frame_path, "wb") as f:
        f.write(contents)

    # Process frame
    result = liveness_detector.process_frame(frame_path, session)

    # Update session
    session.results.append(result.model_dump())
    if result.passed:
        session.current_challenge_index += 1

    # Check if all challenges completed
    all_done = session.current_challenge_index >= len(session.challenges)
    if all_done:
        session = liveness_detector.evaluate_session(session)

    liveness_sessions[session_id] = session.model_dump()

    next_challenge = None
    if not all_done and session.current_challenge_index < len(session.challenges):
        next_challenge = session.challenges[session.current_challenge_index].value

    return {
        "success": True,
        "data": {
            "challenge": result.challenge.value,
            "passed": result.passed,
            "confidence": result.confidence,
            "anti_spoof_score": result.anti_spoof_score,
            "face_landmarks_detected": result.face_landmarks_detected,
            "processing_time_ms": result.processing_time_ms,
            "all_challenges_complete": all_done,
            "overall_result": session.overall_result.value if session.overall_result else None,
            "next_challenge": next_challenge,
            "next_instructions": _get_challenge_instructions(
                LivenessChallenge(next_challenge)
            ) if next_challenge else None,
        },
    }


@app.get("/api/v1/kyc/liveness/{session_id}")
async def get_liveness_session(session_id: str):
    session_data = liveness_sessions.get(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Liveness session not found")
    return {"success": True, "data": session_data}


# ══════════════════════════════════════════════════════════════════════════════
# KYB APPLICATIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/kyb/applications")
async def list_kyb_applications(
    status: Optional[str] = None,
    stakeholder_type: Optional[str] = None,
):
    apps = list(kyb_applications.values())
    if status:
        apps = [a for a in apps if a.status.value == status]
    if stakeholder_type:
        apps = [a for a in apps if a.stakeholder_type.value == stakeholder_type]

    return {
        "success": True,
        "data": [_serialize_kyb(a) for a in apps],
        "total": len(apps),
    }


@app.get("/api/v1/kyb/applications/{application_id}")
async def get_kyb_application(application_id: str):
    app_obj = kyb_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYB application not found")
    return {"success": True, "data": _serialize_kyb(app_obj)}


@app.post("/api/v1/kyb/applications")
async def create_kyb_application(req: CreateKYBRequest):
    app_id = f"kyb-{str(uuid.uuid4())[:8]}"
    app_obj = KYBApplication(
        id=app_id,
        account_id=req.account_id,
        stakeholder_type=req.stakeholder_type,
        business_name=req.business_name,
        registration_number=req.registration_number,
        tax_id=req.tax_id,
        business_type=req.business_type,
        incorporation_date=req.incorporation_date,
        registered_address=req.registered_address,
        business_address=req.business_address,
        industry=req.industry,
        annual_revenue=req.annual_revenue,
        employee_count=req.employee_count,
        website=req.website,
        directors=req.directors,
        shareholders=req.shareholders,
    )
    kyb_applications[app_id] = app_obj
    return {"success": True, "data": _serialize_kyb(app_obj)}


@app.post("/api/v1/kyb/applications/{application_id}/documents")
async def upload_kyb_document(
    application_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a business document for KYB verification."""
    app_obj = kyb_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYB application not found")

    file_path = os.path.join(UPLOAD_DIR, f"{application_id}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc_type = DocumentType(document_type)

    # Run PaddleOCR
    ocr_result = ocr_engine.extract_document_fields(file_path, doc_type)
    app_obj.ocr_results.append(ocr_result)

    # Run Docling for structured parsing
    parsed = doc_parser.parse_document(file_path)

    # Run VLM verification
    verification = doc_verifier.verify_document(file_path, doc_type, ocr_result.raw_text)
    app_obj.document_verifications.append(verification)

    app_obj.status = KYBStatus.PROCESSING
    app_obj.updated_at = datetime.utcnow()

    return {
        "success": True,
        "data": {
            "ocr_result": {
                "fields": [{"field_name": f.field_name, "value": f.value, "confidence": f.confidence} for f in ocr_result.fields],
                "overall_confidence": ocr_result.overall_confidence,
            },
            "docling_parsed": {
                "page_count": parsed.get("page_count", 0),
                "tables_found": len(parsed.get("tables", [])),
                "markdown_preview": parsed.get("markdown", "")[:500],
            },
            "verification": {
                "is_authentic": verification.is_authentic,
                "confidence": verification.confidence,
                "issues": verification.issues,
            },
        },
    }


@app.post("/api/v1/kyb/applications/{application_id}/screen")
async def screen_kyb_application(application_id: str):
    """Run full KYB screening (AML, sanctions, PEP, adverse media)."""
    app_obj = kyb_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYB application not found")

    app_obj = kyb_screener.screen_business(app_obj)
    kyb_applications[application_id] = app_obj

    return {
        "success": True,
        "data": {
            "aml_screening": app_obj.aml_screening_passed,
            "sanctions_screening": app_obj.sanctions_screening_passed,
            "pep_screening": app_obj.pep_screening_passed,
            "adverse_media": app_obj.adverse_media_clear,
            "risk_level": app_obj.risk_level.value,
            "risk_score": app_obj.risk_score,
            "risk_factors": app_obj.risk_factors,
            "status": app_obj.status.value,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN REVIEW
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/kyc/applications/{application_id}/review")
async def review_kyc_application(application_id: str, decision: ReviewDecision):
    """Admin: approve or reject a KYC application."""
    app_obj = kyc_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYC application not found")

    app_obj.reviewer_id = decision.reviewer_id
    app_obj.reviewer_notes = decision.notes

    if decision.decision == "approve":
        app_obj.status = KYCStatus.APPROVED
        app_obj.approved_at = datetime.utcnow()
    elif decision.decision == "reject":
        app_obj.status = KYCStatus.REJECTED
        app_obj.rejection_reason = decision.rejection_reason
    else:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")

    app_obj.updated_at = datetime.utcnow()
    return {"success": True, "data": _serialize_kyc(app_obj)}


@app.post("/api/v1/kyb/applications/{application_id}/review")
async def review_kyb_application(application_id: str, decision: ReviewDecision):
    app_obj = kyb_applications.get(application_id)
    if not app_obj:
        raise HTTPException(status_code=404, detail="KYB application not found")

    app_obj.reviewer_id = decision.reviewer_id
    app_obj.reviewer_notes = decision.notes

    if decision.decision == "approve":
        app_obj.status = KYBStatus.APPROVED
        app_obj.approved_at = datetime.utcnow()
    elif decision.decision == "reject":
        app_obj.status = KYBStatus.REJECTED
        app_obj.rejection_reason = decision.rejection_reason
    else:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")

    app_obj.updated_at = datetime.utcnow()
    return {"success": True, "data": _serialize_kyb(app_obj)}


# ══════════════════════════════════════════════════════════════════════════════
# OCR & DOCUMENT ANALYSIS (standalone)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/ocr/extract")
async def ocr_extract(
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Standalone OCR extraction endpoint."""
    file_path = os.path.join(UPLOAD_DIR, f"ocr_{uuid.uuid4()}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc_type = DocumentType(document_type)
    result = ocr_engine.extract_document_fields(file_path, doc_type)

    return {
        "success": True,
        "data": {
            "document_type": result.document_type.value,
            "fields": [{"field_name": f.field_name, "value": f.value, "confidence": f.confidence} for f in result.fields],
            "raw_text": result.raw_text,
            "overall_confidence": result.overall_confidence,
            "processing_time_ms": result.processing_time_ms,
        },
    }


@app.post("/api/v1/documents/verify")
async def verify_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Standalone document verification endpoint."""
    file_path = os.path.join(UPLOAD_DIR, f"verify_{uuid.uuid4()}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc_type = DocumentType(document_type)
    ocr_result = ocr_engine.extract_document_fields(file_path, doc_type)
    verification = doc_verifier.verify_document(file_path, doc_type, ocr_result.raw_text)

    return {
        "success": True,
        "data": {
            "is_authentic": verification.is_authentic,
            "confidence": verification.confidence,
            "tampering_detected": verification.tampering_detected,
            "expiry_valid": verification.expiry_valid,
            "face_detected": verification.face_detected,
            "face_match_score": verification.face_match_score,
            "issues": verification.issues,
            "vlm_analysis": verification.vlm_analysis,
        },
    }


@app.post("/api/v1/documents/parse")
async def parse_document_endpoint(
    file: UploadFile = File(...),
):
    """Parse a document using Docling for structured extraction."""
    file_path = os.path.join(UPLOAD_DIR, f"parse_{uuid.uuid4()}_{file.filename}")
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    result = doc_parser.parse_document(file_path)
    return {"success": True, "data": result}


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _serialize_kyc(app_obj: KYCApplication) -> dict:
    return {
        "id": app_obj.id,
        "account_id": app_obj.account_id,
        "stakeholder_type": app_obj.stakeholder_type.value,
        "status": app_obj.status.value,
        "full_name": app_obj.full_name,
        "email": app_obj.email,
        "phone_number": app_obj.phone_number,
        "date_of_birth": app_obj.date_of_birth,
        "nationality": app_obj.nationality,
        "address": app_obj.address,
        "bvn": app_obj.bvn,
        "nin": app_obj.nin,
        "risk_level": app_obj.risk_level.value,
        "risk_score": app_obj.risk_score,
        "risk_factors": app_obj.risk_factors,
        "rejection_reason": app_obj.rejection_reason,
        "reviewer_notes": app_obj.reviewer_notes,
        "documents_count": len(app_obj.documents),
        "ocr_results_count": len(app_obj.ocr_results),
        "liveness_completed": app_obj.liveness_session is not None,
        "selfie_match_score": app_obj.selfie_match_score,
        "created_at": app_obj.created_at.isoformat(),
        "updated_at": app_obj.updated_at.isoformat(),
        "approved_at": app_obj.approved_at.isoformat() if app_obj.approved_at else None,
    }


def _serialize_kyb(app_obj: KYBApplication) -> dict:
    return {
        "id": app_obj.id,
        "account_id": app_obj.account_id,
        "stakeholder_type": app_obj.stakeholder_type.value,
        "status": app_obj.status.value,
        "business_name": app_obj.business_name,
        "registration_number": app_obj.registration_number,
        "tax_id": app_obj.tax_id,
        "business_type": app_obj.business_type,
        "incorporation_date": app_obj.incorporation_date,
        "registered_address": app_obj.registered_address,
        "business_address": app_obj.business_address,
        "industry": app_obj.industry,
        "annual_revenue": app_obj.annual_revenue,
        "employee_count": app_obj.employee_count,
        "website": app_obj.website,
        "directors_count": len(app_obj.directors),
        "shareholders_count": len(app_obj.shareholders),
        "ubos_count": len(app_obj.ultimate_beneficial_owners),
        "aml_screening": app_obj.aml_screening_passed,
        "sanctions_screening": app_obj.sanctions_screening_passed,
        "pep_screening": app_obj.pep_screening_passed,
        "adverse_media": app_obj.adverse_media_clear,
        "risk_level": app_obj.risk_level.value,
        "risk_score": app_obj.risk_score,
        "risk_factors": app_obj.risk_factors,
        "rejection_reason": app_obj.rejection_reason,
        "documents_count": len(app_obj.documents),
        "created_at": app_obj.created_at.isoformat(),
        "updated_at": app_obj.updated_at.isoformat(),
        "approved_at": app_obj.approved_at.isoformat() if app_obj.approved_at else None,
    }


def _get_challenge_instructions(challenge: LivenessChallenge) -> str:
    instructions = {
        LivenessChallenge.BLINK: "Please blink your eyes naturally while looking at the camera",
        LivenessChallenge.TURN_LEFT: "Slowly turn your head to the left",
        LivenessChallenge.TURN_RIGHT: "Slowly turn your head to the right",
        LivenessChallenge.SMILE: "Please smile naturally",
        LivenessChallenge.NOD: "Slowly nod your head up and down",
        LivenessChallenge.RAISE_EYEBROWS: "Please raise your eyebrows",
    }
    return instructions.get(challenge, "Follow the on-screen instructions")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "3002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
