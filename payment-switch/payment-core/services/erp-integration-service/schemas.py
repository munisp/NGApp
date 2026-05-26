from pydantic import BaseModel

class ERPConnection(BaseModel):
    erp_system: str
    api_key: str
