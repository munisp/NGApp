"""
Comprehensive Middleware Integration for SocialEscrow
Integrates TigerBeetle, Kafka, Dapr, Fluvio, Temporal, Keycloak, Permify, Redis, APISIX
"""

import asyncio
import json
import os
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List, Dict, Callable
from uuid import uuid4

import httpx
from pydantic import BaseModel


# ============================================================================
# TigerBeetle Integration - Double-Entry Ledger
# ============================================================================

class TigerBeetleAccountType(str, Enum):
    USER_WALLET = "user_wallet"
    ESCROW_HOLD = "escrow_hold"
    PLATFORM_FEE = "platform_fee"
    PAYMENT_GATEWAY = "payment_gateway"
    PAYOUT_PENDING = "payout_pending"


class TigerBeetleClient:
    """TigerBeetle client for double-entry accounting"""
    
    def __init__(self, addresses: List[str], cluster_id: int = 0):
        self.addresses = addresses
        self.cluster_id = cluster_id
        self._client = None
    
    async def connect(self):
        """Connect to TigerBeetle cluster"""
        try:
            import tigerbeetle
            self._client = tigerbeetle.Client(
                cluster_id=self.cluster_id,
                addresses=self.addresses
            )
        except ImportError:
            # Fallback to HTTP API if native client not available
            self._client = TigerBeetleHTTPClient(self.addresses[0])
    
    async def create_account(
        self,
        account_id: int,
        ledger: int,
        code: int,
        user_data: bytes = b"",
        flags: int = 0
    ) -> bool:
        """Create a new account"""
        if hasattr(self._client, 'create_accounts'):
            result = self._client.create_accounts([{
                "id": account_id,
                "ledger": ledger,
                "code": code,
                "user_data": user_data,
                "flags": flags,
            }])
            return len(result) == 0
        else:
            return await self._client.create_account(account_id, ledger, code, user_data, flags)
    
    async def transfer(
        self,
        from_account: str,
        to_account: str,
        amount: int,
        reference: str,
        ledger: int = 1,
        code: int = 1
    ) -> dict:
        """Execute a transfer between accounts"""
        
        # Parse account IDs
        from_id = self._parse_account_id(from_account)
        to_id = self._parse_account_id(to_account)
        
        transfer_id = int(uuid4().int % (2**128))
        
        if hasattr(self._client, 'create_transfers'):
            result = self._client.create_transfers([{
                "id": transfer_id,
                "debit_account_id": from_id,
                "credit_account_id": to_id,
                "amount": amount,
                "ledger": ledger,
                "code": code,
                "user_data": reference.encode()[:128],
            }])
            return {
                "success": len(result) == 0,
                "transfer_id": transfer_id,
                "reference": reference,
            }
        else:
            return await self._client.transfer(from_id, to_id, amount, reference, ledger, code)
    
    async def get_account_balance(self, account: str) -> dict:
        """Get account balance"""
        account_id = self._parse_account_id(account)
        
        if hasattr(self._client, 'lookup_accounts'):
            accounts = self._client.lookup_accounts([account_id])
            if accounts:
                acc = accounts[0]
                return {
                    "debits_pending": acc.debits_pending,
                    "debits_posted": acc.debits_posted,
                    "credits_pending": acc.credits_pending,
                    "credits_posted": acc.credits_posted,
                    "balance": acc.credits_posted - acc.debits_posted,
                }
        else:
            return await self._client.get_balance(account_id)
        
        return {"balance": 0}
    
    def _parse_account_id(self, account: str) -> int:
        """Parse account string to ID"""
        # Format: "type:id" -> hash to int
        import hashlib
        return int(hashlib.sha256(account.encode()).hexdigest()[:16], 16)


