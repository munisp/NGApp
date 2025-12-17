"""
Repository Pattern for EscrowProtect
Provides database abstraction for all services

This module implements the repository pattern to:
1. Abstract database operations from business logic
2. Enable easy switching between in-memory (dev) and PostgreSQL (prod)
3. Ensure all data is persisted properly

Usage:
- In production: Use PostgreSQL repositories
- In development: Can use in-memory repositories for testing
"""

import os
import uuid
import json
import logging
from typing import Dict, Any, List, Optional, TypeVar, Generic
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager

from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.database import (
    Base, User, BankAccount, Escrow, EscrowTimeline, LedgerEntry,
    AccountBalance, Dispute, DisputeEvidence, DisputeMessage,
    FraudAlert, FraudPattern, AuditLog,
    EscrowStatus, DisputeStatus, DisputeReason, LedgerEntryType, FraudRiskLevel
)

logger = logging.getLogger(__name__)

# Environment configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./escrow.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
ALLOW_INMEMORY_FALLBACK = os.getenv("ALLOW_INMEMORY_FALLBACK", "true").lower() == "true"

# For PostgreSQL in production, convert postgres:// to postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ============================================
# Base Repository Interface
# ============================================

T = TypeVar('T')

class BaseRepository(ABC, Generic[T]):
    """Abstract base repository"""
    
    @abstractmethod
    async def get(self, id: str) -> Optional[T]:
        pass
    
    @abstractmethod
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        pass
    
    @abstractmethod
    async def create(self, entity: T) -> T:
        pass
    
    @abstractmethod
    async def update(self, id: str, data: Dict[str, Any]) -> Optional[T]:
        pass
    
    @abstractmethod
    async def delete(self, id: str) -> bool:
        pass


# ============================================
# Database Session Management
# ============================================

class DatabaseManager:
    """Manages database connections and sessions"""
    
    def __init__(self):
        self.engine = engine
        self.session_factory = async_session_factory
        self._initialized = False
    
    async def init_db(self):
        """Initialize database tables"""
        if self._initialized:
            return
        
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            self._initialized = True
            logger.info("Database tables initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            if not ALLOW_INMEMORY_FALLBACK:
                raise
    
    @asynccontextmanager
    async def session(self):
        """Get database session"""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            async with self.session() as session:
                await session.execute(select(1))
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            return {"status": "unhealthy", "database": str(e)}


# Global database manager
db_manager = DatabaseManager()


# ============================================
# User Repository
# ============================================

class UserRepository:
    """Repository for User entities"""
    
    async def get(self, user_id: str) -> Optional[User]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
    
    async def get_by_phone(self, phone: str) -> Optional[User]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(User).where(User.phone == phone)
            )
            return result.scalar_one_or_none()
    
    async def create(self, user_data: Dict[str, Any]) -> User:
        async with db_manager.session() as session:
            user = User(
                id=user_data.get("id", str(uuid.uuid4())),
                phone=user_data["phone"],
                phone_verified=user_data.get("phone_verified", False),
                name=user_data.get("name"),
                email=user_data.get("email"),
                kyc_level=user_data.get("kyc_level", 0),
            )
            session.add(user)
            await session.flush()
            return user
    
    async def update(self, user_id: str, data: Dict[str, Any]) -> Optional[User]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                for key, value in data.items():
                    if hasattr(user, key):
                        setattr(user, key, value)
                user.updated_at = datetime.utcnow()
                await session.flush()
            return user
    
    async def update_kyc(self, user_id: str, kyc_level: int, bvn_hash: str = None, nin_hash: str = None) -> Optional[User]:
        data = {"kyc_level": kyc_level, "kyc_verified_at": datetime.utcnow()}
        if bvn_hash:
            data["bvn_hash"] = bvn_hash
        if nin_hash:
            data["nin_hash"] = nin_hash
        return await self.update(user_id, data)
    
    async def increment_stats(self, user_id: str, successful: bool, amount: float):
        async with db_manager.session() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.total_transactions += 1
                user.total_volume += amount
                if successful:
                    user.successful_transactions += 1
                user.last_active_at = datetime.utcnow()
                await session.flush()


