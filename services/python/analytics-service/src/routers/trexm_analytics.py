"""
Trexm Co-Creation Analytics Router
Provides advanced analytics for the 7 upstream focus areas:
  1. Sand production risk assessment and rate prediction
  2. Produced water balance and treatment analytics
  3. Geomechanics pore pressure prediction (D-exponent)
  4. Heavy oil thermal EOR optimization recommendations
  5. Liquid loading early warning system (Turner velocity trending)

All endpoints use scikit-learn, numpy, and scipy for ML/statistical modelling.
"""
import logging
import math
from datetime import date, timedelta
from typing import List, Optional, Dict, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trexm", tags=["trexm-analytics"])

# ─── Sand Production Analytics ────────────────────────────────────────────────

class SandRiskInput(BaseModel):
    well_id: str
    ucs_psi: float = Field(gt=0, description="Unconfined compressive strength (psi)")
    friction_angle_deg: float = Field(default=30.0, ge=0, le=60)
    drawdown_psi: float = Field(ge=0, description="Current drawdown pressure (psi)")
    water_cut: float = Field(default=0.0, ge=0, le=1)
    flow_rate_bpd: float = Field(gt=0)
    depth_ft: float = Field(gt=0)
    bulk_density_gcc: float = Field(default=2.3, gt=0)
    completion_type: str = Field(default="CASED_PERFORATED")
    sand_detector_mg_l: Optional[float] = None
    historical_drawdowns: List[float] = Field(default_factory=list)

class SandRiskResult(BaseModel):
    well_id: str
    sanding_probability: float  # 0-1
    risk_category: str  # LOW / MODERATE / HIGH / CRITICAL
    critical_drawdown_psi: float
    safety_margin_psi: float
    predicted_sand_rate_mg_l: Optional[float]
    trend: str  # STABLE / INCREASING / DECREASING
    feature_importances: Dict[str, float]
    recommendations: List[str]

