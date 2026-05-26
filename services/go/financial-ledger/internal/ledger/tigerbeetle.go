// Package ledger provides the TigerBeetle client for immutable double-entry accounting.
// TigerBeetle records every barrel of oil produced as a financial event.
// Spec: FRQ-010 — 10K+ transfers/sec; zero balance discrepancies.
//
// Account Ledgers:
//
//	Ledger 1 (Production Volume): Tracks physical commodity (barrels)
//	Ledger 2 (USD Currency):      Tracks monetary value
//
// Account Codes:
//
//	1001 — Well Inventory (oil in tank)
//	1002 — Reservoir Asset (oil in ground)
//	2001 — Revenue Account
//	2002 — Royalty Liability
//	2003 — Tax Liability
//	2004 — Partner Share
package ledger

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	tb_types "github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// AccountCode defines the type of ledger account.
type AccountCode uint16

const (
	CodeWellInventory  AccountCode = 1001
	CodeReservoirAsset AccountCode = 1002
	CodeRevenue        AccountCode = 2001
	CodeRoyaltyLiab    AccountCode = 2002
	CodeTaxLiability   AccountCode = 2003
	CodePartnerShare   AccountCode = 2004
)

// TransferCode defines the type of ledger transfer.
type TransferCode uint16

const (
	CodeProduction  TransferCode = 10
	CodeSale        TransferCode = 20
	CodeRoyalty     TransferCode = 30
	CodeTax         TransferCode = 40
	CodePartnerDist TransferCode = 50
)

// Account represents a TigerBeetle account.
type Account struct {
	ID             uint64      `json:"id"`
	UserData       uint64      `json:"user_data"`
	Ledger         uint32      `json:"ledger"`
	Code           AccountCode `json:"code"`
	DebitsPending  uint64      `json:"debits_pending"`
	DebitsPosted   uint64      `json:"debits_posted"`
	CreditsPending uint64      `json:"credits_pending"`
	CreditsPosted  uint64      `json:"credits_posted"`
}

// Balance returns the net balance (credits - debits).
func (a Account) Balance() int64 {
	return int64(a.CreditsPosted) - int64(a.DebitsPosted)
}

// Transfer represents a TigerBeetle transfer between two accounts.
type Transfer struct {
	ID              uint64       `json:"id"`
	DebitAccountID  uint64       `json:"debit_account_id"`
	CreditAccountID uint64       `json:"credit_account_id"`
	Amount          uint64       `json:"amount"`
	Ledger          uint32       `json:"ledger"`
	Code            TransferCode `json:"code"`
	Timestamp       time.Time    `json:"timestamp"`
	PendingID       uint64       `json:"pending_id,omitempty"`
	Flags           uint16       `json:"flags"`
}

// ProductionEvent records a production event (oil extracted from reservoir).
type ProductionEvent struct {
	WellID         uint64    `json:"well_id"`
	VolumeBarrels  uint64    `json:"volume_barrels"`
	PricePerBarrel uint64    `json:"price_per_barrel_cents"`
	Timestamp      time.Time `json:"timestamp"`
}

// RoyaltyShare defines a royalty recipient and their percentage.
type RoyaltyShare struct {
	OwnerAccountID uint64  `json:"owner_account_id"`
	Percentage     float64 `json:"percentage"`
	AmountCents    uint64  `json:"amount_cents"`
}

// TigerBeetleClient wraps the TigerBeetle Go client with real SDK calls.
type TigerBeetleClient struct {
	addresses []string
	client    tb.Client
}

// NewTigerBeetleClient creates a new client connected to the TigerBeetle cluster.
func NewTigerBeetleClient(addresses string) (*TigerBeetleClient, error) {
	addrs := strings.Split(addresses, ",")
	client, err := tb.NewClient(0, addrs, 32)
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle connect %v: %w", addrs, err)
	}
	slog.Info("TigerBeetle client connected", "addresses", addrs)
	return &TigerBeetleClient{addresses: addrs, client: client}, nil
}

// CreateProductionAccount creates ledger accounts for a specific well.
func (c *TigerBeetleClient) CreateProductionAccount(ctx context.Context, wellID uint64) error {
	accounts := []tb_types.Account{
		{
			ID:     tb_types.ToUint128(wellID),
			Ledger: 1,
			Code:   uint16(CodeWellInventory),
			Flags:  tb_types.AccountFlags{}.ToUint16(),
		},
		{
			ID:     tb_types.ToUint128(wellID + 1_000_000),
			Ledger: 1,
			Code:   uint16(CodeReservoirAsset),
			Flags:  tb_types.AccountFlags{}.ToUint16(),
		},
	}
	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return fmt.Errorf("create production accounts: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.AccountOK && r.Result != tb_types.AccountExists {
			return fmt.Errorf("account creation failed for index %d: %v", r.Index, r.Result)
		}
	}
	slog.Info("production accounts created", "well_id", wellID)
	return nil
}

