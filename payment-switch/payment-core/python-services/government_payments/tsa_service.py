"""
Government & Regulatory Payments module — Treasury Single Account (TSA),
tax collection (FIRS/SIRS), pension remittance, social payments/disbursements,
regulatory reporting, and GIFMIS integration.

Implements CBN circular requirements for government payment flows through the
National Payment Switch.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import uuid


class PaymentCategory(str, Enum):
    TSA_COLLECTION = "TSA_COLLECTION"
    TAX_PAYMENT = "TAX_PAYMENT"
    PENSION_REMITTANCE = "PENSION_REMITTANCE"
    SOCIAL_DISBURSEMENT = "SOCIAL_DISBURSEMENT"
    CUSTOMS_DUTY = "CUSTOMS_DUTY"
    REGULATORY_FEE = "REGULATORY_FEE"


class PaymentStatus(str, Enum):
    INITIATED = "INITIATED"
    VALIDATED = "VALIDATED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVERSED = "REVERSED"


class ReportType(str, Enum):
    BOP_RETURN = "BOP_RETURN"
    EFORM_M = "EFORM_M"
    FORM_A = "FORM_A"
    CBN_MONTHLY = "CBN_MONTHLY"
    NFIU_STR = "NFIU_STR"
    GIFMIS_RECONCILIATION = "GIFMIS_RECONCILIATION"


@dataclass
class GovernmentPayment:
    id: str = ""
    category: PaymentCategory = PaymentCategory.TSA_COLLECTION
    status: PaymentStatus = PaymentStatus.INITIATED
    payer_name: str = ""
    payer_tin: str = ""
    payer_account: str = ""
    payer_bank: str = ""
    beneficiary_mda: str = ""  # Ministry/Department/Agency
    beneficiary_account: str = ""
    amount: float = 0.0
    currency: str = "NGN"
    payment_ref: str = ""
    tsa_code: str = ""
    revenue_code: str = ""
    narration: str = ""
    initiated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    gifmis_ref: str = ""
    failure_reason: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = f"GOV-{uuid.uuid4().hex[:12].upper()}"
        if not self.payment_ref:
            self.payment_ref = f"PAY-{uuid.uuid4().hex[:8].upper()}"


@dataclass
class TaxPayment:
    id: str = ""
    tax_type: str = ""  # CIT, VAT, WHT, PIT, EDT, STAMP_DUTY
    payer_name: str = ""
    payer_tin: str = ""
    assessment_year: int = 2026
    assessment_ref: str = ""
    tax_office: str = ""
    amount: float = 0.0
    penalty: float = 0.0
    interest: float = 0.0
    total_amount: float = 0.0
    status: str = "pending"
    paid_at: Optional[datetime] = None
    receipt_number: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = f"TAX-{uuid.uuid4().hex[:12].upper()}"
        self.total_amount = self.amount + self.penalty + self.interest


@dataclass
class PensionRemittance:
    id: str = ""
    employer_name: str = ""
    employer_rc: str = ""  # RC number
    pfa_name: str = ""  # Pension Fund Administrator
    pfa_code: str = ""
    employee_count: int = 0
    employer_contribution: float = 0.0
    employee_contribution: float = 0.0
    voluntary_contribution: float = 0.0
    total_amount: float = 0.0
    period: str = ""  # e.g., "2026-04"
    status: str = "pending"
    schedule_ref: str = ""
    submitted_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"PEN-{uuid.uuid4().hex[:12].upper()}"
        self.total_amount = (
            self.employer_contribution
            + self.employee_contribution
            + self.voluntary_contribution
        )


@dataclass
class SocialDisbursement:
    id: str = ""
    program_name: str = ""
    program_code: str = ""
    beneficiary_count: int = 0
    amount_per_beneficiary: float = 0.0
    total_amount: float = 0.0
    disbursed_count: int = 0
    failed_count: int = 0
    status: str = "pending"  # pending, disbursing, completed, partial
    initiated_by: str = ""
    initiated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"SOC-{uuid.uuid4().hex[:12].upper()}"
        self.total_amount = self.beneficiary_count * self.amount_per_beneficiary


@dataclass
class RegulatoryReport:
    id: str = ""
    report_type: ReportType = ReportType.BOP_RETURN
    period: str = ""
    generated_at: datetime = field(default_factory=datetime.now)
    submitted_at: Optional[datetime] = None
    status: str = "draft"  # draft, generated, submitted, accepted, rejected
    record_count: int = 0
    total_value: float = 0.0
    currency: str = "NGN"
    submitted_to: str = ""
    reference: str = ""
    file_path: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = f"RPT-{uuid.uuid4().hex[:12].upper()}"


class GovernmentPaymentEngine:
    """Orchestrates government and regulatory payment processing."""

    def __init__(self):
        self.payments: dict[str, GovernmentPayment] = {}
        self.tax_payments: dict[str, TaxPayment] = {}
        self.pension_remittances: dict[str, PensionRemittance] = {}
        self.social_disbursements: dict[str, SocialDisbursement] = {}
        self.regulatory_reports: dict[str, RegulatoryReport] = {}
        self._seed_data()

    def process_tsa_collection(self, payment: GovernmentPayment) -> GovernmentPayment:
        """Process a TSA revenue collection payment."""
        payment.category = PaymentCategory.TSA_COLLECTION
        payment.status = PaymentStatus.PROCESSING
        payment.gifmis_ref = f"GIFMIS-{uuid.uuid4().hex[:8].upper()}"
        payment.status = PaymentStatus.COMPLETED
        payment.completed_at = datetime.now()
        self.payments[payment.id] = payment
        return payment

    def process_tax_payment(self, tax: TaxPayment) -> TaxPayment:
        """Process a tax payment to FIRS/SIRS."""
        tax.status = "paid"
        tax.paid_at = datetime.now()
        tax.receipt_number = f"FIRS-{uuid.uuid4().hex[:8].upper()}"
        self.tax_payments[tax.id] = tax
        return tax

    def submit_pension_remittance(self, pension: PensionRemittance) -> PensionRemittance:
        """Submit pension contribution remittance to PFA."""
        pension.status = "submitted"
        pension.submitted_at = datetime.now()
        pension.schedule_ref = f"PENCOM-{uuid.uuid4().hex[:8].upper()}"
        self.pension_remittances[pension.id] = pension
        return pension

    def initiate_social_disbursement(self, disbursement: SocialDisbursement) -> SocialDisbursement:
        """Initiate a government-to-person social payment disbursement."""
        disbursement.status = "disbursing"
        disbursement.initiated_at = datetime.now()
        self.social_disbursements[disbursement.id] = disbursement
        return disbursement

    def generate_regulatory_report(self, report_type: ReportType, period: str) -> RegulatoryReport:
        """Generate a regulatory report (BOP, eForm M, Form A, etc.)."""
        report = RegulatoryReport(
            report_type=report_type,
            period=period,
            status="generated",
            record_count=150,
            total_value=45_000_000.0,
            submitted_to="CBN" if report_type != ReportType.NFIU_STR else "NFIU",
            reference=f"CBN-{report_type.value}-{period}",
        )
        self.regulatory_reports[report.id] = report
        return report

    def _seed_data(self):
        """Populate with realistic seed data."""
        # TSA collections
        mdas = [
            ("Federal Ministry of Finance", "TSA-001-FMF", "0001001234"),
            ("Nigeria Customs Service", "TSA-002-NCS", "0001005678"),
            ("Federal Ministry of Health", "TSA-003-FMH", "0001009012"),
            ("Federal Ministry of Education", "TSA-004-FME", "0001003456"),
            ("NNPC Ltd", "TSA-005-NNPC", "0001007890"),
        ]
        for i, (mda, tsa_code, acct) in enumerate(mdas):
            p = GovernmentPayment(
                category=PaymentCategory.TSA_COLLECTION,
                status=PaymentStatus.COMPLETED,
                payer_name=f"Revenue Collection Agent {i+1}",
                payer_tin=f"TIN{10000000+i}",
                payer_account=f"00{20000000+i}",
                payer_bank="ACCESS",
                beneficiary_mda=mda,
                beneficiary_account=acct,
                amount=[450_000_000, 1_200_000_000, 89_000_000, 156_000_000, 8_500_000_000][i],
                tsa_code=tsa_code,
                revenue_code=f"REV-{1000+i}",
                narration=f"TSA collection for {mda}",
                completed_at=datetime.now() - timedelta(hours=i * 3),
            )
            self.payments[p.id] = p

        # Tax payments
        taxes = [
            ("CIT", "Dangote Industries", "TIN20001", "FIRS Lagos", 2_500_000_000),
            ("VAT", "MTN Nigeria", "TIN20002", "FIRS Abuja", 890_000_000),
            ("WHT", "Access Bank Plc", "TIN20003", "FIRS Lagos", 340_000_000),
            ("PIT", "Lagos State PAYE", "TIN20004", "LIRS Ikeja", 1_200_000),
            ("STAMP_DUTY", "Globacom Ltd", "TIN20005", "FIRS Abuja", 45_000_000),
        ]
        for tax_type, name, tin, office, amount in taxes:
            t = TaxPayment(
                tax_type=tax_type,
                payer_name=name,
                payer_tin=tin,
                tax_office=office,
                amount=amount,
                status="paid",
                paid_at=datetime.now() - timedelta(days=1),
            )
            self.tax_payments[t.id] = t

        # Pension remittances
        pfas = [
            ("Stanbic IBTC Pension", "PENCOM-001", 2500),
            ("ARM Pension Managers", "PENCOM-002", 1800),
            ("Leadway Pensure", "PENCOM-003", 3200),
        ]
        for pfa, code, emp_count in pfas:
            p = PensionRemittance(
                employer_name="Federal Civil Service Commission",
                employer_rc="RC100001",
                pfa_name=pfa,
                pfa_code=code,
                employee_count=emp_count,
                employer_contribution=emp_count * 45_000 * 0.10,
                employee_contribution=emp_count * 45_000 * 0.08,
                period="2026-04",
                status="confirmed",
                submitted_at=datetime.now() - timedelta(days=2),
                confirmed_at=datetime.now() - timedelta(days=1),
            )
            self.pension_remittances[p.id] = p

        # Social disbursements
        programs = [
            ("N-Power Stipend", "NSIP-001", 500_000, 30_000),
            ("Conditional Cash Transfer", "CCT-001", 1_200_000, 5_000),
            ("COVID-19 Palliative", "COVID-PAL", 200_000, 20_000),
        ]
        for name, code, count, amount in programs:
            d = SocialDisbursement(
                program_name=name,
                program_code=code,
                beneficiary_count=count,
                amount_per_beneficiary=amount,
                disbursed_count=int(count * 0.95),
                failed_count=int(count * 0.05),
                status="completed",
                initiated_by="Federal Ministry of Humanitarian Affairs",
            )
            self.social_disbursements[d.id] = d