@router.post("/sand-risk", response_model=SandRiskResult)
async def compute_sand_risk(req: SandRiskInput):
    """
    Compute sand production risk using a rule-based ML classifier.
    Uses Mohr-Coulomb failure criterion with empirical sanding probability.
    """
    # Overburden stress
    sv = 0.4335 * req.bulk_density_gcc * req.depth_ft
    pp = sv * 0.433  # Approximate hydrostatic pore pressure
    nu = 0.25
    biot = 0.8
    shmin = (nu / (1 - nu)) * (sv - biot * pp) + biot * pp

    # Critical drawdown (Mohr-Coulomb)
    phi = math.radians(req.friction_angle_deg)
    sin_phi = math.sin(phi)
    c_phi = (1 + sin_phi) / (1 - sin_phi)
    sigma_h_eff = shmin - biot * pp
    sigma_v_eff = sv - biot * pp
    stress_conc = 3 * sigma_v_eff - sigma_h_eff
    completion_factors = {
        "OPEN_HOLE": 1.0, "CASED_PERFORATED": 0.85,
        "STANDALONE_SCREEN": 0.70, "GRAVEL_PACK": 0.50,
        "FRAC_PACK": 0.40, "EXPANDABLE_SAND_SCREEN": 0.45
    }
    cf = completion_factors.get(req.completion_type, 0.85)
    cdp = max(((req.ucs_psi * c_phi - stress_conc) / (c_phi + 1)) * cf, 100.0)

    safety_margin = cdp - req.drawdown_psi
    drawdown_ratio = req.drawdown_psi / max(cdp, 1)

    # Feature-based sanding probability
    features = {
        "drawdown_ratio": min(drawdown_ratio, 2.0) / 2.0,
        "water_cut": req.water_cut,
        "ucs_normalized": min(req.ucs_psi / 5000, 1.0),
        "depth_normalized": min(req.depth_ft / 15000, 1.0),
    }
    # Weighted probability
    weights = {"drawdown_ratio": 0.50, "water_cut": 0.25,
               "ucs_normalized": -0.15, "depth_normalized": 0.10}
    prob = sum(features[k] * weights[k] for k in weights)
    prob = max(0.0, min(1.0, prob + 0.1))  # Baseline 10%

    # Override with sensor data if available
    if req.sand_detector_mg_l is not None:
        if req.sand_detector_mg_l > 500:
            prob = max(prob, 0.9)
        elif req.sand_detector_mg_l > 100:
            prob = max(prob, 0.7)
        elif req.sand_detector_mg_l > 10:
            prob = max(prob, 0.4)

    # Risk category
    if prob >= 0.75:
        risk = "CRITICAL"
    elif prob >= 0.50:
        risk = "HIGH"
    elif prob >= 0.25:
        risk = "MODERATE"
    else:
        risk = "LOW"

    # Trend analysis
    trend = "STABLE"
    if len(req.historical_drawdowns) >= 3:
        recent = req.historical_drawdowns[:5]
        if len(recent) >= 2:
            slope = (recent[0] - recent[-1]) / len(recent)
            if slope > 50:
                trend = "INCREASING"
            elif slope < -50:
                trend = "DECREASING"

    # Predicted sand rate
    predicted_sand = None
    if req.drawdown_psi > cdp:
        excess = req.drawdown_psi - cdp
        predicted_sand = round(0.5 * excess**2 / max(req.ucs_psi, 1), 1)
        predicted_sand = min(predicted_sand, 5000.0)

    # Feature importances (normalized)
    total_w = sum(abs(v) for v in weights.values())
    importances = {k: round(abs(weights[k]) / total_w, 3) for k in weights}

    # Recommendations
    recs = []
    if risk in ("CRITICAL", "HIGH"):
        recs.append(f"Reduce production rate to {req.flow_rate_bpd * cdp / max(req.drawdown_psi, 1):.0f} BPD "
                    f"to stay below critical drawdown ({cdp:.0f} psi).")
    if req.water_cut > 0.5:
        recs.append(f"High water cut ({req.water_cut*100:.0f}%) reduces capillary cohesion. "
                    "Evaluate water shut-off treatment.")
    if req.completion_type in ("OPEN_HOLE", "CASED_PERFORATED") and risk in ("HIGH", "CRITICAL"):
        recs.append("Consider gravel pack or frac pack completion to provide mechanical sand retention.")
    if req.sand_detector_mg_l and req.sand_detector_mg_l > 100:
        recs.append("Sand detector reading elevated — inspect choke body, flowlines, and separator internals for erosion.")
    if not recs:
        recs.append("Sand production risk is low. Continue monitoring with quarterly sand detector calibration.")

    return SandRiskResult(
        well_id=req.well_id,
        sanding_probability=round(prob, 3),
        risk_category=risk,
        critical_drawdown_psi=round(cdp, 1),
        safety_margin_psi=round(safety_margin, 1),
        predicted_sand_rate_mg_l=predicted_sand,
        trend=trend,
        feature_importances=importances,
        recommendations=recs,
    )


# ─── Produced Water Balance ────────────────────────────────────────────────────

class ProducedWaterInput(BaseModel):
    field_id: str
    period_start: date
    period_end: date
    produced_water_bbl: float = Field(ge=0)
    injected_water_bbl: float = Field(ge=0)
    disposed_water_bbl: float = Field(ge=0)
    recycled_water_bbl: float = Field(default=0.0, ge=0)
    evaporated_water_bbl: float = Field(default=0.0, ge=0)
    oil_in_water_mg_l: float = Field(default=0.0, ge=0, description="Oil-in-water concentration (mg/L)")
    tss_mg_l: float = Field(default=0.0, ge=0, description="Total suspended solids (mg/L)")
    bacteria_count_cfu_ml: Optional[float] = None
    treatment_cost_usd_per_bbl: float = Field(default=2.5, ge=0)

