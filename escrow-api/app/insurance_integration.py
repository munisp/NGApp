"""
Insurance Integration Module

This module provides comprehensive insurance integration supporting:
1. Licensed Insurer API Integration (NAICOM-regulated)
2. Self-funded Protection Fund (non-insurance guarantee)

Designed for Nigerian market compliance with NAICOM regulations.
"""

import os
import json
import hmac
import hashlib
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Literal
from enum import Enum
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import uuid

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class InsuranceConfig:
    """Insurance integration configuration"""
    
    # Licensed Insurer Configuration
    INSURER_API_URL = os.getenv("INSURER_API_URL", "https://api.insurer.ng")
    INSURER_API_KEY = os.getenv("INSURER_API_KEY", "")
    INSURER_SECRET_KEY = os.getenv("INSURER_SECRET_KEY", "")
    INSURER_AGENT_CODE = os.getenv("INSURER_AGENT_CODE", "")
    INSURER_PRODUCT_CODE = os.getenv("INSURER_PRODUCT_CODE", "ESCROW-PROTECT-001")
    
    # Protection Fund Configuration
    PROTECTION_FUND_ENABLED = os.getenv("PROTECTION_FUND_ENABLED", "true").lower() == "true"
    PROTECTION_FUND_RESERVE = float(os.getenv("PROTECTION_FUND_RESERVE", "10000000"))  # 10M NGN
    PROTECTION_FUND_MAX_CLAIM = float(os.getenv("PROTECTION_FUND_MAX_CLAIM", "500000"))  # 500K NGN
    
    # Premium Configuration
    BASE_PREMIUM_RATE = float(os.getenv("BASE_PREMIUM_RATE", "0.015"))  # 1.5%
    MIN_PREMIUM = float(os.getenv("MIN_PREMIUM", "100"))  # 100 NGN
    MAX_PREMIUM_RATE = float(os.getenv("MAX_PREMIUM_RATE", "0.05"))  # 5%
    
    # Risk Factors
    HIGH_RISK_CATEGORIES = os.getenv("HIGH_RISK_CATEGORIES", "electronics,phones,laptops,jewelry").split(",")
    HIGH_RISK_LOCATIONS = os.getenv("HIGH_RISK_LOCATIONS", "lagos,port_harcourt,kano").split(",")


# =============================================================================
# Data Models
# =============================================================================

class CoverageType(str, Enum):
    NONE = "none"
    BASIC = "basic"  # Fraud protection only
    STANDARD = "standard"  # Fraud + non-delivery
    PREMIUM = "premium"  # Fraud + non-delivery + damage + disputes
    COMPREHENSIVE = "comprehensive"  # All risks


class ClaimStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"
    APPEALED = "appealed"
    CLOSED = "closed"


class ClaimType(str, Enum):
    FRAUD = "fraud"
    NON_DELIVERY = "non_delivery"
    DAMAGED_GOODS = "damaged_goods"
    WRONG_ITEM = "wrong_item"
    SELLER_DISPUTE = "seller_dispute"
    BUYER_DISPUTE = "buyer_dispute"


class PolicyStatus(str, Enum):
    QUOTED = "quoted"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    CLAIMED = "claimed"


@dataclass
class RiskAssessment:
    """Risk assessment for insurance pricing"""
    escrow_id: str
    transaction_amount: float
    risk_score: float  # 0-100
    risk_level: Literal["low", "medium", "high", "very_high"]
    risk_factors: List[str]
    merchant_kyc_tier: int
    merchant_history: Dict[str, Any]
    item_category: str
    delivery_method: str
    location_corridor: str
    buyer_history: Dict[str, Any]
    recommended_coverage: CoverageType
    assessment_date: datetime = field(default_factory=datetime.utcnow)


@dataclass
class InsuranceQuote:
    """Insurance quote"""
    quote_id: str
    escrow_id: str
    coverage_type: CoverageType
    transaction_amount: float
    premium_amount: float
    premium_rate: float
    coverage_amount: float
    deductible: float
    coverage_details: Dict[str, Any]
    risk_assessment: RiskAssessment
    valid_until: datetime
    terms_and_conditions: str
    is_licensed_insurance: bool
    insurer_name: Optional[str] = None
    policy_wording_url: Optional[str] = None


@dataclass
class InsurancePolicy:
    """Insurance policy"""
    policy_id: str
    policy_number: str
    quote_id: str
    escrow_id: str
    coverage_type: CoverageType
    status: PolicyStatus
    transaction_amount: float
    premium_amount: float
    coverage_amount: float
    deductible: float
    effective_date: datetime
    expiry_date: datetime
    policyholder_name: str
    policyholder_phone: str
    policyholder_email: Optional[str]
    beneficiary_name: str
    beneficiary_phone: str
    is_licensed_insurance: bool
    insurer_name: Optional[str] = None
    insurer_policy_number: Optional[str] = None
    certificate_url: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InsuranceClaim:
    """Insurance claim"""
    claim_id: str
    claim_number: str
    policy_id: str
    escrow_id: str
    claim_type: ClaimType
    status: ClaimStatus
    claim_amount: float
    approved_amount: Optional[float]
    deductible_applied: float
    description: str
    evidence: List[Dict[str, Any]]
    submitted_at: datetime
    reviewed_at: Optional[datetime]
    resolved_at: Optional[datetime]
    reviewer_notes: Optional[str]
    rejection_reason: Optional[str]
    payout_reference: Optional[str]
    appeal_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Risk Assessment Engine
