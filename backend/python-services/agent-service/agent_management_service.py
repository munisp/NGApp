import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
"""
Agent Banking Platform - Comprehensive Agent Management Service
Handles agent CRUD operations, hierarchy management, and agent lifecycle
"""

import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal

import asyncpg
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Depends, Query, Path, Body
from fastapi.middleware.cors import CORSMiddleware

apply_middleware(app)
setup_logging("agent-management-service")
app.include_router(metrics_router)

from pydantic import BaseModel, EmailStr, validator
from passlib.context import CryptContext
import jwt
from geopy.geocoders import Nominatim
from geopy.distance import geodesic

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Agent Management Service",
    description="Comprehensive agent management and hierarchy service for Agent Banking Platform",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:5173,http://localhost:5174,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://banking_user:banking_pass@localhost:5432/agent_banking")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = "HS256"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database and Redis connections
db_pool = None
redis_client = None

# =====================================================
# DATA MODELS
# =====================================================

class AgentTier(str):
    SUPER_AGENT = "super_agent"
    SENIOR_AGENT = "senior_agent"
    AGENT = "agent"
    SUB_AGENT = "sub_agent"
    TRAINEE = "trainee"

class AgentStatus(str):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_APPROVAL = "pending_approval"
    TERMINATED = "terminated"

class KYCStatus(str):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"

class AgentCreate(BaseModel):
    email: EmailStr
    phone: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    tier: str = AgentTier.AGENT
    parent_agent_id: Optional[str] = None
    territory_id: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    business_name: Optional[str] = None
    business_registration_number: Optional[str] = None
    tax_identification_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_routing_number: Optional[str] = None
    max_transaction_limit: Optional[Decimal] = Decimal("100000.00")
    daily_transaction_limit: Optional[Decimal] = Decimal("500000.00")
    monthly_transaction_limit: Optional[Decimal] = Decimal("10000000.00")

    @validator('tier')
    def validate_tier(cls, v):
        valid_tiers = [AgentTier.SUPER_AGENT, AgentTier.SENIOR_AGENT, AgentTier.AGENT, AgentTier.SUB_AGENT, AgentTier.TRAINEE]
        if v not in valid_tiers:
            raise ValueError(f'Invalid tier. Must be one of: {valid_tiers}')
        return v

class AgentUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    tier: Optional[str] = None
    parent_agent_id: Optional[str] = None
    territory_id: Optional[str] = None
    status: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    business_name: Optional[str] = None
    max_transaction_limit: Optional[Decimal] = None
    daily_transaction_limit: Optional[Decimal] = None
    monthly_transaction_limit: Optional[Decimal] = None

class AgentResponse(BaseModel):
    id: str
    email: str
    phone: str
    first_name: str
    last_name: str
    full_name: str
    tier: str
    parent_agent_id: Optional[str]
    hierarchy_level: int
    territory_id: Optional[str]
    status: str
    kyc_status: str
    address: Optional[Dict[str, Any]]
    business_name: Optional[str]
    max_transaction_limit: Decimal
    daily_transaction_limit: Decimal
    monthly_transaction_limit: Decimal
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]

class AgentHierarchy(BaseModel):
    agent_id: str
    agent_name: str
    tier: str
    status: str
    hierarchy_level: int
    parent_name: Optional[str]
    territory_name: Optional[str]
    sub_agents_count: int
    children: List['AgentHierarchy'] = []

class TerritoryCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    country: str
    state_province: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    parent_territory_id: Optional[str] = None
    max_agents: int = 100

class TerritoryResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str]
    country: str
    state_province: Optional[str]
    city: Optional[str]
    postal_code: Optional[str]
    parent_territory_id: Optional[str]
    territory_level: int
    max_agents: int
    current_agent_count: int
    is_active: bool
    created_at: datetime

class AgentPerformanceMetrics(BaseModel):
    agent_id: str
    agent_name: str
    tier: str
    territory_name: Optional[str]
    monthly_transactions: int
    monthly_volume: Decimal
    monthly_commission: Decimal
    avg_commission_rate: Optional[Decimal]
    tier_rank: Optional[int]

