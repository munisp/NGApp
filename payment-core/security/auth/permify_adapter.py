"""
Permify Authorization Adapter for Payment Switch Platform

Provides fine-grained RBAC/ABAC authorization using Permify.
"""

import httpx
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class PermifyConfig:
    """Permify connection configuration"""
    url: str
    tenant_id: str = "payment-switch"
    api_key: Optional[str] = None
    verify_ssl: bool = True


@dataclass
class Entity:
    """Permify entity"""
    type: str
    id: str


@dataclass
class Subject:
    """Permify subject"""
    type: str
    id: str
    relation: Optional[str] = None


@dataclass
class Tuple:
    """Relationship tuple"""
    entity: Entity
    relation: str
    subject: Subject

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "entity": {"type": self.entity.type, "id": self.entity.id},
            "relation": self.relation,
            "subject": {"type": self.subject.type, "id": self.subject.id},
        }
        if self.subject.relation:
            result["subject"]["relation"] = self.subject.relation
        return result


@dataclass
class CheckRequest:
    """Permission check request"""
    entity: Entity
    permission: str
    subject: Subject
    tenant_id: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None


@dataclass
class CheckResponse:
    """Permission check response"""
    can: bool
    remaining_depth: Optional[int] = None


@dataclass
class WriteResponse:
    """Relationship write response"""
    snap_token: str


@dataclass
class LookupEntityRequest:
    """Entity lookup request"""
    entity_type: str
    permission: str
    subject: Subject
    tenant_id: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None


@dataclass
class LookupEntityResponse:
    """Entity lookup response"""
    entity_ids: List[str]


class PermifyAdapter:
    """Permify authorization adapter"""

    def __init__(self, config: PermifyConfig):
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers = {"Content-Type": "application/json"}
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            self._client = httpx.AsyncClient(
                timeout=10.0,
                verify=self.config.verify_ssl,
                headers=headers
            )
        return self._client

    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def check(self, req: CheckRequest) -> CheckResponse:
        """Perform a permission check"""
        tenant_id = req.tenant_id or self.config.tenant_id
        url = f"{self.config.url}/v1/tenants/{tenant_id}/permissions/check"

        payload = {
            "tenant_id": tenant_id,
            "entity": {"type": req.entity.type, "id": req.entity.id},
            "permission": req.permission,
            "subject": {"type": req.subject.type, "id": req.subject.id},
        }
        if req.subject.relation:
            payload["subject"]["relation"] = req.subject.relation
        if req.metadata:
            payload["metadata"] = req.metadata

        response = await self.client.post(url, json=payload)

        if response.status_code != 200:
            logger.error(f"Permission check failed: {response.text}")
            raise Exception(f"Permission check failed: {response.status_code}")

        result = response.json()
        return CheckResponse(
            can=result.get("can", False),
            remaining_depth=result.get("remaining_depth"),
        )

    async def write_relationships(self, tuples: List[Tuple]) -> WriteResponse:
        """Write relationship tuples"""
        url = f"{self.config.url}/v1/tenants/{self.config.tenant_id}/relationships/write"

        payload = {
            "tenant_id": self.config.tenant_id,
            "tuples": [t.to_dict() for t in tuples],
        }

        response = await self.client.post(url, json=payload)

        if response.status_code != 200:
            logger.error(f"Write relationships failed: {response.text}")
            raise Exception(f"Write relationships failed: {response.status_code}")

        result = response.json()
        return WriteResponse(snap_token=result.get("snap_token", ""))

    async def delete_relationships(self, tuples: List[Tuple]) -> None:
        """Delete relationship tuples"""
        url = f"{self.config.url}/v1/tenants/{self.config.tenant_id}/relationships/delete"

        payload = {
            "tenant_id": self.config.tenant_id,
            "tuples": [t.to_dict() for t in tuples],
        }

        response = await self.client.post(url, json=payload)

        if response.status_code != 200:
            logger.error(f"Delete relationships failed: {response.text}")
            raise Exception(f"Delete relationships failed: {response.status_code}")

    async def lookup_entities(self, req: LookupEntityRequest) -> LookupEntityResponse:
        """Look up entities a subject has permission on"""
        tenant_id = req.tenant_id or self.config.tenant_id
        url = f"{self.config.url}/v1/tenants/{tenant_id}/permissions/lookup-entity"

        payload = {
            "tenant_id": tenant_id,
            "entity_type": req.entity_type,
            "permission": req.permission,
            "subject": {"type": req.subject.type, "id": req.subject.id},
        }
        if req.subject.relation:
            payload["subject"]["relation"] = req.subject.relation
        if req.metadata:
            payload["metadata"] = req.metadata

        response = await self.client.post(url, json=payload)

        if response.status_code != 200:
            logger.error(f"Lookup entities failed: {response.text}")
            raise Exception(f"Lookup entities failed: {response.status_code}")

        result = response.json()
        return LookupEntityResponse(entity_ids=result.get("entity_ids", []))

    # Payment Switch specific helper methods

    async def can_access_merchant(
        self,
        user_id: str,
        merchant_id: str,
        permission: str = "view"
    ) -> bool:
        """Check if a user can access a merchant"""
        result = await self.check(CheckRequest(
            entity=Entity(type="merchant", id=merchant_id),
            permission=permission,
            subject=Subject(type="user", id=user_id),
        ))
        return result.can

    async def can_access_transaction(
        self,
        user_id: str,
        transaction_id: str,
        permission: str = "view"
    ) -> bool:
        """Check if a user can access a transaction"""
        result = await self.check(CheckRequest(
            entity=Entity(type="transaction", id=transaction_id),
            permission=permission,
            subject=Subject(type="user", id=user_id),
        ))
        return result.can

    async def assign_user_to_merchant(
        self,
        user_id: str,
        merchant_id: str,
        role: str = "member"
    ) -> None:
        """Assign a user to a merchant with a role"""
        await self.write_relationships([
            Tuple(
                entity=Entity(type="merchant", id=merchant_id),
                relation=role,
                subject=Subject(type="user", id=user_id),
            )
        ])

    async def remove_user_from_merchant(
        self,
        user_id: str,
        merchant_id: str,
        role: str = "member"
    ) -> None:
        """Remove a user from a merchant"""
        await self.delete_relationships([
            Tuple(
                entity=Entity(type="merchant", id=merchant_id),
                relation=role,
                subject=Subject(type="user", id=user_id),
            )
        ])

    async def get_user_merchants(
        self,
        user_id: str,
        permission: str = "view"
    ) -> List[str]:
        """Get all merchants a user has access to"""
        result = await self.lookup_entities(LookupEntityRequest(
            entity_type="merchant",
            permission=permission,
            subject=Subject(type="user", id=user_id),
        ))
        return result.entity_ids


# Singleton instance for convenience
_permify_adapter: Optional[PermifyAdapter] = None


def get_permify_adapter() -> PermifyAdapter:
    """Get the global Permify adapter instance"""
    global _permify_adapter
    if _permify_adapter is None:
        import os
        config = PermifyConfig(
            url=os.getenv("PERMIFY_URL", "http://permify:3476"),
            tenant_id=os.getenv("PERMIFY_TENANT_ID", "payment-switch"),
            api_key=os.getenv("PERMIFY_API_KEY"),
        )
        _permify_adapter = PermifyAdapter(config)
    return _permify_adapter


def init_permify_adapter(config: PermifyConfig) -> PermifyAdapter:
    """Initialize the global Permify adapter with custom config"""
    global _permify_adapter
    _permify_adapter = PermifyAdapter(config)
    return _permify_adapter