# =============================================================================

class RiskAssessmentEngine:
    """
    Risk assessment engine for insurance pricing
    
    Calculates risk score based on:
    - Merchant KYC tier and history
    - Item category
    - Delivery method
    - Location corridor
    - Transaction amount
    - Buyer history
    """
    
    def __init__(self):
        self.high_risk_categories = InsuranceConfig.HIGH_RISK_CATEGORIES
        self.high_risk_locations = InsuranceConfig.HIGH_RISK_LOCATIONS
    
    async def assess_risk(
        self,
        escrow_id: str,
        transaction_amount: float,
        merchant_id: str,
        merchant_kyc_tier: int,
        merchant_completed_transactions: int,
        merchant_dispute_rate: float,
        item_category: str,
        delivery_method: str,
        buyer_location: str,
        seller_location: str,
        buyer_completed_transactions: int = 0
    ) -> RiskAssessment:
        """Assess risk for an escrow transaction"""
        
        risk_factors = []
        risk_score = 0
        
        # 1. Merchant KYC Tier (0-25 points)
        kyc_scores = {0: 25, 1: 15, 2: 8, 3: 0}
        kyc_risk = kyc_scores.get(merchant_kyc_tier, 20)
        risk_score += kyc_risk
        if kyc_risk > 10:
            risk_factors.append(f"Low KYC tier ({merchant_kyc_tier})")
        
        # 2. Merchant History (0-20 points)
        if merchant_completed_transactions < 5:
            risk_score += 15
            risk_factors.append("New merchant (< 5 transactions)")
        elif merchant_completed_transactions < 20:
            risk_score += 8
            risk_factors.append("Limited merchant history")
        
        if merchant_dispute_rate > 0.1:
            risk_score += 20
            risk_factors.append(f"High dispute rate ({merchant_dispute_rate:.1%})")
        elif merchant_dispute_rate > 0.05:
            risk_score += 10
            risk_factors.append(f"Elevated dispute rate ({merchant_dispute_rate:.1%})")
        
        # 3. Item Category (0-15 points)
        category_lower = item_category.lower()
        if any(cat in category_lower for cat in self.high_risk_categories):
            risk_score += 15
            risk_factors.append(f"High-risk category: {item_category}")
        elif category_lower in ["fashion", "clothing", "shoes"]:
            risk_score += 5
        
        # 4. Transaction Amount (0-15 points)
        if transaction_amount > 500000:
            risk_score += 15
            risk_factors.append("High-value transaction (> 500K)")
        elif transaction_amount > 200000:
            risk_score += 10
            risk_factors.append("Medium-high value transaction")
        elif transaction_amount > 50000:
            risk_score += 5
        
        # 5. Delivery Method (0-10 points)
        if delivery_method.lower() in ["pickup", "self_delivery"]:
            risk_score += 10
            risk_factors.append("Untracked delivery method")
        elif delivery_method.lower() not in ["courier", "logistics", "tracked"]:
            risk_score += 5
        
        # 6. Location Corridor (0-10 points)
        location_corridor = f"{seller_location.lower()}-{buyer_location.lower()}"
        if any(loc in location_corridor for loc in self.high_risk_locations):
            risk_score += 5
            risk_factors.append(f"High-risk location corridor")
        
        # 7. Buyer History (0-5 points)
        if buyer_completed_transactions < 3:
            risk_score += 5
            risk_factors.append("New buyer")
        
        # Normalize to 0-100
        risk_score = min(100, risk_score)
        
        # Determine risk level
        if risk_score >= 70:
            risk_level = "very_high"
            recommended_coverage = CoverageType.COMPREHENSIVE
        elif risk_score >= 50:
            risk_level = "high"
            recommended_coverage = CoverageType.PREMIUM
        elif risk_score >= 30:
            risk_level = "medium"
            recommended_coverage = CoverageType.STANDARD
        else:
            risk_level = "low"
            recommended_coverage = CoverageType.BASIC
        
        return RiskAssessment(
            escrow_id=escrow_id,
            transaction_amount=transaction_amount,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            merchant_kyc_tier=merchant_kyc_tier,
            merchant_history={
                "completed_transactions": merchant_completed_transactions,
                "dispute_rate": merchant_dispute_rate
            },
            item_category=item_category,
            delivery_method=delivery_method,
            location_corridor=location_corridor,
            buyer_history={
                "completed_transactions": buyer_completed_transactions
            },
            recommended_coverage=recommended_coverage
        )


# =============================================================================
# Premium Calculator
# =============================================================================

