from pydantic import BaseModel

class QRCode(BaseModel):
    data: str
