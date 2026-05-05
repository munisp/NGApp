package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Lead represents a sales lead entity
type Lead struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	LeadNumber        string                 `json:"lead_number" gorm:"uniqueIndex;not null"`
	Source            string                 `json:"source" gorm:"not null"`
	SourceDetails     string                 `json:"source_details"`
	Campaign          string                 `json:"campaign"`
	Medium            string                 `json:"medium"`
	Status            LeadStatus             `json:"status" gorm:"type:varchar(20);default:'new'"`
	Priority          Priority               `json:"priority" gorm:"type:varchar(10);default:'medium'"`
	Score             int                    `json:"score" gorm:"default:0"`
	Grade             LeadGrade              `json:"grade" gorm:"type:varchar(10);default:'unqualified'"`
	
	// Contact Information
	FirstName         string                 `json:"first_name" gorm:"not null"`
	LastName          string                 `json:"last_name" gorm:"not null"`
	Email             string                 `json:"email" gorm:"index;not null"`
	Phone             string                 `json:"phone" gorm:"index"`
	AlternatePhone    string                 `json:"alternate_phone"`
	Website           string                 `json:"website"`
	
	// Company Information
	Company           string                 `json:"company"`
	JobTitle          string                 `json:"job_title"`
	Industry          string                 `json:"industry"`
	CompanySize       string                 `json:"company_size"`
	AnnualRevenue     *decimal.Decimal       `json:"annual_revenue" gorm:"type:decimal(15,2)"`
	
	// Address Information
	Street            string                 `json:"street"`
	City              string                 `json:"city"`
	State             string                 `json:"state"`
	PostalCode        string                 `json:"postal_code"`
	Country           string                 `json:"country"`
	
	// Lead Details
	Description       string                 `json:"description"`
	Notes             string                 `json:"notes"`
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Assignment and Ownership
	OwnerID           *uuid.UUID             `json:"owner_id" gorm:"type:uuid;index"`
	OwnerName         string                 `json:"owner_name"`
	AssignedAt        *time.Time             `json:"assigned_at"`
	TeamID            *uuid.UUID             `json:"team_id" gorm:"type:uuid"`
	
	// Qualification Information
	Budget            *decimal.Decimal       `json:"budget" gorm:"type:decimal(15,2)"`
	Timeline          string                 `json:"timeline"`
	Authority         string                 `json:"authority"`
	Need              string                 `json:"need"`
	QualificationNotes string                `json:"qualification_notes"`
	
	// Conversion Information
	ConvertedAt       *time.Time             `json:"converted_at"`
	ConvertedToAccountID *uuid.UUID          `json:"converted_to_account_id" gorm:"type:uuid"`
	ConvertedToContactID *uuid.UUID          `json:"converted_to_contact_id" gorm:"type:uuid"`
	ConvertedToOpportunityID *uuid.UUID      `json:"converted_to_opportunity_id" gorm:"type:uuid"`
	
	// Tracking Information
	FirstTouchDate    *time.Time             `json:"first_touch_date"`
	LastTouchDate     *time.Time             `json:"last_touch_date"`
	TouchCount        int                    `json:"touch_count" gorm:"default:0"`
	LastActivityAt    *time.Time             `json:"last_activity_at"`
	
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Activities        []Activity             `json:"activities" gorm:"foreignKey:LeadID"`
	Interactions      []Interaction          `json:"interactions" gorm:"foreignKey:LeadID"`
}

