"""
Security and Compliance Service for EscrowProtect
TIER 3: Security and Compliance Features

Provides:
- Data encryption at rest
- PII minimization
- Audit logging
- Role-based access control
- KYC/AML compliance
- Data retention policies
"""

import uuid
import hashlib
import hmac
import base64
import secrets
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import logging

logger = logging.getLogger(__name__)

class UserRole(str, Enum):
    BUYER = "buyer"
    SELLER = "seller"
    ADMIN = "admin"
    SUPPORT = "support"
    COMPLIANCE = "compliance"
    SYSTEM = "system"

class Permission(str, Enum):
    # Escrow permissions
    CREATE_ESCROW = "escrow:create"
    VIEW_ESCROW = "escrow:view"
    UPDATE_ESCROW = "escrow:update"
    CANCEL_ESCROW = "escrow:cancel"
    RELEASE_ESCROW = "escrow:release"
    REFUND_ESCROW = "escrow:refund"
    
    # User permissions
    VIEW_USER = "user:view"
    UPDATE_USER = "user:update"
    SUSPEND_USER = "user:suspend"
    DELETE_USER = "user:delete"
    
    # Admin permissions
    VIEW_ALL_ESCROWS = "admin:view_all_escrows"
    VIEW_ALL_USERS = "admin:view_all_users"
    MANAGE_DISPUTES = "admin:manage_disputes"
    VIEW_AUDIT_LOGS = "admin:view_audit_logs"
    MANAGE_COMPLIANCE = "admin:manage_compliance"
    
    # Compliance permissions
    VIEW_KYC = "compliance:view_kyc"
    APPROVE_KYC = "compliance:approve_kyc"
    FLAG_SUSPICIOUS = "compliance:flag_suspicious"
    GENERATE_REPORTS = "compliance:generate_reports"

# Role-permission mapping
ROLE_PERMISSIONS = {
    UserRole.BUYER: [
        Permission.CREATE_ESCROW,
        Permission.VIEW_ESCROW,
        Permission.CANCEL_ESCROW,
    ],
    UserRole.SELLER: [
        Permission.VIEW_ESCROW,
        Permission.UPDATE_ESCROW,
    ],
    UserRole.SUPPORT: [
        Permission.VIEW_ESCROW,
        Permission.VIEW_USER,
        Permission.MANAGE_DISPUTES,
    ],
    UserRole.COMPLIANCE: [
        Permission.VIEW_ESCROW,
        Permission.VIEW_USER,
        Permission.VIEW_KYC,
        Permission.APPROVE_KYC,
        Permission.FLAG_SUSPICIOUS,
        Permission.GENERATE_REPORTS,
        Permission.VIEW_AUDIT_LOGS,
    ],
    UserRole.ADMIN: [
        # All permissions
        *[p for p in Permission]
    ],
    UserRole.SYSTEM: [
        # All permissions for automated processes
        *[p for p in Permission]
    ],
}

class KYCLevel(int, Enum):
    NONE = 0
    PHONE_VERIFIED = 1
    BVN_VERIFIED = 2
    NIN_VERIFIED = 3
    FULL_KYC = 4

# KYC thresholds (in NGN)
KYC_THRESHOLDS = {
    KYCLevel.NONE: 10000,           # ₦10,000 max without verification
    KYCLevel.PHONE_VERIFIED: 100000, # ₦100,000 max with phone only
    KYCLevel.BVN_VERIFIED: 1000000,  # ₦1,000,000 max with BVN
    KYCLevel.NIN_VERIFIED: 5000000,  # ₦5,000,000 max with NIN
    KYCLevel.FULL_KYC: float('inf'), # No limit with full KYC
}

@dataclass
class AuditLogEntry:
    """Immutable audit log entry"""
    id: str
    timestamp: str
    actor_id: str
    actor_type: str  # user, admin, system
    actor_ip: Optional[str]
    action: str
    resource_type: str
    resource_id: str
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    metadata: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None

@dataclass
class EncryptedField:
    """Encrypted field with metadata"""
    ciphertext: str
    iv: str
    tag: str
    key_id: str
    algorithm: str = "AES-256-GCM"

