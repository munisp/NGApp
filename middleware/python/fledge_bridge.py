"""
fledge_bridge.py — FledgePower Protocol Ingest Bridge for OG-RMM Platform
==========================================================================

Simulates a production FledgePower (LF Energy) edge-to-cloud data bridge that:
  - Speaks IEC 60870-5-104 (IEC 104), DNP3, and Modbus TCP — the dominant
    protocols in oil & gas RTUs, protection relays, and SCADA outstations.
  - Normalises all readings into the RTDIP PCDM (Process Control Data Model)
    tag schema: {asset}.{measurement} e.g. "W-001.WELLHEAD_PRESSURE"
  - Forwards normalised readings to the RTDIP FastAPI ingest endpoint.
  - Publishes raw frames to Kafka topic "og.fledge.raw" for audit/replay.
  - Exposes a FastAPI management API on :8001 for health, stats, and
    manual trigger (used by the tRPC fledge router in Node.js).

Production deployment:
  - Replace the simulated protocol drivers with real Fledge South plugins:
      fledge-south-iec104, fledge-south-dnp3, fledge-south-modbus
  - Set FLEDGE_ENABLED=true and configure FLEDGE_HOST/PORT to the Fledge
    core REST API.
  - The bridge subscribes to Fledge's North plugin output stream via its
    REST API and forwards to RTDIP.

Environment variables:
  FLEDGE_ENABLED       - "true" to use real Fledge API (default: false → simulate)
  FLEDGE_HOST          - Fledge core host (default: localhost)
  FLEDGE_PORT          - Fledge core port (default: 8081)
  RTDIP_API_URL        - RTDIP ingest endpoint (default: http://localhost:8000)
  KAFKA_BOOTSTRAP      - Kafka broker (default: localhost:9092)
  KAFKA_ENABLED        - "true" to publish to Kafka (default: false)
  BRIDGE_POLL_INTERVAL - seconds between simulated readings (default: 5)
"""

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Configuration ────────────────────────────────────────────────────────────

