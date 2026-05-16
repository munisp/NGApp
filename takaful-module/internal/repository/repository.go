package repository

import (
	"fmt"
	"sync"
	"takaful-module/internal/models"
	"time"
)

type TakafulRepository struct {
	mu             sync.RWMutex
	funds          map[string]*models.TakafulFund
	participants   map[string]*models.TakafulParticipant
	contributions  []models.TakafulContribution
	distributions  []models.SurplusDistribution
	compliance     []models.ShariaCompliance
}

func NewTakafulRepository() *TakafulRepository {
	repo := &TakafulRepository{
		funds:        make(map[string]*models.TakafulFund),
		participants: make(map[string]*models.TakafulParticipant),
	}
	repo.seedFunds()
	return repo
}

func (r *TakafulRepository) seedFunds() {
	funds := []models.TakafulFund{
		{ID: "TF-001", Name: "Family Takaful Fund", FundType: "family", TotalContributions: 25000000, TabarruPool: 7500000, InvestmentPool: 15000000, ClaimsPaid: 3200000, SurplusAmount: 1800000, WakalaFeeRate: 0.10, MudharabaShare: 0.60, ParticipantCount: 1250, IsActive: true, CreatedAt: time.Now().AddDate(-1, 0, 0)},
		{ID: "TF-002", Name: "General Takaful Fund", FundType: "general", TotalContributions: 18000000, TabarruPool: 5400000, InvestmentPool: 10800000, ClaimsPaid: 2100000, SurplusAmount: 950000, WakalaFeeRate: 0.12, MudharabaShare: 0.55, ParticipantCount: 890, IsActive: true, CreatedAt: time.Now().AddDate(-1, 0, 0)},
		{ID: "TF-003", Name: "Health Takaful Fund", FundType: "health", TotalContributions: 12000000, TabarruPool: 4800000, InvestmentPool: 6000000, ClaimsPaid: 3500000, SurplusAmount: 200000, WakalaFeeRate: 0.08, MudharabaShare: 0.65, ParticipantCount: 620, IsActive: true, CreatedAt: time.Now().AddDate(0, -6, 0)},
	}
	for i := range funds {
		r.funds[funds[i].ID] = &funds[i]
	}
}

func (r *TakafulRepository) GetFunds() []models.TakafulFund {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.TakafulFund
	for _, f := range r.funds {
		result = append(result, *f)
	}
	return result
}

func (r *TakafulRepository) GetFund(id string) (*models.TakafulFund, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	f, ok := r.funds[id]
	if !ok {
		return nil, fmt.Errorf("fund %s not found", id)
	}
	return f, nil
}

func (r *TakafulRepository) UpdateFund(f *models.TakafulFund) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.funds[f.ID] = f
}

func (r *TakafulRepository) AddParticipant(p *models.TakafulParticipant) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.participants[p.ID] = p
	return nil
}

func (r *TakafulRepository) GetParticipant(id string) (*models.TakafulParticipant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.participants[id]
	if !ok {
		return nil, fmt.Errorf("participant %s not found", id)
	}
	return p, nil
}

func (r *TakafulRepository) ListParticipants(fundID string) []models.TakafulParticipant {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.TakafulParticipant
	for _, p := range r.participants {
		if fundID == "" || p.FundID == fundID {
			result = append(result, *p)
		}
	}
	return result
}

func (r *TakafulRepository) AddContribution(c models.TakafulContribution) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.contributions = append(r.contributions, c)
}

func (r *TakafulRepository) GetContributions(participantID string) []models.TakafulContribution {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.TakafulContribution
	for _, c := range r.contributions {
		if c.ParticipantID == participantID {
			result = append(result, c)
		}
	}
	return result
}

func (r *TakafulRepository) AddDistribution(d models.SurplusDistribution) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.distributions = append(r.distributions, d)
}

func (r *TakafulRepository) GetDistributions(fundID string) []models.SurplusDistribution {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.SurplusDistribution
	for _, d := range r.distributions {
		if d.FundID == fundID {
			result = append(result, d)
		}
	}
	return result
}

func (r *TakafulRepository) AddCompliance(c models.ShariaCompliance) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.compliance = append(r.compliance, c)
}

func (r *TakafulRepository) GetCompliance(fundID string) []models.ShariaCompliance {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.ShariaCompliance
	for _, c := range r.compliance {
		if c.FundID == fundID {
			result = append(result, c)
		}
	}
	return result
}
