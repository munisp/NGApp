package db

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/core"
)

// MockRepository is a simple in-memory store for non-accounting data.
// In a real application, this would be a PostgreSQL or similar client.
type MockRepository struct {
	reinsurers sync.Map // map[uint64]*core.Reinsurer
	contracts  sync.Map // map[uint64]*core.ReinsuranceContract
	transactions sync.Map // map[uint64]*core.ReinsuranceTransaction
	nextID     uint64
}

// NewMockRepository creates a new in-memory repository.
func NewMockRepository() *MockRepository {
	return &MockRepository{
		nextID: 1,
	}
}

func (r *MockRepository) generateID() uint64 {
	r.nextID++
	return r.nextID - 1
}

// CreateReinsurer saves a new reinsurer to the store.
func (r *MockRepository) CreateReinsurer(ctx context.Context, reinsurer *core.Reinsurer) error {
	if reinsurer.ID == 0 {
		reinsurer.ID = r.generateID()
	}
	r.reinsurers.Store(reinsurer.ID, reinsurer)
	return nil
}

// GetReinsurerByID retrieves a reinsurer by ID.
func (r *MockRepository) GetReinsurerByID(ctx context.Context, id uint64) (*core.Reinsurer, error) {
	if val, ok := r.reinsurers.Load(id); ok {
		return val.(*core.Reinsurer), nil
	}
	return nil, fmt.Errorf("reinsurer with ID %d not found", id)
}

// CreateContract saves a new reinsurance contract.
func (r *MockRepository) CreateContract(ctx context.Context, contract *core.ReinsuranceContract) error {
	if contract.ID == 0 {
		contract.ID = r.generateID()
	}
	r.contracts.Store(contract.ID, contract)
	return nil
}

// GetContractByPolicyID retrieves a contract by the associated policy ID.
func (r *MockRepository) GetContractByPolicyID(ctx context.Context, policyID uint64) (*core.ReinsuranceContract, error) {
	var foundContract *core.ReinsuranceContract
	r.contracts.Range(func(key, value any) bool {
		contract := value.(*core.ReinsuranceContract)
		if contract.PolicyID == policyID {
			foundContract = contract
			return false // Stop iteration
		}
		return true
	})
	if foundContract != nil {
		return foundContract, nil
	}
	return nil, fmt.Errorf("contract for policy ID %d not found", policyID)
}

// RecordTransaction saves a new reinsurance transaction.
func (r *MockRepository) RecordTransaction(ctx context.Context, transaction *core.ReinsuranceTransaction) error {
	if transaction.ID == 0 {
		transaction.ID = r.generateID()
	}
	transaction.Timestamp = time.Now().UTC()
	r.transactions.Store(transaction.ID, transaction)
	return nil
}

// GetTransactionsByReinsurerID retrieves all transactions for a reinsurer.
func (r *MockRepository) GetTransactionsByReinsurerID(ctx context.Context, reinsurerID uint64) ([]core.ReinsuranceTransaction, error) {
	var transactions []core.ReinsuranceTransaction
	r.transactions.Range(func(key, value any) bool {
		tx := value.(*core.ReinsuranceTransaction)
		// Need to look up the contract to link to the reinsurer
		if val, ok := r.contracts.Load(tx.ContractID); ok {
			contract := val.(*core.ReinsuranceContract)
			if contract.ReinsurerID == reinsurerID {
				transactions = append(transactions, *tx)
			}
		}
		return true
	})
	return transactions, nil
}

// GetUnsettledTransactionsByReinsurerID retrieves transactions that are not yet settled.
// In a real system, this would involve a specific flag or a more complex query.
// For the mock, we'll assume any transaction not of type SETTLEMENT is unsettled.
func (r *MockRepository) GetUnsettledTransactionsByReinsurerID(ctx context.Context, reinsurerID uint64) ([]core.ReinsuranceTransaction, error) {
	var unsettled []core.ReinsuranceTransaction
	r.transactions.Range(func(key, value any) bool {
		tx := value.(*core.ReinsuranceTransaction)
		if tx.Type != core.TransactionTypeSettlement {
			// Need to look up the contract to link to the reinsurer
			if val, ok := r.contracts.Load(tx.ContractID); ok {
				contract := val.(*core.ReinsuranceContract)
				if contract.ReinsurerID == reinsurerID {
					unsettled = append(unsettled, *tx)
				}
			}
		}
		return true
	})
	return unsettled, nil
}
