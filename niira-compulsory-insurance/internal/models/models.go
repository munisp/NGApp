package models

import "time"

type CompulsoryClass string

const (
	ClassMotorTP           CompulsoryClass = "motor_third_party"
	ClassEmployerLiability CompulsoryClass = "employer_liability"
	ClassBuildingInsurance CompulsoryClass = "building_insurance"
	ClassProfessionalPI    CompulsoryClass = "professional_indemnity"
	ClassProductLiability  CompulsoryClass = "product_liability"
	ClassHealthcarePI      CompulsoryClass = "healthcare_professional_indemnity"
	ClassMarineCargo       CompulsoryClass = "marine_cargo"
	ClassPublicLiability   CompulsoryClass = "public_liability"
	ClassGroupLife         CompulsoryClass = "group_life"
	ClassOccupiers         CompulsoryClass = "occupiers_liability"
	ClassContractorsAllRisk CompulsoryClass = "contractors_all_risk"
)

type CompulsoryProduct struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Class            CompulsoryClass `json:"class"`
	Description      string          `json:"description"`
	NIIRASection     string          `json:"niira_section"`
	MinCoverageNGN   float64         `json:"min_coverage_ngn"`
	BasePremiumNGN   float64         `json:"base_premium_ngn"`
	ApplicableTo     []string        `json:"applicable_to"`
	ComplianceDeadline string        `json:"compliance_deadline"`
	PenaltyForNonCompliance string   `json:"penalty_for_non_compliance"`
	IsActive         bool            `json:"is_active"`
}

type ComplianceCertificate struct {
	ID              string    `json:"id"`
	PolicyID        string    `json:"policy_id"`
	BusinessName    string    `json:"business_name"`
	RCNumber        string    `json:"rc_number"`
	Class           string    `json:"class"`
	CertificateNo   string    `json:"certificate_no"`
	IssuedDate      string    `json:"issued_date"`
	ExpiryDate      string    `json:"expiry_date"`
	NAICOMRef       string    `json:"naicom_ref"`
	Status          string    `json:"status"`
	GeneratedAt     time.Time `json:"generated_at"`
}

type ComplianceCheck struct {
	BusinessName    string   `json:"business_name"`
	BusinessType    string   `json:"business_type"`
	EmployeeCount   int      `json:"employee_count"`
	RequiredClasses []string `json:"required_classes"`
	MissingClasses  []string `json:"missing_classes"`
	IsCompliant     bool     `json:"is_compliant"`
	TotalPremiumNGN float64  `json:"total_premium_ngn"`
	Deadline        string   `json:"deadline"`
}

type NIIRAPolicy struct {
	ID            string    `json:"id"`
	ProductID     string    `json:"product_id"`
	BusinessName  string    `json:"business_name"`
	RCNumber      string    `json:"rc_number"`
	PremiumPaid   float64   `json:"premium_paid_ngn"`
	CoverageNGN   float64   `json:"coverage_ngn"`
	Status        string    `json:"status"`
	StartDate     string    `json:"start_date"`
	EndDate       string    `json:"end_date"`
	CreatedAt     time.Time `json:"created_at"`
}
