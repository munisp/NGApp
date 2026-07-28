package models

import (
	"time"

	"github.com/google/uuid"
)

type ReportType string
type ReportStatus string
type FilingFrequency string

const (
	ReportTypeQuarterly       ReportType = "quarterly"
	ReportTypeAnnual          ReportType = "annual"
	ReportTypeMonthly         ReportType = "monthly"
	ReportTypeSolvency        ReportType = "solvency"
	ReportTypeClaimsRatio     ReportType = "claims_ratio"
	ReportTypePremiumIncome   ReportType = "premium_income"
	ReportTypeReinsurance     ReportType = "reinsurance"
	ReportTypeInvestment      ReportType = "investment"
	ReportTypeCapitalAdequacy ReportType = "capital_adequacy"

	ReportStatusDraft     ReportStatus = "draft"
	ReportStatusPending   ReportStatus = "pending"
	ReportStatusSubmitted ReportStatus = "submitted"
	ReportStatusAccepted  ReportStatus = "accepted"
	ReportStatusRejected  ReportStatus = "rejected"
	ReportStatusOverdue   ReportStatus = "overdue"

	FilingFrequencyMonthly    FilingFrequency = "monthly"
	FilingFrequencyQuarterly  FilingFrequency = "quarterly"
	FilingFrequencyAnnually   FilingFrequency = "annually"
	FilingFrequencyAdHoc      FilingFrequency = "ad_hoc"
)