class TigerBeetleHTTPClient:
    """HTTP fallback client for TigerBeetle"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    async def create_account(self, account_id: int, ledger: int, code: int, user_data: bytes, flags: int) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/accounts",
                json={"id": account_id, "ledger": ledger, "code": code, "flags": flags}
            )
            return response.status_code == 201
    
    async def transfer(self, from_id: int, to_id: int, amount: int, reference: str, ledger: int, code: int) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transfers",
                json={
                    "debit_account_id": from_id,
                    "credit_account_id": to_id,
                    "amount": amount,
                    "reference": reference,
                }
            )
            return response.json()
    
    async def get_balance(self, account_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/accounts/{account_id}")
            return response.json()


# ============================================================================
# Kafka Integration - Event Streaming
# ============================================================================

class KafkaProducer:
    """Kafka producer for event streaming"""
    
    def __init__(self, bootstrap_servers: List[str], client_id: str = "escrow-api"):
        self.bootstrap_servers = bootstrap_servers
        self.client_id = client_id
        self._producer = None
    
    async def connect(self):
        """Connect to Kafka cluster"""
        try:
            from aiokafka import AIOKafkaProducer
            self._producer = AIOKafkaProducer(
                bootstrap_servers=",".join(self.bootstrap_servers),
                client_id=self.client_id,
                value_serializer=lambda v: json.dumps(v).encode()
            )
            await self._producer.start()
        except ImportError:
            self._producer = KafkaHTTPProducer(self.bootstrap_servers[0])
    
    async def send(self, topic: str, value: dict, key: Optional[str] = None):
        """Send message to topic"""
        if hasattr(self._producer, 'send_and_wait'):
            await self._producer.send_and_wait(
                topic,
                value=value,
                key=key.encode() if key else None
            )
        else:
            await self._producer.send(topic, value, key)
    
    async def close(self):
        """Close producer"""
        if hasattr(self._producer, 'stop'):
            await self._producer.stop()


class KafkaConsumer:
    """Kafka consumer for event streaming"""
    
    def __init__(
        self,
        bootstrap_servers: List[str],
        group_id: str,
        topics: List[str],
        handler: Callable
    ):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.topics = topics
        self.handler = handler
        self._consumer = None
        self._running = False
    
    async def start(self):
        """Start consuming messages"""
        try:
            from aiokafka import AIOKafkaConsumer
            self._consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=",".join(self.bootstrap_servers),
                group_id=self.group_id,
                value_deserializer=lambda v: json.loads(v.decode())
            )
            await self._consumer.start()
            self._running = True
            
            async for msg in self._consumer:
                if not self._running:
                    break
                await self.handler(msg.topic, msg.value)
        except ImportError:
            pass
    
    async def stop(self):
        """Stop consuming"""
        self._running = False
        if self._consumer:
            await self._consumer.stop()


class KafkaHTTPProducer:
    """HTTP fallback for Kafka (via Kafka REST Proxy)"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    async def send(self, topic: str, value: dict, key: Optional[str] = None):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/topics/{topic}",
                json={"records": [{"key": key, "value": value}]},
                headers={"Content-Type": "application/vnd.kafka.json.v2+json"}
            )


# ============================================================================
# Dapr Integration - Sidecar Pattern
# ============================================================================

