// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// ReconciliationLoop handles periodic reconciliation between Mojaloop and TigerBeetle
type ReconciliationLoop struct {
	ledger        LedgerEngine
	workflowStore WorkflowStore
	db            *sql.DB
	config        *ReconciliationConfig
	mu            sync.RWMutex
	running       bool
	stopCh        chan struct{}
}

// ReconciliationConfig holds reconciliation configuration

// NewReconciliationLoop creates a new reconciliation loop
func NewReconciliationLoop(ledger LedgerEngine, workflow WorkflowStore, db *sql.DB, config *ReconciliationConfig) *ReconciliationLoop {
	if config == nil {
		config = DefaultReconciliationConfig()
	}
	return &ReconciliationLoop{
		ledger:        ledger,
		workflowStore: workflow,
		db:            db,
		config:        config,
		stopCh:        make(chan struct{}),
	}
}

// Start begins the reconciliation loops
func (r *ReconciliationLoop) Start(ctx context.Context) error {
	r.mu.Lock()
	if r.running {
		r.mu.Unlock()
		return fmt.Errorf("reconciliation loop already running")
	}
	r.running = true
	r.mu.Unlock()

	// Start fast loop
	go r.runFastLoop(ctx)

	// Start slow loop
	go r.runSlowLoop(ctx)

	return nil
}

// Stop stops the reconciliation loops
func (r *ReconciliationLoop) Stop() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.running {
		close(r.stopCh)
		r.running = false
	}
}

// runFastLoop validates recent transfer state alignment
func (r *ReconciliationLoop) runFastLoop(ctx context.Context) {
	ticker := time.NewTicker(r.config.FastLoopInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.stopCh:
			return
		case <-ticker.C:
			result, err := r.runFastReconciliation(ctx)
			if err != nil {
				r.logError("fast reconciliation failed", err)
				continue
			}

			if len(result.Discrepancies) > 0 {
				r.handleDiscrepancies(ctx, result)
			}

			if len(result.StuckTransfers) > 0 && r.config.AlertOnStuck {
				r.alertStuckTransfers(ctx, result.StuckTransfers)
			}
		}
	}
}

// runSlowLoop performs balance-level reconciliation
func (r *ReconciliationLoop) runSlowLoop(ctx context.Context) {
	ticker := time.NewTicker(r.config.SlowLoopInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.stopCh:
			return
		case <-ticker.C:
			result, err := r.runBalanceReconciliation(ctx)
			if err != nil {
				r.logError("balance reconciliation failed", err)
				continue
			}

			// Save snapshot
			r.saveBalanceSnapshot(ctx, result)

			if len(result.Drifts) > 0 && r.config.AlertOnDrift {
				r.alertBalanceDrift(ctx, result.Drifts)
			}
		}
	}
}

// FastReconciliationResult holds the result of fast reconciliation
type FastReconciliationResult struct {
	Timestamp        time.Time              `json:"timestamp"`
	TransfersChecked int                    `json:"transfers_checked"`
	Discrepancies    []*TransferDiscrepancy `json:"discrepancies,omitempty"`
	StuckTransfers   []*StuckTransfer       `json:"stuck_transfers,omitempty"`
	Duration         time.Duration          `json:"duration"`
}

// TransferDiscrepancy represents a discrepancy between Mojaloop and TigerBeetle state
type TransferDiscrepancy struct {
	TransferID       string                   `json:"transfer_id"`
	MojaloopState    MojaloopTransferState    `json:"mojaloop_state"`
	TigerBeetleState TigerBeetleTransferState `json:"tigerbeetle_state"`
	ExpectedTBState  TigerBeetleTransferState `json:"expected_tb_state"`
	Action           DiscrepancyAction        `json:"action"`
	Resolved         bool                     `json:"resolved"`
	Error            string                   `json:"error,omitempty"`
}

// DiscrepancyAction represents the action to take for a discrepancy
type DiscrepancyAction string

const (
	ActionPostPending     DiscrepancyAction = "POST_PENDING"
	ActionVoidPending     DiscrepancyAction = "VOID_PENDING"
	ActionAdvanceMojaloop DiscrepancyAction = "ADVANCE_MOJALOOP"
	ActionManualReview    DiscrepancyAction = "MANUAL_REVIEW"
	ActionHaltProcessing  DiscrepancyAction = "HALT_PROCESSING"
)

// StuckTransfer represents a transfer that has been pending too long
type StuckTransfer struct {
	TransferID     string                `json:"transfer_id"`
	State          MojaloopTransferState `json:"state"`
	Age            time.Duration         `json:"age"`
	ExpirationDate time.Time             `json:"expiration_date"`
	IsExpired      bool                  `json:"is_expired"`
}

