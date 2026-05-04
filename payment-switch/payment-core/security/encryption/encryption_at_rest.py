"""
Encryption at Rest Service for PayGate Payment Switch

Provides comprehensive encryption at rest capabilities using envelope encryption
with Vault/KMS-managed master keys and locally-generated data encryption keys.
"""

import base64
import hashlib
import json
import os
import secrets
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple

# Try to import cryptography library, fall back to basic implementation
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.backends import default_backend
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False


class EncryptionAlgorithm(str, Enum):
    """Supported encryption algorithms"""
    AES_256_GCM = "AES-256-GCM"
    AES_256_CBC = "AES-256-CBC"


class KeyDerivationFunction(str, Enum):
    """Supported key derivation functions"""
    PBKDF2 = "PBKDF2"
    HKDF = "HKDF"


@dataclass
class EncryptionConfig:
    """Configuration for encryption at rest"""
    master_key_id: str = "paygate-master-key"
    master_key_provider: str = "vault"  # vault, aws-kms, gcp-kms, azure-keyvault
    data_key_rotation_days: int = 90
    data_key_cache_ttl: timedelta = field(default_factory=lambda: timedelta(hours=1))
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
    key_derivation_func: KeyDerivationFunction = KeyDerivationFunction.PBKDF2
    pbkdf2_iterations: int = 100000
    audit_key_usage: bool = True
    audit_decryption: bool = True


@dataclass
class DataKey:
    """Data encryption key"""
    id: str
    plaintext: bytes
    ciphertext: bytes  # Encrypted with master key
    algorithm: str
    created_at: datetime
    expires_at: datetime
    key_version: int


@dataclass
class EncryptedData:
    """Encrypted data with metadata"""
    ciphertext: bytes
    nonce: bytes
    data_key_id: str
    encrypted_data_key: bytes
    algorithm: str
    version: int
    encrypted_at: datetime


@dataclass
class KeyUsageEvent:
    """Key usage audit event"""
    timestamp: datetime
    key_id: str
    operation: str  # encrypt, decrypt, rotate
    data_store: str  # postgres, tigerbeetle, kafka, redis, rustfs
    resource_id: str
    user_id: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class CachedDataKey:
    """Cached data key with expiration"""
    key: DataKey
    cached_at: datetime
    expires_at: datetime


class AuditLogger(Protocol):
    """Protocol for audit logging"""
    def log_key_usage(self, event: KeyUsageEvent) -> None:
        ...


class KeyManager(ABC):
    """Abstract base class for key management providers"""
    
    @abstractmethod
    def get_master_key(self, key_id: str) -> bytes:
        """Retrieve the master key"""
        pass
    
    @abstractmethod
    def generate_data_key(self, key_id: str) -> DataKey:
        """Generate a new data encryption key"""
        pass
    
    @abstractmethod
    def encrypt_data_key(self, master_key_id: str, data_key: bytes) -> bytes:
        """Encrypt a data key with the master key"""
        pass
    
    @abstractmethod
    def decrypt_data_key(self, master_key_id: str, encrypted_key: bytes) -> bytes:
        """Decrypt a data key with the master key"""
        pass
    
    @abstractmethod
    def rotate_key(self, key_id: str) -> None:
        """Rotate a key"""
        pass