# =====================================================
# DATABASE CONNECTION
# =====================================================

async def get_db_connection():
    """Get database connection from pool"""
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(DATABASE_URL)
    return await db_pool.acquire()

async def get_redis_connection():
    """Get Redis connection"""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(REDIS_URL)
    return redis_client

# =====================================================
# UTILITY FUNCTIONS
# =====================================================

def generate_agent_id(tier: str) -> str:
    """Generate unique agent ID based on tier"""
    tier_prefixes = {
        AgentTier.SUPER_AGENT: "SA",
        AgentTier.SENIOR_AGENT: "SR",
        AgentTier.AGENT: "AG",
        AgentTier.SUB_AGENT: "SB",
        AgentTier.TRAINEE: "TR"
    }
    prefix = tier_prefixes.get(tier, "AG")
    unique_id = str(uuid.uuid4()).replace("-", "")[:8].upper()
    return f"{prefix}{unique_id}"

async def validate_hierarchy_rules(parent_agent_id: str, child_tier: str, conn) -> bool:
    """Validate agent hierarchy rules"""
    if not parent_agent_id:
        return True
    
    # Get parent agent details
    parent_query = "SELECT tier, hierarchy_level FROM agents WHERE id = $1"
    parent_result = await conn.fetchrow(parent_query, parent_agent_id)
    
    if not parent_result:
        raise HTTPException(status_code=404, detail="Parent agent not found")
    
    parent_tier = parent_result['tier']
    parent_level = parent_result['hierarchy_level']
    
    # Define hierarchy rules
    hierarchy_rules = {
        AgentTier.SUPER_AGENT: [AgentTier.SENIOR_AGENT, AgentTier.AGENT, AgentTier.SUB_AGENT],
        AgentTier.SENIOR_AGENT: [AgentTier.AGENT, AgentTier.SUB_AGENT],
        AgentTier.AGENT: [AgentTier.SUB_AGENT],
        AgentTier.SUB_AGENT: [],
        AgentTier.TRAINEE: []
    }
    
    # Check if child tier is allowed under parent tier
    allowed_children = hierarchy_rules.get(parent_tier, [])
    if child_tier not in allowed_children:
        raise HTTPException(
            status_code=400, 
            detail=f"Agent tier '{child_tier}' cannot be placed under '{parent_tier}'"
        )
    
    # Check maximum hierarchy depth (prevent infinite nesting)
    if parent_level >= 5:
        raise HTTPException(status_code=400, detail="Maximum hierarchy depth exceeded")
    
    return True