# ============================================
# Escrow Repository
# ============================================

class EscrowRepository:
    """Repository for Escrow entities"""
    
    async def get(self, escrow_id: str) -> Optional[Escrow]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow)
                .options(selectinload(Escrow.timeline_events))
                .where(Escrow.id == escrow_id)
            )
            return result.scalar_one_or_none()
    
    async def get_by_claim_token(self, token: str) -> Optional[Escrow]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow).where(Escrow.claim_token == token)
            )
            return result.scalar_one_or_none()
    
    async def create(self, escrow_data: Dict[str, Any]) -> Escrow:
        async with db_manager.session() as session:
            escrow = Escrow(
                id=escrow_data.get("id", str(uuid.uuid4())),
                buyer_id=escrow_data["buyer_id"],
                seller_id=escrow_data.get("seller_id"),
                amount=escrow_data["amount"],
                currency=escrow_data.get("currency", "NGN"),
                platform_fee=escrow_data["platform_fee"],
                insurance_fee=escrow_data.get("insurance_fee", 0),
                total_amount=escrow_data["total_amount"],
                listing_title=escrow_data.get("listing_title"),
                listing_source=escrow_data.get("listing_source"),
                seller_phone=escrow_data.get("seller_phone"),
                claim_token=escrow_data.get("claim_token"),
                status=EscrowStatus.PENDING_PAYMENT,
                expires_at=escrow_data.get("expires_at"),
                idempotency_key=escrow_data.get("idempotency_key"),
            )
            session.add(escrow)
            await session.flush()
            return escrow
    
    async def update_status(self, escrow_id: str, status: EscrowStatus, **kwargs) -> Optional[Escrow]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow).where(Escrow.id == escrow_id)
            )
            escrow = result.scalar_one_or_none()
            if escrow:
                escrow.status = status
                escrow.updated_at = datetime.utcnow()
                for key, value in kwargs.items():
                    if hasattr(escrow, key):
                        setattr(escrow, key, value)
                await session.flush()
            return escrow
    
    async def get_by_buyer(self, buyer_id: str, limit: int = 50) -> List[Escrow]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow)
                .where(Escrow.buyer_id == buyer_id)
                .order_by(Escrow.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())
    
    async def get_by_seller(self, seller_id: str, limit: int = 50) -> List[Escrow]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow)
                .where(Escrow.seller_id == seller_id)
                .order_by(Escrow.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())
    
    async def get_expiring(self, hours: int = 24) -> List[Escrow]:
        """Get escrows expiring within specified hours"""
        async with db_manager.session() as session:
            cutoff = datetime.utcnow() + timedelta(hours=hours)
            result = await session.execute(
                select(Escrow)
                .where(
                    and_(
                        Escrow.expires_at <= cutoff,
                        Escrow.status.in_([
                            EscrowStatus.PENDING_PAYMENT,
                            EscrowStatus.PAYMENT_RECEIVED,
                            EscrowStatus.SELLER_ACCEPTED
                        ])
                    )
                )
            )
            return list(result.scalars().all())
    
    async def add_timeline_event(self, escrow_id: str, event_type: str, event_data: Dict = None, actor_id: str = None, actor_type: str = None):
        async with db_manager.session() as session:
            event = EscrowTimeline(
                id=str(uuid.uuid4()),
                escrow_id=escrow_id,
                event_type=event_type,
                event_data=event_data or {},
                actor_id=actor_id,
                actor_type=actor_type,
            )
            session.add(event)
            await session.flush()


# ============================================
# Merchant/KYC Repository
# ============================================

