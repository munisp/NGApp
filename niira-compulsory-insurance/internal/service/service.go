package service

import (
	"fmt"
	"niira-compulsory-insurance/internal/models"
	"niira-compulsory-insurance/internal/repository"
	"time"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProducts() []models.CompulsoryProduct     { return s.repo.GetProducts() }
func (s *Service) GetProduct(id string) *models.CompulsoryProduct { return s.repo.GetProduct(id) }
func (s *Service) GetPolicies() []models.NIIRAPolicy           { return s.repo.GetPolicies() }
func (s *Service) GetCertificates() []models.ComplianceCertificate { return s.repo.GetCertificates() }

func (s *Service) CheckCompliance(bizName, bizType string, empCount int, existingClasses []string) *models.ComplianceCheck {
	required := determineRequired(bizType, empCount)
	existingSet := make(map[string]bool)
	for _, c := range existingClasses {
		existingSet[c] = true
	}
	var missing []string
	totalPremium := 0.0
	for _, req := range required {
		if !existingSet[req] {
			missing = append(missing, req)
			products := s.repo.GetProducts()
			for _, p := range products {
				if string(p.Class) == req {
					totalPremium += p.BasePremiumNGN
					break
				}
			}
		}
	}
	return &models.ComplianceCheck{
		BusinessName:    bizName,
		BusinessType:    bizType,
		EmployeeCount:   empCount,
		RequiredClasses: required,
		MissingClasses:  missing,
		IsCompliant:     len(missing) == 0,
		TotalPremiumNGN: totalPremium,
		Deadline:        "2026-07-30",
	}
}

func determineRequired(bizType string, empCount int) []string {
	required := []string{"motor_third_party"}
	if empCount >= 3 {
		required = append(required, "employer_liability", "group_life")
	}
	switch bizType {
	case "hospital", "clinic", "pharmacy":
		required = append(required, "healthcare_professional_indemnity", "public_liability", "occupiers_liability")
	case "law_firm", "accounting_firm", "engineering_firm":
		required = append(required, "professional_indemnity")
	case "manufacturer", "food_producer", "pharma":
		required = append(required, "product_liability")
	case "hotel", "mall", "cinema", "event_venue":
		required = append(required, "public_liability", "occupiers_liability")
	case "importer", "exporter", "shipping":
		required = append(required, "marine_cargo")
	case "construction", "contractor":
		required = append(required, "contractors_all_risk", "occupiers_liability")
	}
	return required
}

func (s *Service) IssuePolicy(productID, bizName, rcNumber string) (*models.NIIRAPolicy, error) {
	product := s.repo.GetProduct(productID)
	if product == nil {
		return nil, fmt.Errorf("product not found: %s", productID)
	}
	now := time.Now()
	policy := &models.NIIRAPolicy{
		ID:           fmt.Sprintf("NIIRA-POL-%d", now.UnixNano()%1000000000),
		ProductID:    productID,
		BusinessName: bizName,
		RCNumber:     rcNumber,
		PremiumPaid:  product.BasePremiumNGN,
		CoverageNGN:  product.MinCoverageNGN,
		Status:       "active",
		StartDate:    now.Format("2006-01-02"),
		EndDate:      now.Add(365 * 24 * time.Hour).Format("2006-01-02"),
		CreatedAt:    now,
	}
	s.repo.CreatePolicy(policy)
	cert := &models.ComplianceCertificate{
		ID:            fmt.Sprintf("CERT-%d", now.UnixNano()%1000000000),
		PolicyID:      policy.ID,
		BusinessName:  bizName,
		RCNumber:      rcNumber,
		Class:         string(product.Class),
		CertificateNo: fmt.Sprintf("NAICOM/%s/%d", product.NIIRASection, now.UnixNano()%100000),
		IssuedDate:    now.Format("2006-01-02"),
		ExpiryDate:    now.Add(365 * 24 * time.Hour).Format("2006-01-02"),
		NAICOMRef:     fmt.Sprintf("NAI-REF-%d", now.UnixNano()%100000),
		Status:        "valid",
		GeneratedAt:   now,
	}
	s.repo.CreateCertificate(cert)
	return policy, nil
}
