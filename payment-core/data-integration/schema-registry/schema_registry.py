#!/usr/bin/env python3
"""
Schema Registry for Payment Switch
Manages versioned schemas for Kafka topics with backward compatibility
"""

import json
import logging
import os
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/1')


class CompatibilityMode(Enum):
    NONE = "NONE"
    BACKWARD = "BACKWARD"
    BACKWARD_TRANSITIVE = "BACKWARD_TRANSITIVE"
    FORWARD = "FORWARD"
    FORWARD_TRANSITIVE = "FORWARD_TRANSITIVE"
    FULL = "FULL"
    FULL_TRANSITIVE = "FULL_TRANSITIVE"


@dataclass
class SchemaVersion:
    version: int
    schema: Dict[str, Any]
    fingerprint: str
    created_at: str
    created_by: str
    compatibility_mode: str


@dataclass
class SchemaSubject:
    name: str
    versions: List[SchemaVersion] = field(default_factory=list)
    compatibility_mode: str = "BACKWARD"
    description: str = ""


class SchemaRegistry:
    """Schema registry for managing event schemas"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "schema_registry:"
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Schema registry connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def _get_subject_key(self, subject: str) -> str:
        return f"{self.prefix}subject:{subject}"
    
    def _compute_fingerprint(self, schema: Dict[str, Any]) -> str:
        schema_str = json.dumps(schema, sort_keys=True)
        return hashlib.sha256(schema_str.encode()).hexdigest()[:16]
    
    def register_schema(
        self,
        subject: str,
        schema: Dict[str, Any],
        created_by: str = "system"
    ) -> int:
        """Register a new schema version for a subject"""
        key = self._get_subject_key(subject)
        
        # Get existing subject or create new
        existing = self.redis_client.get(key)
        if existing:
            subject_data = json.loads(existing)
            versions = subject_data.get('versions', [])
            compatibility_mode = subject_data.get('compatibility_mode', 'BACKWARD')
        else:
            versions = []
            compatibility_mode = 'BACKWARD'
        
        # Check if schema already exists
        fingerprint = self._compute_fingerprint(schema)
        for v in versions:
            if v['fingerprint'] == fingerprint:
                logger.info(f"Schema already exists for {subject} at version {v['version']}")
                return v['version']
        
        # Check compatibility
        if versions and compatibility_mode != 'NONE':
            latest_schema = versions[-1]['schema']
            if not self._check_compatibility(latest_schema, schema, compatibility_mode):
                raise ValueError(f"Schema is not compatible with latest version (mode: {compatibility_mode})")
        
        # Create new version
        new_version = len(versions) + 1
        version_data = {
            'version': new_version,
            'schema': schema,
            'fingerprint': fingerprint,
            'created_at': datetime.utcnow().isoformat(),
            'created_by': created_by,
            'compatibility_mode': compatibility_mode
        }
        versions.append(version_data)
        
        # Save subject
        subject_data = {
            'name': subject,
            'versions': versions,
            'compatibility_mode': compatibility_mode,
            'updated_at': datetime.utcnow().isoformat()
        }
        self.redis_client.set(key, json.dumps(subject_data))
        
        logger.info(f"Registered schema version {new_version} for {subject}")
        return new_version
    
    def get_schema(self, subject: str, version: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get schema for a subject (latest or specific version)"""
        key = self._get_subject_key(subject)
        existing = self.redis_client.get(key)
        
        if not existing:
            return None
        
        subject_data = json.loads(existing)
        versions = subject_data.get('versions', [])
        
        if not versions:
            return None
        
        if version is None:
            return versions[-1]['schema']
        
        for v in versions:
            if v['version'] == version:
                return v['schema']
        
        return None
    
    def get_all_versions(self, subject: str) -> List[int]:
        """Get all version numbers for a subject"""
        key = self._get_subject_key(subject)
        existing = self.redis_client.get(key)
        
        if not existing:
            return []
        
        subject_data = json.loads(existing)
        return [v['version'] for v in subject_data.get('versions', [])]
    
    def set_compatibility(self, subject: str, mode: CompatibilityMode):
        """Set compatibility mode for a subject"""
        key = self._get_subject_key(subject)
        existing = self.redis_client.get(key)
        
        if not existing:
            subject_data = {'name': subject, 'versions': [], 'compatibility_mode': mode.value}
        else:
            subject_data = json.loads(existing)
            subject_data['compatibility_mode'] = mode.value
        
        self.redis_client.set(key, json.dumps(subject_data))
        logger.info(f"Set compatibility mode for {subject} to {mode.value}")
    
    def _check_compatibility(
        self,
        old_schema: Dict[str, Any],
        new_schema: Dict[str, Any],
        mode: str
    ) -> bool:
        """Check if new schema is compatible with old schema"""
        if mode == 'NONE':
            return True
        
        old_fields = set(old_schema.get('properties', {}).keys())
        new_fields = set(new_schema.get('properties', {}).keys())
        old_required = set(old_schema.get('required', []))
        new_required = set(new_schema.get('required', []))
        
        if mode in ['BACKWARD', 'BACKWARD_TRANSITIVE']:
            # New schema can read old data
            # - Can add optional fields
            # - Cannot remove fields
            # - Cannot add required fields
            removed_fields = old_fields - new_fields
            added_required = new_required - old_required
            
            if removed_fields:
                logger.warning(f"Backward incompatible: removed fields {removed_fields}")
                return False
            if added_required - new_fields:
                logger.warning(f"Backward incompatible: added required fields {added_required}")
                return False
            return True
        
        if mode in ['FORWARD', 'FORWARD_TRANSITIVE']:
            # Old schema can read new data
            # - Can remove optional fields
            # - Cannot add fields
            # - Cannot remove required fields
            added_fields = new_fields - old_fields
            removed_required = old_required - new_required
            
            if added_fields:
                logger.warning(f"Forward incompatible: added fields {added_fields}")
                return False
            if removed_required:
                logger.warning(f"Forward incompatible: removed required fields {removed_required}")
                return False
            return True
        
        if mode in ['FULL', 'FULL_TRANSITIVE']:
            # Both backward and forward compatible
            return (
                self._check_compatibility(old_schema, new_schema, 'BACKWARD') and
                self._check_compatibility(old_schema, new_schema, 'FORWARD')
            )
        
        return True
    
    def list_subjects(self) -> List[str]:
        """List all registered subjects"""
        pattern = f"{self.prefix}subject:*"
        keys = self.redis_client.keys(pattern)
        return [k.replace(f"{self.prefix}subject:", "") for k in keys]
    
    def delete_subject(self, subject: str) -> bool:
        """Delete a subject and all its versions"""
        key = self._get_subject_key(subject)
        result = self.redis_client.delete(key)
        return result > 0


# Pre-defined schemas for payment switch events
TRANSACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "transaction_id": {"type": "string"},
        "event_type": {"type": "string"},
        "timestamp": {"type": "string", "format": "date-time"},
        "payer_id": {"type": "string"},
        "payer_name": {"type": "string"},
        "payee_id": {"type": "string"},
        "payee_name": {"type": "string"},
        "amount": {"type": "number"},
        "currency": {"type": "string"},
        "status": {"type": "string", "enum": ["RESERVED", "COMMITTED", "ABORTED", "FAILED"]},
        "correlation_id": {"type": "string"},
        "latency_ms": {"type": "integer"}
    },
    "required": ["transaction_id", "event_type", "timestamp", "payer_id", "payee_id", "amount", "currency", "status"]
}

FRAUD_ALERT_SCHEMA = {
    "type": "object",
    "properties": {
        "alert_id": {"type": "string"},
        "transaction_id": {"type": "string"},
        "alert_type": {"type": "string"},
        "severity": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
        "status": {"type": "string", "enum": ["OPEN", "INVESTIGATING", "ESCALATED", "RESOLVED"]},
        "risk_score": {"type": "number", "minimum": 0, "maximum": 100},
        "ml_confidence": {"type": "number", "minimum": 0, "maximum": 100},
        "timestamp": {"type": "string", "format": "date-time"}
    },
    "required": ["alert_id", "transaction_id", "alert_type", "severity", "status", "risk_score", "timestamp"]
}

SETTLEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "settlement_id": {"type": "string"},
        "window_id": {"type": "string"},
        "status": {"type": "string"},
        "total_transactions": {"type": "integer"},
        "total_amount": {"type": "number"},
        "participant_count": {"type": "integer"},
        "opened_at": {"type": "string", "format": "date-time"},
        "closed_at": {"type": "string", "format": "date-time"}
    },
    "required": ["settlement_id", "window_id", "status", "total_transactions", "total_amount"]
}

KYC_EVENT_SCHEMA = {
    "type": "object",
    "properties": {
        "customer_id": {"type": "string"},
        "verification_id": {"type": "string"},
        "verification_type": {"type": "string"},
        "result": {"type": "string", "enum": ["APPROVED", "REJECTED", "PENDING", "EXPIRED"]},
        "confidence_score": {"type": "number", "minimum": 0, "maximum": 100},
        "documents": {"type": "array", "items": {"type": "string"}},
        "timestamp": {"type": "string", "format": "date-time"},
        "pii_fields": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string"},
                "date_of_birth": {"type": "string"},
                "national_id": {"type": "string"},
                "address": {"type": "string"}
            }
        }
    },
    "required": ["customer_id", "verification_id", "verification_type", "result", "timestamp"]
}


def register_default_schemas(registry: SchemaRegistry):
    """Register default schemas for payment switch events"""
    schemas = [
        ("domain.events.transaction", TRANSACTION_SCHEMA),
        ("domain.events.fraud", FRAUD_ALERT_SCHEMA),
        ("domain.events.settlement", SETTLEMENT_SCHEMA),
        ("domain.events.kyc", KYC_EVENT_SCHEMA),
    ]
    
    for subject, schema in schemas:
        try:
            registry.set_compatibility(subject, CompatibilityMode.BACKWARD)
            version = registry.register_schema(subject, schema, created_by="system")
            logger.info(f"Registered {subject} schema version {version}")
        except Exception as e:
            logger.error(f"Failed to register {subject} schema: {e}")


# Singleton instance
_registry: Optional[SchemaRegistry] = None

def get_registry() -> SchemaRegistry:
    global _registry
    if _registry is None:
        _registry = SchemaRegistry()
        _registry.initialize()
    return _registry
