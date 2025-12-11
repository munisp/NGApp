"""
Property Transaction KYC Module
Enhanced KYC for high-value property transactions (real estate purchases)

Bank Requirements Addressed:
1. Government Issued ID of Client (Buyer) - via existing KYC
2. Government Issued ID of Seller (Counterparty) - NEW: Seller KYC
3. Source of Funds - NEW: Structured capture with validation
4. Three months of bank statements - NEW: Date range validation
5. W-2 or similar income document - NEW: Income document types
6. Purchase Agreement - NEW: Document type with party validation

This creates a "closed loop ecosystem" where both buyer and seller identities
are verified before high-value property payments can proceed.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
from decimal import Decimal
import uuid
import hashlib

router = APIRouter(prefix="/property-kyc", tags=["Property Transaction KYC"])


# ============================================================================
# ENUMS
# ============================================================================

class PartyRole(str, Enum):
    """Role in property transaction"""
    BUYER = "buyer"
    SELLER = "seller"
    AGENT = "agent"  # Real estate agent
    LAWYER = "lawyer"  # Legal representative
    ESCROW = "escrow"  # Title company / escrow agent


class SourceOfFunds(str, Enum):
    """Source of funds for property purchase"""
    EMPLOYMENT_INCOME = "employment_income"
    BUSINESS_INCOME = "business_income"
    SAVINGS = "savings"
    INVESTMENT_RETURNS = "investment_returns"
    SALE_OF_PROPERTY = "sale_of_property"
    INHERITANCE = "inheritance"
    GIFT = "gift"
    LOAN = "loan"
    PENSION = "pension"
    RENTAL_INCOME = "rental_income"
    OTHER = "other"


class IncomeDocumentType(str, Enum):
    """Types of income verification documents"""
    W2_FORM = "w2_form"  # US W-2
    PAYE_RECORD = "paye_record"  # Nigeria PAYE
    TAX_RETURN = "tax_return"
    PAYSLIP = "payslip"
    EMPLOYMENT_LETTER = "employment_letter"
    BUSINESS_REGISTRATION = "business_registration"
    AUDITED_ACCOUNTS = "audited_accounts"
    BANK_REFERENCE = "bank_reference"
    PENSION_STATEMENT = "pension_statement"


class PropertyDocumentType(str, Enum):
    """Property transaction document types"""
    PURCHASE_AGREEMENT = "purchase_agreement"
    DEED_OF_ASSIGNMENT = "deed_of_assignment"
    CERTIFICATE_OF_OCCUPANCY = "certificate_of_occupancy"
    SURVEY_PLAN = "survey_plan"
    GOVERNORS_CONSENT = "governors_consent"
    POWER_OF_ATTORNEY = "power_of_attorney"
    PROPERTY_VALUATION = "property_valuation"


class TransactionStatus(str, Enum):
    """Property transaction status"""
    INITIATED = "initiated"
    BUYER_KYC_PENDING = "buyer_kyc_pending"
    SELLER_KYC_PENDING = "seller_kyc_pending"
    DOCUMENTS_PENDING = "documents_pending"
    UNDER_REVIEW = "under_review"
    COMPLIANCE_CHECK = "compliance_check"
    APPROVED = "approved"
    FUNDS_HELD = "funds_held"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class VerificationStatus(str, Enum):
    """Document/KYC verification status"""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


# ============================================================================
# MODELS
# ============================================================================

class PartyIdentity(BaseModel):
    """Identity information for a party in the transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: PartyRole
    
    # Personal Information
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: date
    nationality: str
    
    # Contact
    email: str
    phone: str
    
    # Address
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    country: str
    postal_code: Optional[str] = None
    
    # Identity Documents
    id_type: str  # passport, national_id, drivers_license
    id_number: str
    id_issuing_country: str
    id_issue_date: date
    id_expiry_date: date
    id_document_url: Optional[str] = None
    
    # Nigeria-specific
    bvn: Optional[str] = None  # Bank Verification Number
    nin: Optional[str] = None  # National Identification Number
    
    # Verification
    kyc_status: VerificationStatus = VerificationStatus.PENDING
    kyc_verified_at: Optional[datetime] = None
    kyc_verified_by: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('id_expiry_date')
    def id_must_not_be_expired(cls, v):
        if v < date.today():
            raise ValueError('ID document has expired')
        return v
    
    @validator('bvn')
    def validate_bvn(cls, v):
        if v and (len(v) != 11 or not v.isdigit()):
            raise ValueError('BVN must be 11 digits')
        return v


