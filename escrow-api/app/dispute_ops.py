"""
Dispute Operations Workflow

Provides mature dispute resolution with:
- Clear SLAs and evidence standards
- Arbitration workflow
- Escalation paths
- Resolution tracking
- Operational metrics

This closes the gap with marketplaces that have dedicated dispute ops teams.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/disputes", tags=["Dispute Operations"])


# ============================================
# ENUMS
# ============================================

class DisputeType(str, Enum):
    """Types of disputes"""
    ITEM_NOT_RECEIVED = "item_not_received"
    ITEM_NOT_AS_DESCRIBED = "item_not_as_described"
    ITEM_DAMAGED = "item_damaged"
    WRONG_ITEM = "wrong_item"
    PARTIAL_ORDER = "partial_order"
    COUNTERFEIT = "counterfeit"
    SELLER_UNRESPONSIVE = "seller_unresponsive"
    DELIVERY_ISSUE = "delivery_issue"
    REFUND_NOT_RECEIVED = "refund_not_received"
    OTHER = "other"


class DisputeStatus(str, Enum):
    """Dispute status"""
    OPENED = "opened"
    AWAITING_SELLER_RESPONSE = "awaiting_seller_response"
    AWAITING_BUYER_RESPONSE = "awaiting_buyer_response"
    UNDER_REVIEW = "under_review"
    EVIDENCE_COLLECTION = "evidence_collection"
    ARBITRATION = "arbitration"
    ESCALATED = "escalated"
    RESOLVED_BUYER_FAVOR = "resolved_buyer_favor"
    RESOLVED_SELLER_FAVOR = "resolved_seller_favor"
    RESOLVED_SPLIT = "resolved_split"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class DisputePriority(str, Enum):
    """Dispute priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class EvidenceType(str, Enum):
    """Types of evidence"""
    PHOTO = "photo"
    VIDEO = "video"
    SCREENSHOT = "screenshot"
    DOCUMENT = "document"
    TRACKING_INFO = "tracking_info"
    COMMUNICATION = "communication"
    PROOF_OF_DELIVERY = "proof_of_delivery"
    RECEIPT = "receipt"
    OTHER = "other"


class ResolutionType(str, Enum):
    """Types of resolution"""
    FULL_REFUND = "full_refund"
    PARTIAL_REFUND = "partial_refund"
    REPLACEMENT = "replacement"
    STORE_CREDIT = "store_credit"
    NO_ACTION = "no_action"
    MUTUAL_AGREEMENT = "mutual_agreement"


class EscalationReason(str, Enum):
    """Reasons for escalation"""
    SLA_BREACH = "sla_breach"
    HIGH_VALUE = "high_value"
    REPEAT_OFFENDER = "repeat_offender"
    FRAUD_SUSPECTED = "fraud_suspected"
    COMPLEX_CASE = "complex_case"
    CUSTOMER_REQUEST = "customer_request"
    LEGAL_THREAT = "legal_threat"


# ============================================
# SLA CONFIGURATION
# ============================================

SLA_CONFIG = {
    DisputePriority.LOW: {
        "initial_response_hours": 48,
        "resolution_hours": 168,  # 7 days
        "escalation_hours": 120   # 5 days
    },
    DisputePriority.MEDIUM: {
        "initial_response_hours": 24,
        "resolution_hours": 96,   # 4 days
        "escalation_hours": 72    # 3 days
    },
    DisputePriority.HIGH: {
        "initial_response_hours": 12,
        "resolution_hours": 48,   # 2 days
        "escalation_hours": 36    # 1.5 days
    },
    DisputePriority.URGENT: {
        "initial_response_hours": 4,
        "resolution_hours": 24,   # 1 day
        "escalation_hours": 12    # 12 hours
    }
}

# Evidence requirements by dispute type
EVIDENCE_REQUIREMENTS = {
    DisputeType.ITEM_NOT_RECEIVED: {
        "buyer_required": [],
        "seller_required": [EvidenceType.TRACKING_INFO, EvidenceType.PROOF_OF_DELIVERY],
        "helpful": [EvidenceType.COMMUNICATION]
    },
    DisputeType.ITEM_NOT_AS_DESCRIBED: {
        "buyer_required": [EvidenceType.PHOTO],
        "seller_required": [EvidenceType.PHOTO],
        "helpful": [EvidenceType.SCREENSHOT, EvidenceType.COMMUNICATION]
    },
    DisputeType.ITEM_DAMAGED: {
        "buyer_required": [EvidenceType.PHOTO],
        "seller_required": [],
        "helpful": [EvidenceType.VIDEO, EvidenceType.TRACKING_INFO]
    },
    DisputeType.WRONG_ITEM: {
        "buyer_required": [EvidenceType.PHOTO],
        "seller_required": [EvidenceType.RECEIPT],
        "helpful": [EvidenceType.COMMUNICATION]
    },
    DisputeType.COUNTERFEIT: {
        "buyer_required": [EvidenceType.PHOTO, EvidenceType.DOCUMENT],
        "seller_required": [EvidenceType.DOCUMENT],
        "helpful": [EvidenceType.RECEIPT]
    }
}


# ============================================
# DATA MODELS
# ============================================

