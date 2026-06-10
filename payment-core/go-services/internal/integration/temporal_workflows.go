// Package integration provides infrastructure integration components
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// TransferWorkflow represents the Temporal workflow for transfer lifecycle
// This workflow orchestrates the complete transfer flow with TigerBeetle integration
type TransferWorkflow struct {
	TransferID    string                `json:"transfer_id"`
	PayerFSP      string                `json:"payer_fsp"`
	PayeeFSP      string                `json:"payee_fsp"`
	Amount        int64                 `json:"amount"`
	Currency      string                `json:"currency"`
	Condition     string                `json:"condition,omitempty"`
	Expiration    time.Time             `json:"expiration"`
	ExtensionList map[string]string     `json:"extension_list,omitempty"`
	State         TransferWorkflowState `json:"state"`
	TigerBeetleID uint64                `json:"tigerbeetle_id,omitempty"`
	ErrorCode     string                `json:"error_code,omitempty"`
	ErrorMessage  string                `json:"error_message,omitempty"`
	CreatedAt     time.Time             `json:"created_at"`
	CompletedAt   *time.Time            `json:"completed_at,omitempty"`
}

// TransferWorkflowState represents the state of a transfer workflow
type TransferWorkflowState string

const (
	TransferStateInitiated  TransferWorkflowState = "INITIATED"
	TransferStateValidating TransferWorkflowState = "VALIDATING"
	TransferStateReserving  TransferWorkflowState = "RESERVING"
	TransferStateReserved   TransferWorkflowState = "RESERVED"
	TransferStateCommitting TransferWorkflowState = "COMMITTING"
	TransferStateCommitted  TransferWorkflowState = "COMMITTED"
	TransferStateAborting   TransferWorkflowState = "ABORTING"
	TransferStateAborted    TransferWorkflowState = "ABORTED"
	TransferStateExpired    TransferWorkflowState = "EXPIRED"
	TransferStateFailed     TransferWorkflowState = "FAILED"
)

// TransferWorkflowInput is the input for starting a transfer workflow
type TransferWorkflowInput struct {
	TransferID    string            `json:"transfer_id"`
	PayerFSP      string            `json:"payer_fsp"`
	PayeeFSP      string            `json:"payee_fsp"`
	Amount        int64             `json:"amount"`
	Currency      string            `json:"currency"`
	Condition     string            `json:"condition,omitempty"`
	Expiration    time.Time         `json:"expiration"`
	ILPPacket     string            `json:"ilp_packet,omitempty"`
	ExtensionList map[string]string `json:"extension_list,omitempty"`
}

// TransferWorkflowResult is the result of a transfer workflow
type TransferWorkflowResult struct {
	TransferID    string                `json:"transfer_id"`
	State         TransferWorkflowState `json:"state"`
	Fulfilment    string                `json:"fulfilment,omitempty"`
	TigerBeetleID uint64                `json:"tigerbeetle_id,omitempty"`
	CompletedAt   time.Time             `json:"completed_at"`
	ErrorCode     string                `json:"error_code,omitempty"`
	ErrorMessage  string                `json:"error_message,omitempty"`
}

// TemporalTransferWorkflowDefinition defines the Temporal workflow for transfers
// This is the main workflow that orchestrates the transfer lifecycle
type TemporalTransferWorkflowDefinition struct{}

