"""
ISO 27001 Compliance Controls for PayGate
Implements Information Security Management System (ISMS) controls.
"""

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
import threading


class RiskStatus(Enum):
    """Risk status"""
    IDENTIFIED = "identified"
    ASSESSED = "assessed"
    TREATED = "treated"
    ACCEPTED = "accepted"
    CLOSED = "closed"


class TreatmentType(Enum):
    """Risk treatment types"""
    MITIGATE = "mitigate"
    TRANSFER = "transfer"
    ACCEPT = "accept"
    AVOID = "avoid"


class IncidentStatus(Enum):
    """Incident status"""
    OPEN = "open"
    INVESTIGATING = "investigating"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentSeverity(Enum):
    """Incident severity"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AssetClassification(Enum):
    """Asset classification"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


@dataclass
class Risk:
    """Represents an identified risk"""
    id: str = ""
    name: str = ""
    description: str = ""
    category: str = ""  # operational, technical, compliance, strategic
    asset: str = ""
    threat: str = ""
    vulnerability: str = ""
    
    # Risk scoring
    likelihood: float = 0.0  # 0-1
    impact: float = 0.0  # 0-1
    inherent_risk: float = 0.0  # likelihood * impact
    
    # Controls
    controls: List[str] = field(default_factory=list)
    control_effectiveness: float = 0.0  # 0-1
    residual_risk: float = 0.0
    
    # Treatment
    treatment_id: str = ""
    status: RiskStatus = RiskStatus.IDENTIFIED
    
    # Metadata
    owner: str = ""
    review_date: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    attributes: Dict[str, str] = field(default_factory=dict)


@dataclass
class TreatmentAction:
    """Action in a treatment plan"""
    id: str = ""
    description: str = ""
    owner: str = ""
    due_date: datetime = field(default_factory=datetime.utcnow)
    status: str = "pending"
    evidence: str = ""


@dataclass
class RiskTreatment:
    """Risk treatment plan"""
    id: str = ""
    risk_id: str = ""
    type: TreatmentType = TreatmentType.MITIGATE
    description: str = ""
    actions: List[TreatmentAction] = field(default_factory=list)
    target_risk: float = 0.0
    status: str = "planned"
    owner: str = ""
    due_date: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


@dataclass
class ComplianceAuditEvent:
    """Compliance audit event"""
    id: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    event_type: str = ""
    category: str = ""  # access, change, security, compliance
    severity: str = "info"  # info, warning, critical
    
    # Actor
    actor_id: str = ""
    actor_type: str = ""  # user, service, system
    actor_ip: str = ""
    
    # Action
    action: str = ""
    resource: str = ""
    resource_id: str = ""
    outcome: str = ""  # success, failure
    
    # Details
    details: Dict[str, Any] = field(default_factory=dict)
    previous_state: Any = None
    new_state: Any = None
    
    # Integrity
    hash: str = ""
    previous_hash: str = ""
    
    # Compliance
    control_ref: str = ""  # ISO 27001 control reference
    justification: str = ""


@dataclass
class SecurityIncident:
    """Security incident"""
    id: str = ""
    title: str = ""
    description: str = ""
    type: str = ""  # breach, malware, unauthorized_access, data_loss
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    status: IncidentStatus = IncidentStatus.OPEN
    
    # Timeline
    detected_at: datetime = field(default_factory=datetime.utcnow)
    reported_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    contained_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    # Assignment
    reporter: str = ""
    assignee: str = ""
    team: str = ""
    
    # Impact
    affected_systems: List[str] = field(default_factory=list)
    affected_users: int = 0
    data_compromised: bool = False
    financial_impact: float = 0.0
    
    # Response
    actions: List[Dict[str, Any]] = field(default_factory=list)
    root_cause: str = ""
    lessons_learned: str = ""
    
    # Evidence
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    
    # Compliance
    notification_required: bool = False
    notification_sent: bool = False
    regulatory_report: str = ""