@dataclass
class Evidence:
    """Evidence submitted for a dispute"""
    evidence_id: str
    dispute_id: str
    submitted_by: str  # buyer_id or seller_id
    submitted_by_role: str  # "buyer" or "seller"
    
    evidence_type: EvidenceType
    title: str
    description: str
    
    # Files
    file_urls: List[str] = field(default_factory=list)
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Verification
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: str = ""
    
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DisputeMessage:
    """Message in dispute thread"""
    message_id: str
    dispute_id: str
    sender_id: str
    sender_role: str  # "buyer", "seller", "agent", "system"
    
    content: str
    attachments: List[str] = field(default_factory=list)
    
    is_internal: bool = False  # Internal notes not visible to parties
    
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DisputeAction:
    """Action taken on a dispute"""
    action_id: str
    dispute_id: str
    action_type: str
    performed_by: str
    performed_by_role: str
    
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Dispute:
    """Dispute record"""
    dispute_id: str
    escrow_id: str
    order_id: str
    seller_id: str
    buyer_id: str
    
    # Type and status
    dispute_type: DisputeType
    status: DisputeStatus
    priority: DisputePriority
    
    # Description
    title: str
    description: str
    
    # Amount
    disputed_amount_ngn: int
    
    # Evidence
    evidence: List[Evidence] = field(default_factory=list)
    
    # Messages
    messages: List[DisputeMessage] = field(default_factory=list)
    
    # Actions
    actions: List[DisputeAction] = field(default_factory=list)
    
    # Assignment
    assigned_agent_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    # SLA tracking
    sla_response_deadline: Optional[datetime] = None
    sla_resolution_deadline: Optional[datetime] = None
    sla_response_met: bool = False
    sla_resolution_met: bool = False
    
    # Escalation
    is_escalated: bool = False
    escalation_reason: Optional[EscalationReason] = None
    escalated_at: Optional[datetime] = None
    escalated_to: Optional[str] = None
    
    # Resolution
    resolution_type: Optional[ResolutionType] = None
    resolution_amount_ngn: int = 0
    resolution_notes: str = ""
    resolved_by: Optional[str] = None
    
    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    # Feedback
    buyer_satisfaction: Optional[int] = None  # 1-5
    seller_satisfaction: Optional[int] = None  # 1-5
    feedback_notes: str = ""


@dataclass
class DisputeAgent:
    """Dispute resolution agent"""
    agent_id: str
    name: str
    email: str
    
    # Capacity
    max_active_disputes: int = 20
    current_active_disputes: int = 0
    
    # Skills
    specializations: List[DisputeType] = field(default_factory=list)
    can_handle_escalations: bool = False
    
    # Stats
    total_resolved: int = 0
    average_resolution_hours: float = 0
    satisfaction_rating: float = 0.0
    
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


# ============================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================

disputes_db: Dict[str, Dispute] = {}
agents_db: Dict[str, DisputeAgent] = {}


# ============================================
# DISPUTE OPS ENGINE
# ============================================

