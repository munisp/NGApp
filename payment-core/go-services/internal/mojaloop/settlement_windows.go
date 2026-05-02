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

// SettlementWindowManager handles settlement window lifecycle and netting
type SettlementWindowManager struct {
	ledger           LedgerEngine
	workflowStore    WorkflowStore
	db               *sql.DB
	linkedMgr        *LinkedTransferManager
	participantMgr   *ParticipantLifecycleManager
	mu               sync.RWMutex
}

// NewSettlementWindowManager creates a new settlement window manager
func NewSettlementWindowManager(
	ledger LedgerEngine,
	workflow WorkflowStore,
	db *sql.DB,
	linkedMgr *LinkedTransferManager,
	participantMgr *ParticipantLifecycleManager,
) *SettlementWindowManager {
	return &SettlementWindowManager{
		ledger:         ledger,
		workflowStore:  workflow,
		db:             db,
		linkedMgr:      linkedMgr,
		participantMgr: participantMgr,
	}
}

// SettlementWindowState represents the state of a settlement window
type SettlementWindowState string

const (
	SettlementWindowStateOpen       SettlementWindowState = "OPEN"
	SettlementWindowStateClosed     SettlementWindowState = "CLOSED"
	SettlementWindowStatePending    SettlementWindowState = "PENDING_SETTLEMENT"
	SettlementWindowStateSettled    SettlementWindowState = "SETTLED"
	SettlementWindowStateAborted    SettlementWindowState = "ABORTED"
)

// SettlementWindow represents a settlement window
type SettlementWindow struct {
	SettlementWindowID int64                 `json:"settlementWindowId"`
	State              SettlementWindowState `json:"state"`
	Reason             string                `json:"reason,omitempty"`
	CreatedDate        time.Time             `json:"createdDate"`
	ChangedDate        time.Time             `json:"changedDate"`
	ClosedDate         *time.Time            `json:"closedDate,omitempty"`
	SettledDate        *time.Time            `json:"settledDate,omitempty"`
}

// SettlementWindowContent represents the content of a settlement window
type SettlementWindowContent struct {
	SettlementWindowID int64                    `json:"settlementWindowId"`
	Participants       []*ParticipantSettlement `json:"participants"`
	TotalTransfers     int                      `json:"totalTransfers"`
	TotalAmount        map[string]int64         `json:"totalAmount"` // currency -> amount
}

// ParticipantSettlement represents a participant's settlement position
type ParticipantSettlement struct {
	ParticipantID   string           `json:"participantId"`
	ParticipantName string           `json:"participantName"`
	Accounts        []*AccountSettlement `json:"accounts"`
}

// AccountSettlement represents settlement for a specific account
type AccountSettlement struct {
	AccountID       int64  `json:"accountId"`
	Currency        string `json:"currency"`
	NetSettlement   int64  `json:"netSettlement"` // Positive = receive, Negative = pay
	TransferCount   int    `json:"transferCount"`
	TotalDebits     int64  `json:"totalDebits"`
	TotalCredits    int64  `json:"totalCredits"`
}

// Settlement represents a settlement
type Settlement struct {
	SettlementID       int64                    `json:"settlementId"`
	State              SettlementState          `json:"state"`
	SettlementWindows  []*SettlementWindow      `json:"settlementWindows"`
	Participants       []*ParticipantSettlement `json:"participants"`
	CreatedDate        time.Time                `json:"createdDate"`
	ChangedDate        time.Time                `json:"changedDate"`
}

// SettlementState represents the state of a settlement
type SettlementState string

const (
	SettlementStatePendingSettlement SettlementState = "PENDING_SETTLEMENT"
	SettlementStateSettling          SettlementState = "PS_TRANSFERS_RECORDED"
	SettlementStateSettled           SettlementState = "SETTLED"
	SettlementStateAborted           SettlementState = "ABORTED"
)

// CreateSettlementWindow creates a new settlement window
func (m *SettlementWindowManager) CreateSettlementWindow(ctx context.Context, reason string) (*SettlementWindow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Close any existing open window
	_, err := m.db.ExecContext(ctx, `
		UPDATE settlement_windows 
		SET state = 'CLOSED', changed_date = $1, closed_date = $1
		WHERE state = 'OPEN'
	`, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to close existing windows: %w", err)
	}

	// Create new window
	now := time.Now()
	var windowID int64
	err = m.db.QueryRowContext(ctx, `
		INSERT INTO settlement_windows (state, reason, created_date, changed_date)
		VALUES ('OPEN', $1, $2, $2)
		RETURNING settlement_window_id
	`, reason, now).Scan(&windowID)
	if err != nil {
		return nil, fmt.Errorf("failed to create settlement window: %w", err)
	}

	return &SettlementWindow{
		SettlementWindowID: windowID,
		State:              SettlementWindowStateOpen,
		Reason:             reason,
		CreatedDate:        now,
		ChangedDate:        now,
	}, nil
}