@dataclass
class Asset:
    """Information asset"""
    id: str = ""
    name: str = ""
    description: str = ""
    type: str = ""  # hardware, software, data, service, personnel
    classification: AssetClassification = AssetClassification.INTERNAL
    owner: str = ""
    custodian: str = ""
    location: str = ""
    
    # Value
    business_value: str = ""  # critical, high, medium, low
    
    # Lifecycle
    status: str = "active"  # active, retired, planned
    acquired_at: datetime = field(default_factory=datetime.utcnow)
    retired_at: Optional[datetime] = None
    review_date: datetime = field(default_factory=datetime.utcnow)
    
    # Dependencies
    dependencies: List[str] = field(default_factory=list)
    dependent_assets: List[str] = field(default_factory=list)
    
    # Security
    security_controls: List[str] = field(default_factory=list)
    risk_assessments: List[str] = field(default_factory=list)
    
    # Metadata
    tags: List[str] = field(default_factory=list)
    attributes: Dict[str, str] = field(default_factory=dict)


@dataclass
class CryptoAlgorithm:
    """Approved cryptographic algorithm"""
    id: str = ""
    name: str = ""
    type: str = ""  # symmetric, asymmetric, hash, kdf
    key_sizes: List[int] = field(default_factory=list)
    approved: bool = True
    deprecated: bool = False
    use_cases: List[str] = field(default_factory=list)


@dataclass
class CryptoKey:
    """Cryptographic key"""
    id: str = ""
    name: str = ""
    algorithm: str = ""
    key_size: int = 0
    purpose: str = ""  # encryption, signing, key_exchange
    owner: str = ""
    status: str = "active"  # active, rotated, revoked, expired
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=datetime.utcnow)
    rotated_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    storage_location: str = ""  # hsm, vault, kms


@dataclass
class AccessPolicy:
    """Access control policy"""
    id: str = ""
    name: str = ""
    description: str = ""
    type: str = "rbac"  # rbac, abac, mandatory
    rules: List[Dict[str, Any]] = field(default_factory=list)
    enforcement_mode: str = "enforce"  # enforce, audit
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    review_date: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Role:
    """Security role"""
    id: str = ""
    name: str = ""
    description: str = ""
    permissions: List[str] = field(default_factory=list)
    parent_roles: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ControlApplicability:
    """Control applicability for SoA"""
    control_id: str = ""
    control_name: str = ""
    applicable: bool = True
    implemented: bool = False
    justification: str = ""
    evidence: List[str] = field(default_factory=list)


class ISO27001Config:
    """Configuration for ISO 27001 framework"""
    
    def __init__(
        self,
        organization_name: str = "PayGate",
        isms_scope: str = "Payment Processing Platform",
        risk_appetite: float = 0.3,
        audit_retention_days: int = 2555,  # 7 years
        incident_sla_minutes: int = 60,
        review_interval_days: int = 90
    ):
        self.organization_name = organization_name
        self.isms_scope = isms_scope
        self.risk_appetite = risk_appetite
        self.audit_retention_days = audit_retention_days
        self.incident_sla_minutes = incident_sla_minutes
        self.review_interval_days = review_interval_days


class RiskAssessmentFramework:
    """ISO 27001 Risk Assessment Framework"""
    
    def __init__(self, risk_appetite: float = 0.3):
        self._risks: Dict[str, Risk] = {}
        self._treatments: Dict[str, RiskTreatment] = {}
        self._risk_appetite = risk_appetite
        self._lock = threading.RLock()
    
    def identify_risk(self, risk: Risk) -> str:
        """Identify a new risk"""
        with self._lock:
            risk.id = self._generate_risk_id()
            risk.status = RiskStatus.IDENTIFIED
            risk.created_at = datetime.utcnow()
            risk.updated_at = datetime.utcnow()
            
            self._risks[risk.id] = risk
            return risk.id
    
    def assess_risk(
        self,
        risk_id: str,
        likelihood: float,
        impact: float,
        controls: List[str],
        control_effectiveness: float
    ) -> None:
        """Assess a risk's likelihood and impact"""
        with self._lock:
            if risk_id not in self._risks:
                raise ValueError(f"Risk not found: {risk_id}")
            
            risk = self._risks[risk_id]
            risk.likelihood = likelihood
            risk.impact = impact
            risk.inherent_risk = likelihood * impact
            risk.controls = controls
            risk.control_effectiveness = control_effectiveness
            risk.residual_risk = risk.inherent_risk * (1 - control_effectiveness)
            risk.status = RiskStatus.ASSESSED
            risk.updated_at = datetime.utcnow()
    
    def treat_risk(self, risk_id: str, treatment: RiskTreatment) -> str:
        """Create a treatment plan for a risk"""
        with self._lock:
            if risk_id not in self._risks:
                raise ValueError(f"Risk not found: {risk_id}")
            
            treatment.id = self._generate_treatment_id()
            treatment.risk_id = risk_id
            treatment.status = "planned"
            
            self._treatments[treatment.id] = treatment
            
            risk = self._risks[risk_id]
            risk.treatment_id = treatment.id
            risk.status = RiskStatus.TREATED
            risk.updated_at = datetime.utcnow()
            
            return treatment.id
    
    def get_risk_register(self) -> List[Risk]:
        """Get all risks"""
        with self._lock:
            return list(self._risks.values())
    
    def get_risks_above_appetite(self) -> List[Risk]:
        """Get risks above risk appetite"""
        with self._lock:
            return [
                risk for risk in self._risks.values()
                if risk.residual_risk > self._risk_appetite
            ]
    
    def _generate_risk_id(self) -> str:
        data = f"risk-{time.time_ns()}"
        return "RISK-" + hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _generate_treatment_id(self) -> str:
        data = f"treatment-{time.time_ns()}"
        return "TRT-" + hashlib.sha256(data.encode()).hexdigest()[:16]


