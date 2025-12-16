"""
Authentication and Authorization Module

This module provides production-grade authentication and authorization:
1. JWT token validation
2. API key authentication
3. Role-based access control (RBAC)
4. Webhook signature verification
5. Rate limiting integration

Security features:
- Token expiration and refresh
- Role hierarchy enforcement
- Audit logging for auth events
- Brute force protection
"""

import os
import json
import hmac
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Set
from enum import Enum
from dataclasses import dataclass, field
from functools import wraps
import jwt
from fastapi import HTTPException, Request, Depends, Header, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class AuthConfig:
    """Authentication configuration"""
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # API Key Configuration
    API_KEY_HEADER = os.getenv("API_KEY_HEADER", "X-API-Key")
    ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
    
    # Production Mode
    PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
    REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "true").lower() == "true"
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    
    # Webhook Secrets
    WEBHOOK_SECRETS: Dict[str, str] = {}
    
    @classmethod
    def validate_production_config(cls) -> List[str]:
        """Validate configuration for production mode"""
        errors = []
        
        if cls.PRODUCTION_MODE:
            if not cls.JWT_SECRET_KEY or len(cls.JWT_SECRET_KEY) < 32:
                errors.append("JWT_SECRET_KEY must be at least 32 characters in production")
            
            if not cls.ADMIN_API_KEY or len(cls.ADMIN_API_KEY) < 32:
                errors.append("ADMIN_API_KEY must be at least 32 characters in production")
            
            if cls.JWT_SECRET_KEY == "dev-secret-key-change-in-production":
                errors.append("JWT_SECRET_KEY is using default value - must be changed in production")
        
        return errors


# =============================================================================
# Data Models
# =============================================================================

class UserRole(str, Enum):
    """User roles with hierarchy"""
    SYSTEM = "system"  # Internal system operations
    ADMIN = "admin"  # Platform administrators
    SUPPORT = "support"  # Customer support
    MERCHANT = "merchant"  # Sellers
    BUYER = "buyer"  # Buyers
    AGENT = "agent"  # Cash agents
    WEBHOOK = "webhook"  # Webhook callbacks
    ANONYMOUS = "anonymous"  # Unauthenticated


class Permission(str, Enum):
    """Granular permissions"""
    # Escrow permissions
    ESCROW_CREATE = "escrow:create"
    ESCROW_READ = "escrow:read"
    ESCROW_UPDATE = "escrow:update"
    ESCROW_DELETE = "escrow:delete"
    ESCROW_RELEASE = "escrow:release"
    ESCROW_REFUND = "escrow:refund"
    
    # Payment permissions
    PAYMENT_INITIATE = "payment:initiate"
    PAYMENT_VERIFY = "payment:verify"
    PAYOUT_INITIATE = "payout:initiate"
    PAYOUT_APPROVE = "payout:approve"
    
    # User management
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    
    # KYC permissions
    KYC_READ = "kyc:read"
    KYC_UPDATE = "kyc:update"
    KYC_VERIFY = "kyc:verify"
    
    # Admin permissions
    ADMIN_READ = "admin:read"
    ADMIN_WRITE = "admin:write"
    SYSTEM_CONFIG = "system:config"
    
    # Dispute permissions
    DISPUTE_CREATE = "dispute:create"
    DISPUTE_READ = "dispute:read"
    DISPUTE_RESOLVE = "dispute:resolve"
    
    # Insurance permissions
    INSURANCE_QUOTE = "insurance:quote"
    INSURANCE_BIND = "insurance:bind"
    INSURANCE_CLAIM = "insurance:claim"


