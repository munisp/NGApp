from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes
from app.database import engine, Base
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Liveness Detection Service",
    description="KYC/KYB Liveness Detection with Anti-Spoofing and Face Matching",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api/v1/liveness", tags=["liveness"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "liveness-detection"}

@app.on_event("startup")
async def startup_event():
    logger.info("Liveness Detection Service started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Liveness Detection Service shutdown")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
