from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid
import math

app = FastAPI(title="Tax & Financial Planning Service", version="1.0.0")

class FilingStatus(str, Enum):
    single = "single"
    married_joint = "married_joint"
    married_separate = "married_separate"
    head_of_household = "head_of_household"
    business = "business"

class TaxJurisdiction(str, Enum):
    nigeria = "NG"
    kenya = "KE"
    ghana = "GH"
    south_africa = "ZA"
    tanzania = "TZ"
    uganda = "UG"

TAX_BRACKETS = {
    TaxJurisdiction.nigeria: [
        (300000, 0.07), (300000, 0.11), (500000, 0.15),
        (500000, 0.19), (1600000, 0.21), (float("inf"), 0.24),
    ],
    TaxJurisdiction.kenya: [
        (288000, 0.10), (100000, 0.25), (5664000, 0.30),
        (3600000, 0.325), (float("inf"), 0.35),
    ],
    TaxJurisdiction.ghana: [
        (4824, 0.0), (1320, 0.05), (1560, 0.10),
        (36000, 0.175), (196740, 0.25), (float("inf"), 0.30),
    ],
    TaxJurisdiction.south_africa: [
        (226000, 0.18), (127000, 0.26), (192000, 0.31),
        (131000, 0.36), (175000, 0.39), (435000, 0.41),
        (float("inf"), 0.45),
    ],
}

DEDUCTION_CATALOG = {
    TaxJurisdiction.nigeria: [
        {"id": "pension", "name": "Pension Contribution", "max_rate": 0.08, "type": "percentage"},
        {"id": "nhf", "name": "National Housing Fund", "max_rate": 0.025, "type": "percentage"},
        {"id": "nhis", "name": "National Health Insurance", "max_rate": 0.05, "type": "percentage"},
        {"id": "life_insurance", "name": "Life Insurance Premium", "max_amount": 0, "type": "actual"},
        {"id": "mortgage_interest", "name": "Mortgage Interest", "max_amount": 0, "type": "actual"},
        {"id": "charity", "name": "Charitable Donations", "max_rate": 0.10, "type": "percentage"},
    ],
    TaxJurisdiction.kenya: [
        {"id": "pension", "name": "Pension/Provident Fund", "max_amount": 240000, "type": "capped"},
        {"id": "mortgage_interest", "name": "Mortgage Interest", "max_amount": 300000, "type": "capped"},
        {"id": "insurance", "name": "Insurance Relief", "max_amount": 60000, "type": "capped"},
        {"id": "disability", "name": "Disability Exemption", "max_amount": 150000, "type": "capped"},
    ],
    TaxJurisdiction.south_africa: [
        {"id": "retirement", "name": "Retirement Annuity", "max_rate": 0.275, "type": "percentage"},
        {"id": "medical", "name": "Medical Aid Credits", "max_amount": 0, "type": "credit"},
        {"id": "travel", "name": "Travel Allowance", "max_rate": 0.80, "type": "percentage"},
        {"id": "donations", "name": "Donations (Section 18A)", "max_rate": 0.10, "type": "percentage"},
    ],
}

class TaxCalculationRequest(BaseModel):
    user_id: str
    jurisdiction: TaxJurisdiction
    filing_status: FilingStatus = FilingStatus.single
    annual_income: float
    other_income: float = 0
    deductions: dict[str, float] = {}
    tax_credits: float = 0

class RetirementPlanRequest(BaseModel):
    user_id: str
    current_age: int
    retirement_age: int = 60
    current_savings: float = 0
    monthly_contribution: float = 0
    expected_return: float = 0.10
    inflation_rate: float = 0.05
    desired_monthly_income: float = 0
    jurisdiction: TaxJurisdiction = TaxJurisdiction.nigeria

class EstatePlanRequest(BaseModel):
    user_id: str
    total_assets: float
    liabilities: float = 0
    beneficiaries: list[dict] = []
    jurisdiction: TaxJurisdiction = TaxJurisdiction.nigeria
    has_will: bool = False
    has_trust: bool = False

class CapitalGainsRequest(BaseModel):
    user_id: str
    jurisdiction: TaxJurisdiction
    transactions: list[dict]

tax_records: dict[str, list] = {}
retirement_plans: dict[str, dict] = {}
estate_plans: dict[str, dict] = {}