class AccessControlPolicy:
    """ISO 27001 A.9 Access Control"""
    
    def __init__(self):
        self._policies: Dict[str, AccessPolicy] = {}
        self._roles: Dict[str, Role] = {}
        self._permissions: Dict[str, Dict[str, Any]] = {}
        self._assignments: Dict[str, List[str]] = {}  # user -> roles
        self._lock = threading.RLock()
        
        self._initialize_default_roles()
    
    def _initialize_default_roles(self) -> None:
        """Create default security roles"""
        default_roles = [
            Role(
                id="super_admin",
                name="Super Administrator",
                description="Full system access",
                permissions=["*"]
            ),
            Role(
                id="security_admin",
                name="Security Administrator",
                description="Security configuration and audit access",
                permissions=["security:*", "audit:read", "users:read", "roles:*"]
            ),
            Role(
                id="compliance_officer",
                name="Compliance Officer",
                description="Compliance monitoring and reporting",
                permissions=["audit:read", "compliance:*", "reports:read", "risks:read"]
            ),
            Role(
                id="operations",
                name="Operations",
                description="Day-to-day operations",
                permissions=["transactions:read", "settlements:read", "participants:read", "monitoring:read"]
            ),
            Role(
                id="read_only",
                name="Read Only",
                description="Read-only access to non-sensitive data",
                permissions=["dashboard:read", "reports:read"]
            )
        ]
        
        for role in default_roles:
            role.created_at = datetime.utcnow()
            self._roles[role.id] = role
    
    def assign_role(self, user_id: str, role_id: str) -> None:
        """Assign a role to a user"""
        with self._lock:
            if role_id not in self._roles:
                raise ValueError(f"Role not found: {role_id}")
            
            if user_id not in self._assignments:
                self._assignments[user_id] = []
            
            if role_id not in self._assignments[user_id]:
                self._assignments[user_id].append(role_id)
    
    def revoke_role(self, user_id: str, role_id: str) -> None:
        """Revoke a role from a user"""
        with self._lock:
            if user_id in self._assignments and role_id in self._assignments[user_id]:
                self._assignments[user_id].remove(role_id)
    
    def check_access(self, user_id: str, resource: str, action: str) -> tuple:
        """Check if a user has access to a resource"""
        with self._lock:
            roles = self._assignments.get(user_id, [])
            if not roles:
                return False, "no roles assigned"
            
            for role_id in roles:
                role = self._roles.get(role_id)
                if not role:
                    continue
                
                for perm in role.permissions:
                    if perm == "*" or self._match_permission(perm, resource, action):
                        return True, f"allowed by role: {role_id}"
            
            return False, "no matching permission"
    
    def _match_permission(self, permission: str, resource: str, action: str) -> bool:
        """Check if a permission matches resource:action"""
        if permission == f"{resource}:{action}":
            return True
        if permission == f"{resource}:*":
            return True
        return False
    
    def get_user_roles(self, user_id: str) -> List[Role]:
        """Get roles assigned to a user"""
        with self._lock:
            role_ids = self._assignments.get(user_id, [])
            return [self._roles[rid] for rid in role_ids if rid in self._roles]


