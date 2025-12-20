"""
GraphQL Federation Layer for EscrowProtect Platform

Provides a unified GraphQL API over existing FastAPI endpoints:
- Read-first queries with dataloaders to avoid N+1
- Safe mutations for escrow operations
- Federation-ready schema with Apollo Federation directives
- Subscription support for real-time updates

Designed to be additive - REST endpoints remain the primary interface.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)

# Configuration
GRAPHQL_ENABLED = os.getenv("GRAPHQL_ENABLED", "true").lower() == "true"
GRAPHQL_INTROSPECTION = os.getenv("GRAPHQL_INTROSPECTION", "true").lower() == "true"
GRAPHQL_PLAYGROUND = os.getenv("GRAPHQL_PLAYGROUND", "true").lower() == "true"


# =============================================================================
# SCHEMA TYPES
# =============================================================================

@dataclass
class Money:
    """Monetary value with currency"""
    amount: int  # In smallest unit (kobo for NGN)
    currency: str
    formatted: str = ""
    
    def __post_init__(self):
        if not self.formatted:
            symbols = {"NGN": "₦", "GHS": "GH₵", "KES": "KES", "ZAR": "R", "USD": "$"}
            symbol = symbols.get(self.currency, self.currency)
            self.formatted = f"{symbol}{self.amount / 100:,.2f}"


@dataclass
class User:
    """User entity (Federation key: id)"""
    id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    kyc_tier: int = 0
    created_at: Optional[str] = None
    
    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or "Unknown"


@dataclass
class Seller:
    """Seller profile (extends User)"""
    user_id: str
    handle: Optional[str] = None
    platform: Optional[str] = None
    rating: float = 0.0
    transaction_count: int = 0
    verified: bool = False
    tier: str = "bronze"


@dataclass
class Escrow:
    """Escrow transaction entity (Federation key: id)"""
    id: str
    buyer_id: str
    seller_id: str
    amount: Money = None
    platform_fee: Money = None
    insurance_fee: Optional[Money] = None
    status: str = "pending"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    expires_at: Optional[str] = None
    listing_text: Optional[str] = None
    source_url: Optional[str] = None
    delivery_confirmed_at: Optional[str] = None
    released_at: Optional[str] = None
    refunded_at: Optional[str] = None


@dataclass
class Dispute:
    """Dispute entity"""
    id: str
    escrow_id: str
    initiator_id: str
    reason: str
    status: str = "open"
    resolution: Optional[str] = None
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None


@dataclass
class Transaction:
    """Ledger transaction"""
    id: str
    escrow_id: str
    type: str
    amount: Money = None
    from_account: str = ""
    to_account: str = ""
    status: str = "pending"
    created_at: Optional[str] = None


# =============================================================================
# DATALOADERS
# =============================================================================

class DataLoader:
    """
    Generic dataloader for batching and caching database queries.
    Prevents N+1 query problems in GraphQL resolvers.
    """
    
    def __init__(self, batch_fn):
        self.batch_fn = batch_fn
        self.cache: Dict[str, Any] = {}
        self.queue: List[str] = []
        self.pending: Optional[asyncio.Future] = None
    
    async def load(self, key: str) -> Any:
        """Load a single item by key"""
        if key in self.cache:
            return self.cache[key]
        
        self.queue.append(key)
        
        if self.pending is None:
            self.pending = asyncio.get_event_loop().create_future()
            asyncio.get_event_loop().call_soon(self._dispatch)
        
        await self.pending
        return self.cache.get(key)
    
    async def load_many(self, keys: List[str]) -> List[Any]:
        """Load multiple items by keys"""
        return [await self.load(key) for key in keys]
    
    def _dispatch(self):
        """Dispatch batched query"""
        keys = self.queue.copy()
        self.queue.clear()
        
        async def execute():
            try:
                results = await self.batch_fn(keys)
                for key, result in zip(keys, results):
                    self.cache[key] = result
            finally:
                if self.pending:
                    self.pending.set_result(None)
                    self.pending = None
        
        asyncio.create_task(execute())
    
    def clear(self, key: Optional[str] = None):
        """Clear cache"""
        if key:
            self.cache.pop(key, None)
        else:
            self.cache.clear()


class EscrowDataLoader(DataLoader):
    """Dataloader for escrow entities"""
    
    def __init__(self, escrow_service):
        self.escrow_service = escrow_service
        super().__init__(self._batch_load)
    
    async def _batch_load(self, ids: List[str]) -> List[Optional[Escrow]]:
        """Batch load escrows by IDs"""
        # In production, this would query the database
        results = []
        for escrow_id in ids:
            try:
                escrow_data = await self.escrow_service.get_escrow(escrow_id)
                if escrow_data:
                    results.append(Escrow(
                        id=escrow_data.get("id"),
                        buyer_id=escrow_data.get("buyer_id"),
                        seller_id=escrow_data.get("seller_id"),
                        amount=Money(
                            amount=escrow_data.get("amount_kobo", 0),
                            currency=escrow_data.get("currency", "NGN"),
                        ),
                        status=escrow_data.get("status", "pending"),
                        created_at=escrow_data.get("created_at"),
                    ))
                else:
                    results.append(None)
            except Exception as e:
                logger.error(f"Failed to load escrow {escrow_id}: {e}")
                results.append(None)
        return results


class UserDataLoader(DataLoader):
    """Dataloader for user entities"""
    
    def __init__(self, user_service):
        self.user_service = user_service
        super().__init__(self._batch_load)
    
    async def _batch_load(self, ids: List[str]) -> List[Optional[User]]:
        """Batch load users by IDs"""
        results = []
        for user_id in ids:
            try:
                user_data = await self.user_service.get_user(user_id)
                if user_data:
                    results.append(User(
                        id=user_data.get("id"),
                        phone=user_data.get("phone"),
                        email=user_data.get("email"),
                        first_name=user_data.get("first_name"),
                        last_name=user_data.get("last_name"),
                        kyc_tier=user_data.get("kyc_tier", 0),
                    ))
                else:
                    results.append(None)
            except Exception as e:
                logger.error(f"Failed to load user {user_id}: {e}")
                results.append(None)
        return results


# =============================================================================
# RESOLVERS
# =============================================================================

class GraphQLResolvers:
    """
    GraphQL resolvers for EscrowProtect schema.
    Uses dataloaders for efficient data fetching.
    """
    
    def __init__(self, escrow_service=None, user_service=None, ledger_service=None):
        self.escrow_service = escrow_service
        self.user_service = user_service
        self.ledger_service = ledger_service
        
        # Initialize dataloaders
        self.escrow_loader = EscrowDataLoader(escrow_service) if escrow_service else None
        self.user_loader = UserDataLoader(user_service) if user_service else None
    
    # Query resolvers
    
    async def resolve_escrow(self, info, id: str) -> Optional[Escrow]:
        """Resolve single escrow by ID"""
        if self.escrow_loader:
            return await self.escrow_loader.load(id)
        return None
    
    async def resolve_escrows(
        self, 
        info, 
        buyer_id: Optional[str] = None,
        seller_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Escrow]:
        """Resolve list of escrows with filters"""
        if not self.escrow_service:
            return []
        
        try:
            escrows = await self.escrow_service.list_escrows(
                buyer_id=buyer_id,
                seller_id=seller_id,
                status=status,
                limit=limit,
                offset=offset,
            )
            return [
                Escrow(
                    id=e.get("id"),
                    buyer_id=e.get("buyer_id"),
                    seller_id=e.get("seller_id"),
                    amount=Money(
                        amount=e.get("amount_kobo", 0),
                        currency=e.get("currency", "NGN"),
                    ),
                    status=e.get("status", "pending"),
                    created_at=e.get("created_at"),
                )
                for e in escrows
            ]
        except Exception as e:
            logger.error(f"Failed to list escrows: {e}")
            return []
    
    async def resolve_user(self, info, id: str) -> Optional[User]:
        """Resolve single user by ID"""
        if self.user_loader:
            return await self.user_loader.load(id)
        return None
    
    async def resolve_me(self, info) -> Optional[User]:
        """Resolve current authenticated user"""
        # Get user from context
        user_id = info.context.get("user_id") if hasattr(info, "context") else None
        if user_id and self.user_loader:
            return await self.user_loader.load(user_id)
        return None
    
    async def resolve_transactions(
        self,
        info,
        escrow_id: str,
        limit: int = 50,
    ) -> List[Transaction]:
        """Resolve transactions for an escrow"""
        if not self.ledger_service:
            return []
        
        try:
            txns = await self.ledger_service.get_escrow_transactions(escrow_id)
            return [
                Transaction(
                    id=t.get("id"),
                    escrow_id=escrow_id,
                    type=t.get("type"),
                    amount=Money(
                        amount=t.get("amount_kobo", 0),
                        currency=t.get("currency", "NGN"),
                    ),
                    from_account=t.get("from_account", ""),
                    to_account=t.get("to_account", ""),
                    status=t.get("status", "pending"),
                    created_at=t.get("created_at"),
                )
                for t in txns
            ]
        except Exception as e:
            logger.error(f"Failed to get transactions: {e}")
            return []
    
    # Mutation resolvers
    
    async def resolve_create_escrow(
        self,
        info,
        buyer_id: str,
        seller_id: str,
        amount_kobo: int,
        currency: str = "NGN",
        listing_text: Optional[str] = None,
        source_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create new escrow transaction"""
        if not self.escrow_service:
            return {"success": False, "error": "Escrow service not available"}
        
        try:
            result = await self.escrow_service.create_escrow(
                buyer_id=buyer_id,
                seller_id=seller_id,
                amount_kobo=amount_kobo,
                currency=currency,
                listing_text=listing_text,
                source_url=source_url,
                idempotency_key=idempotency_key,
            )
            
            # Clear cache
            if self.escrow_loader:
                self.escrow_loader.clear()
            
            return {
                "success": True,
                "escrow": Escrow(
                    id=result.get("id"),
                    buyer_id=buyer_id,
                    seller_id=seller_id,
                    amount=Money(amount=amount_kobo, currency=currency),
                    status="pending",
                    created_at=result.get("created_at"),
                ),
            }
        except Exception as e:
            logger.error(f"Failed to create escrow: {e}")
            return {"success": False, "error": str(e)}
    
    async def resolve_confirm_delivery(
        self,
        info,
        escrow_id: str,
        confirmation_type: str,  # "buyer" or "seller"
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Confirm delivery for escrow"""
        if not self.escrow_service:
            return {"success": False, "error": "Escrow service not available"}
        
        try:
            result = await self.escrow_service.confirm_delivery(
                escrow_id=escrow_id,
                confirmation_type=confirmation_type,
                notes=notes,
            )
            
            # Clear cache
            if self.escrow_loader:
                self.escrow_loader.clear(escrow_id)
            
            return {"success": True, "escrow_id": escrow_id}
        except Exception as e:
            logger.error(f"Failed to confirm delivery: {e}")
            return {"success": False, "error": str(e)}
    
    async def resolve_release_escrow(
        self,
        info,
        escrow_id: str,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Release escrow funds to seller"""
        if not self.escrow_service:
            return {"success": False, "error": "Escrow service not available"}
        
        try:
            result = await self.escrow_service.release_escrow(
                escrow_id=escrow_id,
                idempotency_key=idempotency_key,
            )
            
            if self.escrow_loader:
                self.escrow_loader.clear(escrow_id)
            
            return {"success": True, "escrow_id": escrow_id, "transaction_id": result.get("transaction_id")}
        except Exception as e:
            logger.error(f"Failed to release escrow: {e}")
            return {"success": False, "error": str(e)}
    
    async def resolve_refund_escrow(
        self,
        info,
        escrow_id: str,
        reason: str,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Refund escrow to buyer"""
        if not self.escrow_service:
            return {"success": False, "error": "Escrow service not available"}
        
        try:
            result = await self.escrow_service.refund_escrow(
                escrow_id=escrow_id,
                reason=reason,
                idempotency_key=idempotency_key,
            )
            
            if self.escrow_loader:
                self.escrow_loader.clear(escrow_id)
            
            return {"success": True, "escrow_id": escrow_id, "transaction_id": result.get("transaction_id")}
        except Exception as e:
            logger.error(f"Failed to refund escrow: {e}")
            return {"success": False, "error": str(e)}
    
    async def resolve_create_dispute(
        self,
        info,
        escrow_id: str,
        reason: str,
        evidence: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create dispute for escrow"""
        if not self.escrow_service:
            return {"success": False, "error": "Escrow service not available"}
        
        user_id = info.context.get("user_id") if hasattr(info, "context") else None
        
        try:
            result = await self.escrow_service.create_dispute(
                escrow_id=escrow_id,
                initiator_id=user_id,
                reason=reason,
                evidence=evidence,
            )
            
            return {
                "success": True,
                "dispute": Dispute(
                    id=result.get("id"),
                    escrow_id=escrow_id,
                    initiator_id=user_id,
                    reason=reason,
                    status="open",
                    created_at=result.get("created_at"),
                ),
            }
        except Exception as e:
            logger.error(f"Failed to create dispute: {e}")
            return {"success": False, "error": str(e)}


# =============================================================================
# SCHEMA DEFINITION (SDL)
# =============================================================================

GRAPHQL_SCHEMA = """
# Federation directives
directive @key(fields: String!) on OBJECT | INTERFACE
directive @extends on OBJECT | INTERFACE
directive @external on FIELD_DEFINITION
directive @requires(fields: String!) on FIELD_DEFINITION
directive @provides(fields: String!) on FIELD_DEFINITION

# Scalar types
scalar DateTime
scalar JSON

# Money type
type Money {
    amount: Int!
    currency: String!
    formatted: String!
}

# User entity (Federation key)
type User @key(fields: "id") {
    id: ID!
    phone: String
    email: String
    firstName: String
    lastName: String
    fullName: String!
    kycTier: Int!
    createdAt: DateTime
}

# Seller profile
type Seller {
    userId: ID!
    handle: String
    platform: String
    rating: Float!
    transactionCount: Int!
    verified: Boolean!
    tier: String!
    user: User
}

# Escrow entity (Federation key)
type Escrow @key(fields: "id") {
    id: ID!
    buyerId: ID!
    sellerId: ID!
    buyer: User
    seller: User
    amount: Money!
    platformFee: Money
    insuranceFee: Money
    status: EscrowStatus!
    createdAt: DateTime
    updatedAt: DateTime
    expiresAt: DateTime
    listingText: String
    sourceUrl: String
    deliveryConfirmedAt: DateTime
    releasedAt: DateTime
    refundedAt: DateTime
    transactions: [Transaction!]!
    disputes: [Dispute!]!
}

# Escrow status enum
enum EscrowStatus {
    PENDING
    FUNDED
    DELIVERED
    RELEASED
    REFUNDED
    DISPUTED
    EXPIRED
    CANCELLED
}

# Transaction type
type Transaction {
    id: ID!
    escrowId: ID!
    type: TransactionType!
    amount: Money!
    fromAccount: String!
    toAccount: String!
    status: String!
    createdAt: DateTime
}

enum TransactionType {
    ESCROW_HOLD
    ESCROW_RELEASE
    ESCROW_REFUND
    PLATFORM_FEE
    INSURANCE_FEE
}

# Dispute type
type Dispute {
    id: ID!
    escrowId: ID!
    escrow: Escrow
    initiatorId: ID!
    initiator: User
    reason: String!
    status: DisputeStatus!
    resolution: String
    createdAt: DateTime
    resolvedAt: DateTime
}

enum DisputeStatus {
    OPEN
    UNDER_REVIEW
    RESOLVED
    ESCALATED
    CLOSED
}

# Mutation results
type CreateEscrowResult {
    success: Boolean!
    escrow: Escrow
    error: String
}

type ConfirmDeliveryResult {
    success: Boolean!
    escrowId: ID
    error: String
}

type ReleaseEscrowResult {
    success: Boolean!
    escrowId: ID
    transactionId: ID
    error: String
}

type RefundEscrowResult {
    success: Boolean!
    escrowId: ID
    transactionId: ID
    error: String
}

type CreateDisputeResult {
    success: Boolean!
    dispute: Dispute
    error: String
}

# Queries
type Query {
    # Get current user
    me: User
    
    # Get user by ID
    user(id: ID!): User
    
    # Get escrow by ID
    escrow(id: ID!): Escrow
    
    # List escrows with filters
    escrows(
        buyerId: ID
        sellerId: ID
        status: EscrowStatus
        limit: Int = 20
        offset: Int = 0
    ): [Escrow!]!
    
    # Get transactions for escrow
    transactions(escrowId: ID!, limit: Int = 50): [Transaction!]!
    
    # Get disputes for escrow
    disputes(escrowId: ID!): [Dispute!]!
    
    # Platform statistics
    platformStats: PlatformStats
}

type PlatformStats {
    totalEscrows: Int!
    totalVolume: Money!
    activeEscrows: Int!
    disputeRate: Float!
}

# Mutations
type Mutation {
    # Create new escrow
    createEscrow(
        buyerId: ID!
        sellerId: ID!
        amountKobo: Int!
        currency: String = "NGN"
        listingText: String
        sourceUrl: String
        idempotencyKey: String
    ): CreateEscrowResult!
    
    # Confirm delivery
    confirmDelivery(
        escrowId: ID!
        confirmationType: String!
        notes: String
    ): ConfirmDeliveryResult!
    
    # Release escrow to seller
    releaseEscrow(
        escrowId: ID!
        idempotencyKey: String
    ): ReleaseEscrowResult!
    
    # Refund escrow to buyer
    refundEscrow(
        escrowId: ID!
        reason: String!
        idempotencyKey: String
    ): RefundEscrowResult!
    
    # Create dispute
    createDispute(
        escrowId: ID!
        reason: String!
        evidence: String
    ): CreateDisputeResult!
}

# Subscriptions
type Subscription {
    # Subscribe to escrow status changes
    escrowStatusChanged(escrowId: ID!): Escrow
    
    # Subscribe to new messages in dispute
    disputeMessageAdded(disputeId: ID!): DisputeMessage
}

type DisputeMessage {
    id: ID!
    disputeId: ID!
    senderId: ID!
    message: String!
    createdAt: DateTime!
}
"""


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

def create_graphql_app(
    escrow_service=None,
    user_service=None,
    ledger_service=None,
):
    """
    Create GraphQL application for FastAPI integration.
    
    Usage:
        from graphql_layer import create_graphql_app
        
        graphql_app = create_graphql_app(
            escrow_service=escrow_service,
            user_service=user_service,
            ledger_service=ledger_service,
        )
        
        app.include_router(graphql_app, prefix="/graphql")
    """
    try:
        from ariadne import make_executable_schema, QueryType, MutationType
        from ariadne.asgi import GraphQL
        
        resolvers = GraphQLResolvers(
            escrow_service=escrow_service,
            user_service=user_service,
            ledger_service=ledger_service,
        )
        
        query = QueryType()
        mutation = MutationType()
        
        # Bind query resolvers
        query.set_field("me", resolvers.resolve_me)
        query.set_field("user", resolvers.resolve_user)
        query.set_field("escrow", resolvers.resolve_escrow)
        query.set_field("escrows", resolvers.resolve_escrows)
        query.set_field("transactions", resolvers.resolve_transactions)
        
        # Bind mutation resolvers
        mutation.set_field("createEscrow", resolvers.resolve_create_escrow)
        mutation.set_field("confirmDelivery", resolvers.resolve_confirm_delivery)
        mutation.set_field("releaseEscrow", resolvers.resolve_release_escrow)
        mutation.set_field("refundEscrow", resolvers.resolve_refund_escrow)
        mutation.set_field("createDispute", resolvers.resolve_create_dispute)
        
        schema = make_executable_schema(GRAPHQL_SCHEMA, query, mutation)
        
        return GraphQL(
            schema,
            debug=GRAPHQL_PLAYGROUND,
            introspection=GRAPHQL_INTROSPECTION,
        )
        
    except ImportError:
        logger.warning("Ariadne not installed, GraphQL disabled")
        return None


async def graphql_health() -> Dict[str, Any]:
    """Get GraphQL health status"""
    return {
        "enabled": GRAPHQL_ENABLED,
        "introspection": GRAPHQL_INTROSPECTION,
        "playground": GRAPHQL_PLAYGROUND,
    }
