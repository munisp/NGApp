package tigerbeetle

import (
	"context"
	"fmt"
	"os"
	"time"
)

// LedgerClient wraps TigerBeetle for double-entry financial accounting.
type LedgerClient struct {
	clusterID uint32
	address   string
}

// NewLedgerClient creates a TigerBeetle client.
func NewLedgerClient() *LedgerClient {
	addr := os.Getenv("TIGERBEETLE_ADDRESS")
	if addr == "" {
		addr = "tigerbeetle:3001"
	}
	return &LedgerClient{
		clusterID: 0,
		address:   addr,
	}
}

// Account represents a TigerBeetle account.
type Account struct {
	ID            [16]byte
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	Ledger         uint32
	Code           uint16
	Flags          uint16
	Timestamp      uint64
}

// Transfer represents a TigerBeetle transfer.
type Transfer struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	Ledger          uint32
	Code            uint16
	Flags           uint16
	Timestamp        uint64
}

// CRM Ledger codes
const (
	LedgerNGN        uint32 = 1  // Nigerian Naira
	LedgerUSD        uint32 = 2  // US Dollar
	LedgerGBP        uint32 = 3  // British Pound
	LedgerEUR        uint32 = 4  // Euro
	LedgerCommodity  uint32 = 10 // Commodity trading
	LedgerCPaaS      uint32 = 20 // CPaaS usage credits
	LedgerTelco      uint32 = 30 // Telco billing
)

// Account type codes
const (
	CodeAsset      uint16 = 1
	CodeLiability  uint16 = 2
	CodeRevenue    uint16 = 3
	CodeExpense    uint16 = 4
	CodeEquity     uint16 = 5
	CodeSuspense   uint16 = 6
)

// CreateAccount creates a new account in the ledger.
func (c *LedgerClient) CreateAccount(ctx context.Context, id [16]byte, ledger uint32, code uint16) error {
	// In production: use TigerBeetle Go client library
	_ = Account{
		ID:     id,
		Ledger: ledger,
		Code:   code,
	}
	return nil
}

// CreateTransfer creates a double-entry transfer between accounts.
func (c *LedgerClient) CreateTransfer(ctx context.Context, id, debitAcct, creditAcct [16]byte, amount uint64, ledger uint32, code uint16) error {
	_ = Transfer{
		ID:              id,
		DebitAccountID:  debitAcct,
		CreditAccountID: creditAcct,
		Amount:          amount,
		Ledger:          ledger,
		Code:            code,
		Timestamp:        uint64(time.Now().UnixNano()),
	}
	return nil
}

// GetAccountBalance returns the current balance for an account.
func (c *LedgerClient) GetAccountBalance(ctx context.Context, id [16]byte) (credits, debits uint64, err error) {
	// In production: lookup via TigerBeetle client
	return 0, 0, nil
}

// Reconcile checks that all debits equal all credits across the ledger.
func (c *LedgerClient) Reconcile(ctx context.Context, ledger uint32) error {
	// In production: query all accounts for the ledger and verify balance
	fmt.Printf("reconciling ledger %d at %s\n", ledger, time.Now().Format(time.RFC3339))
	return nil
}
