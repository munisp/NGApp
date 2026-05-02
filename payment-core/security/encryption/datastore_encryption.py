"""
Data Store Encryption for PayGate Payment Switch

Provides encryption capabilities for specific data stores including PostgreSQL,
TigerBeetle, Kafka, Redis, RustFS, Kubernetes secrets, and backups.
"""

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from .encryption_at_rest import EncryptedData, EncryptionAtRestService, FieldEncryptor


class DataType(str, Enum):
    """Data classification types"""
    PII = "pii"
    SENSITIVE = "sensitive"
    FINANCIAL = "financial"
    INTERNAL = "internal"


@dataclass
class EncryptedColumnConfig:
    """Configuration for encrypted database columns"""
    table_name: str
    column_name: str
    data_type: DataType
    searchable: bool = False  # If true, use deterministic encryption


def get_default_encrypted_columns() -> List[EncryptedColumnConfig]:
    """Returns the default columns to encrypt"""
    return [
        # Customer PII
        EncryptedColumnConfig("customers", "email", DataType.PII, searchable=True),
        EncryptedColumnConfig("customers", "phone", DataType.PII, searchable=True),
        EncryptedColumnConfig("customers", "national_id", DataType.PII, searchable=True),
        EncryptedColumnConfig("customers", "date_of_birth", DataType.PII, searchable=False),
        EncryptedColumnConfig("customers", "address", DataType.PII, searchable=False),
        
        # KYC Documents
        EncryptedColumnConfig("kyc_documents", "document_number", DataType.PII, searchable=True),
        EncryptedColumnConfig("kyc_documents", "document_data", DataType.PII, searchable=False),
        
        # Bank Accounts
        EncryptedColumnConfig("bank_accounts", "account_number", DataType.FINANCIAL, searchable=True),
        EncryptedColumnConfig("bank_accounts", "routing_number", DataType.FINANCIAL, searchable=True),
        EncryptedColumnConfig("bank_accounts", "iban", DataType.FINANCIAL, searchable=True),
        
        # Cards
        EncryptedColumnConfig("cards", "card_number", DataType.FINANCIAL, searchable=False),
        EncryptedColumnConfig("cards", "cvv", DataType.SENSITIVE, searchable=False),
        EncryptedColumnConfig("cards", "expiry", DataType.FINANCIAL, searchable=False),
        
        # API Tokens
        EncryptedColumnConfig("api_tokens", "token_hash", DataType.SENSITIVE, searchable=True),
        EncryptedColumnConfig("api_tokens", "secret", DataType.SENSITIVE, searchable=False),
        
        # Webhook Secrets
        EncryptedColumnConfig("webhooks", "secret", DataType.SENSITIVE, searchable=False),
    ]


class DataStoreEncryption:
    """Base class for data store encryption"""
    
    def __init__(self, service: EncryptionAtRestService):
        self.service = service


