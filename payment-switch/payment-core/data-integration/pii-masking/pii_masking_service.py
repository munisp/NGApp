#!/usr/bin/env python3
"""
PII Masking Service for Payment Switch
Tokenization, masking, and access control for sensitive data
"""

import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from enum import Enum
import secrets

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/3')
ENCRYPTION_KEY = os.getenv('PII_ENCRYPTION_KEY', 'default-key-change-in-production')


class PIIType(Enum):
    FULL_NAME = "full_name"
    DATE_OF_BIRTH = "date_of_birth"
    NATIONAL_ID = "national_id"
    BVN = "bvn"
    NIN = "nin"
    PASSPORT_NUMBER = "passport_number"
    PHONE_NUMBER = "phone_number"
    EMAIL = "email"
    ADDRESS = "address"
    BANK_ACCOUNT = "bank_account"
    CARD_NUMBER = "card_number"


class MaskingStrategy(Enum):
    FULL = "full"           # Replace entirely with ***
    PARTIAL = "partial"     # Show first/last few characters
    HASH = "hash"           # One-way hash
    TOKENIZE = "tokenize"   # Reversible tokenization
    REDACT = "redact"       # Remove entirely


@dataclass
class PIIField:
    field_path: str
    pii_type: PIIType
    masking_strategy: MaskingStrategy
    access_roles: Set[str]


