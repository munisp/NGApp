"""
RBAC Middleware for Liveness Detection Service
Integrates Keycloak authentication and Permify authorization
"""

import os
import logging
from typing import Optional, List
from functools import wraps

import jwt
import requests
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# Configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "kyc-kyb-system")
PERMIFY_URL = os.getenv("PERMIFY_URL", "http://localhost:3476")

# Keycloak public key cache
_keycloak_public_key = None

security = HTTPBearer()


class RBACMiddleware:
    """RBAC Middleware for authentication and authorization"""
    
    def __init__(self):
        self.keycloak_url = KEYCLOAK_URL
        self.realm = KEYCLOAK_REALM
        self.permify_url = PERMIFY_URL
        self.public_key = None
        
    def get_keycloak_public_key(self) -> str:
        """Get Keycloak public key for JWT verification"""
        global _keycloak_public_key
        
        if _keycloak_public_key:
            return _keycloak_public_key
            
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}"
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            
            realm_info = response.json()
            public_key = realm_info.get("public_key")
            
            if not public_key:
                raise ValueError("Public key not found in realm info")
                
            _keycloak_public_key = f"-----BEGIN PUBLIC KEY-----\n{public_key}\n-----END PUBLIC KEY-----"
            return _keycloak_public_key
            
        except Exception as e:
            logger.error(f"Failed to get Keycloak public key: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
    
    def verify_token(self, token: str) -> dict:
        """Verify JWT token from Keycloak"""
        try:
            public_key = self.get_keycloak_public_key()
            
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience="account",
                options={"verify_exp": True}
            )
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
    
    def extract_user_info(self, payload: dict) -> dict:
        """Extract user information from JWT payload"""
        return {
            "user_id": payload.get("sub"),
            "username": payload.get("preferred_username"),
            "email": payload.get("email"),
            "roles": payload.get("realm_access", {}).get("roles", []),
            "organization_id": payload.get("organization_id"),
            "name": payload.get("name"),
        }
    
    def check_permission(
        self,
        user_id: str,
        permission: str,
        resource_id: Optional[str] = None
    ) -> bool:
        """Check permission using Permify"""
        try:
            url = f"{self.permify_url}/v1/permissions/check"
            
            # Determine entity type based on permission
            if permission.startswith("liveness"):
                entity_type = "liveness_check"
            else:
                entity_type = "user"
            
            payload = {
                "entity": {
                    "type": entity_type,
                    "id": resource_id or "default"
                },
                "permission": permission,
                "subject": {
                    "type": "user",
                    "id": user_id
                }
            }
            
            response = requests.post(url, json=payload, timeout=2)
            
            if response.status_code == 200:
                result = response.json()
                return result.get("can", False)
            else:
                logger.warning(f"Permify check failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            # Fail open for now (should be fail closed in production)
            return False
    
    def check_role_permission(self, roles: List[str], required_roles: List[str]) -> bool:
        """Check if user has any of the required roles"""
        return any(role in roles for role in required_roles)
    
    async def authenticate(self, request: Request) -> dict:
        """Authenticate request and extract user info"""
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        token = auth_header.split(" ")[1]
        payload = self.verify_token(token)
        user_info = self.extract_user_info(payload)
        
        # Attach user info to request state
        request.state.user = user_info
        
        return user_info


# Global middleware instance
rbac_middleware = RBACMiddleware()


def require_auth(func):
    """Decorator to require authentication"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract request from args
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found"
            )
        
        # Authenticate
        user_info = await rbac_middleware.authenticate(request)
        
        # Call original function
        return await func(*args, **kwargs)
    
    return wrapper


def require_roles(required_roles: List[str]):
    """Decorator to require specific roles"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )
            
            # Authenticate
            user_info = await rbac_middleware.authenticate(request)
            
            # Check roles
            user_roles = user_info.get("roles", [])
            
            # System administrator has access to everything
            if "system_administrator" in user_roles:
                return await func(*args, **kwargs)
            
            # Check required roles
            if not rbac_middleware.check_role_permission(user_roles, required_roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required roles: {required_roles}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_permission(permission: str):
    """Decorator to require specific permission via Permify"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )
            
            # Authenticate
            user_info = await rbac_middleware.authenticate(request)
            user_id = user_info.get("user_id")
            
            # System administrator has access to everything
            if "system_administrator" in user_info.get("roles", []):
                return await func(*args, **kwargs)
            
            # Check permission via Permify
            resource_id = kwargs.get("id") or kwargs.get("customer_id")
            
            if not rbac_middleware.check_permission(user_id, permission, resource_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {permission}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Permission constants for Liveness Service
class LivenessPermissions:
    CHECK_CREATE = "liveness.check.create"
    CHECK_READ = "liveness.check.read"
    FACE_MATCH = "liveness.face.match"
    FEATURES_EXTRACT = "liveness.features.extract"


# Role constants
class Roles:
    SYSTEM_ADMIN = "system_administrator"
    COMPLIANCE_OFFICER = "compliance_officer"
    KYC_ANALYST = "kyc_analyst"
    RISK_MANAGER = "risk_manager"
    KYC_OPERATOR = "kyc_operator"