def calculate_tax(income: float, jurisdiction: TaxJurisdiction) -> tuple[float, list[dict]]:
    brackets = TAX_BRACKETS.get(jurisdiction, TAX_BRACKETS[TaxJurisdiction.nigeria])
    remaining = income
    total_tax = 0
    breakdown = []

    for bracket_size, rate in brackets:
        if remaining <= 0:
            break
        taxable = min(remaining, bracket_size)
        tax = taxable * rate
        breakdown.append({
            "bracket": f"Up to {bracket_size:,.0f}" if bracket_size != float("inf") else "Remainder",
            "rate": rate,
            "taxable_amount": round(taxable, 2),
            "tax": round(tax, 2),
        })
        total_tax += tax
        remaining -= taxable

    return round(total_tax, 2), breakdown


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "tax-financial-planning",
        "version": "1.0.0",
        "jurisdictions": [j.value for j in TaxJurisdiction],
    }


@app.post("/tax/calculate")
def calculate_tax_liability(req: TaxCalculationRequest):
    gross_income = req.annual_income + req.other_income

    total_deductions = 0
    deduction_details = []
    catalog = DEDUCTION_CATALOG.get(req.jurisdiction, [])
    for ded in catalog:
        claimed = req.deductions.get(ded["id"], 0)
        if claimed <= 0:
            continue
        allowed = claimed
        if ded["type"] == "percentage":
            max_allowed = gross_income * ded["max_rate"]
            allowed = min(claimed, max_allowed)
        elif ded["type"] == "capped" and ded.get("max_amount", 0) > 0:
            allowed = min(claimed, ded["max_amount"])
        total_deductions += allowed
        deduction_details.append({
            "id": ded["id"],
            "name": ded["name"],
            "claimed": claimed,
            "allowed": round(allowed, 2),
        })

    taxable_income = max(0, gross_income - total_deductions)
    tax_liability, brackets = calculate_tax(taxable_income, req.jurisdiction)
    tax_after_credits = max(0, tax_liability - req.tax_credits)
    effective_rate = tax_after_credits / gross_income if gross_income > 0 else 0

    record = {
        "id": f"tax_{uuid.uuid4().hex[:8]}",
        "user_id": req.user_id,
        "jurisdiction": req.jurisdiction.value,
        "gross_income": gross_income,
        "total_deductions": round(total_deductions, 2),
        "taxable_income": round(taxable_income, 2),
        "tax_liability": tax_liability,
        "tax_credits": req.tax_credits,
        "final_tax": tax_after_credits,
        "effective_rate": round(effective_rate, 4),
        "brackets": brackets,
        "deductions": deduction_details,
        "calculated_at": datetime.utcnow().isoformat(),
    }

    if req.user_id not in tax_records:
        tax_records[req.user_id] = []
    tax_records[req.user_id].append(record)

    savings_tips = []
    for ded in catalog:
        if ded["id"] not in req.deductions:
            if ded["type"] == "percentage":
                potential = gross_income * ded["max_rate"]
                tax_saved = potential * effective_rate
                savings_tips.append({
                    "deduction": ded["name"],
                    "potential_amount": round(potential, 2),
                    "potential_tax_savings": round(tax_saved, 2),
                })
            elif ded["type"] == "capped" and ded.get("max_amount", 0) > 0:
                tax_saved = ded["max_amount"] * effective_rate
                savings_tips.append({
                    "deduction": ded["name"],
                    "potential_amount": ded["max_amount"],
                    "potential_tax_savings": round(tax_saved, 2),
                })

    record["optimization_tips"] = savings_tips
    record["total_potential_savings"] = round(sum(t["potential_tax_savings"] for t in savings_tips), 2)

    return record


@app.get("/tax/deductions")
def get_available_deductions(jurisdiction: str = "NG"):
    try:
        j = TaxJurisdiction(jurisdiction)
    except ValueError:
        raise HTTPException(400, f"Invalid jurisdiction: {jurisdiction}")
    return {"jurisdiction": jurisdiction, "deductions": DEDUCTION_CATALOG.get(j, [])}


@app.get("/tax/brackets")
def get_tax_brackets(jurisdiction: str = "NG"):
    try:
        j = TaxJurisdiction(jurisdiction)
    except ValueError:
        raise HTTPException(400, f"Invalid jurisdiction: {jurisdiction}")
    brackets = TAX_BRACKETS.get(j, [])
    return {
        "jurisdiction": jurisdiction,
        "brackets": [
            {"range": f"Up to {b:,.0f}" if b != float("inf") else "Above", "rate": r}
            for b, r in brackets
        ],
    }


@app.get("/tax/history")
def get_tax_history(user_id: str):
    records = tax_records.get(user_id, [])
    return {"records": records, "total": len(records)}


