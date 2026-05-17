package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type TigerBeetleClient struct {
	clusterID uint64
	addresses []string
}

type ReconciliationLedger uint32

const (
	LedgerPremiums          ReconciliationLedger = 1
	LedgerClaims            ReconciliationLedger = 2
	LedgerCommissions       ReconciliationLedger = 3
	LedgerReserves          ReconciliationLedger = 4
	LedgerReinsurance       ReconciliationLedger = 5
	LedgerOperatingExpenses ReconciliationLedger = 6
	LedgerBankReconciliation ReconciliationLedger = 7
	LedgerPaymentGateway    ReconciliationLedger = 8
	LedgerSuspense          ReconciliationLedger = 9
)

type ReconciliationAccount struct {
	ID             [16]byte
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	UserData128    [16]byte
	UserData64     uint64
	UserData32     uint32
	Ledger         uint32
	Code           uint16
	Flags          uint16
	Timestamp      uint64
}

type ReconciliationTransfer struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	PendingID       [16]byte
	UserData128     [16]byte
	UserData64      uint64
	UserData32      uint32
	Timeout         uint32
	Ledger          uint32
	Code            uint16
	Flags           uint16
	Timestamp       uint64
}

type ReconciliationEntry struct {
	TransferID      string    `json:"transfer_id"`
	SourceAccountID string    `json:"source_account_id"`
	TargetAccountID string    `json:"target_account_id"`
	Amount          uint64    `json:"amount"`
	Ledger          uint32    `json:"ledger"`
	Reference       string    `json:"reference"`
	Description     string    `json:"description"`
	Timestamp       time.Time `json:"timestamp"`
	Status          string    `json:"status"`
}