// Account represents a business account entity
type Account struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AccountNumber     string                 `json:"account_number" gorm:"uniqueIndex;not null"`
	Name              string                 `json:"name" gorm:"not null;index"`
	Type              AccountType            `json:"type" gorm:"type:varchar(20);default:'prospect'"`
	Status            AccountStatus          `json:"status" gorm:"type:varchar(20);default:'active'"`
	Priority          Priority               `json:"priority" gorm:"type:varchar(10);default:'medium'"`
	
	// Company Information
	Industry          string                 `json:"industry"`
	Sector            string                 `json:"sector"`
	CompanySize       string                 `json:"company_size"`
	EmployeeCount     int                    `json:"employee_count"`
	AnnualRevenue     *decimal.Decimal       `json:"annual_revenue" gorm:"type:decimal(15,2)"`
	Website           string                 `json:"website"`
	Description       string                 `json:"description"`
	
	// Contact Information
	Phone             string                 `json:"phone"`
	Fax               string                 `json:"fax"`
	Email             string                 `json:"email"`
	
	// Address Information
	BillingAddress    Address                `json:"billing_address" gorm:"embedded;embeddedPrefix:billing_"`
	ShippingAddress   Address                `json:"shipping_address" gorm:"embedded;embeddedPrefix:shipping_"`
	
	// Relationship Information
	ParentAccountID   *uuid.UUID             `json:"parent_account_id" gorm:"type:uuid"`
	ParentAccount     *Account               `json:"parent_account" gorm:"foreignKey:ParentAccountID"`
	ChildAccounts     []Account              `json:"child_accounts" gorm:"foreignKey:ParentAccountID"`
	
	// Assignment and Ownership
	OwnerID           *uuid.UUID             `json:"owner_id" gorm:"type:uuid;index"`
	OwnerName         string                 `json:"owner_name"`
	TeamID            *uuid.UUID             `json:"team_id" gorm:"type:uuid"`
	
	// Business Information
	TaxID             string                 `json:"tax_id" gorm:"encrypted"`
	CreditLimit       *decimal.Decimal       `json:"credit_limit" gorm:"type:decimal(15,2)"`
	PaymentTerms      string                 `json:"payment_terms"`
	PreferredCurrency string                 `json:"preferred_currency" gorm:"default:'USD'"`
	
	// Tracking Information
	LastActivityAt    *time.Time             `json:"last_activity_at"`
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Contacts          []Contact              `json:"contacts" gorm:"foreignKey:AccountID"`
	Opportunities     []Opportunity          `json:"opportunities" gorm:"foreignKey:AccountID"`
	Activities        []Activity             `json:"activities" gorm:"foreignKey:AccountID"`
}

// Contact represents a contact person entity
type Contact struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ContactNumber     string                 `json:"contact_number" gorm:"uniqueIndex;not null"`
	AccountID         *uuid.UUID             `json:"account_id" gorm:"type:uuid;index"`
	
	// Personal Information
	FirstName         string                 `json:"first_name" gorm:"not null"`
	LastName          string                 `json:"last_name" gorm:"not null"`
	MiddleName        string                 `json:"middle_name"`
	Salutation        string                 `json:"salutation"`
	Suffix            string                 `json:"suffix"`
	
	// Contact Information
	Email             string                 `json:"email" gorm:"index;not null"`
	AlternateEmail    string                 `json:"alternate_email"`
	Phone             string                 `json:"phone" gorm:"index"`
	AlternatePhone    string                 `json:"alternate_phone"`
	Mobile            string                 `json:"mobile"`
	Fax               string                 `json:"fax"`
	
	// Professional Information
	JobTitle          string                 `json:"job_title"`
	Department        string                 `json:"department"`
	Role              ContactRole            `json:"role" gorm:"type:varchar(20);default:'contact'"`
	ReportsTo         *uuid.UUID             `json:"reports_to" gorm:"type:uuid"`
	Manager           *Contact               `json:"manager" gorm:"foreignKey:ReportsTo"`
	DirectReports     []Contact              `json:"direct_reports" gorm:"foreignKey:ReportsTo"`
	
	// Address Information
	MailingAddress    Address                `json:"mailing_address" gorm:"embedded;embeddedPrefix:mailing_"`
	
	// Personal Details
	DateOfBirth       *time.Time             `json:"date_of_birth"`
	Gender            string                 `json:"gender"`
	MaritalStatus     string                 `json:"marital_status"`
	
	// Preferences
	PreferredLanguage string                 `json:"preferred_language" gorm:"default:'en'"`
	PreferredContactMethod string            `json:"preferred_contact_method"`
	DoNotCall         bool                   `json:"do_not_call" gorm:"default:false"`
	DoNotEmail        bool                   `json:"do_not_email" gorm:"default:false"`
	OptedOut          bool                   `json:"opted_out" gorm:"default:false"`
	
	// Assignment and Ownership
	OwnerID           *uuid.UUID             `json:"owner_id" gorm:"type:uuid;index"`
	OwnerName         string                 `json:"owner_name"`
	
	// Social Media
	LinkedIn          string                 `json:"linkedin"`
	Twitter           string                 `json:"twitter"`
	Facebook          string                 `json:"facebook"`
	
	// Tracking Information
	LastActivityAt    *time.Time             `json:"last_activity_at"`
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Account           *Account               `json:"account" gorm:"foreignKey:AccountID"`
	Opportunities     []Opportunity          `json:"opportunities" gorm:"foreignKey:ContactID"`
	Activities        []Activity             `json:"activities" gorm:"foreignKey:ContactID"`
	Interactions      []Interaction          `json:"interactions" gorm:"foreignKey:ContactID"`
}

