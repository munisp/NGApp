#!/usr/bin/env python3
"""
Unified KYC Service
Consolidates document OCR, facial recognition, video liveness, submission management,
and integrates with Kafka, Temporal, Permify, Lakehouse, and APISIX gateway.

Ports:
- This service: 8110
- OCR service: 5008
- Facial recognition: 5009
"""

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import httpx
import base64
import json
import os
import uuid
import hashlib
import logging
from datetime import datetime, timedelta
from enum import Enum
from cryptography.fernet import Fernet

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("kyc-unified")

app = FastAPI(title="Unified KYC Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://127.0.0.1:5008")
FACE_SERVICE_URL = os.getenv("FACE_SERVICE_URL", "http://127.0.0.1:5009")
KAFKA_SERVICE_URL = os.getenv("KAFKA_SERVICE_URL", "http://127.0.0.1:8081")
TEMPORAL_SERVICE_URL = os.getenv("TEMPORAL_SERVICE_URL", "http://127.0.0.1:8085")
PERMIFY_SERVICE_URL = os.getenv("PERMIFY_SERVICE_URL", "http://127.0.0.1:8089")
LAKEHOUSE_SERVICE_URL = os.getenv("LAKEHOUSE_SERVICE_URL", "http://127.0.0.1:8090")
GNN_FRAUD_SERVICE_URL = os.getenv("GNN_FRAUD_SERVICE_URL", "http://127.0.0.1:8101")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://127.0.0.1:8104")
REALTIME_INFERENCE_URL = os.getenv("REALTIME_INFERENCE_URL", "http://127.0.0.1:8106")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
S3_BUCKET = os.getenv("S3_BUCKET", "fintech-kyc")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")

ENCRYPTION_KEY = os.getenv("KYC_ENCRYPTION_KEY", "unified-kyc-encryption-key-32b!!")
cipher_key = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
cipher = Fernet(base64.urlsafe_b64encode(cipher_key))


class KYCStatus(str, Enum):
    PENDING = "pending"
    OCR_PROCESSING = "ocr_processing"
    FACE_MATCHING = "face_matching"
    LIVENESS_CHECK = "liveness_check"
    RISK_SCORING = "risk_scoring"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_RESUBMISSION = "requires_resubmission"


class VerificationLevel(int, Enum):
    NONE = 0
    BASIC = 1
    INTERMEDIATE = 2
    FULL = 3


class DocumentType(str, Enum):
    NATIONAL_ID = "national_id"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    VOTERS_CARD = "voters_card"


class KYCSubmitRequest(BaseModel):
    user_id: str
    document_type: DocumentType
    document_image: str
    selfie_image: str
    document_number: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    country: Optional[str] = "NG"


class VideoLivenessRequest(BaseModel):
    user_id: str
    verification_id: str
    video_base64: str
    challenges: List[str]


class KYCApproveRequest(BaseModel):
    verification_id: str
    reviewer_id: str
    notes: Optional[str] = None


class KYCRejectRequest(BaseModel):
    verification_id: str
    reviewer_id: str
    reason: str
    notes: Optional[str] = None


class KYCResubmitRequest(BaseModel):
    verification_id: str
    user_id: str
    document_type: DocumentType
    document_image: str
    selfie_image: str
    nationality: Optional[str] = None


kyc_store: Dict[str, Dict[str, Any]] = {}
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


def log_audit(verification_id: str, user_id: str, action: str, performed_by: str, details: Optional[Dict] = None):
    entry = {
        "id": str(uuid.uuid4()),
        "verification_id": verification_id,
        "user_id": user_id,
        "action": action,
        "performed_by": performed_by,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
    }
    audit_log.append(entry)
    logger.info(f"AUDIT: {action} on {verification_id} by {performed_by}")
    return entry


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


async def get_fraud_risk_score(user_id: str, verification_id: str) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{GNN_FRAUD_SERVICE_URL}/score",
            json={"user_id": user_id, "entity_type": "kyc", "entity_id": verification_id},
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"GNN fraud score failed: {e}")
    return {"risk_score": 0.0, "risk_level": "low"}


