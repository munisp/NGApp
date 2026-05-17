package models

import "time"

type Customer struct {
	ID          string    `json:"id" db:"id"`
	FirstName   string    `json:"first_name" db:"first_name"`
	LastName    string    `json:"last_name" db:"last_name"`
	Email       string    `json:"email" db:"email"`
	Phone       string    `json:"phone" db:"phone"`
	DateOfBirth time.Time `json:"date_of_birth" db:"date_of_birth"`
	Address     string    `json:"address" db:"address"`
	City        string    `json:"city" db:"city"`
	State       string    `json:"state" db:"state"`
	KYCStatus   string    `json:"kyc_status" db:"kyc_status"`
	BVN         string    `json:"bvn,omitempty" db:"bvn"`
	NIN         string    `json:"nin,omitempty" db:"nin"`
	RiskScore   float64   `json:"risk_score" db:"risk_score"`
	Tier        string    `json:"tier" db:"tier"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CustomerPolicy struct {
	ID         string    `json:"id" db:"id"`
	CustomerID string    `json:"customer_id" db:"customer_id"`
	PolicyType string    `json:"policy_type" db:"policy_type"`
	Status     string    `json:"status" db:"status"`
	Premium    float64   `json:"premium" db:"premium"`
	SumAssured float64   `json:"sum_assured" db:"sum_assured"`
	StartDate  time.Time `json:"start_date" db:"start_date"`
	EndDate    time.Time `json:"end_date" db:"end_date"`
}

type CustomerClaim struct {
	ID         string    `json:"id" db:"id"`
	PolicyID   string    `json:"policy_id" db:"policy_id"`
	CustomerID string    `json:"customer_id" db:"customer_id"`
	Amount     float64   `json:"amount" db:"amount"`
	Status     string    `json:"status" db:"status"`
	FiledDate  time.Time `json:"filed_date" db:"filed_date"`
}

type CustomerPayment struct {
	ID          string    `json:"id" db:"id"`
	PolicyID    string    `json:"policy_id" db:"policy_id"`
	CustomerID  string    `json:"customer_id" db:"customer_id"`
	Amount      float64   `json:"amount" db:"amount"`
	Status      string    `json:"status" db:"status"`
	PaymentDate time.Time `json:"payment_date" db:"payment_date"`
}

type CustomerFilter struct {
	KYCStatus string `json:"kyc_status"`
	State     string `json:"state"`
	Tier      string `json:"tier"`
}

const (
	KYCPending  = "pending"
	KYCVerified = "verified"
	KYCRejected = "rejected"
	KYCSuspended = "suspended"

	TierBronze   = "bronze"
	TierSilver   = "silver"
	TierGold     = "gold"
	TierPlatinum = "platinum"
)