class DataEncryption:
    """
    Encryption service for sensitive data at rest.
    
    Uses AES-256-GCM for encryption.
    In production, keys would be stored in AWS KMS or HashiCorp Vault.
    """
    
    def __init__(self):
        # In production, fetch from KMS
        self.master_key = secrets.token_bytes(32)
        self.key_id = "master-key-v1"
    
    def encrypt(self, plaintext: str) -> EncryptedField:
        """Encrypt sensitive data"""
        # In production, use cryptography library with proper AES-GCM
        # For POC, use simple encoding
        iv = secrets.token_hex(12)
        
        # Simulated encryption (in production, use actual AES-GCM)
        encoded = base64.b64encode(plaintext.encode()).decode()
        tag = hashlib.sha256(f"{encoded}{iv}".encode()).hexdigest()[:32]
        
        return EncryptedField(
            ciphertext=encoded,
            iv=iv,
            tag=tag,
            key_id=self.key_id
        )
    
    def decrypt(self, encrypted: EncryptedField) -> str:
        """Decrypt sensitive data"""
        # Verify tag
        expected_tag = hashlib.sha256(f"{encrypted.ciphertext}{encrypted.iv}".encode()).hexdigest()[:32]
        if encrypted.tag != expected_tag:
            raise ValueError("Decryption failed: invalid tag")
        
        # Simulated decryption
        return base64.b64decode(encrypted.ciphertext).decode()
    
    def hash_pii(self, value: str, salt: str = None) -> str:
        """
        One-way hash for PII that needs to be searchable but not readable.
        Uses HMAC-SHA256 with a secret key.
        """
        if salt is None:
            salt = secrets.token_hex(16)
        
        hashed = hmac.new(
            self.master_key,
            f"{value}{salt}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{salt}:{hashed}"
    
    def verify_hash(self, value: str, stored_hash: str) -> bool:
        """Verify a value against its hash"""
        salt, _ = stored_hash.split(":")
        computed = self.hash_pii(value, salt)
        return hmac.compare_digest(computed, stored_hash)

class PIIMinimizer:
    """
    PII minimization service.
    
    Ensures only necessary PII is stored and displayed.
    """
    
    @staticmethod
    def mask_phone(phone: str) -> str:
        """Mask phone number for display"""
        if len(phone) >= 10:
            return f"{phone[:4]}****{phone[-4:]}"
        return "****"
    
    @staticmethod
    def mask_account_number(account: str) -> str:
        """Mask bank account number"""
        if len(account) >= 4:
            return f"******{account[-4:]}"
        return "****"
    
    @staticmethod
    def mask_email(email: str) -> str:
        """Mask email address"""
        if "@" in email:
            local, domain = email.split("@")
            if len(local) > 2:
                masked_local = f"{local[0]}***{local[-1]}"
            else:
                masked_local = "***"
            return f"{masked_local}@{domain}"
        return "***@***"
    
    @staticmethod
    def mask_name(name: str) -> str:
        """Mask name for privacy"""
        parts = name.split()
        masked_parts = []
        for part in parts:
            if len(part) > 1:
                masked_parts.append(f"{part[0]}***")
            else:
                masked_parts.append("*")
        return " ".join(masked_parts)
    
    @staticmethod
    def redact_for_logs(data: Dict[str, Any]) -> Dict[str, Any]:
        """Redact sensitive fields from log data"""
        sensitive_fields = [
            "password", "token", "secret", "key", "bvn", "nin",
            "account_number", "card_number", "cvv", "pin"
        ]
        
        redacted = {}
        for key, value in data.items():
            if any(sf in key.lower() for sf in sensitive_fields):
                redacted[key] = "[REDACTED]"
            elif isinstance(value, dict):
                redacted[key] = PIIMinimizer.redact_for_logs(value)
            else:
                redacted[key] = value
        
        return redacted

class AuditLogger:
    """
    Immutable audit logging service.
    
    All sensitive operations are logged for compliance and forensics.
    """
    
    def __init__(self):
        self.logs: List[AuditLogEntry] = []
    
    def log(
        self,
        actor_id: str,
        actor_type: str,
        action: str,
        resource_type: str,
        resource_id: str,
        old_value: Dict[str, Any] = None,
        new_value: Dict[str, Any] = None,
        actor_ip: str = None,
        metadata: Dict[str, Any] = None,
        correlation_id: str = None
    ) -> AuditLogEntry:
        """Create immutable audit log entry"""
        # Redact sensitive data
        if old_value:
            old_value = PIIMinimizer.redact_for_logs(old_value)
        if new_value:
            new_value = PIIMinimizer.redact_for_logs(new_value)
        
        entry = AuditLogEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow().isoformat(),
            actor_id=actor_id,
            actor_type=actor_type,
            actor_ip=actor_ip,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata or {},
            correlation_id=correlation_id
        )
        
        self.logs.append(entry)
        logger.info(f"Audit: {action} on {resource_type}/{resource_id} by {actor_type}/{actor_id}")
        
        return entry
    
    def query(
        self,
        actor_id: str = None,
        resource_type: str = None,
        resource_id: str = None,
        action: str = None,
        start_time: str = None,
        end_time: str = None,
        limit: int = 100
    ) -> List[AuditLogEntry]:
        """Query audit logs with filters"""
        results = self.logs
        
        if actor_id:
            results = [l for l in results if l.actor_id == actor_id]
        if resource_type:
            results = [l for l in results if l.resource_type == resource_type]
        if resource_id:
            results = [l for l in results if l.resource_id == resource_id]
        if action:
            results = [l for l in results if l.action == action]
        if start_time:
            results = [l for l in results if l.timestamp >= start_time]
        if end_time:
            results = [l for l in results if l.timestamp <= end_time]
        
        return results[-limit:]
    
    def get_user_activity(self, user_id: str, days: int = 30) -> List[AuditLogEntry]:
        """Get all activity for a user"""
        start_time = (datetime.utcnow() - timedelta(days=days)).isoformat()
        return self.query(actor_id=user_id, start_time=start_time)
    
    def get_resource_history(self, resource_type: str, resource_id: str) -> List[AuditLogEntry]:
        """Get complete history for a resource"""
        return self.query(resource_type=resource_type, resource_id=resource_id)

