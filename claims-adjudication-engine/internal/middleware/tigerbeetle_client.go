package middleware

import (
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
)

// TigerBeetleConfig holds TigerBeetle configuration
type TigerBeetleConfig struct {
	Addresses []string
	ClusterID uint64
}

// TigerBeetleClient handles financial transactions with TigerBeetle
type TigerBeetleClient struct {
	config TigerBeetleConfig
	// In production, this would be the actual TigerBeetle client
	// client *tigerbeetle.Client
}

// Account represents a TigerBeetle account
type Account struct {
	ID             [16]byte
	UserData       [16]byte
	Ledger         uint32
	Code           uint16
	Flags          uint16
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	Timestamp      uint64
}

// Transfer represents a TigerBeetle transfer
type Transfer struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	UserData        [16]byte
	Ledger          uint32
	Code            uint16
	Flags           uint16
	Amount          uint64
	Timeout         uint32
	Timestamp       uint64
}

// Ledger codes for insurance operations
const (
	LedgerPremiums        uint32 = 1
	LedgerClaims          uint32 = 2
	LedgerCommissions     uint32 = 3
	LedgerReserves        uint32 = 4
	LedgerReinsurance     uint32 = 5
	LedgerOperatingExpenses uint32 = 6
)

// Account codes
const (
	AccountCodeCustomer    uint16 = 1
	AccountCodePolicy      uint16 = 2
	AccountCodeClaim       uint16 = 3
	AccountCodeAgent       uint16 = 4
	AccountCodeCompany     uint16 = 5
	AccountCodeReinsurer   uint16 = 6
	AccountCodeReserve     uint16 = 7
)

// Transfer codes
const (
	TransferCodePremiumPayment    uint16 = 1
	TransferCodeClaimPayment      uint16 = 2
	TransferCodeCommissionPayment uint16 = 3
	TransferCodeReserveAllocation uint16 = 4
	TransferCodeReinsuranceCession uint16 = 5
	TransferCodeRefund            uint16 = 6
)

// NewTigerBeetleClient creates a new TigerBeetle client
func NewTigerBeetleClient(config TigerBeetleConfig) (*TigerBeetleClient, error) {
	if len(config.Addresses) == 0 {
		addr := os.Getenv("TIGERBEETLE_ADDRESS")
		if addr == "" {
			addr = "127.0.0.1:3000"
		}
		config.Addresses = []string{addr}
	}

	// In production, initialize actual TigerBeetle client
	// client, err := tigerbeetle.NewClient(config.ClusterID, config.Addresses)

	return &TigerBeetleClient{
		config: config,
	}, nil
}

// CreateAccount creates a new account in TigerBeetle
func (t *TigerBeetleClient) CreateAccount(ctx context.Context, id uuid.UUID, ledger uint32, code uint16) error {
	account := Account{
		ID:     uuidToBytes(id),
		Ledger: ledger,
		Code:   code,
	}

	// In production: t.client.CreateAccounts([]Account{account})
	_ = account
	return nil
}

// CreateClaimAccount creates accounts for a new claim
func (t *TigerBeetleClient) CreateClaimAccount(ctx context.Context, claimID uuid.UUID, policyID uuid.UUID) error {
	// Create claim account
	if err := t.CreateAccount(ctx, claimID, LedgerClaims, AccountCodeClaim); err != nil {
		return fmt.Errorf("failed to create claim account: %w", err)
	}

	// Create reserve account for this claim
	reserveID := uuid.New()
	if err := t.CreateAccount(ctx, reserveID, LedgerReserves, AccountCodeReserve); err != nil {
		return fmt.Errorf("failed to create reserve account: %w", err)
	}

	return nil
}

// TransferClaimPayment transfers funds for a claim payment
func (t *TigerBeetleClient) TransferClaimPayment(ctx context.Context, claimID uuid.UUID, customerID uuid.UUID, amount uint64) (*TransferResult, error) {
	transferID := uuid.New()

	transfer := Transfer{
		ID:              uuidToBytes(transferID),
		DebitAccountID:  uuidToBytes(t.getCompanyAccountID()),
		CreditAccountID: uuidToBytes(customerID),
		Ledger:          LedgerClaims,
		Code:            TransferCodeClaimPayment,
		Amount:          amount,
		UserData:        uuidToBytes(claimID),
	}

	// In production: t.client.CreateTransfers([]Transfer{transfer})
	_ = transfer

	return &TransferResult{
		TransferID: transferID,
		Amount:     amount,
		Status:     "COMPLETED",
		Timestamp:  time.Now(),
	}, nil
}

// AllocateReserve allocates reserve for a claim
func (t *TigerBeetleClient) AllocateReserve(ctx context.Context, claimID uuid.UUID, amount uint64) (*TransferResult, error) {
	transferID := uuid.New()

	transfer := Transfer{
		ID:              uuidToBytes(transferID),
		DebitAccountID:  uuidToBytes(t.getCompanyAccountID()),
		CreditAccountID: uuidToBytes(t.getReserveAccountID(claimID)),
		Ledger:          LedgerReserves,
		Code:            TransferCodeReserveAllocation,
		Amount:          amount,
		UserData:        uuidToBytes(claimID),
	}

	_ = transfer

	return &TransferResult{
		TransferID: transferID,
		Amount:     amount,
		Status:     "COMPLETED",
		Timestamp:  time.Now(),
	}, nil
}