// runFastReconciliation checks recent transfers for state alignment
func (r *ReconciliationLoop) runFastReconciliation(ctx context.Context) (*FastReconciliationResult, error) {
	start := time.Now()
	result := &FastReconciliationResult{
		Timestamp: start,
	}

	// Get recent transfers from workflow store
	cutoff := time.Now().Add(-r.config.FastLoopLookback)
	transfers, err := r.getRecentTransfers(ctx, cutoff)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent transfers: %w", err)
	}

	result.TransfersChecked = len(transfers)

	for _, transfer := range transfers {
		// Check for stuck transfers
		if transfer.MojaloopState == TransferStateReserved {
			age := time.Since(transfer.CreatedAt)
			if age > r.config.StuckTransferAge {
				stuck := &StuckTransfer{
					TransferID:     transfer.TransferID,
					State:          transfer.MojaloopState,
					Age:            age,
					ExpirationDate: transfer.ExpirationDate,
					IsExpired:      time.Now().After(transfer.ExpirationDate),
				}
				result.StuckTransfers = append(result.StuckTransfers, stuck)
			}
		}

		// Check state alignment
		expectedTBState := StateMachineMapping[transfer.MojaloopState]
		if transfer.TigerBeetleState != expectedTBState {
			discrepancy := &TransferDiscrepancy{
				TransferID:       transfer.TransferID,
				MojaloopState:    transfer.MojaloopState,
				TigerBeetleState: transfer.TigerBeetleState,
				ExpectedTBState:  expectedTBState,
			}

			// Determine action
			discrepancy.Action = r.determineAction(discrepancy)
			result.Discrepancies = append(result.Discrepancies, discrepancy)
		}
	}

	result.Duration = time.Since(start)
	return result, nil
}

// determineAction determines what action to take for a discrepancy
func (r *ReconciliationLoop) determineAction(d *TransferDiscrepancy) DiscrepancyAction {
	// Mojaloop says COMMITTED but TigerBeetle is still PENDING
	if d.MojaloopState == TransferStateCommitted && d.TigerBeetleState == TBTransferStatePending {
		return ActionPostPending
	}

	// Mojaloop says ABORTED but TigerBeetle is still PENDING
	if d.MojaloopState == TransferStateAborted && d.TigerBeetleState == TBTransferStatePending {
		return ActionVoidPending
	}

	// TigerBeetle is POSTED but Mojaloop is still RESERVED
	if d.TigerBeetleState == TBTransferStatePosted && d.MojaloopState == TransferStateReserved {
		return ActionAdvanceMojaloop
	}

	// TigerBeetle is VOIDED but Mojaloop is COMMITTED - CRITICAL ERROR
	if d.TigerBeetleState == TBTransferStateVoided && d.MojaloopState == TransferStateCommitted {
		return ActionHaltProcessing
	}

	return ActionManualReview
}

// handleDiscrepancies attempts to resolve discrepancies
func (r *ReconciliationLoop) handleDiscrepancies(ctx context.Context, result *FastReconciliationResult) {
	for _, d := range result.Discrepancies {
		switch d.Action {
		case ActionPostPending:
			// Attempt idempotent post
			state, err := r.workflowStore.GetTransferState(ctx, d.TransferID)
			if err != nil {
				d.Error = err.Error()
				continue
			}
			if err := r.ledger.PostLinkedPendingTransfers(ctx, state.TBTransferIDs); err != nil {
				d.Error = err.Error()
			} else {
				d.Resolved = true
			}

		case ActionVoidPending:
			// Attempt idempotent void
			state, err := r.workflowStore.GetTransferState(ctx, d.TransferID)
			if err != nil {
				d.Error = err.Error()
				continue
			}
			if err := r.ledger.VoidLinkedPendingTransfers(ctx, state.TBTransferIDs); err != nil {
				d.Error = err.Error()
			} else {
				d.Resolved = true
			}

		case ActionAdvanceMojaloop:
			// Advance Mojaloop state machine
			if err := r.workflowStore.UpdateTransferState(ctx, d.TransferID, TransferStateCommitted); err != nil {
				d.Error = err.Error()
			} else {
				d.Resolved = true
			}

		case ActionHaltProcessing:
			// Critical error - halt processing for affected participants
			r.haltProcessing(ctx, d)

		case ActionManualReview:
			// Log for manual review
			r.logDiscrepancy(d)
		}
	}
}

// BalanceReconciliationResult holds the result of balance reconciliation
type BalanceReconciliationResult struct {
	Timestamp       time.Time              `json:"timestamp"`
	AccountsChecked int                    `json:"accounts_checked"`
	Balances        []*AccountBalanceCheck `json:"balances"`
	Drifts          []*BalanceDrift        `json:"drifts,omitempty"`
	Duration        time.Duration          `json:"duration"`
}

