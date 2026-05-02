"""
Encryption at Rest Module for PayGate Payment Switch

This module provides comprehensive encryption at rest capabilities for all data stores
in the PayGate platform, including PostgreSQL, TigerBeetle, Kafka, Redis, RustFS,
Kubernetes secrets, and backups.
"""

from .encryption_at_rest import (
    EncryptionAtRestService,
    EncryptionConfig,
    KeyManager,
    DataKey,
    EncryptedData,
    KeyUsageEvent,
    VaultKeyManager,
    FieldEncryptor,
)

from .datastore_encryption import (
    DataStoreEncryption,
    PostgresEncryption,
    TigerBeetleEncryption,
    KafkaEncryption,
    RedisEncryption,
    RustFSEncryption,
    BackupEncryption,
    KubernetesSecretsEncryption,
    EncryptedColumnConfig,
    SSEConfig,
    BackupMetadata,
)

__all__ = [
    # Core encryption
    "EncryptionAtRestService",
    "EncryptionConfig",
    "KeyManager",
    "DataKey",
    "EncryptedData",
    "KeyUsageEvent",
    "VaultKeyManager",
    "FieldEncryptor",
    # Data store encryption
    "DataStoreEncryption",
    "PostgresEncryption",
    "TigerBeetleEncryption",
    "KafkaEncryption",
    "RedisEncryption",
    "RustFSEncryption",
    "BackupEncryption",
    "KubernetesSecretsEncryption",
    "EncryptedColumnConfig",
    "SSEConfig",
    "BackupMetadata",
]
