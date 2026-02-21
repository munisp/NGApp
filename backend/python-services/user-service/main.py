"""
User Service - Production Implementation
User management, authentication, and profile handling
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uvicorn
import uuid
import logging
import hashlib
import secrets
import re
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="User Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

security = HTTPBearer()

# Enums
class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"
    PENDING_VERIFICATION = "pending_verification"

class UserRole(str, Enum):
    USER = "user"
    PREMIUM = "premium"
    BUSINESS = "business"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class KYCLevel(str, Enum):
    NONE = "none"
    BASIC = "basic"  # Email + Phone verified
    INTERMEDIATE = "intermediate"  # + ID document
    ADVANCED = "advanced"  # + Address proof + Biometric

# Models
class User(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone_number: Optional[str] = None
    password_hash: str
    
    # Personal info
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    
    # Address
    country: str
    city: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Account details
    status: UserStatus = UserStatus.PENDING_VERIFICATION
    role: UserRole = UserRole.USER
    kyc_level: KYCLevel = KYCLevel.NONE
    
    # Verification
    email_verified: bool = False
    phone_verified: bool = False
    email_verification_token: Optional[str] = None
    phone_verification_code: Optional[str] = None
    
    # Security
    two_factor_enabled: bool = False
    two_factor_secret: Optional[str] = None
    failed_login_attempts: int = 0
    last_login_at: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None
    
    # Preferences
    preferred_language: str = "en"
    preferred_currency: str = "USD"
    timezone: str = "UTC"
    
    # Metadata
    referral_code: str = Field(default_factory=lambda: secrets.token_urlsafe(8))
    referred_by: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None

class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = None
    first_name: str
    last_name: str
    country: str
    referred_by: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain number')
        return v

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    timezone: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    two_factor_code: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    expires_in: int = 3600

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class VerifyEmailRequest(BaseModel):
    token: str

class VerifyPhoneRequest(BaseModel):
    code: str

class UserProfile(BaseModel):
    user_id: str
    email: str
    phone_number: Optional[str]
    first_name: str
    last_name: str
    country: str
    status: UserStatus
    role: UserRole
    kyc_level: KYCLevel
    email_verified: bool
    phone_verified: bool
    referral_code: str
    created_at: datetime

# Storage
users_db: Dict[str, User] = {}
email_index: Dict[str, str] = {}  # email -> user_id
tokens_db: Dict[str, str] = {}  # token -> user_id
refresh_tokens_db: Dict[str, str] = {}  # refresh_token -> user_id

class UserService:
    """Production user service"""
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash password"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    @staticmethod
    def _verify_password(password: str, password_hash: str) -> bool:
        """Verify password"""
        return UserService._hash_password(password) == password_hash
    
    @staticmethod
    def _generate_token() -> str:
        """Generate access token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    async def create_user(request: CreateUserRequest) -> User:
        """Create new user"""
        
        # Check if email exists
        if request.email.lower() in email_index:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password
        password_hash = UserService._hash_password(request.password)
        
        # Generate verification token
        email_verification_token = secrets.token_urlsafe(32)
        phone_verification_code = str(secrets.randbelow(1000000)).zfill(6)
        
        # Create user
        user = User(
            email=request.email.lower(),
            phone_number=request.phone_number,
            password_hash=password_hash,
            first_name=request.first_name,
            last_name=request.last_name,
            country=request.country,
            referred_by=request.referred_by,
            email_verification_token=email_verification_token,
            phone_verification_code=phone_verification_code
        )
        
        # Store
        users_db[user.user_id] = user
        email_index[user.email] = user.user_id
        
        logger.info(f"Created user {user.user_id}: {user.email}")
        
        # Would send verification email/SMS here
        logger.info(f"Email verification token: {email_verification_token}")
        logger.info(f"Phone verification code: {phone_verification_code}")
        
        return user
    
    @staticmethod
    async def login(request: LoginRequest) -> LoginResponse:
        """User login"""
        
        # Find user
        if request.email.lower() not in email_index:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_id = email_index[request.email.lower()]
        user = users_db[user_id]
        
        # Check password
        if not UserService._verify_password(request.password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.status = UserStatus.SUSPENDED
                logger.warning(f"User {user_id} suspended after 5 failed login attempts")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check status
        if user.status != UserStatus.ACTIVE and user.status != UserStatus.PENDING_VERIFICATION:
            raise HTTPException(status_code=403, detail=f"Account {user.status}")
        
        # Check 2FA
        if user.two_factor_enabled:
            if not request.two_factor_code:
                raise HTTPException(status_code=403, detail="2FA code required")
            # Would verify 2FA code here
        
        # Generate tokens
        access_token = UserService._generate_token()
        refresh_token = UserService._generate_token()
        
        tokens_db[access_token] = user_id
        refresh_tokens_db[refresh_token] = user_id
        
        # Update user
        user.failed_login_attempts = 0
        user.last_login_at = datetime.utcnow()
        user.last_active_at = datetime.utcnow()
        
        logger.info(f"User {user_id} logged in")
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user_id
        )
    
    @staticmethod
    async def get_user(user_id: str) -> User:
        """Get user by ID"""
        
        if user_id not in users_db:
            raise HTTPException(status_code=404, detail="User not found")
        
        return users_db[user_id]
    
    @staticmethod
    async def get_profile(user_id: str) -> UserProfile:
        """Get user profile"""
        
        user = await UserService.get_user(user_id)
        
        return UserProfile(
            user_id=user.user_id,
            email=user.email,
            phone_number=user.phone_number,
            first_name=user.first_name,
            last_name=user.last_name,
            country=user.country,
            status=user.status,
            role=user.role,
            kyc_level=user.kyc_level,
            email_verified=user.email_verified,
            phone_verified=user.phone_verified,
            referral_code=user.referral_code,
            created_at=user.created_at
        )
    
    @staticmethod
    async def update_user(user_id: str, request: UpdateUserRequest) -> User:
        """Update user"""
        
        user = await UserService.get_user(user_id)
        
        # Update fields
        if request.first_name:
            user.first_name = request.first_name
        if request.last_name:
            user.last_name = request.last_name
        if request.phone_number:
            user.phone_number = request.phone_number
        if request.date_of_birth:
            user.date_of_birth = request.date_of_birth
        if request.gender:
            user.gender = request.gender
        if request.city:
            user.city = request.city
        if request.address:
            user.address = request.address
        if request.postal_code:
            user.postal_code = request.postal_code
        if request.preferred_language:
            user.preferred_language = request.preferred_language
        if request.preferred_currency:
            user.preferred_currency = request.preferred_currency
        if request.timezone:
            user.timezone = request.timezone
        
        user.updated_at = datetime.utcnow()
        
        logger.info(f"Updated user {user_id}")
        return user
    
    @staticmethod
    async def verify_email(user_id: str, token: str) -> User:
        """Verify email"""
        
        user = await UserService.get_user(user_id)
        
        if user.email_verified:
            raise HTTPException(status_code=400, detail="Email already verified")
        
        if user.email_verification_token != token:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        
        user.email_verified = True
        user.email_verification_token = None
        
        # Upgrade KYC level
        if user.kyc_level == KYCLevel.NONE:
            user.kyc_level = KYCLevel.BASIC
        
        # Activate account
        if user.status == UserStatus.PENDING_VERIFICATION:
            user.status = UserStatus.ACTIVE
        
        user.updated_at = datetime.utcnow()
        
        logger.info(f"Verified email for user {user_id}")
        return user
    
    @staticmethod
    async def verify_phone(user_id: str, code: str) -> User:
        """Verify phone"""
        
        user = await UserService.get_user(user_id)
        
        if user.phone_verified:
            raise HTTPException(status_code=400, detail="Phone already verified")
        
        if user.phone_verification_code != code:
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
        user.phone_verified = True
        user.phone_verification_code = None
        
        # Upgrade KYC level
        if user.kyc_level == KYCLevel.NONE and user.email_verified:
            user.kyc_level = KYCLevel.BASIC
        
        user.updated_at = datetime.utcnow()
        
        logger.info(f"Verified phone for user {user_id}")
        return user
    
    @staticmethod
    async def change_password(user_id: str, request: ChangePasswordRequest) -> Dict:
        """Change password"""
        
        user = await UserService.get_user(user_id)
        
        # Verify current password
        if not UserService._verify_password(request.current_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid current password")
        
        # Update password
        user.password_hash = UserService._hash_password(request.new_password)
        user.password_changed_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        
        logger.info(f"Changed password for user {user_id}")
        return {"status": "success", "message": "Password changed"}
    
    @staticmethod
    async def verify_token(token: str) -> str:
        """Verify access token"""
        
        if token not in tokens_db:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return tokens_db[token]

# API Endpoints
@app.post("/api/v1/users/register", response_model=UserProfile)
async def register(request: CreateUserRequest):
    """Register new user"""
    user = await UserService.create_user(request)
    return await UserService.get_profile(user.user_id)

@app.post("/api/v1/users/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """User login"""
    return await UserService.login(request)

@app.get("/api/v1/users/me", response_model=UserProfile)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user profile"""
    user_id = await UserService.verify_token(credentials.credentials)
    return await UserService.get_profile(user_id)

@app.get("/api/v1/users/{user_id}", response_model=UserProfile)
async def get_user(user_id: str):
    """Get user by ID"""
    return await UserService.get_profile(user_id)

@app.put("/api/v1/users/{user_id}", response_model=UserProfile)
async def update_user(user_id: str, request: UpdateUserRequest):
    """Update user"""
    await UserService.update_user(user_id, request)
    return await UserService.get_profile(user_id)

@app.post("/api/v1/users/{user_id}/verify-email")
async def verify_email(user_id: str, request: VerifyEmailRequest):
    """Verify email"""
    await UserService.verify_email(user_id, request.token)
    return {"status": "success", "message": "Email verified"}

@app.post("/api/v1/users/{user_id}/verify-phone")
async def verify_phone(user_id: str, request: VerifyPhoneRequest):
    """Verify phone"""
    await UserService.verify_phone(user_id, request.code)
    return {"status": "success", "message": "Phone verified"}

@app.post("/api/v1/users/{user_id}/change-password")
async def change_password(user_id: str, request: ChangePasswordRequest):
    """Change password"""
    return await UserService.change_password(user_id, request)

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "service": "user-service",
        "version": "2.0.0",
        "total_users": len(users_db),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8070)
