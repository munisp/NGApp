from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from enum import Enum
import uuid
import math

app = FastAPI(title="Insurance & Health Service", version="1.0.0")

class InsuranceType(str, Enum):
    health = "health"
    life = "life"
    auto = "auto"
    property = "property"
    travel = "travel"
    crop = "crop"
    micro = "micro"
    business = "business"

class ClaimStatus(str, Enum):
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"

class PolicyStatus(str, Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"
    pending = "pending"
    lapsed = "lapsed"

class PremiumFrequency(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    annually = "annually"
    one_time = "one_time"

class InsuranceProduct(BaseModel):
    id: str
    name: str
    type: InsuranceType
    description: str
    base_premium: float
    currency: str
    coverage_amount: float
    deductible: float
    features: list[str]
    exclusions: list[str]
    min_age: int
    max_age: int
    waiting_period_days: int
    active: bool

class Policy(BaseModel):
    id: str
    user_id: str
    product_id: str
    product_name: str
    type: InsuranceType
    status: PolicyStatus
    premium: float
    premium_frequency: PremiumFrequency
    coverage_amount: float
    deductible: float
    currency: str
    start_date: datetime
    end_date: datetime
    beneficiaries: list[dict]
    auto_renew: bool
    created_at: datetime

class Claim(BaseModel):
    id: str
    policy_id: str
    user_id: str
    type: str
    description: str
    amount_claimed: float
    amount_approved: Optional[float] = None
    status: ClaimStatus
    documents: list[str]
    reviewer_notes: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

class PremiumQuoteRequest(BaseModel):
    product_id: str
    age: int
    gender: str
    pre_existing_conditions: list[str] = []
    coverage_amount: Optional[float] = None
    frequency: PremiumFrequency = PremiumFrequency.monthly
    location: str = "lagos"
    occupation_risk: str = "low"

class PolicyCreateRequest(BaseModel):
    user_id: str
    product_id: str
    premium_frequency: PremiumFrequency
    coverage_amount: Optional[float] = None
    beneficiaries: list[dict] = []
    auto_renew: bool = True
    age: int = 30
    gender: str = "male"
    pre_existing_conditions: list[str] = []

class ClaimSubmitRequest(BaseModel):
    policy_id: str
    user_id: str
    type: str
    description: str
    amount_claimed: float
    documents: list[str] = []

class ClaimReviewRequest(BaseModel):
    claim_id: str
    reviewer_id: str
    status: ClaimStatus
    amount_approved: Optional[float] = None
    notes: str = ""

products_db: dict[str, InsuranceProduct] = {}
policies_db: dict[str, Policy] = {}
claims_db: dict[str, Claim] = {}
premium_payments: list[dict] = []

def init_products():
    catalog = [
        {
            "name": "AfriHealth Basic",
            "type": InsuranceType.health,
            "description": "Basic health coverage for individuals. Covers hospitalization, surgery, and emergency care across partner hospitals in Nigeria, Kenya, Ghana, and South Africa.",
            "base_premium": 15000.0,
            "currency": "NGN",
            "coverage_amount": 5000000.0,
            "deductible": 50000.0,
            "features": [
                "Hospitalization up to 30 days",
                "Emergency room visits",
                "Surgery coverage",
                "Ambulance services",
                "Lab tests and diagnostics",
                "Prescription medications",
            ],
            "exclusions": ["Cosmetic surgery", "Dental (non-emergency)", "Pre-existing conditions (first 12 months)"],
            "min_age": 18, "max_age": 65,
            "waiting_period_days": 30,
        },
        {
            "name": "AfriHealth Premium",
            "type": InsuranceType.health,
            "description": "Comprehensive health coverage including dental, optical, maternity, and mental health services.",
            "base_premium": 45000.0,
            "currency": "NGN",
            "coverage_amount": 20000000.0,
            "deductible": 25000.0,
            "features": [
                "Everything in Basic",
                "Dental coverage",
                "Optical coverage",
                "Maternity and childbirth",
                "Mental health services",
                "International emergency coverage",
                "Annual health checkup",
                "Telemedicine consultations",
            ],
            "exclusions": ["Cosmetic surgery", "Experimental treatments"],
            "min_age": 18, "max_age": 70,
            "waiting_period_days": 14,
        },
        {
            "name": "AfriLife Term",
            "type": InsuranceType.life,
            "description": "Term life insurance with death benefit and optional critical illness rider.",
            "base_premium": 8000.0,
            "currency": "NGN",
            "coverage_amount": 10000000.0,
            "deductible": 0.0,
            "features": [
                "Death benefit payout",
                "Critical illness rider",
                "Accidental death benefit (2x)",
                "Funeral expense coverage",
                "Premium waiver on disability",
            ],
            "exclusions": ["Suicide (first 2 years)", "Criminal activity", "War and terrorism"],
            "min_age": 18, "max_age": 60,
            "waiting_period_days": 0,
        },
        {
            "name": "AfriAuto Comprehensive",
            "type": InsuranceType.auto,
            "description": "Comprehensive vehicle insurance for cars and motorcycles.",
            "base_premium": 35000.0,
            "currency": "NGN",
            "coverage_amount": 15000000.0,
            "deductible": 100000.0,
            "features": [
                "Third-party liability",
                "Own damage coverage",
                "Theft protection",
                "Fire damage",
                "Windscreen coverage",
                "Roadside assistance",
                "Passenger liability",
            ],
            "exclusions": ["Mechanical breakdown", "Wear and tear", "Driving under influence"],
            "min_age": 18, "max_age": 75,
            "waiting_period_days": 0,
        },
        {
            "name": "AfriTravel Shield",
            "type": InsuranceType.travel,
            "description": "Travel insurance covering medical emergencies, trip cancellation, and lost baggage for African and international travel.",
            "base_premium": 5000.0,
            "currency": "NGN",
            "coverage_amount": 2000000.0,
            "deductible": 10000.0,
            "features": [
                "Medical emergency abroad",
                "Trip cancellation/interruption",
                "Lost/delayed baggage",
                "Flight delay compensation",
                "Emergency evacuation",
                "Personal liability",
            ],
            "exclusions": ["Pre-existing conditions", "Adventure sports (without rider)", "Travel against govt advisory"],
            "min_age": 1, "max_age": 80,
            "waiting_period_days": 0,
        },
        {
            "name": "AfriCrop Protect",
            "type": InsuranceType.crop,
            "description": "Agricultural insurance for smallholder farmers. Weather-indexed and area-yield based coverage.",
            "base_premium": 3000.0,
            "currency": "NGN",
            "coverage_amount": 500000.0,
            "deductible": 20000.0,
            "features": [
                "Drought protection",
                "Flood damage coverage",
                "Pest and disease coverage",
                "Weather-indexed payouts",
                "Satellite-based monitoring",
                "Quick claim settlement (72hrs)",
            ],
            "exclusions": ["Negligent farming practices", "Government land seizure"],
            "min_age": 18, "max_age": 70,
            "waiting_period_days": 7,
        },
        {
            "name": "AfriMicro Shield",
            "type": InsuranceType.micro,
            "description": "Affordable micro-insurance for low-income earners. Mobile money premium payment.",
            "base_premium": 500.0,
            "currency": "NGN",
            "coverage_amount": 100000.0,
            "deductible": 0.0,
            "features": [
                "Hospital cash benefit",
                "Accidental death benefit",
                "Mobile money premium payment",
                "SMS claim submission",
                "24hr claim processing",
                "No medical exam required",
            ],
            "exclusions": ["Pre-existing conditions", "Self-inflicted injuries"],
            "min_age": 18, "max_age": 60,
            "waiting_period_days": 7,
        },
        {
            "name": "AfriBusiness Guard",
            "type": InsuranceType.business,
            "description": "Business insurance covering property, liability, and business interruption.",
            "base_premium": 50000.0,
            "currency": "NGN",
            "coverage_amount": 50000000.0,
            "deductible": 200000.0,
            "features": [
                "Business property coverage",
                "General liability",
                "Business interruption",
                "Employee dishonesty",
                "Cyber liability",
                "Professional indemnity",
                "Product liability",
            ],
            "exclusions": ["War and civil unrest", "Nuclear hazard", "Intentional acts"],
            "min_age": 18, "max_age": 75,
            "waiting_period_days": 14,
        },
    ]

    for i, p in enumerate(catalog):
        pid = f"prod_{i+1}"
        products_db[pid] = InsuranceProduct(id=pid, active=True, **p)

init_products()

def calculate_premium(product: InsuranceProduct, age: int, gender: str,
                      conditions: list[str], coverage: float,
                      frequency: PremiumFrequency, location: str,
                      occupation_risk: str) -> dict:
    base = product.base_premium
    if coverage and coverage != product.coverage_amount:
        base = base * (coverage / product.coverage_amount)

    age_factor = 1.0
    if age < 25:
        age_factor = 1.15
    elif age < 35:
        age_factor = 1.0
    elif age < 45:
        age_factor = 1.2
    elif age < 55:
        age_factor = 1.5
    elif age < 65:
        age_factor = 2.0
    else:
        age_factor = 2.5

    gender_factor = 1.0 if gender == "female" else 1.05

    condition_factor = 1.0 + len(conditions) * 0.15

    location_factors = {
        "lagos": 1.1, "abuja": 1.05, "nairobi": 1.0,
        "accra": 0.95, "johannesburg": 1.1, "cape_town": 1.05,
        "dar_es_salaam": 0.9, "kampala": 0.9,
    }
    loc_factor = location_factors.get(location.lower(), 1.0)

    occ_factors = {"low": 1.0, "medium": 1.2, "high": 1.5, "hazardous": 2.0}
    occ_factor = occ_factors.get(occupation_risk, 1.0)

    annual = base * age_factor * gender_factor * condition_factor * loc_factor * occ_factor
    annual = math.ceil(annual / 100) * 100

    freq_map = {
        PremiumFrequency.annually: (annual, 1),
        PremiumFrequency.quarterly: (math.ceil(annual / 4 * 1.02 / 100) * 100, 4),
        PremiumFrequency.monthly: (math.ceil(annual / 12 * 1.05 / 100) * 100, 12),
        PremiumFrequency.one_time: (annual, 1),
    }
    premium, payments_per_year = freq_map[frequency]

    return {
        "annual_premium": annual,
        "premium_per_period": premium,
        "frequency": frequency.value,
        "payments_per_year": payments_per_year,
        "coverage_amount": coverage or product.coverage_amount,
        "deductible": product.deductible,
        "factors": {
            "base": base,
            "age_factor": age_factor,
            "gender_factor": gender_factor,
            "condition_factor": condition_factor,
            "location_factor": loc_factor,
            "occupation_factor": occ_factor,
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "insurance-health",
        "version": "1.0.0",
        "products": len(products_db),
        "policies": len(policies_db),
        "claims": len(claims_db),
    }


@app.get("/products")
def list_products(type: Optional[str] = None):
    prods = list(products_db.values())
    if type:
        prods = [p for p in prods if p.type.value == type]
    return {"products": [p.dict() for p in prods], "total": len(prods)}


@app.get("/products/{product_id}")
def get_product(product_id: str):
    p = products_db.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p.dict()


@app.post("/quotes")
def get_premium_quote(req: PremiumQuoteRequest):
    product = products_db.get(req.product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    if req.age < product.min_age or req.age > product.max_age:
        raise HTTPException(400, f"Age must be between {product.min_age} and {product.max_age}")

    quote = calculate_premium(
        product, req.age, req.gender, req.pre_existing_conditions,
        req.coverage_amount or product.coverage_amount, req.frequency,
        req.location, req.occupation_risk,
    )
    quote["product"] = {"id": product.id, "name": product.name, "type": product.type.value}
    quote["quote_id"] = str(uuid.uuid4())[:8]
    quote["valid_until"] = (datetime.utcnow() + timedelta(days=30)).isoformat()
    return quote


@app.post("/policies")
def create_policy(req: PolicyCreateRequest):
    product = products_db.get(req.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    coverage = req.coverage_amount or product.coverage_amount
    quote = calculate_premium(
        product, req.age, req.gender, req.pre_existing_conditions,
        coverage, req.premium_frequency, "lagos", "low",
    )

    policy_id = f"pol_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    end = now + timedelta(days=365)

    policy = Policy(
        id=policy_id,
        user_id=req.user_id,
        product_id=product.id,
        product_name=product.name,
        type=product.type,
        status=PolicyStatus.active,
        premium=quote["premium_per_period"],
        premium_frequency=req.premium_frequency,
        coverage_amount=coverage,
        deductible=product.deductible,
        currency=product.currency,
        start_date=now,
        end_date=end,
        beneficiaries=req.beneficiaries,
        auto_renew=req.auto_renew,
        created_at=now,
    )
    policies_db[policy_id] = policy
    return policy.dict()


@app.get("/policies")
def list_policies(user_id: str):
    user_policies = [p.dict() for p in policies_db.values() if p.user_id == user_id]
    return {"policies": user_policies, "total": len(user_policies)}


@app.get("/policies/{policy_id}")
def get_policy(policy_id: str):
    p = policies_db.get(policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    return p.dict()


@app.post("/policies/{policy_id}/cancel")
def cancel_policy(policy_id: str):
    p = policies_db.get(policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    p.status = PolicyStatus.cancelled
    return {"policy_id": policy_id, "status": "cancelled"}


@app.post("/policies/{policy_id}/renew")
def renew_policy(policy_id: str):
    p = policies_db.get(policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    p.start_date = datetime.utcnow()
    p.end_date = datetime.utcnow() + timedelta(days=365)
    p.status = PolicyStatus.active
    return p.dict()


@app.post("/claims")
def submit_claim(req: ClaimSubmitRequest):
    policy = policies_db.get(req.policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    if policy.status != PolicyStatus.active:
        raise HTTPException(400, "Policy is not active")
    if policy.user_id != req.user_id:
        raise HTTPException(403, "Policy does not belong to user")
    if req.amount_claimed > policy.coverage_amount:
        raise HTTPException(400, "Claim amount exceeds coverage")

    claim_id = f"clm_{uuid.uuid4().hex[:8]}"
    claim = Claim(
        id=claim_id,
        policy_id=req.policy_id,
        user_id=req.user_id,
        type=req.type,
        description=req.description,
        amount_claimed=req.amount_claimed,
        status=ClaimStatus.submitted,
        documents=req.documents,
        submitted_at=datetime.utcnow(),
    )
    claims_db[claim_id] = claim
    return claim.dict()


@app.get("/claims")
def list_claims(user_id: Optional[str] = None, policy_id: Optional[str] = None, status: Optional[str] = None):
    result = list(claims_db.values())
    if user_id:
        result = [c for c in result if c.user_id == user_id]
    if policy_id:
        result = [c for c in result if c.policy_id == policy_id]
    if status:
        result = [c for c in result if c.status.value == status]
    return {"claims": [c.dict() for c in result], "total": len(result)}


@app.get("/claims/{claim_id}")
def get_claim(claim_id: str):
    c = claims_db.get(claim_id)
    if not c:
        raise HTTPException(404, "Claim not found")
    return c.dict()


@app.post("/claims/review")
def review_claim(req: ClaimReviewRequest):
    claim = claims_db.get(req.claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found")

    claim.status = req.status
    claim.reviewer_notes = req.notes
    claim.reviewed_at = datetime.utcnow()

    if req.status == ClaimStatus.approved:
        policy = policies_db.get(claim.policy_id)
        approved = req.amount_approved or claim.amount_claimed
        if policy:
            approved = min(approved, policy.coverage_amount)
            approved = max(0, approved - policy.deductible)
        claim.amount_approved = approved

    return claim.dict()


@app.post("/premium/pay")
def pay_premium(user_id: str, policy_id: str, amount: float, method: str = "wallet"):
    policy = policies_db.get(policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    if policy.user_id != user_id:
        raise HTTPException(403, "Not authorized")

    payment = {
        "id": f"ppay_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "policy_id": policy_id,
        "amount": amount,
        "method": method,
        "status": "completed",
        "paid_at": datetime.utcnow().isoformat(),
    }
    premium_payments.append(payment)

    if policy.status == PolicyStatus.lapsed:
        policy.status = PolicyStatus.active

    return payment


@app.get("/premium/history")
def premium_history(user_id: str):
    user_payments = [p for p in premium_payments if p["user_id"] == user_id]
    return {"payments": user_payments, "total": len(user_payments)}


@app.get("/analytics/summary")
def analytics_summary():
    total_policies = len(policies_db)
    active = sum(1 for p in policies_db.values() if p.status == PolicyStatus.active)
    total_claims = len(claims_db)
    approved_claims = sum(1 for c in claims_db.values() if c.status == ClaimStatus.approved)
    total_premium = sum(p["amount"] for p in premium_payments)
    total_paid = sum(c.amount_approved or 0 for c in claims_db.values() if c.status in [ClaimStatus.approved, ClaimStatus.paid])
    by_type = {}
    for p in policies_db.values():
        t = p.type.value
        by_type[t] = by_type.get(t, 0) + 1

    return {
        "total_policies": total_policies,
        "active_policies": active,
        "total_claims": total_claims,
        "approved_claims": approved_claims,
        "claim_approval_rate": approved_claims / total_claims if total_claims else 0,
        "total_premium_collected": total_premium,
        "total_claims_paid": total_paid,
        "loss_ratio": total_paid / total_premium if total_premium else 0,
        "policies_by_type": by_type,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8115)
