package service

import (
	"context"
	"customer-360-view/internal/models"
	"customer-360-view/internal/repository"
	"fmt"
	"math"
	"time"
)

type Customer360Service struct{ repo *repository.Customer360Repository }

func NewCustomer360Service(repo *repository.Customer360Repository) *Customer360Service {
	return &Customer360Service{repo: repo}
}

type CustomerDashboard struct {
	Profile      *models.CustomerProfile     `json:"profile"`
	Policies     []models.PolicySummary      `json:"policies"`
	Claims       []models.ClaimSummary       `json:"claims"`
	Interactions []models.InteractionLog     `json:"interactions"`
	Payments     []models.PaymentHistory     `json:"payments"`
	RiskProfile  *models.CustomerRiskProfile `json:"risk_profile"`
	Summary      CustomerSummary             `json:"summary"`
}

type CustomerSummary struct {
	ActivePolicies    int     `json:"active_policies"`
	TotalPremium      float64 `json:"total_premium"`
	TotalClaimsPaid   float64 `json:"total_claims_paid"`
	LifetimeValue     float64 `json:"lifetime_value"`
	ClaimsRatio       float64 `json:"claims_ratio"`
	Segment           string  `json:"segment"`
	RelationshipYears int     `json:"relationship_years"`
}

func (s *Customer360Service) CreateProfile(ctx context.Context, req CreateProfileRequest) (*models.CustomerProfile, error) {
	profile := &models.CustomerProfile{
		CustomerRef: req.CustomerRef, FirstName: req.FirstName, LastName: req.LastName,
		Email: req.Email, Phone: req.Phone, DateOfBirth: req.DateOfBirth,
		Gender: req.Gender, Address: req.Address, City: req.City,
		State: req.State, LGA: req.LGA, BVN: req.BVN, NIN: req.NIN,
		Occupation: req.Occupation, EmployerName: req.EmployerName,
		AnnualIncome: req.AnnualIncome, RiskCategory: "standard",
		SegmentCode: "bronze", KYCStatus: "pending",
	}
	if err := s.repo.CreateProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}
	return profile, nil
}

func (s *Customer360Service) GetFullDashboard(ctx context.Context, customerRef string) (*CustomerDashboard, error) {
	profile, err := s.repo.GetProfile(ctx, customerRef)
	if err != nil { return nil, fmt.Errorf("customer not found") }
	policies, _ := s.repo.GetPolicies(ctx, customerRef)
	claims, _ := s.repo.GetClaims(ctx, customerRef)
	interactions, _ := s.repo.GetInteractions(ctx, customerRef)
	payments, _ := s.repo.GetPayments(ctx, customerRef)
	riskProfile, _ := s.repo.GetRiskProfile(ctx, customerRef)

	activePolicies, _ := s.repo.GetActivePolicyCount(ctx, customerRef)
	totalPremium, _ := s.repo.GetTotalPremium(ctx, customerRef)
	totalClaimsPaid, _ := s.repo.GetTotalClaimsPaid(ctx, customerRef)
	claimsRatio := 0.0
	if totalPremium > 0 { claimsRatio = totalClaimsPaid / totalPremium }
	years := 0
	if len(policies) > 0 { years = int(time.Since(policies[len(policies)-1].InceptionDate).Hours() / 8760) }
	ltv := totalPremium*float64(years+1) - totalClaimsPaid

	summary := CustomerSummary{
		ActivePolicies: int(activePolicies), TotalPremium: totalPremium,
		TotalClaimsPaid: totalClaimsPaid, LifetimeValue: ltv,
		ClaimsRatio: math.Round(claimsRatio*10000) / 100,
		Segment: profile.SegmentCode, RelationshipYears: years,
	}

	return &CustomerDashboard{
		Profile: profile, Policies: policies, Claims: claims,
		Interactions: interactions, Payments: payments,
		RiskProfile: riskProfile, Summary: summary,
	}, nil
}

