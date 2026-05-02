from fastapi import APIRouter
from .schemas import POSTransaction

router = APIRouter()

@router.post("/transaction")
async def process_pos_transaction(transaction: POSTransaction):
    return {"status": "POS transaction processed"}
