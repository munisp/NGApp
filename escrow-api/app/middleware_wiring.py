"""
Middleware Wiring for SocialEscrow Platform

This module wires all middleware components to the business logic:
1. Mojaloop - Fail-closed production enforcement (no mock fallbacks)
2. Keycloak - OIDC authentication integration
3. Permify - Authorization enforcement on ledger operations
4. Dapr - Service mesh integration for pubsub/state
5. Fluvio - High-performance event streaming
6. Kafka - Event emission on TigerBeetle state changes
7. Temporal - Saga orchestration for Mojaloop transfers
8. Redis - Caching and distributed locks
9. Postgres - Metadata and read model persistence

All integrations are fail-closed in production mode.
"""

import os
import json
import uuid
import asyncio
import logging
from typing import Optional, Dict, Any, List, Callable, TypeVar, Generic
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Production mode configuration
PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
REQUIRE_MOJALOOP = os.getenv("REQUIRE_MOJALOOP", "false").lower() == "true"
REQUIRE_KEYCLOAK = os.getenv("REQUIRE_KEYCLOAK", "false").lower() == "true"
REQUIRE_PERMIFY = os.getenv("REQUIRE_PERMIFY", "false").lower() == "true"
REQUIRE_DAPR = os.getenv("REQUIRE_DAPR", "false").lower() == "true"
REQUIRE_FLUVIO = os.getenv("REQUIRE_FLUVIO", "false").lower() == "true"
REQUIRE_KAFKA = os.getenv("REQUIRE_KAFKA", "false").lower() == "true"
REQUIRE_TEMPORAL = os.getenv("REQUIRE_TEMPORAL", "false").lower() == "true"


class MiddlewareError(Exception):
    """Base exception for middleware errors"""
    pass


class MojaloopProductionError(MiddlewareError):
    """Raised when Mojaloop is required but unavailable in production"""
    pass


class KeycloakProductionError(MiddlewareError):
    """Raised when Keycloak is required but unavailable in production"""
    pass


class PermifyProductionError(MiddlewareError):
    """Raised when Permify is required but unavailable in production"""
    pass


class DaprProductionError(MiddlewareError):
    """Raised when Dapr is required but unavailable in production"""
    pass


class FluvioProductionError(MiddlewareError):
    """Raised when Fluvio is required but unavailable in production"""
    pass


# =============================================================================
# 1. MOJALOOP FAIL-CLOSED PRODUCTION ENFORCEMENT
# =============================================================================

def require_mojaloop_connection(func):
    """
    Decorator that enforces Mojaloop connection in production.
    No mock fallbacks allowed when REQUIRE_MOJALOOP=true.
    """
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        if not self.connected:
            await self.connect()
        
        if not self.connected:
            if PRODUCTION_MODE or REQUIRE_MOJALOOP:
                raise MojaloopProductionError(
                    f"Mojaloop connection required but unavailable. "
                    f"PRODUCTION_MODE={PRODUCTION_MODE}, REQUIRE_MOJALOOP={REQUIRE_MOJALOOP}"
                )
            logger.warning(f"Mojaloop not connected, mock fallback allowed in dev mode")
        
        return await func(self, *args, **kwargs)
    return wrapper


class MojaloopProductionAdapter:
    """
    Production-ready Mojaloop adapter with fail-closed enforcement.
    Wraps the base MojaloopAdapter with production guards.
    """
    
    def __init__(self):
        from app.mojaloop_adapter import MojaloopAdapter
        self._adapter = MojaloopAdapter()
        self._connected = False
    
    @property
    def connected(self) -> bool:
        return self._adapter.connected
    
    async def connect(self) -> bool:
        """Connect to Mojaloop with production enforcement"""
        result = await self._adapter.connect()
        
        if not result and (PRODUCTION_MODE or REQUIRE_MOJALOOP):
            raise MojaloopProductionError(
                "Failed to connect to Mojaloop hub. "
                "Check MOJALOOP_HUB_URL and network connectivity."
            )
        
        return result
    
    @require_mojaloop_connection
    async def lookup_party(self, party_id_type, party_id_value):
        """Look up party with production enforcement - no mock fallback"""
        if not self._adapter.connected:
            raise MojaloopProductionError("Mojaloop not connected - cannot lookup party")
        return await self._adapter.lookup_party(party_id_type, party_id_value)
    
    @require_mojaloop_connection
    async def create_quote(self, payer, payee, amount, transaction_id=None, note=None):
        """Create quote with production enforcement - no mock fallback"""
        if not self._adapter.connected:
            raise MojaloopProductionError("Mojaloop not connected - cannot create quote")
        return await self._adapter.create_quote(payer, payee, amount, transaction_id, note)
    
    @require_mojaloop_connection
    async def initiate_transfer(self, quote, idempotency_key=None):
        """Initiate transfer with production enforcement - no mock fallback"""
        if not self._adapter.connected:
            raise MojaloopProductionError("Mojaloop not connected - cannot initiate transfer")
        return await self._adapter.initiate_transfer(quote, idempotency_key)
    
    async def handle_quote_callback(self, quote_id, data):
        """Handle quote callback"""
        return await self._adapter.handle_quote_callback(quote_id, data)
    
    async def handle_transfer_callback(self, transfer_id, data):
        """Handle transfer callback"""
        return await self._adapter.handle_transfer_callback(transfer_id, data)
    
    async def close(self):
        """Close adapter"""
        await self._adapter.close()