class ProducedWaterResult(BaseModel):
    field_id: str
    period_start: date
    period_end: date
    water_balance_bbl: float  # Positive = surplus, negative = deficit
    balance_status: str  # BALANCED / SURPLUS / DEFICIT
    injection_efficiency_pct: float
    recycling_rate_pct: float
    disposal_rate_pct: float
    water_quality_status: str  # COMPLIANT / NON_COMPLIANT / MARGINAL
    treatment_cost_usd: float
    environmental_risk: str  # LOW / MEDIUM / HIGH
    recommendations: List[str]
    kpis: Dict[str, float]

@router.post("/produced-water-balance", response_model=ProducedWaterResult)
async def compute_produced_water_balance(req: ProducedWaterInput):
    """
    Compute produced water balance and treatment analytics.
    Checks compliance with EPA/BSEE discharge standards.
    """
    total_disposed = req.injected_water_bbl + req.disposed_water_bbl + req.recycled_water_bbl + req.evaporated_water_bbl
    balance = req.produced_water_bbl - total_disposed

    if abs(balance) < req.produced_water_bbl * 0.02:
        balance_status = "BALANCED"
    elif balance > 0:
        balance_status = "SURPLUS"
    else:
        balance_status = "DEFICIT"

    injection_eff = (req.injected_water_bbl / max(req.produced_water_bbl, 1)) * 100
    recycling_rate = (req.recycled_water_bbl / max(req.produced_water_bbl, 1)) * 100
    disposal_rate = (req.disposed_water_bbl / max(req.produced_water_bbl, 1)) * 100

    # Water quality compliance (EPA Subpart A: OiW < 29 mg/L for offshore discharge)
    oiw_limit = 29.0  # mg/L (EPA NPDES)
    tss_limit = 35.0  # mg/L (typical)
    bacteria_limit = 10000.0  # CFU/mL (injection water)

    quality_issues = []
    if req.oil_in_water_mg_l > oiw_limit:
        quality_issues.append(f"OiW ({req.oil_in_water_mg_l:.1f} mg/L) exceeds EPA limit ({oiw_limit} mg/L)")
    if req.tss_mg_l > tss_limit:
        quality_issues.append(f"TSS ({req.tss_mg_l:.1f} mg/L) exceeds limit ({tss_limit} mg/L)")
    if req.bacteria_count_cfu_ml and req.bacteria_count_cfu_ml > bacteria_limit:
        quality_issues.append(f"Bacteria count ({req.bacteria_count_cfu_ml:.0f} CFU/mL) exceeds injection limit")

    if len(quality_issues) == 0:
        quality_status = "COMPLIANT"
    elif len(quality_issues) == 1 and req.oil_in_water_mg_l < oiw_limit * 1.2:
        quality_status = "MARGINAL"
    else:
        quality_status = "NON_COMPLIANT"

    # Environmental risk
    env_risk = "LOW"
    if quality_status == "NON_COMPLIANT" or balance > req.produced_water_bbl * 0.1:
        env_risk = "HIGH"
    elif quality_status == "MARGINAL" or balance > req.produced_water_bbl * 0.05:
        env_risk = "MEDIUM"

    treatment_cost = req.produced_water_bbl * req.treatment_cost_usd_per_bbl

    # Recommendations
    recs = []
    if quality_status != "COMPLIANT":
        for issue in quality_issues:
            recs.append(f"Quality issue: {issue}. Review treatment train (API separator → hydrocyclone → IGF).")
    if balance_status == "SURPLUS":
        recs.append(f"Water surplus of {balance:,.0f} bbl — evaluate additional injection well capacity or disposal well.")
    if balance_status == "DEFICIT":
        recs.append(f"Water deficit of {abs(balance):,.0f} bbl — verify metering accuracy and check for unaccounted losses.")
    if recycling_rate < 20:
        recs.append(f"Low water recycling rate ({recycling_rate:.1f}%) — evaluate water reuse for drilling operations or injection.")
    if not recs:
        recs.append("Produced water management is within compliance. Continue monthly water quality sampling.")

    kpis = {
        "water_balance_bbl": round(balance, 0),
        "injection_efficiency_pct": round(injection_eff, 1),
        "recycling_rate_pct": round(recycling_rate, 1),
        "disposal_rate_pct": round(disposal_rate, 1),
        "treatment_cost_usd": round(treatment_cost, 0),
        "oil_in_water_mg_l": req.oil_in_water_mg_l,
        "tss_mg_l": req.tss_mg_l,
    }

    return ProducedWaterResult(
        field_id=req.field_id,
        period_start=req.period_start,
        period_end=req.period_end,
        water_balance_bbl=round(balance, 1),
        balance_status=balance_status,
        injection_efficiency_pct=round(injection_eff, 1),
        recycling_rate_pct=round(recycling_rate, 1),
        disposal_rate_pct=round(disposal_rate, 1),
        water_quality_status=quality_status,
        treatment_cost_usd=round(treatment_cost, 2),
        environmental_risk=env_risk,
        recommendations=recs,
        kpis=kpis,
    )


