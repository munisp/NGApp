"""
Permify Authorization Schema for SocialEscrow Platform

This module defines the authorization model for fine-grained access control
using Permify. It includes entity definitions, relationships, and permissions.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Permify Schema Definition (in Permify's schema language)
PERMIFY_SCHEMA = """
entity user {}

entity escrow {
    relation buyer @user
    relation seller @user
    relation arbiter @user
    relation platform_admin @user
    
    permission view = buyer or seller or arbiter or platform_admin
    permission accept = seller
    permission ship = seller
    permission confirm_delivery = buyer
    permission dispute = buyer or seller
    permission resolve_dispute = arbiter or platform_admin
    permission cancel = buyer and not seller_accepted
    permission refund = platform_admin or (arbiter and disputed)
    permission release = platform_admin or (buyer and shipped)
    
    attribute seller_accepted boolean
    attribute disputed boolean
    attribute shipped boolean
}

entity dispute {
    relation escrow @escrow
    relation opener @user
    relation assigned_arbiter @user
    relation platform_admin @user
    
    permission view = opener or assigned_arbiter or platform_admin or escrow.buyer or escrow.seller
    permission submit_evidence = opener or escrow.buyer or escrow.seller
    permission resolve = assigned_arbiter or platform_admin
    permission escalate = opener or assigned_arbiter
    permission close = platform_admin
}

entity transaction {
    relation escrow @escrow
    relation initiator @user
    relation platform_admin @user
    
    permission view = initiator or platform_admin or escrow.buyer or escrow.seller
    permission reverse = platform_admin
}

entity seller_profile {
    relation owner @user
    relation platform_admin @user
    
    permission view = owner or platform_admin
    permission edit = owner
    permission verify = platform_admin
    permission suspend = platform_admin
}

entity buyer_profile {
    relation owner @user
    relation platform_admin @user
    
    permission view = owner or platform_admin
    permission edit = owner
    permission verify = platform_admin
    permission suspend = platform_admin
}

entity bank_account {
    relation owner @user
    relation platform_admin @user
    
    permission view = owner or platform_admin
    permission verify = platform_admin
    permission delete = owner or platform_admin
}

