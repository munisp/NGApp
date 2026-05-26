"""
OG-RMM RTDIP Query API — FastAPI service
=========================================
Provides REST endpoints for time-series analytics on Delta Lake data.
Uses RTDIP Core (PySpark + Delta Lake) when available, falls back to
in-memory simulation for development.

Endpoints:
  POST /rtdip/twa          — Time-weighted average
  POST /rtdip/resample     — Resample to fixed interval
  POST /rtdip/latest       — Latest values for tags
  GET  /rtdip/tags         — Browse available OPC-UA tags
  GET  /health             — Health check
  GET  /metrics            — Ingestion statistics
"""
from __future__ import annotations

import asyncio
import logging
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rtdip-api")

# ─── Configuration ─────────────────────────────────────────────────────────────

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "ogrmm_minio")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "ogrmm_minio_secret_2026")
SPARK_MASTER = os.getenv("SPARK_MASTER", "local[*]")
DELTA_TABLE_PATH = os.getenv("DELTA_TABLE_PATH", "s3a://og-rmm-lakehouse/pcdm")
RTDIP_ENABLED = os.getenv("RTDIP_ENABLED", "false").lower() == "true"

# ─── Pydantic models ───────────────────────────────────────────────────────────

class TWARequest(BaseModel):
    tag: str
    startTime: str
    endTime: str
    unit: Optional[str] = "psi"


class ResampleRequest(BaseModel):
    tag: str
    startTime: str
    endTime: str
    interval: str = "1h"
    method: str = "mean"


class LatestRequest(BaseModel):
    tags: list[str] = Field(..., min_length=1, max_length=100)


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: float


# ─── Simulation helpers ────────────────────────────────────────────────────────

def _seed(tag: str) -> int:
    return sum(ord(c) for c in tag)


def _sim_twa(tag: str, start: str, end: str) -> float:
    """Deterministic TWA simulation based on tag name."""
    s = _seed(tag)
    return round((s % 500 + 100) + math.sin(s) * 20, 2)


def _sim_resample(tag: str, start: str, end: str, n: int = 24) -> list[dict[str, Any]]:
    """Simulate a resampled time series."""
    t0 = datetime.fromisoformat(start.replace("Z", "+00:00")).timestamp()
    t1 = datetime.fromisoformat(end.replace("Z", "+00:00")).timestamp()
    step = (t1 - t0) / n
    base = (_seed(tag) % 500) + 100
    result = []
    for i in range(n):
        ts = datetime.fromtimestamp(t0 + i * step, tz=timezone.utc).isoformat()
        val = round(base + math.sin(i * 0.4) * 20 + random.uniform(-2, 2), 2)
        result.append({"timestamp": ts, "value": val})
    return result


# ─── RTDIP Core integration (optional) ────────────────────────────────────────

spark = None

def _init_spark() -> None:
    """Attempt to initialise a PySpark session with Delta Lake support."""
    global spark
    try:
        from pyspark.sql import SparkSession
        spark = (
            SparkSession.builder
            .appName("og-rmm-rtdip")
            .master(SPARK_MASTER)
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", f"http://{MINIO_ENDPOINT}")
            .config("spark.hadoop.fs.s3a.access.key", MINIO_ACCESS_KEY)
            .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .getOrCreate()
        )
        log.info("PySpark session initialised: %s", SPARK_MASTER)
    except Exception as exc:
        log.warning("PySpark unavailable (simulation mode): %s", exc)
        spark = None


def _rtdip_twa(tag: str, start: str, end: str) -> float:
    """Query TWA from Delta Lake using RTDIP Core."""
    if spark is None:
        return _sim_twa(tag, start, end)
    try:
        from rtdip_sdk.queries.time_series import TimeWeightedAverage
        result = TimeWeightedAverage(
            spark=spark,
            df=spark.read.format("delta").load(DELTA_TABLE_PATH),
            tag_name=tag,
            start_date=start,
            end_date=end,
        ).get()
        return float(result.first()["Value"])
    except Exception as exc:
        log.warning("RTDIP TWA query failed, using simulation: %s", exc)
        return _sim_twa(tag, start, end)


# ─── FastAPI application ───────────────────────────────────────────────────────

