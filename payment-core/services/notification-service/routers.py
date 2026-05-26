from fastapi import APIRouter
from .schemas import Notification

router = APIRouter()

@router.post("/send")
async def send_notification(notification: Notification):
    return {"status": "Notification sent"}
