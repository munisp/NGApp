"""
Dispute Resolution Operational Workflow for SocialEscrow
Implements full dispute lifecycle: evidence submission, mediation, SLA timers,
escalation paths, and resolution outcomes that drive ledger movements.
"""

import json
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class DisputeStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    EVIDENCE_COLLECTION = "evidence_collection"
    UNDER_REVIEW = "under_review"
    MEDIATION = "mediation"
    ESCALATED = "escalated"
    RESOLVED_BUYER_FAVOR = "resolved_buyer_favor"
    RESOLVED_SELLER_FAVOR = "resolved_seller_favor"
    RESOLVED_SPLIT = "resolved_split"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class DisputeReason(str, Enum):
    ITEM_NOT_RECEIVED = "item_not_received"
    ITEM_NOT_AS_DESCRIBED = "item_not_as_described"
    ITEM_DAMAGED = "item_damaged"
    WRONG_ITEM = "wrong_item"
    COUNTERFEIT = "counterfeit"
    SELLER_UNRESPONSIVE = "seller_unresponsive"
    PARTIAL_DELIVERY = "partial_delivery"
    QUALITY_ISSUE = "quality_issue"
    OTHER = "other"


class EvidenceType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    SCREENSHOT = "screenshot"
    CHAT_LOG = "chat_log"
    RECEIPT = "receipt"
    TRACKING_INFO = "tracking_info"
    DOCUMENT = "document"
    OTHER = "other"


class ResolutionType(str, Enum):
    FULL_REFUND = "full_refund"
    PARTIAL_REFUND = "partial_refund"
    REPLACEMENT = "replacement"
    RELEASE_TO_SELLER = "release_to_seller"
    SPLIT = "split"
    NO_ACTION = "no_action"


# Database Models
class DisputeCase(Base):
    __tablename__ = "dispute_cases"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_number = Column(String(20), unique=True, index=True)
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=False, index=True)
    
    # Parties
    initiated_by = Column(String(36), nullable=False)  # user_id
    initiator_role = Column(String(20), nullable=False)  # buyer or seller
    respondent_id = Column(String(36), nullable=False)
    
    # Dispute details
    reason = Column(SQLEnum(DisputeReason), nullable=False)
    description = Column(Text, nullable=False)
    amount_disputed = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    
    # Status tracking
    status = Column(SQLEnum(DisputeStatus), default=DisputeStatus.DRAFT)
    status_history = Column(Text)  # JSON array
    
    # Assignment
    assigned_reviewer_id = Column(String(36))
    assigned_at = Column(DateTime)
    review_priority = Column(Integer, default=5)  # 1-10, 1 being highest
    
    # SLA tracking
    evidence_deadline = Column(DateTime)
    review_deadline = Column(DateTime)
    resolution_deadline = Column(DateTime)
    sla_breached = Column(Boolean, default=False)
    
    # Escalation
    escalation_level = Column(Integer, default=0)
    escalated_at = Column(DateTime)
    escalation_reason = Column(Text)
    
    # Resolution
    resolution_type = Column(SQLEnum(ResolutionType))
    resolution_amount = Column(Float)
    resolution_notes = Column(Text)
    resolved_by = Column(String(36))
    resolved_at = Column(DateTime)
    
    # Risk scoring
    risk_score = Column(Float, default=0.0)
    auto_flagged = Column(Boolean, default=False)
    flag_reasons = Column(Text)  # JSON array
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    evidence = relationship("DisputeEvidence", back_populates="dispute_case")
    messages = relationship("DisputeMessage", back_populates="dispute_case")


class DisputeEvidence(Base):
    __tablename__ = "dispute_evidence"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    dispute_id = Column(String(36), ForeignKey("dispute_cases.id"), nullable=False, index=True)
    
    # Evidence details
    evidence_type = Column(SQLEnum(EvidenceType), nullable=False)
    title = Column(String(200))
    description = Column(Text)
    
    # File storage
    file_url = Column(String(500))
    file_hash = Column(String(64))  # SHA-256 for immutability verification
    file_size = Column(Integer)
    mime_type = Column(String(100))
    
    # Metadata
    submitted_by = Column(String(36), nullable=False)
    submitted_by_role = Column(String(20))  # buyer, seller, reviewer
    
    # Timestamps (immutable)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Verification
    verified = Column(Boolean, default=False)
    verified_by = Column(String(36))
    verified_at = Column(DateTime)
    verification_notes = Column(Text)
    
    # Relationships
    dispute_case = relationship("DisputeCase", back_populates="evidence")