class DisputeOpsEngine:
    """Core engine for dispute operations"""
    
    # ============================================
    # DISPUTE CREATION
    # ============================================
    
    @staticmethod
    def determine_priority(
        dispute_type: DisputeType,
        amount_ngn: int,
        buyer_status: str = "new",
        seller_tier: str = "bronze"
    ) -> DisputePriority:
        """Determine dispute priority based on factors"""
        # High value transactions
        if amount_ngn >= 500000:
            return DisputePriority.URGENT
        elif amount_ngn >= 100000:
            return DisputePriority.HIGH
        
        # Fraud-related
        if dispute_type == DisputeType.COUNTERFEIT:
            return DisputePriority.HIGH
        
        # VIP buyers
        if buyer_status == "vip":
            return DisputePriority.HIGH
        
        # Platinum sellers
        if seller_tier == "platinum":
            return DisputePriority.HIGH
        
        # Default based on type
        if dispute_type in [DisputeType.ITEM_NOT_RECEIVED, DisputeType.WRONG_ITEM]:
            return DisputePriority.MEDIUM
        
        return DisputePriority.LOW
    
    @staticmethod
    def create_dispute(
        escrow_id: str,
        order_id: str,
        seller_id: str,
        buyer_id: str,
        dispute_type: DisputeType,
        title: str,
        description: str,
        disputed_amount_ngn: int,
        initial_evidence: List[Dict[str, Any]] = None,
        buyer_status: str = "new",
        seller_tier: str = "bronze"
    ) -> Dispute:
        """Create a new dispute"""
        dispute_id = f"dsp_{uuid.uuid4().hex[:12]}"
        
        # Determine priority
        priority = DisputeOpsEngine.determine_priority(
            dispute_type, disputed_amount_ngn, buyer_status, seller_tier
        )
        
        # Calculate SLA deadlines
        sla = SLA_CONFIG[priority]
        now = datetime.utcnow()
        
        dispute = Dispute(
            dispute_id=dispute_id,
            escrow_id=escrow_id,
            order_id=order_id,
            seller_id=seller_id,
            buyer_id=buyer_id,
            dispute_type=dispute_type,
            status=DisputeStatus.OPENED,
            priority=priority,
            title=title,
            description=description,
            disputed_amount_ngn=disputed_amount_ngn,
            sla_response_deadline=now + timedelta(hours=sla["initial_response_hours"]),
            sla_resolution_deadline=now + timedelta(hours=sla["resolution_hours"])
        )
        
        # Add initial evidence
        if initial_evidence:
            for ev in initial_evidence:
                evidence = Evidence(
                    evidence_id=f"ev_{uuid.uuid4().hex[:8]}",
                    dispute_id=dispute_id,
                    submitted_by=buyer_id,
                    submitted_by_role="buyer",
                    evidence_type=EvidenceType(ev.get("type", "other")),
                    title=ev.get("title", ""),
                    description=ev.get("description", ""),
                    file_urls=ev.get("file_urls", [])
                )
                dispute.evidence.append(evidence)
        
        # Add system message
        dispute.messages.append(DisputeMessage(
            message_id=f"msg_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            sender_id="system",
            sender_role="system",
            content=f"Dispute opened: {title}. Priority: {priority.value}. SLA response deadline: {dispute.sla_response_deadline.strftime('%Y-%m-%d %H:%M UTC')}"
        ))
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="dispute_opened",
            performed_by=buyer_id,
            performed_by_role="buyer",
            description=f"Dispute opened: {dispute_type.value}"
        ))
        
        disputes_db[dispute_id] = dispute
        
        # Auto-assign to agent
        DisputeOpsEngine.auto_assign_agent(dispute_id)
        
        # Update status to awaiting seller response
        dispute.status = DisputeStatus.AWAITING_SELLER_RESPONSE
        
        logger.info(f"Created dispute {dispute_id} for escrow {escrow_id}")
        return dispute
    
    # ============================================
    # AGENT MANAGEMENT
    # ============================================
    
    @staticmethod
    def create_agent(
        name: str,
        email: str,
        specializations: List[DisputeType] = None,
        can_handle_escalations: bool = False,
        max_active_disputes: int = 20
    ) -> DisputeAgent:
        """Create a dispute resolution agent"""
        agent_id = f"agt_{uuid.uuid4().hex[:8]}"
        
        agent = DisputeAgent(
            agent_id=agent_id,
            name=name,
            email=email,
            specializations=specializations or [],
            can_handle_escalations=can_handle_escalations,
            max_active_disputes=max_active_disputes
        )
        
        agents_db[agent_id] = agent
        logger.info(f"Created agent {agent_id}: {name}")
        return agent
    
    @staticmethod
    def auto_assign_agent(dispute_id: str) -> Optional[str]:
        """Auto-assign an agent to a dispute"""
        if dispute_id not in disputes_db:
            return None
        
        dispute = disputes_db[dispute_id]
        
        # Find available agent
        available_agents = [
            a for a in agents_db.values()
            if a.is_active and a.current_active_disputes < a.max_active_disputes
        ]
        
        if not available_agents:
            logger.warning(f"No available agents for dispute {dispute_id}")
            return None
        
        # Prefer agents with matching specialization
        specialized = [
            a for a in available_agents
            if dispute.dispute_type in a.specializations
        ]
        
        if specialized:
            # Pick agent with lowest load
            agent = min(specialized, key=lambda a: a.current_active_disputes)
        else:
            agent = min(available_agents, key=lambda a: a.current_active_disputes)
        
        # Assign
        dispute.assigned_agent_id = agent.agent_id
        dispute.assigned_at = datetime.utcnow()
        agent.current_active_disputes += 1
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="agent_assigned",
            performed_by="system",
            performed_by_role="system",
            description=f"Assigned to agent: {agent.name}"
        ))
        
        logger.info(f"Assigned dispute {dispute_id} to agent {agent.agent_id}")
        return agent.agent_id
    
    # ============================================
    # EVIDENCE MANAGEMENT
    # ============================================
    
    @staticmethod
    def submit_evidence(
        dispute_id: str,
        submitted_by: str,
        submitted_by_role: str,
        evidence_type: EvidenceType,
        title: str,
        description: str,
        file_urls: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Evidence:
        """Submit evidence for a dispute"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        evidence = Evidence(
            evidence_id=f"ev_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            submitted_by=submitted_by,
            submitted_by_role=submitted_by_role,
            evidence_type=evidence_type,
            title=title,
            description=description,
            file_urls=file_urls or [],
            metadata=metadata or {}
        )
        
        dispute.evidence.append(evidence)
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="evidence_submitted",
            performed_by=submitted_by,
            performed_by_role=submitted_by_role,
            description=f"Evidence submitted: {evidence_type.value} - {title}"
        ))
        
        logger.info(f"Evidence {evidence.evidence_id} submitted for dispute {dispute_id}")
        return evidence
    
    @staticmethod
    def verify_evidence(
        dispute_id: str,
        evidence_id: str,
        verified_by: str,
        is_verified: bool,
        notes: str = ""
    ) -> Evidence:
        """Verify evidence"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        for evidence in dispute.evidence:
            if evidence.evidence_id == evidence_id:
                evidence.is_verified = is_verified
                evidence.verified_by = verified_by
                evidence.verified_at = datetime.utcnow()
                evidence.verification_notes = notes
                return evidence
        
        raise ValueError(f"Evidence {evidence_id} not found")
    
    @staticmethod
    def check_evidence_requirements(dispute_id: str) -> Dict[str, Any]:
        """Check if evidence requirements are met"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        requirements = EVIDENCE_REQUIREMENTS.get(dispute.dispute_type, {})
        
        buyer_evidence_types = {
            e.evidence_type for e in dispute.evidence
            if e.submitted_by_role == "buyer"
        }
        seller_evidence_types = {
            e.evidence_type for e in dispute.evidence
            if e.submitted_by_role == "seller"
        }
        
        buyer_required = set(requirements.get("buyer_required", []))
        seller_required = set(requirements.get("seller_required", []))
        
        buyer_missing = buyer_required - buyer_evidence_types
        seller_missing = seller_required - seller_evidence_types
        
        return {
            "buyer_requirements_met": len(buyer_missing) == 0,
            "seller_requirements_met": len(seller_missing) == 0,
            "buyer_missing": [e.value for e in buyer_missing],
            "seller_missing": [e.value for e in seller_missing],
            "helpful_evidence": [e.value for e in requirements.get("helpful", [])]
        }
    
    # ============================================
    # MESSAGING
    # ============================================
    
    @staticmethod
    def send_message(
        dispute_id: str,
        sender_id: str,
        sender_role: str,
        content: str,
        attachments: List[str] = None,
        is_internal: bool = False
    ) -> DisputeMessage:
        """Send a message in the dispute thread"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        message = DisputeMessage(
            message_id=f"msg_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            sender_id=sender_id,
            sender_role=sender_role,
            content=content,
            attachments=attachments or [],
            is_internal=is_internal
        )
        
        dispute.messages.append(message)
        
        # Track first response
        if not dispute.first_response_at:
            if sender_role == "seller" and dispute.status == DisputeStatus.AWAITING_SELLER_RESPONSE:
                dispute.first_response_at = datetime.utcnow()
                dispute.sla_response_met = dispute.first_response_at <= dispute.sla_response_deadline
                dispute.status = DisputeStatus.AWAITING_BUYER_RESPONSE
        
        return message
    
    @staticmethod
    def get_messages(dispute_id: str, include_internal: bool = False) -> List[DisputeMessage]:
        """Get messages for a dispute"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        if include_internal:
            return dispute.messages
        else:
            return [m for m in dispute.messages if not m.is_internal]
    
    # ============================================
    # STATUS MANAGEMENT
    # ============================================
    
    @staticmethod
    def update_status(
        dispute_id: str,
        new_status: DisputeStatus,
        updated_by: str,
        notes: str = ""
    ) -> Dispute:
        """Update dispute status"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        old_status = dispute.status
        dispute.status = new_status
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="status_changed",
            performed_by=updated_by,
            performed_by_role="agent",
            description=f"Status changed from {old_status.value} to {new_status.value}. {notes}"
        ))
        
        # Add system message
        dispute.messages.append(DisputeMessage(
            message_id=f"msg_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            sender_id="system",
            sender_role="system",
            content=f"Dispute status updated to: {new_status.value}"
        ))
        
        logger.info(f"Dispute {dispute_id} status changed to {new_status.value}")
        return dispute
    
    @staticmethod
    def escalate_dispute(
        dispute_id: str,
        reason: EscalationReason,
        escalated_by: str,
        notes: str = ""
    ) -> Dispute:
        """Escalate a dispute"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        dispute.is_escalated = True
        dispute.escalation_reason = reason
        dispute.escalated_at = datetime.utcnow()
        dispute.status = DisputeStatus.ESCALATED
        
        # Increase priority
        if dispute.priority == DisputePriority.LOW:
            dispute.priority = DisputePriority.MEDIUM
        elif dispute.priority == DisputePriority.MEDIUM:
            dispute.priority = DisputePriority.HIGH
        elif dispute.priority == DisputePriority.HIGH:
            dispute.priority = DisputePriority.URGENT
        
        # Find escalation agent
        escalation_agents = [
            a for a in agents_db.values()
            if a.is_active and a.can_handle_escalations and a.current_active_disputes < a.max_active_disputes
        ]
        
        if escalation_agents:
            new_agent = min(escalation_agents, key=lambda a: a.current_active_disputes)
            
            # Release from current agent
            if dispute.assigned_agent_id and dispute.assigned_agent_id in agents_db:
                agents_db[dispute.assigned_agent_id].current_active_disputes -= 1
            
            dispute.assigned_agent_id = new_agent.agent_id
            dispute.escalated_to = new_agent.agent_id
            new_agent.current_active_disputes += 1
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="escalated",
            performed_by=escalated_by,
            performed_by_role="agent",
            description=f"Escalated: {reason.value}. {notes}"
        ))
        
        logger.info(f"Dispute {dispute_id} escalated: {reason.value}")
        return dispute
    
    # ============================================
    # RESOLUTION
    # ============================================
    
    @staticmethod
    def resolve_dispute(
        dispute_id: str,
        resolution_type: ResolutionType,
        resolution_amount_ngn: int,
        resolved_by: str,
        notes: str = ""
    ) -> Dispute:
        """Resolve a dispute"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        dispute.resolution_type = resolution_type
        dispute.resolution_amount_ngn = resolution_amount_ngn
        dispute.resolution_notes = notes
        dispute.resolved_by = resolved_by
        dispute.resolved_at = datetime.utcnow()
        
        # Determine final status
        if resolution_type in [ResolutionType.FULL_REFUND, ResolutionType.REPLACEMENT]:
            dispute.status = DisputeStatus.RESOLVED_BUYER_FAVOR
        elif resolution_type == ResolutionType.NO_ACTION:
            dispute.status = DisputeStatus.RESOLVED_SELLER_FAVOR
        elif resolution_type == ResolutionType.PARTIAL_REFUND:
            dispute.status = DisputeStatus.RESOLVED_SPLIT
        else:
            dispute.status = DisputeStatus.RESOLVED_SPLIT
        
        # Check SLA
        dispute.sla_resolution_met = dispute.resolved_at <= dispute.sla_resolution_deadline
        
        # Release agent
        if dispute.assigned_agent_id and dispute.assigned_agent_id in agents_db:
            agent = agents_db[dispute.assigned_agent_id]
            agent.current_active_disputes -= 1
            agent.total_resolved += 1
            
            # Update average resolution time
            resolution_hours = (dispute.resolved_at - dispute.created_at).total_seconds() / 3600
            agent.average_resolution_hours = (
                (agent.average_resolution_hours * (agent.total_resolved - 1) + resolution_hours)
                / agent.total_resolved
            )
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="resolved",
            performed_by=resolved_by,
            performed_by_role="agent",
            description=f"Resolved: {resolution_type.value}. Amount: {resolution_amount_ngn} NGN. {notes}"
        ))
        
        logger.info(f"Dispute {dispute_id} resolved: {resolution_type.value}")
        return dispute
    
    @staticmethod
    def close_dispute(dispute_id: str, closed_by: str) -> Dispute:
        """Close a resolved dispute"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute = disputes_db[dispute_id]
        
        if dispute.status not in [
            DisputeStatus.RESOLVED_BUYER_FAVOR,
            DisputeStatus.RESOLVED_SELLER_FAVOR,
            DisputeStatus.RESOLVED_SPLIT
        ]:
            raise ValueError("Dispute must be resolved before closing")
        
        dispute.status = DisputeStatus.CLOSED
        dispute.closed_at = datetime.utcnow()
        
        # Add action
        dispute.actions.append(DisputeAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            dispute_id=dispute_id,
            action_type="closed",
            performed_by=closed_by,
            performed_by_role="agent",
            description="Dispute closed"
        ))
        
        return dispute
    
    @staticmethod
    def record_feedback(
        dispute_id: str,
        user_id: str,
        user_role: str,
        satisfaction: int,
        notes: str = ""
    ) -> Dispute:
        """Record satisfaction feedback"""
        if dispute_id not in disputes_db:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        if satisfaction < 1 or satisfaction > 5:
            raise ValueError("Satisfaction must be between 1 and 5")
        
        dispute = disputes_db[dispute_id]
        
        if user_role == "buyer":
            dispute.buyer_satisfaction = satisfaction
        elif user_role == "seller":
            dispute.seller_satisfaction = satisfaction
        
        if notes:
            dispute.feedback_notes += f"\n{user_role}: {notes}"
        
        # Update agent rating
        if dispute.assigned_agent_id and dispute.assigned_agent_id in agents_db:
            agent = agents_db[dispute.assigned_agent_id]
            total_feedback = (
                (1 if dispute.buyer_satisfaction else 0) +
                (1 if dispute.seller_satisfaction else 0)
            )
            if total_feedback > 0:
                avg_satisfaction = (
                    (dispute.buyer_satisfaction or 0) +
                    (dispute.seller_satisfaction or 0)
                ) / total_feedback
                
                # Update agent's overall rating
                agent.satisfaction_rating = (
                    (agent.satisfaction_rating * (agent.total_resolved - 1) + avg_satisfaction)
                    / agent.total_resolved
                )
        
        return dispute
    
    # ============================================
    # QUERIES
    # ============================================
    
    @staticmethod
    def get_dispute(dispute_id: str) -> Optional[Dispute]:
        """Get dispute by ID"""
        return disputes_db.get(dispute_id)
    
    @staticmethod
    def get_disputes_by_escrow(escrow_id: str) -> List[Dispute]:
        """Get disputes for an escrow"""
        return [d for d in disputes_db.values() if d.escrow_id == escrow_id]
    
    @staticmethod
    def get_buyer_disputes(
        buyer_id: str,
        status: Optional[DisputeStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dispute]:
        """Get disputes for a buyer"""
        disputes = [d for d in disputes_db.values() if d.buyer_id == buyer_id]
        
        if status:
            disputes = [d for d in disputes if d.status == status]
        
        disputes.sort(key=lambda d: d.created_at, reverse=True)
        return disputes[offset:offset + limit]
    
    @staticmethod
    def get_seller_disputes(
        seller_id: str,
        status: Optional[DisputeStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dispute]:
        """Get disputes for a seller"""
        disputes = [d for d in disputes_db.values() if d.seller_id == seller_id]
        
        if status:
            disputes = [d for d in disputes if d.status == status]
        
        disputes.sort(key=lambda d: d.created_at, reverse=True)
        return disputes[offset:offset + limit]
    
    @staticmethod
    def get_agent_disputes(
        agent_id: str,
        status: Optional[DisputeStatus] = None
    ) -> List[Dispute]:
        """Get disputes assigned to an agent"""
        disputes = [d for d in disputes_db.values() if d.assigned_agent_id == agent_id]
        
        if status:
            disputes = [d for d in disputes if d.status == status]
        
        disputes.sort(key=lambda d: d.sla_resolution_deadline or d.created_at)
        return disputes
    
    @staticmethod
    def get_pending_disputes(priority: Optional[DisputePriority] = None) -> List[Dispute]:
        """Get pending disputes"""
        pending_statuses = [
            DisputeStatus.OPENED,
            DisputeStatus.AWAITING_SELLER_RESPONSE,
            DisputeStatus.AWAITING_BUYER_RESPONSE,
            DisputeStatus.UNDER_REVIEW,
            DisputeStatus.EVIDENCE_COLLECTION,
            DisputeStatus.ARBITRATION
        ]
        
        disputes = [d for d in disputes_db.values() if d.status in pending_statuses]
        
        if priority:
            disputes = [d for d in disputes if d.priority == priority]
        
        # Sort by SLA deadline
        disputes.sort(key=lambda d: d.sla_resolution_deadline or d.created_at)
        return disputes
    
    @staticmethod
    def get_sla_breached_disputes() -> List[Dispute]:
        """Get disputes that have breached SLA"""
        now = datetime.utcnow()
        breached = []
        
        for dispute in disputes_db.values():
            if dispute.status in [DisputeStatus.CLOSED, DisputeStatus.CANCELLED]:
                continue
            
            if dispute.sla_resolution_deadline and dispute.sla_resolution_deadline < now:
                breached.append(dispute)
        
        return breached
    
    # ============================================
    # ANALYTICS
    # ============================================
    
    @staticmethod
    def get_dispute_analytics(days: int = 30) -> Dict[str, Any]:
        """Get dispute analytics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        disputes = [d for d in disputes_db.values() if d.created_at >= cutoff]
        resolved = [d for d in disputes if d.resolved_at]
        
        # Status breakdown
        status_breakdown = {}
        for status in DisputeStatus:
            status_breakdown[status.value] = len([d for d in disputes if d.status == status])
        
        # Type breakdown
        type_breakdown = {}
        for dtype in DisputeType:
            type_breakdown[dtype.value] = len([d for d in disputes if d.dispute_type == dtype])
        
        # Resolution breakdown
        resolution_breakdown = {}
        for rtype in ResolutionType:
            resolution_breakdown[rtype.value] = len([d for d in resolved if d.resolution_type == rtype])
        
        # SLA metrics
        sla_response_met = len([d for d in disputes if d.sla_response_met])
        sla_resolution_met = len([d for d in resolved if d.sla_resolution_met])
        
        # Average resolution time
        resolution_times = [
            (d.resolved_at - d.created_at).total_seconds() / 3600
            for d in resolved if d.resolved_at
        ]
        avg_resolution_hours = sum(resolution_times) / len(resolution_times) if resolution_times else 0
        
        # Satisfaction
        buyer_satisfactions = [d.buyer_satisfaction for d in resolved if d.buyer_satisfaction]
        seller_satisfactions = [d.seller_satisfaction for d in resolved if d.seller_satisfaction]
        
        return {
            "period_days": days,
            "total_disputes": len(disputes),
            "resolved_disputes": len(resolved),
            "status_breakdown": status_breakdown,
            "type_breakdown": type_breakdown,
            "resolution_breakdown": resolution_breakdown,
            "sla": {
                "response_met_count": sla_response_met,
                "response_met_pct": round(sla_response_met / len(disputes) * 100, 1) if disputes else 0,
                "resolution_met_count": sla_resolution_met,
                "resolution_met_pct": round(sla_resolution_met / len(resolved) * 100, 1) if resolved else 0
            },
            "resolution_time": {
                "average_hours": round(avg_resolution_hours, 1),
                "average_days": round(avg_resolution_hours / 24, 1)
            },
            "satisfaction": {
                "buyer_average": round(sum(buyer_satisfactions) / len(buyer_satisfactions), 1) if buyer_satisfactions else 0,
                "seller_average": round(sum(seller_satisfactions) / len(seller_satisfactions), 1) if seller_satisfactions else 0
            },
            "escalation_rate": round(
                len([d for d in disputes if d.is_escalated]) / len(disputes) * 100, 1
            ) if disputes else 0
        }
    
    @staticmethod
    def get_agent_performance(agent_id: str) -> Dict[str, Any]:
        """Get agent performance metrics"""
        if agent_id not in agents_db:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = agents_db[agent_id]
        
        # Get agent's disputes
        disputes = [d for d in disputes_db.values() if d.assigned_agent_id == agent_id]
        resolved = [d for d in disputes if d.resolved_at]
        
        return {
            "agent_id": agent_id,
            "name": agent.name,
            "total_assigned": len(disputes),
            "total_resolved": agent.total_resolved,
            "current_active": agent.current_active_disputes,
            "average_resolution_hours": round(agent.average_resolution_hours, 1),
            "satisfaction_rating": round(agent.satisfaction_rating, 2),
            "sla_compliance": {
                "response_met": len([d for d in disputes if d.sla_response_met]),
                "resolution_met": len([d for d in resolved if d.sla_resolution_met])
            },
            "resolution_breakdown": {
                rtype.value: len([d for d in resolved if d.resolution_type == rtype])
                for rtype in ResolutionType
            }
        }