// Opportunity represents a sales opportunity entity
type Opportunity struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OpportunityNumber string                 `json:"opportunity_number" gorm:"uniqueIndex;not null"`
	Name              string                 `json:"name" gorm:"not null;index"`
	AccountID         *uuid.UUID             `json:"account_id" gorm:"type:uuid;index"`
	ContactID         *uuid.UUID             `json:"contact_id" gorm:"type:uuid;index"`
	
	// Opportunity Details
	Type              OpportunityType        `json:"type" gorm:"type:varchar(20);default:'new_business'"`
	Stage             OpportunityStage       `json:"stage" gorm:"type:varchar(30);default:'prospecting'"`
	Status            OpportunityStatus      `json:"status" gorm:"type:varchar(20);default:'open'"`
	Priority          Priority               `json:"priority" gorm:"type:varchar(10);default:'medium'"`
	Source            string                 `json:"source"`
	
	// Financial Information
	Amount            decimal.Decimal        `json:"amount" gorm:"type:decimal(15,2);not null"`
	Currency          string                 `json:"currency" gorm:"default:'USD'"`
	Probability       int                    `json:"probability" gorm:"default:0"` // 0-100
	WeightedAmount    decimal.Decimal        `json:"weighted_amount" gorm:"type:decimal(15,2)"`
	
	// Timeline Information
	CloseDate         time.Time              `json:"close_date" gorm:"not null"`
	CreatedDate       time.Time              `json:"created_date"`
	FirstContactDate  *time.Time             `json:"first_contact_date"`
	LastActivityDate  *time.Time             `json:"last_activity_date"`
	
	// Sales Process
	SalesCycle        int                    `json:"sales_cycle"` // days
	DaysInStage       int                    `json:"days_in_stage"`
	StageHistory      []StageHistory         `json:"stage_history" gorm:"foreignKey:OpportunityID"`
	
	// Assignment and Ownership
	OwnerID           *uuid.UUID             `json:"owner_id" gorm:"type:uuid;index"`
	OwnerName         string                 `json:"owner_name"`
	TeamID            *uuid.UUID             `json:"team_id" gorm:"type:uuid"`
	
	// Competition and Analysis
	Competitors       []string               `json:"competitors" gorm:"type:text[]"`
	CompetitorAnalysis string                `json:"competitor_analysis"`
	WinLossReason     string                 `json:"win_loss_reason"`
	
	// Products and Services
	Products          []OpportunityProduct   `json:"products" gorm:"foreignKey:OpportunityID"`
	
	// Additional Information
	Description       string                 `json:"description"`
	Notes             string                 `json:"notes"`
	NextStep          string                 `json:"next_step"`
	NextStepDate      *time.Time             `json:"next_step_date"`
	
	// Forecasting
	ForecastCategory  ForecastCategory       `json:"forecast_category" gorm:"type:varchar(20);default:'pipeline'"`
	CommitStatus      CommitStatus           `json:"commit_status" gorm:"type:varchar(20);default:'not_committed'"`
	
	// Tracking Information
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Account           *Account               `json:"account" gorm:"foreignKey:AccountID"`
	Contact           *Contact               `json:"contact" gorm:"foreignKey:ContactID"`
	Activities        []Activity             `json:"activities" gorm:"foreignKey:OpportunityID"`
	Interactions      []Interaction          `json:"interactions" gorm:"foreignKey:OpportunityID"`
}

