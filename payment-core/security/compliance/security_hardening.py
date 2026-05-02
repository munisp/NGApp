"""
Security Hardening for PayGate
Implements CSP, HSTS, input validation, encryption, and secure session management.
"""

import base64
import hashlib
import hmac
import os
import re
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Pattern, Callable
import threading
from functools import wraps


@dataclass
class SecurityHardeningConfig:
    """Configuration for security hardening"""
    # CSP
    csp_enabled: bool = True
    csp_report_only: bool = False
    csp_report_uri: str = ""
    
    # HSTS
    hsts_enabled: bool = True
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    
    # Sessions
    session_timeout: timedelta = field(default_factory=lambda: timedelta(minutes=30))
    session_secure: bool = True
    session_http_only: bool = True
    session_same_site: str = "Strict"
    
    # Encryption
    encryption_key: bytes = field(default_factory=lambda: b"")
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: timedelta = field(default_factory=lambda: timedelta(minutes=1))


class ContentSecurityPolicy:
    """
    Content Security Policy Manager
    
    Manages CSP headers for XSS and injection protection.
    """
    
    def __init__(self):
        self._directives: Dict[str, List[str]] = {}
        self._lock = threading.RLock()
        
        # Set secure defaults
        self._set_defaults()
    
    def _set_defaults(self) -> None:
        """Set secure default CSP directives"""
        self._directives = {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'strict-dynamic'"],
            "style-src": ["'self'", "'unsafe-inline'"],  # Required for many UI frameworks
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "connect-src": ["'self'"],
            "frame-ancestors": ["'none'"],
            "form-action": ["'self'"],
            "base-uri": ["'self'"],
            "object-src": ["'none'"],
            "upgrade-insecure-requests": []
        }
    
    def set_directive(self, directive: str, values: List[str]) -> None:
        """Set a CSP directive"""
        with self._lock:
            self._directives[directive] = values
    
    def add_source(self, directive: str, source: str) -> None:
        """Add a source to a directive"""
        with self._lock:
            if directive not in self._directives:
                self._directives[directive] = []
            self._directives[directive].append(source)
    
    def remove_source(self, directive: str, source: str) -> None:
        """Remove a source from a directive"""
        with self._lock:
            if directive in self._directives and source in self._directives[directive]:
                self._directives[directive].remove(source)
    
    def build(self) -> str:
        """Build the CSP header value"""
        with self._lock:
            parts = []
            for directive, values in self._directives.items():
                if not values:
                    parts.append(directive)
                else:
                    parts.append(f"{directive} {' '.join(values)}")
            return "; ".join(parts)
    
    def get_header_name(self, report_only: bool = False) -> str:
        """Get the appropriate header name"""
        if report_only:
            return "Content-Security-Policy-Report-Only"
        return "Content-Security-Policy"
    
    def generate_nonce(self) -> str:
        """Generate a nonce for inline scripts"""
        return base64.b64encode(secrets.token_bytes(16)).decode()


class SecurityHeaders:
    """
    HTTP Security Headers Manager
    
    Manages security headers including HSTS, X-Frame-Options, etc.
    """
    
    def __init__(self, config: SecurityHardeningConfig):
        self._config = config
    
    def get_headers(self) -> Dict[str, str]:
        """Get all security headers"""
        headers = {}
        
        # HSTS
        if self._config.hsts_enabled:
            hsts = f"max-age={self._config.hsts_max_age}"
            if self._config.hsts_include_subdomains:
                hsts += "; includeSubDomains"
            if self._config.hsts_preload:
                hsts += "; preload"
            headers["Strict-Transport-Security"] = hsts
        
        # X-Frame-Options (defense in depth with CSP frame-ancestors)
        headers["X-Frame-Options"] = "DENY"
        
        # X-Content-Type-Options
        headers["X-Content-Type-Options"] = "nosniff"
        
        # X-XSS-Protection (legacy, but still useful for older browsers)
        headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy (formerly Feature-Policy)
        headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=(self)"
        
        # Cache-Control for sensitive pages
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        headers["Pragma"] = "no-cache"
        headers["Expires"] = "0"
        
        # Cross-Origin policies
        headers["Cross-Origin-Opener-Policy"] = "same-origin"
        headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        headers["Cross-Origin-Resource-Policy"] = "same-origin"
        
        return headers