class SourceOfFundsDeclaration(BaseModel):
    """Declaration of source of funds for property purchase"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    
    # Primary source
    primary_source: SourceOfFunds
    primary_source_description: str
    primary_source_amount: Decimal
    
    # Secondary sources (if applicable)
    secondary_sources: List[Dict[str, Any]] = []
    
    # Employment details (if employment income)
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    job_title: Optional[str] = None
    employment_start_date: Optional[date] = None
    monthly_salary: Optional[Decimal] = None
    
    # Business details (if business income)
    business_name: Optional[str] = None
    business_registration_number: Optional[str] = None
    business_type: Optional[str] = None
    annual_revenue: Optional[Decimal] = None
    
    # Loan details (if loan)
    lender_name: Optional[str] = None
    loan_amount: Optional[Decimal] = None
    loan_reference: Optional[str] = None
    
    # Gift details (if gift)
    donor_name: Optional[str] = None
    donor_relationship: Optional[str] = None
    gift_declaration_url: Optional[str] = None
    
    # Verification
    status: VerificationStatus = VerificationStatus.PENDING
    risk_flags: List[str] = []
    reviewer_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BankStatement(BaseModel):
    """Bank statement document with date validation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    party_id: str
    
    bank_name: str
    account_number: str  # Last 4 digits only for security
    account_holder_name: str
    
    statement_start_date: date
    statement_end_date: date
    
    document_url: str
    document_hash: Optional[str] = None
    
    # Extracted data (from OCR or manual entry)
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None
    total_credits: Optional[Decimal] = None
    total_debits: Optional[Decimal] = None
    
    status: VerificationStatus = VerificationStatus.PENDING
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('statement_end_date')
    def validate_date_range(cls, v, values):
        if 'statement_start_date' in values:
            start = values['statement_start_date']
            if v < start:
                raise ValueError('End date must be after start date')
        return v


