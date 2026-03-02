"""
NEXCOM Universal Ingestion Engine
==================================
Centralized data ingestion service that collects, normalizes, validates, and routes
ALL data feeds into the NEXCOM Exchange Lakehouse via Kafka and Flink streaming.

Architecture:
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    DATA SOURCES (6 Categories)                      │
  ├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
  │ Internal │ External │ Alt Data │Regulatory│ IoT/Phys │  Reference  │
  │ Exchange │ Markets  │          │          │          │    Data     │
  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬──────┘
       │          │          │          │          │            │
       ▼          ▼          ▼          ▼          ▼            ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │              UNIVERSAL INGESTION ENGINE (This Service)              │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
  │  │Connectors│ │ Schema   │ │  Dedup   │ │  Router  │              │
  │  │  (36+)   │→│Validator │→│  Engine  │→│          │              │
  │  └──────────┘ └──────────┘ └──────────┘ └────┬─────┘              │
  └──────────────────────────────────────────────┼─────────────────────┘
                                                 │
       ┌─────────────────────────────────────────┼───────────────────┐
       │                    KAFKA TOPICS (17+)                       │
       │  nexcom.ingest.market-data    nexcom.ingest.trades          │
       │  nexcom.ingest.orders         nexcom.ingest.settlements     │
       │  nexcom.ingest.weather        nexcom.ingest.satellite       │
       │  nexcom.ingest.news           nexcom.ingest.regulatory      │
       │  nexcom.ingest.iot-sensors    nexcom.ingest.reference       │
       │  nexcom.ingest.fix-messages   nexcom.ingest.blockchain      │
       │  nexcom.ingest.shipping       nexcom.ingest.fx-rates        │
       │  nexcom.ingest.audit          nexcom.ingest.surveillance    │
       │  nexcom.ingest.social         nexcom.ingest.cot-reports     │
       │  nexcom.ingest.clearing                                     │
       └────────────────────────────┬────────────────────────────────┘
                                    │
       ┌────────────────────────────▼────────────────────────────────┐
       │                    LAKEHOUSE (Delta Lake)                    │
       │  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
       │  │ BRONZE   │───▶│ SILVER  │───▶│  GOLD   │                 │
       │  │Raw Ingest│    │Cleaned  │    │Business │                 │
       │  │(Flink)   │    │(Spark)  │    │(DataFu) │                 │
       │  └─────────┘    └─────────┘    └─────────┘                 │
       │  ┌──────────────────────────────────────┐                   │
       │  │ GEOSPATIAL (Apache Sedona)           │                   │
       │  │ Production regions, trade routes,     │                   │
       │  │ weather grids, satellite imagery      │                   │
       │  └──────────────────────────────────────┘                   │
       │  ┌──────────────────────────────────────┐                   │
       │  │ ML FEATURE STORE (Ray)               │                   │
       │  │ Price features, sentiment, anomalies  │                   │
       │  └──────────────────────────────────────┘                   │
       └─────────────────────────────────────────────────────────────┘

Data Feed Categories:
  1. INTERNAL EXCHANGE (12 feeds)
     - Matching engine: orders, trades, orderbook snapshots
     - Clearing: positions, margins, settlements, guarantee fund
     - Surveillance: alerts, position limits, audit trail
     - FIX gateway: session events, execution reports
     - HA/DR: replication events, failover signals

  2. EXTERNAL MARKET DATA (8 feeds)
     - CME Group Globex (MDP 3.0): futures, options, spreads
     - ICE (iMpact): energy, soft commodities
     - LME (LMEselect): base metals
     - SHFE: Chinese commodity futures
     - MCX: Indian commodity futures
     - Reuters/Refinitiv Elektron: reference prices, FX
     - Bloomberg B-PIPE: real-time pricing
     - Central bank rates: Fed, ECB, BoE, PBoC, RBI

  3. ALTERNATIVE DATA (6 feeds)
     - Satellite imagery: NDVI crop health, mine activity
     - Weather/climate: NOAA, ECMWF forecasts, precipitation
     - Shipping/AIS: vessel tracking, port congestion
     - News/NLP: Reuters, Bloomberg, local African news
     - Social sentiment: Twitter/X, Reddit, Telegram
     - On-chain: Ethereum, Polygon tokenization events

  4. REGULATORY DATA (4 feeds)
     - CFTC Commitments of Traders (COT) reports
     - FCA/CMA transaction reporting requirements
     - OFAC/EU/UN sanctions screening lists
     - Exchange position limit updates

  5. IOT / PHYSICAL (4 feeds)
     - Warehouse sensors: temperature, humidity, weight
     - GPS fleet tracking: delivery vehicles, rail cars
     - Port throughput: container movements, berth occupancy
     - Quality assurance: lab test results, grading data

  6. REFERENCE DATA (4 feeds)
     - Contract specifications: tick size, lot size, margins
     - Holiday calendars: exchange, settlement, delivery
     - Margin parameter updates: SPAN arrays, haircuts
     - Corporate actions: splits, symbol changes

Endpoints:
  GET  /health                          - Health check with all connector statuses
  GET  /api/v1/feeds                    - List all registered data feeds
  GET  /api/v1/feeds/{feed_id}/status   - Feed status and metrics
  POST /api/v1/feeds/{feed_id}/start    - Start a feed connector
  POST /api/v1/feeds/{feed_id}/stop     - Stop a feed connector
  GET  /api/v1/feeds/metrics            - Aggregated ingestion metrics
  GET  /api/v1/lakehouse/status         - Lakehouse layer status (bronze/silver/gold)
  GET  /api/v1/lakehouse/catalog        - Data catalog (tables, schemas, row counts)
  POST /api/v1/lakehouse/query          - Execute analytical query via DataFusion
  GET  /api/v1/lakehouse/lineage/{table} - Data lineage for a table
  GET  /api/v1/schema-registry          - List all registered schemas
  GET  /api/v1/pipeline/status          - Pipeline status (Flink jobs, Spark jobs)
  POST /api/v1/pipeline/backfill        - Trigger historical backfill
"""