class MerchantRepository:
    """Repository for merchant KYC profiles (extends User)"""
    
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def get_or_create(self, merchant_id: str, phone: str) -> User:
        """Get existing merchant or create new one"""
        user = await self.user_repo.get(merchant_id)
        if not user:
            user = await self.user_repo.create({
                "id": merchant_id,
                "phone": phone,
                "phone_verified": True,
                "kyc_level": 0,
            })
        return user
    
    async def update_kyc_tier(self, merchant_id: str, tier: int, **kwargs) -> Optional[User]:
        """Update merchant's KYC tier"""
        return await self.user_repo.update(merchant_id, {"kyc_level": tier, **kwargs})
    
    async def add_bank_account(self, merchant_id: str, bank_data: Dict[str, Any]) -> BankAccount:
        """Add verified bank account for merchant"""
        async with db_manager.session() as session:
            import hashlib
            account_hash = hashlib.sha256(bank_data["account_number"].encode()).hexdigest()
            
            bank = BankAccount(
                id=str(uuid.uuid4()),
                user_id=merchant_id,
                bank_code=bank_data["bank_code"],
                bank_name=bank_data["bank_name"],
                account_number_hash=account_hash,
                account_number_last4=bank_data["account_number"][-4:],
                account_name=bank_data.get("account_name"),
                verified=True,
                verified_at=datetime.utcnow(),
                verification_method="name_enquiry",
                is_primary=True,
            )
            session.add(bank)
            await session.flush()
            return bank
    
    async def get_bank_accounts(self, merchant_id: str) -> List[BankAccount]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(BankAccount).where(BankAccount.user_id == merchant_id)
            )
            return list(result.scalars().all())
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get merchant statistics"""
        async with db_manager.session() as session:
            total = await session.execute(select(func.count(User.id)))
            by_kyc = await session.execute(
                select(User.kyc_level, func.count(User.id))
                .group_by(User.kyc_level)
            )
            
            return {
                "total_merchants": total.scalar() or 0,
                "by_kyc_level": {row[0]: row[1] for row in by_kyc.all()}
            }


# ============================================
# Dispute Repository
# ============================================

class DisputeRepository:
    """Repository for Dispute entities"""
    
    async def get(self, dispute_id: str) -> Optional[Dispute]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Dispute)
                .options(selectinload(Dispute.evidence))
                .options(selectinload(Dispute.messages))
                .where(Dispute.id == dispute_id)
            )
            return result.scalar_one_or_none()
    
    async def create(self, dispute_data: Dict[str, Any]) -> Dispute:
        async with db_manager.session() as session:
            dispute = Dispute(
                id=dispute_data.get("id", str(uuid.uuid4())),
                escrow_id=dispute_data["escrow_id"],
                opened_by=dispute_data["opened_by"],
                opened_by_role=dispute_data["opened_by_role"],
                reason=DisputeReason(dispute_data["reason"]),
                description=dispute_data["description"],
                status=DisputeStatus.OPEN,
                evidence_deadline=datetime.utcnow() + timedelta(days=3),
            )
            session.add(dispute)
            await session.flush()
            return dispute
    
    async def update_status(self, dispute_id: str, status: DisputeStatus, **kwargs) -> Optional[Dispute]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Dispute).where(Dispute.id == dispute_id)
            )
            dispute = result.scalar_one_or_none()
            if dispute:
                dispute.status = status
                dispute.updated_at = datetime.utcnow()
                for key, value in kwargs.items():
                    if hasattr(dispute, key):
                        setattr(dispute, key, value)
                await session.flush()
            return dispute
    
    async def add_evidence(self, dispute_id: str, evidence_data: Dict[str, Any]) -> DisputeEvidence:
        async with db_manager.session() as session:
            evidence = DisputeEvidence(
                id=str(uuid.uuid4()),
                dispute_id=dispute_id,
                submitted_by=evidence_data["submitted_by"],
                submitted_by_role=evidence_data["submitted_by_role"],
                evidence_type=evidence_data["evidence_type"],
                file_url=evidence_data.get("file_url"),
                description=evidence_data.get("description"),
            )
            session.add(evidence)
            await session.flush()
            return evidence
    
    async def get_open_disputes(self, limit: int = 100) -> List[Dispute]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(Dispute)
                .where(Dispute.status.in_([DisputeStatus.OPEN, DisputeStatus.EVIDENCE_COLLECTION, DisputeStatus.UNDER_REVIEW]))
                .order_by(Dispute.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())


# ============================================
# Fraud Alert Repository
# ============================================

class FraudAlertRepository:
    """Repository for Fraud Alert entities"""
    
    async def create(self, alert_data: Dict[str, Any]) -> FraudAlert:
        async with db_manager.session() as session:
            alert = FraudAlert(
                id=alert_data.get("id", str(uuid.uuid4())),
                user_id=alert_data.get("user_id"),
                escrow_id=alert_data.get("escrow_id"),
                alert_type=alert_data["alert_type"],
                risk_level=FraudRiskLevel(alert_data["risk_level"]),
                risk_score=alert_data["risk_score"],
                detection_method=alert_data.get("detection_method", "rule"),
                detection_rule=alert_data.get("detection_rule"),
                evidence=alert_data.get("evidence", {}),
                description=alert_data.get("description"),
            )
            session.add(alert)
            await session.flush()
            return alert
    
    async def get_open_alerts(self, limit: int = 100) -> List[FraudAlert]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(FraudAlert)
                .where(FraudAlert.status == "open")
                .order_by(FraudAlert.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())
    
    async def resolve(self, alert_id: str, resolved_by: str, resolution_notes: str, action_taken: str = None) -> Optional[FraudAlert]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(FraudAlert).where(FraudAlert.id == alert_id)
            )
            alert = result.scalar_one_or_none()
            if alert:
                alert.status = "resolved"
                alert.resolved_by = resolved_by
                alert.resolution_notes = resolution_notes
                alert.action_taken = action_taken
                alert.resolved_at = datetime.utcnow()
                await session.flush()
            return alert


# ============================================
# Ledger Repository (PostgreSQL backup for TigerBeetle)
# ============================================

class LedgerRepository:
    """
    Repository for ledger entries.
    This is a PostgreSQL backup/audit trail for TigerBeetle transactions.
    """
    
    async def create_entry(self, entry_data: Dict[str, Any]) -> LedgerEntry:
        async with db_manager.session() as session:
            entry = LedgerEntry(
                id=entry_data.get("id", str(uuid.uuid4())),
                transaction_id=entry_data["transaction_id"],
                escrow_id=entry_data.get("escrow_id"),
                entry_type=LedgerEntryType(entry_data["entry_type"]),
                account_id=entry_data["account_id"],
                account_type=entry_data["account_type"],
                amount=entry_data["amount"],
                currency=entry_data.get("currency", "NGN"),
                balance_after=entry_data["balance_after"],
                reference=entry_data.get("reference"),
                description=entry_data.get("description"),
                idempotency_key=entry_data.get("idempotency_key"),
                extra_data=entry_data.get("extra_data", {}),
            )
            session.add(entry)
            await session.flush()
            return entry
    
    async def get_by_escrow(self, escrow_id: str) -> List[LedgerEntry]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(LedgerEntry)
                .where(LedgerEntry.escrow_id == escrow_id)
                .order_by(LedgerEntry.created_at)
            )
            return list(result.scalars().all())
    
    async def get_by_account(self, account_id: str, limit: int = 100) -> List[LedgerEntry]:
        async with db_manager.session() as session:
            result = await session.execute(
                select(LedgerEntry)
                .where(LedgerEntry.account_id == account_id)
                .order_by(LedgerEntry.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())


# ============================================
# Audit Log Repository
# ============================================

class AuditLogRepository:
    """Repository for audit logs"""
    
    async def log(self, log_data: Dict[str, Any]) -> AuditLog:
        async with db_manager.session() as session:
            log = AuditLog(
                id=str(uuid.uuid4()),
                actor_id=log_data["actor_id"],
                actor_type=log_data["actor_type"],
                action=log_data["action"],
                resource_type=log_data["resource_type"],
                resource_id=log_data["resource_id"],
                old_value=log_data.get("old_value"),
                new_value=log_data.get("new_value"),
                actor_ip=log_data.get("ip_address"),
                extra_data=log_data.get("extra_data", {}),
            )
            session.add(log)
            await session.flush()
            return log
    
    async def query(
        self,
        actor_id: str = None,
        resource_type: str = None,
        resource_id: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100
    ) -> List[AuditLog]:
        async with db_manager.session() as session:
            query = select(AuditLog)
            
            conditions = []
            if actor_id:
                conditions.append(AuditLog.actor_id == actor_id)
            if resource_type:
                conditions.append(AuditLog.resource_type == resource_type)
            if resource_id:
                conditions.append(AuditLog.resource_id == resource_id)
            if start_time:
                conditions.append(AuditLog.created_at >= start_time)
            if end_time:
                conditions.append(AuditLog.created_at <= end_time)
            
            if conditions:
                query = query.where(and_(*conditions))
            
            query = query.order_by(AuditLog.created_at.desc()).limit(limit)
            
            result = await session.execute(query)
            return list(result.scalars().all())


# ============================================
# Redis Cache Manager
# ============================================

class RedisCacheManager:
    """
    Redis cache for ephemeral data.
    
    Used for:
    - Session data
    - OTPs and verification codes
    - Rate limiting
    - Idempotency keys
    - Payout locks
    - Cached lookups (bank list, exchange rates)
    """
    
    def __init__(self):
        self.client = None
        self.connected = False
        self._fallback_cache: Dict[str, Any] = {}
    
    async def connect(self):
        """Connect to Redis"""
        try:
            import redis.asyncio as redis
            self.client = redis.from_url(REDIS_URL, decode_responses=True)
            await self.client.ping()
            self.connected = True
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory fallback.")
            self.connected = False
    
    async def get(self, key: str) -> Optional[str]:
        if self.connected and self.client:
            try:
                return await self.client.get(key)
            except Exception as e:
                logger.error(f"Redis get failed: {e}")
        return self._fallback_cache.get(key)
    
    async def set(self, key: str, value: str, ttl: int = None):
        if self.connected and self.client:
            try:
                if ttl:
                    await self.client.setex(key, ttl, value)
                else:
                    await self.client.set(key, value)
                return
            except Exception as e:
                logger.error(f"Redis set failed: {e}")
        self._fallback_cache[key] = value
    
    async def delete(self, key: str):
        if self.connected and self.client:
            try:
                await self.client.delete(key)
                return
            except Exception as e:
                logger.error(f"Redis delete failed: {e}")
        self._fallback_cache.pop(key, None)
    
    async def incr(self, key: str, ttl: int = None) -> int:
        """Increment counter (for rate limiting)"""
        if self.connected and self.client:
            try:
                value = await self.client.incr(key)
                if ttl and value == 1:
                    await self.client.expire(key, ttl)
                return value
            except Exception as e:
                logger.error(f"Redis incr failed: {e}")
        
        current = int(self._fallback_cache.get(key, 0))
        self._fallback_cache[key] = current + 1
        return current + 1
    
    async def acquire_lock(self, key: str, ttl: int = 30) -> bool:
        """Acquire distributed lock"""
        lock_key = f"lock:{key}"
        if self.connected and self.client:
            try:
                return await self.client.set(lock_key, "1", nx=True, ex=ttl)
            except Exception as e:
                logger.error(f"Redis lock failed: {e}")
        
        if lock_key not in self._fallback_cache:
            self._fallback_cache[lock_key] = True
            return True
        return False
    
    async def release_lock(self, key: str):
        """Release distributed lock"""
        await self.delete(f"lock:{key}")
    
    async def set_json(self, key: str, value: Any, ttl: int = None):
        """Store JSON-serializable value"""
        await self.set(key, json.dumps(value), ttl)
    
    async def get_json(self, key: str) -> Optional[Any]:
        """Get JSON value"""
        data = await self.get(key)
        if data:
            return json.loads(data)
        return None


# ============================================
# Marketplace Repository (Sellers, Listings, Reviews)
# ============================================

class MarketplaceRepository:
    """Repository for marketplace entities using Redis + PostgreSQL"""
    
    def __init__(self, cache_manager: RedisCacheManager):
        self.cache = cache_manager
    
    async def get_seller(self, seller_id: str) -> Optional[Dict[str, Any]]:
        """Get seller profile from cache or database"""
        cached = await self.cache.get_json(f"seller:{seller_id}")
        if cached:
            return cached
        # Fallback to database query if needed
        return None
    
    async def save_seller(self, seller_id: str, data: Dict[str, Any], ttl: int = 3600):
        """Save seller profile to cache"""
        await self.cache.set_json(f"seller:{seller_id}", data, ttl)
    
    async def get_listing(self, listing_id: str) -> Optional[Dict[str, Any]]:
        """Get listing from cache"""
        return await self.cache.get_json(f"listing:{listing_id}")
    
    async def save_listing(self, listing_id: str, data: Dict[str, Any], ttl: int = 3600):
        """Save listing to cache"""
        await self.cache.set_json(f"listing:{listing_id}", data, ttl)
    
    async def get_reviews(self, seller_id: str) -> List[Dict[str, Any]]:
        """Get seller reviews"""
        data = await self.cache.get_json(f"reviews:{seller_id}")
        return data if data else []
    
    async def add_review(self, seller_id: str, review: Dict[str, Any]):
        """Add review for seller"""
        reviews = await self.get_reviews(seller_id)
        reviews.append(review)
        await self.cache.set_json(f"reviews:{seller_id}", reviews, ttl=86400)


# ============================================
# Growth Wallet Repository
# ============================================

class GrowthWalletRepository:
    """Repository for growth wallet data"""
    
    def __init__(self, cache_manager: RedisCacheManager):
        self.cache = cache_manager
    
    async def get_wallet(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's growth wallet"""
        return await self.cache.get_json(f"wallet:{user_id}")
    
    async def save_wallet(self, user_id: str, data: Dict[str, Any]):
        """Save wallet data (no TTL - persistent)"""
        await self.cache.set_json(f"wallet:{user_id}", data)
    
    async def get_active_services(self, user_id: str) -> Dict[str, Any]:
        """Get user's active services"""
        data = await self.cache.get_json(f"services:{user_id}")
        return data if data else {}
    
    async def save_active_services(self, user_id: str, services: Dict[str, Any]):
        """Save active services"""
        await self.cache.set_json(f"services:{user_id}", services)