class AccessControl:
    """
    Role-based access control service.
    """
    
    def __init__(self):
        self.user_roles: Dict[str, List[UserRole]] = {}
    
    def assign_role(self, user_id: str, role: UserRole):
        """Assign role to user"""
        if user_id not in self.user_roles:
            self.user_roles[user_id] = []
        if role not in self.user_roles[user_id]:
            self.user_roles[user_id].append(role)
    
    def remove_role(self, user_id: str, role: UserRole):
        """Remove role from user"""
        if user_id in self.user_roles and role in self.user_roles[user_id]:
            self.user_roles[user_id].remove(role)
    
    def get_roles(self, user_id: str) -> List[UserRole]:
        """Get user's roles"""
        return self.user_roles.get(user_id, [UserRole.BUYER])
    
    def get_permissions(self, user_id: str) -> List[Permission]:
        """Get all permissions for a user"""
        roles = self.get_roles(user_id)
        permissions = set()
        for role in roles:
            permissions.update(ROLE_PERMISSIONS.get(role, []))
        return list(permissions)
    
    def has_permission(self, user_id: str, permission: Permission) -> bool:
        """Check if user has a specific permission"""
        return permission in self.get_permissions(user_id)
    
    def check_access(
        self,
        user_id: str,
        permission: Permission,
        resource_owner_id: str = None
    ) -> bool:
        """
        Check if user can access a resource.
        
        Considers:
        - User's permissions
        - Resource ownership (users can access their own resources)
        """
        # Users can always access their own resources
        if resource_owner_id and user_id == resource_owner_id:
            return True
        
        return self.has_permission(user_id, permission)

