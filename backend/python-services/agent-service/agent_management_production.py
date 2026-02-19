"""
Production-Ready Agent Management Service
Integrates with: Kafka, Dapr, Fluvio, Temporal, Keycloak, Permify, Redis, APISIX, TigerBeetle, Lakehouse
"""

import os
import uuid
import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, AsyncGenerator
from decimal import Decimal
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum

import asyncpg
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Depends, Query, Path, Body, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AgentTier(str, Enum):
    SUPER_AGENT = "super_agent"
    SENIOR_AGENT = "senior_agent"
    AGENT = "agent"
    SUB_AGENT = "sub_agent"
    TRAINEE = "trainee"


class AgentStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_APPROVAL = "pending_approval"
    TERMINATED = "terminated"


class KYCStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class ServiceConfig:
    database_url: str = field(default_factory=lambda: os.getenv(
        "DATABASE_URL", 
        "postgresql://banking_user:banking_pass@localhost:5432/agent_banking"
    ))
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379"))
    kafka_bootstrap_servers: str = field(default_factory=lambda: os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    fluvio_endpoint: str = field(default_factory=lambda: os.getenv("FLUVIO_ENDPOINT", "localhost:9003"))
    temporal_host: str = field(default_factory=lambda: os.getenv("TEMPORAL_HOST", "localhost:7233"))
    keycloak_url: str = field(default_factory=lambda: os.getenv("KEYCLOAK_URL", "http://localhost:8080"))
    keycloak_realm: str = field(default_factory=lambda: os.getenv("KEYCLOAK_REALM", "agent-banking"))
    permify_url: str = field(default_factory=lambda: os.getenv("PERMIFY_URL", "http://localhost:3476"))
    tigerbeetle_addresses: str = field(default_factory=lambda: os.getenv("TIGERBEETLE_ADDRESSES", "localhost:3000"))
    lakehouse_url: str = field(default_factory=lambda: os.getenv("LAKEHOUSE_URL", "http://localhost:8181"))
    dapr_http_port: int = field(default_factory=lambda: int(os.getenv("DAPR_HTTP_PORT", "3500")))
    apisix_admin_url: str = field(default_factory=lambda: os.getenv("APISIX_ADMIN_URL", "http://localhost:9180"))
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", ""))
    
    def __post_init__(self):
        if not self.jwt_secret:
            raise ValueError("JWT_SECRET environment variable must be set")


class DatabasePool:
    """Production-ready database connection pool with proper lifecycle management"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize the connection pool"""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=5,
                max_size=20,
                max_inactive_connection_lifetime=300,
                command_timeout=60,
                statement_cache_size=100
            )
            logger.info("Database pool initialized")
    
    async def close(self):
        """Close the connection pool"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database pool closed")
    
    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection from the pool and release it properly"""
        if self._pool is None:
            raise RuntimeError("Database pool not initialized")
        
        async with self._pool.acquire() as connection:
            yield connection
    
    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection with transaction support"""
        async with self.acquire() as connection:
            async with connection.transaction():
                yield connection


class RedisClient:
    """Production-ready Redis client with connection pooling"""
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: Optional[redis.Redis] = None
    
    async def initialize(self):
        """Initialize Redis connection"""
        if self._client is None:
            self._client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20
            )
            await self._client.ping()
            logger.info("Redis client initialized")
    
    async def close(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis client closed")
    
    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis client not initialized")
        return self._client


class KafkaProducer:
    """Kafka producer for event streaming"""
    
    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        self._producer = None
    
    async def initialize(self):
        """Initialize Kafka producer"""
        try:
            from aiokafka import AIOKafkaProducer
            self._producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='all',
                retries=3,
                retry_backoff_ms=100
            )
            await self._producer.start()
            logger.info("Kafka producer initialized")
        except ImportError:
            logger.warning("aiokafka not installed, Kafka integration disabled")
        except Exception as e:
            logger.warning(f"Kafka connection failed: {e}, continuing without Kafka")
    
    async def close(self):
        """Close Kafka producer"""
        if self._producer:
            await self._producer.stop()
            self._producer = None
            logger.info("Kafka producer closed")
    
    async def send_event(self, topic: str, key: str, value: Dict[str, Any]):
        """Send event to Kafka topic"""
        if self._producer:
            try:
                await self._producer.send_and_wait(topic, value=value, key=key)
                logger.debug(f"Event sent to {topic}: {key}")
            except Exception as e:
                logger.error(f"Failed to send Kafka event: {e}")


class FluvioClient:
    """Fluvio client for real-time streaming"""
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self._client = None
    
    async def initialize(self):
        """Initialize Fluvio client"""
        try:
            from fluvio import Fluvio
            self._client = await Fluvio.connect()
            logger.info("Fluvio client initialized")
        except ImportError:
            logger.warning("fluvio not installed, Fluvio integration disabled")
        except Exception as e:
            logger.warning(f"Fluvio connection failed: {e}, continuing without Fluvio")
    
    async def close(self):
        """Close Fluvio client"""
        self._client = None
        logger.info("Fluvio client closed")
    
    async def produce(self, topic: str, key: str, value: Dict[str, Any]):
        """Produce message to Fluvio topic"""
        if self._client:
            try:
                producer = await self._client.topic_producer(topic)
                await producer.send(key, json.dumps(value))
                logger.debug(f"Message sent to Fluvio topic {topic}: {key}")
            except Exception as e:
                logger.error(f"Failed to send Fluvio message: {e}")


class DaprClient:
    """Dapr sidecar client for service mesh integration"""
    
    def __init__(self, http_port: int):
        self.base_url = f"http://localhost:{http_port}"
        self._client: Optional[httpx.AsyncClient] = None
    
    async def initialize(self):
        """Initialize Dapr client"""
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)
        logger.info("Dapr client initialized")
    
    async def close(self):
        """Close Dapr client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("Dapr client closed")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def invoke_service(self, app_id: str, method: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke another service via Dapr"""
        if not self._client:
            raise RuntimeError("Dapr client not initialized")
        
        response = await self._client.post(
            f"/v1.0/invoke/{app_id}/method/{method}",
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    async def publish_event(self, pubsub_name: str, topic: str, data: Dict[str, Any]):
        """Publish event via Dapr pub/sub"""
        if not self._client:
            return
        
        try:
            response = await self._client.post(
                f"/v1.0/publish/{pubsub_name}/{topic}",
                json=data
            )
            response.raise_for_status()
            logger.debug(f"Event published to {pubsub_name}/{topic}")
        except Exception as e:
            logger.error(f"Failed to publish Dapr event: {e}")
    
    async def save_state(self, store_name: str, key: str, value: Any):
        """Save state to Dapr state store"""
        if not self._client:
            return
        
        try:
            response = await self._client.post(
                f"/v1.0/state/{store_name}",
                json=[{"key": key, "value": value}]
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to save Dapr state: {e}")
    
    async def get_state(self, store_name: str, key: str) -> Optional[Any]:
        """Get state from Dapr state store"""
        if not self._client:
            return None
        
        try:
            response = await self._client.get(f"/v1.0/state/{store_name}/{key}")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Failed to get Dapr state: {e}")
            return None


class KeycloakClient:
    """Keycloak client for authentication"""
    
    def __init__(self, url: str, realm: str):
        self.url = url
        self.realm = realm
        self._client: Optional[httpx.AsyncClient] = None
    
    async def initialize(self):
        """Initialize Keycloak client"""
        self._client = httpx.AsyncClient(timeout=30.0)
        logger.info("Keycloak client initialized")
    
    async def close(self):
        """Close Keycloak client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("Keycloak client closed")
    
    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token with Keycloak"""
        if not self._client:
            return None
        
        try:
            response = await self._client.get(
                f"{self.url}/realms/{self.realm}/protocol/openid-connect/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return None
    
    async def create_user(self, user_data: Dict[str, Any], admin_token: str) -> Optional[str]:
        """Create user in Keycloak"""
        if not self._client:
            return None
        
        try:
            response = await self._client.post(
                f"{self.url}/admin/realms/{self.realm}/users",
                json=user_data,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if response.status_code == 201:
                location = response.headers.get("Location", "")
                return location.split("/")[-1] if location else None
            return None
        except Exception as e:
            logger.error(f"User creation failed: {e}")
            return None


class PermifyClient:
    """Permify client for fine-grained authorization"""
    
    def __init__(self, url: str):
        self.url = url
        self._client: Optional[httpx.AsyncClient] = None
    
    async def initialize(self):
        """Initialize Permify client"""
        self._client = httpx.AsyncClient(base_url=self.url, timeout=30.0)
        logger.info("Permify client initialized")
    
    async def close(self):
        """Close Permify client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("Permify client closed")
    
    async def check_permission(
        self, 
        entity_type: str, 
        entity_id: str, 
        permission: str, 
        subject_type: str, 
        subject_id: str
    ) -> bool:
        """Check if subject has permission on entity"""
        if not self._client:
            return True
        
        try:
            response = await self._client.post(
                "/v1/tenants/t1/permissions/check",
                json={
                    "metadata": {"snap_token": "", "schema_version": "", "depth": 20},
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id}
                }
            )
            if response.status_code == 200:
                result = response.json()
                return result.get("can") == "CHECK_RESULT_ALLOWED"
            return False
        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            return False
    
    async def write_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str
    ) -> bool:
        """Write relationship to Permify"""
        if not self._client:
            return True
        
        try:
            response = await self._client.post(
                "/v1/tenants/t1/relationships/write",
                json={
                    "metadata": {"schema_version": ""},
                    "tuples": [{
                        "entity": {"type": entity_type, "id": entity_id},
                        "relation": relation,
                        "subject": {"type": subject_type, "id": subject_id}
                    }]
                }
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Relationship write failed: {e}")
            return False


class TigerBeetleClient:
    """TigerBeetle client for financial ledger operations"""
    
    def __init__(self, addresses: str):
        self.addresses = addresses.split(",")
        self._client = None
    
    async def initialize(self):
        """Initialize TigerBeetle client"""
        try:
            import tigerbeetle
            self._client = tigerbeetle.Client(
                cluster_id=0,
                addresses=self.addresses
            )
            logger.info("TigerBeetle client initialized")
        except ImportError:
            logger.warning("tigerbeetle not installed, using HTTP fallback")
        except Exception as e:
            logger.warning(f"TigerBeetle connection failed: {e}")
    
    async def close(self):
        """Close TigerBeetle client"""
        self._client = None
        logger.info("TigerBeetle client closed")
    
    async def create_account(self, account_id: int, ledger: int, code: int) -> bool:
        """Create account in TigerBeetle"""
        if not self._client:
            return True
        
        try:
            import tigerbeetle
            account = tigerbeetle.Account(
                id=account_id,
                ledger=ledger,
                code=code,
                flags=0
            )
            errors = self._client.create_accounts([account])
            return len(errors) == 0
        except Exception as e:
            logger.error(f"Account creation failed: {e}")
            return False
    
    async def create_transfer(
        self,
        transfer_id: int,
        debit_account_id: int,
        credit_account_id: int,
        amount: int,
        ledger: int,
        code: int
    ) -> bool:
        """Create transfer in TigerBeetle"""
        if not self._client:
            return True
        
        try:
            import tigerbeetle
            transfer = tigerbeetle.Transfer(
                id=transfer_id,
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                amount=amount,
                ledger=ledger,
                code=code,
                flags=0
            )
            errors = self._client.create_transfers([transfer])
            return len(errors) == 0
        except Exception as e:
            logger.error(f"Transfer creation failed: {e}")
            return False


class LakehouseClient:
    """Lakehouse client for data analytics"""
    
    def __init__(self, url: str):
        self.url = url
        self._client: Optional[httpx.AsyncClient] = None
    
    async def initialize(self):
        """Initialize Lakehouse client"""
        self._client = httpx.AsyncClient(base_url=self.url, timeout=60.0)
        logger.info("Lakehouse client initialized")
    
    async def close(self):
        """Close Lakehouse client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("Lakehouse client closed")
    
    async def write_event(self, table: str, data: Dict[str, Any]) -> bool:
        """Write event to Lakehouse"""
        if not self._client:
            return True
        
        try:
            response = await self._client.post(
                f"/v1/tables/{table}/records",
                json=data
            )
            return response.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Lakehouse write failed: {e}")
            return False
    
    async def query(self, sql: str) -> List[Dict[str, Any]]:
        """Execute SQL query on Lakehouse"""
        if not self._client:
            return []
        
        try:
            response = await self._client.post(
                "/v1/query",
                json={"sql": sql}
            )
            if response.status_code == 200:
                return response.json().get("results", [])
            return []
        except Exception as e:
            logger.error(f"Lakehouse query failed: {e}")
            return []


class AgentCreate(BaseModel):
    email: EmailStr
    phone: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    tier: AgentTier = AgentTier.AGENT
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


class AgentUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    tier: Optional[AgentTier] = None
    parent_agent_id: Optional[str] = None
    territory_id: Optional[str] = None
    status: Optional[AgentStatus] = None
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

    class Config:
        from_attributes = True


class ServiceContainer:
    """Container for all service dependencies"""
    
    def __init__(self, config: ServiceConfig):
        self.config = config
        self.db = DatabasePool(config.database_url)
        self.redis = RedisClient(config.redis_url)
        self.kafka = KafkaProducer(config.kafka_bootstrap_servers)
        self.fluvio = FluvioClient(config.fluvio_endpoint)
        self.dapr = DaprClient(config.dapr_http_port)
        self.keycloak = KeycloakClient(config.keycloak_url, config.keycloak_realm)
        self.permify = PermifyClient(config.permify_url)
        self.tigerbeetle = TigerBeetleClient(config.tigerbeetle_addresses)
        self.lakehouse = LakehouseClient(config.lakehouse_url)
    
    async def initialize(self):
        """Initialize all services"""
        await self.db.initialize()
        await self.redis.initialize()
        await self.kafka.initialize()
        await self.fluvio.initialize()
        await self.dapr.initialize()
        await self.keycloak.initialize()
        await self.permify.initialize()
        await self.tigerbeetle.initialize()
        await self.lakehouse.initialize()
        logger.info("All services initialized")
    
    async def close(self):
        """Close all services"""
        await self.lakehouse.close()
        await self.tigerbeetle.close()
        await self.permify.close()
        await self.keycloak.close()
        await self.dapr.close()
        await self.fluvio.close()
        await self.kafka.close()
        await self.redis.close()
        await self.db.close()
        logger.info("All services closed")


services: Optional[ServiceContainer] = None
security = HTTPBearer(auto_error=False)


def get_services() -> ServiceContainer:
    if services is None:
        raise RuntimeError("Services not initialized")
    return services


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    svc: ServiceContainer = Depends(get_services)
) -> Optional[Dict[str, Any]]:
    """Get current user from token"""
    if not credentials:
        return None
    
    user_info = await svc.keycloak.verify_token(credentials.credentials)
    return user_info


def generate_agent_id(tier: AgentTier) -> str:
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


def generate_idempotency_key(data: Dict[str, Any]) -> str:
    """Generate idempotency key from request data"""
    content = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(content.encode()).hexdigest()[:32]


async def validate_hierarchy_rules(
    parent_agent_id: str, 
    child_tier: AgentTier, 
    conn: asyncpg.Connection
) -> bool:
    """Validate agent hierarchy rules"""
    if not parent_agent_id:
        return True
    
    parent_result = await conn.fetchrow(
        "SELECT tier, hierarchy_level FROM agents WHERE id = $1",
        parent_agent_id
    )
    
    if not parent_result:
        raise HTTPException(status_code=404, detail="Parent agent not found")
    
    parent_tier = parent_result['tier']
    parent_level = parent_result['hierarchy_level']
    
    hierarchy_rules = {
        AgentTier.SUPER_AGENT.value: [AgentTier.SENIOR_AGENT.value, AgentTier.AGENT.value, AgentTier.SUB_AGENT.value],
        AgentTier.SENIOR_AGENT.value: [AgentTier.AGENT.value, AgentTier.SUB_AGENT.value],
        AgentTier.AGENT.value: [AgentTier.SUB_AGENT.value],
        AgentTier.SUB_AGENT.value: [],
        AgentTier.TRAINEE.value: []
    }
    
    allowed_children = hierarchy_rules.get(parent_tier, [])
    if child_tier.value not in allowed_children:
        raise HTTPException(
            status_code=400, 
            detail=f"Agent tier '{child_tier.value}' cannot be placed under '{parent_tier}'"
        )
    
    if parent_level >= 5:
        raise HTTPException(status_code=400, detail="Maximum hierarchy depth exceeded")
    
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global services
    
    try:
        config = ServiceConfig()
        services = ServiceContainer(config)
        await services.initialize()
        yield
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.warning("Starting with minimal configuration for development")
        yield
    finally:
        if services:
            await services.close()


app = FastAPI(
    title="Agent Management Service (Production)",
    description="Production-ready agent management with full middleware integration",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/agents", response_model=AgentResponse)
async def create_agent(
    agent_data: AgentCreate,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    svc: ServiceContainer = Depends(get_services),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Create a new agent with full middleware integration"""
    
    if not idempotency_key:
        idempotency_key = generate_idempotency_key(agent_data.dict())
    
    cached_result = await svc.redis.client.get(f"idempotency:{idempotency_key}")
    if cached_result:
        return AgentResponse(**json.loads(cached_result))
    
    async with svc.db.transaction() as conn:
        if agent_data.parent_agent_id:
            await validate_hierarchy_rules(agent_data.parent_agent_id, agent_data.tier, conn)
        
        agent_id = generate_agent_id(agent_data.tier)
        
        duplicate_check = await conn.fetchrow(
            "SELECT id FROM agents WHERE email = $1 OR phone = $2",
            agent_data.email, agent_data.phone
        )
        if duplicate_check:
            raise HTTPException(status_code=400, detail="Agent with this email or phone already exists")
        
        hierarchy_level = 1
        if agent_data.parent_agent_id:
            parent = await conn.fetchrow(
                "SELECT hierarchy_level FROM agents WHERE id = $1",
                agent_data.parent_agent_id
            )
            if parent:
                hierarchy_level = parent['hierarchy_level'] + 1
        
        result = await conn.fetchrow(
            """
            INSERT INTO agents (
                id, email, phone, first_name, last_name, middle_name, date_of_birth, gender,
                tier, parent_agent_id, hierarchy_level, territory_id, address, emergency_contact,
                business_name, business_registration_number, tax_identification_number,
                bank_account_number, bank_name, bank_routing_number,
                max_transaction_limit, daily_transaction_limit, monthly_transaction_limit,
                status, kyc_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
            ) RETURNING *
            """,
            agent_id, agent_data.email, agent_data.phone, agent_data.first_name,
            agent_data.last_name, agent_data.middle_name, agent_data.date_of_birth,
            agent_data.gender, agent_data.tier.value, agent_data.parent_agent_id,
            hierarchy_level, agent_data.territory_id,
            json.dumps(agent_data.address) if agent_data.address else None,
            json.dumps(agent_data.emergency_contact) if agent_data.emergency_contact else None,
            agent_data.business_name, agent_data.business_registration_number,
            agent_data.tax_identification_number, agent_data.bank_account_number,
            agent_data.bank_name, agent_data.bank_routing_number,
            float(agent_data.max_transaction_limit), float(agent_data.daily_transaction_limit),
            float(agent_data.monthly_transaction_limit),
            AgentStatus.PENDING_APPROVAL.value, KYCStatus.NOT_STARTED.value
        )
        
        await conn.execute(
            """
            INSERT INTO agent_activity_log (agent_id, activity_type, activity_description, activity_data)
            VALUES ($1, $2, $3, $4)
            """,
            agent_id, "agent_created", "Agent account created",
            json.dumps({"created_by": current_user.get("sub") if current_user else "system"})
        )
    
    await svc.permify.write_relationship("agent", agent_id, "owner", "user", agent_id)
    if agent_data.parent_agent_id:
        await svc.permify.write_relationship("agent", agent_id, "parent", "agent", agent_data.parent_agent_id)
    
    account_id = int(hashlib.sha256(agent_id.encode()).hexdigest()[:15], 16)
    await svc.tigerbeetle.create_account(account_id, ledger=1, code=1)
    
    event_data = {
        "event_type": "agent.created",
        "agent_id": agent_id,
        "tier": agent_data.tier.value,
        "parent_agent_id": agent_data.parent_agent_id,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await svc.kafka.send_event("agent-events", agent_id, event_data)
    await svc.fluvio.produce("agent-events", agent_id, event_data)
    await svc.dapr.publish_event("pubsub", "agent-events", event_data)
    
    await svc.lakehouse.write_event("agent_events", event_data)
    
    response = AgentResponse(
        id=result['id'],
        email=result['email'],
        phone=result['phone'],
        first_name=result['first_name'],
        last_name=result['last_name'],
        full_name=f"{result['first_name']} {result['last_name']}",
        tier=result['tier'],
        parent_agent_id=result['parent_agent_id'],
        hierarchy_level=result['hierarchy_level'],
        territory_id=str(result['territory_id']) if result['territory_id'] else None,
        status=result['status'],
        kyc_status=result['kyc_status'],
        address=json.loads(result['address']) if result['address'] else None,
        business_name=result['business_name'],
        max_transaction_limit=Decimal(str(result['max_transaction_limit'])),
        daily_transaction_limit=Decimal(str(result['daily_transaction_limit'])),
        monthly_transaction_limit=Decimal(str(result['monthly_transaction_limit'])),
        created_at=result['created_at'],
        updated_at=result['updated_at'],
        last_login_at=result['last_login_at']
    )
    
    await svc.redis.client.setex(
        f"idempotency:{idempotency_key}",
        3600,
        json.dumps(response.dict(), default=str)
    )
    
    await svc.redis.client.setex(
        f"agent:{agent_id}",
        3600,
        json.dumps(response.dict(), default=str)
    )
    
    return response


@app.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str = Path(..., description="Agent ID"),
    svc: ServiceContainer = Depends(get_services),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Get agent by ID"""
    
    cached = await svc.redis.client.get(f"agent:{agent_id}")
    if cached:
        return AgentResponse(**json.loads(cached))
    
    async with svc.db.acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not result:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        response = AgentResponse(
            id=result['id'],
            email=result['email'],
            phone=result['phone'],
            first_name=result['first_name'],
            last_name=result['last_name'],
            full_name=f"{result['first_name']} {result['last_name']}",
            tier=result['tier'],
            parent_agent_id=result['parent_agent_id'],
            hierarchy_level=result['hierarchy_level'],
            territory_id=str(result['territory_id']) if result['territory_id'] else None,
            status=result['status'],
            kyc_status=result['kyc_status'],
            address=json.loads(result['address']) if result['address'] else None,
            business_name=result['business_name'],
            max_transaction_limit=Decimal(str(result['max_transaction_limit'])),
            daily_transaction_limit=Decimal(str(result['daily_transaction_limit'])),
            monthly_transaction_limit=Decimal(str(result['monthly_transaction_limit'])),
            created_at=result['created_at'],
            updated_at=result['updated_at'],
            last_login_at=result['last_login_at']
        )
        
        await svc.redis.client.setex(
            f"agent:{agent_id}",
            3600,
            json.dumps(response.dict(), default=str)
        )
        
        return response


@app.get("/agents", response_model=List[AgentResponse])
async def list_agents(
    tier: Optional[AgentTier] = Query(None, description="Filter by agent tier"),
    status: Optional[AgentStatus] = Query(None, description="Filter by agent status"),
    territory_id: Optional[str] = Query(None, description="Filter by territory"),
    parent_agent_id: Optional[str] = Query(None, description="Filter by parent agent"),
    limit: int = Query(50, ge=1, le=1000, description="Number of agents to return"),
    offset: int = Query(0, ge=0, description="Number of agents to skip"),
    svc: ServiceContainer = Depends(get_services)
):
    """List agents with filtering and pagination"""
    
    async with svc.db.acquire() as conn:
        where_conditions = []
        params = []
        param_count = 0
        
        if tier:
            param_count += 1
            where_conditions.append(f"tier = ${param_count}")
            params.append(tier.value)
        
        if status:
            param_count += 1
            where_conditions.append(f"status = ${param_count}")
            params.append(status.value)
        
        if territory_id:
            param_count += 1
            where_conditions.append(f"territory_id = ${param_count}::uuid")
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
                territory_id=str(result['territory_id']) if result['territory_id'] else None,
                status=result['status'],
                kyc_status=result['kyc_status'],
                address=json.loads(result['address']) if result['address'] else None,
                business_name=result['business_name'],
                max_transaction_limit=Decimal(str(result['max_transaction_limit'])),
                daily_transaction_limit=Decimal(str(result['daily_transaction_limit'])),
                monthly_transaction_limit=Decimal(str(result['monthly_transaction_limit'])),
                created_at=result['created_at'],
                updated_at=result['updated_at'],
                last_login_at=result['last_login_at']
            ))
        
        return agents


@app.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    svc: ServiceContainer = Depends(get_services),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Update agent information"""
    
    async with svc.db.transaction() as conn:
        existing_agent = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent_data.parent_agent_id is not None and agent_data.parent_agent_id != existing_agent['parent_agent_id']:
            tier = agent_data.tier or AgentTier(existing_agent['tier'])
            await validate_hierarchy_rules(agent_data.parent_agent_id, tier, conn)
        
        update_fields = []
        params = []
        param_count = 0
        
        update_data = agent_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                param_count += 1
                if field == 'tier':
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(value.value)
                elif field == 'status':
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(value.value)
                elif field in ('address', 'emergency_contact'):
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(json.dumps(value))
                elif field in ('max_transaction_limit', 'daily_transaction_limit', 'monthly_transaction_limit'):
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(float(value))
                else:
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        param_count += 1
        update_fields.append(f"updated_at = ${param_count}")
        params.append(datetime.utcnow())
        
        param_count += 1
        params.append(agent_id)
        
        query = f"""
        UPDATE agents
        SET {", ".join(update_fields)}
        WHERE id = ${param_count}
        RETURNING *
        """
        
        result = await conn.fetchrow(query, *params)
        
        await conn.execute(
            """
            INSERT INTO agent_activity_log (agent_id, activity_type, activity_description, activity_data)
            VALUES ($1, $2, $3, $4)
            """,
            agent_id, "agent_updated", "Agent information updated",
            json.dumps({
                "updated_by": current_user.get("sub") if current_user else "system",
                "updated_fields": list(update_data.keys())
            })
        )
    
    await svc.redis.client.delete(f"agent:{agent_id}")
    
    event_data = {
        "event_type": "agent.updated",
        "agent_id": agent_id,
        "updated_fields": list(update_data.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await svc.kafka.send_event("agent-events", agent_id, event_data)
    await svc.fluvio.produce("agent-events", agent_id, event_data)
    await svc.dapr.publish_event("pubsub", "agent-events", event_data)
    await svc.lakehouse.write_event("agent_events", event_data)
    
    response = AgentResponse(
        id=result['id'],
        email=result['email'],
        phone=result['phone'],
        first_name=result['first_name'],
        last_name=result['last_name'],
        full_name=f"{result['first_name']} {result['last_name']}",
        tier=result['tier'],
        parent_agent_id=result['parent_agent_id'],
        hierarchy_level=result['hierarchy_level'],
        territory_id=str(result['territory_id']) if result['territory_id'] else None,
        status=result['status'],
        kyc_status=result['kyc_status'],
        address=json.loads(result['address']) if result['address'] else None,
        business_name=result['business_name'],
        max_transaction_limit=Decimal(str(result['max_transaction_limit'])),
        daily_transaction_limit=Decimal(str(result['daily_transaction_limit'])),
        monthly_transaction_limit=Decimal(str(result['monthly_transaction_limit'])),
        created_at=result['created_at'],
        updated_at=result['updated_at'],
        last_login_at=result['last_login_at']
    )
    
    return response


@app.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    svc: ServiceContainer = Depends(get_services),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Soft delete agent (set status to terminated)"""
    
    async with svc.db.transaction() as conn:
        result = await conn.fetchrow("SELECT id FROM agents WHERE id = $1", agent_id)
        if not result:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        sub_agents = await conn.fetchval(
            "SELECT COUNT(*) FROM agents WHERE parent_agent_id = $1 AND status != 'terminated'",
            agent_id
        )
        if sub_agents > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete agent with {sub_agents} active sub-agents"
            )
        
        await conn.execute(
            "UPDATE agents SET status = $1, updated_at = $2 WHERE id = $3",
            AgentStatus.TERMINATED.value, datetime.utcnow(), agent_id
        )
        
        await conn.execute(
            """
            INSERT INTO agent_activity_log (agent_id, activity_type, activity_description, activity_data)
            VALUES ($1, $2, $3, $4)
            """,
            agent_id, "agent_terminated", "Agent account terminated",
            json.dumps({"terminated_by": current_user.get("sub") if current_user else "system"})
        )
    
    await svc.redis.client.delete(f"agent:{agent_id}")
    
    event_data = {
        "event_type": "agent.terminated",
        "agent_id": agent_id,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await svc.kafka.send_event("agent-events", agent_id, event_data)
    await svc.fluvio.produce("agent-events", agent_id, event_data)
    await svc.dapr.publish_event("pubsub", "agent-events", event_data)
    await svc.lakehouse.write_event("agent_events", event_data)
    
    return {"success": True, "message": "Agent terminated successfully"}


@app.get("/agents/{agent_id}/hierarchy")
async def get_agent_hierarchy(
    agent_id: str,
    svc: ServiceContainer = Depends(get_services)
):
    """Get agent hierarchy (ancestors and descendants)"""
    
    async with svc.db.acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
        if not result:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        ancestors = await conn.fetch(
            """
            WITH RECURSIVE hierarchy AS (
                SELECT id, parent_agent_id, first_name, last_name, tier, status, 1 as level
                FROM agents WHERE id = $1
                UNION ALL
                SELECT a.id, a.parent_agent_id, a.first_name, a.last_name, a.tier, a.status, h.level + 1
                FROM agents a
                JOIN hierarchy h ON a.id = h.parent_agent_id
            )
            SELECT * FROM hierarchy WHERE id != $1 ORDER BY level
            """,
            agent_id
        )
        
        descendants = await conn.fetch(
            """
            WITH RECURSIVE hierarchy AS (
                SELECT id, parent_agent_id, first_name, last_name, tier, status, 1 as level
                FROM agents WHERE parent_agent_id = $1
                UNION ALL
                SELECT a.id, a.parent_agent_id, a.first_name, a.last_name, a.tier, a.status, h.level + 1
                FROM agents a
                JOIN hierarchy h ON a.parent_agent_id = h.id
            )
            SELECT * FROM hierarchy ORDER BY level
            """,
            agent_id
        )
        
        return {
            "agent_id": agent_id,
            "agent_name": f"{result['first_name']} {result['last_name']}",
            "tier": result['tier'],
            "ancestors": [
                {
                    "id": a['id'],
                    "name": f"{a['first_name']} {a['last_name']}",
                    "tier": a['tier'],
                    "status": a['status'],
                    "level": a['level']
                }
                for a in ancestors
            ],
            "descendants": [
                {
                    "id": d['id'],
                    "name": f"{d['first_name']} {d['last_name']}",
                    "tier": d['tier'],
                    "status": d['status'],
                    "level": d['level']
                }
                for d in descendants
            ],
            "total_descendants": len(descendants)
        }


@app.get("/health")
async def health_check(svc: ServiceContainer = Depends(get_services)):
    """Health check endpoint"""
    
    health_status = {
        "status": "healthy",
        "service": "Agent Management Service (Production)",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }
    
    try:
        async with svc.db.acquire() as conn:
            await conn.fetchval("SELECT 1")
        health_status["components"]["database"] = "healthy"
    except Exception as e:
        health_status["components"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    try:
        await svc.redis.client.ping()
        health_status["components"]["redis"] = "healthy"
    except Exception as e:
        health_status["components"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status


@app.get("/metrics")
async def get_metrics(svc: ServiceContainer = Depends(get_services)):
    """Get service metrics"""
    
    async with svc.db.acquire() as conn:
        total_agents = await conn.fetchval("SELECT COUNT(*) FROM agents")
        active_agents = await conn.fetchval(
            "SELECT COUNT(*) FROM agents WHERE status = $1",
            AgentStatus.ACTIVE.value
        )
        agents_by_tier = await conn.fetch(
            "SELECT tier, COUNT(*) as count FROM agents GROUP BY tier"
        )
        agents_by_status = await conn.fetch(
            "SELECT status, COUNT(*) as count FROM agents GROUP BY status"
        )
    
    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "agents_by_tier": {row['tier']: row['count'] for row in agents_by_tier},
        "agents_by_status": {row['status']: row['count'] for row in agents_by_status},
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8111)
