import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from .config import get_db, logger
from .models import (
    AgentHierarchy,
    AgentHierarchyActivityLog,
    AgentHierarchyCreate,
    AgentHierarchyUpdate,
    AgentHierarchyResponse,
    AgentHierarchyListResponse,
    AgentHierarchyFullResponse,
    Base,
)

# Initialize logger from config
logger = logging.getLogger("agent-hierarchy-service")

router = APIRouter(
    prefix="/hierarchy",
    tags=["agent-hierarchy"],
    responses={404: {"description": "Not found"}},
)

# --- Helper Functions ---

def create_activity_log(
    db: Session,
    agent_hierarchy_id: UUID,
    action: str,
    details: Optional[str] = None,
    performed_by: Optional[str] = "system",
) -> None:
    """Creates a new activity log entry."""
    log_entry = AgentHierarchyActivityLog(
        agent_hierarchy_id=agent_hierarchy_id,
        action=action,
        details=details,
        performed_by=performed_by,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    logger.info(f"Activity Log created for ID {agent_hierarchy_id}: {action}")

def get_hierarchy_subtree(db: Session, agent_id: UUID) -> List[AgentHierarchyResponse]:
    """Recursively fetches the subtree starting from the given agent_id."""
    # This is a simplified, non-optimized recursive fetch. For production, a materialized path or
    # adjacency list with a recursive CTE would be preferred for performance.
    
    # Fetch the children of the current node
    children_models = db.query(AgentHierarchy).filter(AgentHierarchy.parent_id == agent_id).all()
    
    subtree = []
    for child_model in children_models:
        # Convert to response schema
        child_response = AgentHierarchyResponse.model_validate(child_model)
        
        # Recursively get the child's subtree
        # Note: This is a simple implementation. A full recursive response schema would need to be defined
        # to include nested children, which is omitted in models.py for simplicity.
        # For this function, we'll just return a flat list of all descendants.
        subtree.append(child_response)
        subtree.extend(get_hierarchy_subtree(db, child_model.id))
        
    return subtree

# --- CRUD Endpoints ---

@router.post(
    "/",
    response_model=AgentHierarchyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new agent node in the hierarchy",
)
def create_agent_node(
    agent_node: AgentHierarchyCreate, db: Session = Depends(get_db)
):
    """
    Creates a new agent node and inserts it into the hierarchy.
    
    - **agent_id**: The unique ID of the agent (must be unique across the table).
    - **name**: The agent's name.
    - **parent_id**: Optional ID of the parent agent.
    - **level**: The agent's hierarchical level/role.
    """
    # Check for existing agent_id
    if db.query(AgentHierarchy).filter(AgentHierarchy.agent_id == agent_node.agent_id).first():
        logger.warning(f"Attempted to create duplicate agent_id: {agent_node.agent_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent with agent_id '{agent_node.agent_id}' already exists.",
        )

    # Check if parent_id exists if provided
    if agent_node.parent_id:
        parent = db.query(AgentHierarchy).filter(AgentHierarchy.id == agent_node.parent_id).first()
        if not parent:
            logger.warning(f"Parent ID not found: {agent_node.parent_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent node with ID '{agent_node.parent_id}' not found.",
            )

    try:
        db_agent_node = AgentHierarchy(**agent_node.model_dump())
        db.add(db_agent_node)
        db.commit()
        db.refresh(db_agent_node)
        
        create_activity_log(
            db,
            db_agent_node.id,
            "CREATE",
            f"Agent node created with agent_id: {db_agent_node.agent_id} and parent_id: {db_agent_node.parent_id}",
        )
        
        return db_agent_node
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating agent node: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}",
        )


@router.get(
    "/",
    response_model=List[AgentHierarchyListResponse],
    summary="List all agent nodes with optional filtering",
)
def list_agent_nodes(
    level: Optional[str] = Query(None, description="Filter by hierarchical level/role."),
    is_active: Optional[bool] = Query(None, description="Filter by active status."),
    db: Session = Depends(get_db),
):
    """
    Retrieves a list of all agent nodes in the hierarchy, with optional filtering by level and active status.
    """
    query = db.query(AgentHierarchy)
    
    if level:
        query = query.filter(AgentHierarchy.level == level)
    
    if is_active is not None:
        query = query.filter(AgentHierarchy.is_active == is_active)
        
    return query.all()


@router.get(
    "/{node_id}",
    response_model=AgentHierarchyFullResponse,
    summary="Get a specific agent node by its hierarchy ID",
)
def get_agent_node(node_id: UUID, db: Session = Depends(get_db)):
    """
    Retrieves a single agent node by its internal hierarchy ID, including its activity log.
    """
    db_agent_node = (
        db.query(AgentHierarchy)
        .filter(AgentHierarchy.id == node_id)
        .first()
    )
    if not db_agent_node:
        logger.warning(f"Agent node not found for ID: {node_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent node not found"
        )
    return db_agent_node