# ============================================
# Loyalty Points Repository
# ============================================

class LoyaltyRepository:
    """Repository for loyalty points and buyer profiles"""
    
    def __init__(self, cache_manager: RedisCacheManager):
        self.cache = cache_manager
    
    async def get_buyer_profile(self, buyer_id: str) -> Optional[Dict[str, Any]]:
        """Get buyer loyalty profile"""
        return await self.cache.get_json(f"loyalty:{buyer_id}")
    
    async def save_buyer_profile(self, buyer_id: str, data: Dict[str, Any]):
        """Save buyer loyalty profile"""
        await self.cache.set_json(f"loyalty:{buyer_id}", data)
    
    async def get_redemption(self, redemption_id: str) -> Optional[Dict[str, Any]]:
        """Get redemption record"""
        return await self.cache.get_json(f"redemption:{redemption_id}")
    
    async def save_redemption(self, redemption_id: str, data: Dict[str, Any]):
        """Save redemption record"""
        await self.cache.set_json(f"redemption:{redemption_id}", data)
    
    async def add_points(self, buyer_id: str, points: int, reason: str):
        """Add points to buyer profile"""
        profile = await self.get_buyer_profile(buyer_id) or {"points": 0, "history": []}
        profile["points"] = profile.get("points", 0) + points
        profile["history"] = profile.get("history", [])
        profile["history"].append({
            "points": points,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat()
        })
        await self.save_buyer_profile(buyer_id, profile)