// CloseSettlementWindow closes the current open settlement window
func (m *SettlementWindowManager) CloseSettlementWindow(ctx context.Context, windowID int64, reason string) (*SettlementWindow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	result, err := m.db.ExecContext(ctx, `
		UPDATE settlement_windows 
		SET state = 'CLOSED', reason = $1, changed_date = $2, closed_date = $2
		WHERE settlement_window_id = $3 AND state = 'OPEN'
	`, reason, now, windowID)
	if err != nil {
		return nil, fmt.Errorf("failed to close settlement window: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, fmt.Errorf("settlement window %d is not open", windowID)
	}

	return m.GetSettlementWindow(ctx, windowID)
}

// GetSettlementWindow retrieves a settlement window by ID
func (m *SettlementWindowManager) GetSettlementWindow(ctx context.Context, windowID int64) (*SettlementWindow, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT settlement_window_id, state, reason, created_date, changed_date, closed_date, settled_date
		FROM settlement_windows
		WHERE settlement_window_id = $1
	`, windowID)

	window := &SettlementWindow{}
	var state string
	var closedDate, settledDate sql.NullTime

	err := row.Scan(
		&window.SettlementWindowID, &state, &window.Reason,
		&window.CreatedDate, &window.ChangedDate, &closedDate, &settledDate,
	)
	if err != nil {
		return nil, err
	}

	window.State = SettlementWindowState(state)
	if closedDate.Valid {
		window.ClosedDate = &closedDate.Time
	}
	if settledDate.Valid {
		window.SettledDate = &settledDate.Time
	}

	return window, nil
}

// GetSettlementWindowContent calculates the settlement content for a window
func (m *SettlementWindowManager) GetSettlementWindowContent(ctx context.Context, windowID int64) (*SettlementWindowContent, error) {
	// Get all transfers in this window
	rows, err := m.db.QueryContext(ctx, `
		SELECT t.payer_fsp, t.payee_fsp, t.amount, t.currency
		FROM mojaloop_transfers t
		WHERE t.settlement_window_id = $1
		  AND t.mojaloop_state = 'COMMITTED'
	`, windowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Calculate net positions
	participantPositions := make(map[string]map[string]*AccountSettlement) // fspID -> currency -> position
	totalAmount := make(map[string]int64)
	totalTransfers := 0

	for rows.Next() {
		var payerFSP, payeeFSP, currency string
		var amount int64

		if err := rows.Scan(&payerFSP, &payeeFSP, &amount, &currency); err != nil {
			continue
		}

		totalTransfers++
		totalAmount[currency] += amount

		// Initialize participant positions if needed
		if participantPositions[payerFSP] == nil {
			participantPositions[payerFSP] = make(map[string]*AccountSettlement)
		}
		if participantPositions[payeeFSP] == nil {
			participantPositions[payeeFSP] = make(map[string]*AccountSettlement)
		}
		if participantPositions[payerFSP][currency] == nil {
			participantPositions[payerFSP][currency] = &AccountSettlement{Currency: currency}
		}
		if participantPositions[payeeFSP][currency] == nil {
			participantPositions[payeeFSP][currency] = &AccountSettlement{Currency: currency}
		}

		// Payer debits (pays)
		participantPositions[payerFSP][currency].TotalDebits += amount
		participantPositions[payerFSP][currency].TransferCount++

		// Payee credits (receives)
		participantPositions[payeeFSP][currency].TotalCredits += amount
		participantPositions[payeeFSP][currency].TransferCount++
	}

	// Calculate net settlement for each participant
	var participants []*ParticipantSettlement
	for fspID, currencies := range participantPositions {
		participant := &ParticipantSettlement{
			ParticipantID:   fspID,
			ParticipantName: fspID,
			Accounts:        make([]*AccountSettlement, 0),
		}

		for _, account := range currencies {
			account.NetSettlement = account.TotalCredits - account.TotalDebits
			participant.Accounts = append(participant.Accounts, account)
		}

		participants = append(participants, participant)
	}

	return &SettlementWindowContent{
		SettlementWindowID: windowID,
		Participants:       participants,
		TotalTransfers:     totalTransfers,
		TotalAmount:        totalAmount,
	}, nil
}

// CreateSettlement creates a settlement from one or more settlement windows
func (m *SettlementWindowManager) CreateSettlement(ctx context.Context, windowIDs []int64) (*Settlement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Validate all windows are closed
	for _, windowID := range windowIDs {
		window, err := m.GetSettlementWindow(ctx, windowID)
		if err != nil {
			return nil, fmt.Errorf("window %d not found: %w", windowID, err)
		}
		if window.State != SettlementWindowStateClosed {
			return nil, fmt.Errorf("window %d is not closed: %s", windowID, window.State)
		}
	}

	// Create settlement record
	now := time.Now()
	var settlementID int64
	err := m.db.QueryRowContext(ctx, `
		INSERT INTO settlements (state, created_date, changed_date)
		VALUES ('PENDING_SETTLEMENT', $1, $1)
		RETURNING settlement_id
	`, now).Scan(&settlementID)
	if err != nil {
		return nil, fmt.Errorf("failed to create settlement: %w", err)
	}

	// Link windows to settlement
	for _, windowID := range windowIDs {
		_, err = m.db.ExecContext(ctx, `
			INSERT INTO settlement_settlement_window (settlement_id, settlement_window_id, created_date)
			VALUES ($1, $2, $3)
		`, settlementID, windowID, now)
		if err != nil {
			return nil, fmt.Errorf("failed to link window %d: %w", windowID, err)
		}

		// Update window state
		_, err = m.db.ExecContext(ctx, `
			UPDATE settlement_windows 
			SET state = 'PENDING_SETTLEMENT', changed_date = $1
			WHERE settlement_window_id = $2
		`, now, windowID)
		if err != nil {
			return nil, fmt.Errorf("failed to update window %d state: %w", windowID, err)
		}
	}

	// Calculate aggregate positions
	content, err := m.calculateSettlementContent(ctx, windowIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate settlement content: %w", err)
	}

	// Save participant positions
	for _, participant := range content.Participants {
		for _, account := range participant.Accounts {
			_, err = m.db.ExecContext(ctx, `
				INSERT INTO settlement_participant_currency (
					settlement_id, participant_id, currency, net_amount,
					transfer_count, total_debits, total_credits, created_date
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, settlementID, participant.ParticipantID, account.Currency,
				account.NetSettlement, account.TransferCount,
				account.TotalDebits, account.TotalCredits, now)
			if err != nil {
				return nil, fmt.Errorf("failed to save participant position: %w", err)
			}
		}
	}

	return m.GetSettlement(ctx, settlementID)
}

