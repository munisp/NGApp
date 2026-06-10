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


from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .routers import router
# Initialize event integration for lakehouse
try:
    from . import events_integration
except ImportError:
    import events_integration



app = FastAPI()

@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes probes"""
    return {"status": "healthy", "service": "qr-code-service"}

@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint for Kubernetes probes"""
    return {"status": "ready", "service": "qr-code-service"}

app.include_router(router)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )

