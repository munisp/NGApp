"""
Kafka Schema Registry Integration

This module provides schema management for domain events to ensure
contract compatibility between producers and consumers.

Features:
- JSON Schema definitions for all domain events
- Schema versioning with compatibility checks
- Schema registration and validation
- Backward/forward compatibility enforcement
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Type
import hashlib

logger = logging.getLogger(__name__)


class CompatibilityMode(Enum):
    """Schema compatibility modes"""
    BACKWARD = "BACKWARD"
    FORWARD = "FORWARD"
    FULL = "FULL"
    NONE = "NONE"


@dataclass
class SchemaVersion:
    """Represents a versioned schema"""
    schema_id: str
    version: int
    schema_json: Dict[str, Any]
    fingerprint: str
    created_at: str
    compatibility_mode: CompatibilityMode


class EventSchemaRegistry:
    """
    Schema registry for domain events.
    
    Provides:
    - Schema registration and versioning
    - Compatibility checking
    - Schema validation
    - Schema evolution tracking
    """
    
    def __init__(self, registry_url: Optional[str] = None):
        """
        Initialize schema registry.
        
        Args:
            registry_url: URL of external schema registry (Confluent, etc.)
                         If None, uses in-memory registry
        """
        self.registry_url = registry_url
        self._schemas: Dict[str, List[SchemaVersion]] = {}
        self._compatibility_modes: Dict[str, CompatibilityMode] = {}
        self._register_default_schemas()
    
    def _register_default_schemas(self) -> None:
        """Register default schemas for all domain events"""
        
        # Base event schema (all events inherit from this)
        base_event_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.event.base",
            "type": "object",
            "required": [
                "event_id",
                "event_type",
                "timestamp",
                "version",
                "source_service",
                "correlation_id",
                "aggregate_type",
                "aggregate_id",
                "data"
            ],
            "properties": {
                "event_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Unique identifier for this event"
                },
                "event_type": {
                    "type": "string",
                    "description": "Type of event (e.g., kyc.verification.completed)"
                },
                "timestamp": {
                    "type": "string",
                    "format": "date-time",
                    "description": "ISO 8601 timestamp when event occurred"
                },
                "version": {
                    "type": "string",
                    "pattern": "^\\d+\\.\\d+$",
                    "description": "Schema version (e.g., 1.0)"
                },
                "source_service": {
                    "type": "string",
                    "description": "Name of service that emitted the event"
                },
                "correlation_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Correlation ID for request tracing"
                },
                "causation_id": {
                    "type": ["string", "null"],
                    "format": "uuid",
                    "description": "ID of event that caused this event"
                },
                "aggregate_type": {
                    "type": "string",
                    "description": "Type of aggregate (customer, transaction, etc.)"
                },
                "aggregate_id": {
                    "type": "string",
                    "description": "ID of the aggregate"
                },
                "data": {
                    "type": "object",
                    "description": "Event-specific data payload"
                },
                "metadata": {
                    "type": "object",
                    "description": "Additional metadata",
                    "default": {}
                }
            }
        }
        self.register_schema("domain.event.base", base_event_schema)
        
        # KYC Events
        kyc_verification_completed_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.kyc.verification.completed",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["status", "confidence_score"],
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["verified", "rejected", "pending_review"]
                        },
                        "confidence_score": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100
                        },
                        "verified_fields": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "document_types": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "risk_level": {
                            "type": "string",
                            "enum": ["low", "medium", "high"]
                        },
                        "completed_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.kyc.verification.completed", kyc_verification_completed_schema)
        
        # AML Events
        aml_screening_completed_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.aml.screening.completed",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["risk_score", "watchlists_checked"],
                    "properties": {
                        "risk_score": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 100
                        },
                        "watchlists_checked": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": ["OFAC", "UN", "EU", "UK_HMT", "PEP", "ADVERSE_MEDIA"]
                            }
                        },
                        "matches_found": {
                            "type": "integer",
                            "minimum": 0
                        },
                        "match_details": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "watchlist": {"type": "string"},
                                    "match_score": {"type": "number"},
                                    "matched_name": {"type": "string"}
                                }
                            }
                        },
                        "decision": {
                            "type": "string",
                            "enum": ["clear", "review", "block"]
                        },
                        "screened_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.aml.screening.completed", aml_screening_completed_schema)
        
        # Remittance Events
        remittance_completed_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.remittance.completed",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["status", "amount", "currency"],
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["completed", "failed", "reversed"]
                        },
                        "amount": {
                            "type": "number",
                            "minimum": 0
                        },
                        "currency": {
                            "type": "string",
                            "pattern": "^[A-Z]{3}$"
                        },
                        "sender_id": {"type": "string"},
                        "recipient_id": {"type": "string"},
                        "corridor": {"type": "string"},
                        "exchange_rate": {"type": "number"},
                        "fees": {"type": "number"},
                        "payout_reference": {"type": "string"},
                        "payout_method": {
                            "type": "string",
                            "enum": ["bank_transfer", "mobile_money", "cash_pickup", "wallet"]
                        },
                        "completed_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.remittance.completed", remittance_completed_schema)
        
        # Fraud Events
        fraud_score_calculated_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.fraud.score.calculated",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["score", "decision"],
                    "properties": {
                        "score": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1
                        },
                        "decision": {
                            "type": "string",
                            "enum": ["allow", "step_up", "review", "block"]
                        },
                        "risk_factors": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "model_version": {"type": "string"},
                        "features": {
                            "type": "object",
                            "additionalProperties": {"type": "number"}
                        },
                        "scored_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.fraud.score.calculated", fraud_score_calculated_schema)
        
        # Settlement Events
        settlement_completed_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.settlement.completed",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["status", "total_amount", "transaction_count"],
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["completed", "partial", "failed"]
                        },
                        "total_amount": {"type": "number"},
                        "currency": {"type": "string"},
                        "transaction_count": {"type": "integer"},
                        "settlement_reference": {"type": "string"},
                        "partner_id": {"type": "string"},
                        "settlement_date": {
                            "type": "string",
                            "format": "date"
                        },
                        "completed_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.settlement.completed", settlement_completed_schema)
        
        # Reconciliation Events
        reconciliation_mismatch_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.reconciliation.mismatch.found",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["entity_type", "entity_id", "mismatch_type"],
                    "properties": {
                        "entity_type": {
                            "type": "string",
                            "enum": ["transaction", "balance", "settlement"]
                        },
                        "entity_id": {"type": "string"},
                        "mismatch_type": {
                            "type": "string",
                            "enum": ["amount", "status", "missing", "duplicate"]
                        },
                        "expected_value": {},
                        "actual_value": {},
                        "difference": {},
                        "source_system": {"type": "string"},
                        "target_system": {"type": "string"},
                        "found_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.reconciliation.mismatch.found", reconciliation_mismatch_schema)
        
        # Dispute Events
        dispute_opened_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.dispute.opened",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["dispute_type", "transaction_id", "amount"],
                    "properties": {
                        "dispute_type": {
                            "type": "string",
                            "enum": ["unauthorized", "not_received", "wrong_amount", "duplicate", "other"]
                        },
                        "transaction_id": {"type": "string"},
                        "amount": {"type": "number"},
                        "currency": {"type": "string"},
                        "customer_id": {"type": "string"},
                        "reason": {"type": "string"},
                        "evidence": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "opened_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.dispute.opened", dispute_opened_schema)
        
        # Rate Alert Events
        rate_alert_triggered_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.rate.alert.triggered",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["currency_pair", "target_rate", "current_rate"],
                    "properties": {
                        "currency_pair": {"type": "string"},
                        "target_rate": {"type": "number"},
                        "current_rate": {"type": "number"},
                        "direction": {
                            "type": "string",
                            "enum": ["above", "below"]
                        },
                        "customer_id": {"type": "string"},
                        "alert_id": {"type": "string"},
                        "triggered_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.rate.alert.triggered", rate_alert_triggered_schema)
        
        # FX Lock Events
        fx_lock_created_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "domain.events.fx.lock.created",
            "allOf": [{"$ref": "domain.event.base"}],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["currency_pair", "locked_rate", "amount", "expires_at"],
                    "properties": {
                        "currency_pair": {"type": "string"},
                        "locked_rate": {"type": "number"},
                        "amount": {"type": "number"},
                        "currency": {"type": "string"},
                        "customer_id": {"type": "string"},
                        "lock_id": {"type": "string"},
                        "expires_at": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "created_at": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                }
            }
        }
        self.register_schema("domain.events.fx.lock.created", fx_lock_created_schema)
        
        logger.info(f"Registered {len(self._schemas)} default event schemas")
    
    def _compute_fingerprint(self, schema: Dict[str, Any]) -> str:
        """Compute a fingerprint for a schema"""
        canonical = json.dumps(schema, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]
    
    def register_schema(
        self,
        subject: str,
        schema: Dict[str, Any],
        compatibility_mode: CompatibilityMode = CompatibilityMode.BACKWARD
    ) -> SchemaVersion:
        """
        Register a new schema version.
        
        Args:
            subject: Schema subject (e.g., domain.events.kyc.verification.completed)
            schema: JSON Schema definition
            compatibility_mode: Compatibility mode for this subject
        
        Returns:
            SchemaVersion object
        """
        fingerprint = self._compute_fingerprint(schema)
        
        # Check if schema already exists
        if subject in self._schemas:
            for existing in self._schemas[subject]:
                if existing.fingerprint == fingerprint:
                    return existing
            
            # Check compatibility
            if not self._check_compatibility(subject, schema):
                raise ValueError(f"Schema is not compatible with existing versions for {subject}")
            
            version = len(self._schemas[subject]) + 1
        else:
            self._schemas[subject] = []
            version = 1
        
        schema_version = SchemaVersion(
            schema_id=f"{subject}-v{version}",
            version=version,
            schema_json=schema,
            fingerprint=fingerprint,
            created_at=datetime.utcnow().isoformat(),
            compatibility_mode=compatibility_mode
        )
        
        self._schemas[subject].append(schema_version)
        self._compatibility_modes[subject] = compatibility_mode
        
        logger.info(f"Registered schema {subject} version {version}")
        return schema_version
    
    def _check_compatibility(self, subject: str, new_schema: Dict[str, Any]) -> bool:
        """Check if new schema is compatible with existing versions"""
        if subject not in self._schemas or not self._schemas[subject]:
            return True
        
        mode = self._compatibility_modes.get(subject, CompatibilityMode.BACKWARD)
        latest = self._schemas[subject][-1]
        
        if mode == CompatibilityMode.NONE:
            return True
        
        # Simplified compatibility check
        # In production, use a proper JSON Schema compatibility library
        old_required = set(latest.schema_json.get("properties", {}).get("data", {}).get("required", []))
        new_required = set(new_schema.get("properties", {}).get("data", {}).get("required", []))
        
        if mode == CompatibilityMode.BACKWARD:
            # New schema can't add required fields
            added_required = new_required - old_required
            if added_required:
                logger.warning(f"Backward incompatible: added required fields {added_required}")
                return False
        
        elif mode == CompatibilityMode.FORWARD:
            # New schema can't remove required fields
            removed_required = old_required - new_required
            if removed_required:
                logger.warning(f"Forward incompatible: removed required fields {removed_required}")
                return False
        
        elif mode == CompatibilityMode.FULL:
            # Neither add nor remove required fields
            if old_required != new_required:
                logger.warning(f"Full incompatible: required fields changed")
                return False
        
        return True
    
    def get_schema(self, subject: str, version: Optional[int] = None) -> Optional[SchemaVersion]:
        """
        Get a schema by subject and optional version.
        
        Args:
            subject: Schema subject
            version: Specific version (None for latest)
        
        Returns:
            SchemaVersion or None if not found
        """
        if subject not in self._schemas:
            return None
        
        versions = self._schemas[subject]
        if not versions:
            return None
        
        if version is None:
            return versions[-1]
        
        for v in versions:
            if v.version == version:
                return v
        
        return None
    
    def validate_event(self, subject: str, event_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Validate an event against its schema.
        
        Args:
            subject: Schema subject
            event_data: Event data to validate
        
        Returns:
            Tuple of (is_valid, list of errors)
        """
        schema_version = self.get_schema(subject)
        if not schema_version:
            return False, [f"Schema not found for subject: {subject}"]
        
        errors = []
        schema = schema_version.schema_json
        
        # Check required fields
        required = schema.get("required", [])
        for field in required:
            if field not in event_data:
                errors.append(f"Missing required field: {field}")
        
        # Check data payload required fields
        data_schema = schema.get("properties", {}).get("data", {})
        data_required = data_schema.get("required", [])
        event_data_payload = event_data.get("data", {})
        
        for field in data_required:
            if field not in event_data_payload:
                errors.append(f"Missing required data field: {field}")
        
        return len(errors) == 0, errors
    
    def list_subjects(self) -> List[str]:
        """List all registered schema subjects"""
        return list(self._schemas.keys())
    
    def get_all_versions(self, subject: str) -> List[SchemaVersion]:
        """Get all versions of a schema"""
        return self._schemas.get(subject, [])
    
    def export_schemas(self) -> Dict[str, Any]:
        """Export all schemas as a dictionary"""
        export = {}
        for subject, versions in self._schemas.items():
            export[subject] = {
                "versions": [
                    {
                        "version": v.version,
                        "schema": v.schema_json,
                        "fingerprint": v.fingerprint,
                        "created_at": v.created_at
                    }
                    for v in versions
                ],
                "compatibility_mode": self._compatibility_modes.get(subject, CompatibilityMode.BACKWARD).value
            }
        return export


# Global registry instance
_registry: Optional[EventSchemaRegistry] = None


def get_schema_registry() -> EventSchemaRegistry:
    """Get the global schema registry instance"""
    global _registry
    if _registry is None:
        _registry = EventSchemaRegistry()
    return _registry


def validate_event(event_type: str, event_data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """Convenience function to validate an event"""
    registry = get_schema_registry()
    subject = f"domain.events.{event_type.replace('.', '.')}"
    return registry.validate_event(subject, event_data)