class ComplianceAuditLogger:
    """ISO 27001 A.12.4 Logging"""
    
    def __init__(self, retention_days: int = 2555):
        self._events: List[ComplianceAuditEvent] = []
        self._retention_days = retention_days
        self._lock = threading.RLock()
    
    def log_event(self, event: ComplianceAuditEvent) -> str:
        """Log a compliance audit event"""
        with self._lock:
            event.id = self._generate_audit_id()
            event.timestamp = datetime.utcnow()
            
            # Get previous hash for chain integrity
            if self._events:
                event.previous_hash = self._events[-1].hash
            else:
                event.previous_hash = "genesis"
            
            # Compute hash
            event.hash = self._compute_event_hash(event)
            
            self._events.append(event)
            return event.id
    
    def log_access_event(
        self,
        actor_id: str,
        actor_ip: str,
        resource: str,
        action: str,
        outcome: str
    ) -> str:
        """Log an access control event"""
        return self.log_event(ComplianceAuditEvent(
            event_type="access",
            category="access",
            severity="warning" if outcome == "failure" else "info",
            actor_id=actor_id,
            actor_type="user",
            actor_ip=actor_ip,
            action=action,
            resource=resource,
            outcome=outcome,
            control_ref="A.9.4"
        ))
    
    def log_change_event(
        self,
        actor_id: str,
        resource: str,
        previous_state: Any,
        new_state: Any,
        justification: str = ""
    ) -> str:
        """Log a configuration change event"""
        return self.log_event(ComplianceAuditEvent(
            event_type="change",
            category="change",
            severity="warning",
            actor_id=actor_id,
            actor_type="user",
            action="modify",
            resource=resource,
            outcome="success",
            previous_state=previous_state,
            new_state=new_state,
            justification=justification,
            control_ref="A.12.1"
        ))
    
    def log_security_event(
        self,
        event_type: str,
        severity: str,
        details: Dict[str, Any]
    ) -> str:
        """Log a security event"""
        return self.log_event(ComplianceAuditEvent(
            event_type=event_type,
            category="security",
            severity=severity,
            actor_type="system",
            action=event_type,
            outcome="detected",
            details=details,
            control_ref="A.16.1"
        ))
    
    def get_events(
        self,
        start_time: datetime,
        end_time: datetime,
        category: str = "",
        severity: str = "",
        limit: int = 0
    ) -> List[ComplianceAuditEvent]:
        """Get audit events with filters"""
        with self._lock:
            filtered = []
            
            for event in self._events:
                if event.timestamp < start_time or event.timestamp > end_time:
                    continue
                if category and event.category != category:
                    continue
                if severity and event.severity != severity:
                    continue
                
                filtered.append(event)
                
                if limit > 0 and len(filtered) >= limit:
                    break
            
            return filtered
    
    def verify_integrity(self) -> tuple:
        """Verify the integrity of the audit log chain"""
        with self._lock:
            issues = []
            
            for i, event in enumerate(self._events):
                # Verify hash
                computed_hash = self._compute_event_hash(event)
                if computed_hash != event.hash:
                    issues.append(f"hash mismatch at event {event.id}")
                
                # Verify chain
                if i > 0:
                    if event.previous_hash != self._events[i - 1].hash:
                        issues.append(f"chain broken at event {event.id}")
            
            return len(issues) == 0, issues
    
    def _generate_audit_id(self) -> str:
        data = f"audit-{time.time_ns()}"
        return "AUD-" + hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _compute_event_hash(self, event: ComplianceAuditEvent) -> str:
        data = f"{event.timestamp.isoformat()}:{event.event_type}:{event.actor_id}:{event.action}:{event.resource}:{event.outcome}:{event.previous_hash}"
        return hashlib.sha256(data.encode()).hexdigest()


