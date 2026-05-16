package service

import (
	"context"
	"fmt"
	"math"
	"policy-renewal-automation/internal/models"
	"policy-renewal-automation/internal/repository"
	"time"
	"github.com/google/uuid"
)

type RenewalService struct{ repo *repository.RenewalRepository }

func NewRenewalService(repo *repository.RenewalRepository) *RenewalService {
	return &RenewalService{repo: repo}
}

func (s *RenewalService) RegisterPolicy(ctx context.Context, req RegisterPolicyRequest) (*models.RenewalPolicy, error) {
	policy := &models.RenewalPolicy{
		PolicyNumber: req.PolicyNumber, PolicyType: req.PolicyType, CustomerID: req.CustomerID,
		CustomerName: req.CustomerName, CurrentPremium: req.CurrentPremium, SumAssured: req.SumAssured,
		InceptionDate: req.InceptionDate, ExpiryDate: req.ExpiryDate,
		RenewalDate: req.ExpiryDate.AddDate(0, 0, -30),
		ClaimsCount: req.ClaimsCount, ClaimsAmount: req.ClaimsAmount,
		AutoRenew: req.AutoRenew, AgentID: req.AgentID, RenewalStatus: "pending",
	}
	policy.RiskScore = s.calculateRiskScore(policy)
	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("failed to register policy: %w", err)
	}
	return policy, nil
}

func (s *RenewalService) GenerateQuote(ctx context.Context, policyID uuid.UUID) (*models.RenewalQuote, error) {
	policy, err := s.repo.GetPolicy(ctx, policyID)
	if err != nil { return nil, fmt.Errorf("policy not found") }

	claimsLoading := 0.0
	if policy.ClaimsCount > 0 {
		claimsRatio := policy.ClaimsAmount / policy.CurrentPremium
		if claimsRatio > 0.7 { claimsLoading = 0.20 } else if claimsRatio > 0.5 { claimsLoading = 0.10 } else if claimsRatio > 0.3 { claimsLoading = 0.05 }
	}
	inflationAdj := 0.08 // 8% annual inflation adjustment for Nigeria
	loyaltyDiscount := 0.0
	if policy.ClaimsCount == 0 { loyaltyDiscount = 0.10 } else if policy.ClaimsCount <= 1 { loyaltyDiscount = 0.05 }

	campaigns, _ := s.repo.ListActiveCampaigns(ctx)
	campaignDiscount := 0.0
	for _, c := range campaigns {
		if c.PolicyType == policy.PolicyType || c.PolicyType == "" {
			daysToExpiry := int(policy.ExpiryDate.Sub(time.Now()).Hours() / 24)
			if daysToExpiry <= c.TargetDaysBeforeExpiry {
				campaignDiscount = math.Min(c.DiscountPercent/100, c.MaxDiscount/policy.CurrentPremium)
				break
			}
		}
	}

	totalDiscount := loyaltyDiscount + campaignDiscount
	totalLoading := claimsLoading + inflationAdj
	newPremium := policy.CurrentPremium * (1 + totalLoading - totalDiscount)
	newPremium = math.Round(newPremium*100) / 100

	quote := &models.RenewalQuote{
		PolicyID: policyID, PolicyNumber: policy.PolicyNumber,
		PreviousPremium: policy.CurrentPremium, NewPremium: newPremium,
		PremiumChange: newPremium - policy.CurrentPremium,
		ChangePercent: math.Round(((newPremium-policy.CurrentPremium)/policy.CurrentPremium)*10000) / 100,
		RatingFactors: map[string]interface{}{
			"claims_loading": claimsLoading, "inflation_adj": inflationAdj,
			"loyalty_discount": loyaltyDiscount, "campaign_discount": campaignDiscount,
			"risk_score": policy.RiskScore,
		},
		DiscountApplied: totalDiscount * policy.CurrentPremium,
		LoadingApplied: totalLoading * policy.CurrentPremium,
		ValidUntil: policy.ExpiryDate.AddDate(0, 0, 30), Status: "draft",
	}
	if err := s.repo.CreateQuote(ctx, quote); err != nil {
		return nil, fmt.Errorf("failed to create quote: %w", err)
	}
	policy.RenewalStatus = "quoted"
	s.repo.UpdatePolicy(ctx, policy)
	return quote, nil
}

func (s *RenewalService) ProcessDueRenewals(ctx context.Context, daysAhead int) (int, error) {
	policies, err := s.repo.GetPoliciesDueForRenewal(ctx, daysAhead)
	if err != nil { return 0, fmt.Errorf("failed to get due policies: %w", err) }
	processed := 0
	for _, policy := range policies {
		if policy.RenewalStatus == "pending" {
			notif := &models.RenewalNotification{
				PolicyID: policy.ID, PolicyNumber: policy.PolicyNumber, CustomerID: policy.CustomerID,
				NotificationType: s.getNotificationType(policy.ExpiryDate),
				Channel: "email", TemplateName: "renewal_reminder", Status: "pending",
			}
			s.repo.CreateNotification(ctx, notif)
			policy.RenewalStatus = "notified"
			s.repo.UpdatePolicy(ctx, &policy)
			processed++
		}
	}
	return processed, nil
}

