"""
Security Features for SocialEscrow
Implements MFA, WebAuthn/Biometric authentication, session management,
and integrates with Keycloak for SSO.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List, Dict
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer, LargeBinary

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class MFAMethod(str, Enum):
    TOTP = "totp"  # Time-based OTP (Google Authenticator)
    SMS = "sms"
    EMAIL = "email"
    WEBAUTHN = "webauthn"  # Biometric/Security Key


class SessionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AuthEventType(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    MFA_VERIFIED = "mfa_verified"
    PASSWORD_CHANGED = "password_changed"
    WEBAUTHN_REGISTERED = "webauthn_registered"
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


# Database Models
class UserMFA(Base):
    __tablename__ = "user_mfa"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # MFA settings
    mfa_enabled = Column(Boolean, default=False)
    primary_method = Column(SQLEnum(MFAMethod))
    
    # TOTP
    totp_secret = Column(String(64))  # Encrypted
    totp_enabled = Column(Boolean, default=False)
    totp_verified_at = Column(DateTime)
    
    # SMS
    sms_enabled = Column(Boolean, default=False)
    sms_phone = Column(String(20))
    sms_verified_at = Column(DateTime)
    
    # Email
    email_enabled = Column(Boolean, default=False)
    email_address = Column(String(200))
    email_verified_at = Column(DateTime)
    
    # Backup codes
    backup_codes = Column(Text)  # JSON array, hashed
    backup_codes_generated_at = Column(DateTime)
    backup_codes_used = Column(Integer, default=0)
    
    # Recovery
    recovery_email = Column(String(200))
    recovery_phone = Column(String(20))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    # Credential details
    credential_id = Column(LargeBinary, unique=True, nullable=False)
    public_key = Column(LargeBinary, nullable=False)
    sign_count = Column(Integer, default=0)
    
    # Device info
    device_name = Column(String(200))
    device_type = Column(String(50))  # platform, cross-platform
    aaguid = Column(String(36))
    
    # Status
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    # Session token
    session_token = Column(String(64), unique=True, nullable=False, index=True)
    refresh_token = Column(String(64), unique=True, index=True)
    
    # Status
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.ACTIVE)
    
    # Device info
    device_id = Column(String(100))
    device_name = Column(String(200))
    device_type = Column(String(50))
    user_agent = Column(Text)
    
    # Location
    ip_address = Column(String(45))
    country = Column(String(100))
    city = Column(String(100))
    
    # MFA
    mfa_verified = Column(Boolean, default=False)
    mfa_verified_at = Column(DateTime)
    
    # Expiry
    expires_at = Column(DateTime, nullable=False)
    refresh_expires_at = Column(DateTime)
    
    # Activity
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthAuditLog(Base):
    __tablename__ = "auth_audit_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    event_type = Column(SQLEnum(AuthEventType), nullable=False)
    event_details = Column(Text)  # JSON
    
    # Context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    device_id = Column(String(100))
    
    # Risk
    risk_score = Column(Float, default=0.0)
    is_suspicious = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class MFAChallenge(Base):
    __tablename__ = "mfa_challenges"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    method = Column(SQLEnum(MFAMethod), nullable=False)
    challenge_code = Column(String(10))  # For SMS/Email
    challenge_data = Column(Text)  # For WebAuthn
    
    # Status
    is_verified = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    # Expiry
    expires_at = Column(DateTime, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models
class EnableTOTPRequest(BaseModel):
    verification_code: str


class VerifyMFARequest(BaseModel):
    method: MFAMethod
    code: str
    challenge_id: Optional[str] = None


class RegisterWebAuthnRequest(BaseModel):
    credential_id: str  # Base64
    public_key: str  # Base64
    attestation_object: str  # Base64
    client_data_json: str  # Base64
    device_name: Optional[str] = None


class WebAuthnAuthenticateRequest(BaseModel):
    credential_id: str  # Base64
    authenticator_data: str  # Base64
    client_data_json: str  # Base64
    signature: str  # Base64


# Keycloak Client
class KeycloakClient:
    """Keycloak Admin API client for SSO integration"""
    
    def __init__(self, server_url: str, realm: str, client_id: str, client_secret: str):
        self.server_url = server_url.rstrip("/")
        self.realm = realm
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token = None
        self._token_expires_at = None
    
    async def _get_admin_token(self) -> str:
        """Get admin access token"""
        if self._access_token and self._token_expires_at and datetime.utcnow() < self._token_expires_at:
            return self._access_token
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                }
            )
            data = response.json()
            self._access_token = data["access_token"]
            self._token_expires_at = datetime.utcnow() + timedelta(seconds=data["expires_in"] - 60)
            return self._access_token
    
    async def create_user(self, username: str, email: str, password: str, attributes: Optional[dict] = None) -> dict:
        """Create a new user in Keycloak"""
        token = await self._get_admin_token()
        
        user_data = {
            "username": username,
            "email": email,
            "enabled": True,
            "emailVerified": False,
            "credentials": [{"type": "password", "value": password, "temporary": False}],
            "attributes": attributes or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.server_url}/admin/realms/{self.realm}/users",
                json=user_data,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 201:
                # Get user ID from location header
                location = response.headers.get("Location", "")
                user_id = location.split("/")[-1]
                return {"id": user_id, "username": username}
            
            return response.json()
    
    async def get_user(self, user_id: str) -> dict:
        """Get user by ID"""
        token = await self._get_admin_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.server_url}/admin/realms/{self.realm}/users/{user_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            return response.json()
    
    async def update_user(self, user_id: str, updates: dict) -> bool:
        """Update user attributes"""
        token = await self._get_admin_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.server_url}/admin/realms/{self.realm}/users/{user_id}",
                json=updates,
                headers={"Authorization": f"Bearer {token}"}
            )
            return response.status_code == 204
    
    async def enable_totp(self, user_id: str) -> dict:
        """Enable TOTP for user"""
        token = await self._get_admin_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.server_url}/admin/realms/{self.realm}/users/{user_id}",
                json={"requiredActions": ["CONFIGURE_TOTP"]},
                headers={"Authorization": f"Bearer {token}"}
            )
            return {"success": response.status_code == 204}
    
    async def verify_token(self, token: str) -> dict:
        """Verify and decode an access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/token/introspect",
                data={
                    "token": token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                }
            )
            return response.json()
    
    async def logout_user(self, user_id: str) -> bool:
        """Logout user from all sessions"""
        token = await self._get_admin_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.server_url}/admin/realms/{self.realm}/users/{user_id}/logout",
                headers={"Authorization": f"Bearer {token}"}
            )
            return response.status_code == 204