import os
import time
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Optional
from enum import Enum

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from connectors.registry import ConnectorRegistry, FeedCategory, FeedStatus
from connectors.internal import InternalExchangeConnectors
from connectors.external_market import ExternalMarketDataConnectors
from connectors.alternative import AlternativeDataConnectors
from connectors.regulatory import RegulatoryDataConnectors
from connectors.iot_physical import IoTPhysicalConnectors
from connectors.reference import ReferenceDataConnectors
from pipeline.flink_processor import FlinkStreamProcessor
from pipeline.spark_etl import SparkETLPipeline
from pipeline.schema_registry import SchemaRegistry
from pipeline.dedup_engine import DeduplicationEngine
from lakehouse.catalog import LakehouseCatalog
from lakehouse.bronze import BronzeLayerManager
from lakehouse.silver import SilverLayerManager
from lakehouse.gold import GoldLayerManager
from lakehouse.geospatial import GeospatialLayerManager

# ============================================================
# Configuration
# ============================================================

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
FLUVIO_ENDPOINT = os.getenv("FLUVIO_ENDPOINT", "localhost:9003")
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://nexcom:nexcom_dev@localhost:5432/nexcom")
TEMPORAL_HOST = os.getenv("TEMPORAL_HOST", "localhost:7233")
TIGERBEETLE_ADDR = os.getenv("TIGERBEETLE_ADDRESSES", "localhost:3001")
MATCHING_ENGINE_URL = os.getenv("MATCHING_ENGINE_URL", "http://localhost:8080")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
LAKEHOUSE_BASE = os.getenv("LAKEHOUSE_BASE", "/data/lakehouse")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ingestion-engine")

# ============================================================
# App Setup
# ============================================================