// calculateSettlementContent calculates aggregate content for multiple windows
func (m *SettlementWindowManager) calculateSettlementContent(ctx context.Context, windowIDs []int64) (*SettlementWindowContent, error) {
	participantPositions := make(map[string]map[string]*AccountSettlement)
	totalAmount := make(map[string]int64)
	totalTransfers := 0

	for _, windowID := range windowIDs {
		content, err := m.GetSettlementWindowContent(ctx, windowID)
		if err != nil {
			return nil, err
		}

		totalTransfers += content.TotalTransfers
		for currency, amount := range content.TotalAmount {
			totalAmount[currency] += amount
		}

		for _, participant := range content.Participants {
			if participantPositions[participant.ParticipantID] == nil {
				participantPositions[participant.ParticipantID] = make(map[string]*AccountSettlement)
			}

			for _, account := range participant.Accounts {
				if participantPositions[participant.ParticipantID][account.Currency] == nil {
					participantPositions[participant.ParticipantID][account.Currency] = &AccountSettlement{
						Currency: account.Currency,
					}
				}

				pos := participantPositions[participant.ParticipantID][account.Currency]
				pos.TotalDebits += account.TotalDebits
				pos.TotalCredits += account.TotalCredits
				pos.TransferCount += account.TransferCount
				pos.NetSettlement = pos.TotalCredits - pos.TotalDebits
			}
		}
	}

	var participants []*ParticipantSettlement
	for fspID, currencies := range participantPositions {
		participant := &ParticipantSettlement{
			ParticipantID:   fspID,
			ParticipantName: fspID,
			Accounts:        make([]*AccountSettlement, 0),
		}

		for _, account := range currencies {
			participant.Accounts = append(participant.Accounts, account)
		}

		participants = append(participants, participant)
	}

	return &SettlementWindowContent{
		Participants:   participants,
		TotalTransfers: totalTransfers,
		TotalAmount:    totalAmount,
	}, nil
}

