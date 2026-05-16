"""IFRS 17 Compliance Engine — PAA, BBA, CSM calculations with Temporal orchestration."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import math

app = FastAPI(title="IFRS 17 Engine", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ContractGroup(BaseModel):
    group_id: str
    portfolio: str  # life, health, property, motor
    cohort: str  # 2024-Q1, etc.
    approach: str = "PAA"  # PAA, BBA, VFA
    premium_total: float = 0
    claims_expected: float = 0
    expenses: float = 0
    discount_rate: float = 0.12
    risk_adjustment_pct: float = 0.06
    coverage_period_months: int = 12


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ifrs17-engine", "version": "3.0.0",
            "middleware": ["kafka", "temporal", "postgres"]}


@app.post("/api/v1/ifrs17/paa/calculate")
async def paa_calculate(group: ContractGroup):
    """Premium Allocation Approach calculation."""
    unearned = group.premium_total * 0.6
    earned = group.premium_total - unearned
    loss_component = max(0, group.claims_expected - group.premium_total * 0.8)
    liability_remaining = unearned + loss_component
    liability_incurred = group.claims_expected * 0.4

    return {
        "group_id": group.group_id,
        "approach": "PAA",
        "liability_remaining_coverage": round(liability_remaining, 2),
        "liability_incurred_claims": round(liability_incurred, 2),
        "insurance_revenue": round(earned, 2),
        "insurance_service_expense": round(group.claims_expected * 0.4 + group.expenses * 0.4, 2),
        "loss_component": round(loss_component, 2),
        "calculated_at": datetime.utcnow().isoformat(),
    }


@app.post("/api/v1/ifrs17/bba/calculate")
async def bba_calculate(group: ContractGroup):
    """Building Block Approach (General Model) calculation."""
    pv_future_cashflows = group.claims_expected / (1 + group.discount_rate)
    risk_adjustment = pv_future_cashflows * group.risk_adjustment_pct
    csm = max(0, group.premium_total - pv_future_cashflows - risk_adjustment - group.expenses)
    csm_amortized = csm / group.coverage_period_months

    return {
        "group_id": group.group_id,
        "approach": "BBA",
        "pv_future_cashflows": round(pv_future_cashflows, 2),
        "risk_adjustment": round(risk_adjustment, 2),
        "csm_initial": round(csm, 2),
        "csm_monthly_amortization": round(csm_amortized, 2),
        "fulfilment_cashflows": round(pv_future_cashflows + risk_adjustment, 2),
        "insurance_contract_liability": round(pv_future_cashflows + risk_adjustment + csm, 2),
        "calculated_at": datetime.utcnow().isoformat(),
    }


@app.post("/api/v1/ifrs17/vfa/calculate")
async def vfa_calculate(group: ContractGroup):
    """Variable Fee Approach for contracts with direct participation."""
    underlying_items_fv = group.premium_total * 1.08
    entity_share = 0.15
    variable_fee = underlying_items_fv * entity_share
    pv_cashflows = group.claims_expected / (1 + group.discount_rate)
    risk_adj = pv_cashflows * group.risk_adjustment_pct
    csm = max(0, variable_fee - pv_cashflows - risk_adj)

    return {
        "group_id": group.group_id,
        "approach": "VFA",
        "underlying_items_fair_value": round(underlying_items_fv, 2),
        "entity_share_percentage": entity_share,
        "variable_fee": round(variable_fee, 2),
        "pv_future_cashflows": round(pv_cashflows, 2),
        "risk_adjustment": round(risk_adj, 2),
        "csm": round(csm, 2),
        "calculated_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/v1/ifrs17/reports")
async def list_reports():
    """IFRS 17 regulatory reports."""
    return {
        "reports": [
            {"id": "balance-sheet", "name": "Insurance Contract Liabilities", "status": "ready"},
            {"id": "income-statement", "name": "Insurance Revenue & Expense", "status": "ready"},
            {"id": "csm-rollforward", "name": "CSM Roll-Forward", "status": "ready"},
            {"id": "loss-component", "name": "Loss Component Analysis", "status": "ready"},
            {"id": "transition", "name": "IFRS 17 Transition Report", "status": "draft"},
        ]
    }


@app.get("/api/v1/ifrs17/portfolios")
async def list_portfolios():
    """Contract group portfolios."""
    return {
        "portfolios": [
            {"id": "life-onerous", "name": "Life - Onerous", "approach": "BBA", "groups": 12, "csm": 0, "loss_component": 45000000},
            {"id": "life-profitable", "name": "Life - Profitable", "approach": "BBA", "groups": 28, "csm": 890000000, "loss_component": 0},
            {"id": "health-short", "name": "Health - Short Duration", "approach": "PAA", "groups": 45, "csm": 0, "loss_component": 12000000},
            {"id": "motor-standard", "name": "Motor - Standard", "approach": "PAA", "groups": 67, "csm": 0, "loss_component": 0},
            {"id": "unit-linked", "name": "Unit-Linked Products", "approach": "VFA", "groups": 8, "csm": 340000000, "loss_component": 0},
        ]
    }