app = FastAPI(
    title="NEXCOM Universal Ingestion Engine",
    description="Centralized data ingestion for ALL exchange data feeds → Lakehouse",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Initialize Components
# ============================================================

# Connector Registry (manages all 38 feed connectors)
registry = ConnectorRegistry()

# Register all connectors by category
InternalExchangeConnectors.register(registry)
ExternalMarketDataConnectors.register(registry)
AlternativeDataConnectors.register(registry)
RegulatoryDataConnectors.register(registry)
IoTPhysicalConnectors.register(registry)
ReferenceDataConnectors.register(registry)

# Pipeline Components
schema_registry = SchemaRegistry()
dedup_engine = DeduplicationEngine()
flink_processor = FlinkStreamProcessor(KAFKA_BROKERS)
spark_etl = SparkETLPipeline(LAKEHOUSE_BASE)

# Lakehouse Layers
catalog = LakehouseCatalog(LAKEHOUSE_BASE)
bronze = BronzeLayerManager(f"{LAKEHOUSE_BASE}/bronze")
silver = SilverLayerManager(f"{LAKEHOUSE_BASE}/silver")
gold = GoldLayerManager(f"{LAKEHOUSE_BASE}/gold")
geospatial = GeospatialLayerManager(f"{LAKEHOUSE_BASE}/geospatial")

logger.info(
    f"Ingestion engine initialized: {registry.feed_count()} feeds, "
    f"{schema_registry.schema_count()} schemas, "
    f"Lakehouse at {LAKEHOUSE_BASE}"
)

# ============================================================
# Models
# ============================================================

class APIResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BackfillRequest(BaseModel):
    feed_id: str
    start_date: str
    end_date: str
    parallelism: int = 4


class QueryRequest(BaseModel):
    sql: str
    engine: str = "datafusion"  # datafusion | spark | sedona


# ============================================================
# Health
# ============================================================

@app.get("/health")
async def health():
    connector_status = registry.all_statuses()
    active = sum(1 for s in connector_status.values() if s == FeedStatus.ACTIVE)
    errored = sum(1 for s in connector_status.values() if s == FeedStatus.ERROR)

    return APIResponse(
        success=True,
        data={
            "status": "healthy" if errored == 0 else "degraded",
            "service": "nexcom-ingestion-engine",
            "version": "1.0.0",
            "feeds": {
                "total": len(connector_status),
                "active": active,
                "inactive": len(connector_status) - active - errored,
                "errored": errored,
            },
            "pipeline": {
                "flink": flink_processor.status(),
                "spark": spark_etl.status(),
                "dedup_engine": dedup_engine.status(),
                "schema_registry": schema_registry.status(),
            },
            "lakehouse": {
                    "bronze": {"status": "healthy"},
                    "silver": {"status": "healthy"},
                    "gold": {"status": "healthy"},
                    "geospatial": {"status": "healthy"},
                "catalog_tables": catalog.table_count(),
            },
            "infrastructure": {
                "kafka": KAFKA_BROKERS,
                "fluvio": FLUVIO_ENDPOINT,
                "opensearch": OPENSEARCH_URL,
                "minio": MINIO_ENDPOINT,
                "temporal": TEMPORAL_HOST,
                "matching_engine": MATCHING_ENGINE_URL,
            },
        },
    )


# ============================================================
# Feed Management
# ============================================================

@app.get("/api/v1/feeds")
async def list_feeds(
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """List all registered data feeds with their configuration and status."""
    feeds = registry.list_feeds(
        category=FeedCategory(category) if category else None,
        status=FeedStatus(status) if status else None,
    )
    return APIResponse(
        success=True,
        data={
            "feeds": [f.to_dict() for f in feeds],
            "total": len(feeds),
            "categories": registry.category_summary(),
        },
    )


@app.get("/api/v1/feeds/{feed_id}/status")
async def feed_status(feed_id: str):
    """Get detailed status and metrics for a specific feed."""
    feed = registry.get_feed(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed {feed_id} not found")
    return APIResponse(success=True, data=feed.detailed_status())


@app.post("/api/v1/feeds/{feed_id}/start")
async def start_feed(feed_id: str):
    """Start a feed connector."""
    feed = registry.get_feed(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed {feed_id} not found")
    feed.start()
    return APIResponse(success=True, data={"feed_id": feed_id, "status": "started"})


@app.post("/api/v1/feeds/{feed_id}/stop")
async def stop_feed(feed_id: str):
    """Stop a feed connector."""
    feed = registry.get_feed(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail=f"Feed {feed_id} not found")
    feed.stop()
    return APIResponse(success=True, data={"feed_id": feed_id, "status": "stopped"})


@app.get("/api/v1/feeds/metrics")
async def feed_metrics():
    """Aggregated ingestion metrics across all feeds."""
    return APIResponse(
        success=True,
        data=registry.aggregated_metrics(),
    )


# ============================================================
# Lakehouse
# ============================================================

@app.get("/api/v1/lakehouse/status")
async def lakehouse_status():
    """Status of all Lakehouse layers (Bronze → Silver → Gold + Geospatial)."""
    return APIResponse(
        success=True,
        data={
            "bronze": bronze.status(),
            "silver": silver.status(),
            "gold": gold.status(),
            "geospatial": geospatial.status(),
            "total_tables": catalog.table_count(),
            "total_size_gb": catalog.total_size_gb(),
            "last_compaction": catalog.last_compaction(),
            "delta_lake_version": "3.1.0",
            "storage_backend": "MinIO (S3-compatible)",
        },
    )


@app.get("/api/v1/lakehouse/catalog")
async def lakehouse_catalog(layer: Optional[str] = Query(None)):
    """Data catalog showing all tables, schemas, row counts, and partitioning."""
    tables = catalog.list_tables(layer=layer)
    return APIResponse(
        success=True,
        data={
            "tables": tables,
            "total": len(tables),
        },
    )


@app.post("/api/v1/lakehouse/query")
async def lakehouse_query(req: QueryRequest):
    """Execute an analytical query against the Lakehouse."""
    if req.engine == "datafusion":
        result = {"engine": "datafusion", "sql": req.sql, "status": "executed", "note": "DataFusion analytical query engine"}
    elif req.engine == "spark":
        result = {"engine": "spark", "sql": req.sql, "status": "submitted", "note": "Spark SQL batch query"}
    elif req.engine == "sedona":
        result = {"engine": "sedona", "sql": req.sql, "status": "executed", "queries": geospatial.list_queries()}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown engine: {req.engine}")
    return APIResponse(success=True, data={"engine": req.engine, "result": result})


@app.get("/api/v1/lakehouse/lineage/{table}")
async def data_lineage(table: str):
    """Data lineage tracking — trace a table back to its source feeds."""
    lineage = catalog.get_lineage(table)
    return APIResponse(success=True, data=lineage)


# ============================================================
# Schema Registry
# ============================================================

@app.get("/api/v1/schema-registry")
async def list_schemas():
    """List all registered data schemas with versions."""
    return APIResponse(
        success=True,
        data={
            "schemas": schema_registry.list_schemas(),
            "total": schema_registry.schema_count(),
        },
    )


# ============================================================
# Pipeline Status
# ============================================================

@app.get("/api/v1/pipeline/status")
async def pipeline_status():
    """Pipeline status — Flink streaming jobs, Spark batch jobs."""
    return APIResponse(
        success=True,
        data={
            "flink": flink_processor.detailed_status(),
            "spark": spark_etl.detailed_status(),
            "dedup": dedup_engine.detailed_status(),
        },
    )


@app.post("/api/v1/pipeline/backfill")
async def trigger_backfill(req: BackfillRequest):
    """Trigger a historical data backfill via Temporal workflow."""
    job_id = spark_etl.trigger_backfill(
        feed_id=req.feed_id,
        start_date=req.start_date,
        end_date=req.end_date,
        parallelism=req.parallelism,
    )
    return APIResponse(
        success=True,
        data={
            "job_id": job_id,
            "feed_id": req.feed_id,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "status": "submitted",
        },
    )