app = FastAPI(
    title="OG-RMM RTDIP Query API",
    description="Time-series analytics for oil & gas well telemetry via Delta Lakehouse",
    version="12.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ingestion stats (updated by OPC-UA simulator)
_stats = {
    "ingestion_rate": 0.0,
    "tag_count": 0,
    "messages_ingested": 0,
    "last_ingestion": None,
    "delta_table_path": DELTA_TABLE_PATH,
    "spark_mode": "local" if RTDIP_ENABLED else "simulated",
}


@app.on_event("startup")
async def startup() -> None:
    if RTDIP_ENABLED:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _init_spark)
    asyncio.create_task(_opcua_simulator())
    log.info("RTDIP API started (mode=%s)", _stats["spark_mode"])


# ─── OPC-UA simulator ─────────────────────────────────────────────────────────

WELL_TAGS = [
    ("W-001", "WELLHEAD_PRESSURE", "psi", 1800, 200),
    ("W-001", "TUBING_TEMP", "°F", 180, 15),
    ("W-001", "GAS_RATE", "mscf/d", 1200, 100),
    ("W-002", "WELLHEAD_PRESSURE", "psi", 2100, 300),
    ("W-002", "OIL_RATE", "bbl/d", 450, 50),
    ("W-003", "CHOKE_POSITION", "%", 65, 10),
    ("W-003", "BOTTOM_HOLE_PRESSURE", "psi", 3200, 400),
]

_tag_store: dict[str, dict[str, Any]] = {}


