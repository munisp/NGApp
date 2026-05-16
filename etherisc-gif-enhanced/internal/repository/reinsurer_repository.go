package repository

import (
	"reinsurer-api/internal/model"
)

// ReinsurerRepository defines the interface for data access operations.
type ReinsurerRepository interface {
	SaveQuote(quote model.QuoteSubmission) error
	SaveClaim(claim model.ClaimNotification) error
	GetReinsurerByAPIKey(apiKey string) (*model.Reinsurer, error)
}

// ReinsurerDB is the storage backend interface accepted by reinsurerRepository.
// Both the test stub (testing build tag) and PostgresReinsurerDB (production) satisfy this interface.
type ReinsurerDB interface {
	SaveQuote(quote model.QuoteSubmission) error
	SaveClaim(claim model.ClaimNotification) error
	GetReinsurerByAPIKey(apiKey string) (*model.Reinsurer, error)
}

// reinsurerRepository implements ReinsurerRepository backed by a ReinsurerDB.
type reinsurerRepository struct {
	db ReinsurerDB
}

// NewReinsurerRepository creates a new instance of reinsurerRepository.
func NewReinsurerRepository(db ReinsurerDB) ReinsurerRepository {
	return &reinsurerRepository{db: db}
}

// SaveQuote implements ReinsurerRepository.
func (r *reinsurerRepository) SaveQuote(quote model.QuoteSubmission) error {
	return r.db.SaveQuote(quote)
}

// SaveClaim implements ReinsurerRepository.
func (r *reinsurerRepository) SaveClaim(claim model.ClaimNotification) error {
	return r.db.SaveClaim(claim)
}

// GetReinsurerByAPIKey implements ReinsurerRepository.
func (r *reinsurerRepository) GetReinsurerByAPIKey(apiKey string) (*model.Reinsurer, error) {
	return r.db.GetReinsurerByAPIKey(apiKey)
}
