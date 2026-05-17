//go:build testing
// +build testing

// This file contains MockDB used exclusively in unit tests.
// It is excluded from production builds via the 'testing' build tag.
package repository

import (
	"log"
	"reinsurer-api/internal/model"
	"sync"
	"time"
)

// MockDB simulates a database connection and storage.
type MockDB struct {
	Reinsurers map[string]model.Reinsurer
	Quotes     map[string]model.QuoteSubmission
	Claims     map[string]model.ClaimNotification
	mu         sync.RWMutex
}

// NewMockDB creates a new instance of MockDB with some initial data.
func NewMockDB() *MockDB {
	db := &MockDB{
		Reinsurers: make(map[string]model.Reinsurer),
		Quotes:     make(map[string]model.QuoteSubmission),
		Claims:     make(map[string]model.ClaimNotification),
	}
	db.seedData()
	return db
}

func (db *MockDB) seedData() {
	db.Reinsurers["reinsurer-a-id"] = model.Reinsurer{
		ID:        "reinsurer-a-id",
		Name:      "Reinsurer A",
		APIKey:    "reinsurer-a-secret-key",
		IsActive:  true,
		CreatedAt: time.Now(),
	}
	db.Reinsurers["reinsurer-b-id"] = model.Reinsurer{
		ID:        "reinsurer-b-id",
		Name:      "Reinsurer B",
		APIKey:    "reinsurer-b-secret-key",
		IsActive:  true,
		CreatedAt: time.Now(),
	}
	log.Println("MockDB seeded with 2 reinsurers.")
}

// SaveQuote saves a quote submission to the mock database.
func (db *MockDB) SaveQuote(quote model.QuoteSubmission) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.Quotes[quote.QuoteID] = quote
	log.Printf("MockDB: Saved quote %s", quote.QuoteID)
	return nil
}

// SaveClaim saves a claim notification to the mock database.
func (db *MockDB) SaveClaim(claim model.ClaimNotification) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.Claims[claim.ClaimID] = claim
	log.Printf("MockDB: Saved claim %s", claim.ClaimID)
	return nil
}

// GetReinsurerByAPIKey retrieves a reinsurer by their API key.
func (db *MockDB) GetReinsurerByAPIKey(apiKey string) (*model.Reinsurer, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, r := range db.Reinsurers {
		if r.APIKey == apiKey {
			return &r, nil
		}
	}
	return nil, nil // Not found
}