func (s *RenewalService) AcceptRenewal(ctx context.Context, policyID uuid.UUID) error {
	policy, err := s.repo.GetPolicy(ctx, policyID)
	if err != nil { return fmt.Errorf("policy not found") }
	quotes, _ := s.repo.GetQuotesByPolicy(ctx, policyID)
	if len(quotes) == 0 { return fmt.Errorf("no quote available") }
	latestQuote := quotes[0]
	policy.RenewalStatus = "accepted"
	policy.CurrentPremium = latestQuote.NewPremium
	policy.InceptionDate = policy.ExpiryDate
	policy.ExpiryDate = policy.ExpiryDate.AddDate(1, 0, 0)
	policy.RenewalDate = policy.ExpiryDate.AddDate(0, 0, -30)
	policy.ClaimsCount = 0; policy.ClaimsAmount = 0
	return s.repo.UpdatePolicy(ctx, policy)
}

func (s *RenewalService) DeclineRenewal(ctx context.Context, policyID uuid.UUID) error {
	policy, err := s.repo.GetPolicy(ctx, policyID)
	if err != nil { return fmt.Errorf("policy not found") }
	policy.RenewalStatus = "declined"
	return s.repo.UpdatePolicy(ctx, policy)
}

func (s *RenewalService) CreateCampaign(ctx context.Context, req CreateCampaignRequest) (*models.RenewalCampaign, error) {
	campaign := &models.RenewalCampaign{
		Name: req.Name, PolicyType: req.PolicyType,
		TargetDaysBeforeExpiry: req.TargetDaysBeforeExpiry,
		DiscountPercent: req.DiscountPercent, MaxDiscount: req.MaxDiscount,
		StartDate: req.StartDate, EndDate: req.EndDate, IsActive: true,
	}
	if err := s.repo.CreateCampaign(ctx, campaign); err != nil {
		return nil, fmt.Errorf("failed to create campaign: %w", err)
	}
	return campaign, nil
}

func (s *RenewalService) CalculateMetrics(ctx context.Context, period, policyType string) (*models.RenewalMetrics, error) {
	renewed, _ := s.repo.CountByStatus(ctx, "accepted")
	lapsed, _ := s.repo.CountByStatus(ctx, "lapsed")
	totalDue := renewed + lapsed
	renewalRate := 0.0
	if totalDue > 0 { renewalRate = float64(renewed) / float64(totalDue) * 100 }
	premiumRetained, _ := s.repo.GetTotalPremiumByStatus(ctx, "accepted")
	premiumLost, _ := s.repo.GetTotalPremiumByStatus(ctx, "lapsed")

	metrics := &models.RenewalMetrics{
		Period: period, PolicyType: policyType, TotalDue: int(totalDue),
		Renewed: int(renewed), Lapsed: int(lapsed),
		RenewalRate: math.Round(renewalRate*100) / 100,
		PremiumRetained: premiumRetained, PremiumLost: premiumLost,
	}
	if err := s.repo.CreateMetrics(ctx, metrics); err != nil {
		return nil, fmt.Errorf("failed to create metrics: %w", err)
	}
	return metrics, nil
}

func (s *RenewalService) GetPolicies(ctx context.Context, status, policyType string) ([]models.RenewalPolicy, error) {
	return s.repo.ListPolicies(ctx, status, policyType)
}

func (s *RenewalService) GetPolicy(ctx context.Context, id uuid.UUID) (*models.RenewalPolicy, error) {
	return s.repo.GetPolicy(ctx, id)
}

func (s *RenewalService) GetQuotes(ctx context.Context, policyID uuid.UUID) ([]models.RenewalQuote, error) {
	return s.repo.GetQuotesByPolicy(ctx, policyID)
}

func (s *RenewalService) GetCampaigns(ctx context.Context) ([]models.RenewalCampaign, error) {
	return s.repo.ListActiveCampaigns(ctx)
}

func (s *RenewalService) GetMetrics(ctx context.Context, policyType string) ([]models.RenewalMetrics, error) {
	return s.repo.GetMetrics(ctx, policyType)
}

func (s *RenewalService) calculateRiskScore(p *models.RenewalPolicy) float64 {
	score := 50.0
	if p.ClaimsCount > 3 { score += 30 } else if p.ClaimsCount > 1 { score += 15 } else if p.ClaimsCount > 0 { score += 5 }
	if p.ClaimsAmount > p.CurrentPremium*2 { score += 20 } else if p.ClaimsAmount > p.CurrentPremium { score += 10 }
	return math.Min(score, 100)
}

func (s *RenewalService) getNotificationType(expiryDate time.Time) string {
	days := int(expiryDate.Sub(time.Now()).Hours() / 24)
	if days > 60 { return "90_day" }
	if days > 30 { return "60_day" }
	if days > 14 { return "30_day" }
	if days > 7 { return "14_day" }
	return "7_day"
}
