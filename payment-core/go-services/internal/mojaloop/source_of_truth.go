// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// SourceOfTruthContract defines the authoritative data ownership between systems
// TigerBeetle: balances, reservations, posting finality, reversals/voids
// PostgreSQL: participant config, routing, quotes, workflow state, idempotency, audit
// Mojaloop DB: disabled as authoritative ledger, treated as compatibility/shadow store
type SourceOfTruthContract struct {
	mu sync.RWMutex

	// LedgerEngine is TigerBeetle - authoritative for money movement
	LedgerEngine LedgerEngine

	// WorkflowStore is PostgreSQL - authoritative for process state
	WorkflowStore WorkflowStore

	// ShadowStore is Mojaloop DB - compatibility layer only
	ShadowStore ShadowStore
}

// LedgerEngine interface for TigerBeetle operations
type LedgerEngine interface {
	// Account operations
	CreateAccount(ctx context.Context, account *TBAccount) error
	GetAccountBalance(ctx context.Context, accountID uint128) (*AccountBalance, error)

	// Transfer operations with linked support
	CreatePendingTransfer(ctx context.Context, transfer *TBTransfer) error
	CreateLinkedPendingTransfers(ctx context.Context, transfers []*TBTransfer) error
	PostPendingTransfer(ctx context.Context, transferID uint128) error
	PostLinkedPendingTransfers(ctx context.Context, transferIDs []uint128) error
	VoidPendingTransfer(ctx context.Context, transferID uint128) error
	VoidLinkedPendingTransfers(ctx context.Context, transferIDs []uint128) error

	// Batch operations
	CreateTransferBatch(ctx context.Context, transfers []*TBTransfer) ([]TransferResult, error)

	// Lookup
	LookupTransfer(ctx context.Context, transferID uint128) (*TBTransfer, error)
	LookupTransfers(ctx context.Context, transferIDs []uint128) ([]*TBTransfer, error)
}

// WorkflowStore interface for PostgreSQL operations
type WorkflowStore interface {
	// Participant management
	GetParticipant(ctx context.Context, fspID string) (*Participant, error)
	CreateParticipant(ctx context.Context, participant *Participant) error
	UpdateParticipant(ctx context.Context, participant *Participant) error

	// Transfer workflow state
	SaveTransferState(ctx context.Context, state *TransferWorkflowState) error
	GetTransferState(ctx context.Context, transferID string) (*TransferWorkflowState, error)
	UpdateTransferState(ctx context.Context, transferID string, newState MojaloopTransferState) error

	// Quote management
	SaveQuote(ctx context.Context, quote *Quote) error
	GetQuote(ctx context.Context, quoteID string) (*Quote, error)

	// Idempotency
	CheckIdempotency(ctx context.Context, key string) (*IdempotencyRecord, error)
	SaveIdempotency(ctx context.Context, record *IdempotencyRecord) error

	// Outbox for reliable event publishing
	SaveOutboxEvent(ctx context.Context, event *OutboxEvent) error
	GetPendingOutboxEvents(ctx context.Context, limit int) ([]*OutboxEvent, error)
	MarkOutboxEventPublished(ctx context.Context, eventID string) error
}

// ShadowStore interface for Mojaloop DB compatibility
type ShadowStore interface {
	// Shadow operations - not authoritative, for compatibility only
	SyncTransferState(ctx context.Context, transferID string, state MojaloopTransferState) error
	SyncParticipantPosition(ctx context.Context, fspID string, currency string, position float64) error
}

// uint128 represents a 128-bit unsigned integer for TigerBeetle IDs
type uint128 [16]byte

// TBAccount represents a TigerBeetle account
type TBAccount struct {
	ID             uint128
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	UserData128    uint128 // For correlation (participantID, currency)
	UserData64     uint64  // For metadata
	UserData32     uint32  // For flags/type
	Reserved       uint32
	Ledger         uint32 // Currency ledger ID
	Code           uint16 // Account type code
	Flags          uint16 // Account flags
	Timestamp      uint64
}

// AccountFlags for TigerBeetle accounts
type AccountFlags uint16

const (
	// AccountFlagLinked indicates account is part of a linked group
	AccountFlagLinked AccountFlags = 1 << 0
	// AccountFlagDebitsMustNotExceedCredits prevents overdrafts
	AccountFlagDebitsMustNotExceedCredits AccountFlags = 1 << 1
	// AccountFlagCreditsMustNotExceedDebits for liability accounts
	AccountFlagCreditsMustNotExceedDebits AccountFlags = 1 << 2
	// AccountFlagHistory enables historical balance queries
	AccountFlagHistory AccountFlags = 1 << 3
)

