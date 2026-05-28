// Package ledger wraps the TigerBeetle Go client for production accounting.
// Volumes are stored as integer units × 1000 (i.e. millibbl or mscf).
// Returns errors when TigerBeetle is not configured.
package ledger

import (
	"context"
	"fmt"
	"log"
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

// ─── Unavailable client (returned when TigerBeetle is not configured) ─────────

type unavailableClient struct{}

// NewUnavailableClient returns a client that returns errors for all operations.
func NewUnavailableClient() LedgerClient {
	log.Println("[ledger] WARNING: TigerBeetle not configured — ledger unavailable. Set TIGERBEETLE_ADDRESS env var.")
	return &unavailableClient{}
}

func (u *unavailableClient) Close() {}

func (u *unavailableClient) CreateAccount(_ context.Context, _ string, _ uint32, _ uint16) error {
	return fmt.Errorf("tigerbeetle not configured: set TIGERBEETLE_ADDRESS env var")
}

func (u *unavailableClient) CreateTransfer(_ context.Context, _ Transfer) error {
	return fmt.Errorf("tigerbeetle not configured: set TIGERBEETLE_ADDRESS env var")
}

func (u *unavailableClient) GetAccountBalance(_ context.Context, _ string) (*AccountBalance, error) {
	return nil, fmt.Errorf("tigerbeetle not configured: set TIGERBEETLE_ADDRESS env var")
}

func (u *unavailableClient) GetTransfers(_ context.Context, _ string, _ int) ([]Transfer, error) {
	return nil, fmt.Errorf("tigerbeetle not configured: set TIGERBEETLE_ADDRESS env var")
}