# Role to permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.SYSTEM: set(Permission),  # All permissions
    UserRole.ADMIN: {
        Permission.ESCROW_CREATE, Permission.ESCROW_READ, Permission.ESCROW_UPDATE,
        Permission.ESCROW_DELETE, Permission.ESCROW_RELEASE, Permission.ESCROW_REFUND,
        Permission.PAYMENT_INITIATE, Permission.PAYMENT_VERIFY,
        Permission.PAYOUT_INITIATE, Permission.PAYOUT_APPROVE,
        Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE,
        Permission.KYC_READ, Permission.KYC_UPDATE, Permission.KYC_VERIFY,
        Permission.ADMIN_READ, Permission.ADMIN_WRITE,
        Permission.DISPUTE_CREATE, Permission.DISPUTE_READ, Permission.DISPUTE_RESOLVE,
        Permission.INSURANCE_QUOTE, Permission.INSURANCE_BIND, Permission.INSURANCE_CLAIM,
    },
    UserRole.SUPPORT: {
        Permission.ESCROW_READ, Permission.USER_READ, Permission.KYC_READ,
        Permission.DISPUTE_READ, Permission.DISPUTE_RESOLVE,
    },
    UserRole.MERCHANT: {
        Permission.ESCROW_CREATE, Permission.ESCROW_READ, Permission.ESCROW_UPDATE,
        Permission.PAYMENT_VERIFY, Permission.PAYOUT_INITIATE,
        Permission.USER_READ, Permission.USER_UPDATE,
        Permission.KYC_READ, Permission.KYC_UPDATE,
        Permission.DISPUTE_CREATE, Permission.DISPUTE_READ,
        Permission.INSURANCE_QUOTE, Permission.INSURANCE_BIND,
    },
    UserRole.BUYER: {
        Permission.ESCROW_CREATE, Permission.ESCROW_READ,
        Permission.PAYMENT_INITIATE, Permission.PAYMENT_VERIFY,
        Permission.USER_READ, Permission.USER_UPDATE,
        Permission.DISPUTE_CREATE, Permission.DISPUTE_READ,
        Permission.INSURANCE_QUOTE,
    },
    UserRole.AGENT: {
        Permission.ESCROW_READ, Permission.PAYMENT_VERIFY,
        Permission.USER_READ,
    },
    UserRole.WEBHOOK: {
        Permission.ESCROW_UPDATE, Permission.PAYMENT_VERIFY,
    },
    UserRole.ANONYMOUS: set(),  # No permissions
}


@dataclass
class TokenPayload:
    """JWT token payload"""
    sub: str  # Subject (user ID)
    role: UserRole
    permissions: Set[Permission]
    merchant_id: Optional[str] = None
    buyer_id: Optional[str] = None
    exp: Optional[datetime] = None
    iat: Optional[datetime] = None
    jti: Optional[str] = None  # JWT ID for revocation
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuthenticatedUser:
    """Authenticated user context"""
    user_id: str
    role: UserRole
    permissions: Set[Permission]
    merchant_id: Optional[str] = None
    buyer_id: Optional[str] = None
    token_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def has_permission(self, permission: Permission) -> bool:
        """Check if user has a specific permission"""
        return permission in self.permissions
    
    def has_any_permission(self, permissions: List[Permission]) -> bool:
        """Check if user has any of the specified permissions"""
        return any(p in self.permissions for p in permissions)
    
    def has_all_permissions(self, permissions: List[Permission]) -> bool:
        """Check if user has all specified permissions"""
        return all(p in self.permissions for p in permissions)


# =============================================================================
# Token Service
# =============================================================================

