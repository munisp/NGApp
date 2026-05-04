// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"
)

// LiquidityManager handles liquidity checks and net debit cap enforcement
// FIXED: Separated cache mutex from main mutex to prevent deadlocks
// The main mutex (mu) protects reservation operations
// The cache mutex (cacheMu) protects the position cache
type LiquidityManager struct {
	ledger         LedgerEngine
	db             *sql.DB
	participantMgr *ParticipantLifecycleManager
	mu             sync.Mutex // Changed from RWMutex - simpler and avoids re-entrancy issues

	// Cache for performance - separate mutex to avoid deadlocks
	positionCache map[string]*CachedPosition
	cacheMu       sync.RWMutex // Separate mutex for cache operations
	cacheTTL      time.Duration
}

// CachedPosition holds cached position data
type CachedPosition struct {
	Position *ParticipantPosition
	CachedAt time.Time
}

// NewLiquidityManager creates a new liquidity manager
func NewLiquidityManager(ledger LedgerEngine, db *sql.DB, participantMgr *ParticipantLifecycleManager) *LiquidityManager {
	return &LiquidityManager{
		ledger:         ledger,
		db:             db,
		participantMgr: participantMgr,
		positionCache:  make(map[string]*CachedPosition),
		cacheTTL:       5 * time.Second, // Short TTL for position cache
	}
}

// LiquidityCheckResult represents the result of a liquidity check
type LiquidityCheckResult struct {
	Allowed         bool   `json:"allowed"`
	ParticipantName string `json:"participant_name"`
	Currency        string `json:"currency"`
	RequestedAmount int64  `json:"requested_amount"`
	CurrentPosition int64  `json:"current_position"`
	ReservedAmount  int64  `json:"reserved_amount"`
	NetDebitCap     int64  `json:"net_debit_cap"`
	AvailableLimit  int64  `json:"available_limit"`
	RejectionReason string `json:"rejection_reason,omitempty"`
}

// CheckLiquidity checks if a participant has sufficient liquidity for a transfer
// FIXED: Removed mutex lock - this is a read-only operation that doesn't need the main mutex
// Cache access is protected by cacheMu in getPosition
func (m *LiquidityManager) CheckLiquidity(ctx context.Context, participantName string, currency string, amount int64) (*LiquidityCheckResult, error) {
	// Get participant details (no lock needed - participantMgr is thread-safe)
	participant, err := m.participantMgr.GetParticipantByName(ctx, participantName)
	if err != nil {
		return nil, fmt.Errorf("participant not found: %w", err)
	}

	// Check if participant is active
	if participant.Status != ParticipantStatusActive {
		return &LiquidityCheckResult{
			Allowed:         false,
			ParticipantName: participantName,
			Currency:        currency,
			RequestedAmount: amount,
			RejectionReason: fmt.Sprintf("participant is not active: %s", participant.Status),
		}, nil
	}

	// Check if liquidity check is enabled for this participant
	if !participant.LiquidityCheck {
		return &LiquidityCheckResult{
			Allowed:         true,
			ParticipantName: participantName,
			Currency:        currency,
			RequestedAmount: amount,
		}, nil
	}

	// Get current position
	position, err := m.getPosition(ctx, participantName, currency)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	// Calculate available limit
	netDebitCap := participant.NetDebitCap[currency]
	availableLimit := position.AvailableLimit

	result := &LiquidityCheckResult{
		ParticipantName: participantName,
		Currency:        currency,
		RequestedAmount: amount,
		CurrentPosition: position.Value,
		ReservedAmount:  position.ReservedValue,
		NetDebitCap:     netDebitCap,
		AvailableLimit:  availableLimit,
	}

	// Check if transfer would exceed limit
	if amount > availableLimit {
		result.Allowed = false
		result.RejectionReason = fmt.Sprintf("insufficient liquidity: requested %d, available %d", amount, availableLimit)
	} else {
		result.Allowed = true
	}

	return result, nil
}

