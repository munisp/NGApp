package models

import (
	"time"

	"github.com/google/uuid"
)

type CustomerProfile struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerNumber    string    `json:"customer_number" gorm:"type:varchar(20);unique"`
	FirstName         string    `json:"first_name" gorm:"type:varchar(100)"`
	LastName          string    `json:"last_name" gorm:"type:varchar(100)"`
	Email             string    `json:"email" gorm:"type:varchar(255);unique"`
	Phone             string    `json:"phone" gorm:"type:varchar(20)"`
	DateOfBirth       *time.Time `json:"date_of_birth"`
	Gender            string    `json:"gender" gorm:"type:varchar(10)"`
	Address           string    `json:"address" gorm:"type:text"`
	City              string    `json:"city" gorm:"type:varchar(100)"`
	State             string    `json:"state" gorm:"type:varchar(100)"`
	Country           string    `json:"country" gorm:"type:varchar(100);default:'Nigeria'"`
	KYCStatus         string    `json:"kyc_status" gorm:"type:varchar(20);default:'PENDING'"`
	RiskScore         float64   `json:"risk_score" gorm:"type:decimal(5,2)"`
	LifetimeValue     float64   `json:"lifetime_value" gorm:"type:decimal(20,2)"`
	TotalPolicies     int       `json:"total_policies" gorm:"default:0"`
	TotalClaims       int       `json:"total_claims" gorm:"default:0"`
	TotalPremiumPaid  float64   `json:"total_premium_paid" gorm:"type:decimal(20,2)"`
	CustomerSince     time.Time `json:"customer_since" gorm:"autoCreateTime"`
	LastInteractionAt *time.Time `json:"last_interaction_at"`
	PreferredChannel  string    `json:"preferred_channel" gorm:"type:varchar(20)"`
	Segment           string    `json:"segment" gorm:"type:varchar(50)"`
	Tags              string    `json:"tags" gorm:"type:jsonb"`
	CreatedAt         time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type CustomerInteraction struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID      uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	InteractionType string    `json:"interaction_type" gorm:"type:varchar(50)"`
	Channel         string    `json:"channel" gorm:"type:varchar(20)"`
	Subject         string    `json:"subject" gorm:"type:varchar(255)"`
	Description     string    `json:"description" gorm:"type:text"`
	Outcome         string    `json:"outcome" gorm:"type:varchar(50)"`
	AgentID         *uuid.UUID `json:"agent_id" gorm:"type:uuid"`
	Duration        int       `json:"duration"`
	Sentiment       string    `json:"sentiment" gorm:"type:varchar(20)"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type CustomerPolicy struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID    uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	PolicyID      uuid.UUID `json:"policy_id" gorm:"type:uuid;not null"`
	PolicyNumber  string    `json:"policy_number" gorm:"type:varchar(50)"`
	ProductType   string    `json:"product_type" gorm:"type:varchar(50)"`
	Status        string    `json:"status" gorm:"type:varchar(20)"`
	Premium       float64   `json:"premium" gorm:"type:decimal(20,2)"`
	SumInsured    float64   `json:"sum_insured" gorm:"type:decimal(20,2)"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type CustomerClaim struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID   uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	ClaimID      uuid.UUID `json:"claim_id" gorm:"type:uuid;not null"`
	ClaimNumber  string    `json:"claim_number" gorm:"type:varchar(50)"`
	PolicyNumber string    `json:"policy_number" gorm:"type:varchar(50)"`
	ClaimAmount  float64   `json:"claim_amount" gorm:"type:decimal(20,2)"`
	PaidAmount   float64   `json:"paid_amount" gorm:"type:decimal(20,2)"`
	Status       string    `json:"status" gorm:"type:varchar(20)"`
	ClaimDate    time.Time `json:"claim_date"`
	ResolvedAt   *time.Time `json:"resolved_at"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type CustomerPreference struct {
	ID                  uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID          uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;unique"`
	EmailNotifications  bool      `json:"email_notifications" gorm:"default:true"`
	SMSNotifications    bool      `json:"sms_notifications" gorm:"default:true"`
	PushNotifications   bool      `json:"push_notifications" gorm:"default:true"`
	MarketingConsent    bool      `json:"marketing_consent" gorm:"default:false"`
	PreferredLanguage   string    `json:"preferred_language" gorm:"type:varchar(10);default:'en'"`
	PreferredPayment    string    `json:"preferred_payment" gorm:"type:varchar(50)"`
	AutoRenewal         bool      `json:"auto_renewal" gorm:"default:false"`
	PaperlessStatements bool      `json:"paperless_statements" gorm:"default:true"`
	UpdatedAt           time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}
