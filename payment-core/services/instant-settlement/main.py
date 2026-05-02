"""Main application for $service_name service."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .routers import router
import os
# Initialize event integration for lakehouse
try:
    from . import events_integration
except ImportError:
    import events_integration



app = FastAPI(
    title="$service_name Service",
    description="$service_name microservice for Next-Generation Payment Switch",
    version="1.0.0"
)

@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes probes"""
    return {"status": "healthy", "service": "instant-settlement"}

@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint for Kubernetes probes"""
    return {"status": "ready", "service": "instant-settlement"}


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1/$service_name", tags=["$service_name"])

@app.get("/")
async def root():
    """Root endpoint."""
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


    return {
        "service": "$service_name",
        "version": "1.0.0",
        "status": "running"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
