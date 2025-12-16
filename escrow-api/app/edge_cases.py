"""
Edge Case Handlers for EscrowProtect
Comprehensive handling of edge cases across all platform features

Covers:
- Agent liquidity and float management
- Agent fraud prevention and reputation
- Partial payments (cash + mobile money)
- Insurance edge cases (reinsurance, claim limits)
- Voice note confirmation and fallback
- Fraud detection appeals
- Cross-border transactions
- Seller onboarding edge cases
"""

import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# ============================================
# AGENT LIQUIDITY MANAGEMENT
# ============================================

class FloatStatus(str, Enum):
    HEALTHY = "healthy"       # > 80% of target
    LOW = "low"               # 50-80% of target
    CRITICAL = "critical"     # < 50% of target
    DEPLETED = "depleted"     # Cannot service transactions

@dataclass
class AgentFloat:
    """Agent's cash float for transactions"""
    agent_id: str
    current_balance: float
    target_balance: float
    min_balance: float
    last_replenished: str
    daily_volume: float = 0.0
    pending_payouts: float = 0.0
    
    @property
    def available_balance(self) -> float:
        return self.current_balance - self.pending_payouts
    
    @property
    def status(self) -> FloatStatus:
        ratio = self.available_balance / self.target_balance
        if ratio > 0.8:
            return FloatStatus.HEALTHY
        elif ratio > 0.5:
            return FloatStatus.LOW
        elif ratio > 0:
            return FloatStatus.CRITICAL
        else:
            return FloatStatus.DEPLETED

