from fastapi import APIRouter
from .schemas import ERPConnection

router = APIRouter()

@router.post("/connect")
async def connect_erp(connection: ERPConnection):
    return {"status": "ERP connected"}
