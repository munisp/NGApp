package models

import "time"

type LoanStatus string

const (
	LoanPending   LoanStatus = "pending"
	LoanApproved  LoanStatus = "approved"
	LoanActive    LoanStatus = "active"
	LoanPaidOff   LoanStatus = "paid_off"
	LoanDefaulted LoanStatus = "defaulted"
	LoanRejected  LoanStatus = "rejected"
)

type PremiumLoan struct {
	ID                string     `json:"id"`
	PolicyID          string     `json:"policy_id"`
	CustomerID        string     `json:"customer_id"`
	PremiumAmount     float64    `json:"premium_amount"`
	LoanAmount        float64    `json:"loan_amount"`
	DownPayment       float64    `json:"down_payment"`
	InterestRate      float64    `json:"interest_rate"`
	Tenure            int        `json:"tenure_months"`
	MonthlyPayment    float64    `json:"monthly_payment"`
	TotalInterest     float64    `json:"total_interest"`
	TotalRepayment    float64    `json:"total_repayment"`
	OutstandingBalance float64   `json:"outstanding_balance"`
	Status            LoanStatus `json:"status"`
	CreditScore       int        `json:"credit_score"`
	RiskCategory      string     `json:"risk_category"`
	DisbursedAt       *time.Time `json:"disbursed_at,omitempty"`
	NextPaymentDate   *time.Time `json:"next_payment_date,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type Installment struct {
	ID         string    `json:"id"`
	LoanID     string    `json:"loan_id"`
	Number     int       `json:"installment_number"`
	Amount     float64   `json:"amount"`
	Principal  float64   `json:"principal"`
	Interest   float64   `json:"interest"`
	Balance    float64   `json:"outstanding_after"`
	DueDate    time.Time `json:"due_date"`
	PaidDate   *time.Time `json:"paid_date,omitempty"`
	Status     string    `json:"status"`
	LateFee    float64   `json:"late_fee"`
}

type LoanApplication struct {
	PolicyID       string  `json:"policy_id"`
	CustomerID     string  `json:"customer_id"`
	PremiumAmount  float64 `json:"premium_amount"`
	DownPaymentPct float64 `json:"down_payment_pct"`
	Tenure         int     `json:"tenure_months"`
	CreditScore    int     `json:"credit_score"`
	MonthlyIncome  float64 `json:"monthly_income"`
	Employer       string  `json:"employer"`
}
