package middleware

import (
	"sync"
	"time"
)

type TigerBeetleConfig struct {
	Addresses  string
	ClusterID  uint32
	MaxRetries int
}

var DefaultTigerBeetleConfig = TigerBeetleConfig{
	Addresses:  "tigerbeetle:3000",
	ClusterID:  0,
	MaxRetries: 3,
}

type AccountType uint16

const (
	AccountTypeAsset     AccountType = 1
	AccountTypeLiability AccountType = 2
	AccountTypeIncome    AccountType = 3
	AccountTypeExpense   AccountType = 4
)

type LedgerAccount struct {
	ID                 uint128
	UserData128        uint128
	UserData64         uint64
	UserData32         uint32
	Ledger             uint32
	Code               uint16
	Flags              uint16
	DebitsPosted       uint64
	DebitsPending      uint64
	CreditsPosted      uint64
	CreditsPending     uint64
	Timestamp          uint64
}

type uint128 [2]uint64

type LedgerTransfer struct {
	ID                uint128
	DebitAccountID    uint128
	CreditAccountID   uint128
	Amount            uint64
	UserData128       uint128
	UserData64        uint64
	UserData32        uint32
	PendingID         uint128
	Timeout           uint32
	Ledger            uint32
	Code              uint16
	Flags             uint16
	Timestamp         uint64
}

type TigerBeetleLedger struct {
	mu       sync.RWMutex
	config   TigerBeetleConfig
	accounts map[uint128]LedgerAccount
	transfers []LedgerTransfer
}

func NewTigerBeetleLedger(cfg TigerBeetleConfig) *TigerBeetleLedger {
	return &TigerBeetleLedger{
		config:    cfg,
		accounts:  make(map[uint128]LedgerAccount),
		transfers: make([]LedgerTransfer, 0),
	}
}

func (tb *TigerBeetleLedger) CreateAccount(id uint128, ledger uint32, code uint16) LedgerAccount {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	acct := LedgerAccount{
		ID:     id,
		Ledger: ledger,
		Code:   code,
		Timestamp: uint64(time.Now().UnixNano()),
	}
	tb.accounts[id] = acct
	return acct
}

func (tb *TigerBeetleLedger) CreateTransfer(debit uint128, credit uint128, amount uint64, ledger uint32, code uint16) LedgerTransfer {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	transfer := LedgerTransfer{
		ID:               uint128{uint64(time.Now().UnixNano()), 0},
		DebitAccountID:   debit,
		CreditAccountID:  credit,
		Amount:           amount,
		Ledger:           ledger,
		Code:             code,
		Timestamp:        uint64(time.Now().UnixNano()),
	}

	// Update account balances
	if da, ok := tb.accounts[debit]; ok {
		da.DebitsPosted += amount
		tb.accounts[debit] = da
	}
	if ca, ok := tb.accounts[credit]; ok {
		ca.CreditsPosted += amount
		tb.accounts[credit] = ca
	}

	tb.transfers = append(tb.transfers, transfer)
	return transfer
}

func (tb *TigerBeetleLedger) GetAccount(id uint128) (LedgerAccount, bool) {
	tb.mu.RLock()
	defer tb.mu.RUnlock()
	acct, ok := tb.accounts[id]
	return acct, ok
}

func (tb *TigerBeetleLedger) GetBalance(id uint128) int64 {
	tb.mu.RLock()
	defer tb.mu.RUnlock()
	acct, ok := tb.accounts[id]
	if !ok {
		return 0
	}
	return int64(acct.CreditsPosted) - int64(acct.DebitsPosted)
}

func (tb *TigerBeetleLedger) GetMetrics() map[string]int64 {
	tb.mu.RLock()
	defer tb.mu.RUnlock()
	return map[string]int64{
		"accounts":  int64(len(tb.accounts)),
		"transfers": int64(len(tb.transfers)),
	}
}

// Default ledger IDs for Nigerian payment switch
var LedgerIDs = map[string]uint32{
	"ngn_settlement": 1,
	"usd_settlement": 2,
	"gbp_settlement": 3,
	"eur_settlement": 4,
	"ghs_settlement": 5,
	"kes_settlement": 6,
	"zar_settlement": 7,
	"fees":           100,
	"suspense":       200,
	"float":          300,
}

var AccountCodes = map[string]uint16{
	"bank_settlement":  1,
	"merchant_account": 2,
	"fee_collection":   3,
	"suspense_account": 4,
	"float_account":    5,
	"fx_holding":       6,
	"escrow":           7,
}
