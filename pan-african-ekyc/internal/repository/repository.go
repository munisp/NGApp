package repository

import (
	"fmt"
	"pan-african-ekyc/internal/models"
	"sync"
	"time"
)

type EKYCRepository struct {
	mu            sync.RWMutex
	verifications map[string]*models.VerificationRequest
	profiles      map[string]*models.KYCProfile
	documents     []models.SupportedDocument
}

func NewEKYCRepository() *EKYCRepository {
	repo := &EKYCRepository{
		verifications: make(map[string]*models.VerificationRequest),
		profiles:      make(map[string]*models.KYCProfile),
	}
	repo.seedDocuments()
	return repo
}

func (r *EKYCRepository) seedDocuments() {
	r.documents = []models.SupportedDocument{
		{Country: "NG", Type: "nin", Name: "National Identification Number", Provider: "NIMC", Format: "11 digits"},
		{Country: "NG", Type: "bvn", Name: "Bank Verification Number", Provider: "NIBSS", Format: "11 digits"},
		{Country: "NG", Type: "voter_id", Name: "Voter's Card", Provider: "INEC", Format: "19 characters"},
		{Country: "NG", Type: "drivers_license", Name: "Driver's License", Provider: "FRSC", Format: "FG/state/year/number"},
		{Country: "NG", Type: "cac", Name: "CAC Registration", Provider: "CAC", Format: "RC + number"},
		{Country: "NG", Type: "tin", Name: "Tax Identification Number", Provider: "FIRS", Format: "10 digits"},
		{Country: "KE", Type: "national_id", Name: "National ID Card", Provider: "IPRS", Format: "8 digits"},
		{Country: "KE", Type: "kra_pin", Name: "KRA PIN", Provider: "KRA", Format: "A + 9 digits + letter"},
		{Country: "GH", Type: "ghana_card", Name: "Ghana Card", Provider: "NIA", Format: "GHA-XXXXXXXX-X"},
		{Country: "ZA", Type: "sa_id", Name: "South African ID", Provider: "DHA", Format: "13 digits"},
		{Country: "RW", Type: "nid", Name: "National ID", Provider: "NIDA", Format: "16 digits"},
	}
}

func (r *EKYCRepository) CreateVerification(v *models.VerificationRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.verifications[v.ID] = v
	return nil
}

func (r *EKYCRepository) GetVerification(id string) (*models.VerificationRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	v, ok := r.verifications[id]
	if !ok { return nil, fmt.Errorf("verification %s not found", id) }
	return v, nil
}

func (r *EKYCRepository) ListVerifications(customerID string) []models.VerificationRequest {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.VerificationRequest
	for _, v := range r.verifications {
		if customerID == "" || v.CustomerID == customerID { result = append(result, *v) }
	}
	return result
}

func (r *EKYCRepository) CreateProfile(p *models.KYCProfile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[p.CustomerID] = p
	return nil
}

func (r *EKYCRepository) GetProfile(customerID string) (*models.KYCProfile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.profiles[customerID]
	if !ok { return nil, fmt.Errorf("KYC profile not found for %s", customerID) }
	return p, nil
}

func (r *EKYCRepository) UpdateProfile(p *models.KYCProfile) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[p.CustomerID] = p
}

func (r *EKYCRepository) GetSupportedDocuments(country string) []models.SupportedDocument {
	var result []models.SupportedDocument
	for _, d := range r.documents {
		if country == "" || d.Country == country { result = append(result, d) }
	}
	return result
}

func (r *EKYCRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	verified, pending, failed := 0, 0, 0
	for _, v := range r.verifications {
		switch v.Status {
		case "verified": verified++
		case "pending": pending++
		case "failed": failed++
		}
	}
	return map[string]interface{}{
		"total_verifications": len(r.verifications), "verified": verified, "pending": pending, "failed": failed,
		"kyc_profiles": len(r.profiles), "supported_countries": 6,
	}
}

func init() { _ = time.Now }