// GetSettlement retrieves a settlement by ID
func (m *SettlementWindowManager) GetSettlement(ctx context.Context, settlementID int64) (*Settlement, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT settlement_id, state, created_date, changed_date
		FROM settlements
		WHERE settlement_id = $1
	`, settlementID)

	settlement := &Settlement{}
	var state string

	err := row.Scan(&settlement.SettlementID, &state, &settlement.CreatedDate, &settlement.ChangedDate)
	if err != nil {
		return nil, err
	}

	settlement.State = SettlementState(state)

	// Get linked windows
	rows, err := m.db.QueryContext(ctx, `
		SELECT sw.settlement_window_id, sw.state, sw.reason, sw.created_date, sw.changed_date, sw.closed_date, sw.settled_date
		FROM settlement_windows sw
		JOIN settlement_settlement_window ssw ON sw.settlement_window_id = ssw.settlement_window_id
		WHERE ssw.settlement_id = $1
	`, settlementID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		window := &SettlementWindow{}
		var windowState string
		var closedDate, settledDate sql.NullTime

		err := rows.Scan(
			&window.SettlementWindowID, &windowState, &window.Reason,
			&window.CreatedDate, &window.ChangedDate, &closedDate, &settledDate,
		)
		if err != nil {
			continue
		}

		window.State = SettlementWindowState(windowState)
		if closedDate.Valid {
			window.ClosedDate = &closedDate.Time
		}
		if settledDate.Valid {
			window.SettledDate = &settledDate.Time
		}

		settlement.SettlementWindows = append(settlement.SettlementWindows, window)
	}

	// Get participant positions
	posRows, err := m.db.QueryContext(ctx, `
		SELECT participant_id, currency, net_amount, transfer_count, total_debits, total_credits
		FROM settlement_participant_currency
		WHERE settlement_id = $1
	`, settlementID)
	if err != nil {
		return nil, err
	}
	defer posRows.Close()

	participantMap := make(map[string]*ParticipantSettlement)
	for posRows.Next() {
		var participantID, currency string
		var netAmount, totalDebits, totalCredits int64
		var transferCount int

		err := posRows.Scan(&participantID, &currency, &netAmount, &transferCount, &totalDebits, &totalCredits)
		if err != nil {
			continue
		}

		if participantMap[participantID] == nil {
			participantMap[participantID] = &ParticipantSettlement{
				ParticipantID:   participantID,
				ParticipantName: participantID,
				Accounts:        make([]*AccountSettlement, 0),
			}
		}

		participantMap[participantID].Accounts = append(participantMap[participantID].Accounts, &AccountSettlement{
			Currency:      currency,
			NetSettlement: netAmount,
			TransferCount: transferCount,
			TotalDebits:   totalDebits,
			TotalCredits:  totalCredits,
		})
	}

	for _, participant := range participantMap {
		settlement.Participants = append(settlement.Participants, participant)
	}

	return settlement, nil
}

// ExecuteSettlement executes the settlement by posting to TigerBeetle
func (m *SettlementWindowManager) ExecuteSettlement(ctx context.Context, settlementID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	settlement, err := m.GetSettlement(ctx, settlementID)
	if err != nil {
		return fmt.Errorf("settlement not found: %w", err)
	}

	if settlement.State != SettlementStatePendingSettlement {
		return fmt.Errorf("settlement is not pending: %s", settlement.State)
	}

	// Build settlement entries for TigerBeetle
	var entries []*SettlementEntry
	for _, participant := range settlement.Participants {
		for _, account := range participant.Accounts {
			if account.NetSettlement != 0 {
				entries = append(entries, &SettlementEntry{
					ParticipantID: participant.ParticipantID,
					Currency:      account.Currency,
					NetAmount:     account.NetSettlement,
				})
			}
		}
	}

	// Create settlement transfers in TigerBeetle
	settlementReq := &SettlementTransferRequest{
		SettlementID:       fmt.Sprintf("settlement-%d", settlementID),
		SettlementWindowID: fmt.Sprintf("windows-%d", settlementID),
		Entries:            entries,
	}

	_, err = m.linkedMgr.CreateSettlementTransfers(ctx, settlementReq)
	if err != nil {
		return fmt.Errorf("failed to create settlement transfers: %w", err)
	}

	// Update settlement state
	now := time.Now()
	_, err = m.db.ExecContext(ctx, `
		UPDATE settlements SET state = 'PS_TRANSFERS_RECORDED', changed_date = $1
		WHERE settlement_id = $2
	`, now, settlementID)
	if err != nil {
		return fmt.Errorf("failed to update settlement state: %w", err)
	}

	// Mark as settled
	_, err = m.db.ExecContext(ctx, `
		UPDATE settlements SET state = 'SETTLED', changed_date = $1
		WHERE settlement_id = $2
	`, now, settlementID)
	if err != nil {
		return fmt.Errorf("failed to mark settlement as settled: %w", err)
	}

	// Update window states
	for _, window := range settlement.SettlementWindows {
		_, err = m.db.ExecContext(ctx, `
			UPDATE settlement_windows 
			SET state = 'SETTLED', changed_date = $1, settled_date = $1
			WHERE settlement_window_id = $2
		`, now, window.SettlementWindowID)
		if err != nil {
			return fmt.Errorf("failed to update window %d state: %w", window.SettlementWindowID, err)
		}
	}

	return nil
}

// AbortSettlement aborts a pending settlement
func (m *SettlementWindowManager) AbortSettlement(ctx context.Context, settlementID int64, reason string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	settlement, err := m.GetSettlement(ctx, settlementID)
	if err != nil {
		return fmt.Errorf("settlement not found: %w", err)
	}

	if settlement.State == SettlementStateSettled {
		return fmt.Errorf("cannot abort settled settlement")
	}

	now := time.Now()

	// Update settlement state
	_, err = m.db.ExecContext(ctx, `
		UPDATE settlements SET state = 'ABORTED', changed_date = $1
		WHERE settlement_id = $2
	`, now, settlementID)
	if err != nil {
		return fmt.Errorf("failed to abort settlement: %w", err)
	}

	// Revert window states to closed
	for _, window := range settlement.SettlementWindows {
		_, err = m.db.ExecContext(ctx, `
			UPDATE settlement_windows 
			SET state = 'CLOSED', changed_date = $1
			WHERE settlement_window_id = $2
		`, now, window.SettlementWindowID)
		if err != nil {
			return fmt.Errorf("failed to revert window %d state: %w", window.SettlementWindowID, err)
		}
	}

	return nil
}

// GetOpenSettlementWindow returns the current open settlement window
func (m *SettlementWindowManager) GetOpenSettlementWindow(ctx context.Context) (*SettlementWindow, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT settlement_window_id, state, reason, created_date, changed_date, closed_date, settled_date
		FROM settlement_windows
		WHERE state = 'OPEN'
		ORDER BY created_date DESC
		LIMIT 1
	`)

	window := &SettlementWindow{}
	var state string
	var closedDate, settledDate sql.NullTime

	err := row.Scan(
		&window.SettlementWindowID, &state, &window.Reason,
		&window.CreatedDate, &window.ChangedDate, &closedDate, &settledDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No open window
		}
		return nil, err
	}

	window.State = SettlementWindowState(state)
	if closedDate.Valid {
		window.ClosedDate = &closedDate.Time
	}
	if settledDate.Valid {
		window.SettledDate = &settledDate.Time
	}

	return window, nil
}

