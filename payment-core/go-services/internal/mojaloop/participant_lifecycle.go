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

// ParticipantLifecycleManager handles participant onboarding, management, and offboarding
type ParticipantLifecycleManager struct {
	ledger        LedgerEngine
	workflowStore WorkflowStore
	db            *sql.DB
	linkedMgr     *LinkedTransferManager
	mu            sync.RWMutex
}

// NewParticipantLifecycleManager creates a new participant lifecycle manager
func NewParticipantLifecycleManager(ledger LedgerEngine, workflow WorkflowStore, db *sql.DB, linkedMgr *LinkedTransferManager) *ParticipantLifecycleManager {
	return &ParticipantLifecycleManager{
		ledger:        ledger,
		workflowStore: workflow,
		db:            db,
		linkedMgr:     linkedMgr,
	}
}

// ParticipantStatus represents the status of a participant
type ParticipantStatus string

const (
	ParticipantStatusPending   ParticipantStatus = "PENDING"
	ParticipantStatusActive    ParticipantStatus = "ACTIVE"
	ParticipantStatusSuspended ParticipantStatus = "SUSPENDED"
	ParticipantStatusDisabled  ParticipantStatus = "DISABLED"
	ParticipantStatusClosed    ParticipantStatus = "CLOSED"
)

// ParticipantDetails holds detailed participant information
type ParticipantDetails struct {
	ParticipantID int               `json:"participant_id"`
	Name          string            `json:"name"`
	Description   string            `json:"description,omitempty"`
	Status        ParticipantStatus `json:"status"`
	CreatedDate   time.Time         `json:"created_date"`
	UpdatedDate   time.Time         `json:"updated_date"`

	// TigerBeetle account mapping
	TBAccounts           map[string]uint128 `json:"tb_accounts"` // currency -> account ID
	TBSettlementAccounts map[string]uint128 `json:"tb_settlement_accounts"`

	// Limits and configuration
	NetDebitCap    map[string]int64 `json:"net_debit_cap"` // currency -> limit in minor units
	LiquidityCheck bool             `json:"liquidity_check"`

	// Endpoints
	Endpoints []*ParticipantEndpoint `json:"endpoints,omitempty"`

	// Currencies
	Currencies []string `json:"currencies"`

	// Contact information
	ContactName  string `json:"contact_name,omitempty"`
	ContactEmail string `json:"contact_email,omitempty"`
	ContactPhone string `json:"contact_phone,omitempty"`
}

// ParticipantEndpoint represents a participant's callback endpoint
type ParticipantEndpoint struct {
	Type     string `json:"type"` // FSPIOP_CALLBACK_URL_TRANSFER_POST, etc.
	Value    string `json:"value"`
	IsActive bool   `json:"is_active"`
}

// OnboardingRequest represents a request to onboard a new participant
type OnboardingRequest struct {
	Name           string                 `json:"name"`
	Description    string                 `json:"description,omitempty"`
	Currencies     []string               `json:"currencies"`
	NetDebitCap    map[string]int64       `json:"net_debit_cap,omitempty"`
	LiquidityCheck bool                   `json:"liquidity_check"`
	Endpoints      []*ParticipantEndpoint `json:"endpoints,omitempty"`
	ContactName    string                 `json:"contact_name,omitempty"`
	ContactEmail   string                 `json:"contact_email,omitempty"`
	ContactPhone   string                 `json:"contact_phone,omitempty"`
	InitialFunding map[string]int64       `json:"initial_funding,omitempty"` // currency -> amount
}

