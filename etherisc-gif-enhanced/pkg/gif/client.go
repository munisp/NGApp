package gif

import (
	"context"
	"errors"
	"fmt"
	"time"

	"policy-service-integration/pkg/models"
)

// GIFClient defines the interface for interacting with the Etherisc GIF backend.
type GIFClient interface {
	// CreatePolicyOnChain simulates sending the policy data to the GIF backend for on-chain creation.
	// It returns a mock transaction hash.
	CreatePolicyOnChain(ctx context.Context, policy *models.ParametricPolicy) (txHash string, err error)

	// GetTransactionStatus simulates checking the status of an on-chain transaction.
	// Statuses: "Pending", "Confirmed", "Failed"
	GetTransactionStatus(ctx context.Context, txHash string) (status string, onChainAddress string, err error)
}

// MockGIFClient is a mock implementation of the GIFClient for demonstration.
type MockGIFClient struct {
	// Map to simulate transaction status and eventual on-chain address
	transactions map[string]struct {
		Status         string
		OnChainAddress string
		Attempts       int
	}
}

// NewMockGIFClient creates a new MockGIFClient.
func NewMockGIFClient() *MockGIFClient {
	return &MockGIFClient{
		transactions: make(map[string]struct {
			Status         string
			OnChainAddress string
			Attempts       int
		}),
	}
}

// CreatePolicyOnChain simulates the on-chain creation process.
func (c *MockGIFClient) CreatePolicyOnChain(ctx context.Context, policy *models.ParametricPolicy) (txHash string, err error) {
	// Simulate a failure for a specific product ID for testing error handling
	if policy.GIFProductID == "FAIL_PRODUCT" {
		return "", errors.New("simulated on-chain creation failure for product")
	}

	// Generate a mock transaction hash
	mockTxHash := fmt.Sprintf("0xmocktxhash%s", policy.ID.String())

	// Initialize transaction status as Pending
	c.transactions[mockTxHash] = struct {
		Status         string
		OnChainAddress string
		Attempts       int
	}{
		Status:         "Pending",
		OnChainAddress: "",
		Attempts:       0,
	}

	return mockTxHash, nil
}

// GetTransactionStatus simulates the transaction confirmation process.
func (c *MockGIFClient) GetTransactionStatus(ctx context.Context, txHash string) (status string, onChainAddress string, err error) {
	tx, ok := c.transactions[txHash]
	if !ok {
		return "", "", errors.New("transaction hash not found")
	}

	tx.Attempts++

	// Simulate confirmation after 3 attempts
	if tx.Attempts >= 3 {
		tx.Status = "Confirmed"
		tx.OnChainAddress = fmt.Sprintf("0xpolicyaddr%s", txHash[len(txHash)-8:])
	}

	// Simulate a failure for a specific transaction hash
	if txHash == "0xmocktxhash-fail" {
		tx.Status = "Failed"
	}

	c.transactions[txHash] = tx

	return tx.Status, tx.OnChainAddress, nil
}

// Service is a mock service layer that uses the GIF client.
type Service struct {
	GIFClient GIFClient
}

// NewService creates a new Service instance.
func NewService(client GIFClient) *Service {
	return &Service{GIFClient: client}
}

// SimulatePolicyCreation is a simple function to demonstrate client usage.
func (s *Service) SimulatePolicyCreation(ctx context.Context, policy *models.ParametricPolicy) (string, error) {
	txHash, err := s.GIFClient.CreatePolicyOnChain(ctx, policy)
	if err != nil {
		return "", fmt.Errorf("failed to create policy on chain: %w", err)
	}

	// Simulate waiting for confirmation
	for i := 0; i < 5; i++ {
		status, addr, err := s.GIFClient.GetTransactionStatus(ctx, txHash)
		if err != nil {
			return "", fmt.Errorf("failed to get transaction status: %w", err)
		}

		if status == "Confirmed" {
			return addr, nil
		} else if status == "Failed" {
			return "", errors.New("transaction failed on chain")
		}

		time.Sleep(100 * time.Millisecond) // Simulate polling delay
	}

	return "", errors.New("transaction timed out")
}