# ============================================
# PYDANTIC MODELS FOR API
# ============================================

class CreateDisputeRequest(BaseModel):
    escrow_id: str
    order_id: str
    seller_id: str
    dispute_type: DisputeType
    title: str = Field(..., min_length=10, max_length=200)
    description: str = Field(..., min_length=50, max_length=5000)
    disputed_amount_ngn: int = Field(..., ge=100)
    initial_evidence: Optional[List[Dict[str, Any]]] = None
    buyer_status: str = "new"
    seller_tier: str = "bronze"


class SubmitEvidenceRequest(BaseModel):
    evidence_type: EvidenceType
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., max_length=1000)
    file_urls: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    attachments: Optional[List[str]] = None
    is_internal: bool = False


class UpdateStatusRequest(BaseModel):
    status: DisputeStatus
    notes: str = ""


class EscalateRequest(BaseModel):
    reason: EscalationReason
    notes: str = ""


class ResolveRequest(BaseModel):
    resolution_type: ResolutionType
    resolution_amount_ngn: int = Field(..., ge=0)
    notes: str = ""


class FeedbackRequest(BaseModel):
    satisfaction: int = Field(..., ge=1, le=5)
    notes: str = ""


class CreateAgentRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str
    specializations: Optional[List[DisputeType]] = None
    can_handle_escalations: bool = False
    max_active_disputes: int = 20


