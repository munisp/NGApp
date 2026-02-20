"""
Router for agent-commerce-integration service
Auto-extracted from main.py for unified gateway registration
"""

from fastapi import APIRouter

router = APIRouter(prefix="/agent-commerce-integration", tags=["agent-commerce-integration"])

@router.get("/products")
async def list_products():
    return {"status": "ok"}

@router.post("/orders")
async def create_order(order: Order):
    return {"status": "ok"}

@router.get("/health")
async def health_check():
    return {"status": "ok"}

