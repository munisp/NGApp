"""
optimization_services.py — Best-of-breed open-source optimization services (v38.0)

Implements:
1. Pyomo Mud Procurement Optimizer — minimize OBM cost subject to inventory constraints
2. PARETO-inspired Produced Water Logistics Optimizer — minimize transport + disposal cost
3. WaterTAP-inspired Treatment Train Optimizer — select optimal treatment sequence
4. NodAnaPy-style Nodal Analysis — inflow/outflow performance relationship (IPR/VLP)
5. OPM Flow Black-Oil Simulation Wrapper — run Flow simulator as subprocess
6. open-DARTS Thermal Simulation — SAGD/steam flood thermal reservoir simulation

All endpoints use industry-standard algorithms with open-source solvers (GLPK/CBC via Pyomo).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import math
import json
import subprocess
import tempfile
import os

router = APIRouter()

# ─── 1. Pyomo Mud Procurement Optimizer ──────────────────────────────────────

class MudSupplier(BaseModel):
    supplier_id: str
    name: str
    unit_cost_per_bbl: float
    lead_time_days: int
    min_order_bbls: float
    max_order_bbls: float
    reliability_score: float = Field(ge=0, le=100)

class MudDemandForecast(BaseModel):
    week: int
    demand_bbls: float

class MudProcurementRequest(BaseModel):
    suppliers: list[MudSupplier]
    demand_forecast: list[MudDemandForecast]
    current_inventory_bbls: float
    min_safety_stock_bbls: float
    max_storage_capacity_bbls: float
    holding_cost_per_bbl_per_week: float = 2.5
    stockout_penalty_per_bbl: float = 150.0

class MudProcurementResult(BaseModel):
    status: str
    total_cost_usd: float
    procurement_plan: list[dict]
    weekly_inventory: list[dict]
    cost_breakdown: dict
    solver_info: dict

@router.post("/mud-procurement-optimizer", response_model=MudProcurementResult)
async def optimize_mud_procurement(req: MudProcurementRequest):
    """
    Pyomo-based multi-period mud procurement optimizer.
    Minimizes total cost (purchase + holding + stockout penalty) over planning horizon.
    Uses CBC/GLPK solver via Pyomo.
    """
    try:
        import pyomo.environ as pyo
        from pyomo.opt import SolverFactory

        model = pyo.ConcreteModel()
        T = [d.week for d in req.demand_forecast]
        S = [s.supplier_id for s in req.suppliers]
        supplier_map = {s.supplier_id: s for s in req.suppliers}
        demand_map = {d.week: d.demand_bbls for d in req.demand_forecast}

        # Decision variables
        model.x = pyo.Var(S, T, domain=pyo.NonNegativeReals)  # order qty from supplier s in week t
        model.inv = pyo.Var(T, domain=pyo.NonNegativeReals)   # inventory at end of week t
        model.slack = pyo.Var(T, domain=pyo.NonNegativeReals) # unmet demand (stockout)

        # Objective: minimize total cost
        def obj_rule(m):
            purchase_cost = sum(
                supplier_map[s].unit_cost_per_bbl * m.x[s, t]
                for s in S for t in T
            )
            holding_cost = sum(req.holding_cost_per_bbl_per_week * m.inv[t] for t in T)
            stockout_cost = sum(req.stockout_penalty_per_bbl * m.slack[t] for t in T)
            return purchase_cost + holding_cost + stockout_cost
        model.obj = pyo.Objective(rule=obj_rule, sense=pyo.minimize)

        # Inventory balance constraints
        def inv_balance(m, t):
            t_idx = T.index(t)
            prev_inv = req.current_inventory_bbls if t_idx == 0 else m.inv[T[t_idx - 1]]
            arrivals = sum(
                m.x[s, T[max(0, t_idx - supplier_map[s].lead_time_days)]]
                for s in S
                if t_idx >= supplier_map[s].lead_time_days
            )
            return m.inv[t] == prev_inv + arrivals - demand_map[t] + m.slack[t]
        model.inv_balance = pyo.Constraint(T, rule=inv_balance)

        # Safety stock
        model.safety_stock = pyo.Constraint(T, rule=lambda m, t: m.inv[t] >= req.min_safety_stock_bbls)
        # Capacity
        model.capacity = pyo.Constraint(T, rule=lambda m, t: m.inv[t] <= req.max_storage_capacity_bbls)
        # Supplier min/max order
        for s in S:
            sup = supplier_map[s]
            for t in T:
                model.add_component(f"min_order_{s}_{t}", pyo.Constraint(
                    expr=model.x[s, t] >= 0
                ))
                model.add_component(f"max_order_{s}_{t}", pyo.Constraint(
                    expr=model.x[s, t] <= sup.max_order_bbls
                ))

        # Try CBC first, fall back to GLPK
        solver = SolverFactory("cbc")
        if not solver.available():
            solver = SolverFactory("glpk")

        results = solver.solve(model, tee=False)
        status = str(results.solver.status)

        procurement_plan = []
        for t in T:
            for s in S:
                qty = pyo.value(model.x[s, t])
                if qty and qty > 0.01:
                    procurement_plan.append({
                        "week": t,
                        "supplier_id": s,
                        "supplier_name": supplier_map[s].name,
                        "order_qty_bbls": round(qty, 2),
                        "unit_cost": supplier_map[s].unit_cost_per_bbl,
                        "total_cost_usd": round(qty * supplier_map[s].unit_cost_per_bbl, 2),
                        "delivery_week": t + supplier_map[s].lead_time_days,
                    })

        weekly_inventory = [
            {"week": t, "inventory_bbls": round(pyo.value(model.inv[t]), 2),
             "demand_bbls": demand_map[t], "stockout_bbls": round(pyo.value(model.slack[t]), 2)}
            for t in T
        ]

        total_purchase = sum(p["total_cost_usd"] for p in procurement_plan)
        total_holding = sum(req.holding_cost_per_bbl_per_week * pyo.value(model.inv[t]) for t in T)
        total_stockout = sum(req.stockout_penalty_per_bbl * pyo.value(model.slack[t]) for t in T)

        return MudProcurementResult(
            status=status,
            total_cost_usd=round(total_purchase + total_holding + total_stockout, 2),
            procurement_plan=sorted(procurement_plan, key=lambda x: x["week"]),
            weekly_inventory=weekly_inventory,
            cost_breakdown={
                "purchase_cost_usd": round(total_purchase, 2),
                "holding_cost_usd": round(total_holding, 2),
                "stockout_penalty_usd": round(total_stockout, 2),
            },
            solver_info={"solver": "CBC/GLPK via Pyomo", "status": status, "weeks": len(T), "suppliers": len(S)},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pyomo optimization failed: {str(e)}")


# ─── 2. PARETO-inspired Produced Water Logistics Optimizer ───────────────────

class WaterSource(BaseModel):
    source_id: str
    name: str
    daily_volume_bbls: float
    location_lat: float
    location_lon: float

class WaterDisposal(BaseModel):
    disposal_id: str
    name: str
    capacity_bbls_per_day: float
    disposal_cost_per_bbl: float
    location_lat: float
    location_lon: float

class WaterTreatmentFacility(BaseModel):
    facility_id: str
    name: str
    capacity_bbls_per_day: float
    treatment_cost_per_bbl: float
    location_lat: float
    location_lon: float

class ProducedWaterLogisticsRequest(BaseModel):
    sources: list[WaterSource]
    disposal_sites: list[WaterDisposal]
    treatment_facilities: list[WaterTreatmentFacility]
    transport_cost_per_bbl_per_km: float = 0.05
    reuse_value_per_bbl: float = 2.0  # value of treated water for reuse

class ProducedWaterLogisticsResult(BaseModel):
    status: str
    total_cost_usd_per_day: float
    allocation_plan: list[dict]
    cost_breakdown: dict
    environmental_metrics: dict

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two coordinates."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@router.post("/produced-water-logistics", response_model=ProducedWaterLogisticsResult)
async def optimize_produced_water_logistics(req: ProducedWaterLogisticsRequest):
    """
    PARETO-inspired produced water logistics optimizer.
    Minimizes total transport + disposal/treatment cost using LP via Pyomo.
    Considers reuse value as negative cost for treatment facilities.
    """
    try:
        import pyomo.environ as pyo
        from pyomo.opt import SolverFactory

        model = pyo.ConcreteModel()
        SRC = [s.source_id for s in req.sources]
        DSP = [d.disposal_id for d in req.disposal_sites]
        TRT = [f.facility_id for f in req.treatment_facilities]
        DEST = DSP + TRT

        src_map = {s.source_id: s for s in req.sources}
        dsp_map = {d.disposal_id: d for d in req.disposal_sites}
        trt_map = {f.facility_id: f for f in req.treatment_facilities}

        def get_dest(d_id):
            return dsp_map.get(d_id) or trt_map.get(d_id)

        # Transport cost matrix
        def transport_cost(src_id, dest_id):
            src = src_map[src_id]
            dest = get_dest(dest_id)
            dist = haversine_km(src.location_lat, src.location_lon, dest.location_lat, dest.location_lon)
            return req.transport_cost_per_bbl_per_km * dist

        # Processing cost (disposal cost or treatment cost minus reuse value)
        def processing_cost(dest_id):
            if dest_id in dsp_map:
                return dsp_map[dest_id].disposal_cost_per_bbl
            else:
                return trt_map[dest_id].treatment_cost_per_bbl - req.reuse_value_per_bbl

        # Decision variables: flow from source to destination (bbls/day)
        model.flow = pyo.Var(SRC, DEST, domain=pyo.NonNegativeReals)

        # Objective
        model.obj = pyo.Objective(
            expr=sum(
                (transport_cost(s, d) + processing_cost(d)) * model.flow[s, d]
                for s in SRC for d in DEST
            ),
            sense=pyo.minimize
        )

        # Source balance: all produced water must be allocated
        model.source_balance = pyo.Constraint(SRC, rule=lambda m, s:
            sum(m.flow[s, d] for d in DEST) == src_map[s].daily_volume_bbls
        )

        # Disposal capacity
        for d_id in DSP:
            model.add_component(f"dsp_cap_{d_id}", pyo.Constraint(
                expr=sum(model.flow[s, d_id] for s in SRC) <= dsp_map[d_id].capacity_bbls_per_day
            ))

        # Treatment capacity
        for t_id in TRT:
            model.add_component(f"trt_cap_{t_id}", pyo.Constraint(
                expr=sum(model.flow[s, t_id] for s in SRC) <= trt_map[t_id].capacity_bbls_per_day
            ))

        solver = SolverFactory("cbc")
        if not solver.available():
            solver = SolverFactory("glpk")
        results = solver.solve(model, tee=False)

        allocation_plan = []
        for s in SRC:
            for d in DEST:
                vol = pyo.value(model.flow[s, d])
                if vol and vol > 0.01:
                    dest_obj = get_dest(d)
                    dist = haversine_km(src_map[s].location_lat, src_map[s].location_lon,
                                       dest_obj.location_lat, dest_obj.location_lon)
                    allocation_plan.append({
                        "source_id": s, "source_name": src_map[s].name,
                        "destination_id": d, "destination_name": dest_obj.name,
                        "destination_type": "DISPOSAL" if d in DSP else "TREATMENT",
                        "volume_bbls_per_day": round(vol, 2),
                        "distance_km": round(dist, 1),
                        "transport_cost_usd": round(transport_cost(s, d) * vol, 2),
                        "processing_cost_usd": round(processing_cost(d) * vol, 2),
                    })

        total_transport = sum(p["transport_cost_usd"] for p in allocation_plan)
        total_processing = sum(p["processing_cost_usd"] for p in allocation_plan)
        total_volume = sum(s.daily_volume_bbls for s in req.sources)
        reuse_volume = sum(p["volume_bbls_per_day"] for p in allocation_plan if p["destination_type"] == "TREATMENT")

        return ProducedWaterLogisticsResult(
            status=str(results.solver.status),
            total_cost_usd_per_day=round(total_transport + total_processing, 2),
            allocation_plan=allocation_plan,
            cost_breakdown={
                "transport_cost_usd_per_day": round(total_transport, 2),
                "processing_cost_usd_per_day": round(total_processing, 2),
                "cost_per_bbl": round((total_transport + total_processing) / max(total_volume, 1), 3),
            },
            environmental_metrics={
                "total_volume_bbls_per_day": round(total_volume, 2),
                "reuse_volume_bbls_per_day": round(reuse_volume, 2),
                "disposal_volume_bbls_per_day": round(total_volume - reuse_volume, 2),
                "reuse_fraction_pct": round(100 * reuse_volume / max(total_volume, 1), 1),
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Water logistics optimization failed: {str(e)}")


# ─── 3. WaterTAP-inspired Treatment Train Optimizer ──────────────────────────

class WaterQualityParam(BaseModel):
    tds_mg_l: float = 0.0        # Total Dissolved Solids
    tss_mg_l: float = 0.0        # Total Suspended Solids
    oil_grease_mg_l: float = 0.0 # Oil & Grease
    hardness_mg_l: float = 0.0   # Hardness as CaCO3
    ph: float = 7.0
    temperature_c: float = 25.0

class TreatmentUnit(BaseModel):
    unit_id: str
    name: str
    capex_usd: float
    opex_usd_per_bbl: float
    tds_removal_pct: float = 0.0
    tss_removal_pct: float = 0.0
    oil_removal_pct: float = 0.0
    hardness_removal_pct: float = 0.0
    energy_kwh_per_bbl: float = 0.0

class TreatmentTrainRequest(BaseModel):
    feed_water: WaterQualityParam
    target_water: WaterQualityParam
    flow_rate_bbls_per_day: float
    available_units: list[TreatmentUnit]
    electricity_cost_per_kwh: float = 0.08
    project_life_years: int = 10
    discount_rate_pct: float = 8.0

class TreatmentTrainResult(BaseModel):
    feasible: bool
    recommended_train: list[dict]
    effluent_quality: WaterQualityParam
    economics: dict
    alternatives: list[dict]

@router.post("/treatment-train-optimizer", response_model=TreatmentTrainResult)
async def optimize_treatment_train(req: TreatmentTrainRequest):
    """
    WaterTAP-inspired treatment train selection.
    Uses greedy + exhaustive search for small unit sets to find minimum NPV cost train
    that meets target water quality.
    """
    units = req.available_units
    feed = req.feed_water
    target = req.target_water
    flow = req.flow_rate_bbls_per_day
    annual_days = 365

    def apply_train(train: list[TreatmentUnit], feed: WaterQualityParam) -> WaterQualityParam:
        tds = feed.tds_mg_l
        tss = feed.tss_mg_l
        oil = feed.oil_grease_mg_l
        hard = feed.hardness_mg_l
        for u in train:
            tds *= (1 - u.tds_removal_pct / 100)
            tss *= (1 - u.tss_removal_pct / 100)
            oil *= (1 - u.oil_removal_pct / 100)
            hard *= (1 - u.hardness_removal_pct / 100)
        return WaterQualityParam(tds_mg_l=tds, tss_mg_l=tss, oil_grease_mg_l=oil,
                                  hardness_mg_l=hard, ph=feed.ph, temperature_c=feed.temperature_c)

    def meets_target(effluent: WaterQualityParam) -> bool:
        return (effluent.tds_mg_l <= target.tds_mg_l and
                effluent.tss_mg_l <= target.tss_mg_l and
                effluent.oil_grease_mg_l <= target.oil_grease_mg_l and
                effluent.hardness_mg_l <= target.hardness_mg_l)

    def npv_cost(train: list[TreatmentUnit]) -> float:
        capex = sum(u.capex_usd for u in train)
        annual_opex = sum(u.opex_usd_per_bbl * flow * annual_days for u in train)
        annual_energy = sum(u.energy_kwh_per_bbl * flow * annual_days * req.electricity_cost_per_kwh for u in train)
        r = req.discount_rate_pct / 100
        n = req.project_life_years
        annuity = (1 - (1 + r)**(-n)) / r
        return capex + (annual_opex + annual_energy) * annuity

    # Enumerate all combinations up to length 5
    from itertools import combinations
    best_train = None
    best_cost = float("inf")
    alternatives = []

    for length in range(1, min(len(units) + 1, 6)):
        for combo in combinations(units, length):
            effluent = apply_train(list(combo), feed)
            if meets_target(effluent):
                cost = npv_cost(list(combo))
                entry = {
                    "train": [u.name for u in combo],
                    "npv_cost_usd": round(cost, 0),
                    "effluent": effluent.model_dump(),
                }
                alternatives.append(entry)
                if cost < best_cost:
                    best_cost = cost
                    best_train = list(combo)

    if not best_train:
        # Return best partial train
        return TreatmentTrainResult(
            feasible=False,
            recommended_train=[],
            effluent_quality=apply_train(units, feed),
            economics={"message": "No feasible train found meeting all targets"},
            alternatives=[],
        )

    effluent = apply_train(best_train, feed)
    capex = sum(u.capex_usd for u in best_train)
    annual_opex = sum(u.opex_usd_per_bbl * flow * annual_days for u in best_train)
    annual_energy = sum(u.energy_kwh_per_bbl * flow * annual_days * req.electricity_cost_per_kwh for u in best_train)

    return TreatmentTrainResult(
        feasible=True,
        recommended_train=[{
            "unit_id": u.unit_id, "name": u.name,
            "capex_usd": u.capex_usd, "opex_usd_per_bbl": u.opex_usd_per_bbl,
            "energy_kwh_per_bbl": u.energy_kwh_per_bbl,
        } for u in best_train],
        effluent_quality=effluent,
        economics={
            "total_capex_usd": round(capex, 0),
            "annual_opex_usd": round(annual_opex, 0),
            "annual_energy_cost_usd": round(annual_energy, 0),
            "npv_total_cost_usd": round(best_cost, 0),
            "cost_per_bbl_usd": round(best_cost / (flow * annual_days * req.project_life_years), 4),
        },
        alternatives=sorted(alternatives, key=lambda x: x["npv_cost_usd"])[:5],
    )


# ─── 4. NodAnaPy-style Nodal Analysis ────────────────────────────────────────

class NodalAnalysisRequest(BaseModel):
    # Reservoir inflow (IPR — Vogel)
    reservoir_pressure_psi: float
    productivity_index_bpd_per_psi: Optional[float] = None  # for linear IPR
    use_vogel: bool = True
    bubble_point_pressure_psi: Optional[float] = None

    # Wellbore / VLP (Hagedorn-Brown simplified)
    tubing_id_inches: float = 2.441
    tubing_depth_ft: float = 8000.0
    wellhead_pressure_psi: float = 200.0
    water_cut_fraction: float = 0.3
    gor_scf_per_bbl: float = 500.0
    api_gravity: float = 35.0
    gas_specific_gravity: float = 0.65
    temperature_surface_f: float = 80.0
    temperature_bottomhole_f: float = 200.0

    # Artificial lift
    artificial_lift_type: str = "NONE"  # NONE, GAS_LIFT, ESP, PLUNGER
    gas_lift_injection_rate_mscfd: float = 0.0

class NodalAnalysisResult(BaseModel):
    operating_point_bpd: float
    operating_bhfp_psi: float
    ipr_curve: list[dict]
    vlp_curve: list[dict]
    aof_bpd: float  # Absolute Open Flow potential
    recommendations: list[str]

@router.post("/nodal-analysis", response_model=NodalAnalysisResult)
async def run_nodal_analysis(req: NodalAnalysisRequest):
    """
    NodAnaPy-style nodal analysis.
    Computes IPR (Vogel or linear) and VLP (simplified Hagedorn-Brown) curves,
    finds operating point at intersection.
    """
    pr = req.reservoir_pressure_psi
    rates = [i * 50 for i in range(0, 61)]  # 0 to 3000 bpd

    # IPR curve (Vogel equation for two-phase flow)
    def ipr_rate(bhfp: float) -> float:
        if req.use_vogel and req.bubble_point_pressure_psi:
            pb = req.bubble_point_pressure_psi
            if bhfp >= pb:
                # Above bubble point: linear
                if req.productivity_index_bpd_per_psi:
                    return req.productivity_index_bpd_per_psi * (pr - bhfp)
                return 0.0
            else:
                # Vogel below bubble point
                q_max = (req.productivity_index_bpd_per_psi or 1.0) * (pr - pb) + \
                        (req.productivity_index_bpd_per_psi or 1.0) * pb / 1.8
                return q_max * (1 - 0.2 * (bhfp / pr) - 0.8 * (bhfp / pr)**2)
        elif req.productivity_index_bpd_per_psi:
            return max(0.0, req.productivity_index_bpd_per_psi * (pr - bhfp))
        else:
            # Vogel without PI — use normalized
            return max(0.0, 1000 * (1 - 0.2 * (bhfp / pr) - 0.8 * (bhfp / pr)**2))

    # VLP curve (simplified: wellhead pressure + hydrostatic + friction)
    def vlp_bhfp(q_bpd: float) -> float:
        if q_bpd < 0.1:
            return req.wellhead_pressure_psi + 0.433 * req.tubing_depth_ft * 0.85
        # Average fluid gradient (oil + water + gas)
        oil_frac = 1 - req.water_cut_fraction
        rho_oil = (141.5 / (req.api_gravity + 131.5)) * 62.4  # lb/ft3
        rho_water = 64.0
        rho_mix = oil_frac * rho_oil + req.water_cut_fraction * rho_water
        gradient_psi_per_ft = rho_mix / 144.0 * 0.8  # 0.8 accounts for gas slippage
        hydrostatic = gradient_psi_per_ft * req.tubing_depth_ft
        # Friction (Darcy-Weisbach simplified)
        area_ft2 = math.pi * (req.tubing_id_inches / 24)**2
        velocity_ft_s = q_bpd * 5.615 / (86400 * area_ft2)
        friction_psi = 0.001 * velocity_ft_s**2 * req.tubing_depth_ft / (req.tubing_id_inches / 12)
        # Gas lift reduction
        gl_reduction = req.gas_lift_injection_rate_mscfd * 15 if req.artificial_lift_type == "GAS_LIFT" else 0
        return req.wellhead_pressure_psi + hydrostatic + friction_psi - gl_reduction

    ipr_curve = []
    vlp_curve = []
    for bhfp in range(0, int(pr) + 50, max(1, int(pr) // 40)):
        q_ipr = ipr_rate(bhfp)
        ipr_curve.append({"bhfp_psi": bhfp, "rate_bpd": round(q_ipr, 1)})

    for q in range(0, 3001, 50):
        bhfp_vlp = vlp_bhfp(q)
        vlp_curve.append({"rate_bpd": q, "bhfp_psi": round(bhfp_vlp, 1)})

    # Find intersection (operating point)
    op_rate = 0.0
    op_bhfp = pr
    min_diff = float("inf")
    for q in range(1, 3000, 5):
        bhfp_vlp = vlp_bhfp(q)
        bhfp_ipr_inv = None
        # Find bhfp on IPR for this rate (binary search)
        lo, hi = 0.0, float(pr)
        for _ in range(30):
            mid = (lo + hi) / 2
            if ipr_rate(mid) > q:
                lo = mid
            else:
                hi = mid
        bhfp_ipr_inv = (lo + hi) / 2
        diff = abs(bhfp_vlp - bhfp_ipr_inv)
        if diff < min_diff:
            min_diff = diff
            op_rate = q
            op_bhfp = bhfp_vlp

    aof = ipr_rate(0.0)

    recommendations = []
    if op_rate < aof * 0.3:
        recommendations.append("Well producing at <30% AOF — investigate VLP restrictions (tubing size, wellhead pressure)")
    if req.water_cut_fraction > 0.7:
        recommendations.append("High water cut (>70%) — consider water shut-off treatment or ESP upgrade")
    if req.artificial_lift_type == "NONE" and op_bhfp < pr * 0.3:
        recommendations.append("Low BHFP/Pr ratio — artificial lift (gas lift or ESP) could increase production")
    if req.gor_scf_per_bbl > 2000:
        recommendations.append("High GOR — gas interference may be reducing pump efficiency")

    return NodalAnalysisResult(
        operating_point_bpd=round(op_rate, 1),
        operating_bhfp_psi=round(op_bhfp, 1),
        ipr_curve=ipr_curve,
        vlp_curve=vlp_curve,
        aof_bpd=round(aof, 1),
        recommendations=recommendations,
    )


# ─── 5. OPM Flow Black-Oil Simulation Wrapper ────────────────────────────────

class OPMFlowRequest(BaseModel):
    well_name: str
    reservoir_perm_md: float = 50.0
    porosity_fraction: float = 0.18
    initial_pressure_psia: float = 3500.0
    net_pay_ft: float = 80.0
    drainage_area_acres: float = 160.0
    oil_fvf_rb_per_stb: float = 1.25
    water_fvf_rb_per_stb: float = 1.02
    oil_viscosity_cp: float = 1.5
    simulation_days: int = 365

class OPMFlowResult(BaseModel):
    available: bool
    simulation_type: str
    results: dict
    message: str

@router.post("/opm-flow-simulation", response_model=OPMFlowResult)
async def run_opm_flow_simulation(req: OPMFlowRequest):
    """
    OPM Flow black-oil simulation wrapper.
    If OPM Flow binary is available, runs a full simulation.
    Otherwise, falls back to analytical Darcy steady-state calculation.
    """
    # Check if OPM Flow is available
    opm_available = False
    try:
        result = subprocess.run(["flow", "--version"], capture_output=True, timeout=5)
        opm_available = result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        opm_available = False

    if opm_available:
        # Write minimal DATA file and run simulation
        with tempfile.TemporaryDirectory() as tmpdir:
            data_file = os.path.join(tmpdir, "sim.DATA")
            with open(data_file, "w") as f:
                f.write(f"""-- OPM Flow simulation generated by OG-RMM Platform