// AssignTransferToWindow assigns a transfer to the current open settlement window
func (m *SettlementWindowManager) AssignTransferToWindow(ctx context.Context, transferID string) error {
	// Get current open window
	window, err := m.GetOpenSettlementWindow(ctx)
	if err != nil {
		return err
	}

	if window == nil {
		// Create a new window if none exists
		window, err = m.CreateSettlementWindow(ctx, "Auto-created")
		if err != nil {
			return err
		}
	}

	// Assign transfer to window
	_, err = m.db.ExecContext(ctx, `
		UPDATE mojaloop_transfers 
		SET settlement_window_id = $1
		WHERE transfer_id = $2
	`, window.SettlementWindowID, transferID)

	return err
}

// SettlementReport generates a settlement report
type SettlementReport struct {
	SettlementID       int64                    `json:"settlementId"`
	State              SettlementState          `json:"state"`
	WindowCount        int                      `json:"windowCount"`
	TotalTransfers     int                      `json:"totalTransfers"`
	TotalAmount        map[string]int64         `json:"totalAmount"`
	ParticipantSummary []*ParticipantSummary    `json:"participantSummary"`
	CreatedDate        time.Time                `json:"createdDate"`
	SettledDate        *time.Time               `json:"settledDate,omitempty"`
}

// ParticipantSummary summarizes a participant's settlement
type ParticipantSummary struct {
	ParticipantID   string           `json:"participantId"`
	NetPositions    map[string]int64 `json:"netPositions"` // currency -> net amount
	TotalDebits     map[string]int64 `json:"totalDebits"`
	TotalCredits    map[string]int64 `json:"totalCredits"`
}