// ReleaseReserve releases reserve when claim is settled
func (t *TigerBeetleClient) ReleaseReserve(ctx context.Context, claimID uuid.UUID, amount uint64) (*TransferResult, error) {
	transferID := uuid.New()

	transfer := Transfer{
		ID:              uuidToBytes(transferID),
		DebitAccountID:  uuidToBytes(t.getReserveAccountID(claimID)),
		CreditAccountID: uuidToBytes(t.getCompanyAccountID()),
		Ledger:          LedgerReserves,
		Code:            TransferCodeReserveAllocation,
		Amount:          amount,
		UserData:        uuidToBytes(claimID),
	}

	_ = transfer

	return &TransferResult{
		TransferID: transferID,
		Amount:     amount,
		Status:     "COMPLETED",
		Timestamp:  time.Now(),
	}, nil
}

// TransferReinsuranceCession transfers funds to reinsurer
func (t *TigerBeetleClient) TransferReinsuranceCession(ctx context.Context, claimID uuid.UUID, reinsurerID uuid.UUID, amount uint64) (*TransferResult, error) {
	transferID := uuid.New()

	transfer := Transfer{
		ID:              uuidToBytes(transferID),
		DebitAccountID:  uuidToBytes(reinsurerID),
		CreditAccountID: uuidToBytes(t.getCompanyAccountID()),
		Ledger:          LedgerReinsurance,
		Code:            TransferCodeReinsuranceCession,
		Amount:          amount,
		UserData:        uuidToBytes(claimID),
	}

	_ = transfer

	return &TransferResult{
		TransferID: transferID,
		Amount:     amount,
		Status:     "COMPLETED",
		Timestamp:  time.Now(),
	}, nil
}

// GetAccountBalance gets the balance of an account
func (t *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID uuid.UUID) (*AccountBalance, error) {
	// In production: accounts := t.client.LookupAccounts([]uuid.UUID{accountID})

	return &AccountBalance{
		AccountID:      accountID,
		DebitsPending:  0,
		DebitsPosted:   1000000,
		CreditsPending: 0,
		CreditsPosted:  500000,
		Balance:        500000,
		Timestamp:      time.Now(),
	}, nil
}

// GetClaimTransfers gets all transfers for a claim
func (t *TigerBeetleClient) GetClaimTransfers(ctx context.Context, claimID uuid.UUID) ([]TransferResult, error) {
	// In production: query transfers by user_data (claimID)

	return []TransferResult{
		{
			TransferID: uuid.New(),
			Amount:     100000,
			Status:     "COMPLETED",
			Timestamp:  time.Now().Add(-24 * time.Hour),
		},
	}, nil
}

// CreatePendingTransfer creates a pending (two-phase) transfer
func (t *TigerBeetleClient) CreatePendingTransfer(ctx context.Context, debitAccount, creditAccount uuid.UUID, amount uint64, timeout uint32) (*TransferResult, error) {
	transferID := uuid.New()

	transfer := Transfer{
		ID:              uuidToBytes(transferID),
		DebitAccountID:  uuidToBytes(debitAccount),
		CreditAccountID: uuidToBytes(creditAccount),
		Amount:          amount,
		Timeout:         timeout,
		Flags:           1, // Pending flag
	}

	_ = transfer

	return &TransferResult{
		TransferID: transferID,
		Amount:     amount,
		Status:     "PENDING",
		Timestamp:  time.Now(),
	}, nil
}

// CommitTransfer commits a pending transfer
func (t *TigerBeetleClient) CommitTransfer(ctx context.Context, transferID uuid.UUID) error {
	// In production: t.client.CreateTransfers with commit flag
	return nil
}

// VoidTransfer voids a pending transfer
func (t *TigerBeetleClient) VoidTransfer(ctx context.Context, transferID uuid.UUID) error {
	// In production: t.client.CreateTransfers with void flag
	return nil
}

// TransferResult represents the result of a transfer
type TransferResult struct {
	TransferID uuid.UUID `json:"transfer_id"`
	Amount     uint64    `json:"amount"`
	Status     string    `json:"status"`
	Timestamp  time.Time `json:"timestamp"`
	Error      string    `json:"error,omitempty"`
}

// AccountBalance represents an account balance
type AccountBalance struct {
	AccountID      uuid.UUID `json:"account_id"`
	DebitsPending  uint64    `json:"debits_pending"`
	DebitsPosted   uint64    `json:"debits_posted"`
	CreditsPending uint64    `json:"credits_pending"`
	CreditsPosted  uint64    `json:"credits_posted"`
	Balance        int64     `json:"balance"`
	Timestamp      time.Time `json:"timestamp"`
}

// Helper functions
func uuidToBytes(id uuid.UUID) [16]byte {
	var bytes [16]byte
	copy(bytes[:], id[:])
	return bytes
}

func bytesToUUID(bytes [16]byte) uuid.UUID {
	var id uuid.UUID
	copy(id[:], bytes[:])
	return id
}

func uint64ToBytes(n uint64) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, n)
	return b
}

func (t *TigerBeetleClient) getCompanyAccountID() uuid.UUID {
	// In production, this would be configured
	return uuid.MustParse("00000000-0000-0000-0000-000000000001")
}

func (t *TigerBeetleClient) getReserveAccountID(claimID uuid.UUID) uuid.UUID {
	// In production, this would be looked up from a mapping
	return uuid.MustParse("00000000-0000-0000-0000-000000000002")
}

// Close closes the TigerBeetle client
func (t *TigerBeetleClient) Close() error {
	// In production: t.client.Close()
	return nil
}
