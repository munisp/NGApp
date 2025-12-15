"""
Python API Gateway Service
Provides lakehouse, analytics, and ingestion endpoints for the Document Intelligence Platform
"""

import os
import logging
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import random

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/document_intelligence")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SPARK_MASTER_URL = os.getenv("SPARK_MASTER_URL", "spark://localhost:7077")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")

# Metrics
REQUEST_COUNT = Counter("python_api_requests_total", "Total API requests", ["endpoint", "status"])
REQUEST_LATENCY = Histogram("python_api_request_latency_seconds", "API request latency")


# ============================================================================
# Pydantic Models
# ============================================================================

class TableInfo(BaseModel):
    name: str
    database: str
    format: str
    row_count: int
    size_bytes: int
    last_modified: str
    partitions: Optional[List[str]] = None


class TableSchema(BaseModel):
    table_name: str
    columns: List[Dict[str, Any]]
    primary_key: Optional[List[str]] = None
    partition_columns: Optional[List[str]] = None


class QueryRequest(BaseModel):
    filters: Optional[Dict[str, Any]] = None
    columns: Optional[List[str]] = None
    limit: int = 100
    offset: int = 0
    orderBy: Optional[str] = None


class QueryResult(BaseModel):
    table_name: str
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_count: int
    execution_time_ms: float


class TableStats(BaseModel):
    table_name: str
    row_count: int
    size_bytes: int
    column_stats: Dict[str, Dict[str, Any]]
    last_updated: str


class ProcessingTrend(BaseModel):
    timestamp: str
    documents_processed: int
    success_rate: float
    avg_processing_time_ms: float
    error_count: int


class CategoryStat(BaseModel):
    category: str
    document_count: int
    success_rate: float
    avg_confidence: float


class ErrorPattern(BaseModel):
    error_type: str
    count: int
    percentage: float
    sample_messages: List[str]
    affected_categories: List[str]


class ConnectorInfo(BaseModel):
    id: str
    name: str
    type: str
    status: str
    last_sync: Optional[str] = None
    config: Dict[str, Any]


class IngestionJob(BaseModel):
    id: str
    name: str
    connector_type: str
    status: str
    created_at: str
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    config: Dict[str, Any]
    stats: Optional[Dict[str, Any]] = None


class CreateJobRequest(BaseModel):
    name: str
    connectorType: str
    config: Dict[str, Any]
    schedule: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    dependencies: Dict[str, str]


# ============================================================================
# In-Memory Data Store (for demo - replace with real DB/Spark in production)
# ============================================================================