// OnboardParticipant onboards a new participant
func (m *ParticipantLifecycleManager) OnboardParticipant(ctx context.Context, req *OnboardingRequest) (*ParticipantDetails, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if participant already exists
	existing, _ := m.GetParticipantByName(ctx, req.Name)
	if existing != nil {
		return nil, fmt.Errorf("participant %s already exists", req.Name)
	}

	// Create participant record
	participant := &ParticipantDetails{
		Name:                 req.Name,
		Description:          req.Description,
		Status:               ParticipantStatusPending,
		CreatedDate:          time.Now(),
		UpdatedDate:          time.Now(),
		TBAccounts:           make(map[string]uint128),
		TBSettlementAccounts: make(map[string]uint128),
		NetDebitCap:          req.NetDebitCap,
		LiquidityCheck:       req.LiquidityCheck,
		Endpoints:            req.Endpoints,
		Currencies:           req.Currencies,
		ContactName:          req.ContactName,
		ContactEmail:         req.ContactEmail,
		ContactPhone:         req.ContactPhone,
	}

	// Set default net debit caps if not provided
	if participant.NetDebitCap == nil {
		participant.NetDebitCap = make(map[string]int64)
	}
	for _, currency := range req.Currencies {
		if _, ok := participant.NetDebitCap[currency]; !ok {
			participant.NetDebitCap[currency] = 0 // No limit by default
		}
	}

	// Create TigerBeetle accounts for each currency
	if err := m.linkedMgr.CreateParticipantAccounts(ctx, req.Name, req.Currencies); err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle accounts: %w", err)
	}

	// Get the created account IDs
	for _, currency := range req.Currencies {
		participant.TBAccounts[currency] = HashToUint128(fmt.Sprintf("participant:%s:%s", req.Name, currency))
		participant.TBSettlementAccounts[currency] = HashToUint128(fmt.Sprintf("settlement:%s:%s", req.Name, currency))
	}

	// Save participant to database
	if err := m.saveParticipant(ctx, participant); err != nil {
		return nil, fmt.Errorf("failed to save participant: %w", err)
	}

	// Process initial funding if provided
	if req.InitialFunding != nil {
		for currency, amount := range req.InitialFunding {
			if amount > 0 {
				if err := m.fundParticipant(ctx, participant, currency, amount); err != nil {
					// Log but don't fail - participant is created
					fmt.Printf("Warning: failed to fund participant %s with %d %s: %v\n", req.Name, amount, currency, err)
				}
			}
		}
	}

	// Activate participant
	participant.Status = ParticipantStatusActive
	participant.UpdatedDate = time.Now()
	if err := m.updateParticipantStatus(ctx, participant.Name, ParticipantStatusActive); err != nil {
		return nil, fmt.Errorf("failed to activate participant: %w", err)
	}

	return participant, nil
}

// SuspendParticipant suspends a participant (stops new transfers but allows existing to complete)
func (m *ParticipantLifecycleManager) SuspendParticipant(ctx context.Context, name string, reason string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	if participant.Status != ParticipantStatusActive {
		return fmt.Errorf("participant is not active, current status: %s", participant.Status)
	}

	// Update status
	if err := m.updateParticipantStatus(ctx, name, ParticipantStatusSuspended); err != nil {
		return fmt.Errorf("failed to suspend participant: %w", err)
	}

	// Log suspension
	m.logLifecycleEvent(ctx, name, "SUSPENDED", reason)

	return nil
}

// ReactivateParticipant reactivates a suspended participant
func (m *ParticipantLifecycleManager) ReactivateParticipant(ctx context.Context, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	if participant.Status != ParticipantStatusSuspended {
		return fmt.Errorf("participant is not suspended, current status: %s", participant.Status)
	}

	// Update status
	if err := m.updateParticipantStatus(ctx, name, ParticipantStatusActive); err != nil {
		return fmt.Errorf("failed to reactivate participant: %w", err)
	}

	// Log reactivation
	m.logLifecycleEvent(ctx, name, "REACTIVATED", "")

	return nil
}

// DisableParticipant disables a participant (no new transfers, existing transfers may be aborted)
func (m *ParticipantLifecycleManager) DisableParticipant(ctx context.Context, name string, reason string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	if participant.Status == ParticipantStatusClosed {
		return fmt.Errorf("participant is already closed")
	}

	// Update status
	if err := m.updateParticipantStatus(ctx, name, ParticipantStatusDisabled); err != nil {
		return fmt.Errorf("failed to disable participant: %w", err)
	}

	// Log disabling
	m.logLifecycleEvent(ctx, name, "DISABLED", reason)

	return nil
}