class DaprClient:
    """Dapr sidecar client for service invocation and pub/sub"""
    
    def __init__(self, dapr_http_port: int = 3500, dapr_grpc_port: int = 50001):
        self.http_port = dapr_http_port
        self.grpc_port = dapr_grpc_port
        self.base_url = f"http://localhost:{dapr_http_port}"
    
    async def invoke_service(
        self,
        app_id: str,
        method: str,
        data: Optional[dict] = None,
        http_method: str = "POST"
    ) -> dict:
        """Invoke a service method via Dapr"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/v1.0/invoke/{app_id}/method/{method}"
            
            if http_method == "GET":
                response = await client.get(url)
            else:
                response = await client.post(url, json=data or {})
            
            return response.json()
    
    async def publish_event(
        self,
        pubsub_name: str,
        topic: str,
        data: dict,
        metadata: Optional[dict] = None
    ):
        """Publish event to pub/sub"""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/v1.0/publish/{pubsub_name}/{topic}",
                json=data,
                headers={"Content-Type": "application/json"}
            )
    
    async def get_state(self, store_name: str, key: str) -> Optional[dict]:
        """Get state from state store"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v1.0/state/{store_name}/{key}"
            )
            if response.status_code == 200:
                return response.json()
            return None
    
    async def save_state(self, store_name: str, key: str, value: dict):
        """Save state to state store"""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/v1.0/state/{store_name}",
                json=[{"key": key, "value": value}]
            )
    
    async def delete_state(self, store_name: str, key: str):
        """Delete state from state store"""
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{self.base_url}/v1.0/state/{store_name}/{key}"
            )
    
    async def get_secret(self, store_name: str, key: str) -> Optional[dict]:
        """Get secret from secret store"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v1.0/secrets/{store_name}/{key}"
            )
            if response.status_code == 200:
                return response.json()
            return None
    
    async def invoke_binding(
        self,
        binding_name: str,
        operation: str,
        data: dict,
        metadata: Optional[dict] = None
    ) -> dict:
        """Invoke output binding"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1.0/bindings/{binding_name}",
                json={
                    "operation": operation,
                    "data": data,
                    "metadata": metadata or {},
                }
            )
            return response.json() if response.content else {}


# ============================================================================
# Fluvio Integration - Real-time Streaming
# ============================================================================

class FluvioClient:
    """Fluvio client for real-time streaming"""
    
    def __init__(self, endpoint: str = "localhost:9003"):
        self.endpoint = endpoint
        self._producer = None
        self._consumer = None
    
    async def connect(self):
        """Connect to Fluvio cluster"""
        try:
            from fluvio import Fluvio
            self._fluvio = await Fluvio.connect()
        except ImportError:
            self._fluvio = FluvioHTTPClient(self.endpoint)
    
    async def produce(self, topic: str, value: str, key: Optional[str] = None):
        """Produce message to topic"""
        if hasattr(self._fluvio, 'topic_producer'):
            producer = await self._fluvio.topic_producer(topic)
            await producer.send_string(value)
        else:
            await self._fluvio.produce(topic, value, key)
    
    async def consume(self, topic: str, partition: int = 0, offset: int = 0):
        """Consume messages from topic"""
        if hasattr(self._fluvio, 'partition_consumer'):
            consumer = await self._fluvio.partition_consumer(topic, partition)
            async for record in consumer.stream(offset):
                yield record.value_string()
        else:
            async for msg in self._fluvio.consume(topic, partition, offset):
                yield msg


class FluvioHTTPClient:
    """HTTP fallback for Fluvio"""
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
    
    async def produce(self, topic: str, value: str, key: Optional[str] = None):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"http://{self.endpoint}/topics/{topic}/produce",
                json={"value": value, "key": key}
            )
    
    async def consume(self, topic: str, partition: int, offset: int):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://{self.endpoint}/topics/{topic}/consume",
                params={"partition": partition, "offset": offset}
            )
            for msg in response.json().get("messages", []):
                yield msg["value"]


# ============================================================================
# Temporal Integration - Workflow Orchestration
# ============================================================================