@app.post("/retirement/plan")
def create_retirement_plan(req: RetirementPlanRequest):
    years_to_retirement = req.retirement_age - req.current_age
    if years_to_retirement <= 0:
        raise HTTPException(400, "Already at or past retirement age")

    real_return = (1 + req.expected_return) / (1 + req.inflation_rate) - 1
    months = years_to_retirement * 12

    fv_savings = req.current_savings * math.pow(1 + req.expected_return / 12, months)
    fv_contributions = req.monthly_contribution * ((math.pow(1 + req.expected_return / 12, months) - 1) / (req.expected_return / 12)) if req.expected_return > 0 else req.monthly_contribution * months
    total_at_retirement = fv_savings + fv_contributions

    retirement_years = 25
    if req.desired_monthly_income > 0:
        monthly_real_return = real_return / 12
        needed = req.desired_monthly_income * ((1 - math.pow(1 + monthly_real_return, -retirement_years * 12)) / monthly_real_return) if monthly_real_return > 0 else req.desired_monthly_income * retirement_years * 12
    else:
        needed = total_at_retirement

    gap = max(0, needed - total_at_retirement)
    additional_monthly = 0
    if gap > 0 and months > 0:
        r = req.expected_return / 12
        if r > 0:
            additional_monthly = gap * r / (math.pow(1 + r, months) - 1)
        else:
            additional_monthly = gap / months

    sustainable_monthly = total_at_retirement * (real_return / 12) / (1 - math.pow(1 + real_return / 12, -retirement_years * 12)) if real_return > 0 else total_at_retirement / (retirement_years * 12)

    year_projections = []
    balance = req.current_savings
    for y in range(1, years_to_retirement + 1):
        balance = balance * (1 + req.expected_return) + req.monthly_contribution * 12
        year_projections.append({"year": y, "age": req.current_age + y, "balance": round(balance, 2)})

    plan = {
        "id": f"ret_{uuid.uuid4().hex[:8]}",
        "user_id": req.user_id,
        "current_age": req.current_age,
        "retirement_age": req.retirement_age,
        "years_to_retirement": years_to_retirement,
        "current_savings": req.current_savings,
        "monthly_contribution": req.monthly_contribution,
        "projected_at_retirement": round(total_at_retirement, 2),
        "amount_needed": round(needed, 2),
        "funding_gap": round(gap, 2),
        "additional_monthly_needed": round(additional_monthly, 2),
        "sustainable_monthly_income": round(sustainable_monthly, 2),
        "assumptions": {
            "expected_return": req.expected_return,
            "inflation_rate": req.inflation_rate,
            "retirement_duration_years": retirement_years,
        },
        "year_projections": year_projections,
        "on_track": gap <= 0,
        "created_at": datetime.utcnow().isoformat(),
    }

    retirement_plans[req.user_id] = plan
    return plan


@app.get("/retirement/plan")
def get_retirement_plan(user_id: str):
    plan = retirement_plans.get(user_id)
    if not plan:
        raise HTTPException(404, "No retirement plan found")
    return plan


@app.post("/estate/plan")
def create_estate_plan(req: EstatePlanRequest):
    net_worth = req.total_assets - req.liabilities

    distribution = []
    total_allocated = 0
    for b in req.beneficiaries:
        share = b.get("share", 0)
        amount = net_worth * (share / 100)
        distribution.append({
            "name": b.get("name", "Unknown"),
            "relationship": b.get("relationship", ""),
            "share_percent": share,
            "estimated_amount": round(amount, 2),
        })
        total_allocated += share

    estate_tax = 0
    if req.jurisdiction == TaxJurisdiction.south_africa:
        exemption = 3500000
        taxable = max(0, net_worth - exemption)
        estate_tax = taxable * 0.20

    recommendations = []
    if not req.has_will:
        recommendations.append({
            "priority": "high",
            "action": "Create a valid will",
            "description": "Without a will, your estate will be distributed according to intestate succession laws.",
        })
    if not req.has_trust and net_worth > 10000000:
        recommendations.append({
            "priority": "medium",
            "action": "Consider setting up a trust",
            "description": "A trust can help minimize estate taxes and protect assets for beneficiaries.",
        })
    if total_allocated < 100:
        recommendations.append({
            "priority": "high",
            "action": f"Allocate remaining {100 - total_allocated}% of estate",
            "description": "Unallocated portions will be distributed per intestate succession.",
        })
    recommendations.append({
        "priority": "medium",
        "action": "Review life insurance coverage",
        "description": "Life insurance can provide liquidity for estate taxes and immediate family needs.",
    })
    recommendations.append({
        "priority": "low",
        "action": "Update beneficiary designations",
        "description": "Ensure retirement accounts and insurance policies have current beneficiary designations.",
    })

    plan = {
        "id": f"est_{uuid.uuid4().hex[:8]}",
        "user_id": req.user_id,
        "total_assets": req.total_assets,
        "liabilities": req.liabilities,
        "net_worth": net_worth,
        "estate_tax_estimate": round(estate_tax, 2),
        "distribution": distribution,
        "total_allocated_percent": total_allocated,
        "has_will": req.has_will,
        "has_trust": req.has_trust,
        "recommendations": recommendations,
        "jurisdiction": req.jurisdiction.value,
        "created_at": datetime.utcnow().isoformat(),
    }

    estate_plans[req.user_id] = plan
    return plan