# Simulated lakehouse tables
LAKEHOUSE_TABLES = {
    "documents": {
        "name": "documents",
        "database": "document_intelligence",
        "format": "delta",
        "row_count": 15420,
        "size_bytes": 52428800,
        "last_modified": datetime.utcnow().isoformat(),
        "partitions": ["category", "status"],
        "schema": [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "user_id", "type": "integer", "nullable": False},
            {"name": "category", "type": "string", "nullable": False},
            {"name": "filename", "type": "string", "nullable": False},
            {"name": "file_url", "type": "string", "nullable": False},
            {"name": "status", "type": "string", "nullable": False},
            {"name": "created_at", "type": "timestamp", "nullable": False},
            {"name": "updated_at", "type": "timestamp", "nullable": False},
        ]
    },
    "ocr_results": {
        "name": "ocr_results",
        "database": "document_intelligence",
        "format": "delta",
        "row_count": 14850,
        "size_bytes": 104857600,
        "last_modified": datetime.utcnow().isoformat(),
        "partitions": ["engine"],
        "schema": [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "document_id", "type": "integer", "nullable": False},
            {"name": "engine", "type": "string", "nullable": False},
            {"name": "raw_text", "type": "string", "nullable": True},
            {"name": "extracted_data", "type": "json", "nullable": True},
            {"name": "confidence", "type": "float", "nullable": True},
            {"name": "processing_time_ms", "type": "integer", "nullable": True},
            {"name": "created_at", "type": "timestamp", "nullable": False},
        ]
    },
    "batches": {
        "name": "batches",
        "database": "document_intelligence",
        "format": "delta",
        "row_count": 1250,
        "size_bytes": 5242880,
        "last_modified": datetime.utcnow().isoformat(),
        "partitions": ["status"],
        "schema": [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "user_id", "type": "integer", "nullable": False},
            {"name": "name", "type": "string", "nullable": False},
            {"name": "total_files", "type": "integer", "nullable": False},
            {"name": "completed_files", "type": "integer", "nullable": False},
            {"name": "failed_files", "type": "integer", "nullable": False},
            {"name": "status", "type": "string", "nullable": False},
            {"name": "created_at", "type": "timestamp", "nullable": False},
        ]
    },
    "audit_log": {
        "name": "audit_log",
        "database": "document_intelligence",
        "format": "delta",
        "row_count": 125000,
        "size_bytes": 209715200,
        "last_modified": datetime.utcnow().isoformat(),
        "partitions": ["event_type", "date"],
        "schema": [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "user_id", "type": "integer", "nullable": True},
            {"name": "event_type", "type": "string", "nullable": False},
            {"name": "resource_type", "type": "string", "nullable": False},
            {"name": "resource_id", "type": "string", "nullable": True},
            {"name": "action", "type": "string", "nullable": False},
            {"name": "metadata", "type": "json", "nullable": True},
            {"name": "ip_address", "type": "string", "nullable": True},
            {"name": "timestamp", "type": "timestamp", "nullable": False},
        ]
    },
    "verification_results": {
        "name": "verification_results",
        "database": "document_intelligence",
        "format": "delta",
        "row_count": 8500,
        "size_bytes": 26214400,
        "last_modified": datetime.utcnow().isoformat(),
        "partitions": ["verification_type"],
        "schema": [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "document_id", "type": "integer", "nullable": False},
            {"name": "verification_type", "type": "string", "nullable": False},
            {"name": "provider", "type": "string", "nullable": False},
            {"name": "verified", "type": "boolean", "nullable": False},
            {"name": "match_score", "type": "float", "nullable": True},
            {"name": "details", "type": "json", "nullable": True},
            {"name": "created_at", "type": "timestamp", "nullable": False},
        ]
    }
}

# Simulated connectors
CONNECTORS = [
    {"id": "s3-main", "name": "S3 Document Storage", "type": "s3", "status": "active", "config": {"bucket": "documents", "region": "us-east-1"}},
    {"id": "postgres-main", "name": "PostgreSQL Database", "type": "postgresql", "status": "active", "config": {"host": "localhost", "database": "document_intelligence"}},
    {"id": "sftp-partner", "name": "Partner SFTP", "type": "sftp", "status": "inactive", "config": {"host": "sftp.partner.com", "path": "/uploads"}},
    {"id": "api-nimc", "name": "NIMC API", "type": "rest_api", "status": "active", "config": {"url": "https://api.nimc.gov.ng/v1"}},
    {"id": "api-cac", "name": "CAC API", "type": "rest_api", "status": "active", "config": {"url": "https://api.cac.gov.ng/v1"}},
]

# Simulated ingestion jobs
INGESTION_JOBS = [
    {
        "id": "job-001",
        "name": "Daily Document Sync",
        "connector_type": "s3",
        "status": "active",
        "created_at": (datetime.utcnow() - timedelta(days=30)).isoformat(),
        "last_run": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "next_run": (datetime.utcnow() + timedelta(hours=22)).isoformat(),
        "config": {"source": "s3-main", "schedule": "0 0 * * *"},
        "stats": {"total_processed": 15420, "success_rate": 0.98, "avg_time_ms": 250}
    },
    {
        "id": "job-002",
        "name": "Hourly Verification Check",
        "connector_type": "rest_api",
        "status": "active",
        "created_at": (datetime.utcnow() - timedelta(days=15)).isoformat(),
        "last_run": (datetime.utcnow() - timedelta(minutes=45)).isoformat(),
        "next_run": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
        "config": {"sources": ["api-nimc", "api-cac"], "schedule": "0 * * * *"},
        "stats": {"total_processed": 8500, "success_rate": 0.95, "avg_time_ms": 1200}
    },
]