class TemporalClient:
    """Temporal client for workflow orchestration"""
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 7233,
        namespace: str = "default"
    ):
        self.host = host
        self.port = port
        self.namespace = namespace
        self._client = None
    
    async def connect(self):
        """Connect to Temporal server"""
        try:
            from temporalio.client import Client
            self._client = await Client.connect(f"{self.host}:{self.port}")
        except ImportError:
            self._client = TemporalHTTPClient(self.host, self.port)
    
    async def start_workflow(
        self,
        workflow_type: str,
        workflow_id: str,
        task_queue: str,
        args: List[Any] = None,
        execution_timeout: Optional[timedelta] = None
    ) -> str:
        """Start a workflow execution"""
        if hasattr(self._client, 'start_workflow'):
            handle = await self._client.start_workflow(
                workflow_type,
                args or [],
                id=workflow_id,
                task_queue=task_queue,
                execution_timeout=execution_timeout or timedelta(hours=24),
            )
            return handle.id
        else:
            return await self._client.start_workflow(
                workflow_type, workflow_id, task_queue, args
            )
    
    async def signal_workflow(
        self,
        workflow_id: str,
        signal_name: str,
        args: List[Any] = None
    ):
        """Send signal to workflow"""
        if hasattr(self._client, 'get_workflow_handle'):
            handle = self._client.get_workflow_handle(workflow_id)
            await handle.signal(signal_name, args or [])
        else:
            await self._client.signal_workflow(workflow_id, signal_name, args)
    
    async def query_workflow(
        self,
        workflow_id: str,
        query_name: str,
        args: List[Any] = None
    ) -> Any:
        """Query workflow state"""
        if hasattr(self._client, 'get_workflow_handle'):
            handle = self._client.get_workflow_handle(workflow_id)
            return await handle.query(query_name, args or [])
        else:
            return await self._client.query_workflow(workflow_id, query_name, args)
    
    async def cancel_workflow(self, workflow_id: str):
        """Cancel a workflow"""
        if hasattr(self._client, 'get_workflow_handle'):
            handle = self._client.get_workflow_handle(workflow_id)
            await handle.cancel()
        else:
            await self._client.cancel_workflow(workflow_id)


class TemporalHTTPClient:
    """HTTP fallback for Temporal (via Temporal Web API)"""
    
    def __init__(self, host: str, port: int):
        self.base_url = f"http://{host}:{port}"
    
    async def start_workflow(
        self,
        workflow_type: str,
        workflow_id: str,
        task_queue: str,
        args: List[Any]
    ) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/namespaces/default/workflows",
                json={
                    "workflowType": {"name": workflow_type},
                    "workflowId": workflow_id,
                    "taskQueue": {"name": task_queue},
                    "input": args,
                }
            )
            return workflow_id
    
    async def signal_workflow(self, workflow_id: str, signal_name: str, args: List[Any]):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/api/v1/namespaces/default/workflows/{workflow_id}/signal/{signal_name}",
                json={"input": args}
            )
    
    async def query_workflow(self, workflow_id: str, query_name: str, args: List[Any]) -> Any:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/namespaces/default/workflows/{workflow_id}/query/{query_name}",
                json={"input": args}
            )
            return response.json()
    
    async def cancel_workflow(self, workflow_id: str):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/api/v1/namespaces/default/workflows/{workflow_id}/cancel"
            )


# ============================================================================
# Permify Integration - Authorization/RBAC
# ============================================================================

class PermifyClient:
    """Permify client for fine-grained authorization"""
    
    def __init__(self, host: str = "localhost", port: int = 3476):
        self.base_url = f"http://{host}:{port}"
    
    async def check_permission(
        self,
        tenant_id: str,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_type: str,
        subject_id: str
    ) -> bool:
        """Check if subject has permission on entity"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/tenants/{tenant_id}/permissions/check",
                json={
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject": {"type": subject_type, "id": subject_id},
                }
            )
            data = response.json()
            return data.get("can") == "CHECK_RESULT_ALLOWED"
    
    async def write_relationship(
        self,
        tenant_id: str,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str
    ):
        """Write a relationship tuple"""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/v1/tenants/{tenant_id}/relationships/write",
                json={
                    "tuples": [{
                        "entity": {"type": entity_type, "id": entity_id},
                        "relation": relation,
                        "subject": {"type": subject_type, "id": subject_id},
                    }]
                }
            )
    
    async def delete_relationship(
        self,
        tenant_id: str,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str
    ):
        """Delete a relationship tuple"""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/v1/tenants/{tenant_id}/relationships/delete",
                json={
                    "tuples": [{
                        "entity": {"type": entity_type, "id": entity_id},
                        "relation": relation,
                        "subject": {"type": subject_type, "id": subject_id},
                    }]
                }
            )
    
    async def lookup_subjects(
        self,
        tenant_id: str,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_type: str
    ) -> List[str]:
        """Lookup subjects with permission on entity"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/tenants/{tenant_id}/permissions/lookup-subject",
                json={
                    "entity": {"type": entity_type, "id": entity_id},
                    "permission": permission,
                    "subject_reference": {"type": subject_type},
                }
            )
            data = response.json()
            return [s["id"] for s in data.get("subject_ids", [])]


