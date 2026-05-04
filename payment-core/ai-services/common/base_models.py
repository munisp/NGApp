"""
Base data models for the AI/ML integration services.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, validator

class PlatformType(str, Enum):
    """Type of banking platform."""
    
    AGENT_BANKING = "agent_banking"
    NEOBANK = "neobank"
    CORE_BANKING = "core_banking"
    PAYMENT_PROCESSING = "payment_processing"
    CRM = "crm"

class EventType(str, Enum):
    """Type of banking event."""
    
    # Customer events
    CUSTOMER_CREATED = "customer_created"
    CUSTOMER_UPDATED = "customer_updated"
    CUSTOMER_DELETED = "customer_deleted"
    CUSTOMER_MERGED = "customer_merged"
    CUSTOMER_VERIFIED = "customer_verified"
    CUSTOMER_KYC_UPDATED = "customer_kyc_updated"
    CUSTOMER_RISK_UPDATED = "customer_risk_updated"
    CUSTOMER_SEGMENT_UPDATED = "customer_segment_updated"
    CUSTOMER_PREFERENCES_UPDATED = "customer_preferences_updated"
    
    # Account events
    ACCOUNT_CREATED = "account_created"
    ACCOUNT_UPDATED = "account_updated"
    ACCOUNT_CLOSED = "account_closed"
    ACCOUNT_BLOCKED = "account_blocked"
    ACCOUNT_UNBLOCKED = "account_unblocked"
    ACCOUNT_BALANCE_UPDATED = "account_balance_updated"
    ACCOUNT_LIMIT_UPDATED = "account_limit_updated"
    
    # Transaction events
    TRANSACTION_CREATED = "transaction_created"
    TRANSACTION_UPDATED = "transaction_updated"
    TRANSACTION_DELETED = "transaction_deleted"
    TRANSACTION_APPROVED = "transaction_approved"
    TRANSACTION_DECLINED = "transaction_declined"
    TRANSACTION_DISPUTED = "transaction_disputed"
    TRANSACTION_REFUNDED = "transaction_refunded"
    
    # Product events
    PRODUCT_PURCHASED = "product_purchased"
    PRODUCT_ACTIVATED = "product_activated"
    PRODUCT_DEACTIVATED = "product_deactivated"
    PRODUCT_RENEWED = "product_renewed"
    PRODUCT_CANCELLED = "product_cancelled"
    
    # Interaction events
    INTERACTION_STARTED = "interaction_started"
    INTERACTION_COMPLETED = "interaction_completed"
    INTERACTION_ABANDONED = "interaction_abandoned"
    INTERACTION_FEEDBACK = "interaction_feedback"
    
    # Campaign events
    CAMPAIGN_IMPRESSION = "campaign_impression"
    CAMPAIGN_CLICK = "campaign_click"
    CAMPAIGN_CONVERSION = "campaign_conversion"
    CAMPAIGN_REJECTED = "campaign_rejected"
    
    # Fraud events
    FRAUD_ALERT = "fraud_alert"
    FRAUD_CONFIRMED = "fraud_confirmed"
    FRAUD_CLEARED = "fraud_cleared"
    FRAUD_REPORTED = "fraud_reported"
    
    # Agent events
    AGENT_CREATED = "agent_created"
    AGENT_UPDATED = "agent_updated"
    AGENT_DELETED = "agent_deleted"
    AGENT_ACTIVATED = "agent_activated"
    AGENT_DEACTIVATED = "agent_deactivated"
    AGENT_LOCATION_UPDATED = "agent_location_updated"
    AGENT_PERFORMANCE_UPDATED = "agent_performance_updated"

class LanguageCode(str, Enum):
    """Language code for multi-lingual support."""
    
    ENGLISH = "en"
    HAUSA = "ha"
    YORUBA = "yo"
    IGBO = "ig"
    PIDGIN = "pcm"

class RiskLevel(str, Enum):
    """Risk level for customers and transactions."""
    
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"

class CustomerSegment(str, Enum):
    """Customer segment."""
    
    MASS = "mass"
    MASS_AFFLUENT = "mass_affluent"
    AFFLUENT = "affluent"
    HIGH_NET_WORTH = "high_net_worth"
    ULTRA_HIGH_NET_WORTH = "ultra_high_net_worth"
    SMALL_BUSINESS = "small_business"
    MEDIUM_BUSINESS = "medium_business"
    LARGE_BUSINESS = "large_business"
    GOVERNMENT = "government"
    NON_PROFIT = "non_profit"

class KYCStatus(str, Enum):
    """KYC status."""
    
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"

class TransactionStatus(str, Enum):
    """Transaction status."""
    
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"
    FAILED = "failed"
    REVERSED = "reversed"
    REFUNDED = "refunded"
    SETTLED = "settled"
    DISPUTED = "disputed"

class TransactionType(str, Enum):
    """Transaction type."""
    
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER = "transfer"
    PAYMENT = "payment"
    PURCHASE = "purchase"
    REFUND = "refund"
    FEE = "fee"
    INTEREST = "interest"
    ADJUSTMENT = "adjustment"
    LOAN_DISBURSEMENT = "loan_disbursement"
    LOAN_REPAYMENT = "loan_repayment"

class AccountType(str, Enum):
    """Account type."""
    
    SAVINGS = "savings"
    CURRENT = "current"
    FIXED_DEPOSIT = "fixed_deposit"
    LOAN = "loan"
    CREDIT_CARD = "credit_card"
    WALLET = "wallet"
    INVESTMENT = "investment"
    PENSION = "pension"
    INSURANCE = "insurance"

class ProductCategory(str, Enum):
    """Product category."""
    
    ACCOUNT = "account"
    LOAN = "loan"
    CARD = "card"
    INVESTMENT = "investment"
    INSURANCE = "insurance"
    PAYMENT = "payment"
    DIGITAL = "digital"

class InteractionChannel(str, Enum):
    """Interaction channel."""
    
    BRANCH = "branch"
    ATM = "atm"
    AGENT = "agent"
    INTERNET = "internet"
    MOBILE = "mobile"
    USSD = "ussd"
    CALL_CENTER = "call_center"
    SOCIAL_MEDIA = "social_media"
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    CHATBOT = "chatbot"
    POS = "pos"

class FraudType(str, Enum):
    """Fraud type."""
    
    ACCOUNT_TAKEOVER = "account_takeover"
    IDENTITY_THEFT = "identity_theft"
    CARD_FRAUD = "card_fraud"
    TRANSACTION_FRAUD = "transaction_fraud"
    APPLICATION_FRAUD = "application_fraud"
    INTERNAL_FRAUD = "internal_fraud"
    MONEY_LAUNDERING = "money_laundering"
    TERRORIST_FINANCING = "terrorist_financing"

class BaseEvent(BaseModel):
    """Base event model."""
    
    id: UUID = Field(default_factory=uuid4)
    event_type: EventType
    platform_type: PlatformType
    platform_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    source_system: str
    version: str = "1.0"
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerIdentifier(BaseModel):
    """Customer identifier model."""
    
    customer_id: str
    platform_type: PlatformType
    platform_id: str
    external_ids: Dict[str, str] = Field(default_factory=dict)

class Address(BaseModel):
    """Address model."""
    
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    address_type: Optional[str] = None
    is_primary: bool = False
    is_verified: bool = False
    verification_date: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ContactInfo(BaseModel):
    """Contact information model."""
    
    email: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    addresses: List[Address] = Field(default_factory=list)
    preferred_contact_method: Optional[str] = None
    preferred_language: Optional[LanguageCode] = LanguageCode.ENGLISH
    do_not_contact: bool = False

class IdentificationDocument(BaseModel):
    """Identification document model."""
    
    document_type: str
    document_number: str
    issuing_country: str
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_verified: bool = False
    verification_date: Optional[datetime] = None
    verification_method: Optional[str] = None
    document_image_url: Optional[str] = None

class PersonalInfo(BaseModel):
    """Personal information model."""
    
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    employer: Optional[str] = None
    identification_documents: List[IdentificationDocument] = Field(default_factory=list)

class CustomerPreferences(BaseModel):
    """Customer preferences model."""
    
    preferred_language: LanguageCode = LanguageCode.ENGLISH
    communication_preferences: Dict[str, bool] = Field(default_factory=dict)
    marketing_consent: bool = False
    product_interests: List[str] = Field(default_factory=list)
    preferred_channels: List[InteractionChannel] = Field(default_factory=list)
    notification_settings: Dict[str, bool] = Field(default_factory=dict)

class RiskProfile(BaseModel):
    """Risk profile model."""
    
    risk_level: RiskLevel = RiskLevel.MEDIUM
    risk_score: float = 50.0
    risk_factors: List[str] = Field(default_factory=list)
    last_assessment_date: Optional[datetime] = None
    next_assessment_date: Optional[datetime] = None
    is_politically_exposed: bool = False
    is_sanctioned: bool = False
    is_high_risk_country: bool = False
    is_high_risk_industry: bool = False
    aml_status: Optional[str] = None
    fraud_status: Optional[str] = None

class CustomerProfile(BaseModel):
    """Customer profile model."""
    
    customer_id: str
    platform_type: PlatformType
    platform_id: str
    external_ids: Dict[str, str] = Field(default_factory=dict)
    personal_info: PersonalInfo
    contact_info: ContactInfo
    kyc_status: KYCStatus = KYCStatus.NOT_STARTED
    kyc_expiry_date: Optional[datetime] = None
    segment: CustomerSegment = CustomerSegment.MASS
    risk_profile: RiskProfile = Field(default_factory=RiskProfile)
    preferences: CustomerPreferences = Field(default_factory=CustomerPreferences)
    lifetime_value: float = 0.0
    acquisition_channel: Optional[InteractionChannel] = None
    acquisition_date: Optional[datetime] = None
    acquisition_campaign: Optional[str] = None
    last_activity_date: Optional[datetime] = None
    is_active: bool = True
    status: str = "active"
    tags: List[str] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerEvent(BaseEvent):
    """Customer event model."""
    
    customer_id: str
    event_data: Dict[str, Any] = Field(default_factory=dict)
    customer_profile: Optional[CustomerProfile] = None

class AccountEvent(BaseEvent):
    """Account event model."""
    
    account_id: str
    customer_id: str
    event_data: Dict[str, Any] = Field(default_factory=dict)

class TransactionEvent(BaseEvent):
    """Transaction event model."""
    
    transaction_id: str
    account_id: str
    customer_id: str
    transaction_type: TransactionType
    amount: float
    currency: str
    status: TransactionStatus
    event_data: Dict[str, Any] = Field(default_factory=dict)

class ProductEvent(BaseEvent):
    """Product event model."""
    
    product_id: str
    customer_id: str
    product_category: ProductCategory
    event_data: Dict[str, Any] = Field(default_factory=dict)

class InteractionEvent(BaseEvent):
    """Interaction event model."""
    
    interaction_id: str
    customer_id: str
    channel: InteractionChannel
    duration: Optional[int] = None
    event_data: Dict[str, Any] = Field(default_factory=dict)

class CampaignEvent(BaseEvent):
    """Campaign event model."""
    
    campaign_id: str
    customer_id: str
    channel: InteractionChannel
    event_data: Dict[str, Any] = Field(default_factory=dict)

class FraudEvent(BaseEvent):
    """Fraud event model."""
    
    alert_id: str
    customer_id: Optional[str] = None
    account_id: Optional[str] = None
    transaction_id: Optional[str] = None
    fraud_type: FraudType
    risk_score: float
    event_data: Dict[str, Any] = Field(default_factory=dict)

class AgentEvent(BaseEvent):
    """Agent event model."""
    
    agent_id: str
    event_data: Dict[str, Any] = Field(default_factory=dict)

class CustomerProfileUpdate(BaseModel):
    """Customer profile update model."""
    
    customer_id: str
    platform_type: PlatformType
    platform_id: str
    update_type: str
    update_data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    source_system: str
    version: str = "1.0"
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerInsight(BaseModel):
    """Customer insight model."""
    
    customer_id: str
    insight_type: str
    insight_value: Any
    confidence: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerRecommendation(BaseModel):
    """Customer recommendation model."""
    
    customer_id: str
    recommendation_type: str
    recommendation_id: str
    product_id: Optional[str] = None
    campaign_id: Optional[str] = None
    score: float
    reason: str
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_to: Optional[datetime] = None
    is_presented: bool = False
    is_accepted: Optional[bool] = None
    presentation_timestamp: Optional[datetime] = None
    response_timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerSegmentationResult(BaseModel):
    """Customer segmentation result model."""
    
    customer_id: str
    segment: CustomerSegment
    previous_segment: Optional[CustomerSegment] = None
    confidence: float
    segment_change_reason: Optional[str] = None
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    effective_to: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RiskAssessmentResult(BaseModel):
    """Risk assessment result model."""
    
    customer_id: str
    risk_level: RiskLevel
    previous_risk_level: Optional[RiskLevel] = None
    risk_score: float
    previous_risk_score: Optional[float] = None
    risk_factors: List[Dict[str, Any]] = Field(default_factory=list)
    assessment_timestamp: datetime = Field(default_factory=datetime.utcnow)
    next_assessment_due: Optional[datetime] = None
    assessor: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class FraudDetectionResult(BaseModel):
    """Fraud detection result model."""
    
    alert_id: str
    customer_id: Optional[str] = None
    account_id: Optional[str] = None
    transaction_id: Optional[str] = None
    fraud_type: FraudType
    risk_score: float
    is_fraud: bool
    confidence: float
    detection_timestamp: datetime = Field(default_factory=datetime.utcnow)
    detection_model: str
    detection_rules: List[str] = Field(default_factory=list)
    alert_status: str = "new"
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerLifetimeValueResult(BaseModel):
    """Customer lifetime value result model."""
    
    customer_id: str
    lifetime_value: float
    previous_lifetime_value: Optional[float] = None
    prediction_horizon: str
    confidence: float
    contributing_factors: List[Dict[str, Any]] = Field(default_factory=list)
    calculation_timestamp: datetime = Field(default_factory=datetime.utcnow)
    calculation_model: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ChurnPredictionResult(BaseModel):
    """Churn prediction result model."""
    
    customer_id: str
    churn_probability: float
    churn_risk_level: str
    prediction_horizon: str
    confidence: float
    contributing_factors: List[Dict[str, Any]] = Field(default_factory=list)
    prediction_timestamp: datetime = Field(default_factory=datetime.utcnow)
    prediction_model: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class NextBestActionResult(BaseModel):
    """Next best action result model."""
    
    customer_id: str
    action_id: str
    action_type: str
    action_description: str
    priority: int
    score: float
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_to: Optional[datetime] = None
    channels: List[InteractionChannel] = Field(default_factory=list)
    is_executed: bool = False
    execution_timestamp: Optional[datetime] = None
    execution_result: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerJourneyEvent(BaseModel):
    """Customer journey event model."""
    
    customer_id: str
    journey_id: str
    journey_name: str
    step_id: str
    step_name: str
    previous_step_id: Optional[str] = None
    event_timestamp: datetime = Field(default_factory=datetime.utcnow)
    channel: InteractionChannel
    is_milestone: bool = False
    duration_since_previous_step: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CustomerFeedback(BaseModel):
    """Customer feedback model."""
    
    customer_id: str
    feedback_id: str
    feedback_type: str
    feedback_channel: InteractionChannel
    rating: Optional[int] = None
    comments: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    feedback_timestamp: datetime = Field(default_factory=datetime.utcnow)
    related_product_id: Optional[str] = None
    related_service_id: Optional[str] = None
    related_interaction_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AIModelMetadata(BaseModel):
    """AI model metadata model."""
    
    model_id: str
    model_name: str
    model_version: str
    model_type: str
    training_timestamp: datetime
    last_evaluation_timestamp: Optional[datetime] = None
    performance_metrics: Dict[str, float] = Field(default_factory=dict)
    feature_importance: Dict[str, float] = Field(default_factory=dict)
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AIModelPrediction(BaseModel):
    """AI model prediction model."""
    
    prediction_id: str
    model_id: str
    entity_id: str
    entity_type: str
    prediction_type: str
    prediction_value: Any
    prediction_probability: float
    prediction_timestamp: datetime = Field(default_factory=datetime.utcnow)
    features: Dict[str, Any] = Field(default_factory=dict)
    explanation: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GraphNode(BaseModel):
    """Graph node model."""
    
    node_id: str
    node_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GraphEdge(BaseModel):
    """Graph edge model."""
    
    edge_id: str
    edge_type: str
    source_id: str
    target_id: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GraphQuery(BaseModel):
    """Graph query model."""
    
    query_id: str
    query_type: str
    query_text: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result_limit: int = 100
    timeout: int = 30
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GraphQueryResult(BaseModel):
    """Graph query result model."""
    
    query_id: str
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    execution_time: float
    is_complete: bool = True
    has_more: bool = False
    next_page_token: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeGraphQuestion(BaseModel):
    """Knowledge graph question model."""
    
    question_id: str
    question_text: str
    language: LanguageCode = LanguageCode.ENGLISH
    context: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeGraphAnswer(BaseModel):
    """Knowledge graph answer model."""
    
    question_id: str
    answer_text: str
    confidence: float
    supporting_facts: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

class EmbeddingVector(BaseModel):
    """Embedding vector model."""
    
    entity_id: str
    entity_type: str
    vector: List[float]
    model_id: str
    dimension: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class VectorSearchQuery(BaseModel):
    """Vector search query model."""
    
    query_id: str
    query_vector: Optional[List[float]] = None
    query_text: Optional[str] = None
    entity_type: Optional[str] = None
    top_k: int = 10
    min_score: float = 0.0
    filters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class VectorSearchResult(BaseModel):
    """Vector search result model."""
    
    query_id: str
    results: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

class APIRequest(BaseModel):
    """API request model."""
    
    request_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    client_id: str
    endpoint: str
    method: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class APIResponse(BaseModel):
    """API response model."""
    
    request_id: UUID
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str
    status_code: int
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    execution_time: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

