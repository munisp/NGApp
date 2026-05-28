"""
Production Analytics Router
Provides production volume, revenue, and efficiency KPIs.
Queries PostgreSQL daily_production table and computes rolling metrics.
"""

import logging
from datetime import date, timedelta
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..database import get_db_pool

logger = logging.getLogger(__name__)
router = APIRouter()


class DailyProductionRecord(BaseModel):
    well_id: str
    production_date: date
    oil_bbls: float
    gas_mcf: float
    water_bbls: float
    uptime_hours: float
    avg_tubing_psi: Optional[float]
    avg_flow_rate: Optional[float]


class ProductionSummary(BaseModel):
    period_start: date
    period_end: date
    total_oil_bbls: float
    total_gas_mcf: float
    total_water_bbls: float
    avg_daily_oil_bpd: float
    avg_uptime_pct: float
    water_cut_pct: float
    gor_scf_per_bbl: float  # Gas-Oil Ratio
    well_count: int


@router.get("/daily/{well_id}", response_model=List[DailyProductionRecord])
async def get_daily_production(
    well_id: str,
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    limit: int = Query(default=90, le=365),
):
    """Get daily production records for a specific well."""
    if end is None:
        end = date.today()
    if start is None:
        start = end - timedelta(days=limit)

    pool = await get_db_pool()
    rows = await pool.fetch(
        """
        SELECT well_id::text, production_date, oil_bbls, gas_mcf, water_bbls,
               uptime_hours, avg_tubing_psi, avg_flow_rate
        FROM daily_production
        WHERE well_id = $1::uuid
          AND production_date BETWEEN $2 AND $3
        ORDER BY production_date DESC
        LIMIT $4
        """,
        well_id, start, end, limit,
    )

    return [
        DailyProductionRecord(
            well_id=r["well_id"],
            production_date=r["production_date"],
            oil_bbls=float(r["oil_bbls"] or 0),
            gas_mcf=float(r["gas_mcf"] or 0),
            water_bbls=float(r["water_bbls"] or 0),
            uptime_hours=float(r["uptime_hours"] or 0),
            avg_tubing_psi=float(r["avg_tubing_psi"]) if r["avg_tubing_psi"] else None,
            avg_flow_rate=float(r["avg_flow_rate"]) if r["avg_flow_rate"] else None,
        )
        for r in rows
    ]


@router.get("/summary", response_model=ProductionSummary)
async def get_production_summary(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    operator_id: Optional[str] = Query(default=None),
):
    """Get aggregated production summary across all wells for a date range."""
    if end is None:
        end = date.today()
    if start is None:
        start = end - timedelta(days=30)

    pool = await get_db_pool()

    row = await pool.fetchrow(
        """
        SELECT
            COUNT(DISTINCT dp.well_id) as well_count,
            COALESCE(SUM(dp.oil_bbls), 0) as total_oil,
            COALESCE(SUM(dp.gas_mcf), 0) as total_gas,
            COALESCE(SUM(dp.water_bbls), 0) as total_water,
            COALESCE(AVG(dp.uptime_hours / 24.0 * 100), 0) as avg_uptime
        FROM daily_production dp
        JOIN wells w ON dp.well_id = w.well_id
        WHERE dp.production_date BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR w.operator_id = $3::uuid)
        """,
        start, end, operator_id,
    )

    days = (end - start).days + 1
    total_oil = float(row["total_oil"] or 0)
    total_gas = float(row["total_gas"] or 0)
    total_water = float(row["total_water"] or 0)
    well_count = int(row["well_count"] or 0)
    avg_uptime = float(row["avg_uptime"] or 0)

    # Compute derived metrics
    avg_daily_oil = total_oil / days if days > 0 else 0
    total_liquid = total_oil + total_water
    water_cut = (total_water / total_liquid * 100) if total_liquid > 0 else 0
    gor = (total_gas * 1000 / total_oil) if total_oil > 0 else 0  # SCF/BBL

    return ProductionSummary(
        period_start=start,
        period_end=end,
        total_oil_bbls=total_oil,
        total_gas_mcf=total_gas,
        total_water_bbls=total_water,
        avg_daily_oil_bpd=avg_daily_oil,
        avg_uptime_pct=avg_uptime,
        water_cut_pct=water_cut,
        gor_scf_per_bbl=gor,
        well_count=well_count,
    )


