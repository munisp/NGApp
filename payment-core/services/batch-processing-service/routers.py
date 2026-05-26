from fastapi import APIRouter
from .schemas import Batch

router = APIRouter()

@router.post("/process")
async def process_batch(batch: Batch):
    return {"status": "Batch processing started"}