// AccountType identifies the type of account
type AccountType uint16

const (
	AccountTypePosition    AccountType = 1 // Participant position account
	AccountTypeSettlement  AccountType = 2 // Settlement account
	AccountTypeHubNostro   AccountType = 3 // Hub clearing/nostro account
	AccountTypeHubFee      AccountType = 4 // Hub fee revenue account
	AccountTypeInterchange AccountType = 5 // Interchange fee account
)

// TBTransfer represents a TigerBeetle transfer
type TBTransfer struct {
	ID              uint128
	DebitAccountID  uint128
	CreditAccountID uint128
	Amount          uint64
	PendingID       uint128 // For posting/voiding pending transfers
	UserData128     uint128 // For correlation (transferID, quoteID)
	UserData64      uint64  // For metadata
	UserData32      uint32  // For leg index
	Timeout         uint32  // Timeout in seconds for pending transfers
	Ledger          uint32  // Currency ledger ID
	Code            uint16  // Transfer type code
	Flags           uint16  // Transfer flags
	Timestamp       uint64
}

// TransferFlags for TigerBeetle transfers
type TransferFlags uint16

const (
	// TransferFlagLinked indicates transfer is part of a linked group
	TransferFlagLinked TransferFlags = 1 << 0
	// TransferFlagPending creates a pending (two-phase) transfer
	TransferFlagPending TransferFlags = 1 << 1
	// TransferFlagPostPendingTransfer posts a pending transfer
	TransferFlagPostPendingTransfer TransferFlags = 1 << 2
	// TransferFlagVoidPendingTransfer voids a pending transfer
	TransferFlagVoidPendingTransfer TransferFlags = 1 << 3
	// TransferFlagBalancingDebit for balancing entries
	TransferFlagBalancingDebit TransferFlags = 1 << 4
	// TransferFlagBalancingCredit for balancing entries
	TransferFlagBalancingCredit TransferFlags = 1 << 5
)

// TransferResult holds the result of a transfer operation
type TransferResult struct {
	TransferID uint128
	Result     TransferResultCode
}

// TransferResultCode indicates the result of a transfer
type TransferResultCode uint8

const (
	TransferResultOK                                         TransferResultCode = 0
	TransferResultLinkedEventFailed                          TransferResultCode = 1
	TransferResultLinkedEventChainOpen                       TransferResultCode = 2
	TransferResultTimestampMustBeZero                        TransferResultCode = 3
	TransferResultReservedFlag                               TransferResultCode = 4
	TransferResultReservedField                              TransferResultCode = 5
	TransferResultIDMustNotBeZero                            TransferResultCode = 6
	TransferResultIDMustNotBeIntMax                          TransferResultCode = 7
	TransferResultFlagsAreMutuallyExclusive                  TransferResultCode = 8
	TransferResultDebitAccountIDMustNotBeZero                TransferResultCode = 9
	TransferResultCreditAccountIDMustNotBeZero               TransferResultCode = 10
	TransferResultAccountsMustBeDifferent                    TransferResultCode = 11
	TransferResultPendingIDMustBeZero                        TransferResultCode = 12
	TransferResultPendingIDMustNotBeZero                     TransferResultCode = 13
	TransferResultPendingTransferMustExist                   TransferResultCode = 14
	TransferResultPendingTransferNotPending                  TransferResultCode = 15
	TransferResultPendingTransferHasDifferentDebitAccountID  TransferResultCode = 16
	TransferResultPendingTransferHasDifferentCreditAccountID TransferResultCode = 17
	TransferResultPendingTransferHasDifferentLedger          TransferResultCode = 18
	TransferResultPendingTransferHasDifferentCode            TransferResultCode = 19
	TransferResultExceedsCredits                             TransferResultCode = 20
	TransferResultExceedsDebits                              TransferResultCode = 21
	TransferResultCannotPostAndVoidPendingTransfer           TransferResultCode = 22
	TransferResultPendingTransferAlreadyPosted               TransferResultCode = 23
	TransferResultPendingTransferAlreadyVoided               TransferResultCode = 24
	TransferResultPendingTransferExpired                     TransferResultCode = 25
	TransferResultExists                                     TransferResultCode = 26
	TransferResultOverflowsDebits                            TransferResultCode = 27
	TransferResultOverflowsCredits                           TransferResultCode = 28
	TransferResultOverflowsDebitsPending                     TransferResultCode = 29
	TransferResultOverflowsCreditsPending                    TransferResultCode = 30
	TransferResultOverflowsTimeout                           TransferResultCode = 31
	TransferResultAmountMustNotBeZero                        TransferResultCode = 32
	TransferResultLedgerMustNotBeZero                        TransferResultCode = 33
	TransferResultCodeMustNotBeZero                          TransferResultCode = 34
	TransferResultDebitAccountNotFound                       TransferResultCode = 35
	TransferResultCreditAccountNotFound                      TransferResultCode = 36
	TransferResultAccountsMustHaveSameLedger                 TransferResultCode = 37
	TransferResultTransferMustHaveSameLedgerAsAccounts       TransferResultCode = 38
	TransferResultPendingTransferHasDifferentAmount          TransferResultCode = 39
	TransferResultPendingTransferHasDifferentTimeout         TransferResultCode = 40
)