@app.get("/estate/plan")
def get_estate_plan(user_id: str):
    plan = estate_plans.get(user_id)
    if not plan:
        raise HTTPException(404, "No estate plan found")
    return plan


@app.post("/capital-gains/calculate")
def calculate_capital_gains(req: CapitalGainsRequest):
    total_gains = 0
    total_losses = 0
    details = []

    for txn in req.transactions:
        buy_price = txn.get("buy_price", 0)
        sell_price = txn.get("sell_price", 0)
        quantity = txn.get("quantity", 1)
        gain = (sell_price - buy_price) * quantity

        holding_days = txn.get("holding_days", 365)
        is_long_term = holding_days > 365

        if gain > 0:
            total_gains += gain
        else:
            total_losses += abs(gain)

        cgt_rate = 0.10
        if req.jurisdiction == TaxJurisdiction.south_africa:
            cgt_rate = 0.18
        elif req.jurisdiction == TaxJurisdiction.kenya:
            cgt_rate = 0.15

        tax = max(0, gain) * cgt_rate

        details.append({
            "asset": txn.get("asset", "Unknown"),
            "buy_price": buy_price,
            "sell_price": sell_price,
            "quantity": quantity,
            "gain_loss": round(gain, 2),
            "is_long_term": is_long_term,
            "cgt_rate": cgt_rate,
            "tax": round(tax, 2),
        })

    net_gain = total_gains - total_losses
    exemptions = {"NG": 0, "KE": 0, "ZA": 40000, "GH": 0}
    exemption = exemptions.get(req.jurisdiction.value, 0)
    taxable_gain = max(0, net_gain - exemption)

    return {
        "user_id": req.user_id,
        "jurisdiction": req.jurisdiction.value,
        "total_gains": round(total_gains, 2),
        "total_losses": round(total_losses, 2),
        "net_gain": round(net_gain, 2),
        "exemption": exemption,
        "taxable_gain": round(taxable_gain, 2),
        "total_tax": round(sum(d["tax"] for d in details), 2),
        "details": details,
        "harvesting_opportunities": [
            d for d in details if d["gain_loss"] < 0
        ],
    }


@app.get("/financial-health/score")
def get_financial_health_score(user_id: str, income: float = 0, expenses: float = 0,
                                savings: float = 0, debt: float = 0, investments: float = 0):
    if income <= 0:
        raise HTTPException(400, "Income must be positive")

    savings_rate = (income - expenses) / income if income > 0 else 0
    dti_ratio = debt / (income * 12) if income > 0 else 1
    emergency_months = savings / expenses if expenses > 0 else 0
    investment_ratio = investments / (income * 12) if income > 0 else 0

    score = 0
    score += min(25, savings_rate * 100)
    score += min(25, max(0, (1 - dti_ratio) * 25))
    score += min(25, emergency_months * 4)
    score += min(25, investment_ratio * 50)
    score = round(min(100, max(0, score)), 1)

    recommendations = []
    if savings_rate < 0.20:
        recommendations.append({"area": "savings", "action": "Increase savings to at least 20% of income", "priority": "high"})
    if dti_ratio > 0.40:
        recommendations.append({"area": "debt", "action": "Reduce debt-to-income ratio below 40%", "priority": "high"})
    if emergency_months < 6:
        recommendations.append({"area": "emergency_fund", "action": f"Build emergency fund to cover 6 months (currently {emergency_months:.1f})", "priority": "medium"})
    if investment_ratio < 0.10:
        recommendations.append({"area": "investments", "action": "Invest at least 10% of annual income", "priority": "medium"})

    return {
        "user_id": user_id,
        "score": score,
        "rating": "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Poor",
        "components": {
            "savings_rate": {"value": round(savings_rate, 4), "score": min(25, savings_rate * 100)},
            "debt_to_income": {"value": round(dti_ratio, 4), "score": min(25, max(0, (1 - dti_ratio) * 25))},
            "emergency_fund_months": {"value": round(emergency_months, 1), "score": min(25, emergency_months * 4)},
            "investment_ratio": {"value": round(investment_ratio, 4), "score": min(25, investment_ratio * 50)},
        },
        "recommendations": recommendations,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8120)