# TOTP Service
class TOTPService:
    """Time-based One-Time Password service"""
    
    def __init__(self, issuer: str = "SocialEscrow"):
        self.issuer = issuer
    
    def generate_secret(self) -> str:
        """Generate a new TOTP secret"""
        return base64.b32encode(secrets.token_bytes(20)).decode()
    
    def get_provisioning_uri(self, secret: str, email: str) -> str:
        """Get the provisioning URI for authenticator apps"""
        import urllib.parse
        params = {
            "secret": secret,
            "issuer": self.issuer,
            "algorithm": "SHA1",
            "digits": "6",
            "period": "30",
        }
        return f"otpauth://totp/{self.issuer}:{email}?{urllib.parse.urlencode(params)}"
    
    def verify_code(self, secret: str, code: str, window: int = 1) -> bool:
        """Verify a TOTP code"""
        import time
        import struct
        
        try:
            code = int(code)
        except ValueError:
            return False
        
        # Decode secret
        try:
            key = base64.b32decode(secret.upper())
        except Exception:
            return False
        
        # Check codes within window
        current_time = int(time.time()) // 30
        
        for offset in range(-window, window + 1):
            counter = current_time + offset
            counter_bytes = struct.pack(">Q", counter)
            
            # Generate HMAC
            h = hmac.new(key, counter_bytes, hashlib.sha1).digest()
            
            # Dynamic truncation
            offset_val = h[-1] & 0x0F
            truncated = struct.unpack(">I", h[offset_val:offset_val + 4])[0]
            truncated &= 0x7FFFFFFF
            otp = truncated % 1000000
            
            if otp == code:
                return True
        
        return False