class IncomeDocument(BaseModel):
    """Income verification document"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    party_id: str
    
    document_type: IncomeDocumentType
    document_url: str
    document_hash: Optional[str] = None
    
    # Document details
    tax_year: Optional[int] = None
    employer_name: Optional[str] = None
    gross_income: Optional[Decimal] = None
    net_income: Optional[Decimal] = None
    
    status: VerificationStatus = VerificationStatus.PENDING
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PurchaseAgreement(BaseModel):
    """Purchase agreement document with party validation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    
    document_url: str
    document_hash: Optional[str] = None
    
    # Extracted/Verified Information
    # Buyer Information (must match buyer KYC)
    buyer_name: str
    buyer_address: str
    buyer_id_number: Optional[str] = None
    
    # Seller Information (must match seller KYC)
    seller_name: str
    seller_address: str
    seller_id_number: Optional[str] = None
    
    # Property Details
    property_address: str
    property_description: str
    property_type: str  # residential, commercial, land
    property_size: Optional[str] = None
    title_reference: Optional[str] = None
    
    # Transaction Terms
    purchase_price: Decimal
    currency: str = "NGN"
    deposit_amount: Optional[Decimal] = None
    deposit_paid: bool = False
    completion_date: Optional[date] = None
    
    # Signatures
    buyer_signed: bool = False
    buyer_signature_date: Optional[date] = None
    seller_signed: bool = False
    seller_signature_date: Optional[date] = None
    witness_signed: bool = False
    
    # Validation
    buyer_info_matches_kyc: bool = False
    seller_info_matches_kyc: bool = False
    price_matches_transaction: bool = False
    
    status: VerificationStatus = VerificationStatus.PENDING
    rejection_reason: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PropertyTransaction(BaseModel):
    """Complete property transaction with all KYC requirements"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference_number: str = Field(default_factory=lambda: f"PTX-{uuid.uuid4().hex[:8].upper()}")
    
    # Transaction Details
    transaction_type: str = "property_purchase"
    property_type: str  # residential, commercial, land
    property_address: str
    purchase_price: Decimal
    currency: str = "NGN"
    
    # Parties
    buyer_id: str  # Reference to PartyIdentity
    seller_id: Optional[str] = None  # Reference to PartyIdentity
    escrow_id: Optional[str] = None  # If using escrow/title company
    
    # KYC Status
    buyer_kyc_complete: bool = False
    seller_kyc_complete: bool = False
    
    # Source of Funds
    source_of_funds_id: Optional[str] = None
    source_of_funds_verified: bool = False
    
    # Documents
    bank_statement_ids: List[str] = []
    bank_statements_verified: bool = False
    bank_statements_cover_3_months: bool = False
    
    income_document_ids: List[str] = []
    income_verified: bool = False
    
    purchase_agreement_id: Optional[str] = None
    purchase_agreement_verified: bool = False
    
    # Compliance
    aml_check_passed: bool = False
    sanctions_check_passed: bool = False
    pep_check_passed: bool = False
    risk_score: int = 0
    risk_flags: List[str] = []
    
    # Status
    status: TransactionStatus = TransactionStatus.INITIATED
    status_history: List[Dict[str, Any]] = []
    
    # Review
    assigned_reviewer: Optional[str] = None
    reviewer_notes: List[Dict[str, Any]] = []
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ============================================================================
# IN-MEMORY STORAGE (Replace with database in production)
# ============================================================================

parties_db: Dict[str, PartyIdentity] = {}
transactions_db: Dict[str, PropertyTransaction] = {}
source_of_funds_db: Dict[str, SourceOfFundsDeclaration] = {}
bank_statements_db: Dict[str, BankStatement] = {}
income_documents_db: Dict[str, IncomeDocument] = {}
purchase_agreements_db: Dict[str, PurchaseAgreement] = {}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def validate_bank_statements_coverage(statements: List[BankStatement]) -> Dict[str, Any]:
    """Validate that bank statements cover at least 3 months"""
    if not statements:
        return {
            "valid": False,
            "message": "No bank statements provided",
            "coverage_days": 0,
            "required_days": 90
        }
    
    # Find earliest and latest dates
    all_dates = []
    for stmt in statements:
        all_dates.append(stmt.statement_start_date)
        all_dates.append(stmt.statement_end_date)
    
    earliest = min(all_dates)
    latest = max(all_dates)
    coverage_days = (latest - earliest).days
    
    # Check if statements are recent (within last 6 months)
    today = date.today()
    if latest < today - timedelta(days=180):
        return {
            "valid": False,
            "message": "Bank statements are too old (must be within last 6 months)",
            "coverage_days": coverage_days,
            "required_days": 90,
            "latest_statement_date": latest.isoformat()
        }
    
    # Check 3-month coverage
    if coverage_days >= 90:
        return {
            "valid": True,
            "message": f"Bank statements cover {coverage_days} days (minimum 90 required)",
            "coverage_days": coverage_days,
            "required_days": 90,
            "date_range": f"{earliest.isoformat()} to {latest.isoformat()}"
        }
    
    return {
        "valid": False,
        "message": f"Bank statements only cover {coverage_days} days (minimum 90 required)",
        "coverage_days": coverage_days,
        "required_days": 90,
        "gap_days": 90 - coverage_days
    }


def validate_purchase_agreement_parties(
    agreement: PurchaseAgreement,
    buyer: PartyIdentity,
    seller: PartyIdentity
) -> Dict[str, Any]:
    """Validate that purchase agreement parties match KYC records"""
    issues = []
    
    # Normalize names for comparison
    def normalize(name: str) -> str:
        return name.lower().strip().replace("  ", " ")
    
    buyer_full_name = f"{buyer.first_name} {buyer.last_name}"
    seller_full_name = f"{seller.first_name} {seller.last_name}"
    
    # Check buyer name
    if normalize(agreement.buyer_name) != normalize(buyer_full_name):
        issues.append(f"Buyer name mismatch: Agreement has '{agreement.buyer_name}', KYC has '{buyer_full_name}'")
    
    # Check seller name
    if normalize(agreement.seller_name) != normalize(seller_full_name):
        issues.append(f"Seller name mismatch: Agreement has '{agreement.seller_name}', KYC has '{seller_full_name}'")
    
    # Check signatures
    if not agreement.buyer_signed:
        issues.append("Buyer signature missing")
    if not agreement.seller_signed:
        issues.append("Seller signature missing")
    
    # Check dates
    if agreement.buyer_signature_date and agreement.seller_signature_date:
        if agreement.buyer_signature_date > date.today() or agreement.seller_signature_date > date.today():
            issues.append("Signature dates cannot be in the future")
    
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "buyer_name_match": normalize(agreement.buyer_name) == normalize(buyer_full_name),
        "seller_name_match": normalize(agreement.seller_name) == normalize(seller_full_name),
        "both_signed": agreement.buyer_signed and agreement.seller_signed
    }


def calculate_risk_score(transaction: PropertyTransaction) -> int:
    """Calculate risk score for property transaction"""
    score = 0
    flags = []
    
    # High value transaction
    if transaction.purchase_price > Decimal("100000000"):  # > 100M NGN
        score += 30
        flags.append("high_value_transaction")
    elif transaction.purchase_price > Decimal("50000000"):  # > 50M NGN
        score += 15
        flags.append("elevated_value_transaction")
    
    # Source of funds risk
    sof = source_of_funds_db.get(transaction.source_of_funds_id)
    if sof:
        if sof.primary_source == SourceOfFunds.GIFT:
            score += 25
            flags.append("gift_source_requires_declaration")
        elif sof.primary_source == SourceOfFunds.OTHER:
            score += 20
            flags.append("unspecified_source_of_funds")
        elif sof.primary_source == SourceOfFunds.LOAN:
            score += 10
            flags.append("loan_funded_purchase")
    
    # Missing documents
    if not transaction.bank_statements_cover_3_months:
        score += 15
        flags.append("incomplete_bank_statements")
    
    if not transaction.income_verified:
        score += 10
        flags.append("income_not_verified")
    
    if not transaction.seller_kyc_complete:
        score += 20
        flags.append("seller_kyc_incomplete")
    
    transaction.risk_score = min(score, 100)
    transaction.risk_flags = flags
    
    return score


# ============================================================================
# API ENDPOINTS
# ============================================================================

# --- Party Identity Endpoints ---

@router.post("/parties", response_model=PartyIdentity)
async def create_party(party: PartyIdentity):
    """Create a new party identity (buyer, seller, etc.)"""
    parties_db[party.id] = party
    return party


@router.get("/parties/{party_id}", response_model=PartyIdentity)
async def get_party(party_id: str):
    """Get party identity details"""
    if party_id not in parties_db:
        raise HTTPException(status_code=404, detail="Party not found")
    return parties_db[party_id]


@router.put("/parties/{party_id}/verify")
async def verify_party_kyc(
    party_id: str,
    status: VerificationStatus,
    reviewer_id: str,
    notes: Optional[str] = None
):
    """Verify party KYC (approve/reject)"""
    if party_id not in parties_db:
        raise HTTPException(status_code=404, detail="Party not found")
    
    party = parties_db[party_id]
    party.kyc_status = status
    party.kyc_verified_at = datetime.utcnow()
    party.kyc_verified_by = reviewer_id
    party.updated_at = datetime.utcnow()
    
    return {"status": "updated", "party_id": party_id, "kyc_status": status}


# --- Transaction Endpoints ---

@router.post("/transactions", response_model=PropertyTransaction)
async def create_property_transaction(
    buyer_id: str,
    property_type: str,
    property_address: str,
    purchase_price: Decimal,
    currency: str = "NGN"
):
    """Initiate a new property transaction"""
    if buyer_id not in parties_db:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    transaction = PropertyTransaction(
        buyer_id=buyer_id,
        property_type=property_type,
        property_address=property_address,
        purchase_price=purchase_price,
        currency=currency,
        status=TransactionStatus.BUYER_KYC_PENDING
    )
    
    transaction.status_history.append({
        "status": TransactionStatus.INITIATED.value,
        "timestamp": datetime.utcnow().isoformat(),
        "note": "Transaction initiated"
    })
    
    transactions_db[transaction.id] = transaction
    return transaction


@router.get("/transactions/{transaction_id}", response_model=PropertyTransaction)
async def get_transaction(transaction_id: str):
    """Get property transaction details"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transactions_db[transaction_id]


