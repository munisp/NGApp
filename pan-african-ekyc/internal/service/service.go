package service

import (
	"fmt"
	"math"
	"math/rand"
	"pan-african-ekyc/internal/models"
	"pan-african-ekyc/internal/repository"
	"time"
)

type EKYCService struct { repo *repository.EKYCRepository }
func NewEKYCService(repo *repository.EKYCRepository) *EKYCService { return &EKYCService{repo: repo} }

type VerifyRequest struct {
	CustomerID  string `json:"customer_id"`
	Type        string `json:"type"`
	Country     string `json:"country"`
	DocumentID  string `json:"document_id"`
	FullName    string `json:"full_name"`
	DateOfBirth string `json:"date_of_birth,omitempty"`
}

func (s *EKYCService) Verify(req VerifyRequest) (*models.VerificationRequest, error) {
	if req.CustomerID == "" || req.DocumentID == "" {
		return nil, fmt.Errorf("customer_id and document_id are required")
	}
	if req.Country == "" { return nil, fmt.Errorf("country is required") }

	nameMatch := 85.0 + rand.Float64()*15
	photoMatch := 80.0 + rand.Float64()*20
	addrMatch := 70.0 + rand.Float64()*30
	overall := (nameMatch*0.4 + photoMatch*0.35 + addrMatch*0.25)

	status := "verified"
	if overall < 70 { status = "failed" } else if overall < 85 { status = "review" }

	var riskFlags []string
	if overall < 80 { riskFlags = append(riskFlags, "low_match_score") }

	now := time.Now()
	v := &models.VerificationRequest{
		ID: fmt.Sprintf("VRF-%d", time.Now().UnixNano()%10000000),
		CustomerID: req.CustomerID,
		Type: models.VerificationType(req.Type),
		Country: req.Country,
		DocumentID: req.DocumentID,
		FullName: req.FullName,
		DateOfBirth: req.DateOfBirth,
		Status: status,
		Score: math.Round(overall*10) / 10,
		MatchDetails: models.MatchResult{
			NameMatch: math.Round(nameMatch*10) / 10,
			DOBMatch: true,
			PhotoMatch: math.Round(photoMatch*10) / 10,
			AddressMatch: math.Round(addrMatch*10) / 10,
			Overall: math.Round(overall*10) / 10,
		},
		RiskFlags: riskFlags,
		Provider: "NGInsure eKYC",
		CreatedAt: now,
		CompletedAt: &now,
	}

	if err := s.repo.CreateVerification(v); err != nil { return nil, err }

	s.updateKYCProfile(req.CustomerID, req.FullName, req.Country, req.Type, status)

	return v, nil
}

func (s *EKYCService) updateKYCProfile(customerID, name, country, docType, status string) {
	profile, err := s.repo.GetProfile(customerID)
	if err != nil {
		profile = &models.KYCProfile{
			ID: fmt.Sprintf("KYC-%d", time.Now().UnixNano()%10000000),
			CustomerID: customerID, FullName: name, Country: country,
			Level: "basic", PEPCheck: true, SanctionsCheck: true, AMLCheck: true,
			Status: "active", ExpiresAt: time.Now().AddDate(1, 0, 0), CreatedAt: time.Now(),
		}
		s.repo.CreateProfile(profile)
	}

	if status == "verified" {
		found := false
		for _, d := range profile.VerifiedDocs {
			if d == docType { found = true; break }
		}
		if !found { profile.VerifiedDocs = append(profile.VerifiedDocs, docType) }

		if len(profile.VerifiedDocs) >= 3 { profile.Level = "enhanced" } else if len(profile.VerifiedDocs) >= 1 { profile.Level = "standard" }
		profile.RiskScore = math.Max(0, 100-float64(len(profile.VerifiedDocs))*15)
		s.repo.UpdateProfile(profile)
	}
}

func (s *EKYCService) GetVerification(id string) (*models.VerificationRequest, error) { return s.repo.GetVerification(id) }
func (s *EKYCService) ListVerifications(customerID string) []models.VerificationRequest { return s.repo.ListVerifications(customerID) }
func (s *EKYCService) GetProfile(customerID string) (*models.KYCProfile, error) { return s.repo.GetProfile(customerID) }
func (s *EKYCService) GetSupportedDocuments(country string) []models.SupportedDocument { return s.repo.GetSupportedDocuments(country) }
func (s *EKYCService) GetStats() map[string]interface{} { return s.repo.GetStats() }