class VaultKeyManager(KeyManager):
    """Key manager implementation using HashiCorp Vault"""
    
    def __init__(self, vault_addr: str, vault_token: str, transit_path: str = "transit"):
        self.vault_addr = vault_addr
        self.vault_token = vault_token
        self.transit_path = transit_path
        self._lock = threading.Lock()
    
    def get_master_key(self, key_id: str) -> bytes:
        """In Vault Transit, we don't retrieve the master key directly"""
        raise NotImplementedError("Master key retrieval not supported with Vault Transit")
    
    def generate_data_key(self, key_id: str) -> DataKey:
        """Generate a new data encryption key"""
        # Generate a random 256-bit key
        plaintext = secrets.token_bytes(32)
        
        # Encrypt the data key with Vault Transit
        ciphertext = self.encrypt_data_key(key_id, plaintext)
        
        return DataKey(
            id=secrets.token_hex(16),
            plaintext=plaintext,
            ciphertext=ciphertext,
            algorithm=EncryptionAlgorithm.AES_256_GCM.value,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=90),
            key_version=1,
        )
    
    def encrypt_data_key(self, master_key_id: str, data_key: bytes) -> bytes:
        """Encrypt a data key using Vault Transit"""
        # In production, this would call Vault Transit API
        # POST /v1/transit/encrypt/{master_key_id}
        
        # For now, use local encryption as placeholder
        derived_key = self._derive_key(master_key_id)
        return self._encrypt_aes_gcm(derived_key, data_key)
    
    def decrypt_data_key(self, master_key_id: str, encrypted_key: bytes) -> bytes:
        """Decrypt a data key using Vault Transit"""
        # In production, this would call Vault Transit API
        # POST /v1/transit/decrypt/{master_key_id}
        
        derived_key = self._derive_key(master_key_id)
        return self._decrypt_aes_gcm(derived_key, encrypted_key)
    
    def rotate_key(self, key_id: str) -> None:
        """Rotate a key in Vault"""
        # In production, this would call Vault Transit API
        # POST /v1/transit/keys/{key_id}/rotate
        pass
    
    def _derive_key(self, key_id: str) -> bytes:
        """Derive encryption key from key ID"""
        if HAS_CRYPTOGRAPHY:
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"paygate-salt",
                iterations=100000,
                backend=default_backend(),
            )
            return kdf.derive(key_id.encode())
        else:
            # Fallback using hashlib
            return hashlib.pbkdf2_hmac(
                "sha256",
                key_id.encode(),
                b"paygate-salt",
                100000,
                dklen=32,
            )
    
    def _encrypt_aes_gcm(self, key: bytes, plaintext: bytes) -> bytes:
        """Encrypt using AES-GCM"""
        if HAS_CRYPTOGRAPHY:
            aesgcm = AESGCM(key)
            nonce = secrets.token_bytes(12)
            ciphertext = aesgcm.encrypt(nonce, plaintext, None)
            return nonce + ciphertext
        else:
            raise RuntimeError("cryptography library required for AES-GCM encryption")
    
    def _decrypt_aes_gcm(self, key: bytes, ciphertext: bytes) -> bytes:
        """Decrypt using AES-GCM"""
        if HAS_CRYPTOGRAPHY:
            aesgcm = AESGCM(key)
            nonce = ciphertext[:12]
            ct = ciphertext[12:]
            return aesgcm.decrypt(nonce, ct, None)
        else:
            raise RuntimeError("cryptography library required for AES-GCM decryption")


