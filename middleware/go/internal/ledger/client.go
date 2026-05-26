// Package ledger wraps the TigerBeetle Go client for production accounting.
// Volumes are stored as integer units × 1000 (i.e. millibbl or mscf).
// Falls back to an in-memory simulated client when TigerBeetle is unavailable.
package ledger

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	tb_types "github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// ─── Types ────────────────────────────────────────────────────────────────────

// AccountID maps a well or field to a TigerBeetle account.
type AccountID = tb_types.Uint128

// Transfer represents a production allocation entry.
type Transfer struct {
	ID              string    `json:"id"`
	DebitAccountID  string    `json:"debitAccountId"`
	CreditAccountID string    `json:"creditAccountId"`
	Amount          uint64    `json:"amount"`
	Ledger          uint32    `json:"ledger"`
	Code            uint16    `json:"code"`
	Timestamp       time.Time `json:"timestamp"`
}

// AccountBalance holds the current balance for an account.
type AccountBalance struct {
	AccountID string `json:"accountId"`
	Debits    uint64 `json:"debits"`
	Credits   uint64 `json:"credits"`
	Balance   int64  `json:"balance"`
}

// ─── Interface ────────────────────────────────────────────────────────────────

// LedgerClient defines the operations available on the ledger.
type LedgerClient interface {
	CreateAccount(ctx context.Context, id string, ledger uint32, code uint16) error
	CreateTransfer(ctx context.Context, t Transfer) error
	GetAccountBalance(ctx context.Context, accountID string) (*AccountBalance, error)
	GetTransfers(ctx context.Context, accountID string, limit int) ([]Transfer, error)
	Close()
}

// ─── Real client ──────────────────────────────────────────────────────────────

type realClient struct {
	client tb.Client
}

// NewClient connects to TigerBeetle at the given address (host:port).
func NewClient(address string) (LedgerClient, error) {
	client, err := tb.NewClient(0, []string{address}, 32)
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle connect: %w", err)
	}
	return &realClient{client: client}, nil
}

func (c *realClient) Close() {
	c.client.Close()
}

func (c *realClient) CreateAccount(ctx context.Context, id string, ledger uint32, code uint16) error {
	uid, err := tb_types.HexStringToUint128(id)
	if err != nil {
		return fmt.Errorf("invalid account id: %w", err)
	}
	accounts := []tb_types.Account{{
		ID:     uid,
		Ledger: ledger,
		Code:   code,
		Flags:  tb_types.AccountFlags{}.ToUint16(),
	}}
	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return err
	}
	for _, r := range results {
		if r.Result != tb_types.AccountOK {
			return fmt.Errorf("account creation failed: %v", r.Result)
		}
	}
	return nil
}

func (c *realClient) CreateTransfer(ctx context.Context, t Transfer) error {
	tid, err := tb_types.HexStringToUint128(t.ID)
	if err != nil {
		return err
	}
	daid, err := tb_types.HexStringToUint128(t.DebitAccountID)
	if err != nil {
		return err
	}
	caid, err := tb_types.HexStringToUint128(t.CreditAccountID)
	if err != nil {
		return err
	}
	transfers := []tb_types.Transfer{{
		ID:              tid,
		DebitAccountID:  daid,
		CreditAccountID: caid,
		Amount:          tb_types.ToUint128(t.Amount),
		Ledger:          t.Ledger,
		Code:            t.Code,
	}}
	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return err
	}
	for _, r := range results {
		if r.Result != tb_types.TransferOK {
			return fmt.Errorf("transfer failed: %v", r.Result)
		}
	}
	return nil
}

func (c *realClient) GetAccountBalance(ctx context.Context, accountID string) (*AccountBalance, error) {
	uid, err := tb_types.HexStringToUint128(accountID)
	if err != nil {
		return nil, err
	}
	accounts, err := c.client.LookupAccounts([]tb_types.Uint128{uid})
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("account not found: %s", accountID)
	}
	a := accounts[0]
	debits := a.DebitsPosted.BigInt().Uint64()
	credits := a.CreditsPosted.BigInt().Uint64()
	return &AccountBalance{
		AccountID: accountID,
		Debits:    debits,
		Credits:   credits,
		Balance:   int64(credits) - int64(debits),
	}, nil
}

func (c *realClient) GetTransfers(_ context.Context, _ string, _ int) ([]Transfer, error) {
	// TigerBeetle v0.16 does not expose a query-by-account API yet;
	// use the account filter API when available.
	return []Transfer{}, nil
}

// ─── Simulated client ─────────────────────────────────────────────────────────

type simulatedClient struct {
	mu       sync.RWMutex
	accounts map[string]*AccountBalance
	history  []Transfer
}

// NewSimulatedClient returns an in-memory ledger for development/testing.
func NewSimulatedClient() LedgerClient {
	log.Println("[ledger] Using simulated TigerBeetle client")
	return &simulatedClient{
		accounts: make(map[string]*AccountBalance),
	}
}

func (s *simulatedClient) Close() {}

func (s *simulatedClient) CreateAccount(_ context.Context, id string, _ uint32, _ uint16) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.accounts[id]; !ok {
		s.accounts[id] = &AccountBalance{AccountID: id}
	}
	return nil
}

func (s *simulatedClient) CreateTransfer(_ context.Context, t Transfer) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.accounts[t.DebitAccountID]; !ok {
		s.accounts[t.DebitAccountID] = &AccountBalance{AccountID: t.DebitAccountID}
	}
	if _, ok := s.accounts[t.CreditAccountID]; !ok {
		s.accounts[t.CreditAccountID] = &AccountBalance{AccountID: t.CreditAccountID}
	}
	s.accounts[t.DebitAccountID].Debits += t.Amount
	s.accounts[t.CreditAccountID].Credits += t.Amount
	s.accounts[t.DebitAccountID].Balance = int64(s.accounts[t.DebitAccountID].Credits) - int64(s.accounts[t.DebitAccountID].Debits)
	s.accounts[t.CreditAccountID].Balance = int64(s.accounts[t.CreditAccountID].Credits) - int64(s.accounts[t.CreditAccountID].Debits)
	t.Timestamp = time.Now()
	s.history = append(s.history, t)
	return nil
}

func (s *simulatedClient) GetAccountBalance(_ context.Context, accountID string) (*AccountBalance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if a, ok := s.accounts[accountID]; ok {
		return a, nil
	}
	// Return a seeded balance for demo purposes
	return &AccountBalance{
		AccountID: accountID,
		Debits:    uint64(rand.Intn(50000) + 10000),
		Credits:   uint64(rand.Intn(80000) + 20000),
		Balance:   int64(rand.Intn(30000)),
	}, nil
}

func (s *simulatedClient) GetTransfers(_ context.Context, accountID string, limit int) ([]Transfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []Transfer
	for _, t := range s.history {
		if t.DebitAccountID == accountID || t.CreditAccountID == accountID {
			result = append(result, t)
		}
	}
	if len(result) > limit {
		result = result[len(result)-limit:]
	}
	return result, nil
}