class PremiumCalculator:
    """Calculate insurance premiums based on risk assessment"""
    
    def __init__(self):
        self.base_rate = InsuranceConfig.BASE_PREMIUM_RATE
        self.min_premium = InsuranceConfig.MIN_PREMIUM
        self.max_rate = InsuranceConfig.MAX_PREMIUM_RATE
    
    def calculate_premium(
        self,
        transaction_amount: float,
        coverage_type: CoverageType,
        risk_assessment: RiskAssessment
    ) -> Dict[str, float]:
        """Calculate premium for given coverage"""
        
        # Base rate by coverage type
        coverage_multipliers = {
            CoverageType.NONE: 0,
            CoverageType.BASIC: 0.8,
            CoverageType.STANDARD: 1.0,
            CoverageType.PREMIUM: 1.5,
            CoverageType.COMPREHENSIVE: 2.0
        }
        
        # Risk multiplier
        risk_multipliers = {
            "low": 0.8,
            "medium": 1.0,
            "high": 1.5,
            "very_high": 2.0
        }
        
        # Calculate rate
        coverage_mult = coverage_multipliers.get(coverage_type, 1.0)
        risk_mult = risk_multipliers.get(risk_assessment.risk_level, 1.0)
        
        premium_rate = self.base_rate * coverage_mult * risk_mult
        premium_rate = min(premium_rate, self.max_rate)
        
        # Calculate premium amount
        premium_amount = transaction_amount * premium_rate
        premium_amount = max(premium_amount, self.min_premium)
        
        # Coverage amount (what we'll pay out)
        coverage_percentages = {
            CoverageType.NONE: 0,
            CoverageType.BASIC: 0.8,
            CoverageType.STANDARD: 0.9,
            CoverageType.PREMIUM: 0.95,
            CoverageType.COMPREHENSIVE: 1.0
        }
        
        coverage_pct = coverage_percentages.get(coverage_type, 0.9)
        coverage_amount = transaction_amount * coverage_pct
        
        # Deductible
        deductible_rates = {
            CoverageType.NONE: 0,
            CoverageType.BASIC: 0.1,
            CoverageType.STANDARD: 0.05,
            CoverageType.PREMIUM: 0.02,
            CoverageType.COMPREHENSIVE: 0
        }
        
        deductible = transaction_amount * deductible_rates.get(coverage_type, 0.05)
        
        return {
            "premium_rate": premium_rate,
            "premium_amount": round(premium_amount, 2),
            "coverage_amount": round(coverage_amount, 2),
            "deductible": round(deductible, 2)
        }


# =============================================================================
# Licensed Insurer Adapter
# =============================================================================

class LicensedInsurerAdapter:
    """
    Adapter for licensed Nigerian insurance companies
    
    Integrates with NAICOM-regulated insurers for:
    - Quote generation
    - Policy binding
    - Claims submission
    - Claims settlement
    """
    
    def __init__(self):
        self.api_url = InsuranceConfig.INSURER_API_URL
        self.api_key = InsuranceConfig.INSURER_API_KEY
        self.secret_key = InsuranceConfig.INSURER_SECRET_KEY
        self.agent_code = InsuranceConfig.INSURER_AGENT_CODE
        self.product_code = InsuranceConfig.INSURER_PRODUCT_CODE
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for insurer API requests"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        signature_data = f"{self.api_key}{timestamp}"
        signature = hmac.new(
            self.secret_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Agent-Code": self.agent_code,
            "X-Timestamp": timestamp,
            "X-Signature": signature
        }
    
    async def get_quote(
        self,
        escrow_id: str,
        transaction_amount: float,
        coverage_type: CoverageType,
        risk_assessment: RiskAssessment,
        policyholder_name: str,
        policyholder_phone: str
    ) -> InsuranceQuote:
        """Get quote from licensed insurer"""
        logger.info(f"Getting licensed insurer quote for escrow {escrow_id}")
        
        # In production: POST to {api_url}/quotes
        # For POC, simulate response
        
        calculator = PremiumCalculator()
        pricing = calculator.calculate_premium(
            transaction_amount=transaction_amount,
            coverage_type=coverage_type,
            risk_assessment=risk_assessment
        )
        
        quote_id = f"LIQ-{uuid.uuid4().hex[:12].upper()}"
        
        return InsuranceQuote(
            quote_id=quote_id,
            escrow_id=escrow_id,
            coverage_type=coverage_type,
            transaction_amount=transaction_amount,
            premium_amount=pricing["premium_amount"],
            premium_rate=pricing["premium_rate"],
            coverage_amount=pricing["coverage_amount"],
            deductible=pricing["deductible"],
            coverage_details={
                "fraud_protection": True,
                "non_delivery": coverage_type in [CoverageType.STANDARD, CoverageType.PREMIUM, CoverageType.COMPREHENSIVE],
                "damaged_goods": coverage_type in [CoverageType.PREMIUM, CoverageType.COMPREHENSIVE],
                "dispute_resolution": coverage_type == CoverageType.COMPREHENSIVE,
                "max_claim_period_days": 30
            },
            risk_assessment=risk_assessment,
            valid_until=datetime.utcnow() + timedelta(hours=24),
            terms_and_conditions="https://insurer.ng/terms/escrow-protect",
            is_licensed_insurance=True,
            insurer_name="Nigerian Insurance Company Ltd",
            policy_wording_url="https://insurer.ng/policy/escrow-protect-wording.pdf"
        )
    
    async def bind_policy(
        self,
        quote: InsuranceQuote,
        policyholder_name: str,
        policyholder_phone: str,
        policyholder_email: Optional[str],
        beneficiary_name: str,
        beneficiary_phone: str
    ) -> InsurancePolicy:
        """Bind policy with licensed insurer"""
        logger.info(f"Binding licensed insurance policy for quote {quote.quote_id}")
        
        # In production: POST to {api_url}/policies
        
        policy_id = f"LIP-{uuid.uuid4().hex[:12].upper()}"
        insurer_policy_number = f"NIC/EP/{datetime.utcnow().strftime('%Y%m%d')}/{uuid.uuid4().hex[:6].upper()}"
        
        return InsurancePolicy(
            policy_id=policy_id,
            policy_number=f"EP-{policy_id}",
            quote_id=quote.quote_id,
            escrow_id=quote.escrow_id,
            coverage_type=quote.coverage_type,
            status=PolicyStatus.ACTIVE,
            transaction_amount=quote.transaction_amount,
            premium_amount=quote.premium_amount,
            coverage_amount=quote.coverage_amount,
            deductible=quote.deductible,
            effective_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=30),
            policyholder_name=policyholder_name,
            policyholder_phone=policyholder_phone,
            policyholder_email=policyholder_email,
            beneficiary_name=beneficiary_name,
            beneficiary_phone=beneficiary_phone,
            is_licensed_insurance=True,
            insurer_name="Nigerian Insurance Company Ltd",
            insurer_policy_number=insurer_policy_number,
            certificate_url=f"https://insurer.ng/certificates/{insurer_policy_number}.pdf"
        )
    
    async def submit_claim(
        self,
        policy: InsurancePolicy,
        claim_type: ClaimType,
        claim_amount: float,
        description: str,
        evidence: List[Dict[str, Any]]
    ) -> InsuranceClaim:
        """Submit claim to licensed insurer"""
        logger.info(f"Submitting claim for policy {policy.policy_id}")
        
        # In production: POST to {api_url}/claims
        
        claim_id = f"LIC-{uuid.uuid4().hex[:12].upper()}"
        claim_number = f"CLM/{datetime.utcnow().strftime('%Y%m%d')}/{uuid.uuid4().hex[:6].upper()}"
        
        return InsuranceClaim(
            claim_id=claim_id,
            claim_number=claim_number,
            policy_id=policy.policy_id,
            escrow_id=policy.escrow_id,
            claim_type=claim_type,
            status=ClaimStatus.SUBMITTED,
            claim_amount=claim_amount,
            approved_amount=None,
            deductible_applied=policy.deductible,
            description=description,
            evidence=evidence,
            submitted_at=datetime.utcnow(),
            reviewed_at=None,
            resolved_at=None,
            reviewer_notes=None,
            rejection_reason=None,
            payout_reference=None
        )
    
    async def get_claim_status(self, claim_id: str) -> Dict[str, Any]:
        """Get claim status from insurer"""
        # In production: GET {api_url}/claims/{claim_id}
        return {
            "claim_id": claim_id,
            "status": "under_review",
            "message": "Claim is being reviewed by the insurer"
        }