// Activity represents a CRM activity entity
type Activity struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Type              ActivityType           `json:"type" gorm:"type:varchar(20);not null"`
	Subject           string                 `json:"subject" gorm:"not null"`
	Description       string                 `json:"description"`
	Status            ActivityStatus         `json:"status" gorm:"type:varchar(20);default:'planned'"`
	Priority          Priority               `json:"priority" gorm:"type:varchar(10);default:'medium'"`
	
	// Relationships
	LeadID            *uuid.UUID             `json:"lead_id" gorm:"type:uuid;index"`
	AccountID         *uuid.UUID             `json:"account_id" gorm:"type:uuid;index"`
	ContactID         *uuid.UUID             `json:"contact_id" gorm:"type:uuid;index"`
	OpportunityID     *uuid.UUID             `json:"opportunity_id" gorm:"type:uuid;index"`
	
	// Timing Information
	ScheduledAt       *time.Time             `json:"scheduled_at"`
	StartedAt         *time.Time             `json:"started_at"`
	CompletedAt       *time.Time             `json:"completed_at"`
	DueDate           *time.Time             `json:"due_date"`
	Duration          int                    `json:"duration"` // minutes
	
	// Assignment
	OwnerID           *uuid.UUID             `json:"owner_id" gorm:"type:uuid;index"`
	OwnerName         string                 `json:"owner_name"`
	AssignedTo        *uuid.UUID             `json:"assigned_to" gorm:"type:uuid"`
	AssignedToName    string                 `json:"assigned_to_name"`
	
	// Location and Meeting Details
	Location          string                 `json:"location"`
	MeetingURL        string                 `json:"meeting_url"`
	Attendees         []string               `json:"attendees" gorm:"type:text[]"`
	
	// Results and Outcome
	Outcome           string                 `json:"outcome"`
	Result            string                 `json:"result"`
	FollowUpRequired  bool                   `json:"follow_up_required" gorm:"default:false"`
	FollowUpDate      *time.Time             `json:"follow_up_date"`
	
	// Additional Information
	Tags              []string               `json:"tags" gorm:"type:text[]"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	DeletedAt         gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	// Relationships
	Lead              *Lead                  `json:"lead" gorm:"foreignKey:LeadID"`
	Account           *Account               `json:"account" gorm:"foreignKey:AccountID"`
	Contact           *Contact               `json:"contact" gorm:"foreignKey:ContactID"`
	Opportunity       *Opportunity           `json:"opportunity" gorm:"foreignKey:OpportunityID"`
}

// Supporting models and enums

// Address represents an address structure
type Address struct {
	Street     string  `json:"street"`
	City       string  `json:"city"`
	State      string  `json:"state"`
	PostalCode string  `json:"postal_code"`
	Country    string  `json:"country"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
}

