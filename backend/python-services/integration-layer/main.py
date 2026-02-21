from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List
import logging

from . import models
from .models import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Remittance Platform Integration Service")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# OAuth2PasswordBearer for authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Placeholder for authentication logic
def get_current_user(token: str = Depends(oauth2_scheme)):
    # In a real application, you would decode the token, validate it, and fetch the user.
    # For this example, we'll just check if the token is present.
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info(f"User authenticated with token: {token[:10]}...")
    return {"username": "testuser", "id": 1} # Mock user

@app.get("/health", tags=["Health Check"])
async def health_check():
    logger.info("Health check requested.")
    return {"status": "healthy"}

@app.get("/metrics", tags=["Metrics"])
async def get_metrics(current_user: dict = Depends(get_current_user)):
    logger.info(f"Metrics requested by user: {current_user['username']}")
    # In a real application, you would gather actual metrics here
    return {"total_agents": 100, "total_transactions": 1000, "active_agents": 80}

# Agent Endpoints
@app.post("/agents/", response_model=models.Agent, tags=["Agents"])
async def create_agent(agent: models.AgentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Create agent requested by user: {current_user['username']}")
    db_agent = models.Agent(**agent.dict())
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent

@app.get("/agents/", response_model=List[models.Agent], tags=["Agents"])
async def read_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Read agents requested by user: {current_user['username']}")
    agents = db.query(models.Agent).offset(skip).limit(limit).all()
    return agents

@app.get("/agents/{agent_id}", response_model=models.Agent, tags=["Agents"])
async def read_agent(agent_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Read agent {agent_id} requested by user: {current_user['username']}")
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if agent is None:
        logger.warning(f"Agent {agent_id} not found.")
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@app.put("/agents/{agent_id}", response_model=models.Agent, tags=["Agents"])
async def update_agent(agent_id: int, agent: models.AgentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Update agent {agent_id} requested by user: {current_user['username']}")
    db_agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if db_agent is None:
        logger.warning(f"Agent {agent_id} not found for update.")
        raise HTTPException(status_code=404, detail="Agent not found")
    for key, value in agent.dict().items():
        setattr(db_agent, key, value)
    db.commit()
    db.refresh(db_agent)
    return db_agent

@app.delete("/agents/{agent_id}", tags=["Agents"])
async def delete_agent(agent_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Delete agent {agent_id} requested by user: {current_user['username']}")
    db_agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if db_agent is None:
        logger.warning(f"Agent {agent_id} not found for deletion.")
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(db_agent)
    db.commit()
    return {"message": "Agent deleted successfully"}

# Transaction Endpoints
@app.post("/transactions/", response_model=models.Transaction, tags=["Transactions"])
async def create_transaction(transaction: models.TransactionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Create transaction requested by user: {current_user['username']}")
    db_transaction = models.Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions/", response_model=List[models.Transaction], tags=["Transactions"])
async def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Read transactions requested by user: {current_user['username']}")
    transactions = db.query(models.Transaction).offset(skip).limit(limit).all()
    return transactions

@app.get("/transactions/{transaction_id}", response_model=models.Transaction, tags=["Transactions"])
async def read_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Read transaction {transaction_id} requested by user: {current_user['username']}")
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if transaction is None:
        logger.warning(f"Transaction {transaction_id} not found.")
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@app.put("/transactions/{transaction_id}", response_model=models.Transaction, tags=["Transactions"])
async def update_transaction(transaction_id: int, transaction: models.TransactionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Update transaction {transaction_id} requested by user: {current_user['username']}")
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        logger.warning(f"Transaction {transaction_id} not found for update.")
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in transaction.dict().items():
        setattr(db_transaction, key, value)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.delete("/transactions/{transaction_id}", tags=["Transactions"])
async def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"Delete transaction {transaction_id} requested by user: {current_user['username']}")
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        logger.warning(f"Transaction {transaction_id} not found for deletion.")
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(db_transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}