// CloseParticipant permanently closes a participant (requires zero balance)
func (m *ParticipantLifecycleManager) CloseParticipant(ctx context.Context, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	// Check all balances are zero
	for currency, accountID := range participant.TBAccounts {
		balance, err := m.ledger.GetAccountBalance(ctx, accountID)
		if err != nil {
			return fmt.Errorf("failed to get balance for %s: %w", currency, err)
		}

		available := int64(balance.CreditsPosted) - int64(balance.DebitsPosted)
		pending := int64(balance.DebitsPending) + int64(balance.CreditsPending)

		if available != 0 || pending != 0 {
			return fmt.Errorf("cannot close participant with non-zero balance in %s: available=%d, pending=%d", currency, available, pending)
		}
	}

	// Update status
	if err := m.updateParticipantStatus(ctx, name, ParticipantStatusClosed); err != nil {
		return fmt.Errorf("failed to close participant: %w", err)
	}

	// Log closure
	m.logLifecycleEvent(ctx, name, "CLOSED", "")

	return nil
}

// UpdateNetDebitCap updates the net debit cap for a participant
func (m *ParticipantLifecycleManager) UpdateNetDebitCap(ctx context.Context, name string, currency string, newCap int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	// Validate currency is supported
	found := false
	for _, c := range participant.Currencies {
		if c == currency {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("participant does not support currency %s", currency)
	}

	// Update cap
	participant.NetDebitCap[currency] = newCap
	participant.UpdatedDate = time.Now()

	// Save to database
	if err := m.saveParticipant(ctx, participant); err != nil {
		return fmt.Errorf("failed to update net debit cap: %w", err)
	}

	// Log change
	m.logLifecycleEvent(ctx, name, "NET_DEBIT_CAP_UPDATED", fmt.Sprintf("%s: %d", currency, newCap))

	return nil
}

// AddCurrency adds a new currency to a participant
func (m *ParticipantLifecycleManager) AddCurrency(ctx context.Context, name string, currency string, netDebitCap int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	// Check if currency already exists
	for _, c := range participant.Currencies {
		if c == currency {
			return fmt.Errorf("participant already has currency %s", currency)
		}
	}

	// Create TigerBeetle accounts for the new currency
	if err := m.linkedMgr.CreateParticipantAccounts(ctx, name, []string{currency}); err != nil {
		return fmt.Errorf("failed to create TigerBeetle accounts: %w", err)
	}

	// Update participant
	participant.Currencies = append(participant.Currencies, currency)
	participant.TBAccounts[currency] = HashToUint128(fmt.Sprintf("participant:%s:%s", name, currency))
	participant.TBSettlementAccounts[currency] = HashToUint128(fmt.Sprintf("settlement:%s:%s", name, currency))
	participant.NetDebitCap[currency] = netDebitCap
	participant.UpdatedDate = time.Now()

	// Save to database
	if err := m.saveParticipant(ctx, participant); err != nil {
		return fmt.Errorf("failed to add currency: %w", err)
	}

	// Log change
	m.logLifecycleEvent(ctx, name, "CURRENCY_ADDED", currency)

	return nil
}

// UpdateEndpoint updates a participant's endpoint
func (m *ParticipantLifecycleManager) UpdateEndpoint(ctx context.Context, name string, endpointType string, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return fmt.Errorf("participant not found: %w", err)
	}

	// Find and update endpoint
	found := false
	for _, ep := range participant.Endpoints {
		if ep.Type == endpointType {
			ep.Value = value
			ep.IsActive = true
			found = true
			break
		}
	}

	if !found {
		// Add new endpoint
		participant.Endpoints = append(participant.Endpoints, &ParticipantEndpoint{
			Type:     endpointType,
			Value:    value,
			IsActive: true,
		})
	}

	participant.UpdatedDate = time.Now()

	// Save to database
	if err := m.saveParticipant(ctx, participant); err != nil {
		return fmt.Errorf("failed to update endpoint: %w", err)
	}

	return nil
}