// RecordProduction records oil production as a double-entry transfer.
func (c *TigerBeetleClient) RecordProduction(ctx context.Context, event ProductionEvent) (*Transfer, error) {
	tid := generateTransferID()
	transfers := []tb_types.Transfer{{
		ID:              tb_types.ToUint128(tid),
		DebitAccountID:  tb_types.ToUint128(event.WellID + 1_000_000),
		CreditAccountID: tb_types.ToUint128(event.WellID),
		Amount:          tb_types.ToUint128(event.VolumeBarrels),
		Ledger:          1,
		Code:            uint16(CodeProduction),
	}}

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return nil, fmt.Errorf("record production: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.TransferOK {
			return nil, fmt.Errorf("production transfer failed: %v", r.Result)
		}
	}

	transfer := &Transfer{
		ID:              tid,
		DebitAccountID:  event.WellID + 1_000_000,
		CreditAccountID: event.WellID,
		Amount:          event.VolumeBarrels,
		Ledger:          1,
		Code:            CodeProduction,
		Timestamp:       event.Timestamp,
	}

	slog.Info("production recorded",
		"well_id", event.WellID,
		"volume_bbls", event.VolumeBarrels,
		"transfer_id", tid,
	)
	return transfer, nil
}

// RecordSale records an oil sale (debit inventory, credit revenue).
func (c *TigerBeetleClient) RecordSale(ctx context.Context, wellID, volumeBarrels, revenueAccountID uint64) (*Transfer, error) {
	tid := generateTransferID()
	transfers := []tb_types.Transfer{{
		ID:              tb_types.ToUint128(tid),
		DebitAccountID:  tb_types.ToUint128(wellID),
		CreditAccountID: tb_types.ToUint128(revenueAccountID),
		Amount:          tb_types.ToUint128(volumeBarrels),
		Ledger:          1,
		Code:            uint16(CodeSale),
	}}

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return nil, fmt.Errorf("record sale: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.TransferOK {
			return nil, fmt.Errorf("sale transfer failed: %v", r.Result)
		}
	}

	return &Transfer{
		ID:              tid,
		DebitAccountID:  wellID,
		CreditAccountID: revenueAccountID,
		Amount:          volumeBarrels,
		Ledger:          1,
		Code:            CodeSale,
		Timestamp:       time.Now().UTC(),
	}, nil
}

// DistributeRoyalty atomically distributes royalties using linked transfers.
func (c *TigerBeetleClient) DistributeRoyalty(ctx context.Context, revenueAccountID uint64, shares []RoyaltyShare) error {
	if len(shares) == 0 {
		return fmt.Errorf("no royalty shares provided")
	}

	transfers := make([]tb_types.Transfer, len(shares))
	for i, share := range shares {
		flags := tb_types.TransferFlags{}
		if i < len(shares)-1 {
			flags.Linked = true
		}
		transfers[i] = tb_types.Transfer{
			ID:              tb_types.ToUint128(generateTransferID()),
			DebitAccountID:  tb_types.ToUint128(revenueAccountID),
			CreditAccountID: tb_types.ToUint128(share.OwnerAccountID),
			Amount:          tb_types.ToUint128(share.AmountCents),
			Ledger:          2,
			Code:            uint16(CodeRoyalty),
			Flags:           flags.ToUint16(),
		}
	}

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("distribute royalty: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.TransferOK {
			return fmt.Errorf("royalty transfer failed at index %d: %v", r.Index, r.Result)
		}
	}

	slog.Info("royalties distributed",
		"revenue_account", revenueAccountID,
		"recipients", len(shares),
		"total_cents", totalAmount(shares),
	)
	return nil
}

// GetAccountBalance retrieves the current balance for an account.
func (c *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID uint64) (*Account, error) {
	accounts, err := c.client.LookupAccounts([]tb_types.Uint128{tb_types.ToUint128(accountID)})
	if err != nil {
		return nil, fmt.Errorf("lookup account: %w", err)
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("account not found: %d", accountID)
	}
	a := accounts[0]
	return &Account{
		ID:             accountID,
		Ledger:         a.Ledger,
		Code:           AccountCode(a.Code),
		CreditsPosted:  a.CreditsPosted.BigInt().Uint64(),
		DebitsPosted:   a.DebitsPosted.BigInt().Uint64(),
		CreditsPending: a.CreditsPending.BigInt().Uint64(),
		DebitsPending:  a.DebitsPending.BigInt().Uint64(),
	}, nil
}

// Close releases TigerBeetle client resources.
func (c *TigerBeetleClient) Close() {
	if c.client != nil {
		c.client.Close()
	}
	slog.Info("TigerBeetle client closed")
}

var transferCounter uint64

func generateTransferID() uint64 {
	transferCounter++
	return uint64(time.Now().UnixNano())&0xFFFFFFFF00000000 | transferCounter&0xFFFFFFFF
}

func totalAmount(shares []RoyaltyShare) uint64 {
	var total uint64
	for _, s := range shares {
		total += s.AmountCents
	}
	return total
}
