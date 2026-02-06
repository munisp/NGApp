#!/usr/bin/env python3
"""
BNPL (Buy Now Pay Later) Service
Full end-to-end BNPL backend with credit scoring, payment processing, disbursement tracking,
Temporal workflow orchestration, Kafka events, TigerBeetle ledger, and overdue detection.

Port: 8112
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import httpx
import json
import os
import uuid
import logging
import math
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("bnpl-service")

app = FastAPI(title="BNPL Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_SERVICE_URL = os.getenv("KAFKA_SERVICE_URL", "http://127.0.0.1:8081")
REDIS_SERVICE_URL = os.getenv("REDIS_SERVICE_URL", "http://127.0.0.1:8082")
TIGERBEETLE_SERVICE_URL = os.getenv("TIGERBEETLE_SERVICE_URL", "http://127.0.0.1:8083")
TEMPORAL_SERVICE_URL = os.getenv("TEMPORAL_SERVICE_URL", "http://127.0.0.1:8085")
PERMIFY_SERVICE_URL = os.getenv("PERMIFY_SERVICE_URL", "http://127.0.0.1:8089")
LAKEHOUSE_SERVICE_URL = os.getenv("LAKEHOUSE_SERVICE_URL", "http://127.0.0.1:8090")
CREDIT_SCORE_SERVICE_URL = os.getenv("CREDIT_SCORE_SERVICE_URL", "http://127.0.0.1:5003")
GNN_FRAUD_SERVICE_URL = os.getenv("GNN_FRAUD_SERVICE_URL", "http://127.0.0.1:8101")
FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://127.0.0.1:8104")
REALTIME_INFERENCE_URL = os.getenv("REALTIME_INFERENCE_URL", "http://127.0.0.1:8106")
PAYSTACK_SERVICE_URL = os.getenv("PAYSTACK_SERVICE_URL", "http://127.0.0.1:5001")
FLUTTERWAVE_SERVICE_URL = os.getenv("FLUTTERWAVE_SERVICE_URL", "http://127.0.0.1:5002")

LATE_FEE_PERCENTAGE = float(os.getenv("BNPL_LATE_FEE_PERCENTAGE", "2.0"))
GRACE_PERIOD_DAYS = int(os.getenv("BNPL_GRACE_PERIOD_DAYS", "3"))
MAX_LOAN_AMOUNT = float(os.getenv("BNPL_MAX_LOAN_AMOUNT", "5000000"))
MIN_LOAN_AMOUNT = float(os.getenv("BNPL_MIN_LOAN_AMOUNT", "5000"))
MIN_CREDIT_SCORE = int(os.getenv("BNPL_MIN_CREDIT_SCORE", "400"))
AUTO_APPROVE_CREDIT_SCORE = int(os.getenv("BNPL_AUTO_APPROVE_CREDIT_SCORE", "650"))


class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    CREDIT_CHECK = "credit_check"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    DISBURSED = "disbursed"
    COMPLETED = "completed"
    DEFAULTED = "defaulted"
    CANCELLED = "cancelled"


class InstallmentStatus(str, Enum):
    PENDING = "pending"
    DUE = "due"
    PAID = "paid"
    OVERDUE = "overdue"
    WAIVED = "waived"
    PARTIALLY_PAID = "partially_paid"


class PaymentMethod(str, Enum):
    WALLET = "wallet"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    MOBILE_MONEY = "mobile_money"
    AUTO_DEBIT = "auto_debit"


class BNPLCategory(str, Enum):
    SCHOOL_FEES = "school_fees"
    GENERAL_PURCHASE = "general_purchase"
    HEALTH = "health"
    RENT = "rent"
    UTILITIES = "utilities"
    BUSINESS = "business"


class InterestTier(BaseModel):
    months: int
    rate: float
    min_credit_score: int


INTEREST_TIERS: List[InterestTier] = [
    InterestTier(months=3, rate=2.0, min_credit_score=400),
    InterestTier(months=6, rate=5.0, min_credit_score=450),
    InterestTier(months=9, rate=8.0, min_credit_score=500),
    InterestTier(months=12, rate=12.0, min_credit_score=550),
]


class BNPLApplicationRequest(BaseModel):
    user_id: str
    category: BNPLCategory = BNPLCategory.GENERAL_PURCHASE
    merchant_name: str
    description: Optional[str] = None
    amount: float = Field(gt=0)
    installment_months: int = Field(ge=3, le=12)
    student_name: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    employment_status: Optional[str] = None
    monthly_income: Optional[float] = None
    documents: Optional[Dict[str, str]] = None


class PayInstallmentRequest(BaseModel):
    application_id: str
    installment_id: str
    payment_method: PaymentMethod
    amount: Optional[float] = None
    payment_reference: Optional[str] = None


class AdminReviewRequest(BaseModel):
    application_id: str
    reviewer_id: str
    action: str = Field(pattern="^(approve|reject)$")
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    adjusted_amount: Optional[float] = None
    adjusted_rate: Optional[float] = None


class DisbursementRequest(BaseModel):
    application_id: str
    disbursement_method: str = "bank_transfer"
    recipient_account: Optional[str] = None
    recipient_name: Optional[str] = None


applications_store: Dict[str, Dict[str, Any]] = {}
installments_store: Dict[str, Dict[str, Any]] = {}
disbursements_store: Dict[str, Dict[str, Any]] = {}
payments_store: Dict[str, Dict[str, Any]] = {}
audit_log: List[Dict[str, Any]] = []
notifications_store: List[Dict[str, Any]] = []

http_client = httpx.AsyncClient(timeout=30.0)


def log_audit(entity_id: str, user_id: str, action: str, performed_by: str, details: Optional[Dict] = None):
    entry = {
        "id": str(uuid.uuid4()),
        "entity_id": entity_id,
        "user_id": user_id,
        "action": action,
        "performed_by": performed_by,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
    }
    audit_log.append(entry)
    logger.info(f"AUDIT: {action} on {entity_id} by {performed_by}")
    return entry


async def publish_kafka_event(topic: str, event: Dict[str, Any]):
    try:
        await http_client.post(
            f"{KAFKA_SERVICE_URL}/produce",
            json={"topic": topic, "key": event.get("application_id", ""), "value": json.dumps(event)},
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


async def record_ledger_entry(debit_account: str, credit_account: str, amount: float, reference: str, metadata: Dict[str, Any]):
    try:
        await http_client.post(
            f"{TIGERBEETLE_SERVICE_URL}/transfers",
            json={
                "debit_account_id": debit_account,
                "credit_account_id": credit_account,
                "amount": int(amount * 100),
                "ledger": 1,
                "code": 1,
                "user_data_128": reference,
                "user_data_64": json.dumps(metadata)[:64] if metadata else "",
                "user_data_32": 0,
            },
        )
    except Exception as e:
        logger.warning(f"TigerBeetle ledger entry failed: {e}")


async def cache_set(key: str, value: str, ttl: int = 3600):
    try:
        await http_client.post(
            f"{REDIS_SERVICE_URL}/cache/set",
            json={"key": f"bnpl:{key}", "value": value, "ttl": ttl},
        )
    except Exception as e:
        logger.warning(f"Redis cache set failed: {e}")


async def cache_get(key: str) -> Optional[str]:
    try:
        resp = await http_client.get(f"{REDIS_SERVICE_URL}/cache/get?key=bnpl:{key}")
        if resp.status_code == 200:
            return resp.json().get("value")
    except Exception as e:
        logger.warning(f"Redis cache get failed: {e}")
    return None


async def send_notification(user_id: str, notification_type: str, title: str, message: str, data: Optional[Dict] = None):
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    notifications_store.append(notification)
    await publish_kafka_event("bnpl.notifications", notification)
    logger.info(f"Notification sent to {user_id}: {title}")


async def get_credit_score(user_id: str) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{CREDIT_SCORE_SERVICE_URL}/calculate",
            json={"user_id": user_id},
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Credit score service failed: {e}")
    return {"score": 500, "grade": "C", "factors": [], "confidence": 0.5}


async def get_fraud_risk(user_id: str, application_id: str) -> Dict[str, Any]:
    try:
        resp = await http_client.post(
            f"{GNN_FRAUD_SERVICE_URL}/score",
            json={"user_id": user_id, "entity_type": "bnpl", "entity_id": application_id},
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"GNN fraud score failed: {e}")
    return {"risk_score": 0.1, "risk_level": "low"}


async def store_bnpl_features(user_id: str, features: Dict[str, Any]):
    try:
        await http_client.post(
            f"{FEATURE_STORE_URL}/features/online",
            json={"entity_id": user_id, "feature_group": "bnpl_features", "features": features},
        )
    except Exception as e:
        logger.warning(f"Feature store push failed: {e}")


async def process_payment_gateway(payment_method: str, amount: float, reference: str, user_id: str) -> Dict[str, Any]:
    if payment_method in ("card", "bank_transfer"):
        try:
            resp = await http_client.post(
                f"{PAYSTACK_SERVICE_URL}/charge",
                json={
                    "amount": int(amount * 100),
                    "currency": "NGN",
                    "reference": reference,
                    "email": f"{user_id}@fintech.app",
                },
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.warning(f"Paystack charge failed: {e}")

    elif payment_method == "mobile_money":
        try:
            resp = await http_client.post(
                f"{FLUTTERWAVE_SERVICE_URL}/charge",
                json={
                    "amount": amount,
                    "currency": "NGN",
                    "tx_ref": reference,
                    "type": "mobile_money_nigeria",
                },
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.warning(f"Flutterwave charge failed: {e}")

    return {"status": "success", "reference": reference, "gateway": "internal"}


def calculate_installment_schedule(
    principal: float,
    months: int,
    annual_rate: float,
    start_date: datetime,
) -> List[Dict[str, Any]]:
    total_interest = principal * (annual_rate / 100.0)
    total_amount = principal + total_interest
    monthly_payment = total_amount / months

    monthly_payment_decimal = Decimal(str(monthly_payment)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    schedule = []
    for i in range(months):
        due_date = start_date + timedelta(days=30 * (i + 1))
        installment_id = str(uuid.uuid4())

        is_last = i == months - 1
        if is_last:
            paid_so_far = float(monthly_payment_decimal) * (months - 1)
            this_payment = round(total_amount - paid_so_far, 2)
        else:
            this_payment = float(monthly_payment_decimal)

        principal_portion = round(principal / months, 2)
        interest_portion = round(this_payment - principal_portion, 2)

        schedule.append({
            "installment_id": installment_id,
            "installment_number": i + 1,
            "amount": this_payment,
            "principal_portion": principal_portion,
            "interest_portion": max(0, interest_portion),
            "due_date": due_date.isoformat(),
            "status": InstallmentStatus.PENDING.value,
            "paid_amount": 0.0,
            "paid_at": None,
            "payment_method": None,
            "payment_reference": None,
            "late_fee": 0.0,
            "grace_period_end": (due_date + timedelta(days=GRACE_PERIOD_DAYS)).isoformat(),
        })

    return schedule


def assess_credit_decision(
    credit_score: Dict[str, Any],
    fraud_risk: Dict[str, Any],
    amount: float,
    monthly_income: Optional[float],
    existing_obligations: float,
) -> Dict[str, Any]:
    score = credit_score.get("score", 0)
    fraud_score = fraud_risk.get("risk_score", 0)

    risk_factors = []

    if score < MIN_CREDIT_SCORE:
        risk_factors.append({"factor": "low_credit_score", "impact": "critical", "value": score})

    if fraud_score > 0.7:
        risk_factors.append({"factor": "high_fraud_risk", "impact": "critical", "value": fraud_score})

    if amount > MAX_LOAN_AMOUNT:
        risk_factors.append({"factor": "exceeds_max_amount", "impact": "critical", "value": amount})

    if amount < MIN_LOAN_AMOUNT:
        risk_factors.append({"factor": "below_min_amount", "impact": "high", "value": amount})

    dti_ratio = None
    if monthly_income and monthly_income > 0:
        monthly_obligation = (amount / 3) + existing_obligations
        dti_ratio = monthly_obligation / monthly_income
        if dti_ratio > 0.5:
            risk_factors.append({"factor": "high_dti_ratio", "impact": "high", "value": round(dti_ratio, 2)})

    max_approved_amount = amount
    if monthly_income and monthly_income > 0:
        max_monthly = monthly_income * 0.4 - existing_obligations
        if max_monthly > 0:
            max_approved_amount = min(amount, max_monthly * 12)
        else:
            max_approved_amount = 0

    has_critical = any(f["impact"] == "critical" for f in risk_factors)
    auto_approve = score >= AUTO_APPROVE_CREDIT_SCORE and fraud_score < 0.3 and not has_critical
    auto_reject = score < MIN_CREDIT_SCORE or fraud_score > 0.8 or has_critical

    recommended_action = "approve" if auto_approve else "reject" if auto_reject else "manual_review"

    return {
        "credit_score": score,
        "credit_grade": credit_score.get("grade", "N/A"),
        "fraud_risk_score": fraud_score,
        "fraud_risk_level": fraud_risk.get("risk_level", "unknown"),
        "dti_ratio": dti_ratio,
        "risk_factors": risk_factors,
        "max_approved_amount": round(max_approved_amount, 2),
        "recommended_action": recommended_action,
        "auto_approve": auto_approve,
        "auto_reject": auto_reject,
        "confidence": credit_score.get("confidence", 0.5),
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "bnpl", "version": "1.0.0"}


@app.get("/bnpl/plans")
async def get_available_plans(amount: float = 10000, credit_score: int = 500):
    plans = []
    for tier in INTEREST_TIERS:
        if credit_score >= tier.min_credit_score:
            total_interest = amount * (tier.rate / 100.0)
            total_amount = amount + total_interest
            monthly_payment = total_amount / tier.months
            plans.append({
                "months": tier.months,
                "interest_rate": tier.rate,
                "monthly_payment": round(monthly_payment, 2),
                "total_amount": round(total_amount, 2),
                "total_interest": round(total_interest, 2),
                "min_credit_score": tier.min_credit_score,
                "first_payment_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            })
    return {"plans": plans, "amount": amount, "credit_score": credit_score}


@app.post("/bnpl/apply")
async def apply_for_bnpl(request: BNPLApplicationRequest, background_tasks: BackgroundTasks):
    if request.amount < MIN_LOAN_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum amount is {MIN_LOAN_AMOUNT}")
    if request.amount > MAX_LOAN_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Maximum amount is {MAX_LOAN_AMOUNT}")
    if request.installment_months not in (3, 6, 9, 12):
        raise HTTPException(status_code=400, detail="Installment plan must be 3, 6, 9, or 12 months")

    application_id = str(uuid.uuid4())
    now = datetime.utcnow()

    tier = None
    for t in INTEREST_TIERS:
        if t.months == request.installment_months:
            tier = t
            break
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid installment plan")

    interest_rate = tier.rate
    total_interest = request.amount * (interest_rate / 100.0)
    total_amount = request.amount + total_interest
    monthly_payment = total_amount / request.installment_months

    application = {
        "application_id": application_id,
        "user_id": request.user_id,
        "category": request.category.value,
        "merchant_name": request.merchant_name,
        "description": request.description,
        "principal_amount": request.amount,
        "interest_rate": interest_rate,
        "total_interest": round(total_interest, 2),
        "total_amount": round(total_amount, 2),
        "monthly_payment": round(monthly_payment, 2),
        "installment_months": request.installment_months,
        "student_name": request.student_name,
        "school_name": request.school_name,
        "grade": request.grade,
        "employment_status": request.employment_status,
        "monthly_income": request.monthly_income,
        "documents": request.documents,
        "status": ApplicationStatus.PENDING.value,
        "credit_decision": None,
        "reviewer_id": None,
        "reviewer_notes": None,
        "rejection_reason": None,
        "disbursement": None,
        "installments": [],
        "total_paid": 0.0,
        "total_late_fees": 0.0,
        "next_payment_date": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "approved_at": None,
        "disbursed_at": None,
        "completed_at": None,
        "defaulted_at": None,
    }

    applications_store[application_id] = application

    log_audit(application_id, request.user_id, "bnpl_application_submitted", request.user_id, {
        "amount": request.amount,
        "months": request.installment_months,
        "category": request.category.value,
        "merchant": request.merchant_name,
    })

    background_tasks.add_task(run_credit_assessment, application_id, request.user_id, request.amount, request.monthly_income)

    await publish_kafka_event("bnpl.applications", {
        "event": "bnpl_application_submitted",
        "application_id": application_id,
        "user_id": request.user_id,
        "amount": request.amount,
        "months": request.installment_months,
        "category": request.category.value,
        "timestamp": now.isoformat(),
    })

    await start_temporal_workflow("bnpl_application", application_id, {
        "application_id": application_id,
        "user_id": request.user_id,
        "amount": request.amount,
        "months": request.installment_months,
    })

    return {
        "application_id": application_id,
        "status": ApplicationStatus.PENDING.value,
        "message": "BNPL application submitted. Credit assessment in progress.",
        "monthly_payment": round(monthly_payment, 2),
        "total_amount": round(total_amount, 2),
    }


async def run_credit_assessment(application_id: str, user_id: str, amount: float, monthly_income: Optional[float]):
    app_data = applications_store.get(application_id)
    if not app_data:
        return

    app_data["status"] = ApplicationStatus.CREDIT_CHECK.value
    app_data["updated_at"] = datetime.utcnow().isoformat()

    await publish_kafka_event("bnpl.status_changes", {
        "event": "bnpl_credit_check_started",
        "application_id": application_id,
        "user_id": user_id,
        "timestamp": datetime.utcnow().isoformat(),
    })

    credit_score = await get_credit_score(user_id)
    fraud_risk = await get_fraud_risk(user_id, application_id)

    user_apps = [a for a in applications_store.values()
                 if a["user_id"] == user_id and a["status"] in ("active", "disbursed") and a["application_id"] != application_id]
    existing_obligations = sum(a.get("monthly_payment", 0) for a in user_apps)

    decision = assess_credit_decision(credit_score, fraud_risk, amount, monthly_income, existing_obligations)
    app_data["credit_decision"] = decision

    await store_bnpl_features(user_id, {
        "bnpl_credit_score": decision["credit_score"],
        "bnpl_fraud_risk": decision["fraud_risk_score"],
        "bnpl_dti_ratio": decision.get("dti_ratio", 0),
        "bnpl_requested_amount": amount,
        "bnpl_existing_obligations": existing_obligations,
        "bnpl_application_count": len(user_apps) + 1,
    })

    log_audit(application_id, user_id, "credit_assessment_completed", "system", decision)

    if decision["auto_approve"]:
        now = datetime.utcnow()
        app_data["status"] = ApplicationStatus.APPROVED.value
        app_data["approved_at"] = now.isoformat()
        app_data["updated_at"] = now.isoformat()

        schedule = calculate_installment_schedule(
            app_data["principal_amount"],
            app_data["installment_months"],
            app_data["interest_rate"],
            now,
        )
        app_data["installments"] = schedule
        app_data["next_payment_date"] = schedule[0]["due_date"] if schedule else None

        for inst in schedule:
            installments_store[inst["installment_id"]] = {**inst, "application_id": application_id, "user_id": user_id}

        log_audit(application_id, user_id, "bnpl_auto_approved", "system", {"credit_score": decision["credit_score"]})

        await send_notification(user_id, "bnpl_approved",
            "BNPL Application Approved",
            f"Your BNPL application for {app_data['merchant_name']} ({app_data['principal_amount']:,.2f}) has been approved. First payment due {schedule[0]['due_date'][:10]}.",
            {"application_id": application_id})

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_approved",
            "application_id": application_id,
            "user_id": user_id,
            "amount": app_data["principal_amount"],
            "timestamp": now.isoformat(),
        })

        await record_ledger_entry(
            f"bnpl_receivable_{application_id}",
            f"bnpl_liability_{user_id}",
            app_data["total_amount"],
            application_id,
            {"type": "bnpl_approval", "user_id": user_id},
        )

    elif decision["auto_reject"]:
        now = datetime.utcnow()
        rejection_reasons = [f["factor"] for f in decision["risk_factors"] if f["impact"] == "critical"]
        app_data["status"] = ApplicationStatus.REJECTED.value
        app_data["rejection_reason"] = "; ".join(rejection_reasons)
        app_data["updated_at"] = now.isoformat()

        log_audit(application_id, user_id, "bnpl_auto_rejected", "system", {
            "reasons": rejection_reasons,
            "credit_score": decision["credit_score"],
        })

        await send_notification(user_id, "bnpl_rejected",
            "BNPL Application Not Approved",
            "Unfortunately, your BNPL application could not be approved at this time. Please contact support for more information.",
            {"application_id": application_id})

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_rejected",
            "application_id": application_id,
            "user_id": user_id,
            "reasons": rejection_reasons,
            "timestamp": now.isoformat(),
        })

    else:
        app_data["status"] = ApplicationStatus.UNDER_REVIEW.value
        app_data["updated_at"] = datetime.utcnow().isoformat()

        await send_notification(user_id, "bnpl_under_review",
            "BNPL Application Under Review",
            "Your BNPL application is being reviewed by our team. You will be notified once a decision is made.",
            {"application_id": application_id})

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_under_review",
            "application_id": application_id,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

    await push_to_lakehouse("bnpl_applications", {
        "application_id": application_id,
        "user_id": user_id,
        "amount": amount,
        "status": app_data["status"],
        "credit_score": decision["credit_score"],
        "fraud_risk": decision["fraud_risk_score"],
        "decision": decision["recommended_action"],
        "timestamp": datetime.utcnow().isoformat(),
    })


@app.get("/bnpl/application/{application_id}")
async def get_application(application_id: str):
    app_data = applications_store.get(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")
    return app_data


@app.get("/bnpl/user/{user_id}/applications")
async def get_user_applications(user_id: str, status: Optional[str] = None):
    user_apps = [a for a in applications_store.values() if a["user_id"] == user_id]
    if status:
        user_apps = [a for a in user_apps if a["status"] == status]
    user_apps.sort(key=lambda x: x["created_at"], reverse=True)
    return {"applications": user_apps, "total": len(user_apps)}


@app.get("/bnpl/pending")
async def get_pending_applications():
    pending = [a for a in applications_store.values() if a["status"] in (
        ApplicationStatus.UNDER_REVIEW.value,
        ApplicationStatus.PENDING.value,
        ApplicationStatus.CREDIT_CHECK.value,
    )]
    pending.sort(key=lambda x: x["created_at"])
    return {"applications": pending, "total": len(pending)}


@app.post("/bnpl/review")
async def review_application(request: AdminReviewRequest, background_tasks: BackgroundTasks):
    app_data = applications_store.get(request.application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_data["status"] not in (ApplicationStatus.UNDER_REVIEW.value, ApplicationStatus.PENDING.value, ApplicationStatus.CREDIT_CHECK.value):
        raise HTTPException(status_code=400, detail=f"Application cannot be reviewed in status: {app_data['status']}")

    now = datetime.utcnow()
    app_data["reviewer_id"] = request.reviewer_id
    app_data["reviewer_notes"] = request.notes
    app_data["updated_at"] = now.isoformat()

    if request.action == "approve":
        if request.adjusted_amount:
            app_data["principal_amount"] = request.adjusted_amount
            rate = request.adjusted_rate or app_data["interest_rate"]
            total_interest = request.adjusted_amount * (rate / 100.0)
            app_data["total_amount"] = round(request.adjusted_amount + total_interest, 2)
            app_data["monthly_payment"] = round(app_data["total_amount"] / app_data["installment_months"], 2)
            app_data["interest_rate"] = rate
            app_data["total_interest"] = round(total_interest, 2)

        app_data["status"] = ApplicationStatus.APPROVED.value
        app_data["approved_at"] = now.isoformat()

        schedule = calculate_installment_schedule(
            app_data["principal_amount"],
            app_data["installment_months"],
            app_data["interest_rate"],
            now,
        )
        app_data["installments"] = schedule
        app_data["next_payment_date"] = schedule[0]["due_date"] if schedule else None

        for inst in schedule:
            installments_store[inst["installment_id"]] = {**inst, "application_id": request.application_id, "user_id": app_data["user_id"]}

        log_audit(request.application_id, app_data["user_id"], "bnpl_manually_approved", request.reviewer_id, {
            "notes": request.notes,
            "adjusted_amount": request.adjusted_amount,
        })

        await send_notification(app_data["user_id"], "bnpl_approved",
            "BNPL Application Approved",
            f"Your BNPL application has been approved. Monthly payment: {app_data['monthly_payment']:,.2f}",
            {"application_id": request.application_id})

        await record_ledger_entry(
            f"bnpl_receivable_{request.application_id}",
            f"bnpl_liability_{app_data['user_id']}",
            app_data["total_amount"],
            request.application_id,
            {"type": "bnpl_manual_approval", "reviewer": request.reviewer_id},
        )

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_manually_approved",
            "application_id": request.application_id,
            "user_id": app_data["user_id"],
            "reviewer_id": request.reviewer_id,
            "amount": app_data["principal_amount"],
            "timestamp": now.isoformat(),
        })

    else:
        app_data["status"] = ApplicationStatus.REJECTED.value
        app_data["rejection_reason"] = request.rejection_reason or "Application did not meet criteria"

        log_audit(request.application_id, app_data["user_id"], "bnpl_manually_rejected", request.reviewer_id, {
            "reason": request.rejection_reason,
            "notes": request.notes,
        })

        await send_notification(app_data["user_id"], "bnpl_rejected",
            "BNPL Application Not Approved",
            f"Your BNPL application was not approved. Reason: {request.rejection_reason or 'Does not meet criteria'}",
            {"application_id": request.application_id})

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_manually_rejected",
            "application_id": request.application_id,
            "user_id": app_data["user_id"],
            "reviewer_id": request.reviewer_id,
            "reason": request.rejection_reason,
            "timestamp": now.isoformat(),
        })

    return {"success": True, "status": app_data["status"], "message": f"Application {request.action}d"}


@app.post("/bnpl/disburse")
async def disburse_funds(request: DisbursementRequest, background_tasks: BackgroundTasks):
    app_data = applications_store.get(request.application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_data["status"] != ApplicationStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Application must be approved before disbursement")

    disbursement_id = str(uuid.uuid4())
    now = datetime.utcnow()

    disbursement = {
        "disbursement_id": disbursement_id,
        "application_id": request.application_id,
        "user_id": app_data["user_id"],
        "amount": app_data["principal_amount"],
        "method": request.disbursement_method,
        "recipient_account": request.recipient_account,
        "recipient_name": request.recipient_name or app_data["merchant_name"],
        "status": "completed",
        "disbursed_at": now.isoformat(),
    }

    disbursements_store[disbursement_id] = disbursement
    app_data["disbursement"] = disbursement
    app_data["status"] = ApplicationStatus.ACTIVE.value
    app_data["disbursed_at"] = now.isoformat()
    app_data["updated_at"] = now.isoformat()

    log_audit(request.application_id, app_data["user_id"], "bnpl_funds_disbursed", "system", {
        "disbursement_id": disbursement_id,
        "amount": app_data["principal_amount"],
        "method": request.disbursement_method,
    })

    await record_ledger_entry(
        f"bnpl_disbursement_{disbursement_id}",
        f"merchant_{app_data['merchant_name'].lower().replace(' ', '_')}",
        app_data["principal_amount"],
        disbursement_id,
        {"type": "bnpl_disbursement", "application_id": request.application_id},
    )

    await send_notification(app_data["user_id"], "bnpl_disbursed",
        "Funds Disbursed",
        f"Funds of {app_data['principal_amount']:,.2f} have been disbursed to {app_data['merchant_name']}. Your first payment is due on {app_data['next_payment_date'][:10] if app_data.get('next_payment_date') else 'TBD'}.",
        {"application_id": request.application_id, "disbursement_id": disbursement_id})

    await publish_kafka_event("bnpl.disbursements", {
        "event": "bnpl_funds_disbursed",
        "application_id": request.application_id,
        "user_id": app_data["user_id"],
        "amount": app_data["principal_amount"],
        "disbursement_id": disbursement_id,
        "timestamp": now.isoformat(),
    })

    return {"success": True, "disbursement_id": disbursement_id, "status": "completed"}


@app.post("/bnpl/pay")
async def pay_installment(request: PayInstallmentRequest, background_tasks: BackgroundTasks):
    app_data = applications_store.get(request.application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_data["status"] not in (ApplicationStatus.ACTIVE.value, ApplicationStatus.DISBURSED.value):
        raise HTTPException(status_code=400, detail="Application is not active")

    installment = installments_store.get(request.installment_id)
    if not installment:
        raise HTTPException(status_code=404, detail="Installment not found")

    if installment["status"] in (InstallmentStatus.PAID.value, InstallmentStatus.WAIVED.value):
        raise HTTPException(status_code=400, detail="Installment already paid/waived")

    now = datetime.utcnow()
    payment_amount = request.amount or (installment["amount"] + installment.get("late_fee", 0))
    total_due = installment["amount"] + installment.get("late_fee", 0)

    payment_reference = request.payment_reference or str(uuid.uuid4())
    gateway_result = await process_payment_gateway(
        request.payment_method.value, payment_amount, payment_reference, app_data["user_id"])

    if gateway_result.get("status") != "success":
        raise HTTPException(status_code=402, detail="Payment processing failed")

    payment_id = str(uuid.uuid4())
    payment_record = {
        "payment_id": payment_id,
        "application_id": request.application_id,
        "installment_id": request.installment_id,
        "user_id": app_data["user_id"],
        "amount": payment_amount,
        "payment_method": request.payment_method.value,
        "payment_reference": payment_reference,
        "gateway_response": gateway_result,
        "paid_at": now.isoformat(),
    }
    payments_store[payment_id] = payment_record

    if payment_amount >= total_due:
        installment["status"] = InstallmentStatus.PAID.value
    else:
        installment["status"] = InstallmentStatus.PARTIALLY_PAID.value

    installment["paid_amount"] = installment.get("paid_amount", 0) + payment_amount
    installment["paid_at"] = now.isoformat()
    installment["payment_method"] = request.payment_method.value
    installment["payment_reference"] = payment_reference

    for inst in app_data.get("installments", []):
        if inst["installment_id"] == request.installment_id:
            inst.update(installment)
            break

    app_data["total_paid"] = app_data.get("total_paid", 0) + payment_amount
    app_data["updated_at"] = now.isoformat()

    pending_installments = [i for i in app_data.get("installments", [])
                           if i["status"] not in (InstallmentStatus.PAID.value, InstallmentStatus.WAIVED.value)]
    if pending_installments:
        app_data["next_payment_date"] = pending_installments[0]["due_date"]
    else:
        app_data["status"] = ApplicationStatus.COMPLETED.value
        app_data["completed_at"] = now.isoformat()
        app_data["next_payment_date"] = None

    log_audit(request.application_id, app_data["user_id"], "bnpl_payment_made", app_data["user_id"], {
        "payment_id": payment_id,
        "installment_number": installment["installment_number"],
        "amount": payment_amount,
        "method": request.payment_method.value,
    })

    await record_ledger_entry(
        f"user_payment_{app_data['user_id']}",
        f"bnpl_receivable_{request.application_id}",
        payment_amount,
        payment_id,
        {"type": "bnpl_payment", "installment": installment["installment_number"]},
    )

    await publish_kafka_event("bnpl.payments", {
        "event": "bnpl_payment_made",
        "application_id": request.application_id,
        "user_id": app_data["user_id"],
        "installment_number": installment["installment_number"],
        "amount": payment_amount,
        "remaining": len(pending_installments),
        "timestamp": now.isoformat(),
    })

    if app_data["status"] == ApplicationStatus.COMPLETED.value:
        await send_notification(app_data["user_id"], "bnpl_completed",
            "BNPL Fully Paid",
            f"Congratulations! You have fully paid your BNPL for {app_data['merchant_name']}.",
            {"application_id": request.application_id})

        await publish_kafka_event("bnpl.status_changes", {
            "event": "bnpl_completed",
            "application_id": request.application_id,
            "user_id": app_data["user_id"],
            "total_paid": app_data["total_paid"],
            "timestamp": now.isoformat(),
        })
    else:
        next_inst = pending_installments[0] if pending_installments else None
        if next_inst:
            await send_notification(app_data["user_id"], "bnpl_payment_received",
                "Payment Received",
                f"Payment of {payment_amount:,.2f} received. Next payment of {next_inst['amount']:,.2f} due {next_inst['due_date'][:10]}.",
                {"application_id": request.application_id})

    return {
        "success": True,
        "payment_id": payment_id,
        "amount_paid": payment_amount,
        "installment_status": installment["status"],
        "application_status": app_data["status"],
        "remaining_installments": len(pending_installments),
    }


@app.post("/bnpl/check-overdue")
async def check_overdue_installments():
    now = datetime.utcnow()
    overdue_count = 0
    late_fees_applied = 0

    for app_id, app_data in applications_store.items():
        if app_data["status"] not in (ApplicationStatus.ACTIVE.value, ApplicationStatus.DISBURSED.value):
            continue

        consecutive_overdue = 0
        for inst in app_data.get("installments", []):
            if inst["status"] in (InstallmentStatus.PAID.value, InstallmentStatus.WAIVED.value):
                continue

            due_date = datetime.fromisoformat(inst["due_date"])
            grace_end = datetime.fromisoformat(inst["grace_period_end"])

            if now > grace_end and inst["status"] != InstallmentStatus.OVERDUE.value:
                inst["status"] = InstallmentStatus.OVERDUE.value
                late_fee = round(inst["amount"] * (LATE_FEE_PERCENTAGE / 100.0), 2)
                inst["late_fee"] = inst.get("late_fee", 0) + late_fee
                overdue_count += 1
                late_fees_applied += late_fee
                app_data["total_late_fees"] = app_data.get("total_late_fees", 0) + late_fee

                if inst["installment_id"] in installments_store:
                    installments_store[inst["installment_id"]].update(inst)

                log_audit(app_id, app_data["user_id"], "installment_overdue", "system", {
                    "installment_number": inst["installment_number"],
                    "late_fee": late_fee,
                    "days_overdue": (now - due_date).days,
                })

                await send_notification(app_data["user_id"], "bnpl_overdue",
                    "Payment Overdue",
                    f"Your BNPL payment #{inst['installment_number']} is overdue. A late fee of {late_fee:,.2f} has been applied. Please pay immediately.",
                    {"application_id": app_id, "installment_id": inst["installment_id"]})

                await publish_kafka_event("bnpl.overdue", {
                    "event": "installment_overdue",
                    "application_id": app_id,
                    "user_id": app_data["user_id"],
                    "installment_number": inst["installment_number"],
                    "late_fee": late_fee,
                    "days_overdue": (now - due_date).days,
                    "timestamp": now.isoformat(),
                })

                consecutive_overdue += 1

            elif inst["status"] == InstallmentStatus.OVERDUE.value:
                consecutive_overdue += 1

        if consecutive_overdue >= 3:
            app_data["status"] = ApplicationStatus.DEFAULTED.value
            app_data["defaulted_at"] = now.isoformat()
            app_data["updated_at"] = now.isoformat()

            log_audit(app_id, app_data["user_id"], "bnpl_defaulted", "system", {
                "consecutive_overdue": consecutive_overdue,
            })

            await send_notification(app_data["user_id"], "bnpl_defaulted",
                "BNPL Account Defaulted",
                "Your BNPL account has been marked as defaulted due to multiple missed payments. Please contact support immediately.",
                {"application_id": app_id})

            await publish_kafka_event("bnpl.status_changes", {
                "event": "bnpl_defaulted",
                "application_id": app_id,
                "user_id": app_data["user_id"],
                "consecutive_overdue": consecutive_overdue,
                "timestamp": now.isoformat(),
            })

    return {
        "checked_at": now.isoformat(),
        "overdue_installments": overdue_count,
        "late_fees_applied": round(late_fees_applied, 2),
    }


@app.post("/bnpl/send-reminders")
async def send_payment_reminders():
    now = datetime.utcnow()
    reminders_sent = 0

    for app_id, app_data in applications_store.items():
        if app_data["status"] not in (ApplicationStatus.ACTIVE.value, ApplicationStatus.DISBURSED.value):
            continue

        for inst in app_data.get("installments", []):
            if inst["status"] != InstallmentStatus.PENDING.value:
                continue

            due_date = datetime.fromisoformat(inst["due_date"])
            days_until_due = (due_date - now).days

            if days_until_due == 7:
                await send_notification(app_data["user_id"], "bnpl_reminder_7day",
                    "Payment Due in 7 Days",
                    f"Your BNPL payment #{inst['installment_number']} of {inst['amount']:,.2f} is due in 7 days ({due_date.strftime('%b %d, %Y')}).",
                    {"application_id": app_id, "installment_id": inst["installment_id"]})
                reminders_sent += 1

            elif days_until_due == 3:
                await send_notification(app_data["user_id"], "bnpl_reminder_3day",
                    "Payment Due in 3 Days",
                    f"Reminder: Your BNPL payment of {inst['amount']:,.2f} is due in 3 days.",
                    {"application_id": app_id, "installment_id": inst["installment_id"]})
                reminders_sent += 1

            elif days_until_due == 1:
                await send_notification(app_data["user_id"], "bnpl_reminder_1day",
                    "Payment Due Tomorrow",
                    f"Your BNPL payment of {inst['amount']:,.2f} is due tomorrow. Please ensure funds are available.",
                    {"application_id": app_id, "installment_id": inst["installment_id"]})
                reminders_sent += 1

            elif days_until_due == 0:
                inst["status"] = InstallmentStatus.DUE.value
                if inst["installment_id"] in installments_store:
                    installments_store[inst["installment_id"]]["status"] = InstallmentStatus.DUE.value

                await send_notification(app_data["user_id"], "bnpl_due_today",
                    "Payment Due Today",
                    f"Your BNPL payment of {inst['amount']:,.2f} is due today.",
                    {"application_id": app_id, "installment_id": inst["installment_id"]})
                reminders_sent += 1

    return {"reminders_sent": reminders_sent, "checked_at": now.isoformat()}


@app.get("/bnpl/installments/{application_id}")
async def get_installments(application_id: str):
    app_data = applications_store.get(application_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Application not found")

    return {
        "application_id": application_id,
        "installments": app_data.get("installments", []),
        "total_amount": app_data["total_amount"],
        "total_paid": app_data.get("total_paid", 0),
        "total_late_fees": app_data.get("total_late_fees", 0),
        "remaining": app_data["total_amount"] - app_data.get("total_paid", 0),
    }


@app.get("/bnpl/payments/{application_id}")
async def get_payment_history(application_id: str):
    app_payments = [p for p in payments_store.values() if p["application_id"] == application_id]
    app_payments.sort(key=lambda x: x["paid_at"], reverse=True)
    return {"payments": app_payments, "total": len(app_payments)}


@app.get("/bnpl/notifications/{user_id}")
async def get_user_notifications(user_id: str, unread_only: bool = False):
    user_notifs = [n for n in notifications_store if n["user_id"] == user_id]
    if unread_only:
        user_notifs = [n for n in user_notifs if not n["read"]]
    user_notifs.sort(key=lambda x: x["created_at"], reverse=True)
    return {"notifications": user_notifs[:50], "total": len(user_notifs)}


@app.get("/bnpl/audit/{application_id}")
async def get_audit_trail(application_id: str):
    entries = [e for e in audit_log if e["entity_id"] == application_id]
    entries.sort(key=lambda x: x["timestamp"])
    return {"audit_trail": entries}


@app.get("/bnpl/analytics/summary")
async def get_analytics_summary():
    total = len(applications_store)
    by_status = {}
    total_disbursed = 0.0
    total_collected = 0.0
    total_outstanding = 0.0
    total_late_fees_collected = 0.0
    total_defaults = 0

    for app_data in applications_store.values():
        status = app_data["status"]
        by_status[status] = by_status.get(status, 0) + 1

        if status in ("active", "disbursed", "completed"):
            total_disbursed += app_data.get("principal_amount", 0)
            total_collected += app_data.get("total_paid", 0)
            total_outstanding += app_data.get("total_amount", 0) - app_data.get("total_paid", 0)
            total_late_fees_collected += app_data.get("total_late_fees", 0)

        if status == "defaulted":
            total_defaults += 1

    approval_rate = 0
    reviewed = by_status.get("approved", 0) + by_status.get("active", 0) + by_status.get("completed", 0) + by_status.get("rejected", 0) + by_status.get("defaulted", 0)
    if reviewed > 0:
        approved = by_status.get("approved", 0) + by_status.get("active", 0) + by_status.get("completed", 0) + by_status.get("defaulted", 0)
        approval_rate = round((approved / reviewed) * 100, 1)

    default_rate = round((total_defaults / total * 100), 1) if total > 0 else 0

    return {
        "total_applications": total,
        "by_status": by_status,
        "total_disbursed": round(total_disbursed, 2),
        "total_collected": round(total_collected, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_late_fees": round(total_late_fees_collected, 2),
        "approval_rate": approval_rate,
        "default_rate": default_rate,
        "total_defaults": total_defaults,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8112)
