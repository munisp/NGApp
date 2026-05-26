from pydantic import BaseModel

class Batch(BaseModel):
    batch_id: str
    file_path: str
