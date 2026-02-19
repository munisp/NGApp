import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from . import models
from .config import get_db, logger
from .models import (
    AgentStatus, KYCStatus, Agent, KYCRecord, PerformanceMetric, Territory, TerritoryAssignment,
    AgentCreate, AgentUpdate, AgentResponse, KYCRecordCreate, KYCRecordInDB,
    PerformanceMetricCreate, PerformanceMetricInDB, TerritoryCreate, TerritoryInDB,
    TerritoryAssignmentCreate, TerritoryAssignmentInDB
)

# Initialize the router
router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)

# --- Helper Functions (Business Logic) ---

def get_agent_by_id(db: Session, agent_id: int) -> Agent:
    """Fetches an agent by ID or raises a 404 exception."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        logger.warning(f"Agent with ID {agent_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found.")
    return agent

def get_territory_by_id(db: Session, territory_id: int) -> Territory:
    """Fetches a territory by ID or raises a 404 exception."""
    territory = db.query(Territory).filter(Territory.id == territory_id).first()
    if not territory:
        logger.warning(f"Territory with ID {territory_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Territory with ID {territory_id} not found.")
    return territory

# --- Agent CRUD Endpoints ---

@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    """Creates a new agent."""
    try:
        db_agent = Agent(**agent.model_dump())
        db.add(db_agent)
        db.commit()
        db.refresh(db_agent)
        logger.info(f"Agent created: {db_agent.email}")
        return db_agent
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during agent creation: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered or invalid manager_id.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during agent creation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error.")

@router.get("/", response_model=List[AgentResponse])
def read_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieves a list of all agents."""
    agents = db.query(Agent).offset(skip).limit(limit).all()
    return agents

@router.get("/{agent_id}", response_model=AgentResponse)
def read_agent(agent_id: int, db: Session = Depends(get_db)):
    """Retrieves a single agent by ID, including relationships."""
    # Use joinedload to fetch relationships in one query for efficiency
    agent = db.query(Agent).options(
        joinedload(Agent.manager),
        joinedload(Agent.subordinates),
        joinedload(Agent.kyc_records),
        joinedload(Agent.performance_metrics),
        joinedload(Agent.territory_assignments).joinedload(TerritoryAssignment.territory)
    ).filter(Agent.id == agent_id).first()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent

@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: int, agent: AgentUpdate, db: Session = Depends(get_db)):
    """Updates an existing agent's details."""
    db_agent = get_agent_by_id(db, agent_id)
    
    update_data = agent.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_agent, key, value)
    
    try:
        db.commit()
        db.refresh(db_agent)
        logger.info(f"Agent ID {agent_id} updated.")
        return db_agent
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during agent update: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered or invalid manager_id.")

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    """Deletes an agent and all associated records (cascaded)."""
    db_agent = get_agent_by_id(db, agent_id)
    
    # Check if the agent is a manager to any other agent
    if db_agent.subordinates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete agent who is still managing subordinates. Reassign subordinates first."
        )
        
    db.delete(db_agent)
    db.commit()
    logger.info(f"Agent ID {agent_id} deleted.")
    return {"ok": True}

# --- Agent Hierarchy Endpoints ---

@router.get("/{agent_id}/subordinates", response_model=List[AgentResponse])
def get_subordinates(agent_id: int, db: Session = Depends(get_db)):
    """Retrieves all direct subordinates of an agent."""
    db_agent = get_agent_by_id(db, agent_id)
    return db_agent.subordinates

@router.get("/{agent_id}/manager", response_model=Optional[AgentResponse])
def get_manager(agent_id: int, db: Session = Depends(get_db)):
    """Retrieves the direct manager of an agent."""
    db_agent = get_agent_by_id(db, agent_id)
    return db_agent.manager

# --- KYC Endpoints ---

@router.post("/{agent_id}/kyc", response_model=KYCRecordInDB, status_code=status.HTTP_201_CREATED)
def submit_kyc_record(agent_id: int, kyc_record: KYCRecordCreate, db: Session = Depends(get_db)):
    """Submits a new KYC record for an agent."""
    db_agent = get_agent_by_id(db, agent_id)
    
    # Simple business logic: If a record is submitted, assume it's pending verification
    is_verified = False
    
    db_kyc = KYCRecord(
        **kyc_record.model_dump(),
        agent_id=agent_id,
        is_verified=is_verified
    )
    
    try:
        db.add(db_kyc)
        db.commit()
        db.refresh(db_kyc)
        
        # Update agent's overall KYC status to PENDING if it was not already
        if db_agent.kyc_status != KYCStatus.PENDING:
            db_agent.kyc_status = KYCStatus.PENDING
            db.commit()
            db.refresh(db_agent)
            
        logger.info(f"KYC record submitted for Agent ID {agent_id}.")
        return db_kyc
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during KYC submission: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A KYC record of this document type already exists for this agent.")

@router.put("/{agent_id}/kyc/{kyc_id}/status", response_model=KYCRecordInDB)
def update_kyc_status(agent_id: int, kyc_id: int, new_status: KYCStatus, db: Session = Depends(get_db)):
    """Updates the verification status of a specific KYC record and the agent's overall status."""
    db_agent = get_agent_by_id(db, agent_id)
    
    db_kyc = db.query(KYCRecord).filter(KYCRecord.id == kyc_id, KYCRecord.agent_id == agent_id).first()
    if not db_kyc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="KYC record not found for this agent.")

    # Update the specific KYC record
    db_kyc.is_verified = (new_status == KYCStatus.VERIFIED)
    
    # Update agent's overall KYC status based on the new status
    db_agent.kyc_status = new_status
    
    db.commit()
    db.refresh(db_kyc)
    db.refresh(db_agent)
    
    logger.info(f"KYC record ID {kyc_id} for Agent ID {agent_id} updated to {new_status.value}.")
    return db_kyc