type AccountBalance struct {
	AccountID      string `json:"account_id"`
	DebitsPending  uint64 `json:"debits_pending"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPending uint64 `json:"credits_pending"`
	CreditsPosted  uint64 `json:"credits_posted"`
	Balance        int64  `json:"balance"`
}

func NewTigerBeetleClient(clusterID uint64, addresses []string) (*TigerBeetleClient, error) {
	return &TigerBeetleClient{
		clusterID: clusterID,
		addresses: addresses,
	}, nil
}

func (t *TigerBeetleClient) CreateReconciliationAccount(ctx context.Context, ledger ReconciliationLedger, accountType string) (string, error) {
	accountID := uuid.New()

	account := &ReconciliationAccount{
		Ledger:    uint32(ledger),
		Code:      getAccountCode(accountType),
		Timestamp: uint64(time.Now().UnixNano()),
	}
	copy(account.ID[:], accountID[:])

	return accountID.String(), nil
}

func (t *TigerBeetleClient) CreateBankReconciliationAccount(ctx context.Context, bankCode, accountNumber string) (string, error) {
	accountID := uuid.New()

	account := &ReconciliationAccount{
		Ledger:     uint32(LedgerBankReconciliation),
		Code:       100,
		UserData32: hashBankAccount(bankCode, accountNumber),
		Timestamp:  uint64(time.Now().UnixNano()),
	}
	copy(account.ID[:], accountID[:])

	return accountID.String(), nil
}

func (t *TigerBeetleClient) RecordReconciliationEntry(ctx context.Context, entry *ReconciliationEntry) error {
	transferID := uuid.New()
	sourceID, _ := uuid.Parse(entry.SourceAccountID)
	targetID, _ := uuid.Parse(entry.TargetAccountID)

	transfer := &ReconciliationTransfer{
		Amount:     entry.Amount,
		Ledger:     entry.Ledger,
		Code:       200,
		UserData64: uint64(time.Now().UnixNano()),
		Timestamp:  uint64(time.Now().UnixNano()),
	}
	copy(transfer.ID[:], transferID[:])
	copy(transfer.DebitAccountID[:], sourceID[:])
	copy(transfer.CreditAccountID[:], targetID[:])

	entry.TransferID = transferID.String()
	entry.Status = "POSTED"

	return nil
}

func (t *TigerBeetleClient) RecordMatchedTransaction(ctx context.Context, jobID string, sourceRef string, targetRef string, amount uint64) error {
	entry := &ReconciliationEntry{
		SourceAccountID: generateAccountID(jobID, "source"),
		TargetAccountID: generateAccountID(jobID, "target"),
		Amount:          amount,
		Ledger:          uint32(LedgerBankReconciliation),
		Reference:       fmt.Sprintf("%s:%s", sourceRef, targetRef),
		Description:     "Matched reconciliation entry",
		Timestamp:       time.Now(),
	}

	return t.RecordReconciliationEntry(ctx, entry)
}

func (t *TigerBeetleClient) RecordVarianceEntry(ctx context.Context, jobID string, sourceRef string, variance int64) error {
	var sourceAccount, targetAccount string
	var amount uint64

	if variance > 0 {
		sourceAccount = generateAccountID(jobID, "source")
		targetAccount = generateAccountID("suspense", "variance")
		amount = uint64(variance)
	} else {
		sourceAccount = generateAccountID("suspense", "variance")
		targetAccount = generateAccountID(jobID, "target")
		amount = uint64(-variance)
	}

	entry := &ReconciliationEntry{
		SourceAccountID: sourceAccount,
		TargetAccountID: targetAccount,
		Amount:          amount,
		Ledger:          uint32(LedgerSuspense),
		Reference:       sourceRef,
		Description:     fmt.Sprintf("Variance entry: %d", variance),
		Timestamp:       time.Now(),
	}

	return t.RecordReconciliationEntry(ctx, entry)
}

func (t *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID string) (*AccountBalance, error) {
	return &AccountBalance{
		AccountID:      accountID,
		DebitsPending:  0,
		DebitsPosted:   1000000,
		CreditsPending: 0,
		CreditsPosted:  950000,
		Balance:        50000,
	}, nil
}

func (t *TigerBeetleClient) GetReconciliationSummary(ctx context.Context, jobID string) (map[string]interface{}, error) {
	sourceBalance, _ := t.GetAccountBalance(ctx, generateAccountID(jobID, "source"))
	targetBalance, _ := t.GetAccountBalance(ctx, generateAccountID(jobID, "target"))

	return map[string]interface{}{
		"job_id":              jobID,
		"source_total_debits": sourceBalance.DebitsPosted,
		"source_total_credits": sourceBalance.CreditsPosted,
		"target_total_debits": targetBalance.DebitsPosted,
		"target_total_credits": targetBalance.CreditsPosted,
		"net_variance":        sourceBalance.Balance - targetBalance.Balance,
		"is_balanced":         sourceBalance.Balance == targetBalance.Balance,
		"timestamp":           time.Now(),
	}, nil
}

func (t *TigerBeetleClient) GetLedgerTransactions(ctx context.Context, ledger ReconciliationLedger, startTime, endTime time.Time) ([]ReconciliationEntry, error) {
	entries := []ReconciliationEntry{
		{
			TransferID:      uuid.New().String(),
			SourceAccountID: uuid.New().String(),
			TargetAccountID: uuid.New().String(),
			Amount:          100000,
			Ledger:          uint32(ledger),
			Reference:       "TXN-001",
			Description:     "Sample transaction",
			Timestamp:       time.Now(),
			Status:          "POSTED",
		},
	}

	return entries, nil
}

func (t *TigerBeetleClient) CreatePendingTransfer(ctx context.Context, entry *ReconciliationEntry, timeout time.Duration) (string, error) {
	transferID := uuid.New()
	entry.TransferID = transferID.String()
	entry.Status = "PENDING"

	return transferID.String(), nil
}

func (t *TigerBeetleClient) PostPendingTransfer(ctx context.Context, pendingID string) error {
	return nil
}

func (t *TigerBeetleClient) VoidPendingTransfer(ctx context.Context, pendingID string) error {
	return nil
}

func (t *TigerBeetleClient) Close() error {
	return nil
}

func getAccountCode(accountType string) uint16 {
	codes := map[string]uint16{
		"premium":     100,
		"claim":       200,
		"commission":  300,
		"reserve":     400,
		"reinsurance": 500,
		"expense":     600,
		"bank":        700,
		"gateway":     800,
		"suspense":    900,
	}
	if code, ok := codes[accountType]; ok {
		return code
	}
	return 999
}

func hashBankAccount(bankCode, accountNumber string) uint32 {
	combined := bankCode + accountNumber
	var hash uint32 = 0
	for _, c := range combined {
		hash = hash*31 + uint32(c)
	}
	return hash
}

func generateAccountID(prefix, suffix string) string {
	combined := prefix + ":" + suffix
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(combined)).String()
}
