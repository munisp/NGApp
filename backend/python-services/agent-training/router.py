import uuid
import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .config import get_db, logger
from .models import (
    AgentTraining,
    AgentTrainingLog,
    AgentTrainingCreate,
    AgentTrainingUpdate,
    AgentTrainingResponse,
    AgentTrainingLogCreate,
    AgentTrainingLogResponse,
    AgentTrainingListResponse,
)

router = APIRouter(
    prefix="/agent-training",
    tags=["agent-training"],
)

# --- Helper Functions ---

def get_training_or_404(db: Session, training_id: uuid.UUID) -> AgentTraining:
    """Fetches an AgentTraining session by ID or raises a 404 error."""
    training = db.query(AgentTraining).filter(AgentTraining.id == training_id).first()
    if not training:
        logger.warning(f"AgentTraining with ID {training_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AgentTraining with ID {training_id} not found",
        )
    return training

# --- AgentTraining CRUD Endpoints ---

@router.post(
    "/",
    response_model=AgentTrainingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new agent training session",
)
def create_training(
    training_data: AgentTrainingCreate, db: Session = Depends(get_db)
):
    """
    Creates a new agent training session record in the database.
    The initial status will be 'PENDING'.
    """
    db_training = AgentTraining(**training_data.model_dump())
    db.add(db_training)
    db.commit()
    db.refresh(db_training)
    logger.info(f"Created new AgentTraining session: {db_training.id}")
    return db_training

@router.get(
    "/",
    response_model=List[AgentTrainingListResponse],
    summary="List all agent training sessions",
)
def list_trainings(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """
    Retrieves a list of all agent training sessions with pagination.
    Note: This endpoint returns a lighter response model without logs.
    """
    trainings = db.query(AgentTraining).offset(skip).limit(limit).all()
    return trainings

@router.get(
    "/{training_id}",
    response_model=AgentTrainingResponse,
    summary="Get a specific agent training session by ID",
)
def read_training(training_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Retrieves a single agent training session, including its associated logs.
    """
    # Use joinedload to fetch logs in the same query
    training = (
        db.query(AgentTraining)
        .options(joinedload(AgentTraining.logs))
        .filter(AgentTraining.id == training_id)
        .first()
    )
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AgentTraining with ID {training_id} not found",
        )
    return training

@router.put(
    "/{training_id}",
    response_model=AgentTrainingResponse,
    summary="Update an existing agent training session",
)
def update_training(
    training_id: uuid.UUID,
    training_data: AgentTrainingUpdate,
    db: Session = Depends(get_db),
):
    """
    Updates the details of an existing agent training session.
    Only provided fields will be updated.
    """
    db_training = get_training_or_404(db, training_id)

    update_data = training_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_training, key, value)

    db.add(db_training)
    db.commit()
    db.refresh(db_training)
    logger.info(f"Updated AgentTraining session: {training_id}")
    return db_training

@router.delete(
    "/{training_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an agent training session",
)
def delete_training(training_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Deletes an agent training session and all its associated logs.
    """
    db_training = get_training_or_404(db, training_id)
    db.delete(db_training)
    db.commit()
    logger.info(f"Deleted AgentTraining session: {training_id}")
    return {"ok": True}

# --- Business-Specific Endpoints ---

@router.post(
    "/{training_id}/start",
    response_model=AgentTrainingResponse,
    summary="Start a pending agent training session",
)
def start_training(training_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Sets the training session status to 'RUNNING' and records the start time.
    """
    db_training = get_training_or_404(db, training_id)

    if db_training.status not in ["PENDING", "FAILED", "STOPPED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Training is already in status: {db_training.status}",
        )

    db_training.status = "RUNNING"
    db_training.start_time = datetime.datetime.utcnow()
    db_training.end_time = None # Reset end time if restarting
    db.add(db_training)
    db.commit()
    db.refresh(db_training)
    logger.info(f"Started AgentTraining session: {training_id}")
    return db_training

@router.post(
    "/{training_id}/stop",
    response_model=AgentTrainingResponse,
    summary="Stop a running agent training session",
)
def stop_training(training_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Sets the training session status to 'STOPPED' and records the end time.
    """
    db_training = get_training_or_404(db, training_id)

    if db_training.status != "RUNNING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Training is not running. Current status: {db_training.status}",
        )

    db_training.status = "STOPPED"
    db_training.end_time = datetime.datetime.utcnow()
    db.add(db_training)
    db.commit()
    db.refresh(db_training)
    logger.info(f"Stopped AgentTraining session: {training_id}")
    return db_training

@router.get(
    "/agent/{agent_id}",
    response_model=List[AgentTrainingListResponse],
    summary="List all training sessions for a specific agent",
)
def list_trainings_by_agent(
    agent_id: uuid.UUID, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """
    Retrieves a list of all training sessions associated with a given agent ID.
    """
    trainings = (
        db.query(AgentTraining)
        .filter(AgentTraining.agent_id == agent_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return trainings

# --- AgentTrainingLog Endpoints ---

@router.post(
    "/{training_id}/logs",
    response_model=AgentTrainingLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new log entry to a training session",
)
def create_log_entry(
    training_id: uuid.UUID,
    log_data: AgentTrainingLogBase,
    db: Session = Depends(get_db),
):
    """
    Creates a new log entry associated with the specified training session.
    """
    # Check if training exists
    get_training_or_404(db, training_id)

    db_log = AgentTrainingLog(
        **log_data.model_dump(),
        training_id=training_id
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    logger.debug(f"Added log to training {training_id}: {db_log.message}")
    return db_log

@router.get(
    "/{training_id}/logs",
    response_model=List[AgentTrainingLogResponse],
    summary="Retrieve all logs for a specific training session",
)
def list_training_logs(
    training_id: uuid.UUID, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """
    Retrieves a paginated list of log entries for a given training session, ordered by timestamp.
    """
    # Check if training exists
    get_training_or_404(db, training_id)

    logs = (
        db.query(AgentTrainingLog)
        .filter(AgentTrainingLog.training_id == training_id)
        .order_by(AgentTrainingLog.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return logs
