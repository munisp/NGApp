package models

import (
	"time"
	"github.com/google/uuid"
)

type CustomerProfile struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef     string                 `json:"customer_ref" gorm:"uniqueIndex;not null"`
	FirstName       string                 `json:"first_name"`
	LastName        string                 `json:"last_name"`
	Email           string                 `json:"email" gorm:"index"`
	Phone           string                 `json:"phone" gorm:"index"`
	DateOfBirth     *time.Time             `json:"date_of_birth"`
	Gender          string                 `json:"gender"`
	Address         string                 `json:"address"`
	City            string                 `json:"city"`
	State           string                 `json:"state"`
	LGA             string                 `json:"lga"`
	BVN             string                 `json:"bvn"`
	NIN             string                 `json:"nin"`
	Occupation      string                 `json:"occupation"`
	EmployerName    string                 `json:"employer_name"`
	AnnualIncome    float64                `json:"annual_income"`
	RiskCategory    string                 `json:"risk_category" gorm:"default:'standard'"` // preferred, standard, substandard
	LifetimeValue   float64                `json:"lifetime_value"`
	SegmentCode     string                 `json:"segment_code"` // platinum, gold, silver, bronze
	KYCStatus       string                 `json:"kyc_status" gorm:"default:'pending'"` // pending, verified, failed
	ConsentStatus   string                 `json:"consent_status"`
	Tags            map[string]interface{} `json:"tags" gorm:"serializer:json"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type PolicySummary struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef   string    `json:"customer_ref" gorm:"index;not null"`
	PolicyNumber  string    `json:"policy_number" gorm:"index"`
	PolicyType    string    `json:"policy_type"`
	ProductName   string    `json:"product_name"`
	Status        string    `json:"status"` // active, lapsed, cancelled, matured
	Premium       float64   `json:"premium"`
	SumAssured    float64   `json:"sum_assured"`
	InceptionDate time.Time `json:"inception_date"`
	ExpiryDate    time.Time `json:"expiry_date"`
	AgentCode     string    `json:"agent_code"`
	CreatedAt     time.Time `json:"created_at"`
}

type ClaimSummary struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef  string    `json:"customer_ref" gorm:"index;not null"`
	ClaimNumber  string    `json:"claim_number" gorm:"index"`
	PolicyNumber string    `json:"policy_number"`
	ClaimType    string    `json:"claim_type"`
	Status       string    `json:"status"`
	AmountClaimed float64  `json:"amount_claimed"`
	AmountPaid   float64   `json:"amount_paid"`
	FiledDate    time.Time `json:"filed_date"`
	SettledDate  *time.Time `json:"settled_date"`
	CreatedAt    time.Time `json:"created_at"`
}

type InteractionLog struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef  string                 `json:"customer_ref" gorm:"index;not null"`
	Channel      string                 `json:"channel"` // phone, email, web, mobile, branch, agent
	Type         string                 `json:"type"` // inquiry, complaint, service_request, feedback
	Subject      string                 `json:"subject"`
	Description  string                 `json:"description"`
	AgentID      string                 `json:"agent_id"`
	Status       string                 `json:"status"`
	Sentiment    string                 `json:"sentiment"`
	Metadata     map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	CreatedAt    time.Time              `json:"created_at"`
}

type PaymentHistory struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef  string    `json:"customer_ref" gorm:"index;not null"`
	PolicyNumber string    `json:"policy_number"`
	Amount       float64   `json:"amount"`
	PaymentMethod string   `json:"payment_method"`
	TransactionRef string  `json:"transaction_ref"`
	Status       string    `json:"status"`
	PaidAt       time.Time `json:"paid_at"`
	CreatedAt    time.Time `json:"created_at"`
}

type CustomerRiskProfile struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerRef   string                 `json:"customer_ref" gorm:"uniqueIndex;not null"`
	OverallScore  float64                `json:"overall_score"`
	ClaimsRisk    float64                `json:"claims_risk"`
	PaymentRisk   float64                `json:"payment_risk"`
	FraudRisk     float64                `json:"fraud_risk"`
	Factors       map[string]interface{} `json:"factors" gorm:"serializer:json"`
	LastCalculated time.Time             `json:"last_calculated"`
	CreatedAt     time.Time              `json:"created_at"`
}