# ============================================================================
# Redis Integration - Caching & Sessions
# ============================================================================

class RedisClient:
    """Redis client for caching and sessions"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0, password: Optional[str] = None):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self._client = None
    
    async def connect(self):
        """Connect to Redis"""
        try:
            import redis.asyncio as redis
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True
            )
        except ImportError:
            self._client = RedisHTTPClient(self.host, self.port)
    
    async def get(self, key: str) -> Optional[str]:
        """Get value by key"""
        return await self._client.get(key)
    
    async def set(self, key: str, value: str, ex: Optional[int] = None):
        """Set value with optional expiry"""
        await self._client.set(key, value, ex=ex)
    
    async def delete(self, key: str):
        """Delete key"""
        await self._client.delete(key)
    
    async def hget(self, name: str, key: str) -> Optional[str]:
        """Get hash field"""
        return await self._client.hget(name, key)
    
    async def hset(self, name: str, key: str, value: str):
        """Set hash field"""
        await self._client.hset(name, key, value)
    
    async def hgetall(self, name: str) -> dict:
        """Get all hash fields"""
        return await self._client.hgetall(name)
    
    async def lpush(self, key: str, *values):
        """Push to list"""
        await self._client.lpush(key, *values)
    
    async def lrange(self, key: str, start: int, end: int) -> List[str]:
        """Get list range"""
        return await self._client.lrange(key, start, end)
    
    async def publish(self, channel: str, message: str):
        """Publish to channel"""
        await self._client.publish(channel, message)
    
    async def incr(self, key: str) -> int:
        """Increment counter"""
        return await self._client.incr(key)
    
    async def expire(self, key: str, seconds: int):
        """Set key expiry"""
        await self._client.expire(key, seconds)


class RedisHTTPClient:
    """HTTP fallback for Redis (via Redis REST API)"""
    
    def __init__(self, host: str, port: int):
        self.base_url = f"http://{host}:{port}"
    
    async def get(self, key: str) -> Optional[str]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/get/{key}")
            return response.json().get("result")
    
    async def set(self, key: str, value: str, ex: Optional[int] = None):
        async with httpx.AsyncClient() as client:
            params = {"value": value}
            if ex:
                params["ex"] = ex
            await client.post(f"{self.base_url}/set/{key}", params=params)
    
    async def delete(self, key: str):
        async with httpx.AsyncClient() as client:
            await client.delete(f"{self.base_url}/del/{key}")


# ============================================================================
# APISIX Integration - API Gateway
# ============================================================================

class APISIXAdminClient:
    """APISIX Admin API client for route management"""
    
    def __init__(self, admin_url: str = "http://localhost:9180", api_key: str = ""):
        self.admin_url = admin_url
        self.api_key = api_key
    
    def _get_headers(self) -> dict:
        return {"X-API-KEY": self.api_key}
    
    async def create_route(
        self,
        route_id: str,
        uri: str,
        upstream_id: Optional[str] = None,
        upstream_nodes: Optional[dict] = None,
        methods: Optional[List[str]] = None,
        plugins: Optional[dict] = None
    ):
        """Create or update a route"""
        route_config = {
            "uri": uri,
            "methods": methods or ["GET", "POST", "PUT", "DELETE"],
            "plugins": plugins or {},
        }
        
        if upstream_id:
            route_config["upstream_id"] = upstream_id
        elif upstream_nodes:
            route_config["upstream"] = {
                "type": "roundrobin",
                "nodes": upstream_nodes,
            }
        
        async with httpx.AsyncClient() as client:
            await client.put(
                f"{self.admin_url}/apisix/admin/routes/{route_id}",
                json=route_config,
                headers=self._get_headers()
            )
    
    async def create_upstream(
        self,
        upstream_id: str,
        nodes: dict,
        upstream_type: str = "roundrobin",
        health_check: Optional[dict] = None
    ):
        """Create or update an upstream"""
        upstream_config = {
            "type": upstream_type,
            "nodes": nodes,
        }
        
        if health_check:
            upstream_config["checks"] = health_check
        
        async with httpx.AsyncClient() as client:
            await client.put(
                f"{self.admin_url}/apisix/admin/upstreams/{upstream_id}",
                json=upstream_config,
                headers=self._get_headers()
            )
    
    async def create_consumer(
        self,
        username: str,
        plugins: dict
    ):
        """Create or update a consumer"""
        async with httpx.AsyncClient() as client:
            await client.put(
                f"{self.admin_url}/apisix/admin/consumers/{username}",
                json={"username": username, "plugins": plugins},
                headers=self._get_headers()
            )
    
    async def enable_plugin(
        self,
        route_id: str,
        plugin_name: str,
        plugin_config: dict
    ):
        """Enable a plugin on a route"""
        # Get current route
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.admin_url}/apisix/admin/routes/{route_id}",
                headers=self._get_headers()
            )
            route = response.json().get("value", {})
        
        # Update plugins
        plugins = route.get("plugins", {})
        plugins[plugin_name] = plugin_config
        
        # Update route
        await self.create_route(
            route_id=route_id,
            uri=route.get("uri"),
            upstream_id=route.get("upstream_id"),
            methods=route.get("methods"),
            plugins=plugins
        )


# ============================================================================
# Unified Middleware Manager
# ============================================================================

class MiddlewareManager:
    """Unified manager for all middleware integrations"""
    
    def __init__(self):
        self.tigerbeetle: Optional[TigerBeetleClient] = None
        self.kafka_producer: Optional[KafkaProducer] = None
        self.dapr: Optional[DaprClient] = None
        self.fluvio: Optional[FluvioClient] = None
        self.temporal: Optional[TemporalClient] = None
        self.permify: Optional[PermifyClient] = None
        self.redis: Optional[RedisClient] = None
        self.apisix: Optional[APISIXAdminClient] = None
        self._initialized = False
    
    async def initialize(self, config: dict):
        """Initialize all middleware clients"""
        
        # TigerBeetle
        if config.get("tigerbeetle"):
            self.tigerbeetle = TigerBeetleClient(
                addresses=config["tigerbeetle"].get("addresses", ["localhost:3000"]),
                cluster_id=config["tigerbeetle"].get("cluster_id", 0)
            )
            await self.tigerbeetle.connect()
        
        # Kafka
        if config.get("kafka"):
            self.kafka_producer = KafkaProducer(
                bootstrap_servers=config["kafka"].get("bootstrap_servers", ["localhost:9092"]),
                client_id=config["kafka"].get("client_id", "escrow-api")
            )
            await self.kafka_producer.connect()
        
        # Dapr
        if config.get("dapr"):
            self.dapr = DaprClient(
                dapr_http_port=config["dapr"].get("http_port", 3500),
                dapr_grpc_port=config["dapr"].get("grpc_port", 50001)
            )
        
        # Fluvio
        if config.get("fluvio"):
            self.fluvio = FluvioClient(
                endpoint=config["fluvio"].get("endpoint", "localhost:9003")
            )
            await self.fluvio.connect()
        
        # Temporal
        if config.get("temporal"):
            self.temporal = TemporalClient(
                host=config["temporal"].get("host", "localhost"),
                port=config["temporal"].get("port", 7233),
                namespace=config["temporal"].get("namespace", "default")
            )
            await self.temporal.connect()
        
        # Permify
        if config.get("permify"):
            self.permify = PermifyClient(
                host=config["permify"].get("host", "localhost"),
                port=config["permify"].get("port", 3476)
            )
        
        # Redis
        if config.get("redis"):
            self.redis = RedisClient(
                host=config["redis"].get("host", "localhost"),
                port=config["redis"].get("port", 6379),
                db=config["redis"].get("db", 0),
                password=config["redis"].get("password")
            )
            await self.redis.connect()
        
        # APISIX
        if config.get("apisix"):
            self.apisix = APISIXAdminClient(
                admin_url=config["apisix"].get("admin_url", "http://localhost:9180"),
                api_key=config["apisix"].get("api_key", "")
            )
        
        self._initialized = True
    
    async def publish_event(self, event_type: str, data: dict):
        """Publish event to all configured streaming platforms"""
        
        event = {
            "id": str(uuid4()),
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Kafka
        if self.kafka_producer:
            await self.kafka_producer.send(
                topic=f"escrow.{event_type.replace('.', '_')}",
                value=event,
                key=data.get("escrow_id") or data.get("user_id")
            )
        
        # Dapr pub/sub
        if self.dapr:
            await self.dapr.publish_event(
                pubsub_name="escrow-pubsub",
                topic=event_type,
                data=event
            )
        
        # Fluvio
        if self.fluvio:
            await self.fluvio.produce(
                topic=f"escrow-{event_type.replace('.', '-')}",
                value=json.dumps(event)
            )
    
    async def check_permission(
        self,
        user_id: str,
        resource_type: str,
        resource_id: str,
        permission: str
    ) -> bool:
        """Check permission using Permify"""
        
        if not self.permify:
            return True  # Default allow if Permify not configured
        
        return await self.permify.check_permission(
            tenant_id="escrow",
            entity_type=resource_type,
            entity_id=resource_id,
            permission=permission,
            subject_type="user",
            subject_id=user_id
        )
    
    async def start_workflow(
        self,
        workflow_type: str,
        workflow_id: str,
        args: List[Any] = None
    ) -> str:
        """Start a Temporal workflow"""
        
        if not self.temporal:
            raise RuntimeError("Temporal not configured")
        
        return await self.temporal.start_workflow(
            workflow_type=workflow_type,
            workflow_id=workflow_id,
            task_queue="escrow-tasks",
            args=args or []
        )
    
    async def cache_get(self, key: str) -> Optional[str]:
        """Get from cache"""
        if self.redis:
            return await self.redis.get(key)
        return None
    
    async def cache_set(self, key: str, value: str, ttl: int = 3600):
        """Set in cache"""
        if self.redis:
            await self.redis.set(key, value, ex=ttl)
    
    async def ledger_transfer(
        self,
        from_account: str,
        to_account: str,
        amount: int,
        reference: str
    ) -> dict:
        """Execute ledger transfer"""
        
        if not self.tigerbeetle:
            return {"success": False, "error": "TigerBeetle not configured"}
        
        return await self.tigerbeetle.transfer(
            from_account=from_account,
            to_account=to_account,
            amount=amount,
            reference=reference
        )


# Global middleware manager instance
middleware_manager = MiddlewareManager()


async def get_middleware_manager() -> MiddlewareManager:
    """Get the middleware manager instance"""
    return middleware_manager


# FastAPI Router for middleware health checks
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/v1/middleware", tags=["middleware"])


@router.get("/health")
async def middleware_health():
    """Check health of all middleware components"""
    
    health = {
        "tigerbeetle": middleware_manager.tigerbeetle is not None,
        "kafka": middleware_manager.kafka_producer is not None,
        "dapr": middleware_manager.dapr is not None,
        "fluvio": middleware_manager.fluvio is not None,
        "temporal": middleware_manager.temporal is not None,
        "permify": middleware_manager.permify is not None,
        "redis": middleware_manager.redis is not None,
        "apisix": middleware_manager.apisix is not None,
    }
    
    return {
        "status": "healthy" if all(health.values()) else "degraded",
        "components": health,
    }


@router.post("/initialize")
async def initialize_middleware(config: dict):
    """Initialize middleware with configuration"""
    await middleware_manager.initialize(config)
    return {"status": "initialized"}