// Execute runs the transfer workflow
// In Temporal, this would be decorated with @workflow.defn
func (w *TemporalTransferWorkflowDefinition) Execute(ctx context.Context, input *TransferWorkflowInput) (*TransferWorkflowResult, error) {
	workflow := &TransferWorkflow{
		TransferID:    input.TransferID,
		PayerFSP:      input.PayerFSP,
		PayeeFSP:      input.PayeeFSP,
		Amount:        input.Amount,
		Currency:      input.Currency,
		Condition:     input.Condition,
		Expiration:    input.Expiration,
		ExtensionList: input.ExtensionList,
		State:         TransferStateInitiated,
		CreatedAt:     time.Now().UTC(),
	}

	result := &TransferWorkflowResult{
		TransferID: input.TransferID,
	}

	// Step 1: Validate transfer
	workflow.State = TransferStateValidating
	validationResult, err := executeValidateTransferActivity(ctx, input)
	if err != nil {
		workflow.State = TransferStateFailed
		workflow.ErrorCode = "3100"
		workflow.ErrorMessage = err.Error()
		result.State = TransferStateFailed
		result.ErrorCode = workflow.ErrorCode
		result.ErrorMessage = workflow.ErrorMessage
		return result, nil
	}

	if !validationResult.Valid {
		workflow.State = TransferStateFailed
		workflow.ErrorCode = validationResult.ErrorCode
		workflow.ErrorMessage = validationResult.ErrorMessage
		result.State = TransferStateFailed
		result.ErrorCode = workflow.ErrorCode
		result.ErrorMessage = workflow.ErrorMessage
		return result, nil
	}

	// Step 2: Reserve funds in TigerBeetle (pending transfer)
	workflow.State = TransferStateReserving
	reserveResult, err := executeReserveFundsActivity(ctx, &ReserveFundsInput{
		TransferID:     input.TransferID,
		PayerAccountID: validationResult.PayerAccountID,
		PayeeAccountID: validationResult.PayeeAccountID,
		Amount:         input.Amount,
		Currency:       input.Currency,
		Timeout:        input.Expiration.Sub(time.Now()),
	})
	if err != nil {
		workflow.State = TransferStateFailed
		workflow.ErrorCode = "3000"
		workflow.ErrorMessage = fmt.Sprintf("Failed to reserve funds: %v", err)
		result.State = TransferStateFailed
		result.ErrorCode = workflow.ErrorCode
		result.ErrorMessage = workflow.ErrorMessage
		return result, nil
	}

	workflow.TigerBeetleID = reserveResult.TigerBeetleTransferID
	workflow.State = TransferStateReserved
	result.TigerBeetleID = reserveResult.TigerBeetleTransferID

	// Step 3: Wait for fulfillment or timeout
	// In Temporal, this would use workflow.Await with a selector
	fulfillmentCh := make(chan *FulfillmentSignal, 1)
	timeoutCh := time.After(time.Until(input.Expiration))

	// Simulate waiting for fulfillment signal
	// In real Temporal workflow: workflow.GetSignalChannel("fulfillment").Receive(ctx, &signal)
	select {
	case fulfillment := <-fulfillmentCh:
		// Step 4a: Commit transfer
		workflow.State = TransferStateCommitting
		commitResult, err := executeCommitTransferActivity(ctx, &CommitTransferInput{
			TransferID:            input.TransferID,
			TigerBeetleTransferID: reserveResult.TigerBeetleTransferID,
			Fulfilment:            fulfillment.Fulfilment,
		})
		if err != nil {
			// Commit failed, abort
			workflow.State = TransferStateAborting
			_, abortErr := executeAbortTransferActivity(ctx, &AbortTransferInput{
				TransferID:            input.TransferID,
				TigerBeetleTransferID: reserveResult.TigerBeetleTransferID,
				Reason:                fmt.Sprintf("Commit failed: %v", err),
			})
			if abortErr != nil {
				workflow.ErrorMessage = fmt.Sprintf("Commit and abort both failed: %v, %v", err, abortErr)
			}
			workflow.State = TransferStateAborted
			result.State = TransferStateAborted
			result.ErrorCode = "3000"
			result.ErrorMessage = workflow.ErrorMessage
			return result, nil
		}

		workflow.State = TransferStateCommitted
		now := time.Now().UTC()
		workflow.CompletedAt = &now
		result.State = TransferStateCommitted
		result.Fulfilment = commitResult.Fulfilment
		result.CompletedAt = now

	case <-timeoutCh:
		// Step 4b: Timeout - abort transfer
		workflow.State = TransferStateAborting
		_, err := executeAbortTransferActivity(ctx, &AbortTransferInput{
			TransferID:            input.TransferID,
			TigerBeetleTransferID: reserveResult.TigerBeetleTransferID,
			Reason:                "Transfer expired",
		})
		if err != nil {
			workflow.ErrorMessage = fmt.Sprintf("Abort failed: %v", err)
		}
		workflow.State = TransferStateExpired
		workflow.ErrorCode = "5100"
		workflow.ErrorMessage = "Transfer expired"
		result.State = TransferStateExpired
		result.ErrorCode = workflow.ErrorCode
		result.ErrorMessage = workflow.ErrorMessage

	case <-ctx.Done():
		// Context cancelled
		workflow.State = TransferStateAborting
		executeAbortTransferActivity(ctx, &AbortTransferInput{
			TransferID:            input.TransferID,
			TigerBeetleTransferID: reserveResult.TigerBeetleTransferID,
			Reason:                "Workflow cancelled",
		})
		workflow.State = TransferStateAborted
		result.State = TransferStateAborted
	}

	return result, nil
}

