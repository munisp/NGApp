package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Customer represents a customer entity
type Customer struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ExternalID        string                 `json:"external_id" gorm:"uniqueIndex;not null"`
	CustomerNumber    string                 `json:"customer_number" gorm:"uniqueIndex;not null"`
	FirstName         string                 `json:"first_name" gorm:"not null"`
	LastName          string                 `json:"last_name" gorm:"not null"`
	MiddleName        string                 `json:"middle_name"`
	Email             string                 `json:"email" gorm:"uniqueIndex;not null"`
	Phone             string                 `json:"phone" gorm:"index"`
	AlternatePhone    string                 `json:"alternate_phone"`
	DateOfBirth       *time.Time             `json:"date_of_birth"`
	Gender            string                 `json:"gender" gorm:"type:varchar(10)"`
	MaritalStatus     string                 `json:"marital_status" gorm:"type:varchar(20)"`
	Nationality       string                 `json:"nationality"`
	PreferredLanguage string                 `json:"preferred_language" gorm:"default:'en'"`
	Status            CustomerStatus         `json:"status" gorm:"type:varchar(20);default:'active'"`
	Tier              CustomerTier           `json:"tier" gorm:"type:varchar(20);default:'bronze'"`
	Source            string                 `json:"source" gorm:"type:varchar(50)"`
	ReferredBy        *uuid.UUID             `json:"referred_by" gorm:"type:uuid"`
	KYCStatus         KYCStatus              `json:"kyc_status" gorm:"type:varchar(20);default:'pending'"`
	KYCCompletedAt    *time.Time             `json:"kyc_completed_at"`
	RiskScore         float64                `json:"risk_score" gorm:"default:0"`
	CreditScore       int                    `json:"credit_score" gorm:"default:0"`
	LifetimeValue     float64                `json:"lifetime_value" gorm:"default:0"`
	TotalSpent        float64                `json:"total_spent" gorm:"default:0"`
	LastActivityAt    *time.Time             `json:"last_activity_at"`
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	Metadata          map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Profile      CustomerProfile      `json:"profile" gorm:"foreignKey:CustomerID"`
	Addresses    []CustomerAddress    `json:"addresses" gorm:"foreignKey:CustomerID"`
	Interactions []CustomerInteraction `json:"interactions" gorm:"foreignKey:CustomerID"`
	Segments     []CustomerSegment    `json:"segments" gorm:"many2many:customer_segment_mappings;"`
	Preferences  CustomerPreferences  `json:"preferences" gorm:"foreignKey:CustomerID"`
}

// CustomerStatus represents customer status enum
type CustomerStatus string

const (
	CustomerStatusActive    CustomerStatus = "active"
	CustomerStatusInactive  CustomerStatus = "inactive"
	CustomerStatusSuspended CustomerStatus = "suspended"
	CustomerStatusClosed    CustomerStatus = "closed"
)

// CustomerTier represents customer tier enum
type CustomerTier string

const (
	CustomerTierBronze   CustomerTier = "bronze"
	CustomerTierSilver   CustomerTier = "silver"
	CustomerTierGold     CustomerTier = "gold"
	CustomerTierPlatinum CustomerTier = "platinum"
	CustomerTierDiamond  CustomerTier = "diamond"
)

// KYCStatus represents KYC status enum
type KYCStatus string

const (
	KYCStatusPending   KYCStatus = "pending"
	KYCStatusInReview  KYCStatus = "in_review"
	KYCStatusApproved  KYCStatus = "approved"
	KYCStatusRejected  KYCStatus = "rejected"
	KYCStatusExpired   KYCStatus = "expired"
)

