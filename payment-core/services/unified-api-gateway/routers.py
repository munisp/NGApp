"""API routers for $service_name service."""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from .schemas import HealthResponse, ErrorResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="$service_name",
        timestamp=datetime.utcnow()
    )

@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return {
        "service": "$service_name",
        "requests_total": 0,
        "errors_total": 0
    }