class IncidentResponseManager:
    """ISO 27001 A.16 Incident Management"""
    
    def __init__(self, sla_minutes: int = 60):
        self._incidents: Dict[str, SecurityIncident] = {}
        self._sla_minutes = sla_minutes
        self._lock = threading.RLock()
    
    def report_incident(self, incident: SecurityIncident) -> str:
        """Report a new security incident"""
        with self._lock:
            incident.id = self._generate_incident_id()
            incident.status = IncidentStatus.OPEN
            incident.reported_at = datetime.utcnow()
            if not incident.detected_at:
                incident.detected_at = datetime.utcnow()
            
            self._incidents[incident.id] = incident
            return incident.id
    
    def acknowledge_incident(self, incident_id: str, assignee: str) -> None:
        """Acknowledge an incident"""
        with self._lock:
            if incident_id not in self._incidents:
                raise ValueError(f"Incident not found: {incident_id}")
            
            incident = self._incidents[incident_id]
            incident.acknowledged_at = datetime.utcnow()
            incident.assignee = assignee
            incident.status = IncidentStatus.INVESTIGATING
    
    def add_action(self, incident_id: str, action: Dict[str, Any]) -> None:
        """Add an action to an incident"""
        with self._lock:
            if incident_id not in self._incidents:
                raise ValueError(f"Incident not found: {incident_id}")
            
            action["id"] = self._generate_action_id()
            action["performed_at"] = datetime.utcnow().isoformat()
            
            self._incidents[incident_id].actions.append(action)
    
    def contain_incident(self, incident_id: str) -> None:
        """Mark an incident as contained"""
        with self._lock:
            if incident_id not in self._incidents:
                raise ValueError(f"Incident not found: {incident_id}")
            
            incident = self._incidents[incident_id]
            incident.contained_at = datetime.utcnow()
            incident.status = IncidentStatus.CONTAINED
    
    def resolve_incident(
        self,
        incident_id: str,
        root_cause: str,
        lessons_learned: str
    ) -> None:
        """Resolve an incident"""
        with self._lock:
            if incident_id not in self._incidents:
                raise ValueError(f"Incident not found: {incident_id}")
            
            incident = self._incidents[incident_id]
            incident.resolved_at = datetime.utcnow()
            incident.status = IncidentStatus.RESOLVED
            incident.root_cause = root_cause
            incident.lessons_learned = lessons_learned
    
    def get_open_incidents(self) -> List[SecurityIncident]:
        """Get all open incidents"""
        with self._lock:
            return [
                incident for incident in self._incidents.values()
                if incident.status not in [IncidentStatus.CLOSED, IncidentStatus.RESOLVED]
            ]
    
    def get_sla_breaches(self) -> List[SecurityIncident]:
        """Get incidents that breached SLA"""
        with self._lock:
            breaches = []
            sla = timedelta(minutes=self._sla_minutes)
            
            for incident in self._incidents.values():
                if incident.acknowledged_at is None:
                    if datetime.utcnow() - incident.reported_at > sla:
                        breaches.append(incident)
                else:
                    if incident.acknowledged_at - incident.reported_at > sla:
                        breaches.append(incident)
            
            return breaches
    
    def _generate_incident_id(self) -> str:
        data = f"incident-{time.time_ns()}"
        return "INC-" + hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _generate_action_id(self) -> str:
        data = f"action-{time.time_ns()}"
        return "ACT-" + hashlib.sha256(data.encode()).hexdigest()[:16]


class AssetInventory:
    """ISO 27001 A.8 Asset Management"""
    
    def __init__(self):
        self._assets: Dict[str, Asset] = {}
        self._lock = threading.RLock()
    
    def register_asset(self, asset: Asset) -> str:
        """Register a new asset"""
        with self._lock:
            asset.id = self._generate_asset_id()
            asset.status = "active"
            asset.acquired_at = datetime.utcnow()
            asset.review_date = datetime.utcnow() + timedelta(days=90)
            
            self._assets[asset.id] = asset
            return asset.id
    
    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """Get an asset by ID"""
        with self._lock:
            return self._assets.get(asset_id)
    
    def get_assets_by_classification(self, classification: AssetClassification) -> List[Asset]:
        """Get assets by classification"""
        with self._lock:
            return [
                asset for asset in self._assets.values()
                if asset.classification == classification
            ]
    
    def get_assets_needing_review(self) -> List[Asset]:
        """Get assets needing review"""
        with self._lock:
            now = datetime.utcnow()
            return [
                asset for asset in self._assets.values()
                if asset.review_date < now
            ]
    
    def _generate_asset_id(self) -> str:
        data = f"asset-{time.time_ns()}"
        return "AST-" + hashlib.sha256(data.encode()).hexdigest()[:16]