// FulfillmentSignal represents a fulfillment signal to the workflow
type FulfillmentSignal struct {
	TransferID  string    `json:"transfer_id"`
	Fulfilment  string    `json:"fulfilment"`
	CompletedAt time.Time `json:"completed_at"`
}

// Activity definitions

// ValidateTransferInput is input for validate transfer activity
type ValidateTransferInput struct {
	TransferID string `json:"transfer_id"`
	PayerFSP   string `json:"payer_fsp"`
	PayeeFSP   string `json:"payee_fsp"`
	Amount     int64  `json:"amount"`
	Currency   string `json:"currency"`
	Condition  string `json:"condition,omitempty"`
}

// ValidateTransferResult is result of validate transfer activity
type ValidateTransferResult struct {
	Valid          bool   `json:"valid"`
	PayerAccountID uint64 `json:"payer_account_id"`
	PayeeAccountID uint64 `json:"payee_account_id"`
	ErrorCode      string `json:"error_code,omitempty"`
	ErrorMessage   string `json:"error_message,omitempty"`
}

// executeValidateTransferActivity validates the transfer
func executeValidateTransferActivity(ctx context.Context, input *TransferWorkflowInput) (*ValidateTransferResult, error) {
	// In Temporal: workflow.ExecuteActivity(ctx, ValidateTransferActivity, input)

	result := &ValidateTransferResult{Valid: true}

	// Validate payer FSP exists and is active
	payerAccount, err := lookupParticipantAccount(ctx, input.PayerFSP, input.Currency)
	if err != nil {
		result.Valid = false
		result.ErrorCode = "3201"
		result.ErrorMessage = fmt.Sprintf("Payer FSP not found: %s", input.PayerFSP)
		return result, nil
	}
	result.PayerAccountID = payerAccount

	// Validate payee FSP exists and is active
	payeeAccount, err := lookupParticipantAccount(ctx, input.PayeeFSP, input.Currency)
	if err != nil {
		result.Valid = false
		result.ErrorCode = "3201"
		result.ErrorMessage = fmt.Sprintf("Payee FSP not found: %s", input.PayeeFSP)
		return result, nil
	}
	result.PayeeAccountID = payeeAccount

	// Validate amount is positive
	if input.Amount <= 0 {
		result.Valid = false
		result.ErrorCode = "3100"
		result.ErrorMessage = "Amount must be positive"
		return result, nil
	}

	// Validate currency is supported
	if !isCurrencySupported(input.Currency) {
		result.Valid = false
		result.ErrorCode = "3100"
		result.ErrorMessage = fmt.Sprintf("Currency not supported: %s", input.Currency)
		return result, nil
	}

	// Validate condition format if provided
	if input.Condition != "" && !isValidCondition(input.Condition) {
		result.Valid = false
		result.ErrorCode = "3100"
		result.ErrorMessage = "Invalid condition format"
		return result, nil
	}

	return result, nil
}

// ReserveFundsInput is input for reserve funds activity
type ReserveFundsInput struct {
	TransferID     string        `json:"transfer_id"`
	PayerAccountID uint64        `json:"payer_account_id"`
	PayeeAccountID uint64        `json:"payee_account_id"`
	Amount         int64         `json:"amount"`
	Currency       string        `json:"currency"`
	Timeout        time.Duration `json:"timeout"`
}

// ReserveFundsResult is result of reserve funds activity
type ReserveFundsResult struct {
	TigerBeetleTransferID uint64 `json:"tigerbeetle_transfer_id"`
	Reserved              bool   `json:"reserved"`
}

// executeReserveFundsActivity reserves funds in TigerBeetle
func executeReserveFundsActivity(ctx context.Context, input *ReserveFundsInput) (*ReserveFundsResult, error) {
	// In Temporal: workflow.ExecuteActivity(ctx, ReserveFundsActivity, input)

	// Generate TigerBeetle transfer ID from transfer ID
	tbTransferID := generateTigerBeetleID(input.TransferID)

	// Create pending transfer in TigerBeetle
	// This would call the TigerBeetle client
	transfer := &TigerBeetleTransfer{
		ID:              tbTransferID,
		DebitAccountID:  input.PayerAccountID,
		CreditAccountID: input.PayeeAccountID,
		Amount:          uint64(input.Amount),
		Timeout:         uint32(input.Timeout.Seconds()),
		Flags:           TBTransferFlagPending,
	}

	err := createTigerBeetleTransfer(ctx, transfer)
	if err != nil {
		return nil, fmt.Errorf("failed to create pending transfer: %w", err)
	}

	return &ReserveFundsResult{
		TigerBeetleTransferID: tbTransferID,
		Reserved:              true,
	}, nil
}