// AccountBalance represents the balance of an account
type AccountBalance struct {
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	Available      int64 // CreditsPosted - DebitsPosted - DebitsPending
}

// MojaloopTransferState represents the state of a Mojaloop transfer

const ()

// TigerBeetleTransferState represents the state of a TigerBeetle transfer
type TigerBeetleTransferState string

const (
	TBTransferStatePending TigerBeetleTransferState = "PENDING"
	TBTransferStatePosted  TigerBeetleTransferState = "POSTED"
	TBTransferStateVoided  TigerBeetleTransferState = "VOIDED"
)

// StateMachineMapping maps Mojaloop states to TigerBeetle states
var StateMachineMapping = map[MojaloopTransferState]TigerBeetleTransferState{
	TransferStateReceived:  TBTransferStatePending, // Not yet in TB
	TransferStateReserved:  TBTransferStatePending, // Pending transfer created
	TransferStateCommitted: TBTransferStatePosted,  // Transfer posted
	TransferStateAborted:   TBTransferStateVoided,  // Transfer voided
	TransferStateExpired:   TBTransferStateVoided,  // Transfer voided due to timeout
}

// TransferWorkflowState represents the workflow state of a transfer
type TransferWorkflowState struct {
	TransferID       string                   `json:"transfer_id"`
	MojaloopState    MojaloopTransferState    `json:"mojaloop_state"`
	TigerBeetleState TigerBeetleTransferState `json:"tigerbeetle_state"`
	PayerFSP         string                   `json:"payer_fsp"`
	PayeeFSP         string                   `json:"payee_fsp"`
	Amount           string                   `json:"amount"`
	Currency         string                   `json:"currency"`
	ILPCondition     string                   `json:"ilp_condition"`
	ILPFulfilment    string                   `json:"ilp_fulfilment,omitempty"`
	ExpirationDate   time.Time                `json:"expiration_date"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`

	// TigerBeetle correlation
	TBTransferIDs     []uint128 `json:"tb_transfer_ids"` // Multiple for linked transfers
	TBDebitAccountID  uint128   `json:"tb_debit_account_id"`
	TBCreditAccountID uint128   `json:"tb_credit_account_id"`

	// Error information
	ErrorCode        string `json:"error_code,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
}

// Participant represents a Mojaloop participant (DFSP)
type Participant struct {
	ParticipantID int       `json:"participant_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	IsActive      bool      `json:"is_active"`
	CreatedDate   time.Time `json:"created_date"`

	// TigerBeetle account mapping
	TBAccounts map[string]uint128 `json:"tb_accounts"` // currency -> account ID

	// Limits and configuration
	NetDebitCap    map[string]float64 `json:"net_debit_cap"` // currency -> limit
	LiquidityCheck bool               `json:"liquidity_check"`
}

// Quote represents a Mojaloop quote
type Quote struct {
	QuoteID            string    `json:"quote_id"`
	TransactionID      string    `json:"transaction_id"`
	PayerFSP           string    `json:"payer_fsp"`
	PayeeFSP           string    `json:"payee_fsp"`
	AmountType         string    `json:"amount_type"` // SEND or RECEIVE
	Amount             string    `json:"amount"`
	Currency           string    `json:"currency"`
	TransferAmount     string    `json:"transfer_amount,omitempty"`
	PayeeFSPFee        string    `json:"payee_fsp_fee,omitempty"`
	PayeeFSPCommission string    `json:"payee_fsp_commission,omitempty"`
	ILPPacket          string    `json:"ilp_packet,omitempty"`
	Condition          string    `json:"condition,omitempty"`
	Expiration         time.Time `json:"expiration"`
	CreatedAt          time.Time `json:"created_at"`
}

