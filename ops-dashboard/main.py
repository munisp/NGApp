"""
Operations Dashboard Service
Internal dashboard for support agents, compliance analysts, and operations team.
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
from decimal import Decimal

app = FastAPI(
    title="Operations Dashboard",
    description="Internal dashboard for support, compliance, and operations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING_USER = "pending_user"
    PENDING_INTERNAL = "pending_internal"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketCategory(str, Enum):
    TRANSACTION_ISSUE = "transaction_issue"
    ACCOUNT_ACCESS = "account_access"
    KYC_VERIFICATION = "kyc_verification"
    PAYMENT_FAILED = "payment_failed"
    REFUND_REQUEST = "refund_request"
    FRAUD_REPORT = "fraud_report"
    GENERAL_INQUIRY = "general_inquiry"
    TECHNICAL_ISSUE = "technical_issue"
    COMPLIANCE = "compliance"
    DISPUTE = "dispute"


class AgentRole(str, Enum):
    SUPPORT_AGENT = "support_agent"
    SENIOR_SUPPORT = "senior_support"
    COMPLIANCE_ANALYST = "compliance_analyst"
    FRAUD_ANALYST = "fraud_analyst"
    OPERATIONS_MANAGER = "operations_manager"
    ADMIN = "admin"


class DisputeStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    PENDING_EVIDENCE = "pending_evidence"
    RESOLVED_CUSTOMER = "resolved_customer"
    RESOLVED_MERCHANT = "resolved_merchant"
    ESCALATED = "escalated"
    CLOSED = "closed"


# Models
class Agent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    role: AgentRole
    is_active: bool = True
    is_online: bool = False
    current_tickets: int = 0
    max_tickets: int = 20
    skills: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None


class SupportTicket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_number: str
    user_id: str
    user_name: str
    user_email: str
    category: TicketCategory
    subject: str
    description: str
    priority: TicketPriority = TicketPriority.MEDIUM
    status: TicketStatus = TicketStatus.OPEN
    assigned_to: Optional[str] = None
    related_transaction_id: Optional[str] = None
    tags: List[str] = []
    messages: List[Dict[str, Any]] = []
    internal_notes: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    sla_due_at: Optional[datetime] = None


class Dispute(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dispute_number: str
    transaction_id: str
    user_id: str
    merchant_id: Optional[str] = None
    amount: Decimal
    currency: str = "NGN"
    reason: str
    description: str
    status: DisputeStatus = DisputeStatus.OPEN
    assigned_to: Optional[str] = None
    evidence: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    resolution: Optional[str] = None
    resolution_amount: Optional[Decimal] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=45))


class ManualReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    review_type: str
    entity_id: str
    entity_type: str
    reason: str
    priority: TicketPriority = TicketPriority.MEDIUM
    status: str = "pending"
    assigned_to: Optional[str] = None
    decision: Optional[str] = None
    decision_notes: Optional[str] = None
    decided_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None


class UserLookup(BaseModel):
    user_id: str
    email: str
    phone: str
    name: str
    kyc_tier: str
    account_status: str
    created_at: datetime
    total_transactions: int
    total_volume: Decimal
    open_tickets: int
    risk_score: int


# In-memory storage
agents_db: Dict[str, Agent] = {}
tickets_db: Dict[str, SupportTicket] = {}
disputes_db: Dict[str, Dispute] = {}
reviews_db: Dict[str, ManualReview] = {}

# SLA Configuration (in hours)
SLA_CONFIG = {
    TicketPriority.URGENT: {"first_response": 1, "resolution": 4},
    TicketPriority.HIGH: {"first_response": 4, "resolution": 24},
    TicketPriority.MEDIUM: {"first_response": 8, "resolution": 48},
    TicketPriority.LOW: {"first_response": 24, "resolution": 72},
}


def generate_ticket_number() -> str:
    """Generate unique ticket number."""
    timestamp = datetime.utcnow().strftime("%y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"TKT-{timestamp}-{random_part}"


def generate_dispute_number() -> str:
    """Generate unique dispute number."""
    timestamp = datetime.utcnow().strftime("%y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"DSP-{timestamp}-{random_part}"


# Agent Endpoints
@app.post("/agents", response_model=Agent)
async def create_agent(
    name: str,
    email: str,
    role: AgentRole,
    skills: List[str] = []
):
    """Create a new support agent."""
    agent = Agent(
        name=name,
        email=email,
        role=role,
        skills=skills
    )
    agents_db[agent.id] = agent
    return agent


@app.get("/agents", response_model=List[Agent])
async def list_agents(
    role: Optional[AgentRole] = None,
    online_only: bool = False
):
    """List all agents."""
    agents = list(agents_db.values())
    
    if role:
        agents = [a for a in agents if a.role == role]
    if online_only:
        agents = [a for a in agents if a.is_online]
    
    return agents


@app.put("/agents/{agent_id}/status")
async def update_agent_status(agent_id: str, is_online: bool):
    """Update agent online status."""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = agents_db[agent_id]
    agent.is_online = is_online
    agent.last_active = datetime.utcnow()
    return agent


# Ticket Endpoints
@app.post("/tickets", response_model=SupportTicket)
async def create_ticket(
    user_id: str,
    user_name: str,
    user_email: str,
    category: TicketCategory,
    subject: str,
    description: str,
    priority: TicketPriority = TicketPriority.MEDIUM,
    related_transaction_id: Optional[str] = None,
    tags: List[str] = []
):
    """Create a new support ticket."""
    sla = SLA_CONFIG[priority]
    sla_due_at = datetime.utcnow() + timedelta(hours=sla["resolution"])
    
    ticket = SupportTicket(
        ticket_number=generate_ticket_number(),
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        category=category,
        subject=subject,
        description=description,
        priority=priority,
        related_transaction_id=related_transaction_id,
        tags=tags,
        sla_due_at=sla_due_at
    )
    
    ticket.messages.append({
        "timestamp": datetime.utcnow().isoformat(),
        "sender": "user",
        "sender_name": user_name,
        "content": description
    })
    
    tickets_db[ticket.id] = ticket
    
    # Auto-assign if possible
    await auto_assign_ticket(ticket.id)
    
    return ticket


async def auto_assign_ticket(ticket_id: str):
    """Auto-assign ticket to available agent."""
    ticket = tickets_db.get(ticket_id)
    if not ticket or ticket.assigned_to:
        return
    
    # Find available agent with matching skills
    available_agents = [
        a for a in agents_db.values()
        if a.is_online and a.is_active and a.current_tickets < a.max_tickets
    ]
    
    if available_agents:
        # Sort by current workload
        available_agents.sort(key=lambda x: x.current_tickets)
        agent = available_agents[0]
        
        ticket.assigned_to = agent.id
        ticket.status = TicketStatus.IN_PROGRESS
        agent.current_tickets += 1
        
        ticket.internal_notes.append({
            "timestamp": datetime.utcnow().isoformat(),
            "author": "system",
            "content": f"Auto-assigned to {agent.name}"
        })


@app.get("/tickets", response_model=List[SupportTicket])
async def list_tickets(
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    category: Optional[TicketCategory] = None,
    assigned_to: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(default=50, le=200)
):
    """List support tickets with filters."""
    tickets = list(tickets_db.values())
    
    if status:
        tickets = [t for t in tickets if t.status == status]
    if priority:
        tickets = [t for t in tickets if t.priority == priority]
    if category:
        tickets = [t for t in tickets if t.category == category]
    if assigned_to:
        tickets = [t for t in tickets if t.assigned_to == assigned_to]
    if user_id:
        tickets = [t for t in tickets if t.user_id == user_id]
    
    tickets.sort(key=lambda x: (
        x.priority == TicketPriority.URGENT,
        x.priority == TicketPriority.HIGH,
        x.created_at
    ), reverse=True)
    
    return tickets[:limit]


@app.get("/tickets/{ticket_id}", response_model=SupportTicket)
async def get_ticket(ticket_id: str):
    """Get ticket details."""
    if ticket_id not in tickets_db:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return tickets_db[ticket_id]


@app.put("/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, agent_id: str):
    """Assign ticket to an agent."""
    if ticket_id not in tickets_db:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    ticket = tickets_db[ticket_id]
    agent = agents_db[agent_id]
    
    # Release from previous agent
    if ticket.assigned_to and ticket.assigned_to in agents_db:
        prev_agent = agents_db[ticket.assigned_to]
        prev_agent.current_tickets = max(0, prev_agent.current_tickets - 1)
    
    ticket.assigned_to = agent_id
    ticket.status = TicketStatus.IN_PROGRESS
    ticket.updated_at = datetime.utcnow()
    agent.current_tickets += 1
    
    ticket.internal_notes.append({
        "timestamp": datetime.utcnow().isoformat(),
        "author": "system",
        "content": f"Assigned to {agent.name}"
    })
    
    return ticket


@app.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    agent_id: str,
    message: str,
    is_internal: bool = False
):
    """Reply to a ticket."""
    if ticket_id not in tickets_db:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    ticket = tickets_db[ticket_id]
    agent = agents_db[agent_id]
    
    if is_internal:
        ticket.internal_notes.append({
            "timestamp": datetime.utcnow().isoformat(),
            "author": agent.name,
            "author_id": agent_id,
            "content": message
        })
    else:
        ticket.messages.append({
            "timestamp": datetime.utcnow().isoformat(),
            "sender": "agent",
            "sender_name": agent.name,
            "sender_id": agent_id,
            "content": message
        })
        
        if not ticket.first_response_at:
            ticket.first_response_at = datetime.utcnow()
        
        ticket.status = TicketStatus.PENDING_USER
    
    ticket.updated_at = datetime.utcnow()
    return ticket


@app.put("/tickets/{ticket_id}/resolve")
async def resolve_ticket(
    ticket_id: str,
    agent_id: str,
    resolution_notes: str
):
    """Resolve a ticket."""
    if ticket_id not in tickets_db:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = tickets_db[ticket_id]
    ticket.status = TicketStatus.RESOLVED
    ticket.resolved_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    
    ticket.internal_notes.append({
        "timestamp": datetime.utcnow().isoformat(),
        "author": agents_db.get(agent_id, Agent(name="Unknown", email="", role=AgentRole.SUPPORT_AGENT)).name,
        "content": f"Resolved: {resolution_notes}"
    })
    
    # Release agent capacity
    if ticket.assigned_to and ticket.assigned_to in agents_db:
        agent = agents_db[ticket.assigned_to]
        agent.current_tickets = max(0, agent.current_tickets - 1)
    
    return ticket


@app.put("/tickets/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: str,
    agent_id: str,
    reason: str,
    escalate_to: Optional[str] = None
):
    """Escalate a ticket."""
    if ticket_id not in tickets_db:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = tickets_db[ticket_id]
    ticket.status = TicketStatus.ESCALATED
    ticket.priority = TicketPriority.HIGH
    ticket.updated_at = datetime.utcnow()
    
    ticket.internal_notes.append({
        "timestamp": datetime.utcnow().isoformat(),
        "author": agents_db.get(agent_id, Agent(name="Unknown", email="", role=AgentRole.SUPPORT_AGENT)).name,
        "content": f"Escalated: {reason}"
    })
    
    if escalate_to and escalate_to in agents_db:
        await assign_ticket(ticket_id, escalate_to)
    
    return ticket


# Dispute Endpoints
@app.post("/disputes", response_model=Dispute)
async def create_dispute(
    transaction_id: str,
    user_id: str,
    amount: Decimal,
    reason: str,
    description: str,
    currency: str = "NGN",
    merchant_id: Optional[str] = None
):
    """Create a new dispute."""
    dispute = Dispute(
        dispute_number=generate_dispute_number(),
        transaction_id=transaction_id,
        user_id=user_id,
        merchant_id=merchant_id,
        amount=amount,
        currency=currency,
        reason=reason,
        description=description
    )
    
    dispute.timeline.append({
        "timestamp": datetime.utcnow().isoformat(),
        "event": "dispute_created",
        "description": f"Dispute created for {currency} {amount}"
    })
    
    disputes_db[dispute.id] = dispute
    return dispute


@app.get("/disputes", response_model=List[Dispute])
async def list_disputes(
    status: Optional[DisputeStatus] = None,
    assigned_to: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(default=50, le=200)
):
    """List disputes."""
    disputes = list(disputes_db.values())
    
    if status:
        disputes = [d for d in disputes if d.status == status]
    if assigned_to:
        disputes = [d for d in disputes if d.assigned_to == assigned_to]
    if user_id:
        disputes = [d for d in disputes if d.user_id == user_id]
    
    disputes.sort(key=lambda x: x.created_at, reverse=True)
    return disputes[:limit]


@app.get("/disputes/{dispute_id}", response_model=Dispute)
async def get_dispute(dispute_id: str):
    """Get dispute details."""
    if dispute_id not in disputes_db:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return disputes_db[dispute_id]


@app.put("/disputes/{dispute_id}/assign")
async def assign_dispute(dispute_id: str, agent_id: str):
    """Assign dispute to an agent."""
    if dispute_id not in disputes_db:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    dispute = disputes_db[dispute_id]
    dispute.assigned_to = agent_id
    dispute.status = DisputeStatus.INVESTIGATING
    dispute.updated_at = datetime.utcnow()
    
    dispute.timeline.append({
        "timestamp": datetime.utcnow().isoformat(),
        "event": "assigned",
        "description": f"Assigned to agent {agent_id}"
    })
    
    return dispute


@app.post("/disputes/{dispute_id}/evidence")
async def add_dispute_evidence(
    dispute_id: str,
    evidence_type: str,
    description: str,
    file_url: Optional[str] = None,
    submitted_by: str = "user"
):
    """Add evidence to a dispute."""
    if dispute_id not in disputes_db:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    dispute = disputes_db[dispute_id]
    
    evidence = {
        "id": str(uuid.uuid4()),
        "type": evidence_type,
        "description": description,
        "file_url": file_url,
        "submitted_by": submitted_by,
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    dispute.evidence.append(evidence)
    dispute.updated_at = datetime.utcnow()
    
    dispute.timeline.append({
        "timestamp": datetime.utcnow().isoformat(),
        "event": "evidence_added",
        "description": f"Evidence added: {evidence_type}"
    })
    
    return dispute


@app.put("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    agent_id: str,
    resolution: str,
    resolution_in_favor: str,
    resolution_amount: Optional[Decimal] = None
):
    """Resolve a dispute."""
    if dispute_id not in disputes_db:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    dispute = disputes_db[dispute_id]
    
    if resolution_in_favor == "customer":
        dispute.status = DisputeStatus.RESOLVED_CUSTOMER
    else:
        dispute.status = DisputeStatus.RESOLVED_MERCHANT
    
    dispute.resolution = resolution
    dispute.resolution_amount = resolution_amount
    dispute.updated_at = datetime.utcnow()
    
    dispute.timeline.append({
        "timestamp": datetime.utcnow().isoformat(),
        "event": "resolved",
        "description": f"Resolved in favor of {resolution_in_favor}: {resolution}"
    })
    
    return dispute


# Manual Review Endpoints
@app.post("/reviews", response_model=ManualReview)
async def create_manual_review(
    review_type: str,
    entity_id: str,
    entity_type: str,
    reason: str,
    priority: TicketPriority = TicketPriority.MEDIUM
):
    """Create a manual review request."""
    review = ManualReview(
        review_type=review_type,
        entity_id=entity_id,
        entity_type=entity_type,
        reason=reason,
        priority=priority
    )
    reviews_db[review.id] = review
    return review


@app.get("/reviews", response_model=List[ManualReview])
async def list_reviews(
    status: Optional[str] = None,
    review_type: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(default=50, le=200)
):
    """List manual reviews."""
    reviews = list(reviews_db.values())
    
    if status:
        reviews = [r for r in reviews if r.status == status]
    if review_type:
        reviews = [r for r in reviews if r.review_type == review_type]
    if assigned_to:
        reviews = [r for r in reviews if r.assigned_to == assigned_to]
    
    reviews.sort(key=lambda x: x.created_at, reverse=True)
    return reviews[:limit]


@app.put("/reviews/{review_id}/decide")
async def decide_review(
    review_id: str,
    agent_id: str,
    decision: str,
    decision_notes: str
):
    """Make a decision on a manual review."""
    if review_id not in reviews_db:
        raise HTTPException(status_code=404, detail="Review not found")
    
    review = reviews_db[review_id]
    review.status = "completed"
    review.decision = decision
    review.decision_notes = decision_notes
    review.decided_by = agent_id
    review.decided_at = datetime.utcnow()
    
    return review


# User Lookup Endpoints
@app.get("/users/{user_id}/lookup")
async def lookup_user(user_id: str):
    """Lookup user details for support purposes."""
    # In production, aggregate from multiple services
    user_tickets = [t for t in tickets_db.values() if t.user_id == user_id]
    
    return {
        "user_id": user_id,
        "email": f"user_{user_id}@example.com",
        "phone": "+234800000000",
        "name": f"User {user_id}",
        "kyc_tier": "tier_2",
        "account_status": "active",
        "created_at": datetime.utcnow() - timedelta(days=90),
        "total_transactions": 45,
        "total_volume": Decimal("250000.00"),
        "open_tickets": len([t for t in user_tickets if t.status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]]),
        "risk_score": 15,
        "recent_tickets": user_tickets[:5],
        "flags": []
    }


@app.get("/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: str,
    limit: int = Query(default=20, le=100)
):
    """Get user's recent transactions for support."""
    # In production, fetch from transaction service
    return {
        "user_id": user_id,
        "transactions": [
            {
                "id": f"txn_{i}",
                "type": "transfer",
                "amount": Decimal("5000.00") * i,
                "currency": "NGN",
                "status": "completed",
                "created_at": (datetime.utcnow() - timedelta(days=i)).isoformat()
            }
            for i in range(1, min(limit + 1, 11))
        ]
    }