# =============================================================================
# Protection Fund (Non-Insurance)
# =============================================================================

class ProtectionFund:
    """
    Self-funded Protection Fund
    
    NOT insurance - this is a guarantee/protection fund that:
    - Does not require NAICOM licensing
    - Has clear terms and caps
    - Is funded by platform contributions and premiums
    - Provides buyer protection without insurance branding
    """
    
    def __init__(self):
        self.enabled = InsuranceConfig.PROTECTION_FUND_ENABLED
        self.reserve = InsuranceConfig.PROTECTION_FUND_RESERVE
        self.max_claim = InsuranceConfig.PROTECTION_FUND_MAX_CLAIM
        
        # Fund state (in production, use database)
        self._fund_balance = self.reserve
        self._total_contributions = 0.0
        self._total_payouts = 0.0
        self._policies: Dict[str, InsurancePolicy] = {}
        self._claims: Dict[str, InsuranceClaim] = {}
    
    async def get_fund_status(self) -> Dict[str, Any]:
        """Get protection fund status"""
        return {
            "enabled": self.enabled,
            "fund_balance": self._fund_balance,
            "reserve_target": self.reserve,
            "total_contributions": self._total_contributions,
            "total_payouts": self._total_payouts,
            "max_claim_amount": self.max_claim,
            "active_policies": len([p for p in self._policies.values() if p.status == PolicyStatus.ACTIVE]),
            "pending_claims": len([c for c in self._claims.values() if c.status in [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW]]),
            "fund_health": "healthy" if self._fund_balance >= self.reserve * 0.5 else "low" if self._fund_balance >= self.reserve * 0.2 else "critical"
        }
    
    async def get_quote(
        self,
        escrow_id: str,
        transaction_amount: float,
        coverage_type: CoverageType,
        risk_assessment: RiskAssessment
    ) -> InsuranceQuote:
        """Get protection fund quote"""
        logger.info(f"Getting protection fund quote for escrow {escrow_id}")
        
        calculator = PremiumCalculator()
        pricing = calculator.calculate_premium(
            transaction_amount=transaction_amount,
            coverage_type=coverage_type,
            risk_assessment=risk_assessment
        )
        
        # Cap coverage at max claim
        coverage_amount = min(pricing["coverage_amount"], self.max_claim)
        
        quote_id = f"PFQ-{uuid.uuid4().hex[:12].upper()}"
        
        return InsuranceQuote(
            quote_id=quote_id,
            escrow_id=escrow_id,
            coverage_type=coverage_type,
            transaction_amount=transaction_amount,
            premium_amount=pricing["premium_amount"],
            premium_rate=pricing["premium_rate"],
            coverage_amount=coverage_amount,
            deductible=pricing["deductible"],
            coverage_details={
                "fraud_protection": True,
                "non_delivery": coverage_type in [CoverageType.STANDARD, CoverageType.PREMIUM, CoverageType.COMPREHENSIVE],
                "damaged_goods": coverage_type in [CoverageType.PREMIUM, CoverageType.COMPREHENSIVE],
                "dispute_resolution": coverage_type == CoverageType.COMPREHENSIVE,
                "max_claim_amount": self.max_claim,
                "max_claim_period_days": 14,
                "fund_type": "protection_fund"
            },
            risk_assessment=risk_assessment,
            valid_until=datetime.utcnow() + timedelta(hours=24),
            terms_and_conditions="""
EscrowProtect Guarantee Terms:
1. This is NOT insurance. It is a buyer protection guarantee.
2. Maximum claim amount: ₦500,000 per transaction.
3. Claims must be filed within 14 days of transaction completion.
4. Deductible applies based on coverage tier selected.
5. EscrowProtect reserves the right to investigate all claims.
6. Fraudulent claims will result in account suspension.
7. Payouts are subject to fund availability.
            """.strip(),
            is_licensed_insurance=False,
            insurer_name="EscrowProtect Guarantee Fund"
        )
    
    async def create_policy(
        self,
        quote: InsuranceQuote,
        policyholder_name: str,
        policyholder_phone: str,
        policyholder_email: Optional[str],
        beneficiary_name: str,
        beneficiary_phone: str
    ) -> InsurancePolicy:
        """Create protection fund policy"""
        logger.info(f"Creating protection fund policy for quote {quote.quote_id}")
        
        policy_id = f"PFP-{uuid.uuid4().hex[:12].upper()}"
        
        policy = InsurancePolicy(
            policy_id=policy_id,
            policy_number=f"EPG-{policy_id}",
            quote_id=quote.quote_id,
            escrow_id=quote.escrow_id,
            coverage_type=quote.coverage_type,
            status=PolicyStatus.ACTIVE,
            transaction_amount=quote.transaction_amount,
            premium_amount=quote.premium_amount,
            coverage_amount=quote.coverage_amount,
            deductible=quote.deductible,
            effective_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=14),
            policyholder_name=policyholder_name,
            policyholder_phone=policyholder_phone,
            policyholder_email=policyholder_email,
            beneficiary_name=beneficiary_name,
            beneficiary_phone=beneficiary_phone,
            is_licensed_insurance=False,
            insurer_name="EscrowProtect Guarantee Fund"
        )
        
        # Store policy
        self._policies[policy_id] = policy
        
        # Add premium to fund
        self._fund_balance += quote.premium_amount
        self._total_contributions += quote.premium_amount
        
        return policy
    
    async def submit_claim(
        self,
        policy_id: str,
        claim_type: ClaimType,
        claim_amount: float,
        description: str,
        evidence: List[Dict[str, Any]]
    ) -> InsuranceClaim:
        """Submit claim to protection fund"""
        logger.info(f"Submitting protection fund claim for policy {policy_id}")
        
        policy = self._policies.get(policy_id)
        if not policy:
            raise ValueError(f"Policy not found: {policy_id}")
        
        if policy.status != PolicyStatus.ACTIVE:
            raise ValueError(f"Policy is not active: {policy.status}")
        
        # Cap claim at coverage amount
        claim_amount = min(claim_amount, policy.coverage_amount)
        
        claim_id = f"PFC-{uuid.uuid4().hex[:12].upper()}"
        claim_number = f"EPG-CLM-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        claim = InsuranceClaim(
            claim_id=claim_id,
            claim_number=claim_number,
            policy_id=policy_id,
            escrow_id=policy.escrow_id,
            claim_type=claim_type,
            status=ClaimStatus.SUBMITTED,
            claim_amount=claim_amount,
            approved_amount=None,
            deductible_applied=policy.deductible,
            description=description,
            evidence=evidence,
            submitted_at=datetime.utcnow(),
            reviewed_at=None,
            resolved_at=None,
            reviewer_notes=None,
            rejection_reason=None,
            payout_reference=None
        )
        
        self._claims[claim_id] = claim
        
        # Update policy status
        policy.status = PolicyStatus.CLAIMED
        
        return claim
    
    async def review_claim(
        self,
        claim_id: str,
        approved: bool,
        approved_amount: Optional[float] = None,
        reviewer_notes: str = "",
        rejection_reason: Optional[str] = None
    ) -> InsuranceClaim:
        """Review and approve/reject claim"""
        claim = self._claims.get(claim_id)
        if not claim:
            raise ValueError(f"Claim not found: {claim_id}")
        
        claim.reviewed_at = datetime.utcnow()
        claim.reviewer_notes = reviewer_notes
        
        if approved:
            # Calculate payout
            payout = approved_amount or claim.claim_amount
            payout = payout - claim.deductible_applied
            payout = max(0, payout)
            
            # Check fund availability
            if payout > self._fund_balance:
                claim.status = ClaimStatus.REJECTED
                claim.rejection_reason = "Insufficient fund balance"
            else:
                claim.status = ClaimStatus.APPROVED
                claim.approved_amount = payout
        else:
            claim.status = ClaimStatus.REJECTED
            claim.rejection_reason = rejection_reason or "Claim not approved"
        
        return claim
    
    async def process_payout(self, claim_id: str) -> Dict[str, Any]:
        """Process payout for approved claim"""
        claim = self._claims.get(claim_id)
        if not claim:
            raise ValueError(f"Claim not found: {claim_id}")
        
        if claim.status != ClaimStatus.APPROVED:
            raise ValueError(f"Claim is not approved: {claim.status}")
        
        payout_amount = claim.approved_amount or 0
        
        # Deduct from fund
        self._fund_balance -= payout_amount
        self._total_payouts += payout_amount
        
        # Update claim
        claim.status = ClaimStatus.PAID
        claim.resolved_at = datetime.utcnow()
        claim.payout_reference = f"PAYOUT-{uuid.uuid4().hex[:12].upper()}"
        
        return {
            "claim_id": claim_id,
            "payout_amount": payout_amount,
            "payout_reference": claim.payout_reference,
            "fund_balance_after": self._fund_balance
        }


