package service

import "time"

type KYCSubmitRequest struct {
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	Email       string     `json:"email"`
	Phone       string     `json:"phone"`
	BVN         string     `json:"bvn"`
	NIN         string     `json:"nin"`
	DateOfBirth *time.Time `json:"date_of_birth"`
	Address     string     `json:"address"`
	State       string     `json:"state"`
	LGA         string     `json:"lga"`
}

type KYBSubmitRequest struct {
	BusinessName      string     `json:"business_name"`
	RCNumber          string     `json:"rc_number"`
	TIN               string     `json:"tin"`
	BusinessType      string     `json:"business_type"`
	IndustryCode      string     `json:"industry_code"`
	IncorporationDate *time.Time `json:"incorporation_date"`
	RegisteredAddress string     `json:"registered_address"`
	State             string     `json:"state"`
	DirectorCount     int        `json:"director_count"`
	AnnualTurnover    float64    `json:"annual_turnover"`
	EmployeeCount     int        `json:"employee_count"`
}

type DocumentUploadRequest struct {
	ApplicationRef   string     `json:"application_ref"`
	DocumentType     string     `json:"document_type"`
	DocumentNumber   string     `json:"document_number"`
	IssuingAuthority string     `json:"issuing_authority"`
	ExpiryDate       *time.Time `json:"expiry_date"`
}

type ReviewRequest struct {
	ReviewerID  string `json:"reviewer_id"`
	Decision    string `json:"decision"` // approved, rejected, escalated
	ReviewNotes string `json:"review_notes"`
}