class CryptographyPolicy:
    """ISO 27001 A.10 Cryptographic Controls"""
    
    def __init__(self):
        self._algorithms: Dict[str, CryptoAlgorithm] = {}
        self._key_inventory: Dict[str, CryptoKey] = {}
        self._lock = threading.RLock()
        
        self._initialize_approved_algorithms()
    
    def _initialize_approved_algorithms(self) -> None:
        """Set up approved cryptographic algorithms"""
        approved = [
            CryptoAlgorithm(
                id="aes-256-gcm",
                name="AES-256-GCM",
                type="symmetric",
                key_sizes=[256],
                approved=True,
                use_cases=["data_encryption", "file_encryption"]
            ),
            CryptoAlgorithm(
                id="rsa-4096",
                name="RSA-4096",
                type="asymmetric",
                key_sizes=[4096],
                approved=True,
                use_cases=["key_exchange", "digital_signature"]
            ),
            CryptoAlgorithm(
                id="ecdsa-p384",
                name="ECDSA P-384",
                type="asymmetric",
                key_sizes=[384],
                approved=True,
                use_cases=["digital_signature", "authentication"]
            ),
            CryptoAlgorithm(
                id="sha-256",
                name="SHA-256",
                type="hash",
                key_sizes=[256],
                approved=True,
                use_cases=["integrity", "password_hashing"]
            ),
            CryptoAlgorithm(
                id="sha-384",
                name="SHA-384",
                type="hash",
                key_sizes=[384],
                approved=True,
                use_cases=["integrity", "digital_signature"]
            ),
            CryptoAlgorithm(
                id="argon2id",
                name="Argon2id",
                type="kdf",
                key_sizes=[256],
                approved=True,
                use_cases=["password_hashing", "key_derivation"]
            ),
            # Deprecated algorithms
            CryptoAlgorithm(
                id="sha-1",
                name="SHA-1",
                type="hash",
                key_sizes=[160],
                approved=False,
                deprecated=True,
                use_cases=[]
            ),
            CryptoAlgorithm(
                id="md5",
                name="MD5",
                type="hash",
                key_sizes=[128],
                approved=False,
                deprecated=True,
                use_cases=[]
            )
        ]
        
        for algo in approved:
            self._algorithms[algo.id] = algo
    
    def is_algorithm_approved(self, algorithm_id: str) -> bool:
        """Check if an algorithm is approved"""
        with self._lock:
            algo = self._algorithms.get(algorithm_id)
            if not algo:
                return False
            return algo.approved and not algo.deprecated
    
    def register_key(self, key: CryptoKey) -> str:
        """Register a cryptographic key"""
        with self._lock:
            # Validate algorithm
            algo = self._algorithms.get(key.algorithm)
            if not algo:
                raise ValueError(f"Unknown algorithm: {key.algorithm}")
            if not algo.approved:
                raise ValueError(f"Algorithm not approved: {key.algorithm}")
            
            key.id = self._generate_key_id()
            key.status = "active"
            key.created_at = datetime.utcnow()
            
            self._key_inventory[key.id] = key
            return key.id
    
    def get_expiring_keys(self, within: timedelta) -> List[CryptoKey]:
        """Get keys expiring within the given duration"""
        with self._lock:
            threshold = datetime.utcnow() + within
            return [
                key for key in self._key_inventory.values()
                if key.status == "active" and key.expires_at < threshold
            ]
    
    def _generate_key_id(self) -> str:
        data = f"key-{time.time_ns()}"
        return "KEY-" + hashlib.sha256(data.encode()).hexdigest()[:16]


