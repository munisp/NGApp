"""
Oil & Gas RMM Platform — Python Analytics Service
Provides production analytics, KPI computation, and lakehouse query APIs.
Uses Apache Sedona for geospatial queries and DuckDB/Delta Lake for lakehouse access.
Spec: FRQ-013 — query response < 2s for 90th percentile; BRQ-007 — production reporting.

Stack:
  FastAPI — HTTP API framework
  DuckDB — in-process analytics (Delta Lake queries)
  Apache Sedona — geospatial analytics
  Pandas / NumPy — data processing
  SQLAlchemy + asyncpg — PostgreSQL access (no MySQL/TiDB)
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import get_db_pool, close_db_pool
from .routers import production, kpi, geospatial, lakehouse, trexm_analytics, geoscience_libs, optimization_services

# Structured JSON logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "msg": "%(message)s"}',
)
logger = logging.getLogger("analytics-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize and clean up resources."""
    logger.info("Analytics Service starting up")
    await get_db_pool()
    yield
    logger.info("Analytics Service shutting down")
    await close_db_pool()


app = FastAPI(
    title="OG RMM Analytics Service",
    description="Production analytics, KPI computation, and lakehouse query APIs for Oil & Gas operations.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for the React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(production.router, prefix="/api/v1/analytics/production", tags=["production"])
app.include_router(kpi.router, prefix="/api/v1/analytics/kpi", tags=["kpi"])
app.include_router(geospatial.router, prefix="/api/v1/analytics/geo", tags=["geospatial"])
app.include_router(lakehouse.router, prefix="/api/v1/analytics/lakehouse", tags=["lakehouse"])
app.include_router(trexm_analytics.router, prefix="/api/v1/analytics", tags=["trexm-analytics"])
app.include_router(geoscience_libs.router, prefix="/api/v1/analytics", tags=["geoscience-libs"])
app.include_router(optimization_services.router, prefix="/api/v1/analytics/optimize", tags=["optimization-services"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics-service"}


@app.get("/api/v1/analytics/summary")
async def get_summary():
    """High-level operational summary for the dashboard overview card."""
    return {
        "total_wells": 142,
        "active_wells": 128,
        "shut_in_wells": 9,
        "drilling_wells": 5,
        "total_production_bpd": 48_320,
        "total_gas_mmscfd": 124.5,
        "total_water_bpd": 18_200,
        "active_alarms": 7,
        "critical_alarms": 2,
        "avg_uptime_pct": 96.4,
        "mtbf_days": 142,
        "revenue_today_usd": 4_832_000,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8085")),
        reload=os.getenv("ENV", "production") == "development",
        log_level="info",
    )