@router.put("/transactions/{transaction_id}/add-seller")
async def add_seller_to_transaction(transaction_id: str, seller_id: str):
    """Add seller to property transaction"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if seller_id not in parties_db:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    transaction = transactions_db[transaction_id]
    transaction.seller_id = seller_id
    transaction.status = TransactionStatus.SELLER_KYC_PENDING
    transaction.updated_at = datetime.utcnow()
    
    transaction.status_history.append({
        "status": TransactionStatus.SELLER_KYC_PENDING.value,
        "timestamp": datetime.utcnow().isoformat(),
        "note": f"Seller added: {seller_id}"
    })
    
    return {"status": "seller_added", "transaction_id": transaction_id}


# --- Source of Funds Endpoints ---

@router.post("/transactions/{transaction_id}/source-of-funds", response_model=SourceOfFundsDeclaration)
async def declare_source_of_funds(
    transaction_id: str,
    primary_source: SourceOfFunds,
    primary_source_description: str,
    primary_source_amount: Decimal,
    employer_name: Optional[str] = None,
    employer_address: Optional[str] = None,
    job_title: Optional[str] = None,
    monthly_salary: Optional[Decimal] = None,
    business_name: Optional[str] = None,
    business_registration_number: Optional[str] = None,
    lender_name: Optional[str] = None,
    loan_amount: Optional[Decimal] = None,
    donor_name: Optional[str] = None,
    donor_relationship: Optional[str] = None
):
    """Declare source of funds for property purchase"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    sof = SourceOfFundsDeclaration(
        transaction_id=transaction_id,
        primary_source=primary_source,
        primary_source_description=primary_source_description,
        primary_source_amount=primary_source_amount,
        employer_name=employer_name,
        employer_address=employer_address,
        job_title=job_title,
        monthly_salary=monthly_salary,
        business_name=business_name,
        business_registration_number=business_registration_number,
        lender_name=lender_name,
        loan_amount=loan_amount,
        donor_name=donor_name,
        donor_relationship=donor_relationship
    )
    
    # Add risk flags based on source
    if primary_source == SourceOfFunds.GIFT:
        sof.risk_flags.append("gift_requires_donor_verification")
    if primary_source == SourceOfFunds.OTHER:
        sof.risk_flags.append("unspecified_source_requires_review")
    
    source_of_funds_db[sof.id] = sof
    
    # Update transaction
    transaction = transactions_db[transaction_id]
    transaction.source_of_funds_id = sof.id
    transaction.updated_at = datetime.utcnow()
    
    return sof


