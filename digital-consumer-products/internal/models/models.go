package models

import "time"

type ProductLine string

const (
	LinePayPerDay      ProductLine = "pay_per_day_motor"
	LineGigWorker      ProductLine = "gig_worker_ondemand"
	LineSMECyber       ProductLine = "sme_cyber"
	LinePetInsurance   ProductLine = "pet_insurance"
	LineDigitalNomad   ProductLine = "digital_nomad_travel"
	LineSubscriptionMotor ProductLine = "subscription_motor"
	LineHospiCash      ProductLine = "hospi_cash"
	LineFuneral        ProductLine = "funeral_burial"
)

type ConsumerProduct struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Line            ProductLine `json:"product_line"`
	Description     string      `json:"description"`
	MinPremiumNGN   float64     `json:"min_premium_ngn"`
	MaxCoverageNGN  float64     `json:"max_coverage_ngn"`
	BillingCycle    string      `json:"billing_cycle"`
	ActivationType  string      `json:"activation_type"`
	TargetSegment   string      `json:"target_segment"`
	IsActive        bool        `json:"is_active"`
}

type ConsumerPolicy struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	CustomerID   string    `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	PremiumPaid  float64   `json:"premium_paid_ngn"`
	Coverage     float64   `json:"coverage_ngn"`
	Status       string    `json:"status"`
	ActivatedAt  time.Time `json:"activated_at"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type CyberRiskAssessment struct {
	BusinessName    string   `json:"business_name"`
	Industry        string   `json:"industry"`
	EmployeeCount   int      `json:"employee_count"`
	RiskScore       float64  `json:"risk_score"`
	RiskLevel       string   `json:"risk_level"`
	Vulnerabilities []string `json:"vulnerabilities"`
	RecommendedPlan string   `json:"recommended_plan"`
	PremiumNGN      float64  `json:"premium_ngn"`
}

type HospiCashClaim struct {
	ID             string    `json:"id"`
	PolicyID       string    `json:"policy_id"`
	HospitalName   string    `json:"hospital_name"`
	AdmissionDate  string    `json:"admission_date"`
	DischargeDate  string    `json:"discharge_date"`
	DaysAdmitted   int       `json:"days_admitted"`
	DailyBenefit   float64   `json:"daily_benefit_ngn"`
	TotalPayout    float64   `json:"total_payout_ngn"`
	Status         string    `json:"status"`
	ProcessedAt    time.Time `json:"processed_at"`
}
