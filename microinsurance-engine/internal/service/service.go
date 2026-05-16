package service

import (
	"fmt"
	"math"
	"microinsurance-engine/internal/models"
	"microinsurance-engine/internal/repository"
	"time"
)

type MicroService struct {
	repo *repository.MicroRepository
}

func NewMicroService(repo *repository.MicroRepository) *MicroService {
	return &MicroService{repo: repo}
}

type EnrollRequest struct {
	ProductID     string  `json:"product_id"`
	CustomerID    string  `json:"customer_id"`
	CustomerName  string  `json:"customer_name"`
	CustomerPhone string  `json:"customer_phone"`
	Channel       string  `json:"channel"`
	PaymentRef    string  `json:"payment_ref"`
}

func (s *MicroService) Enroll(req EnrollRequest) (*models.MicroPolicy, error) {
	product, err := s.repo.GetProduct(req.ProductID)
	if err != nil {
		return nil, err
	}
	if !product.IsActive {
		return nil, fmt.Errorf("product %s is not active", req.ProductID)
	}
	if req.CustomerPhone == "" {
		return nil, fmt.Errorf("customer phone is required for microinsurance")
	}

	premium := s.calculatePremium(product, req.Channel)
	now := time.Now()

	policy := &models.MicroPolicy{
		ID:             fmt.Sprintf("MIP-%d", time.Now().UnixNano()%10000000),
		ProductID:      product.ID,
		CustomerID:     req.CustomerID,
		CustomerName:   req.CustomerName,
		CustomerPhone:  req.CustomerPhone,
		Premium:        premium,
		CoverageAmount: product.CoverageAmount,
		Currency:       product.Currency,
		Status:         "active",
		StartDate:      now,
		EndDate:        now.AddDate(0, 0, product.DurationDays),
		Channel:        req.Channel,
		PaymentRef:     req.PaymentRef,
		CreatedAt:      now,
	}

	if err := s.repo.CreatePolicy(policy); err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *MicroService) calculatePremium(product *models.MicroProduct, channel string) float64 {
	base := product.MinPremium
	premium := base * product.RiskMultiplier

	switch channel {
	case "ussd":
		premium *= 0.90
	case "whatsapp":
		premium *= 0.95
	case "agent":
		premium *= 1.05
	}

	premium = math.Round(premium/50) * 50
	if premium < product.MinPremium {
		premium = product.MinPremium
	}
	if premium > product.MaxPremium {
		premium = product.MaxPremium
	}
	return premium
}

type ClaimRequest struct {
	PolicyID    string  `json:"policy_id"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	Evidence    string  `json:"evidence"`
}

func (s *MicroService) FileClaim(req ClaimRequest) (*models.MicroClaim, error) {
	policy, err := s.repo.GetPolicy(req.PolicyID)
	if err != nil {
		return nil, err
	}
	if policy.Status != "active" {
		return nil, fmt.Errorf("policy %s is not active", req.PolicyID)
	}
	if time.Now().After(policy.EndDate) {
		return nil, fmt.Errorf("policy %s has expired", req.PolicyID)
	}

	product, _ := s.repo.GetProduct(policy.ProductID)
	if product != nil {
		claimCount := s.repo.CountClaimsForPolicy(req.PolicyID)
		if claimCount >= product.MaxClaimsPerYear {
			return nil, fmt.Errorf("maximum claims (%d) reached for this policy", product.MaxClaimsPerYear)
		}
		if product.ClaimWaitDays > 0 {
			waitUntil := policy.StartDate.AddDate(0, 0, product.ClaimWaitDays)
			if time.Now().Before(waitUntil) {
				return nil, fmt.Errorf("claim waiting period: cannot claim until %s", waitUntil.Format("2006-01-02"))
			}
		}
	}

	if req.Amount > policy.CoverageAmount {
		return nil, fmt.Errorf("claim amount %.2f exceeds coverage %.2f", req.Amount, policy.CoverageAmount)
	}
	if req.Amount <= 0 {
		return nil, fmt.Errorf("claim amount must be positive")
	}

	status := "pending"
	reviewNotes := ""
	if req.Amount <= 5000 && req.Evidence != "" {
		status = "auto_approved"
		reviewNotes = "Auto-approved: low value claim with evidence"
	}

	claim := &models.MicroClaim{
		ID:          fmt.Sprintf("MIC-%d", time.Now().UnixNano()%10000000),
		PolicyID:    req.PolicyID,
		CustomerID:  policy.CustomerID,
		Amount:      req.Amount,
		Description: req.Description,
		Evidence:    req.Evidence,
		Status:      status,
		ReviewNotes: reviewNotes,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateClaim(claim); err != nil {
		return nil, err
	}
	return claim, nil
}

func (s *MicroService) GetProducts() []models.MicroProduct {
	return s.repo.GetProducts()
}

func (s *MicroService) GetProduct(id string) (*models.MicroProduct, error) {
	return s.repo.GetProduct(id)
}

func (s *MicroService) GetPolicy(id string) (*models.MicroPolicy, error) {
	return s.repo.GetPolicy(id)
}

func (s *MicroService) ListPolicies(customerID string) []models.MicroPolicy {
	return s.repo.ListPolicies(customerID)
}

func (s *MicroService) GetClaim(id string) (*models.MicroClaim, error) {
	return s.repo.GetClaim(id)
}

func (s *MicroService) GetStats() map[string]interface{} {
	return s.repo.GetStats()
}
