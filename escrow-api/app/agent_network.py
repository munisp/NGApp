"""
Agent Network for Cash Transactions - EscrowProtect
TIER 4: Agent Network for Cash Transactions

Enables cash-based escrow through a network of verified agents
(POS operators, mobile money agents, bank agents).

This bridges the gap for users without bank accounts or
who prefer cash transactions.
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging
import math

logger = logging.getLogger(__name__)

class AgentType(str, Enum):
    POS_OPERATOR = "pos_operator"
    MOBILE_MONEY = "mobile_money"
    BANK_AGENT = "bank_agent"
    OPAY_AGENT = "opay_agent"
    PALMPAY_AGENT = "palmpay_agent"
    MONIEPOINT_AGENT = "moniepoint_agent"

class AgentStatus(str, Enum):
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"

class CashTransactionType(str, Enum):
    CASH_IN = "cash_in"      # Buyer deposits cash to fund escrow
    CASH_OUT = "cash_out"    # Seller withdraws cash from escrow
    INSPECTION = "inspection" # Agent inspects item for buyer

class CashTransactionStatus(str, Enum):
    PENDING = "pending"
    AGENT_ASSIGNED = "agent_assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class AgentLocation:
    """Agent's physical location"""
    address: str
    city: str
    state: str
    lga: str  # Local Government Area
    latitude: float
    longitude: float
    landmark: Optional[str] = None

@dataclass
class Agent:
    """Verified agent in the network"""
    id: str
    name: str
    phone: str
    agent_type: AgentType
    status: AgentStatus
    location: AgentLocation
    
    # Verification
    verified: bool = False
    verification_date: Optional[str] = None
    nin_verified: bool = False
    business_registered: bool = False
    
    # Capabilities
    max_transaction_amount: float = 500000  # ₦500,000 default
    can_do_inspection: bool = False
    
    # Performance
    total_transactions: int = 0
    successful_transactions: int = 0
    rating: float = 5.0
    
    # Commission
    commission_rate: float = 0.01  # 1% default
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_active_at: Optional[str] = None

@dataclass
class CashTransaction:
    """Cash transaction through agent network"""
    id: str
    escrow_id: str
    transaction_type: CashTransactionType
    status: CashTransactionStatus
    
    # Parties
    user_id: str
    user_phone: str
    agent_id: Optional[str] = None
    
    # Amount
    amount: float = 0.0
    agent_commission: float = 0.0
    platform_fee: float = 0.0
    
    # Verification
    verification_code: Optional[str] = None
    verification_expires_at: Optional[str] = None
    
    # Location
    user_location: Optional[Dict[str, float]] = None  # lat, lng
    assigned_agent_location: Optional[AgentLocation] = None
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    assigned_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    # Notes
    notes: str = ""

