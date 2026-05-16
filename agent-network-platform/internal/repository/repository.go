package repository

import (
	"agent-network-platform/internal/models"
	"fmt"
	"sync"
	"time"
)

type AgentRepository struct {
	mu         sync.RWMutex
	agents     map[string]*models.Agent
	sales      []models.AgentSale
	targets    map[string]*models.AgentTarget
	territories map[string]*models.AgentTerritory
}

func NewAgentRepository() *AgentRepository {
	return &AgentRepository{
		agents:      make(map[string]*models.Agent),
		targets:     make(map[string]*models.AgentTarget),
		territories: make(map[string]*models.AgentTerritory),
	}
}

func (r *AgentRepository) Create(a *models.Agent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[a.ID] = a
	return nil
}

func (r *AgentRepository) GetByID(id string) (*models.Agent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.agents[id]
	if !ok {
		return nil, fmt.Errorf("agent %s not found", id)
	}
	return a, nil
}

func (r *AgentRepository) Update(a *models.Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[a.ID] = a
}

func (r *AgentRepository) List(region, status string) []models.Agent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Agent
	for _, a := range r.agents {
		if region != "" && a.Region != region { continue }
		if status != "" && string(a.Status) != status { continue }
		result = append(result, *a)
	}
	return result
}

func (r *AgentRepository) RecordSale(sale models.AgentSale) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sales = append(r.sales, sale)
	if a, ok := r.agents[sale.AgentID]; ok {
		a.TotalSales += sale.Premium
		a.TotalCommission += sale.Commission
		a.PoliciesSold++
		a.ActivePolicies++
		now := time.Now()
		a.LastActiveAt = &now
	}
}

func (r *AgentRepository) GetSales(agentID string) []models.AgentSale {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.AgentSale
	for _, s := range r.sales {
		if s.AgentID == agentID {
			result = append(result, s)
		}
	}
	return result
}

func (r *AgentRepository) SetTarget(t *models.AgentTarget) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.targets[t.AgentID+"-"+t.Period] = t
}

func (r *AgentRepository) GetTarget(agentID, period string) *models.AgentTarget {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.targets[agentID+"-"+period]
}

func (r *AgentRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	active := 0
	totalSales := 0.0
	totalComm := 0.0
	for _, a := range r.agents {
		if a.Status == models.AgentActive { active++ }
		totalSales += a.TotalSales
		totalComm += a.TotalCommission
	}
	return map[string]interface{}{
		"total_agents": len(r.agents), "active_agents": active,
		"total_sales": totalSales, "total_commissions": totalComm,
		"total_transactions": len(r.sales),
	}
}