# ============================================================================
# Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Python API Gateway Service")
    yield
    logger.info("Python API Gateway Service shutdown complete")


app = FastAPI(
    title="Document Intelligence API Gateway",
    description="Lakehouse, Analytics, and Ingestion API for Document Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="python-api-gateway",
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat(),
        dependencies={
            "database": "connected",
            "redis": "connected",
            "spark": "connected",
            "minio": "connected"
        }
    )


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ============================================================================
# Lakehouse Endpoints
# ============================================================================

@app.get("/api/lakehouse/tables", response_model=List[TableInfo])
async def list_tables():
    """List all available tables in the lakehouse"""
    REQUEST_COUNT.labels(endpoint="lakehouse_list_tables", status="200").inc()
    
    tables = []
    for name, info in LAKEHOUSE_TABLES.items():
        tables.append(TableInfo(
            name=info["name"],
            database=info["database"],
            format=info["format"],
            row_count=info["row_count"],
            size_bytes=info["size_bytes"],
            last_modified=info["last_modified"],
            partitions=info.get("partitions")
        ))
    return tables


@app.get("/api/lakehouse/tables/{table_name}/schema", response_model=TableSchema)
async def get_table_schema(table_name: str):
    """Get schema for a specific table"""
    if table_name not in LAKEHOUSE_TABLES:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
    
    REQUEST_COUNT.labels(endpoint="lakehouse_get_schema", status="200").inc()
    
    table = LAKEHOUSE_TABLES[table_name]
    return TableSchema(
        table_name=table_name,
        columns=table["schema"],
        primary_key=["id"],
        partition_columns=table.get("partitions")
    )


@app.post("/api/lakehouse/tables/{table_name}/query", response_model=QueryResult)
async def query_table(table_name: str, request: QueryRequest):
    """Query data from a table"""
    if table_name not in LAKEHOUSE_TABLES:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
    
    start_time = time.time()
    REQUEST_COUNT.labels(endpoint="lakehouse_query", status="200").inc()
    
    table = LAKEHOUSE_TABLES[table_name]
    columns = request.columns or [col["name"] for col in table["schema"]]
    
    # Generate sample data based on table schema
    rows = []
    sample_size = min(request.limit, 100)
    
    for i in range(sample_size):
        row = {}
        for col in table["schema"]:
            if col["name"] in columns:
                if col["type"] == "integer":
                    row[col["name"]] = request.offset + i + 1
                elif col["type"] == "string":
                    row[col["name"]] = f"sample_{col['name']}_{i}"
                elif col["type"] == "float":
                    row[col["name"]] = round(random.uniform(0.5, 1.0), 4)
                elif col["type"] == "boolean":
                    row[col["name"]] = random.choice([True, False])
                elif col["type"] == "timestamp":
                    row[col["name"]] = (datetime.utcnow() - timedelta(days=random.randint(0, 30))).isoformat()
                elif col["type"] == "json":
                    row[col["name"]] = {"sample": "data"}
        rows.append(row)
    
    execution_time = (time.time() - start_time) * 1000
    
    return QueryResult(
        table_name=table_name,
        columns=columns,
        rows=rows,
        total_count=table["row_count"],
        execution_time_ms=round(execution_time, 2)
    )