// IdempotencyRecord tracks idempotent requests
type IdempotencyRecord struct {
	Key         string          `json:"key"`
	RequestHash string          `json:"request_hash"`
	Response    json.RawMessage `json:"response"`
	StatusCode  int             `json:"status_code"`
	CreatedAt   time.Time       `json:"created_at"`
	ExpiresAt   time.Time       `json:"expires_at"`
}

// OutboxEvent represents an event in the transactional outbox
type OutboxEvent struct {
	ID            int64           `json:"id"`
	EventID       string          `json:"event_id"`
	EventType     string          `json:"event_type"`
	AggregateID   string          `json:"aggregate_id"`
	AggregateType string          `json:"aggregate_type"`
	Payload       json.RawMessage `json:"payload"`
	CreatedAt     time.Time       `json:"created_at"`
	PublishedAt   *time.Time      `json:"published_at,omitempty"`
	RetryCount    int             `json:"retry_count"`
}

// NewSourceOfTruthContract creates a new source of truth contract
func NewSourceOfTruthContract(ledger LedgerEngine, workflow WorkflowStore, shadow ShadowStore) *SourceOfTruthContract {
	return &SourceOfTruthContract{
		LedgerEngine:  ledger,
		WorkflowStore: workflow,
		ShadowStore:   shadow,
	}
}

// ValidateStateTransition validates a state transition is allowed
func (s *SourceOfTruthContract) ValidateStateTransition(currentState, newState MojaloopTransferState) error {
	validTransitions := map[MojaloopTransferState][]MojaloopTransferState{
		TransferStateReceived:  {TransferStateReserved, TransferStateAborted, TransferStateInvalid},
		TransferStateReserved:  {TransferStateCommitted, TransferStateAborted, TransferStateExpired},
		TransferStateCommitted: {}, // Terminal state
		TransferStateAborted:   {}, // Terminal state
		TransferStateExpired:   {}, // Terminal state
		TransferStateInvalid:   {}, // Terminal state
	}

	allowed, ok := validTransitions[currentState]
	if !ok {
		return fmt.Errorf("unknown current state: %s", currentState)
	}

	for _, state := range allowed {
		if state == newState {
			return nil
		}
	}

	return fmt.Errorf("invalid state transition from %s to %s", currentState, newState)
}