# =============================================================================
# Unified Insurance Service
# =============================================================================

class InsuranceService:
    """
    Unified Insurance Service
    
    Routes to appropriate provider based on:
    - Transaction amount
    - Coverage type
    - User preference
    - Regulatory requirements
    """
    
    def __init__(self):
        self.risk_engine = RiskAssessmentEngine()
        self.premium_calculator = PremiumCalculator()
        self.licensed_insurer = LicensedInsurerAdapter()
        self.protection_fund = ProtectionFund()
    
    async def assess_risk(
        self,
        escrow_id: str,
        transaction_amount: float,
        merchant_id: str,
        merchant_kyc_tier: int = 0,
        merchant_completed_transactions: int = 0,
        merchant_dispute_rate: float = 0.0,
        item_category: str = "general",
        delivery_method: str = "courier",
        buyer_location: str = "lagos",
        seller_location: str = "lagos",
        buyer_completed_transactions: int = 0
    ) -> RiskAssessment:
        """Assess risk for an escrow transaction"""
        return await self.risk_engine.assess_risk(
            escrow_id=escrow_id,
            transaction_amount=transaction_amount,
            merchant_id=merchant_id,
            merchant_kyc_tier=merchant_kyc_tier,
            merchant_completed_transactions=merchant_completed_transactions,
            merchant_dispute_rate=merchant_dispute_rate,
            item_category=item_category,
            delivery_method=delivery_method,
            buyer_location=buyer_location,
            seller_location=seller_location,
            buyer_completed_transactions=buyer_completed_transactions
        )
    
    async def get_quotes(
        self,
        escrow_id: str,
        transaction_amount: float,
        risk_assessment: RiskAssessment,
        policyholder_name: str = "",
        policyholder_phone: str = ""
    ) -> Dict[str, List[InsuranceQuote]]:
        """Get quotes from all available providers"""
        
        quotes = {
            "licensed_insurance": [],
            "protection_fund": []
        }
        
        # Get quotes for each coverage type
        for coverage_type in [CoverageType.BASIC, CoverageType.STANDARD, CoverageType.PREMIUM, CoverageType.COMPREHENSIVE]:
            # Licensed insurer quote
            try:
                licensed_quote = await self.licensed_insurer.get_quote(
                    escrow_id=escrow_id,
                    transaction_amount=transaction_amount,
                    coverage_type=coverage_type,
                    risk_assessment=risk_assessment,
                    policyholder_name=policyholder_name,
                    policyholder_phone=policyholder_phone
                )
                quotes["licensed_insurance"].append(licensed_quote)
            except Exception as e:
                logger.error(f"Failed to get licensed insurer quote: {e}")
            
            # Protection fund quote
            try:
                pf_quote = await self.protection_fund.get_quote(
                    escrow_id=escrow_id,
                    transaction_amount=transaction_amount,
                    coverage_type=coverage_type,
                    risk_assessment=risk_assessment
                )
                quotes["protection_fund"].append(pf_quote)
            except Exception as e:
                logger.error(f"Failed to get protection fund quote: {e}")
        
        return quotes
    
    async def get_recommendation(
        self,
        escrow_id: str,
        transaction_amount: float,
        risk_assessment: RiskAssessment
    ) -> Dict[str, Any]:
        """Get insurance recommendation based on risk"""
        
        # Determine recommended provider
        if transaction_amount > 500000:
            # High-value: recommend licensed insurance
            recommended_provider = "licensed_insurance"
            reason = "High-value transaction benefits from regulated insurance coverage"
        elif risk_assessment.risk_level in ["high", "very_high"]:
            # High-risk: recommend licensed insurance
            recommended_provider = "licensed_insurance"
            reason = "High-risk transaction benefits from comprehensive insurance"
        else:
            # Standard: protection fund is sufficient
            recommended_provider = "protection_fund"
            reason = "Protection fund provides adequate coverage for this transaction"
        
        # Get recommended quote
        quotes = await self.get_quotes(
            escrow_id=escrow_id,
            transaction_amount=transaction_amount,
            risk_assessment=risk_assessment
        )
        
        recommended_coverage = risk_assessment.recommended_coverage
        recommended_quotes = quotes[recommended_provider]
        
        recommended_quote = None
        for quote in recommended_quotes:
            if quote.coverage_type == recommended_coverage:
                recommended_quote = quote
                break
        
        return {
            "recommended_provider": recommended_provider,
            "recommended_coverage": recommended_coverage.value,
            "reason": reason,
            "risk_level": risk_assessment.risk_level,
            "risk_score": risk_assessment.risk_score,
            "recommended_quote": recommended_quote,
            "all_quotes": quotes
        }
    
    async def purchase_coverage(
        self,
        quote_id: str,
        provider: Literal["licensed_insurance", "protection_fund"],
        policyholder_name: str,
        policyholder_phone: str,
        policyholder_email: Optional[str],
        beneficiary_name: str,
        beneficiary_phone: str
    ) -> InsurancePolicy:
        """Purchase coverage from selected provider"""
        
        # In production, retrieve quote from database
        # For POC, we'll need the quote object passed in
        
        # This is a simplified implementation
        # In production, you'd look up the quote by ID
        
        logger.info(f"Purchasing coverage from {provider} for quote {quote_id}")
        
        # For now, return a mock policy
        policy_id = f"POL-{uuid.uuid4().hex[:12].upper()}"
        
        return InsurancePolicy(
            policy_id=policy_id,
            policy_number=f"EP-{policy_id}",
            quote_id=quote_id,
            escrow_id="",  # Would be from quote
            coverage_type=CoverageType.STANDARD,
            status=PolicyStatus.ACTIVE,
            transaction_amount=0,
            premium_amount=0,
            coverage_amount=0,
            deductible=0,
            effective_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=30),
            policyholder_name=policyholder_name,
            policyholder_phone=policyholder_phone,
            policyholder_email=policyholder_email,
            beneficiary_name=beneficiary_name,
            beneficiary_phone=beneficiary_phone,
            is_licensed_insurance=provider == "licensed_insurance",
            insurer_name="Nigerian Insurance Company Ltd" if provider == "licensed_insurance" else "EscrowProtect Guarantee Fund"
        )
    
    async def file_claim(
        self,
        policy_id: str,
        claim_type: ClaimType,
        claim_amount: float,
        description: str,
        evidence: List[Dict[str, Any]]
    ) -> InsuranceClaim:
        """File a claim against a policy"""
        
        # Check if policy is in protection fund
        if policy_id in self.protection_fund._policies:
            return await self.protection_fund.submit_claim(
                policy_id=policy_id,
                claim_type=claim_type,
                claim_amount=claim_amount,
                description=description,
                evidence=evidence
            )
        else:
            # Assume licensed insurance
            # In production, look up policy and route appropriately
            policy = InsurancePolicy(
                policy_id=policy_id,
                policy_number="",
                quote_id="",
                escrow_id="",
                coverage_type=CoverageType.STANDARD,
                status=PolicyStatus.ACTIVE,
                transaction_amount=0,
                premium_amount=0,
                coverage_amount=0,
                deductible=0,
                effective_date=datetime.utcnow(),
                expiry_date=datetime.utcnow() + timedelta(days=30),
                policyholder_name="",
                policyholder_phone="",
                policyholder_email=None,
                beneficiary_name="",
                beneficiary_phone="",
                is_licensed_insurance=True
            )
            return await self.licensed_insurer.submit_claim(
                policy=policy,
                claim_type=claim_type,
                claim_amount=claim_amount,
                description=description,
                evidence=evidence
            )
    
    async def get_fund_status(self) -> Dict[str, Any]:
        """Get protection fund status"""
        return await self.protection_fund.get_fund_status()