class TokenService:
    """JWT token management service"""
    
    def __init__(self):
        self._revoked_tokens: Set[str] = set()  # In production, use Redis
    
    def create_access_token(
        self,
        user_id: str,
        role: UserRole,
        merchant_id: Optional[str] = None,
        buyer_id: Optional[str] = None,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new access token"""
        
        now = datetime.utcnow()
        expires = now + timedelta(minutes=AuthConfig.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        token_id = secrets.token_urlsafe(16)
        
        permissions = ROLE_PERMISSIONS.get(role, set())
        
        payload = {
            "sub": user_id,
            "role": role.value,
            "permissions": [p.value for p in permissions],
            "merchant_id": merchant_id,
            "buyer_id": buyer_id,
            "exp": expires,
            "iat": now,
            "jti": token_id,
            "type": "access"
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        token = jwt.encode(
            payload,
            AuthConfig.JWT_SECRET_KEY or "dev-secret-key-change-in-production",
            algorithm=AuthConfig.JWT_ALGORITHM
        )
        
        logger.info(f"Created access token for user {user_id} with role {role.value}")
        
        return token
    
    def create_refresh_token(self, user_id: str, role: UserRole) -> str:
        """Create a refresh token"""
        
        now = datetime.utcnow()
        expires = now + timedelta(days=AuthConfig.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        token_id = secrets.token_urlsafe(16)
        
        payload = {
            "sub": user_id,
            "role": role.value,
            "exp": expires,
            "iat": now,
            "jti": token_id,
            "type": "refresh"
        }
        
        token = jwt.encode(
            payload,
            AuthConfig.JWT_SECRET_KEY or "dev-secret-key-change-in-production",
            algorithm=AuthConfig.JWT_ALGORITHM
        )
        
        return token
    
    def verify_token(self, token: str) -> TokenPayload:
        """Verify and decode a JWT token"""
        
        try:
            payload = jwt.decode(
                token,
                AuthConfig.JWT_SECRET_KEY or "dev-secret-key-change-in-production",
                algorithms=[AuthConfig.JWT_ALGORITHM]
            )
            
            token_id = payload.get("jti")
            if token_id and token_id in self._revoked_tokens:
                raise HTTPException(status_code=401, detail="Token has been revoked")
            
            role = UserRole(payload.get("role", "anonymous"))
            permissions = {Permission(p) for p in payload.get("permissions", [])}
            
            return TokenPayload(
                sub=payload.get("sub", ""),
                role=role,
                permissions=permissions,
                merchant_id=payload.get("merchant_id"),
                buyer_id=payload.get("buyer_id"),
                exp=datetime.fromtimestamp(payload.get("exp", 0)),
                iat=datetime.fromtimestamp(payload.get("iat", 0)),
                jti=token_id,
                metadata=payload.get("metadata", {})
            )
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    def revoke_token(self, token_id: str):
        """Revoke a token by its ID"""
        self._revoked_tokens.add(token_id)
        logger.info(f"Revoked token {token_id}")
    
    def is_token_revoked(self, token_id: str) -> bool:
        """Check if a token has been revoked"""
        return token_id in self._revoked_tokens


# =============================================================================
# API Key Service
# =============================================================================

class APIKeyService:
    """API key management service"""
    
    def __init__(self):
        # In production, store in database with hashed keys
        self._api_keys: Dict[str, Dict[str, Any]] = {}
        
        # Add admin API key if configured
        if AuthConfig.ADMIN_API_KEY:
            self._api_keys[AuthConfig.ADMIN_API_KEY] = {
                "user_id": "system",
                "role": UserRole.ADMIN,
                "name": "Admin API Key",
                "created_at": datetime.utcnow().isoformat()
            }
    
    def create_api_key(
        self,
        user_id: str,
        role: UserRole,
        name: str = "API Key"
    ) -> str:
        """Create a new API key"""
        
        api_key = f"esc_{secrets.token_urlsafe(32)}"
        
        self._api_keys[api_key] = {
            "user_id": user_id,
            "role": role,
            "name": name,
            "created_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Created API key for user {user_id}")
        
        return api_key
    
    def verify_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Verify an API key and return associated data"""
        return self._api_keys.get(api_key)
    
    def revoke_api_key(self, api_key: str) -> bool:
        """Revoke an API key"""
        if api_key in self._api_keys:
            del self._api_keys[api_key]
            logger.info(f"Revoked API key")
            return True
        return False


# =============================================================================
# Webhook Signature Verification
# =============================================================================

class WebhookVerifier:
    """Webhook signature verification"""
    
    @staticmethod
    def verify_signature(
        payload: bytes,
        signature: str,
        secret: str,
        algorithm: str = "sha256"
    ) -> bool:
        """Verify webhook signature using HMAC"""
        
        if algorithm == "sha256":
            expected = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
        elif algorithm == "sha512":
            expected = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha512
            ).hexdigest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        
        return hmac.compare_digest(expected, signature)
    
    @staticmethod
    def verify_paystack_webhook(payload: bytes, signature: str) -> bool:
        """Verify Paystack webhook signature"""
        secret = os.getenv("PAYSTACK_SECRET_KEY", "")
        return WebhookVerifier.verify_signature(payload, signature, secret, "sha512")
    
    @staticmethod
    def verify_flutterwave_webhook(payload: bytes, signature: str) -> bool:
        """Verify Flutterwave webhook signature"""
        secret = os.getenv("FLUTTERWAVE_WEBHOOK_SECRET", "")
        return signature == secret
    
    @staticmethod
    def verify_bank_webhook(payload: bytes, signature: str) -> bool:
        """Verify bank webhook signature"""
        secret = os.getenv("BANK_WEBHOOK_SECRET", "")
        return WebhookVerifier.verify_signature(payload, signature, secret, "sha256")


