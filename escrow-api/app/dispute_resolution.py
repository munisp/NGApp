"""
Dispute Resolution Service for EscrowProtect
Structured dispute handling with evidence collection and automated resolution

Dispute Flow:
1. Buyer/Seller opens dispute with reason
2. Evidence collection period (48-72 hours)
3. Review by system rules or human arbiter
4. Resolution: Full refund, partial refund, release to seller, or split
5. Funds distributed according to resolution
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

class DisputeStatus(str, Enum):
    OPEN = "open"
    EVIDENCE_COLLECTION = "evidence_collection"
    UNDER_REVIEW = "under_review"
    AWAITING_RESPONSE = "awaiting_response"
    RESOLVED_BUYER = "resolved_buyer"
    RESOLVED_SELLER = "resolved_seller"
    RESOLVED_SPLIT = "resolved_split"
    ESCALATED = "escalated"
    CLOSED = "closed"

class DisputeReason(str, Enum):
    NOT_RECEIVED = "not_received"
    WRONG_ITEM = "wrong_item"
    DAMAGED = "damaged"
    NOT_AS_DESCRIBED = "not_as_described"
    COUNTERFEIT = "counterfeit"
    PARTIAL_DELIVERY = "partial_delivery"
    LATE_DELIVERY = "late_delivery"
    SELLER_UNRESPONSIVE = "seller_unresponsive"
    BUYER_UNRESPONSIVE = "buyer_unresponsive"
    OTHER = "other"

class EvidenceType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    SCREENSHOT = "screenshot"
    DOCUMENT = "document"
    TRACKING_INFO = "tracking_info"
    CHAT_LOG = "chat_log"
    RECEIPT = "receipt"
    UNBOXING_VIDEO = "unboxing_video"

class ResolutionType(str, Enum):
    FULL_REFUND = "full_refund"
    PARTIAL_REFUND = "partial_refund"
    RELEASE_TO_SELLER = "release_to_seller"
    SPLIT = "split"
    ESCALATE = "escalate"

@dataclass
class Evidence:
    """Evidence submitted for a dispute"""
    id: str
    dispute_id: str
    submitted_by: str  # user_id
    submitted_by_role: str  # buyer or seller
    evidence_type: EvidenceType
    file_url: Optional[str] = None
    description: str = ""
    verified: bool = False
    verification_notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class DisputeMessage:
    """Message in dispute thread"""
    id: str
    dispute_id: str
    sender_id: Optional[str]
    sender_role: str  # buyer, seller, admin, system
    message: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class Dispute:
    """Dispute record"""
    id: str
    escrow_id: str
    status: DisputeStatus
    reason: DisputeReason
    
    # Parties
    buyer_id: str
    seller_id: str
    opened_by: str
    opened_by_role: str
    
    # Description
    description: str
    
    # Amount
    escrow_amount: float
    
    # Resolution
    resolution_type: Optional[ResolutionType] = None
    resolution_notes: str = ""
    buyer_amount: float = 0.0
    seller_amount: float = 0.0
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    
    # Deadlines
    evidence_deadline: Optional[str] = None
    response_deadline: Optional[str] = None
    review_deadline: Optional[str] = None
    
    # Evidence and messages
    evidence: List[Evidence] = field(default_factory=list)
    messages: List[DisputeMessage] = field(default_factory=list)
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

# Resolution rules based on dispute reason and evidence
RESOLUTION_RULES = {
    DisputeReason.NOT_RECEIVED: {
        "evidence_required_buyer": [EvidenceType.SCREENSHOT],  # Order confirmation
        "evidence_required_seller": [EvidenceType.TRACKING_INFO],  # Proof of delivery
        "auto_resolve_days": 7,  # Auto-refund if no tracking after 7 days
        "default_resolution": ResolutionType.FULL_REFUND,
        "seller_wins_if": ["valid_tracking", "delivery_confirmed"],
    },
    DisputeReason.WRONG_ITEM: {
        "evidence_required_buyer": [EvidenceType.PHOTO, EvidenceType.UNBOXING_VIDEO],
        "evidence_required_seller": [EvidenceType.PHOTO],  # Original listing photo
        "auto_resolve_days": 5,
        "default_resolution": ResolutionType.FULL_REFUND,
        "seller_wins_if": ["item_matches_listing"],
    },
    DisputeReason.DAMAGED: {
        "evidence_required_buyer": [EvidenceType.PHOTO, EvidenceType.UNBOXING_VIDEO],
        "evidence_required_seller": [EvidenceType.PHOTO],  # Pre-shipping condition
        "auto_resolve_days": 5,
        "default_resolution": ResolutionType.SPLIT,
        "split_ratio": (0.7, 0.3),  # 70% buyer, 30% seller by default
    },
    DisputeReason.NOT_AS_DESCRIBED: {
        "evidence_required_buyer": [EvidenceType.PHOTO, EvidenceType.SCREENSHOT],
        "evidence_required_seller": [EvidenceType.SCREENSHOT],  # Original listing
        "auto_resolve_days": 5,
        "default_resolution": ResolutionType.PARTIAL_REFUND,
        "partial_refund_ratio": 0.5,
    },
    DisputeReason.COUNTERFEIT: {
        "evidence_required_buyer": [EvidenceType.PHOTO, EvidenceType.VIDEO],
        "evidence_required_seller": [EvidenceType.RECEIPT, EvidenceType.DOCUMENT],
        "auto_resolve_days": 7,
        "default_resolution": ResolutionType.FULL_REFUND,
        "escalate_if": ["high_value", "repeat_seller"],
    },
    DisputeReason.PARTIAL_DELIVERY: {
        "evidence_required_buyer": [EvidenceType.PHOTO, EvidenceType.UNBOXING_VIDEO],
        "evidence_required_seller": [EvidenceType.PHOTO],  # Packing photo
        "auto_resolve_days": 5,
        "default_resolution": ResolutionType.PARTIAL_REFUND,
    },
    DisputeReason.LATE_DELIVERY: {
        "evidence_required_buyer": [EvidenceType.SCREENSHOT],  # Promised delivery date
        "evidence_required_seller": [EvidenceType.TRACKING_INFO],
        "auto_resolve_days": 3,
        "default_resolution": ResolutionType.PARTIAL_REFUND,
        "partial_refund_ratio": 0.1,  # 10% refund for late delivery
    },
}

class DisputeResolutionService:
    """
    Dispute resolution service with automated rules and evidence collection.
    """
    
    # Timeouts
    EVIDENCE_COLLECTION_HOURS = 72
    RESPONSE_TIMEOUT_HOURS = 48
    REVIEW_TIMEOUT_HOURS = 24
    
    # Thresholds
    HIGH_VALUE_THRESHOLD_NGN = 500000
    ESCALATION_THRESHOLD_NGN = 1000000
    
    def __init__(self):
        # In-memory storage for POC
        self.disputes: Dict[str, Dispute] = {}
        self.escrow_disputes: Dict[str, str] = {}  # escrow_id -> dispute_id
    
    async def open_dispute(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        opened_by: str,
        opened_by_role: str,
        reason: DisputeReason,
        description: str,
        escrow_amount: float
    ) -> Dispute:
        """
        Open a new dispute for an escrow.
        """
        # Check if dispute already exists
        if escrow_id in self.escrow_disputes:
            existing = self.disputes[self.escrow_disputes[escrow_id]]
            if existing.status not in [DisputeStatus.CLOSED, DisputeStatus.RESOLVED_BUYER, 
                                       DisputeStatus.RESOLVED_SELLER, DisputeStatus.RESOLVED_SPLIT]:
                raise ValueError(f"Active dispute already exists for escrow {escrow_id}")
        
        dispute_id = f"DSP-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.utcnow()
        
        # Set deadlines
        evidence_deadline = (now + timedelta(hours=self.EVIDENCE_COLLECTION_HOURS)).isoformat()
        
        dispute = Dispute(
            id=dispute_id,
            escrow_id=escrow_id,
            status=DisputeStatus.EVIDENCE_COLLECTION,
            reason=reason,
            buyer_id=buyer_id,
            seller_id=seller_id,
            opened_by=opened_by,
            opened_by_role=opened_by_role,
            description=description,
            escrow_amount=escrow_amount,
            evidence_deadline=evidence_deadline
        )
        
        # Add system message
        dispute.messages.append(DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            sender_id=None,
            sender_role="system",
            message=f"Dispute opened by {opened_by_role}. Reason: {reason.value}. "
                   f"Both parties have {self.EVIDENCE_COLLECTION_HOURS} hours to submit evidence."
        ))
        
        # Store dispute
        self.disputes[dispute_id] = dispute
        self.escrow_disputes[escrow_id] = dispute_id
        
        logger.info(f"Dispute {dispute_id} opened for escrow {escrow_id}")
        
        return dispute
    
    async def submit_evidence(
        self,
        dispute_id: str,
        submitted_by: str,
        submitted_by_role: str,
        evidence_type: EvidenceType,
        file_url: str = None,
        description: str = ""
    ) -> Evidence:
        """
        Submit evidence for a dispute.
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        if dispute.status not in [DisputeStatus.EVIDENCE_COLLECTION, DisputeStatus.AWAITING_RESPONSE]:
            raise ValueError(f"Cannot submit evidence in status {dispute.status}")
        
        # Check deadline
        if dispute.evidence_deadline:
            deadline = datetime.fromisoformat(dispute.evidence_deadline)
            if datetime.utcnow() > deadline:
                raise ValueError("Evidence submission deadline has passed")
        
        evidence = Evidence(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            submitted_by=submitted_by,
            submitted_by_role=submitted_by_role,
            evidence_type=evidence_type,
            file_url=file_url,
            description=description
        )
        
        dispute.evidence.append(evidence)
        dispute.updated_at = datetime.utcnow().isoformat()
        
        # Add message
        dispute.messages.append(DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            sender_id=submitted_by,
            sender_role=submitted_by_role,
            message=f"Submitted {evidence_type.value} evidence: {description[:100]}"
        ))
        
        logger.info(f"Evidence submitted for dispute {dispute_id} by {submitted_by_role}")
        
        return evidence
    
    async def add_message(
        self,
        dispute_id: str,
        sender_id: str,
        sender_role: str,
        message: str
    ) -> DisputeMessage:
        """
        Add a message to the dispute thread.
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        msg = DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            sender_id=sender_id,
            sender_role=sender_role,
            message=message
        )
        
        dispute.messages.append(msg)
        dispute.updated_at = datetime.utcnow().isoformat()
        
        return msg
    
    async def request_response(
        self,
        dispute_id: str,
        from_role: str
    ) -> Dispute:
        """
        Request response from the other party.
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute.status = DisputeStatus.AWAITING_RESPONSE
        dispute.response_deadline = (
            datetime.utcnow() + timedelta(hours=self.RESPONSE_TIMEOUT_HOURS)
        ).isoformat()
        dispute.updated_at = datetime.utcnow().isoformat()
        
        other_role = "seller" if from_role == "buyer" else "buyer"
        
        dispute.messages.append(DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            sender_id=None,
            sender_role="system",
            message=f"Response requested from {other_role}. "
                   f"Deadline: {self.RESPONSE_TIMEOUT_HOURS} hours."
        ))
        
        return dispute
    
    async def move_to_review(self, dispute_id: str) -> Dispute:
        """
        Move dispute to review stage.
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        dispute.status = DisputeStatus.UNDER_REVIEW
        dispute.review_deadline = (
            datetime.utcnow() + timedelta(hours=self.REVIEW_TIMEOUT_HOURS)
        ).isoformat()
        dispute.updated_at = datetime.utcnow().isoformat()
        
        dispute.messages.append(DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute_id,
            sender_id=None,
            sender_role="system",
            message="Dispute is now under review. Resolution expected within "
                   f"{self.REVIEW_TIMEOUT_HOURS} hours."
        ))
        
        return dispute
    
    async def auto_resolve(self, dispute_id: str) -> Dispute:
        """
        Attempt automatic resolution based on rules and evidence.
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        rules = RESOLUTION_RULES.get(dispute.reason, {})
        
        # Check evidence submitted
        buyer_evidence = [e for e in dispute.evidence if e.submitted_by_role == "buyer"]
        seller_evidence = [e for e in dispute.evidence if e.submitted_by_role == "seller"]
        
        buyer_evidence_types = {e.evidence_type for e in buyer_evidence}
        seller_evidence_types = {e.evidence_type for e in seller_evidence}
        
        # Check if seller provided required evidence
        seller_required = set(rules.get("evidence_required_seller", []))
        seller_provided = bool(seller_required & seller_evidence_types)
        
        # Check for tracking info (special case for NOT_RECEIVED)
        has_tracking = EvidenceType.TRACKING_INFO in seller_evidence_types
        
        # Determine resolution
        resolution_type = None
        buyer_amount = 0.0
        seller_amount = 0.0
        resolution_notes = ""
        
        if dispute.reason == DisputeReason.NOT_RECEIVED:
            if has_tracking:
                # Check if tracking shows delivered
                tracking_evidence = [e for e in seller_evidence 
                                   if e.evidence_type == EvidenceType.TRACKING_INFO]
                # In production, would verify tracking with carrier API
                # For now, assume tracking = delivered
                resolution_type = ResolutionType.RELEASE_TO_SELLER
                seller_amount = dispute.escrow_amount
                resolution_notes = "Seller provided valid tracking information showing delivery."
            else:
                resolution_type = ResolutionType.FULL_REFUND
                buyer_amount = dispute.escrow_amount
                resolution_notes = "Seller did not provide tracking information."
        
        elif dispute.reason == DisputeReason.WRONG_ITEM:
            if buyer_evidence and not seller_evidence:
                resolution_type = ResolutionType.FULL_REFUND
                buyer_amount = dispute.escrow_amount
                resolution_notes = "Buyer provided evidence of wrong item. Seller did not respond."
            elif buyer_evidence and seller_evidence:
                # Need human review
                resolution_type = ResolutionType.ESCALATE
                resolution_notes = "Both parties provided evidence. Escalating for human review."
            else:
                resolution_type = ResolutionType.RELEASE_TO_SELLER
                seller_amount = dispute.escrow_amount
                resolution_notes = "Buyer did not provide evidence of wrong item."
        
        elif dispute.reason == DisputeReason.DAMAGED:
            if buyer_evidence:
                # Split by default for damage claims with evidence
                split_ratio = rules.get("split_ratio", (0.7, 0.3))
                resolution_type = ResolutionType.SPLIT
                buyer_amount = dispute.escrow_amount * split_ratio[0]
                seller_amount = dispute.escrow_amount * split_ratio[1]
                resolution_notes = f"Damage claim with evidence. Split {int(split_ratio[0]*100)}% buyer, {int(split_ratio[1]*100)}% seller."
            else:
                resolution_type = ResolutionType.RELEASE_TO_SELLER
                seller_amount = dispute.escrow_amount
                resolution_notes = "No evidence of damage provided."
        
        elif dispute.reason == DisputeReason.NOT_AS_DESCRIBED:
            if buyer_evidence:
                partial_ratio = rules.get("partial_refund_ratio", 0.5)
                resolution_type = ResolutionType.PARTIAL_REFUND
                buyer_amount = dispute.escrow_amount * partial_ratio
                seller_amount = dispute.escrow_amount * (1 - partial_ratio)
                resolution_notes = f"Item not as described. {int(partial_ratio*100)}% refund to buyer."
            else:
                resolution_type = ResolutionType.RELEASE_TO_SELLER
                seller_amount = dispute.escrow_amount
                resolution_notes = "No evidence provided."
        
        elif dispute.reason == DisputeReason.LATE_DELIVERY:
            partial_ratio = rules.get("partial_refund_ratio", 0.1)
            resolution_type = ResolutionType.PARTIAL_REFUND
            buyer_amount = dispute.escrow_amount * partial_ratio
            seller_amount = dispute.escrow_amount * (1 - partial_ratio)
            resolution_notes = f"Late delivery confirmed. {int(partial_ratio*100)}% compensation to buyer."
        
        else:
            # Default: escalate for human review
            resolution_type = ResolutionType.ESCALATE
            resolution_notes = "Requires human review."
        
        # Check if should escalate due to high value
        if dispute.escrow_amount > self.ESCALATION_THRESHOLD_NGN:
            resolution_type = ResolutionType.ESCALATE
            resolution_notes = f"High-value dispute (₦{dispute.escrow_amount:,.0f}). Escalating for review."
        
        # Apply resolution
        if resolution_type == ResolutionType.ESCALATE:
            dispute.status = DisputeStatus.ESCALATED
        else:
            await self._apply_resolution(
                dispute, resolution_type, buyer_amount, seller_amount, 
                "system", resolution_notes
            )
        
        return dispute
    
    async def resolve_manually(
        self,
        dispute_id: str,
        resolution_type: ResolutionType,
        buyer_amount: float,
        seller_amount: float,
        resolved_by: str,
        resolution_notes: str
    ) -> Dispute:
        """
        Manually resolve a dispute (admin action).
        """
        dispute = self.disputes.get(dispute_id)
        if not dispute:
            raise ValueError(f"Dispute {dispute_id} not found")
        
        # Validate amounts
        total = buyer_amount + seller_amount
        if abs(total - dispute.escrow_amount) > 0.01:
            raise ValueError(f"Resolution amounts ({total}) must equal escrow amount ({dispute.escrow_amount})")
        
        await self._apply_resolution(
            dispute, resolution_type, buyer_amount, seller_amount,
            resolved_by, resolution_notes
        )
        
        return dispute
    
    async def _apply_resolution(
        self,
        dispute: Dispute,
        resolution_type: ResolutionType,
        buyer_amount: float,
        seller_amount: float,
        resolved_by: str,
        resolution_notes: str
    ):
        """
        Apply resolution to dispute.
        """
        dispute.resolution_type = resolution_type
        dispute.buyer_amount = buyer_amount
        dispute.seller_amount = seller_amount
        dispute.resolved_by = resolved_by
        dispute.resolved_at = datetime.utcnow().isoformat()
        dispute.resolution_notes = resolution_notes
        dispute.updated_at = datetime.utcnow().isoformat()
        
        # Set status based on resolution
        if resolution_type == ResolutionType.FULL_REFUND:
            dispute.status = DisputeStatus.RESOLVED_BUYER
        elif resolution_type == ResolutionType.RELEASE_TO_SELLER:
            dispute.status = DisputeStatus.RESOLVED_SELLER
        elif resolution_type in [ResolutionType.PARTIAL_REFUND, ResolutionType.SPLIT]:
            dispute.status = DisputeStatus.RESOLVED_SPLIT
        
        # Add resolution message
        dispute.messages.append(DisputeMessage(
            id=str(uuid.uuid4()),
            dispute_id=dispute.id,
            sender_id=None,
            sender_role="system",
            message=f"Dispute resolved: {resolution_type.value}. "
                   f"Buyer receives ₦{buyer_amount:,.0f}, Seller receives ₦{seller_amount:,.0f}. "
                   f"Notes: {resolution_notes}"
        ))
        
        logger.info(f"Dispute {dispute.id} resolved: {resolution_type.value}")
    
    async def get_dispute(self, dispute_id: str) -> Optional[Dispute]:
        """Get dispute by ID"""
        return self.disputes.get(dispute_id)
    
    async def get_dispute_by_escrow(self, escrow_id: str) -> Optional[Dispute]:
        """Get dispute by escrow ID"""
        dispute_id = self.escrow_disputes.get(escrow_id)
        if dispute_id:
            return self.disputes.get(dispute_id)
        return None
    
    async def get_user_disputes(self, user_id: str) -> List[Dispute]:
        """Get all disputes for a user"""
        return [
            d for d in self.disputes.values()
            if d.buyer_id == user_id or d.seller_id == user_id
        ]
    
    async def check_deadlines(self) -> List[Dispute]:
        """
        Check for disputes with passed deadlines and take action.
        Should be called periodically (e.g., every hour).
        """
        now = datetime.utcnow()
        updated_disputes = []
        
        for dispute in self.disputes.values():
            if dispute.status == DisputeStatus.EVIDENCE_COLLECTION:
                if dispute.evidence_deadline:
                    deadline = datetime.fromisoformat(dispute.evidence_deadline)
                    if now > deadline:
                        # Move to review
                        await self.move_to_review(dispute.id)
                        updated_disputes.append(dispute)
            
            elif dispute.status == DisputeStatus.AWAITING_RESPONSE:
                if dispute.response_deadline:
                    deadline = datetime.fromisoformat(dispute.response_deadline)
                    if now > deadline:
                        # No response, auto-resolve in favor of opener
                        await self.auto_resolve(dispute.id)
                        updated_disputes.append(dispute)
            
            elif dispute.status == DisputeStatus.UNDER_REVIEW:
                if dispute.review_deadline:
                    deadline = datetime.fromisoformat(dispute.review_deadline)
                    if now > deadline:
                        # Auto-resolve
                        await self.auto_resolve(dispute.id)
                        updated_disputes.append(dispute)
        
        return updated_disputes
    
    def get_dispute_summary(self, dispute: Dispute) -> Dict[str, Any]:
        """Get summary of dispute for display"""
        return {
            "id": dispute.id,
            "escrow_id": dispute.escrow_id,
            "status": dispute.status.value,
            "reason": dispute.reason.value,
            "amount": dispute.escrow_amount,
            "opened_by": dispute.opened_by_role,
            "description": dispute.description[:200],
            "evidence_count": len(dispute.evidence),
            "message_count": len(dispute.messages),
            "resolution": {
                "type": dispute.resolution_type.value if dispute.resolution_type else None,
                "buyer_amount": dispute.buyer_amount,
                "seller_amount": dispute.seller_amount,
                "notes": dispute.resolution_notes
            } if dispute.resolution_type else None,
            "created_at": dispute.created_at,
            "resolved_at": dispute.resolved_at
        }


# Global dispute resolution instance
dispute_resolution = DisputeResolutionService()
