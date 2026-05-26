"""
Zero Trust Architecture for PayGate Payment Switch

This module implements Zero Trust security principles:
- Identity verification at every access point
- Least privilege access
- Micro-segmentation
- Continuous validation
- Device trust scoring
"""

from .zero_trust_engine import (
    ZeroTrustEngine,
    ZeroTrustConfig,
    ZeroTrustMiddleware,
    AccessRequest,
    AccessDecision,
    Subject,
    Resource,
    AccessContext,
    TrustDecision,
    RiskLevel,
    StepUpRequirement,
    PolicyDecisionPoint,
    DeviceTrustScorer,
    MicroSegmentation,
    ContinuousValidator,
    IdentityVerifier,
    zero_trust_required,
)

from .device_trust_service import (
    DeviceTrustService,
    DeviceTrustConfig,
    DeviceProfile,
    DeviceTrustRequest,
    DeviceTrustResponse,
    SecurityPosture,
    DeviceContext,
)

__all__ = [
    # Core engine
    "ZeroTrustEngine",
    "ZeroTrustConfig",
    "ZeroTrustMiddleware",
    
    # Request/Response types
    "AccessRequest",
    "AccessDecision",
    "Subject",
    "Resource",
    "AccessContext",
    "TrustDecision",
    "RiskLevel",
    "StepUpRequirement",
    
    # Components
    "PolicyDecisionPoint",
    "DeviceTrustScorer",
    "MicroSegmentation",
    "ContinuousValidator",
    "IdentityVerifier",
    
    # Device Trust
    "DeviceTrustService",
    "DeviceTrustConfig",
    "DeviceProfile",
    "DeviceTrustRequest",
    "DeviceTrustResponse",
    "SecurityPosture",
    "DeviceContext",
    
    # Decorators
    "zero_trust_required",
]