# PII field definitions for payment switch data
PII_FIELDS = [
    PIIField("pii_fields.full_name", PIIType.FULL_NAME, MaskingStrategy.PARTIAL, {"admin", "compliance", "kyc"}),
    PIIField("pii_fields.date_of_birth", PIIType.DATE_OF_BIRTH, MaskingStrategy.FULL, {"admin", "compliance", "kyc"}),
    PIIField("pii_fields.national_id", PIIType.NATIONAL_ID, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
    PIIField("pii_fields.bvn", PIIType.BVN, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
    PIIField("pii_fields.nin", PIIType.NIN, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
    PIIField("pii_fields.passport_number", PIIType.PASSPORT_NUMBER, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
    PIIField("pii_fields.phone_number", PIIType.PHONE_NUMBER, MaskingStrategy.PARTIAL, {"admin", "compliance", "support"}),
    PIIField("pii_fields.email", PIIType.EMAIL, MaskingStrategy.PARTIAL, {"admin", "compliance", "support"}),
    PIIField("pii_fields.address", PIIType.ADDRESS, MaskingStrategy.FULL, {"admin", "compliance"}),
    PIIField("payer_name", PIIType.FULL_NAME, MaskingStrategy.PARTIAL, {"admin", "compliance", "noc"}),
    PIIField("payee_name", PIIType.FULL_NAME, MaskingStrategy.PARTIAL, {"admin", "compliance", "noc"}),
    PIIField("bank_account", PIIType.BANK_ACCOUNT, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
    PIIField("card_number", PIIType.CARD_NUMBER, MaskingStrategy.PARTIAL, {"admin", "compliance"}),
]


class PIIMaskingService:
    """Service for masking and tokenizing PII data"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "pii_tokens:"
        self.pii_fields = {f.field_path: f for f in PII_FIELDS}
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("PII masking service connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def mask_data(self, data: Dict[str, Any], user_roles: Set[str]) -> Dict[str, Any]:
        """Mask PII fields in data based on user roles"""
        masked = data.copy()
        
        for field_path, pii_field in self.pii_fields.items():
            value = self._get_nested_value(masked, field_path)
            if value is None:
                continue
            
            # Check if user has access to this field
            if pii_field.access_roles.intersection(user_roles):
                # User has access, don't mask
                continue
            
            # Apply masking strategy
            masked_value = self._apply_masking(value, pii_field.masking_strategy, pii_field.pii_type)
            self._set_nested_value(masked, field_path, masked_value)
        
        return masked
    
    def _apply_masking(self, value: str, strategy: MaskingStrategy, pii_type: PIIType) -> str:
        """Apply masking strategy to a value"""
        if not value:
            return value
        
        if strategy == MaskingStrategy.FULL:
            return "***MASKED***"
        
        if strategy == MaskingStrategy.PARTIAL:
            return self._partial_mask(value, pii_type)
        
        if strategy == MaskingStrategy.HASH:
            return self._hash_value(value)
        
        if strategy == MaskingStrategy.TOKENIZE:
            return self._tokenize(value)
        
        if strategy == MaskingStrategy.REDACT:
            return "[REDACTED]"
        
        return value
    
    def _partial_mask(self, value: str, pii_type: PIIType) -> str:
        """Apply partial masking based on PII type"""
        if not value or len(value) < 4:
            return "***"
        
        if pii_type == PIIType.EMAIL:
            # Show first 2 chars and domain
            parts = value.split('@')
            if len(parts) == 2:
                local = parts[0]
                domain = parts[1]
                masked_local = local[:2] + '*' * (len(local) - 2) if len(local) > 2 else local
                return f"{masked_local}@{domain}"
            return value[:2] + '*' * (len(value) - 2)
        
        if pii_type == PIIType.PHONE_NUMBER:
            # Show last 4 digits
            digits = re.sub(r'\D', '', value)
            return '*' * (len(digits) - 4) + digits[-4:] if len(digits) > 4 else '***'
        
        if pii_type in [PIIType.NATIONAL_ID, PIIType.BVN, PIIType.NIN, PIIType.PASSPORT_NUMBER]:
            # Show first 2 and last 2 characters
            return value[:2] + '*' * (len(value) - 4) + value[-2:]
        
        if pii_type == PIIType.BANK_ACCOUNT:
            # Show last 4 digits
            return '*' * (len(value) - 4) + value[-4:] if len(value) > 4 else '***'
        
        if pii_type == PIIType.CARD_NUMBER:
            # Show first 6 and last 4 (BIN + last 4)
            digits = re.sub(r'\D', '', value)
            if len(digits) >= 16:
                return digits[:6] + '*' * 6 + digits[-4:]
            return '*' * (len(digits) - 4) + digits[-4:] if len(digits) > 4 else '***'
        
        if pii_type == PIIType.FULL_NAME:
            # Show first name initial and last name
            parts = value.split()
            if len(parts) >= 2:
                return parts[0][0] + '. ' + parts[-1]
            return value[0] + '. ***'
        
        # Default: show first and last 2 characters
        return value[:2] + '*' * (len(value) - 4) + value[-2:]
    
    def _hash_value(self, value: str) -> str:
        """Create one-way hash of value"""
        salted = f"{ENCRYPTION_KEY}:{value}"
        return hashlib.sha256(salted.encode()).hexdigest()[:16]
    
    def _tokenize(self, value: str) -> str:
        """Create reversible token for value"""
        # Check if already tokenized
        existing_token = self.redis_client.get(f"{self.prefix}value:{self._hash_value(value)}")
        if existing_token:
            return existing_token
        
        # Create new token
        token = f"TOK-{secrets.token_hex(8)}"
        
        # Store bidirectional mapping
        value_hash = self._hash_value(value)
        self.redis_client.set(f"{self.prefix}token:{token}", value)
        self.redis_client.set(f"{self.prefix}value:{value_hash}", token)
        
        return token
    
    def detokenize(self, token: str, user_roles: Set[str]) -> Optional[str]:
        """Retrieve original value from token (requires appropriate role)"""
        if not token.startswith("TOK-"):
            return token
        
        # Check if user has detokenization permission
        if "admin" not in user_roles and "compliance" not in user_roles:
            logger.warning(f"Unauthorized detokenization attempt for token {token}")
            return None
        
        value = self.redis_client.get(f"{self.prefix}token:{token}")
        
        # Log access for audit
        self._log_pii_access(token, user_roles)
        
        return value
    
    def _log_pii_access(self, token: str, user_roles: Set[str]):
        """Log PII access for audit trail"""
        log_entry = {
            'token': token,
            'roles': list(user_roles),
            'timestamp': datetime.utcnow().isoformat(),
            'action': 'detokenize'
        }
        self.redis_client.lpush(f"{self.prefix}audit_log", json.dumps(log_entry))
        self.redis_client.ltrim(f"{self.prefix}audit_log", 0, 99999)  # Keep last 100k entries
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Optional[Any]:
        """Get value from nested dict using dot notation"""
        keys = path.split('.')
        current = data
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None
        return current
    
    def _set_nested_value(self, data: Dict[str, Any], path: str, value: Any):
        """Set value in nested dict using dot notation"""
        keys = path.split('.')
        current = data
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value
    
    def get_pii_audit_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get PII access audit log"""
        entries = self.redis_client.lrange(f"{self.prefix}audit_log", 0, limit - 1)
        return [json.loads(e) for e in entries]
    
    def classify_data(self, data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Classify PII fields in data"""
        classifications = {}
        
        for field_path, pii_field in self.pii_fields.items():
            value = self._get_nested_value(data, field_path)
            if value is not None:
                if pii_field.pii_type.value not in classifications:
                    classifications[pii_field.pii_type.value] = []
                classifications[pii_field.pii_type.value].append(field_path)
        
        return classifications


# FastAPI middleware for PII masking
class PIIMaskingMiddleware:
    """Middleware to automatically mask PII in API responses"""
    
    def __init__(self, service: PIIMaskingService):
        self.service = service
    
    async def __call__(self, request, call_next):
        response = await call_next(request)
        
        # Get user roles from request (from JWT token)
        user_roles = self._get_user_roles(request)
        
        # If response is JSON, mask PII
        if hasattr(response, 'body'):
            try:
                body = json.loads(response.body)
                masked_body = self._mask_response(body, user_roles)
                response.body = json.dumps(masked_body).encode()
            except (json.JSONDecodeError, AttributeError):
                pass
        
        return response
    
    def _get_user_roles(self, request) -> Set[str]:
        """Extract user roles from request"""
        # In production, extract from JWT token
        # For now, return default roles
        return {"viewer"}
    
    def _mask_response(self, data: Any, user_roles: Set[str]) -> Any:
        """Recursively mask PII in response data"""
        if isinstance(data, dict):
            return self.service.mask_data(data, user_roles)
        if isinstance(data, list):
            return [self._mask_response(item, user_roles) for item in data]
        return data


# Singleton instance
_service: Optional[PIIMaskingService] = None

def get_pii_masking_service() -> PIIMaskingService:
    global _service
    if _service is None:
        _service = PIIMaskingService()
        _service.initialize()
    return _service
