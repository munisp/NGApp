package service

import (
	"agent-network-platform/internal/models"
	"agent-network-platform/internal/repository"
	"fmt"
	"time"
)

type AgentService struct {
	repo *repository.AgentRepository
}

func NewAgentService(repo *repository.AgentRepository) *AgentService {
	return &AgentService{repo: repo}
}

type RegisterRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	NIN     string `json:"nin"`
	Region  string `json:"region"`
	State   string `json:"state"`
	LGA     string `json:"lga"`
	Address string `json:"address"`
}

func (s *AgentService) Register(req RegisterRequest) (*models.Agent, error) {
	if req.Name == "" || req.Phone == "" {
		return nil, fmt.Errorf("name and phone are required")
	}
	if req.NIN == "" {
		return nil, fmt.Errorf("NIN is required for agent verification")
	}

	tier, rate := s.assignInitialTier()

	agent := &models.Agent{
		ID:             fmt.Sprintf("AGT-%d", time.Now().UnixNano()%10000000),
		Name:           req.Name,
		Email:          req.Email,
		Phone:          req.Phone,
		NIN:            req.NIN,
		Region:         req.Region,
		State:          req.State,
		LGA:            req.LGA,
		Address:        req.Address,
		Tier:           tier,
		Status:         models.AgentPending,
		CommissionRate: rate,
		Rating:         5.0,
		CreatedAt:      time.Now(),
	}

	if err := s.repo.Create(agent); err != nil {
		return nil, err
	}
	return agent, nil
}

func (s *AgentService) assignInitialTier() (models.AgentTier, float64) {
	return models.TierBronze, 0.05
}

type SaleRequest struct {
	AgentID    string  `json:"agent_id"`
	PolicyID   string  `json:"policy_id"`
	CustomerID string  `json:"customer_id"`
	Product    string  `json:"product"`
	Premium    float64 `json:"premium"`
	Channel    string  `json:"channel"`
}

func (s *AgentService) RecordSale(req SaleRequest) (*models.AgentSale, error) {
	agent, err := s.repo.GetByID(req.AgentID)
	if err != nil {
		return nil, err
	}
	if agent.Status != models.AgentActive && agent.Status != models.AgentPending {
		return nil, fmt.Errorf("agent %s is not active", req.AgentID)
	}
	if req.Premium <= 0 {
		return nil, fmt.Errorf("premium must be positive")
	}

	commission := req.Premium * agent.CommissionRate

	sale := models.AgentSale{
		ID:         fmt.Sprintf("SALE-%d", time.Now().UnixNano()%10000000),
		AgentID:    req.AgentID,
		PolicyID:   req.PolicyID,
		CustomerID: req.CustomerID,
		Product:    req.Product,
		Premium:    req.Premium,
		Commission: commission,
		Status:     "completed",
		Channel:    req.Channel,
		CreatedAt:  time.Now(),
	}
	s.repo.RecordSale(sale)

	s.checkTierUpgrade(agent)

	return &sale, nil
}

func (s *AgentService) checkTierUpgrade(agent *models.Agent) {
	var newTier models.AgentTier
	var newRate float64
	switch {
	case agent.TotalSales >= 10000000:
		newTier, newRate = models.TierPlatinum, 0.12
	case agent.TotalSales >= 5000000:
		newTier, newRate = models.TierGold, 0.10
	case agent.TotalSales >= 1000000:
		newTier, newRate = models.TierSilver, 0.07
	default:
		return
	}
	if newTier != agent.Tier {
		agent.Tier = newTier
		agent.CommissionRate = newRate
		s.repo.Update(agent)
	}
}

func (s *AgentService) VerifyAgent(id string) error {
	agent, err := s.repo.GetByID(id)
	if err != nil { return err }
	now := time.Now()
	agent.Status = models.AgentActive
	agent.VerifiedAt = &now
	s.repo.Update(agent)
	return nil
}

func (s *AgentService) GetAgent(id string) (*models.Agent, error) { return s.repo.GetByID(id) }
func (s *AgentService) ListAgents(region, status string) []models.Agent { return s.repo.List(region, status) }
func (s *AgentService) GetSales(agentID string) []models.AgentSale { return s.repo.GetSales(agentID) }
func (s *AgentService) GetStats() map[string]interface{} { return s.repo.GetStats() }
