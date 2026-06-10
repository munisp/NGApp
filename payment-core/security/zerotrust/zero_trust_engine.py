"""
Zero Trust Architecture Implementation for PayGate
Implements identity verification, least privilege, micro-segmentation,
continuous validation, and device trust scoring.
"""

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
from functools import wraps
import threading


class TrustDecision(Enum):
    """Access decision types"""
    ALLOW = "allow"
    DENY = "deny"
    STEP_UP = "step_up"


class RiskLevel(Enum):
    """Risk levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Subject:
    """Represents the entity requesting access"""
    id: str
    type: str  # user, service, device
    email: Optional[str] = None
    roles: List[str] = field(default_factory=list)
    groups: List[str] = field(default_factory=list)
    attributes: Dict[str, str] = field(default_factory=dict)
    auth_method: str = ""
    auth_time: datetime = field(default_factory=datetime.utcnow)
    mfa_verified: bool = False
    session_id: str = ""


@dataclass
class Resource:
    """Represents the resource being accessed"""
    type: str
    id: str
    owner: str = ""
    namespace: str = ""
    attributes: Dict[str, str] = field(default_factory=dict)
    sensitivity: str = "internal"  # public, internal, confidential, restricted


@dataclass
class AccessContext:
    """Contextual information for access decisions"""
    ip_address: str = ""
    user_agent: str = ""
    device_id: str = ""
    device_type: str = ""  # managed, byod, unknown
    geo_country: str = ""
    geo_city: str = ""
    network_zone: str = ""  # public, dmz, internal, corporate
    risk_signals: List[Dict[str, Any]] = field(default_factory=list)
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class AccessRequest:
    """Represents a request for resource access"""
    request_id: str
    subject: Subject
    resource: Resource
    action: str
    context: AccessContext
    timestamp: datetime = field(default_factory=datetime.utcnow)
    justification: str = ""


@dataclass
class StepUpRequirement:
    """Specifies additional authentication needed"""
    type: str  # mfa, reauthenticate, approval
    methods: List[str] = field(default_factory=list)
    reason: str = ""
    expires_in: timedelta = field(default_factory=lambda: timedelta(minutes=5))


@dataclass
class AccessDecision:
    """Result of an access request evaluation"""
    request_id: str
    decision: TrustDecision
    reason: str
    conditions: List[str] = field(default_factory=list)
    step_up_required: Optional[StepUpRequirement] = None
    valid_until: datetime = field(default_factory=datetime.utcnow)
    audit_id: str = ""
    policy_matched: str = ""
    trust_score: float = 0.0
    risk_score: float = 0.0


class ZeroTrustConfig:
    """Configuration for Zero Trust engine"""
    
    def __init__(
        self,
        require_mfa: bool = True,
        mfa_grace_period: timedelta = timedelta(minutes=5),
        token_max_age: timedelta = timedelta(minutes=15),
        session_timeout: timedelta = timedelta(minutes=30),
        min_device_trust_score: float = 0.7,
        require_device_attestation: bool = False,
        default_deny: bool = True,
        require_justification: bool = False,
        revalidation_interval: timedelta = timedelta(minutes=5),
        anomaly_threshold: float = 0.8
    ):
        self.require_mfa = require_mfa
        self.mfa_grace_period = mfa_grace_period
        self.token_max_age = token_max_age
        self.session_timeout = session_timeout
        self.min_device_trust_score = min_device_trust_score
        self.require_device_attestation = require_device_attestation
        self.default_deny = default_deny
        self.require_justification = require_justification
        self.revalidation_interval = revalidation_interval
        self.anomaly_threshold = anomaly_threshold


class PolicyDecisionPoint:
    """Evaluates access policies"""
    
    def __init__(self):
        self._policies: List[Dict[str, Any]] = []
        self._lock = threading.RLock()
        
        # Add default deny policy
        self.add_policy({
            "id": "default-deny",
            "name": "Default Deny",
            "priority": 1000,
            "effect": "deny"
        })
    
    def add_policy(self, policy: Dict[str, Any]) -> None:
        """Add a new policy"""
        with self._lock:
            self._policies.append(policy)
            # Sort by priority
            self._policies.sort(key=lambda p: p.get("priority", 0))
    
    def evaluate(self, request: AccessRequest) -> Dict[str, Any]:
        """Evaluate policies for an access request"""
        with self._lock:
            for policy in self._policies:
                if self._matches_policy(policy, request):
                    return {
                        "decision": policy.get("effect", "deny"),
                        "policy_id": policy.get("id", "unknown"),
                        "reason": f"matched policy: {policy.get('name', 'unknown')}"
                    }
            
            return {
                "decision": "deny",
                "policy_id": "default-deny",
                "reason": "no matching policy"
            }
    
    def _matches_policy(self, policy: Dict[str, Any], request: AccessRequest) -> bool:
        """Check if request matches policy"""
        # Check subjects
        subjects = policy.get("subjects", [])
        if subjects:
            matched = False
            for pattern in subjects:
                if self._match_pattern(pattern, request.subject.id) or \
                   any(self._match_pattern(pattern, role) for role in request.subject.roles):
                    matched = True
                    break
            if not matched:
                return False
        
        # Check resources
        resources = policy.get("resources", [])
        if resources:
            matched = False
            resource_path = f"{request.resource.type}/{request.resource.id}"
            for pattern in resources:
                if self._match_pattern(pattern, resource_path):
                    matched = True
                    break
            if not matched:
                return False
        
        # Check actions
        actions = policy.get("actions", [])
        if actions:
            matched = False
            for action in actions:
                if action == "*" or action == request.action:
                    matched = True
                    break
            if not matched:
                return False
        
        return True
    
    def _match_pattern(self, pattern: str, value: str) -> bool:
        """Match a pattern against a value"""
        if pattern == "*":
            return True
        if pattern.endswith("*"):
            return value.startswith(pattern[:-1])
        return pattern == value


class DeviceTrustScorer:
    """Scores device trust"""
    
    def __init__(self):
        self._known_devices: Dict[str, float] = {}
        self._lock = threading.RLock()
    
    def register_device(self, device_id: str, trust_score: float) -> None:
        """Register a known device"""
        with self._lock:
            self._known_devices[device_id] = trust_score
    
    def score(self, context: AccessContext) -> float:
        """Calculate device trust score"""
        score = 0.5  # Base score
        
        # Check if device is known
        with self._lock:
            if context.device_id in self._known_devices:
                score = self._known_devices[context.device_id]
        
        # Adjust based on device type
        device_type_scores = {
            "managed": 0.3,
            "byod": 0.1,
            "unknown": -0.2
        }
        score += device_type_scores.get(context.device_type, 0)
        
        # Adjust based on network zone
        network_zone_scores = {
            "corporate": 0.2,
            "vpn": 0.1,
            "internal": 0.05,
            "public": -0.1
        }
        score += network_zone_scores.get(context.network_zone, 0)
        
        # Clamp score
        return max(0.0, min(1.0, score))


class MicroSegmentation:
    """Manages network micro-segmentation"""
    
    def __init__(self):
        self._rules: Dict[str, List[str]] = {
            "public": ["dmz"],
            "dmz": ["internal"],
            "internal": ["internal", "data"],
            "corporate": ["internal", "data", "admin"],
            "admin": ["*"]
        }
        self._lock = threading.RLock()
    
    def add_rule(self, source_zone: str, dest_zones: List[str]) -> None:
        """Add a segmentation rule"""
        with self._lock:
            self._rules[source_zone] = dest_zones
    
    def is_allowed(self, source_zone: str, dest_namespace: str) -> bool:
        """Check if access between zones is allowed"""
        with self._lock:
            allowed_zones = self._rules.get(source_zone, [])
            return "*" in allowed_zones or dest_namespace in allowed_zones


class ContinuousValidator:
    """Performs continuous session validation"""
    
    def __init__(self, interval: timedelta):
        self._interval = interval
        self._validations: Dict[str, datetime] = {}
        self._lock = threading.RLock()
    
    def validate(self, session_id: str) -> None:
        """Mark a session as validated"""
        with self._lock:
            self._validations[session_id] = datetime.utcnow()
    
    def is_valid(self, session_id: str) -> bool:
        """Check if session validation is current"""
        with self._lock:
            last_validation = self._validations.get(session_id)
            if last_validation is None:
                return True  # First access, allow
            
            return datetime.utcnow() - last_validation < self._interval


class IdentityVerifier:
    """Verifies subject identity"""
    
    def __init__(self, config: ZeroTrustConfig):
        self._config = config
    
    def verify(self, subject: Subject) -> Dict[str, Any]:
        """Verify subject identity"""
        # Check subject ID
        if not subject.id:
            return {"valid": False, "reason": "missing subject ID"}
        
        # Check authentication time
        if datetime.utcnow() - subject.auth_time > self._config.token_max_age:
            return {"valid": False, "reason": "authentication expired"}
        
        # Check session
        if not subject.session_id:
            return {"valid": False, "reason": "missing session"}
        
        return {"valid": True, "reason": ""}


class ZeroTrustEngine:
    """
    Zero Trust Architecture Engine
    
    Implements:
    - Identity verification at every access point
    - Least privilege access via policy decision point
    - Micro-segmentation for network isolation
    - Continuous validation of sessions
    - Device trust scoring
    """
    
    def __init__(
        self,
        config: Optional[ZeroTrustConfig] = None,
        audit_logger: Optional[Callable] = None
    ):
        self._config = config or ZeroTrustConfig()
        self._audit_logger = audit_logger
        
        self._pdp = PolicyDecisionPoint()
        self._device_trust = DeviceTrustScorer()
        self._segmentation = MicroSegmentation()
        self._validator = ContinuousValidator(self._config.revalidation_interval)
        self._identity = IdentityVerifier(self._config)
        
        self._lock = threading.RLock()
    
    def evaluate(self, request: AccessRequest) -> AccessDecision:
        """Evaluate an access request and return a decision"""
        with self._lock:
            # Step 1: Verify identity
            identity_result = self._identity.verify(request.subject)
            if not identity_result["valid"]:
                return self._deny_access(
                    request, 
                    "identity_verification_failed", 
                    identity_result["reason"]
                )
            
            # Step 2: Check MFA if required
            if self._config.require_mfa and not request.subject.mfa_verified:
                if datetime.utcnow() - request.subject.auth_time > self._config.mfa_grace_period:
                    return self._step_up_required(
                        request,
                        "mfa_required",
                        ["totp", "webauthn", "sms"]
                    )
            
            # Step 3: Evaluate device trust
            device_score = self._device_trust.score(request.context)
            if device_score < self._config.min_device_trust_score:
                return self._deny_access(
                    request,
                    "device_trust_insufficient",
                    f"device trust score {device_score:.2f} below threshold {self._config.min_device_trust_score:.2f}"
                )
            
            # Step 4: Check micro-segmentation rules
            if not self._segmentation.is_allowed(
                request.context.network_zone,
                request.resource.namespace
            ):
                return self._deny_access(
                    request,
                    "network_segment_denied",
                    f"access from {request.context.network_zone} to {request.resource.namespace} not allowed"
                )
            
            # Step 5: Evaluate access policy
            policy_decision = self._pdp.evaluate(request)
            if policy_decision["decision"] == "deny":
                return self._deny_access(
                    request,
                    policy_decision["policy_id"],
                    policy_decision["reason"]
                )
            
            # Step 6: Calculate risk score
            risk_score = self._calculate_risk_score(request, device_score)
            if risk_score > self._config.anomaly_threshold:
                return self._step_up_required(
                    request,
                    "high_risk_detected",
                    ["reauthenticate", "approval"]
                )
            
            # Step 7: Check continuous validation
            if not self._validator.is_valid(request.subject.session_id):
                return self._step_up_required(
                    request,
                    "session_revalidation_required",
                    ["reauthenticate"]
                )
            
            # Access granted
            decision = AccessDecision(
                request_id=request.request_id,
                decision=TrustDecision.ALLOW,
                reason="all_checks_passed",
                valid_until=datetime.utcnow() + self._config.token_max_age,
                policy_matched=policy_decision["policy_id"],
                trust_score=device_score,
                risk_score=risk_score
            )
            
            # Log the decision
            if self._audit_logger:
                decision.audit_id = self._generate_audit_id(request)
                self._audit_logger(request, decision)
            
            return decision
    
    def _deny_access(self, request: AccessRequest, reason: str, details: str) -> AccessDecision:
        """Create a deny decision"""
        decision = AccessDecision(
            request_id=request.request_id,
            decision=TrustDecision.DENY,
            reason=f"{reason}: {details}",
            valid_until=datetime.utcnow(),
            trust_score=0.0,
            risk_score=1.0
        )
        
        if self._audit_logger:
            decision.audit_id = self._generate_audit_id(request)
            self._audit_logger(request, decision)
        
        return decision
    
    def _step_up_required(
        self, 
        request: AccessRequest, 
        reason: str, 
        methods: List[str]
    ) -> AccessDecision:
        """Create a step-up authentication decision"""
        decision = AccessDecision(
            request_id=request.request_id,
            decision=TrustDecision.STEP_UP,
            reason=reason,
            step_up_required=StepUpRequirement(
                type="mfa",
                methods=methods,
                reason=reason,
                expires_in=timedelta(minutes=5)
            ),
            valid_until=datetime.utcnow()
        )
        
        if self._audit_logger:
            decision.audit_id = self._generate_audit_id(request)
            self._audit_logger(request, decision)
        
        return decision
    
    def _calculate_risk_score(self, request: AccessRequest, device_score: float) -> float:
        """Calculate overall risk score"""
        risk_score = 0.0
        
        # Base risk from device trust (inverse)
        risk_score += (1 - device_score) * 0.3
        
        # Risk from authentication age
        auth_age = datetime.utcnow() - request.subject.auth_time
        if auth_age > timedelta(hours=1):
            risk_score += 0.2
        elif auth_age > timedelta(minutes=30):
            risk_score += 0.1
        
        # Risk from resource sensitivity
        sensitivity_scores = {
            "restricted": 0.2,
            "confidential": 0.1,
            "internal": 0.05,
            "public": 0.0
        }
        risk_score += sensitivity_scores.get(request.resource.sensitivity, 0)
        
        # Risk from context signals
        for signal in request.context.risk_signals:
            risk_score += signal.get("score", 0) * 0.1
        
        # Cap at 1.0
        return min(1.0, risk_score)
    
    def _generate_audit_id(self, request: AccessRequest) -> str:
        """Generate a unique audit ID"""
        data = f"{request.request_id}:{request.subject.id}:{request.resource.id}:{time.time_ns()}"
        hash_obj = hashlib.sha256(data.encode())
        return hash_obj.hexdigest()[:32]
    
    def add_policy(self, policy: Dict[str, Any]) -> None:
        """Add an access policy"""
        self._pdp.add_policy(policy)
    
    def register_device(self, device_id: str, trust_score: float) -> None:
        """Register a known device"""
        self._device_trust.register_device(device_id, trust_score)
    
    def add_segmentation_rule(self, source_zone: str, dest_zones: List[str]) -> None:
        """Add a micro-segmentation rule"""
        self._segmentation.add_rule(source_zone, dest_zones)
    
    def validate_session(self, session_id: str) -> None:
        """Mark a session as validated"""
        self._validator.validate(session_id)


def zero_trust_required(engine: ZeroTrustEngine):
    """
    Decorator for Zero Trust enforcement on functions
    
    Usage:
        @zero_trust_required(engine)
        def sensitive_operation(request: AccessRequest):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(request: AccessRequest, *args, **kwargs):
            decision = engine.evaluate(request)
            
            if decision.decision == TrustDecision.DENY:
                raise PermissionError(f"Access denied: {decision.reason}")
            
            if decision.decision == TrustDecision.STEP_UP:
                raise PermissionError(
                    f"Step-up authentication required: {decision.reason}"
                )
            
            return func(request, *args, **kwargs)
        
        return wrapper
    return decorator


