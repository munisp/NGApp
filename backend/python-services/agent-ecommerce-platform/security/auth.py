"""
E-commerce Security Layer
JWT Authentication, RBAC, and Security Middleware
"""

import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import uuid
import os
import hashlib
import secrets

# Security configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Security bearer
security_bearer = HTTPBearer()

# ============================================================================
# USER ROLES AND PERMISSIONS
# ============================================================================

class UserRole(str, Enum):
    """User roles with hierarchical permissions"""
    SUPER_ADMIN = "super_admin"      # Full system access
    STORE_OWNER = "store_owner"      # Manage own store
    STORE_MANAGER = "store_manager"  # Manage store operations
    CUSTOMER = "customer"            # Browse and purchase
    GUEST = "guest"                  # Browse only

class Permission(str, Enum):
    """Granular permissions"""
    # Store management
    CREATE_STORE = "create_store"
    UPDATE_STORE = "update_store"
    DELETE_STORE = "delete_store"
    VIEW_STORE = "view_store"
    
    # Product management
    CREATE_PRODUCT = "create_product"
    UPDATE_PRODUCT = "update_product"
    DELETE_PRODUCT = "delete_product"
    VIEW_PRODUCT = "view_product"
    
    # Order management
    CREATE_ORDER = "create_order"
    UPDATE_ORDER = "update_order"
    CANCEL_ORDER = "cancel_order"
    VIEW_ORDER = "view_order"
    VIEW_ALL_ORDERS = "view_all_orders"
    
    # Customer management
    VIEW_CUSTOMER = "view_customer"
    UPDATE_CUSTOMER = "update_customer"
    VIEW_ALL_CUSTOMERS = "view_all_customers"
    
    # Analytics
    VIEW_ANALYTICS = "view_analytics"
    VIEW_FINANCIAL_REPORTS = "view_financial_reports"

# Role-Permission mapping
ROLE_PERMISSIONS: Dict[UserRole, List[Permission]] = {
    UserRole.SUPER_ADMIN: [p for p in Permission],  # All permissions
    
    UserRole.STORE_OWNER: [
        Permission.CREATE_STORE,
        Permission.UPDATE_STORE,
        Permission.DELETE_STORE,
        Permission.VIEW_STORE,
        Permission.CREATE_PRODUCT,
        Permission.UPDATE_PRODUCT,
        Permission.DELETE_PRODUCT,
        Permission.VIEW_PRODUCT,
        Permission.VIEW_ALL_ORDERS,
        Permission.UPDATE_ORDER,
        Permission.VIEW_ALL_CUSTOMERS,
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_FINANCIAL_REPORTS,
    ],
    
    UserRole.STORE_MANAGER: [
        Permission.VIEW_STORE,
        Permission.CREATE_PRODUCT,
        Permission.UPDATE_PRODUCT,
        Permission.VIEW_PRODUCT,
        Permission.VIEW_ALL_ORDERS,
        Permission.UPDATE_ORDER,
        Permission.VIEW_CUSTOMER,
        Permission.VIEW_ANALYTICS,
    ],
    
    UserRole.CUSTOMER: [
        Permission.VIEW_STORE,
        Permission.VIEW_PRODUCT,
        Permission.CREATE_ORDER,
        Permission.VIEW_ORDER,
        Permission.CANCEL_ORDER,
        Permission.VIEW_CUSTOMER,
        Permission.UPDATE_CUSTOMER,
    ],
    
    UserRole.GUEST: [
        Permission.VIEW_STORE,
        Permission.VIEW_PRODUCT,
    ],
}

# ============================================================================
# MODELS
# ============================================================================

class User(BaseModel):
    """User model"""
    id: str
    email: EmailStr
    username: str
    role: UserRole
    store_id: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    
class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: str  # user_id
    email: str
    username: str
    role: UserRole
    store_id: Optional[str] = None
    exp: datetime
    iat: datetime
    jti: str  # JWT ID for revocation

class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginRequest(BaseModel):
    """Login request"""
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    """Registration request"""
    email: EmailStr
    username: str
    password: str
    role: UserRole = UserRole.CUSTOMER
    store_name: Optional[str] = None

# ============================================================================
# PASSWORD HASHING
# ============================================================================

class PasswordHasher:
    """Secure password hashing with bcrypt"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password with bcrypt"""
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            hashed.encode('utf-8')
        )

# ============================================================================
# JWT TOKEN MANAGEMENT
# ============================================================================