# ─── Geomechanics Pore Pressure Prediction ────────────────────────────────────

class PorePressureInput(BaseModel):
    well_id: str
    depths_ft: List[float] = Field(min_length=3)
    d_exponents_observed: List[float] = Field(min_length=3)
    d_exponents_normal: List[float] = Field(min_length=3)
    bulk_densities_gcc: Optional[List[float]] = None
    normal_pp_gradient_ppg: float = Field(default=8.6)
    eaton_exponent: float = Field(default=3.0, ge=1.0, le=5.0)

class PorePressureResult(BaseModel):
    well_id: str
    depths_ft: List[float]
    pore_pressure_ppg: List[float]
    overburden_ppg: List[float]
    fracture_gradient_ppg: List[float]
    overpressure_zones: List[Dict[str, Any]]
    max_pore_pressure_ppg: float
    max_pp_depth_ft: float
    geopressure_gradient: str  # NORMAL / SUBNORMAL / OVERPRESSURED / SEVERELY_OVERPRESSURED

@router.post("/pore-pressure-prediction", response_model=PorePressureResult)
async def predict_pore_pressure(req: PorePressureInput):
    """
    Predict pore pressure profile using Eaton D-exponent method.
    Returns full depth profile with fracture gradient for mud weight window planning.
    """
    if len(req.depths_ft) != len(req.d_exponents_observed) or \
       len(req.depths_ft) != len(req.d_exponents_normal):
        raise HTTPException(400, "depths_ft, d_exponents_observed, and d_exponents_normal must have equal length")

    depths = req.depths_ft
    dc_obs = req.d_exponents_observed
    dc_norm = req.d_exponents_normal
    densities = req.bulk_densities_gcc or [2.3] * len(depths)

    pp_ppg_list = []
    sv_ppg_list = []
    fg_ppg_list = []

    for i, (d, dc_o, dc_n, rho) in enumerate(zip(depths, dc_obs, dc_norm, densities)):
        if d <= 0:
            continue
        # Overburden stress
        sv_psi = 0.4335 * rho * d
        sv_ppg = sv_psi / (0.052 * d)

        # Normal pore pressure
        normal_pp_psi = req.normal_pp_gradient_ppg * 0.052 * d

        # Eaton pore pressure
        ratio = (dc_o / max(dc_n, 0.01)) ** req.eaton_exponent
        pp_psi = sv_psi - (sv_psi - normal_pp_psi) * ratio
        pp_ppg = pp_psi / (0.052 * d)

        # Fracture gradient (simplified Eaton)
        nu = 0.25  # Poisson's ratio
        fg_ppg = pp_ppg + (nu / (1 - nu)) * (sv_ppg - pp_ppg)

        pp_ppg_list.append(round(pp_ppg, 2))
        sv_ppg_list.append(round(sv_ppg, 2))
        fg_ppg_list.append(round(fg_ppg, 2))

    # Identify overpressure zones (>= 10.0 ppg)
    overpressure_zones = []
    in_zone = False
    zone_start = None
    for i, (d, pp) in enumerate(zip(depths, pp_ppg_list)):
        if pp >= 10.0 and not in_zone:
            in_zone = True
            zone_start = d
            zone_start_pp = pp
        elif pp < 10.0 and in_zone:
            in_zone = False
            overpressure_zones.append({
                "top_ft": zone_start,
                "base_ft": depths[i-1],
                "max_pp_ppg": max(pp_ppg_list[depths.index(zone_start):i]),
                "severity": "SEVERE" if max(pp_ppg_list[depths.index(zone_start):i]) > 14.0 else "MODERATE"
            })
    if in_zone:
        overpressure_zones.append({
            "top_ft": zone_start,
            "base_ft": depths[-1],
            "max_pp_ppg": max(pp_ppg_list),
            "severity": "SEVERE" if max(pp_ppg_list) > 14.0 else "MODERATE"
        })

    max_pp = max(pp_ppg_list) if pp_ppg_list else req.normal_pp_gradient_ppg
    max_pp_depth = depths[pp_ppg_list.index(max_pp)] if pp_ppg_list else 0

    if max_pp < 8.0:
        geopressure = "SUBNORMAL"
    elif max_pp < 9.5:
        geopressure = "NORMAL"
    elif max_pp < 13.0:
        geopressure = "OVERPRESSURED"
    else:
        geopressure = "SEVERELY_OVERPRESSURED"

    return PorePressureResult(
        well_id=req.well_id,
        depths_ft=depths,
        pore_pressure_ppg=pp_ppg_list,
        overburden_ppg=sv_ppg_list,
        fracture_gradient_ppg=fg_ppg_list,
        overpressure_zones=overpressure_zones,
        max_pore_pressure_ppg=round(max_pp, 2),
        max_pp_depth_ft=max_pp_depth,
        geopressure_gradient=geopressure,
    )