class PostgresEncryption(DataStoreEncryption):
    """PostgreSQL-specific encryption"""
    
    def __init__(self, service: EncryptionAtRestService):
        super().__init__(service)
        self.field_encryptor = FieldEncryptor(service)
    
    def encrypt_column(
        self,
        value: Any,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Encrypt a column value"""
        # Serialize value to JSON
        json_str = json.dumps(value)
        return self.field_encryptor.encrypt_pii(
            json_str, table_name, column_name, record_id, user_id
        )
    
    def decrypt_column(
        self,
        encrypted_value: str,
        table_name: str,
        column_name: str,
        record_id: str,
        user_id: Optional[str] = None,
    ) -> Any:
        """Decrypt a column value"""
        decrypted = self.field_encryptor.decrypt_pii(
            encrypted_value, table_name, column_name, record_id, user_id
        )
        return json.loads(decrypted)
    
    def get_encrypted_columns(self) -> List[EncryptedColumnConfig]:
        """Get list of columns that should be encrypted"""
        return get_default_encrypted_columns()


class TigerBeetleEncryption(DataStoreEncryption):
    """TigerBeetle-specific encryption"""
    
    def encrypt_user_data(
        self,
        user_data: bytes,
        transfer_id: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Encrypt user_data_128 field for TigerBeetle transfers"""
        encrypted = self.service.encrypt(user_data, "tigerbeetle", transfer_id, user_id)
        # TigerBeetle user_data is 128 bits, store encrypted data separately
        return encrypted.ciphertext
    
    def decrypt_user_data(
        self,
        encrypted_data: bytes,
        transfer_id: str,
        encrypted_metadata: EncryptedData,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt user_data_128 field for TigerBeetle transfers"""
        # Reconstruct encrypted data structure
        encrypted_metadata.ciphertext = encrypted_data
        return self.service.decrypt(encrypted_metadata, "tigerbeetle", transfer_id, user_id)


class KafkaEncryption(DataStoreEncryption):
    """Kafka-specific encryption"""
    
    def encrypt_message(
        self,
        message: bytes,
        topic: str,
        partition: int,
        offset: int,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Encrypt a Kafka message"""
        resource_id = f"{topic}:{partition}:{offset}"
        encrypted = self.service.encrypt(message, "kafka", resource_id, user_id)
        
        # Serialize encrypted data for Kafka
        return json.dumps({
            "ciphertext": base64.b64encode(encrypted.ciphertext).decode(),
            "nonce": base64.b64encode(encrypted.nonce).decode(),
            "data_key_id": encrypted.data_key_id,
            "encrypted_data_key": base64.b64encode(encrypted.encrypted_data_key).decode(),
            "algorithm": encrypted.algorithm,
            "version": encrypted.version,
        }).encode()
    
    def decrypt_message(
        self,
        encrypted_message: bytes,
        topic: str,
        partition: int,
        offset: int,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt a Kafka message"""
        data = json.loads(encrypted_message.decode())
        
        encrypted = EncryptedData(
            ciphertext=base64.b64decode(data["ciphertext"]),
            nonce=base64.b64decode(data["nonce"]),
            data_key_id=data["data_key_id"],
            encrypted_data_key=base64.b64decode(data["encrypted_data_key"]),
            algorithm=data["algorithm"],
            version=data["version"],
            encrypted_at=datetime.utcnow(),
        )
        
        resource_id = f"{topic}:{partition}:{offset}"
        return self.service.decrypt(encrypted, "kafka", resource_id, user_id)
    
    @staticmethod
    def get_encrypted_topics() -> List[str]:
        """Returns topics that should be encrypted"""
        return [
            "payments.transactions",
            "payments.settlements",
            "kyc.verifications",
            "kyc.documents",
            "audit.events",
            "fraud.alerts",
            "pii.updates",
        ]


class RedisEncryption(DataStoreEncryption):
    """Redis-specific encryption"""
    
    def encrypt_value(
        self,
        value: bytes,
        key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Encrypt a Redis value"""
        encrypted = self.service.encrypt(value, "redis", key, user_id)
        
        return json.dumps({
            "ciphertext": base64.b64encode(encrypted.ciphertext).decode(),
            "nonce": base64.b64encode(encrypted.nonce).decode(),
            "data_key_id": encrypted.data_key_id,
            "encrypted_data_key": base64.b64encode(encrypted.encrypted_data_key).decode(),
            "algorithm": encrypted.algorithm,
            "version": encrypted.version,
        }).encode()
    
    def decrypt_value(
        self,
        encrypted_value: bytes,
        key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt a Redis value"""
        data = json.loads(encrypted_value.decode())
        
        encrypted = EncryptedData(
            ciphertext=base64.b64decode(data["ciphertext"]),
            nonce=base64.b64decode(data["nonce"]),
            data_key_id=data["data_key_id"],
            encrypted_data_key=base64.b64decode(data["encrypted_data_key"]),
            algorithm=data["algorithm"],
            version=data["version"],
            encrypted_at=datetime.utcnow(),
        )
        
        return self.service.decrypt(encrypted, "redis", key, user_id)
    
    @staticmethod
    def get_sensitive_key_patterns() -> List[str]:
        """Returns Redis key patterns that should be encrypted"""
        return [
            "session:*",
            "token:*",
            "user:*:pii",
            "cache:customer:*",
            "cache:account:*",
            "rate_limit:*",
        ]


@dataclass
class SSEConfig:
    """Server-Side Encryption configuration for RustFS"""
    algorithm: str = "AES256"  # AES256, aws:kms
    key_id: Optional[str] = None  # KMS key ID if using KMS
    customer_key: Optional[str] = None  # Base64-encoded customer key for SSE-C
    customer_key_md5: Optional[str] = None  # MD5 of customer key for SSE-C


class RustFSEncryption(DataStoreEncryption):
    """RustFS-specific encryption (Server-Side Encryption)"""
    
    def __init__(self, service: EncryptionAtRestService, sse_key: Optional[bytes] = None):
        super().__init__(service)
        self.sse_key = sse_key
    
    def get_sse_config(self) -> SSEConfig:
        """Get SSE configuration for RustFS uploads"""
        if not self.sse_key:
            # Use server-managed encryption
            return SSEConfig(algorithm="AES256")
        
        # Use customer-provided key (SSE-C)
        return SSEConfig(
            algorithm="AES256",
            customer_key=base64.b64encode(self.sse_key).decode(),
            customer_key_md5=self._compute_md5(self.sse_key),
        )
    
    def encrypt_object(
        self,
        data: bytes,
        bucket: str,
        key: str,
        user_id: Optional[str] = None,
    ) -> Tuple[bytes, Dict[str, str]]:
        """Encrypt an object before upload (client-side encryption)"""
        resource_id = f"{bucket}/{key}"
        encrypted = self.service.encrypt(data, "rustfs", resource_id, user_id)
        
        # Store encryption metadata in object metadata
        metadata = {
            "x-amz-meta-encryption-algorithm": encrypted.algorithm,
            "x-amz-meta-encryption-key-id": encrypted.data_key_id,
            "x-amz-meta-encryption-nonce": base64.b64encode(encrypted.nonce).decode(),
            "x-amz-meta-encrypted-data-key": base64.b64encode(encrypted.encrypted_data_key).decode(),
            "x-amz-meta-encryption-version": str(encrypted.version),
        }
        
        return encrypted.ciphertext, metadata
    
    def decrypt_object(
        self,
        data: bytes,
        metadata: Dict[str, str],
        bucket: str,
        key: str,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt an object after download (client-side decryption)"""
        # Reconstruct encrypted data from metadata
        encrypted = EncryptedData(
            ciphertext=data,
            nonce=base64.b64decode(metadata["x-amz-meta-encryption-nonce"]),
            data_key_id=metadata["x-amz-meta-encryption-key-id"],
            encrypted_data_key=base64.b64decode(metadata["x-amz-meta-encrypted-data-key"]),
            algorithm=metadata["x-amz-meta-encryption-algorithm"],
            version=int(metadata["x-amz-meta-encryption-version"]),
            encrypted_at=datetime.utcnow(),
        )
        
        resource_id = f"{bucket}/{key}"
        return self.service.decrypt(encrypted, "rustfs", resource_id, user_id)
    
    def _compute_md5(self, data: bytes) -> str:
        """Compute MD5 hash for SSE-C"""
        return base64.b64encode(hashlib.md5(data).digest()).decode()


@dataclass
class BackupMetadata:
    """Backup encryption metadata"""
    backup_id: str
    source_data_store: str
    encrypted_at: datetime
    algorithm: str
    data_key_id: str
    encrypted_data_key: str
    nonce: str
    checksum: str


class BackupEncryption(DataStoreEncryption):
    """Backup-specific encryption"""
    
    def encrypt_backup(
        self,
        data: bytes,
        backup_id: str,
        source_data_store: str,
        user_id: Optional[str] = None,
    ) -> Tuple[bytes, BackupMetadata]:
        """Encrypt a backup file"""
        resource_id = f"backup:{source_data_store}:{backup_id}"
        encrypted = self.service.encrypt(data, "backup", resource_id, user_id)
        
        metadata = BackupMetadata(
            backup_id=backup_id,
            source_data_store=source_data_store,
            encrypted_at=encrypted.encrypted_at,
            algorithm=encrypted.algorithm,
            data_key_id=encrypted.data_key_id,
            encrypted_data_key=base64.b64encode(encrypted.encrypted_data_key).decode(),
            nonce=base64.b64encode(encrypted.nonce).decode(),
            checksum=self._compute_checksum(encrypted.ciphertext),
        )
        
        return encrypted.ciphertext, metadata
    
    def decrypt_backup(
        self,
        data: bytes,
        metadata: BackupMetadata,
        user_id: Optional[str] = None,
    ) -> bytes:
        """Decrypt a backup file"""
        # Verify checksum
        if self._compute_checksum(data) != metadata.checksum:
            raise ValueError("Backup checksum mismatch")
        
        encrypted = EncryptedData(
            ciphertext=data,
            nonce=base64.b64decode(metadata.nonce),
            data_key_id=metadata.data_key_id,
            encrypted_data_key=base64.b64decode(metadata.encrypted_data_key),
            algorithm=metadata.algorithm,
            version=1,
            encrypted_at=metadata.encrypted_at,
        )
        
        resource_id = f"backup:{metadata.source_data_store}:{metadata.backup_id}"
        return self.service.decrypt(encrypted, "backup", resource_id, user_id)
    
    def _compute_checksum(self, data: bytes) -> str:
        """Compute SHA-256 checksum"""
        return base64.b64encode(hashlib.sha256(data).digest()).decode()


@dataclass
class EncryptionProvider:
    """Kubernetes encryption provider configuration"""
    name: str
    type: str  # aescbc, aesgcm, kms, secretbox
    key_id: str
    endpoint: Optional[str] = None  # For KMS provider


class KubernetesSecretsEncryption:
    """Kubernetes secrets encryption configuration"""
    
    def __init__(self):
        self.providers = [
            EncryptionProvider(
                name="paygate-kms",
                type="kms",
                key_id="paygate-secrets-key",
                endpoint="unix:///var/run/kmsplugin/socket.sock",
            ),
            EncryptionProvider(
                name="paygate-aesgcm",
                type="aesgcm",
                key_id="paygate-secrets-key-local",
            ),
        ]
    
    def generate_encryption_config(self) -> str:
        """Generate Kubernetes EncryptionConfiguration"""
        return """apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
      - configmaps
    providers:
      - kms:
          apiVersion: v2
          name: paygate-kms
          endpoint: unix:///var/run/kmsplugin/socket.sock
          cachesize: 1000
          timeout: 3s
      - aesgcm:
          keys:
            - name: paygate-secrets-key
              secret: ${ENCRYPTION_KEY_BASE64}
      - identity: {}
"""
    
    def generate_kms_plugin_config(self) -> str:
        """Generate KMS plugin configuration for Vault"""
        return """apiVersion: v1
kind: ConfigMap
metadata:
  name: vault-kms-plugin-config
  namespace: kube-system
data:
  config.yaml: |
    socketPath: /var/run/kmsplugin/socket.sock
    vaultAddr: https://vault.security.svc.cluster.local:8200
    vaultToken: ${VAULT_TOKEN}
    transitPath: transit
    keyName: paygate-secrets-key
    cacheSize: 1000
    cacheTTL: 1h
"""