# =============================================================================
# Singleton Instance
# =============================================================================

insurance_service = InsuranceService()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/insurance", tags=["Insurance Integration"])


class RiskAssessmentRequest(BaseModel):
    escrow_id: str
    transaction_amount: float
    merchant_id: str
    merchant_kyc_tier: int = 0
    merchant_completed_transactions: int = 0
    merchant_dispute_rate: float = 0.0
    item_category: str = "general"
    delivery_method: str = "courier"
    buyer_location: str = "lagos"
    seller_location: str = "lagos"
    buyer_completed_transactions: int = 0


class GetQuotesRequest(BaseModel):
    escrow_id: str
    transaction_amount: float
    merchant_id: str
    merchant_kyc_tier: int = 0
    item_category: str = "general"
    policyholder_name: str = ""
    policyholder_phone: str = ""


class PurchaseCoverageRequest(BaseModel):
    quote_id: str
    provider: Literal["licensed_insurance", "protection_fund"]
    policyholder_name: str
    policyholder_phone: str
    policyholder_email: Optional[str] = None
    beneficiary_name: str
    beneficiary_phone: str


class FileClaimRequest(BaseModel):
    policy_id: str
    claim_type: str
    claim_amount: float
    description: str
    evidence: List[Dict[str, Any]] = []