async def _opcua_simulator() -> None:
    """Simulate OPC-UA sensor readings at 1-second intervals."""
    global _stats
    _stats["tag_count"] = len(WELL_TAGS)
    t0 = time.time()
    count = 0
    while True:
        await asyncio.sleep(1)
        for well, tag, unit, base, noise in WELL_TAGS:
            full_tag = f"{well}.{tag}"
            value = round(base + math.sin(time.time() * 0.1) * noise + random.uniform(-noise * 0.1, noise * 0.1), 2)
            _tag_store[full_tag] = {
                "tag": full_tag,
                "value": value,
                "unit": unit,
                "quality": 192,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            count += 1

        elapsed = time.time() - t0
        _stats["ingestion_rate"] = round(count / elapsed, 1) if elapsed > 0 else 0
        _stats["messages_ingested"] = count
        _stats["last_ingestion"] = datetime.now(timezone.utc).isoformat()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": "12.0.0",
        "spark": "connected" if spark is not None else "simulated",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics")
async def metrics() -> dict[str, Any]:
    return _stats


@app.post("/rtdip/twa")
async def query_twa(req: TWARequest) -> dict[str, Any]:
    twa = _rtdip_twa(req.tag, req.startTime, req.endTime) if RTDIP_ENABLED else _sim_twa(req.tag, req.startTime, req.endTime)
    return {
        "tag": req.tag,
        "twa": twa,
        "unit": req.unit,
        "startTime": req.startTime,
        "endTime": req.endTime,
        "source": "rtdip" if spark else "simulated",
    }


@app.post("/rtdip/resample")
async def query_resample(req: ResampleRequest) -> dict[str, Any]:
    data = _sim_resample(req.tag, req.startTime, req.endTime, 24)
    return {
        "tag": req.tag,
        "interval": req.interval,
        "method": req.method,
        "data": data,
        "source": "simulated",
    }


@app.post("/rtdip/latest")
async def get_latest(req: LatestRequest) -> dict[str, Any]:
    values = []
    for tag in req.tags:
        if tag in _tag_store:
            values.append(_tag_store[tag])
        else:
            values.append({
                "tag": tag,
                "value": _sim_twa(tag, "", ""),
                "unit": "psi",
                "quality": 192,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    return {"values": values, "source": "simulated" if not RTDIP_ENABLED else "rtdip"}


@app.get("/rtdip/tags")
async def get_tags(
    wellId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
) -> dict[str, Any]:
    tag_defs = [
        {"tag": k, "description": k.split(".")[-1].replace("_", " ").lower(), "unit": v["unit"], "dataType": "float64"}
        for k, v in _tag_store.items()
    ]
    if wellId:
        tag_defs = [t for t in tag_defs if t["tag"].startswith(wellId)]
    if search:
        tag_defs = [t for t in tag_defs if search.lower() in t["tag"].lower()]
    return {"tags": tag_defs[:limit], "total": len(tag_defs), "source": "simulated"}


# ─── OPC-UA Write-back ────────────────────────────────────────────────────────

# Pending write-back commands (tag -> {value, unit, requestedAt, status})
_writeback_store: dict[str, dict[str, Any]] = {}


class WritebackRequest(BaseModel):
    tag: str = Field(..., description="OPC-UA node tag (e.g. W-001.CHOKE_POSITION)")
    value: float = Field(..., description="Setpoint value to write")
    unit: Optional[str] = Field(None, description="Engineering unit (informational)")
    source: Optional[str] = Field("dr_event", description="Originating system")
    eventId: Optional[str] = Field(None, description="DR event ID that triggered this write")


class WritebackResponse(BaseModel):
    tag: str
    value: float
    unit: Optional[str]
    status: str  # "accepted" | "applied" | "rejected"
    message: str
    requestedAt: str
    source: str


@app.post("/writeback/{tag:path}", response_model=WritebackResponse)
async def opcua_writeback(tag: str, req: WritebackRequest) -> WritebackResponse:
    """
    Write a setpoint value to an OPC-UA node.

    In production this would call asyncua / opcua-asyncio to write the node value.
    In simulation mode the write is accepted and the in-memory tag store is updated
    so the next /rtdip/latest call reflects the new setpoint.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Validate tag exists or is a known pattern
    known_tags = set(_tag_store.keys())
    if tag not in known_tags and not any(tag.startswith(w) for w, *_ in WELL_TAGS):
        return WritebackResponse(
            tag=tag,
            value=req.value,
            unit=req.unit,
            status="rejected",
            message=f"Unknown tag '{tag}' — not found in OPC-UA address space",
            requestedAt=now,
            source=req.source or "unknown",
        )

    if RTDIP_ENABLED:
        # Production path: write via asyncua
        try:
            import asyncua  # type: ignore
            # Resolve node ID from tag name (simplified mapping)
            node_id = f"ns=2;s={tag}"
            async with asyncua.Client(url=os.getenv("OPCUA_SERVER_URL", "opc.tcp://localhost:4840")) as client:
                node = client.get_node(node_id)
                await node.write_value(req.value)
            status, message = "applied", f"OPC-UA write successful: {tag} = {req.value}"
        except Exception as exc:
            log.error("OPC-UA write failed for %s: %s", tag, exc)
            status, message = "rejected", f"OPC-UA write failed: {exc}"
    else:
        # Simulation path: update in-memory tag store
        if tag in _tag_store:
            _tag_store[tag]["value"] = req.value
            _tag_store[tag]["timestamp"] = now
            _tag_store[tag]["quality"] = 192  # Good
        else:
            # Create a new simulated tag entry
            _tag_store[tag] = {
                "tag": tag,
                "value": req.value,
                "unit": req.unit or "unknown",
                "quality": 192,
                "timestamp": now,
            }
        status, message = "applied", f"[SIM] Setpoint written: {tag} = {req.value} {req.unit or ''}"

    # Record write-back in store for audit trail
    _writeback_store[tag] = {
        "value": req.value,
        "unit": req.unit,
        "requestedAt": now,
        "status": status,
        "eventId": req.eventId,
        "source": req.source or "unknown",
    }

    log.info("[WRITEBACK] %s %s = %s (%s) event=%s", status.upper(), tag, req.value, req.unit, req.eventId)
    return WritebackResponse(
        tag=tag,
        value=req.value,
        unit=req.unit,
        status=status,
        message=message,
        requestedAt=now,
        source=req.source or "unknown",
    )


@app.get("/writeback/audit")
async def writeback_audit(
    limit: int = Query(50, ge=1, le=500),
) -> dict[str, Any]:
    """Return the recent write-back audit log."""
    entries = [
        {"tag": tag, **data}
        for tag, data in list(_writeback_store.items())[-limit:]
    ]
    return {"entries": entries, "total": len(_writeback_store)}


# ─── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("rtdip_api:app", host="0.0.0.0", port=port, reload=False, log_level="info")