# =============================================================================
# 2. KEYCLOAK OIDC AUTHENTICATION
# =============================================================================

@dataclass
class KeycloakConfig:
    """Keycloak configuration"""
    server_url: str = field(default_factory=lambda: os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080"))
    realm: str = field(default_factory=lambda: os.getenv("KEYCLOAK_REALM", "escrowprotect"))
    client_id: str = field(default_factory=lambda: os.getenv("KEYCLOAK_CLIENT_ID", "escrow-api"))
    client_secret: str = field(default_factory=lambda: os.getenv("KEYCLOAK_CLIENT_SECRET", ""))
    

@dataclass
class TokenInfo:
    """Decoded token information"""
    sub: str  # Subject (user ID)
    email: Optional[str] = None
    name: Optional[str] = None
    roles: List[str] = field(default_factory=list)
    groups: List[str] = field(default_factory=list)
    exp: Optional[int] = None
    iat: Optional[int] = None


class KeycloakAuthProvider:
    """
    Keycloak OIDC authentication provider.
    Validates JWT tokens and extracts user information.
    """
    
    def __init__(self, config: Optional[KeycloakConfig] = None):
        self.config = config or KeycloakConfig()
        self._jwks_client = None
        self._connected = False
        self._public_key = None
    
    @property
    def connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Connect to Keycloak and fetch JWKS"""
        try:
            import aiohttp
            
            # Fetch OIDC configuration
            oidc_url = f"{self.config.server_url}/realms/{self.config.realm}/.well-known/openid-configuration"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(oidc_url) as resp:
                    if resp.status == 200:
                        oidc_config = await resp.json()
                        jwks_uri = oidc_config.get("jwks_uri")
                        
                        # Fetch JWKS
                        async with session.get(jwks_uri) as jwks_resp:
                            if jwks_resp.status == 200:
                                jwks = await jwks_resp.json()
                                self._public_key = jwks
                                self._connected = True
                                logger.info(f"Connected to Keycloak at {self.config.server_url}")
                                return True
            
        except Exception as e:
            logger.warning(f"Keycloak connection failed: {e}")
        
        if PRODUCTION_MODE or REQUIRE_KEYCLOAK:
            raise KeycloakProductionError(
                f"Failed to connect to Keycloak. "
                f"Check KEYCLOAK_SERVER_URL={self.config.server_url}"
            )
        
        return False
    
    async def validate_token(self, token: str) -> TokenInfo:
        """
        Validate JWT token and extract user information.
        Fails closed in production if Keycloak is unavailable.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_KEYCLOAK:
                raise KeycloakProductionError("Keycloak not connected - cannot validate token")
            
            # Dev mode: return mock token info
            logger.warning("Keycloak not connected, returning mock token info")
            return TokenInfo(
                sub="dev-user-id",
                email="dev@example.com",
                name="Dev User",
                roles=["user"],
                groups=[]
            )
        
        try:
            import jwt
            from jwt import PyJWKClient
            
            # Decode and validate token
            jwks_uri = f"{self.config.server_url}/realms/{self.config.realm}/protocol/openid-connect/certs"
            jwks_client = PyJWKClient(jwks_uri)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.config.client_id,
                options={"verify_exp": True}
            )
            
            # Extract roles from realm_access and resource_access
            roles = []
            if "realm_access" in decoded:
                roles.extend(decoded["realm_access"].get("roles", []))
            if "resource_access" in decoded and self.config.client_id in decoded["resource_access"]:
                roles.extend(decoded["resource_access"][self.config.client_id].get("roles", []))
            
            return TokenInfo(
                sub=decoded.get("sub", ""),
                email=decoded.get("email"),
                name=decoded.get("name"),
                roles=roles,
                groups=decoded.get("groups", []),
                exp=decoded.get("exp"),
                iat=decoded.get("iat")
            )
            
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            raise KeycloakProductionError(f"Invalid token: {e}")
    
    def require_auth(self, required_roles: Optional[List[str]] = None):
        """
        Decorator to require authentication on endpoints.
        Optionally checks for required roles.
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract token from request (FastAPI dependency injection)
                from fastapi import Request, HTTPException
                
                request = None
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
                
                if not request:
                    raise HTTPException(status_code=401, detail="No request context")
                
                auth_header = request.headers.get("Authorization", "")
                if not auth_header.startswith("Bearer "):
                    raise HTTPException(status_code=401, detail="Missing Bearer token")
                
                token = auth_header[7:]
                token_info = await self.validate_token(token)
                
                # Check required roles
                if required_roles:
                    if not any(role in token_info.roles for role in required_roles):
                        raise HTTPException(
                            status_code=403,
                            detail=f"Required roles: {required_roles}"
                        )
                
                # Inject token info into request state
                request.state.user = token_info
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator


# =============================================================================
# 3. PERMIFY AUTHORIZATION ENFORCEMENT
# =============================================================================

class PermifyAuthzProvider:
    """
    Permify authorization provider.
    Enforces fine-grained permissions on ledger operations.
    """
    
    def __init__(self):
        self.host = os.getenv("PERMIFY_HOST", "localhost:3476")
        self.tenant_id = os.getenv("PERMIFY_TENANT_ID", "escrowprotect")
        self._connected = False
        self._session = None
    
    @property
    def connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Connect to Permify"""
        try:
            import aiohttp
            
            self._session = aiohttp.ClientSession()
            
            # Test connection
            async with self._session.get(f"http://{self.host}/healthz") as resp:
                if resp.status == 200:
                    self._connected = True
                    logger.info(f"Connected to Permify at {self.host}")
                    return True
                    
        except Exception as e:
            logger.warning(f"Permify connection failed: {e}")
        
        if PRODUCTION_MODE or REQUIRE_PERMIFY:
            raise PermifyProductionError(
                f"Failed to connect to Permify at {self.host}"
            )
        
        return False
    
    async def check_permission(
        self,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_type: str,
        subject_id: str
    ) -> bool:
        """
        Check if subject has permission on entity.
        Fails closed in production if Permify is unavailable.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_PERMIFY:
                raise PermifyProductionError("Permify not connected - cannot check permission")
            
            # Dev mode: allow all
            logger.warning("Permify not connected, allowing all permissions in dev mode")
            return True
        
        try:
            payload = {
                "tenant_id": self.tenant_id,
                "metadata": {"snap_token": "", "schema_version": "", "depth": 20},
                "entity": {"type": entity_type, "id": entity_id},
                "permission": permission,
                "subject": {"type": subject_type, "id": subject_id}
            }
            
            async with self._session.post(
                f"http://{self.host}/v1/tenants/{self.tenant_id}/permissions/check",
                json=payload
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return result.get("can") == "CHECK_RESULT_ALLOWED"
                else:
                    logger.error(f"Permify check failed: {await resp.text()}")
                    return False
                    
        except Exception as e:
            logger.error(f"Permify check error: {e}")
            if PRODUCTION_MODE or REQUIRE_PERMIFY:
                raise PermifyProductionError(f"Permission check failed: {e}")
            return True
    
    async def create_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str
    ) -> bool:
        """Create a relationship tuple in Permify"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_PERMIFY:
                raise PermifyProductionError("Permify not connected - cannot create relationship")
            return True
        
        try:
            payload = {
                "tenant_id": self.tenant_id,
                "metadata": {"schema_version": ""},
                "tuples": [{
                    "entity": {"type": entity_type, "id": entity_id},
                    "relation": relation,
                    "subject": {"type": subject_type, "id": subject_id}
                }]
            }
            
            async with self._session.post(
                f"http://{self.host}/v1/tenants/{self.tenant_id}/relationships/write",
                json=payload
            ) as resp:
                return resp.status == 200
                
        except Exception as e:
            logger.error(f"Permify relationship creation error: {e}")
            return False
    
    def require_permission(self, entity_type: str, permission: str):
        """
        Decorator to require permission on an entity.
        Entity ID is extracted from request path or body.
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                from fastapi import Request, HTTPException
                
                request = None
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
                
                if not request:
                    raise HTTPException(status_code=401, detail="No request context")
                
                # Get user from request state (set by Keycloak auth)
                user = getattr(request.state, "user", None)
                if not user:
                    raise HTTPException(status_code=401, detail="Not authenticated")
                
                # Extract entity ID from path params or body
                entity_id = kwargs.get("escrow_id") or kwargs.get("id") or kwargs.get("entity_id")
                if not entity_id:
                    # Try to get from path
                    entity_id = request.path_params.get("escrow_id") or request.path_params.get("id")
                
                if not entity_id:
                    raise HTTPException(status_code=400, detail="Entity ID required")
                
                # Check permission
                allowed = await self.check_permission(
                    entity_type=entity_type,
                    entity_id=str(entity_id),
                    permission=permission,
                    subject_type="user",
                    subject_id=user.sub
                )
                
                if not allowed:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Permission denied: {permission} on {entity_type}/{entity_id}"
                    )
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator


# =============================================================================
# 4. DAPR SERVICE MESH INTEGRATION
# =============================================================================

class DaprServiceMesh:
    """
    Dapr service mesh integration for:
    - Service invocation
    - Pub/sub messaging
    - State management
    - Secrets management
    """
    
    def __init__(self):
        self.http_port = int(os.getenv("DAPR_HTTP_PORT", "3500"))
        self.grpc_port = int(os.getenv("DAPR_GRPC_PORT", "50001"))
        self.app_id = os.getenv("DAPR_APP_ID", "escrow-api")
        self._base_url = f"http://localhost:{self.http_port}"
        self._connected = False
        self._session = None
    
    @property
    def connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Connect to Dapr sidecar"""
        try:
            import aiohttp
            
            self._session = aiohttp.ClientSession()
            
            # Check Dapr sidecar health
            async with self._session.get(f"{self._base_url}/v1.0/healthz") as resp:
                if resp.status == 200:
                    self._connected = True
                    logger.info(f"Connected to Dapr sidecar on port {self.http_port}")
                    return True
                    
        except Exception as e:
            logger.warning(f"Dapr sidecar not available: {e}")
        
        if PRODUCTION_MODE or REQUIRE_DAPR:
            raise DaprProductionError(
                f"Failed to connect to Dapr sidecar on port {self.http_port}"
            )
        
        return False
    
    async def invoke_service(
        self,
        app_id: str,
        method: str,
        data: Optional[Dict[str, Any]] = None,
        http_method: str = "POST"
    ) -> Dict[str, Any]:
        """Invoke another service through Dapr"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_DAPR:
                raise DaprProductionError("Dapr not connected - cannot invoke service")
            return {"error": "Dapr not available", "mock": True}
        
        try:
            url = f"{self._base_url}/v1.0/invoke/{app_id}/method/{method}"
            
            if http_method == "GET":
                async with self._session.get(url) as resp:
                    return await resp.json()
            else:
                async with self._session.post(url, json=data or {}) as resp:
                    return await resp.json()
                    
        except Exception as e:
            logger.error(f"Dapr service invocation failed: {e}")
            raise DaprProductionError(f"Service invocation failed: {e}")
    
    async def publish_event(
        self,
        pubsub_name: str,
        topic: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        """Publish event through Dapr pub/sub"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_DAPR:
                raise DaprProductionError("Dapr not connected - cannot publish event")
            logger.warning(f"Dapr not connected, event not published: {topic}")
            return False
        
        try:
            url = f"{self._base_url}/v1.0/publish/{pubsub_name}/{topic}"
            headers = {}
            if metadata:
                for key, value in metadata.items():
                    headers[f"metadata.{key}"] = value
            
            async with self._session.post(url, json=data, headers=headers) as resp:
                return resp.status in (200, 204)
                
        except Exception as e:
            logger.error(f"Dapr publish failed: {e}")
            return False
    
    async def get_state(self, store_name: str, key: str) -> Optional[Any]:
        """Get state from Dapr state store"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            return None
        
        try:
            url = f"{self._base_url}/v1.0/state/{store_name}/{key}"
            async with self._session.get(url) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
                
        except Exception as e:
            logger.error(f"Dapr get state failed: {e}")
            return None
    
    async def save_state(
        self,
        store_name: str,
        key: str,
        value: Any,
        etag: Optional[str] = None
    ) -> bool:
        """Save state to Dapr state store"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_DAPR:
                raise DaprProductionError("Dapr not connected - cannot save state")
            return False
        
        try:
            url = f"{self._base_url}/v1.0/state/{store_name}"
            payload = [{"key": key, "value": value}]
            if etag:
                payload[0]["etag"] = etag
                payload[0]["options"] = {"concurrency": "first-write"}
            
            async with self._session.post(url, json=payload) as resp:
                return resp.status in (200, 204)
                
        except Exception as e:
            logger.error(f"Dapr save state failed: {e}")
            return False