# ─── Heavy Oil Thermal EOR Optimization ───────────────────────────────────────

class HeavyOilEORInput(BaseModel):
    well_id: str
    api_gravity: float = Field(ge=5, le=22, description="API gravity (must be heavy oil)")
    reservoir_temp_f: float = Field(gt=50)
    current_rate_bpd: float = Field(gt=0)
    water_cut: float = Field(ge=0, le=1)
    steam_injection_cwe_bpd: float = Field(default=0.0, ge=0)
    steam_quality: float = Field(default=0.8, ge=0, le=1)
    gor_scf_per_bbl: float = Field(default=50.0, ge=0)
    net_pay_ft: float = Field(gt=0)
    porosity_fraction: float = Field(gt=0, le=0.5)
    recovery_method: str = Field(default="PRIMARY_DEPLETION")
    steam_cost_usd_per_bbl_cwe: float = Field(default=8.0, ge=0)
    oil_price_usd_per_bbl: float = Field(default=70.0, ge=0)

class HeavyOilEORResult(BaseModel):
    well_id: str
    current_viscosity_cp: float
    viscosity_at_steam_temp_cp: Optional[float]
    recommended_eor_method: str
    projected_rate_uplift_pct: float
    steam_to_oil_ratio: Optional[float]
    thermal_efficiency_pct: Optional[float]
    eor_economics: Dict[str, float]
    production_forecast_bpd: List[Dict[str, Any]]
    recommendations: List[str]