class AgentNetworkService:
    """
    Agent network service for cash-based escrow transactions.
    
    Flow for Cash-In (Buyer funding escrow with cash):
    1. Buyer requests cash deposit
    2. System finds nearest available agent
    3. Buyer receives verification code and agent location
    4. Buyer visits agent with cash
    5. Agent verifies code and accepts cash
    6. Agent confirms transaction in app
    7. Escrow is funded
    
    Flow for Cash-Out (Seller receiving cash):
    1. Seller requests cash withdrawal
    2. System finds nearest available agent
    3. Seller receives verification code and agent location
    4. Seller visits agent
    5. Agent verifies code and dispenses cash
    6. Transaction complete
    
    Flow for Inspection (Agent inspects item):
    1. Buyer requests inspection before release
    2. System finds nearest agent with inspection capability
    3. Seller brings item to agent
    4. Agent inspects and reports condition
    5. Buyer decides to release or dispute
    """
    
    # Nigerian states with major cities
    COVERAGE_AREAS = {
        "Lagos": ["Ikeja", "Victoria Island", "Lekki", "Surulere", "Yaba", "Ikorodu"],
        "Abuja": ["Wuse", "Garki", "Maitama", "Gwarinpa", "Kubwa"],
        "Rivers": ["Port Harcourt", "Obio-Akpor"],
        "Kano": ["Kano Municipal", "Nassarawa", "Tarauni"],
        "Oyo": ["Ibadan North", "Ibadan South", "Ogbomoso"],
        "Kaduna": ["Kaduna North", "Kaduna South", "Zaria"],
        "Anambra": ["Onitsha", "Awka", "Nnewi"],
        "Delta": ["Warri", "Asaba", "Sapele"],
        "Enugu": ["Enugu North", "Enugu South", "Nsukka"],
    }
    
    # Commission rates by transaction type
    COMMISSION_RATES = {
        CashTransactionType.CASH_IN: 0.01,   # 1%
        CashTransactionType.CASH_OUT: 0.015, # 1.5%
        CashTransactionType.INSPECTION: 0.02, # 2% or flat fee
    }
    
    # Minimum flat fee for small transactions
    MIN_COMMISSION_NGN = 100
    
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.transactions: Dict[str, CashTransaction] = {}
        self.escrow_transactions: Dict[str, List[str]] = {}  # escrow_id -> [transaction_ids]
        
        # Initialize with sample agents for POC
        self._initialize_sample_agents()
    
    def _initialize_sample_agents(self):
        """Initialize sample agents for POC"""
        sample_agents = [
            {
                "name": "Chidi's POS Services",
                "phone": "+2348012345678",
                "agent_type": AgentType.POS_OPERATOR,
                "location": AgentLocation(
                    address="15 Allen Avenue",
                    city="Ikeja",
                    state="Lagos",
                    lga="Ikeja",
                    latitude=6.6018,
                    longitude=3.3515,
                    landmark="Near Allen Junction"
                ),
                "max_transaction_amount": 500000,
                "can_do_inspection": True,
            },
            {
                "name": "Amaka Mobile Money",
                "phone": "+2348023456789",
                "agent_type": AgentType.OPAY_AGENT,
                "location": AgentLocation(
                    address="Shop 5, Computer Village",
                    city="Ikeja",
                    state="Lagos",
                    lga="Ikeja",
                    latitude=6.6088,
                    longitude=3.3464,
                    landmark="Computer Village Main Gate"
                ),
                "max_transaction_amount": 300000,
                "can_do_inspection": False,
            },
            {
                "name": "Emeka Bank Agent",
                "phone": "+2348034567890",
                "agent_type": AgentType.BANK_AGENT,
                "location": AgentLocation(
                    address="22 Admiralty Way",
                    city="Lekki",
                    state="Lagos",
                    lga="Eti-Osa",
                    latitude=6.4281,
                    longitude=3.4219,
                    landmark="Near Lekki Phase 1"
                ),
                "max_transaction_amount": 1000000,
                "can_do_inspection": True,
            },
        ]
        
        for agent_data in sample_agents:
            agent_id = f"AGT-{uuid.uuid4().hex[:8].upper()}"
            agent = Agent(
                id=agent_id,
                name=agent_data["name"],
                phone=agent_data["phone"],
                agent_type=agent_data["agent_type"],
                status=AgentStatus.ACTIVE,
                location=agent_data["location"],
                verified=True,
                verification_date=datetime.utcnow().isoformat(),
                max_transaction_amount=agent_data["max_transaction_amount"],
                can_do_inspection=agent_data["can_do_inspection"],
            )
            self.agents[agent_id] = agent
    
    def register_agent(
        self,
        name: str,
        phone: str,
        agent_type: AgentType,
        location: AgentLocation,
        nin: str = None,
        business_registration: str = None
    ) -> Agent:
        """
        Register a new agent in the network.
        
        Agents must be verified before they can process transactions.
        """
        agent_id = f"AGT-{uuid.uuid4().hex[:8].upper()}"
        
        agent = Agent(
            id=agent_id,
            name=name,
            phone=phone,
            agent_type=agent_type,
            status=AgentStatus.PENDING_VERIFICATION,
            location=location,
            nin_verified=nin is not None,
            business_registered=business_registration is not None,
        )
        
        self.agents[agent_id] = agent
        
        logger.info(f"Agent {agent_id} registered, pending verification")
        
        return agent
    
    def verify_agent(self, agent_id: str, verified_by: str) -> Agent:
        """Verify an agent after background check"""
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent.verified = True
        agent.verification_date = datetime.utcnow().isoformat()
        agent.status = AgentStatus.ACTIVE
        
        logger.info(f"Agent {agent_id} verified by {verified_by}")
        
        return agent
    
    def find_nearest_agents(
        self,
        latitude: float,
        longitude: float,
        transaction_type: CashTransactionType,
        amount: float,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find nearest available agents for a transaction.
        
        Filters by:
        - Active status
        - Transaction amount capability
        - Inspection capability (if needed)
        - Distance
        """
        available_agents = []
        
        for agent in self.agents.values():
            # Check status
            if agent.status != AgentStatus.ACTIVE:
                continue
            
            # Check amount capability
            if amount > agent.max_transaction_amount:
                continue
            
            # Check inspection capability
            if transaction_type == CashTransactionType.INSPECTION and not agent.can_do_inspection:
                continue
            
            # Calculate distance
            distance = self._calculate_distance(
                latitude, longitude,
                agent.location.latitude, agent.location.longitude
            )
            
            available_agents.append({
                "agent": agent,
                "distance_km": distance,
                "estimated_time_minutes": self._estimate_travel_time(distance)
            })
        
        # Sort by distance
        available_agents.sort(key=lambda x: x["distance_km"])
        
        return available_agents[:limit]
    
    def create_cash_transaction(
        self,
        escrow_id: str,
        user_id: str,
        user_phone: str,
        transaction_type: CashTransactionType,
        amount: float,
        user_latitude: float = None,
        user_longitude: float = None
    ) -> CashTransaction:
        """
        Create a cash transaction request.
        
        This initiates the process of finding an agent
        and generating verification codes.
        """
        transaction_id = f"CTX-{uuid.uuid4().hex[:12].upper()}"
        
        # Calculate commission
        commission_rate = self.COMMISSION_RATES.get(transaction_type, 0.01)
        commission = max(amount * commission_rate, self.MIN_COMMISSION_NGN)
        
        # Generate verification code (6 digits)
        import random
        verification_code = ''.join(random.choices('0123456789', k=6))
        verification_expires = (datetime.utcnow() + timedelta(hours=24)).isoformat()
        
        transaction = CashTransaction(
            id=transaction_id,
            escrow_id=escrow_id,
            transaction_type=transaction_type,
            status=CashTransactionStatus.PENDING,
            user_id=user_id,
            user_phone=user_phone,
            amount=amount,
            agent_commission=commission,
            verification_code=verification_code,
            verification_expires_at=verification_expires,
            user_location={"latitude": user_latitude, "longitude": user_longitude} if user_latitude else None
        )
        
        self.transactions[transaction_id] = transaction
        
        # Track by escrow
        if escrow_id not in self.escrow_transactions:
            self.escrow_transactions[escrow_id] = []
        self.escrow_transactions[escrow_id].append(transaction_id)
        
        logger.info(f"Cash transaction {transaction_id} created for escrow {escrow_id}")
        
        return transaction
    
    def assign_agent(
        self,
        transaction_id: str,
        agent_id: str
    ) -> CashTransaction:
        """
        Assign an agent to a cash transaction.
        """
        transaction = self.transactions.get(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction {transaction_id} not found")
        
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        transaction.agent_id = agent_id
        transaction.assigned_agent_location = agent.location
        transaction.status = CashTransactionStatus.AGENT_ASSIGNED
        transaction.assigned_at = datetime.utcnow().isoformat()
        
        logger.info(f"Agent {agent_id} assigned to transaction {transaction_id}")
        
        return transaction
    
    def verify_and_complete(
        self,
        transaction_id: str,
        verification_code: str,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        Verify code and complete cash transaction.
        
        Called by agent after receiving/dispensing cash.
        """
        transaction = self.transactions.get(transaction_id)
        if not transaction:
            return {"success": False, "error": "Transaction not found"}
        
        # Verify agent
        if transaction.agent_id != agent_id:
            return {"success": False, "error": "Agent not assigned to this transaction"}
        
        # Verify code
        if transaction.verification_code != verification_code:
            return {"success": False, "error": "Invalid verification code"}
        
        # Check expiration
        if transaction.verification_expires_at:
            expires = datetime.fromisoformat(transaction.verification_expires_at)
            if datetime.utcnow() > expires:
                return {"success": False, "error": "Verification code expired"}
        
        # Complete transaction
        transaction.status = CashTransactionStatus.COMPLETED
        transaction.completed_at = datetime.utcnow().isoformat()
        
        # Update agent stats
        agent = self.agents.get(agent_id)
        if agent:
            agent.total_transactions += 1
            agent.successful_transactions += 1
            agent.last_active_at = datetime.utcnow().isoformat()
        
        logger.info(f"Cash transaction {transaction_id} completed")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "amount": transaction.amount,
            "commission": transaction.agent_commission,
            "escrow_id": transaction.escrow_id
        }
    
    def get_transaction_instructions(
        self,
        transaction: CashTransaction,
        agent: Agent
    ) -> Dict[str, str]:
        """
        Generate instructions for user to complete cash transaction.
        """
        if transaction.transaction_type == CashTransactionType.CASH_IN:
            return {
                "title": "Cash Deposit Instructions",
                "step_1": f"Visit {agent.name} at {agent.location.address}, {agent.location.city}",
                "step_2": f"Landmark: {agent.location.landmark or 'N/A'}",
                "step_3": f"Tell the agent you want to fund EscrowProtect",
                "step_4": f"Give them your verification code: {transaction.verification_code}",
                "step_5": f"Pay ₦{transaction.amount + transaction.agent_commission:,.0f} in cash",
                "step_6": "Wait for confirmation SMS",
                "note": f"Code expires in 24 hours. Agent commission: ₦{transaction.agent_commission:,.0f}",
                "agent_phone": agent.phone
            }
        
        elif transaction.transaction_type == CashTransactionType.CASH_OUT:
            return {
                "title": "Cash Withdrawal Instructions",
                "step_1": f"Visit {agent.name} at {agent.location.address}, {agent.location.city}",
                "step_2": f"Landmark: {agent.location.landmark or 'N/A'}",
                "step_3": f"Tell the agent you want to withdraw from EscrowProtect",
                "step_4": f"Give them your verification code: {transaction.verification_code}",
                "step_5": f"Receive ₦{transaction.amount - transaction.agent_commission:,.0f} in cash",
                "step_6": "Confirm receipt in the app",
                "note": f"Code expires in 24 hours. Agent commission: ₦{transaction.agent_commission:,.0f}",
                "agent_phone": agent.phone
            }
        
        elif transaction.transaction_type == CashTransactionType.INSPECTION:
            return {
                "title": "Item Inspection Instructions",
                "step_1": f"Seller brings item to {agent.name}",
                "step_2": f"Location: {agent.location.address}, {agent.location.city}",
                "step_3": f"Agent inspects item condition",
                "step_4": f"Agent reports findings to buyer",
                "step_5": "Buyer decides to release or dispute",
                "note": f"Inspection fee: ₦{transaction.agent_commission:,.0f}",
                "agent_phone": agent.phone
            }
        
        return {}
    
    def get_agent_dashboard(self, agent_id: str) -> Dict[str, Any]:
        """
        Get dashboard data for an agent.
        """
        agent = self.agents.get(agent_id)
        if not agent:
            return {"error": "Agent not found"}
        
        # Get pending transactions
        pending = [
            t for t in self.transactions.values()
            if t.agent_id == agent_id and t.status in [
                CashTransactionStatus.AGENT_ASSIGNED,
                CashTransactionStatus.IN_PROGRESS
            ]
        ]
        
        # Get recent completed
        completed = [
            t for t in self.transactions.values()
            if t.agent_id == agent_id and t.status == CashTransactionStatus.COMPLETED
        ][-10:]  # Last 10
        
        # Calculate earnings
        total_commission = sum(t.agent_commission for t in completed)
        
        return {
            "agent": {
                "id": agent.id,
                "name": agent.name,
                "status": agent.status.value,
                "rating": agent.rating,
                "total_transactions": agent.total_transactions,
                "success_rate": agent.successful_transactions / max(agent.total_transactions, 1)
            },
            "pending_transactions": len(pending),
            "pending_amount": sum(t.amount for t in pending),
            "total_earnings": total_commission,
            "recent_transactions": [
                {
                    "id": t.id,
                    "type": t.transaction_type.value,
                    "amount": t.amount,
                    "commission": t.agent_commission,
                    "completed_at": t.completed_at
                }
                for t in completed
            ]
        }
    
    def _calculate_distance(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """
        Calculate distance between two points using Haversine formula.
        Returns distance in kilometers.
        """
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _estimate_travel_time(self, distance_km: float) -> int:
        """
        Estimate travel time in minutes.
        Assumes average speed of 20 km/h in Nigerian urban traffic.
        """
        return int(distance_km / 20 * 60) + 5  # Add 5 minutes buffer


# Global agent network service instance
agent_network = AgentNetworkService()
