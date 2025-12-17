"""
Returns & Refunds Pipeline

Provides a standardized returns/refunds workflow:
- RMA (Return Merchandise Authorization) generation
- Reverse logistics integration
- Inspection workflow
- Partial refund policies
- Automated refund processing

This closes the gap with marketplaces like Jumia/Jiji that have mature returns operations.
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

router = APIRouter(prefix="/api/v1/returns", tags=["Returns & Refunds"])


# ============================================
# ENUMS
# ============================================

class ReturnReason(str, Enum):
    """Reasons for return"""
    WRONG_ITEM = "wrong_item"
    DAMAGED = "damaged"
    NOT_AS_DESCRIBED = "not_as_described"
    DEFECTIVE = "defective"
    CHANGED_MIND = "changed_mind"
    SIZE_FIT = "size_fit"
    QUALITY_ISSUE = "quality_issue"
    LATE_DELIVERY = "late_delivery"
    MISSING_PARTS = "missing_parts"
    OTHER = "other"


class ReturnStatus(str, Enum):
    """Return request status"""
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    PICKUP_SCHEDULED = "pickup_scheduled"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    INSPECTING = "inspecting"
    INSPECTION_PASSED = "inspection_passed"
    INSPECTION_FAILED = "inspection_failed"
    REFUND_PROCESSING = "refund_processing"
    REFUND_COMPLETED = "refund_completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class RefundType(str, Enum):
    """Type of refund"""
    FULL = "full"
    PARTIAL = "partial"
    STORE_CREDIT = "store_credit"
    REPLACEMENT = "replacement"
    NO_REFUND = "no_refund"


class RefundMethod(str, Enum):
    """Method of refund"""
    ORIGINAL_PAYMENT = "original_payment"
    BANK_TRANSFER = "bank_transfer"
    WALLET = "wallet"
    STORE_CREDIT = "store_credit"


class InspectionResult(str, Enum):
    """Result of item inspection"""
    PASSED = "passed"
    MINOR_DAMAGE = "minor_damage"
    MAJOR_DAMAGE = "major_damage"
    WRONG_ITEM_RETURNED = "wrong_item_returned"
    ITEM_MISSING = "item_missing"
    TAMPERED = "tampered"


# ============================================
# DATA MODELS
# ============================================

@dataclass
class ReturnPolicy:
    """Seller's return policy"""
    seller_id: str
    accepts_returns: bool = True
    return_window_days: int = 7
    
    # Eligible reasons
    eligible_reasons: List[ReturnReason] = field(default_factory=lambda: [
        ReturnReason.WRONG_ITEM,
        ReturnReason.DAMAGED,
        ReturnReason.NOT_AS_DESCRIBED,
        ReturnReason.DEFECTIVE,
        ReturnReason.MISSING_PARTS
    ])
    
    # Refund policies by reason
    full_refund_reasons: List[ReturnReason] = field(default_factory=lambda: [
        ReturnReason.WRONG_ITEM,
        ReturnReason.DAMAGED,
        ReturnReason.DEFECTIVE
    ])
    
    partial_refund_reasons: List[ReturnReason] = field(default_factory=lambda: [
        ReturnReason.NOT_AS_DESCRIBED,
        ReturnReason.QUALITY_ISSUE
    ])
    
    # Changed mind policy
    changed_mind_eligible: bool = False
    changed_mind_restocking_fee_pct: int = 15
    
    # Shipping
    buyer_pays_return_shipping: bool = False
    free_return_threshold_ngn: int = 50000
    
    # Conditions
    requires_original_packaging: bool = True
    requires_tags_attached: bool = True
    requires_receipt: bool = False


@dataclass
class ReturnItem:
    """Item being returned"""
    product_id: str
    variant_id: Optional[str]
    product_title: str
    quantity: int
    unit_price_ngn: int
    total_ngn: int
    condition_on_return: Optional[str] = None
    inspection_result: Optional[InspectionResult] = None
    inspection_notes: str = ""


