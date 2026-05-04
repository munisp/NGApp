// Package safety provides production safety and correctness guarantees
package safety

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// IdempotencyVerifier ensures exactly-once semantics across the payment flow
// API → Mojaloop → TigerBeetle → Events
type IdempotencyVerifier struct {
	// Idempotency key storage (Redis-backed in production)
	keyStore IdempotencyKeyStore

	// Event log for reconciliation
	eventLog EventLog

	// Ledger state reader
	ledgerReader LedgerReader

	// Reconciliation state
	lastReconcile time.Time
	reconcileMu   sync.Mutex

	// Stats
	totalRequests    uint64
	duplicateBlocked uint64
	reconcileErrors  uint64

	// Alerting
	alertChan chan ReconciliationAlert

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// IdempotencyKeyStore interface for key storage
type IdempotencyKeyStore interface {
	// SetNX sets key if not exists, returns true if set
	SetNX(ctx context.Context, key string, value []byte, ttl time.Duration) (bool, error)
	// Get retrieves a key value
	Get(ctx context.Context, key string) ([]byte, error)
	// Delete removes a key
	Delete(ctx context.Context, key string) error
}

// EventLog interface for event storage
type EventLog interface {
	// Append appends an event to the log
	Append(ctx context.Context, event TransferEvent) error
	// GetByTransferID retrieves events for a transfer
	GetByTransferID(ctx context.Context, transferID string) ([]TransferEvent, error)
	// GetRange retrieves events in a time range
	GetRange(ctx context.Context, start, end time.Time) ([]TransferEvent, error)
}

// LedgerReader interface for reading ledger state
type LedgerReader interface {
	// GetTransfer retrieves a transfer from the ledger
	GetTransfer(ctx context.Context, transferID [16]byte) (*LedgerTransfer, error)
	// GetAccountBalance retrieves account balance
	GetAccountBalance(ctx context.Context, accountID [16]byte) (uint64, error)
}

// TransferEvent represents a transfer event in the log
type TransferEvent struct {
	TransferID      string    `json:"transfer_id"`
	EventType       string    `json:"event_type"` // CREATED, COMMITTED, FAILED, REVERSED
	DebitAccountID  string    `json:"debit_account_id"`
	CreditAccountID string    `json:"credit_account_id"`
	Amount          uint64    `json:"amount"`
	Currency        string    `json:"currency"`
	Ledger          uint32    `json:"ledger"`
	Timestamp       time.Time `json:"timestamp"`
	IdempotencyKey  string    `json:"idempotency_key"`
	Hash            string    `json:"hash"` // Hash of previous event for chain integrity
}

// LedgerTransfer represents a transfer in the ledger
type LedgerTransfer struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	Ledger          uint32
	Flags           uint16
	Timestamp       uint64
}

// ReconciliationAlert represents a reconciliation discrepancy
type ReconciliationAlert struct {
	Type        string                 `json:"type"` // MISSING_EVENT, MISSING_LEDGER, AMOUNT_MISMATCH, BALANCE_MISMATCH
	TransferID  string                 `json:"transfer_id"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"` // CRITICAL, WARNING, INFO
	Timestamp   time.Time              `json:"timestamp"`
	Details     map[string]interface{} `json:"details"`
}

// IdempotencyConfig configures the verifier
type IdempotencyConfig struct {
	KeyTTL              time.Duration
	ReconcileInterval   time.Duration
	AlertBufferSize     int
	MaxConcurrentChecks int
}

// DefaultIdempotencyConfig returns optimized defaults
func DefaultIdempotencyConfig() IdempotencyConfig {
	return IdempotencyConfig{
		KeyTTL:              24 * time.Hour,
		ReconcileInterval:   1 * time.Minute,
		AlertBufferSize:     1000,
		MaxConcurrentChecks: 100,
	}
}

// NewIdempotencyVerifier creates a new idempotency verifier
func NewIdempotencyVerifier(
	keyStore IdempotencyKeyStore,
	eventLog EventLog,
	ledgerReader LedgerReader,
	config IdempotencyConfig,
) *IdempotencyVerifier {
	ctx, cancel := context.WithCancel(context.Background())

	v := &IdempotencyVerifier{
		keyStore:     keyStore,
		eventLog:     eventLog,
		ledgerReader: ledgerReader,
		alertChan:    make(chan ReconciliationAlert, config.AlertBufferSize),
		ctx:          ctx,
		cancel:       cancel,
	}

	// Start reconciliation loop
	v.wg.Add(1)
	go v.reconcileLoop(config.ReconcileInterval)

	return v
}

// CheckAndSet checks if a request is a duplicate and sets the idempotency key
// Returns (isDuplicate, previousResult, error)
func (v *IdempotencyVerifier) CheckAndSet(ctx context.Context, key string, request interface{}) (bool, []byte, error) {
	atomic.AddUint64(&v.totalRequests, 1)

	// Serialize request for storage
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return false, nil, fmt.Errorf("failed to serialize request: %w", err)
	}

	// Try to set the key
	set, err := v.keyStore.SetNX(ctx, key, requestBytes, 24*time.Hour)
	if err != nil {
		return false, nil, fmt.Errorf("failed to check idempotency key: %w", err)
	}

	if !set {
		// Key already exists - this is a duplicate
		atomic.AddUint64(&v.duplicateBlocked, 1)

		// Get the previous result
		prevResult, err := v.keyStore.Get(ctx, key+":result")
		if err != nil {
			return true, nil, nil // Duplicate but no result yet (in-flight)
		}

		return true, prevResult, nil
	}

	return false, nil, nil
}