// CommitTransferInput is input for commit transfer activity
type CommitTransferInput struct {
	TransferID            string `json:"transfer_id"`
	TigerBeetleTransferID uint64 `json:"tigerbeetle_transfer_id"`
	Fulfilment            string `json:"fulfilment"`
}

// CommitTransferResult is result of commit transfer activity
type CommitTransferResult struct {
	Committed  bool   `json:"committed"`
	Fulfilment string `json:"fulfilment"`
}

// executeCommitTransferActivity commits the transfer in TigerBeetle
func executeCommitTransferActivity(ctx context.Context, input *CommitTransferInput) (*CommitTransferResult, error) {
	// In Temporal: workflow.ExecuteActivity(ctx, CommitTransferActivity, input)

	// Post the pending transfer in TigerBeetle
	err := postTigerBeetleTransfer(ctx, input.TigerBeetleTransferID)
	if err != nil {
		return nil, fmt.Errorf("failed to commit transfer: %w", err)
	}

	return &CommitTransferResult{
		Committed:  true,
		Fulfilment: input.Fulfilment,
	}, nil
}

// AbortTransferInput is input for abort transfer activity
type AbortTransferInput struct {
	TransferID            string `json:"transfer_id"`
	TigerBeetleTransferID uint64 `json:"tigerbeetle_transfer_id"`
	Reason                string `json:"reason"`
}

// AbortTransferResult is result of abort transfer activity
type AbortTransferResult struct {
	Aborted bool   `json:"aborted"`
	Reason  string `json:"reason"`
}

// executeAbortTransferActivity aborts the transfer in TigerBeetle
func executeAbortTransferActivity(ctx context.Context, input *AbortTransferInput) (*AbortTransferResult, error) {
	// In Temporal: workflow.ExecuteActivity(ctx, AbortTransferActivity, input)

	// Void the pending transfer in TigerBeetle
	err := voidTigerBeetleTransfer(ctx, input.TigerBeetleTransferID)
	if err != nil {
		return nil, fmt.Errorf("failed to abort transfer: %w", err)
	}

	return &AbortTransferResult{
		Aborted: true,
		Reason:  input.Reason,
	}, nil
}

// Helper functions

func lookupParticipantAccount(ctx context.Context, fspID, currency string) (uint64, error) {
	// Map of known FSP IDs to their TigerBeetle account IDs
	// In a full deployment, this would query PostgreSQL:
	// SELECT tigerbeetle_account_id FROM mojaloop_participants WHERE fsp_id = $1 AND currency = $2
	accounts := map[string]map[string]uint64{
		"firstbank":   {"NGN": 0x0001_0000_0000_0001, "USD": 0x0001_0000_0000_0002},
		"gtbank":      {"NGN": 0x0002_0000_0000_0001, "USD": 0x0002_0000_0000_0002},
		"accessbank":  {"NGN": 0x0003_0000_0000_0001, "USD": 0x0003_0000_0000_0002},
		"zenithbank":  {"NGN": 0x0004_0000_0000_0001, "USD": 0x0004_0000_0000_0002},
		"ubabank":     {"NGN": 0x0005_0000_0000_0001, "USD": 0x0005_0000_0000_0002},
		"sterlingbank": {"NGN": 0x0006_0000_0000_0001, "USD": 0x0006_0000_0000_0002},
		"wemabank":    {"NGN": 0x0007_0000_0000_0001, "USD": 0x0007_0000_0000_0002},
		"fidelitybank": {"NGN": 0x0008_0000_0000_0001, "USD": 0x0008_0000_0000_0002},
	}

	if currencies, ok := accounts[fspID]; ok {
		if accountID, ok := currencies[currency]; ok {
			return accountID, nil
		}
		return 0, fmt.Errorf("currency %s not supported for FSP %s", currency, fspID)
	}
	return 0, fmt.Errorf("unknown FSP: %s", fspID)
}

func isCurrencySupported(currency string) bool {
	supported := map[string]bool{
		"NGN": true, "USD": true, "EUR": true, "GBP": true,
		"KES": true, "GHS": true, "ZAR": true, "XOF": true,
	}
	return supported[currency]
}

func isValidCondition(condition string) bool {
	// Validate ILP condition format (base64url encoded SHA-256 hash)
	return len(condition) == 43 || len(condition) == 44
}