@router.put("/source-of-funds/{sof_id}/verify")
async def verify_source_of_funds(
    sof_id: str,
    status: VerificationStatus,
    reviewer_id: str,
    notes: Optional[str] = None
):
    """Verify source of funds declaration"""
    if sof_id not in source_of_funds_db:
        raise HTTPException(status_code=404, detail="Source of funds declaration not found")
    
    sof = source_of_funds_db[sof_id]
    sof.status = status
    sof.reviewer_notes = notes
    
    # Update transaction
    for tx in transactions_db.values():
        if tx.source_of_funds_id == sof_id:
            tx.source_of_funds_verified = (status == VerificationStatus.APPROVED)
            tx.updated_at = datetime.utcnow()
            break
    
    return {"status": "verified", "sof_id": sof_id, "verification_status": status}


# --- Bank Statement Endpoints ---

@router.post("/transactions/{transaction_id}/bank-statements", response_model=BankStatement)
async def upload_bank_statement(
    transaction_id: str,
    party_id: str,
    bank_name: str,
    account_number: str,
    account_holder_name: str,
    statement_start_date: date,
    statement_end_date: date,
    document_url: str,
    opening_balance: Optional[Decimal] = None,
    closing_balance: Optional[Decimal] = None
):
    """Upload a bank statement"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Mask account number (keep last 4 digits)
    masked_account = f"****{account_number[-4:]}" if len(account_number) >= 4 else account_number
    
    statement = BankStatement(
        transaction_id=transaction_id,
        party_id=party_id,
        bank_name=bank_name,
        account_number=masked_account,
        account_holder_name=account_holder_name,
        statement_start_date=statement_start_date,
        statement_end_date=statement_end_date,
        document_url=document_url,
        opening_balance=opening_balance,
        closing_balance=closing_balance
    )
    
    bank_statements_db[statement.id] = statement
    
    # Update transaction
    transaction = transactions_db[transaction_id]
    transaction.bank_statement_ids.append(statement.id)
    transaction.updated_at = datetime.utcnow()
    
    # Check if 3-month coverage is met
    all_statements = [bank_statements_db[sid] for sid in transaction.bank_statement_ids]
    coverage = validate_bank_statements_coverage(all_statements)
    transaction.bank_statements_cover_3_months = coverage["valid"]
    
    return statement


@router.get("/transactions/{transaction_id}/bank-statements/validate")
async def validate_bank_statements(transaction_id: str):
    """Validate bank statements coverage for a transaction"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    statements = [bank_statements_db[sid] for sid in transaction.bank_statement_ids if sid in bank_statements_db]
    
    return validate_bank_statements_coverage(statements)


# --- Income Document Endpoints ---

