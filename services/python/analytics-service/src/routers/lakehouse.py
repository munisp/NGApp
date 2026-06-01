"""
Lakehouse Router — DuckDB + Delta Lake Analytics
Provides ad-hoc SQL queries against the Delta Lake data lakehouse.
Uses DuckDB for in-process analytics with Delta Lake extension.
Spec: FRQ-015 — lakehouse query API; BRQ-011 — historical data access.

Lakehouse Schema (Delta Lake tables on object storage):
  bronze/field_telemetry/     — raw sensor readings (partitioned by date/well)
  bronze/production_reports/  — raw production reports
  silver/well_metrics/        — cleaned, validated metrics
  silver/production_daily/    — aggregated daily production
  gold/executive_summary/     — executive KPI tables
  gold/regulatory_reports/    — compliance reporting tables
"""

import logging
import os
from typing import Any, Dict, List, Optional

import duckdb
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# DuckDB connection (in-memory for analytics)
_duckdb_conn: Optional[duckdb.DuckDBPyConnection] = None


def get_duckdb() -> duckdb.DuckDBPyConnection:
    """Get or create the DuckDB connection with Delta Lake extension."""
    global _duckdb_conn
    if _duckdb_conn is None:
        _duckdb_conn = duckdb.connect(":memory:")
        # In production: install delta extension and configure S3/GCS
        # _duckdb_conn.execute("INSTALL delta; LOAD delta;")
        # _duckdb_conn.execute("SET s3_region='us-east-1';")
        logger.info("DuckDB connection initialized")
    return _duckdb_conn


class QueryRequest(BaseModel):
    sql: str
    limit: int = 1000
    timeout_seconds: int = 30


class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: float


@router.post("/query", response_model=QueryResult)
async def execute_lakehouse_query(request: QueryRequest):
    """
    Execute an ad-hoc SQL query against the Delta Lake lakehouse.
    Queries run on DuckDB with Delta Lake extension.
    Spec: FRQ-015 — query response < 2s for 90th percentile.
    """
    import time

    # Security: only allow SELECT statements
    sql = request.sql.strip()
    if not sql.upper().startswith("SELECT"):
        raise HTTPException(
            status_code=400,
            detail="Only SELECT statements are allowed"
        )

    # Enforce limit
    if "LIMIT" not in sql.upper():
        sql = f"{sql} LIMIT {request.limit}"

    conn = get_duckdb()
    start_time = time.time()

    try:
        result = conn.execute(sql).fetchdf()
        elapsed_ms = (time.time() - start_time) * 1000

        return QueryResult(
            columns=list(result.columns),
            rows=result.values.tolist(),
            row_count=len(result),
            execution_time_ms=elapsed_ms,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query failed: {str(e)}")


@router.get("/tables")
async def list_lakehouse_tables():
    """List available Delta Lake tables in the lakehouse."""
    return {
        "tables": [
            {
                "name": "bronze.field_telemetry",
                "description": "Raw sensor readings from edge agents",
                "partition_by": ["date", "well_id"],
                "retention_days": 90,
                "format": "delta",
            },
            {
                "name": "bronze.production_reports",
                "description": "Raw production reports from operators",
                "partition_by": ["year", "month"],
                "retention_days": 3650,
                "format": "delta",
            },
            {
                "name": "silver.well_metrics",
                "description": "Cleaned and validated well metrics",
                "partition_by": ["date"],
                "retention_days": 365,
                "format": "delta",
            },
            {
                "name": "silver.production_daily",
                "description": "Aggregated daily production per well",
                "partition_by": ["year", "month"],
                "retention_days": 3650,
                "format": "delta",
            },
            {
                "name": "gold.executive_summary",
                "description": "Executive KPI summary (refreshed hourly)",
                "partition_by": ["date"],
                "retention_days": 3650,
                "format": "delta",
            },
            {
                "name": "gold.regulatory_reports",
                "description": "Compliance and regulatory reporting tables",
                "partition_by": ["year", "report_type"],
                "retention_days": 7300,
                "format": "delta",
            },
        ]
    }


@router.get("/executive-summary")
async def get_executive_summary(
    year: int = Query(default=2025),
    month: Optional[int] = Query(default=None),
):
    """
    Return executive summary from the gold layer.
    Spec: BRQ-011 — monthly executive production report.
    """
    conn = get_duckdb()

    # In production: query Delta Lake gold.executive_summary
    # For demonstration, return computed mock data
    return {
        "period": f"{year}-{month:02d}" if month else str(year),
        "total_production": {
            "oil_bbls": 1_456_800,
            "gas_mmscf": 3_740.2,
            "water_bbls": 548_200,
            "ngl_bbls": 124_500,
        },
        "revenue": {
            "oil_usd": 109_260_000,
            "gas_usd": 14_960_800,
            "ngl_usd": 6_225_000,
            "total_usd": 130_445_800,
        },
        "costs": {
            "opex_usd": 28_400_000,
            "royalties_usd": 19_566_870,
            "taxes_usd": 9_133_206,
            "net_revenue_usd": 73_345_724,
        },
        "operations": {
            "avg_uptime_pct": 96.4,
            "total_wells": 142,
            "active_wells": 128,
            "new_wells_drilled": 3,
            "workovers_completed": 7,
        },
        "top_producers": [
            {"well_name": "Permian Basin #47", "oil_bpd": 1_240, "rank": 1},
            {"well_name": "Eagle Ford #12", "oil_bpd": 980, "rank": 2},
            {"well_name": "Bakken #89", "oil_bpd": 870, "rank": 3},
        ],
    }