@router.get("/decline-curve/{well_id}")
async def get_decline_curve(well_id: str, months: int = Query(default=24, le=120)):
    """
    Compute Arps decline curve analysis for a well.
    Returns historical production and projected future production.
    Spec: BRQ-007 — decline curve analysis for reserve estimation.
    """
    pool = await get_db_pool()
    rows = await pool.fetch(
        """
        SELECT production_date, oil_bbls
        FROM daily_production
        WHERE well_id = $1::uuid
          AND oil_bbls > 0
        ORDER BY production_date ASC
        LIMIT 365
        """,
        well_id,
    )

    if len(rows) < 10:
        raise HTTPException(status_code=404, detail="Insufficient production history for decline curve analysis")

    # Extract production data
    dates = [r["production_date"] for r in rows]
    production = np.array([float(r["oil_bbls"]) for r in rows])

    # Fit exponential decline: q(t) = qi * exp(-Di * t)
    t = np.arange(len(production), dtype=float)
    # Avoid log of zero
    prod_nonzero = np.maximum(production, 0.1)
    log_prod = np.log(prod_nonzero)

    # Linear regression on log-transformed data
    coeffs = np.polyfit(t, log_prod, 1)
    Di = -coeffs[0]  # Decline rate per day
    qi = np.exp(coeffs[1])  # Initial rate

    # Project future production
    future_t = np.arange(len(production), len(production) + months * 30)
    projected = qi * np.exp(-Di * future_t)

    # Compute EUR (Estimated Ultimate Recovery) using exponential integral
    eur_remaining = qi * np.exp(-Di * len(production)) / Di if Di > 0 else 0

    return {
        "well_id": well_id,
        "decline_type": "exponential",
        "initial_rate_bpd": float(qi),
        "decline_rate_per_day": float(Di),
        "decline_rate_annual_pct": float(Di * 365 * 100),
        "eur_remaining_bbls": float(eur_remaining),
        "historical": [
            {"date": str(d), "oil_bbls": float(p)}
            for d, p in zip(dates, production)
        ],
        "projected": [
            {"month": i + 1, "oil_bbls_per_day": float(p)}
            for i, p in enumerate(projected[::30])
        ],
    }


@router.get("/field-summary")
async def get_field_summary():
    """
    Get production summary grouped by field/basin.
    Used for the geospatial heatmap overlay.
    """
    pool = await get_db_pool()
    rows = await pool.fetch(
        """
        SELECT
            w.field_name,
            w.basin,
            COUNT(DISTINCT w.well_id) as well_count,
            COALESCE(SUM(dp.oil_bbls), 0) as oil_30d,
            COALESCE(SUM(dp.gas_mcf), 0) as gas_30d,
            AVG(w.latitude) as lat,
            AVG(w.longitude) as lon
        FROM wells w
        LEFT JOIN daily_production dp ON w.well_id = dp.well_id
            AND dp.production_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY w.field_name, w.basin
        ORDER BY oil_30d DESC
        """
    )

    return {
        "fields": [
            {
                "field_name": r["field_name"],
                "basin": r["basin"],
                "well_count": r["well_count"],
                "oil_30d_bbls": float(r["oil_30d"]),
                "gas_30d_mcf": float(r["gas_30d"]),
                "lat": float(r["lat"]) if r["lat"] else None,
                "lon": float(r["lon"]) if r["lon"] else None,
            }
            for r in rows
        ]
    }
