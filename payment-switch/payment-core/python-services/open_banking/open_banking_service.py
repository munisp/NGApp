"""
Open Banking / API Marketplace module for the National Payment Switch.

Implements Account Information Service (AIS), Payment Initiation Service (PIS),
consent management, API marketplace, developer sandbox, and usage-based billing.
Compliant with CBN Open Banking Framework.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import uuid


class ConsentStatus(str, Enum):
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    REJECTED = "REJECTED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class ServiceType(str, Enum):
    AIS = "AIS"  # Account Information Service
    PIS = "PIS"  # Payment Initiation Service
    CBPII = "CBPII"  # Card-Based Payment Instrument Issuer
    PISP = "PISP"  # Payment Initiation Service Provider


class TPPStatus(str, Enum):
    REGISTERED = "REGISTERED"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REVOKED = "REVOKED"


class APITier(str, Enum):
    SANDBOX = "SANDBOX"
    STARTER = "STARTER"
    GROWTH = "GROWTH"
    ENTERPRISE = "ENTERPRISE"


@dataclass
class ThirdPartyProvider:
    """A registered TPP (Third Party Provider) accessing the Open Banking APIs."""
    id: str = ""
    name: str = ""
    registration_number: str = ""
    cbn_license: str = ""
    services: list[ServiceType] = field(default_factory=list)
    status: TPPStatus = TPPStatus.REGISTERED
    api_tier: APITier = APITier.SANDBOX
    client_id: str = ""
    webhook_url: str = ""
    redirect_uris: list[str] = field(default_factory=list)
    contact_email: str = ""
    monthly_api_calls: int = 0
    rate_limit_per_min: int = 60
    registered_at: datetime = field(default_factory=datetime.now)
    last_active_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"TPP-{uuid.uuid4().hex[:12].upper()}"
        if not self.client_id:
            self.client_id = f"cli_{uuid.uuid4().hex[:16]}"


@dataclass
class Consent:
    """Customer consent for data sharing or payment initiation."""
    id: str = ""
    customer_id: str = ""
    customer_name: str = ""
    tpp_id: str = ""
    tpp_name: str = ""
    service_type: ServiceType = ServiceType.AIS
    status: ConsentStatus = ConsentStatus.PENDING
    permissions: list[str] = field(default_factory=list)
    accounts: list[str] = field(default_factory=list)
    valid_from: datetime = field(default_factory=datetime.now)
    valid_until: datetime = field(default_factory=lambda: datetime.now() + timedelta(days=90))
    authorized_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"CON-{uuid.uuid4().hex[:12].upper()}"


@dataclass
class AISRequest:
    """Account Information Service request."""
    id: str = ""
    consent_id: str = ""
    tpp_id: str = ""
    request_type: str = ""  # balances, transactions, standing_orders, beneficiaries
    account_id: str = ""
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    status: str = "completed"
    response_code: int = 200
    requested_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.id:
            self.id = f"AIS-{uuid.uuid4().hex[:12].upper()}"


@dataclass
class PISRequest:
    """Payment Initiation Service request."""
    id: str = ""
    consent_id: str = ""
    tpp_id: str = ""
    debtor_account: str = ""
    debtor_bank: str = ""
    creditor_account: str = ""
    creditor_bank: str = ""
    creditor_name: str = ""
    amount: float = 0.0
    currency: str = "NGN"
    reference: str = ""
    status: str = "initiated"  # initiated, authorized, executed, failed
    payment_id: str = ""
    initiated_at: datetime = field(default_factory=datetime.now)
    executed_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"PIS-{uuid.uuid4().hex[:12].upper()}"


@dataclass
class APIUsageRecord:
    """Tracks API usage per TPP for billing."""
    tpp_id: str = ""
    endpoint: str = ""
    method: str = "GET"
    status_code: int = 200
    latency_ms: int = 0
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SandboxEnvironment:
    """Developer sandbox for testing."""
    id: str = ""
    tpp_id: str = ""
    name: str = ""
    status: str = "active"
    test_accounts: list[dict] = field(default_factory=list)
    test_api_key: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    total_test_calls: int = 0

    def __post_init__(self):
        if not self.id:
            self.id = f"SBX-{uuid.uuid4().hex[:12].upper()}"
        if not self.test_api_key:
            self.test_api_key = f"sbx_test_{uuid.uuid4().hex[:24]}"


class OpenBankingEngine:
    """Orchestrates Open Banking / API Marketplace operations."""

    def __init__(self):
        self.tpps: dict[str, ThirdPartyProvider] = {}
        self.consents: dict[str, Consent] = {}
        self.ais_requests: dict[str, AISRequest] = {}
        self.pis_requests: dict[str, PISRequest] = {}
        self.sandboxes: dict[str, SandboxEnvironment] = {}
        self.usage_records: list[APIUsageRecord] = []
        self._seed_data()

    def register_tpp(self, tpp: ThirdPartyProvider) -> ThirdPartyProvider:
        """Register a new Third Party Provider."""
        tpp.status = TPPStatus.REGISTERED
        tpp.registered_at = datetime.now()
        self.tpps[tpp.id] = tpp
        return tpp

    def create_consent(self, consent: Consent) -> Consent:
        """Create a new customer consent."""
        consent.status = ConsentStatus.PENDING
        consent.valid_from = datetime.now()
        consent.valid_until = datetime.now() + timedelta(days=90)
        self.consents[consent.id] = consent
        return consent

    def authorize_consent(self, consent_id: str) -> Consent:
        """Customer authorizes a consent."""
        consent = self.consents.get(consent_id)
        if consent:
            consent.status = ConsentStatus.AUTHORIZED
            consent.authorized_at = datetime.now()
        return consent

    def revoke_consent(self, consent_id: str) -> Consent:
        """Customer or TPP revokes a consent."""
        consent = self.consents.get(consent_id)
        if consent:
            consent.status = ConsentStatus.REVOKED
            consent.revoked_at = datetime.now()
        return consent

    def initiate_payment(self, pis: PISRequest) -> PISRequest:
        """Initiate a payment via PIS."""
        pis.status = "initiated"
        pis.payment_id = f"PAY-{uuid.uuid4().hex[:8].upper()}"
        self.pis_requests[pis.id] = pis
        return pis

    def create_sandbox(self, tpp_id: str) -> SandboxEnvironment:
        """Create a sandbox environment for a TPP."""
        sandbox = SandboxEnvironment(
            tpp_id=tpp_id,
            name=f"Sandbox for {tpp_id}",
            test_accounts=[
                {"id": "TEST-001", "name": "Test Current Account", "balance": 5_000_000, "currency": "NGN", "type": "current"},
                {"id": "TEST-002", "name": "Test Savings Account", "balance": 12_000_000, "currency": "NGN", "type": "savings"},
                {"id": "TEST-003", "name": "Test USD Account", "balance": 25_000, "currency": "USD", "type": "domiciliary"},
            ],
        )
        self.sandboxes[sandbox.id] = sandbox
        return sandbox

    def _seed_data(self):
        """Populate with realistic seed data."""
        tpps = [
            ("Paystack", "RC1234567", "CBN/OB/2024/001", [ServiceType.AIS, ServiceType.PIS], TPPStatus.ACTIVE, APITier.ENTERPRISE, 850_000),
            ("Flutterwave", "RC2345678", "CBN/OB/2024/002", [ServiceType.AIS, ServiceType.PIS], TPPStatus.ACTIVE, APITier.ENTERPRISE, 720_000),
            ("Mono", "RC3456789", "CBN/OB/2024/003", [ServiceType.AIS], TPPStatus.ACTIVE, APITier.GROWTH, 450_000),
            ("Okra", "RC4567890", "CBN/OB/2024/004", [ServiceType.AIS], TPPStatus.ACTIVE, APITier.GROWTH, 380_000),
            ("Stitch", "RC5678901", "CBN/OB/2024/005", [ServiceType.AIS, ServiceType.PIS], TPPStatus.ACTIVE, APITier.STARTER, 120_000),
            ("OnePipe", "RC6789012", "CBN/OB/2024/006", [ServiceType.PIS], TPPStatus.ACTIVE, APITier.STARTER, 95_000),
            ("Bloc", "RC7890123", "CBN/OB/2024/007", [ServiceType.AIS, ServiceType.PIS], TPPStatus.REGISTERED, APITier.SANDBOX, 0),
            ("Paga", "RC8901234", "CBN/OB/2024/008", [ServiceType.PIS], TPPStatus.ACTIVE, APITier.GROWTH, 210_000),
        ]
        for name, rc, license_, services, status, tier, calls in tpps:
            tpp = ThirdPartyProvider(
                name=name,
                registration_number=rc,
                cbn_license=license_,
                services=services,
                status=status,
                api_tier=tier,
                monthly_api_calls=calls,
                contact_email=f"api@{name.lower().replace(' ', '')}.com",
                webhook_url=f"https://api.{name.lower().replace(' ', '')}.com/webhooks/openbanking",
                redirect_uris=[f"https://app.{name.lower().replace(' ', '')}.com/callback"],
            )
            self.tpps[tpp.id] = tpp

        # Active consents
        for i, tpp in enumerate(list(self.tpps.values())[:5]):
            consent = Consent(
                customer_id=f"CUST-{10000+i}",
                customer_name=f"Customer {i+1}",
                tpp_id=tpp.id,
                tpp_name=tpp.name,
                service_type=ServiceType.AIS if ServiceType.AIS in tpp.services else ServiceType.PIS,
                status=ConsentStatus.AUTHORIZED,
                permissions=["ReadAccountsBasic", "ReadBalances", "ReadTransactionsBasic"],
                accounts=[f"00{30000000+i}", f"00{40000000+i}"],
                authorized_at=datetime.now() - timedelta(days=30),
            )
            self.consents[consent.id] = consent