@router.post("/assess-risk")
async def assess_risk(request: RiskAssessmentRequest):
    """Assess risk for an escrow transaction"""
    assessment = await insurance_service.assess_risk(
        escrow_id=request.escrow_id,
        transaction_amount=request.transaction_amount,
        merchant_id=request.merchant_id,
        merchant_kyc_tier=request.merchant_kyc_tier,
        merchant_completed_transactions=request.merchant_completed_transactions,
        merchant_dispute_rate=request.merchant_dispute_rate,
        item_category=request.item_category,
        delivery_method=request.delivery_method,
        buyer_location=request.buyer_location,
        seller_location=request.seller_location,
        buyer_completed_transactions=request.buyer_completed_transactions
    )
    
    return {
        "escrow_id": assessment.escrow_id,
        "risk_score": assessment.risk_score,
        "risk_level": assessment.risk_level,
        "risk_factors": assessment.risk_factors,
        "recommended_coverage": assessment.recommended_coverage.value,
        "assessment_date": assessment.assessment_date.isoformat()
    }


@router.post("/quotes")
async def get_quotes(request: GetQuotesRequest):
    """Get insurance quotes from all providers"""
    
    # First assess risk
    assessment = await insurance_service.assess_risk(
        escrow_id=request.escrow_id,
        transaction_amount=request.transaction_amount,
        merchant_id=request.merchant_id,
        merchant_kyc_tier=request.merchant_kyc_tier,
        item_category=request.item_category
    )
    
    # Get quotes
    quotes = await insurance_service.get_quotes(
        escrow_id=request.escrow_id,
        transaction_amount=request.transaction_amount,
        risk_assessment=assessment,
        policyholder_name=request.policyholder_name,
        policyholder_phone=request.policyholder_phone
    )
    
    # Format response
    formatted_quotes = {
        "licensed_insurance": [],
        "protection_fund": []
    }
    
    for provider, provider_quotes in quotes.items():
        for quote in provider_quotes:
            formatted_quotes[provider].append({
                "quote_id": quote.quote_id,
                "coverage_type": quote.coverage_type.value,
                "premium_amount": quote.premium_amount,
                "premium_rate": quote.premium_rate,
                "coverage_amount": quote.coverage_amount,
                "deductible": quote.deductible,
                "coverage_details": quote.coverage_details,
                "valid_until": quote.valid_until.isoformat(),
                "is_licensed_insurance": quote.is_licensed_insurance,
                "insurer_name": quote.insurer_name
            })
    
    return {
        "escrow_id": request.escrow_id,
        "transaction_amount": request.transaction_amount,
        "risk_assessment": {
            "risk_score": assessment.risk_score,
            "risk_level": assessment.risk_level,
            "recommended_coverage": assessment.recommended_coverage.value
        },
        "quotes": formatted_quotes
    }