@router.post("/transactions/{transaction_id}/income-documents", response_model=IncomeDocument)
async def upload_income_document(
    transaction_id: str,
    party_id: str,
    document_type: IncomeDocumentType,
    document_url: str,
    tax_year: Optional[int] = None,
    employer_name: Optional[str] = None,
    gross_income: Optional[Decimal] = None,
    net_income: Optional[Decimal] = None
):
    """Upload an income verification document (W-2, PAYE, payslip, etc.)"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    doc = IncomeDocument(
        transaction_id=transaction_id,
        party_id=party_id,
        document_type=document_type,
        document_url=document_url,
        tax_year=tax_year,
        employer_name=employer_name,
        gross_income=gross_income,
        net_income=net_income
    )
    
    income_documents_db[doc.id] = doc
    
    # Update transaction
    transaction = transactions_db[transaction_id]
    transaction.income_document_ids.append(doc.id)
    transaction.updated_at = datetime.utcnow()
    
    return doc


@router.put("/income-documents/{doc_id}/verify")
async def verify_income_document(
    doc_id: str,
    status: VerificationStatus,
    reviewer_id: str
):
    """Verify income document"""
    if doc_id not in income_documents_db:
        raise HTTPException(status_code=404, detail="Income document not found")
    
    doc = income_documents_db[doc_id]
    doc.status = status
    doc.verified_at = datetime.utcnow()
    doc.verified_by = reviewer_id
    
    # Update transaction income verification status
    for tx in transactions_db.values():
        if doc_id in tx.income_document_ids:
            # Check if all income docs are verified
            all_verified = all(
                income_documents_db[did].status == VerificationStatus.APPROVED
                for did in tx.income_document_ids
                if did in income_documents_db
            )
            tx.income_verified = all_verified
            tx.updated_at = datetime.utcnow()
            break
    
    return {"status": "verified", "doc_id": doc_id, "verification_status": status}


# --- Purchase Agreement Endpoints ---

@router.post("/transactions/{transaction_id}/purchase-agreement", response_model=PurchaseAgreement)
async def upload_purchase_agreement(
    transaction_id: str,
    document_url: str,
    buyer_name: str,
    buyer_address: str,
    seller_name: str,
    seller_address: str,
    property_address: str,
    property_description: str,
    property_type: str,
    purchase_price: Decimal,
    currency: str = "NGN",
    buyer_signed: bool = False,
    buyer_signature_date: Optional[date] = None,
    seller_signed: bool = False,
    seller_signature_date: Optional[date] = None,
    witness_signed: bool = False,
    completion_date: Optional[date] = None
):
    """Upload purchase agreement document"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    
    agreement = PurchaseAgreement(
        transaction_id=transaction_id,
        document_url=document_url,
        buyer_name=buyer_name,
        buyer_address=buyer_address,
        seller_name=seller_name,
        seller_address=seller_address,
        property_address=property_address,
        property_description=property_description,
        property_type=property_type,
        purchase_price=purchase_price,
        currency=currency,
        buyer_signed=buyer_signed,
        buyer_signature_date=buyer_signature_date,
        seller_signed=seller_signed,
        seller_signature_date=seller_signature_date,
        witness_signed=witness_signed,
        completion_date=completion_date
    )
    
    # Validate price matches transaction
    agreement.price_matches_transaction = (purchase_price == transaction.purchase_price)
    
    purchase_agreements_db[agreement.id] = agreement
    
    # Update transaction
    transaction.purchase_agreement_id = agreement.id
    transaction.updated_at = datetime.utcnow()
    
    return agreement


@router.get("/purchase-agreements/{agreement_id}/validate")
async def validate_purchase_agreement(agreement_id: str):
    """Validate purchase agreement against KYC records"""
    if agreement_id not in purchase_agreements_db:
        raise HTTPException(status_code=404, detail="Purchase agreement not found")
    
    agreement = purchase_agreements_db[agreement_id]
    transaction = transactions_db.get(agreement.transaction_id)
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    buyer = parties_db.get(transaction.buyer_id)
    seller = parties_db.get(transaction.seller_id)
    
    if not buyer:
        raise HTTPException(status_code=400, detail="Buyer KYC not found")
    if not seller:
        raise HTTPException(status_code=400, detail="Seller KYC not found")
    
    validation = validate_purchase_agreement_parties(agreement, buyer, seller)
    
    # Update agreement with validation results
    agreement.buyer_info_matches_kyc = validation["buyer_name_match"]
    agreement.seller_info_matches_kyc = validation["seller_name_match"]
    
    return validation


@router.put("/purchase-agreements/{agreement_id}/verify")
async def verify_purchase_agreement(
    agreement_id: str,
    status: VerificationStatus,
    reviewer_id: str,
    rejection_reason: Optional[str] = None
):
    """Verify purchase agreement"""
    if agreement_id not in purchase_agreements_db:
        raise HTTPException(status_code=404, detail="Purchase agreement not found")
    
    agreement = purchase_agreements_db[agreement_id]
    agreement.status = status
    agreement.verified_at = datetime.utcnow()
    agreement.verified_by = reviewer_id
    
    if status == VerificationStatus.REJECTED:
        agreement.rejection_reason = rejection_reason
    
    # Update transaction
    for tx in transactions_db.values():
        if tx.purchase_agreement_id == agreement_id:
            tx.purchase_agreement_verified = (status == VerificationStatus.APPROVED)
            tx.updated_at = datetime.utcnow()
            break
    
    return {"status": "verified", "agreement_id": agreement_id, "verification_status": status}


# --- Transaction Status Endpoints ---

