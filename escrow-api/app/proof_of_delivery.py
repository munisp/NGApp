"""
Proof of Delivery Integration

Provides logistics-grade evidence capture for dispute resolution:
- Integration with logistics providers (GIG, Kwik, etc.)
- Proof of delivery capture (photos, signatures, GPS)
- Delivery confirmation workflow
- Evidence trails for disputes
- Automated delivery notifications

This closes the gap with logistics integrators that have mature POD systems.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query
import uuid
import logging
import hashlib

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/delivery", tags=["Proof of Delivery"])


# ============================================
# ENUMS
# ============================================

class DeliveryStatus(str, Enum):
    """Delivery status"""
    PENDING = "pending"
    LABEL_CREATED = "label_created"
    PICKUP_SCHEDULED = "pickup_scheduled"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERY_ATTEMPTED = "delivery_attempted"
    DELIVERED = "delivered"
    RETURNED_TO_SENDER = "returned_to_sender"
    CANCELLED = "cancelled"
    EXCEPTION = "exception"


class DeliveryMethod(str, Enum):
    """Delivery method"""
    STANDARD = "standard"
    EXPRESS = "express"
    SAME_DAY = "same_day"
    NEXT_DAY = "next_day"
    PICKUP = "pickup"


class LogisticsProvider(str, Enum):
    """Supported logistics providers"""
    GIG_LOGISTICS = "gig_logistics"
    KWIK = "kwik"
    SENDBOX = "sendbox"
    DHL = "dhl"
    FEDEX = "fedex"
    SELF_DELIVERY = "self_delivery"


class PODType(str, Enum):
    """Type of proof of delivery"""
    SIGNATURE = "signature"
    PHOTO = "photo"
    OTP = "otp"
    GPS = "gps"
    RECIPIENT_ID = "recipient_id"
    DOORSTEP_PHOTO = "doorstep_photo"


class DeliveryExceptionType(str, Enum):
    """Types of delivery exceptions"""
    ADDRESS_NOT_FOUND = "address_not_found"
    RECIPIENT_UNAVAILABLE = "recipient_unavailable"
    REFUSED_DELIVERY = "refused_delivery"
    DAMAGED_IN_TRANSIT = "damaged_in_transit"
    WEATHER_DELAY = "weather_delay"
    VEHICLE_BREAKDOWN = "vehicle_breakdown"
    SECURITY_ISSUE = "security_issue"
    WRONG_ADDRESS = "wrong_address"
    INCOMPLETE_ADDRESS = "incomplete_address"
    OTHER = "other"


# ============================================
# DATA MODELS
# ============================================

@dataclass
class Address:
    """Delivery address"""
    name: str
    phone: str
    address_line1: str
    address_line2: Optional[str]
    city: str
    state: str
    postal_code: Optional[str]
    country: str = "Nigeria"
    landmark: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class Package:
    """Package details"""
    weight_kg: float
    length_cm: float
    width_cm: float
    height_cm: float
    description: str
    declared_value_ngn: int
    is_fragile: bool = False
    requires_signature: bool = True


@dataclass
class ProofOfDelivery:
    """Proof of delivery evidence"""
    pod_id: str
    delivery_id: str
    pod_type: PODType
    captured_at: datetime
    captured_by: str  # Driver/agent ID
    
    # Evidence data
    signature_url: Optional[str] = None
    photo_urls: List[str] = field(default_factory=list)
    otp_code: Optional[str] = None
    otp_verified: bool = False
    
    # GPS data
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    
    # Recipient info
    recipient_name: Optional[str] = None
    recipient_id_type: Optional[str] = None
    recipient_id_number: Optional[str] = None
    relationship_to_buyer: Optional[str] = None
    
    # Verification
    verification_hash: Optional[str] = None
    is_verified: bool = False
    
    notes: str = ""


@dataclass
class DeliveryEvent:
    """Delivery tracking event"""
    event_id: str
    delivery_id: str
    status: DeliveryStatus
    timestamp: datetime
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str = ""
    driver_id: Optional[str] = None
    photo_url: Optional[str] = None


@dataclass
class DeliveryException:
    """Delivery exception record"""
    exception_id: str
    delivery_id: str
    exception_type: DeliveryExceptionType
    timestamp: datetime
    description: str
    photo_urls: List[str] = field(default_factory=list)
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None


@dataclass
class Delivery:
    """Delivery record"""
    delivery_id: str
    order_id: str
    escrow_id: Optional[str]
    seller_id: str
    buyer_id: str
    
    # Status
    status: DeliveryStatus
    
    # Provider
    provider: LogisticsProvider
    
    # Method
    method: DeliveryMethod
    
    # Optional provider fields
    provider_tracking_number: Optional[str] = None
    provider_label_url: Optional[str] = None
    
    # Addresses
    pickup_address: Address = None
    delivery_address: Address = None
    
    # Package
    package: Package = None
    
    # Costs
    shipping_cost_ngn: int = 0
    insurance_cost_ngn: int = 0
    total_cost_ngn: int = 0
    
    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    pickup_scheduled_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    estimated_delivery_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    # POD
    proof_of_delivery: Optional[ProofOfDelivery] = None
    requires_pod: bool = True
    pod_types_required: List[PODType] = field(default_factory=lambda: [PODType.PHOTO, PODType.GPS])
    
    # Events
    events: List[DeliveryEvent] = field(default_factory=list)
    
    # Exceptions
    exceptions: List[DeliveryException] = field(default_factory=list)
    
    # OTP for delivery
    delivery_otp: Optional[str] = None
    delivery_otp_expires_at: Optional[datetime] = None
    
    # Driver
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    
    # Notes
    seller_notes: str = ""
    buyer_notes: str = ""
    driver_notes: str = ""


@dataclass
class ShippingRate:
    """Shipping rate quote"""
    provider: LogisticsProvider
    method: DeliveryMethod
    cost_ngn: int
    insurance_cost_ngn: int
    estimated_days: int
    pickup_available: bool
    tracking_available: bool
    pod_available: bool


# ============================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================

deliveries_db: Dict[str, Delivery] = {}
pod_db: Dict[str, ProofOfDelivery] = {}


# ============================================
# LOGISTICS PROVIDER ADAPTERS
# ============================================

class LogisticsAdapter:
    """Base adapter for logistics providers"""
    
    @staticmethod
    def get_rates(
        pickup_state: str,
        delivery_state: str,
        weight_kg: float,
        declared_value_ngn: int
    ) -> List[ShippingRate]:
        """Get shipping rates from all providers"""
        rates = []
        
        # GIG Logistics rates (simulated)
        is_interstate = pickup_state != delivery_state
        base_rate = 2500 if is_interstate else 1500
        weight_rate = int(weight_kg * 200)
        
        rates.append(ShippingRate(
            provider=LogisticsProvider.GIG_LOGISTICS,
            method=DeliveryMethod.STANDARD,
            cost_ngn=base_rate + weight_rate,
            insurance_cost_ngn=int(declared_value_ngn * 0.01),
            estimated_days=3 if is_interstate else 2,
            pickup_available=True,
            tracking_available=True,
            pod_available=True
        ))
        
        rates.append(ShippingRate(
            provider=LogisticsProvider.GIG_LOGISTICS,
            method=DeliveryMethod.EXPRESS,
            cost_ngn=int((base_rate + weight_rate) * 1.5),
            insurance_cost_ngn=int(declared_value_ngn * 0.01),
            estimated_days=2 if is_interstate else 1,
            pickup_available=True,
            tracking_available=True,
            pod_available=True
        ))
        
        # Kwik rates (simulated)
        rates.append(ShippingRate(
            provider=LogisticsProvider.KWIK,
            method=DeliveryMethod.SAME_DAY,
            cost_ngn=3500 if not is_interstate else 0,  # Same day only within city
            insurance_cost_ngn=int(declared_value_ngn * 0.015),
            estimated_days=0,
            pickup_available=True,
            tracking_available=True,
            pod_available=True
        ))
        
        # Sendbox rates (simulated)
        rates.append(ShippingRate(
            provider=LogisticsProvider.SENDBOX,
            method=DeliveryMethod.STANDARD,
            cost_ngn=base_rate + weight_rate + 500,
            insurance_cost_ngn=int(declared_value_ngn * 0.012),
            estimated_days=4 if is_interstate else 2,
            pickup_available=True,
            tracking_available=True,
            pod_available=True
        ))
        
        # Self delivery option
        rates.append(ShippingRate(
            provider=LogisticsProvider.SELF_DELIVERY,
            method=DeliveryMethod.STANDARD,
            cost_ngn=0,
            insurance_cost_ngn=0,
            estimated_days=0,
            pickup_available=False,
            tracking_available=False,
            pod_available=True
        ))
        
        # Filter out zero-cost options that aren't available
        rates = [r for r in rates if r.cost_ngn > 0 or r.provider == LogisticsProvider.SELF_DELIVERY]
        
        return rates
    
    @staticmethod
    def create_shipment(
        delivery: Delivery,
        provider: LogisticsProvider
    ) -> Dict[str, Any]:
        """Create shipment with provider (simulated)"""
        tracking_number = f"{provider.value.upper()[:3]}-{uuid.uuid4().hex[:10].upper()}"
        label_url = f"https://labels.escrowprotect.ng/{tracking_number}.pdf"
        
        return {
            "tracking_number": tracking_number,
            "label_url": label_url,
            "estimated_pickup": datetime.utcnow() + timedelta(hours=24),
            "estimated_delivery": datetime.utcnow() + timedelta(days=3)
        }
    
    @staticmethod
    def schedule_pickup(
        delivery: Delivery,
        pickup_date: datetime
    ) -> Dict[str, Any]:
        """Schedule pickup with provider (simulated)"""
        return {
            "pickup_id": f"PU-{uuid.uuid4().hex[:8].upper()}",
            "scheduled_date": pickup_date,
            "time_window": "9:00 AM - 6:00 PM"
        }
    
    @staticmethod
    def get_tracking(tracking_number: str) -> List[Dict[str, Any]]:
        """Get tracking events from provider (simulated)"""
        return []


# ============================================
# DELIVERY ENGINE
# ============================================

class DeliveryEngine:
    """Core engine for delivery and POD operations"""
    
    # ============================================
    # SHIPPING RATES
    # ============================================
    
    @staticmethod
    def get_shipping_rates(
        pickup_state: str,
        delivery_state: str,
        weight_kg: float,
        declared_value_ngn: int
    ) -> List[ShippingRate]:
        """Get shipping rates from all providers"""
        return LogisticsAdapter.get_rates(
            pickup_state, delivery_state, weight_kg, declared_value_ngn
        )
    
    # ============================================
    # DELIVERY CREATION
    # ============================================
    
    @staticmethod
    def create_delivery(
        order_id: str,
        seller_id: str,
        buyer_id: str,
        pickup_address: Dict[str, Any],
        delivery_address: Dict[str, Any],
        package: Dict[str, Any],
        provider: LogisticsProvider,
        method: DeliveryMethod,
        escrow_id: str = None,
        requires_pod: bool = True,
        pod_types: List[PODType] = None
    ) -> Delivery:
        """Create a new delivery"""
        delivery_id = f"del_{uuid.uuid4().hex[:12]}"
        
        # Create address objects
        pickup_addr = Address(
            name=pickup_address.get("name"),
            phone=pickup_address.get("phone"),
            address_line1=pickup_address.get("address_line1"),
            address_line2=pickup_address.get("address_line2"),
            city=pickup_address.get("city"),
            state=pickup_address.get("state"),
            postal_code=pickup_address.get("postal_code"),
            landmark=pickup_address.get("landmark"),
            latitude=pickup_address.get("latitude"),
            longitude=pickup_address.get("longitude")
        )
        
        delivery_addr = Address(
            name=delivery_address.get("name"),
            phone=delivery_address.get("phone"),
            address_line1=delivery_address.get("address_line1"),
            address_line2=delivery_address.get("address_line2"),
            city=delivery_address.get("city"),
            state=delivery_address.get("state"),
            postal_code=delivery_address.get("postal_code"),
            landmark=delivery_address.get("landmark"),
            latitude=delivery_address.get("latitude"),
            longitude=delivery_address.get("longitude")
        )
        
        # Create package object
        pkg = Package(
            weight_kg=package.get("weight_kg", 0.5),
            length_cm=package.get("length_cm", 20),
            width_cm=package.get("width_cm", 15),
            height_cm=package.get("height_cm", 10),
            description=package.get("description", ""),
            declared_value_ngn=package.get("declared_value_ngn", 0),
            is_fragile=package.get("is_fragile", False),
            requires_signature=package.get("requires_signature", True)
        )
        
        # Get shipping rate
        rates = DeliveryEngine.get_shipping_rates(
            pickup_addr.state,
            delivery_addr.state,
            pkg.weight_kg,
            pkg.declared_value_ngn
        )
        
        selected_rate = None
        for rate in rates:
            if rate.provider == provider and rate.method == method:
                selected_rate = rate
                break
        
        if not selected_rate:
            selected_rate = rates[0] if rates else ShippingRate(
                provider=provider,
                method=method,
                cost_ngn=2000,
                insurance_cost_ngn=0,
                estimated_days=3,
                pickup_available=True,
                tracking_available=True,
                pod_available=True
            )
        
        # Generate delivery OTP
        delivery_otp = str(uuid.uuid4().int)[:6]
        
        delivery = Delivery(
            delivery_id=delivery_id,
            order_id=order_id,
            escrow_id=escrow_id,
            seller_id=seller_id,
            buyer_id=buyer_id,
            status=DeliveryStatus.PENDING,
            provider=provider,
            method=method,
            pickup_address=pickup_addr,
            delivery_address=delivery_addr,
            package=pkg,
            shipping_cost_ngn=selected_rate.cost_ngn,
            insurance_cost_ngn=selected_rate.insurance_cost_ngn,
            total_cost_ngn=selected_rate.cost_ngn + selected_rate.insurance_cost_ngn,
            estimated_delivery_at=datetime.utcnow() + timedelta(days=selected_rate.estimated_days),
            requires_pod=requires_pod,
            pod_types_required=pod_types or [PODType.PHOTO, PODType.GPS],
            delivery_otp=delivery_otp,
            delivery_otp_expires_at=datetime.utcnow() + timedelta(days=7)
        )
        
        # Add initial event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=DeliveryStatus.PENDING,
            timestamp=datetime.utcnow(),
            description="Delivery created"
        ))
        
        deliveries_db[delivery_id] = delivery
        logger.info(f"Created delivery {delivery_id} for order {order_id}")
        return delivery
    
    @staticmethod
    def create_shipping_label(delivery_id: str) -> Delivery:
        """Create shipping label with provider"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        # Create shipment with provider
        shipment = LogisticsAdapter.create_shipment(delivery, delivery.provider)
        
        delivery.provider_tracking_number = shipment["tracking_number"]
        delivery.provider_label_url = shipment["label_url"]
        delivery.estimated_delivery_at = shipment["estimated_delivery"]
        delivery.status = DeliveryStatus.LABEL_CREATED
        
        # Add event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=DeliveryStatus.LABEL_CREATED,
            timestamp=datetime.utcnow(),
            description=f"Shipping label created. Tracking: {shipment['tracking_number']}"
        ))
        
        logger.info(f"Created shipping label for delivery {delivery_id}")
        return delivery
    
    @staticmethod
    def schedule_pickup(delivery_id: str, pickup_date: datetime) -> Delivery:
        """Schedule pickup"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        # Schedule with provider
        pickup = LogisticsAdapter.schedule_pickup(delivery, pickup_date)
        
        delivery.pickup_scheduled_at = pickup_date
        delivery.status = DeliveryStatus.PICKUP_SCHEDULED
        
        # Add event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=DeliveryStatus.PICKUP_SCHEDULED,
            timestamp=datetime.utcnow(),
            description=f"Pickup scheduled for {pickup_date.strftime('%Y-%m-%d')}"
        ))
        
        return delivery
    
    # ============================================
    # STATUS UPDATES
    # ============================================
    
    @staticmethod
    def update_status(
        delivery_id: str,
        status: DeliveryStatus,
        location: str = None,
        latitude: float = None,
        longitude: float = None,
        description: str = None,
        driver_id: str = None,
        photo_url: str = None
    ) -> Delivery:
        """Update delivery status"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        delivery.status = status
        
        # Update timestamps
        if status == DeliveryStatus.PICKED_UP:
            delivery.picked_up_at = datetime.utcnow()
        elif status == DeliveryStatus.DELIVERED:
            delivery.delivered_at = datetime.utcnow()
        
        # Update driver
        if driver_id:
            delivery.driver_id = driver_id
        
        # Add event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=status,
            timestamp=datetime.utcnow(),
            location=location,
            latitude=latitude,
            longitude=longitude,
            description=description or f"Status updated to {status.value}",
            driver_id=driver_id,
            photo_url=photo_url
        ))
        
        logger.info(f"Updated delivery {delivery_id} status to {status.value}")
        return delivery
    
    @staticmethod
    def record_exception(
        delivery_id: str,
        exception_type: DeliveryExceptionType,
        description: str,
        photo_urls: List[str] = None
    ) -> DeliveryException:
        """Record a delivery exception"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        exception = DeliveryException(
            exception_id=f"exc_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            exception_type=exception_type,
            timestamp=datetime.utcnow(),
            description=description,
            photo_urls=photo_urls or []
        )
        
        delivery.exceptions.append(exception)
        delivery.status = DeliveryStatus.EXCEPTION
        
        # Add event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=DeliveryStatus.EXCEPTION,
            timestamp=datetime.utcnow(),
            description=f"Exception: {exception_type.value} - {description}"
        ))
        
        logger.warning(f"Recorded exception for delivery {delivery_id}: {exception_type.value}")
        return exception
    
    # ============================================
    # PROOF OF DELIVERY
    # ============================================
    
    @staticmethod
    def generate_verification_hash(pod: ProofOfDelivery) -> str:
        """Generate verification hash for POD"""
        data = f"{pod.delivery_id}|{pod.captured_at.isoformat()}|{pod.latitude}|{pod.longitude}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    @staticmethod
    def capture_pod(
        delivery_id: str,
        pod_type: PODType,
        captured_by: str,
        signature_url: str = None,
        photo_urls: List[str] = None,
        latitude: float = None,
        longitude: float = None,
        accuracy_meters: float = None,
        recipient_name: str = None,
        recipient_id_type: str = None,
        recipient_id_number: str = None,
        relationship_to_buyer: str = None,
        notes: str = ""
    ) -> ProofOfDelivery:
        """Capture proof of delivery"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        pod_id = f"pod_{uuid.uuid4().hex[:12]}"
        
        pod = ProofOfDelivery(
            pod_id=pod_id,
            delivery_id=delivery_id,
            pod_type=pod_type,
            captured_at=datetime.utcnow(),
            captured_by=captured_by,
            signature_url=signature_url,
            photo_urls=photo_urls or [],
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=accuracy_meters,
            recipient_name=recipient_name,
            recipient_id_type=recipient_id_type,
            recipient_id_number=recipient_id_number,
            relationship_to_buyer=relationship_to_buyer,
            notes=notes
        )
        
        # Generate verification hash
        pod.verification_hash = DeliveryEngine.generate_verification_hash(pod)
        
        pod_db[pod_id] = pod
        delivery.proof_of_delivery = pod
        
        logger.info(f"Captured POD {pod_id} for delivery {delivery_id}")
        return pod
    
    @staticmethod
    def verify_delivery_otp(delivery_id: str, otp: str) -> bool:
        """Verify delivery OTP"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        if not delivery.delivery_otp:
            return False
        
        if delivery.delivery_otp_expires_at and delivery.delivery_otp_expires_at < datetime.utcnow():
            return False
        
        if delivery.delivery_otp == otp:
            # Update POD if exists
            if delivery.proof_of_delivery:
                delivery.proof_of_delivery.otp_code = otp
                delivery.proof_of_delivery.otp_verified = True
                delivery.proof_of_delivery.is_verified = True
            return True
        
        return False
    
    @staticmethod
    def complete_delivery(
        delivery_id: str,
        pod_type: PODType,
        captured_by: str,
        photo_urls: List[str] = None,
        signature_url: str = None,
        latitude: float = None,
        longitude: float = None,
        recipient_name: str = None,
        otp: str = None
    ) -> Delivery:
        """Complete delivery with POD"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        # Verify OTP if provided
        otp_verified = False
        if otp:
            otp_verified = DeliveryEngine.verify_delivery_otp(delivery_id, otp)
        
        # Capture POD
        pod = DeliveryEngine.capture_pod(
            delivery_id=delivery_id,
            pod_type=pod_type,
            captured_by=captured_by,
            signature_url=signature_url,
            photo_urls=photo_urls,
            latitude=latitude,
            longitude=longitude,
            recipient_name=recipient_name
        )
        
        if otp_verified:
            pod.otp_code = otp
            pod.otp_verified = True
            pod.is_verified = True
        
        # Update delivery status
        delivery.status = DeliveryStatus.DELIVERED
        delivery.delivered_at = datetime.utcnow()
        
        # Add event
        delivery.events.append(DeliveryEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            delivery_id=delivery_id,
            status=DeliveryStatus.DELIVERED,
            timestamp=datetime.utcnow(),
            latitude=latitude,
            longitude=longitude,
            description=f"Delivered. POD captured: {pod_type.value}",
            driver_id=captured_by,
            photo_url=photo_urls[0] if photo_urls else None
        ))
        
        logger.info(f"Completed delivery {delivery_id}")
        return delivery
    
    # ============================================
    # QUERIES
    # ============================================
    
    @staticmethod
    def get_delivery(delivery_id: str) -> Optional[Delivery]:
        """Get delivery by ID"""
        return deliveries_db.get(delivery_id)
    
    @staticmethod
    def get_delivery_by_tracking(tracking_number: str) -> Optional[Delivery]:
        """Get delivery by tracking number"""
        for delivery in deliveries_db.values():
            if delivery.provider_tracking_number == tracking_number:
                return delivery
        return None
    
    @staticmethod
    def get_order_deliveries(order_id: str) -> List[Delivery]:
        """Get deliveries for an order"""
        return [d for d in deliveries_db.values() if d.order_id == order_id]
    
    @staticmethod
    def get_seller_deliveries(
        seller_id: str,
        status: Optional[DeliveryStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Delivery]:
        """Get deliveries for a seller"""
        deliveries = [d for d in deliveries_db.values() if d.seller_id == seller_id]
        
        if status:
            deliveries = [d for d in deliveries if d.status == status]
        
        deliveries.sort(key=lambda d: d.created_at, reverse=True)
        return deliveries[offset:offset + limit]
    
    @staticmethod
    def get_buyer_deliveries(
        buyer_id: str,
        status: Optional[DeliveryStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Delivery]:
        """Get deliveries for a buyer"""
        deliveries = [d for d in deliveries_db.values() if d.buyer_id == buyer_id]
        
        if status:
            deliveries = [d for d in deliveries if d.status == status]
        
        deliveries.sort(key=lambda d: d.created_at, reverse=True)
        return deliveries[offset:offset + limit]
    
    @staticmethod
    def get_pod_evidence(delivery_id: str) -> Dict[str, Any]:
        """Get all POD evidence for a delivery (for disputes)"""
        if delivery_id not in deliveries_db:
            raise ValueError(f"Delivery {delivery_id} not found")
        
        delivery = deliveries_db[delivery_id]
        
        evidence = {
            "delivery_id": delivery_id,
            "order_id": delivery.order_id,
            "escrow_id": delivery.escrow_id,
            "status": delivery.status.value,
            "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None,
            "proof_of_delivery": None,
            "events": [],
            "exceptions": [],
            "verification_status": "unverified"
        }
        
        # Add POD
        if delivery.proof_of_delivery:
            pod = delivery.proof_of_delivery
            evidence["proof_of_delivery"] = {
                "pod_id": pod.pod_id,
                "type": pod.pod_type.value,
                "captured_at": pod.captured_at.isoformat(),
                "captured_by": pod.captured_by,
                "signature_url": pod.signature_url,
                "photo_urls": pod.photo_urls,
                "otp_verified": pod.otp_verified,
                "gps": {
                    "latitude": pod.latitude,
                    "longitude": pod.longitude,
                    "accuracy_meters": pod.accuracy_meters
                } if pod.latitude else None,
                "recipient": {
                    "name": pod.recipient_name,
                    "id_type": pod.recipient_id_type,
                    "relationship": pod.relationship_to_buyer
                } if pod.recipient_name else None,
                "verification_hash": pod.verification_hash,
                "is_verified": pod.is_verified
            }
            
            if pod.is_verified:
                evidence["verification_status"] = "verified"
            elif pod.photo_urls or pod.signature_url:
                evidence["verification_status"] = "partial"
        
        # Add events
        for event in delivery.events:
            evidence["events"].append({
                "event_id": event.event_id,
                "status": event.status.value,
                "timestamp": event.timestamp.isoformat(),
                "location": event.location,
                "gps": {
                    "latitude": event.latitude,
                    "longitude": event.longitude
                } if event.latitude else None,
                "description": event.description,
                "photo_url": event.photo_url
            })
        
        # Add exceptions
        for exc in delivery.exceptions:
            evidence["exceptions"].append({
                "exception_id": exc.exception_id,
                "type": exc.exception_type.value,
                "timestamp": exc.timestamp.isoformat(),
                "description": exc.description,
                "photo_urls": exc.photo_urls,
                "resolved": exc.resolved_at is not None
            })
        
        return evidence


# ============================================
# PYDANTIC MODELS FOR API
# ============================================

class AddressRequest(BaseModel):
    name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: Optional[str] = None
    landmark: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PackageRequest(BaseModel):
    weight_kg: float = Field(..., ge=0.1, le=100)
    length_cm: float = Field(20, ge=1, le=200)
    width_cm: float = Field(15, ge=1, le=200)
    height_cm: float = Field(10, ge=1, le=200)
    description: str
    declared_value_ngn: int = Field(..., ge=0)
    is_fragile: bool = False
    requires_signature: bool = True


class GetRatesRequest(BaseModel):
    pickup_state: str
    delivery_state: str
    weight_kg: float = Field(..., ge=0.1, le=100)
    declared_value_ngn: int = Field(..., ge=0)


class CreateDeliveryRequest(BaseModel):
    order_id: str
    seller_id: str
    buyer_id: str
    pickup_address: AddressRequest
    delivery_address: AddressRequest
    package: PackageRequest
    provider: LogisticsProvider
    method: DeliveryMethod
    escrow_id: Optional[str] = None
    requires_pod: bool = True
    pod_types: Optional[List[PODType]] = None


class UpdateStatusRequest(BaseModel):
    status: DeliveryStatus
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    driver_id: Optional[str] = None
    photo_url: Optional[str] = None


class RecordExceptionRequest(BaseModel):
    exception_type: DeliveryExceptionType
    description: str = Field(..., min_length=10, max_length=500)
    photo_urls: Optional[List[str]] = None


class CapturePODRequest(BaseModel):
    pod_type: PODType
    captured_by: str
    signature_url: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    recipient_name: Optional[str] = None
    recipient_id_type: Optional[str] = None
    recipient_id_number: Optional[str] = None
    relationship_to_buyer: Optional[str] = None
    notes: str = ""


class CompleteDeliveryRequest(BaseModel):
    pod_type: PODType
    captured_by: str
    photo_urls: Optional[List[str]] = None
    signature_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    recipient_name: Optional[str] = None
    otp: Optional[str] = None


class VerifyOTPRequest(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6)


# ============================================
# API ENDPOINTS
# ============================================

@router.post("/rates")
async def get_shipping_rates(request: GetRatesRequest):
    """Get shipping rates from all providers"""
    rates = DeliveryEngine.get_shipping_rates(
        pickup_state=request.pickup_state,
        delivery_state=request.delivery_state,
        weight_kg=request.weight_kg,
        declared_value_ngn=request.declared_value_ngn
    )
    return {"rates": [r.__dict__ for r in rates]}


@router.post("/create")
async def create_delivery(request: CreateDeliveryRequest):
    """Create a new delivery"""
    delivery = DeliveryEngine.create_delivery(
        order_id=request.order_id,
        seller_id=request.seller_id,
        buyer_id=request.buyer_id,
        pickup_address=request.pickup_address.dict(),
        delivery_address=request.delivery_address.dict(),
        package=request.package.dict(),
        provider=request.provider,
        method=request.method,
        escrow_id=request.escrow_id,
        requires_pod=request.requires_pod,
        pod_types=request.pod_types
    )
    return {"delivery": _serialize_delivery(delivery)}


@router.post("/{delivery_id}/label")
async def create_shipping_label(delivery_id: str):
    """Create shipping label"""
    try:
        delivery = DeliveryEngine.create_shipping_label(delivery_id)
        return {"delivery": _serialize_delivery(delivery)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/schedule-pickup")
async def schedule_pickup(delivery_id: str, pickup_date: datetime):
    """Schedule pickup"""
    try:
        delivery = DeliveryEngine.schedule_pickup(delivery_id, pickup_date)
        return {"delivery": _serialize_delivery(delivery)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/status")
async def update_status(delivery_id: str, request: UpdateStatusRequest):
    """Update delivery status"""
    try:
        delivery = DeliveryEngine.update_status(
            delivery_id=delivery_id,
            status=request.status,
            location=request.location,
            latitude=request.latitude,
            longitude=request.longitude,
            description=request.description,
            driver_id=request.driver_id,
            photo_url=request.photo_url
        )
        return {"delivery": _serialize_delivery(delivery)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/exception")
async def record_exception(delivery_id: str, request: RecordExceptionRequest):
    """Record a delivery exception"""
    try:
        exception = DeliveryEngine.record_exception(
            delivery_id=delivery_id,
            exception_type=request.exception_type,
            description=request.description,
            photo_urls=request.photo_urls
        )
        return {"exception": exception.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/pod")
async def capture_pod(delivery_id: str, request: CapturePODRequest):
    """Capture proof of delivery"""
    try:
        pod = DeliveryEngine.capture_pod(
            delivery_id=delivery_id,
            pod_type=request.pod_type,
            captured_by=request.captured_by,
            signature_url=request.signature_url,
            photo_urls=request.photo_urls,
            latitude=request.latitude,
            longitude=request.longitude,
            accuracy_meters=request.accuracy_meters,
            recipient_name=request.recipient_name,
            recipient_id_type=request.recipient_id_type,
            recipient_id_number=request.recipient_id_number,
            relationship_to_buyer=request.relationship_to_buyer,
            notes=request.notes
        )
        return {"pod": pod.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/verify-otp")
async def verify_otp(delivery_id: str, request: VerifyOTPRequest):
    """Verify delivery OTP"""
    try:
        verified = DeliveryEngine.verify_delivery_otp(delivery_id, request.otp)
        return {"verified": verified}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{delivery_id}/complete")
async def complete_delivery(delivery_id: str, request: CompleteDeliveryRequest):
    """Complete delivery with POD"""
    try:
        delivery = DeliveryEngine.complete_delivery(
            delivery_id=delivery_id,
            pod_type=request.pod_type,
            captured_by=request.captured_by,
            photo_urls=request.photo_urls,
            signature_url=request.signature_url,
            latitude=request.latitude,
            longitude=request.longitude,
            recipient_name=request.recipient_name,
            otp=request.otp
        )
        return {"delivery": _serialize_delivery(delivery)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{delivery_id}")
async def get_delivery(delivery_id: str):
    """Get delivery by ID"""
    delivery = DeliveryEngine.get_delivery(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return {"delivery": _serialize_delivery(delivery)}


@router.get("/tracking/{tracking_number}")
async def get_by_tracking(tracking_number: str):
    """Get delivery by tracking number"""
    delivery = DeliveryEngine.get_delivery_by_tracking(tracking_number)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return {"delivery": _serialize_delivery(delivery)}


@router.get("/order/{order_id}")
async def get_order_deliveries(order_id: str):
    """Get deliveries for an order"""
    deliveries = DeliveryEngine.get_order_deliveries(order_id)
    return {"deliveries": [_serialize_delivery(d) for d in deliveries]}


@router.get("/seller/{seller_id}")
async def get_seller_deliveries(
    seller_id: str,
    status: Optional[DeliveryStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get deliveries for a seller"""
    deliveries = DeliveryEngine.get_seller_deliveries(seller_id, status, limit, offset)
    return {"deliveries": [_serialize_delivery(d) for d in deliveries], "count": len(deliveries)}


@router.get("/buyer/{buyer_id}")
async def get_buyer_deliveries(
    buyer_id: str,
    status: Optional[DeliveryStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get deliveries for a buyer"""
    deliveries = DeliveryEngine.get_buyer_deliveries(buyer_id, status, limit, offset)
    return {"deliveries": [_serialize_delivery(d) for d in deliveries], "count": len(deliveries)}


@router.get("/{delivery_id}/evidence")
async def get_pod_evidence(delivery_id: str):
    """Get all POD evidence for a delivery (for disputes)"""
    try:
        evidence = DeliveryEngine.get_pod_evidence(delivery_id)
        return {"evidence": evidence}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# HELPER FUNCTIONS
# ============================================

def _serialize_delivery(delivery: Delivery) -> Dict[str, Any]:
    """Serialize delivery to dict"""
    return {
        "delivery_id": delivery.delivery_id,
        "order_id": delivery.order_id,
        "escrow_id": delivery.escrow_id,
        "seller_id": delivery.seller_id,
        "buyer_id": delivery.buyer_id,
        "status": delivery.status.value,
        "provider": delivery.provider.value,
        "provider_tracking_number": delivery.provider_tracking_number,
        "provider_label_url": delivery.provider_label_url,
        "method": delivery.method.value,
        "pickup_address": delivery.pickup_address.__dict__ if delivery.pickup_address else None,
        "delivery_address": delivery.delivery_address.__dict__ if delivery.delivery_address else None,
        "package": delivery.package.__dict__ if delivery.package else None,
        "shipping_cost_ngn": delivery.shipping_cost_ngn,
        "insurance_cost_ngn": delivery.insurance_cost_ngn,
        "total_cost_ngn": delivery.total_cost_ngn,
        "created_at": delivery.created_at.isoformat(),
        "pickup_scheduled_at": delivery.pickup_scheduled_at.isoformat() if delivery.pickup_scheduled_at else None,
        "picked_up_at": delivery.picked_up_at.isoformat() if delivery.picked_up_at else None,
        "estimated_delivery_at": delivery.estimated_delivery_at.isoformat() if delivery.estimated_delivery_at else None,
        "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None,
        "proof_of_delivery": delivery.proof_of_delivery.__dict__ if delivery.proof_of_delivery else None,
        "requires_pod": delivery.requires_pod,
        "pod_types_required": [p.value for p in delivery.pod_types_required],
        "delivery_otp": delivery.delivery_otp,
        "driver_id": delivery.driver_id,
        "driver_name": delivery.driver_name,
        "driver_phone": delivery.driver_phone,
        "events": [e.__dict__ for e in delivery.events],
        "exceptions": [e.__dict__ for e in delivery.exceptions]
    }