# Security Service
class SecurityService:
    """Main security service for MFA and session management"""
    
    SESSION_DURATION_HOURS = 24
    REFRESH_TOKEN_DURATION_DAYS = 30
    MFA_CHALLENGE_DURATION_MINUTES = 10
    
    def __init__(
        self,
        event_bus: EventBus,
        redis_client: Any,
        keycloak_client: Optional[KeycloakClient] = None
    ):
        self.event_bus = event_bus
        self.redis = redis_client
        self.keycloak = keycloak_client
        self.totp = TOTPService()
    
    def _generate_token(self, length: int = 32) -> str:
        """Generate a secure random token"""
        return secrets.token_urlsafe(length)
    
    def _generate_otp(self, length: int = 6) -> str:
        """Generate a numeric OTP"""
        return ''.join(secrets.choice('0123456789') for _ in range(length))
    
    def _hash_code(self, code: str) -> str:
        """Hash a backup code"""
        return hashlib.sha256(code.encode()).hexdigest()
    
    async def get_or_create_mfa(self, db, user_id: str) -> UserMFA:
        """Get or create MFA settings for user"""
        mfa = db.query(UserMFA).filter(UserMFA.user_id == user_id).first()
        
        if not mfa:
            mfa = UserMFA(user_id=user_id)
            db.add(mfa)
            db.commit()
            db.refresh(mfa)
        
        return mfa
    
    async def setup_totp(self, db, user_id: str, email: str) -> dict:
        """Setup TOTP for user"""
        mfa = await self.get_or_create_mfa(db, user_id)
        
        # Generate new secret
        secret = self.totp.generate_secret()
        mfa.totp_secret = secret  # Should be encrypted in production
        db.commit()
        
        # Generate provisioning URI
        uri = self.totp.get_provisioning_uri(secret, email)
        
        return {
            "secret": secret,
            "provisioning_uri": uri,
        }
    
    async def enable_totp(
        self,
        db,
        user_id: str,
        verification_code: str
    ) -> bool:
        """Enable TOTP after verification"""
        mfa = await self.get_or_create_mfa(db, user_id)
        
        if not mfa.totp_secret:
            raise ValueError("TOTP not set up")
        
        if not self.totp.verify_code(mfa.totp_secret, verification_code):
            raise ValueError("Invalid verification code")
        
        mfa.totp_enabled = True
        mfa.totp_verified_at = datetime.utcnow()
        mfa.mfa_enabled = True
        mfa.primary_method = MFAMethod.TOTP
        
        # Generate backup codes
        backup_codes = [self._generate_token(8) for _ in range(10)]
        mfa.backup_codes = json.dumps([self._hash_code(c) for c in backup_codes])
        mfa.backup_codes_generated_at = datetime.utcnow()
        
        db.commit()
        
        # Log event
        await self._log_auth_event(db, user_id, AuthEventType.MFA_ENABLED, {
            "method": MFAMethod.TOTP.value
        })
        
        return True, backup_codes
    
    async def verify_totp(self, db, user_id: str, code: str) -> bool:
        """Verify TOTP code"""
        mfa = db.query(UserMFA).filter(UserMFA.user_id == user_id).first()
        
        if not mfa or not mfa.totp_enabled:
            raise ValueError("TOTP not enabled")
        
        if self.totp.verify_code(mfa.totp_secret, code):
            await self._log_auth_event(db, user_id, AuthEventType.MFA_VERIFIED, {
                "method": MFAMethod.TOTP.value
            })
            return True
        
        # Check backup codes
        if mfa.backup_codes:
            backup_codes = json.loads(mfa.backup_codes)
            code_hash = self._hash_code(code)
            
            if code_hash in backup_codes:
                backup_codes.remove(code_hash)
                mfa.backup_codes = json.dumps(backup_codes)
                mfa.backup_codes_used += 1
                db.commit()
                
                await self._log_auth_event(db, user_id, AuthEventType.MFA_VERIFIED, {
                    "method": "backup_code"
                })
                return True
        
        return False
    
    async def send_sms_otp(self, db, user_id: str, phone: str) -> str:
        """Send OTP via SMS"""
        mfa = await self.get_or_create_mfa(db, user_id)
        
        otp = self._generate_otp()
        
        # Create challenge
        challenge = MFAChallenge(
            user_id=user_id,
            method=MFAMethod.SMS,
            challenge_code=self._hash_code(otp),
            expires_at=datetime.utcnow() + timedelta(minutes=self.MFA_CHALLENGE_DURATION_MINUTES),
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        
        # Send SMS (integrate with SMS provider)
        await self.event_bus.publish(Event(
            type="sms.send",
            data={
                "phone": phone,
                "message": f"Your SocialEscrow verification code is: {otp}. Valid for 10 minutes.",
            }
        ))
        
        return challenge.id
    
    async def send_email_otp(self, db, user_id: str, email: str) -> str:
        """Send OTP via email"""
        mfa = await self.get_or_create_mfa(db, user_id)
        
        otp = self._generate_otp()
        
        # Create challenge
        challenge = MFAChallenge(
            user_id=user_id,
            method=MFAMethod.EMAIL,
            challenge_code=self._hash_code(otp),
            expires_at=datetime.utcnow() + timedelta(minutes=self.MFA_CHALLENGE_DURATION_MINUTES),
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        
        # Send email
        await self.event_bus.publish(Event(
            type="email.send",
            data={
                "to": email,
                "subject": "SocialEscrow Verification Code",
                "body": f"Your verification code is: {otp}. Valid for 10 minutes.",
            }
        ))
        
        return challenge.id
    
    async def verify_otp_challenge(
        self,
        db,
        challenge_id: str,
        code: str
    ) -> bool:
        """Verify OTP challenge"""
        challenge = db.query(MFAChallenge).filter(
            MFAChallenge.id == challenge_id
        ).first()
        
        if not challenge:
            raise ValueError("Challenge not found")
        
        if challenge.expires_at < datetime.utcnow():
            raise ValueError("Challenge expired")
        
        if challenge.attempts >= challenge.max_attempts:
            raise ValueError("Too many attempts")
        
        challenge.attempts += 1
        
        if self._hash_code(code) == challenge.challenge_code:
            challenge.is_verified = True
            db.commit()
            
            await self._log_auth_event(db, challenge.user_id, AuthEventType.MFA_VERIFIED, {
                "method": challenge.method.value
            })
            return True
        
        db.commit()
        return False
    
    async def register_webauthn(
        self,
        db,
        user_id: str,
        request: RegisterWebAuthnRequest
    ) -> WebAuthnCredential:
        """Register a WebAuthn credential"""
        
        credential = WebAuthnCredential(
            user_id=user_id,
            credential_id=base64.b64decode(request.credential_id),
            public_key=base64.b64decode(request.public_key),
            device_name=request.device_name or "Security Key",
            device_type="cross-platform",
        )
        
        db.add(credential)
        
        # Enable WebAuthn MFA
        mfa = await self.get_or_create_mfa(db, user_id)
        mfa.mfa_enabled = True
        if not mfa.primary_method:
            mfa.primary_method = MFAMethod.WEBAUTHN
        
        db.commit()
        db.refresh(credential)
        
        await self._log_auth_event(db, user_id, AuthEventType.WEBAUTHN_REGISTERED, {
            "device_name": credential.device_name
        })
        
        return credential
    
    async def create_session(
        self,
        db,
        user_id: str,
        device_info: dict,
        mfa_verified: bool = False
    ) -> UserSession:
        """Create a new user session"""
        
        session = UserSession(
            user_id=user_id,
            session_token=self._generate_token(),
            refresh_token=self._generate_token(),
            device_id=device_info.get("device_id"),
            device_name=device_info.get("device_name"),
            device_type=device_info.get("device_type"),
            user_agent=device_info.get("user_agent"),
            ip_address=device_info.get("ip_address"),
            country=device_info.get("country"),
            city=device_info.get("city"),
            mfa_verified=mfa_verified,
            mfa_verified_at=datetime.utcnow() if mfa_verified else None,
            expires_at=datetime.utcnow() + timedelta(hours=self.SESSION_DURATION_HOURS),
            refresh_expires_at=datetime.utcnow() + timedelta(days=self.REFRESH_TOKEN_DURATION_DAYS),
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # Cache session
        await self.redis.set(
            f"session:{session.session_token}",
            json.dumps({
                "user_id": user_id,
                "mfa_verified": mfa_verified,
                "expires_at": session.expires_at.isoformat(),
            }),
            ex=self.SESSION_DURATION_HOURS * 3600
        )
        
        await self._log_auth_event(db, user_id, AuthEventType.SESSION_CREATED, {
            "device_name": device_info.get("device_name"),
            "ip_address": device_info.get("ip_address"),
        })
        
        return session
    
    async def validate_session(self, db, session_token: str) -> Optional[dict]:
        """Validate a session token"""
        
        # Check cache first
        cached = await self.redis.get(f"session:{session_token}")
        if cached:
            data = json.loads(cached)
            if datetime.fromisoformat(data["expires_at"]) > datetime.utcnow():
                return data
        
        # Check database
        session = db.query(UserSession).filter(
            UserSession.session_token == session_token,
            UserSession.status == SessionStatus.ACTIVE
        ).first()
        
        if not session:
            return None
        
        if session.expires_at < datetime.utcnow():
            session.status = SessionStatus.EXPIRED
            db.commit()
            return None
        
        # Update last activity
        session.last_activity_at = datetime.utcnow()
        db.commit()
        
        return {
            "user_id": session.user_id,
            "mfa_verified": session.mfa_verified,
            "expires_at": session.expires_at.isoformat(),
        }
    
    async def refresh_session(self, db, refresh_token: str) -> Optional[UserSession]:
        """Refresh a session using refresh token"""
        
        session = db.query(UserSession).filter(
            UserSession.refresh_token == refresh_token,
            UserSession.status == SessionStatus.ACTIVE
        ).first()
        
        if not session:
            return None
        
        if session.refresh_expires_at < datetime.utcnow():
            session.status = SessionStatus.EXPIRED
            db.commit()
            return None
        
        # Create new session
        new_session = await self.create_session(
            db,
            session.user_id,
            {
                "device_id": session.device_id,
                "device_name": session.device_name,
                "device_type": session.device_type,
                "user_agent": session.user_agent,
                "ip_address": session.ip_address,
            },
            mfa_verified=session.mfa_verified
        )
        
        # Revoke old session
        session.status = SessionStatus.REVOKED
        db.commit()
        
        return new_session
    
    async def revoke_session(self, db, session_token: str, user_id: str):
        """Revoke a session"""
        
        session = db.query(UserSession).filter(
            UserSession.session_token == session_token,
            UserSession.user_id == user_id
        ).first()
        
        if session:
            session.status = SessionStatus.REVOKED
            db.commit()
            
            # Remove from cache
            await self.redis.delete(f"session:{session_token}")
            
            await self._log_auth_event(db, user_id, AuthEventType.SESSION_REVOKED, {})
    
    async def revoke_all_sessions(self, db, user_id: str, except_current: Optional[str] = None):
        """Revoke all sessions for a user"""
        
        query = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.status == SessionStatus.ACTIVE
        )
        
        if except_current:
            query = query.filter(UserSession.session_token != except_current)
        
        sessions = query.all()
        
        for session in sessions:
            session.status = SessionStatus.REVOKED
            await self.redis.delete(f"session:{session.session_token}")
        
        db.commit()
    
    async def get_active_sessions(self, db, user_id: str) -> List[UserSession]:
        """Get all active sessions for a user"""
        
        return db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.status == SessionStatus.ACTIVE
        ).order_by(UserSession.last_activity_at.desc()).all()
    
    async def _log_auth_event(
        self,
        db,
        user_id: str,
        event_type: AuthEventType,
        details: dict,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log an authentication event"""
        
        log = AuthAuditLog(
            user_id=user_id,
            event_type=event_type,
            event_details=json.dumps(details),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        db.add(log)
        db.commit()
        
        # Publish event
        await self.event_bus.publish(Event(
            type=f"auth.{event_type.value}",
            data={
                "user_id": user_id,
                "event_type": event_type.value,
                **details,
            }
        ))
    
    async def check_suspicious_activity(
        self,
        db,
        user_id: str,
        ip_address: str,
        device_id: Optional[str] = None
    ) -> dict:
        """Check for suspicious login activity"""
        
        risk_score = 0.0
        risk_factors = []
        
        # Check for new device
        if device_id:
            known_device = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.device_id == device_id
            ).first()
            
            if not known_device:
                risk_score += 2.0
                risk_factors.append("new_device")
        
        # Check for new IP
        recent_ips = db.query(UserSession.ip_address).filter(
            UserSession.user_id == user_id,
            UserSession.created_at > datetime.utcnow() - timedelta(days=30)
        ).distinct().all()
        
        if ip_address not in [ip[0] for ip in recent_ips]:
            risk_score += 1.0
            risk_factors.append("new_ip")
        
        # Check for multiple failed attempts
        recent_failures = db.query(AuthAuditLog).filter(
            AuthAuditLog.user_id == user_id,
            AuthAuditLog.event_type == AuthEventType.SUSPICIOUS_ACTIVITY,
            AuthAuditLog.created_at > datetime.utcnow() - timedelta(hours=1)
        ).count()
        
        if recent_failures >= 3:
            risk_score += 3.0
            risk_factors.append("multiple_failures")
        
        is_suspicious = risk_score >= 3.0
        
        if is_suspicious:
            await self._log_auth_event(db, user_id, AuthEventType.SUSPICIOUS_ACTIVITY, {
                "risk_score": risk_score,
                "risk_factors": risk_factors,
                "ip_address": ip_address,
            })
        
        return {
            "is_suspicious": is_suspicious,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "require_mfa": risk_score >= 2.0,
        }


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/security", tags=["security"])


@router.get("/mfa/status")
async def get_mfa_status(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get MFA status for user"""
    from app.main import get_security_service
    service = get_security_service()
    
    mfa = await service.get_or_create_mfa(db, user_id)
    
    return {
        "mfa_enabled": mfa.mfa_enabled,
        "primary_method": mfa.primary_method.value if mfa.primary_method else None,
        "totp_enabled": mfa.totp_enabled,
        "sms_enabled": mfa.sms_enabled,
        "email_enabled": mfa.email_enabled,
        "backup_codes_remaining": 10 - mfa.backup_codes_used if mfa.backup_codes else 0,
    }


@router.post("/mfa/totp/setup")
async def setup_totp(
    user_id: str = Query(...),
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Setup TOTP for user"""
    from app.main import get_security_service
    service = get_security_service()
    
    result = await service.setup_totp(db, user_id, email)
    return result


@router.post("/mfa/totp/enable")
async def enable_totp(
    request: EnableTOTPRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Enable TOTP after verification"""
    try:
        from app.main import get_security_service
        service = get_security_service()
        success, backup_codes = await service.enable_totp(db, user_id, request.verification_code)
        return {"success": success, "backup_codes": backup_codes}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mfa/verify")
async def verify_mfa(
    request: VerifyMFARequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Verify MFA code"""
    from app.main import get_security_service
    service = get_security_service()
    
    if request.method == MFAMethod.TOTP:
        success = await service.verify_totp(db, user_id, request.code)
    elif request.method in [MFAMethod.SMS, MFAMethod.EMAIL]:
        if not request.challenge_id:
            raise HTTPException(status_code=400, detail="Challenge ID required")
        success = await service.verify_otp_challenge(db, request.challenge_id, request.code)
    else:
        raise HTTPException(status_code=400, detail="Unsupported MFA method")
    
    return {"success": success}


@router.post("/mfa/sms/send")
async def send_sms_otp(
    user_id: str = Query(...),
    phone: str = Query(...),
    db: Session = Depends(get_db),
):
    """Send OTP via SMS"""
    from app.main import get_security_service
    service = get_security_service()
    
    challenge_id = await service.send_sms_otp(db, user_id, phone)
    return {"challenge_id": challenge_id}


@router.post("/mfa/email/send")
async def send_email_otp(
    user_id: str = Query(...),
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Send OTP via email"""
    from app.main import get_security_service
    service = get_security_service()
    
    challenge_id = await service.send_email_otp(db, user_id, email)
    return {"challenge_id": challenge_id}


@router.post("/webauthn/register")
async def register_webauthn(
    request: RegisterWebAuthnRequest,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Register a WebAuthn credential"""
    from app.main import get_security_service
    service = get_security_service()
    
    credential = await service.register_webauthn(db, user_id, request)
    return {
        "credential_id": credential.id,
        "device_name": credential.device_name,
    }


@router.get("/sessions")
async def get_active_sessions(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get all active sessions for user"""
    from app.main import get_security_service
    service = get_security_service()
    
    sessions = await service.get_active_sessions(db, user_id)
    
    return [
        {
            "id": s.id,
            "device_name": s.device_name,
            "device_type": s.device_type,
            "ip_address": s.ip_address,
            "country": s.country,
            "city": s.city,
            "last_activity_at": s.last_activity_at.isoformat(),
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.post("/sessions/revoke/{session_id}")
async def revoke_session(
    session_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Revoke a specific session"""
    from app.main import get_security_service
    service = get_security_service()
    
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await service.revoke_session(db, session.session_token, user_id)
    return {"status": "revoked"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    user_id: str = Query(...),
    current_session_token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Revoke all sessions except current"""
    from app.main import get_security_service
    service = get_security_service()
    
    await service.revoke_all_sessions(db, user_id, except_current=current_session_token)
    return {"status": "all_revoked"}
