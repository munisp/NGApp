"""
Router for omnichannel-middleware service
Auto-extracted from main.py for unified gateway registration
"""

from fastapi import APIRouter

router = APIRouter(prefix="/omnichannel-middleware", tags=["omnichannel-middleware"])

@router.post("/send")
async def send_message(message: Message):
    return {"status": "ok"}

@router.get("/health")
async def health_check():
    return {"status": "ok"}

