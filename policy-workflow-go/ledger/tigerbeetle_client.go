package ledger

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/tigerbeetle/tigerbeetle-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// TigerBeetleClient provides a high-level wrapper around the TigerBeetle database client.
// It handles connection management, error handling, and provides convenient methods for
// common operations like creating accounts and processing transfers.
type TigerBeetleClient struct {
	client    tigerbeetle.Client
	clusterID uint32
	addresses []string
	mu        sync.RWMutex
	closed    bool
}

// ClientConfig holds the configuration for creating a TigerBeetle client.
type ClientConfig struct {
	ClusterID          uint32
	Addresses          []string
	MaxConcurrentBatch uint32 // Maximum number of concurrent requests
}

// AccountType represents different types of accounts in the system.
type AccountType uint16

const (
	AccountTypeCompanyReceivables AccountType = 1
	AccountTypeCompanyPayables    AccountType = 2
	AccountTypeCompanyReserves    AccountType = 3
	AccountTypeCompanyCommissions AccountType = 4
	AccountTypeCustomer           AccountType = 100
	AccountTypeAgent              AccountType = 200
	AccountTypeSuspense           AccountType = 300
)

// TransferCode represents different types of transfers in the system.
type TransferCode uint16

const (
	TransferCodePremiumPayment    TransferCode = 1
	TransferCodeRefund            TransferCode = 2
	TransferCodeClaimPayment      TransferCode = 3
	TransferCodeCommission        TransferCode = 4
	TransferCodeReserveAllocation TransferCode = 10
	TransferCodeReserveRelease    TransferCode = 11
)

// NewTigerBeetleClient creates a new client for interacting with TigerBeetle.
// It establishes a connection to the TigerBeetle cluster and returns a client instance.
func NewTigerBeetleClient(config ClientConfig) (*TigerBeetleClient, error) {
	if config.MaxConcurrentBatch == 0 {
		config.MaxConcurrentBatch = 4096 // Default value
	}

	client, err := tigerbeetle.NewClient(
		types.ToUint128(uint64(config.ClusterID)),
		config.Addresses,
		config.MaxConcurrentBatch,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	return &TigerBeetleClient{
		client:    client,
		clusterID: config.ClusterID,
		addresses: config.Addresses,
		closed:    false,
	}, nil
}

// CreateAccount creates a single account in TigerBeetle.
func (c *TigerBeetleClient) CreateAccount(ctx context.Context, account types.Account) error {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	results, err := c.client.CreateAccounts([]types.Account{account})
	if err != nil {
		return fmt.Errorf("failed to create account: %w", err)
	}

	if len(results) > 0 {
		result := results[0]
		if result.Result != types.AccountEventResultOk {
			return fmt.Errorf("account creation failed: %s", accountResultToString(result.Result))
		}
	}

	return nil
}

// CreateAccounts creates multiple accounts in a single batch operation.
// This is more efficient than creating accounts one by one.
func (c *TigerBeetleClient) CreateAccounts(ctx context.Context, accounts []types.Account) ([]types.AccountEventResult, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return nil, fmt.Errorf("failed to create accounts: %w", err)
	}

	return results, nil
}

// CreateTransfer creates a single atomic transfer between two accounts.
func (c *TigerBeetleClient) CreateTransfer(ctx context.Context, transfer types.Transfer) error {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	results, err := c.client.CreateTransfers([]types.Transfer{transfer})
	if err != nil {
		return fmt.Errorf("failed to create transfer: %w", err)
	}

	if len(results) > 0 {
		result := results[0]
		if result.Result != types.TransferEventResultOk {
			return NewTransferError(result.Result, transfer)
		}
	}

	return nil
}

// CreateTransfers creates multiple transfers in a single batch operation.
// All transfers are processed atomically - either all succeed or all fail.
func (c *TigerBeetleClient) CreateTransfers(ctx context.Context, transfers []types.Transfer) ([]types.TransferEventResult, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return nil, fmt.Errorf("failed to create transfers: %w", err)
	}

	return results, nil
}

// LookupAccounts retrieves account information for the given account IDs.
func (c *TigerBeetleClient) LookupAccounts(ctx context.Context, accountIDs []types.Uint128) ([]types.Account, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	accounts, err := c.client.LookupAccounts(accountIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup accounts: %w", err)
	}

	return accounts, nil
}

// LookupTransfers retrieves transfer information for the given transfer IDs.
func (c *TigerBeetleClient) LookupTransfers(ctx context.Context, transferIDs []types.Uint128) ([]types.Transfer, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("client is closed")
	}
	c.mu.RUnlock()

	transfers, err := c.client.LookupTransfers(transferIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup transfers: %w", err)
	}

	return transfers, nil
}

