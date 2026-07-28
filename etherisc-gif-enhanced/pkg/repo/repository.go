package repo

import (
	"context"
	"errors"

	"policy-service-integration/pkg/models"

	"github.com/google/uuid"
)

// Mock implementation of a repository for demonstration purposes.
// In a real application, this would connect to a PostgreSQL database.

var (
	ErrNotFound = errors.New("record not found")
)

// PolicyRepository defines the interface for policy data access.
type PolicyRepository interface {
	CreatePolicy(ctx context.Context, policy *models.Policy) error
	GetPolicyByID(ctx context.Context, id uuid.UUID) (*models.Policy, error)
	UpdatePolicyStatus(ctx context.Context, id uuid.UUID, status models.PolicyStatus) error
	UpdatePolicyParametricDetails(ctx context.Context, id uuid.UUID, txHash, onChainAddress string) error
}

// ParametricPolicyRepository defines the interface for parametric policy data access.
type ParametricPolicyRepository interface {
	CreateParametricPolicy(ctx context.Context, pp *models.ParametricPolicy) error
	GetParametricPolicyByID(ctx context.Context, id uuid.UUID) (*models.ParametricPolicy, error)
}

// Repository combines all repository interfaces.
type Repository interface {
	PolicyRepository
	ParametricPolicyRepository
}

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	Policies map[uuid.UUID]*models.Policy
	ParametricPolicies map[uuid.UUID]*models.ParametricPolicy
}

// NewMockRepository creates a new MockRepository.
func NewMockRepository() *MockRepository {
	return &MockRepository{
		Policies: make(map[uuid.UUID]*models.Policy),
		ParametricPolicies: make(map[uuid.UUID]*models.ParametricPolicy),
	}
}

// CreatePolicy mocks the creation of a Policy record.
func (r *MockRepository) CreatePolicy(ctx context.Context, policy *models.Policy) error {
	r.Policies[policy.ID] = policy
	return nil
}

// GetPolicyByID mocks retrieving a Policy record.
func (r *MockRepository) GetPolicyByID(ctx context.Context, id uuid.UUID) (*models.Policy, error) {
	policy, ok := r.Policies[id]
	if !ok {
		return nil, ErrNotFound
	}
	return policy, nil
}

// UpdatePolicyStatus mocks updating the status of a Policy record.
func (r *MockRepository) UpdatePolicyStatus(ctx context.Context, id uuid.UUID, status models.PolicyStatus) error {
	policy, ok := r.Policies[id]
	if !ok {
		return ErrNotFound
	}
	policy.Status = status
	return nil
}

// UpdatePolicyParametricDetails mocks updating the transaction hash and on-chain address.
func (r *MockRepository) UpdatePolicyParametricDetails(ctx context.Context, id uuid.UUID, txHash, onChainAddress string) error {
	policy, ok := r.Policies[id]
	if !ok {
		return ErrNotFound
	}
	if policy.ParametricPolicyID == nil {
		return errors.New("policy is not parametric")
	}
	pp, ok := r.ParametricPolicies[*policy.ParametricPolicyID]
	if !ok {
		return ErrNotFound
	}
	pp.TxHash = txHash
	pp.OnChainAddress = onChainAddress
	return nil
}

// CreateParametricPolicy mocks the creation of a ParametricPolicy record.
func (r *MockRepository) CreateParametricPolicy(ctx context.Context, pp *models.ParametricPolicy) error {
	r.ParametricPolicies[pp.ID] = pp
	return nil
}

// GetParametricPolicyByID mocks retrieving a ParametricPolicy record.
func (r *MockRepository) GetParametricPolicyByID(ctx context.Context, id uuid.UUID) (*models.ParametricPolicy, error) {
	pp, ok := r.ParametricPolicies[id]
	if !ok {
		return nil, ErrNotFound
	}
	return pp, nil
}