async def geocode_address(address: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Geocode address to get coordinates"""
    try:
        geolocator = Nominatim(user_agent="agent_banking_platform")
        address_string = f"{address.get('street', '')}, {address.get('city', '')}, {address.get('country', '')}"
        location = geolocator.geocode(address_string)
        
        if location:
            return {"latitude": location.latitude, "longitude": location.longitude}
    except Exception as e:
        logger.warning(f"Geocoding failed: {e}")
    
    return None

# =====================================================
# AGENT MANAGEMENT ENDPOINTS
# =====================================================

@app.post("/agents", response_model=AgentResponse)
async def create_agent(agent_data: AgentCreate):
    """Create a new agent"""
    conn = await get_db_connection()
    try:
        # Validate hierarchy rules
        if agent_data.parent_agent_id:
            await validate_hierarchy_rules(agent_data.parent_agent_id, agent_data.tier, conn)
        
        # Generate unique agent ID
        agent_id = generate_agent_id(agent_data.tier)
        
        # Check for duplicate email/phone
        duplicate_check = await conn.fetchrow(
            "SELECT id FROM agents WHERE email = $1 OR phone = $2",
            agent_data.email, agent_data.phone
        )
        if duplicate_check:
            raise HTTPException(status_code=400, detail="Agent with this email or phone already exists")
        
        # Geocode address if provided
        coordinates = None
        if agent_data.address:
            coordinates = await geocode_address(agent_data.address)
        
        # Insert agent
        insert_query = """
        INSERT INTO agents (
            id, email, phone, first_name, last_name, middle_name, date_of_birth, gender,
            tier, parent_agent_id, territory_id, address, emergency_contact,
            business_name, business_registration_number, tax_identification_number,
            bank_account_number, bank_name, bank_routing_number,
            max_transaction_limit, daily_transaction_limit, monthly_transaction_limit
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING *
        """
        
        result = await conn.fetchrow(
            insert_query,
            agent_id, agent_data.email, agent_data.phone, agent_data.first_name,
            agent_data.last_name, agent_data.middle_name, agent_data.date_of_birth,
            agent_data.gender, agent_data.tier, agent_data.parent_agent_id,
            agent_data.territory_id, agent_data.address, agent_data.emergency_contact,
            agent_data.business_name, agent_data.business_registration_number,
            agent_data.tax_identification_number, agent_data.bank_account_number,
            agent_data.bank_name, agent_data.bank_routing_number,
            agent_data.max_transaction_limit, agent_data.daily_transaction_limit,
            agent_data.monthly_transaction_limit
        )
        
        # Cache agent data in Redis
        redis_conn = await get_redis_connection()
        await redis_conn.setex(
            f"agent:{agent_id}",
            3600,  # 1 hour TTL
            f"{result['first_name']} {result['last_name']}"
        )
        
        # Log activity
        await log_agent_activity(agent_id, "agent_created", "Agent account created", conn)
        
        return AgentResponse(
            id=result['id'],
            email=result['email'],
            phone=result['phone'],
            first_name=result['first_name'],
            last_name=result['last_name'],
            full_name=f"{result['first_name']} {result['last_name']}",
            tier=result['tier'],
            parent_agent_id=result['parent_agent_id'],
            hierarchy_level=result['hierarchy_level'],
            territory_id=result['territory_id'],
            status=result['status'],
            kyc_status=result['kyc_status'],
            address=result['address'],
            business_name=result['business_name'],
            max_transaction_limit=result['max_transaction_limit'],
            daily_transaction_limit=result['daily_transaction_limit'],
            monthly_transaction_limit=result['monthly_transaction_limit'],
            created_at=result['created_at'],
            updated_at=result['updated_at'],
            last_login_at=result['last_login_at']
        )
    
    finally:
        await conn.close()

@app.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str = Path(..., description="Agent ID")):
    """Get agent by ID"""
    conn = await get_db_connection()
    try:
        result = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not result:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return AgentResponse(
            id=result['id'],
            email=result['email'],
            phone=result['phone'],
            first_name=result['first_name'],
            last_name=result['last_name'],
            full_name=f"{result['first_name']} {result['last_name']}",
            tier=result['tier'],
            parent_agent_id=result['parent_agent_id'],
            hierarchy_level=result['hierarchy_level'],
            territory_id=result['territory_id'],
            status=result['status'],
            kyc_status=result['kyc_status'],
            address=result['address'],
            business_name=result['business_name'],
            max_transaction_limit=result['max_transaction_limit'],
            daily_transaction_limit=result['daily_transaction_limit'],
            monthly_transaction_limit=result['monthly_transaction_limit'],
            created_at=result['created_at'],
            updated_at=result['updated_at'],
            last_login_at=result['last_login_at']
        )
    
    finally:
        await conn.close()

@app.get("/agents", response_model=List[AgentResponse])
async def list_agents(
    tier: Optional[str] = Query(None, description="Filter by agent tier"),
    status: Optional[str] = Query(None, description="Filter by agent status"),
    territory_id: Optional[str] = Query(None, description="Filter by territory"),
    parent_agent_id: Optional[str] = Query(None, description="Filter by parent agent"),
    limit: int = Query(50, ge=1, le=1000, description="Number of agents to return"),
    offset: int = Query(0, ge=0, description="Number of agents to skip")
):
    """List agents with filtering and pagination"""
    conn = await get_db_connection()
    try:
        # Build query with filters
        where_conditions = []
        params = []
        param_count = 0
        
        if tier:
            param_count += 1
            where_conditions.append(f"tier = ${param_count}")
            params.append(tier)
        
        if status:
            param_count += 1
            where_conditions.append(f"status = ${param_count}")
            params.append(status)
        
        if territory_id:
            param_count += 1
            where_conditions.append(f"territory_id = ${param_count}")
            params.append(territory_id)
        
        if parent_agent_id:
            param_count += 1
            where_conditions.append(f"parent_agent_id = ${param_count}")
            params.append(parent_agent_id)
        
        where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        param_count += 1
        limit_param = f"${param_count}"
        params.append(limit)
        
        param_count += 1
        offset_param = f"${param_count}"
        params.append(offset)
        
        query = f"""
        SELECT * FROM agents
        {where_clause}
        ORDER BY created_at DESC
        LIMIT {limit_param} OFFSET {offset_param}
        """
        
        results = await conn.fetch(query, *params)
        
        agents = []
        for result in results:
            agents.append(AgentResponse(
                id=result['id'],
                email=result['email'],
                phone=result['phone'],
                first_name=result['first_name'],
                last_name=result['last_name'],
                full_name=f"{result['first_name']} {result['last_name']}",
                tier=result['tier'],
                parent_agent_id=result['parent_agent_id'],
                hierarchy_level=result['hierarchy_level'],
                territory_id=result['territory_id'],
                status=result['status'],
                kyc_status=result['kyc_status'],
                address=result['address'],
                business_name=result['business_name'],
                max_transaction_limit=result['max_transaction_limit'],
                daily_transaction_limit=result['daily_transaction_limit'],
                monthly_transaction_limit=result['monthly_transaction_limit'],
                created_at=result['created_at'],
                updated_at=result['updated_at'],
                last_login_at=result['last_login_at']
            ))
        
        return agents
    
    finally:
        await conn.close()

@app.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, agent_data: AgentUpdate):
    """Update agent information"""
    conn = await get_db_connection()
    try:
        # Check if agent exists
        existing_agent = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Validate hierarchy rules if parent is being changed
        if agent_data.parent_agent_id is not None and agent_data.parent_agent_id != existing_agent['parent_agent_id']:
            tier = agent_data.tier or existing_agent['tier']
            await validate_hierarchy_rules(agent_data.parent_agent_id, tier, conn)
        
        # Build update query dynamically
        update_fields = []
        params = []
        param_count = 0
        
        for field, value in agent_data.dict(exclude_unset=True).items():
            if value is not None:
                param_count += 1
                update_fields.append(f"{field} = ${param_count}")
                params.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        param_count += 1
        params.append(agent_id)
        
        update_query = f"""
        UPDATE agents 
        SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${param_count}
        RETURNING *
        """
        
        result = await conn.fetchrow(update_query, *params)
        
        # Update Redis cache
        redis_conn = await get_redis_connection()
        await redis_conn.setex(
            f"agent:{agent_id}",
            3600,
            f"{result['first_name']} {result['last_name']}"
        )
        
        # Log activity
        await log_agent_activity(agent_id, "agent_updated", "Agent information updated", conn)
        
        return AgentResponse(
            id=result['id'],
            email=result['email'],
            phone=result['phone'],
            first_name=result['first_name'],
            last_name=result['last_name'],
            full_name=f"{result['first_name']} {result['last_name']}",
            tier=result['tier'],
            parent_agent_id=result['parent_agent_id'],
            hierarchy_level=result['hierarchy_level'],
            territory_id=result['territory_id'],
            status=result['status'],
            kyc_status=result['kyc_status'],
            address=result['address'],
            business_name=result['business_name'],
            max_transaction_limit=result['max_transaction_limit'],
            daily_transaction_limit=result['daily_transaction_limit'],
            monthly_transaction_limit=result['monthly_transaction_limit'],
            created_at=result['created_at'],
            updated_at=result['updated_at'],
            last_login_at=result['last_login_at']
        )
    
    finally:
        await conn.close()

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """Soft delete agent (set status to terminated)"""
    conn = await get_db_connection()
    try:
        # Check if agent exists
        existing_agent = await conn.fetchrow("SELECT id FROM agents WHERE id = $1", agent_id)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Check if agent has sub-agents
        sub_agents = await conn.fetchrow("SELECT COUNT(*) as count FROM agents WHERE parent_agent_id = $1", agent_id)
        if sub_agents['count'] > 0:
            raise HTTPException(status_code=400, detail="Cannot delete agent with sub-agents")
        
        # Soft delete (update status)
        await conn.execute(
            "UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            AgentStatus.TERMINATED, agent_id
        )
        
        # Remove from Redis cache
        redis_conn = await get_redis_connection()
        await redis_conn.delete(f"agent:{agent_id}")
        
        # Log activity
        await log_agent_activity(agent_id, "agent_deleted", "Agent account terminated", conn)
        
        return {"message": "Agent deleted successfully"}
    
    finally:
        await conn.close()

# =====================================================
# HIERARCHY MANAGEMENT ENDPOINTS
# =====================================================

@app.get("/agents/{agent_id}/hierarchy", response_model=AgentHierarchy)
async def get_agent_hierarchy(agent_id: str):
    """Get agent hierarchy tree"""
    conn = await get_db_connection()
    try:
        # Get agent and build hierarchy tree
        hierarchy_query = """
        WITH RECURSIVE agent_tree AS (
            -- Base case: start with the requested agent
            SELECT id, first_name, last_name, tier, status, hierarchy_level, 
                   parent_agent_id, territory_id, 0 as depth
            FROM agents 
            WHERE id = $1
            
            UNION ALL
            
            -- Recursive case: get all descendants
            SELECT a.id, a.first_name, a.last_name, a.tier, a.status, a.hierarchy_level,
                   a.parent_agent_id, a.territory_id, at.depth + 1
            FROM agents a
            INNER JOIN agent_tree at ON a.parent_agent_id = at.id
            WHERE at.depth < 10  -- Prevent infinite recursion
        )
        SELECT at.*, t.name as territory_name,
               (SELECT COUNT(*) FROM agents WHERE parent_agent_id = at.id) as sub_agents_count
        FROM agent_tree at
        LEFT JOIN agent_territories t ON at.territory_id = t.id
        ORDER BY depth, first_name
        """
        
        results = await conn.fetch(hierarchy_query, agent_id)
        
        if not results:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Build hierarchy tree structure
        agents_dict = {}
        root_agent = None
        
        for result in results:
            agent_hierarchy = AgentHierarchy(
                agent_id=result['id'],
                agent_name=f"{result['first_name']} {result['last_name']}",
                tier=result['tier'],
                status=result['status'],
                hierarchy_level=result['hierarchy_level'],
                parent_name=None,
                territory_name=result['territory_name'],
                sub_agents_count=result['sub_agents_count'],
                children=[]
            )
            
            agents_dict[result['id']] = agent_hierarchy
            
            if result['id'] == agent_id:
                root_agent = agent_hierarchy
        
        # Build parent-child relationships
        for result in results:
            if result['parent_agent_id'] and result['parent_agent_id'] in agents_dict:
                parent = agents_dict[result['parent_agent_id']]
                child = agents_dict[result['id']]
                child.parent_name = parent.agent_name
                parent.children.append(child)
        
        return root_agent
    
    finally:
        await conn.close()

@app.get("/agents/{agent_id}/sub-agents", response_model=List[AgentResponse])
async def get_sub_agents(agent_id: str):
    """Get all sub-agents under an agent"""
    conn = await get_db_connection()
    try:
        # Get all descendants using the hierarchy table
        query = """
        SELECT a.* FROM agents a
        INNER JOIN agent_hierarchy ah ON a.id = ah.agent_id
        WHERE ah.ancestor_id = $1 AND ah.depth > 0
        ORDER BY ah.depth, a.first_name
        """
        
        results = await conn.fetch(query, agent_id)
        
        sub_agents = []
        for result in results:
            sub_agents.append(AgentResponse(
                id=result['id'],
                email=result['email'],
                phone=result['phone'],
                first_name=result['first_name'],
                last_name=result['last_name'],
                full_name=f"{result['first_name']} {result['last_name']}",
                tier=result['tier'],
                parent_agent_id=result['parent_agent_id'],
                hierarchy_level=result['hierarchy_level'],
                territory_id=result['territory_id'],
                status=result['status'],
                kyc_status=result['kyc_status'],
                address=result['address'],
                business_name=result['business_name'],
                max_transaction_limit=result['max_transaction_limit'],
                daily_transaction_limit=result['daily_transaction_limit'],
                monthly_transaction_limit=result['monthly_transaction_limit'],
                created_at=result['created_at'],
                updated_at=result['updated_at'],
                last_login_at=result['last_login_at']
            ))
        
        return sub_agents
    
    finally:
        await conn.close()

@app.post("/agents/{agent_id}/transfer-hierarchy")
async def transfer_agent_hierarchy(
    agent_id: str,
    new_parent_id: str = Body(..., embed=True)
):
    """Transfer agent to a new parent in the hierarchy"""
    conn = await get_db_connection()
    try:
        # Get current agent details
        current_agent = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not current_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Validate new hierarchy rules
        await validate_hierarchy_rules(new_parent_id, current_agent['tier'], conn)
        
        # Check for circular reference
        if new_parent_id:
            circular_check = await conn.fetchrow(
                "SELECT 1 FROM agent_hierarchy WHERE agent_id = $1 AND ancestor_id = $2",
                new_parent_id, agent_id
            )
            if circular_check:
                raise HTTPException(status_code=400, detail="Cannot create circular hierarchy reference")
        
        # Update parent agent
        await conn.execute(
            "UPDATE agents SET parent_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            new_parent_id, agent_id
        )
        
        # Log activity
        await log_agent_activity(
            agent_id, 
            "hierarchy_transfer", 
            f"Agent transferred to new parent: {new_parent_id}", 
            conn
        )
        
        return {"message": "Agent hierarchy transferred successfully"}
    
    finally:
        await conn.close()

# =====================================================
# TERRITORY MANAGEMENT ENDPOINTS
# =====================================================

@app.post("/territories", response_model=TerritoryResponse)
async def create_territory(territory_data: TerritoryCreate):
    """Create a new territory"""
    conn = await get_db_connection()
    try:
        # Check for duplicate code
        duplicate_check = await conn.fetchrow("SELECT id FROM agent_territories WHERE code = $1", territory_data.code)
        if duplicate_check:
            raise HTTPException(status_code=400, detail="Territory with this code already exists")
        
        # Calculate territory level
        territory_level = 1
        if territory_data.parent_territory_id:
            parent_result = await conn.fetchrow(
                "SELECT territory_level FROM agent_territories WHERE id = $1",
                territory_data.parent_territory_id
            )
            if parent_result:
                territory_level = parent_result['territory_level'] + 1
        
        # Insert territory
        insert_query = """
        INSERT INTO agent_territories (
            name, code, description, country, state_province, city, postal_code,
            parent_territory_id, territory_level, max_agents
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        """
        
        result = await conn.fetchrow(
            insert_query,
            territory_data.name, territory_data.code, territory_data.description,
            territory_data.country, territory_data.state_province, territory_data.city,
            territory_data.postal_code, territory_data.parent_territory_id,
            territory_level, territory_data.max_agents
        )
        
        return TerritoryResponse(
            id=str(result['id']),
            name=result['name'],
            code=result['code'],
            description=result['description'],
            country=result['country'],
            state_province=result['state_province'],
            city=result['city'],
            postal_code=result['postal_code'],
            parent_territory_id=str(result['parent_territory_id']) if result['parent_territory_id'] else None,
            territory_level=result['territory_level'],
            max_agents=result['max_agents'],
            current_agent_count=result['current_agent_count'],
            is_active=result['is_active'],
            created_at=result['created_at']
        )
    
    finally:
        await conn.close()

@app.get("/territories", response_model=List[TerritoryResponse])
async def list_territories():
    """List all territories"""
    conn = await get_db_connection()
    try:
        results = await conn.fetch("SELECT * FROM agent_territories ORDER BY territory_level, name")
        
        territories = []
        for result in results:
            territories.append(TerritoryResponse(
                id=str(result['id']),
                name=result['name'],
                code=result['code'],
                description=result['description'],
                country=result['country'],
                state_province=result['state_province'],
                city=result['city'],
                postal_code=result['postal_code'],
                parent_territory_id=str(result['parent_territory_id']) if result['parent_territory_id'] else None,
                territory_level=result['territory_level'],
                max_agents=result['max_agents'],
                current_agent_count=result['current_agent_count'],
                is_active=result['is_active'],
                created_at=result['created_at']
            ))
        
        return territories
    
    finally:
        await conn.close()

# =====================================================
# PERFORMANCE AND ANALYTICS ENDPOINTS
# =====================================================

@app.get("/agents/performance/summary", response_model=List[AgentPerformanceMetrics])
async def get_agent_performance_summary():
    """Get agent performance summary from materialized view"""
    conn = await get_db_connection()
    try:
        results = await conn.fetch("SELECT * FROM agent_performance_summary ORDER BY monthly_commission DESC")
        
        performance_metrics = []
        for result in results:
            performance_metrics.append(AgentPerformanceMetrics(
                agent_id=result['agent_id'],
                agent_name=result['agent_name'],
                tier=result['tier'],
                territory_name=result['territory_name'],
                monthly_transactions=result['monthly_transactions'] or 0,
                monthly_volume=result['monthly_volume'] or Decimal('0.00'),
                monthly_commission=result['monthly_commission'] or Decimal('0.00'),
                avg_commission_rate=result['avg_commission_rate'],
                tier_rank=result['tier_rank']
            ))
        
        return performance_metrics
    
    finally:
        await conn.close()

@app.post("/agents/performance/refresh")
async def refresh_performance_summary():
    """Refresh the agent performance materialized view"""
    conn = await get_db_connection()
    try:
        await conn.execute("REFRESH MATERIALIZED VIEW agent_performance_summary")
        return {"message": "Performance summary refreshed successfully"}
    
    finally:
        await conn.close()

# =====================================================
# UTILITY FUNCTIONS
# =====================================================

async def log_agent_activity(agent_id: str, activity_type: str, description: str, conn):
    """Log agent activity"""
    try:
        await conn.execute(
            """
            INSERT INTO agent_activity_log (agent_id, activity_type, activity_description)
            VALUES ($1, $2, $3)
            """,
            agent_id, activity_type, description
        )
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")

# =====================================================
# HEALTH CHECK AND STATUS ENDPOINTS
# =====================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        conn = await get_db_connection()
        await conn.fetchval("SELECT 1")
        await conn.close()
        
        # Check Redis connection
        redis_conn = await get_redis_connection()
        await redis_conn.ping()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "redis": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    conn = await get_db_connection()
    try:
        # Get agent counts by tier and status
        tier_counts = await conn.fetch(
            "SELECT tier, status, COUNT(*) as count FROM agents GROUP BY tier, status"
        )
        
        # Get territory utilization
        territory_utilization = await conn.fetch(
            "SELECT name, current_agent_count, max_agents FROM agent_territories WHERE is_active = true"
        )
        
        # Get recent activity count
        recent_activity = await conn.fetchval(
            "SELECT COUNT(*) FROM agent_activity_log WHERE timestamp >= NOW() - INTERVAL '24 hours'"
        )
        
        return {
            "tier_status_distribution": [dict(row) for row in tier_counts],
            "territory_utilization": [dict(row) for row in territory_utilization],
            "recent_activity_24h": recent_activity,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    finally:
        await conn.close()

# =====================================================
# STARTUP AND SHUTDOWN EVENTS
# =====================================================

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global db_pool, redis_client
    
    try:
        # Initialize database pool
        db_pool = await asyncpg.create_pool(DATABASE_URL)
        logger.info("Database pool initialized")
        
        # Initialize Redis client
        redis_client = redis.from_url(REDIS_URL)
        await redis_client.ping()
        logger.info("Redis client initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize connections: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    global db_pool, redis_client
    
    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed")
    
    if redis_client:
        await redis_client.close()
        logger.info("Redis client closed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "agent_management_service:app",
        host="0.0.0.0",
        port=8040,
        reload=False,
        log_level="info"
    )