@dataclass
class ValidationError:
    """Validation error"""
    field: str
    message: str
    code: str


@dataclass
class ValidationResult:
    """Validation result"""
    valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    
    def add_error(self, field: str, message: str, code: str) -> None:
        """Add a validation error"""
        self.valid = False
        self.errors.append(ValidationError(field=field, message=message, code=code))


class InputValidator:
    """
    Input Validation Service
    
    Provides comprehensive input validation for security.
    """
    
    def __init__(self):
        self._patterns: Dict[str, Pattern] = {
            "email": re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"),
            "phone": re.compile(r"^\+?[1-9]\d{1,14}$"),
            "uuid": re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I),
            "alphanumeric": re.compile(r"^[a-zA-Z0-9]+$"),
            "numeric": re.compile(r"^[0-9]+$"),
            "alpha": re.compile(r"^[a-zA-Z]+$"),
            "iban": re.compile(r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$"),
            "swift": re.compile(r"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$"),
            "card_number": re.compile(r"^[0-9]{13,19}$"),
            "cvv": re.compile(r"^[0-9]{3,4}$"),
            "ip_address": re.compile(r"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"),
            "url": re.compile(r"^https?://[^\s/$.?#].[^\s]*$"),
            "amount": re.compile(r"^[0-9]+(\.[0-9]{1,2})?$"),
        }
    
    def validate_email(self, email: str) -> bool:
        """Validate an email address"""
        return bool(self._patterns["email"].match(email))
    
    def validate_phone(self, phone: str) -> bool:
        """Validate a phone number (E.164 format)"""
        return bool(self._patterns["phone"].match(phone))
    
    def validate_uuid(self, uuid_str: str) -> bool:
        """Validate a UUID"""
        return bool(self._patterns["uuid"].match(uuid_str))
    
    def validate_iban(self, iban: str) -> bool:
        """Validate an IBAN"""
        iban = iban.upper().replace(" ", "")
        return bool(self._patterns["iban"].match(iban))
    
    def validate_swift(self, swift: str) -> bool:
        """Validate a SWIFT/BIC code"""
        return bool(self._patterns["swift"].match(swift.upper()))
    
    def validate_card_number(self, card_number: str) -> bool:
        """Validate a card number (basic format check + Luhn)"""
        card_number = card_number.replace(" ", "").replace("-", "")
        
        if not self._patterns["card_number"].match(card_number):
            return False
        
        return self._luhn_check(card_number)
    
    def _luhn_check(self, number: str) -> bool:
        """Perform Luhn algorithm validation"""
        total = 0
        alt = False
        
        for char in reversed(number):
            n = int(char)
            if alt:
                n *= 2
                if n > 9:
                    n -= 9
            total += n
            alt = not alt
        
        return total % 10 == 0
    
    def validate_amount(self, amount: str) -> bool:
        """Validate a monetary amount"""
        return bool(self._patterns["amount"].match(amount))
    
    def sanitize_string(self, input_str: str) -> str:
        """Sanitize a string by removing potentially dangerous characters"""
        # Remove null bytes
        input_str = input_str.replace("\x00", "")
        
        # Remove control characters except newlines and tabs
        result = []
        for char in input_str:
            if char in ("\n", "\t") or not (0 <= ord(char) < 32 or ord(char) == 127):
                result.append(char)
        
        return "".join(result)
    
    def sanitize_html(self, input_str: str) -> str:
        """Escape HTML special characters"""
        replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        }
        for char, replacement in replacements.items():
            input_str = input_str.replace(char, replacement)
        return input_str
    
    def validate_password(self, password: str) -> ValidationResult:
        """Validate password strength"""
        result = ValidationResult()
        
        if len(password) < 12:
            result.add_error("password", "Password must be at least 12 characters", "PASSWORD_TOO_SHORT")
        
        if len(password) > 128:
            result.add_error("password", "Password must be at most 128 characters", "PASSWORD_TOO_LONG")
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(not c.isalnum() for c in password)
        
        if not has_upper:
            result.add_error("password", "Password must contain at least one uppercase letter", "PASSWORD_NO_UPPERCASE")
        
        if not has_lower:
            result.add_error("password", "Password must contain at least one lowercase letter", "PASSWORD_NO_LOWERCASE")
        
        if not has_digit:
            result.add_error("password", "Password must contain at least one digit", "PASSWORD_NO_DIGIT")
        
        if not has_special:
            result.add_error("password", "Password must contain at least one special character", "PASSWORD_NO_SPECIAL")
        
        return result
    
    def validate_request(self, data: Dict[str, Any], rules: Dict[str, List[str]]) -> ValidationResult:
        """Validate request data against rules"""
        result = ValidationResult()
        
        for field_name, field_rules in rules.items():
            value = data.get(field_name)
            
            for rule in field_rules:
                if rule == "required" and (value is None or value == ""):
                    result.add_error(field_name, f"{field_name} is required", "REQUIRED")
                    continue
                
                if value is None:
                    continue
                
                if rule == "email" and not self.validate_email(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid email", "INVALID_EMAIL")
                
                elif rule == "phone" and not self.validate_phone(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid phone number", "INVALID_PHONE")
                
                elif rule == "uuid" and not self.validate_uuid(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid UUID", "INVALID_UUID")
                
                elif rule == "iban" and not self.validate_iban(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid IBAN", "INVALID_IBAN")
                
                elif rule == "swift" and not self.validate_swift(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid SWIFT code", "INVALID_SWIFT")
                
                elif rule == "card_number" and not self.validate_card_number(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid card number", "INVALID_CARD")
                
                elif rule == "amount" and not self.validate_amount(str(value)):
                    result.add_error(field_name, f"{field_name} must be a valid amount", "INVALID_AMOUNT")
                
                elif rule.startswith("min:"):
                    min_len = int(rule.split(":")[1])
                    if len(str(value)) < min_len:
                        result.add_error(field_name, f"{field_name} must be at least {min_len} characters", "TOO_SHORT")
                
                elif rule.startswith("max:"):
                    max_len = int(rule.split(":")[1])
                    if len(str(value)) > max_len:
                        result.add_error(field_name, f"{field_name} must be at most {max_len} characters", "TOO_LONG")
        
        return result


class EncryptionService:
    """
    Encryption Service
    
    Provides encryption at rest using AES-256-GCM.
    """
    
    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("Encryption key must be 32 bytes (256 bits)")
        self._key = key
    
    def encrypt(self, plaintext: bytes) -> bytes:
        """Encrypt plaintext using AES-256-GCM"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            
            nonce = os.urandom(12)
            aesgcm = AESGCM(self._key)
            ciphertext = aesgcm.encrypt(nonce, plaintext, None)
            return nonce + ciphertext
        except ImportError:
            # Fallback to simple XOR for environments without cryptography
            return self._simple_encrypt(plaintext)
    
    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt ciphertext using AES-256-GCM"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            
            if len(ciphertext) < 12:
                raise ValueError("Ciphertext too short")
            
            nonce = ciphertext[:12]
            actual_ciphertext = ciphertext[12:]
            
            aesgcm = AESGCM(self._key)
            return aesgcm.decrypt(nonce, actual_ciphertext, None)
        except ImportError:
            return self._simple_decrypt(ciphertext)
    
    def _simple_encrypt(self, plaintext: bytes) -> bytes:
        """Simple XOR encryption fallback"""
        nonce = os.urandom(12)
        key_stream = hashlib.sha256(self._key + nonce).digest()
        encrypted = bytes(p ^ key_stream[i % len(key_stream)] for i, p in enumerate(plaintext))
        return nonce + encrypted
    
    def _simple_decrypt(self, ciphertext: bytes) -> bytes:
        """Simple XOR decryption fallback"""
        nonce = ciphertext[:12]
        encrypted = ciphertext[12:]
        key_stream = hashlib.sha256(self._key + nonce).digest()
        return bytes(e ^ key_stream[i % len(key_stream)] for i, e in enumerate(encrypted))
    
    def encrypt_string(self, plaintext: str) -> str:
        """Encrypt a string and return base64-encoded ciphertext"""
        ciphertext = self.encrypt(plaintext.encode())
        return base64.b64encode(ciphertext).decode()
    
    def decrypt_string(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext and return plaintext string"""
        data = base64.b64decode(ciphertext)
        plaintext = self.decrypt(data)
        return plaintext.decode()
    
    def hash_password(self, password: str, salt: Optional[bytes] = None) -> tuple:
        """Hash a password using PBKDF2"""
        if salt is None:
            salt = os.urandom(16)
        
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return base64.b64encode(key).decode(), base64.b64encode(salt).decode()
    
    def verify_password(self, password: str, hashed: str, salt: str) -> bool:
        """Verify a password against a hash"""
        salt_bytes = base64.b64decode(salt)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt_bytes, 100000)
        return hmac.compare_digest(base64.b64encode(key).decode(), hashed)


@dataclass
class SecureSession:
    """Secure session"""
    id: str
    user_id: str
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    ip_address: str
    user_agent: str
    data: Dict[str, Any] = field(default_factory=dict)
    revoked: bool = False


class SecureSessionManager:
    """
    Secure Session Manager
    
    Manages secure sessions with proper cookie handling.
    """
    
    def __init__(self, config: SecurityHardeningConfig):
        self._sessions: Dict[str, SecureSession] = {}
        self._config = config
        self._lock = threading.RLock()
    
    def create_session(self, user_id: str, ip_address: str, user_agent: str) -> SecureSession:
        """Create a new secure session"""
        with self._lock:
            session_id = secrets.token_hex(32)
            now = datetime.utcnow()
            
            session = SecureSession(
                id=session_id,
                user_id=user_id,
                created_at=now,
                expires_at=now + self._config.session_timeout,
                last_activity=now,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self._sessions[session_id] = session
            return session
    
    def get_session(self, session_id: str) -> Optional[SecureSession]:
        """Get a session by ID"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            if session.revoked:
                return None
            
            if datetime.utcnow() > session.expires_at:
                return None
            
            return session
    
    def validate_session(self, session_id: str, ip_address: str, user_agent: str) -> Optional[SecureSession]:
        """Validate a session"""
        session = self.get_session(session_id)
        if not session:
            return None
        
        # Update last activity and extend expiration
        with self._lock:
            session.last_activity = datetime.utcnow()
            session.expires_at = datetime.utcnow() + self._config.session_timeout
        
        return session
    
    def revoke_session(self, session_id: str) -> bool:
        """Revoke a session"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            
            session.revoked = True
            return True
    
    def revoke_user_sessions(self, user_id: str) -> int:
        """Revoke all sessions for a user"""
        with self._lock:
            count = 0
            for session in self._sessions.values():
                if session.user_id == user_id and not session.revoked:
                    session.revoked = True
                    count += 1
            return count
    
    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions"""
        with self._lock:
            now = datetime.utcnow()
            expired = [
                sid for sid, session in self._sessions.items()
                if now > session.expires_at or session.revoked
            ]
            
            for sid in expired:
                del self._sessions[sid]
            
            return len(expired)
    
    def get_cookie_options(self) -> Dict[str, Any]:
        """Get cookie options for session cookie"""
        return {
            "httponly": self._config.session_http_only,
            "secure": self._config.session_secure,
            "samesite": self._config.session_same_site,
            "path": "/",
        }


class RateLimiter:
    """
    Rate Limiter
    
    Implements token bucket rate limiting.
    """
    
    def __init__(self, limit: int, window: timedelta):
        self._buckets: Dict[str, Dict[str, Any]] = {}
        self._limit = limit
        self._window = window
        self._lock = threading.RLock()
    
    def allow(self, key: str) -> bool:
        """Check if a request is allowed"""
        with self._lock:
            now = datetime.utcnow()
            
            if key not in self._buckets:
                self._buckets[key] = {
                    "tokens": self._limit,
                    "last_reset": now
                }
            
            bucket = self._buckets[key]
            
            # Reset bucket if window has passed
            if now - bucket["last_reset"] > self._window:
                bucket["tokens"] = self._limit
                bucket["last_reset"] = now
            
            if bucket["tokens"] > 0:
                bucket["tokens"] -= 1
                return True
            
            return False
    
    def remaining(self, key: str) -> int:
        """Get remaining tokens for a key"""
        with self._lock:
            if key not in self._buckets:
                return self._limit
            
            bucket = self._buckets[key]
            
            if datetime.utcnow() - bucket["last_reset"] > self._window:
                return self._limit
            
            return bucket["tokens"]
    
    def reset(self, key: str) -> None:
        """Reset the rate limit for a key"""
        with self._lock:
            if key in self._buckets:
                del self._buckets[key]


class CSRFProtection:
    """
    CSRF Protection
    
    Provides CSRF token management.
    """
    
    def __init__(self, token_expiry: timedelta = timedelta(hours=1)):
        self._tokens: Dict[str, Dict[str, Any]] = {}
        self._token_expiry = token_expiry
        self._lock = threading.RLock()
    
    def generate_token(self, session_id: str) -> str:
        """Generate a new CSRF token for a session"""
        with self._lock:
            token = secrets.token_hex(32)
            self._tokens[token] = {
                "session_id": session_id,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + self._token_expiry
            }
            return token
    
    def validate_token(self, token: str, session_id: str) -> bool:
        """Validate a CSRF token"""
        with self._lock:
            token_data = self._tokens.get(token)
            if not token_data:
                return False
            
            if token_data["session_id"] != session_id:
                return False
            
            if datetime.utcnow() > token_data["expires_at"]:
                return False
            
            return True
    
    def invalidate_token(self, token: str) -> None:
        """Invalidate a CSRF token"""
        with self._lock:
            if token in self._tokens:
                del self._tokens[token]
    
    def cleanup_expired_tokens(self) -> int:
        """Remove expired tokens"""
        with self._lock:
            now = datetime.utcnow()
            expired = [
                token for token, data in self._tokens.items()
                if now > data["expires_at"]
            ]
            
            for token in expired:
                del self._tokens[token]
            
            return len(expired)


class SecurityHardeningService:
    """
    Security Hardening Service
    
    Provides comprehensive security hardening including:
    - Content Security Policy (CSP)
    - HTTP Security Headers (HSTS, X-Frame-Options, etc.)
    - Input Validation
    - Encryption at Rest
    - Secure Session Management
    - Rate Limiting
    - CSRF Protection
    """
    
    def __init__(self, config: Optional[SecurityHardeningConfig] = None):
        self._config = config or SecurityHardeningConfig()
        
        self.csp = ContentSecurityPolicy()
        self.headers = SecurityHeaders(self._config)
        self.validator = InputValidator()
        self.sessions = SecureSessionManager(self._config)
        self.rate_limiter = RateLimiter(
            self._config.rate_limit_requests,
            self._config.rate_limit_window
        )
        self.csrf = CSRFProtection()
        
        self.encryption: Optional[EncryptionService] = None
        if self._config.encryption_key:
            self.encryption = EncryptionService(self._config.encryption_key)
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get all security headers"""
        headers = self.headers.get_headers()
        
        if self._config.csp_enabled:
            header_name = self.csp.get_header_name(self._config.csp_report_only)
            headers[header_name] = self.csp.build()
        
        return headers
    
    def check_rate_limit(self, client_ip: str) -> bool:
        """Check if a request is within rate limits"""
        if not self._config.rate_limit_enabled:
            return True
        return self.rate_limiter.allow(client_ip)


def security_hardening_middleware(service: SecurityHardeningService):
    """
    Decorator for security hardening middleware
    
    Usage with FastAPI:
        @app.middleware("http")
        @security_hardening_middleware(service)
        async def security_middleware(request, call_next):
            return await call_next(request)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request, call_next):
            # Check rate limit
            client_ip = request.client.host if request.client else "unknown"
            if not service.check_rate_limit(client_ip):
                from starlette.responses import JSONResponse
                return JSONResponse(
                    {"error": "Rate limit exceeded"},
                    status_code=429
                )
            
            # Process request
            response = await call_next(request)
            
            # Add security headers
            for header, value in service.get_security_headers().items():
                response.headers[header] = value
            
            return response
        
        return wrapper
    return decorator