func generateTigerBeetleID(transferID string) uint64 {
	// Generate deterministic TigerBeetle ID from transfer ID
	// In production: use a proper hash function
	var id uint64
	for i, c := range transferID {
		id += uint64(c) * uint64(i+1)
	}
	return id
}

// TigerBeetle integration types

const (
	TBTransferFlagPending = 1 << 0
	TBTransferFlagPost    = 1 << 1
	TBTransferFlagVoid    = 1 << 2
)

type TigerBeetleTransfer struct {
	ID              uint64
	DebitAccountID  uint64
	CreditAccountID uint64
	Amount          uint64
	Timeout         uint32
	Flags           uint16
}

func createTigerBeetleTransfer(ctx context.Context, transfer *TigerBeetleTransfer) error {
	// In production: call TigerBeetle client
	return nil
}

func postTigerBeetleTransfer(ctx context.Context, transferID uint64) error {
	// In production: call TigerBeetle client to post pending transfer
	return nil
}

func voidTigerBeetleTransfer(ctx context.Context, transferID uint64) error {
	// In production: call TigerBeetle client to void pending transfer
	return nil
}

// SettlementWorkflow represents the Temporal workflow for settlement windows
type SettlementWorkflow struct {
	SettlementID   string                  `json:"settlement_id"`
	WindowID       string                  `json:"window_id"`
	State          SettlementWorkflowState `json:"state"`
	Participants   []string                `json:"participants"`
	NetPositions   map[string]int64        `json:"net_positions"`
	SettlementDate time.Time               `json:"settlement_date"`
	CreatedAt      time.Time               `json:"created_at"`
	CompletedAt    *time.Time              `json:"completed_at,omitempty"`
}

// SettlementWorkflowState represents settlement workflow state
type SettlementWorkflowState string

const (
	SettlementStatePending     SettlementWorkflowState = "PENDING"
	SettlementStateCalculating SettlementWorkflowState = "CALCULATING"
	SettlementStateSettling    SettlementWorkflowState = "SETTLING"
	SettlementStateSettled     SettlementWorkflowState = "SETTLED"
	SettlementStateFailed      SettlementWorkflowState = "FAILED"
)

// SettlementWorkflowInput is input for settlement workflow
type SettlementWorkflowInput struct {
	WindowID       string    `json:"window_id"`
	SettlementDate time.Time `json:"settlement_date"`
	Participants   []string  `json:"participants"`
}

// SettlementWorkflowResult is result of settlement workflow
type SettlementWorkflowResult struct {
	SettlementID string                  `json:"settlement_id"`
	State        SettlementWorkflowState `json:"state"`
	NetPositions map[string]int64        `json:"net_positions"`
	CompletedAt  time.Time               `json:"completed_at"`
}

// ParticipantOnboardingWorkflow represents workflow for participant onboarding
type ParticipantOnboardingWorkflow struct {
	ParticipantID   string                     `json:"participant_id"`
	FSPID           string                     `json:"fsp_id"`
	State           ParticipantOnboardingState `json:"state"`
	KYCStatus       string                     `json:"kyc_status"`
	AccountsCreated bool                       `json:"accounts_created"`
	LimitsSet       bool                       `json:"limits_set"`
	CreatedAt       time.Time                  `json:"created_at"`
	CompletedAt     *time.Time                 `json:"completed_at,omitempty"`
}

// ParticipantOnboardingState represents onboarding state
type ParticipantOnboardingState string

const (
	OnboardingStateInitiated      ParticipantOnboardingState = "INITIATED"
	OnboardingStateKYCPending     ParticipantOnboardingState = "KYC_PENDING"
	OnboardingStateKYCApproved    ParticipantOnboardingState = "KYC_APPROVED"
	OnboardingStateAccountCreated ParticipantOnboardingState = "ACCOUNT_CREATED"
	OnboardingStateLimitsSet      ParticipantOnboardingState = "LIMITS_SET"
	OnboardingStateActive         ParticipantOnboardingState = "ACTIVE"
	OnboardingStateRejected       ParticipantOnboardingState = "REJECTED"
)

