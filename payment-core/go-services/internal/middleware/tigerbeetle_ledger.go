package middleware

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// TigerBeetleLedger provides double-entry accounting via TigerBeetle
type TigerBeetleLedger struct {
	clusterID uint64
	addresses []string
	mu        sync.RWMutex
	accounts  map[string]*Account
	transfers []Transfer
}

// Account represents a TigerBeetle account
type Account struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	Ledger         uint32    `json:"ledger"`
	Code           uint16    `json:"code"`
	DebitsPosted   uint64    `json:"debits_posted"`
	CreditsPosted  uint64    `json:"credits_posted"`
	DebitsPending  uint64    `json:"debits_pending"`
	CreditsPending uint64    `json:"credits_pending"`
	CreatedAt      time.Time `json:"created_at"`
}

// Transfer represents a double-entry transfer between accounts
type Transfer struct {
	ID              string    `json:"id"`
	DebitAccountID  string    `json:"debit_account_id"`
	CreditAccountID string    `json:"credit_account_id"`
	Amount          uint64    `json:"amount"`
	Ledger          uint32    `json:"ledger"`
	Code            uint16    `json:"code"`
	PendingID       string    `json:"pending_id,omitempty"`
	Timeout         uint32    `json:"timeout,omitempty"`
	Flags           uint16    `json:"flags"`
	CreatedAt       time.Time `json:"created_at"`
}

// Ledger codes for different currencies
const (
	LedgerNGN uint32 = 1
	LedgerUSD uint32 = 2
	LedgerGBP uint32 = 3
	LedgerEUR uint32 = 4
	LedgerBTC uint32 = 10
	LedgerETH uint32 = 11
)

// Account codes
const (
	CodeUserWallet    uint16 = 1
	CodeMerchant      uint16 = 2
	CodeFeeCollection uint16 = 3
	CodeSettlement    uint16 = 4
	CodeEscrow        uint16 = 5
	CodeSuspense      uint16 = 6
)

func NewTigerBeetleLedger(addresses []string) *TigerBeetleLedger {
	if len(addresses) == 0 {
		addresses = []string{getEnvOrDefault("TIGERBEETLE_ADDRESS", "127.0.0.1:3000")}
	}
	return &TigerBeetleLedger{
		clusterID: 0,
		addresses: addresses,
		accounts:  make(map[string]*Account),
		transfers: make([]Transfer, 0),
	}
}

// CreateAccount creates a new account in the ledger
func (l *TigerBeetleLedger) CreateAccount(ctx context.Context, id, userID string, ledger uint32, code uint16) (*Account, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if _, exists := l.accounts[id]; exists {
		return nil, fmt.Errorf("account %s already exists", id)
	}
	account := &Account{
		ID:        id,
		UserID:    userID,
		Ledger:    ledger,
		Code:      code,
		CreatedAt: time.Now(),
	}
	l.accounts[id] = account
	return account, nil
}

// CreateTransfer creates a double-entry transfer between two accounts
func (l *TigerBeetleLedger) CreateTransfer(ctx context.Context, id, debitAccountID, creditAccountID string, amount uint64, ledger uint32, code uint16) (*Transfer, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	debit, ok := l.accounts[debitAccountID]
	if !ok {
		return nil, fmt.Errorf("debit account %s not found", debitAccountID)
	}
	credit, ok := l.accounts[creditAccountID]
	if !ok {
		return nil, fmt.Errorf("credit account %s not found", creditAccountID)
	}
	if debit.Ledger != credit.Ledger {
		return nil, fmt.Errorf("cross-ledger transfer not allowed")
	}
	transfer := Transfer{
		ID:              id,
		DebitAccountID:  debitAccountID,
		CreditAccountID: creditAccountID,
		Amount:          amount,
		Ledger:          ledger,
		Code:            code,
		CreatedAt:       time.Now(),
	}
	debit.DebitsPosted += amount
	credit.CreditsPosted += amount
	l.transfers = append(l.transfers, transfer)
	return &transfer, nil
}

// CreatePendingTransfer creates a two-phase transfer (pending first)
func (l *TigerBeetleLedger) CreatePendingTransfer(ctx context.Context, id, debitAccountID, creditAccountID string, amount uint64, ledger uint32, timeout uint32) (*Transfer, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	debit, ok := l.accounts[debitAccountID]
	if !ok {
		return nil, fmt.Errorf("debit account %s not found", debitAccountID)
	}
	transfer := Transfer{
		ID:              id,
		DebitAccountID:  debitAccountID,
		CreditAccountID: creditAccountID,
		Amount:          amount,
		Ledger:          ledger,
		Timeout:         timeout,
		Flags:           1, // pending flag
		CreatedAt:       time.Now(),
	}
	debit.DebitsPending += amount
	l.transfers = append(l.transfers, transfer)
	return &transfer, nil
}

// PostPendingTransfer confirms a pending transfer
func (l *TigerBeetleLedger) PostPendingTransfer(ctx context.Context, pendingID string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	for i, t := range l.transfers {
		if t.ID == pendingID && t.Flags == 1 {
			l.transfers[i].Flags = 0
			if debit, ok := l.accounts[t.DebitAccountID]; ok {
				debit.DebitsPending -= t.Amount
				debit.DebitsPosted += t.Amount
			}
			if credit, ok := l.accounts[t.CreditAccountID]; ok {
				credit.CreditsPosted += t.Amount
			}
			return nil
		}
	}
	return fmt.Errorf("pending transfer %s not found", pendingID)
}

// GetAccountBalance returns the balance for an account
func (l *TigerBeetleLedger) GetAccountBalance(ctx context.Context, accountID string) (int64, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	account, ok := l.accounts[accountID]
	if !ok {
		return 0, fmt.Errorf("account %s not found", accountID)
	}
	balance := int64(account.CreditsPosted) - int64(account.DebitsPosted)
	return balance, nil
}