// GenerateSettlementReport generates a detailed settlement report
func (m *SettlementWindowManager) GenerateSettlementReport(ctx context.Context, settlementID int64) (*SettlementReport, error) {
	settlement, err := m.GetSettlement(ctx, settlementID)
	if err != nil {
		return nil, err
	}

	report := &SettlementReport{
		SettlementID:   settlementID,
		State:          settlement.State,
		WindowCount:    len(settlement.SettlementWindows),
		TotalAmount:    make(map[string]int64),
		CreatedDate:    settlement.CreatedDate,
	}

	// Calculate totals
	totalTransfers := 0
	participantSummaries := make(map[string]*ParticipantSummary)

	for _, participant := range settlement.Participants {
		summary := &ParticipantSummary{
			ParticipantID: participant.ParticipantID,
			NetPositions:  make(map[string]int64),
			TotalDebits:   make(map[string]int64),
			TotalCredits:  make(map[string]int64),
		}

		for _, account := range participant.Accounts {
			summary.NetPositions[account.Currency] = account.NetSettlement
			summary.TotalDebits[account.Currency] = account.TotalDebits
			summary.TotalCredits[account.Currency] = account.TotalCredits
			totalTransfers += account.TransferCount
			report.TotalAmount[account.Currency] += account.TotalDebits
		}

		participantSummaries[participant.ParticipantID] = summary
	}

	report.TotalTransfers = totalTransfers / 2 // Each transfer counted twice (payer and payee)

	for _, summary := range participantSummaries {
		report.ParticipantSummary = append(report.ParticipantSummary, summary)
	}

	// Get settled date from windows
	for _, window := range settlement.SettlementWindows {
		if window.SettledDate != nil {
			report.SettledDate = window.SettledDate
			break
		}
	}

	return report, nil
}

// SettlementWindowSchema returns the PostgreSQL schema for settlement tables
func SettlementWindowSchema() string {
	return `
-- Settlement windows table
CREATE TABLE IF NOT EXISTS settlement_windows (
    settlement_window_id SERIAL PRIMARY KEY,
    state VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    reason TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_date TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_date TIMESTAMP WITH TIME ZONE,
    settled_date TIMESTAMP WITH TIME ZONE
);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_settlement_windows_state 
ON settlement_windows(state);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
    settlement_id SERIAL PRIMARY KEY,
    state VARCHAR(50) NOT NULL DEFAULT 'PENDING_SETTLEMENT',
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_date TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_settlements_state 
ON settlements(state);

-- Settlement to settlement window mapping
CREATE TABLE IF NOT EXISTS settlement_settlement_window (
    settlement_settlement_window_id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES settlements(settlement_id),
    settlement_window_id INTEGER NOT NULL REFERENCES settlement_windows(settlement_window_id),
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(settlement_id, settlement_window_id)
);

-- Settlement participant currency positions
CREATE TABLE IF NOT EXISTS settlement_participant_currency (
    settlement_participant_currency_id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES settlements(settlement_id),
    participant_id VARCHAR(128) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    net_amount BIGINT NOT NULL,
    transfer_count INTEGER NOT NULL,
    total_debits BIGINT NOT NULL,
    total_credits BIGINT NOT NULL,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(settlement_id, participant_id, currency)
);

-- Index for participant queries
CREATE INDEX IF NOT EXISTS idx_settlement_participant_currency_participant 
ON settlement_participant_currency(participant_id, settlement_id);

-- Add settlement_window_id to transfers table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mojaloop_transfers' AND column_name = 'settlement_window_id'
    ) THEN
        ALTER TABLE mojaloop_transfers ADD COLUMN settlement_window_id INTEGER;
    END IF;
END $$;

-- Index for settlement window queries on transfers
CREATE INDEX IF NOT EXISTS idx_mojaloop_transfers_settlement_window 
ON mojaloop_transfers(settlement_window_id) WHERE settlement_window_id IS NOT NULL;
`
}
