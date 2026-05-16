from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="IFRS 17 Insurance Contracts Engine",
    description="IFRS 17 compliance engine for insurance contract measurement and reporting",
    version="1.0.0",
)


class ContractGroup(BaseModel):
    group_id: str
    product_line: str
    cohort_year: int
    measurement_model: str  # BBA, PAA, VFA
    onerous: bool
    contracts_count: int


@app.get("/api/v1/ifrs17/contract-groups")
async def contract_groups():
    return {
        "groups": [
            {"group_id": "CG-MTR-2026", "product_line": "Motor", "cohort_year": 2026,
             "measurement_model": "PAA", "onerous": False, "contracts_count": 15420},
            {"group_id": "CG-LIF-2026", "product_line": "Term Life", "cohort_year": 2026,
             "measurement_model": "BBA", "onerous": False, "contracts_count": 3200},
            {"group_id": "CG-GRP-2026", "product_line": "Group Life", "cohort_year": 2026,
             "measurement_model": "BBA", "onerous": False, "contracts_count": 450},
            {"group_id": "CG-HLT-2026", "product_line": "Hospital Cash", "cohort_year": 2026,
             "measurement_model": "PAA", "onerous": False, "contracts_count": 8500},
        ],
    }


@app.get("/api/v1/ifrs17/measurement/{group_id}")
async def measure_group(group_id: str):
    return {
        "group_id": group_id,
        "measurement_date": "2026-03-31",
        "model": "BBA",
        "fulfilment_cash_flows": {
            "present_value_future_cash_flows": 2450000000,
            "risk_adjustment": 122500000,
            "discount_rate": 0.135,
            "expected_claims": 1470000000,
            "expected_premiums": 3920000000,
        },
        "contractual_service_margin": {
            "opening_balance": 850000000,
            "changes_relating_to_future_service": 45000000,
            "amount_recognised_for_service": -95000000,
            "closing_balance": 800000000,
        },
        "insurance_revenue": 980000000,
        "insurance_service_expense": -588000000,
        "insurance_service_result": 392000000,
        "loss_ratio": 0.60,
    }


@app.get("/api/v1/ifrs17/disclosure")
async def disclosure():
    return {
        "period": "Q1 2026",
        "reconciliation": {
            "liability_for_remaining_coverage": {
                "excluding_loss_component": 2850000000,
                "loss_component": 0,
            },
            "liability_for_incurred_claims": 420000000,
            "total_insurance_contract_liability": 3270000000,
        },
        "transition_adjustments": {
            "approach": "Full Retrospective",
            "cumulative_effect_on_equity": -125000000,
        },
    }


@app.get("/api/v1/ifrs17/reports")
async def available_reports():
    return {
        "reports": [
            {"id": "RPT-PNL", "name": "Insurance Service Result (P&L)", "frequency": "quarterly"},
            {"id": "RPT-BS", "name": "Insurance Contract Liabilities (Balance Sheet)", "frequency": "quarterly"},
            {"id": "RPT-CSM", "name": "CSM Rollforward", "frequency": "quarterly"},
            {"id": "RPT-FCF", "name": "Fulfilment Cash Flows Analysis", "frequency": "quarterly"},
            {"id": "RPT-RA", "name": "Risk Adjustment Analysis", "frequency": "quarterly"},
            {"id": "RPT-DISC", "name": "IFRS 17 Disclosure Notes", "frequency": "annual"},
            {"id": "RPT-TRANS", "name": "Transition Impact Report", "frequency": "one-time"},
        ],
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ifrs17-engine"}