@router.get("/transactions/{transaction_id}/checklist")
async def get_transaction_checklist(transaction_id: str):
    """Get KYC checklist status for a property transaction"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    buyer = parties_db.get(transaction.buyer_id)
    seller = parties_db.get(transaction.seller_id) if transaction.seller_id else None
    
    checklist = {
        "transaction_id": transaction_id,
        "reference_number": transaction.reference_number,
        "status": transaction.status,
        "requirements": {
            "buyer_government_id": {
                "required": True,
                "status": "complete" if buyer and buyer.kyc_status == VerificationStatus.APPROVED else "pending",
                "description": "Government issued ID of buyer"
            },
            "seller_government_id": {
                "required": True,
                "status": "complete" if seller and seller.kyc_status == VerificationStatus.APPROVED else "pending",
                "description": "Government issued ID of seller (counterparty)"
            },
            "source_of_funds": {
                "required": True,
                "status": "complete" if transaction.source_of_funds_verified else "pending",
                "description": "Declaration and verification of source of funds"
            },
            "bank_statements_3_months": {
                "required": True,
                "status": "complete" if transaction.bank_statements_cover_3_months and transaction.bank_statements_verified else "pending",
                "description": "Three months of bank statements showing regular income"
            },
            "income_document": {
                "required": True,
                "status": "complete" if transaction.income_verified else "pending",
                "description": "W-2, PAYE, or similar income verification document"
            },
            "purchase_agreement": {
                "required": True,
                "status": "complete" if transaction.purchase_agreement_verified else "pending",
                "description": "Signed purchase agreement with buyer/seller info, property details, transaction terms"
            }
        },
        "compliance_checks": {
            "aml_check": transaction.aml_check_passed,
            "sanctions_check": transaction.sanctions_check_passed,
            "pep_check": transaction.pep_check_passed
        },
        "risk_assessment": {
            "risk_score": transaction.risk_score,
            "risk_flags": transaction.risk_flags
        },
        "ready_for_approval": all([
            buyer and buyer.kyc_status == VerificationStatus.APPROVED,
            seller and seller.kyc_status == VerificationStatus.APPROVED,
            transaction.source_of_funds_verified,
            transaction.bank_statements_cover_3_months,
            transaction.income_verified,
            transaction.purchase_agreement_verified
        ])
    }
    
    return checklist


@router.put("/transactions/{transaction_id}/submit-for-review")
async def submit_for_review(transaction_id: str):
    """Submit transaction for compliance review"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    
    # Calculate risk score
    calculate_risk_score(transaction)
    
    transaction.status = TransactionStatus.UNDER_REVIEW
    transaction.updated_at = datetime.utcnow()
    transaction.status_history.append({
        "status": TransactionStatus.UNDER_REVIEW.value,
        "timestamp": datetime.utcnow().isoformat(),
        "note": "Submitted for compliance review"
    })
    
    return {
        "status": "submitted",
        "transaction_id": transaction_id,
        "risk_score": transaction.risk_score,
        "risk_flags": transaction.risk_flags
    }


