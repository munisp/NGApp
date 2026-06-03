"""IFRS 17 measurement calculations - CSM, Risk Adjustment, Discount Curves."""

import numpy as np
from decimal import Decimal
from datetime import date
from typing import List

import structlog

from app.models.contracts import (
    ContractGroup,
    FulfillmentCashflows,
    ContractualServiceMargin,
    RiskAdjustment,
    LossComponent,
    DiscountCurve,
    MeasurementModel,
)

logger = structlog.get_logger()


class MeasurementService:
    """Core IFRS 17 measurement engine."""

    def __init__(self, db_session):
        self.db = db_session

    async def calculate_fulfillment_cashflows(
        self, group: ContractGroup, valuation_date: date, cashflow_projections: dict
    ) -> FulfillmentCashflows:
        """Calculate present value of future cash flows per IFRS 17.32-37."""
        discount_curve = await self.get_discount_curve(group.currency, valuation_date)
        
        pv_premiums = self._discount_cashflows(
            cashflow_projections.get("premiums", []),
            discount_curve,
            group.coverage_period_months,
        )
        pv_claims = self._discount_cashflows(
            cashflow_projections.get("claims", []),
            discount_curve,
            group.coverage_period_months,
        )
        pv_expenses = self._discount_cashflows(
            cashflow_projections.get("expenses", []),
            discount_curve,
            group.coverage_period_months,
        )
        pv_commissions = self._discount_cashflows(
            cashflow_projections.get("commissions", []),
            discount_curve,
            group.coverage_period_months,
        )

        risk_adj = await self.calculate_risk_adjustment(group, valuation_date)

        total = pv_claims + pv_expenses + pv_commissions + risk_adj.non_financial_risk_amount - pv_premiums

        return FulfillmentCashflows(
            group_id=group.id,
            valuation_date=valuation_date,
            pv_future_premiums=Decimal(str(pv_premiums)),
            pv_future_claims=Decimal(str(pv_claims)),
            pv_future_expenses=Decimal(str(pv_expenses)),
            pv_future_commissions=Decimal(str(pv_commissions)),
            risk_adjustment=risk_adj.non_financial_risk_amount,
            total_fulfillment_cf=Decimal(str(total)),
            discount_rate=Decimal(str(discount_curve.rates[0] if discount_curve.rates else 0.12)),
        )

    async def calculate_csm(
        self, group: ContractGroup, valuation_date: date, 
        fulfillment_cf: FulfillmentCashflows, prior_csm: ContractualServiceMargin = None
    ) -> ContractualServiceMargin:
        """Calculate Contractual Service Margin per IFRS 17.44-46."""
        if group.measurement_model == MeasurementModel.PAA:
            return self._calculate_paa_csm(group, valuation_date)

        opening = prior_csm.closing_balance if prior_csm else Decimal("0")
        
        # Accretion at locked-in rate
        locked_in_rate = fulfillment_cf.discount_rate
        accretion = opening * locked_in_rate / Decimal("12")

        # Changes in fulfillment CFs related to future service
        changes = Decimal("0")  # Would come from experience adjustments

        # Amount recognized in P&L (coverage units method)
        coverage_units_this_period = Decimal("1") / Decimal(str(group.coverage_period_months))
        recognized = (opening + accretion + changes) * coverage_units_this_period

        closing = opening + accretion + changes - recognized

        # If CSM would go negative, group becomes onerous
        if closing < 0:
            logger.warning("onerous_group_detected", group_id=group.id, csm=float(closing))
            closing = Decimal("0")

        return ContractualServiceMargin(
            group_id=group.id,
            valuation_date=valuation_date,
            opening_balance=opening,
            changes_in_estimates=changes,
            accretion_of_interest=accretion,
            fx_adjustments=Decimal("0"),
            recognized_in_pnl=recognized,
            closing_balance=closing,
        )

    async def calculate_risk_adjustment(
        self, group: ContractGroup, valuation_date: date
    ) -> RiskAdjustment:
        """Calculate risk adjustment for non-financial risk per IFRS 17.37.
        
        Uses Cost of Capital method at 75th percentile confidence level.
        """
        # Cost of capital method: RA = CoC_rate * SCR * discount_factor
        cost_of_capital_rate = 0.06  # 6% CoC rate (industry standard)
        
        # Simplified SCR proxy based on premium volume and loss volatility
        # In production: full stochastic simulation
        premium_volume = 1_000_000  # Would come from group data
        loss_volatility = 0.25  # coefficient of variation
        
        # One-year SCR approximation
        scr = premium_volume * loss_volatility * 1.645  # ~95th percentile
        
        # Multi-year projection
        remaining_months = group.coverage_period_months
        discount_rate = 0.12  # Nigerian risk-free + spread
        
        ra_amount = 0.0
        for month in range(remaining_months):
            year_fraction = month / 12.0
            discount_factor = 1.0 / (1.0 + discount_rate) ** year_fraction
            ra_amount += cost_of_capital_rate * scr * discount_factor / 12.0

        return RiskAdjustment(
            group_id=group.id,
            valuation_date=valuation_date,
            confidence_level=Decimal("0.75"),
            method="cost_of_capital",
            non_financial_risk_amount=Decimal(str(round(ra_amount, 2))),
            release_pattern="coverage_units",
        )

    async def check_onerous(
        self, group: ContractGroup, fulfillment_cf: FulfillmentCashflows
    ) -> LossComponent:
        """Check if contract group is onerous per IFRS 17.47-52."""
        # Group is onerous if fulfillment CFs exceed premiums at initial recognition
        is_onerous = fulfillment_cf.total_fulfillment_cf > Decimal("0")

        loss = LossComponent(
            group_id=group.id,
            valuation_date=date.today(),
            loss_at_initial_recognition=max(fulfillment_cf.total_fulfillment_cf, Decimal("0")),
            remaining_loss=max(fulfillment_cf.total_fulfillment_cf, Decimal("0")),
        )

        if is_onerous:
            logger.warning("onerous_contract_group", group_id=group.id, 
                          loss=float(loss.loss_at_initial_recognition))

        return loss

    async def get_discount_curve(self, currency: str, ref_date: date) -> DiscountCurve:
        """Get or construct discount curve per IFRS 17.B72-85.
        
        Bottom-up approach: risk-free rate + illiquidity premium.
        Source: CBN Treasury Bills/Bonds yield curve.
        """
        # Nigerian yield curve tenors and rates (CBN reference)
        tenors = [1, 3, 6, 12, 24, 36, 60, 120]  # months
        # Base rates from CBN T-Bill/Bond auctions + illiquidity premium
        base_rates = [0.10, 0.105, 0.11, 0.115, 0.12, 0.125, 0.13, 0.135]
        illiquidity_premium = 0.005  # 50bps for insurance liabilities

        rates = [r + illiquidity_premium for r in base_rates]

        return DiscountCurve(
            id=f"{currency}_{ref_date.isoformat()}",
            currency=currency,
            reference_date=ref_date,
            method="bottom_up",
            tenors=tenors,
            rates=rates,
            source="CBN_yield_curve",
        )

    def _discount_cashflows(
        self, cashflows: List[float], curve: DiscountCurve, max_months: int
    ) -> float:
        """Discount projected cash flows using the yield curve."""
        if not cashflows:
            return 0.0

        # Interpolate discount factors from curve
        rates_array = np.array(curve.rates) if curve.rates else np.array([0.12])
        tenors_array = np.array(curve.tenors) if curve.tenors else np.array([12])

        pv = 0.0
        for month, cf in enumerate(cashflows[:max_months], 1):
            # Linear interpolation of rate for this tenor
            rate = float(np.interp(month, tenors_array, rates_array))
            discount_factor = 1.0 / (1.0 + rate) ** (month / 12.0)
            pv += cf * discount_factor

        return round(pv, 2)

    def _calculate_paa_csm(
        self, group: ContractGroup, valuation_date: date
    ) -> ContractualServiceMargin:
        """PAA simplified measurement for short-duration contracts (<12 months)."""
        return ContractualServiceMargin(
            group_id=group.id,
            valuation_date=valuation_date,
            opening_balance=Decimal("0"),
            closing_balance=Decimal("0"),
        )
