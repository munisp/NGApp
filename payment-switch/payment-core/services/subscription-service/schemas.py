from pydantic import BaseModel

class Subscription(BaseModel):
    user_id: str
    plan_id: str