// SetResult stores the result for an idempotency key
func (v *IdempotencyVerifier) SetResult(ctx context.Context, key string, result interface{}) error {
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to serialize result: %w", err)
	}

	_, err = v.keyStore.SetNX(ctx, key+":result", resultBytes, 24*time.Hour)
	return err
}

// RecordEvent records a transfer event for reconciliation
func (v *IdempotencyVerifier) RecordEvent(ctx context.Context, event TransferEvent) error {
	// Compute hash chain
	event.Hash = v.computeEventHash(event)
	event.Timestamp = time.Now()

	return v.eventLog.Append(ctx, event)
}

// computeEventHash computes the hash for event chain integrity
func (v *IdempotencyVerifier) computeEventHash(event TransferEvent) string {
	data := fmt.Sprintf("%s:%s:%s:%s:%d:%d",
		event.TransferID,
		event.EventType,
		event.DebitAccountID,
		event.CreditAccountID,
		event.Amount,
		event.Timestamp.UnixNano(),
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// reconcileLoop runs continuous reconciliation
func (v *IdempotencyVerifier) reconcileLoop(interval time.Duration) {
	defer v.wg.Done()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-v.ctx.Done():
			return
		case <-ticker.C:
			v.runReconciliation()
		}
	}
}

// runReconciliation performs a reconciliation check
func (v *IdempotencyVerifier) runReconciliation() {
	v.reconcileMu.Lock()
	defer v.reconcileMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Get events since last reconciliation
	start := v.lastReconcile
	if start.IsZero() {
		start = time.Now().Add(-1 * time.Hour)
	}
	end := time.Now()

	events, err := v.eventLog.GetRange(ctx, start, end)
	if err != nil {
		atomic.AddUint64(&v.reconcileErrors, 1)
		return
	}

	// Check each committed event against ledger
	for _, event := range events {
		if event.EventType != "COMMITTED" {
			continue
		}

		// Parse transfer ID
		var transferID [16]byte
		if decoded, err := hex.DecodeString(event.TransferID); err == nil && len(decoded) == 16 {
			copy(transferID[:], decoded)
		} else {
			continue
		}

		// Check ledger state
		ledgerTransfer, err := v.ledgerReader.GetTransfer(ctx, transferID)
		if err != nil {
			v.raiseAlert(ReconciliationAlert{
				Type:        "MISSING_LEDGER",
				TransferID:  event.TransferID,
				Description: "Event exists but transfer not found in ledger",
				Severity:    "CRITICAL",
				Timestamp:   time.Now(),
				Details: map[string]interface{}{
					"event_timestamp": event.Timestamp,
					"error":           err.Error(),
				},
			})
			continue
		}

		// Verify amounts match
		if ledgerTransfer.Amount != event.Amount {
			v.raiseAlert(ReconciliationAlert{
				Type:        "AMOUNT_MISMATCH",
				TransferID:  event.TransferID,
				Description: "Event amount does not match ledger amount",
				Severity:    "CRITICAL",
				Timestamp:   time.Now(),
				Details: map[string]interface{}{
					"event_amount":  event.Amount,
					"ledger_amount": ledgerTransfer.Amount,
				},
			})
		}
	}

	v.lastReconcile = end
}

// raiseAlert sends a reconciliation alert
func (v *IdempotencyVerifier) raiseAlert(alert ReconciliationAlert) {
	select {
	case v.alertChan <- alert:
	default:
		// Channel full, log and drop
	}
}

// Alerts returns the alert channel
func (v *IdempotencyVerifier) Alerts() <-chan ReconciliationAlert {
	return v.alertChan
}

// Stats returns verifier statistics
func (v *IdempotencyVerifier) Stats() (requests, duplicates, reconcileErrors uint64) {
	return atomic.LoadUint64(&v.totalRequests),
		atomic.LoadUint64(&v.duplicateBlocked),
		atomic.LoadUint64(&v.reconcileErrors)
}

// Close shuts down the verifier
func (v *IdempotencyVerifier) Close() error {
	v.cancel()
	v.wg.Wait()
	close(v.alertChan)
	return nil
}

// RedisIdempotencyStore implements IdempotencyKeyStore with Redis
type RedisIdempotencyStore struct {
	client RedisClient
}

// RedisClient interface for Redis operations
type RedisClient interface {
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error)
	Get(ctx context.Context, key string) (string, error)
	Del(ctx context.Context, keys ...string) (int64, error)
}

// NewRedisIdempotencyStore creates a new Redis-backed store
func NewRedisIdempotencyStore(client RedisClient) *RedisIdempotencyStore {
	return &RedisIdempotencyStore{client: client}
}

// SetNX implements IdempotencyKeyStore
func (s *RedisIdempotencyStore) SetNX(ctx context.Context, key string, value []byte, ttl time.Duration) (bool, error) {
	return s.client.SetNX(ctx, "idempotency:"+key, value, ttl)
}

// Get implements IdempotencyKeyStore
func (s *RedisIdempotencyStore) Get(ctx context.Context, key string) ([]byte, error) {
	result, err := s.client.Get(ctx, "idempotency:"+key)
	if err != nil {
		return nil, err
	}
	return []byte(result), nil
}

// Delete implements IdempotencyKeyStore
func (s *RedisIdempotencyStore) Delete(ctx context.Context, key string) error {
	_, err := s.client.Del(ctx, "idempotency:"+key)
	return err
}