# ============================================
# Session Repository (WhatsApp, USSD)
# ============================================

class SessionRepository:
    """Repository for session data (WhatsApp, USSD) using Redis"""
    
    def __init__(self, cache_manager: RedisCacheManager):
        self.cache = cache_manager
    
    async def get_whatsapp_session(self, phone: str) -> Optional[Dict[str, Any]]:
        """Get WhatsApp session"""
        return await self.cache.get_json(f"wa_session:{phone}")
    
    async def save_whatsapp_session(self, phone: str, data: Dict[str, Any], ttl: int = 3600):
        """Save WhatsApp session (1 hour TTL)"""
        await self.cache.set_json(f"wa_session:{phone}", data, ttl)
    
    async def delete_whatsapp_session(self, phone: str):
        """Delete WhatsApp session"""
        await self.cache.delete(f"wa_session:{phone}")
    
    async def get_ussd_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get USSD session"""
        return await self.cache.get_json(f"ussd_session:{session_id}")
    
    async def save_ussd_session(self, session_id: str, data: Dict[str, Any], ttl: int = 300):
        """Save USSD session (5 minute TTL)"""
        await self.cache.set_json(f"ussd_session:{session_id}", data, ttl)
    
    async def delete_ussd_session(self, session_id: str):
        """Delete USSD session"""
        await self.cache.delete(f"ussd_session:{session_id}")


# ============================================
# Agent Network Repository
# ============================================

class AgentRepository:
    """Repository for agent network data"""
    
    def __init__(self, cache_manager: RedisCacheManager):
        self.cache = cache_manager
    
    async def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get agent profile"""
        return await self.cache.get_json(f"agent:{agent_id}")
    
    async def save_agent(self, agent_id: str, data: Dict[str, Any]):
        """Save agent profile"""
        await self.cache.set_json(f"agent:{agent_id}", data)
    
    async def get_cash_transaction(self, txn_id: str) -> Optional[Dict[str, Any]]:
        """Get cash transaction"""
        return await self.cache.get_json(f"cash_txn:{txn_id}")
    
    async def save_cash_transaction(self, txn_id: str, data: Dict[str, Any]):
        """Save cash transaction"""
        await self.cache.set_json(f"cash_txn:{txn_id}", data)
    
    async def find_nearby_agents(self, lat: float, lon: float, radius_km: float = 5.0) -> List[Dict[str, Any]]:
        """Find agents near a location (simplified - in production use PostGIS)"""
        # This is a simplified implementation
        # In production, use PostGIS or a geospatial index
        return []