FLEDGE_ENABLED = os.getenv("FLEDGE_ENABLED", "false").lower() == "true"
FLEDGE_HOST = os.getenv("FLEDGE_HOST", "localhost")
FLEDGE_PORT = int(os.getenv("FLEDGE_PORT", "8081"))
RTDIP_API_URL = os.getenv("RTDIP_API_URL", "http://localhost:8000")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
KAFKA_ENABLED = os.getenv("KAFKA_ENABLED", "false").lower() == "true"
POLL_INTERVAL = float(os.getenv("BRIDGE_POLL_INTERVAL", "5"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [fledge] %(levelname)s %(message)s")
log = logging.getLogger("fledge_bridge")

# ─── Protocol definitions ─────────────────────────────────────────────────────

# IEC 60870-5-104 data objects — typical for protection relays and RTUs
IEC104_OBJECTS = [
    {"ioa": 1001, "tag": "W-001.WELLHEAD_PRESSURE",    "type": "M_ME_NC_1", "unit": "psi",   "range": (800, 1200)},
    {"ioa": 1002, "tag": "W-001.TUBING_TEMP",          "type": "M_ME_NC_1", "unit": "degF",  "range": (120, 180)},
    {"ioa": 1003, "tag": "W-001.CHOKE_POSITION",       "type": "M_ME_NC_1", "unit": "%",     "range": (0, 100)},
    {"ioa": 1004, "tag": "W-002.WELLHEAD_PRESSURE",    "type": "M_ME_NC_1", "unit": "psi",   "range": (750, 1100)},
    {"ioa": 1005, "tag": "W-002.CASING_PRESSURE",      "type": "M_ME_NC_1", "unit": "psi",   "range": (600, 900)},
    {"ioa": 2001, "tag": "SEPARATOR.INLET_PRESSURE",   "type": "M_ME_NC_1", "unit": "psi",   "range": (200, 400)},
    {"ioa": 2002, "tag": "SEPARATOR.LIQUID_LEVEL",     "type": "M_ME_NC_1", "unit": "%",     "range": (20, 80)},
    {"ioa": 3001, "tag": "COMPRESSOR.SUCTION_PRESSURE","type": "M_ME_NC_1", "unit": "psi",   "range": (50, 150)},
    {"ioa": 3002, "tag": "COMPRESSOR.DISCHARGE_PRESSURE","type": "M_ME_NC_1","unit": "psi",  "range": (400, 600)},
]

# DNP3 analog input objects — typical for flow computers and meters
DNP3_OBJECTS = [
    {"index": 0, "tag": "W-001.OIL_RATE",             "type": "AI_32F",    "unit": "bbl/d", "range": (200, 500)},
    {"index": 1, "tag": "W-001.GAS_RATE",             "type": "AI_32F",    "unit": "mscf/d","range": (800, 1500)},
    {"index": 2, "tag": "W-001.WATER_CUT",            "type": "AI_32F",    "unit": "%",     "range": (5, 35)},
    {"index": 3, "tag": "W-002.OIL_RATE",             "type": "AI_32F",    "unit": "bbl/d", "range": (150, 400)},
    {"index": 4, "tag": "W-002.GAS_RATE",             "type": "AI_32F",    "unit": "mscf/d","range": (600, 1200)},
    {"index": 5, "tag": "METERING.TOTAL_LIQUID_RATE", "type": "AI_32F",    "unit": "bbl/d", "range": (400, 900)},
    {"index": 6, "tag": "METERING.ALLOCATED_OIL",     "type": "AI_32F",    "unit": "bbl/d", "range": (300, 700)},
]

# Modbus TCP holding registers — typical for VFDs, pumps, and compressors
MODBUS_REGISTERS = [
    {"address": 40001, "tag": "COMPRESSOR.MOTOR_CURRENT",  "unit": "A",    "range": (80, 120),   "scale": 0.1},
    {"address": 40002, "tag": "COMPRESSOR.MOTOR_SPEED",    "unit": "RPM",  "range": (2800, 3200),"scale": 1.0},
    {"address": 40003, "tag": "COMPRESSOR.VIBRATION_X",    "unit": "mm/s", "range": (0.5, 4.0),  "scale": 0.01},
    {"address": 40004, "tag": "COMPRESSOR.VIBRATION_Y",    "unit": "mm/s", "range": (0.5, 4.0),  "scale": 0.01},
    {"address": 40005, "tag": "PUMP.DISCHARGE_PRESSURE",   "unit": "psi",  "range": (100, 300),  "scale": 0.1},
    {"address": 40006, "tag": "PUMP.FLOW_RATE",            "unit": "gpm",  "range": (200, 800),  "scale": 0.1},
    {"address": 40007, "tag": "FACILITY.DEMAND_KW",        "unit": "kW",   "range": (800, 1400), "scale": 1.0},
    {"address": 40008, "tag": "FACILITY.POWER_FACTOR",     "unit": "pf",   "range": (0.85, 0.98),"scale": 0.001},
]

# ─── In-memory state ──────────────────────────────────────────────────────────

_stats: dict[str, Any] = {
    "iec104_readings": 0,
    "dnp3_readings": 0,
    "modbus_readings": 0,
    "rtdip_forwards": 0,
    "rtdip_errors": 0,
    "kafka_publishes": 0,
    "last_poll": None,
    "uptime_seconds": 0,
    "started_at": datetime.now(timezone.utc).isoformat(),
}
_start_time = time.time()
_last_readings: list[dict] = []

# ─── Simulated protocol drivers ───────────────────────────────────────────────

def _simulate_iec104() -> list[dict]:
    """Simulate IEC 60870-5-104 spontaneous data transmission (ASDU type M_ME_NC_1)."""
    now = datetime.now(timezone.utc).isoformat()
    readings = []
    for obj in IEC104_OBJECTS:
        lo, hi = obj["range"]
        value = round(random.uniform(lo, hi), 3)
        readings.append({
            "protocol": "IEC104",
            "ioa": obj["ioa"],
            "tag": obj["tag"],
            "value": value,
            "unit": obj["unit"],
            "quality": 0,  # 0 = good
            "timestamp": now,
            "asdu_type": obj["type"],
        })
    _stats["iec104_readings"] += len(readings)
    return readings


def _simulate_dnp3() -> list[dict]:
    """Simulate DNP3 unsolicited response (Class 1 data)."""
    now = datetime.now(timezone.utc).isoformat()
    readings = []
    for obj in DNP3_OBJECTS:
        lo, hi = obj["range"]
        value = round(random.uniform(lo, hi), 3)
        readings.append({
            "protocol": "DNP3",
            "index": obj["index"],
            "tag": obj["tag"],
            "value": value,
            "unit": obj["unit"],
            "quality": 0,
            "timestamp": now,
            "object_type": obj["type"],
        })
    _stats["dnp3_readings"] += len(readings)
    return readings


def _simulate_modbus() -> list[dict]:
    """Simulate Modbus TCP read holding registers (FC03)."""
    now = datetime.now(timezone.utc).isoformat()
    readings = []
    for reg in MODBUS_REGISTERS:
        lo, hi = reg["range"]
        raw = random.uniform(lo / reg["scale"], hi / reg["scale"])
        value = round(raw * reg["scale"], 4)
        readings.append({
            "protocol": "Modbus",
            "address": reg["address"],
            "tag": reg["tag"],
            "value": value,
            "unit": reg["unit"],
            "quality": 0,
            "timestamp": now,
            "function_code": "FC03",
        })
    _stats["modbus_readings"] += len(readings)
    return readings


async def _fetch_fledge_readings() -> list[dict]:
    """Fetch readings from real Fledge core REST API (production mode)."""
    url = f"http://{FLEDGE_HOST}:{FLEDGE_PORT}/fledge/asset"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        assets = resp.json()
        readings = []
        for asset in assets:
            asset_name = asset.get("assetCode", "")
            readings_url = f"http://{FLEDGE_HOST}:{FLEDGE_PORT}/fledge/asset/{asset_name}?limit=1"
            r = await client.get(readings_url)
            if r.status_code == 200:
                data = r.json()
                if data:
                    row = data[0]
                    for key, val in row.get("reading", {}).items():
                        readings.append({
                            "protocol": "Fledge",
                            "tag": f"{asset_name}.{key}".upper(),
                            "value": float(val),
                            "unit": "",
                            "quality": 0,
                            "timestamp": row.get("timestamp", datetime.now(timezone.utc).isoformat()),
                        })
        return readings

# ─── RTDIP forwarding ─────────────────────────────────────────────────────────

async def _forward_to_rtdip(readings: list[dict]) -> None:
    """Forward normalised readings to RTDIP ingest endpoint."""
    if not readings:
        return
    payload = {
        "readings": [
            {
                "tag": r["tag"],
                "value": r["value"],
                "unit": r.get("unit", ""),
                "quality": r.get("quality", 0),
                "timestamp": r["timestamp"],
                "source": f"fledge/{r['protocol']}",
            }
            for r in readings
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{RTDIP_API_URL}/ingest/batch", json=payload)
            if resp.status_code == 200:
                _stats["rtdip_forwards"] += len(readings)
            else:
                _stats["rtdip_errors"] += 1
                log.warning("RTDIP ingest returned %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        _stats["rtdip_errors"] += 1
        log.debug("RTDIP ingest unavailable (simulated mode): %s", exc)


async def _publish_to_kafka(readings: list[dict]) -> None:
    """Publish raw frames to Kafka topic og.fledge.raw (if enabled)."""
    if not KAFKA_ENABLED or not readings:
        return
    try:
        from aiokafka import AIOKafkaProducer  # type: ignore
        producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP)
        await producer.start()
        for r in readings:
            await producer.send_and_wait(
                "og.fledge.raw",
                json.dumps(r).encode(),
                key=r["tag"].encode(),
            )
        await producer.stop()
        _stats["kafka_publishes"] += len(readings)
    except Exception as exc:
        log.debug("Kafka publish skipped: %s", exc)

# ─── Poll loop ────────────────────────────────────────────────────────────────

async def _poll_loop() -> None:
    """Main polling loop — collect readings from all protocols and forward."""
    log.info("FledgePower bridge starting — mode: %s", "live" if FLEDGE_ENABLED else "simulated")
    while True:
        try:
            if FLEDGE_ENABLED:
                readings = await _fetch_fledge_readings()
            else:
                readings = (
                    _simulate_iec104()
                    + _simulate_dnp3()
                    + _simulate_modbus()
                )

            _stats["last_poll"] = datetime.now(timezone.utc).isoformat()
            _stats["uptime_seconds"] = round(time.time() - _start_time, 1)

            # Store last batch for the /readings endpoint
            global _last_readings
            _last_readings = readings[-50:]  # keep last 50

            # Forward to RTDIP and Kafka concurrently
            await asyncio.gather(
                _forward_to_rtdip(readings),
                _publish_to_kafka(readings),
            )

            log.info(
                "Poll complete — IEC104: %d, DNP3: %d, Modbus: %d readings forwarded",
                _stats["iec104_readings"],
                _stats["dnp3_readings"],
                _stats["modbus_readings"],
            )
        except Exception as exc:
            log.error("Poll error: %s", exc)

        await asyncio.sleep(POLL_INTERVAL)

# ─── FastAPI management API ───────────────────────────────────────────────────

app = FastAPI(title="FledgePower Bridge", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(_poll_loop())


@app.get("/health")
async def health() -> dict:
    return {
        "online": True,
        "mode": "live" if FLEDGE_ENABLED else "simulated",
        "fledge_host": f"{FLEDGE_HOST}:{FLEDGE_PORT}" if FLEDGE_ENABLED else "N/A",
        "rtdip_url": RTDIP_API_URL,
        "uptime_seconds": round(time.time() - _start_time, 1),
    }


@app.get("/stats")
async def stats() -> dict:
    return {
        **_stats,
        "uptime_seconds": round(time.time() - _start_time, 1),
        "mode": "live" if FLEDGE_ENABLED else "simulated",
        "protocols": ["IEC60870-5-104", "DNP3", "Modbus TCP"],
        "tag_count": len(IEC104_OBJECTS) + len(DNP3_OBJECTS) + len(MODBUS_REGISTERS),
        "rtdip_url": RTDIP_API_URL,
        "kafka_enabled": KAFKA_ENABLED,
    }


@app.get("/readings")
async def readings() -> dict:
    """Return the last batch of normalised readings."""
    return {"readings": _last_readings, "count": len(_last_readings)}


class TriggerRequest(BaseModel):
    protocol: str = "all"  # "iec104" | "dnp3" | "modbus" | "all"


@app.post("/trigger")
async def trigger(req: TriggerRequest) -> dict:
    """Manually trigger a poll cycle for a specific protocol."""
    proto = req.protocol.lower()
    if proto == "iec104":
        readings_batch = _simulate_iec104()
    elif proto == "dnp3":
        readings_batch = _simulate_dnp3()
    elif proto == "modbus":
        readings_batch = _simulate_modbus()
    else:
        readings_batch = _simulate_iec104() + _simulate_dnp3() + _simulate_modbus()

    await asyncio.gather(
        _forward_to_rtdip(readings_batch),
        _publish_to_kafka(readings_batch),
    )
    return {"triggered": proto, "readings_count": len(readings_batch)}


@app.get("/protocols")
async def protocols() -> dict:
    """Return protocol configuration and object counts."""
    return {
        "iec104": {
            "standard": "IEC 60870-5-104",
            "description": "Telecontrol equipment — protection relays, RTUs",
            "objects": len(IEC104_OBJECTS),
            "tags": [o["tag"] for o in IEC104_OBJECTS],
            "asdu_types": list({o["type"] for o in IEC104_OBJECTS}),
        },
        "dnp3": {
            "standard": "IEEE 1815 (DNP3)",
            "description": "Distributed Network Protocol — flow computers, meters",
            "objects": len(DNP3_OBJECTS),
            "tags": [o["tag"] for o in DNP3_OBJECTS],
            "object_types": list({o["type"] for o in DNP3_OBJECTS}),
        },
        "modbus": {
            "standard": "Modbus TCP (IEC 61158)",
            "description": "Holding registers — VFDs, pumps, compressors",
            "registers": len(MODBUS_REGISTERS),
            "tags": [r["tag"] for r in MODBUS_REGISTERS],
            "function_codes": ["FC03 (Read Holding Registers)"],
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
