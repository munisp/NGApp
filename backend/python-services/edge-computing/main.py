
from fastapi import FastAPI

app = FastAPI(
    title="Agent Banking Edge Service",
    description="Edge computing service for the Agent Banking Platform",
    version="1.0.0",
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Agent Banking Edge Service"}


