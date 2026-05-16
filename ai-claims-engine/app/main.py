from fastapi import FastAPI
from app.routers import claims, damage_assessment, fraud_screening, document_extraction

app = FastAPI(
    title="AI Claims Engine",
    description="Intelligent claims automation with document AI, damage assessment, and fraud detection",
    version="1.0.0",
)

app.include_router(claims.router, prefix="/api/v1/claims-ai", tags=["claims"])
app.include_router(damage_assessment.router, prefix="/api/v1/claims-ai/damage", tags=["damage"])
app.include_router(fraud_screening.router, prefix="/api/v1/claims-ai/fraud", tags=["fraud"])
app.include_router(document_extraction.router, prefix="/api/v1/claims-ai/documents", tags=["documents"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-claims-engine"}
