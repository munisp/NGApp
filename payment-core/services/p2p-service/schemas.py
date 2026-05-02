from pydantic import BaseModel

class P2PTransaction(BaseModel):
    from_user: str
    to_user: str
    amount: float