entity platform {
    relation admin @user
    relation support @user
    relation arbiter @user
    
    permission manage_users = admin
    permission manage_escrows = admin or support
    permission resolve_disputes = admin or arbiter
    permission view_analytics = admin
    permission manage_settings = admin
}
"""


@dataclass
class PermifyRelationship:
    """Represents a relationship tuple in Permify"""
    entity_type: str
    entity_id: str
    relation: str
    subject_type: str
    subject_id: str


class PermifySchemaManager:
    """
    Manages Permify schema and authorization operations.
    
    This class handles:
    - Schema initialization
    - Relationship management
    - Permission checks
    - Bulk operations
    """
    
    def __init__(self):
        self.permify_host = os.getenv("PERMIFY_HOST", "localhost:3476")
        self.tenant_id = os.getenv("PERMIFY_TENANT_ID", "escrow")
        self._schema_version = None
        self._initialized = False
    
    async def initialize_schema(self) -> Dict[str, Any]:
        """
        Initialize or update the Permify schema.
        Should be called on application startup.
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/schemas/write",
                    json={"schema": PERMIFY_SCHEMA},
                    timeout=30.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self._schema_version = result.get("schema_version")
                    self._initialized = True
                    logger.info(f"Permify schema initialized: version {self._schema_version}")
                    return {"success": True, "schema_version": self._schema_version}
                else:
                    logger.error(f"Failed to initialize Permify schema: {response.text}")
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.warning(f"Permify schema initialization failed (non-blocking): {e}")
            return {"success": False, "error": str(e)}
    
    async def create_escrow_relationships(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        arbiter_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create all relationships for a new escrow.
        Called when an escrow is created.
        """
        relationships = [
            PermifyRelationship("escrow", escrow_id, "buyer", "user", buyer_id),
            PermifyRelationship("escrow", escrow_id, "seller", "user", seller_id),
        ]
        
        if arbiter_id:
            relationships.append(
                PermifyRelationship("escrow", escrow_id, "arbiter", "user", arbiter_id)
            )
        
        results = []
        for rel in relationships:
            result = await self._write_relationship(rel)
            results.append(result)
        
        return {
            "success": all(r.get("success") for r in results),
            "relationships_created": len([r for r in results if r.get("success")]),
            "details": results,
        }
    
    async def create_dispute_relationships(
        self,
        dispute_id: str,
        escrow_id: str,
        opener_id: str,
        arbiter_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create relationships for a new dispute.
        """
        relationships = [
            PermifyRelationship("dispute", dispute_id, "escrow", "escrow", escrow_id),
            PermifyRelationship("dispute", dispute_id, "opener", "user", opener_id),
        ]
        
        if arbiter_id:
            relationships.append(
                PermifyRelationship("dispute", dispute_id, "assigned_arbiter", "user", arbiter_id)
            )
        
        results = []
        for rel in relationships:
            result = await self._write_relationship(rel)
            results.append(result)
        
        return {
            "success": all(r.get("success") for r in results),
            "relationships_created": len([r for r in results if r.get("success")]),
        }
    
    async def check_permission(
        self,
        entity_type: str,
        entity_id: str,
        permission: str,
        subject_type: str,
        subject_id: str,
    ) -> bool:
        """
        Check if a subject has a specific permission on an entity.
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/permissions/check",
                    json={
                        "metadata": {"schema_version": self._schema_version} if self._schema_version else {},
                        "entity": {"type": entity_type, "id": entity_id},
                        "permission": permission,
                        "subject": {"type": subject_type, "id": subject_id},
                    },
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("can") == "CHECK_RESULT_ALLOWED"
                else:
                    logger.warning(f"Permission check failed: {response.text}")
                    return False
                    
        except Exception as e:
            logger.warning(f"Permission check error (defaulting to deny): {e}")
            return False
    
    async def can_view_escrow(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can view an escrow"""
        return await self.check_permission("escrow", escrow_id, "view", "user", user_id)
    
    async def can_accept_escrow(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can accept an escrow (seller only)"""
        return await self.check_permission("escrow", escrow_id, "accept", "user", user_id)
    
    async def can_ship_escrow(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can mark escrow as shipped (seller only)"""
        return await self.check_permission("escrow", escrow_id, "ship", "user", user_id)
    
    async def can_confirm_delivery(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can confirm delivery (buyer only)"""
        return await self.check_permission("escrow", escrow_id, "confirm_delivery", "user", user_id)
    
    async def can_dispute_escrow(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can open a dispute"""
        return await self.check_permission("escrow", escrow_id, "dispute", "user", user_id)
    
    async def can_resolve_dispute(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can resolve a dispute (arbiter/admin only)"""
        return await self.check_permission("escrow", escrow_id, "resolve_dispute", "user", user_id)
    
    async def can_cancel_escrow(self, user_id: str, escrow_id: str) -> bool:
        """Check if user can cancel an escrow"""
        return await self.check_permission("escrow", escrow_id, "cancel", "user", user_id)
    
    async def update_escrow_attribute(
        self,
        escrow_id: str,
        attribute: str,
        value: bool,
    ) -> Dict[str, Any]:
        """
        Update an escrow attribute (e.g., seller_accepted, disputed, shipped).
        These attributes affect permission calculations.
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/data/attributes/write",
                    json={
                        "attributes": [{
                            "entity": {"type": "escrow", "id": escrow_id},
                            "attribute": attribute,
                            "value": {"boolean_value": value},
                        }]
                    },
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    return {"success": True, "attribute": attribute, "value": value}
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.warning(f"Attribute update failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _write_relationship(self, rel: PermifyRelationship) -> Dict[str, Any]:
        """Write a single relationship to Permify"""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/relationships/write",
                    json={
                        "metadata": {"schema_version": self._schema_version} if self._schema_version else {},
                        "tuples": [{
                            "entity": {"type": rel.entity_type, "id": rel.entity_id},
                            "relation": rel.relation,
                            "subject": {"type": rel.subject_type, "id": rel.subject_id},
                        }]
                    },
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    return {"success": True, "relationship": f"{rel.entity_type}:{rel.entity_id}#{rel.relation}@{rel.subject_type}:{rel.subject_id}"}
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.warning(f"Relationship write failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_relationship(
        self,
        entity_type: str,
        entity_id: str,
        relation: str,
        subject_type: str,
        subject_id: str,
    ) -> Dict[str, Any]:
        """Delete a relationship from Permify"""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/relationships/delete",
                    json={
                        "tuples": [{
                            "entity": {"type": entity_type, "id": entity_id},
                            "relation": relation,
                            "subject": {"type": subject_type, "id": subject_id},
                        }]
                    },
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    return {"success": True}
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.warning(f"Relationship delete failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def list_relationships(
        self,
        entity_type: str,
        entity_id: str,
    ) -> List[Dict[str, Any]]:
        """List all relationships for an entity"""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{self.permify_host}/v1/tenants/{self.tenant_id}/relationships/read",
                    json={
                        "metadata": {"schema_version": self._schema_version} if self._schema_version else {},
                        "filter": {
                            "entity": {"type": entity_type, "ids": [entity_id]},
                        }
                    },
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("tuples", [])
                else:
                    return []
                    
        except Exception as e:
            logger.warning(f"Relationship list failed: {e}")
            return []


# Global instance
permify_schema_manager = PermifySchemaManager()


async def initialize_permify():
    """Initialize Permify schema on application startup"""
    return await permify_schema_manager.initialize_schema()
