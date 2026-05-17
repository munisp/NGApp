package service

import (
	"context"
	"agent-mobile-app/internal/models"
	"agent-mobile-app/internal/repository"
	"fmt"
	"time"
)

type AgentMobileService struct{ repo *repository.AgentMobileRepository }
func NewAgentMobileService(repo *repository.AgentMobileRepository) *AgentMobileService {
	return &AgentMobileService{repo: repo}
}

func (s *AgentMobileService) GetDashboard(ctx context.Context, agentCode string) (*models.AgentDashboardStats, error) {
	agent, err := s.repo.GetAgent(ctx, agentCode)
	if err != nil { return nil, fmt.Errorf("agent not found") }

	totalLeads, _ := s.repo.CountLeads(ctx, agentCode, "")
	activeLeads, _ := s.repo.CountLeads(ctx, agentCode, "contacted")
	convertedLeads, _ := s.repo.CountLeads(ctx, agentCode, "converted")
	totalQuotes, _ := s.repo.CountQuotes(ctx, agentCode, "")
	pendingQuotes, _ := s.repo.CountQuotes(ctx, agentCode, "sent")
	monthlyPremium, _ := s.repo.SumMonthlyPremium(ctx, agentCode)
	monthlyCommission, _ := s.repo.SumMonthlyCommission(ctx, agentCode)

	convRate := 0.0
	if totalLeads > 0 { convRate = float64(convertedLeads) / float64(totalLeads) * 100 }

	return &models.AgentDashboardStats{
		AgentCode: agentCode, TotalLeads: int(totalLeads), ActiveLeads: int(activeLeads),
		ConvertedLeads: int(convertedLeads), ConversionRate: convRate,
		TotalQuotes: int(totalQuotes), PendingQuotes: int(pendingQuotes),
		MonthlyPremium: monthlyPremium, MonthlyCommission: monthlyCommission,
		Tier: agent.Tier, Rating: agent.Rating,
	}, nil
}

func (s *AgentMobileService) CreateLead(ctx context.Context, req CreateLeadRequest) (*models.AgentLead, error) {
	lead := &models.AgentLead{
		AgentCode: req.AgentCode, CustomerName: req.CustomerName,
		CustomerPhone: req.CustomerPhone, CustomerEmail: req.CustomerEmail,
		ProductType: req.ProductType, EstimatedPremium: req.EstimatedPremium,
		Priority: req.Priority, Notes: req.Notes, FollowUpDate: req.FollowUpDate,
		Location: req.Location, Status: "new",
	}
	if lead.Priority == "" { lead.Priority = "medium" }
	if err := s.repo.CreateLead(ctx, lead); err != nil {
		return nil, fmt.Errorf("failed to create lead: %w", err)
	}
	s.repo.LogActivity(ctx, &models.AgentActivity{AgentCode: req.AgentCode, ActivityType: "lead_added", Description: "New lead: " + req.CustomerName, ReferenceID: lead.ID.String()})
	return lead, nil
}

func (s *AgentMobileService) UpdateLead(ctx context.Context, leadID string, req UpdateLeadRequest) error {
	leads, _ := s.repo.GetLeads(ctx, "", "")
	for _, l := range leads {
		if l.ID.String() == leadID {
			if req.Status != "" { l.Status = req.Status }
			if req.Notes != "" { l.Notes = req.Notes }
			if req.FollowUpDate != nil { l.FollowUpDate = req.FollowUpDate }
			if req.Status == "converted" { now := time.Now(); l.ConvertedAt = &now }
			return s.repo.UpdateLead(ctx, &l)
		}
	}
	return fmt.Errorf("lead not found")
}

func (s *AgentMobileService) CreateQuote(ctx context.Context, req CreateQuoteRequest) (*models.AgentQuote, error) {
	agent, err := s.repo.GetAgent(ctx, req.AgentCode)
	if err != nil { return nil, fmt.Errorf("agent not found") }

	premium := s.calculatePremium(req.ProductType, req.SumAssured, req.Duration)
	commission := premium * agent.CommissionRate / 100

	quote := &models.AgentQuote{
		QuoteRef: fmt.Sprintf("QT-%d", time.Now().UnixNano()%1000000),
		AgentCode: req.AgentCode, LeadID: req.LeadID, CustomerName: req.CustomerName,
		ProductType: req.ProductType, ProductName: req.ProductName,
		SumAssured: req.SumAssured, Premium: premium, Commission: commission,
		Duration: req.Duration, Status: "draft", ValidUntil: time.Now().AddDate(0, 0, 30),
		Details: req.Details,
	}
	if err := s.repo.CreateQuote(ctx, quote); err != nil {
		return nil, fmt.Errorf("failed to create quote: %w", err)
	}
	s.repo.LogActivity(ctx, &models.AgentActivity{AgentCode: req.AgentCode, ActivityType: "quote_created", Description: fmt.Sprintf("Quote %s for %s", quote.QuoteRef, req.CustomerName), ReferenceID: quote.QuoteRef, Amount: premium})
	return quote, nil
}

func (s *AgentMobileService) calculatePremium(productType string, sumAssured float64, durationMonths int) float64 {
	baseRate := map[string]float64{
		"life": 0.025, "motor": 0.04, "health": 0.035, "property": 0.02, "travel": 0.015,
	}
	rate := baseRate[productType]
	if rate == 0 { rate = 0.03 }
	annualPremium := sumAssured * rate
	return annualPremium * float64(durationMonths) / 12.0
}

func (s *AgentMobileService) RegisterDevice(ctx context.Context, req RegisterDeviceRequest) error {
	agent, err := s.repo.GetAgent(ctx, req.AgentCode)
	if err != nil { return fmt.Errorf("agent not found") }
	agent.DeviceID = req.DeviceID; agent.PushToken = req.PushToken
	now := time.Now(); agent.LastLoginAt = &now
	return s.repo.UpdateAgent(ctx, agent)
}

func (s *AgentMobileService) GetLeads(ctx context.Context, agentCode, status string) ([]models.AgentLead, error) { return s.repo.GetLeads(ctx, agentCode, status) }
func (s *AgentMobileService) GetQuotes(ctx context.Context, agentCode string) ([]models.AgentQuote, error) { return s.repo.GetQuotes(ctx, agentCode) }
func (s *AgentMobileService) GetActivities(ctx context.Context, agentCode string) ([]models.AgentActivity, error) { return s.repo.GetActivities(ctx, agentCode, 30) }
func (s *AgentMobileService) GetProfile(ctx context.Context, agentCode string) (*models.AgentProfile, error) { return s.repo.GetAgent(ctx, agentCode) }