class DisputeMessage(Base):
    __tablename__ = "dispute_messages"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    dispute_id = Column(String(36), ForeignKey("dispute_cases.id"), nullable=False, index=True)
    
    sender_id = Column(String(36), nullable=False)
    sender_role = Column(String(20))  # buyer, seller, reviewer, system
    
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal reviewer notes
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dispute_case = relationship("DisputeCase", back_populates="messages")


class ReviewerQueue(Base):
    __tablename__ = "reviewer_queue"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    reviewer_id = Column(String(36), nullable=False, index=True)
    
    # Capacity
    max_active_cases = Column(Integer, default=20)
    current_active_cases = Column(Integer, default=0)
    
    # Specializations
    specializations = Column(Text)  # JSON array of DisputeReason
    
    # Performance
    total_resolved = Column(Integer, default=0)
    avg_resolution_time_hours = Column(Float)
    satisfaction_rating = Column(Float)
    
    # Availability
    is_available = Column(Boolean, default=True)
    unavailable_until = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Pydantic Models
class CreateDisputeRequest(BaseModel):
    escrow_id: str
    reason: DisputeReason
    description: str
    amount_disputed: Optional[float] = None


class SubmitEvidenceRequest(BaseModel):
    evidence_type: EvidenceType
    title: str
    description: Optional[str] = None
    file_url: str
    file_hash: str
    file_size: int
    mime_type: str


class ResolveDisputeRequest(BaseModel):
    resolution_type: ResolutionType
    resolution_amount: Optional[float] = None
    resolution_notes: str


class DisputeResponse(BaseModel):
    id: str
    case_number: str
    escrow_id: str
    status: DisputeStatus
    reason: DisputeReason
    amount_disputed: float
    evidence_deadline: Optional[datetime]
    resolution_deadline: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Dispute Service