class EncryptionAtRestService:
    """
    Comprehensive encryption at rest service for PayGate platform.
    
    Uses envelope encryption with Vault/KMS-managed master keys and
    locally-generated data encryption keys.
    """
    
    def __init__(
        self,
        key_manager: KeyManager,
        config: Optional[EncryptionConfig] = None,
        audit_logger: Optional[AuditLogger] = None,
    ):
        self.key_manager = key_manager
        self.config = config or EncryptionConfig()
        self.audit_logger = audit_logger
        self._data_key_cache: Dict[str, CachedDataKey] = {}
        self._lock = threading.RLock()
    
    def encrypt(
        self,
        plaintext: bytes,
        data_store: str,
        resource_id: str,
        user_id: Optional[str] = None,
    ) -> EncryptedData:
        """Encrypt data using envelope encryption"""
        try:
            # Get or generate data key
            data_key = self._get_or_generate_data_key()
            
            if not HAS_CRYPTOGRAPHY:
                raise RuntimeError("cryptography library required for encryption")
            
            # Create AES-GCM cipher
            aesgcm = AESGCM(data_key.plaintext)
            
            # Generate nonce
            nonce = secrets.token_bytes(12)
            
            # Encrypt data
            ciphertext = aesgcm.encrypt(nonce, plaintext, None)
            
            self._log_key_usage(
                operation="encrypt",
                data_store=data_store,
                resource_id=resource_id,
                user_id=user_id,
                success=True,
            )
            
            return EncryptedData(
                ciphertext=ciphertext,
                nonce=nonce,
                data_key_id=data_key.id,
                encrypted_data_key=data_key.ciphertext,
                algorithm=self.config.algorithm.value,
                version=data_key.key_version,
                encrypted_at=datetime.utcnow(),
            )
        except Exception as e:
            self._log_key_usage(
                operation="encrypt",
                data_store=data_store,
                resource_id=resource_id,
                user_id=user_id,
                success=False,
                error_message=str(e),
            )
            raise
    
    def decrypt(
        self,
        encrypted: EncryptedData,
        data_store: str,
        resource_id: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt data using envelope encryption"""
        try:
            # Decrypt the data key
            data_key_plaintext = self.key_manager.decrypt_data_key(
                self.config.master_key_id,
                encrypted.encrypted_data_key,
            )
            
            if not HAS_CRYPTOGRAPHY:
                raise RuntimeError("cryptography library required for decryption")
            
            # Create AES-GCM cipher
            aesgcm = AESGCM(data_key_plaintext)
            
            # Decrypt data
            plaintext = aesgcm.decrypt(encrypted.nonce, encrypted.ciphertext, None)
            
            self._log_key_usage(
                operation="decrypt",
                data_store=data_store,
                resource_id=resource_id,
                user_id=user_id,
                success=True,
            )
            
            return plaintext
        except Exception as e:
            self._log_key_usage(
                operation="decrypt",
                data_store=data_store,
                resource_id=resource_id,
                user_id=user_id,
                success=False,
                error_message=str(e),
            )
            raise
    
    def encrypt_string(
        self,
        plaintext: str,
        data_store: str,
        resource_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Encrypt a string and return base64-encoded result"""
        encrypted = self.encrypt(
            plaintext.encode("utf-8"),
            data_store,
            resource_id,
            user_id,
        )
        return self._serialize_encrypted_data(encrypted)
    
    def decrypt_string(
        self,
        ciphertext: str,
        data_store: str,
        resource_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Decrypt a base64-encoded string"""
        encrypted = self._deserialize_encrypted_data(ciphertext)
        plaintext = self.decrypt(encrypted, data_store, resource_id, user_id)
        return plaintext.decode("utf-8")
    
    def rotate_data_key(self, user_id: Optional[str] = None) -> None:
        """Rotate the data encryption key"""
        with self._lock:
            # Clear cache to force new key generation
            self._data_key_cache.pop(self.config.master_key_id, None)
            
            # Generate new data key
            self.key_manager.generate_data_key(self.config.master_key_id)
            
            self._log_key_usage(
                operation="rotate",
                data_store="all",
                resource_id="",
                user_id=user_id,
                success=True,
            )
    
    def _get_or_generate_data_key(self) -> DataKey:
        """Get a cached data key or generate a new one"""
        with self._lock:
            cached = self._data_key_cache.get(self.config.master_key_id)
            
            if cached and datetime.utcnow() < cached.expires_at:
                return cached.key
            
            # Generate new data key
            data_key = self.key_manager.generate_data_key(self.config.master_key_id)
            
            # Cache the data key
            self._data_key_cache[self.config.master_key_id] = CachedDataKey(
                key=data_key,
                cached_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + self.config.data_key_cache_ttl,
            )
            
            return data_key
    
    def _serialize_encrypted_data(self, data: EncryptedData) -> str:
        """Serialize encrypted data to a string"""
        return f"{data.version}:{data.algorithm}:{data.data_key_id}:" \
               f"{base64.b64encode(data.nonce).decode()}:" \
               f"{base64.b64encode(data.encrypted_data_key).decode()}:" \
               f"{base64.b64encode(data.ciphertext).decode()}"
    
    def _deserialize_encrypted_data(self, data: str) -> EncryptedData:
        """Deserialize encrypted data from a string"""
        parts = data.split(":")
        if len(parts) != 6:
            raise ValueError("Invalid encrypted data format")
        
        version, algorithm, key_id, nonce_b64, enc_key_b64, ciphertext_b64 = parts
        
        return EncryptedData(
            version=int(version),
            algorithm=algorithm,
            data_key_id=key_id,
            nonce=base64.b64decode(nonce_b64),
            encrypted_data_key=base64.b64decode(enc_key_b64),
            ciphertext=base64.b64decode(ciphertext_b64),
            encrypted_at=datetime.utcnow(),
        )
    
    def _log_key_usage(
        self,
        operation: str,
        data_store: str,
        resource_id: str,
        user_id: Optional[str],
        success: bool,
        error_message: Optional[str] = None,
    ) -> None:
        """Log key usage for audit"""
        if not self.audit_logger:
            return
        
        if not self.config.audit_key_usage:
            return
        
        if operation == "decrypt" and not self.config.audit_decryption:
            return
        
        event = KeyUsageEvent(
            timestamp=datetime.utcnow(),
            key_id=self.config.master_key_id,
            operation=operation,
            data_store=data_store,
            resource_id=resource_id,
            user_id=user_id,
            success=success,
            error_message=error_message,
        )
        
        self.audit_logger.log_key_usage(event)


class FieldEncryptor:
    """Field-level encryption for database columns"""
    
    def __init__(self, service: EncryptionAtRestService):
        self.service = service
    
    def encrypt_pii(
        self,
        value: str,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Encrypt PII fields"""
        resource_id = f"{table_name}.{column_name}.{record_id}"
        return self.service.encrypt_string(value, "postgres", resource_id, user_id)
    
    def decrypt_pii(
        self,
        encrypted_value: str,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Decrypt PII fields"""
        resource_id = f"{table_name}.{column_name}.{record_id}"
        return self.service.decrypt_string(encrypted_value, "postgres", resource_id, user_id)
    
    def encrypt_sensitive(
        self,
        value: str,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Encrypt sensitive fields (tokens, secrets)"""
        resource_id = f"{table_name}.{column_name}.{record_id}"
        return self.service.encrypt_string(value, "postgres", resource_id, user_id)
    
    def decrypt_sensitive(
        self,
        encrypted_value: str,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Decrypt sensitive fields"""
        resource_id = f"{table_name}.{column_name}.{record_id}"
        return self.service.decrypt_string(encrypted_value, "postgres", resource_id, user_id)