func (s *Customer360Service) CalculateRiskProfile(ctx context.Context, customerRef string) (*models.CustomerRiskProfile, error) {
	claims, _ := s.repo.GetClaims(ctx, customerRef)
	totalPremium, _ := s.repo.GetTotalPremium(ctx, customerRef)
	totalClaimsPaid, _ := s.repo.GetTotalClaimsPaid(ctx, customerRef)

	claimsRisk := math.Min(float64(len(claims))*15, 100)
	paymentRisk := 20.0 // default medium
	fraudRisk := 10.0
	if totalPremium > 0 && totalClaimsPaid/totalPremium > 0.8 { fraudRisk = 60 }
	overall := (claimsRisk*0.4 + paymentRisk*0.3 + fraudRisk*0.3)

	rp := &models.CustomerRiskProfile{
		CustomerRef: customerRef, OverallScore: math.Round(overall*100) / 100,
		ClaimsRisk: claimsRisk, PaymentRisk: paymentRisk, FraudRisk: fraudRisk,
		Factors: map[string]interface{}{
			"total_claims": len(claims), "claims_ratio": totalClaimsPaid / math.Max(totalPremium, 1),
		},
		LastCalculated: time.Now(),
	}
	if err := s.repo.SaveRiskProfile(ctx, rp); err != nil {
		return nil, fmt.Errorf("failed to save risk profile: %w", err)
	}
	return rp, nil
}

func (s *Customer360Service) UpdateSegment(ctx context.Context, customerRef string) (*models.CustomerProfile, error) {
	profile, err := s.repo.GetProfile(ctx, customerRef)
	if err != nil { return nil, fmt.Errorf("customer not found") }
	activePolicies, _ := s.repo.GetActivePolicyCount(ctx, customerRef)
	totalPremium, _ := s.repo.GetTotalPremium(ctx, customerRef)

	if totalPremium >= 5000000 || activePolicies >= 5 { profile.SegmentCode = "platinum"
	} else if totalPremium >= 2000000 || activePolicies >= 3 { profile.SegmentCode = "gold"
	} else if totalPremium >= 500000 || activePolicies >= 2 { profile.SegmentCode = "silver"
	} else { profile.SegmentCode = "bronze" }

	profile.LifetimeValue = totalPremium
	if err := s.repo.UpdateProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to update segment: %w", err)
	}
	return profile, nil
}

func (s *Customer360Service) AddPolicy(ctx context.Context, req AddPolicyRequest) (*models.PolicySummary, error) {
	ps := &models.PolicySummary{
		CustomerRef: req.CustomerRef, PolicyNumber: req.PolicyNumber, PolicyType: req.PolicyType,
		ProductName: req.ProductName, Status: req.Status, Premium: req.Premium,
		SumAssured: req.SumAssured, InceptionDate: req.InceptionDate, ExpiryDate: req.ExpiryDate,
		AgentCode: req.AgentCode,
	}
	if err := s.repo.AddPolicy(ctx, ps); err != nil {
		return nil, fmt.Errorf("failed to add policy: %w", err)
	}
	return ps, nil
}

func (s *Customer360Service) AddInteraction(ctx context.Context, req AddInteractionRequest) (*models.InteractionLog, error) {
	il := &models.InteractionLog{
		CustomerRef: req.CustomerRef, Channel: req.Channel, Type: req.Type,
		Subject: req.Subject, Description: req.Description, AgentID: req.AgentID,
		Status: "open", Metadata: req.Metadata,
	}
	if err := s.repo.AddInteraction(ctx, il); err != nil {
		return nil, fmt.Errorf("failed to add interaction: %w", err)
	}
	return il, nil
}

func (s *Customer360Service) SearchCustomers(ctx context.Context, query, segment string) ([]models.CustomerProfile, error) {
	return s.repo.SearchProfiles(ctx, query, segment)
}
