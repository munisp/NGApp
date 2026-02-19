import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from . import models
from .config import get_db
from .models import ArtAgent, ArtAgentActivityLog, ArtAgentCreate, ArtAgentResponse, ArtAgentUpdate, AgentStatus, ActivityAction

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/art-agents",
    tags=["Art Agents"],
    responses={404: {"description": "Not found"}},
)

# --- Utility Functions ---

def log_activity(db: Session, agent_id: int, action: ActivityAction, details: Optional[str] = None):
    """
    Creates an activity log entry for a given agent.
    """
    log_entry = models.ArtAgentActivityLog(
        agent_id=agent_id,
        action=action,
        details=details
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    logger.info(f"Agent {agent_id} activity logged: {action.value}")

# --- CRUD Endpoints ---

@router.post(
    "/", 
    response_model=ArtAgentResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Art Agent"
)
def create_agent(agent: ArtAgentCreate, db: Session = Depends(get_db)):
    """
    Creates a new Art Agent with the provided details.
    
    Raises:
        HTTPException: 400 if an agent with the same name already exists.
    """
    logger.info(f"Attempting to create new agent: {agent.name}")
    
    # Check for existing agent with the same name
    db_agent = db.query(ArtAgent).filter(ArtAgent.name == agent.name).first()
    if db_agent:
        logger.warning(f"Agent creation failed: Name '{agent.name}' already exists.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Art Agent with name '{agent.name}' already exists."
        )

    # Create the new agent
    db_agent = ArtAgent(**agent.model_dump())
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    
    # Log creation activity
    log_activity(db, db_agent.id, ActivityAction.CREATED, f"Agent created with model_version: {db_agent.model_version}")
    
    logger.info(f"Successfully created agent with ID: {db_agent.id}")
    return db_agent

@router.get(
    "/{agent_id}", 
    response_model=ArtAgentResponse,
    summary="Retrieve a specific Art Agent by ID"
)
def read_agent(agent_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the details of a single Art Agent by its unique ID.
    
    Raises:
        HTTPException: 404 if the agent is not found.
    """
    db_agent = db.query(ArtAgent).filter(ArtAgent.id == agent_id).first()
    if db_agent is None:
        logger.warning(f"Agent retrieval failed: Agent ID {agent_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Art Agent not found"
        )
    return db_agent

@router.get(
    "/", 
    response_model=List[ArtAgentResponse],
    summary="List all Art Agents"
)
def list_agents(
    status_filter: Optional[AgentStatus] = None,
    is_public_filter: Optional[bool] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Retrieves a list of Art Agents, with optional filtering by status and public visibility.
    """
    query = db.query(ArtAgent)
    
    if status_filter:
        query = query.filter(ArtAgent.status == status_filter)
    
    if is_public_filter is not None:
        query = query.filter(ArtAgent.is_public == is_public_filter)
        
    agents = query.offset(skip).limit(limit).all()
    
    logger.info(f"Listed {len(agents)} agents (skip={skip}, limit={limit}, status={status_filter}, public={is_public_filter})")
    return agents

@router.patch(
    "/{agent_id}", 
    response_model=ArtAgentResponse,
    summary="Update an existing Art Agent"
)
def update_agent(agent_id: int, agent_update: ArtAgentUpdate, db: Session = Depends(get_db)):
    """
    Updates the details of an existing Art Agent. Only provided fields will be updated.
    
    Raises:
        HTTPException: 404 if the agent is not found.
    """
    db_agent = db.query(ArtAgent).filter(ArtAgent.id == agent_id).first()
    if db_agent is None:
        logger.warning(f"Agent update failed: Agent ID {agent_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Art Agent not found"
        )

    update_data = agent_update.model_dump(exclude_unset=True)
    
    # Check for name conflict if name is being updated
    if "name" in update_data and update_data["name"] != db_agent.name:
        existing_agent = db.query(ArtAgent).filter(ArtAgent.name == update_data["name"]).first()
        if existing_agent:
            logger.warning(f"Agent update failed: Name '{update_data['name']}' already exists.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Art Agent with name '{update_data['name']}' already exists."
            )

    for key, value in update_data.items():
        setattr(db_agent, key, value)

    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    
    # Log update activity
    log_activity(db, db_agent.id, ActivityAction.UPDATED, f"Agent updated with fields: {', '.join(update_data.keys())}")
    
    logger.info(f"Successfully updated agent with ID: {db_agent.id}")
    return db_agent

@router.delete(
    "/{agent_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an Art Agent"
)
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    """
    Deletes an Art Agent by its ID.
    
    Raises:
        HTTPException: 404 if the agent is not found.
    """
    db_agent = db.query(ArtAgent).filter(ArtAgent.id == agent_id).first()
    if db_agent is None:
        logger.warning(f"Agent deletion failed: Agent ID {agent_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Art Agent not found"
        )

    db.delete(db_agent)
    db.commit()
    
    # Log deletion activity (This log is created after the agent is deleted, but the log entry
    # itself is independent and refers to the deleted agent's ID)
    # NOTE: Since the log is linked by ForeignKey with cascade="all, delete-orphan",
    # all logs will be deleted when the agent is deleted. A separate system log might be better,
    # but for this service, we'll log the action before the commit that deletes the agent.
    # However, for a true hard delete, the log will be gone.
    # A soft delete (changing status to DELETED) is a better practice.
    
    # Implementing soft delete instead of hard delete for better data integrity
    db_agent.status = AgentStatus.DELETED
    db.add(db_agent)
    db.commit()
    
    log_activity(db, agent_id, ActivityAction.DELETED, "Agent soft-deleted (status set to DELETED)")
    
    logger.info(f"Successfully soft-deleted agent with ID: {agent_id}")
    return

# --- Business-Specific Endpoints ---

@router.post(
    "/{agent_id}/generate",
    status_code=status.HTTP_200_OK,
    summary="Trigger art generation by the agent"
)
def generate_art(agent_id: int, prompt: str, db: Session = Depends(get_db)):
    """
    Triggers the Art Agent to generate a piece of art based on a text prompt.
    
    In a real-world scenario, this would involve calling an external art generation API.
    For this implementation, it simulates the process and logs the activity.
    
    Raises:
        HTTPException: 404 if the agent is not found.
        HTTPException: 400 if the agent is not ACTIVE.
    """
    db_agent = db.query(ArtAgent).filter(ArtAgent.id == agent_id).first()
    if db_agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Art Agent not found"
        )
        
    if db_agent.status != AgentStatus.ACTIVE:
        log_activity(db, agent_id, ActivityAction.FAILED_GENERATION, f"Generation failed: Agent status is {db_agent.status.value}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent is not active. Current status: {db_agent.status.value}"
        )

    # --- SIMULATED ART GENERATION LOGIC ---
    # In a real application, this is where the heavy lifting happens.
    # For demonstration, we simulate success and log it.
    
    # Simulate a successful generation
    result_url = f"https://art-service.com/generated/{agent_id}/{hash(prompt)}.png"
    
    log_activity(
        db, 
        agent_id, 
        ActivityAction.GENERATED_ART, 
        f"Successfully generated art for prompt: '{prompt[:50]}...'. Result URL: {result_url}"
    )
    
    logger.info(f"Agent {agent_id} successfully generated art.")
    return {"message": "Art generation successfully triggered and completed (simulated).", "result_url": result_url}

@router.get(
    "/{agent_id}/activity-log",
    response_model=List[models.ArtAgentActivityLogResponse],
    summary="Retrieve activity log for a specific Art Agent"
)
def get_agent_activity_log(agent_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """
    Retrieves the recent activity log entries for a given Art Agent.
    
    Raises:
        HTTPException: 404 if the agent is not found.
    """
    # Check if agent exists
    if db.query(ArtAgent).filter(ArtAgent.id == agent_id).first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Art Agent not found"
        )
        
    logs = db.query(ArtAgentActivityLog) \
             .filter(ArtAgentActivityLog.agent_id == agent_id) \
             .order_by(ArtAgentActivityLog.timestamp.desc()) \
             .offset(skip) \
             .limit(limit) \
             .all()
             
    logger.info(f"Retrieved {len(logs)} activity logs for agent {agent_id}.")
    return logs