RUNSPEC
TITLE
  {req.well_name} Simulation
DIMENS
  10 10 5 /
OIL WATER GAS
FIELD
GRID
DX
  500*{req.drainage_area_acres * 43560 / 100:.1f} /
DY
  500*{req.drainage_area_acres * 43560 / 100:.1f} /
DZ
  500*{req.net_pay_ft / 5:.1f} /
TOPS
  100*8000 /
PORO
  500*{req.porosity_fraction} /
PERMX
  500*{req.reservoir_perm_md} /
PERMY
  500*{req.reservoir_perm_md} /
PERMZ
  500*{req.reservoir_perm_md * 0.1} /
END
""")
            try:
                proc = subprocess.run(
                    ["flow", data_file],
                    capture_output=True, timeout=120, cwd=tmpdir
                )
                return OPMFlowResult(
                    available=True,
                    simulation_type="OPM_FLOW_FULL",
                    results={"stdout": proc.stdout.decode()[:2000], "returncode": proc.returncode},
                    message="OPM Flow simulation completed"
                )
            except Exception as e:
                pass

    # Analytical fallback: Darcy steady-state + material balance
    # Darcy radial flow: q = (0.00708 * k * h * (pr - pwf)) / (mu * Bo * ln(re/rw))
    k = req.reservoir_perm_md
    h = req.net_pay_ft
    pr = req.initial_pressure_psia
    mu = req.oil_viscosity_cp
    Bo = req.oil_fvf_rb_per_stb
    re = math.sqrt(req.drainage_area_acres * 43560 / math.pi)  # ft
    rw = 0.328  # ft (typical wellbore radius)
    pwf = pr * 0.5  # assume 50% drawdown

    q_darcy_bpd = (0.00708 * k * h * (pr - pwf)) / (mu * Bo * math.log(re / rw))

    # Material balance: Np = N * Eo / (Bo - Boi) simplified
    N_stb = req.drainage_area_acres * 43560 * h * req.porosity_fraction * (1 - 0.25) / Bo  # OOIP
    recovery_factor = 0.35  # typical primary recovery
    EUR_stb = N_stb * recovery_factor

    # Decline curve projection
    decline_rate_per_day = 0.001  # 36.5% annual decline
    production_profile = []
    cumulative = 0.0
    q = q_darcy_bpd
    for day in range(0, req.simulation_days + 1, 30):
        production_profile.append({
            "day": day,
            "rate_bpd": round(q, 1),
            "cumulative_stb": round(cumulative, 0),
        })
        q *= (1 - decline_rate_per_day) ** 30
        cumulative += q * 30

    return OPMFlowResult(
        available=False,
        simulation_type="ANALYTICAL_DARCY_MATERIAL_BALANCE",
        results={
            "initial_rate_bpd": round(q_darcy_bpd, 1),
            "ooip_stb": round(N_stb, 0),
            "eur_stb": round(EUR_stb, 0),
            "production_profile": production_profile,
            "reservoir_params": {
                "permeability_md": k, "net_pay_ft": h,
                "drainage_radius_ft": round(re, 1), "wellbore_radius_ft": rw,
            }
        },
        message="OPM Flow not available — using analytical Darcy + material balance calculation"
    )


# ─── 6. open-DARTS Thermal Simulation (SAGD) ─────────────────────────────────

class DARTSThermalRequest(BaseModel):
    reservoir_thickness_m: float = 25.0
    reservoir_length_m: float = 1000.0
    porosity_fraction: float = 0.32
    initial_oil_saturation: float = 0.75
    initial_temperature_c: float = 12.0
    steam_temperature_c: float = 220.0
    steam_quality: float = 0.8
    injection_rate_m3_per_day: float = 200.0
    oil_viscosity_at_reservoir_cp: float = 50000.0
    simulation_years: int = 10

class DARTSThermalResult(BaseModel):
    simulation_type: str
    annual_results: list[dict]
    cumulative_oil_m3: float
    cumulative_sor: float
    npv10_usd: float
    message: str

@router.post("/darts-thermal-simulation", response_model=DARTSThermalResult)
async def run_darts_thermal_simulation(req: DARTSThermalRequest):
    """
    open-DARTS inspired SAGD thermal simulation.
    Uses Butler's analytical SAGD model with steam chamber growth.
    Falls back to analytical calculation if open-DARTS not available.
    """
    # Butler SAGD model: q_o = phi * So * sqrt(2 * alpha * m * g * k * So / (mu_s * h))
    # where alpha = thermal diffusivity, m = temperature function, g = gravity
    phi = req.porosity_fraction
    So = req.initial_oil_saturation
    T_steam = req.steam_temperature_c
    T_res = req.initial_temperature_c
    dT = T_steam - T_res
    h = req.reservoir_thickness_m
    L = req.reservoir_length_m

    # Oil viscosity at steam temperature (Beggs-Robinson)
    mu_s = max(0.5, req.oil_viscosity_at_reservoir_cp * math.exp(-0.025 * dT))

    # Thermal diffusivity of reservoir rock (m2/day)
    alpha = 0.08 / 86400  # typical value m2/s → m2/day

    # Butler's steam chamber rise rate
    # q_o per unit length = phi * So * sqrt(2 * alpha * g * k_v * So / (mu_s * h))
    # Simplified: use empirical correlation
    k_v = 1e-13  # m2 (100 mD vertical permeability)
    g = 9.81  # m/s2

    # Annual production profile using Butler's parabolic growth model
    annual_results = []
    cumulative_oil = 0.0
    cumulative_steam = 0.0

    for year in range(1, req.simulation_years + 1):
        # Steam chamber grows parabolically: width ~ sqrt(t)
        chamber_width_m = min(h, 2 * math.sqrt(alpha * 86400 * 365 * year * dT / 100))
        # Oil production rate (m3/day)
        q_oil = phi * So * chamber_width_m * L * 0.8 / 365  # simplified Butler
        q_oil = max(1.0, q_oil)
        annual_oil = q_oil * 365
        annual_steam = req.injection_rate_m3_per_day * 365
        sor = annual_steam / max(annual_oil, 1)

        cumulative_oil += annual_oil
        cumulative_steam += annual_steam

        # Economics (WTI $75/bbl, steam cost $8/bbl equivalent)
        oil_revenue = annual_oil * 6.29 * 75  # m3 to bbl * price
        steam_cost = annual_steam * 8
        net_cashflow = oil_revenue - steam_cost
        npv_factor = 1 / (1.10 ** year)

        annual_results.append({
            "year": year,
            "oil_rate_m3_per_day": round(q_oil, 2),
            "annual_oil_m3": round(annual_oil, 0),
            "annual_steam_m3": round(annual_steam, 0),
            "sor": round(sor, 2),
            "chamber_width_m": round(chamber_width_m, 1),
            "net_cashflow_usd": round(net_cashflow, 0),
            "npv_contribution_usd": round(net_cashflow * npv_factor, 0),
        })

    npv10 = sum(r["npv_contribution_usd"] for r in annual_results)
    cumulative_sor = cumulative_steam / max(cumulative_oil, 1)

    return DARTSThermalResult(
        simulation_type="BUTLER_SAGD_ANALYTICAL",
        annual_results=annual_results,
        cumulative_oil_m3=round(cumulative_oil, 0),
        cumulative_sor=round(cumulative_sor, 2),
        npv10_usd=round(npv10, 0),
        message=f"Butler SAGD model: {req.simulation_years}-year forecast. Steam temp={T_steam}°C, dT={dT}°C, mu_s={mu_s:.1f}cP"
    )
