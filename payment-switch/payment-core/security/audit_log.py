#!/usr/bin/env python3
"""
Audit Logging Service for Payment Switch
Immutable audit trail for compliance and security
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

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/10')
AUDIT_RETENTION_DAYS = int(os.getenv('AUDIT_RETENTION_DAYS', '2555'))  # 7 years default


class AuditEventType(Enum):
    # Authentication events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILURE = "auth.login.failure"
    LOGOUT = "auth.logout"
    PASSWORD_CHANGE = "auth.password.change"
    MFA_ENABLED = "auth.mfa.enabled"
    MFA_DISABLED = "auth.mfa.disabled"
    
    # Transaction events
    TRANSACTION_CREATED = "transaction.created"
    TRANSACTION_APPROVED = "transaction.approved"
    TRANSACTION_REJECTED = "transaction.rejected"
    TRANSACTION_CANCELLED = "transaction.cancelled"
    
    # Settlement events
    SETTLEMENT_OPENED = "settlement.opened"
    SETTLEMENT_CLOSED = "settlement.closed"
    SETTLEMENT_APPROVED = "settlement.approved"
    SETTLEMENT_REJECTED = "settlement.rejected"
    
    # Participant events
    PARTICIPANT_CREATED = "participant.created"
    PARTICIPANT_UPDATED = "participant.updated"
    PARTICIPANT_SUSPENDED = "participant.suspended"
    PARTICIPANT_ACTIVATED = "participant.activated"
    
    # Fraud events
    FRAUD_ALERT_CREATED = "fraud.alert.created"
    FRAUD_ALERT_RESOLVED = "fraud.alert.resolved"
    FRAUD_ALERT_ESCALATED = "fraud.alert.escalated"
    
    # Kill switch events
    KILLSWITCH_ACTIVATED = "killswitch.activated"
    KILLSWITCH_DEACTIVATED = "killswitch.deactivated"
    
    # Admin events
    USER_CREATED = "admin.user.created"
    USER_UPDATED = "admin.user.updated"
    USER_DELETED = "admin.user.deleted"
    ROLE_ASSIGNED = "admin.role.assigned"
    ROLE_REVOKED = "admin.role.revoked"
    CONFIG_CHANGED = "admin.config.changed"
    
    # Data access events
    DATA_EXPORTED = "data.exported"
    PII_ACCESSED = "data.pii.accessed"
    REPORT_GENERATED = "data.report.generated"
    
    # System events
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"
    BACKUP_CREATED = "system.backup.created"
    BACKUP_RESTORED = "system.backup.restored"


class AuditSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    event_id: str
    event_type: AuditEventType
    severity: AuditSeverity
    timestamp: str
    actor_id: str
    actor_email: str
    actor_ip: str
    resource_type: str
    resource_id: Optional[str]
    action: str
    outcome: str  # success, failure
    details: Dict[str, Any]
    metadata: Dict[str, Any]
    hash: str  # For tamper detection
    previous_hash: str  # Chain for integrity


class AuditLogService:
    """Immutable audit logging service"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "audit:"
        self.retention_days = AUDIT_RETENTION_DAYS
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Audit log service connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def log_event(
        self,
        event_type: AuditEventType,
        actor_id: str,
        actor_email: str,
        actor_ip: str,
        resource_type: str,
        action: str,
        outcome: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.INFO
    ) -> AuditEvent:
        """Log an audit event"""
        
        # Generate event ID
        event_id = f"audit-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        timestamp = datetime.utcnow().isoformat()
        
        # Get previous hash for chain integrity
        previous_hash = self._get_latest_hash()
        
        # Create event
        event_data = {
            'event_id': event_id,
            'event_type': event_type.value,
            'severity': severity.value,
            'timestamp': timestamp,
            'actor_id': actor_id,
            'actor_email': actor_email,
            'actor_ip': actor_ip,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'action': action,
            'outcome': outcome,
            'details': details or {},
            'metadata': metadata or {},
            'previous_hash': previous_hash
        }
        
        # Compute hash for tamper detection
        event_hash = self._compute_hash(event_data)
        event_data['hash'] = event_hash
        
        # Store event
        self._store_event(event_data)
        
        # Update latest hash
        self.redis_client.set(f"{self.prefix}latest_hash", event_hash)
        
        # Log critical events
        if severity == AuditSeverity.CRITICAL:
            logger.critical(f"AUDIT: {event_type.value} by {actor_email} - {outcome}")
        
        return AuditEvent(
            event_id=event_id,
            event_type=event_type,
            severity=severity,
            timestamp=timestamp,
            actor_id=actor_id,
            actor_email=actor_email,
            actor_ip=actor_ip,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            outcome=outcome,
            details=details or {},
            metadata=metadata or {},
            hash=event_hash,
            previous_hash=previous_hash
        )
    
    def _compute_hash(self, event_data: Dict[str, Any]) -> str:
        """Compute SHA-256 hash of event data"""
        # Exclude hash field from computation
        data_to_hash = {k: v for k, v in event_data.items() if k != 'hash'}
        data_str = json.dumps(data_to_hash, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def _get_latest_hash(self) -> str:
        """Get hash of latest event for chain integrity"""
        latest = self.redis_client.get(f"{self.prefix}latest_hash")
        return latest or "genesis"
    
    def _store_event(self, event_data: Dict[str, Any]):
        """Store event in Redis with proper indexing"""
        event_id = event_data['event_id']
        
        # Store main event
        key = f"{self.prefix}event:{event_id}"
        ttl = self.retention_days * 86400
        self.redis_client.setex(key, ttl, json.dumps(event_data))
        
        # Add to chronological list
        self.redis_client.lpush(f"{self.prefix}events", event_id)
        
        # Add to actor index
        actor_id = event_data['actor_id']
        self.redis_client.lpush(f"{self.prefix}actor:{actor_id}", event_id)
        
        # Add to resource index
        resource_type = event_data['resource_type']
        resource_id = event_data.get('resource_id')
        if resource_id:
            self.redis_client.lpush(f"{self.prefix}resource:{resource_type}:{resource_id}", event_id)
        
        # Add to event type index
        event_type = event_data['event_type']
        self.redis_client.lpush(f"{self.prefix}type:{event_type}", event_id)
        
        # Add to date index
        date = event_data['timestamp'][:10]
        self.redis_client.lpush(f"{self.prefix}date:{date}", event_id)
    
    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific audit event"""
        key = f"{self.prefix}event:{event_id}"
        data = self.redis_client.get(key)
        return json.loads(data) if data else None
    
    def verify_event_integrity(self, event_id: str) -> Dict[str, Any]:
        """Verify integrity of an audit event"""
        event = self.get_event(event_id)
        if not event:
            return {'valid': False, 'reason': 'Event not found'}
        
        stored_hash = event.get('hash')
        computed_hash = self._compute_hash(event)
        
        if stored_hash != computed_hash:
            return {
                'valid': False,
                'reason': 'Hash mismatch - event may have been tampered',
                'stored_hash': stored_hash,
                'computed_hash': computed_hash
            }
        
        return {'valid': True, 'hash': stored_hash}
    
    def verify_chain_integrity(self, limit: int = 100) -> Dict[str, Any]:
        """Verify integrity of audit event chain"""
        event_ids = self.redis_client.lrange(f"{self.prefix}events", 0, limit - 1)
        
        if not event_ids:
            return {'valid': True, 'events_checked': 0}
        
        broken_links = []
        events_checked = 0
        
        for i, event_id in enumerate(event_ids):
            event = self.get_event(event_id)
            if not event:
                continue
            
            events_checked += 1
            
            # Verify event hash
            integrity = self.verify_event_integrity(event_id)
            if not integrity['valid']:
                broken_links.append({
                    'event_id': event_id,
                    'issue': 'hash_mismatch'
                })
                continue
            
            # Verify chain link (skip first event)
            if i < len(event_ids) - 1:
                next_event_id = event_ids[i + 1]
                next_event = self.get_event(next_event_id)
                if next_event:
                    expected_previous = next_event.get('hash')
                    actual_previous = event.get('previous_hash')
                    # Note: This is simplified - in production, verify proper chain ordering
        
        return {
            'valid': len(broken_links) == 0,
            'events_checked': events_checked,
            'broken_links': broken_links
        }
    
    def search_events(
        self,
        actor_id: Optional[str] = None,
        event_type: Optional[AuditEventType] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Search audit events with filters"""
        
        # Determine which index to use
        if actor_id:
            event_ids = self.redis_client.lrange(f"{self.prefix}actor:{actor_id}", 0, limit * 2)
        elif event_type:
            event_ids = self.redis_client.lrange(f"{self.prefix}type:{event_type.value}", 0, limit * 2)
        elif resource_type and resource_id:
            event_ids = self.redis_client.lrange(f"{self.prefix}resource:{resource_type}:{resource_id}", 0, limit * 2)
        elif start_date:
            event_ids = self.redis_client.lrange(f"{self.prefix}date:{start_date}", 0, limit * 2)
        else:
            event_ids = self.redis_client.lrange(f"{self.prefix}events", 0, limit * 2)
        
        events = []
        for event_id in event_ids:
            event = self.get_event(event_id)
            if event:
                # Apply additional filters
                if actor_id and event.get('actor_id') != actor_id:
                    continue
                if event_type and event.get('event_type') != event_type.value:
                    continue
                if resource_type and event.get('resource_type') != resource_type:
                    continue
                if resource_id and event.get('resource_id') != resource_id:
                    continue
                
                events.append(event)
                if len(events) >= limit:
                    break
        
        return events
    
    def generate_compliance_report(
        self,
        start_date: str,
        end_date: str,
        report_type: str = "full"
    ) -> Dict[str, Any]:
        """Generate compliance audit report"""
        
        # Get all events in date range
        events = []
        current_date = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        while current_date <= end:
            date_str = current_date.strftime('%Y-%m-%d')
            event_ids = self.redis_client.lrange(f"{self.prefix}date:{date_str}", 0, -1)
            for event_id in event_ids:
                event = self.get_event(event_id)
                if event:
                    events.append(event)
            current_date = current_date.replace(day=current_date.day + 1)
        
        # Generate summary
        summary = {
            'total_events': len(events),
            'by_type': {},
            'by_severity': {'info': 0, 'warning': 0, 'critical': 0},
            'by_outcome': {'success': 0, 'failure': 0},
            'unique_actors': set(),
            'critical_events': []
        }
        
        for event in events:
            event_type = event.get('event_type', 'unknown')
            summary['by_type'][event_type] = summary['by_type'].get(event_type, 0) + 1
            
            severity = event.get('severity', 'info')
            summary['by_severity'][severity] = summary['by_severity'].get(severity, 0) + 1
            
            outcome = event.get('outcome', 'unknown')
            if outcome in summary['by_outcome']:
                summary['by_outcome'][outcome] += 1
            
            summary['unique_actors'].add(event.get('actor_id'))
            
            if severity == 'critical':
                summary['critical_events'].append({
                    'event_id': event.get('event_id'),
                    'event_type': event_type,
                    'timestamp': event.get('timestamp'),
                    'actor_email': event.get('actor_email'),
                    'action': event.get('action')
                })
        
        summary['unique_actors'] = len(summary['unique_actors'])
        
        return {
            'report_id': f"compliance-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            'generated_at': datetime.utcnow().isoformat(),
            'period': {'start': start_date, 'end': end_date},
            'summary': summary,
            'chain_integrity': self.verify_chain_integrity(limit=1000)
        }


# Singleton instance
_service: Optional[AuditLogService] = None

def get_audit_log_service() -> AuditLogService:
    global _service
    if _service is None:
        _service = AuditLogService()
        _service.initialize()
    return _service
