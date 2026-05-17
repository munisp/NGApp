package tigerbeetle

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// Client wraps the TigerBeetle client and provides accounting operations.
type Client struct {
	tbClient types.Client
	logger   *slog.Logger
}

// NewClient creates a new TigerBeetle client.
func NewClient(addresses []string, logger *slog.Logger) (*Client, error) {
	tbClient, err := tb.NewClient(types.Addresses(addresses))
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}
	return &Client{
		tbClient: tbClient,
		logger:   logger,
	}, nil
}

// Close closes the TigerBeetle client connection.
func (c *Client) Close() {
	c.tbClient.Close()
}

// CreateAccount creates a new account in TigerBeetle.
func (c *Client) CreateAccount(ctx context.Context, id uint64, ledger uint32, code uint16, flags types.AccountFlags) error {
	account := types.Account{
		ID:     types.Uint128(id),
		Ledger: ledger,
		Code:   code,
		Flags:  flags,
		Timestamp: types.ToUint128(uint64(time.Now().UnixNano())),
	}

	results, err := c.tbClient.CreateAccounts([]types.Account{account})
	if err != nil {
		return fmt.Errorf("failed to create account %d: %w", id, err)
	}

	if len(results) > 0 {
		return fmt.Errorf("failed to create account %d, result code: %s", id, results[0].Result)
	}

	c.logger.Info("Account created successfully", "id", id, "ledger", ledger, "code", code)
	return nil
}

// CreateReinsurerAccounts creates all necessary accounts for a new reinsurer.
// It returns the IDs of the created accounts: CededPremium, ClaimRecovery, Settlement.
func (c *Client) CreateReinsurerAccounts(ctx context.Context, reinsurerID uint64) (cededID, recoveryID, settlementID uint64, err error) {
	// Generate unique IDs for the accounts. A simple scheme is to use the reinsurerID
	// and append a unique suffix (e.g., 1, 2, 3) to form a 128-bit ID.
	// For simplicity and using uint64, we'll use a scheme that ensures uniqueness
	// within the application's ID space, e.g., by using a large base ID.
	// In a real system, a proper ID generation service would be used.
	// For this task, we'll use a simple offset from the reinsurerID.
	// TigerBeetle IDs are 128-bit, but the Go client accepts uint64 for convenience
	// when the high 64 bits are zero. We'll assume a 64-bit ID space for simplicity.

	// Base ID for the reinsurer's accounts (e.g., 1000000000000000000 + reinsurerID * 100)
	// This is a placeholder for a robust ID generation strategy.
	baseID := uint64(1000000000000000000) + reinsurerID*100

	cededID = baseID + 1
	recoveryID = baseID + 2
	settlementID = baseID + 3

	// Ledger ID for Reinsurance Accounting (e.g., 100)
	const reinsuranceLedger uint32 = 100

	// Account Codes (placeholders, should be defined in a central registry)
	const (
		// Ceded Premium: Liability/Revenue for the reinsurer (Debit: increase, Credit: decrease)
		// From GIF's perspective, this is an expense/asset account (Debit: increase, Credit: decrease)
		// Let's assume GIF's perspective:
		// 1. Ceded Premium: Expense/Asset (Debit: increase, Credit: decrease) -> Code 4001
		// 2. Claim Recovery: Revenue/Liability (Credit: increase, Debit: decrease) -> Code 5001
		// 3. Settlement: Clearing/Asset (Debit: increase, Credit: decrease) -> Code 1001
		// TigerBeetle accounts are double-entry, so we only need to define the account type (Asset/Liability/etc.)
		// For simplicity, we'll use generic codes and rely on the transfer to define the nature.
		// Let's use the TigerBeetle standard: 1000-1999 Assets, 2000-2999 Liabilities, 3000-3999 Owner's Equity, 4000-4999 Revenues, 5000-5999 Expenses
		// Reinsurer Ceded Premium Account (GIF's Liability to Reinsurer) -> Liability
		ReinsurerCededPremiumCode uint16 = 2001
		// Reinsurer Claim Recovery Account (GIF's Asset from Reinsurer) -> Asset
		ReinsurerClaimRecoveryCode uint16 = 1001
		// Reinsurer Settlement Account (Clearing) -> Asset
		ReinsurerSettlementCode uint16 = 1002
	)

	accounts := []struct {
		id    uint64
		code  uint16
		flags types.AccountFlags
	}{
		{cededID, ReinsurerCededPremiumCode, types.AccountFlags{DebitsMustNotExceedCredits: false}},
		{recoveryID, ReinsurerClaimRecoveryCode, types.AccountFlags{DebitsMustNotExceedCredits: false}},
		{settlementID, ReinsurerSettlementCode, types.AccountFlags{DebitsMustNotExceedCredits: false}},
	}

	tbAccounts := make([]types.Account, len(accounts))
	for i, acc := range accounts {
		tbAccounts[i] = types.Account{
			ID:     types.Uint128(acc.id),
			Ledger: reinsuranceLedger,
			Code:   acc.code,
			Flags:  acc.flags,
			Timestamp: types.ToUint128(uint64(time.Now().UnixNano())),
		}
	}

	results, err := c.tbClient.CreateAccounts(tbAccounts)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to create reinsurer accounts: %w", err)
	}

	if len(results) > 0 {
		return 0, 0, 0, fmt.Errorf("failed to create one or more reinsurer accounts, first error: %s", results[0].Result)
	}

	c.logger.Info("Reinsurer accounts created successfully", "reinsurer_id", reinsurerID)
	return cededID, recoveryID, settlementID, nil
}

