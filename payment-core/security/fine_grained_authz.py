#!/usr/bin/env python3
"""
Fine-Grained Authorization for Payment Switch
Role-based and attribute-based access control using Permify/OPA patterns
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from enum import Enum

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/9')


class Permission(Enum):
    # Transaction permissions
    TRANSACTION_READ = "transaction:read"
    TRANSACTION_CREATE = "transaction:create"
    TRANSACTION_APPROVE = "transaction:approve"
    TRANSACTION_CANCEL = "transaction:cancel"
    
    # Settlement permissions
    SETTLEMENT_READ = "settlement:read"
    SETTLEMENT_APPROVE = "settlement:approve"
    SETTLEMENT_REJECT = "settlement:reject"
    
    # Participant permissions
    PARTICIPANT_READ = "participant:read"
    PARTICIPANT_CREATE = "participant:create"
    PARTICIPANT_UPDATE = "participant:update"
    PARTICIPANT_SUSPEND = "participant:suspend"
    
    # Fraud permissions
    FRAUD_READ = "fraud:read"
    FRAUD_RESOLVE = "fraud:resolve"
    FRAUD_ESCALATE = "fraud:escalate"
    
    # Kill switch permissions
    KILLSWITCH_READ = "killswitch:read"
    KILLSWITCH_ACTIVATE = "killswitch:activate"
    KILLSWITCH_DEACTIVATE = "killswitch:deactivate"
    
    # Analytics permissions
    ANALYTICS_READ = "analytics:read"
    ANALYTICS_EXPORT = "analytics:export"
    ANALYTICS_PII = "analytics:pii"
    
    # Admin permissions
    ADMIN_USERS = "admin:users"
    ADMIN_ROLES = "admin:roles"
    ADMIN_AUDIT = "admin:audit"
    ADMIN_CONFIG = "admin:config"


class Role(Enum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    ANALYST = "analyst"
    COMPLIANCE = "compliance"
    FRAUD_ANALYST = "fraud_analyst"
    SETTLEMENT_OFFICER = "settlement_officer"
    PARTICIPANT_MANAGER = "participant_manager"
    NOC_OPERATOR = "noc_operator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


# Role to permissions mapping
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.VIEWER: {
        Permission.TRANSACTION_READ,
        Permission.SETTLEMENT_READ,
        Permission.PARTICIPANT_READ,
        Permission.FRAUD_READ,
        Permission.KILLSWITCH_READ,
        Permission.ANALYTICS_READ,
    },
    Role.OPERATOR: {
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_CREATE,
        Permission.SETTLEMENT_READ,
        Permission.PARTICIPANT_READ,
        Permission.FRAUD_READ,
        Permission.KILLSWITCH_READ,
        Permission.ANALYTICS_READ,
    },
    Role.ANALYST: {
        Permission.TRANSACTION_READ,
        Permission.SETTLEMENT_READ,
        Permission.PARTICIPANT_READ,
        Permission.FRAUD_READ,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
    },
    Role.COMPLIANCE: {
        Permission.TRANSACTION_READ,
        Permission.SETTLEMENT_READ,
        Permission.PARTICIPANT_READ,
        Permission.FRAUD_READ,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.ANALYTICS_PII,
        Permission.ADMIN_AUDIT,
    },
    Role.FRAUD_ANALYST: {
        Permission.TRANSACTION_READ,
        Permission.FRAUD_READ,
        Permission.FRAUD_RESOLVE,
        Permission.FRAUD_ESCALATE,
        Permission.ANALYTICS_READ,
    },
    Role.SETTLEMENT_OFFICER: {
        Permission.TRANSACTION_READ,
        Permission.SETTLEMENT_READ,
        Permission.SETTLEMENT_APPROVE,
        Permission.SETTLEMENT_REJECT,
        Permission.PARTICIPANT_READ,
    },
    Role.PARTICIPANT_MANAGER: {
        Permission.PARTICIPANT_READ,
        Permission.PARTICIPANT_CREATE,
        Permission.PARTICIPANT_UPDATE,
        Permission.PARTICIPANT_SUSPEND,
    },
    Role.NOC_OPERATOR: {
        Permission.TRANSACTION_READ,
        Permission.SETTLEMENT_READ,
        Permission.PARTICIPANT_READ,
        Permission.FRAUD_READ,
        Permission.KILLSWITCH_READ,
        Permission.KILLSWITCH_ACTIVATE,
        Permission.KILLSWITCH_DEACTIVATE,
        Permission.ANALYTICS_READ,
    },
    Role.ADMIN: {
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_CREATE,
        Permission.TRANSACTION_APPROVE,
        Permission.SETTLEMENT_READ,
        Permission.SETTLEMENT_APPROVE,
        Permission.SETTLEMENT_REJECT,
        Permission.PARTICIPANT_READ,
        Permission.PARTICIPANT_CREATE,
        Permission.PARTICIPANT_UPDATE,
        Permission.FRAUD_READ,
        Permission.FRAUD_RESOLVE,
        Permission.FRAUD_ESCALATE,
        Permission.KILLSWITCH_READ,
        Permission.KILLSWITCH_ACTIVATE,
        Permission.KILLSWITCH_DEACTIVATE,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.ADMIN_USERS,
        Permission.ADMIN_ROLES,
        Permission.ADMIN_AUDIT,
    },
    Role.SUPER_ADMIN: set(Permission),  # All permissions
}


@dataclass
class User:
    user_id: str
    email: str
    name: str
    roles: Set[Role]
    participant_id: Optional[str] = None  # For participant-scoped access
    attributes: Dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    last_login: Optional[str] = None


@dataclass
class AuthorizationContext:
    user: User
    resource_type: str
    resource_id: Optional[str]
    action: str
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuthorizationDecision:
    allowed: bool
    reason: str
    permissions_checked: List[str]
    policies_evaluated: List[str]


class AuthorizationService:
    """Fine-grained authorization service"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "authz:"
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Authorization service connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def get_user_permissions(self, user: User) -> Set[Permission]:
        """Get all permissions for a user based on their roles"""
        permissions = set()
        for role in user.roles:
            role_perms = ROLE_PERMISSIONS.get(role, set())
            permissions.update(role_perms)
        return permissions
    
    def check_permission(self, user: User, permission: Permission) -> bool:
        """Check if user has a specific permission"""
        user_permissions = self.get_user_permissions(user)
        return permission in user_permissions
    
    def authorize(self, context: AuthorizationContext) -> AuthorizationDecision:
        """Make authorization decision based on context"""
        policies_evaluated = []
        permissions_checked = []
        
        # Get required permission for action
        required_permission = self._get_required_permission(
            context.resource_type,
            context.action
        )
        
        if required_permission is None:
            return AuthorizationDecision(
                allowed=False,
                reason="Unknown resource type or action",
                permissions_checked=[],
                policies_evaluated=["permission_mapping"]
            )
        
        permissions_checked.append(required_permission.value)
        
        # Check basic permission
        has_permission = self.check_permission(context.user, required_permission)
        policies_evaluated.append("role_based_access")
        
        if not has_permission:
            self._log_access_denied(context, "missing_permission")
            return AuthorizationDecision(
                allowed=False,
                reason=f"User lacks permission: {required_permission.value}",
                permissions_checked=permissions_checked,
                policies_evaluated=policies_evaluated
            )
        
        # Check attribute-based policies
        abac_result = self._check_abac_policies(context)
        policies_evaluated.append("attribute_based_access")
        
        if not abac_result['allowed']:
            self._log_access_denied(context, abac_result['reason'])
            return AuthorizationDecision(
                allowed=False,
                reason=abac_result['reason'],
                permissions_checked=permissions_checked,
                policies_evaluated=policies_evaluated
            )
        
        # Check resource-specific policies
        resource_result = self._check_resource_policies(context)
        policies_evaluated.append("resource_based_access")
        
        if not resource_result['allowed']:
            self._log_access_denied(context, resource_result['reason'])
            return AuthorizationDecision(
                allowed=False,
                reason=resource_result['reason'],
                permissions_checked=permissions_checked,
                policies_evaluated=policies_evaluated
            )
        
        # Log successful access
        self._log_access_granted(context)
        
        return AuthorizationDecision(
            allowed=True,
            reason="Access granted",
            permissions_checked=permissions_checked,
            policies_evaluated=policies_evaluated
        )
    
    def _get_required_permission(self, resource_type: str, action: str) -> Optional[Permission]:
        """Map resource type and action to required permission"""
        permission_map = {
            ("transaction", "read"): Permission.TRANSACTION_READ,
            ("transaction", "create"): Permission.TRANSACTION_CREATE,
            ("transaction", "approve"): Permission.TRANSACTION_APPROVE,
            ("transaction", "cancel"): Permission.TRANSACTION_CANCEL,
            ("settlement", "read"): Permission.SETTLEMENT_READ,
            ("settlement", "approve"): Permission.SETTLEMENT_APPROVE,
            ("settlement", "reject"): Permission.SETTLEMENT_REJECT,
            ("participant", "read"): Permission.PARTICIPANT_READ,
            ("participant", "create"): Permission.PARTICIPANT_CREATE,
            ("participant", "update"): Permission.PARTICIPANT_UPDATE,
            ("participant", "suspend"): Permission.PARTICIPANT_SUSPEND,
            ("fraud", "read"): Permission.FRAUD_READ,
            ("fraud", "resolve"): Permission.FRAUD_RESOLVE,
            ("fraud", "escalate"): Permission.FRAUD_ESCALATE,
            ("killswitch", "read"): Permission.KILLSWITCH_READ,
            ("killswitch", "activate"): Permission.KILLSWITCH_ACTIVATE,
            ("killswitch", "deactivate"): Permission.KILLSWITCH_DEACTIVATE,
            ("analytics", "read"): Permission.ANALYTICS_READ,
            ("analytics", "export"): Permission.ANALYTICS_EXPORT,
            ("analytics", "pii"): Permission.ANALYTICS_PII,
        }
        return permission_map.get((resource_type, action))
    
    def _check_abac_policies(self, context: AuthorizationContext) -> Dict[str, Any]:
        """Check attribute-based access control policies"""
        
        # Time-based restrictions
        current_hour = datetime.utcnow().hour
        if context.action in ["approve", "activate", "deactivate"]:
            # Critical actions only during business hours (8am-8pm UTC)
            if current_hour < 8 or current_hour > 20:
                if Role.SUPER_ADMIN not in context.user.roles:
                    return {
                        'allowed': False,
                        'reason': "Critical actions restricted to business hours (8am-8pm UTC)"
                    }
        
        # Amount-based restrictions for transactions
        if context.resource_type == "transaction" and context.action == "approve":
            amount = context.attributes.get('amount', 0)
            if amount > 100000000:  # 100 million
                if Role.ADMIN not in context.user.roles and Role.SUPER_ADMIN not in context.user.roles:
                    return {
                        'allowed': False,
                        'reason': "Transaction amount exceeds approval limit for this role"
                    }
        
        # Participant-scoped access
        if context.user.participant_id:
            resource_participant = context.attributes.get('participant_id')
            if resource_participant and resource_participant != context.user.participant_id:
                if Role.ADMIN not in context.user.roles and Role.SUPER_ADMIN not in context.user.roles:
                    return {
                        'allowed': False,
                        'reason': "Access restricted to own participant resources"
                    }
        
        return {'allowed': True}
    
    def _check_resource_policies(self, context: AuthorizationContext) -> Dict[str, Any]:
        """Check resource-specific policies"""
        
        # Settlement approval requires dual control
        if context.resource_type == "settlement" and context.action == "approve":
            settlement_id = context.resource_id
            if settlement_id:
                # Check if user already approved this settlement
                approval_key = f"{self.prefix}settlement_approvals:{settlement_id}"
                approvers = self.redis_client.smembers(approval_key)
                if context.user.user_id in approvers:
                    return {
                        'allowed': False,
                        'reason': "Dual control: User already approved this settlement"
                    }
        
        # Kill switch activation requires confirmation
        if context.resource_type == "killswitch" and context.action == "activate":
            if not context.attributes.get('confirmed', False):
                return {
                    'allowed': False,
                    'reason': "Kill switch activation requires explicit confirmation"
                }
        
        return {'allowed': True}
    
    def _log_access_granted(self, context: AuthorizationContext):
        """Log successful access"""
        log_entry = {
            'type': 'access_granted',
            'user_id': context.user.user_id,
            'user_email': context.user.email,
            'resource_type': context.resource_type,
            'resource_id': context.resource_id,
            'action': context.action,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.redis_client.lpush(f"{self.prefix}access_log", json.dumps(log_entry))
        self.redis_client.ltrim(f"{self.prefix}access_log", 0, 99999)
    
    def _log_access_denied(self, context: AuthorizationContext, reason: str):
        """Log denied access"""
        log_entry = {
            'type': 'access_denied',
            'user_id': context.user.user_id,
            'user_email': context.user.email,
            'resource_type': context.resource_type,
            'resource_id': context.resource_id,
            'action': context.action,
            'reason': reason,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.redis_client.lpush(f"{self.prefix}access_log", json.dumps(log_entry))
        self.redis_client.ltrim(f"{self.prefix}access_log", 0, 99999)
        
        # Also log to security alerts for repeated denials
        self._check_security_alert(context)
    
    def _check_security_alert(self, context: AuthorizationContext):
        """Check if access denial pattern warrants security alert"""
        key = f"{self.prefix}denial_count:{context.user.user_id}"
        count = self.redis_client.incr(key)
        self.redis_client.expire(key, 3600)  # 1 hour window
        
        if count >= 10:
            alert = {
                'type': 'excessive_access_denials',
                'user_id': context.user.user_id,
                'user_email': context.user.email,
                'denial_count': count,
                'timestamp': datetime.utcnow().isoformat()
            }
            self.redis_client.lpush(f"{self.prefix}security_alerts", json.dumps(alert))
            logger.warning(f"Security alert: Excessive access denials for user {context.user.user_id}")
    
    def get_access_log(self, limit: int = 100, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get access log entries"""
        entries = self.redis_client.lrange(f"{self.prefix}access_log", 0, limit * 2 - 1)
        logs = [json.loads(e) for e in entries]
        
        if user_id:
            logs = [l for l in logs if l.get('user_id') == user_id]
        
        return logs[:limit]
    
    def get_security_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get security alerts"""
        entries = self.redis_client.lrange(f"{self.prefix}security_alerts", 0, limit - 1)
        return [json.loads(e) for e in entries]
    
    def record_settlement_approval(self, settlement_id: str, user_id: str):
        """Record settlement approval for dual control"""
        key = f"{self.prefix}settlement_approvals:{settlement_id}"
        self.redis_client.sadd(key, user_id)
        self.redis_client.expire(key, 86400 * 7)  # 7 days


# Singleton instance
_service: Optional[AuthorizationService] = None

def get_authorization_service() -> AuthorizationService:
    global _service
    if _service is None:
        _service = AuthorizationService()
        _service.initialize()
    return _service