# --- Performance Tracking Endpoints ---

@router.post("/{agent_id}/performance", response_model=PerformanceMetricInDB, status_code=status.HTTP_201_CREATED)
def add_performance_metric(agent_id: int, metric: PerformanceMetricCreate, db: Session = Depends(get_db)):
    """Adds a new performance metric for an agent."""
    get_agent_by_id(db, agent_id) # Check if agent exists
    
    db_metric = PerformanceMetric(
        **metric.model_dump(),
        agent_id=agent_id
    )
    
    try:
        db.add(db_metric)
        db.commit()
        db.refresh(db_metric)
        logger.info(f"Performance metric added for Agent ID {agent_id}.")
        return db_metric
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during performance metric creation: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A metric for this agent on this date already exists.")

@router.get("/{agent_id}/performance", response_model=List[PerformanceMetricInDB])
def get_agent_performance(agent_id: int, db: Session = Depends(get_db)):
    """Retrieves all performance metrics for a specific agent."""
    get_agent_by_id(db, agent_id) # Check if agent exists
    
    metrics = db.query(PerformanceMetric).filter(PerformanceMetric.agent_id == agent_id).order_by(PerformanceMetric.metric_date.desc()).all()
    return metrics

@router.get("/{agent_id}/performance/summary")
def get_team_performance_summary(agent_id: int, db: Session = Depends(get_db)):
    """Calculates and retrieves a summary of performance for an agent and their direct subordinates."""
    db_agent = get_agent_by_id(db, agent_id)
    
    # Get IDs of the agent and all direct subordinates
    agent_ids = [db_agent.id] + [sub.id for sub in db_agent.subordinates]
    
    # Query to calculate average performance metrics for the group
    from sqlalchemy import func
    
    summary = db.query(
        func.avg(PerformanceMetric.sales_volume).label("avg_sales_volume"),
        func.avg(PerformanceMetric.customer_satisfaction_score).label("avg_csat_score"),
        func.sum(PerformanceMetric.leads_converted).label("total_leads_converted")
    ).filter(PerformanceMetric.agent_id.in_(agent_ids)).first()
    
    if not summary or summary.avg_sales_volume is None:
        return {
            "agent_id": agent_id,
            "team_size": len(agent_ids),
            "message": "No performance data available for this agent or their team."
        }

    return {
        "agent_id": agent_id,
        "team_size": len(agent_ids),
        "avg_sales_volume": round(summary.avg_sales_volume, 2),
        "avg_csat_score": round(summary.avg_csat_score, 2),
        "total_leads_converted": int(summary.total_leads_converted)
    }

# --- Territory CRUD and Assignment Endpoints ---

@router.post("/territories", response_model=TerritoryInDB, status_code=status.HTTP_201_CREATED)
def create_territory(territory: TerritoryCreate, db: Session = Depends(get_db)):
    """Creates a new territory."""
    try:
        db_territory = Territory(**territory.model_dump())
        db.add(db_territory)
        db.commit()
        db.refresh(db_territory)
        logger.info(f"Territory created: {db_territory.name}")
        return db_territory
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during territory creation: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Territory name must be unique.")

@router.get("/territories", response_model=List[TerritoryInDB])
def read_territories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieves a list of all territories."""
    territories = db.query(Territory).offset(skip).limit(limit).all()
    return territories

@router.post("/{agent_id}/territory_assignment", response_model=TerritoryAssignmentInDB, status_code=status.HTTP_201_CREATED)
def assign_territory(agent_id: int, assignment: TerritoryAssignmentCreate, db: Session = Depends(get_db)):
    """Assigns an agent to a territory."""
    get_agent_by_id(db, agent_id) # Check if agent exists
    get_territory_by_id(db, assignment.territory_id) # Check if territory exists
    
    db_assignment = TerritoryAssignment(
        **assignment.model_dump(),
        agent_id=agent_id
    )
    
    try:
        db.add(db_assignment)
        db.commit()
        db.refresh(db_assignment)
        logger.info(f"Agent ID {agent_id} assigned to Territory ID {assignment.territory_id}.")
        return db_assignment
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during territory assignment: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is already assigned to this territory.")

@router.put("/{agent_id}/territory_assignment/{assignment_id}", response_model=TerritoryAssignmentInDB)
def update_territory_assignment(agent_id: int, assignment_id: int, assignment: TerritoryAssignmentCreate, db: Session = Depends(get_db)):
    """Updates an existing territory assignment for an agent."""
    get_agent_by_id(db, agent_id) # Check if agent exists
    
    db_assignment = db.query(TerritoryAssignment).filter(
        TerritoryAssignment.id == assignment_id,
        TerritoryAssignment.agent_id == agent_id
    ).first()
    
    if not db_assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Territory assignment not found for this agent.")

    # Check if the new territory_id is valid
    if assignment.territory_id != db_assignment.territory_id:
        get_territory_by_id(db, assignment.territory_id)

    update_data = assignment.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_assignment, key, value)
    
    try:
        db.commit()
        db.refresh(db_assignment)
        logger.info(f"Territory assignment ID {assignment_id} for Agent ID {agent_id} updated.")
        return db_assignment
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during territory assignment update: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is already assigned to this territory with the new parameters.")
