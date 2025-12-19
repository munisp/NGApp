"""
Persistent Storage Service

This module provides production-grade persistent storage for money-critical flows:
1. Escrow records
2. Settlements and payouts
3. Idempotency keys
4. Virtual accounts
5. Insurance policies and claims
6. Disputes

Uses PostgreSQL for durable storage with Redis for caching and locks.
Replaces all in-memory Dict[str, Any] patterns for financial data.
"""

import os
import json
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, TypeVar, Generic, Type
from dataclasses import dataclass, asdict, field
from enum import Enum
from contextlib import asynccontextmanager
import uuid

logger = logging.getLogger(__name__)

T = TypeVar('T')


# =============================================================================
# Configuration
# =============================================================================

class StorageConfig:
    """Storage configuration"""
    
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    REDIS_URL = os.getenv("REDIS_URL", "")
    
    # Cache TTL
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))
    
    # Idempotency key TTL
    IDEMPOTENCY_TTL_HOURS = int(os.getenv("IDEMPOTENCY_TTL_HOURS", "24"))
    
    # Lock timeout
    LOCK_TIMEOUT_SECONDS = int(os.getenv("LOCK_TIMEOUT_SECONDS", "30"))
    
    # Production mode
    PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"


# =============================================================================
# Storage Backend Interface
# =============================================================================

class StorageBackend:
    """Abstract storage backend interface"""
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError
    
    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        raise NotImplementedError
    
    async def delete(self, key: str) -> bool:
        raise NotImplementedError
    
    async def exists(self, key: str) -> bool:
        raise NotImplementedError
    
    async def list_keys(self, prefix: str) -> List[str]:
        raise NotImplementedError
    
    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        raise NotImplementedError
    
    async def release_lock(self, key: str) -> bool:
        raise NotImplementedError


# =============================================================================
# In-Memory Backend (Development Only)
# =============================================================================

class InMemoryBackend(StorageBackend):
    """In-memory storage backend for development"""
    
    def __init__(self):
        self._data: Dict[str, Dict[str, Any]] = {}
        self._locks: Dict[str, datetime] = {}
        self._ttls: Dict[str, datetime] = {}
        
        if StorageConfig.PRODUCTION_MODE:
            logger.warning("InMemoryBackend should not be used in production!")
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        # Check TTL
        if key in self._ttls and datetime.utcnow() > self._ttls[key]:
            del self._data[key]
            del self._ttls[key]
            return None
        
        return self._data.get(key)
    
    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        self._data[key] = value
        if ttl:
            self._ttls[key] = datetime.utcnow() + timedelta(seconds=ttl)
        return True
    
    async def delete(self, key: str) -> bool:
        if key in self._data:
            del self._data[key]
            if key in self._ttls:
                del self._ttls[key]
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        if key in self._ttls and datetime.utcnow() > self._ttls[key]:
            del self._data[key]
            del self._ttls[key]
            return False
        return key in self._data
    
    async def list_keys(self, prefix: str) -> List[str]:
        return [k for k in self._data.keys() if k.startswith(prefix)]
    
    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        lock_key = f"lock:{key}"
        now = datetime.utcnow()
        
        # Check if lock exists and is not expired
        if lock_key in self._locks:
            if now < self._locks[lock_key]:
                return False
        
        self._locks[lock_key] = now + timedelta(seconds=timeout)
        return True
    
    async def release_lock(self, key: str) -> bool:
        lock_key = f"lock:{key}"
        if lock_key in self._locks:
            del self._locks[lock_key]
            return True
        return False


# =============================================================================
# Redis Backend (Production)
# =============================================================================

