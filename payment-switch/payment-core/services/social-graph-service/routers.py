from fastapi import APIRouter
from .schemas import Friend

router = APIRouter()

@router.post("/add_friend")
async def add_friend(friend: Friend):
    return {"status": "Friend added"}
