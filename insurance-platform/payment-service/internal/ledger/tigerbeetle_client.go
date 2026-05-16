package ledger

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// TigerBeetleClient wraps the TigerBeetle client for financial transactions
type TigerBeetleClient struct {
	client tb.Client
}

// Account represents a financial account in the ledger
type Account struct {
	ID             types.Uint128
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	UserData128    types.Uint128
	UserData64     uint64
	UserData32     uint32
	Reserved       uint32
	Ledger         uint32
	Code           uint16
	Flags          uint16
	Timestamp      uint64
}

// Transfer represents a financial transfer between accounts
type Transfer struct {
	ID              types.Uint128
	DebitAccountID  types.Uint128
	CreditAccountID types.Uint128
	Amount          uint64
	PendingID       types.Uint128
	UserData128     types.Uint128
	UserData64      uint64
	UserData32      uint32
	Timeout         uint32
	Ledger          uint32
	Code            uint16
	Flags           uint16
	Timestamp       uint64
}

// NewTigerBeetleClient creates a new TigerBeetle client
func NewTigerBeetleClient(clusterID uint128, addresses []string) (*TigerBeetleClient, error) {
	client, err := tb.NewClient(clusterID, addresses)
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	return &TigerBeetleClient{
		client: client,
	}, nil
}

// CreateAccount creates a new account in the ledger
func (t *TigerBeetleClient) CreateAccount(ctx context.Context, accountID types.Uint128, ledger uint32, code uint16) error {
	accounts := []types.Account{
		{
			ID:        accountID,
			Ledger:    ledger,
			Code:      code,
			Flags:     0,
			Timestamp: uint64(time.Now().UnixNano()),
		},
	}

	results, err := t.client.CreateAccounts(accounts)
	if err != nil {
		return fmt.Errorf("failed to create account: %w", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("account creation failed with result: %v", results[0].Result)
	}

	log.Printf("Account created successfully: %v", accountID)
	return nil
}

// CreateTransfer creates a transfer between two accounts
func (t *TigerBeetleClient) CreateTransfer(ctx context.Context, transferID, debitAccountID, creditAccountID types.Uint128, amount uint64, ledger uint32, code uint16) error {
	transfers := []types.Transfer{
		{
			ID:              transferID,
			DebitAccountID:  debitAccountID,
			CreditAccountID: creditAccountID,
			Amount:          amount,
			Ledger:          ledger,
			Code:            code,
			Flags:           0,
			Timestamp:       uint64(time.Now().UnixNano()),
		},
	}

	results, err := t.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("failed to create transfer: %w", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("transfer creation failed with result: %v", results[0].Result)
	}

	log.Printf("Transfer created successfully: %v", transferID)
	return nil
}

// CreatePendingTransfer creates a pending transfer (two-phase commit)
func (t *TigerBeetleClient) CreatePendingTransfer(ctx context.Context, transferID, debitAccountID, creditAccountID types.Uint128, amount uint64, ledger uint32, code uint16, timeout uint32) error {
	transfers := []types.Transfer{
		{
			ID:              transferID,
			DebitAccountID:  debitAccountID,
			CreditAccountID: creditAccountID,
			Amount:          amount,
			Ledger:          ledger,
			Code:            code,
			Flags:           types.TransferFlags{Pending: true}.ToUint16(),
			Timeout:         timeout,
			Timestamp:       uint64(time.Now().UnixNano()),
		},
	}

	results, err := t.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("failed to create pending transfer: %w", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("pending transfer creation failed with result: %v", results[0].Result)
	}

	log.Printf("Pending transfer created successfully: %v", transferID)
	return nil
}

// PostPendingTransfer posts (commits) a pending transfer
func (t *TigerBeetleClient) PostPendingTransfer(ctx context.Context, postTransferID, pendingTransferID types.Uint128, ledger uint32, code uint16) error {
	transfers := []types.Transfer{
		{
			ID:        postTransferID,
			PendingID: pendingTransferID,
			Ledger:    ledger,
			Code:      code,
			Flags:     types.TransferFlags{PostPendingTransfer: true}.ToUint16(),
			Timestamp: uint64(time.Now().UnixNano()),
		},
	}

	results, err := t.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("failed to post pending transfer: %w", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("post pending transfer failed with result: %v", results[0].Result)
	}

	log.Printf("Pending transfer posted successfully: %v", pendingTransferID)
	return nil
}

// VoidPendingTransfer voids (cancels) a pending transfer
func (t *TigerBeetleClient) VoidPendingTransfer(ctx context.Context, voidTransferID, pendingTransferID types.Uint128, ledger uint32, code uint16) error {
	transfers := []types.Transfer{
		{
			ID:        voidTransferID,
			PendingID: pendingTransferID,
			Ledger:    ledger,
			Code:      code,
			Flags:     types.TransferFlags{VoidPendingTransfer: true}.ToUint16(),
			Timestamp: uint64(time.Now().UnixNano()),
		},
	}

	results, err := t.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("failed to void pending transfer: %w", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("void pending transfer failed with result: %v", results[0].Result)
	}

	log.Printf("Pending transfer voided successfully: %v", pendingTransferID)
	return nil
}

// LookupAccounts retrieves account information
func (t *TigerBeetleClient) LookupAccounts(ctx context.Context, accountIDs []types.Uint128) ([]types.Account, error) {
	accounts, err := t.client.LookupAccounts(accountIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup accounts: %w", err)
	}

	return accounts, nil
}

// LookupTransfers retrieves transfer information
func (t *TigerBeetleClient) LookupTransfers(ctx context.Context, transferIDs []types.Uint128) ([]types.Transfer, error) {
	transfers, err := t.client.LookupTransfers(transferIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup transfers: %w", err)
	}

	return transfers, nil
}

// GetAccountBalance retrieves the current balance of an account
func (t *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID types.Uint128) (uint64, uint64, error) {
	accounts, err := t.LookupAccounts(ctx, []types.Uint128{accountID})
	if err != nil {
		return 0, 0, err
	}

	if len(accounts) == 0 {
		return 0, 0, errors.New("account not found")
	}

	account := accounts[0]
	return account.CreditsPosted - account.DebitsPosted, account.CreditsPending - account.DebitsPending, nil
}

// Close closes the TigerBeetle client connection
func (t *TigerBeetleClient) Close() {
	t.client.Close()
}

// Helper function to convert uint128
func uint128(high, low uint64) types.Uint128 {
	return types.Uint128{
		High: high,
		Low:  low,
	}
}