class DisputeService:
    """Main dispute resolution service"""
    
    # SLA configurations (in hours)
    SLA_EVIDENCE_COLLECTION = 48  # 48 hours to submit evidence
    SLA_INITIAL_REVIEW = 24  # 24 hours for initial review
    SLA_RESOLUTION = 72  # 72 hours total resolution time
    SLA_ESCALATION_THRESHOLD = 96  # Auto-escalate after 96 hours
    
    # Risk thresholds
    HIGH_VALUE_THRESHOLD = 500000  # NGN 500,000
    REPEAT_DISPUTE_THRESHOLD = 3  # 3+ disputes = high risk
    
    def __init__(self, event_bus: EventBus, redis_client: Any, ledger_client: Any):
        self.event_bus = event_bus
        self.redis = redis_client
        self.ledger = ledger_client
    
    def _generate_case_number(self) -> str:
        """Generate unique case number"""
        import random
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        random_suffix = random.randint(1000, 9999)
        return f"DSP-{timestamp}-{random_suffix}"
    
    async def _calculate_risk_score(self, db, escrow_id: str, user_id: str) -> tuple[float, list[str]]:
        """Calculate risk score for dispute"""
        risk_score = 0.0
        flag_reasons = []
        
        # Check escrow value
        escrow = db.query("escrows").filter_by(id=escrow_id).first()
        if escrow and escrow.amount > self.HIGH_VALUE_THRESHOLD:
            risk_score += 3.0
            flag_reasons.append("high_value_transaction")
        
        # Check user's dispute history
        user_disputes = db.query(DisputeCase).filter(
            DisputeCase.initiated_by == user_id
        ).count()
        if user_disputes >= self.REPEAT_DISPUTE_THRESHOLD:
            risk_score += 2.0
            flag_reasons.append("repeat_disputer")
        
        # Check if new user (less than 30 days)
        # This would check user creation date
        
        # Check for pattern matching (same seller, similar amounts)
        
        return risk_score, flag_reasons
    
    async def create_dispute(
        self,
        db,
        user_id: str,
        user_role: str,
        request: CreateDisputeRequest
    ) -> DisputeCase:
        """Create a new dispute case"""
        
        # Get escrow details
        escrow = db.query("escrows").filter_by(id=request.escrow_id).first()
        if not escrow:
            raise ValueError("Escrow not found")
        
        # Determine respondent
        if user_role == "buyer":
            respondent_id = escrow.seller_id
        else:
            respondent_id = escrow.buyer_id
        
        # Calculate risk score
        risk_score, flag_reasons = await self._calculate_risk_score(
            db, request.escrow_id, user_id
        )
        
        # Create dispute case
        dispute = DisputeCase(
            case_number=self._generate_case_number(),
            escrow_id=request.escrow_id,
            initiated_by=user_id,
            initiator_role=user_role,
            respondent_id=respondent_id,
            reason=request.reason,
            description=request.description,
            amount_disputed=request.amount_disputed or escrow.amount,
            currency=escrow.currency,
            status=DisputeStatus.DRAFT,
            status_history=json.dumps([{
                "status": DisputeStatus.DRAFT.value,
                "timestamp": datetime.utcnow().isoformat(),
                "actor": user_id,
            }]),
            risk_score=risk_score,
            auto_flagged=risk_score >= 5.0,
            flag_reasons=json.dumps(flag_reasons) if flag_reasons else None,
        )
        
        db.add(dispute)
        db.commit()
        db.refresh(dispute)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.created",
            data={
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "escrow_id": dispute.escrow_id,
                "reason": dispute.reason.value,
                "risk_score": risk_score,
            }
        ))
        
        return dispute
    
    async def submit_dispute(self, db, dispute_id: str, user_id: str) -> DisputeCase:
        """Submit a draft dispute for review"""
        
        dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
        if not dispute:
            raise ValueError("Dispute not found")
        
        if dispute.status != DisputeStatus.DRAFT:
            raise ValueError("Dispute already submitted")
        
        if dispute.initiated_by != user_id:
            raise ValueError("Not authorized to submit this dispute")
        
        now = datetime.utcnow()
        
        # Update status
        dispute.status = DisputeStatus.EVIDENCE_COLLECTION
        dispute.submitted_at = now
        
        # Set SLA deadlines
        dispute.evidence_deadline = now + timedelta(hours=self.SLA_EVIDENCE_COLLECTION)
        dispute.review_deadline = now + timedelta(hours=self.SLA_INITIAL_REVIEW + self.SLA_EVIDENCE_COLLECTION)
        dispute.resolution_deadline = now + timedelta(hours=self.SLA_RESOLUTION)
        
        # Update status history
        history = json.loads(dispute.status_history or "[]")
        history.append({
            "status": DisputeStatus.EVIDENCE_COLLECTION.value,
            "timestamp": now.isoformat(),
            "actor": user_id,
        })
        dispute.status_history = json.dumps(history)
        
        db.commit()
        db.refresh(dispute)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.submitted",
            data={
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "escrow_id": dispute.escrow_id,
                "evidence_deadline": dispute.evidence_deadline.isoformat(),
            }
        ))
        
        # Notify respondent
        await self.event_bus.publish(Event(
            type="notification.dispute_opened",
            data={
                "user_id": dispute.respondent_id,
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "evidence_deadline": dispute.evidence_deadline.isoformat(),
            }
        ))
        
        return dispute
    
    async def submit_evidence(
        self,
        db,
        dispute_id: str,
        user_id: str,
        user_role: str,
        request: SubmitEvidenceRequest
    ) -> DisputeEvidence:
        """Submit evidence for a dispute"""
        
        dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
        if not dispute:
            raise ValueError("Dispute not found")
        
        # Check if evidence submission is allowed
        if dispute.status not in [
            DisputeStatus.EVIDENCE_COLLECTION,
            DisputeStatus.UNDER_REVIEW,
            DisputeStatus.MEDIATION
        ]:
            raise ValueError("Evidence submission not allowed in current status")
        
        # Check deadline
        if dispute.evidence_deadline and datetime.utcnow() > dispute.evidence_deadline:
            raise ValueError("Evidence submission deadline has passed")
        
        # Create evidence record (immutable)
        evidence = DisputeEvidence(
            dispute_id=dispute_id,
            evidence_type=request.evidence_type,
            title=request.title,
            description=request.description,
            file_url=request.file_url,
            file_hash=request.file_hash,
            file_size=request.file_size,
            mime_type=request.mime_type,
            submitted_by=user_id,
            submitted_by_role=user_role,
        )
        
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.evidence_submitted",
            data={
                "dispute_id": dispute_id,
                "evidence_id": evidence.id,
                "evidence_type": request.evidence_type.value,
                "submitted_by": user_id,
            }
        ))
        
        return evidence
    
    async def assign_reviewer(self, db, dispute_id: str) -> DisputeCase:
        """Assign a reviewer to the dispute"""
        
        dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
        if not dispute:
            raise ValueError("Dispute not found")
        
        # Find available reviewer with capacity
        reviewer = db.query(ReviewerQueue).filter(
            ReviewerQueue.is_available == True,
            ReviewerQueue.current_active_cases < ReviewerQueue.max_active_cases
        ).order_by(
            ReviewerQueue.current_active_cases.asc(),
            ReviewerQueue.avg_resolution_time_hours.asc()
        ).first()
        
        if not reviewer:
            # No available reviewer - escalate
            await self._escalate_dispute(db, dispute, "no_available_reviewer")
            return dispute
        
        # Assign reviewer
        dispute.assigned_reviewer_id = reviewer.reviewer_id
        dispute.assigned_at = datetime.utcnow()
        dispute.status = DisputeStatus.UNDER_REVIEW
        
        # Update reviewer queue
        reviewer.current_active_cases += 1
        
        # Update status history
        history = json.loads(dispute.status_history or "[]")
        history.append({
            "status": DisputeStatus.UNDER_REVIEW.value,
            "timestamp": datetime.utcnow().isoformat(),
            "actor": "system",
            "reviewer_id": reviewer.reviewer_id,
        })
        dispute.status_history = json.dumps(history)
        
        db.commit()
        db.refresh(dispute)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.reviewer_assigned",
            data={
                "dispute_id": dispute.id,
                "reviewer_id": reviewer.reviewer_id,
            }
        ))
        
        return dispute
    
    async def _escalate_dispute(
        self,
        db,
        dispute: DisputeCase,
        reason: str
    ) -> DisputeCase:
        """Escalate dispute to higher level"""
        
        dispute.escalation_level += 1
        dispute.escalated_at = datetime.utcnow()
        dispute.escalation_reason = reason
        dispute.status = DisputeStatus.ESCALATED
        
        # Update status history
        history = json.loads(dispute.status_history or "[]")
        history.append({
            "status": DisputeStatus.ESCALATED.value,
            "timestamp": datetime.utcnow().isoformat(),
            "actor": "system",
            "reason": reason,
            "level": dispute.escalation_level,
        })
        dispute.status_history = json.dumps(history)
        
        db.commit()
        db.refresh(dispute)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.escalated",
            data={
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "escalation_level": dispute.escalation_level,
                "reason": reason,
            }
        ))
        
        return dispute
    
    async def resolve_dispute(
        self,
        db,
        dispute_id: str,
        reviewer_id: str,
        request: ResolveDisputeRequest
    ) -> DisputeCase:
        """Resolve a dispute with final decision"""
        
        dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
        if not dispute:
            raise ValueError("Dispute not found")
        
        if dispute.assigned_reviewer_id != reviewer_id:
            raise ValueError("Not authorized to resolve this dispute")
        
        # Determine final status based on resolution type
        if request.resolution_type == ResolutionType.FULL_REFUND:
            final_status = DisputeStatus.RESOLVED_BUYER_FAVOR
            resolution_amount = dispute.amount_disputed
        elif request.resolution_type == ResolutionType.RELEASE_TO_SELLER:
            final_status = DisputeStatus.RESOLVED_SELLER_FAVOR
            resolution_amount = 0
        elif request.resolution_type == ResolutionType.SPLIT:
            final_status = DisputeStatus.RESOLVED_SPLIT
            resolution_amount = request.resolution_amount or (dispute.amount_disputed / 2)
        elif request.resolution_type == ResolutionType.PARTIAL_REFUND:
            final_status = DisputeStatus.RESOLVED_BUYER_FAVOR
            resolution_amount = request.resolution_amount
        else:
            final_status = DisputeStatus.RESOLVED_SELLER_FAVOR
            resolution_amount = 0
        
        now = datetime.utcnow()
        
        # Update dispute
        dispute.status = final_status
        dispute.resolution_type = request.resolution_type
        dispute.resolution_amount = resolution_amount
        dispute.resolution_notes = request.resolution_notes
        dispute.resolved_by = reviewer_id
        dispute.resolved_at = now
        
        # Update status history
        history = json.loads(dispute.status_history or "[]")
        history.append({
            "status": final_status.value,
            "timestamp": now.isoformat(),
            "actor": reviewer_id,
            "resolution_type": request.resolution_type.value,
            "resolution_amount": resolution_amount,
        })
        dispute.status_history = json.dumps(history)
        
        # Update reviewer queue
        reviewer = db.query(ReviewerQueue).filter(
            ReviewerQueue.reviewer_id == reviewer_id
        ).first()
        if reviewer:
            reviewer.current_active_cases -= 1
            reviewer.total_resolved += 1
        
        db.commit()
        db.refresh(dispute)
        
        # Execute ledger movements based on resolution
        await self._execute_resolution_ledger_movements(dispute, resolution_amount)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="dispute.resolved",
            data={
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "escrow_id": dispute.escrow_id,
                "resolution_type": request.resolution_type.value,
                "resolution_amount": resolution_amount,
                "final_status": final_status.value,
            }
        ))
        
        # Notify parties
        await self.event_bus.publish(Event(
            type="notification.dispute_resolved",
            data={
                "user_ids": [dispute.initiated_by, dispute.respondent_id],
                "dispute_id": dispute.id,
                "case_number": dispute.case_number,
                "resolution_type": request.resolution_type.value,
            }
        ))
        
        return dispute
    
    async def _execute_resolution_ledger_movements(
        self,
        dispute: DisputeCase,
        resolution_amount: float
    ):
        """Execute TigerBeetle ledger movements based on dispute resolution"""
        
        if dispute.resolution_type == ResolutionType.FULL_REFUND:
            # Transfer full amount from escrow to buyer
            await self.ledger.transfer(
                from_account=f"escrow:{dispute.escrow_id}",
                to_account=f"user:{dispute.initiated_by}",
                amount=int(resolution_amount * 100),  # Convert to kobo
                reference=f"dispute_refund:{dispute.id}",
            )
        
        elif dispute.resolution_type == ResolutionType.PARTIAL_REFUND:
            # Partial refund to buyer, rest to seller
            await self.ledger.transfer(
                from_account=f"escrow:{dispute.escrow_id}",
                to_account=f"user:{dispute.initiated_by}",
                amount=int(resolution_amount * 100),
                reference=f"dispute_partial_refund:{dispute.id}",
            )
            remaining = dispute.amount_disputed - resolution_amount
            if remaining > 0:
                await self.ledger.transfer(
                    from_account=f"escrow:{dispute.escrow_id}",
                    to_account=f"user:{dispute.respondent_id}",
                    amount=int(remaining * 100),
                    reference=f"dispute_partial_release:{dispute.id}",
                )
        
        elif dispute.resolution_type == ResolutionType.RELEASE_TO_SELLER:
            # Release full amount to seller
            await self.ledger.transfer(
                from_account=f"escrow:{dispute.escrow_id}",
                to_account=f"user:{dispute.respondent_id}",
                amount=int(dispute.amount_disputed * 100),
                reference=f"dispute_release:{dispute.id}",
            )
        
        elif dispute.resolution_type == ResolutionType.SPLIT:
            # Split between buyer and seller
            buyer_amount = resolution_amount
            seller_amount = dispute.amount_disputed - resolution_amount
            
            await self.ledger.transfer(
                from_account=f"escrow:{dispute.escrow_id}",
                to_account=f"user:{dispute.initiated_by}",
                amount=int(buyer_amount * 100),
                reference=f"dispute_split_buyer:{dispute.id}",
            )
            await self.ledger.transfer(
                from_account=f"escrow:{dispute.escrow_id}",
                to_account=f"user:{dispute.respondent_id}",
                amount=int(seller_amount * 100),
                reference=f"dispute_split_seller:{dispute.id}",
            )
    
    async def check_sla_breaches(self, db):
        """Check for SLA breaches and auto-escalate"""
        
        now = datetime.utcnow()
        
        # Find disputes past their deadlines
        breached_disputes = db.query(DisputeCase).filter(
            DisputeCase.status.in_([
                DisputeStatus.EVIDENCE_COLLECTION,
                DisputeStatus.UNDER_REVIEW,
                DisputeStatus.MEDIATION,
            ]),
            DisputeCase.sla_breached == False,
            DisputeCase.resolution_deadline < now
        ).all()
        
        for dispute in breached_disputes:
            dispute.sla_breached = True
            await self._escalate_dispute(db, dispute, "sla_breach")
        
        db.commit()
    
    async def add_message(
        self,
        db,
        dispute_id: str,
        user_id: str,
        user_role: str,
        message: str,
        is_internal: bool = False
    ) -> DisputeMessage:
        """Add a message to the dispute thread"""
        
        dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
        if not dispute:
            raise ValueError("Dispute not found")
        
        msg = DisputeMessage(
            dispute_id=dispute_id,
            sender_id=user_id,
            sender_role=user_role,
            message=message,
            is_internal=is_internal,
        )
        
        db.add(msg)
        db.commit()
        db.refresh(msg)
        
        # Publish event (only for non-internal messages)
        if not is_internal:
            await self.event_bus.publish(Event(
                type="dispute.message_added",
                data={
                    "dispute_id": dispute_id,
                    "message_id": msg.id,
                    "sender_id": user_id,
                }
            ))
        
        return msg


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/disputes", tags=["disputes"])


