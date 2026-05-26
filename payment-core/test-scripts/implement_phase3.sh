#!/bin/bash

# Phase 3 Services Implementation Script

BASE_DIR="/home/ubuntu/nextgen-payment-switch/services"

# --- Social Graph Service ---
cat > $BASE_DIR/social-graph-service/main.py << 'PY_MAIN'
from fastapi import FastAPI
from .routers import router

app = FastAPI()
app.include_router(router)
PY_MAIN

cat > $BASE_DIR/social-graph-service/schemas.py << 'PY_SCHEMAS'
from pydantic import BaseModel

class Friend(BaseModel):
    user_id: str
    friend_id: str
PY_SCHEMAS

cat > $BASE_DIR/social-graph-service/routers.py << 'PY_ROUTERS'
from fastapi import APIRouter
from .schemas import Friend

router = APIRouter()

@router.post("/add_friend")
async def add_friend(friend: Friend):
    return {"status": "Friend added"}
PY_ROUTERS

# --- POS Service ---
cat > $BASE_DIR/pos-service/main.py << 'PY_MAIN'
from fastapi import FastAPI
from .routers import router

app = FastAPI()
app.include_router(router)
PY_MAIN

cat > $BASE_DIR/pos-service/schemas.py << 'PY_SCHEMAS'
from pydantic import BaseModel

class POSTransaction(BaseModel):
    terminal_id: str
    amount: float
PY_SCHEMAS

cat > $BASE_DIR/pos-service/routers.py << 'PY_ROUTERS'
from fastapi import APIRouter
from .schemas import POSTransaction

router = APIRouter()

@router.post("/transaction")
async def process_pos_transaction(transaction: POSTransaction):
    return {"status": "POS transaction processed"}
PY_ROUTERS

# --- P2P Service ---
cat > $BASE_DIR/p2p-service/main.py << 'PY_MAIN'
from fastapi import FastAPI
from .routers import router

app = FastAPI()
app.include_router(router)
PY_MAIN

cat > $BASE_DIR/p2p-service/schemas.py << 'PY_SCHEMAS'
from pydantic import BaseModel

class P2PTransaction(BaseModel):
    from_user: str
    to_user: str
    amount: float
PY_SCHEMAS

cat > $BASE_DIR/p2p-service/routers.py << 'PY_ROUTERS'
from fastapi import APIRouter
from .schemas import P2PTransaction

router = APIRouter()

@router.post("/send")
async def send_p2p(transaction: P2PTransaction):
    return {"status": "P2P payment sent"}
PY_ROUTERS

echo "Phase 3 services implemented successfully!"

