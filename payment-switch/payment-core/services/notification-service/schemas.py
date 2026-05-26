from pydantic import BaseModel

class Notification(BaseModel):
    recipient: str
    message: str
    channel: str
