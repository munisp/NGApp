package models

import (
	"time"
	"github.com/google/uuid"
)

type KYCApplication struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ApplicationRef  string                 `json:"application_ref" gorm:"uniqueIndex;not null"`
	ApplicantType   string                 `json:"applicant_type"` // individual, business
	FirstName       string                 `json:"first_name"`
	LastName        string                 `json:"last_name"`
	Email           string                 `json:"email" gorm:"index"`
	Phone           string                 `json:"phone"`
	BVN             string                 `json:"bvn"`
	NIN             string                 `json:"nin"`
	DateOfBirth     *time.Time             `json:"date_of_birth"`
	Address         string                 `json:"address"`
	State           string                 `json:"state"`
	LGA             string                 `json:"lga"`
	RiskLevel       string                 `json:"risk_level" gorm:"default:'low'"` // low, medium, high, critical
	OverallScore    float64                `json:"overall_score"`
	Status          string                 `json:"status" gorm:"default:'pending'"` // pending, in_review, approved, rejected, escalated
	ReviewerID      string                 `json:"reviewer_id"`
	ReviewNotes     string                 `json:"review_notes"`
	Metadata        map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	CompletedAt     *time.Time             `json:"completed_at"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type KYBApplication struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ApplicationRef    string                 `json:"application_ref" gorm:"uniqueIndex;not null"`
	BusinessName      string                 `json:"business_name"`
	RCNumber          string                 `json:"rc_number"` // CAC registration
	TIN               string                 `json:"tin"`       // Tax ID
	BusinessType      string                 `json:"business_type"` // limited, partnership, sole_proprietor, ngo
	IndustryCode      string                 `json:"industry_code"`
	IncorporationDate *time.Time             `json:"incorporation_date"`
	RegisteredAddress string                 `json:"registered_address"`
	State             string                 `json:"state"`
	DirectorCount     int                    `json:"director_count"`
	AnnualTurnover    float64                `json:"annual_turnover"`
	EmployeeCount     int                    `json:"employee_count"`
	RiskLevel         string                 `json:"risk_level" gorm:"default:'low'"`
	OverallScore      float64                `json:"overall_score"`
	Status            string                 `json:"status" gorm:"default:'pending'"`
	CACVerified       bool                   `json:"cac_verified"`
	TINVerified       bool                   `json:"tin_verified"`
	Metadata          map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	CompletedAt       *time.Time             `json:"completed_at"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

type VerificationCheck struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ApplicationRef  string                 `json:"application_ref" gorm:"index;not null"`
	CheckType       string                 `json:"check_type"` // bvn, nin, cac, tin, address, watchlist, pep, sanctions
	Provider        string                 `json:"provider"`
	Status          string                 `json:"status"` // pending, passed, failed, error, manual_review
	Score           float64                `json:"score"`
	RawResponse     map[string]interface{} `json:"raw_response" gorm:"serializer:json"`
	ErrorMessage    string                 `json:"error_message"`
	VerifiedAt      *time.Time             `json:"verified_at"`
	CreatedAt       time.Time              `json:"created_at"`
}

type WatchlistEntry struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	EntityName   string    `json:"entity_name" gorm:"index"`
	EntityType   string    `json:"entity_type"` // individual, organization
	ListSource   string    `json:"list_source"` // sanctions, pep, adverse_media, terrorism, fraud
	Country      string    `json:"country"`
	Reason       string    `json:"reason"`
	MatchScore   float64   `json:"match_score"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at"`
}

type DocumentVerification struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ApplicationRef  string    `json:"application_ref" gorm:"index;not null"`
	DocumentType    string    `json:"document_type"` // national_id, passport, drivers_license, utility_bill, cac_cert, tin_cert
	DocumentNumber  string    `json:"document_number"`
	IssuingAuthority string   `json:"issuing_authority"`
	ExpiryDate      *time.Time `json:"expiry_date"`
	Status          string    `json:"status"` // uploaded, verified, rejected, expired
	VerificationScore float64 `json:"verification_score"`
	CreatedAt       time.Time `json:"created_at"`
}