// PostTransfer posts a single transfer to TigerBeetle.
func (c *Client) PostTransfer(ctx context.Context, id uint64, debitAccountID, creditAccountID uint64, amount uint64, currency uint16, ledger uint32, code uint16) (uint64, error) {
	transfer := types.Transfer{
		ID:              types.Uint128(id),
		DebitAccountID:  types.Uint128(debitAccountID),
		CreditAccountID: types.Uint128(creditAccountID),
		Amount:          types.ToUint128(amount),
		Currency:        currency,
		Ledger:          ledger,
		Code:            code,
		Timestamp: types.ToUint128(uint64(time.Now().UnixNano())),
	}

	results, err := c.tbClient.CreateTransfers([]types.Transfer{transfer})
	if err != nil {
		return 0, fmt.Errorf("failed to post transfer %d: %w", id, err)
	}

	if len(results) > 0 {
		return 0, fmt.Errorf("failed to post transfer %d, result code: %s", id, results[0].Result)
	}

	c.logger.Info("Transfer posted successfully", "id", id, "debit", debitAccountID, "credit", creditAccountID, "amount", amount)
	return id, nil
}

// GetAccountBalance retrieves the current balance of an account.
func (c *Client) GetAccountBalance(ctx context.Context, accountID uint64) (uint64, error) {
	accounts, err := c.tbClient.LookupAccounts([]types.Uint128{types.Uint128(accountID)})
	if err != nil {
		return 0, fmt.Errorf("failed to lookup account %d: %w", accountID, err)
	}

	if len(accounts) == 0 {
		return 0, fmt.Errorf("account %d not found", accountID)
	}

	// The balance is the difference between credits and debits.
	// TigerBeetle stores `credits_posted` and `debits_posted` as 128-bit integers.
	credits := types.ToBigInt(accounts[0].CreditsPosted)
	debits := types.ToBigInt(accounts[0].DebitsPosted)

	balance := new(big.Int).Sub(credits, debits)
	
	// Convert back to uint64 for simplicity, assuming the balance fits.
	if balance.Sign() < 0 {
		// Handle negative balance if necessary, but for this task, we'll assume
		// the settlement account balance is what we care about, and it can be negative.
		// For a clearing account, the absolute value is what matters for settlement.
		// We'll return the absolute value and let the caller decide the sign.
		return balance.Abs(balance).Uint64(), nil
	}

	return balance.Uint64(), nil
}