@router.post("/recommendation")
async def get_recommendation(request: GetQuotesRequest):
    """Get insurance recommendation based on risk"""
    
    # Assess risk
    assessment = await insurance_service.assess_risk(
        escrow_id=request.escrow_id,
        transaction_amount=request.transaction_amount,
        merchant_id=request.merchant_id,
        merchant_kyc_tier=request.merchant_kyc_tier,
        item_category=request.item_category
    )
    
    # Get recommendation
    recommendation = await insurance_service.get_recommendation(
        escrow_id=request.escrow_id,
        transaction_amount=request.transaction_amount,
        risk_assessment=assessment
    )
    
    return recommendation


@router.post("/purchase")
async def purchase_coverage(request: PurchaseCoverageRequest):
    """Purchase insurance coverage"""
    
    policy = await insurance_service.purchase_coverage(
        quote_id=request.quote_id,
        provider=request.provider,
        policyholder_name=request.policyholder_name,
        policyholder_phone=request.policyholder_phone,
        policyholder_email=request.policyholder_email,
        beneficiary_name=request.beneficiary_name,
        beneficiary_phone=request.beneficiary_phone
    )
    
    return {
        "policy_id": policy.policy_id,
        "policy_number": policy.policy_number,
        "status": policy.status.value,
        "coverage_type": policy.coverage_type.value,
        "premium_amount": policy.premium_amount,
        "coverage_amount": policy.coverage_amount,
        "effective_date": policy.effective_date.isoformat(),
        "expiry_date": policy.expiry_date.isoformat(),
        "is_licensed_insurance": policy.is_licensed_insurance,
        "insurer_name": policy.insurer_name,
        "certificate_url": policy.certificate_url
    }


@router.post("/claims")
async def file_claim(request: FileClaimRequest):
    """File an insurance claim"""
    
    try:
        claim_type = ClaimType(request.claim_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid claim type: {request.claim_type}")
    
    claim = await insurance_service.file_claim(
        policy_id=request.policy_id,
        claim_type=claim_type,
        claim_amount=request.claim_amount,
        description=request.description,
        evidence=request.evidence
    )
    
    return {
        "claim_id": claim.claim_id,
        "claim_number": claim.claim_number,
        "status": claim.status.value,
        "claim_amount": claim.claim_amount,
        "deductible_applied": claim.deductible_applied,
        "submitted_at": claim.submitted_at.isoformat()
    }


@router.get("/claims/{claim_id}")
async def get_claim_status(claim_id: str):
    """Get claim status"""
    
    # Check protection fund first
    if claim_id in insurance_service.protection_fund._claims:
        claim = insurance_service.protection_fund._claims[claim_id]
        return {
            "claim_id": claim.claim_id,
            "claim_number": claim.claim_number,
            "status": claim.status.value,
            "claim_amount": claim.claim_amount,
            "approved_amount": claim.approved_amount,
            "submitted_at": claim.submitted_at.isoformat(),
            "reviewed_at": claim.reviewed_at.isoformat() if claim.reviewed_at else None,
            "resolved_at": claim.resolved_at.isoformat() if claim.resolved_at else None,
            "rejection_reason": claim.rejection_reason,
            "payout_reference": claim.payout_reference
        }
    
    # Check licensed insurer
    return await insurance_service.licensed_insurer.get_claim_status(claim_id)


@router.get("/fund/status")
async def get_fund_status():
    """Get protection fund status"""
    return await insurance_service.get_fund_status()


@router.get("/coverage-types")
async def get_coverage_types():
    """Get available coverage types"""
    return {
        "coverage_types": [
            {
                "type": "none",
                "name": "No Coverage",
                "description": "No protection - buyer assumes all risk"
            },
            {
                "type": "basic",
                "name": "Basic Protection",
                "description": "Fraud protection only - covers seller fraud",
                "coverage_percentage": 80,
                "deductible_percentage": 10
            },
            {
                "type": "standard",
                "name": "Standard Protection",
                "description": "Fraud + non-delivery protection",
                "coverage_percentage": 90,
                "deductible_percentage": 5
            },
            {
                "type": "premium",
                "name": "Premium Protection",
                "description": "Fraud + non-delivery + damaged goods",
                "coverage_percentage": 95,
                "deductible_percentage": 2
            },
            {
                "type": "comprehensive",
                "name": "Comprehensive Protection",
                "description": "All risks covered including disputes",
                "coverage_percentage": 100,
                "deductible_percentage": 0
            }
        ]
    }