// DisputeWorkflow represents workflow for dispute resolution
type DisputeWorkflow struct {
	DisputeID     string               `json:"dispute_id"`
	TransferID    string               `json:"transfer_id"`
	State         DisputeWorkflowState `json:"state"`
	InitiatorFSP  string               `json:"initiator_fsp"`
	RespondentFSP string               `json:"respondent_fsp"`
	Amount        int64                `json:"amount"`
	Reason        string               `json:"reason"`
	Resolution    string               `json:"resolution,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	ResolvedAt    *time.Time           `json:"resolved_at,omitempty"`
}

// DisputeWorkflowState represents dispute state
type DisputeWorkflowState string

const (
	DisputeStateOpened        DisputeWorkflowState = "OPENED"
	DisputeStateInvestigating DisputeWorkflowState = "INVESTIGATING"
	DisputeStateEscalated     DisputeWorkflowState = "ESCALATED"
	DisputeStateResolved      DisputeWorkflowState = "RESOLVED"
	DisputeStateRejected      DisputeWorkflowState = "REJECTED"
)

// TemporalWorkerConfig holds configuration for Temporal workers
type TemporalWorkerConfig struct {
	TemporalHost       string `json:"temporal_host"`
	TemporalPort       int    `json:"temporal_port"`
	Namespace          string `json:"namespace"`
	TaskQueue          string `json:"task_queue"`
	WorkerCount        int    `json:"worker_count"`
	MaxConcurrentTasks int    `json:"max_concurrent_tasks"`
}

// DefaultTemporalWorkerConfig returns default worker configuration
func DefaultTemporalWorkerConfig() *TemporalWorkerConfig {
	return &TemporalWorkerConfig{
		TemporalHost:       "temporal-frontend.payment-switch.svc.cluster.local",
		TemporalPort:       7233,
		Namespace:          "payment-switch",
		TaskQueue:          "mojaloop-transfers",
		WorkerCount:        10,
		MaxConcurrentTasks: 100,
	}
}

// TemporalWorkflowSchema returns PostgreSQL schema for workflow state
func TemporalWorkflowSchema() string {
	return `
-- Transfer workflow state tracking
CREATE TABLE IF NOT EXISTS temporal_transfer_workflows (
    transfer_id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL,
    tigerbeetle_id BIGINT,
    payer_fsp VARCHAR(64) NOT NULL,
    payee_fsp VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    condition VARCHAR(64),
    expiration TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(10),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for workflow queries
CREATE INDEX IF NOT EXISTS idx_temporal_workflows_state 
ON temporal_transfer_workflows(state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_temporal_workflows_fsp 
ON temporal_transfer_workflows(payer_fsp, payee_fsp);

-- Settlement workflow state tracking
CREATE TABLE IF NOT EXISTS temporal_settlement_workflows (
    settlement_id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    window_id VARCHAR(64) NOT NULL,
    state VARCHAR(50) NOT NULL,
    settlement_date DATE NOT NULL,
    net_positions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Participant onboarding workflow tracking
CREATE TABLE IF NOT EXISTS temporal_onboarding_workflows (
    participant_id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    fsp_id VARCHAR(64) NOT NULL,
    state VARCHAR(50) NOT NULL,
    kyc_status VARCHAR(50),
    accounts_created BOOLEAN DEFAULT FALSE,
    limits_set BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Dispute workflow tracking
CREATE TABLE IF NOT EXISTS temporal_dispute_workflows (
    dispute_id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    transfer_id VARCHAR(64) NOT NULL,
    state VARCHAR(50) NOT NULL,
    initiator_fsp VARCHAR(64) NOT NULL,
    respondent_fsp VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    reason TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Index for dispute queries
CREATE INDEX IF NOT EXISTS idx_temporal_disputes_transfer 
ON temporal_dispute_workflows(transfer_id);

CREATE INDEX IF NOT EXISTS idx_temporal_disputes_fsp 
ON temporal_dispute_workflows(initiator_fsp, respondent_fsp);
`
}

// WorkflowMetrics tracks workflow execution metrics
type WorkflowMetrics struct {
	WorkflowsStarted   int64   `json:"workflows_started"`
	WorkflowsCompleted int64   `json:"workflows_completed"`
	WorkflowsFailed    int64   `json:"workflows_failed"`
	WorkflowsTimedOut  int64   `json:"workflows_timed_out"`
	ActivitiesExecuted int64   `json:"activities_executed"`
	ActivitiesFailed   int64   `json:"activities_failed"`
	AverageLatencyMs   float64 `json:"average_latency_ms"`
	P99LatencyMs       float64 `json:"p99_latency_ms"`
}

// WorkflowMetricsJSON returns metrics as JSON
func (m *WorkflowMetrics) JSON() ([]byte, error) {
	return json.Marshal(m)
}