// AccountBalanceCheck holds balance information for an account
type AccountBalanceCheck struct {
	ParticipantID   string `json:"participant_id"`
	Currency        string `json:"currency"`
	AccountType     string `json:"account_type"`
	TBBalance       int64  `json:"tb_balance"`
	OperationalView int64  `json:"operational_view"`
	Match           bool   `json:"match"`
}

// BalanceDrift represents a drift between TigerBeetle and operational view
type BalanceDrift struct {
	ParticipantID   string `json:"participant_id"`
	Currency        string `json:"currency"`
	AccountType     string `json:"account_type"`
	TBBalance       int64  `json:"tb_balance"`
	OperationalView int64  `json:"operational_view"`
	Drift           int64  `json:"drift"`
}

// runBalanceReconciliation performs balance-level reconciliation
func (r *ReconciliationLoop) runBalanceReconciliation(ctx context.Context) (*BalanceReconciliationResult, error) {
	start := time.Now()
	result := &BalanceReconciliationResult{
		Timestamp: start,
	}

	// Get all participant accounts
	participants, err := r.getAllParticipants(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}

	for _, participant := range participants {
		for currency, accountID := range participant.TBAccounts {
			// Get TigerBeetle balance
			tbBalance, err := r.ledger.GetAccountBalance(ctx, accountID)
			if err != nil {
				r.logError(fmt.Sprintf("failed to get TB balance for %s/%s", participant.Name, currency), err)
				continue
			}

			// Calculate available balance
			tbAvailable := int64(tbBalance.CreditsPosted) - int64(tbBalance.DebitsPosted) - int64(tbBalance.DebitsPending)

			// Get operational view (from Mojaloop position table or derived)
			operationalBalance, err := r.getOperationalBalance(ctx, participant.Name, currency)
			if err != nil {
				r.logError(fmt.Sprintf("failed to get operational balance for %s/%s", participant.Name, currency), err)
				continue
			}

			check := &AccountBalanceCheck{
				ParticipantID:   participant.Name,
				Currency:        currency,
				AccountType:     "POSITION",
				TBBalance:       tbAvailable,
				OperationalView: operationalBalance,
				Match:           tbAvailable == operationalBalance,
			}
			result.Balances = append(result.Balances, check)
			result.AccountsChecked++

			// Check for drift
			drift := tbAvailable - operationalBalance
			if drift != 0 && (drift > r.config.MaxDriftAllowed || drift < -r.config.MaxDriftAllowed) {
				result.Drifts = append(result.Drifts, &BalanceDrift{
					ParticipantID:   participant.Name,
					Currency:        currency,
					AccountType:     "POSITION",
					TBBalance:       tbAvailable,
					OperationalView: operationalBalance,
					Drift:           drift,
				})
			}
		}
	}

	result.Duration = time.Since(start)
	return result, nil
}

// BalanceSnapshot represents a point-in-time balance snapshot
type BalanceSnapshot struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	Balances      []*AccountBalanceCheck `json:"balances"`
	TotalAccounts int                    `json:"total_accounts"`
	DriftCount    int                    `json:"drift_count"`
}

// saveBalanceSnapshot saves a balance snapshot to the database
func (r *ReconciliationLoop) saveBalanceSnapshot(ctx context.Context, result *BalanceReconciliationResult) error {
	snapshot := &BalanceSnapshot{
		ID:            fmt.Sprintf("snapshot-%d", time.Now().UnixNano()),
		Timestamp:     result.Timestamp,
		Balances:      result.Balances,
		TotalAccounts: result.AccountsChecked,
		DriftCount:    len(result.Drifts),
	}

	data, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO reconciliation_snapshots (id, timestamp, data, total_accounts, drift_count)
		VALUES ($1, $2, $3, $4, $5)
	`, snapshot.ID, snapshot.Timestamp, data, snapshot.TotalAccounts, snapshot.DriftCount)

	return err
}

// Helper methods

func (r *ReconciliationLoop) getRecentTransfers(ctx context.Context, since time.Time) ([]*TransferWorkflowState, error) {
	// Query workflow store for recent transfers
	rows, err := r.db.QueryContext(ctx, `
		SELECT transfer_id, mojaloop_state, tigerbeetle_state, payer_fsp, payee_fsp,
		       amount, currency, expiration_date, created_at, updated_at
		FROM mojaloop_transfers
		WHERE created_at >= $1
		ORDER BY created_at DESC
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transfers []*TransferWorkflowState
	for rows.Next() {
		t := &TransferWorkflowState{}
		var mojaloopState, tbState string
		err := rows.Scan(
			&t.TransferID, &mojaloopState, &tbState, &t.PayerFSP, &t.PayeeFSP,
			&t.Amount, &t.Currency, &t.ExpirationDate, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			continue
		}
		t.MojaloopState = MojaloopTransferState(mojaloopState)
		t.TigerBeetleState = TigerBeetleTransferState(tbState)
		transfers = append(transfers, t)
	}

	return transfers, nil
}