@app.get("/api/lakehouse/tables/{table_name}/stats", response_model=TableStats)
async def get_table_stats(table_name: str):
    """Get statistics for a table"""
    if table_name not in LAKEHOUSE_TABLES:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
    
    REQUEST_COUNT.labels(endpoint="lakehouse_stats", status="200").inc()
    
    table = LAKEHOUSE_TABLES[table_name]
    
    # Generate column statistics
    column_stats = {}
    for col in table["schema"]:
        if col["type"] == "integer":
            column_stats[col["name"]] = {"min": 1, "max": table["row_count"], "null_count": 0}
        elif col["type"] == "float":
            column_stats[col["name"]] = {"min": 0.0, "max": 1.0, "avg": 0.85, "null_count": 0}
        elif col["type"] == "string":
            column_stats[col["name"]] = {"distinct_count": min(1000, table["row_count"]), "null_count": 0}
        elif col["type"] == "timestamp":
            column_stats[col["name"]] = {"min": (datetime.utcnow() - timedelta(days=365)).isoformat(), "max": datetime.utcnow().isoformat()}
    
    return TableStats(
        table_name=table_name,
        row_count=table["row_count"],
        size_bytes=table["size_bytes"],
        column_stats=column_stats,
        last_updated=table["last_modified"]
    )


# ============================================================================
# Analytics Endpoints
# ============================================================================

@app.get("/api/analytics/processing-trends", response_model=List[ProcessingTrend])
async def get_processing_trends(
    period: str = Query(default="30d", regex="^(7d|30d|90d)$"),
    granularity: str = Query(default="day", regex="^(hour|day|week)$")
):
    """Get document processing trends over time"""
    REQUEST_COUNT.labels(endpoint="analytics_trends", status="200").inc()
    
    # Parse period
    days = {"7d": 7, "30d": 30, "90d": 90}[period]
    
    # Generate trend data
    trends = []
    if granularity == "hour":
        points = min(days * 24, 168)  # Max 1 week of hourly data
        delta = timedelta(hours=1)
    elif granularity == "day":
        points = days
        delta = timedelta(days=1)
    else:  # week
        points = days // 7
        delta = timedelta(weeks=1)
    
    base_time = datetime.utcnow()
    for i in range(points):
        timestamp = base_time - (delta * (points - i - 1))
        trends.append(ProcessingTrend(
            timestamp=timestamp.isoformat(),
            documents_processed=random.randint(100, 500),
            success_rate=round(random.uniform(0.92, 0.99), 4),
            avg_processing_time_ms=round(random.uniform(200, 800), 2),
            error_count=random.randint(0, 20)
        ))
    
    return trends


@app.get("/api/analytics/categories", response_model=List[CategoryStat])
async def get_category_stats():
    """Get statistics by document category"""
    REQUEST_COUNT.labels(endpoint="analytics_categories", status="200").inc()
    
    categories = [
        "citizenship_identity",
        "immigration_status",
        "income_employment",
        "tribal_aian",
        "employer_health_coverage",
        "household_relationship",
        "other_supporting"
    ]
    
    stats = []
    for category in categories:
        stats.append(CategoryStat(
            category=category,
            document_count=random.randint(500, 5000),
            success_rate=round(random.uniform(0.90, 0.99), 4),
            avg_confidence=round(random.uniform(0.80, 0.95), 4)
        ))
    
    return stats


@app.get("/api/analytics/errors", response_model=List[ErrorPattern])
async def get_error_patterns(
    period: str = Query(default="7d", regex="^(7d|30d|90d)$")
):
    """Get error patterns and statistics"""
    REQUEST_COUNT.labels(endpoint="analytics_errors", status="200").inc()
    
    error_types = [
        {
            "type": "OCR_TIMEOUT",
            "messages": ["OCR processing timed out after 30s", "Engine response timeout"],
            "categories": ["citizenship_identity", "income_employment"]
        },
        {
            "type": "INVALID_FORMAT",
            "messages": ["Unsupported file format", "Corrupted image data"],
            "categories": ["other_supporting"]
        },
        {
            "type": "LOW_CONFIDENCE",
            "messages": ["Confidence below threshold (0.5)", "Unable to extract required fields"],
            "categories": ["immigration_status", "tribal_aian"]
        },
        {
            "type": "VERIFICATION_FAILED",
            "messages": ["NIN verification failed", "CAC lookup returned no results"],
            "categories": ["citizenship_identity"]
        },
        {
            "type": "STORAGE_ERROR",
            "messages": ["S3 upload failed", "File size exceeds limit"],
            "categories": ["employer_health_coverage"]
        }
    ]
    
    total_errors = random.randint(100, 500)
    patterns = []
    
    for error in error_types:
        count = random.randint(10, 100)
        patterns.append(ErrorPattern(
            error_type=error["type"],
            count=count,
            percentage=round((count / total_errors) * 100, 2),
            sample_messages=error["messages"],
            affected_categories=error["categories"]
        ))
    
    return patterns