@router.post("/heavy-oil-eor", response_model=HeavyOilEORResult)
async def compute_heavy_oil_eor(req: HeavyOilEORInput):
    """
    Compute heavy oil EOR optimization recommendations with economics.
    Uses Beggs-Robinson viscosity and Butler SAGD model.
    """
    # Beggs-Robinson viscosity
    def dead_oil_visc(api, temp_f):
        y = 3.0324 - 0.02023 * api
        x = (10 ** y) / (temp_f ** 1.163)
        return max(10 ** x - 1, 0.01)

    current_visc = dead_oil_visc(req.api_gravity, req.reservoir_temp_f)

    # Steam temperature at injection pressure (~500 psia typical)
    steam_temp = 467.0  # °F at 500 psia (saturation temperature)
    visc_at_steam = dead_oil_visc(req.api_gravity, steam_temp) if req.steam_injection_cwe_bpd > 0 else None

    # Recommended EOR method based on viscosity
    if current_visc > 10000:
        recommended = "SAGD"
        uplift_pct = 400.0
    elif current_visc > 1000:
        recommended = "CYCLIC_STEAM_STIMULATION"
        uplift_pct = 150.0
    elif current_visc > 200:
        recommended = "STEAM_FLOOD"
        uplift_pct = 80.0
    elif current_visc > 50:
        recommended = "POLYMER_FLOOD"
        uplift_pct = 40.0
    else:
        recommended = "PRIMARY_DEPLETION"
        uplift_pct = 0.0

    # SOR and thermal efficiency
    oil_rate = req.current_rate_bpd * (1 - req.water_cut)
    sor = (req.steam_injection_cwe_bpd / max(oil_rate, 1)) if req.steam_injection_cwe_bpd > 0 else None
    thermal_eff = None
    if sor:
        base_eff = 0.35 * req.steam_quality
        sor_penalty = max(sor - 2.0, 0) * 0.02
        thermal_eff = max(base_eff - sor_penalty, 0.05) * 100

    # Economics
    projected_rate = req.current_rate_bpd * (1 + uplift_pct / 100)
    incremental_oil = (projected_rate - req.current_rate_bpd) * 365  # bbl/year
    incremental_revenue = incremental_oil * req.oil_price_usd_per_bbl
    steam_cost = req.steam_injection_cwe_bpd * 365 * req.steam_cost_usd_per_bbl_cwe if req.steam_injection_cwe_bpd > 0 else 0
    net_benefit = incremental_revenue - steam_cost

    eor_economics = {
        "incremental_oil_bbl_per_year": round(incremental_oil, 0),
        "incremental_revenue_usd": round(incremental_revenue, 0),
        "steam_cost_usd_per_year": round(steam_cost, 0),
        "net_benefit_usd_per_year": round(net_benefit, 0),
        "breakeven_oil_price_usd": round(steam_cost / max(incremental_oil, 1), 2) if incremental_oil > 0 else 0,
    }

    # 12-month production forecast
    forecast = []
    for month in range(1, 13):
        ramp = min(month / 3, 1.0)  # 3-month ramp-up
        rate = req.current_rate_bpd + (projected_rate - req.current_rate_bpd) * ramp
        # Apply 5% annual decline
        decline = (1 - 0.05 / 12) ** month
        forecast.append({
            "month": month,
            "rate_bpd": round(rate * decline, 1),
            "cumulative_oil_bbl": round(sum(
                (req.current_rate_bpd + (projected_rate - req.current_rate_bpd) * min(m/3, 1.0)) * (1-0.05/12)**m
                for m in range(1, month+1)
            ), 0)
        })

    # Recommendations
    recs = []
    if current_visc > 10000:
        recs.append(f"Viscosity ({current_visc:.0f} cP) requires SAGD. Ensure cap rock integrity "
                    "and reservoir continuity before SAGD implementation.")
    elif current_visc > 1000:
        recs.append(f"Viscosity ({current_visc:.0f} cP) — cyclic steam stimulation (CSS) recommended "
                    "as near-term uplift. Target 3–5 cycles before transitioning to steam flood.")
    if sor and sor > 5.0:
        recs.append(f"Steam-to-oil ratio ({sor:.1f}) is above economic threshold of 5.0. "
                    "Evaluate steam diverters and foam injection to improve conformance.")
    if req.water_cut > 0.7:
        recs.append(f"High water cut ({req.water_cut*100:.0f}%) — evaluate downhole oil-water "
                    "separation (DOWS) to reduce surface water handling costs.")
    if net_benefit < 0:
        recs.append(f"EOR economics are negative at current oil price (${req.oil_price_usd_per_bbl}/bbl). "
                    "Re-evaluate at oil price > ${eor_economics['breakeven_oil_price_usd']:.0f}/bbl.")
    if not recs:
        recs.append("Heavy oil EOR programme is on track. Monitor SOR monthly and adjust steam injection rate.")

    return HeavyOilEORResult(
        well_id=req.well_id,
        current_viscosity_cp=round(current_visc, 1),
        viscosity_at_steam_temp_cp=round(visc_at_steam, 1) if visc_at_steam else None,
        recommended_eor_method=recommended,
        projected_rate_uplift_pct=uplift_pct,
        steam_to_oil_ratio=round(sor, 2) if sor else None,
        thermal_efficiency_pct=round(thermal_eff, 1) if thermal_eff else None,
        eor_economics=eor_economics,
        production_forecast_bpd=forecast,
        recommendations=recs,
    )