// ExecuteTransferPrepare executes the prepare phase of a transfer
func (s *SourceOfTruthContract) ExecuteTransferPrepare(ctx context.Context, req *TransferPrepareRequest) (*TransferWorkflowState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Check idempotency
	idempKey := fmt.Sprintf("transfer:prepare:%s", req.TransferID)
	existing, err := s.WorkflowStore.CheckIdempotency(ctx, idempKey)
	if err == nil && existing != nil {
		// Return cached response
		var state TransferWorkflowState
		json.Unmarshal(existing.Response, &state)
		return &state, nil
	}

	// 2. Create workflow state
	state := &TransferWorkflowState{
		TransferID:       req.TransferID,
		MojaloopState:    TransferStateReceived,
		TigerBeetleState: TBTransferStatePending,
		PayerFSP:         req.PayerFSP,
		PayeeFSP:         req.PayeeFSP,
		Amount:           req.Amount,
		Currency:         req.Currency,
		ILPCondition:     req.Condition,
		ExpirationDate:   req.Expiration,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// 3. Get participant accounts from TigerBeetle
	payerParticipant, err := s.WorkflowStore.GetParticipant(ctx, req.PayerFSP)
	if err != nil {
		return nil, fmt.Errorf("payer participant not found: %w", err)
	}
	payeeParticipant, err := s.WorkflowStore.GetParticipant(ctx, req.PayeeFSP)
	if err != nil {
		return nil, fmt.Errorf("payee participant not found: %w", err)
	}

	payerAccountID, ok := payerParticipant.TBAccounts[req.Currency]
	if !ok {
		return nil, fmt.Errorf("payer has no account for currency %s", req.Currency)
	}
	payeeAccountID, ok := payeeParticipant.TBAccounts[req.Currency]
	if !ok {
		return nil, fmt.Errorf("payee has no account for currency %s", req.Currency)
	}

	state.TBDebitAccountID = payerAccountID
	state.TBCreditAccountID = payeeAccountID

	// 4. Create pending transfer in TigerBeetle
	transferID := GenerateTransferID(req.TransferID, 0) // Leg 0 for principal
	amount, err := ParseAmount(req.Amount)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	tbTransfer := &TBTransfer{
		ID:              transferID,
		DebitAccountID:  payerAccountID,
		CreditAccountID: payeeAccountID,
		Amount:          amount,
		UserData128:     StringToUint128(req.TransferID),
		Timeout:         uint32(time.Until(req.Expiration).Seconds()),
		Ledger:          CurrencyToLedger(req.Currency),
		Code:            1, // Transfer code
		Flags:           uint16(TransferFlagPending),
	}

	if err := s.LedgerEngine.CreatePendingTransfer(ctx, tbTransfer); err != nil {
		state.MojaloopState = TransferStateAborted
		state.ErrorCode = "5000"
		state.ErrorDescription = fmt.Sprintf("Ledger error: %v", err)
		s.WorkflowStore.SaveTransferState(ctx, state)
		return state, err
	}

	state.TBTransferIDs = []uint128{transferID}
	state.MojaloopState = TransferStateReserved

	// 5. Save workflow state
	if err := s.WorkflowStore.SaveTransferState(ctx, state); err != nil {
		return nil, fmt.Errorf("failed to save transfer state: %w", err)
	}

	// 6. Save idempotency record
	responseJSON, _ := json.Marshal(state)
	s.WorkflowStore.SaveIdempotency(ctx, &IdempotencyRecord{
		Key:         idempKey,
		RequestHash: HashRequest(req),
		Response:    responseJSON,
		StatusCode:  200,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	})

	// 7. Sync to shadow store (non-blocking)
	go s.ShadowStore.SyncTransferState(ctx, req.TransferID, TransferStateReserved)

	return state, nil
}

// ExecuteTransferFulfil executes the fulfil phase of a transfer
func (s *SourceOfTruthContract) ExecuteTransferFulfil(ctx context.Context, req *TransferFulfilRequest) (*TransferWorkflowState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Get current state
	state, err := s.WorkflowStore.GetTransferState(ctx, req.TransferID)
	if err != nil {
		return nil, fmt.Errorf("transfer not found: %w", err)
	}

	// 2. Validate state transition
	if err := s.ValidateStateTransition(state.MojaloopState, TransferStateCommitted); err != nil {
		return nil, err
	}

	// 3. Validate fulfilment matches condition
	if !ValidateFulfilment(state.ILPCondition, req.Fulfilment) {
		state.MojaloopState = TransferStateAborted
		state.ErrorCode = "5105"
		state.ErrorDescription = "Fulfilment does not match condition"
		s.WorkflowStore.SaveTransferState(ctx, state)
		return state, fmt.Errorf("fulfilment validation failed")
	}

	// 4. Post pending transfer(s) in TigerBeetle
	if err := s.LedgerEngine.PostLinkedPendingTransfers(ctx, state.TBTransferIDs); err != nil {
		state.ErrorCode = "5000"
		state.ErrorDescription = fmt.Sprintf("Ledger error: %v", err)
		s.WorkflowStore.SaveTransferState(ctx, state)
		return state, err
	}

	// 5. Update state
	state.MojaloopState = TransferStateCommitted
	state.TigerBeetleState = TBTransferStatePosted
	state.ILPFulfilment = req.Fulfilment
	state.UpdatedAt = time.Now()

	if err := s.WorkflowStore.SaveTransferState(ctx, state); err != nil {
		return nil, fmt.Errorf("failed to save transfer state: %w", err)
	}

	// 6. Sync to shadow store
	go s.ShadowStore.SyncTransferState(ctx, req.TransferID, TransferStateCommitted)

	return state, nil
}

// ExecuteTransferAbort executes the abort phase of a transfer
func (s *SourceOfTruthContract) ExecuteTransferAbort(ctx context.Context, req *TransferAbortRequest) (*TransferWorkflowState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Get current state
	state, err := s.WorkflowStore.GetTransferState(ctx, req.TransferID)
	if err != nil {
		return nil, fmt.Errorf("transfer not found: %w", err)
	}

	// 2. Validate state transition
	if err := s.ValidateStateTransition(state.MojaloopState, TransferStateAborted); err != nil {
		return nil, err
	}

	// 3. Void pending transfer(s) in TigerBeetle
	if err := s.LedgerEngine.VoidLinkedPendingTransfers(ctx, state.TBTransferIDs); err != nil {
		state.ErrorCode = "5000"
		state.ErrorDescription = fmt.Sprintf("Ledger error: %v", err)
		s.WorkflowStore.SaveTransferState(ctx, state)
		return state, err
	}

	// 4. Update state
	state.MojaloopState = TransferStateAborted
	state.TigerBeetleState = TBTransferStateVoided
	state.ErrorCode = req.ErrorCode
	state.ErrorDescription = req.ErrorDescription
	state.UpdatedAt = time.Now()

	if err := s.WorkflowStore.SaveTransferState(ctx, state); err != nil {
		return nil, fmt.Errorf("failed to save transfer state: %w", err)
	}

	// 5. Sync to shadow store
	go s.ShadowStore.SyncTransferState(ctx, req.TransferID, TransferStateAborted)

	return state, nil
}

// TransferPrepareRequest represents a transfer prepare request
type TransferPrepareRequest struct {
	TransferID string    `json:"transferId"`
	PayerFSP   string    `json:"payerFsp"`
	PayeeFSP   string    `json:"payeeFsp"`
	Amount     string    `json:"amount"`
	Currency   string    `json:"currency"`
	ILPPacket  string    `json:"ilpPacket"`
	Condition  string    `json:"condition"`
	Expiration time.Time `json:"expiration"`
}

// TransferFulfilRequest represents a transfer fulfil request
type TransferFulfilRequest struct {
	TransferID string `json:"transferId"`
	Fulfilment string `json:"fulfilment"`
}

// TransferAbortRequest represents a transfer abort request
type TransferAbortRequest struct {
	TransferID       string `json:"transferId"`
	ErrorCode        string `json:"errorCode"`
	ErrorDescription string `json:"errorDescription"`
}

// Helper functions

// GenerateTransferID generates a deterministic TigerBeetle transfer ID
func GenerateTransferID(mojaloopTransferID string, legIndex int) uint128 {
	// Hash transferID + leg index for deterministic ID generation
	data := fmt.Sprintf("%s:%d", mojaloopTransferID, legIndex)
	return HashToUint128(data)
}

// StringToUint128 converts a string to uint128
func StringToUint128(s string) uint128 {
	return HashToUint128(s)
}

// HashToUint128 hashes a string to uint128
func HashToUint128(s string) uint128 {
	var result uint128
	// Simple hash for demonstration - use crypto hash in production
	for i, c := range s {
		result[i%16] ^= byte(c)
	}
	return result
}

// ParseAmount parses an amount string to uint64 (in minor units)
func ParseAmount(amount string) (uint64, error) {
	// Parse decimal amount to minor units (e.g., "100.00" -> 10000)
	var major, minor int64
	_, err := fmt.Sscanf(amount, "%d.%d", &major, &minor)
	if err != nil {
		// Try parsing as integer
		_, err = fmt.Sscanf(amount, "%d", &major)
		if err != nil {
			return 0, err
		}
		minor = 0
	}
	return uint64(major*10000 + minor*100), nil
}

// CurrencyToLedger converts a currency code to a ledger ID
func CurrencyToLedger(currency string) uint32 {
	// Map currency codes to ledger IDs
	ledgers := map[string]uint32{
		"USD": 1,
		"EUR": 2,
		"GBP": 3,
		"NGN": 4,
		"KES": 5,
		"ZAR": 6,
		"GHS": 7,
		"TZS": 8,
		"UGX": 9,
		"XOF": 10,
	}
	if id, ok := ledgers[currency]; ok {
		return id
	}
	return 999 // Default ledger
}

// ValidateFulfilment validates that a fulfilment matches a condition
func ValidateFulfilment(condition, fulfilment string) bool {
	// In production, this would verify SHA-256(fulfilment) == condition
	// For now, just check they're not empty
	return condition != "" && fulfilment != ""
}

// HashRequest creates a hash of a request for idempotency
func HashRequest(req interface{}) string {
	data, _ := json.Marshal(req)
	return fmt.Sprintf("%x", data)
}
