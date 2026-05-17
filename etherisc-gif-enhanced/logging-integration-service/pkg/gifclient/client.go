package gifclient

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"github.com/etherisc/logging-integration-service/pkg/logger"
)

// Policy represents a simplified policy structure for logging.
type Policy struct {
	PolicyID string
	Product  string
	Status   string
}

// Client is a mock client for the Etherisc GIF service.
type Client struct {
	log logger.Logger
}

// NewClient creates a new mock GIF client.
func NewClient(log logger.Logger) *Client {
	return &Client{log: log}
}

// GetPolicy simulates fetching a policy from the GIF service.
func (c *Client) GetPolicy(ctx context.Context, policyID string) (*Policy, error) {
	log := logger.GetLoggerFromContext(ctx)
	log.Info().Str("policy_id", policyID).Msg("Attempting to fetch policy from GIF service")

	// Simulate network latency
	time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)

	// Simulate failure 10% of the time
	if rand.Intn(10) == 0 {
		log.Error().Str("policy_id", policyID).Msg("GIF service connection failed")
		return nil, errors.New("failed to connect to GIF service")
	}

	// Simulate policy not found 5% of the time
	if rand.Intn(20) == 0 {
		log.Warn().Str("policy_id", policyID).Msg("Policy not found in GIF service")
		return nil, nil
	}

	policy := &Policy{
		PolicyID: policyID,
		Product:  "FlightDelay",
		Status:   "Active",
	}

	log.Info().
		Str("policy_id", policyID).
		Str("product", policy.Product).
		Str("status", policy.Status).
		Msg("Successfully fetched policy from GIF service")

	return policy, nil
}