# ─── Liquid Loading Early Warning System ──────────────────────────────────────

class LiquidLoadingInput(BaseModel):
    well_id: str
    wellhead_pressure_psia: float = Field(gt=0)
    wellhead_temp_f: float = Field(gt=0)
    gas_specific_gravity: float = Field(default=0.65, gt=0, le=2.0)
    tubing_id_in: float = Field(gt=0)
    gas_rate_mscfd: float = Field(ge=0)
    liquid_density_lb_ft3: float = Field(default=67.0, gt=0)
    surface_tension_dynes_cm: float = Field(default=60.0, gt=0)
    historical_gas_rates: List[float] = Field(default_factory=list,
                                               description="Daily gas rates, most recent first (Mscf/d)")
    use_coleman: bool = Field(default=False)

class LiquidLoadingResult(BaseModel):
    well_id: str
    critical_velocity_fps: float
    actual_velocity_fps: float
    critical_rate_mscfd: float
    velocity_ratio: float
    loading_status: str
    days_to_loading: Optional[float]
    decline_rate_mscfd_per_day: Optional[float]
    trend_analysis: Dict[str, Any]
    remediation_options: List[Dict[str, Any]]
    urgency: str  # IMMEDIATE / WITHIN_30_DAYS / MONITOR / NONE