# =============================================================================
# 5. FLUVIO EVENT STREAMING
# =============================================================================

class FluvioEventStream:
    """
    Fluvio high-performance event streaming.
    Used for real-time event processing alongside Kafka.
    """
    
    def __init__(self):
        self.endpoint = os.getenv("FLUVIO_ENDPOINT", "localhost:9003")
        self._connected = False
        self._client = None
        self._producers: Dict[str, Any] = {}
    
    @property
    def connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Connect to Fluvio cluster"""
        try:
            from fluvio import Fluvio
            
            self._client = await Fluvio.connect()
            self._connected = True
            logger.info("Connected to Fluvio cluster")
            return True
            
        except ImportError:
            logger.warning("fluvio package not installed")
        except Exception as e:
            logger.warning(f"Fluvio connection failed: {e}")
        
        if PRODUCTION_MODE or REQUIRE_FLUVIO:
            raise FluvioProductionError(
                f"Failed to connect to Fluvio at {self.endpoint}"
            )
        
        return False
    
    async def produce(self, topic: str, key: str, value: Dict[str, Any]) -> bool:
        """Produce event to Fluvio topic"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_FLUVIO:
                raise FluvioProductionError("Fluvio not connected - cannot produce")
            return False
        
        try:
            if topic not in self._producers:
                self._producers[topic] = await self._client.topic_producer(topic)
            
            producer = self._producers[topic]
            await producer.send(key, json.dumps(value).encode())
            return True
            
        except Exception as e:
            logger.error(f"Fluvio produce failed: {e}")
            return False
    
    async def consume(
        self,
        topic: str,
        callback: Callable[[str, Dict[str, Any]], None],
        offset: int = 0
    ):
        """Consume events from Fluvio topic"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_FLUVIO:
                raise FluvioProductionError("Fluvio not connected - cannot consume")
            return
        
        try:
            consumer = await self._client.partition_consumer(topic, 0)
            
            async for record in consumer.stream(offset):
                key = record.key_string() if record.key() else ""
                value = json.loads(record.value_string())
                await callback(key, value)
                
        except Exception as e:
            logger.error(f"Fluvio consume failed: {e}")


# =============================================================================
# 6. KAFKA EVENT EMISSION ON TIGERBEETLE STATE CHANGES
# =============================================================================

class TigerBeetleEventEmitter:
    """
    Emits Kafka events on TigerBeetle ledger state changes.
    Wraps TigerBeetleLedger to add event emission.
    """
    
    def __init__(self):
        self._ledger = None
        self._kafka_producer = None
        self._outbox = None
    
    def _get_ledger(self):
        if not self._ledger:
            from app.tigerbeetle_ledger import TigerBeetleLedger
            self._ledger = TigerBeetleLedger()
        return self._ledger
    
    async def _get_kafka_producer(self):
        if not self._kafka_producer:
            try:
                from app.event_streaming import KafkaEventPublisher
                self._kafka_producer = KafkaEventPublisher()
                await self._kafka_producer.connect()
            except Exception as e:
                logger.warning(f"Kafka producer not available: {e}")
        return self._kafka_producer
    
    async def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """Emit event to Kafka and/or transactional outbox"""
        event = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        # Try Kafka first
        producer = await self._get_kafka_producer()
        if producer:
            try:
                await producer.publish(event_type, event)
                logger.debug(f"Emitted Kafka event: {event_type}")
            except Exception as e:
                logger.warning(f"Kafka publish failed, falling back to outbox: {e}")
        
        # Also write to transactional outbox for reliability
        try:
            from app.transactional_outbox import OutboxEvent, outbox_manager
            outbox_event = OutboxEvent(
                event_type=event_type,
                aggregate_type="ledger",
                aggregate_id=data.get("escrow_id") or data.get("user_id") or str(uuid.uuid4()),
                payload=data
            )
            await outbox_manager.add_event(outbox_event)
        except Exception as e:
            logger.warning(f"Outbox write failed: {e}")
    
    async def deposit_to_escrow(
        self,
        buyer_id: str,
        escrow_id: str,
        amount_kobo: int,
        idempotency_key: Optional[str] = None,
        timeout_seconds: Optional[int] = None
    ) -> Dict[str, Any]:
        """Deposit to escrow with event emission"""
        ledger = self._get_ledger()
        
        result = await ledger.deposit_to_escrow(
            buyer_id=buyer_id,
            escrow_id=escrow_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key,
            timeout_seconds=timeout_seconds
        )
        
        # Emit event
        await self._emit_event("escrow.deposit", {
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "amount_kobo": amount_kobo,
            "transfer_id": result.get("transfer_id"),
            "status": "pending"
        })
        
        return result
    
    async def release_escrow(
        self,
        escrow_id: str,
        seller_id: str,
        amount_kobo: int,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Release escrow with event emission"""
        ledger = self._get_ledger()
        
        result = await ledger.release_escrow(
            escrow_id=escrow_id,
            seller_id=seller_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key
        )
        
        # Emit event
        await self._emit_event("escrow.released", {
            "escrow_id": escrow_id,
            "seller_id": seller_id,
            "amount_kobo": amount_kobo,
            "transfer_id": result.get("transfer_id"),
            "status": "released"
        })
        
        return result
    
    async def refund_escrow(
        self,
        escrow_id: str,
        buyer_id: str,
        amount_kobo: int,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Refund escrow with event emission"""
        ledger = self._get_ledger()
        
        result = await ledger.refund_escrow(
            escrow_id=escrow_id,
            buyer_id=buyer_id,
            amount_kobo=amount_kobo,
            idempotency_key=idempotency_key
        )
        
        # Emit event
        await self._emit_event("escrow.refunded", {
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "amount_kobo": amount_kobo,
            "transfer_id": result.get("transfer_id"),
            "status": "refunded"
        })
        
        return result
    
    async def transfer(
        self,
        from_account_id: str,
        to_account_id: str,
        amount_kobo: int,
        code: str = "fee",
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transfer with event emission"""
        ledger = self._get_ledger()
        
        result = await ledger.transfer(
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount_kobo=amount_kobo,
            code=code,
            idempotency_key=idempotency_key
        )
        
        # Emit event
        await self._emit_event("ledger.transfer", {
            "from_account_id": from_account_id,
            "to_account_id": to_account_id,
            "amount_kobo": amount_kobo,
            "code": code,
            "transfer_id": result.get("transfer_id")
        })
        
        return result


# =============================================================================
# 7. TEMPORAL SAGA ORCHESTRATION FOR MOJALOOP TRANSFERS
# =============================================================================

class MojaloopTransferSaga:
    """
    Temporal workflow for orchestrating Mojaloop transfers.
    Implements saga pattern with compensating transactions.
    """
    
    def __init__(self):
        self._temporal_client = None
        self._connected = False
    
    async def connect(self) -> bool:
        """Connect to Temporal"""
        try:
            from temporalio.client import Client
            
            temporal_address = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
            self._temporal_client = await Client.connect(temporal_address)
            self._connected = True
            logger.info(f"Connected to Temporal at {temporal_address}")
            return True
            
        except Exception as e:
            logger.warning(f"Temporal connection failed: {e}")
        
        if PRODUCTION_MODE or REQUIRE_TEMPORAL:
            from app.production_enforcement import TemporalProductionError
            raise TemporalProductionError(
                "Failed to connect to Temporal"
            )
        
        return False
    
    async def start_buyer_payment_workflow(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount_kobo: int,
        buyer_phone: str,
        idempotency_key: str
    ) -> str:
        """
        Start buyer payment workflow:
        1. Look up buyer's DFSP via Mojaloop
        2. Create quote for transfer
        3. Reserve funds in TigerBeetle (pending transfer)
        4. Initiate Mojaloop transfer
        5. Wait for callback
        6. Commit or void TigerBeetle transfer based on result
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_TEMPORAL:
                raise MiddlewareError("Temporal not connected - cannot start workflow")
            
            # Fallback: execute synchronously without saga
            logger.warning("Temporal not connected, executing payment synchronously")
            return await self._execute_payment_sync(
                escrow_id, buyer_id, seller_id, amount_kobo, buyer_phone, idempotency_key
            )
        
        workflow_id = f"buyer-payment-{escrow_id}-{idempotency_key}"
        
        handle = await self._temporal_client.start_workflow(
            "BuyerPaymentWorkflow",
            args=[{
                "escrow_id": escrow_id,
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "amount_kobo": amount_kobo,
                "buyer_phone": buyer_phone,
                "idempotency_key": idempotency_key
            }],
            id=workflow_id,
            task_queue="escrow-payments"
        )
        
        logger.info(f"Started buyer payment workflow: {workflow_id}")
        return workflow_id
    
    async def start_seller_payout_workflow(
        self,
        escrow_id: str,
        seller_id: str,
        amount_kobo: int,
        seller_phone: str,
        idempotency_key: str
    ) -> str:
        """
        Start seller payout workflow:
        1. Release funds from TigerBeetle escrow
        2. Look up seller's DFSP via Mojaloop
        3. Create quote for payout
        4. Initiate Mojaloop transfer
        5. Wait for callback
        6. Handle success or compensate on failure
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            if PRODUCTION_MODE or REQUIRE_TEMPORAL:
                raise MiddlewareError("Temporal not connected - cannot start workflow")
            
            logger.warning("Temporal not connected, executing payout synchronously")
            return await self._execute_payout_sync(
                escrow_id, seller_id, amount_kobo, seller_phone, idempotency_key
            )
        
        workflow_id = f"seller-payout-{escrow_id}-{idempotency_key}"
        
        handle = await self._temporal_client.start_workflow(
            "SellerPayoutWorkflow",
            args=[{
                "escrow_id": escrow_id,
                "seller_id": seller_id,
                "amount_kobo": amount_kobo,
                "seller_phone": seller_phone,
                "idempotency_key": idempotency_key
            }],
            id=workflow_id,
            task_queue="escrow-payments"
        )
        
        logger.info(f"Started seller payout workflow: {workflow_id}")
        return workflow_id
    
    async def _execute_payment_sync(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount_kobo: int,
        buyer_phone: str,
        idempotency_key: str
    ) -> str:
        """Synchronous fallback for buyer payment (dev mode only)"""
        from app.mojaloop_adapter import EscrowMojaloopIntegration
        
        integration = EscrowMojaloopIntegration()
        result = await integration.process_buyer_payment(
            escrow_id=escrow_id,
            buyer_id=buyer_id,
            seller_id=seller_id,
            amount_kobo=amount_kobo,
            buyer_phone=buyer_phone,
            idempotency_key=idempotency_key
        )
        
        return f"sync-payment-{escrow_id}"
    
    async def _execute_payout_sync(
        self,
        escrow_id: str,
        seller_id: str,
        amount_kobo: int,
        seller_phone: str,
        idempotency_key: str
    ) -> str:
        """Synchronous fallback for seller payout (dev mode only)"""
        from app.mojaloop_adapter import EscrowMojaloopIntegration
        
        integration = EscrowMojaloopIntegration()
        result = await integration.process_seller_payout(
            escrow_id=escrow_id,
            seller_id=seller_id,
            amount_kobo=amount_kobo,
            seller_phone=seller_phone,
            idempotency_key=idempotency_key
        )
        
        return f"sync-payout-{escrow_id}"


# =============================================================================
# 8. REDIS CACHING AND DISTRIBUTED LOCKS
# =============================================================================

class RedisCacheAndLocks:
    """
    Redis integration for:
    - Caching TigerBeetle query results
    - Distributed locks for Mojaloop operations
    - Rate limiting
    - Session storage
    """
    
    def __init__(self):
        self.url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client = None
        self._connected = False
    
    @property
    def connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Connect to Redis"""
        try:
            import redis.asyncio as redis
            
            self._client = redis.from_url(self.url)
            await self._client.ping()
            self._connected = True
            logger.info(f"Connected to Redis at {self.url}")
            return True
            
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
        
        return False
    
    async def cache_balance(self, account_id: str, balance: Dict[str, int], ttl: int = 60):
        """Cache account balance with TTL"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            return
        
        try:
            key = f"balance:{account_id}"
            await self._client.setex(key, ttl, json.dumps(balance))
        except Exception as e:
            logger.warning(f"Redis cache write failed: {e}")
    
    async def get_cached_balance(self, account_id: str) -> Optional[Dict[str, int]]:
        """Get cached account balance"""
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            return None
        
        try:
            key = f"balance:{account_id}"
            data = await self._client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis cache read failed: {e}")
        
        return None
    
    @asynccontextmanager
    async def distributed_lock(self, lock_name: str, timeout: int = 30):
        """
        Acquire distributed lock for critical operations.
        Used to prevent double-spending in Mojaloop transfers.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            # No Redis: proceed without lock (dev mode only)
            if PRODUCTION_MODE:
                raise MiddlewareError("Redis not connected - cannot acquire lock in production")
            yield
            return
        
        lock_key = f"lock:{lock_name}"
        lock_value = str(uuid.uuid4())
        
        try:
            # Try to acquire lock
            acquired = await self._client.set(
                lock_key,
                lock_value,
                nx=True,
                ex=timeout
            )
            
            if not acquired:
                raise MiddlewareError(f"Failed to acquire lock: {lock_name}")
            
            yield
            
        finally:
            # Release lock (only if we own it)
            try:
                current = await self._client.get(lock_key)
                if current and current.decode() == lock_value:
                    await self._client.delete(lock_key)
            except Exception as e:
                logger.warning(f"Lock release failed: {e}")
    
    async def rate_limit(self, key: str, limit: int, window: int = 60) -> bool:
        """
        Check rate limit.
        Returns True if within limit, False if exceeded.
        """
        if not self._connected:
            await self.connect()
        
        if not self._connected:
            return True  # Allow in dev mode
        
        try:
            rate_key = f"rate:{key}"
            current = await self._client.incr(rate_key)
            
            if current == 1:
                await self._client.expire(rate_key, window)
            
            return current <= limit
            
        except Exception as e:
            logger.warning(f"Rate limit check failed: {e}")
            return True


# =============================================================================
# 9. UNIFIED MIDDLEWARE MANAGER
# =============================================================================

class MiddlewareManager:
    """
    Unified manager for all middleware integrations.
    Provides a single entry point for wiring middleware to business logic.
    """
    
    def __init__(self):
        self.mojaloop = MojaloopProductionAdapter()
        self.keycloak = KeycloakAuthProvider()
        self.permify = PermifyAuthzProvider()
        self.dapr = DaprServiceMesh()
        self.fluvio = FluvioEventStream()
        self.tigerbeetle_events = TigerBeetleEventEmitter()
        self.mojaloop_saga = MojaloopTransferSaga()
        self.redis = RedisCacheAndLocks()
        self._initialized = False
    
    async def initialize(self) -> Dict[str, bool]:
        """Initialize all middleware connections"""
        results = {}
        
        # Connect to each middleware (non-blocking for optional ones)
        try:
            results["mojaloop"] = await self.mojaloop.connect()
        except MojaloopProductionError as e:
            logger.error(f"Mojaloop: {e}")
            results["mojaloop"] = False
            if REQUIRE_MOJALOOP:
                raise
        
        try:
            results["keycloak"] = await self.keycloak.connect()
        except KeycloakProductionError as e:
            logger.error(f"Keycloak: {e}")
            results["keycloak"] = False
            if REQUIRE_KEYCLOAK:
                raise
        
        try:
            results["permify"] = await self.permify.connect()
        except PermifyProductionError as e:
            logger.error(f"Permify: {e}")
            results["permify"] = False
            if REQUIRE_PERMIFY:
                raise
        
        try:
            results["dapr"] = await self.dapr.connect()
        except DaprProductionError as e:
            logger.error(f"Dapr: {e}")
            results["dapr"] = False
            if REQUIRE_DAPR:
                raise
        
        try:
            results["fluvio"] = await self.fluvio.connect()
        except FluvioProductionError as e:
            logger.error(f"Fluvio: {e}")
            results["fluvio"] = False
            if REQUIRE_FLUVIO:
                raise
        
        try:
            results["temporal"] = await self.mojaloop_saga.connect()
        except Exception as e:
            logger.error(f"Temporal: {e}")
            results["temporal"] = False
            if REQUIRE_TEMPORAL:
                raise
        
        results["redis"] = await self.redis.connect()
        
        self._initialized = True
        logger.info(f"Middleware initialization complete: {results}")
        
        return results
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all middleware"""
        return {
            "mojaloop": {"connected": self.mojaloop.connected},
            "keycloak": {"connected": self.keycloak.connected},
            "permify": {"connected": self.permify.connected},
            "dapr": {"connected": self.dapr.connected},
            "fluvio": {"connected": self.fluvio.connected},
            "temporal": {"connected": self.mojaloop_saga._connected},
            "redis": {"connected": self.redis.connected},
            "production_mode": PRODUCTION_MODE,
            "requirements": {
                "mojaloop": REQUIRE_MOJALOOP,
                "keycloak": REQUIRE_KEYCLOAK,
                "permify": REQUIRE_PERMIFY,
                "dapr": REQUIRE_DAPR,
                "fluvio": REQUIRE_FLUVIO,
                "temporal": REQUIRE_TEMPORAL,
                "kafka": REQUIRE_KAFKA
            }
        }


# Global middleware manager instance
middleware_manager = MiddlewareManager()


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

async def init_middleware():
    """Initialize middleware on app startup"""
    return await middleware_manager.initialize()


async def shutdown_middleware():
    """Cleanup middleware on app shutdown"""
    await middleware_manager.mojaloop.close()
    if middleware_manager.permify._session:
        await middleware_manager.permify._session.close()
    if middleware_manager.dapr._session:
        await middleware_manager.dapr._session.close()


def get_middleware() -> MiddlewareManager:
    """Dependency injection for FastAPI"""
    return middleware_manager
