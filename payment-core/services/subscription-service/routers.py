from fastapi import APIRouter
from .schemas import Subscription

router = APIRouter()

@router.post("/create")
async def create_subscription(subscription: Subscription):
    return {"status": "Subscription created"}
