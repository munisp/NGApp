from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

app = FastAPI(
    title="Float Management Service",
    description="Manages agent float balances, rebalancing, and liquidity",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FloatBalance(BaseModel):
    agent_id: str
    currency: str = "NGN"
    available_balance: Decimal
    reserved_balance: Decimal
    total_balance: Decimal
    min_balance_threshold: Decimal
    max_balance_threshold: Decimal
    last_updated: datetime

class FloatTransaction(BaseModel):
    transaction_id: str
    agent_id: str
    transaction_type: str  # CREDIT, DEBIT, RESERVE, RELEASE
    amount: Decimal
    currency: str = "NGN"
    balance_before: Decimal
    balance_after: Decimal
    timestamp: datetime
    reference: Optional[str] = None

class FloatRebalanceRequest(BaseModel):
    agent_id: str
    amount: Decimal
    rebalance_type: str  # TOP_UP, WITHDRAW
    reason: Optional[str] = None

class FloatAlert(BaseModel):
    alert_id: str
    agent_id: str
    alert_type: str  # LOW_BALANCE, HIGH_BALANCE, NEGATIVE_BALANCE
    current_balance: Decimal
    threshold: Decimal
    severity: str  # INFO, WARNING, CRITICAL
    timestamp: datetime

# In-memory storage
float_balances = {}
float_transactions = []
float_alerts = []

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "float-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/float/initialize")
async def initialize_float(
    agent_id: str,
    initial_balance: Decimal,
    min_threshold: Decimal = Decimal("10000"),
    max_threshold: Decimal = Decimal("1000000")
):
    """
    Initialize float account for an agent
    """
    if agent_id in float_balances:
        raise HTTPException(status_code=400, detail="Float account already exists")
    
    float_balance = FloatBalance(
        agent_id=agent_id,
        currency="NGN",
        available_balance=initial_balance,
        reserved_balance=Decimal("0"),
        total_balance=initial_balance,
        min_balance_threshold=min_threshold,
        max_balance_threshold=max_threshold,
        last_updated=datetime.utcnow()
    )
    
    float_balances[agent_id] = float_balance.dict()
    
    # Record transaction
    transaction = FloatTransaction(
        transaction_id=str(uuid.uuid4()),
        agent_id=agent_id,
        transaction_type="CREDIT",
        amount=initial_balance,
        currency="NGN",
        balance_before=Decimal("0"),
        balance_after=initial_balance,
        timestamp=datetime.utcnow(),
        reference="Initial float"
    )
    float_transactions.append(transaction.dict())
    
    return float_balance

@app.get("/float/{agent_id}")
async def get_float_balance(agent_id: str):
    """
    Get current float balance for an agent
    """
    if agent_id not in float_balances:
        raise HTTPException(status_code=404, detail="Float account not found")
    
    return float_balances[agent_id]

@app.post("/float/{agent_id}/reserve")
async def reserve_float(
    agent_id: str,
    amount: Decimal,
    reference: Optional[str] = None
):
    """
    Reserve float for a pending transaction
    """
    if agent_id not in float_balances:
        raise HTTPException(status_code=404, detail="Float account not found")
    
    balance = float_balances[agent_id]
    
    if balance["available_balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient float balance")
    
    # Update balances
    balance_before = balance["available_balance"]
    balance["available_balance"] -= amount
    balance["reserved_balance"] += amount
    balance["last_updated"] = datetime.utcnow().isoformat()
    
    float_balances[agent_id] = balance
    
    # Record transaction
    transaction = FloatTransaction(
        transaction_id=str(uuid.uuid4()),
        agent_id=agent_id,
        transaction_type="RESERVE",
        amount=amount,
        currency="NGN",
        balance_before=balance_before,
        balance_after=balance["available_balance"],
        timestamp=datetime.utcnow(),
        reference=reference
    )
    float_transactions.append(transaction.dict())
    
    # Check for low balance alert
    check_balance_alerts(agent_id, balance)
    
    return {
        "status": "reserved",
        "available_balance": balance["available_balance"],
        "reserved_balance": balance["reserved_balance"]
    }

@app.post("/float/{agent_id}/commit")
async def commit_reserved_float(
    agent_id: str,
    amount: Decimal,
    reference: Optional[str] = None
):
    """
    Commit reserved float (deduct from reserved balance)
    """
    if agent_id not in float_balances:
        raise HTTPException(status_code=404, detail="Float account not found")
    
    balance = float_balances[agent_id]
    
    if balance["reserved_balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient reserved balance")
    
    # Update balances
    balance_before = balance["total_balance"]
    balance["reserved_balance"] -= amount
    balance["total_balance"] -= amount
    balance["last_updated"] = datetime.utcnow().isoformat()
    
    float_balances[agent_id] = balance
    
    # Record transaction
    transaction = FloatTransaction(
        transaction_id=str(uuid.uuid4()),
        agent_id=agent_id,
        transaction_type="DEBIT",
        amount=amount,
        currency="NGN",
        balance_before=balance_before,
        balance_after=balance["total_balance"],
        timestamp=datetime.utcnow(),
        reference=reference
    )
    float_transactions.append(transaction.dict())
    
    return {
        "status": "committed",
        "total_balance": balance["total_balance"]
    }

