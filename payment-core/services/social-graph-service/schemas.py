from pydantic import BaseModel

class Friend(BaseModel):
    user_id: str
    friend_id: str