# ============================================
# API ENDPOINTS
# ============================================

# Dispute CRUD
@router.post("/create/{buyer_id}")
async def create_dispute(buyer_id: str, request: CreateDisputeRequest):
    """Create a new dispute"""
    dispute = DisputeOpsEngine.create_dispute(
        escrow_id=request.escrow_id,
        order_id=request.order_id,
        seller_id=request.seller_id,
        buyer_id=buyer_id,
        dispute_type=request.dispute_type,
        title=request.title,
        description=request.description,
        disputed_amount_ngn=request.disputed_amount_ngn,
        initial_evidence=request.initial_evidence,
        buyer_status=request.buyer_status,
        seller_tier=request.seller_tier
    )
    return {"dispute": _serialize_dispute(dispute)}


@router.get("/{dispute_id}")
async def get_dispute(dispute_id: str):
    """Get dispute by ID"""
    dispute = DisputeOpsEngine.get_dispute(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return {"dispute": _serialize_dispute(dispute)}


@router.get("/escrow/{escrow_id}")
async def get_disputes_by_escrow(escrow_id: str):
    """Get disputes for an escrow"""
    disputes = DisputeOpsEngine.get_disputes_by_escrow(escrow_id)
    return {"disputes": [_serialize_dispute(d) for d in disputes]}


@router.get("/buyer/{buyer_id}")
async def get_buyer_disputes(
    buyer_id: str,
    status: Optional[DisputeStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get disputes for a buyer"""
    disputes = DisputeOpsEngine.get_buyer_disputes(buyer_id, status, limit, offset)
    return {"disputes": [_serialize_dispute(d) for d in disputes], "count": len(disputes)}


@router.get("/seller/{seller_id}")
async def get_seller_disputes(
    seller_id: str,
    status: Optional[DisputeStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get disputes for a seller"""
    disputes = DisputeOpsEngine.get_seller_disputes(seller_id, status, limit, offset)
    return {"disputes": [_serialize_dispute(d) for d in disputes], "count": len(disputes)}


# Evidence
@router.post("/{dispute_id}/evidence/{user_id}")
async def submit_evidence(
    dispute_id: str,
    user_id: str,
    role: str = Query(..., regex="^(buyer|seller)$"),
    request: SubmitEvidenceRequest = None
):
    """Submit evidence for a dispute"""
    try:
        evidence = DisputeOpsEngine.submit_evidence(
            dispute_id=dispute_id,
            submitted_by=user_id,
            submitted_by_role=role,
            evidence_type=request.evidence_type,
            title=request.title,
            description=request.description,
            file_urls=request.file_urls,
            metadata=request.metadata
        )
        return {"evidence": evidence.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{dispute_id}/evidence-requirements")
async def check_evidence_requirements(dispute_id: str):
    """Check evidence requirements for a dispute"""
    try:
        requirements = DisputeOpsEngine.check_evidence_requirements(dispute_id)
        return {"requirements": requirements}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Messages
@router.post("/{dispute_id}/messages/{sender_id}")
async def send_message(
    dispute_id: str,
    sender_id: str,
    role: str = Query(..., regex="^(buyer|seller|agent)$"),
    request: SendMessageRequest = None
):
    """Send a message in the dispute thread"""
    try:
        message = DisputeOpsEngine.send_message(
            dispute_id=dispute_id,
            sender_id=sender_id,
            sender_role=role,
            content=request.content,
            attachments=request.attachments,
            is_internal=request.is_internal
        )
        return {"message": message.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{dispute_id}/messages")
async def get_messages(dispute_id: str, include_internal: bool = False):
    """Get messages for a dispute"""
    try:
        messages = DisputeOpsEngine.get_messages(dispute_id, include_internal)
        return {"messages": [m.__dict__ for m in messages]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Status management
@router.put("/{dispute_id}/status/{agent_id}")
async def update_status(dispute_id: str, agent_id: str, request: UpdateStatusRequest):
    """Update dispute status"""
    try:
        dispute = DisputeOpsEngine.update_status(
            dispute_id=dispute_id,
            new_status=request.status,
            updated_by=agent_id,
            notes=request.notes
        )
        return {"dispute": _serialize_dispute(dispute)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/escalate/{agent_id}")
async def escalate_dispute(dispute_id: str, agent_id: str, request: EscalateRequest):
    """Escalate a dispute"""
    try:
        dispute = DisputeOpsEngine.escalate_dispute(
            dispute_id=dispute_id,
            reason=request.reason,
            escalated_by=agent_id,
            notes=request.notes
        )
        return {"dispute": _serialize_dispute(dispute)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Resolution
@router.post("/{dispute_id}/resolve/{agent_id}")
async def resolve_dispute(dispute_id: str, agent_id: str, request: ResolveRequest):
    """Resolve a dispute"""
    try:
        dispute = DisputeOpsEngine.resolve_dispute(
            dispute_id=dispute_id,
            resolution_type=request.resolution_type,
            resolution_amount_ngn=request.resolution_amount_ngn,
            resolved_by=agent_id,
            notes=request.notes
        )
        return {"dispute": _serialize_dispute(dispute)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/close/{agent_id}")
async def close_dispute(dispute_id: str, agent_id: str):
    """Close a resolved dispute"""
    try:
        dispute = DisputeOpsEngine.close_dispute(dispute_id, agent_id)
        return {"dispute": _serialize_dispute(dispute)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/feedback/{user_id}")
async def record_feedback(
    dispute_id: str,
    user_id: str,
    role: str = Query(..., regex="^(buyer|seller)$"),
    request: FeedbackRequest = None
):
    """Record satisfaction feedback"""
    try:
        dispute = DisputeOpsEngine.record_feedback(
            dispute_id=dispute_id,
            user_id=user_id,
            user_role=role,
            satisfaction=request.satisfaction,
            notes=request.notes
        )
        return {"dispute": _serialize_dispute(dispute)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Agent management
@router.post("/agents")
async def create_agent(request: CreateAgentRequest):
    """Create a dispute resolution agent"""
    agent = DisputeOpsEngine.create_agent(
        name=request.name,
        email=request.email,
        specializations=request.specializations,
        can_handle_escalations=request.can_handle_escalations,
        max_active_disputes=request.max_active_disputes
    )
    return {"agent": agent.__dict__}


@router.get("/agents/{agent_id}/disputes")
async def get_agent_disputes(agent_id: str, status: Optional[DisputeStatus] = None):
    """Get disputes assigned to an agent"""
    disputes = DisputeOpsEngine.get_agent_disputes(agent_id, status)
    return {"disputes": [_serialize_dispute(d) for d in disputes], "count": len(disputes)}


@router.get("/agents/{agent_id}/performance")
async def get_agent_performance(agent_id: str):
    """Get agent performance metrics"""
    try:
        performance = DisputeOpsEngine.get_agent_performance(agent_id)
        return {"performance": performance}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Queue management
@router.get("/queue/pending")
async def get_pending_disputes(priority: Optional[DisputePriority] = None):
    """Get pending disputes"""
    disputes = DisputeOpsEngine.get_pending_disputes(priority)
    return {"disputes": [_serialize_dispute(d) for d in disputes], "count": len(disputes)}


@router.get("/queue/sla-breached")
async def get_sla_breached_disputes():
    """Get disputes that have breached SLA"""
    disputes = DisputeOpsEngine.get_sla_breached_disputes()
    return {"disputes": [_serialize_dispute(d) for d in disputes], "count": len(disputes)}


# Analytics
@router.get("/analytics/summary")
async def get_dispute_analytics(days: int = Query(30, ge=1, le=365)):
    """Get dispute analytics"""
    analytics = DisputeOpsEngine.get_dispute_analytics(days)
    return {"analytics": analytics}


@router.get("/sla-config")
async def get_sla_config():
    """Get SLA configuration"""
    return {"sla_config": {k.value: v for k, v in SLA_CONFIG.items()}}


@router.get("/evidence-requirements")
async def get_evidence_requirements():
    """Get evidence requirements by dispute type"""
    return {
        "requirements": {
            k.value: {
                "buyer_required": [e.value for e in v.get("buyer_required", [])],
                "seller_required": [e.value for e in v.get("seller_required", [])],
                "helpful": [e.value for e in v.get("helpful", [])]
            }
            for k, v in EVIDENCE_REQUIREMENTS.items()
        }
    }


# ============================================
# HELPER FUNCTIONS
# ============================================

def _serialize_dispute(dispute: Dispute) -> Dict[str, Any]:
    """Serialize dispute to dict"""
    return {
        "dispute_id": dispute.dispute_id,
        "escrow_id": dispute.escrow_id,
        "order_id": dispute.order_id,
        "seller_id": dispute.seller_id,
        "buyer_id": dispute.buyer_id,
        "dispute_type": dispute.dispute_type.value,
        "status": dispute.status.value,
        "priority": dispute.priority.value,
        "title": dispute.title,
        "description": dispute.description,
        "disputed_amount_ngn": dispute.disputed_amount_ngn,
        "evidence": [e.__dict__ for e in dispute.evidence],
        "messages_count": len(dispute.messages),
        "actions_count": len(dispute.actions),
        "assigned_agent_id": dispute.assigned_agent_id,
        "assigned_at": dispute.assigned_at.isoformat() if dispute.assigned_at else None,
        "sla": {
            "response_deadline": dispute.sla_response_deadline.isoformat() if dispute.sla_response_deadline else None,
            "resolution_deadline": dispute.sla_resolution_deadline.isoformat() if dispute.sla_resolution_deadline else None,
            "response_met": dispute.sla_response_met,
            "resolution_met": dispute.sla_resolution_met
        },
        "escalation": {
            "is_escalated": dispute.is_escalated,
            "reason": dispute.escalation_reason.value if dispute.escalation_reason else None,
            "escalated_at": dispute.escalated_at.isoformat() if dispute.escalated_at else None,
            "escalated_to": dispute.escalated_to
        },
        "resolution": {
            "type": dispute.resolution_type.value if dispute.resolution_type else None,
            "amount_ngn": dispute.resolution_amount_ngn,
            "notes": dispute.resolution_notes,
            "resolved_by": dispute.resolved_by
        },
        "dates": {
            "created_at": dispute.created_at.isoformat(),
            "first_response_at": dispute.first_response_at.isoformat() if dispute.first_response_at else None,
            "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
            "closed_at": dispute.closed_at.isoformat() if dispute.closed_at else None
        },
        "feedback": {
            "buyer_satisfaction": dispute.buyer_satisfaction,
            "seller_satisfaction": dispute.seller_satisfaction,
            "notes": dispute.feedback_notes
        }
    }