func (r *ReconciliationLoop) getAllParticipants(ctx context.Context) ([]*Participant, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT participant_id, name, is_active, tb_accounts
		FROM mojaloop_participants
		WHERE is_active = true
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []*Participant
	for rows.Next() {
		p := &Participant{}
		var tbAccountsJSON []byte
		err := rows.Scan(&p.ParticipantID, &p.Name, &p.IsActive, &tbAccountsJSON)
		if err != nil {
			continue
		}
		json.Unmarshal(tbAccountsJSON, &p.TBAccounts)
		participants = append(participants, p)
	}

	return participants, nil
}

func (r *ReconciliationLoop) getOperationalBalance(ctx context.Context, fspID, currency string) (int64, error) {
	var balance int64
	err := r.db.QueryRowContext(ctx, `
		SELECT COALESCE(value, 0) - COALESCE(reserved_value, 0)
		FROM participant_position pp
		JOIN participant_currency pc ON pp.participant_currency_id = pc.participant_currency_id
		JOIN participant p ON pc.participant_id = p.participant_id
		JOIN currency c ON pc.currency_id = c.currency_id
		WHERE p.name = $1 AND c.currency_id = $2
	`, fspID, currency).Scan(&balance)

	if err == sql.ErrNoRows {
		return 0, nil
	}
	return balance, err
}

func (r *ReconciliationLoop) haltProcessing(ctx context.Context, d *TransferDiscrepancy) {
	// Log critical error
	r.logError(fmt.Sprintf("CRITICAL: Halting processing due to discrepancy in transfer %s", d.TransferID), nil)

	// In production, this would:
	// 1. Set a circuit breaker flag
	// 2. Reject new transfers for affected participants
	// 3. Send critical alert
	// 4. Require manual intervention to resume
}

func (r *ReconciliationLoop) alertStuckTransfers(ctx context.Context, stuck []*StuckTransfer) {
	// Send alert for stuck transfers
	for _, s := range stuck {
		r.logError(fmt.Sprintf("Stuck transfer: %s, age: %v, expired: %v", s.TransferID, s.Age, s.IsExpired), nil)
	}
}

func (r *ReconciliationLoop) alertBalanceDrift(ctx context.Context, drifts []*BalanceDrift) {
	// Send alert for balance drifts
	for _, d := range drifts {
		r.logError(fmt.Sprintf("Balance drift: %s/%s, TB: %d, Operational: %d, Drift: %d",
			d.ParticipantID, d.Currency, d.TBBalance, d.OperationalView, d.Drift), nil)
	}
}

func (r *ReconciliationLoop) logDiscrepancy(d *TransferDiscrepancy) {
	fmt.Printf("Discrepancy: transfer=%s, mojaloop=%s, tb=%s, expected=%s, action=%s\n",
		d.TransferID, d.MojaloopState, d.TigerBeetleState, d.ExpectedTBState, d.Action)
}

func (r *ReconciliationLoop) logError(msg string, err error) {
	if err != nil {
		fmt.Printf("ERROR: %s: %v\n", msg, err)
	} else {
		fmt.Printf("ERROR: %s\n", msg)
	}
}

// ReconciliationSchema returns the PostgreSQL schema for reconciliation tables
func ReconciliationSchema() string {
	return `
-- Reconciliation snapshots table
CREATE TABLE IF NOT EXISTS reconciliation_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB NOT NULL,
    total_accounts INTEGER NOT NULL,
    drift_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying recent snapshots
CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_timestamp 
ON reconciliation_snapshots(timestamp DESC);

-- Reconciliation discrepancies table
CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id SERIAL PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    mojaloop_state VARCHAR(50) NOT NULL,
    tigerbeetle_state VARCHAR(50) NOT NULL,
    expected_tb_state VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying unresolved discrepancies
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_unresolved 
ON reconciliation_discrepancies(resolved, created_at DESC) WHERE resolved = FALSE;

-- Balance drift history table
CREATE TABLE IF NOT EXISTS balance_drift_history (
    id SERIAL PRIMARY KEY,
    participant_id VARCHAR(128) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    tb_balance BIGINT NOT NULL,
    operational_view BIGINT NOT NULL,
    drift BIGINT NOT NULL,
    snapshot_id VARCHAR(64) REFERENCES reconciliation_snapshots(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying drift by participant
CREATE INDEX IF NOT EXISTS idx_balance_drift_history_participant 
ON balance_drift_history(participant_id, currency, created_at DESC);
`
}