class RedisBackend(StorageBackend):
    """Redis storage backend for production"""
    
    def __init__(self):
        self._client = None
        self._connected = False
    
    async def _get_client(self):
        if self._client is None:
            try:
                import redis.asyncio as redis
                self._client = redis.from_url(StorageConfig.REDIS_URL)
                await self._client.ping()
                self._connected = True
                logger.info("Redis backend connected")
            except Exception as e:
                logger.error(f"Redis connection failed: {e}")
                self._connected = False
                raise
        return self._client
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        try:
            client = await self._get_client()
            data = await client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        try:
            client = await self._get_client()
            data = json.dumps(value, default=str)
            if ttl:
                await client.setex(key, ttl, data)
            else:
                await client.set(key, data)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        try:
            client = await self._get_client()
            result = await client.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        try:
            client = await self._get_client()
            return await client.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False
    
    async def list_keys(self, prefix: str) -> List[str]:
        try:
            client = await self._get_client()
            keys = await client.keys(f"{prefix}*")
            return [k.decode() if isinstance(k, bytes) else k for k in keys]
        except Exception as e:
            logger.error(f"Redis list_keys error: {e}")
            return []
    
    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        try:
            client = await self._get_client()
            lock_key = f"lock:{key}"
            result = await client.set(lock_key, "1", nx=True, ex=timeout)
            return result is not None
        except Exception as e:
            logger.error(f"Redis acquire_lock error: {e}")
            return False
    
    async def release_lock(self, key: str) -> bool:
        try:
            client = await self._get_client()
            lock_key = f"lock:{key}"
            result = await client.delete(lock_key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis release_lock error: {e}")
            return False


# =============================================================================
# PostgreSQL Backend (Production - Primary Storage)
# =============================================================================

class PostgresBackend(StorageBackend):
    """PostgreSQL storage backend for production"""
    
    def __init__(self):
        self._engine = None
        self._initialized = False
    
    async def _get_engine(self):
        if self._engine is None:
            try:
                from sqlalchemy.ext.asyncio import create_async_engine
                
                database_url = StorageConfig.DATABASE_URL
                if database_url.startswith("postgres://"):
                    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
                elif database_url.startswith("postgresql://"):
                    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
                
                self._engine = create_async_engine(database_url, echo=False)
                
                # Create table if not exists
                await self._ensure_table()
                
                logger.info("PostgreSQL backend connected")
            except Exception as e:
                logger.error(f"PostgreSQL connection failed: {e}")
                raise
        return self._engine
    
    async def _ensure_table(self):
        """Ensure key-value table exists"""
        if self._initialized:
            return
        
        from sqlalchemy import text
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS persistent_storage (
            key VARCHAR(512) PRIMARY KEY,
            value JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_persistent_storage_expires 
        ON persistent_storage(expires_at) WHERE expires_at IS NOT NULL;
        """
        
        try:
            async with self._engine.begin() as conn:
                await conn.execute(text(create_table_sql))
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to create table: {e}")
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("""
                        SELECT value FROM persistent_storage 
                        WHERE key = :key 
                        AND (expires_at IS NULL OR expires_at > NOW())
                    """),
                    {"key": key}
                )
                row = result.fetchone()
                if row:
                    return row[0]
            return None
        except Exception as e:
            logger.error(f"PostgreSQL get error: {e}")
            return None
    
    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            
            expires_at = None
            if ttl:
                expires_at = datetime.utcnow() + timedelta(seconds=ttl)
            
            async with engine.begin() as conn:
                await conn.execute(
                    text("""
                        INSERT INTO persistent_storage (key, value, expires_at, updated_at)
                        VALUES (:key, :value, :expires_at, NOW())
                        ON CONFLICT (key) DO UPDATE SET
                            value = :value,
                            expires_at = :expires_at,
                            updated_at = NOW()
                    """),
                    {"key": key, "value": json.dumps(value, default=str), "expires_at": expires_at}
                )
            return True
        except Exception as e:
            logger.error(f"PostgreSQL set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            
            async with engine.begin() as conn:
                result = await conn.execute(
                    text("DELETE FROM persistent_storage WHERE key = :key"),
                    {"key": key}
                )
            return True
        except Exception as e:
            logger.error(f"PostgreSQL delete error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("""
                        SELECT 1 FROM persistent_storage 
                        WHERE key = :key 
                        AND (expires_at IS NULL OR expires_at > NOW())
                    """),
                    {"key": key}
                )
                return result.fetchone() is not None
        except Exception as e:
            logger.error(f"PostgreSQL exists error: {e}")
            return False
    
    async def list_keys(self, prefix: str) -> List[str]:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("""
                        SELECT key FROM persistent_storage 
                        WHERE key LIKE :prefix
                        AND (expires_at IS NULL OR expires_at > NOW())
                    """),
                    {"prefix": f"{prefix}%"}
                )
                return [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error(f"PostgreSQL list_keys error: {e}")
            return []
    
    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        # Use advisory locks in PostgreSQL
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            lock_id = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
            
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SELECT pg_try_advisory_lock(:lock_id)"),
                    {"lock_id": lock_id}
                )
                row = result.fetchone()
                return row[0] if row else False
        except Exception as e:
            logger.error(f"PostgreSQL acquire_lock error: {e}")
            return False
    
    async def release_lock(self, key: str) -> bool:
        try:
            from sqlalchemy import text
            
            engine = await self._get_engine()
            lock_id = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
            
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": lock_id}
                )
                row = result.fetchone()
                return row[0] if row else False
        except Exception as e:
            logger.error(f"PostgreSQL release_lock error: {e}")
            return False


# =============================================================================
# Storage Factory
# =============================================================================

def get_storage_backend() -> StorageBackend:
    """Get appropriate storage backend based on configuration"""
    
    if StorageConfig.DATABASE_URL:
        logger.info("Using PostgreSQL storage backend")
        return PostgresBackend()
    elif StorageConfig.REDIS_URL:
        logger.info("Using Redis storage backend")
        return RedisBackend()
    else:
        if StorageConfig.PRODUCTION_MODE:
            raise RuntimeError(
                "No persistent storage configured in production mode. "
                "Set DATABASE_URL or REDIS_URL environment variable."
            )
        logger.warning("Using fallback storage backend - set DATABASE_URL for production")
        return InMemoryBackend()


# =============================================================================
# Domain-Specific Storage Services
# =============================================================================

class EscrowStorage:
    """Persistent storage for escrow records"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "escrow:"
    
    async def create(self, escrow_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{escrow_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        data["updated_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get(self, escrow_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._prefix}{escrow_id}"
        return await self._backend.get(key)
    
    async def update(self, escrow_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{escrow_id}"
        existing = await self._backend.get(key)
        if existing:
            existing.update(data)
            existing["updated_at"] = datetime.utcnow().isoformat()
            return await self._backend.set(key, existing)
        return False
    
    async def delete(self, escrow_id: str) -> bool:
        key = f"{self._prefix}{escrow_id}"
        return await self._backend.delete(key)
    
    async def list_all(self) -> List[Dict[str, Any]]:
        keys = await self._backend.list_keys(self._prefix)
        results = []
        for key in keys:
            data = await self._backend.get(key)
            if data:
                results.append(data)
        return results
    
    async def list_by_status(self, status: str) -> List[Dict[str, Any]]:
        all_escrows = await self.list_all()
        return [e for e in all_escrows if e.get("status") == status]


class IdempotencyStorage:
    """Persistent storage for idempotency keys"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "idempotency:"
        self._ttl = StorageConfig.IDEMPOTENCY_TTL_HOURS * 3600
    
    async def check_and_set(
        self,
        key: str,
        response: Dict[str, Any]
    ) -> tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if idempotency key exists.
        Returns (is_new, existing_response)
        """
        full_key = f"{self._prefix}{key}"
        
        existing = await self._backend.get(full_key)
        if existing:
            return False, existing
        
        response["idempotency_key"] = key
        response["created_at"] = datetime.utcnow().isoformat()
        
        await self._backend.set(full_key, response, ttl=self._ttl)
        return True, None
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        full_key = f"{self._prefix}{key}"
        return await self._backend.get(full_key)
    
    async def invalidate(self, key: str) -> bool:
        full_key = f"{self._prefix}{key}"
        return await self._backend.delete(full_key)


class SettlementStorage:
    """Persistent storage for settlement records"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "settlement:"
    
    async def create(self, settlement_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{settlement_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get(self, settlement_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._prefix}{settlement_id}"
        return await self._backend.get(key)
    
    async def update_status(self, settlement_id: str, status: str, details: Optional[Dict[str, Any]] = None) -> bool:
        key = f"{self._prefix}{settlement_id}"
        existing = await self._backend.get(key)
        if existing:
            existing["status"] = status
            existing["updated_at"] = datetime.utcnow().isoformat()
            if details:
                existing.update(details)
            return await self._backend.set(key, existing)
        return False
    
    async def list_pending(self) -> List[Dict[str, Any]]:
        keys = await self._backend.list_keys(self._prefix)
        results = []
        for key in keys:
            data = await self._backend.get(key)
            if data and data.get("status") in ["pending", "processing"]:
                results.append(data)
        return results


class VirtualAccountStorage:
    """Persistent storage for virtual accounts"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "virtual_account:"
    
    async def create(self, account_number: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{account_number}"
        data["created_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get(self, account_number: str) -> Optional[Dict[str, Any]]:
        key = f"{self._prefix}{account_number}"
        return await self._backend.get(key)
    
    async def get_by_reference(self, reference: str) -> Optional[Dict[str, Any]]:
        keys = await self._backend.list_keys(self._prefix)
        for key in keys:
            data = await self._backend.get(key)
            if data and data.get("reference") == reference:
                return data
        return None
    
    async def credit(self, account_number: str, amount: float) -> bool:
        key = f"{self._prefix}{account_number}"
        existing = await self._backend.get(key)
        if existing:
            existing["amount_received"] = existing.get("amount_received", 0) + amount
            existing["updated_at"] = datetime.utcnow().isoformat()
            return await self._backend.set(key, existing)
        return False


class InsuranceStorage:
    """Persistent storage for insurance policies and claims"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._policy_prefix = "insurance_policy:"
        self._claim_prefix = "insurance_claim:"
    
    async def create_policy(self, policy_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._policy_prefix}{policy_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get_policy(self, policy_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._policy_prefix}{policy_id}"
        return await self._backend.get(key)
    
    async def create_claim(self, claim_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._claim_prefix}{claim_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get_claim(self, claim_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._claim_prefix}{claim_id}"
        return await self._backend.get(key)
    
    async def update_claim_status(self, claim_id: str, status: str) -> bool:
        key = f"{self._claim_prefix}{claim_id}"
        existing = await self._backend.get(key)
        if existing:
            existing["status"] = status
            existing["updated_at"] = datetime.utcnow().isoformat()
            return await self._backend.set(key, existing)
        return False


class DisputeStorage:
    """Persistent storage for disputes"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "dispute:"
    
    async def create(self, dispute_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{dispute_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        return await self._backend.set(key, data)
    
    async def get(self, dispute_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._prefix}{dispute_id}"
        return await self._backend.get(key)
    
    async def get_by_escrow(self, escrow_id: str) -> Optional[Dict[str, Any]]:
        keys = await self._backend.list_keys(self._prefix)
        for key in keys:
            data = await self._backend.get(key)
            if data and data.get("escrow_id") == escrow_id:
                return data
        return None
    
    async def update(self, dispute_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{dispute_id}"
        existing = await self._backend.get(key)
        if existing:
            existing.update(data)
            existing["updated_at"] = datetime.utcnow().isoformat()
            return await self._backend.set(key, existing)
        return False


class MerchantAccountStorage:
    """Persistent storage for merchant accounts"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "merchant:"
        self._phone_index_prefix = "merchant_phone:"
    
    async def create(self, account_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{account_id}"
        data["created_at"] = datetime.utcnow().isoformat()
        
        # Create phone index
        phone = data.get("phone")
        if phone:
            phone_key = f"{self._phone_index_prefix}{phone}"
            await self._backend.set(phone_key, {"account_id": account_id})
        
        return await self._backend.set(key, data)
    
    async def get(self, account_id: str) -> Optional[Dict[str, Any]]:
        key = f"{self._prefix}{account_id}"
        return await self._backend.get(key)
    
    async def get_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        phone_key = f"{self._phone_index_prefix}{phone}"
        index = await self._backend.get(phone_key)
        if index:
            return await self.get(index["account_id"])
        return None
    
    async def update(self, account_id: str, data: Dict[str, Any]) -> bool:
        key = f"{self._prefix}{account_id}"
        existing = await self._backend.get(key)
        if existing:
            existing.update(data)
            existing["updated_at"] = datetime.utcnow().isoformat()
            return await self._backend.set(key, existing)
        return False


class AuditLogStorage:
    """Persistent storage for audit logs"""
    
    def __init__(self, backend: StorageBackend):
        self._backend = backend
        self._prefix = "audit:"
    
    async def log(
        self,
        event_type: str,
        user_id: Optional[str],
        resource_type: str,
        resource_id: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> str:
        """Log an audit event"""
        
        audit_id = f"AUD_{uuid.uuid4().hex[:12].upper()}"
        key = f"{self._prefix}{audit_id}"
        
        data = {
            "audit_id": audit_id,
            "event_type": event_type,
            "user_id": user_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self._backend.set(key, data)
        
        logger.info(f"Audit: {event_type} - {action} on {resource_type}/{resource_id} by {user_id}")
        
        return audit_id
    
    async def get_by_resource(self, resource_type: str, resource_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit logs for a specific resource"""
        keys = await self._backend.list_keys(self._prefix)
        results = []
        
        for key in keys:
            data = await self._backend.get(key)
            if data and data.get("resource_type") == resource_type and data.get("resource_id") == resource_id:
                results.append(data)
                if len(results) >= limit:
                    break
        
        return sorted(results, key=lambda x: x.get("timestamp", ""), reverse=True)


# =============================================================================
# Global Storage Instance
# =============================================================================

_storage_backend: Optional[StorageBackend] = None
_escrow_storage: Optional[EscrowStorage] = None
_idempotency_storage: Optional[IdempotencyStorage] = None
_settlement_storage: Optional[SettlementStorage] = None
_virtual_account_storage: Optional[VirtualAccountStorage] = None
_insurance_storage: Optional[InsuranceStorage] = None
_dispute_storage: Optional[DisputeStorage] = None
_merchant_storage: Optional[MerchantAccountStorage] = None
_audit_storage: Optional[AuditLogStorage] = None


def get_storage() -> StorageBackend:
    """Get global storage backend"""
    global _storage_backend
    if _storage_backend is None:
        _storage_backend = get_storage_backend()
    return _storage_backend


def get_escrow_storage() -> EscrowStorage:
    """Get escrow storage service"""
    global _escrow_storage
    if _escrow_storage is None:
        _escrow_storage = EscrowStorage(get_storage())
    return _escrow_storage


def get_idempotency_storage() -> IdempotencyStorage:
    """Get idempotency storage service"""
    global _idempotency_storage
    if _idempotency_storage is None:
        _idempotency_storage = IdempotencyStorage(get_storage())
    return _idempotency_storage


def get_settlement_storage() -> SettlementStorage:
    """Get settlement storage service"""
    global _settlement_storage
    if _settlement_storage is None:
        _settlement_storage = SettlementStorage(get_storage())
    return _settlement_storage


def get_virtual_account_storage() -> VirtualAccountStorage:
    """Get virtual account storage service"""
    global _virtual_account_storage
    if _virtual_account_storage is None:
        _virtual_account_storage = VirtualAccountStorage(get_storage())
    return _virtual_account_storage


def get_insurance_storage() -> InsuranceStorage:
    """Get insurance storage service"""
    global _insurance_storage
    if _insurance_storage is None:
        _insurance_storage = InsuranceStorage(get_storage())
    return _insurance_storage


def get_dispute_storage() -> DisputeStorage:
    """Get dispute storage service"""
    global _dispute_storage
    if _dispute_storage is None:
        _dispute_storage = DisputeStorage(get_storage())
    return _dispute_storage


def get_merchant_storage() -> MerchantAccountStorage:
    """Get merchant account storage service"""
    global _merchant_storage
    if _merchant_storage is None:
        _merchant_storage = MerchantAccountStorage(get_storage())
    return _merchant_storage


def get_audit_storage() -> AuditLogStorage:
    """Get audit log storage service"""
    global _audit_storage
    if _audit_storage is None:
        _audit_storage = AuditLogStorage(get_storage())
    return _audit_storage


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/storage", tags=["Storage"])


@router.get("/health")
async def storage_health():
    """Check storage health"""
    
    backend = get_storage()
    
    try:
        # Test write
        test_key = f"health_check:{uuid.uuid4().hex[:8]}"
        await backend.set(test_key, {"test": True}, ttl=60)
        
        # Test read
        data = await backend.get(test_key)
        
        # Test delete
        await backend.delete(test_key)
        
        return {
            "status": "healthy",
            "backend": type(backend).__name__,
            "production_mode": StorageConfig.PRODUCTION_MODE
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "error": str(e),
                "backend": type(backend).__name__
            }
        )


@router.get("/stats")
async def storage_stats():
    """Get storage statistics"""
    
    backend = get_storage()
    
    escrow_keys = await backend.list_keys("escrow:")
    settlement_keys = await backend.list_keys("settlement:")
    dispute_keys = await backend.list_keys("dispute:")
    merchant_keys = await backend.list_keys("merchant:")
    
    return {
        "backend": type(backend).__name__,
        "counts": {
            "escrows": len(escrow_keys),
            "settlements": len(settlement_keys),
            "disputes": len(dispute_keys),
            "merchants": len(merchant_keys)
        }
    }
