"""IFRS 17 data models for insurance contract groups and measurements."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class MeasurementModel(str, Enum):
    GMM = "gmm"  # General Measurement Model (Building Block Approach)
    PAA = "paa"  # Premium Allocation Approach
    VFA = "vfa"  # Variable Fee Approach


class ContractGroup(BaseModel):
    """IFRS 17 contract group - the unit of measurement."""
    id: str
    portfolio_id: str
    cohort_year: int
    name: str
    measurement_model: MeasurementModel
    inception_date: date
    coverage_period_months: int
    is_onerous: bool = False
    currency: str = "NGN"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FulfillmentCashflows(BaseModel):
    """Present value of future cash flows."""
    group_id: str
    valuation_date: date
    pv_future_premiums: Decimal = Decimal("0")
    pv_future_claims: Decimal = Decimal("0")
    pv_future_expenses: Decimal = Decimal("0")
    pv_future_commissions: Decimal = Decimal("0")
    risk_adjustment: Decimal = Decimal("0")
    total_fulfillment_cf: Decimal = Decimal("0")
    discount_rate: Decimal = Decimal("0.12")  # Nigerian risk-free rate + spread


class ContractualServiceMargin(BaseModel):
    """CSM - unearned profit to be recognized over coverage period."""
    group_id: str
    valuation_date: date
    opening_balance: Decimal = Decimal("0")
    changes_in_estimates: Decimal = Decimal("0")
    accretion_of_interest: Decimal = Decimal("0")
    fx_adjustments: Decimal = Decimal("0")
    recognized_in_pnl: Decimal = Decimal("0")
    closing_balance: Decimal = Decimal("0")


class RiskAdjustment(BaseModel):
    """Non-financial risk compensation required by IFRS 17."""
    group_id: str
    valuation_date: date
    confidence_level: Decimal = Decimal("0.75")  # 75th percentile
    method: str = "cost_of_capital"  # cost_of_capital, var, quantile
    non_financial_risk_amount: Decimal = Decimal("0")
    release_pattern: str = "coverage_units"


class LossComponent(BaseModel):
    """Tracks onerous contract groups per IFRS 17.47-52."""
    group_id: str
    valuation_date: date
    loss_at_initial_recognition: Decimal = Decimal("0")
    subsequent_changes: Decimal = Decimal("0")
    reversal_of_losses: Decimal = Decimal("0")
    remaining_loss: Decimal = Decimal("0")


class DiscountCurve(BaseModel):
    """Yield curve for discounting future cash flows."""
    id: str
    currency: str = "NGN"
    reference_date: date
    method: str = "bottom_up"  # bottom_up or top_down per IFRS 17.B72-85
    tenors: list[int] = []  # in months
    rates: list[float] = []  # annualized rates
    source: str = "CBN_yield_curve"


class TransitionAdjustment(BaseModel):
    """IFRS 17 transition from IFRS 4 - Modified Retrospective Approach."""
    group_id: str
    transition_date: date
    approach: str = "modified_retrospective"  # full, modified, fair_value
    csm_at_transition: Decimal = Decimal("0")
    oci_adjustment: Decimal = Decimal("0")