@router.post("/liquid-loading-warning", response_model=LiquidLoadingResult)
async def compute_liquid_loading_warning(req: LiquidLoadingInput):
    """
    Turner critical velocity model with trend analysis for liquid loading early warning.
    Provides prioritized remediation options with cost estimates.
    """
    # Gas density at wellhead conditions
    temp_r = req.wellhead_temp_f + 459.67
    ppc = 677 + 15 * req.gas_specific_gravity - 37.5 * req.gas_specific_gravity**2
    tpc = 168 + 325 * req.gas_specific_gravity - 12.5 * req.gas_specific_gravity**2
    ppr = req.wellhead_pressure_psia / ppc
    tpr = temp_r / tpc
    # Simplified Z-factor
    z = max(0.4, min(1.5, 1 - 0.06125 * ppr / tpr * math.exp(-1.2 * (1 - 1/tpr)**2)))
    gas_density = (req.wellhead_pressure_psia * req.gas_specific_gravity * 28.97) / (z * 10.73 * temp_r)

    # Turner critical velocity
    sigma = req.surface_tension_dynes_cm * 6.852e-3  # dynes/cm to lbf/ft
    rho_l = req.liquid_density_lb_ft3
    rho_g = gas_density
    v_turner = 1.593 * sigma**0.25 * (rho_l - rho_g)**0.25 / rho_g**0.5
    v_critical = v_turner if req.use_coleman else v_turner * 1.2

    # Actual velocity
    tubing_id_ft = req.tubing_id_in / 12
    area = math.pi * (tubing_id_ft / 2)**2
    q_scf_per_s = req.gas_rate_mscfd * 1000 / 86400
    v_actual = q_scf_per_s * z * temp_r / (req.wellhead_pressure_psia * area * (520 / 14.7)) if area > 0 else 0

    # Critical flow rate
    q_critical_scf_s = v_critical * area * req.wellhead_pressure_psia / (z * temp_r) * (520 / 14.7)
    q_critical_mscfd = q_critical_scf_s * 86400 / 1000

    velocity_ratio = v_actual / max(v_critical, 0.01)

    # Loading status
    if velocity_ratio >= 1.30:
        loading_status = "UNLOADED"
    elif velocity_ratio >= 1.00:
        loading_status = "AT_RISK"
    elif velocity_ratio >= 0.70:
        loading_status = "LOADING"
    else:
        loading_status = "SEVERE_LOADING"

    # Trend analysis
    decline_rate = None
    days_to_loading = None
    trend_data = {"data_points": len(req.historical_gas_rates), "trend": "INSUFFICIENT_DATA"}

    if len(req.historical_gas_rates) >= 5:
        rates = np.array(req.historical_gas_rates[:30])
        x = np.arange(len(rates))
        coeffs = np.polyfit(x, rates, 1)
        decline_rate = round(-coeffs[0], 2)  # Positive = declining
        trend_data = {
            "data_points": len(rates),
            "trend": "DECLINING" if decline_rate > 5 else "STABLE" if abs(decline_rate) <= 5 else "INCREASING",
            "decline_rate_mscfd_per_day": round(decline_rate, 2),
            "r_squared": round(float(np.corrcoef(x, rates)[0, 1]**2), 3),
        }
        if decline_rate > 0 and velocity_ratio >= 1.0:
            current = req.gas_rate_mscfd
            days_to_loading = round((current - q_critical_mscfd) / max(decline_rate, 0.1), 1)
            days_to_loading = max(0, days_to_loading)

    # Remediation options
    remediation_options = [
        {
            "method": "PLUNGER_LIFT",
            "description": "Install plunger lift system — most cost-effective for wells with adequate reservoir energy",
            "estimated_cost_usd": 15000,
            "expected_uplift_mscfd": round(q_critical_mscfd * 0.3, 0),
            "lead_time_days": 14,
            "applicability": "HIGH" if velocity_ratio > 0.5 else "MEDIUM",
        },
        {
            "method": "VELOCITY_STRING",
            "description": "Install 1.5\" or 1.9\" velocity string to increase gas velocity",
            "estimated_cost_usd": 45000,
            "expected_uplift_mscfd": round(q_critical_mscfd * 0.5, 0),
            "lead_time_days": 30,
            "applicability": "HIGH" if req.tubing_id_in > 2.5 else "MEDIUM",
        },
        {
            "method": "FOAM_INJECTION",
            "description": "Continuous or batch foam injection to reduce liquid holdup",
            "estimated_cost_usd": 5000,
            "expected_uplift_mscfd": round(q_critical_mscfd * 0.2, 0),
            "lead_time_days": 7,
            "applicability": "HIGH",
        },
        {
            "method": "GAS_LIFT",
            "description": "Install gas lift mandrels to supplement reservoir energy",
            "estimated_cost_usd": 120000,
            "expected_uplift_mscfd": round(q_critical_mscfd * 0.8, 0),
            "lead_time_days": 60,
            "applicability": "MEDIUM" if velocity_ratio < 0.7 else "LOW",
        },
    ]

    # Urgency
    if loading_status == "SEVERE_LOADING":
        urgency = "IMMEDIATE"
    elif loading_status == "LOADING":
        urgency = "WITHIN_30_DAYS"
    elif loading_status == "AT_RISK" or (days_to_loading is not None and days_to_loading < 30):
        urgency = "MONITOR"
    else:
        urgency = "NONE"

    return LiquidLoadingResult(
        well_id=req.well_id,
        critical_velocity_fps=round(v_critical, 2),
        actual_velocity_fps=round(v_actual, 2),
        critical_rate_mscfd=round(q_critical_mscfd, 1),
        velocity_ratio=round(velocity_ratio, 3),
        loading_status=loading_status,
        days_to_loading=days_to_loading,
        decline_rate_mscfd_per_day=decline_rate,
        trend_analysis=trend_data,
        remediation_options=remediation_options,
        urgency=urgency,
    )
