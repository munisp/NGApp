package service

import (
	"context"
	"fmt"
	"strings"

	"customer-service/internal/models"
	"customer-service/internal/repository"
)

type CustomerService struct{ repo *repository.CustomerRepository }

func NewCustomerService(repo *repository.CustomerRepository) *CustomerService {
	return &CustomerService{repo: repo}
}

func (s *CustomerService) RegisterCustomer(ctx context.Context, c *models.Customer) error {
	if c.FirstName == "" || c.LastName == "" { return fmt.Errorf("first_name and last_name are required") }
	if c.Email == "" { return fmt.Errorf("email is required") }
	if c.Phone == "" { return fmt.Errorf("phone is required") }
	c.RiskScore = s.calculateInitialRiskScore(c)
	return s.repo.Create(ctx, c)
}

func (s *CustomerService) GetCustomer(ctx context.Context, id string) (*models.Customer, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *CustomerService) ListCustomers(ctx context.Context, filter models.CustomerFilter) ([]models.Customer, error) {
	return s.repo.List(ctx, filter)
}

func (s *CustomerService) UpdateCustomer(ctx context.Context, c *models.Customer) error {
	existing, err := s.repo.GetByID(ctx, c.ID)
	if err != nil { return err }
	if existing.KYCStatus == models.KYCSuspended { return fmt.Errorf("cannot update suspended customer") }
	return s.repo.Update(ctx, c)
}

func (s *CustomerService) DeleteCustomer(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *CustomerService) VerifyKYC(ctx context.Context, id string) error {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	if c.BVN == "" && c.NIN == "" { return fmt.Errorf("BVN or NIN required for KYC verification") }
	if c.KYCStatus == models.KYCVerified { return fmt.Errorf("customer already verified") }
	c.KYCStatus = models.KYCVerified
	c.Tier = s.assessTier(c)
	return s.repo.Update(ctx, c)
}

func (s *CustomerService) SuspendCustomer(ctx context.Context, id string) error {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil { return err }
	c.KYCStatus = models.KYCSuspended
	return s.repo.Update(ctx, c)
}

func (s *CustomerService) GetCustomerPolicies(ctx context.Context, id string) ([]models.CustomerPolicy, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil { return nil, err }
	return s.repo.GetPolicies(ctx, id)
}

func (s *CustomerService) GetCustomerClaims(ctx context.Context, id string) ([]models.CustomerClaim, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil { return nil, err }
	return s.repo.GetClaims(ctx, id)
}

func (s *CustomerService) GetCustomerPayments(ctx context.Context, id string) ([]models.CustomerPayment, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil { return nil, err }
	return s.repo.GetPayments(ctx, id)
}

func (s *CustomerService) GetCustomer360(ctx context.Context, id string) (map[string]interface{}, error) {
	c, err := s.repo.GetByID(ctx, id)
	if err != nil { return nil, err }
	policies, _ := s.repo.GetPolicies(ctx, id)
	claims, _ := s.repo.GetClaims(ctx, id)
	payments, _ := s.repo.GetPayments(ctx, id)
	totalPremium := 0.0
	for _, p := range policies { totalPremium += p.Premium }
	totalClaims := 0.0
	for _, cl := range claims { totalClaims += cl.Amount }
	return map[string]interface{}{
		"customer": c, "policies": policies, "claims": claims, "payments": payments,
		"summary": map[string]interface{}{
			"total_policies": len(policies), "total_claims": len(claims), "total_payments": len(payments),
			"total_premium": totalPremium, "total_claims_amount": totalClaims,
			"loss_ratio": func() float64 { if totalPremium > 0 { return totalClaims / totalPremium }; return 0 }(),
		},
	}, nil
}

func (s *CustomerService) calculateInitialRiskScore(c *models.Customer) float64 {
	score := 50.0
	if c.BVN != "" { score += 15 }
	if c.NIN != "" { score += 15 }
	if c.Email != "" && strings.Contains(c.Email, "@") { score += 5 }
	if c.Phone != "" { score += 5 }
	if c.Address != "" { score += 5 }
	if score > 100 { score = 100 }
	return score
}

func (s *CustomerService) assessTier(c *models.Customer) string {
	if c.RiskScore >= 90 { return models.TierPlatinum }
	if c.RiskScore >= 75 { return models.TierGold }
	if c.RiskScore >= 50 { return models.TierSilver }
	return models.TierBronze
}
