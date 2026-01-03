"""
Insurance Pool Integration for SocialEscrow
TIER 4: Insurance Pool Integration

Provides optional insurance for high-value transactions,
protecting both buyers and sellers against:
- Shipping damage/loss
- Fraud beyond platform detection
- Seller insolvency
- Force majeure events
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class InsuranceTier(str, Enum):
    BASIC = "basic"           # Free, limited coverage
    STANDARD = "standard"     # 1% premium, full coverage
    PREMIUM = "premium"       # 2% premium, enhanced coverage + priority support

class ClaimType(str, Enum):
    ITEM_NOT_RECEIVED = "item_not_received"
    ITEM_DAMAGED = "item_damaged"
    ITEM_LOST_IN_TRANSIT = "item_lost_in_transit"
    SELLER_FRAUD = "seller_fraud"
    BUYER_FRAUD = "buyer_fraud"
    COUNTERFEIT_ITEM = "counterfeit_item"
    FORCE_MAJEURE = "force_majeure"

class ClaimStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DENIED = "denied"
    PAID = "paid"
    APPEALED = "appealed"

@dataclass
class InsurancePolicy:
    """Insurance policy for an escrow transaction"""
    id: str
    escrow_id: str
    tier: InsuranceTier
    
    # Coverage
    coverage_amount: float
    premium_paid: float
    deductible: float
    
    # Parties
    buyer_id: str
    seller_id: str
    
    # Status
    active: bool = True
    
    # Coverage details
    covers_shipping_damage: bool = True
    covers_shipping_loss: bool = True
    covers_fraud: bool = True
    covers_counterfeit: bool = True
    covers_force_majeure: bool = False  # Only Premium tier
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    expires_at: Optional[str] = None
    
    # Claims
    claims_filed: int = 0
    claims_paid: float = 0.0

@dataclass
class InsuranceClaim:
    """Insurance claim against a policy"""
    id: str
    policy_id: str
    escrow_id: str
    claim_type: ClaimType
    status: ClaimStatus
    
    # Claimant
    claimant_id: str
    claimant_role: str  # buyer or seller
    
    # Amount
    claimed_amount: float
    approved_amount: float = 0.0
    deductible_applied: float = 0.0
    payout_amount: float = 0.0
    
    # Description
    description: str = ""
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    
    # Review
    reviewer_id: Optional[str] = None
    review_notes: str = ""
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    reviewed_at: Optional[str] = None
    paid_at: Optional[str] = None

class InsurancePoolService:
    """
    Insurance pool service for escrow transactions.
    
    The insurance pool is funded by:
    1. Premium payments from insured transactions
    2. Platform contribution (0.5% of all transactions)
    3. Investment returns on pool balance
    
    Coverage tiers:
    
    BASIC (Free):
    - Coverage: Up to ₦50,000
    - Deductible: 20%
    - Covers: Shipping damage, shipping loss
    - Exclusions: Fraud, counterfeit, force majeure
    
    STANDARD (1% premium):
    - Coverage: Up to ₦500,000
    - Deductible: 10%
    - Covers: Shipping damage, shipping loss, fraud, counterfeit
    - Exclusions: Force majeure
    
    PREMIUM (2% premium):
    - Coverage: Up to ₦5,000,000
    - Deductible: 5%
    - Covers: All risks including force majeure
    - Benefits: Priority support, faster claims processing
    """
    
    # Coverage limits by tier (NGN)
    COVERAGE_LIMITS = {
        InsuranceTier.BASIC: 50000,
        InsuranceTier.STANDARD: 500000,
        InsuranceTier.PREMIUM: 5000000,
    }
    
    # Premium rates
    PREMIUM_RATES = {
        InsuranceTier.BASIC: 0.0,      # Free
        InsuranceTier.STANDARD: 0.01,  # 1%
        InsuranceTier.PREMIUM: 0.02,   # 2%
    }
    
    # Deductible rates
    DEDUCTIBLE_RATES = {
        InsuranceTier.BASIC: 0.20,     # 20%
        InsuranceTier.STANDARD: 0.10,  # 10%
        InsuranceTier.PREMIUM: 0.05,   # 5%
    }
    
    # Platform contribution rate
    PLATFORM_CONTRIBUTION_RATE = 0.005  # 0.5%
    
    def __init__(self):
        self.policies: Dict[str, InsurancePolicy] = {}
        self.claims: Dict[str, InsuranceClaim] = {}
        self.escrow_policies: Dict[str, str] = {}  # escrow_id -> policy_id
        
        # Pool balance tracking
        self.pool_balance: float = 1000000  # Initial seed: ₦1,000,000
        self.total_premiums_collected: float = 0.0
        self.total_claims_paid: float = 0.0
        self.total_platform_contributions: float = 0.0
    
    def calculate_premium(
        self,
        amount: float,
        tier: InsuranceTier
    ) -> Dict[str, float]:
        """
        Calculate insurance premium for a transaction.
        """
        rate = self.PREMIUM_RATES.get(tier, 0.01)
        premium = amount * rate
        
        coverage_limit = self.COVERAGE_LIMITS.get(tier, 50000)
        actual_coverage = min(amount, coverage_limit)
        
        deductible_rate = self.DEDUCTIBLE_RATES.get(tier, 0.10)
        deductible = actual_coverage * deductible_rate
        
        return {
            "tier": tier.value,
            "transaction_amount": amount,
            "premium": premium,
            "coverage_amount": actual_coverage,
            "deductible": deductible,
            "max_payout": actual_coverage - deductible,
            "premium_rate": rate,
            "deductible_rate": deductible_rate
        }
    
    def create_policy(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        amount: float,
        tier: InsuranceTier = InsuranceTier.STANDARD
    ) -> InsurancePolicy:
        """
        Create an insurance policy for an escrow transaction.
        """
        policy_id = f"INS-{uuid.uuid4().hex[:12].upper()}"
        
        # Calculate premium and coverage
        calc = self.calculate_premium(amount, tier)
        
        # Determine coverage based on tier
        covers_fraud = tier in [InsuranceTier.STANDARD, InsuranceTier.PREMIUM]
        covers_counterfeit = tier in [InsuranceTier.STANDARD, InsuranceTier.PREMIUM]
        covers_force_majeure = tier == InsuranceTier.PREMIUM
        
        # Policy expires 30 days after creation (or when escrow completes)
        expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        policy = InsurancePolicy(
            id=policy_id,
            escrow_id=escrow_id,
            tier=tier,
            coverage_amount=calc["coverage_amount"],
            premium_paid=calc["premium"],
            deductible=calc["deductible"],
            buyer_id=buyer_id,
            seller_id=seller_id,
            covers_fraud=covers_fraud,
            covers_counterfeit=covers_counterfeit,
            covers_force_majeure=covers_force_majeure,
            expires_at=expires_at
        )
        
        self.policies[policy_id] = policy
        self.escrow_policies[escrow_id] = policy_id
        
        # Update pool balance
        self.pool_balance += calc["premium"]
        self.total_premiums_collected += calc["premium"]
        
        # Add platform contribution
        platform_contribution = amount * self.PLATFORM_CONTRIBUTION_RATE
        self.pool_balance += platform_contribution
        self.total_platform_contributions += platform_contribution
        
        logger.info(f"Insurance policy {policy_id} created for escrow {escrow_id}")
        
        return policy
    
    def file_claim(
        self,
        escrow_id: str,
        claimant_id: str,
        claimant_role: str,
        claim_type: ClaimType,
        claimed_amount: float,
        description: str,
        evidence: List[Dict[str, Any]] = None
    ) -> InsuranceClaim:
        """
        File an insurance claim.
        """
        # Get policy
        policy_id = self.escrow_policies.get(escrow_id)
        if not policy_id:
            raise ValueError(f"No insurance policy found for escrow {escrow_id}")
        
        policy = self.policies.get(policy_id)
        if not policy:
            raise ValueError(f"Policy {policy_id} not found")
        
        # Validate policy is active
        if not policy.active:
            raise ValueError("Insurance policy is no longer active")
        
        # Validate coverage
        if not self._is_covered(policy, claim_type):
            raise ValueError(f"Claim type {claim_type.value} is not covered by this policy")
        
        # Validate claimant
        if claimant_id not in [policy.buyer_id, policy.seller_id]:
            raise ValueError("Claimant is not a party to this policy")
        
        claim_id = f"CLM-{uuid.uuid4().hex[:12].upper()}"
        
        claim = InsuranceClaim(
            id=claim_id,
            policy_id=policy_id,
            escrow_id=escrow_id,
            claim_type=claim_type,
            status=ClaimStatus.SUBMITTED,
            claimant_id=claimant_id,
            claimant_role=claimant_role,
            claimed_amount=min(claimed_amount, policy.coverage_amount),
            description=description,
            evidence=evidence or []
        )
        
        self.claims[claim_id] = claim
        policy.claims_filed += 1
        
        logger.info(f"Insurance claim {claim_id} filed for policy {policy_id}")
        
        return claim
    
    def review_claim(
        self,
        claim_id: str,
        reviewer_id: str,
        approved: bool,
        approved_amount: float = None,
        review_notes: str = ""
    ) -> InsuranceClaim:
        """
        Review and approve/deny an insurance claim.
        """
        claim = self.claims.get(claim_id)
        if not claim:
            raise ValueError(f"Claim {claim_id} not found")
        
        policy = self.policies.get(claim.policy_id)
        if not policy:
            raise ValueError(f"Policy {claim.policy_id} not found")
        
        claim.reviewer_id = reviewer_id
        claim.review_notes = review_notes
        claim.reviewed_at = datetime.utcnow().isoformat()
        
        if approved:
            # Calculate payout
            if approved_amount is None:
                approved_amount = claim.claimed_amount
            
            approved_amount = min(approved_amount, policy.coverage_amount)
            deductible = approved_amount * (policy.deductible / policy.coverage_amount)
            payout = approved_amount - deductible
            
            claim.status = ClaimStatus.APPROVED
            claim.approved_amount = approved_amount
            claim.deductible_applied = deductible
            claim.payout_amount = payout
            
            logger.info(f"Claim {claim_id} approved for ₦{payout:,.0f}")
        else:
            claim.status = ClaimStatus.DENIED
            logger.info(f"Claim {claim_id} denied: {review_notes}")
        
        return claim
    
    def process_payout(self, claim_id: str) -> Dict[str, Any]:
        """
        Process payout for an approved claim.
        """
        claim = self.claims.get(claim_id)
        if not claim:
            return {"success": False, "error": "Claim not found"}
        
        if claim.status != ClaimStatus.APPROVED:
            return {"success": False, "error": "Claim is not approved"}
        
        policy = self.policies.get(claim.policy_id)
        
        # Check pool balance
        if self.pool_balance < claim.payout_amount:
            return {
                "success": False,
                "error": "Insufficient pool balance",
                "pool_balance": self.pool_balance,
                "payout_amount": claim.payout_amount
            }
        
        # Process payout
        self.pool_balance -= claim.payout_amount
        self.total_claims_paid += claim.payout_amount
        
        claim.status = ClaimStatus.PAID
        claim.paid_at = datetime.utcnow().isoformat()
        
        if policy:
            policy.claims_paid += claim.payout_amount
        
        logger.info(f"Claim {claim_id} paid: ₦{claim.payout_amount:,.0f}")
        
        return {
            "success": True,
            "claim_id": claim_id,
            "payout_amount": claim.payout_amount,
            "claimant_id": claim.claimant_id,
            "pool_balance_after": self.pool_balance
        }
    
    def get_policy(self, escrow_id: str) -> Optional[InsurancePolicy]:
        """Get policy by escrow ID"""
        policy_id = self.escrow_policies.get(escrow_id)
        if policy_id:
            return self.policies.get(policy_id)
        return None
    
    def get_claim(self, claim_id: str) -> Optional[InsuranceClaim]:
        """Get claim by ID"""
        return self.claims.get(claim_id)
    
    def get_user_claims(self, user_id: str) -> List[InsuranceClaim]:
        """Get all claims for a user"""
        return [c for c in self.claims.values() if c.claimant_id == user_id]
    
    def get_pool_stats(self) -> Dict[str, Any]:
        """
        Get insurance pool statistics.
        """
        active_policies = sum(1 for p in self.policies.values() if p.active)
        pending_claims = sum(1 for c in self.claims.values() 
                           if c.status in [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW])
        
        # Calculate loss ratio
        if self.total_premiums_collected > 0:
            loss_ratio = self.total_claims_paid / self.total_premiums_collected
        else:
            loss_ratio = 0.0
        
        return {
            "pool_balance": self.pool_balance,
            "total_premiums_collected": self.total_premiums_collected,
            "total_claims_paid": self.total_claims_paid,
            "total_platform_contributions": self.total_platform_contributions,
            "active_policies": active_policies,
            "total_policies": len(self.policies),
            "pending_claims": pending_claims,
            "total_claims": len(self.claims),
            "loss_ratio": loss_ratio,
            "pool_health": "healthy" if loss_ratio < 0.7 else "warning" if loss_ratio < 0.9 else "critical"
        }
    
    def get_coverage_recommendation(
        self,
        amount: float,
        seller_rating: float = None,
        seller_transaction_count: int = None,
        is_first_transaction: bool = False
    ) -> Dict[str, Any]:
        """
        Recommend insurance tier based on transaction characteristics.
        """
        # High-value transactions
        if amount > 500000:
            recommended_tier = InsuranceTier.PREMIUM
            reason = "High-value transaction - maximum protection recommended"
        
        # New seller or low rating
        elif is_first_transaction or (seller_rating and seller_rating < 4.0):
            recommended_tier = InsuranceTier.STANDARD
            reason = "New or lower-rated seller - standard protection recommended"
        
        # Low transaction count
        elif seller_transaction_count and seller_transaction_count < 10:
            recommended_tier = InsuranceTier.STANDARD
            reason = "Seller has limited transaction history"
        
        # Medium value
        elif amount > 50000:
            recommended_tier = InsuranceTier.STANDARD
            reason = "Medium-value transaction - standard protection recommended"
        
        # Low value
        else:
            recommended_tier = InsuranceTier.BASIC
            reason = "Low-value transaction - basic protection sufficient"
        
        # Calculate all tier options
        options = {}
        for tier in InsuranceTier:
            options[tier.value] = self.calculate_premium(amount, tier)
        
        return {
            "recommended_tier": recommended_tier.value,
            "recommendation_reason": reason,
            "options": options
        }
    
    def _is_covered(self, policy: InsurancePolicy, claim_type: ClaimType) -> bool:
        """Check if claim type is covered by policy"""
        coverage_map = {
            ClaimType.ITEM_NOT_RECEIVED: True,  # Always covered
            ClaimType.ITEM_DAMAGED: policy.covers_shipping_damage,
            ClaimType.ITEM_LOST_IN_TRANSIT: policy.covers_shipping_loss,
            ClaimType.SELLER_FRAUD: policy.covers_fraud,
            ClaimType.BUYER_FRAUD: policy.covers_fraud,
            ClaimType.COUNTERFEIT_ITEM: policy.covers_counterfeit,
            ClaimType.FORCE_MAJEURE: policy.covers_force_majeure,
        }
        return coverage_map.get(claim_type, False)
    
    def expire_policy(self, escrow_id: str):
        """
        Expire a policy when escrow completes successfully.
        """
        policy_id = self.escrow_policies.get(escrow_id)
        if policy_id:
            policy = self.policies.get(policy_id)
            if policy:
                policy.active = False
                logger.info(f"Policy {policy_id} expired for escrow {escrow_id}")


# Global insurance pool service instance
insurance_pool = InsurancePoolService()
