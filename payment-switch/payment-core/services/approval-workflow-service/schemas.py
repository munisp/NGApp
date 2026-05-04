from pydantic import BaseModel

class ApprovalRequest(BaseModel):
    request_id: str
    amount: float