class ISO27001ControlFramework:
    """
    ISO 27001 Information Security Management System
    
    Implements controls for:
    - A.6: Risk Assessment
    - A.8: Asset Management
    - A.9: Access Control
    - A.10: Cryptography
    - A.12.4: Logging and Monitoring
    - A.16: Incident Management
    """
    
    def __init__(self, config: Optional[ISO27001Config] = None):
        self._config = config or ISO27001Config()
        
        self.risk_assessment = RiskAssessmentFramework(self._config.risk_appetite)
        self.access_control = AccessControlPolicy()
        self.audit_logger = ComplianceAuditLogger(self._config.audit_retention_days)
        self.incident_response = IncidentResponseManager(self._config.incident_sla_minutes)
        self.asset_inventory = AssetInventory()
        self.crypto_policy = CryptographyPolicy()
    
    def generate_soa(self) -> List[ControlApplicability]:
        """Generate Statement of Applicability"""
        return [
            ControlApplicability(
                control_id="A.5.1",
                control_name="Policies for information security",
                applicable=True,
                implemented=True,
                justification="Security policies defined and enforced"
            ),
            ControlApplicability(
                control_id="A.6.1",
                control_name="Internal organization",
                applicable=True,
                implemented=True,
                justification="Security roles and responsibilities defined"
            ),
            ControlApplicability(
                control_id="A.7.1",
                control_name="Prior to employment",
                applicable=True,
                implemented=True,
                justification="Background checks and security awareness"
            ),
            ControlApplicability(
                control_id="A.8.1",
                control_name="Responsibility for assets",
                applicable=True,
                implemented=True,
                justification="Asset inventory maintained"
            ),
            ControlApplicability(
                control_id="A.9.1",
                control_name="Business requirements of access control",
                applicable=True,
                implemented=True,
                justification="RBAC implemented via Permify"
            ),
            ControlApplicability(
                control_id="A.9.2",
                control_name="User access management",
                applicable=True,
                implemented=True,
                justification="User provisioning via Keycloak"
            ),
            ControlApplicability(
                control_id="A.9.4",
                control_name="System and application access control",
                applicable=True,
                implemented=True,
                justification="Zero Trust enforcement"
            ),
            ControlApplicability(
                control_id="A.10.1",
                control_name="Cryptographic controls",
                applicable=True,
                implemented=True,
                justification="TLS 1.3, AES-256-GCM encryption"
            ),
            ControlApplicability(
                control_id="A.12.1",
                control_name="Operational procedures and responsibilities",
                applicable=True,
                implemented=True,
                justification="Runbooks and procedures documented"
            ),
            ControlApplicability(
                control_id="A.12.4",
                control_name="Logging and monitoring",
                applicable=True,
                implemented=True,
                justification="Comprehensive audit logging"
            ),
            ControlApplicability(
                control_id="A.13.1",
                control_name="Network security management",
                applicable=True,
                implemented=True,
                justification="Network policies and micro-segmentation"
            ),
            ControlApplicability(
                control_id="A.14.1",
                control_name="Security requirements of information systems",
                applicable=True,
                implemented=True,
                justification="Secure SDLC practices"
            ),
            ControlApplicability(
                control_id="A.16.1",
                control_name="Management of information security incidents",
                applicable=True,
                implemented=True,
                justification="Incident response procedures"
            ),
            ControlApplicability(
                control_id="A.17.1",
                control_name="Information security continuity",
                applicable=True,
                implemented=True,
                justification="DR and BCP implemented"
            ),
            ControlApplicability(
                control_id="A.18.1",
                control_name="Compliance with legal and contractual requirements",
                applicable=True,
                implemented=True,
                justification="Regulatory compliance monitoring"
            )
        ]
    
    def generate_compliance_report(self) -> Dict[str, Any]:
        """Generate a compliance report"""
        soa = self.generate_soa()
        
        implemented = sum(1 for c in soa if c.implemented)
        not_implemented = len(soa) - implemented
        
        return {
            "organization": self._config.organization_name,
            "scope": self._config.isms_scope,
            "generated_at": datetime.utcnow().isoformat(),
            "total_controls": len(soa),
            "implemented": implemented,
            "not_implemented": not_implemented,
            "compliance_rate": (implemented / len(soa)) * 100 if soa else 0,
            "risks_above_appetite": len(self.risk_assessment.get_risks_above_appetite()),
            "open_incidents": len(self.incident_response.get_open_incidents()),
            "sla_breaches": len(self.incident_response.get_sla_breaches()),
            "assets_needing_review": len(self.asset_inventory.get_assets_needing_review()),
            "expiring_keys": len(self.crypto_policy.get_expiring_keys(timedelta(days=30)))
        }