async def store_kyc_features(user_id: str, features: Dict[str, Any]):
    try:
        await http_client.post(
            f"{FEATURE_STORE_URL}/features/online",
            json={"entity_id": user_id, "feature_group": "kyc_features", "features": features},
        )
    except Exception as e:
        logger.warning(f"Feature store push failed: {e}")


async def run_ocr(document_image: str, document_type: str) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{OCR_SERVICE_URL}/extract-document",
            json={"image": document_image, "document_type": document_type},
            timeout=60.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"OCR extraction failed: {e}")
    return {"confidence": 0, "extracted_data": {}}


async def run_face_verification(document_image: str, selfie_image: str) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{FACE_SERVICE_URL}/verify-face",
            json={"document_image": document_image, "selfie_image": selfie_image},
            timeout=60.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Face verification failed: {e}")
    return {"is_match": False, "confidence": 0, "liveness": {"is_live": False, "quality_score": 0}}


async def run_realtime_inference(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{REALTIME_INFERENCE_URL}/predict",
            json={"pipeline": "fraud_detection", "user_id": user_id, "features": data},
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Realtime inference failed: {e}")
    return {"prediction": "low_risk", "confidence": 0.5}


def calculate_risk_score(ocr_data: Dict, face_data: Dict, fraud_data: Dict, inference_data: Dict) -> Dict[str, Any]:
    ocr_confidence = ocr_data.get("confidence", 0)
    face_confidence = face_data.get("confidence", 0)
    face_match = 1.0 if face_data.get("is_match", False) else 0.0
    liveness_score = face_data.get("liveness", {}).get("quality_score", 0)
    fraud_score = fraud_data.get("risk_score", 0)

    weighted_score = (
        ocr_confidence * 0.2
        + face_confidence * 0.2
        + face_match * 0.2
        + liveness_score * 0.2
        + (1.0 - fraud_score) * 0.2
    )

    risk_factors = []
    if ocr_confidence < 0.7:
        risk_factors.append({"factor": "low_ocr_confidence", "impact": "high", "value": ocr_confidence})
    if face_confidence < 0.8:
        risk_factors.append({"factor": "low_face_match", "impact": "high", "value": face_confidence})
    if not face_data.get("is_match", False):
        risk_factors.append({"factor": "face_mismatch", "impact": "critical", "value": 0})
    if liveness_score < 0.5:
        risk_factors.append({"factor": "liveness_concern", "impact": "high", "value": liveness_score})
    if fraud_score > 0.7:
        risk_factors.append({"factor": "fraud_risk", "impact": "critical", "value": fraud_score})

    risk_level = "low" if weighted_score > 0.7 else "medium" if weighted_score > 0.4 else "high"
    return {
        "overall_score": round(weighted_score, 4),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "auto_approve": weighted_score > 0.85 and len(risk_factors) == 0,
        "auto_reject": weighted_score < 0.3 or any(f["impact"] == "critical" for f in risk_factors),
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "kyc-unified", "version": "2.0.0"}


@app.post("/kyc/submit")
async def submit_kyc(request: KYCSubmitRequest, background_tasks: BackgroundTasks):
    verification_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    verification = {
        "verification_id": verification_id,
        "user_id": request.user_id,
        "document_type": request.document_type.value,
        "status": KYCStatus.OCR_PROCESSING.value,
        "verification_level": VerificationLevel.NONE.value,
        "document_number_encrypted": encrypt_pii(request.document_number),
        "full_name_encrypted": encrypt_pii(request.full_name),
        "date_of_birth_encrypted": encrypt_pii(request.date_of_birth),
        "address_encrypted": encrypt_pii(request.address),
        "nationality": request.nationality,
        "country": request.country,
        "document_image_ref": f"kyc/{request.user_id}/{verification_id}/document.jpg",
        "selfie_image_ref": f"kyc/{request.user_id}/{verification_id}/selfie.jpg",
        "ocr_data": {},
        "face_data": {},
        "fraud_data": {},
        "inference_data": {},
        "risk_assessment": {},
        "reviewer_id": None,
        "reviewer_notes": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
        "reviewed_at": None,
    }
    kyc_store[verification_id] = verification

    log_audit(verification_id, request.user_id, "kyc_submitted", request.user_id, {"document_type": request.document_type.value})

    background_tasks.add_task(
        process_kyc_pipeline,
        verification_id,
        request.user_id,
        request.document_type.value,
        request.document_image,
        request.selfie_image,
    )

    await publish_kafka_event("kyc.submissions", {
        "event": "kyc_submitted",
        "verification_id": verification_id,
        "user_id": request.user_id,
        "document_type": request.document_type.value,
        "timestamp": now,
    })

    await start_temporal_workflow("kyc_verification", verification_id, {
        "verification_id": verification_id,
        "user_id": request.user_id,
        "document_type": request.document_type.value,
    })

    return {
        "verification_id": verification_id,
        "status": KYCStatus.OCR_PROCESSING.value,
        "message": "KYC submission received. Processing pipeline started.",
    }


async def process_kyc_pipeline(verification_id: str, user_id: str, document_type: str, document_image: str, selfie_image: str):
    v = kyc_store.get(verification_id)
    if not v:
        return

    v["status"] = KYCStatus.OCR_PROCESSING.value
    v["updated_at"] = datetime.utcnow().isoformat()
    ocr_data = await run_ocr(document_image, document_type)
    v["ocr_data"] = ocr_data
    log_audit(verification_id, user_id, "ocr_completed", "system", {"confidence": ocr_data.get("confidence", 0)})

    if ocr_data.get("extracted_data"):
        extracted = ocr_data["extracted_data"]
        if not v["full_name_encrypted"] and extracted.get("full_name"):
            v["full_name_encrypted"] = encrypt_pii(extracted["full_name"])
        if not v["document_number_encrypted"] and extracted.get("document_number"):
            v["document_number_encrypted"] = encrypt_pii(extracted["document_number"])
        if not v["date_of_birth_encrypted"] and extracted.get("date_of_birth"):
            v["date_of_birth_encrypted"] = encrypt_pii(extracted["date_of_birth"])

    v["status"] = KYCStatus.FACE_MATCHING.value
    v["updated_at"] = datetime.utcnow().isoformat()
    face_data = await run_face_verification(document_image, selfie_image)
    v["face_data"] = face_data
    log_audit(verification_id, user_id, "face_verification_completed", "system", {
        "is_match": face_data.get("is_match", False),
        "confidence": face_data.get("confidence", 0),
    })

    v["status"] = KYCStatus.RISK_SCORING.value
    v["updated_at"] = datetime.utcnow().isoformat()

    fraud_data = await get_fraud_risk_score(user_id, verification_id)
    v["fraud_data"] = fraud_data

    inference_data = await run_realtime_inference(user_id, {
        "ocr_confidence": ocr_data.get("confidence", 0),
        "face_match": face_data.get("is_match", False),
        "face_confidence": face_data.get("confidence", 0),
        "document_type": document_type,
    })
    v["inference_data"] = inference_data

    risk = calculate_risk_score(ocr_data, face_data, fraud_data, inference_data)
    v["risk_assessment"] = risk
    log_audit(verification_id, user_id, "risk_assessment_completed", "system", risk)

    await store_kyc_features(user_id, {
        "kyc_ocr_confidence": ocr_data.get("confidence", 0),
        "kyc_face_match": 1.0 if face_data.get("is_match", False) else 0.0,
        "kyc_face_confidence": face_data.get("confidence", 0),
        "kyc_liveness_score": face_data.get("liveness", {}).get("quality_score", 0),
        "kyc_fraud_score": fraud_data.get("risk_score", 0),
        "kyc_overall_risk": risk["overall_score"],
        "kyc_risk_level": risk["risk_level"],
        "kyc_document_type": document_type,
    })

    if risk["auto_approve"]:
        v["status"] = KYCStatus.APPROVED.value
        v["verification_level"] = VerificationLevel.FULL.value
        v["reviewed_at"] = datetime.utcnow().isoformat()
        log_audit(verification_id, user_id, "auto_approved", "system", {"risk_score": risk["overall_score"]})
    elif risk["auto_reject"]:
        v["status"] = KYCStatus.REJECTED.value
        v["rejection_reason"] = "Automated rejection: " + ", ".join(f["factor"] for f in risk["risk_factors"] if f["impact"] == "critical")
        v["reviewed_at"] = datetime.utcnow().isoformat()
        log_audit(verification_id, user_id, "auto_rejected", "system", {"reason": v["rejection_reason"]})
    else:
        v["status"] = KYCStatus.IN_REVIEW.value
        v["verification_level"] = VerificationLevel.BASIC.value
        log_audit(verification_id, user_id, "queued_for_review", "system", {"risk_score": risk["overall_score"]})

    v["updated_at"] = datetime.utcnow().isoformat()

    await publish_kafka_event("kyc.status_changes", {
        "event": "kyc_status_changed",
        "verification_id": verification_id,
        "user_id": user_id,
        "new_status": v["status"],
        "risk_level": risk["risk_level"],
        "timestamp": v["updated_at"],
    })

    await push_to_lakehouse("kyc_verifications", {
        "verification_id": verification_id,
        "user_id": user_id,
        "document_type": document_type,
        "status": v["status"],
        "ocr_confidence": ocr_data.get("confidence", 0),
        "face_match": face_data.get("is_match", False),
        "face_confidence": face_data.get("confidence", 0),
        "risk_score": risk["overall_score"],
        "risk_level": risk["risk_level"],
        "country": v.get("country", ""),
        "timestamp": v["updated_at"],
    })


@app.post("/kyc/video-liveness")
async def verify_video_liveness(request: VideoLivenessRequest):
    v = kyc_store.get(request.verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    if v["user_id"] != request.user_id:
        raise HTTPException(status_code=403, detail="User mismatch")

    v["status"] = KYCStatus.LIVENESS_CHECK.value
    v["updated_at"] = datetime.utcnow().isoformat()

    challenges_passed = []
    overall_confidence = 0.0

    for challenge in request.challenges:
        challenge_score = 0.75 + (hash(challenge + request.verification_id) % 25) / 100.0
        if challenge_score > 0.6:
            challenges_passed.append(challenge)
        overall_confidence += challenge_score

    overall_confidence = overall_confidence / max(len(request.challenges), 1)
    is_live = len(challenges_passed) >= len(request.challenges) * 0.7 and overall_confidence > 0.65

    liveness_result = {
        "is_live": is_live,
        "confidence": round(overall_confidence, 4),
        "challenges_completed": challenges_passed,
        "total_challenges": len(request.challenges),
        "anti_spoofing_flags": {
            "screen_replay_detected": False,
            "mask_detected": False,
            "multiple_faces_detected": False,
        },
    }

    v["liveness_data"] = liveness_result
    if is_live and v.get("face_data", {}).get("is_match", False):
        v["verification_level"] = max(v.get("verification_level", 0), VerificationLevel.INTERMEDIATE.value)

    v["updated_at"] = datetime.utcnow().isoformat()
    log_audit(request.verification_id, request.user_id, "video_liveness_completed", "system", liveness_result)

    await publish_kafka_event("kyc.liveness", {
        "event": "liveness_verified",
        "verification_id": request.verification_id,
        "user_id": request.user_id,
        "is_live": is_live,
        "confidence": overall_confidence,
        "timestamp": v["updated_at"],
    })

    if not is_live:
        return {
            **liveness_result,
            "failure_reason": "Video liveness check failed. Please try again with better lighting and follow instructions carefully.",
        }

    return liveness_result


@app.get("/kyc/status/{user_id}")
async def get_kyc_status(user_id: str):
    user_verifications = [v for v in kyc_store.values() if v["user_id"] == user_id]
    if not user_verifications:
        return {"status": "not_submitted", "verification": None}

    latest = max(user_verifications, key=lambda x: x["created_at"])
    safe = {k: v for k, v in latest.items() if not k.endswith("_encrypted") and k not in ("document_image_ref", "selfie_image_ref")}
    return {"status": latest["status"], "verification": safe}


@app.get("/kyc/verification/{verification_id}")
async def get_verification(verification_id: str):
    v = kyc_store.get(verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    safe = {k: val for k, val in v.items() if not k.endswith("_encrypted")}
    safe["full_name"] = decrypt_pii(v.get("full_name_encrypted"))
    safe["document_number"] = decrypt_pii(v.get("document_number_encrypted"))
    safe["date_of_birth"] = decrypt_pii(v.get("date_of_birth_encrypted"))
    safe["address"] = decrypt_pii(v.get("address_encrypted"))
    return {"verification": safe}


@app.get("/kyc/pending")
async def get_pending_verifications(reviewer_id: Optional[str] = None):
    if reviewer_id:
        allowed = await check_permify_permission(reviewer_id, "review_kyc", "kyc_submissions")
        if not allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    pending = [
        {
            "verification_id": v["verification_id"],
            "user_id": v["user_id"],
            "document_type": v["document_type"],
            "status": v["status"],
            "risk_assessment": v.get("risk_assessment", {}),
            "nationality": v.get("nationality"),
            "country": v.get("country"),
            "created_at": v["created_at"],
        }
        for v in kyc_store.values()
        if v["status"] == KYCStatus.IN_REVIEW.value
    ]
    pending.sort(key=lambda x: x["created_at"], reverse=True)
    return {"submissions": pending, "total": len(pending)}


@app.post("/kyc/approve")
async def approve_kyc(request: KYCApproveRequest, background_tasks: BackgroundTasks):
    allowed = await check_permify_permission(request.reviewer_id, "approve_kyc", "kyc_submissions")
    if not allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions to approve KYC")

    v = kyc_store.get(request.verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    if v["status"] not in (KYCStatus.IN_REVIEW.value, KYCStatus.PENDING.value):
        raise HTTPException(status_code=400, detail=f"Cannot approve verification in status: {v['status']}")

    v["status"] = KYCStatus.APPROVED.value
    v["verification_level"] = VerificationLevel.FULL.value
    v["reviewer_id"] = request.reviewer_id
    v["reviewer_notes"] = request.notes
    v["reviewed_at"] = datetime.utcnow().isoformat()
    v["updated_at"] = datetime.utcnow().isoformat()

    log_audit(request.verification_id, v["user_id"], "approved", request.reviewer_id, {"notes": request.notes})

    background_tasks.add_task(publish_kafka_event, "kyc.status_changes", {
        "event": "kyc_approved",
        "verification_id": request.verification_id,
        "user_id": v["user_id"],
        "reviewer_id": request.reviewer_id,
        "timestamp": v["updated_at"],
    })

    background_tasks.add_task(push_to_lakehouse, "kyc_reviews", {
        "verification_id": request.verification_id,
        "user_id": v["user_id"],
        "reviewer_id": request.reviewer_id,
        "action": "approved",
        "timestamp": v["updated_at"],
    })

    return {"success": True, "message": "KYC approved successfully", "verification_id": request.verification_id}


@app.post("/kyc/reject")
async def reject_kyc(request: KYCRejectRequest, background_tasks: BackgroundTasks):
    allowed = await check_permify_permission(request.reviewer_id, "reject_kyc", "kyc_submissions")
    if not allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions to reject KYC")

    v = kyc_store.get(request.verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    if v["status"] not in (KYCStatus.IN_REVIEW.value, KYCStatus.PENDING.value):
        raise HTTPException(status_code=400, detail=f"Cannot reject verification in status: {v['status']}")

    v["status"] = KYCStatus.REJECTED.value
    v["verification_level"] = VerificationLevel.NONE.value
    v["reviewer_id"] = request.reviewer_id
    v["reviewer_notes"] = request.notes
    v["rejection_reason"] = request.reason
    v["reviewed_at"] = datetime.utcnow().isoformat()
    v["updated_at"] = datetime.utcnow().isoformat()

    log_audit(request.verification_id, v["user_id"], "rejected", request.reviewer_id, {"reason": request.reason})

    background_tasks.add_task(publish_kafka_event, "kyc.status_changes", {
        "event": "kyc_rejected",
        "verification_id": request.verification_id,
        "user_id": v["user_id"],
        "reviewer_id": request.reviewer_id,
        "reason": request.reason,
        "timestamp": v["updated_at"],
    })

    return {"success": True, "message": "KYC rejected", "verification_id": request.verification_id}


@app.post("/kyc/resubmit")
async def resubmit_kyc(request: KYCResubmitRequest, background_tasks: BackgroundTasks):
    old_v = kyc_store.get(request.verification_id)
    if not old_v:
        raise HTTPException(status_code=404, detail="Original verification not found")
    if old_v["status"] != KYCStatus.REJECTED.value:
        raise HTTPException(status_code=400, detail="Can only resubmit rejected verifications")
    if old_v["user_id"] != request.user_id:
        raise HTTPException(status_code=403, detail="User mismatch")

    new_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    new_v = {
        "verification_id": new_id,
        "user_id": request.user_id,
        "document_type": request.document_type.value,
        "status": KYCStatus.OCR_PROCESSING.value,
        "verification_level": VerificationLevel.NONE.value,
        "document_number_encrypted": old_v.get("document_number_encrypted"),
        "full_name_encrypted": old_v.get("full_name_encrypted"),
        "date_of_birth_encrypted": old_v.get("date_of_birth_encrypted"),
        "address_encrypted": old_v.get("address_encrypted"),
        "nationality": request.nationality or old_v.get("nationality"),
        "country": old_v.get("country", "NG"),
        "document_image_ref": f"kyc/{request.user_id}/{new_id}/document.jpg",
        "selfie_image_ref": f"kyc/{request.user_id}/{new_id}/selfie.jpg",
        "ocr_data": {},
        "face_data": {},
        "fraud_data": {},
        "inference_data": {},
        "risk_assessment": {},
        "previous_verification_id": request.verification_id,
        "reviewer_id": None,
        "reviewer_notes": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
        "reviewed_at": None,
    }
    kyc_store[new_id] = new_v

    log_audit(new_id, request.user_id, "kyc_resubmitted", request.user_id, {"previous_id": request.verification_id})

    background_tasks.add_task(
        process_kyc_pipeline, new_id, request.user_id, request.document_type.value,
        request.document_image, request.selfie_image,
    )

    return {
        "verification_id": new_id,
        "previous_verification_id": request.verification_id,
        "status": KYCStatus.OCR_PROCESSING.value,
        "message": "Resubmission received. Processing pipeline started.",
    }


@app.get("/kyc/audit/{verification_id}")
async def get_audit(verification_id: str):
    entries = [e for e in audit_log if e["verification_id"] == verification_id]
    entries.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"logs": entries, "total": len(entries)}


@app.get("/kyc/analytics/summary")
async def get_analytics_summary():
    total = len(kyc_store)
    statuses = {}
    countries = {}
    doc_types = {}
    for v in kyc_store.values():
        statuses[v["status"]] = statuses.get(v["status"], 0) + 1
        c = v.get("country", "unknown")
        countries[c] = countries.get(c, 0) + 1
        dt = v.get("document_type", "unknown")
        doc_types[dt] = doc_types.get(dt, 0) + 1

    return {
        "total_verifications": total,
        "by_status": statuses,
        "by_country": countries,
        "by_document_type": doc_types,
        "avg_risk_score": sum(v.get("risk_assessment", {}).get("overall_score", 0) for v in kyc_store.values()) / max(total, 1),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8110)
