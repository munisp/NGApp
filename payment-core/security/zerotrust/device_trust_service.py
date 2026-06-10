"""
Device Trust Service for Zero Trust Architecture
Provides comprehensive device trust scoring and attestation verification.
"""

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol
import threading
import json


class TrustLevel(Enum):
    """Device trust levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNTRUSTED = "untrusted"


class DeviceDecision(Enum):
    """Device trust decisions"""
    ALLOW = "allow"
    STEP_UP = "step_up"
    DENY = "deny"


@dataclass
class DeviceTrustConfig:
    """Configuration for device trust scoring"""
    min_trust_score: float = 0.6
    min_attestation_score: float = 0.7
    attestation_weight: float = 0.3
    compliance_weight: float = 0.25
    behavior_weight: float = 0.25
    history_weight: float = 0.2
    anomaly_threshold: float = 0.8
    step_up_threshold: float = 0.5
    attestation_timeout: timedelta = field(default_factory=lambda: timedelta(seconds=10))
    cache_expiry: timedelta = field(default_factory=lambda: timedelta(minutes=15))


@dataclass
class SecurityPosture:
    """Device security posture"""
    encrypted: bool = False
    pin_enabled: bool = False
    biometric_enabled: bool = False
    jailbroken: bool = False
    rooted_device: bool = False
    debugger_attached: bool = False
    emulator_detected: bool = False


@dataclass
class DeviceContext:
    """Device context information"""
    ip_address: str = ""
    geo_country: str = ""
    geo_city: str = ""
    network_type: str = ""  # wifi, cellular, vpn
    timezone: str = ""
    language: str = ""


@dataclass
class DeviceTrustRequest:
    """Device trust evaluation request"""
    device_id: str
    platform: str  # ios, android, windows, macos, linux
    os_version: str = ""
    app_version: str = ""
    attestation_token: str = ""
    security_posture: SecurityPosture = field(default_factory=SecurityPosture)
    context: DeviceContext = field(default_factory=DeviceContext)


@dataclass
class DeviceRiskSignal:
    """Risk signal for a device"""
    type: str
    severity: str  # low, medium, high, critical
    score: float
    description: str
    detected_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(hours=1))


@dataclass
class DeviceStepUp:
    """Step-up requirements for device"""
    type: str
    methods: List[str] = field(default_factory=list)
    reason: str = ""


@dataclass
class DeviceTrustResponse:
    """Device trust evaluation result"""
    device_id: str
    trust_score: float
    trust_level: TrustLevel
    decision: DeviceDecision
    step_up_required: Optional[DeviceStepUp] = None
    risk_signals: List[DeviceRiskSignal] = field(default_factory=list)
    valid_until: datetime = field(default_factory=datetime.utcnow)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class DeviceProfile:
    """Device security profile"""
    device_id: str
    device_type: str = ""  # managed, byod, unknown
    platform: str = ""
    os_version: str = ""
    app_version: str = ""
    
    # Security posture
    encrypted: bool = False
    pin_enabled: bool = False
    biometric_enabled: bool = False
    jailbroken: bool = False
    rooted_device: bool = False
    
    # Compliance
    mdm_enrolled: bool = False
    compliance_status: str = ""
    last_compliance_check: Optional[datetime] = None
    
    # Attestation
    attestation_token: str = ""
    attestation_time: Optional[datetime] = None
    attestation_valid: bool = False
    
    # Trust scores
    trust_score: float = 0.0
    attestation_score: float = 0.0
    compliance_score: float = 0.0
    behavior_score: float = 0.0
    
    # History
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    access_count: int = 0
    failed_attempts: int = 0
    
    # Metadata
    attributes: Dict[str, str] = field(default_factory=dict)
    risk_signals: List[DeviceRiskSignal] = field(default_factory=list)


class AttestationProvider(Protocol):
    """Protocol for attestation providers"""
    
    def verify(self, token: str, platform: str) -> Dict[str, Any]:
        """Verify attestation token"""
        ...


class PlayIntegrityProvider:
    """Android Play Integrity attestation provider"""
    
    def __init__(self, project_id: str, api_key: str):
        self.project_id = project_id
        self.api_key = api_key
    
    def verify(self, token: str, platform: str) -> Dict[str, Any]:
        """Verify Play Integrity token"""
        # In production, this would call Google Play Integrity API
        return {
            "valid": True,
            "integrity_verdict": "MEETS_DEVICE_INTEGRITY",
            "device_recognized": True,
            "app_recognized": True,
            "details": {"verdict": "MEETS_DEVICE_INTEGRITY"}
        }


class DeviceCheckProvider:
    """iOS DeviceCheck attestation provider"""
    
    def __init__(self, team_id: str, key_id: str, private_key: str):
        self.team_id = team_id
        self.key_id = key_id
        self.private_key = private_key
    
    def verify(self, token: str, platform: str) -> Dict[str, Any]:
        """Verify DeviceCheck token"""
        # In production, this would call Apple DeviceCheck API
        return {
            "valid": True,
            "integrity_verdict": "valid",
            "device_recognized": True,
            "app_recognized": True,
            "details": {"bit0": True, "bit1": False}
        }


class RiskDetector(Protocol):
    """Protocol for risk detectors"""
    
    def detect(self, profile: DeviceProfile, request: DeviceTrustRequest) -> List[DeviceRiskSignal]:
        """Detect risk signals"""
        ...


class JailbreakDetector:
    """Detects jailbroken/rooted devices"""
    
    def detect(self, profile: DeviceProfile, request: DeviceTrustRequest) -> List[DeviceRiskSignal]:
        signals = []
        
        if request.security_posture.jailbroken:
            signals.append(DeviceRiskSignal(
                type="jailbreak_detected",
                severity="critical",
                score=0.9,
                description="Device appears to be jailbroken",
                expires_at=datetime.utcnow() + timedelta(hours=24)
            ))
        
        if request.security_posture.rooted_device:
            signals.append(DeviceRiskSignal(
                type="root_detected",
                severity="critical",
                score=0.9,
                description="Device appears to be rooted",
                expires_at=datetime.utcnow() + timedelta(hours=24)
            ))
        
        return signals


class GeoAnomalyDetector:
    """Detects geographic anomalies"""
    
    def detect(self, profile: DeviceProfile, request: DeviceTrustRequest) -> List[DeviceRiskSignal]:
        signals = []
        
        last_country = profile.attributes.get("last_country", "")
        if last_country and last_country != request.context.geo_country:
            time_since_last = datetime.utcnow() - profile.last_seen
            if time_since_last < timedelta(hours=1):
                signals.append(DeviceRiskSignal(
                    type="impossible_travel",
                    severity="high",
                    score=0.7,
                    description=f"Rapid location change from {last_country} to {request.context.geo_country}",
                    expires_at=datetime.utcnow() + timedelta(hours=1)
                ))
        
        # Update last country
        profile.attributes["last_country"] = request.context.geo_country
        
        return signals


class BehaviorAnomalyDetector:
    """Detects behavioral anomalies"""
    
    def detect(self, profile: DeviceProfile, request: DeviceTrustRequest) -> List[DeviceRiskSignal]:
        signals = []
        
        if profile.failed_attempts > 5:
            signals.append(DeviceRiskSignal(
                type="excessive_failures",
                severity="medium",
                score=0.5,
                description=f"Device has {profile.failed_attempts} failed access attempts",
                expires_at=datetime.utcnow() + timedelta(hours=1)
            ))
        
        return signals


class RiskSignalAggregator:
    """Aggregates risk signals from multiple detectors"""
    
    def __init__(self):
        self.detectors: List[RiskDetector] = [
            JailbreakDetector(),
            GeoAnomalyDetector(),
            BehaviorAnomalyDetector(),
        ]
    
    def aggregate(self, profile: DeviceProfile, request: DeviceTrustRequest) -> List[DeviceRiskSignal]:
        signals = []
        for detector in self.detectors:
            detected = detector.detect(profile, request)
            signals.extend(detected)
        return signals


class DeviceTrustService:
    """
    Device Trust Service
    
    Provides comprehensive device trust scoring including:
    - Device attestation verification
    - Security posture assessment
    - Behavioral analysis
    - Risk signal aggregation
    """
    
    def __init__(self, config: Optional[DeviceTrustConfig] = None):
        self._config = config or DeviceTrustConfig()
        self._devices: Dict[str, DeviceProfile] = {}
        self._attestation_providers: Dict[str, AttestationProvider] = {}
        self._risk_aggregator = RiskSignalAggregator()
        self._lock = threading.RLock()
    
    def register_attestation_provider(self, platform: str, provider: AttestationProvider) -> None:
        """Register an attestation provider for a platform"""
        with self._lock:
            self._attestation_providers[platform] = provider
    
    def evaluate_device(self, request: DeviceTrustRequest) -> DeviceTrustResponse:
        """Evaluate device trust"""
        with self._lock:
            # Get or create device profile
            profile = self._get_or_create_profile(request)
            
            # Update profile with request data
            self._update_profile(profile, request)
            
            # Verify attestation if provided
            if request.attestation_token:
                self._verify_attestation(profile, request)
            
            # Calculate scores
            self._calculate_scores(profile, request)
            
            # Aggregate risk signals
            risk_signals = self._risk_aggregator.aggregate(profile, request)
            profile.risk_signals = risk_signals
            
            # Make decision
            response = self._make_decision(profile)
            
            # Update last seen
            profile.last_seen = datetime.utcnow()
            profile.access_count += 1
            
            return response
    
    def _get_or_create_profile(self, request: DeviceTrustRequest) -> DeviceProfile:
        """Get or create a device profile"""
        if request.device_id not in self._devices:
            self._devices[request.device_id] = DeviceProfile(
                device_id=request.device_id,
                first_seen=datetime.utcnow()
            )
        return self._devices[request.device_id]
    
    def _update_profile(self, profile: DeviceProfile, request: DeviceTrustRequest) -> None:
        """Update device profile with request data"""
        profile.platform = request.platform
        profile.os_version = request.os_version
        profile.app_version = request.app_version
        profile.encrypted = request.security_posture.encrypted
        profile.pin_enabled = request.security_posture.pin_enabled
        profile.biometric_enabled = request.security_posture.biometric_enabled
        profile.jailbroken = request.security_posture.jailbroken
        profile.rooted_device = request.security_posture.rooted_device
    
    def _verify_attestation(self, profile: DeviceProfile, request: DeviceTrustRequest) -> None:
        """Verify device attestation"""
        provider = self._attestation_providers.get(request.platform)
        if not provider:
            return
        
        try:
            result = provider.verify(request.attestation_token, request.platform)
            profile.attestation_valid = result.get("valid", False)
            profile.attestation_time = datetime.utcnow()
            
            if profile.attestation_valid:
                profile.attestation_score = 1.0
            else:
                profile.attestation_score = 0.3
        except Exception as e:
            profile.risk_signals.append(DeviceRiskSignal(
                type="attestation_failed",
                severity="high",
                score=0.8,
                description=str(e),
                expires_at=datetime.utcnow() + timedelta(hours=1)
            ))
    
    def _calculate_scores(self, profile: DeviceProfile, request: DeviceTrustRequest) -> None:
        """Calculate trust scores"""
        # Attestation score (if not already set)
        if profile.attestation_score == 0:
            profile.attestation_score = 0.5  # Default for unattested devices
        
        # Compliance score
        profile.compliance_score = self._calculate_compliance_score(profile, request)
        
        # Behavior score
        profile.behavior_score = self._calculate_behavior_score(profile)
        
        # History score
        history_score = self._calculate_history_score(profile)
        
        # Calculate weighted trust score
        profile.trust_score = (
            profile.attestation_score * self._config.attestation_weight +
            profile.compliance_score * self._config.compliance_weight +
            profile.behavior_score * self._config.behavior_weight +
            history_score * self._config.history_weight
        )
        
        # Apply risk signal penalties
        for signal in profile.risk_signals:
            if datetime.utcnow() < signal.expires_at:
                profile.trust_score -= signal.score * 0.1
        
        # Clamp score
        profile.trust_score = max(0.0, min(1.0, profile.trust_score))
    
    def _calculate_compliance_score(self, profile: DeviceProfile, request: DeviceTrustRequest) -> float:
        """Calculate compliance score"""
        score = 0.5
        
        # Encryption
        if profile.encrypted:
            score += 0.15
        
        # PIN/Passcode
        if profile.pin_enabled:
            score += 0.1
        
        # Biometric
        if profile.biometric_enabled:
            score += 0.1
        
        # Jailbreak/Root detection
        if profile.jailbroken or profile.rooted_device:
            score -= 0.4
        
        # Debugger/Emulator detection
        if request.security_posture.debugger_attached:
            score -= 0.3
        if request.security_posture.emulator_detected:
            score -= 0.2
        
        # MDM enrollment
        if profile.mdm_enrolled:
            score += 0.15
        
        return max(0.0, min(1.0, score))
    
    def _calculate_behavior_score(self, profile: DeviceProfile) -> float:
        """Calculate behavior score"""
        score = 0.7
        
        # Failed attempts penalty
        if profile.failed_attempts > 0:
            penalty = min(0.5, profile.failed_attempts * 0.1)
            score -= penalty
        
        # Successful access history bonus
        if profile.access_count > 100:
            score += 0.2
        elif profile.access_count > 10:
            score += 0.1
        
        return max(0.0, min(1.0, score))
    
    def _calculate_history_score(self, profile: DeviceProfile) -> float:
        """Calculate history score"""
        device_age = datetime.utcnow() - profile.first_seen
        
        if device_age > timedelta(days=90):
            return 1.0
        elif device_age > timedelta(days=30):
            return 0.8
        elif device_age > timedelta(days=7):
            return 0.6
        elif device_age > timedelta(days=1):
            return 0.4
        return 0.2
    
    def _make_decision(self, profile: DeviceProfile) -> DeviceTrustResponse:
        """Make trust decision"""
        response = DeviceTrustResponse(
            device_id=profile.device_id,
            trust_score=profile.trust_score,
            trust_level=self._get_trust_level(profile.trust_score),
            decision=DeviceDecision.ALLOW,
            risk_signals=profile.risk_signals,
            valid_until=datetime.utcnow() + self._config.cache_expiry
        )
        
        # Make decision
        if profile.trust_score >= self._config.min_trust_score:
            response.decision = DeviceDecision.ALLOW
        elif profile.trust_score >= self._config.step_up_threshold:
            response.decision = DeviceDecision.STEP_UP
            response.step_up_required = DeviceStepUp(
                type="additional_verification",
                methods=["mfa", "biometric"],
                reason="device trust score below threshold"
            )
        else:
            response.decision = DeviceDecision.DENY
        
        # Add recommendations
        response.recommendations = self._generate_recommendations(profile)
        
        return response
    
    def _get_trust_level(self, score: float) -> TrustLevel:
        """Get trust level from score"""
        if score >= 0.8:
            return TrustLevel.HIGH
        elif score >= 0.6:
            return TrustLevel.MEDIUM
        elif score >= 0.4:
            return TrustLevel.LOW
        return TrustLevel.UNTRUSTED
    
    def _generate_recommendations(self, profile: DeviceProfile) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if not profile.encrypted:
            recommendations.append("Enable device encryption")
        if not profile.pin_enabled:
            recommendations.append("Set up a device PIN or passcode")
        if not profile.biometric_enabled:
            recommendations.append("Enable biometric authentication")
        if profile.jailbroken or profile.rooted_device:
            recommendations.append("Device appears to be jailbroken/rooted - this reduces security")
        if not profile.mdm_enrolled:
            recommendations.append("Enroll device in MDM for enhanced security")
        
        return recommendations
    
    def get_device_profile(self, device_id: str) -> Optional[DeviceProfile]:
        """Get device profile by ID"""
        with self._lock:
            return self._devices.get(device_id)
    
    def record_failed_attempt(self, device_id: str) -> None:
        """Record a failed access attempt"""
        with self._lock:
            if device_id in self._devices:
                self._devices[device_id].failed_attempts += 1
    
    def reset_failed_attempts(self, device_id: str) -> None:
        """Reset failed attempts for a device"""
        with self._lock:
            if device_id in self._devices:
                self._devices[device_id].failed_attempts = 0


def generate_device_fingerprint(request: DeviceTrustRequest) -> str:
    """Generate a device fingerprint"""
    data = f"{request.device_id}:{request.platform}:{request.os_version}:{request.context.timezone}"
    return hashlib.sha256(data.encode()).hexdigest()