# Global instances
user_repo = UserRepository()
escrow_repo = EscrowRepository()
merchant_repo = MerchantRepository()
dispute_repo = DisputeRepository()
fraud_alert_repo = FraudAlertRepository()
ledger_repo = LedgerRepository()
audit_log_repo = AuditLogRepository()
cache = RedisCacheManager()

# Additional repositories (initialized after cache)
marketplace_repo: Optional[MarketplaceRepository] = None
growth_wallet_repo: Optional[GrowthWalletRepository] = None
loyalty_repo: Optional[LoyaltyRepository] = None
session_repo: Optional[SessionRepository] = None
agent_repo: Optional[AgentRepository] = None


def get_marketplace_repo() -> MarketplaceRepository:
    """Get marketplace repository (lazy initialization)"""
    global marketplace_repo
    if marketplace_repo is None:
        marketplace_repo = MarketplaceRepository(cache)
    return marketplace_repo


def get_growth_wallet_repo() -> GrowthWalletRepository:
    """Get growth wallet repository (lazy initialization)"""
    global growth_wallet_repo
    if growth_wallet_repo is None:
        growth_wallet_repo = GrowthWalletRepository(cache)
    return growth_wallet_repo


def get_loyalty_repo() -> LoyaltyRepository:
    """Get loyalty repository (lazy initialization)"""
    global loyalty_repo
    if loyalty_repo is None:
        loyalty_repo = LoyaltyRepository(cache)
    return loyalty_repo


def get_session_repo() -> SessionRepository:
    """Get session repository (lazy initialization)"""
    global session_repo
    if session_repo is None:
        session_repo = SessionRepository(cache)
    return session_repo


def get_agent_repo() -> AgentRepository:
    """Get agent repository (lazy initialization)"""
    global agent_repo
    if agent_repo is None:
        agent_repo = AgentRepository(cache)
    return agent_repo


# ============================================
# Initialization
# ============================================

async def init_persistence():
    """Initialize all persistence layers"""
    await db_manager.init_db()
    await cache.connect()
    logger.info("Persistence layers initialized")


async def health_check() -> Dict[str, Any]:
    """Check health of all persistence layers"""
    db_health = await db_manager.health_check()
    
    redis_health = {"status": "healthy" if cache.connected else "fallback"}
    
    return {
        "database": db_health,
        "cache": redis_health,
        "allow_inmemory_fallback": ALLOW_INMEMORY_FALLBACK
    }