// StageHistory tracks opportunity stage changes
type StageHistory struct {
	ID            uuid.UUID        `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OpportunityID uuid.UUID        `json:"opportunity_id" gorm:"type:uuid;not null;index"`
	FromStage     OpportunityStage `json:"from_stage" gorm:"type:varchar(30)"`
	ToStage       OpportunityStage `json:"to_stage" gorm:"type:varchar(30);not null"`
	ChangedBy     uuid.UUID        `json:"changed_by" gorm:"type:uuid"`
	ChangedByName string           `json:"changed_by_name"`
	Reason        string           `json:"reason"`
	Notes         string           `json:"notes"`
	ChangedAt     time.Time        `json:"changed_at" gorm:"not null"`
	CreatedAt     time.Time        `json:"created_at"`
}

// OpportunityProduct represents products associated with an opportunity
type OpportunityProduct struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OpportunityID uuid.UUID       `json:"opportunity_id" gorm:"type:uuid;not null;index"`
	ProductID     uuid.UUID       `json:"product_id" gorm:"type:uuid;not null"`
	ProductName   string          `json:"product_name" gorm:"not null"`
	Quantity      int             `json:"quantity" gorm:"not null;default:1"`
	UnitPrice     decimal.Decimal `json:"unit_price" gorm:"type:decimal(15,2);not null"`
	TotalPrice    decimal.Decimal `json:"total_price" gorm:"type:decimal(15,2);not null"`
	Discount      decimal.Decimal `json:"discount" gorm:"type:decimal(5,2);default:0"`
	Description   string          `json:"description"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// Interaction represents customer/lead interactions
type Interaction struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Type          InteractionType `json:"type" gorm:"type:varchar(20);not null"`
	Channel       string          `json:"channel" gorm:"not null"`
	Direction     string          `json:"direction" gorm:"not null"` // inbound/outbound
	Subject       string          `json:"subject"`
	Content       string          `json:"content"`
	Status        string          `json:"status" gorm:"default:'completed'"`
	
	// Relationships
	LeadID        *uuid.UUID      `json:"lead_id" gorm:"type:uuid;index"`
	AccountID     *uuid.UUID      `json:"account_id" gorm:"type:uuid;index"`
	ContactID     *uuid.UUID      `json:"contact_id" gorm:"type:uuid;index"`
	OpportunityID *uuid.UUID      `json:"opportunity_id" gorm:"type:uuid;index"`
	
	// Timing
	StartedAt     *time.Time      `json:"started_at"`
	EndedAt       *time.Time      `json:"ended_at"`
	Duration      int             `json:"duration"` // seconds
	
	// Assignment
	OwnerID       *uuid.UUID      `json:"owner_id" gorm:"type:uuid"`
	OwnerName     string          `json:"owner_name"`
	
	// Additional Information
	Tags          []string        `json:"tags" gorm:"type:text[]"`
	CustomFields  map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// Enums and constants

type LeadStatus string
const (
	LeadStatusNew         LeadStatus = "new"
	LeadStatusContacted   LeadStatus = "contacted"
	LeadStatusQualified   LeadStatus = "qualified"
	LeadStatusUnqualified LeadStatus = "unqualified"
	LeadStatusConverted   LeadStatus = "converted"
	LeadStatusLost        LeadStatus = "lost"
)

type LeadGrade string
const (
	LeadGradeUnqualified LeadGrade = "unqualified"
	LeadGradeA           LeadGrade = "a"
	LeadGradeB           LeadGrade = "b"
	LeadGradeC           LeadGrade = "c"
	LeadGradeD           LeadGrade = "d"
)

type AccountType string
const (
	AccountTypeProspect  AccountType = "prospect"
	AccountTypeCustomer  AccountType = "customer"
	AccountTypePartner   AccountType = "partner"
	AccountTypeVendor    AccountType = "vendor"
	AccountTypeCompetitor AccountType = "competitor"
)

type AccountStatus string
const (
	AccountStatusActive   AccountStatus = "active"
	AccountStatusInactive AccountStatus = "inactive"
	AccountStatusSuspended AccountStatus = "suspended"
	AccountStatusClosed   AccountStatus = "closed"
)

type ContactRole string
const (
	ContactRoleContact        ContactRole = "contact"
	ContactRoleDecisionMaker  ContactRole = "decision_maker"
	ContactRoleInfluencer     ContactRole = "influencer"
	ContactRoleChampion       ContactRole = "champion"
	ContactRoleGatekeeper     ContactRole = "gatekeeper"
)

type OpportunityType string
const (
	OpportunityTypeNewBusiness OpportunityType = "new_business"
	OpportunityTypeExisting    OpportunityType = "existing"
	OpportunityTypeRenewal     OpportunityType = "renewal"
	OpportunityTypeUpgrade     OpportunityType = "upgrade"
)

type OpportunityStage string
const (
	OpportunityStageProspecting    OpportunityStage = "prospecting"
	OpportunityStageQualification  OpportunityStage = "qualification"
	OpportunityStageNeedsAnalysis  OpportunityStage = "needs_analysis"
	OpportunityStageValueProposition OpportunityStage = "value_proposition"
	OpportunityStageProposal       OpportunityStage = "proposal"
	OpportunityStageNegotiation    OpportunityStage = "negotiation"
	OpportunityStageClosedWon      OpportunityStage = "closed_won"
	OpportunityStageClosedLost     OpportunityStage = "closed_lost"
)

type OpportunityStatus string
const (
	OpportunityStatusOpen   OpportunityStatus = "open"
	OpportunityStatusWon    OpportunityStatus = "won"
	OpportunityStatusLost   OpportunityStatus = "lost"
	OpportunityStatusOnHold OpportunityStatus = "on_hold"
)

type Priority string
const (
	PriorityLow      Priority = "low"
	PriorityMedium   Priority = "medium"
	PriorityHigh     Priority = "high"
	PriorityCritical Priority = "critical"
)

type ActivityType string
const (
	ActivityTypeCall     ActivityType = "call"
	ActivityTypeEmail    ActivityType = "email"
	ActivityTypeMeeting  ActivityType = "meeting"
	ActivityTypeTask     ActivityType = "task"
	ActivityTypeNote     ActivityType = "note"
	ActivityTypeDemo     ActivityType = "demo"
	ActivityTypeProposal ActivityType = "proposal"
)

type ActivityStatus string
const (
	ActivityStatusPlanned    ActivityStatus = "planned"
	ActivityStatusInProgress ActivityStatus = "in_progress"
	ActivityStatusCompleted  ActivityStatus = "completed"
	ActivityStatusCancelled  ActivityStatus = "cancelled"
	ActivityStatusDeferred   ActivityStatus = "deferred"
)

type InteractionType string
const (
	InteractionTypeCall    InteractionType = "call"
	InteractionTypeEmail   InteractionType = "email"
	InteractionTypeMeeting InteractionType = "meeting"
	InteractionTypeChat    InteractionType = "chat"
	InteractionTypeSMS     InteractionType = "sms"
	InteractionTypeSocial  InteractionType = "social"
)

type ForecastCategory string
const (
	ForecastCategoryPipeline ForecastCategory = "pipeline"
	ForecastCategoryBestCase ForecastCategory = "best_case"
	ForecastCategoryCommit   ForecastCategory = "commit"
	ForecastCategoryOmitted  ForecastCategory = "omitted"
)

type CommitStatus string
const (
	CommitStatusNotCommitted CommitStatus = "not_committed"
	CommitStatusCommitted    CommitStatus = "committed"
	CommitStatusUpside       CommitStatus = "upside"
)

// Table names
func (Lead) TableName() string { return "leads" }
func (Account) TableName() string { return "accounts" }
func (Contact) TableName() string { return "contacts" }
func (Opportunity) TableName() string { return "opportunities" }
func (Activity) TableName() string { return "activities" }
func (StageHistory) TableName() string { return "stage_histories" }
func (OpportunityProduct) TableName() string { return "opportunity_products" }
func (Interaction) TableName() string { return "interactions" }

// Model hooks and methods

// BeforeCreate hook for Lead
func (l *Lead) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	if l.LeadNumber == "" {
		l.LeadNumber = generateLeadNumber()
	}
	return nil
}

