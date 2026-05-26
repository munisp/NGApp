from fastapi import APIRouter
from .schemas import P2PTransaction

router = APIRouter()

@router.post("/send")
async def send_p2p(transaction: P2PTransaction):
    return {"status": "P2P payment sent"}
