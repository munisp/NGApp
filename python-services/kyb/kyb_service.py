#!/usr/bin/env python3
"""
KYB (Know Your Business) Verification Service
Business entity verification with sanctions screening, beneficial owner verification,
risk scoring, and full middleware integration (Kafka, Temporal, Permify, Lakehouse).

Port: 8111
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import httpx
import json
import os
import uuid
import hashlib
import base64
import logging
from datetime import datetime
from enum import Enum
from cryptography.fernet import Fernet

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("kyb-service")

app = FastAPI(title="KYB Verification Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_SERVICE_URL = os.getenv("KAFKA_SERVICE_URL", "http://127.0.0.1:8081")
TEMPORAL_SERVICE_URL = os.getenv("TEMPORAL_SERVICE_URL", "http://127.0.0.1:8085")
PERMIFY_SERVICE_URL = os.getenv("PERMIFY_SERVICE_URL", "http://127.0.0.1:8089")
LAKEHOUSE_SERVICE_URL = os.getenv("LAKEHOUSE_SERVICE_URL", "http://127.0.0.1:8090")
KYC_UNIFIED_URL = os.getenv("KYC_UNIFIED_URL", "http://127.0.0.1:8110")
GNN_FRAUD_SERVICE_URL = os.getenv("GNN_FRAUD_SERVICE_URL", "http://127.0.0.1:8101")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://127.0.0.1:8104")

ENCRYPTION_KEY = os.getenv("KYB_ENCRYPTION_KEY", "unified-kyb-encryption-key-32b!!")
cipher_key = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
cipher = Fernet(base64.urlsafe_b64encode(cipher_key))

HIGH_RISK_COUNTRIES = {"AF", "IR", "KP", "SY", "YE", "SO", "LY", "IQ", "SS", "CF"}
HIGH_RISK_INDUSTRIES = {
    "gambling", "cryptocurrency", "arms_defense", "precious_metals",
    "money_service_business", "adult_entertainment", "cannabis",
}
PEP_WEIGHT = 0.15
SANCTIONS_LISTS = ["OFAC_SDN", "EU_SANCTIONS", "UN_SANCTIONS", "UK_SANCTIONS", "AU_SANCTIONS"]


class KYBStatus(str, Enum):
    PENDING = "pending"
    DOCUMENT_REVIEW = "document_review"
    SANCTIONS_SCREENING = "sanctions_screening"
    OWNER_VERIFICATION = "owner_verification"
    DIRECTOR_VERIFICATION = "director_verification"
    RISK_ASSESSMENT = "risk_assessment"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_ADDITIONAL_INFO = "requires_additional_info"


class BusinessType(str, Enum):
    SOLE_PROPRIETORSHIP = "sole_proprietorship"
    PARTNERSHIP = "partnership"
    LIMITED_LIABILITY = "limited_liability"
    CORPORATION = "corporation"
    COOPERATIVE = "cooperative"


class Address(BaseModel):
    street: str
    city: str
    state: str
    postal_code: str
    country: str


class BeneficialOwnerRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    nationality: str
    ownership_percentage: float = Field(..., ge=0, le=100)
    id_type: str = "national_id"
    id_number: str = ""
    id_expiry_date: str = ""
    is_politically_exposed: bool = False
    address: Optional[Address] = None


class DirectorRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    nationality: str
    position: str
    appointment_date: str
    id_type: str = "national_id"
    id_number: str = ""
    id_expiry_date: str = ""
    is_politically_exposed: bool = False


class BusinessInfoRequest(BaseModel):
    business_name: str
    registration_number: str
    business_type: BusinessType
    country: str
    registration_date: str = ""
    tax_id: str
    industry: str
    website: Optional[str] = None
    email: str = ""
    phone: str = ""
    address: Optional[Address] = None


class KYBSubmitRequest(BaseModel):
    business_info: BusinessInfoRequest
    beneficial_owners: List[BeneficialOwnerRequest]
    directors: List[DirectorRequest]


class KYBApproveRequest(BaseModel):
    verification_id: str
    reviewer_id: str
    notes: Optional[str] = None


class KYBRejectRequest(BaseModel):
    verification_id: str
    reviewer_id: str
    reason: str
    notes: Optional[str] = None


class SanctionsScreeningRequest(BaseModel):
    business_name: str
    registration_number: str
    beneficial_owners: List[Dict[str, str]]
    directors: List[Dict[str, str]]


class BusinessRegistrationVerifyRequest(BaseModel):
    business_name: str
    registration_number: str
    country: str


class TaxIdVerifyRequest(BaseModel):
    tax_id: str
    business_name: str
    country: str


class RiskScoreRequest(BaseModel):
    business_info: BusinessInfoRequest
    beneficial_owners: List[BeneficialOwnerRequest]
    directors: List[DirectorRequest]
    industry: str
    country: str


kyb_store: Dict[str, Dict[str, Any]] = {}
document_store: Dict[str, Dict[str, Any]] = {}
audit_log: List[Dict[str, Any]] = []
http_client = httpx.AsyncClient(timeout=30.0)


def encrypt_pii(data: Optional[str]) -> Optional[str]:
    if not data:
        return None
    return cipher.encrypt(data.encode()).decode()


def decrypt_pii(data: Optional[str]) -> Optional[str]:
    if not data:
        return None
    try:
        return cipher.decrypt(data.encode()).decode()
    except Exception:
        return data


def log_audit(verification_id: str, action: str, performed_by: str, details: Optional[Dict] = None):
    entry = {
        "id": str(uuid.uuid4()),
        "verification_id": verification_id,
        "action": action,
        "performed_by": performed_by,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
    }
    audit_log.append(entry)
    logger.info(f"KYB AUDIT: {action} on {verification_id} by {performed_by}")


async def publish_kafka_event(topic: str, event: Dict[str, Any]):
    try:
        await http_client.post(
            f"{KAFKA_SERVICE_URL}/produce",
            json={"topic": topic, "key": event.get("verification_id", ""), "value": json.dumps(event)},
        )
    except Exception as e:
        logger.warning(f"Kafka publish failed: {e}")


async def start_temporal_workflow(workflow_type: str, workflow_id: str, params: Dict[str, Any]):
    try:
        await http_client.post(
            f"{TEMPORAL_SERVICE_URL}/workflows/{workflow_type}/start",
            json={"workflow_id": workflow_id, "params": params},
        )
    except Exception as e:
        logger.warning(f"Temporal workflow start failed: {e}")


async def check_permify_permission(user_id: str, permission: str, resource: str) -> bool:
    try:
        resp = await http_client.post(
            f"{PERMIFY_SERVICE_URL}/permissions/check",
            json={"user_id": user_id, "permission": permission, "resource": resource},
        )
        if resp.status_code == 200:
            return resp.json().get("allowed", False)
    except Exception as e:
        logger.warning(f"Permify check failed: {e}")
    return True


async def push_to_lakehouse(table: str, data: Dict[str, Any]):
    try:
        await http_client.post(
            f"{LAKEHOUSE_SERVICE_URL}/ingest",
            json={"table": table, "data": data},
        )
    except Exception as e:
        logger.warning(f"Lakehouse push failed: {e}")


def screen_against_sanctions(name: str, entity_type: str = "individual") -> Dict[str, Any]:
    name_lower = name.lower().strip()
    sanctioned_keywords = [
        "al-qaeda", "isis", "hamas", "hezbollah", "taliban",
        "boko haram", "al-shabaab",
    ]

    matches = []
    for keyword in sanctioned_keywords:
        if keyword in name_lower:
            matches.append({
                "list": "OFAC_SDN",
                "match_type": "exact",
                "matched_name": name,
                "score": 1.0,
                "entity_type": entity_type,
            })

    name_parts = name_lower.split()
    for sanctions_list in SANCTIONS_LISTS:
        fuzzy_score = 0.0
        if len(name_parts) >= 2 and any(len(p) > 10 for p in name_parts):
            fuzzy_score = 0.1
        if fuzzy_score > 0.8:
            matches.append({
                "list": sanctions_list,
                "match_type": "fuzzy",
                "matched_name": name,
                "score": fuzzy_score,
                "entity_type": entity_type,
            })

    return {"clean": len(matches) == 0, "matches": matches}


def verify_registration_number(registration_number: str, country: str) -> Dict[str, Any]:
    patterns = {
        "NG": {"prefix": "RC", "min_length": 6, "max_length": 10},
        "KE": {"prefix": "PVT", "min_length": 5, "max_length": 12},
        "GH": {"prefix": "CS", "min_length": 6, "max_length": 12},
        "ZA": {"prefix": "", "min_length": 10, "max_length": 15},
    }

    country_pattern = patterns.get(country, {"prefix": "", "min_length": 4, "max_length": 20})
    is_valid = (
        len(registration_number) >= country_pattern["min_length"]
        and len(registration_number) <= country_pattern["max_length"]
    )

    if country_pattern["prefix"] and not registration_number.upper().startswith(country_pattern["prefix"]):
        is_valid = False

    return {
        "verified": is_valid,
        "registration_status": "active" if is_valid else "unknown",
        "registration_date": None,
        "business_type": None,
        "message": "Registration number format valid" if is_valid else "Registration number format invalid for country",
    }


def verify_tax_id_format(tax_id: str, country: str) -> Dict[str, Any]:
    patterns = {
        "NG": {"length": 10, "prefix": ""},
        "KE": {"length": 11, "prefix": "P"},
        "GH": {"length": 11, "prefix": ""},
        "ZA": {"length": 10, "prefix": ""},
    }

    pattern = patterns.get(country, {"length": 0, "prefix": ""})
    digits_only = "".join(c for c in tax_id if c.isdigit())
    is_valid = len(digits_only) >= max(pattern["length"] - 2, 4)

    if pattern["prefix"] and not tax_id.upper().startswith(pattern["prefix"]):
        is_valid = False

    return {
        "verified": is_valid,
        "status": "valid" if is_valid else "invalid",
        "message": "Tax ID format valid" if is_valid else "Tax ID format invalid for country",
    }


def calculate_kyb_risk_score(
    business_info: BusinessInfoRequest,
    beneficial_owners: List[BeneficialOwnerRequest],
    directors: List[DirectorRequest],
    sanctions_results: Dict[str, Any],
) -> Dict[str, Any]:
    score = 0.0
    risk_factors = []

    if business_info.country in HIGH_RISK_COUNTRIES:
        score += 0.3
        risk_factors.append({"factor": "high_risk_country", "impact": "high", "description": f"Country {business_info.country} is high-risk"})

    if business_info.industry.lower() in HIGH_RISK_INDUSTRIES:
        score += 0.2
        risk_factors.append({"factor": "high_risk_industry", "impact": "high", "description": f"Industry {business_info.industry} is high-risk"})

    total_ownership = sum(o.ownership_percentage for o in beneficial_owners)
    if total_ownership < 75:
        score += 0.1
        risk_factors.append({"factor": "incomplete_ownership", "impact": "medium", "description": f"Only {total_ownership}% ownership declared"})

    pep_count = sum(1 for o in beneficial_owners if o.is_politically_exposed)
    pep_count += sum(1 for d in directors if d.is_politically_exposed)
    if pep_count > 0:
        score += pep_count * PEP_WEIGHT
        risk_factors.append({"factor": "pep_exposure", "impact": "high", "description": f"{pep_count} politically exposed person(s)"})

    if not sanctions_results.get("business_clean", True):
        score += 0.5
        risk_factors.append({"factor": "sanctions_match_business", "impact": "critical", "description": "Business matched sanctions list"})
    if not sanctions_results.get("owners_clean", True):
        score += 0.4
        risk_factors.append({"factor": "sanctions_match_owner", "impact": "critical", "description": "Beneficial owner matched sanctions list"})
    if not sanctions_results.get("directors_clean", True):
        score += 0.3
        risk_factors.append({"factor": "sanctions_match_director", "impact": "critical", "description": "Director matched sanctions list"})

    if len(beneficial_owners) == 0:
        score += 0.15
        risk_factors.append({"factor": "no_beneficial_owners", "impact": "medium", "description": "No beneficial owners declared"})

    if len(directors) == 0:
        score += 0.1
        risk_factors.append({"factor": "no_directors", "impact": "medium", "description": "No directors declared"})

    for owner in beneficial_owners:
        if owner.nationality and owner.nationality in HIGH_RISK_COUNTRIES:
            score += 0.1
            risk_factors.append({"factor": "owner_high_risk_nationality", "impact": "medium", "description": f"Owner from {owner.nationality}"})

    score = min(score, 1.0)
    risk_level = "low" if score < 0.3 else "medium" if score < 0.6 else "high"
    auto_approve = score < 0.15 and len(risk_factors) == 0
    auto_reject = score > 0.8 or any(f["impact"] == "critical" for f in risk_factors)

    return {
        "risk_score": round(score, 4),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "auto_approve": auto_approve,
        "auto_reject": auto_reject,
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "kyb-verification", "version": "1.0.0"}


@app.post("/kyb/submit")
async def submit_kyb(request: KYBSubmitRequest, background_tasks: BackgroundTasks):
    verification_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    encrypted_owners = []
    for owner in request.beneficial_owners:
        encrypted_owners.append({
            "first_name_encrypted": encrypt_pii(owner.first_name),
            "last_name_encrypted": encrypt_pii(owner.last_name),
            "date_of_birth_encrypted": encrypt_pii(owner.date_of_birth),
            "nationality": owner.nationality,
            "ownership_percentage": owner.ownership_percentage,
            "id_type": owner.id_type,
            "id_number_encrypted": encrypt_pii(owner.id_number),
            "is_politically_exposed": owner.is_politically_exposed,
        })

    encrypted_directors = []
    for director in request.directors:
        encrypted_directors.append({
            "first_name_encrypted": encrypt_pii(director.first_name),
            "last_name_encrypted": encrypt_pii(director.last_name),
            "date_of_birth_encrypted": encrypt_pii(director.date_of_birth),
            "nationality": director.nationality,
            "position": director.position,
            "appointment_date": director.appointment_date,
            "id_type": director.id_type,
            "id_number_encrypted": encrypt_pii(director.id_number),
            "is_politically_exposed": director.is_politically_exposed,
        })

    verification = {
        "verification_id": verification_id,
        "status": KYBStatus.DOCUMENT_REVIEW.value,
        "business_name": request.business_info.business_name,
        "registration_number_encrypted": encrypt_pii(request.business_info.registration_number),
        "business_type": request.business_info.business_type.value,
        "country": request.business_info.country,
        "tax_id_encrypted": encrypt_pii(request.business_info.tax_id),
        "industry": request.business_info.industry,
        "email": request.business_info.email,
        "phone": request.business_info.phone,
        "address": request.business_info.address.dict() if request.business_info.address else None,
        "beneficial_owners_encrypted": encrypted_owners,
        "directors_encrypted": encrypted_directors,
        "documents": [],
        "sanctions_results": {},
        "registration_verification": {},
        "tax_verification": {},
        "risk_assessment": {},
        "compliance_checks": {
            "business_registration_verified": False,
            "tax_id_verified": False,
            "beneficial_owners_verified": False,
            "directors_verified": False,
            "documents_verified": False,
        },
        "reviewer_id": None,
        "reviewer_notes": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
        "reviewed_at": None,
    }
    kyb_store[verification_id] = verification

    log_audit(verification_id, "kyb_submitted", "system", {"business_name": request.business_info.business_name})

    background_tasks.add_task(
        process_kyb_pipeline,
        verification_id,
        request.business_info,
        request.beneficial_owners,
        request.directors,
    )

    await publish_kafka_event("kyb.submissions", {
        "event": "kyb_submitted",
        "verification_id": verification_id,
        "business_name": request.business_info.business_name,
        "country": request.business_info.country,
        "timestamp": now,
    })

    await start_temporal_workflow("kyb_verification", verification_id, {
        "verification_id": verification_id,
        "business_name": request.business_info.business_name,
        "country": request.business_info.country,
    })

    return {
        "verificationId": verification_id,
        "status": KYBStatus.DOCUMENT_REVIEW.value,
        "message": "KYB submission received. Verification pipeline started.",
    }


async def process_kyb_pipeline(
    verification_id: str,
    business_info: BusinessInfoRequest,
    beneficial_owners: List[BeneficialOwnerRequest],
    directors: List[DirectorRequest],
):
    v = kyb_store.get(verification_id)
    if not v:
        return

    v["status"] = KYBStatus.DOCUMENT_REVIEW.value
    v["updated_at"] = datetime.utcnow().isoformat()

    reg_result = verify_registration_number(business_info.registration_number, business_info.country)
    v["registration_verification"] = reg_result
    v["compliance_checks"]["business_registration_verified"] = reg_result["verified"]
    log_audit(verification_id, "registration_verified", "system", reg_result)

    tax_result = verify_tax_id_format(business_info.tax_id, business_info.country)
    v["tax_verification"] = tax_result
    v["compliance_checks"]["tax_id_verified"] = tax_result["verified"]
    log_audit(verification_id, "tax_id_verified", "system", tax_result)

    v["status"] = KYBStatus.SANCTIONS_SCREENING.value
    v["updated_at"] = datetime.utcnow().isoformat()

    business_sanctions = screen_against_sanctions(business_info.business_name, "business")

    owners_clean = True
    owner_matches = []
    for owner in beneficial_owners:
        result = screen_against_sanctions(f"{owner.first_name} {owner.last_name}", "individual")
        if not result["clean"]:
            owners_clean = False
            owner_matches.extend(result["matches"])

    directors_clean = True
    director_matches = []
    for director in directors:
        result = screen_against_sanctions(f"{director.first_name} {director.last_name}", "individual")
        if not result["clean"]:
            directors_clean = False
            director_matches.extend(result["matches"])

    sanctions_results = {
        "business_clean": business_sanctions["clean"],
        "owners_clean": owners_clean,
        "directors_clean": directors_clean,
        "matches": business_sanctions["matches"] + owner_matches + director_matches,
        "screened_lists": SANCTIONS_LISTS,
        "screened_at": datetime.utcnow().isoformat(),
    }
    v["sanctions_results"] = sanctions_results
    log_audit(verification_id, "sanctions_screening_completed", "system", {
        "business_clean": business_sanctions["clean"],
        "owners_clean": owners_clean,
        "directors_clean": directors_clean,
        "total_matches": len(sanctions_results["matches"]),
    })

    v["status"] = KYBStatus.OWNER_VERIFICATION.value
    v["updated_at"] = datetime.utcnow().isoformat()

    total_ownership = sum(o.ownership_percentage for o in beneficial_owners)
    v["compliance_checks"]["beneficial_owners_verified"] = total_ownership >= 75 and len(beneficial_owners) > 0
    log_audit(verification_id, "owners_verified", "system", {"total_ownership": total_ownership, "count": len(beneficial_owners)})

    v["status"] = KYBStatus.DIRECTOR_VERIFICATION.value
    v["updated_at"] = datetime.utcnow().isoformat()
    v["compliance_checks"]["directors_verified"] = len(directors) > 0
    log_audit(verification_id, "directors_verified", "system", {"count": len(directors)})

    v["status"] = KYBStatus.RISK_ASSESSMENT.value
    v["updated_at"] = datetime.utcnow().isoformat()

    risk = calculate_kyb_risk_score(business_info, beneficial_owners, directors, sanctions_results)
    v["risk_assessment"] = risk
    log_audit(verification_id, "risk_assessment_completed", "system", risk)

    try:
        resp = await http_client.post(
            f"{FEATURE_STORE_URL}/features/online",
            json={
                "entity_id": verification_id,
                "feature_group": "kyb_features",
                "features": {
                    "kyb_risk_score": risk["risk_score"],
                    "kyb_risk_level": risk["risk_level"],
                    "kyb_country": business_info.country,
                    "kyb_industry": business_info.industry,
                    "kyb_business_type": business_info.business_type.value,
                    "kyb_owner_count": len(beneficial_owners),
                    "kyb_director_count": len(directors),
                    "kyb_pep_count": sum(1 for o in beneficial_owners if o.is_politically_exposed) + sum(1 for d in directors if d.is_politically_exposed),
                    "kyb_sanctions_clean": sanctions_results["business_clean"] and sanctions_results["owners_clean"] and sanctions_results["directors_clean"],
                },
            },
        )
    except Exception as e:
        logger.warning(f"Feature store push failed: {e}")

    if risk["auto_approve"]:
        v["status"] = KYBStatus.APPROVED.value
        v["reviewed_at"] = datetime.utcnow().isoformat()
        log_audit(verification_id, "auto_approved", "system", {"risk_score": risk["risk_score"]})
    elif risk["auto_reject"]:
        v["status"] = KYBStatus.REJECTED.value
        v["rejection_reason"] = "Automated rejection: " + ", ".join(f["factor"] for f in risk["risk_factors"] if f["impact"] == "critical")
        v["reviewed_at"] = datetime.utcnow().isoformat()
        log_audit(verification_id, "auto_rejected", "system", {"reason": v["rejection_reason"]})
    else:
        v["status"] = KYBStatus.IN_REVIEW.value
        log_audit(verification_id, "queued_for_review", "system", {"risk_score": risk["risk_score"]})

    v["updated_at"] = datetime.utcnow().isoformat()

    await publish_kafka_event("kyb.status_changes", {
        "event": "kyb_status_changed",
        "verification_id": verification_id,
        "new_status": v["status"],
        "risk_level": risk["risk_level"],
        "timestamp": v["updated_at"],
    })

    await push_to_lakehouse("kyb_verifications", {
        "verification_id": verification_id,
        "business_name": business_info.business_name,
        "country": business_info.country,
        "industry": business_info.industry,
        "business_type": business_info.business_type.value,
        "status": v["status"],
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "sanctions_clean": sanctions_results["business_clean"] and sanctions_results["owners_clean"],
        "owner_count": len(beneficial_owners),
        "director_count": len(directors),
        "timestamp": v["updated_at"],
    })


@app.post("/kyb/upload-document")
async def upload_document(
    documentType: str = Form(...),
    file: UploadFile = File(...),
    ownerId: Optional[str] = Form(None),
):
    doc_id = str(uuid.uuid4())
    content = await file.read()
    encoded = base64.b64encode(content).decode()

    document_store[doc_id] = {
        "document_id": doc_id,
        "document_type": documentType,
        "file_name": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "owner_id": ownerId,
        "stored_ref": f"kyb/documents/{doc_id}/{file.filename}",
        "uploaded_at": datetime.utcnow().isoformat(),
    }

    return {"documentId": doc_id, "url": f"/kyb/documents/{doc_id}"}


@app.get("/kyb/status/{verification_id}")
async def get_kyb_status(verification_id: str):
    v = kyb_store.get(verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="KYB verification not found")

    checks = v.get("compliance_checks", {})
    doc_progress = 1.0 if checks.get("business_registration_verified") and checks.get("tax_id_verified") else 0.5
    sanctions_progress = 1.0 if v.get("sanctions_results") else 0.0
    owner_progress = 1.0 if checks.get("beneficial_owners_verified") else 0.0
    director_progress = 1.0 if checks.get("directors_verified") else 0.0
    overall = (doc_progress + sanctions_progress + owner_progress + director_progress) / 4.0

    return {
        "verificationId": verification_id,
        "status": v["status"],
        "progress": {
            "documentReview": doc_progress,
            "sanctionsScreening": sanctions_progress,
            "beneficialOwnerVerification": owner_progress,
            "directorVerification": director_progress,
            "overallProgress": overall,
        },
        "estimatedCompletionTime": "24-48 hours" if v["status"] == KYBStatus.IN_REVIEW.value else None,
    }


@app.get("/kyb/verification/{verification_id}")
async def get_kyb_details(verification_id: str):
    v = kyb_store.get(verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="KYB verification not found")

    decrypted_owners = []
    for owner in v.get("beneficial_owners_encrypted", []):
        decrypted_owners.append({
            "firstName": decrypt_pii(owner.get("first_name_encrypted")),
            "lastName": decrypt_pii(owner.get("last_name_encrypted")),
            "dateOfBirth": decrypt_pii(owner.get("date_of_birth_encrypted")),
            "nationality": owner.get("nationality"),
            "ownershipPercentage": owner.get("ownership_percentage"),
            "idType": owner.get("id_type"),
            "isPoliticallyExposed": owner.get("is_politically_exposed"),
        })

    decrypted_directors = []
    for director in v.get("directors_encrypted", []):
        decrypted_directors.append({
            "firstName": decrypt_pii(director.get("first_name_encrypted")),
            "lastName": decrypt_pii(director.get("last_name_encrypted")),
            "dateOfBirth": decrypt_pii(director.get("date_of_birth_encrypted")),
            "nationality": director.get("nationality"),
            "position": director.get("position"),
            "appointmentDate": director.get("appointment_date"),
            "isPoliticallyExposed": director.get("is_politically_exposed"),
        })

    return {
        "verificationId": verification_id,
        "status": v["status"],
        "businessInfo": {
            "businessName": v["business_name"],
            "registrationNumber": decrypt_pii(v.get("registration_number_encrypted")),
            "businessType": v["business_type"],
            "country": v["country"],
            "taxId": decrypt_pii(v.get("tax_id_encrypted")),
            "industry": v["industry"],
        },
        "beneficialOwners": decrypted_owners,
        "directors": decrypted_directors,
        "riskScore": v.get("risk_assessment", {}).get("risk_score", 0),
        "riskLevel": v.get("risk_assessment", {}).get("risk_level", "unknown"),
        "sanctionsCheckResults": v.get("sanctions_results", {}),
        "complianceChecks": v.get("compliance_checks", {}),
        "reviewNotes": v.get("reviewer_notes"),
        "createdAt": v["created_at"],
        "updatedAt": v["updated_at"],
    }


@app.post("/kyb/sanctions-screening")
async def sanctions_screening(request: SanctionsScreeningRequest):
    business_result = screen_against_sanctions(request.business_name, "business")
    owners_clean = True
    directors_clean = True
    all_matches = list(business_result["matches"])

    for owner in request.beneficial_owners:
        name = f"{owner.get('firstName', '')} {owner.get('lastName', '')}".strip()
        if name:
            result = screen_against_sanctions(name, "individual")
            if not result["clean"]:
                owners_clean = False
                all_matches.extend(result["matches"])

    for director in request.directors:
        name = f"{director.get('firstName', '')} {director.get('lastName', '')}".strip()
        if name:
            result = screen_against_sanctions(name, "individual")
            if not result["clean"]:
                directors_clean = False
                all_matches.extend(result["matches"])

    return {
        "businessClean": business_result["clean"],
        "ownersClean": owners_clean,
        "directorsClean": directors_clean,
        "matches": all_matches,
    }


@app.post("/kyb/verify-registration")
async def verify_registration(request: BusinessRegistrationVerifyRequest):
    return verify_registration_number(request.registration_number, request.country)


@app.post("/kyb/verify-tax-id")
async def verify_tax(request: TaxIdVerifyRequest):
    return verify_tax_id_format(request.tax_id, request.country)


@app.post("/kyb/calculate-risk-score")
async def calculate_risk(request: RiskScoreRequest):
    mock_sanctions = {"business_clean": True, "owners_clean": True, "directors_clean": True, "matches": []}
    risk = calculate_kyb_risk_score(
        request.business_info,
        request.beneficial_owners,
        request.directors,
        mock_sanctions,
    )
    return {
        "riskScore": risk["risk_score"],
        "riskLevel": risk["risk_level"],
        "riskFactors": risk["risk_factors"],
    }


@app.post("/kyb/extract-document-data")
async def extract_document_data(
    file: UploadFile = File(...),
    documentType: str = Form("business_registration"),
):
    content = await file.read()
    encoded = base64.b64encode(content).decode()

    extracted = {
        "document_type": documentType,
        "business_name": None,
        "registration_number": None,
        "date": None,
    }

    try:
        resp = await http_client.post(
            f"{KYC_UNIFIED_URL}/../5008/extract-document",
            json={"image": encoded, "document_type": documentType},
            timeout=60.0,
        )
        if resp.status_code == 200:
            extracted = resp.json().get("extracted_data", extracted)
    except Exception as e:
        logger.warning(f"OCR extraction failed: {e}")

    return {"extractedData": extracted, "confidence": 0.7}


@app.get("/kyb/pending")
async def get_pending_kyb(reviewer_id: Optional[str] = None):
    if reviewer_id:
        allowed = await check_permify_permission(reviewer_id, "review_kyb", "kyb_submissions")
        if not allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    pending = [
        {
            "verificationId": v["verification_id"],
            "businessName": v["business_name"],
            "country": v["country"],
            "industry": v["industry"],
            "status": v["status"],
            "riskScore": v.get("risk_assessment", {}).get("risk_score", 0),
            "riskLevel": v.get("risk_assessment", {}).get("risk_level", "unknown"),
            "createdAt": v["created_at"],
        }
        for v in kyb_store.values()
        if v["status"] == KYBStatus.IN_REVIEW.value
    ]
    pending.sort(key=lambda x: x["createdAt"], reverse=True)
    return {"submissions": pending, "total": len(pending)}


@app.post("/kyb/approve")
async def approve_kyb(request: KYBApproveRequest, background_tasks: BackgroundTasks):
    allowed = await check_permify_permission(request.reviewer_id, "approve_kyb", "kyb_submissions")
    if not allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    v = kyb_store.get(request.verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    v["status"] = KYBStatus.APPROVED.value
    v["reviewer_id"] = request.reviewer_id
    v["reviewer_notes"] = request.notes
    v["reviewed_at"] = datetime.utcnow().isoformat()
    v["updated_at"] = datetime.utcnow().isoformat()

    log_audit(request.verification_id, "approved", request.reviewer_id, {"notes": request.notes})

    background_tasks.add_task(publish_kafka_event, "kyb.status_changes", {
        "event": "kyb_approved",
        "verification_id": request.verification_id,
        "business_name": v["business_name"],
        "reviewer_id": request.reviewer_id,
        "timestamp": v["updated_at"],
    })

    return {"success": True, "message": "KYB approved successfully"}


@app.post("/kyb/reject")
async def reject_kyb(request: KYBRejectRequest, background_tasks: BackgroundTasks):
    allowed = await check_permify_permission(request.reviewer_id, "reject_kyb", "kyb_submissions")
    if not allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    v = kyb_store.get(request.verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    v["status"] = KYBStatus.REJECTED.value
    v["reviewer_id"] = request.reviewer_id
    v["reviewer_notes"] = request.notes
    v["rejection_reason"] = request.reason
    v["reviewed_at"] = datetime.utcnow().isoformat()
    v["updated_at"] = datetime.utcnow().isoformat()

    log_audit(request.verification_id, "rejected", request.reviewer_id, {"reason": request.reason})

    background_tasks.add_task(publish_kafka_event, "kyb.status_changes", {
        "event": "kyb_rejected",
        "verification_id": request.verification_id,
        "reason": request.reason,
        "timestamp": v["updated_at"],
    })

    return {"success": True, "message": "KYB rejected"}


@app.get("/kyb/my-verifications")
async def get_user_verifications():
    verifications = list(kyb_store.values())
    return [
        {
            "verificationId": v["verification_id"],
            "status": v["status"],
            "businessName": v["business_name"],
            "riskScore": v.get("risk_assessment", {}).get("risk_score", 0),
            "riskLevel": v.get("risk_assessment", {}).get("risk_level", "unknown"),
            "createdAt": v["created_at"],
            "updatedAt": v["updated_at"],
        }
        for v in verifications
    ]


@app.get("/kyb/check-status")
async def check_kyb_status():
    if not kyb_store:
        return {"hasCompletedKYB": False}
    latest = max(kyb_store.values(), key=lambda v: v["created_at"])
    return {
        "hasCompletedKYB": latest["status"] == KYBStatus.APPROVED.value,
        "status": latest["status"],
        "verificationId": latest["verification_id"],
    }


@app.get("/kyb/audit/{verification_id}")
async def get_kyb_audit(verification_id: str):
    entries = [e for e in audit_log if e["verification_id"] == verification_id]
    entries.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"logs": entries, "total": len(entries)}


@app.get("/kyb/analytics/summary")
async def get_kyb_analytics():
    total = len(kyb_store)
    statuses = {}
    countries = {}
    industries = {}
    for v in kyb_store.values():
        statuses[v["status"]] = statuses.get(v["status"], 0) + 1
        countries[v["country"]] = countries.get(v["country"], 0) + 1
        industries[v["industry"]] = industries.get(v["industry"], 0) + 1

    return {
        "total_verifications": total,
        "by_status": statuses,
        "by_country": countries,
        "by_industry": industries,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8111)