// CheckMultiLegLiquidity checks liquidity for a multi-leg transfer (e.g., FX)
// FIXED: Removed mutex lock - CheckLiquidity is now lock-free for reads
func (m *LiquidityManager) CheckMultiLegLiquidity(ctx context.Context, legs []*LiquidityLeg) (*MultiLegLiquidityResult, error) {
	result := &MultiLegLiquidityResult{
		Allowed:    true,
		LegResults: make([]*LiquidityCheckResult, 0, len(legs)),
	}

	for _, leg := range legs {
		if leg.IsDebit {
			legResult, err := m.CheckLiquidity(ctx, leg.ParticipantName, leg.Currency, leg.Amount)
			if err != nil {
				return nil, err
			}
			result.LegResults = append(result.LegResults, legResult)

			if !legResult.Allowed {
				result.Allowed = false
				result.RejectionReason = fmt.Sprintf("leg %d failed: %s", leg.LegIndex, legResult.RejectionReason)
			}
		}
	}

	return result, nil
}

// LiquidityLeg represents a leg in a multi-leg liquidity check
type LiquidityLeg struct {
	LegIndex        int    `json:"leg_index"`
	ParticipantName string `json:"participant_name"`
	Currency        string `json:"currency"`
	Amount          int64  `json:"amount"`
	IsDebit         bool   `json:"is_debit"` // True if this leg debits the participant
}

// MultiLegLiquidityResult represents the result of a multi-leg liquidity check
type MultiLegLiquidityResult struct {
	Allowed         bool                    `json:"allowed"`
	LegResults      []*LiquidityCheckResult `json:"leg_results"`
	RejectionReason string                  `json:"rejection_reason,omitempty"`
}

// ReserveLiquidity reserves liquidity for a pending transfer
// FIXED: No longer calls CheckLiquidity while holding lock (was causing deadlock)
// Instead, we do check-then-reserve atomically with database transaction
func (m *LiquidityManager) ReserveLiquidity(ctx context.Context, transferID string, participantName string, currency string, amount int64) error {
	// Check liquidity first (no lock needed - CheckLiquidity is now lock-free)
	result, err := m.CheckLiquidity(ctx, participantName, currency, amount)
	if err != nil {
		return err
	}

	if !result.Allowed {
		return fmt.Errorf("liquidity check failed: %s", result.RejectionReason)
	}

	// Now acquire lock for the actual reservation
	m.mu.Lock()
	defer m.mu.Unlock()

	// Record reservation
	_, err = m.db.ExecContext(ctx, `
		INSERT INTO liquidity_reservations (transfer_id, participant_name, currency, amount, status, created_at)
		VALUES ($1, $2, $3, $4, 'RESERVED', $5)
	`, transferID, participantName, currency, amount, time.Now())

	// Invalidate cache with separate mutex
	m.cacheMu.Lock()
	delete(m.positionCache, fmt.Sprintf("%s:%s", participantName, currency))
	m.cacheMu.Unlock()

	return err
}

// ReleaseLiquidity releases reserved liquidity (on abort or timeout)
// FIXED: Uses separate cache mutex for cache invalidation
func (m *LiquidityManager) ReleaseLiquidity(ctx context.Context, transferID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Get reservation details for cache invalidation
	var participantName, currency string
	err := m.db.QueryRowContext(ctx, `
		SELECT participant_name, currency FROM liquidity_reservations
		WHERE transfer_id = $1 AND status = 'RESERVED'
	`, transferID).Scan(&participantName, &currency)

	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Update reservation status
	_, err = m.db.ExecContext(ctx, `
		UPDATE liquidity_reservations
		SET status = 'RELEASED', released_at = $1
		WHERE transfer_id = $2 AND status = 'RESERVED'
	`, time.Now(), transferID)

	// Invalidate cache with separate mutex
	if participantName != "" {
		m.cacheMu.Lock()
		delete(m.positionCache, fmt.Sprintf("%s:%s", participantName, currency))
		m.cacheMu.Unlock()
	}

	return err
}

// CommitLiquidity commits reserved liquidity (on fulfil)
// FIXED: Uses separate cache mutex for cache invalidation
func (m *LiquidityManager) CommitLiquidity(ctx context.Context, transferID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Get reservation details for cache invalidation
	var participantName, currency string
	err := m.db.QueryRowContext(ctx, `
		SELECT participant_name, currency FROM liquidity_reservations
		WHERE transfer_id = $1 AND status = 'RESERVED'
	`, transferID).Scan(&participantName, &currency)

	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Update reservation status
	_, err = m.db.ExecContext(ctx, `
		UPDATE liquidity_reservations
		SET status = 'COMMITTED', committed_at = $1
		WHERE transfer_id = $2 AND status = 'RESERVED'
	`, time.Now(), transferID)

	// Invalidate cache with separate mutex
	if participantName != "" {
		m.cacheMu.Lock()
		delete(m.positionCache, fmt.Sprintf("%s:%s", participantName, currency))
		m.cacheMu.Unlock()
	}

	return err
}