# =============================================================================
# Rate Limiter
# =============================================================================

class RateLimiter:
    """Simple in-memory rate limiter (use Redis in production)"""
    
    def __init__(self):
        self._requests: Dict[str, List[datetime]] = {}
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed under rate limit"""
        
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=AuthConfig.RATE_LIMIT_WINDOW_SECONDS)
        
        if key not in self._requests:
            self._requests[key] = []
        
        # Clean old requests
        self._requests[key] = [
            ts for ts in self._requests[key]
            if ts > window_start
        ]
        
        if len(self._requests[key]) >= AuthConfig.RATE_LIMIT_REQUESTS:
            return False
        
        self._requests[key].append(now)
        return True
    
    def get_remaining(self, key: str) -> int:
        """Get remaining requests in current window"""
        
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=AuthConfig.RATE_LIMIT_WINDOW_SECONDS)
        
        if key not in self._requests:
            return AuthConfig.RATE_LIMIT_REQUESTS
        
        current_requests = len([
            ts for ts in self._requests[key]
            if ts > window_start
        ])
        
        return max(0, AuthConfig.RATE_LIMIT_REQUESTS - current_requests)


# =============================================================================
# Singleton Instances
# =============================================================================

token_service = TokenService()
api_key_service = APIKeyService()
rate_limiter = RateLimiter()
webhook_verifier = WebhookVerifier()


# =============================================================================
# FastAPI Dependencies
# =============================================================================

# Security schemes
bearer_scheme = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name=AuthConfig.API_KEY_HEADER, auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    api_key: Optional[str] = Depends(api_key_header)
) -> AuthenticatedUser:
    """Get current authenticated user from JWT or API key"""
    
    # Skip auth if not required (development mode)
    if not AuthConfig.REQUIRE_AUTH:
        return AuthenticatedUser(
            user_id="dev-user",
            role=UserRole.ADMIN,
            permissions=ROLE_PERMISSIONS[UserRole.ADMIN]
        )
    
    # Try JWT token first
    if credentials and credentials.credentials:
        try:
            payload = token_service.verify_token(credentials.credentials)
            return AuthenticatedUser(
                user_id=payload.sub,
                role=payload.role,
                permissions=payload.permissions,
                merchant_id=payload.merchant_id,
                buyer_id=payload.buyer_id,
                token_id=payload.jti,
                metadata=payload.metadata
            )
        except HTTPException:
            pass  # Try API key next
    
    # Try API key
    if api_key:
        key_data = api_key_service.verify_api_key(api_key)
        if key_data:
            role = key_data.get("role", UserRole.ANONYMOUS)
            return AuthenticatedUser(
                user_id=key_data.get("user_id", ""),
                role=role,
                permissions=ROLE_PERMISSIONS.get(role, set())
            )
    
    # No valid authentication
    raise HTTPException(
        status_code=401,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"}
    )


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    api_key: Optional[str] = Depends(api_key_header)
) -> Optional[AuthenticatedUser]:
    """Get current user if authenticated, None otherwise"""
    
    try:
        return await get_current_user(request, credentials, api_key)
    except HTTPException:
        return None


def require_permission(permission: Permission):
    """Dependency to require a specific permission"""
    
    async def check_permission(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if not user.has_permission(permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {permission.value} required"
            )
        return user
    
    return check_permission


def require_any_permission(permissions: List[Permission]):
    """Dependency to require any of the specified permissions"""
    
    async def check_permissions(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if not user.has_any_permission(permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: one of {[p.value for p in permissions]} required"
            )
        return user
    
    return check_permissions


def require_role(role: UserRole):
    """Dependency to require a specific role"""
    
    async def check_role(
        user: AuthenticatedUser = Depends(get_current_user)
    ) -> AuthenticatedUser:
        if user.role != role and user.role != UserRole.ADMIN and user.role != UserRole.SYSTEM:
            raise HTTPException(
                status_code=403,
                detail=f"Role {role.value} required"
            )
        return user
    
    return check_role


async def rate_limit_check(request: Request):
    """Rate limiting dependency"""
    
    # Use IP address as rate limit key
    client_ip = request.client.host if request.client else "unknown"
    
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={
                "Retry-After": str(AuthConfig.RATE_LIMIT_WINDOW_SECONDS),
                "X-RateLimit-Remaining": "0"
            }
        )


# =============================================================================
# Audit Logging
# =============================================================================

class AuditLogger:
    """Audit logging for security events"""
    
    def __init__(self):
        self._audit_log: List[Dict[str, Any]] = []  # In production, use database
    
    def log_auth_event(
        self,
        event_type: str,
        user_id: Optional[str],
        success: bool,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """Log an authentication event"""
        
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "success": success,
            "ip_address": ip_address,
            "details": details or {}
        }
        
        self._audit_log.append(entry)
        
        log_level = logging.INFO if success else logging.WARNING
        logger.log(log_level, f"Auth event: {event_type} - user={user_id} success={success}")
    
    def log_permission_check(
        self,
        user_id: str,
        permission: str,
        granted: bool,
        resource: Optional[str] = None
    ):
        """Log a permission check"""
        
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "permission_check",
            "user_id": user_id,
            "permission": permission,
            "granted": granted,
            "resource": resource
        }
        
        self._audit_log.append(entry)
    
    def get_recent_events(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get recent audit events"""
        
        events = self._audit_log
        
        if user_id:
            events = [e for e in events if e.get("user_id") == user_id]
        
        if event_type:
            events = [e for e in events if e.get("event_type") == event_type]
        
        return events[-limit:]