class TokenManager:
    """JWT token generation and validation"""
    
    @staticmethod
    def create_access_token(user: User) -> str:
        """Create JWT access token"""
        now = datetime.utcnow()
        expires = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        payload = {
            "sub": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role.value,
            "store_id": user.store_id,
            "exp": expires,
            "iat": now,
            "jti": str(uuid.uuid4()),
            "type": "access"
        }
        
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return token
    
    @staticmethod
    def create_refresh_token(user: User) -> str:
        """Create JWT refresh token"""
        now = datetime.utcnow()
        expires = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        payload = {
            "sub": user.id,
            "exp": expires,
            "iat": now,
            "jti": str(uuid.uuid4()),
            "type": "refresh"
        }
        
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return token
    
    @staticmethod
    def decode_token(token: str) -> TokenPayload:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=[JWT_ALGORITHM]
            )
            
            return TokenPayload(
                sub=payload["sub"],
                email=payload.get("email", ""),
                username=payload.get("username", ""),
                role=UserRole(payload.get("role", UserRole.GUEST.value)),
                store_id=payload.get("store_id"),
                exp=datetime.fromtimestamp(payload["exp"]),
                iat=datetime.fromtimestamp(payload["iat"]),
                jti=payload["jti"]
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    @staticmethod
    def create_token_response(user: User) -> TokenResponse:
        """Create token response with access and refresh tokens"""
        access_token = TokenManager.create_access_token(user)
        refresh_token = TokenManager.create_refresh_token(user)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

# ============================================================================
# AUTHORIZATION
# ============================================================================

class AuthorizationManager:
    """Role-based access control (RBAC)"""
    
    @staticmethod
    def has_permission(user_role: UserRole, permission: Permission) -> bool:
        """Check if role has permission"""
        role_perms = ROLE_PERMISSIONS.get(user_role, [])
        return permission in role_perms
    
    @staticmethod
    def check_permission(user: User, permission: Permission):
        """Check permission and raise exception if not authorized"""
        if not AuthorizationManager.has_permission(user.role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {permission.value} required"
            )
    
    @staticmethod
    def check_store_access(user: User, store_id: str):
        """Check if user has access to store"""
        if user.role == UserRole.SUPER_ADMIN:
            return  # Super admin has access to all stores
        
        if user.store_id != store_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You don't have access to this store"
            )
    
    @staticmethod
    def check_resource_ownership(user: User, resource_user_id: str):
        """Check if user owns the resource"""
        if user.role == UserRole.SUPER_ADMIN:
            return  # Super admin can access all resources
        
        if user.id != resource_user_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You don't own this resource"
            )

# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_bearer)
) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = TokenManager.decode_token(token)
    
    # In production, fetch user from database
    # For now, reconstruct from token
    user = User(
        id=payload.sub,
        email=payload.email,
        username=payload.username,
        role=payload.role,
        store_id=payload.store_id,
        is_active=True,
        is_verified=True,
        created_at=payload.iat
    )
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user

def require_role(required_role: UserRole):
    """Dependency to require specific role"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Role {required_role.value} required"
            )
        return current_user
    return role_checker

def require_permission(required_permission: Permission):
    """Dependency to require specific permission"""
    async def permission_checker(current_user: User = Depends(get_current_user)):
        AuthorizationManager.check_permission(current_user, required_permission)
        return current_user
    return permission_checker

# ============================================================================
# RATE LIMITING
# ============================================================================

class RateLimiter:
    """Simple rate limiter using in-memory storage"""
    
    def __init__(self):
        self.requests: Dict[str, List[datetime]] = {}
    
    def is_allowed(
        self,
        identifier: str,
        max_requests: int = 100,
        window_seconds: int = 60
    ) -> bool:
        """Check if request is allowed under rate limit"""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        # Get requests for this identifier
        if identifier not in self.requests:
            self.requests[identifier] = []
        
        # Remove old requests outside window
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > window_start
        ]
        
        # Check if under limit
        if len(self.requests[identifier]) >= max_requests:
            return False
        
        # Add current request
        self.requests[identifier].append(now)
        return True
    
    def cleanup_old_entries(self):
        """Clean up old entries to prevent memory leak"""
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=1)
        
        for identifier in list(self.requests.keys()):
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier]
                if req_time > cutoff
            ]
            
            if not self.requests[identifier]:
                del self.requests[identifier]

# Global rate limiter
rate_limiter = RateLimiter()

async def check_rate_limit(request: Request):
    """Rate limiting middleware"""
    client_ip = request.client.host
    
    if not rate_limiter.is_allowed(client_ip, max_requests=100, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )

# ============================================================================
# INPUT VALIDATION AND SANITIZATION
# ============================================================================

class InputValidator:
    """Input validation and sanitization"""
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Trim whitespace
        value = value.strip()
        
        # Limit length
        if len(value) > max_length:
            value = value[:max_length]
        
        return value
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """Validate password strength"""
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        
        if not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        
        if not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one digit"
        
        return True, "Password is strong"

# ============================================================================
# AUDIT LOGGING
# ============================================================================

class AuditLogger:
    """Security audit logging"""
    
    @staticmethod
    async def log_authentication(
        user_id: str,
        action: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log authentication events"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            "success": success,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "details": details or {}
        }
        
        # In production, save to database
        print(f"[AUDIT] {log_entry}")
    
    @staticmethod
    async def log_authorization(
        user_id: str,
        resource: str,
        action: str,
        granted: bool,
        reason: Optional[str] = None
    ):
        """Log authorization events"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "resource": resource,
            "action": action,
            "granted": granted,
            "reason": reason
        }
        
        # In production, save to database
        print(f"[AUDIT] {log_entry}")