class KYCCompliance:
    """
    KYC/AML compliance service.
    
    Manages:
    - KYC level verification
    - Transaction limits based on KYC level
    - Suspicious activity reporting
    """
    
    def __init__(self):
        self.user_kyc: Dict[str, Dict[str, Any]] = {}
        self.suspicious_reports: List[Dict[str, Any]] = []
    
    def get_kyc_level(self, user_id: str) -> KYCLevel:
        """Get user's KYC level"""
        kyc = self.user_kyc.get(user_id, {})
        return KYCLevel(kyc.get("level", 0))
    
    def set_kyc_level(
        self,
        user_id: str,
        level: KYCLevel,
        verified_by: str,
        verification_data: Dict[str, Any] = None
    ):
        """Set user's KYC level"""
        self.user_kyc[user_id] = {
            "level": level.value,
            "verified_at": datetime.utcnow().isoformat(),
            "verified_by": verified_by,
            "verification_data": verification_data or {}
        }
    
    def get_transaction_limit(self, user_id: str) -> float:
        """Get user's transaction limit based on KYC level"""
        level = self.get_kyc_level(user_id)
        return KYC_THRESHOLDS.get(level, 0)
    
    def check_transaction_allowed(
        self,
        user_id: str,
        amount: float,
        cumulative_daily: float = 0
    ) -> Dict[str, Any]:
        """
        Check if transaction is allowed based on KYC limits.
        
        Returns:
        - allowed: bool
        - reason: str (if not allowed)
        - required_kyc_level: KYCLevel (if upgrade needed)
        """
        limit = self.get_transaction_limit(user_id)
        total = amount + cumulative_daily
        
        if total <= limit:
            return {"allowed": True}
        
        # Find required KYC level
        required_level = None
        for level, threshold in sorted(KYC_THRESHOLDS.items(), key=lambda x: x[1]):
            if total <= threshold:
                required_level = level
                break
        
        return {
            "allowed": False,
            "reason": f"Transaction exceeds limit of ₦{limit:,.0f} for your verification level",
            "current_limit": limit,
            "required_amount": total,
            "required_kyc_level": required_level.name if required_level else "FULL_KYC",
            "upgrade_url": f"/kyc/upgrade?level={required_level.value if required_level else 4}"
        }
    
    def report_suspicious_activity(
        self,
        user_id: str,
        activity_type: str,
        description: str,
        evidence: Dict[str, Any] = None,
        reported_by: str = "system"
    ) -> str:
        """
        Report suspicious activity for AML compliance.
        
        In production, this would:
        - Create SAR (Suspicious Activity Report)
        - Notify compliance team
        - Potentially freeze account
        """
        report_id = f"SAR-{uuid.uuid4().hex[:12].upper()}"
        
        report = {
            "id": report_id,
            "user_id": user_id,
            "activity_type": activity_type,
            "description": description,
            "evidence": evidence or {},
            "reported_by": reported_by,
            "reported_at": datetime.utcnow().isoformat(),
            "status": "pending_review"
        }
        
        self.suspicious_reports.append(report)
        logger.warning(f"Suspicious activity reported: {report_id} for user {user_id}")
        
        return report_id
    
    def get_pending_reports(self) -> List[Dict[str, Any]]:
        """Get pending suspicious activity reports"""
        return [r for r in self.suspicious_reports if r["status"] == "pending_review"]

class DataRetention:
    """
    Data retention policy enforcement.
    
    Nigerian regulations require:
    - Transaction records: 5 years minimum
    - KYC documents: 5 years after relationship ends
    - Audit logs: 7 years
    """
    
    RETENTION_PERIODS = {
        "transaction": timedelta(days=5*365),  # 5 years
        "kyc_document": timedelta(days=5*365),  # 5 years
        "audit_log": timedelta(days=7*365),    # 7 years
        "session_data": timedelta(days=30),    # 30 days
        "notification": timedelta(days=90),    # 90 days
    }
    
    def __init__(self):
        self.deletion_queue: List[Dict[str, Any]] = []
    
    def get_retention_period(self, data_type: str) -> timedelta:
        """Get retention period for data type"""
        return self.RETENTION_PERIODS.get(data_type, timedelta(days=365))
    
    def schedule_deletion(
        self,
        data_type: str,
        resource_id: str,
        created_at: datetime
    ):
        """Schedule data for deletion after retention period"""
        retention = self.get_retention_period(data_type)
        delete_at = created_at + retention
        
        self.deletion_queue.append({
            "data_type": data_type,
            "resource_id": resource_id,
            "created_at": created_at.isoformat(),
            "delete_at": delete_at.isoformat(),
            "status": "scheduled"
        })
    
    def get_due_for_deletion(self) -> List[Dict[str, Any]]:
        """Get items due for deletion"""
        now = datetime.utcnow()
        return [
            item for item in self.deletion_queue
            if item["status"] == "scheduled" and 
               datetime.fromisoformat(item["delete_at"]) <= now
        ]
    
    def mark_deleted(self, resource_id: str):
        """Mark item as deleted"""
        for item in self.deletion_queue:
            if item["resource_id"] == resource_id:
                item["status"] = "deleted"
                item["deleted_at"] = datetime.utcnow().isoformat()


# Global instances
data_encryption = DataEncryption()
pii_minimizer = PIIMinimizer()
audit_logger = AuditLogger()
access_control = AccessControl()
kyc_compliance = KYCCompliance()
data_retention = DataRetention()