class AgentLiquidityService:
    """
    Manages agent float/liquidity for cash transactions.
    
    Features:
    - Real-time float tracking
    - Low balance alerts
    - Automatic backup agent routing
    - Float replenishment scheduling
    """
    
    # Default float targets by agent type
    DEFAULT_TARGETS = {
        "pos_operator": 200000,      # ₦200,000
        "mobile_money": 300000,      # ₦300,000
        "bank_agent": 500000,        # ₦500,000
        "opay_agent": 250000,        # ₦250,000
        "palmpay_agent": 250000,     # ₦250,000
        "moniepoint_agent": 300000,  # ₦300,000
    }
    
    def __init__(self):
        self.floats: Dict[str, AgentFloat] = {}
        self.alerts: List[Dict[str, Any]] = []
        self.replenishment_requests: List[Dict[str, Any]] = []
    
    def initialize_float(
        self,
        agent_id: str,
        agent_type: str,
        initial_balance: float = None
    ) -> AgentFloat:
        """Initialize float tracking for an agent"""
        target = self.DEFAULT_TARGETS.get(agent_type, 200000)
        
        agent_float = AgentFloat(
            agent_id=agent_id,
            current_balance=initial_balance or target,
            target_balance=target,
            min_balance=target * 0.2,  # 20% of target
            last_replenished=datetime.utcnow().isoformat()
        )
        
        self.floats[agent_id] = agent_float
        return agent_float
    
    def check_availability(
        self,
        agent_id: str,
        amount: float
    ) -> Dict[str, Any]:
        """Check if agent can handle a cash-out transaction"""
        agent_float = self.floats.get(agent_id)
        
        if not agent_float:
            return {
                "available": False,
                "reason": "Agent float not initialized",
                "suggest_backup": True
            }
        
        if agent_float.available_balance < amount:
            return {
                "available": False,
                "reason": f"Insufficient float. Available: ₦{agent_float.available_balance:,.0f}, Required: ₦{amount:,.0f}",
                "current_balance": agent_float.available_balance,
                "required": amount,
                "shortfall": amount - agent_float.available_balance,
                "suggest_backup": True
            }
        
        return {
            "available": True,
            "current_balance": agent_float.available_balance,
            "after_transaction": agent_float.available_balance - amount
        }
    
    def reserve_float(self, agent_id: str, amount: float, transaction_id: str) -> bool:
        """Reserve float for a pending payout"""
        agent_float = self.floats.get(agent_id)
        if not agent_float or agent_float.available_balance < amount:
            return False
        
        agent_float.pending_payouts += amount
        
        # Check if this puts us in low/critical status
        if agent_float.status in [FloatStatus.LOW, FloatStatus.CRITICAL]:
            self._create_low_balance_alert(agent_id, agent_float)
        
        return True
    
    def complete_payout(self, agent_id: str, amount: float, transaction_id: str):
        """Complete a payout and update float"""
        agent_float = self.floats.get(agent_id)
        if agent_float:
            agent_float.current_balance -= amount
            agent_float.pending_payouts -= amount
            agent_float.daily_volume += amount
    
    def receive_cash_in(self, agent_id: str, amount: float, transaction_id: str):
        """Record cash-in which increases agent float"""
        agent_float = self.floats.get(agent_id)
        if agent_float:
            agent_float.current_balance += amount
            agent_float.daily_volume += amount
    
    def find_backup_agents(
        self,
        original_agent_id: str,
        amount: float,
        latitude: float,
        longitude: float,
        max_distance_km: float = 10.0
    ) -> List[str]:
        """Find backup agents with sufficient float"""
        backup_agents = []
        
        for agent_id, agent_float in self.floats.items():
            if agent_id == original_agent_id:
                continue
            
            if agent_float.available_balance >= amount:
                backup_agents.append(agent_id)
        
        return backup_agents
    
    def request_replenishment(self, agent_id: str, amount: float = None):
        """Request float replenishment for an agent"""
        agent_float = self.floats.get(agent_id)
        if not agent_float:
            return
        
        replenish_amount = amount or (agent_float.target_balance - agent_float.current_balance)
        
        request = {
            "id": f"REP-{uuid.uuid4().hex[:8].upper()}",
            "agent_id": agent_id,
            "amount": replenish_amount,
            "current_balance": agent_float.current_balance,
            "target_balance": agent_float.target_balance,
            "requested_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }
        
        self.replenishment_requests.append(request)
        logger.info(f"Replenishment requested for agent {agent_id}: ₦{replenish_amount:,.0f}")
        
        return request
    
    def _create_low_balance_alert(self, agent_id: str, agent_float: AgentFloat):
        """Create alert for low balance"""
        alert = {
            "id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
            "agent_id": agent_id,
            "type": "low_balance",
            "severity": "warning" if agent_float.status == FloatStatus.LOW else "critical",
            "message": f"Agent float is {agent_float.status.value}. Balance: ₦{agent_float.available_balance:,.0f}",
            "created_at": datetime.utcnow().isoformat()
        }
        self.alerts.append(alert)
        
        # Auto-request replenishment for critical status
        if agent_float.status == FloatStatus.CRITICAL:
            self.request_replenishment(agent_id)


# ============================================
# AGENT FRAUD PREVENTION & REPUTATION
# ============================================

class AgentReputationLevel(str, Enum):
    NEW = "new"               # < 10 transactions
    BRONZE = "bronze"         # 10-50 transactions
    SILVER = "silver"         # 50-200 transactions
    GOLD = "gold"             # 200+ transactions, high rating
    SUSPENDED = "suspended"   # Under investigation
    BANNED = "banned"         # Permanently banned

@dataclass
class AgentReputation:
    """Agent reputation and trust score"""
    agent_id: str
    level: AgentReputationLevel
    trust_score: float  # 0-100
    total_transactions: int
    successful_transactions: int
    disputed_transactions: int
    fraud_reports: int
    average_rating: float
    transaction_limit: float  # Max single transaction
    daily_limit: float        # Max daily volume
    created_at: str
    last_updated: str

class AgentFraudPreventionService:
    """
    Prevents agent fraud through:
    - Transaction limits based on reputation
    - Escrow for agent commissions (held until confirmed)
    - Multi-party verification for high-value transactions
    - Fraud pattern detection
    - Reputation scoring
    """
    
    # Transaction limits by reputation level
    TRANSACTION_LIMITS = {
        AgentReputationLevel.NEW: 50000,        # ₦50,000
        AgentReputationLevel.BRONZE: 200000,    # ₦200,000
        AgentReputationLevel.SILVER: 500000,    # ₦500,000
        AgentReputationLevel.GOLD: 2000000,     # ₦2,000,000
    }
    
    DAILY_LIMITS = {
        AgentReputationLevel.NEW: 200000,       # ₦200,000
        AgentReputationLevel.BRONZE: 1000000,   # ₦1,000,000
        AgentReputationLevel.SILVER: 3000000,   # ₦3,000,000
        AgentReputationLevel.GOLD: 10000000,    # ₦10,000,000
    }
    
    def __init__(self):
        self.reputations: Dict[str, AgentReputation] = {}
        self.commission_escrows: Dict[str, Dict[str, Any]] = {}
        self.fraud_reports: List[Dict[str, Any]] = []
        self.agent_disputes: List[Dict[str, Any]] = []
    
    def initialize_reputation(self, agent_id: str) -> AgentReputation:
        """Initialize reputation for new agent"""
        reputation = AgentReputation(
            agent_id=agent_id,
            level=AgentReputationLevel.NEW,
            trust_score=50.0,  # Start at neutral
            total_transactions=0,
            successful_transactions=0,
            disputed_transactions=0,
            fraud_reports=0,
            average_rating=5.0,
            transaction_limit=self.TRANSACTION_LIMITS[AgentReputationLevel.NEW],
            daily_limit=self.DAILY_LIMITS[AgentReputationLevel.NEW],
            created_at=datetime.utcnow().isoformat(),
            last_updated=datetime.utcnow().isoformat()
        )
        
        self.reputations[agent_id] = reputation
        return reputation
    
    def check_transaction_allowed(
        self,
        agent_id: str,
        amount: float,
        daily_volume_so_far: float = 0
    ) -> Dict[str, Any]:
        """Check if agent can process this transaction"""
        reputation = self.reputations.get(agent_id)
        
        if not reputation:
            return {
                "allowed": False,
                "reason": "Agent not registered"
            }
        
        if reputation.level in [AgentReputationLevel.SUSPENDED, AgentReputationLevel.BANNED]:
            return {
                "allowed": False,
                "reason": f"Agent is {reputation.level.value}"
            }
        
        if amount > reputation.transaction_limit:
            return {
                "allowed": False,
                "reason": f"Amount exceeds transaction limit of ₦{reputation.transaction_limit:,.0f}",
                "limit": reputation.transaction_limit,
                "requested": amount
            }
        
        if daily_volume_so_far + amount > reputation.daily_limit:
            return {
                "allowed": False,
                "reason": f"Would exceed daily limit of ₦{reputation.daily_limit:,.0f}",
                "daily_limit": reputation.daily_limit,
                "current_volume": daily_volume_so_far,
                "requested": amount
            }
        
        # High-value transactions require additional verification
        requires_verification = amount > 500000 or reputation.level == AgentReputationLevel.NEW
        
        return {
            "allowed": True,
            "requires_verification": requires_verification,
            "verification_type": "otp" if requires_verification else None
        }
    
    def escrow_commission(
        self,
        transaction_id: str,
        agent_id: str,
        commission_amount: float
    ) -> str:
        """Hold agent commission in escrow until transaction confirmed"""
        escrow_id = f"ACE-{uuid.uuid4().hex[:8].upper()}"
        
        self.commission_escrows[escrow_id] = {
            "id": escrow_id,
            "transaction_id": transaction_id,
            "agent_id": agent_id,
            "amount": commission_amount,
            "status": "held",
            "created_at": datetime.utcnow().isoformat()
        }
        
        return escrow_id
    
    def release_commission(self, escrow_id: str) -> bool:
        """Release commission to agent after successful transaction"""
        escrow = self.commission_escrows.get(escrow_id)
        if not escrow or escrow["status"] != "held":
            return False
        
        escrow["status"] = "released"
        escrow["released_at"] = datetime.utcnow().isoformat()
        
        # Update agent reputation
        self._record_successful_transaction(escrow["agent_id"])
        
        return True
    
    def forfeit_commission(self, escrow_id: str, reason: str) -> bool:
        """Forfeit commission due to agent misconduct"""
        escrow = self.commission_escrows.get(escrow_id)
        if not escrow or escrow["status"] != "held":
            return False
        
        escrow["status"] = "forfeited"
        escrow["forfeited_at"] = datetime.utcnow().isoformat()
        escrow["reason"] = reason
        
        # Update agent reputation negatively
        self._record_disputed_transaction(escrow["agent_id"])
        
        return True
    
    def report_agent_fraud(
        self,
        agent_id: str,
        reporter_id: str,
        fraud_type: str,
        description: str,
        evidence: List[Dict[str, Any]] = None
    ) -> str:
        """Report suspected agent fraud"""
        report_id = f"AFR-{uuid.uuid4().hex[:8].upper()}"
        
        report = {
            "id": report_id,
            "agent_id": agent_id,
            "reporter_id": reporter_id,
            "fraud_type": fraud_type,
            "description": description,
            "evidence": evidence or [],
            "status": "pending_review",
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.fraud_reports.append(report)
        
        # Update reputation
        reputation = self.reputations.get(agent_id)
        if reputation:
            reputation.fraud_reports += 1
            reputation.trust_score = max(0, reputation.trust_score - 10)
            
            # Auto-suspend after 3 reports
            if reputation.fraud_reports >= 3:
                reputation.level = AgentReputationLevel.SUSPENDED
                logger.warning(f"Agent {agent_id} auto-suspended due to fraud reports")
        
        return report_id
    
    def open_agent_dispute(
        self,
        transaction_id: str,
        agent_id: str,
        complainant_id: str,
        complainant_role: str,
        dispute_type: str,
        description: str
    ) -> str:
        """Open dispute against agent"""
        dispute_id = f"ADI-{uuid.uuid4().hex[:8].upper()}"
        
        dispute = {
            "id": dispute_id,
            "transaction_id": transaction_id,
            "agent_id": agent_id,
            "complainant_id": complainant_id,
            "complainant_role": complainant_role,
            "dispute_type": dispute_type,
            "description": description,
            "status": "open",
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.agent_disputes.append(dispute)
        
        # Update reputation
        reputation = self.reputations.get(agent_id)
        if reputation:
            reputation.disputed_transactions += 1
            reputation.trust_score = max(0, reputation.trust_score - 5)
        
        return dispute_id
    
    def _record_successful_transaction(self, agent_id: str):
        """Record successful transaction and update reputation"""
        reputation = self.reputations.get(agent_id)
        if not reputation:
            return
        
        reputation.total_transactions += 1
        reputation.successful_transactions += 1
        reputation.trust_score = min(100, reputation.trust_score + 1)
        reputation.last_updated = datetime.utcnow().isoformat()
        
        # Level up based on transaction count
        self._update_level(reputation)
    
    def _record_disputed_transaction(self, agent_id: str):
        """Record disputed transaction"""
        reputation = self.reputations.get(agent_id)
        if not reputation:
            return
        
        reputation.total_transactions += 1
        reputation.disputed_transactions += 1
        reputation.trust_score = max(0, reputation.trust_score - 5)
        reputation.last_updated = datetime.utcnow().isoformat()
    
    def _update_level(self, reputation: AgentReputation):
        """Update agent level based on performance"""
        if reputation.level in [AgentReputationLevel.SUSPENDED, AgentReputationLevel.BANNED]:
            return
        
        success_rate = reputation.successful_transactions / max(reputation.total_transactions, 1)
        
        if reputation.total_transactions >= 200 and success_rate >= 0.98 and reputation.trust_score >= 80:
            reputation.level = AgentReputationLevel.GOLD
        elif reputation.total_transactions >= 50 and success_rate >= 0.95:
            reputation.level = AgentReputationLevel.SILVER
        elif reputation.total_transactions >= 10 and success_rate >= 0.90:
            reputation.level = AgentReputationLevel.BRONZE
        
        # Update limits
        reputation.transaction_limit = self.TRANSACTION_LIMITS.get(reputation.level, 50000)
        reputation.daily_limit = self.DAILY_LIMITS.get(reputation.level, 200000)


# ============================================
# PARTIAL PAYMENT SUPPORT
# ============================================

class PaymentMethod(str, Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    OPAY = "opay"
    PALMPAY = "palmpay"
    KUDA = "kuda"
    MONIEPOINT = "moniepoint"
    USSD = "ussd"

@dataclass
class PartialPayment:
    """Individual payment in a split payment"""
    id: str
    method: PaymentMethod
    amount: float
    status: str  # pending, completed, failed
    reference: Optional[str] = None
    completed_at: Optional[str] = None

@dataclass
class SplitPayment:
    """Split payment across multiple methods"""
    id: str
    escrow_id: str
    total_amount: float
    payments: List[PartialPayment]
    status: str  # pending, partial, completed, failed
    created_at: str
    
    @property
    def paid_amount(self) -> float:
        return sum(p.amount for p in self.payments if p.status == "completed")
    
    @property
    def remaining_amount(self) -> float:
        return self.total_amount - self.paid_amount

class SplitPaymentService:
    """
    Handles partial/split payments across multiple methods.
    
    Use cases:
    - Buyer has ₦80k cash but needs to pay ₦100k (cash + mobile money)
    - Buyer wants to pay part now, part later (layaway)
    - Multiple buyers contributing to one purchase
    """
    
    def __init__(self):
        self.split_payments: Dict[str, SplitPayment] = {}
    
    def create_split_payment(
        self,
        escrow_id: str,
        total_amount: float,
        payment_plan: List[Dict[str, Any]]
    ) -> SplitPayment:
        """
        Create a split payment plan.
        
        payment_plan example:
        [
            {"method": "cash", "amount": 80000},
            {"method": "opay", "amount": 20000}
        ]
        """
        split_id = f"SPL-{uuid.uuid4().hex[:8].upper()}"
        
        # Validate total matches
        plan_total = sum(p["amount"] for p in payment_plan)
        if abs(plan_total - total_amount) > 1:  # Allow ₦1 rounding
            raise ValueError(f"Payment plan total ₦{plan_total:,.0f} doesn't match required ₦{total_amount:,.0f}")
        
        payments = []
        for i, plan in enumerate(payment_plan):
            payment = PartialPayment(
                id=f"{split_id}-{i+1}",
                method=PaymentMethod(plan["method"]),
                amount=plan["amount"],
                status="pending"
            )
            payments.append(payment)
        
        split_payment = SplitPayment(
            id=split_id,
            escrow_id=escrow_id,
            total_amount=total_amount,
            payments=payments,
            status="pending",
            created_at=datetime.utcnow().isoformat()
        )
        
        self.split_payments[split_id] = split_payment
        return split_payment
    
    def record_payment(
        self,
        split_id: str,
        payment_id: str,
        reference: str = None
    ) -> Dict[str, Any]:
        """Record completion of a partial payment"""
        split_payment = self.split_payments.get(split_id)
        if not split_payment:
            return {"success": False, "error": "Split payment not found"}
        
        # Find and update the payment
        for payment in split_payment.payments:
            if payment.id == payment_id:
                payment.status = "completed"
                payment.reference = reference
                payment.completed_at = datetime.utcnow().isoformat()
                break
        
        # Update overall status
        completed_count = sum(1 for p in split_payment.payments if p.status == "completed")
        if completed_count == len(split_payment.payments):
            split_payment.status = "completed"
        elif completed_count > 0:
            split_payment.status = "partial"
        
        return {
            "success": True,
            "split_id": split_id,
            "payment_id": payment_id,
            "paid_amount": split_payment.paid_amount,
            "remaining_amount": split_payment.remaining_amount,
            "status": split_payment.status
        }
    
    def get_payment_instructions(self, split_payment: SplitPayment) -> List[Dict[str, Any]]:
        """Get instructions for each payment method"""
        instructions = []
        
        for payment in split_payment.payments:
            if payment.status != "pending":
                continue
            
            if payment.method == PaymentMethod.CASH:
                instructions.append({
                    "payment_id": payment.id,
                    "method": "cash",
                    "amount": payment.amount,
                    "instruction": f"Visit nearest agent with ₦{payment.amount:,.0f} cash"
                })
            elif payment.method in [PaymentMethod.OPAY, PaymentMethod.PALMPAY, PaymentMethod.KUDA]:
                instructions.append({
                    "payment_id": payment.id,
                    "method": payment.method.value,
                    "amount": payment.amount,
                    "instruction": f"Transfer ₦{payment.amount:,.0f} via {payment.method.value.upper()}"
                })
            elif payment.method == PaymentMethod.BANK_TRANSFER:
                instructions.append({
                    "payment_id": payment.id,
                    "method": "bank_transfer",
                    "amount": payment.amount,
                    "instruction": f"Transfer ₦{payment.amount:,.0f} to escrow account"
                })
        
        return instructions


# ============================================
# INSURANCE EDGE CASES
# ============================================

class ReinsuranceService:
    """
    Handles insurance edge cases:
    - Claims exceeding pool balance
    - Multiple claims on same escrow
    - Reinsurance for catastrophic losses
    """
    
    # Reinsurance kicks in above this threshold
    REINSURANCE_THRESHOLD = 5000000  # ₦5,000,000
    
    # Maximum claim per escrow
    MAX_CLAIM_PER_ESCROW = 2000000  # ₦2,000,000
    
    # Waiting period before claim payout
    CLAIM_WAITING_PERIOD_DAYS = 3
    
    def __init__(self):
        self.escrow_claims: Dict[str, List[str]] = {}  # escrow_id -> [claim_ids]
        self.reinsurance_claims: List[Dict[str, Any]] = []
    
    def check_claim_eligibility(
        self,
        escrow_id: str,
        claim_amount: float,
        pool_balance: float
    ) -> Dict[str, Any]:
        """Check if claim is eligible and how it should be processed"""
        
        # Check for duplicate claims
        existing_claims = self.escrow_claims.get(escrow_id, [])
        if len(existing_claims) >= 2:
            return {
                "eligible": False,
                "reason": "Maximum claims per escrow reached (2)",
                "existing_claims": existing_claims
            }
        
        # Check claim amount limit
        if claim_amount > self.MAX_CLAIM_PER_ESCROW:
            return {
                "eligible": True,
                "capped": True,
                "original_amount": claim_amount,
                "approved_amount": self.MAX_CLAIM_PER_ESCROW,
                "reason": f"Claim capped at maximum ₦{self.MAX_CLAIM_PER_ESCROW:,.0f}"
            }
        
        # Check if reinsurance needed
        if claim_amount > pool_balance:
            if claim_amount > self.REINSURANCE_THRESHOLD:
                return {
                    "eligible": True,
                    "requires_reinsurance": True,
                    "pool_portion": pool_balance * 0.8,  # 80% from pool
                    "reinsurance_portion": claim_amount - (pool_balance * 0.8),
                    "reason": "Claim exceeds pool balance, reinsurance required"
                }
            else:
                return {
                    "eligible": True,
                    "partial_payout": True,
                    "approved_amount": pool_balance * 0.5,  # 50% of pool
                    "reason": "Partial payout due to pool constraints"
                }
        
        return {
            "eligible": True,
            "approved_amount": claim_amount,
            "waiting_period_days": self.CLAIM_WAITING_PERIOD_DAYS
        }
    
    def record_claim(self, escrow_id: str, claim_id: str):
        """Record claim against escrow"""
        if escrow_id not in self.escrow_claims:
            self.escrow_claims[escrow_id] = []
        self.escrow_claims[escrow_id].append(claim_id)
    
    def submit_reinsurance_claim(
        self,
        claim_id: str,
        amount: float,
        reason: str
    ) -> str:
        """Submit claim to reinsurance provider"""
        reinsurance_id = f"RIN-{uuid.uuid4().hex[:8].upper()}"
        
        self.reinsurance_claims.append({
            "id": reinsurance_id,
            "original_claim_id": claim_id,
            "amount": amount,
            "reason": reason,
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat()
        })
        
        logger.info(f"Reinsurance claim {reinsurance_id} submitted for ₦{amount:,.0f}")
        return reinsurance_id


# ============================================
# VOICE NOTE CONFIRMATION & FALLBACK
# ============================================

class VoiceConfirmationService:
    """
    Handles voice note edge cases:
    - Transcription confirmation before action
    - Fallback to text input
    - Audio quality checks
    """
    
    # Minimum confidence for auto-action
    MIN_CONFIDENCE_AUTO = 0.85
    
    # Minimum confidence for confirmation prompt
    MIN_CONFIDENCE_CONFIRM = 0.60
    
    def __init__(self):
        self.pending_confirmations: Dict[str, Dict[str, Any]] = {}
    
    def process_voice_command(
        self,
        transcription: str,
        confidence: float,
        parsed_command: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process voice command with appropriate confirmation level.
        """
        command_type = parsed_command.get("type", "unknown")
        
        # High confidence - auto-execute
        if confidence >= self.MIN_CONFIDENCE_AUTO:
            return {
                "action": "execute",
                "command": parsed_command,
                "message": f"Executing: {command_type}"
            }
        
        # Medium confidence - confirm
        if confidence >= self.MIN_CONFIDENCE_CONFIRM:
            confirmation_id = f"VCF-{uuid.uuid4().hex[:8].upper()}"
            
            self.pending_confirmations[confirmation_id] = {
                "transcription": transcription,
                "command": parsed_command,
                "confidence": confidence,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat()
            }
            
            return {
                "action": "confirm",
                "confirmation_id": confirmation_id,
                "transcription": transcription,
                "command": parsed_command,
                "message": f"I heard: '{transcription}'\nDid you mean to {command_type}? Reply YES to confirm or type your command."
            }
        
        # Low confidence - fallback to text
        return {
            "action": "fallback",
            "message": "I couldn't understand that clearly. Please type your command instead:\n- ESCROW [amount] [phone]\n- STATUS [escrow_id]\n- HELP"
        }
    
    def confirm_command(self, confirmation_id: str) -> Optional[Dict[str, Any]]:
        """Confirm a pending voice command"""
        pending = self.pending_confirmations.get(confirmation_id)
        if not pending:
            return None
        
        # Check expiration
        if datetime.utcnow() > datetime.fromisoformat(pending["expires_at"]):
            del self.pending_confirmations[confirmation_id]
            return None
        
        command = pending["command"]
        del self.pending_confirmations[confirmation_id]
        
        return command
    
    def check_audio_quality(
        self,
        duration_seconds: float,
        sample_rate: int = None,
        noise_level: float = None
    ) -> Dict[str, Any]:
        """Check if audio quality is sufficient for transcription"""
        issues = []
        
        if duration_seconds < 1:
            issues.append("Audio too short (minimum 1 second)")
        
        if duration_seconds > 60:
            issues.append("Audio too long (maximum 60 seconds)")
        
        if noise_level and noise_level > 0.7:
            issues.append("High background noise detected")
        
        if issues:
            return {
                "quality": "poor",
                "issues": issues,
                "suggestion": "Please record in a quieter environment or type your command"
            }
        
        return {"quality": "good"}


# ============================================
# FRAUD DETECTION APPEALS
# ============================================

class FraudAppealStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DENIED = "denied"

@dataclass
class FraudAppeal:
    """Appeal against fraud detection decision"""
    id: str
    user_id: str
    original_decision: str
    risk_score: float
    appeal_reason: str
    evidence: List[Dict[str, Any]]
    status: FraudAppealStatus
    created_at: str
    reviewed_at: Optional[str] = None
    reviewer_id: Optional[str] = None
    review_notes: str = ""

class FraudAppealService:
    """
    Handles appeals against fraud detection false positives.
    """
    
    def __init__(self):
        self.appeals: Dict[str, FraudAppeal] = {}
        self.user_appeals: Dict[str, List[str]] = {}  # user_id -> [appeal_ids]
    
    def submit_appeal(
        self,
        user_id: str,
        original_decision: str,
        risk_score: float,
        appeal_reason: str,
        evidence: List[Dict[str, Any]] = None
    ) -> FraudAppeal:
        """Submit appeal against fraud detection decision"""
        
        # Check for existing pending appeals
        existing = self.user_appeals.get(user_id, [])
        pending = [a for a in existing if self.appeals.get(a, {}).status == FraudAppealStatus.SUBMITTED]
        if len(pending) >= 2:
            raise ValueError("Maximum 2 pending appeals allowed")
        
        appeal_id = f"FAP-{uuid.uuid4().hex[:8].upper()}"
        
        appeal = FraudAppeal(
            id=appeal_id,
            user_id=user_id,
            original_decision=original_decision,
            risk_score=risk_score,
            appeal_reason=appeal_reason,
            evidence=evidence or [],
            status=FraudAppealStatus.SUBMITTED,
            created_at=datetime.utcnow().isoformat()
        )
        
        self.appeals[appeal_id] = appeal
        
        if user_id not in self.user_appeals:
            self.user_appeals[user_id] = []
        self.user_appeals[user_id].append(appeal_id)
        
        return appeal
    
    def review_appeal(
        self,
        appeal_id: str,
        reviewer_id: str,
        approved: bool,
        review_notes: str = ""
    ) -> FraudAppeal:
        """Review and decide on appeal"""
        appeal = self.appeals.get(appeal_id)
        if not appeal:
            raise ValueError("Appeal not found")
        
        appeal.status = FraudAppealStatus.APPROVED if approved else FraudAppealStatus.DENIED
        appeal.reviewed_at = datetime.utcnow().isoformat()
        appeal.reviewer_id = reviewer_id
        appeal.review_notes = review_notes
        
        return appeal
    
    def get_user_appeals(self, user_id: str) -> List[FraudAppeal]:
        """Get all appeals for a user"""
        appeal_ids = self.user_appeals.get(user_id, [])
        return [self.appeals[aid] for aid in appeal_ids if aid in self.appeals]


# ============================================
# CROSS-BORDER TRANSACTIONS
# ============================================

class Currency(str, Enum):
    NGN = "NGN"  # Nigerian Naira
    GHS = "GHS"  # Ghanaian Cedi
    KES = "KES"  # Kenyan Shilling
    ZAR = "ZAR"  # South African Rand
    USD = "USD"  # US Dollar

@dataclass
class ExchangeRate:
    """Currency exchange rate"""
    from_currency: Currency
    to_currency: Currency
    rate: float
    updated_at: str

class CrossBorderService:
    """
    Handles cross-border transactions between African countries.
    
    Supported corridors:
    - Nigeria <-> Ghana
    - Nigeria <-> Kenya
    - Nigeria <-> South Africa
    """
    
    # Sample exchange rates (would be fetched from API in production)
    EXCHANGE_RATES = {
        ("NGN", "GHS"): 0.0076,    # 1 NGN = 0.0076 GHS
        ("NGN", "KES"): 0.086,     # 1 NGN = 0.086 KES
        ("NGN", "ZAR"): 0.012,     # 1 NGN = 0.012 ZAR
        ("NGN", "USD"): 0.00065,   # 1 NGN = 0.00065 USD
        ("GHS", "NGN"): 131.58,
        ("KES", "NGN"): 11.63,
        ("ZAR", "NGN"): 83.33,
        ("USD", "NGN"): 1538.46,
    }
    
    # Cross-border fees
    CROSS_BORDER_FEE_RATE = 0.025  # 2.5%
    
    def __init__(self):
        self.transactions: Dict[str, Dict[str, Any]] = {}
    
    def get_exchange_rate(
        self,
        from_currency: Currency,
        to_currency: Currency
    ) -> float:
        """Get current exchange rate"""
        key = (from_currency.value, to_currency.value)
        return self.EXCHANGE_RATES.get(key, 1.0)
    
    def calculate_cross_border_amount(
        self,
        amount: float,
        from_currency: Currency,
        to_currency: Currency
    ) -> Dict[str, Any]:
        """Calculate cross-border transaction amounts"""
        rate = self.get_exchange_rate(from_currency, to_currency)
        converted_amount = amount * rate
        fee = amount * self.CROSS_BORDER_FEE_RATE
        fee_converted = fee * rate
        
        return {
            "original_amount": amount,
            "original_currency": from_currency.value,
            "converted_amount": converted_amount,
            "target_currency": to_currency.value,
            "exchange_rate": rate,
            "cross_border_fee": fee,
            "cross_border_fee_converted": fee_converted,
            "total_cost": amount + fee,
            "seller_receives": converted_amount - fee_converted
        }
    
    def create_cross_border_escrow(
        self,
        buyer_country: str,
        seller_country: str,
        amount: float,
        buyer_currency: Currency,
        seller_currency: Currency
    ) -> Dict[str, Any]:
        """Create cross-border escrow transaction"""
        transaction_id = f"CBX-{uuid.uuid4().hex[:8].upper()}"
        
        calculation = self.calculate_cross_border_amount(
            amount, buyer_currency, seller_currency
        )
        
        transaction = {
            "id": transaction_id,
            "buyer_country": buyer_country,
            "seller_country": seller_country,
            "buyer_currency": buyer_currency.value,
            "seller_currency": seller_currency.value,
            "buyer_amount": calculation["total_cost"],
            "seller_amount": calculation["seller_receives"],
            "exchange_rate": calculation["exchange_rate"],
            "cross_border_fee": calculation["cross_border_fee"],
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.transactions[transaction_id] = transaction
        return transaction


# ============================================
# GLOBAL SERVICE INSTANCES
# ============================================

agent_liquidity = AgentLiquidityService()
agent_fraud_prevention = AgentFraudPreventionService()
split_payment_service = SplitPaymentService()
reinsurance_service = ReinsuranceService()
voice_confirmation = VoiceConfirmationService()
fraud_appeal_service = FraudAppealService()
cross_border_service = CrossBorderService()