// GetAccountBalance retrieves the current balance of an account.
func (c *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID types.Uint128) (uint64, uint64, error) {
	accounts, err := c.LookupAccounts(ctx, []types.Uint128{accountID})
	if err != nil {
		return 0, 0, err
	}

	if len(accounts) == 0 {
		return 0, 0, fmt.Errorf("account not found: %v", accountID)
	}

	account := accounts[0]
	debitsPosted := types.BigIntFromUint128(account.DebitsPosted)
	creditsPosted := types.BigIntFromUint128(account.CreditsPosted)

	return debitsPosted.Uint64(), creditsPosted.Uint64(), nil
}

// Close closes the connection to the TigerBeetle cluster.
// After calling Close, the client cannot be used anymore.
func (c *TigerBeetleClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("client already closed")
	}

	c.client.Close()
	c.closed = true
	log.Printf("TigerBeetle client closed")

	return nil
}

// IsClosed returns true if the client has been closed.
func (c *TigerBeetleClient) IsClosed() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.closed
}

// GenerateTransferID generates a deterministic transfer ID based on a unique business identifier.
// This ensures idempotency - the same business transaction will always generate the same transfer ID.
func GenerateTransferID(businessID string, sequence int) types.Uint128 {
	data := fmt.Sprintf("%s-%d-%d", businessID, sequence, time.Now().Unix())
	hash := sha256.Sum256([]byte(data))

	// Use first 16 bytes of hash to create a uint128
	high := binary.BigEndian.Uint64(hash[0:8])
	low := binary.BigEndian.Uint64(hash[8:16])

	return types.Uint128{
		High: high,
		Low:  low,
	}
}

// GenerateAccountID generates a deterministic account ID based on entity type and ID.
func GenerateAccountID(entityType string, entityID uint64) types.Uint128 {
	data := fmt.Sprintf("%s-%d", entityType, entityID)
	hash := sha256.Sum256([]byte(data))

	high := binary.BigEndian.Uint64(hash[0:8])
	low := binary.BigEndian.Uint64(hash[8:16])

	return types.Uint128{
		High: high,
		Low:  low,
	}
}

// TransferError represents an error that occurred during a transfer operation.
type TransferError struct {
	Code     types.TransferEventResult
	Transfer types.Transfer
	Message  string
}

func (e *TransferError) Error() string {
	return fmt.Sprintf("transfer failed: %s (code: %d, transfer_id: %v)",
		e.Message, e.Code, e.Transfer.ID)
}

// NewTransferError creates a new TransferError from a result code and transfer.
func NewTransferError(code types.TransferEventResult, transfer types.Transfer) *TransferError {
	return &TransferError{
		Code:     code,
		Transfer: transfer,
		Message:  transferResultToString(code),
	}
}

// IsInsufficientFunds returns true if the error is due to insufficient funds.
func (e *TransferError) IsInsufficientFunds() bool {
	return e.Code == types.TransferEventResultExceedsCredits
}

// IsDuplicate returns true if the error is due to a duplicate transfer ID.
func (e *TransferError) IsDuplicate() bool {
	return e.Code == types.TransferEventResultExists
}

// Helper function to convert account result codes to human-readable strings.
func accountResultToString(result types.AccountEventResult) string {
	switch result {
	case types.AccountEventResultOk:
		return "success"
	case types.AccountEventResultExists:
		return "account already exists"
	case types.AccountEventResultExceedsCredits:
		return "exceeds credits"
	case types.AccountEventResultExceedsDebits:
		return "exceeds debits"
	default:
		return fmt.Sprintf("unknown error code: %d", result)
	}
}

// Helper function to convert transfer result codes to human-readable strings.
func transferResultToString(result types.TransferEventResult) string {
	switch result {
	case types.TransferEventResultOk:
		return "success"
	case types.TransferEventResultExists:
		return "transfer already exists (duplicate ID)"
	case types.TransferEventResultExceedsCredits:
		return "insufficient funds in debit account"
	case types.TransferEventResultExceedsDebits:
		return "exceeds debits limit"
	case types.TransferEventResultDebitAccountNotFound:
		return "debit account not found"
	case types.TransferEventResultCreditAccountNotFound:
		return "credit account not found"
	case types.TransferEventResultAccountsMustBeDifferent:
		return "debit and credit accounts must be different"
	case types.TransferEventResultPendingTransferNotFound:
		return "pending transfer not found"
	case types.TransferEventResultPendingTransferExpired:
		return "pending transfer expired"
	default:
		return fmt.Sprintf("unknown error code: %d", result)
	}
}
