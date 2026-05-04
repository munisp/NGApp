from pydantic import BaseModel

class POSTransaction(BaseModel):
    terminal_id: str
    amount: float
