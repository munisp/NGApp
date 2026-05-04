from fastapi import APIRouter
from .schemas import ApprovalRequest

router = APIRouter()

@router.post("/submit")
async def submit_for_approval(request: ApprovalRequest):
    return {"status": "Submitted for approval"}
