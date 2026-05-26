from pydantic import BaseModel

class Invoice(BaseModel):
    customer_id: str
    amount: float