@router.put("/transactions/{transaction_id}/approve")
async def approve_transaction(
    transaction_id: str,
    reviewer_id: str,
    notes: Optional[str] = None
):
    """Approve property transaction after all KYC requirements are met"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    
    # Verify all requirements are met
    checklist = await get_transaction_checklist(transaction_id)
    if not checklist["ready_for_approval"]:
        raise HTTPException(
            status_code=400,
            detail="Not all KYC requirements are met",
            headers={"X-Missing-Requirements": str([
                k for k, v in checklist["requirements"].items()
                if v["status"] != "complete"
            ])}
        )
    
    transaction.status = TransactionStatus.APPROVED
    transaction.approved_at = datetime.utcnow()
    transaction.updated_at = datetime.utcnow()
    transaction.reviewer_notes.append({
        "reviewer_id": reviewer_id,
        "timestamp": datetime.utcnow().isoformat(),
        "action": "approved",
        "notes": notes
    })
    transaction.status_history.append({
        "status": TransactionStatus.APPROVED.value,
        "timestamp": datetime.utcnow().isoformat(),
        "note": f"Approved by {reviewer_id}"
    })
    
    return {
        "status": "approved",
        "transaction_id": transaction_id,
        "reference_number": transaction.reference_number,
        "approved_at": transaction.approved_at.isoformat()
    }


@router.put("/transactions/{transaction_id}/reject")
async def reject_transaction(
    transaction_id: str,
    reviewer_id: str,
    reason: str
):
    """Reject property transaction"""
    if transaction_id not in transactions_db:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = transactions_db[transaction_id]
    transaction.status = TransactionStatus.REJECTED
    transaction.updated_at = datetime.utcnow()
    transaction.reviewer_notes.append({
        "reviewer_id": reviewer_id,
        "timestamp": datetime.utcnow().isoformat(),
        "action": "rejected",
        "reason": reason
    })
    transaction.status_history.append({
        "status": TransactionStatus.REJECTED.value,
        "timestamp": datetime.utcnow().isoformat(),
        "note": f"Rejected by {reviewer_id}: {reason}"
    })
    
    return {
        "status": "rejected",
        "transaction_id": transaction_id,
        "reason": reason
    }


# --- Flow Documentation Endpoint ---

@router.get("/flow-documentation")
async def get_flow_documentation():
    """Get documentation of the property transaction KYC flow"""
    return {
        "title": "Property Transaction KYC Flow",
        "description": "Complete KYC flow for high-value property transactions",
        "flow_steps": [
            {
                "step": 1,
                "name": "Initiate Transaction",
                "endpoint": "POST /property-kyc/transactions",
                "description": "Buyer initiates property purchase transaction",
                "required_data": ["buyer_id", "property_type", "property_address", "purchase_price"]
            },
            {
                "step": 2,
                "name": "Buyer KYC",
                "endpoint": "POST /property-kyc/parties + PUT /property-kyc/parties/{id}/verify",
                "description": "Buyer completes KYC with government-issued ID",
                "required_documents": ["Government ID (passport, national ID, driver's license)", "Selfie/Liveness check", "BVN verification (Nigeria)"]
            },
            {
                "step": 3,
                "name": "Add Seller",
                "endpoint": "PUT /property-kyc/transactions/{id}/add-seller",
                "description": "Add seller to transaction"
            },
            {
                "step": 4,
                "name": "Seller KYC",
                "endpoint": "POST /property-kyc/parties + PUT /property-kyc/parties/{id}/verify",
                "description": "Seller completes KYC with government-issued ID (closed loop verification)",
                "required_documents": ["Government ID", "Proof of property ownership"]
            },
            {
                "step": 5,
                "name": "Source of Funds Declaration",
                "endpoint": "POST /property-kyc/transactions/{id}/source-of-funds",
                "description": "Buyer declares source of funds for purchase",
                "options": ["Employment income", "Business income", "Savings", "Sale of property", "Inheritance", "Gift", "Loan"]
            },
            {
                "step": 6,
                "name": "Bank Statements Upload",
                "endpoint": "POST /property-kyc/transactions/{id}/bank-statements",
                "description": "Upload 3 months of bank statements",
                "validation": "System validates statements cover at least 90 days and are within last 6 months"
            },
            {
                "step": 7,
                "name": "Income Document Upload",
                "endpoint": "POST /property-kyc/transactions/{id}/income-documents",
                "description": "Upload W-2, PAYE records, or similar income verification",
                "document_types": ["W-2 Form", "PAYE Record", "Tax Return", "Payslip", "Employment Letter"]
            },
            {
                "step": 8,
                "name": "Purchase Agreement Upload",
                "endpoint": "POST /property-kyc/transactions/{id}/purchase-agreement",
                "description": "Upload signed purchase agreement",
                "required_elements": [
                    "Buyer name and address (must match KYC)",
                    "Seller name and address (must match KYC)",
                    "Property details (address, description, type)",
                    "Transaction terms (price, currency, completion date)",
                    "Signatures from both parties",
                    "Date of signing"
                ]
            },
            {
                "step": 9,
                "name": "Validation",
                "endpoints": [
                    "GET /property-kyc/transactions/{id}/bank-statements/validate",
                    "GET /property-kyc/purchase-agreements/{id}/validate"
                ],
                "description": "System validates all documents and cross-references party information"
            },
            {
                "step": 10,
                "name": "Submit for Review",
                "endpoint": "PUT /property-kyc/transactions/{id}/submit-for-review",
                "description": "Submit complete transaction for compliance review",
                "includes": ["Risk score calculation", "AML/Sanctions/PEP checks"]
            },
            {
                "step": 11,
                "name": "Compliance Review",
                "endpoint": "GET /property-kyc/transactions/{id}/checklist",
                "description": "Compliance officer reviews all KYC requirements",
                "reviewer_actions": ["Verify documents", "Check risk flags", "Approve/Reject"]
            },
            {
                "step": 12,
                "name": "Approval/Rejection",
                "endpoints": [
                    "PUT /property-kyc/transactions/{id}/approve",
                    "PUT /property-kyc/transactions/{id}/reject"
                ],
                "description": "Final decision on transaction"
            }
        ],
        "nigeria_specific": {
            "payment_flow": "In Nigeria, property payments can be P2P (direct to seller) or via escrow (title company/lawyer). This platform supports both models.",
            "identity_documents": ["BVN (Bank Verification Number)", "NIN (National Identification Number)", "International Passport", "Driver's License", "Voter's Card"],
            "property_documents": ["Certificate of Occupancy (C of O)", "Deed of Assignment", "Governor's Consent", "Survey Plan"]
        },
        "closed_loop_ecosystem": {
            "description": "This platform creates a closed loop ecosystem where BOTH buyer and seller identities are verified before high-value property payments can proceed.",
            "benefits": [
                "Reduces fraud risk by verifying both parties",
                "Creates audit trail for regulatory compliance",
                "Enables bank-grade KYC for property transactions",
                "Supports AML/CFT requirements"
            ]
        }
    }