type ComplianceReport struct {
	ID              uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	ReportType      ReportType     `json:"report_type" gorm:"type:varchar(50);not null"`
	ReportPeriod    string         `json:"report_period" gorm:"type:varchar(20);not null"`
	Status          ReportStatus   `json:"status" gorm:"type:varchar(20);not null;default:'draft'"`
	DueDate         time.Time      `json:"due_date" gorm:"not null"`
	SubmittedAt     *time.Time     `json:"submitted_at"`
	AcceptedAt      *time.Time     `json:"accepted_at"`
	RejectionReason string         `json:"rejection_reason" gorm:"type:text"`
	FilePath        string         `json:"file_path" gorm:"type:varchar(500)"`
	SubmittedBy     uuid.UUID      `json:"submitted_by" gorm:"type:uuid"`
	ReviewedBy      *uuid.UUID     `json:"reviewed_by" gorm:"type:uuid"`
	NAICOMRef       string         `json:"naicom_ref" gorm:"type:varchar(100)"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

type FilingDeadline struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	ReportType      ReportType      `json:"report_type" gorm:"type:varchar(50);not null"`
	Frequency       FilingFrequency `json:"frequency" gorm:"type:varchar(20);not null"`
	DayOfMonth      int             `json:"day_of_month" gorm:"default:15"`
	MonthOfYear     int             `json:"month_of_year"`
	ReminderDays    int             `json:"reminder_days" gorm:"default:7"`
	Description     string          `json:"description" gorm:"type:text"`
	IsActive        bool            `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

type SolvencyMetrics struct {
	ID                    uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReportID              uuid.UUID `json:"report_id" gorm:"type:uuid;not null"`
	TotalAssets           float64   `json:"total_assets" gorm:"type:decimal(20,2)"`
	TotalLiabilities      float64   `json:"total_liabilities" gorm:"type:decimal(20,2)"`
	ShareholdersFunds     float64   `json:"shareholders_funds" gorm:"type:decimal(20,2)"`
	SolvencyMargin        float64   `json:"solvency_margin" gorm:"type:decimal(10,4)"`
	MinimumCapital        float64   `json:"minimum_capital" gorm:"type:decimal(20,2)"`
	CapitalAdequacyRatio  float64   `json:"capital_adequacy_ratio" gorm:"type:decimal(10,4)"`
	TechnicalReserves     float64   `json:"technical_reserves" gorm:"type:decimal(20,2)"`
	InvestmentIncome      float64   `json:"investment_income" gorm:"type:decimal(20,2)"`
	UnderwritingProfit    float64   `json:"underwriting_profit" gorm:"type:decimal(20,2)"`
	ClaimsRatio           float64   `json:"claims_ratio" gorm:"type:decimal(10,4)"`
	ExpenseRatio          float64   `json:"expense_ratio" gorm:"type:decimal(10,4)"`
	CombinedRatio         float64   `json:"combined_ratio" gorm:"type:decimal(10,4)"`
	ReinsuranceCeded      float64   `json:"reinsurance_ceded" gorm:"type:decimal(20,2)"`
	RetentionRatio        float64   `json:"retention_ratio" gorm:"type:decimal(10,4)"`
	CalculatedAt          time.Time `json:"calculated_at" gorm:"autoCreateTime"`
}

type PremiumIncomeReport struct {
	ID                  uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReportID            uuid.UUID `json:"report_id" gorm:"type:uuid;not null"`
	ProductCategory     string    `json:"product_category" gorm:"type:varchar(100)"`
	GrossPremium        float64   `json:"gross_premium" gorm:"type:decimal(20,2)"`
	ReinsurancePremium  float64   `json:"reinsurance_premium" gorm:"type:decimal(20,2)"`
	NetPremium          float64   `json:"net_premium" gorm:"type:decimal(20,2)"`
	UnearnedPremium     float64   `json:"unearned_premium" gorm:"type:decimal(20,2)"`
	EarnedPremium       float64   `json:"earned_premium" gorm:"type:decimal(20,2)"`
	PolicyCount         int       `json:"policy_count"`
	NewBusinessPremium  float64   `json:"new_business_premium" gorm:"type:decimal(20,2)"`
	RenewalPremium      float64   `json:"renewal_premium" gorm:"type:decimal(20,2)"`
	CancellationRefunds float64   `json:"cancellation_refunds" gorm:"type:decimal(20,2)"`
	CreatedAt           time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type ClaimsReport struct {
	ID                   uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReportID             uuid.UUID `json:"report_id" gorm:"type:uuid;not null"`
	ProductCategory      string    `json:"product_category" gorm:"type:varchar(100)"`
	ClaimsReported       int       `json:"claims_reported"`
	ClaimsSettled        int       `json:"claims_settled"`
	ClaimsPending        int       `json:"claims_pending"`
	ClaimsRejected       int       `json:"claims_rejected"`
	GrossClaimsPaid      float64   `json:"gross_claims_paid" gorm:"type:decimal(20,2)"`
	ReinsuranceRecovery  float64   `json:"reinsurance_recovery" gorm:"type:decimal(20,2)"`
	NetClaimsPaid        float64   `json:"net_claims_paid" gorm:"type:decimal(20,2)"`
	OutstandingClaims    float64   `json:"outstanding_claims" gorm:"type:decimal(20,2)"`
	IBNR                 float64   `json:"ibnr" gorm:"type:decimal(20,2)"`
	AverageClaimSize     float64   `json:"average_claim_size" gorm:"type:decimal(20,2)"`
	AverageSettlementDays int      `json:"average_settlement_days"`
	CreatedAt            time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type ComplianceAlert struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	AlertType   string       `json:"alert_type" gorm:"type:varchar(50);not null"`
	Severity    string       `json:"severity" gorm:"type:varchar(20);not null"`
	Title       string       `json:"title" gorm:"type:varchar(200);not null"`
	Description string       `json:"description" gorm:"type:text"`
	ReportID    *uuid.UUID   `json:"report_id" gorm:"type:uuid"`
	DueDate     *time.Time   `json:"due_date"`
	IsRead      bool         `json:"is_read" gorm:"default:false"`
	IsResolved  bool         `json:"is_resolved" gorm:"default:false"`
	ResolvedAt  *time.Time   `json:"resolved_at"`
	ResolvedBy  *uuid.UUID   `json:"resolved_by" gorm:"type:uuid"`
	CreatedAt   time.Time    `json:"created_at" gorm:"autoCreateTime"`
}

type NAICOMSubmission struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReportID         uuid.UUID `json:"report_id" gorm:"type:uuid;not null"`
	SubmissionRef    string    `json:"submission_ref" gorm:"type:varchar(100);unique"`
	SubmissionMethod string    `json:"submission_method" gorm:"type:varchar(50)"`
	ResponseCode     string    `json:"response_code" gorm:"type:varchar(20)"`
	ResponseMessage  string    `json:"response_message" gorm:"type:text"`
	SubmittedAt      time.Time `json:"submitted_at" gorm:"autoCreateTime"`
	AcknowledgedAt   *time.Time `json:"acknowledged_at"`
}
