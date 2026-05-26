from fastapi import APIRouter
from .schemas import QRCode

router = APIRouter()

@router.post("/generate")
async def generate_qr_code(qr_code: QRCode):
    return {"status": "QR code generated"}