# ============================================================================
# Ingestion Endpoints
# ============================================================================

@app.get("/api/ingestion/connectors", response_model=List[ConnectorInfo])
async def list_connectors():
    """List all available data connectors"""
    REQUEST_COUNT.labels(endpoint="ingestion_connectors", status="200").inc()
    
    return [
        ConnectorInfo(
            id=c["id"],
            name=c["name"],
            type=c["type"],
            status=c["status"],
            last_sync=(datetime.utcnow() - timedelta(hours=random.randint(1, 24))).isoformat() if c["status"] == "active" else None,
            config=c["config"]
        )
        for c in CONNECTORS
    ]


@app.get("/api/ingestion/jobs", response_model=List[IngestionJob])
async def list_jobs():
    """List all ingestion jobs"""
    REQUEST_COUNT.labels(endpoint="ingestion_jobs", status="200").inc()
    
    return [
        IngestionJob(
            id=j["id"],
            name=j["name"],
            connector_type=j["connector_type"],
            status=j["status"],
            created_at=j["created_at"],
            last_run=j["last_run"],
            next_run=j["next_run"],
            config=j["config"],
            stats=j["stats"]
        )
        for j in INGESTION_JOBS
    ]


@app.post("/api/ingestion/jobs", response_model=IngestionJob)
async def create_job(request: CreateJobRequest):
    """Create a new ingestion job"""
    REQUEST_COUNT.labels(endpoint="ingestion_create_job", status="201").inc()
    
    job_id = f"job-{hashlib.md5(str(time.time()).encode()).hexdigest()[:6]}"
    
    new_job = {
        "id": job_id,
        "name": request.name,
        "connector_type": request.connectorType,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "last_run": None,
        "next_run": (datetime.utcnow() + timedelta(hours=1)).isoformat() if request.schedule else None,
        "config": request.config,
        "stats": None
    }
    
    INGESTION_JOBS.append(new_job)
    
    return IngestionJob(**new_job)


@app.get("/api/ingestion/jobs/{job_id}/logs")
async def get_job_logs(job_id: str):
    """Get logs for a specific ingestion job"""
    REQUEST_COUNT.labels(endpoint="ingestion_job_logs", status="200").inc()
    
    # Find job
    job = next((j for j in INGESTION_JOBS if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    
    # Generate sample logs
    logs = []
    base_time = datetime.utcnow() - timedelta(hours=2)
    
    log_messages = [
        ("INFO", "Job started"),
        ("INFO", "Connecting to data source..."),
        ("INFO", "Connection established"),
        ("INFO", "Fetching records..."),
        ("INFO", "Processing batch 1/10"),
        ("INFO", "Processing batch 2/10"),
        ("WARN", "Slow response from source, retrying..."),
        ("INFO", "Processing batch 3/10"),
        ("INFO", "Processing batch 4/10"),
        ("INFO", "Processing batch 5/10"),
        ("INFO", "Processing batch 6/10"),
        ("INFO", "Processing batch 7/10"),
        ("INFO", "Processing batch 8/10"),
        ("INFO", "Processing batch 9/10"),
        ("INFO", "Processing batch 10/10"),
        ("INFO", "Committing changes..."),
        ("INFO", "Job completed successfully"),
    ]
    
    for i, (level, message) in enumerate(log_messages):
        logs.append({
            "timestamp": (base_time + timedelta(minutes=i * 2)).isoformat(),
            "level": level,
            "message": message,
            "job_id": job_id
        })
    
    return {
        "job_id": job_id,
        "job_name": job["name"],
        "logs": logs,
        "total_entries": len(logs)
    }


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