// CustomerProfile represents detailed customer profile information
type CustomerProfile struct {
	ID                  uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CustomerID          uuid.UUID              `json:"customer_id" gorm:"type:uuid;not null;index"`
	Occupation          string                 `json:"occupation"`
	Industry            string                 `json:"industry"`
	Company             string                 `json:"company"`
	JobTitle            string                 `json:"job_title"`
	AnnualIncome        float64                `json:"annual_income"`
	IncomeSource        string                 `json:"income_source"`
	Education           string                 `json:"education"`
	SocialSecurityNumber string                `json:"social_security_number" gorm:"encrypted"`
	TaxID               string                 `json:"tax_id" gorm:"encrypted"`
	PassportNumber      string                 `json:"passport_number" gorm:"encrypted"`
	DriversLicense      string                 `json:"drivers_license" gorm:"encrypted"`
	EmergencyContact    EmergencyContact       `json:"emergency_contact" gorm:"embedded"`
	ProfilePictureURL   string                 `json:"profile_picture_url"`
	Bio                 string                 `json:"bio"`
	Interests           []string               `json:"interests" gorm:"type:text[]"`
	SocialMediaProfiles map[string]string      `json:"social_media_profiles" gorm:"type:jsonb"`
	CustomFields        map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

// EmergencyContact represents emergency contact information
type EmergencyContact struct {
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
}

// CustomerAddress represents customer address information
type CustomerAddress struct {
	ID           uuid.UUID     `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CustomerID   uuid.UUID     `json:"customer_id" gorm:"type:uuid;not null;index"`
	Type         AddressType   `json:"type" gorm:"type:varchar(20);not null"`
	Label        string        `json:"label"`
	AddressLine1 string        `json:"address_line1" gorm:"not null"`
	AddressLine2 string        `json:"address_line2"`
	City         string        `json:"city" gorm:"not null"`
	State        string        `json:"state" gorm:"not null"`
	PostalCode   string        `json:"postal_code" gorm:"not null"`
	Country      string        `json:"country" gorm:"not null"`
	Latitude     float64       `json:"latitude"`
	Longitude    float64       `json:"longitude"`
	IsPrimary    bool          `json:"is_primary" gorm:"default:false"`
	IsVerified   bool          `json:"is_verified" gorm:"default:false"`
	VerifiedAt   *time.Time    `json:"verified_at"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// AddressType represents address type enum
type AddressType string

const (
	AddressTypeHome     AddressType = "home"
	AddressTypeWork     AddressType = "work"
	AddressTypeMailing  AddressType = "mailing"
	AddressTypeBilling  AddressType = "billing"
	AddressTypeShipping AddressType = "shipping"
	AddressTypeOther    AddressType = "other"
)

// CustomerInteraction represents customer interaction history
type CustomerInteraction struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CustomerID      uuid.UUID              `json:"customer_id" gorm:"type:uuid;not null;index"`
	Type            InteractionType        `json:"type" gorm:"type:varchar(30);not null"`
	Channel         InteractionChannel     `json:"channel" gorm:"type:varchar(20);not null"`
	Direction       InteractionDirection   `json:"direction" gorm:"type:varchar(10);not null"`
	Subject         string                 `json:"subject"`
	Description     string                 `json:"description"`
	Status          InteractionStatus      `json:"status" gorm:"type:varchar(20);default:'completed'"`
	Priority        InteractionPriority    `json:"priority" gorm:"type:varchar(10);default:'medium'"`
	Duration        int                    `json:"duration"` // in seconds
	AgentID         *uuid.UUID             `json:"agent_id" gorm:"type:uuid"`
	AgentName       string                 `json:"agent_name"`
	Department      string                 `json:"department"`
	Resolution      string                 `json:"resolution"`
	SatisfactionScore int                  `json:"satisfaction_score"` // 1-5 scale
	Tags            []string               `json:"tags" gorm:"type:text[]"`
	Attachments     []string               `json:"attachments" gorm:"type:text[]"`
	Metadata        map[string]interface{} `json:"metadata" gorm:"type:jsonb"`
	ScheduledAt     *time.Time             `json:"scheduled_at"`
	StartedAt       *time.Time             `json:"started_at"`
	CompletedAt     *time.Time             `json:"completed_at"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

// InteractionType represents interaction type enum
type InteractionType string

const (
	InteractionTypeCall         InteractionType = "call"
	InteractionTypeEmail        InteractionType = "email"
	InteractionTypeSMS          InteractionType = "sms"
	InteractionTypeChat         InteractionType = "chat"
	InteractionTypeMeeting      InteractionType = "meeting"
	InteractionTypeSupport      InteractionType = "support"
	InteractionTypeSales        InteractionType = "sales"
	InteractionTypeMarketing    InteractionType = "marketing"
	InteractionTypeComplaint    InteractionType = "complaint"
	InteractionTypeFeedback     InteractionType = "feedback"
	InteractionTypeOnboarding   InteractionType = "onboarding"
	InteractionTypeTransaction InteractionType = "transaction"
)

// InteractionChannel represents interaction channel enum
type InteractionChannel string

const (
	InteractionChannelPhone     InteractionChannel = "phone"
	InteractionChannelEmail     InteractionChannel = "email"
	InteractionChannelSMS       InteractionChannel = "sms"
	InteractionChannelWebChat   InteractionChannel = "web_chat"
	InteractionChannelMobile    InteractionChannel = "mobile"
	InteractionChannelSocial    InteractionChannel = "social"
	InteractionChannelInPerson  InteractionChannel = "in_person"
	InteractionChannelAPI       InteractionChannel = "api"
	InteractionChannelWebsite   InteractionChannel = "website"
)

// InteractionDirection represents interaction direction enum
type InteractionDirection string

const (
	InteractionDirectionInbound  InteractionDirection = "inbound"
	InteractionDirectionOutbound InteractionDirection = "outbound"
)

// InteractionStatus represents interaction status enum
type InteractionStatus string

const (
	InteractionStatusScheduled  InteractionStatus = "scheduled"
	InteractionStatusInProgress InteractionStatus = "in_progress"
	InteractionStatusCompleted  InteractionStatus = "completed"
	InteractionStatusCancelled  InteractionStatus = "cancelled"
	InteractionStatusFailed     InteractionStatus = "failed"
)

// InteractionPriority represents interaction priority enum
type InteractionPriority string

const (
	InteractionPriorityLow      InteractionPriority = "low"
	InteractionPriorityMedium   InteractionPriority = "medium"
	InteractionPriorityHigh     InteractionPriority = "high"
	InteractionPriorityCritical InteractionPriority = "critical"
)

// CustomerSegment represents customer segmentation
type CustomerSegment struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string                 `json:"name" gorm:"uniqueIndex;not null"`
	Description string                 `json:"description"`
	Type        SegmentType            `json:"type" gorm:"type:varchar(20);not null"`
	Criteria    map[string]interface{} `json:"criteria" gorm:"type:jsonb"`
	IsActive    bool                   `json:"is_active" gorm:"default:true"`
	Color       string                 `json:"color"`
	Priority    int                    `json:"priority" gorm:"default:0"`
	CreatedBy   uuid.UUID              `json:"created_by" gorm:"type:uuid"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`

	// Many-to-many relationship with customers
	Customers []Customer `json:"customers" gorm:"many2many:customer_segment_mappings;"`
}

// SegmentType represents segment type enum
type SegmentType string

const (
	SegmentTypeDemographic SegmentType = "demographic"
	SegmentTypeBehavioral  SegmentType = "behavioral"
	SegmentTypeGeographic  SegmentType = "geographic"
	SegmentTypePsychographic SegmentType = "psychographic"
	SegmentTypeValue       SegmentType = "value"
	SegmentTypeLifecycle   SegmentType = "lifecycle"
	SegmentTypeCustom      SegmentType = "custom"
)

// CustomerPreferences represents customer communication and service preferences
type CustomerPreferences struct {
	ID                    uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CustomerID            uuid.UUID              `json:"customer_id" gorm:"type:uuid;not null;uniqueIndex"`
	CommunicationChannels []string               `json:"communication_channels" gorm:"type:text[]"`
	PreferredContactTime  string                 `json:"preferred_contact_time"`
	TimeZone              string                 `json:"timezone"`
	Language              string                 `json:"language" gorm:"default:'en'"`
	Currency              string                 `json:"currency" gorm:"default:'USD'"`
	MarketingOptIn        bool                   `json:"marketing_opt_in" gorm:"default:false"`
	SMSOptIn              bool                   `json:"sms_opt_in" gorm:"default:false"`
	EmailOptIn            bool                   `json:"email_opt_in" gorm:"default:true"`
	CallOptIn             bool                   `json:"call_opt_in" gorm:"default:true"`
	PushNotificationOptIn bool                   `json:"push_notification_opt_in" gorm:"default:true"`
	DataSharingOptIn      bool                   `json:"data_sharing_opt_in" gorm:"default:false"`
	ThirdPartyOptIn       bool                   `json:"third_party_opt_in" gorm:"default:false"`
	Frequency             NotificationFrequency  `json:"frequency" gorm:"type:varchar(20);default:'normal'"`
	Topics                []string               `json:"topics" gorm:"type:text[]"`
	CustomPreferences     map[string]interface{} `json:"custom_preferences" gorm:"type:jsonb"`
	CreatedAt             time.Time              `json:"created_at"`
	UpdatedAt             time.Time              `json:"updated_at"`
}

// NotificationFrequency represents notification frequency enum
type NotificationFrequency string

const (
	NotificationFrequencyImmediate NotificationFrequency = "immediate"
	NotificationFrequencyHourly    NotificationFrequency = "hourly"
	NotificationFrequencyDaily     NotificationFrequency = "daily"
	NotificationFrequencyWeekly    NotificationFrequency = "weekly"
	NotificationFrequencyMonthly   NotificationFrequency = "monthly"
	NotificationFrequencyNever     NotificationFrequency = "never"
)

// CustomerEvent represents events related to customer lifecycle
type CustomerEvent struct {
	ID         uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CustomerID uuid.UUID              `json:"customer_id" gorm:"type:uuid;not null;index"`
	EventType  string                 `json:"event_type" gorm:"not null;index"`
	EventData  map[string]interface{} `json:"event_data" gorm:"type:jsonb"`
	Source     string                 `json:"source"`
	UserID     *uuid.UUID             `json:"user_id" gorm:"type:uuid"`
	SessionID  string                 `json:"session_id"`
	IPAddress  string                 `json:"ip_address"`
	UserAgent  string                 `json:"user_agent"`
	Timestamp  time.Time              `json:"timestamp" gorm:"not null;index"`
	CreatedAt  time.Time              `json:"created_at"`
}

// TableName sets the table name for Customer model
func (Customer) TableName() string {
	return "customers"
}

// TableName sets the table name for CustomerProfile model
func (CustomerProfile) TableName() string {
	return "customer_profiles"
}

// TableName sets the table name for CustomerAddress model
func (CustomerAddress) TableName() string {
	return "customer_addresses"
}

// TableName sets the table name for CustomerInteraction model
func (CustomerInteraction) TableName() string {
	return "customer_interactions"
}

// TableName sets the table name for CustomerSegment model
func (CustomerSegment) TableName() string {
	return "customer_segments"
}

// TableName sets the table name for CustomerPreferences model
func (CustomerPreferences) TableName() string {
	return "customer_preferences"
}

// TableName sets the table name for CustomerEvent model
func (CustomerEvent) TableName() string {
	return "customer_events"
}

// BeforeCreate hook for Customer model
func (c *Customer) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.CustomerNumber == "" {
		c.CustomerNumber = generateCustomerNumber()
	}
	return nil
}

// generateCustomerNumber generates a unique customer number
func generateCustomerNumber() string {
	// Implementation would generate a unique customer number
	// For now, using UUID-based approach
	return "CUST-" + uuid.New().String()[:8]
}

// GetFullName returns the full name of the customer
func (c *Customer) GetFullName() string {
	if c.MiddleName != "" {
		return c.FirstName + " " + c.MiddleName + " " + c.LastName
	}
	return c.FirstName + " " + c.LastName
}

// IsActive checks if the customer is active
func (c *Customer) IsActive() bool {
	return c.Status == CustomerStatusActive
}

// GetPrimaryAddress returns the primary address of the customer
func (c *Customer) GetPrimaryAddress() *CustomerAddress {
	for _, addr := range c.Addresses {
		if addr.IsPrimary {
			return &addr
		}
	}
	return nil
}

// HasKYCCompleted checks if KYC is completed
func (c *Customer) HasKYCCompleted() bool {
	return c.KYCStatus == KYCStatusApproved
}

// CalculateAge calculates the age of the customer
func (c *Customer) CalculateAge() int {
	if c.DateOfBirth == nil {
		return 0
	}
	now := time.Now()
	age := now.Year() - c.DateOfBirth.Year()
	if now.YearDay() < c.DateOfBirth.YearDay() {
		age--
	}
	return age
}

