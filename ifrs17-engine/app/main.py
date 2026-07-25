"""IFRS 17 Compliance Engine - Insurance Contract Measurement & Reporting.

Implements the full IFRS 17 standard for A&G Insurance Nigeria:
- General Measurement Model (GMM) / Building Block Approach (BBA)
- Premium Allocation Approach (PAA) for short-duration contracts
- Variable Fee Approach (VFA) for direct participation features
- Contractual Service Margin (CSM) amortization
- Risk Adjustment calculation
- Loss Component tracking
- Discount curve management

Integrates with: Postgres, Kafka, Redis, Lakehouse (Delta Lake)
"""

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.store.database import init_db, close_db
from app.services.scheduler import start_scheduler

import structlog

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    await init_db()
    scheduler_task = asyncio.create_task(start_scheduler())
    logger.info("IFRS 17 Engine started", port=os.getenv("PORT", "8092"))
    yield
    scheduler_task.cancel()
    await close_db()
    logger.info("IFRS 17 Engine stopped")


app = FastAPI(
    title="IFRS 17 Compliance Engine",
    description="Insurance contract measurement and reporting per IFRS 17 standard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8092")))