// BeforeCreate hook for Account
func (a *Account) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.AccountNumber == "" {
		a.AccountNumber = generateAccountNumber()
	}
	return nil
}

// BeforeCreate hook for Contact
func (c *Contact) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.ContactNumber == "" {
		c.ContactNumber = generateContactNumber()
	}
	return nil
}

// BeforeCreate hook for Opportunity
func (o *Opportunity) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.OpportunityNumber == "" {
		o.OpportunityNumber = generateOpportunityNumber()
	}
	// Calculate weighted amount
	o.WeightedAmount = o.Amount.Mul(decimal.NewFromInt(int64(o.Probability))).Div(decimal.NewFromInt(100))
	return nil
}

// BeforeUpdate hook for Opportunity
func (o *Opportunity) BeforeUpdate(tx *gorm.DB) error {
	// Recalculate weighted amount
	o.WeightedAmount = o.Amount.Mul(decimal.NewFromInt(int64(o.Probability))).Div(decimal.NewFromInt(100))
	return nil
}

// Helper functions for generating numbers
func generateLeadNumber() string {
	return "LEAD-" + uuid.New().String()[:8]
}

func generateAccountNumber() string {
	return "ACC-" + uuid.New().String()[:8]
}

func generateContactNumber() string {
	return "CON-" + uuid.New().String()[:8]
}

func generateOpportunityNumber() string {
	return "OPP-" + uuid.New().String()[:8]
}

// Utility methods

// GetFullName returns the full name of a lead
func (l *Lead) GetFullName() string {
	return l.FirstName + " " + l.LastName
}

// GetFullName returns the full name of a contact
func (c *Contact) GetFullName() string {
	if c.MiddleName != "" {
		return c.FirstName + " " + c.MiddleName + " " + c.LastName
	}
	return c.FirstName + " " + c.LastName
}

// IsQualified checks if a lead is qualified
func (l *Lead) IsQualified() bool {
	return l.Status == LeadStatusQualified
}

// IsWon checks if an opportunity is won
func (o *Opportunity) IsWon() bool {
	return o.Status == OpportunityStatusWon
}

// IsLost checks if an opportunity is lost
func (o *Opportunity) IsLost() bool {
	return o.Status == OpportunityStatusLost
}

// IsClosed checks if an opportunity is closed (won or lost)
func (o *Opportunity) IsClosed() bool {
	return o.IsWon() || o.IsLost()
}

// GetSalesCycleDays calculates the sales cycle in days
func (o *Opportunity) GetSalesCycleDays() int {
	if o.IsClosed() && o.FirstContactDate != nil {
		return int(o.UpdatedAt.Sub(*o.FirstContactDate).Hours() / 24)
	}
	return 0
}

