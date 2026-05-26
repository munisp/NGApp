// Package ledger — unit tests for TigerBeetle account and transfer logic.
// Tests cover: account balance calculation, account code constants, transfer codes.
// Run: go test ./internal/ledger/... -v
package ledger

import (
	"testing"
)

// ── Account.Balance tests ─────────────────────────────────────────────────────

func TestAccountBalance_CreditsMinusDebits(t *testing.T) {
	a := Account{
		CreditsPosted: 1000,
		DebitsPosted:  300,
	}
	got := a.Balance()
	if got != 700 {
		t.Errorf("Balance() = %d, want 700", got)
	}
}

func TestAccountBalance_ZeroBalance(t *testing.T) {
	a := Account{
		CreditsPosted: 500,
		DebitsPosted:  500,
	}
	if a.Balance() != 0 {
		t.Errorf("Balance() = %d, want 0", a.Balance())
	}
}

func TestAccountBalance_NegativeBalance(t *testing.T) {
	a := Account{
		CreditsPosted: 100,
		DebitsPosted:  400,
	}
	got := a.Balance()
	if got != -300 {
		t.Errorf("Balance() = %d, want -300", got)
	}
}

func TestAccountBalance_EmptyAccount(t *testing.T) {
	a := Account{}
	if a.Balance() != 0 {
		t.Errorf("empty account Balance() = %d, want 0", a.Balance())
	}
}

// ── AccountCode constants tests ───────────────────────────────────────────────

func TestAccountCodes_Values(t *testing.T) {
	tests := []struct {
		name string
		code AccountCode
		want uint16
	}{
		{"WellInventory", CodeWellInventory, 1001},
		{"ReservoirAsset", CodeReservoirAsset, 1002},
		{"Revenue", CodeRevenue, 2001},
		{"RoyaltyLiab", CodeRoyaltyLiab, 2002},
		{"TaxLiability", CodeTaxLiability, 2003},
		{"PartnerShare", CodePartnerShare, 2004},
	}
	for _, tt := range tests {
		if uint16(tt.code) != tt.want {
			t.Errorf("%s: got %d, want %d", tt.name, tt.code, tt.want)
		}
	}
}

// ── TransferCode constants tests ──────────────────────────────────────────────

func TestTransferCodes_Values(t *testing.T) {
	tests := []struct {
		name string
		code TransferCode
		want uint16
	}{
		{"Production", CodeProduction, 10},
		{"Sale", CodeSale, 20},
		{"Royalty", CodeRoyalty, 30},
		{"Tax", CodeTax, 40},
		{"PartnerDist", CodePartnerDist, 50},
	}
	for _, tt := range tests {
		if uint16(tt.code) != tt.want {
			t.Errorf("%s: got %d, want %d", tt.name, tt.code, tt.want)
		}
	}
}

// ── Transfer struct tests ─────────────────────────────────────────────────────

func TestTransfer_FieldsSet(t *testing.T) {
	tr := Transfer{
		ID:              12345,
		DebitAccountID:  1,
		CreditAccountID: 2,
		Amount:          5000,
		Ledger:          1,
		Code:            CodeProduction,
	}
	if tr.Amount != 5000 {
		t.Errorf("Amount = %d, want 5000", tr.Amount)
	}
	if tr.Code != CodeProduction {
		t.Errorf("Code = %d, want %d", tr.Code, CodeProduction)
	}
}

// ── Ledger separation tests ───────────────────────────────────────────────────

func TestLedgerSeparation_ProductionVsUSD(t *testing.T) {
	// Ledger 1 = production volume (barrels), Ledger 2 = USD
	productionLedger := uint32(1)
	usdLedger := uint32(2)

	if productionLedger == usdLedger {
		t.Error("production and USD ledgers must be separate")
	}

	// Well inventory and reservoir asset should be on production ledger
	wellInventoryAccount := Account{Ledger: productionLedger, Code: CodeWellInventory}
	revenueAccount := Account{Ledger: usdLedger, Code: CodeRevenue}

	if wellInventoryAccount.Ledger != 1 {
		t.Errorf("well inventory should be on ledger 1, got %d", wellInventoryAccount.Ledger)
	}
	if revenueAccount.Ledger != 2 {
		t.Errorf("revenue should be on ledger 2, got %d", revenueAccount.Ledger)
	}
}
