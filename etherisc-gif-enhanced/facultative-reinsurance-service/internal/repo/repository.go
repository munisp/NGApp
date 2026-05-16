package repo

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/etherisc/facultative-reinsurance-service/internal/model"
)

// Repository defines the interface for data access operations.
type Repository interface {
	// Policy operations
	GetPolicyByID(ctx context.Context, policyID string) (*model.Policy, error)
	SavePolicy(ctx context.Context, policy *model.Policy) error

	// Reinsurer operations
	GetReinsurerByID(ctx context.Context, reinsurerID string) (*model.Reinsurer, error)
	GetAllReinsurers(ctx context.Context) ([]*model.Reinsurer, error)

	// Quote operations
	SaveQuote(ctx context.Context, quote *model.ReinsuranceQuote) error
	GetQuoteByID(ctx context.Context, quoteID string) (*model.ReinsuranceQuote, error)

	// Ceded Reinsurance operations
	SaveCededReinsurance(ctx context.Context, cededRe *model.CededReinsurance) error
	GetCededReinsuranceByPolicyID(ctx context.Context, policyID string) (*model.CededReinsurance, error)

	// Claim Cession operations
	SaveClaimCession(ctx context.Context, cession *model.ClaimCession) error
	GetClaimCessionByClaimID(ctx context.Context, claimID string) (*model.ClaimCession, error)
}

// MockRepository is a simple in-memory implementation for development/testing.
type MockRepository struct {
	mu sync.RWMutex
	policies map[string]*model.Policy
	reinsurers map[string]*model.Reinsurer
	quotes map[string]*model.ReinsuranceQuote
	cededReinsurances map[string]*model.CededReinsurance
	claimCessions map[string]*model.ClaimCession
}

func NewMockRepository() *MockRepository {
	repo := &MockRepository{
		policies: make(map[string]*model.Policy),
		reinsurers: make(map[string]*model.Reinsurer),
		quotes: make(map[string]*model.ReinsuranceQuote),
		cededReinsurances: make(map[string]*model.CededReinsurance),
		claimCessions: make(map[string]*model.ClaimCession),
	}
	// Seed initial data for testing
	repo.seedData()
	return repo
}

func (r *MockRepository) seedData() {
	r.reinsurers["R001"] = &model.Reinsurer{
		ID: "R001", Name: "Global Re", Rating: "A+", Capacity: 10000000.00, ContactEmail: "global@re.com",
	}
	r.reinsurers["R002"] = &model.Reinsurer{
		ID: "R002", Name: "Local Re", Rating: "B", Capacity: 1000000.00, ContactEmail: "local@re.com",
	}
	r.policies["P001"] = &model.Policy{
		PolicyID: "P001", InsuredName: "Alice Smith", SumInsured: 5000000.00, Premium: 50000.00,
		StartDate: time.Now(), EndDate: time.Now().AddDate(1, 0, 0), IsCeded: false,
	}
}

// Policy operations
func (r *MockRepository) GetPolicyByID(ctx context.Context, policyID string) (*model.Policy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.policies[policyID]; ok {
		return p, nil
	}
	return nil, errors.New("policy not found")
}

func (r *MockRepository) SavePolicy(ctx context.Context, policy *model.Policy) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[policy.PolicyID] = policy
	return nil
}

// Reinsurer operations
func (r *MockRepository) GetReinsurerByID(ctx context.Context, reinsurerID string) (*model.Reinsurer, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if re, ok := r.reinsurers[reinsurerID]; ok {
		return re, nil
	}
	return nil, errors.New("reinsurer not found")
}

func (r *MockRepository) GetAllReinsurers(ctx context.Context) ([]*model.Reinsurer, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	reinsurers := make([]*model.Reinsurer, 0, len(r.reinsurers))
	for _, re := range r.reinsurers {
		reinsurers = append(reinsurers, re)
	}
	return reinsurers, nil
}

// Quote operations
func (r *MockRepository) SaveQuote(ctx context.Context, quote *model.ReinsuranceQuote) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.quotes[quote.QuoteID] = quote
	return nil
}

func (r *MockRepository) GetQuoteByID(ctx context.Context, quoteID string) (*model.ReinsuranceQuote, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if q, ok := r.quotes[quoteID]; ok {
		return q, nil
	}
	return nil, errors.New("quote not found")
}

// Ceded Reinsurance operations
func (r *MockRepository) SaveCededReinsurance(ctx context.Context, cededRe *model.CededReinsurance) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cededReinsurances[cededRe.ContractID] = cededRe
	return nil
}

func (r *MockRepository) GetCededReinsuranceByPolicyID(ctx context.Context, policyID string) (*model.CededReinsurance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, cr := range r.cededReinsurances {
		if cr.PolicyID == policyID {
			return cr, nil
		}
	}
	return nil, errors.New("ceded reinsurance contract not found for policy")
}

// Claim Cession operations
func (r *MockRepository) SaveClaimCession(ctx context.Context, cession *model.ClaimCession) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.claimCessions[cession.CessionID] = cession
	return nil
}

func (r *MockRepository) GetClaimCessionByClaimID(ctx context.Context, claimID string) (*model.ClaimCession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, cc := range r.claimCessions {
		if cc.ClaimID == claimID {
			return cc, nil
		}
	}
	return nil, errors.New("claim cession not found")
}