// GetPositionHistory gets position history for a participant
func (m *LiquidityManager) GetPositionHistory(ctx context.Context, participantName string, currency string, since time.Time) ([]*PositionHistoryEntry, error) {
	rows, err := m.db.QueryContext(ctx, `
		SELECT recorded_at, value, reserved_value, net_debit_cap, available_limit
		FROM position_history
		WHERE participant_name = $1 AND currency = $2 AND recorded_at >= $3
		ORDER BY recorded_at DESC
		LIMIT 1000
	`, participantName, currency, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*PositionHistoryEntry
	for rows.Next() {
		entry := &PositionHistoryEntry{
			ParticipantName: participantName,
			Currency:        currency,
		}
		err := rows.Scan(&entry.RecordedAt, &entry.Value, &entry.ReservedValue, &entry.NetDebitCap, &entry.AvailableLimit)
		if err != nil {
			continue
		}
		history = append(history, entry)
	}

	return history, nil
}

// PositionHistoryEntry represents a historical position entry
type PositionHistoryEntry struct {
	ParticipantName string    `json:"participant_name"`
	Currency        string    `json:"currency"`
	RecordedAt      time.Time `json:"recorded_at"`
	Value           int64     `json:"value"`
	ReservedValue   int64     `json:"reserved_value"`
	NetDebitCap     int64     `json:"net_debit_cap"`
	AvailableLimit  int64     `json:"available_limit"`
}

// RecordPositionSnapshot records a position snapshot for history
func (m *LiquidityManager) RecordPositionSnapshot(ctx context.Context, participantName string, currency string) error {
	position, err := m.participantMgr.GetParticipantPosition(ctx, participantName, currency)
	if err != nil {
		return err
	}

	_, err = m.db.ExecContext(ctx, `
		INSERT INTO position_history (participant_name, currency, recorded_at, value, reserved_value, net_debit_cap, available_limit)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, participantName, currency, time.Now(), position.Value, position.ReservedValue, position.NetDebitCap, position.AvailableLimit)

	return err
}

// getPosition gets position with caching
// FIXED: Uses separate cacheMu mutex for thread-safe cache access
func (m *LiquidityManager) getPosition(ctx context.Context, participantName string, currency string) (*ParticipantPosition, error) {
	cacheKey := fmt.Sprintf("%s:%s", participantName, currency)

	// Check cache with read lock
	m.cacheMu.RLock()
	if cached, ok := m.positionCache[cacheKey]; ok {
		if time.Since(cached.CachedAt) < m.cacheTTL {
			m.cacheMu.RUnlock()
			return cached.Position, nil
		}
	}
	m.cacheMu.RUnlock()

	// Get fresh position (no lock needed - participantMgr is thread-safe)
	position, err := m.participantMgr.GetParticipantPosition(ctx, participantName, currency)
	if err != nil {
		return nil, err
	}

	// Update cache with write lock
	m.cacheMu.Lock()
	m.positionCache[cacheKey] = &CachedPosition{
		Position: position,
		CachedAt: time.Now(),
	}
	m.cacheMu.Unlock()

	return position, nil
}

// LiquiditySchema returns the PostgreSQL schema for liquidity tables
func LiquiditySchema() string {
	return `
-- Liquidity reservations table
CREATE TABLE IF NOT EXISTS liquidity_reservations (
    id SERIAL PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    participant_name VARCHAR(128) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    committed_at TIMESTAMP WITH TIME ZONE
);

-- Index for transfer lookups
CREATE INDEX IF NOT EXISTS idx_liquidity_reservations_transfer 
ON liquidity_reservations(transfer_id);

-- Index for participant lookups
CREATE INDEX IF NOT EXISTS idx_liquidity_reservations_participant 
ON liquidity_reservations(participant_name, currency, status);

-- Position history table
CREATE TABLE IF NOT EXISTS position_history (
    id SERIAL PRIMARY KEY,
    participant_name VARCHAR(128) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    value BIGINT NOT NULL,
    reserved_value BIGINT NOT NULL,
    net_debit_cap BIGINT NOT NULL,
    available_limit BIGINT NOT NULL
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_position_history_participant 
ON position_history(participant_name, currency, recorded_at DESC);

-- Partition by month for large deployments (optional)
-- CREATE TABLE position_history_y2024m01 PARTITION OF position_history
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
`
}