@dataclass
class ReturnRequest:
    """Return/refund request"""
    return_id: str
    order_id: str
    escrow_id: Optional[str]
    seller_id: str
    buyer_id: str
    
    # Status
    status: ReturnStatus
    
    # Items
    items: List[ReturnItem]
    
    # Reason
    reason: ReturnReason
    reason_details: str
    
    # Evidence
    photos: List[str] = field(default_factory=list)
    video_url: Optional[str] = None
    
    # RMA
    rma_number: Optional[str] = None
    
    # Logistics
    pickup_address: Optional[str] = None
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_scheduled_date: Optional[datetime] = None
    logistics_provider: Optional[str] = None
    tracking_number: Optional[str] = None
    
    # Inspection
    inspection_date: Optional[datetime] = None
    inspection_result: Optional[InspectionResult] = None
    inspection_notes: str = ""
    inspected_by: Optional[str] = None
    
    # Refund
    refund_type: Optional[RefundType] = None
    refund_method: Optional[RefundMethod] = None
    refund_amount_ngn: int = 0
    restocking_fee_ngn: int = 0
    return_shipping_fee_ngn: int = 0
    refund_reference: Optional[str] = None
    
    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    # SLA
    sla_deadline: Optional[datetime] = None
    sla_breached: bool = False
    
    # Notes
    seller_notes: str = ""
    buyer_notes: str = ""
    internal_notes: str = ""


@dataclass
class RefundTransaction:
    """Refund transaction record"""
    refund_id: str
    return_id: str
    order_id: str
    escrow_id: Optional[str]
    
    amount_ngn: int
    method: RefundMethod
    status: str  # pending, processing, completed, failed
    
    # Bank details (if bank transfer)
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    
    # Reference
    payment_reference: Optional[str] = None
    
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    failure_reason: Optional[str] = None


# ============================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================

return_policies_db: Dict[str, ReturnPolicy] = {}
return_requests_db: Dict[str, ReturnRequest] = {}
refund_transactions_db: Dict[str, RefundTransaction] = {}


# ============================================
# RETURNS ENGINE
# ============================================