@app.post("/float/{agent_id}/release")
async def release_reserved_float(
    agent_id: str,
    amount: Decimal,
    reference: Optional[str] = None
):
    """
    Release reserved float (return to available balance)
    """
    if agent_id not in float_balances:
        raise HTTPException(status_code=404, detail="Float account not found")
    
    balance = float_balances[agent_id]
    
    if balance["reserved_balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient reserved balance")
    
    # Update balances
    balance_before = balance["available_balance"]
    balance["reserved_balance"] -= amount
    balance["available_balance"] += amount
    balance["last_updated"] = datetime.utcnow().isoformat()
    
    float_balances[agent_id] = balance
    
    # Record transaction
    transaction = FloatTransaction(
        transaction_id=str(uuid.uuid4()),
        agent_id=agent_id,
        transaction_type="RELEASE",
        amount=amount,
        currency="NGN",
        balance_before=balance_before,
        balance_after=balance["available_balance"],
        timestamp=datetime.utcnow(),
        reference=reference
    )
    float_transactions.append(transaction.dict())
    
    return {
        "status": "released",
        "available_balance": balance["available_balance"]
    }

@app.post("/float/{agent_id}/rebalance")
async def rebalance_float(
    agent_id: str,
    request: FloatRebalanceRequest
):
    """
    Rebalance agent float (top-up or withdraw)
    """
    if agent_id not in float_balances:
        raise HTTPException(status_code=404, detail="Float account not found")
    
    balance = float_balances[agent_id]
    balance_before = balance["total_balance"]
    
    if request.rebalance_type == "TOP_UP":
        balance["available_balance"] += request.amount
        balance["total_balance"] += request.amount
        transaction_type = "CREDIT"
    elif request.rebalance_type == "WITHDRAW":
        if balance["available_balance"] < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient available balance")
        balance["available_balance"] -= request.amount
        balance["total_balance"] -= request.amount
        transaction_type = "DEBIT"
    else:
        raise HTTPException(status_code=400, detail="Invalid rebalance type")
    
    balance["last_updated"] = datetime.utcnow().isoformat()
    float_balances[agent_id] = balance
    
    # Record transaction
    transaction = FloatTransaction(
        transaction_id=str(uuid.uuid4()),
        agent_id=agent_id,
        transaction_type=transaction_type,
        amount=request.amount,
        currency="NGN",
        balance_before=balance_before,
        balance_after=balance["total_balance"],
        timestamp=datetime.utcnow(),
        reference=f"Rebalance: {request.reason or request.rebalance_type}"
    )
    float_transactions.append(transaction.dict())
    
    return {
        "status": "rebalanced",
        "total_balance": balance["total_balance"],
        "available_balance": balance["available_balance"]
    }

@app.get("/float/{agent_id}/transactions")
async def get_float_transactions(
    agent_id: str,
    limit: int = 100
):
    """
    Get float transaction history for an agent
    """
    agent_transactions = [
        t for t in float_transactions
        if t["agent_id"] == agent_id
    ]
    
    return agent_transactions[-limit:]

@app.get("/float/{agent_id}/alerts")
async def get_float_alerts(agent_id: str):
    """
    Get float balance alerts for an agent
    """
    agent_alerts = [
        a for a in float_alerts
        if a["agent_id"] == agent_id
    ]
    
    return agent_alerts

def check_balance_alerts(agent_id: str, balance: Dict):
    """
    Check and create alerts for balance thresholds
    """
    available = Decimal(str(balance["available_balance"]))
    min_threshold = Decimal(str(balance["min_balance_threshold"]))
    max_threshold = Decimal(str(balance["max_balance_threshold"]))
    
    if available < min_threshold:
        alert = FloatAlert(
            alert_id=str(uuid.uuid4()),
            agent_id=agent_id,
            alert_type="LOW_BALANCE",
            current_balance=available,
            threshold=min_threshold,
            severity="WARNING" if available > min_threshold * Decimal("0.5") else "CRITICAL",
            timestamp=datetime.utcnow()
        )
        float_alerts.append(alert.dict())
    
    if available > max_threshold:
        alert = FloatAlert(
            alert_id=str(uuid.uuid4()),
            agent_id=agent_id,
            alert_type="HIGH_BALANCE",
            current_balance=available,
            threshold=max_threshold,
            severity="INFO",
            timestamp=datetime.utcnow()
        )
        float_alerts.append(alert.dict())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
