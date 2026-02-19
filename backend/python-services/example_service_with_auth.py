"""
Example Service with Keycloak Authentication
Agent Banking Platform V11.0

This example demonstrates how to integrate Keycloak authentication
into existing FastAPI microservices.

Author: Manus AI
Date: November 11, 2025
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import logging

# Import Keycloak authentication
from shared.keycloak_auth import (
    KeycloakAuth,
    require_auth,
    require_role,
    require_any_role,
    get_user_id,
    get_username,
    get_email,
    get_roles
)


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize FastAPI app
app = FastAPI(
    title="Agent Banking Service",
    description="Example service with Keycloak authentication",
    version="1.0.0"
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize Keycloak auth
auth = KeycloakAuth(
    server_url="http://keycloak:8080",
    realm="agent-banking",
    client_id="agent-banking-api"
)


# ============================================================================
# Models
# ============================================================================

class UserProfile(BaseModel):
    """User profile model."""
    user_id: str
    username: str
    email: Optional[str]
    roles: List[str]
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class TransactionRequest(BaseModel):
    """Transaction request model."""
    amount: float
    customer_id: str
    transaction_type: str
    description: Optional[str] = None


class TransactionResponse(BaseModel):
    """Transaction response model."""
    transaction_id: str
    status: str
    amount: float
    message: str


# ============================================================================
# Public Endpoints (No Authentication Required)
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "agent-banking-service"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Agent Banking Service",
        "version": "1.0.0",
        "authentication": "Keycloak OAuth 2.0 / OpenID Connect"
    }


# ============================================================================
# Protected Endpoints (Authentication Required)
# ============================================================================

@app.get("/api/v1/profile", response_model=UserProfile)
@require_auth
async def get_profile(user: dict = Depends(auth.get_current_user)):
    """
    Get current user profile.
    
    Requires: Authentication
    """
    return UserProfile(
        user_id=get_user_id(user),
        username=get_username(user),
        email=get_email(user),
        roles=get_roles(user),
        first_name=user.get("given_name"),
        last_name=user.get("family_name")
    )


@app.get("/api/v1/transactions/history")
@require_auth
async def get_transaction_history(
    limit: int = 10,
    offset: int = 0,
    user: dict = Depends(auth.get_current_user)
):
    """
    Get transaction history for current user.
    
    Requires: Authentication
    """
    user_id = get_user_id(user)
    username = get_username(user)
    
    logger.info(f"Fetching transaction history for user: {username} (ID: {user_id})")
    
    # TODO: Fetch from database
    return {
        "user_id": user_id,
        "username": username,
        "transactions": [
            {
                "id": "txn-001",
                "type": "cash-in",
                "amount": 10000.00,
                "status": "completed",
                "timestamp": "2025-11-11T10:00:00Z"
            },
            {
                "id": "txn-002",
                "type": "cash-out",
                "amount": 5000.00,
                "status": "completed",
                "timestamp": "2025-11-11T11:30:00Z"
            }
        ],
        "total": 2,
        "limit": limit,
        "offset": offset
    }


# ============================================================================
# Role-Based Endpoints
# ============================================================================

@app.post("/api/v1/transactions/cash-in", response_model=TransactionResponse)
@require_any_role("agent", "super_agent", "admin")
async def cash_in(
    request: TransactionRequest,
    user: dict = Depends(auth.get_current_user)
):
    """
    Process cash-in transaction.
    
    Requires: agent, super_agent, or admin role
    """
    user_id = get_user_id(user)
    username = get_username(user)
    
    logger.info(f"Cash-in transaction initiated by {username}: {request.amount}")
    
    # TODO: Process transaction via Temporal workflow
    return TransactionResponse(
        transaction_id="txn-003",
        status="completed",
        amount=request.amount,
        message=f"Cash-in of {request.amount} completed successfully"
    )


@app.post("/api/v1/transactions/cash-out", response_model=TransactionResponse)
@require_any_role("agent", "super_agent", "admin")
async def cash_out(
    request: TransactionRequest,
    user: dict = Depends(auth.get_current_user)
):
    """
    Process cash-out transaction.
    
    Requires: agent, super_agent, or admin role
    """
    user_id = get_user_id(user)
    username = get_username(user)
    
    logger.info(f"Cash-out transaction initiated by {username}: {request.amount}")
    
    # TODO: Process transaction via Temporal workflow
    return TransactionResponse(
        transaction_id="txn-004",
        status="completed",
        amount=request.amount,
        message=f"Cash-out of {request.amount} completed successfully"
    )


@app.get("/api/v1/agents/hierarchy")
@require_any_role("super_agent", "admin")
async def get_agent_hierarchy(user: dict = Depends(auth.get_current_user)):
    """
    Get agent hierarchy tree.
    
    Requires: super_agent or admin role
    """
    user_id = get_user_id(user)
    username = get_username(user)
    
    logger.info(f"Agent hierarchy requested by {username}")
    
    # TODO: Fetch from database
    return {
        "agent_id": user_id,
        "username": username,
        "level": 1,
        "downline": [
            {
                "agent_id": "agent-002",
                "username": "sub-agent-1",
                "level": 2,
                "recruits": 5
            },
            {
                "agent_id": "agent-003",
                "username": "sub-agent-2",
                "level": 2,
                "recruits": 3
            }
        ],
        "total_downline": 8
    }


@app.post("/api/v1/agents/recruit")
@require_any_role("agent", "super_agent", "admin")
async def recruit_agent(
    email: str,
    first_name: str,
    last_name: str,
    user: dict = Depends(auth.get_current_user)
):
    """
    Recruit a new agent.
    
    Requires: agent, super_agent, or admin role
    """
    recruiter_id = get_user_id(user)
    recruiter_username = get_username(user)
    
    logger.info(f"Agent recruitment initiated by {recruiter_username}: {email}")
    
    # TODO: Create user in Keycloak and database
    return {
        "message": "Agent recruitment initiated",
        "recruiter_id": recruiter_id,
        "recruiter_username": recruiter_username,
        "new_agent_email": email,
        "status": "pending_verification"
    }


# ============================================================================
# Admin-Only Endpoints
# ============================================================================

@app.get("/api/v1/admin/users")
@require_role("admin")
async def list_users(
    limit: int = 10,
    offset: int = 0,
    user: dict = Depends(auth.get_current_user)
):
    """
    List all users (admin only).
    
    Requires: admin role
    """
    admin_username = get_username(user)
    
    logger.info(f"User list requested by admin: {admin_username}")
    
    # TODO: Fetch from Keycloak or database
    return {
        "users": [
            {
                "user_id": "user-001",
                "username": "agent-001",
                "email": "agent1@example.com",
                "roles": ["agent"],
                "status": "active"
            },
            {
                "user_id": "user-002",
                "username": "super-agent-001",
                "email": "superagent1@example.com",
                "roles": ["super_agent"],
                "status": "active"
            }
        ],
        "total": 2,
        "limit": limit,
        "offset": offset
    }


@app.post("/api/v1/admin/users/{user_id}/roles")
@require_role("admin")
async def assign_role(
    user_id: str,
    role: str,
    user: dict = Depends(auth.get_current_user)
):
    """
    Assign role to user (admin only).
    
    Requires: admin role
    """
    admin_username = get_username(user)
    
    logger.info(f"Role assignment by admin {admin_username}: user={user_id}, role={role}")
    
    # TODO: Assign role in Keycloak
    return {
        "message": f"Role '{role}' assigned to user '{user_id}'",
        "assigned_by": admin_username
    }


# ============================================================================
# Application Startup
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("Agent Banking Service starting up...")
    logger.info(f"Keycloak server: {auth.server_url}")
    logger.info(f"Keycloak realm: {auth.realm}")
    logger.info(f"Client ID: {auth.client_id}")
    logger.info("Service ready to accept requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Agent Banking Service shutting down...")


# ============================================================================
# Run Application
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "example_service_with_auth:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