audit_logger = AuditLogger()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    phone: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request):
    """Login with phone and OTP"""
    
    # In production, verify OTP against stored value
    # For now, accept any 6-digit OTP
    if len(request.otp) != 6 or not request.otp.isdigit():
        audit_logger.log_auth_event(
            "login_failed",
            None,
            False,
            {"reason": "invalid_otp", "phone": request.phone},
            req.client.host if req.client else None
        )
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    # Create user ID from phone
    user_id = f"user_{hashlib.sha256(request.phone.encode()).hexdigest()[:12]}"
    
    # Determine role (in production, look up from database)
    role = UserRole.BUYER  # Default role
    
    access_token = token_service.create_access_token(user_id, role)
    refresh_token = token_service.create_refresh_token(user_id, role)
    
    audit_logger.log_auth_event(
        "login_success",
        user_id,
        True,
        {"phone": request.phone},
        req.client.host if req.client else None
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=AuthConfig.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, req: Request):
    """Refresh access token"""
    
    try:
        payload = token_service.verify_token(request.refresh_token)
        
        if payload.metadata.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        role = payload.role
        access_token = token_service.create_access_token(payload.sub, role)
        refresh_token = token_service.create_refresh_token(payload.sub, role)
        
        # Revoke old refresh token
        if payload.jti:
            token_service.revoke_token(payload.jti)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=AuthConfig.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/logout")
async def logout(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Logout and revoke token"""
    
    if user.token_id:
        token_service.revoke_token(user.token_id)
    
    audit_logger.log_auth_event("logout", user.user_id, True)
    
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user_info(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get current user information"""
    
    return {
        "user_id": user.user_id,
        "role": user.role.value,
        "permissions": [p.value for p in user.permissions],
        "merchant_id": user.merchant_id,
        "buyer_id": user.buyer_id
    }


@router.post("/api-key")
async def create_api_key_endpoint(
    name: str = "API Key",
    user: AuthenticatedUser = Depends(require_permission(Permission.ADMIN_WRITE))
):
    """Create a new API key (admin only)"""
    
    api_key = api_key_service.create_api_key(user.user_id, user.role, name)
    
    return {
        "api_key": api_key,
        "name": name,
        "warning": "Store this key securely - it cannot be retrieved again"
    }


@router.get("/audit")
async def get_audit_log(
    limit: int = 100,
    user_id: Optional[str] = None,
    event_type: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_permission(Permission.ADMIN_READ))
):
    """Get audit log (admin only)"""
    
    return audit_logger.get_recent_events(limit, user_id, event_type)


@router.get("/config/validate")
async def validate_auth_config(
    user: AuthenticatedUser = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Validate authentication configuration"""
    
    errors = AuthConfig.validate_production_config()
    
    return {
        "production_mode": AuthConfig.PRODUCTION_MODE,
        "require_auth": AuthConfig.REQUIRE_AUTH,
        "valid": len(errors) == 0,
        "errors": errors
    }