# FastAPI middleware integration
class ZeroTrustMiddleware:
    """
    FastAPI/Starlette middleware for Zero Trust enforcement
    """
    
    def __init__(self, app, engine: ZeroTrustEngine):
        self.app = app
        self.engine = engine
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Extract request information
        headers = dict(scope.get("headers", []))
        
        # Build access request
        request = AccessRequest(
            request_id=headers.get(b"x-request-id", b"").decode() or str(uuid.uuid4()),
            subject=Subject(
                id=headers.get(b"x-user-id", b"").decode(),
                type="user",
                email=headers.get(b"x-user-email", b"").decode(),
                roles=headers.get(b"x-user-roles", b"").decode().split(","),
                auth_method=headers.get(b"x-auth-method", b"").decode(),
                mfa_verified=headers.get(b"x-mfa-verified", b"").decode() == "true",
                session_id=headers.get(b"x-session-id", b"").decode()
            ),
            resource=Resource(
                type=scope["path"].split("/")[1] if len(scope["path"].split("/")) > 1 else "unknown",
                id=scope["path"].split("/")[2] if len(scope["path"].split("/")) > 2 else "",
                namespace=headers.get(b"x-namespace", b"").decode()
            ),
            action=scope["method"],
            context=AccessContext(
                ip_address=scope.get("client", ("", 0))[0],
                user_agent=headers.get(b"user-agent", b"").decode(),
                device_id=headers.get(b"x-device-id", b"").decode(),
                device_type=headers.get(b"x-device-type", b"").decode(),
                network_zone=headers.get(b"x-network-zone", b"").decode()
            )
        )
        
        # Evaluate access
        decision = self.engine.evaluate(request)
        
        if decision.decision == TrustDecision.DENY:
            response_headers = [
                (b"content-type", b"application/json"),
                (b"x-zerotrust-reason", decision.reason.encode())
            ]
            await send({
                "type": "http.response.start",
                "status": 403,
                "headers": response_headers
            })
            await send({
                "type": "http.response.body",
                "body": json.dumps({"error": "Access denied", "reason": decision.reason}).encode()
            })
            return
        
        if decision.decision == TrustDecision.STEP_UP:
            response_headers = [
                (b"content-type", b"application/json"),
                (b"x-zerotrust-stepup", decision.step_up_required.type.encode()),
                (b"x-zerotrust-methods", ",".join(decision.step_up_required.methods).encode())
            ]
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": response_headers
            })
            await send({
                "type": "http.response.body",
                "body": json.dumps({
                    "error": "Step-up authentication required",
                    "reason": decision.reason,
                    "methods": decision.step_up_required.methods
                }).encode()
            })
            return
        
        # Access granted, continue to app
        await self.app(scope, receive, send)
