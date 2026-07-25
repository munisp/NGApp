"""MLOps Governance Service - model registry, drift monitoring, explainability.

Integrates with: Postgres (model registry), Redis (metrics cache),
Fluvio (real-time data streaming), Lakehouse (feature store/training data).
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.store.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="MLOps Governance Service",
    description="Model registry, drift monitoring, explainability, and governance",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8098"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