class ReturnsEngine:
    """Core engine for returns and refunds"""
    
    # SLA Configuration
    APPROVAL_SLA_HOURS = 24
    INSPECTION_SLA_HOURS = 48
    REFUND_SLA_HOURS = 72
    
    # ============================================
    # RETURN POLICY
    # ============================================
    
    @staticmethod
    def get_or_create_policy(seller_id: str) -> ReturnPolicy:
        """Get or create return policy for seller"""
        if seller_id not in return_policies_db:
            return_policies_db[seller_id] = ReturnPolicy(seller_id=seller_id)
        return return_policies_db[seller_id]
    
    @staticmethod
    def update_policy(seller_id: str, updates: Dict[str, Any]) -> ReturnPolicy:
        """Update seller's return policy"""
        policy = ReturnsEngine.get_or_create_policy(seller_id)
        
        for key, value in updates.items():
            if hasattr(policy, key):
                setattr(policy, key, value)
        
        return policy
    
    @staticmethod
    def check_return_eligibility(
        seller_id: str,
        order_date: datetime,
        reason: ReturnReason
    ) -> Dict[str, Any]:
        """Check if a return is eligible"""
        policy = ReturnsEngine.get_or_create_policy(seller_id)
        
        if not policy.accepts_returns:
            return {
                "eligible": False,
                "reason": "Seller does not accept returns"
            }
        
        # Check return window
        days_since_order = (datetime.utcnow() - order_date).days
        if days_since_order > policy.return_window_days:
            return {
                "eligible": False,
                "reason": f"Return window of {policy.return_window_days} days has expired"
            }
        
        # Check if reason is eligible
        if reason not in policy.eligible_reasons:
            if reason == ReturnReason.CHANGED_MIND and not policy.changed_mind_eligible:
                return {
                    "eligible": False,
                    "reason": "Changed mind returns are not accepted"
                }
            return {
                "eligible": False,
                "reason": f"Return reason '{reason.value}' is not eligible"
            }
        
        # Determine refund type
        if reason in policy.full_refund_reasons:
            refund_type = RefundType.FULL
            restocking_fee_pct = 0
        elif reason in policy.partial_refund_reasons:
            refund_type = RefundType.PARTIAL
            restocking_fee_pct = 10
        elif reason == ReturnReason.CHANGED_MIND:
            refund_type = RefundType.PARTIAL
            restocking_fee_pct = policy.changed_mind_restocking_fee_pct
        else:
            refund_type = RefundType.FULL
            restocking_fee_pct = 0
        
        return {
            "eligible": True,
            "refund_type": refund_type.value,
            "restocking_fee_pct": restocking_fee_pct,
            "buyer_pays_shipping": policy.buyer_pays_return_shipping,
            "requires_original_packaging": policy.requires_original_packaging,
            "requires_tags_attached": policy.requires_tags_attached
        }
    
    # ============================================
    # RETURN REQUESTS
    # ============================================
    
    @staticmethod
    def create_return_request(
        order_id: str,
        seller_id: str,
        buyer_id: str,
        items: List[Dict[str, Any]],
        reason: ReturnReason,
        reason_details: str,
        photos: List[str] = None,
        video_url: str = None,
        pickup_address: str = None,
        pickup_city: str = None,
        pickup_state: str = None,
        escrow_id: str = None
    ) -> ReturnRequest:
        """Create a new return request"""
        return_id = f"ret_{uuid.uuid4().hex[:12]}"
        rma_number = f"RMA-{uuid.uuid4().hex[:8].upper()}"
        
        # Create return items
        return_items = []
        total_value = 0
        for item in items:
            return_item = ReturnItem(
                product_id=item.get("product_id"),
                variant_id=item.get("variant_id"),
                product_title=item.get("product_title", "Unknown"),
                quantity=item.get("quantity", 1),
                unit_price_ngn=item.get("unit_price_ngn", 0),
                total_ngn=item.get("unit_price_ngn", 0) * item.get("quantity", 1)
            )
            return_items.append(return_item)
            total_value += return_item.total_ngn
        
        # Calculate SLA deadline
        sla_deadline = datetime.utcnow() + timedelta(hours=ReturnsEngine.APPROVAL_SLA_HOURS)
        
        return_request = ReturnRequest(
            return_id=return_id,
            order_id=order_id,
            escrow_id=escrow_id,
            seller_id=seller_id,
            buyer_id=buyer_id,
            status=ReturnStatus.REQUESTED,
            items=return_items,
            reason=reason,
            reason_details=reason_details,
            photos=photos or [],
            video_url=video_url,
            rma_number=rma_number,
            pickup_address=pickup_address,
            pickup_city=pickup_city,
            pickup_state=pickup_state,
            sla_deadline=sla_deadline
        )
        
        return_requests_db[return_id] = return_request
        logger.info(f"Created return request {return_id} for order {order_id}")
        return return_request
    
    @staticmethod
    def approve_return(
        return_id: str,
        seller_notes: str = "",
        logistics_provider: str = None
    ) -> ReturnRequest:
        """Approve a return request"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        
        if return_request.status != ReturnStatus.REQUESTED:
            raise ValueError(f"Return request is not in REQUESTED status")
        
        return_request.status = ReturnStatus.APPROVED
        return_request.approved_at = datetime.utcnow()
        return_request.seller_notes = seller_notes
        return_request.logistics_provider = logistics_provider or "GIG Logistics"
        
        # Update SLA deadline for inspection
        return_request.sla_deadline = datetime.utcnow() + timedelta(hours=ReturnsEngine.INSPECTION_SLA_HOURS)
        
        logger.info(f"Approved return request {return_id}")
        return return_request
    
    @staticmethod
    def reject_return(
        return_id: str,
        rejection_reason: str
    ) -> ReturnRequest:
        """Reject a return request"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        
        if return_request.status != ReturnStatus.REQUESTED:
            raise ValueError(f"Return request is not in REQUESTED status")
        
        return_request.status = ReturnStatus.REJECTED
        return_request.seller_notes = rejection_reason
        return_request.closed_at = datetime.utcnow()
        
        logger.info(f"Rejected return request {return_id}")
        return return_request
    
    @staticmethod
    def schedule_pickup(
        return_id: str,
        pickup_date: datetime,
        logistics_provider: str = "GIG Logistics"
    ) -> ReturnRequest:
        """Schedule pickup for return"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        
        if return_request.status not in [ReturnStatus.APPROVED]:
            raise ValueError(f"Return request must be approved before scheduling pickup")
        
        return_request.status = ReturnStatus.PICKUP_SCHEDULED
        return_request.pickup_scheduled_date = pickup_date
        return_request.logistics_provider = logistics_provider
        return_request.tracking_number = f"TRK-{uuid.uuid4().hex[:10].upper()}"
        
        logger.info(f"Scheduled pickup for return {return_id}")
        return return_request
    
    @staticmethod
    def mark_in_transit(return_id: str) -> ReturnRequest:
        """Mark return as in transit"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        return_request.status = ReturnStatus.IN_TRANSIT
        
        return return_request
    
    @staticmethod
    def mark_received(return_id: str) -> ReturnRequest:
        """Mark return as received"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        return_request.status = ReturnStatus.RECEIVED
        return_request.received_at = datetime.utcnow()
        
        # Update SLA deadline for inspection
        return_request.sla_deadline = datetime.utcnow() + timedelta(hours=24)
        
        return return_request
    
    @staticmethod
    def record_inspection(
        return_id: str,
        result: InspectionResult,
        notes: str,
        inspected_by: str,
        item_results: List[Dict[str, Any]] = None
    ) -> ReturnRequest:
        """Record inspection results"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        
        if return_request.status not in [ReturnStatus.RECEIVED, ReturnStatus.INSPECTING]:
            raise ValueError(f"Return must be received before inspection")
        
        return_request.status = ReturnStatus.INSPECTING
        return_request.inspection_date = datetime.utcnow()
        return_request.inspection_result = result
        return_request.inspection_notes = notes
        return_request.inspected_by = inspected_by
        
        # Update individual item results
        if item_results:
            for i, item_result in enumerate(item_results):
                if i < len(return_request.items):
                    return_request.items[i].inspection_result = InspectionResult(item_result.get("result", "passed"))
                    return_request.items[i].inspection_notes = item_result.get("notes", "")
                    return_request.items[i].condition_on_return = item_result.get("condition", "")
        
        # Determine next status based on result
        if result in [InspectionResult.PASSED, InspectionResult.MINOR_DAMAGE]:
            return_request.status = ReturnStatus.INSPECTION_PASSED
        else:
            return_request.status = ReturnStatus.INSPECTION_FAILED
        
        # Update SLA deadline for refund
        return_request.sla_deadline = datetime.utcnow() + timedelta(hours=ReturnsEngine.REFUND_SLA_HOURS)
        
        logger.info(f"Recorded inspection for return {return_id}: {result.value}")
        return return_request
    
    @staticmethod
    def calculate_refund_amount(return_request: ReturnRequest) -> Dict[str, int]:
        """Calculate refund amount based on inspection and policy"""
        policy = ReturnsEngine.get_or_create_policy(return_request.seller_id)
        
        # Calculate item total
        item_total = sum(item.total_ngn for item in return_request.items)
        
        # Determine refund percentage based on inspection result
        if return_request.inspection_result == InspectionResult.PASSED:
            refund_pct = 100
        elif return_request.inspection_result == InspectionResult.MINOR_DAMAGE:
            refund_pct = 90
        elif return_request.inspection_result == InspectionResult.MAJOR_DAMAGE:
            refund_pct = 50
        elif return_request.inspection_result == InspectionResult.WRONG_ITEM_RETURNED:
            refund_pct = 0
        elif return_request.inspection_result == InspectionResult.ITEM_MISSING:
            refund_pct = 0
        elif return_request.inspection_result == InspectionResult.TAMPERED:
            refund_pct = 0
        else:
            refund_pct = 100
        
        # Apply restocking fee for changed mind
        restocking_fee = 0
        if return_request.reason == ReturnReason.CHANGED_MIND:
            restocking_fee = int(item_total * policy.changed_mind_restocking_fee_pct / 100)
        
        # Calculate return shipping fee
        return_shipping_fee = 0
        if policy.buyer_pays_return_shipping and item_total < policy.free_return_threshold_ngn:
            return_shipping_fee = 1500  # Standard return shipping fee
        
        # Calculate final refund
        refund_before_fees = int(item_total * refund_pct / 100)
        refund_amount = max(0, refund_before_fees - restocking_fee - return_shipping_fee)
        
        return {
            "item_total_ngn": item_total,
            "refund_percentage": refund_pct,
            "restocking_fee_ngn": restocking_fee,
            "return_shipping_fee_ngn": return_shipping_fee,
            "refund_amount_ngn": refund_amount
        }
    
    @staticmethod
    def process_refund(
        return_id: str,
        refund_method: RefundMethod,
        bank_code: str = None,
        account_number: str = None,
        account_name: str = None
    ) -> RefundTransaction:
        """Process refund for a return"""
        if return_id not in return_requests_db:
            raise ValueError(f"Return request {return_id} not found")
        
        return_request = return_requests_db[return_id]
        
        if return_request.status not in [ReturnStatus.INSPECTION_PASSED, ReturnStatus.INSPECTION_FAILED]:
            raise ValueError(f"Inspection must be completed before refund")
        
        # Calculate refund amount
        refund_calc = ReturnsEngine.calculate_refund_amount(return_request)
        
        if refund_calc["refund_amount_ngn"] == 0:
            return_request.status = ReturnStatus.CLOSED
            return_request.refund_type = RefundType.NO_REFUND
            return_request.closed_at = datetime.utcnow()
            raise ValueError("No refund due based on inspection results")
        
        # Update return request
        return_request.status = ReturnStatus.REFUND_PROCESSING
        return_request.refund_type = RefundType.FULL if refund_calc["refund_percentage"] == 100 else RefundType.PARTIAL
        return_request.refund_method = refund_method
        return_request.refund_amount_ngn = refund_calc["refund_amount_ngn"]
        return_request.restocking_fee_ngn = refund_calc["restocking_fee_ngn"]
        return_request.return_shipping_fee_ngn = refund_calc["return_shipping_fee_ngn"]
        
        # Create refund transaction
        refund_id = f"ref_{uuid.uuid4().hex[:12]}"
        refund = RefundTransaction(
            refund_id=refund_id,
            return_id=return_id,
            order_id=return_request.order_id,
            escrow_id=return_request.escrow_id,
            amount_ngn=refund_calc["refund_amount_ngn"],
            method=refund_method,
            status="processing",
            bank_code=bank_code,
            account_number=account_number,
            account_name=account_name,
            payment_reference=f"REF-{uuid.uuid4().hex[:10].upper()}"
        )
        
        refund_transactions_db[refund_id] = refund
        return_request.refund_reference = refund.payment_reference
        
        logger.info(f"Processing refund {refund_id} for return {return_id}: {refund_calc['refund_amount_ngn']} NGN")
        return refund
    
    @staticmethod
    def complete_refund(refund_id: str) -> RefundTransaction:
        """Mark refund as completed"""
        if refund_id not in refund_transactions_db:
            raise ValueError(f"Refund {refund_id} not found")
        
        refund = refund_transactions_db[refund_id]
        refund.status = "completed"
        refund.completed_at = datetime.utcnow()
        
        # Update return request
        if refund.return_id in return_requests_db:
            return_request = return_requests_db[refund.return_id]
            return_request.status = ReturnStatus.REFUND_COMPLETED
            return_request.refunded_at = datetime.utcnow()
            return_request.closed_at = datetime.utcnow()
        
        logger.info(f"Completed refund {refund_id}")
        return refund
    
    @staticmethod
    def fail_refund(refund_id: str, reason: str) -> RefundTransaction:
        """Mark refund as failed"""
        if refund_id not in refund_transactions_db:
            raise ValueError(f"Refund {refund_id} not found")
        
        refund = refund_transactions_db[refund_id]
        refund.status = "failed"
        refund.failure_reason = reason
        
        logger.warning(f"Failed refund {refund_id}: {reason}")
        return refund
    
    # ============================================
    # QUERIES
    # ============================================
    
    @staticmethod
    def get_seller_returns(
        seller_id: str,
        status: Optional[ReturnStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ReturnRequest]:
        """Get returns for a seller"""
        returns = [r for r in return_requests_db.values() if r.seller_id == seller_id]
        
        if status:
            returns = [r for r in returns if r.status == status]
        
        returns.sort(key=lambda r: r.created_at, reverse=True)
        return returns[offset:offset + limit]
    
    @staticmethod
    def get_buyer_returns(
        buyer_id: str,
        status: Optional[ReturnStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ReturnRequest]:
        """Get returns for a buyer"""
        returns = [r for r in return_requests_db.values() if r.buyer_id == buyer_id]
        
        if status:
            returns = [r for r in returns if r.status == status]
        
        returns.sort(key=lambda r: r.created_at, reverse=True)
        return returns[offset:offset + limit]
    
    @staticmethod
    def get_pending_returns(seller_id: str = None) -> List[ReturnRequest]:
        """Get returns pending action"""
        pending_statuses = [
            ReturnStatus.REQUESTED,
            ReturnStatus.APPROVED,
            ReturnStatus.RECEIVED,
            ReturnStatus.INSPECTION_PASSED
        ]
        
        returns = [r for r in return_requests_db.values() if r.status in pending_statuses]
        
        if seller_id:
            returns = [r for r in returns if r.seller_id == seller_id]
        
        returns.sort(key=lambda r: r.sla_deadline or r.created_at)
        return returns
    
    @staticmethod
    def get_sla_breached_returns() -> List[ReturnRequest]:
        """Get returns that have breached SLA"""
        now = datetime.utcnow()
        breached = []
        
        for return_request in return_requests_db.values():
            if return_request.sla_deadline and return_request.sla_deadline < now:
                if return_request.status not in [ReturnStatus.CLOSED, ReturnStatus.CANCELLED, ReturnStatus.REFUND_COMPLETED]:
                    return_request.sla_breached = True
                    breached.append(return_request)
        
        return breached
    
    @staticmethod
    def get_return_analytics(seller_id: str, days: int = 30) -> Dict[str, Any]:
        """Get return analytics for seller"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        returns = [r for r in return_requests_db.values() 
                  if r.seller_id == seller_id and r.created_at >= cutoff]
        
        # Status breakdown
        status_breakdown = {}
        for status in ReturnStatus:
            status_breakdown[status.value] = len([r for r in returns if r.status == status])
        
        # Reason breakdown
        reason_breakdown = {}
        for reason in ReturnReason:
            reason_breakdown[reason.value] = len([r for r in returns if r.reason == reason])
        
        # Refund totals
        completed_refunds = [r for r in returns if r.status == ReturnStatus.REFUND_COMPLETED]
        total_refunded = sum(r.refund_amount_ngn for r in completed_refunds)
        
        # SLA metrics
        sla_breached = len([r for r in returns if r.sla_breached])
        
        return {
            "period_days": days,
            "total_returns": len(returns),
            "status_breakdown": status_breakdown,
            "reason_breakdown": reason_breakdown,
            "refunds": {
                "total_refunded_ngn": total_refunded,
                "average_refund_ngn": total_refunded // len(completed_refunds) if completed_refunds else 0,
                "refund_count": len(completed_refunds)
            },
            "sla": {
                "breached_count": sla_breached,
                "breach_rate_pct": round(sla_breached / len(returns) * 100, 1) if returns else 0
            }
        }


# ============================================
# PYDANTIC MODELS FOR API
# ============================================

class UpdatePolicyRequest(BaseModel):
    accepts_returns: Optional[bool] = None
    return_window_days: Optional[int] = Field(None, ge=1, le=30)
    changed_mind_eligible: Optional[bool] = None
    changed_mind_restocking_fee_pct: Optional[int] = Field(None, ge=0, le=50)
    buyer_pays_return_shipping: Optional[bool] = None
    free_return_threshold_ngn: Optional[int] = None
    requires_original_packaging: Optional[bool] = None
    requires_tags_attached: Optional[bool] = None


class CreateReturnRequest(BaseModel):
    order_id: str
    seller_id: str
    items: List[Dict[str, Any]]
    reason: ReturnReason
    reason_details: str = Field(..., min_length=10, max_length=1000)
    photos: Optional[List[str]] = None
    video_url: Optional[str] = None
    pickup_address: Optional[str] = None
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    escrow_id: Optional[str] = None


class ApproveReturnRequest(BaseModel):
    seller_notes: str = ""
    logistics_provider: Optional[str] = None


class RejectReturnRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=10, max_length=500)


class SchedulePickupRequest(BaseModel):
    pickup_date: datetime
    logistics_provider: str = "GIG Logistics"


class RecordInspectionRequest(BaseModel):
    result: InspectionResult
    notes: str = Field(..., min_length=5, max_length=1000)
    inspected_by: str
    item_results: Optional[List[Dict[str, Any]]] = None


class ProcessRefundRequest(BaseModel):
    refund_method: RefundMethod
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None


class CheckEligibilityRequest(BaseModel):
    seller_id: str
    order_date: datetime
    reason: ReturnReason


# ============================================
# API ENDPOINTS
# ============================================

# Policy endpoints
@router.get("/policy/{seller_id}")
async def get_return_policy(seller_id: str):
    """Get seller's return policy"""
    policy = ReturnsEngine.get_or_create_policy(seller_id)
    return {"policy": policy.__dict__}


@router.put("/policy/{seller_id}")
async def update_return_policy(seller_id: str, request: UpdatePolicyRequest):
    """Update seller's return policy"""
    updates = {k: v for k, v in request.dict().items() if v is not None}
    policy = ReturnsEngine.update_policy(seller_id, updates)
    return {"policy": policy.__dict__}


@router.post("/check-eligibility")
async def check_return_eligibility(request: CheckEligibilityRequest):
    """Check if a return is eligible"""
    result = ReturnsEngine.check_return_eligibility(
        seller_id=request.seller_id,
        order_date=request.order_date,
        reason=request.reason
    )
    return result


# Return request endpoints
@router.post("/request/{buyer_id}")
async def create_return_request(buyer_id: str, request: CreateReturnRequest):
    """Create a new return request"""
    return_request = ReturnsEngine.create_return_request(
        order_id=request.order_id,
        seller_id=request.seller_id,
        buyer_id=buyer_id,
        items=request.items,
        reason=request.reason,
        reason_details=request.reason_details,
        photos=request.photos,
        video_url=request.video_url,
        pickup_address=request.pickup_address,
        pickup_city=request.pickup_city,
        pickup_state=request.pickup_state,
        escrow_id=request.escrow_id
    )
    return {"return_request": return_request.__dict__}


@router.get("/request/{return_id}")
async def get_return_request(return_id: str):
    """Get a return request"""
    if return_id not in return_requests_db:
        raise HTTPException(status_code=404, detail="Return request not found")
    return {"return_request": return_requests_db[return_id].__dict__}


@router.post("/request/{return_id}/approve")
async def approve_return(return_id: str, request: ApproveReturnRequest):
    """Approve a return request"""
    try:
        return_request = ReturnsEngine.approve_return(
            return_id=return_id,
            seller_notes=request.seller_notes,
            logistics_provider=request.logistics_provider
        )
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request/{return_id}/reject")
async def reject_return(return_id: str, request: RejectReturnRequest):
    """Reject a return request"""
    try:
        return_request = ReturnsEngine.reject_return(
            return_id=return_id,
            rejection_reason=request.rejection_reason
        )
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request/{return_id}/schedule-pickup")
async def schedule_pickup(return_id: str, request: SchedulePickupRequest):
    """Schedule pickup for return"""
    try:
        return_request = ReturnsEngine.schedule_pickup(
            return_id=return_id,
            pickup_date=request.pickup_date,
            logistics_provider=request.logistics_provider
        )
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request/{return_id}/in-transit")
async def mark_in_transit(return_id: str):
    """Mark return as in transit"""
    try:
        return_request = ReturnsEngine.mark_in_transit(return_id)
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request/{return_id}/received")
async def mark_received(return_id: str):
    """Mark return as received"""
    try:
        return_request = ReturnsEngine.mark_received(return_id)
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request/{return_id}/inspect")
async def record_inspection(return_id: str, request: RecordInspectionRequest):
    """Record inspection results"""
    try:
        return_request = ReturnsEngine.record_inspection(
            return_id=return_id,
            result=request.result,
            notes=request.notes,
            inspected_by=request.inspected_by,
            item_results=request.item_results
        )
        return {"return_request": return_request.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/request/{return_id}/refund-calculation")
async def get_refund_calculation(return_id: str):
    """Get refund calculation for a return"""
    if return_id not in return_requests_db:
        raise HTTPException(status_code=404, detail="Return request not found")
    
    return_request = return_requests_db[return_id]
    calculation = ReturnsEngine.calculate_refund_amount(return_request)
    return {"calculation": calculation}


@router.post("/request/{return_id}/refund")
async def process_refund(return_id: str, request: ProcessRefundRequest):
    """Process refund for a return"""
    try:
        refund = ReturnsEngine.process_refund(
            return_id=return_id,
            refund_method=request.refund_method,
            bank_code=request.bank_code,
            account_number=request.account_number,
            account_name=request.account_name
        )
        return {"refund": refund.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refund/{refund_id}/complete")
async def complete_refund(refund_id: str):
    """Mark refund as completed"""
    try:
        refund = ReturnsEngine.complete_refund(refund_id)
        return {"refund": refund.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refund/{refund_id}/fail")
async def fail_refund(refund_id: str, reason: str = Query(...)):
    """Mark refund as failed"""
    try:
        refund = ReturnsEngine.fail_refund(refund_id, reason)
        return {"refund": refund.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Query endpoints
@router.get("/seller/{seller_id}")
async def get_seller_returns(
    seller_id: str,
    status: Optional[ReturnStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get returns for a seller"""
    returns = ReturnsEngine.get_seller_returns(seller_id, status, limit, offset)
    return {"returns": [r.__dict__ for r in returns], "count": len(returns)}


@router.get("/buyer/{buyer_id}")
async def get_buyer_returns(
    buyer_id: str,
    status: Optional[ReturnStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get returns for a buyer"""
    returns = ReturnsEngine.get_buyer_returns(buyer_id, status, limit, offset)
    return {"returns": [r.__dict__ for r in returns], "count": len(returns)}


@router.get("/pending")
async def get_pending_returns(seller_id: Optional[str] = None):
    """Get returns pending action"""
    returns = ReturnsEngine.get_pending_returns(seller_id)
    return {"returns": [r.__dict__ for r in returns], "count": len(returns)}


@router.get("/sla-breached")
async def get_sla_breached_returns():
    """Get returns that have breached SLA"""
    returns = ReturnsEngine.get_sla_breached_returns()
    return {"returns": [r.__dict__ for r in returns], "count": len(returns)}


@router.get("/analytics/{seller_id}")
async def get_return_analytics(seller_id: str, days: int = Query(30, ge=1, le=365)):
    """Get return analytics for seller"""
    analytics = ReturnsEngine.get_return_analytics(seller_id, days)
    return {"analytics": analytics}
