from fastapi import APIRouter
from .schemas import Invoice

router = APIRouter()

@router.post("/create")
async def create_invoice(invoice: Invoice):
    return {"status": "Invoice created"}