# Dashboard Statistics
@app.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics."""
    tickets = list(tickets_db.values())
    disputes = list(disputes_db.values())
    reviews = list(reviews_db.values())
    agents = list(agents_db.values())
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    return {
        "tickets": {
            "total": len(tickets),
            "open": len([t for t in tickets if t.status == TicketStatus.OPEN]),
            "in_progress": len([t for t in tickets if t.status == TicketStatus.IN_PROGRESS]),
            "escalated": len([t for t in tickets if t.status == TicketStatus.ESCALATED]),
            "resolved_today": len([t for t in tickets if t.resolved_at and t.resolved_at >= today_start]),
            "breaching_sla": len([t for t in tickets if t.sla_due_at and t.sla_due_at < now and t.status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]]),
            "by_priority": {
                p.value: len([t for t in tickets if t.priority == p])
                for p in TicketPriority
            },
            "by_category": {
                c.value: len([t for t in tickets if t.category == c])
                for c in TicketCategory
            }
        },
        "disputes": {
            "total": len(disputes),
            "open": len([d for d in disputes if d.status == DisputeStatus.OPEN]),
            "investigating": len([d for d in disputes if d.status == DisputeStatus.INVESTIGATING]),
            "total_amount": sum(d.amount for d in disputes if d.status not in [DisputeStatus.CLOSED])
        },
        "reviews": {
            "pending": len([r for r in reviews if r.status == "pending"]),
            "completed_today": len([r for r in reviews if r.decided_at and r.decided_at >= today_start])
        },
        "agents": {
            "total": len(agents),
            "online": len([a for a in agents if a.is_online]),
            "total_capacity": sum(a.max_tickets for a in agents if a.is_online),
            "current_load": sum(a.current_tickets for a in agents if a.is_online)
        }
    }


@app.get("/dashboard/sla-metrics")
async def get_sla_metrics():
    """Get SLA performance metrics."""
    tickets = list(tickets_db.values())
    resolved = [t for t in tickets if t.resolved_at]
    
    if not resolved:
        return {
            "first_response": {"avg_hours": 0, "within_sla_pct": 100},
            "resolution": {"avg_hours": 0, "within_sla_pct": 100}
        }
    
    # Calculate first response times
    first_response_times = []
    for t in resolved:
        if t.first_response_at:
            delta = (t.first_response_at - t.created_at).total_seconds() / 3600
            first_response_times.append(delta)
    
    # Calculate resolution times
    resolution_times = []
    for t in resolved:
        delta = (t.resolved_at - t.created_at).total_seconds() / 3600
        resolution_times.append(delta)
    
    return {
        "first_response": {
            "avg_hours": sum(first_response_times) / len(first_response_times) if first_response_times else 0,
            "within_sla_pct": 85  # Placeholder
        },
        "resolution": {
            "avg_hours": sum(resolution_times) / len(resolution_times) if resolution_times else 0,
            "within_sla_pct": 90  # Placeholder
        }
    }


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ops-dashboard",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8016)