@router.post("/", response_model=DisputeResponse)
async def create_dispute(
    request: CreateDisputeRequest,
    user_id: str = Query(...),
    user_role: str = Query(...),
    db: Session = Depends(get_db),
):
    """Create a new dispute case"""
    try:
        from app.main import get_dispute_service
        service = get_dispute_service()
        dispute = await service.create_dispute(db, user_id, user_role, request)
        return DisputeResponse.from_orm(dispute)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/submit")
async def submit_dispute(
    dispute_id: str,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Submit a draft dispute for review"""
    try:
        from app.main import get_dispute_service
        service = get_dispute_service()
        dispute = await service.submit_dispute(db, dispute_id, user_id)
        return DisputeResponse.from_orm(dispute)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/evidence")
async def submit_evidence(
    dispute_id: str,
    request: SubmitEvidenceRequest,
    user_id: str = Query(...),
    user_role: str = Query(...),
    db: Session = Depends(get_db),
):
    """Submit evidence for a dispute"""
    try:
        from app.main import get_dispute_service
        service = get_dispute_service()
        evidence = await service.submit_evidence(db, dispute_id, user_id, user_role, request)
        return {"evidence_id": evidence.id, "status": "submitted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    request: ResolveDisputeRequest,
    reviewer_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Resolve a dispute with final decision"""
    try:
        from app.main import get_dispute_service
        service = get_dispute_service()
        dispute = await service.resolve_dispute(db, dispute_id, reviewer_id, request)
        return DisputeResponse.from_orm(dispute)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    db: Session = Depends(get_db),
):
    """Get dispute details"""
    dispute = db.query(DisputeCase).filter(DisputeCase.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    evidence = db.query(DisputeEvidence).filter(
        DisputeEvidence.dispute_id == dispute_id
    ).all()
    
    messages = db.query(DisputeMessage).filter(
        DisputeMessage.dispute_id == dispute_id,
        DisputeMessage.is_internal == False
    ).order_by(DisputeMessage.created_at.asc()).all()
    
    return {
        "dispute": DisputeResponse.from_orm(dispute),
        "evidence": [
            {
                "id": e.id,
                "type": e.evidence_type.value,
                "title": e.title,
                "file_url": e.file_url,
                "submitted_by": e.submitted_by,
                "created_at": e.created_at,
            }
            for e in evidence
        ],
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_role": m.sender_role,
                "message": m.message,
                "created_at": m.created_at,
            }
            for m in messages
        ],
        "status_history": json.loads(dispute.status_history or "[]"),
    }


@router.post("/{dispute_id}/messages")
async def add_message(
    dispute_id: str,
    message: str,
    user_id: str = Query(...),
    user_role: str = Query(...),
    db: Session = Depends(get_db),
):
    """Add a message to the dispute thread"""
    try:
        from app.main import get_dispute_service
        service = get_dispute_service()
        msg = await service.add_message(db, dispute_id, user_id, user_role, message)
        return {"message_id": msg.id, "status": "sent"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