// GetParticipantByName retrieves a participant by name
func (m *ParticipantLifecycleManager) GetParticipantByName(ctx context.Context, name string) (*ParticipantDetails, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT participant_id, name, description, status, created_date, updated_date,
		       tb_accounts, tb_settlement_accounts, net_debit_cap, liquidity_check,
		       endpoints, currencies, contact_name, contact_email, contact_phone
		FROM mojaloop_participants
		WHERE name = $1
	`, name)

	p := &ParticipantDetails{}
	var tbAccountsJSON, tbSettlementJSON, netDebitCapJSON, endpointsJSON, currenciesJSON []byte
	var status string

	err := row.Scan(
		&p.ParticipantID, &p.Name, &p.Description, &status, &p.CreatedDate, &p.UpdatedDate,
		&tbAccountsJSON, &tbSettlementJSON, &netDebitCapJSON, &p.LiquidityCheck,
		&endpointsJSON, &currenciesJSON, &p.ContactName, &p.ContactEmail, &p.ContactPhone,
	)
	if err != nil {
		return nil, err
	}

	p.Status = ParticipantStatus(status)
	json.Unmarshal(tbAccountsJSON, &p.TBAccounts)
	json.Unmarshal(tbSettlementJSON, &p.TBSettlementAccounts)
	json.Unmarshal(netDebitCapJSON, &p.NetDebitCap)
	json.Unmarshal(endpointsJSON, &p.Endpoints)
	json.Unmarshal(currenciesJSON, &p.Currencies)

	return p, nil
}

// GetParticipantPosition gets the current position for a participant
func (m *ParticipantLifecycleManager) GetParticipantPosition(ctx context.Context, name string, currency string) (*ParticipantPosition, error) {
	participant, err := m.GetParticipantByName(ctx, name)
	if err != nil {
		return nil, err
	}

	accountID, ok := participant.TBAccounts[currency]
	if !ok {
		return nil, fmt.Errorf("participant does not have account for currency %s", currency)
	}

	balance, err := m.ledger.GetAccountBalance(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance: %w", err)
	}

	netDebitCap := participant.NetDebitCap[currency]
	available := int64(balance.CreditsPosted) - int64(balance.DebitsPosted)
	reserved := int64(balance.DebitsPending)

	return &ParticipantPosition{
		ParticipantName: name,
		Currency:        currency,
		Value:           available,
		ReservedValue:   reserved,
		NetDebitCap:     netDebitCap,
		AvailableLimit:  netDebitCap - reserved + available,
	}, nil
}

// ParticipantPosition represents a participant's position
type ParticipantPosition struct {
	ParticipantName string `json:"participant_name"`
	Currency        string `json:"currency"`
	Value           int64  `json:"value"`           // Current balance
	ReservedValue   int64  `json:"reserved_value"`  // Pending debits
	NetDebitCap     int64  `json:"net_debit_cap"`   // Maximum allowed net debit
	AvailableLimit  int64  `json:"available_limit"` // How much more can be debited
}

// Helper methods

func (m *ParticipantLifecycleManager) saveParticipant(ctx context.Context, p *ParticipantDetails) error {
	tbAccountsJSON, _ := json.Marshal(p.TBAccounts)
	tbSettlementJSON, _ := json.Marshal(p.TBSettlementAccounts)
	netDebitCapJSON, _ := json.Marshal(p.NetDebitCap)
	endpointsJSON, _ := json.Marshal(p.Endpoints)
	currenciesJSON, _ := json.Marshal(p.Currencies)

	_, err := m.db.ExecContext(ctx, `
		INSERT INTO mojaloop_participants (
			name, description, status, created_date, updated_date,
			tb_accounts, tb_settlement_accounts, net_debit_cap, liquidity_check,
			endpoints, currencies, contact_name, contact_email, contact_phone
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (name) DO UPDATE SET
			description = EXCLUDED.description,
			status = EXCLUDED.status,
			updated_date = EXCLUDED.updated_date,
			tb_accounts = EXCLUDED.tb_accounts,
			tb_settlement_accounts = EXCLUDED.tb_settlement_accounts,
			net_debit_cap = EXCLUDED.net_debit_cap,
			liquidity_check = EXCLUDED.liquidity_check,
			endpoints = EXCLUDED.endpoints,
			currencies = EXCLUDED.currencies,
			contact_name = EXCLUDED.contact_name,
			contact_email = EXCLUDED.contact_email,
			contact_phone = EXCLUDED.contact_phone
	`, p.Name, p.Description, string(p.Status), p.CreatedDate, p.UpdatedDate,
		tbAccountsJSON, tbSettlementJSON, netDebitCapJSON, p.LiquidityCheck,
		endpointsJSON, currenciesJSON, p.ContactName, p.ContactEmail, p.ContactPhone)

	return err
}

func (m *ParticipantLifecycleManager) updateParticipantStatus(ctx context.Context, name string, status ParticipantStatus) error {
	_, err := m.db.ExecContext(ctx, `
		UPDATE mojaloop_participants
		SET status = $1, updated_date = $2
		WHERE name = $3
	`, string(status), time.Now(), name)
	return err
}

func (m *ParticipantLifecycleManager) fundParticipant(ctx context.Context, p *ParticipantDetails, currency string, amount int64) error {
	// Create a funding transfer from hub to participant
	hubNostro := m.linkedMgr.accountModel.HubNostroAccounts[currency]
	participantAccount := p.TBAccounts[currency]

	transfer := &TBTransfer{
		ID:              GenerateTransferID(fmt.Sprintf("funding:%s:%s:%d", p.Name, currency, time.Now().UnixNano()), 0),
		DebitAccountID:  hubNostro,
		CreditAccountID: participantAccount,
		Amount:          uint64(amount),
		Ledger:          CurrencyToLedger(currency),
		Code:            100, // Funding code
		Flags:           0,   // Immediate transfer, not pending
	}

	_, err := m.ledger.CreateTransferBatch(ctx, []*TBTransfer{transfer})
	return err
}

func (m *ParticipantLifecycleManager) logLifecycleEvent(ctx context.Context, participantName, eventType, details string) {
	m.db.ExecContext(ctx, `
		INSERT INTO participant_lifecycle_events (participant_name, event_type, details, created_at)
		VALUES ($1, $2, $3, $4)
	`, participantName, eventType, details, time.Now())
}

// ParticipantLifecycleSchema returns the PostgreSQL schema for participant lifecycle tables
func ParticipantLifecycleSchema() string {
	return `
-- Mojaloop participants table
CREATE TABLE IF NOT EXISTS mojaloop_participants (
    participant_id SERIAL PRIMARY KEY,
    name VARCHAR(128) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL,
    tb_accounts JSONB NOT NULL DEFAULT '{}',
    tb_settlement_accounts JSONB NOT NULL DEFAULT '{}',
    net_debit_cap JSONB NOT NULL DEFAULT '{}',
    liquidity_check BOOLEAN NOT NULL DEFAULT TRUE,
    endpoints JSONB NOT NULL DEFAULT '[]',
    currencies JSONB NOT NULL DEFAULT '[]',
    contact_name VARCHAR(256),
    contact_email VARCHAR(256),
    contact_phone VARCHAR(50)
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_mojaloop_participants_status 
ON mojaloop_participants(status);

-- Participant lifecycle events table
CREATE TABLE IF NOT EXISTS participant_lifecycle_events (
    id SERIAL PRIMARY KEY,
    participant_name VARCHAR(128) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for participant event queries
CREATE INDEX IF NOT EXISTS idx_participant_lifecycle_events_participant 
ON participant_lifecycle_events(participant_name, created_at DESC);
`
}