@router.put(
    "/{node_id}",
    response_model=AgentHierarchyResponse,
    summary="Update an existing agent node",
)
def update_agent_node(
    node_id: UUID,
    agent_node_update: AgentHierarchyUpdate,
    db: Session = Depends(get_db),
):
    """
    Updates an existing agent node identified by its hierarchy ID.
    
    - **parent_id** can be updated to restructure the hierarchy.
    - **agent_id** cannot be changed after creation.
    """
    db_agent_node = (
        db.query(AgentHierarchy)
        .filter(AgentHierarchy.id == node_id)
        .first()
    )
    if not db_agent_node:
        logger.warning(f"Update failed: Agent node not found for ID: {node_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent node not found"
        )

    update_data = agent_node_update.model_dump(exclude_unset=True)
    
    # Prevent changing agent_id after creation
    if "agent_id" in update_data:
        del update_data["agent_id"]
        
    # Check if parent_id exists if provided
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        parent = db.query(AgentHierarchy).filter(AgentHierarchy.id == update_data["parent_id"]).first()
        if not parent:
            logger.warning(f"Update failed: Parent ID not found: {update_data['parent_id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent node with ID '{update_data['parent_id']}' not found.",
            )
        # Prevent setting self as parent
        if update_data["parent_id"] == node_id:
            logger.warning(f"Update failed: Cannot set node {node_id} as its own parent.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set an agent node as its own parent.",
            )
            
    # Apply updates and log changes
    changes = []
    for key, value in update_data.items():
        if hasattr(db_agent_node, key) and getattr(db_agent_node, key) != value:
            old_value = getattr(db_agent_node, key)
            setattr(db_agent_node, key, value)
            changes.append(f"{key}: {old_value} -> {value}")

    if changes:
        db.commit()
        db.refresh(db_agent_node)
        create_activity_log(
            db,
            db_agent_node.id,
            "UPDATE",
            "Changes: " + "; ".join(changes),
        )
    else:
        logger.info(f"No changes detected for agent node ID: {node_id}")

    return db_agent_node


@router.delete(
    "/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an agent node from the hierarchy",
)
def delete_agent_node(node_id: UUID, db: Session = Depends(get_db)):
    """
    Deletes an agent node by its hierarchy ID.
    
    - **Note**: Deleting a node will set the `parent_id` of its direct children to NULL (due to `ondelete="SET NULL"` in the model).
    - **Note**: All associated activity logs will be deleted (due to `cascade="all, delete-orphan"`).
    """
    db_agent_node = (
        db.query(AgentHierarchy)
        .filter(AgentHierarchy.id == node_id)
        .first()
    )
    if not db_agent_node:
        logger.warning(f"Delete failed: Agent node not found for ID: {node_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent node not found"
        )

    try:
        # Log the deletion before the commit, as the node will be gone after
        create_activity_log(
            db,
            db_agent_node.id,
            "DELETE",
            f"Agent node for agent_id {db_agent_node.agent_id} is being deleted.",
        )
        
        db.delete(db_agent_node)
        db.commit()
        logger.info(f"Agent node deleted: {node_id}")
        return
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting agent node {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during deletion: {e}",
        )

# --- Business-Specific Endpoints ---

@router.get(
    "/{node_id}/children",
    response_model=List[AgentHierarchyListResponse],
    summary="Get direct children of an agent node",
)
def get_direct_children(node_id: UUID, db: Session = Depends(get_db)):
    """
    Retrieves the list of agent nodes that directly report to the specified node.
    """
    # Check if the parent node exists
    parent_node = db.query(AgentHierarchy).filter(AgentHierarchy.id == node_id).first()
    if not parent_node:
        logger.warning(f"Parent node not found for children request: {node_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parent agent node not found"
        )
        
    children = db.query(AgentHierarchy).filter(AgentHierarchy.parent_id == node_id).all()
    return children

@router.get(
    "/{node_id}/subtree",
    response_model=List[AgentHierarchyListResponse],
    summary="Get the entire hierarchy subtree under an agent node",
)
def get_hierarchy_descendants(node_id: UUID, db: Session = Depends(get_db)):
    """
    Retrieves all descendants (children, grandchildren, etc.) of the specified agent node.
    
    Note: This endpoint uses a simple recursive approach which may be inefficient for very deep hierarchies.
    """
    # Check if the root node exists
    root_node = db.query(AgentHierarchy).filter(AgentHierarchy.id == node_id).first()
    if not root_node:
        logger.warning(f"Root node not found for subtree request: {node_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Root agent node not found"
        )
        
    # Fetch the entire flat list of descendants
    descendants = get_hierarchy_subtree(db, node_id)
    
    # Convert the list of AgentHierarchyResponse (which is what get_hierarchy_subtree returns)
    # to AgentHierarchyListResponse for the final output model.
    return [AgentHierarchyListResponse.model_validate(d) for d in descendants]

@router.get(
    "/root",
    response_model=List[AgentHierarchyListResponse],
    summary="Get all root agent nodes (nodes with no parent)",
)
def get_root_nodes(db: Session = Depends(get_db)):
    """
    Retrieves all agent nodes that do not have a parent (i.e., parent_id is NULL).
    These are the top-level nodes in the hierarchy.
    """
    root_nodes = db.query(AgentHierarchy).filter(AgentHierarchy.parent_id.is_(None)).all()
    return root_nodes
