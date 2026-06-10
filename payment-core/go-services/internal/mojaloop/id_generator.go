// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// IDGenerator provides collision-resistant ID generation for TigerBeetle
// This replaces the sha256[:8] approach which has collision risk at scale
type IDGenerator struct {
	nodeID   uint16
	sequence uint64
	lastTime int64
	mu       sync.Mutex
}

// IDGeneratorConfig holds configuration for the ID generator
type IDGeneratorConfig struct {
	NodeID uint16 // Unique node identifier (0-65535)
}

// NewIDGenerator creates a new ID generator
func NewIDGenerator(config *IDGeneratorConfig) *IDGenerator {
	nodeID := config.NodeID
	if nodeID == 0 {
		// Generate random node ID if not provided
		var buf [2]byte
		rand.Read(buf[:])
		nodeID = binary.BigEndian.Uint16(buf[:])
	}

	return &IDGenerator{
		nodeID:   nodeID,
		sequence: 0,
		lastTime: 0,
	}
}

// GenerateID generates a unique 128-bit ID suitable for TigerBeetle
// Format: [timestamp_ms:48][node_id:16][sequence:48][random:16]
// This provides:
// - Time-ordered IDs for efficient storage
// - Node isolation to prevent cross-node collisions
// - Sequence numbers for high-throughput within same millisecond
// - Random suffix for additional collision resistance
func (g *IDGenerator) GenerateID() (uint64, uint64) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now().UnixMilli()

	// Reset sequence if we're in a new millisecond
	if now > g.lastTime {
		g.lastTime = now
		g.sequence = 0
	} else {
		g.sequence++
		// If sequence overflows, wait for next millisecond
		if g.sequence >= (1 << 48) {
			for now <= g.lastTime {
				time.Sleep(time.Millisecond)
				now = time.Now().UnixMilli()
			}
			g.lastTime = now
			g.sequence = 0
		}
	}

	// Generate random suffix
	var randomBuf [2]byte
	rand.Read(randomBuf[:])
	randomSuffix := binary.BigEndian.Uint16(randomBuf[:])

	// Build high 64 bits: [timestamp:48][node_id:16]
	high := uint64(now&0xFFFFFFFFFFFF)<<16 | uint64(g.nodeID)

	// Build low 64 bits: [sequence:48][random:16]
	low := (g.sequence << 16) | uint64(randomSuffix)

	return high, low
}

// GenerateTransferID generates a unique transfer ID for TigerBeetle
// Returns a single uint64 for simpler use cases (lower collision resistance)
func (g *IDGenerator) GenerateTransferID() uint64 {
	high, low := g.GenerateID()
	// XOR high and low for a single 64-bit ID with good distribution
	return high ^ low
}

// GenerateAccountID generates a unique account ID for TigerBeetle
func (g *IDGenerator) GenerateAccountID() uint64 {
	return g.GenerateTransferID()
}

// DeterministicID generates a deterministic ID from a string key
// This is useful for idempotency - same input always produces same output
// Uses a better algorithm than simple sha256[:8] to reduce collisions
func (g *IDGenerator) DeterministicID(key string) uint64 {
	// Use FNV-1a hash for better distribution
	const (
		fnvPrime  = 1099511628211
		fnvOffset = 14695981039346656037
	)

	hash := uint64(fnvOffset)
	for i := 0; i < len(key); i++ {
		hash ^= uint64(key[i])
		hash *= fnvPrime
	}

	// Mix the bits for better distribution
	hash ^= hash >> 33
	hash *= 0xff51afd7ed558ccd
	hash ^= hash >> 33
	hash *= 0xc4ceb9fe1a85ec53
	hash ^= hash >> 33

	return hash
}

// DeterministicIDPair generates a deterministic 128-bit ID pair from a string key
func (g *IDGenerator) DeterministicIDPair(key string) (uint64, uint64) {
	// Generate two different hashes by using different seeds
	high := g.DeterministicID(key)
	low := g.DeterministicID(key + ":low")
	return high, low
}

// Singleton ID generator
var (
	defaultIDGenerator *IDGenerator
	idGeneratorOnce    sync.Once
)

// GetIDGenerator returns the singleton ID generator
func GetIDGenerator() *IDGenerator {
	idGeneratorOnce.Do(func() {
		// Use pod name or hostname hash as node ID for Kubernetes
		nodeID := uint16(0)
		hostname := getEnvOrDefault("HOSTNAME", "")
		if hostname != "" {
			// Hash hostname to get node ID
			hash := uint64(14695981039346656037)
			for i := 0; i < len(hostname); i++ {
				hash ^= uint64(hostname[i])
				hash *= 1099511628211
			}
			nodeID = uint16(hash & 0xFFFF)
		}

		defaultIDGenerator = NewIDGenerator(&IDGeneratorConfig{
			NodeID: nodeID,
		})
	})
	return defaultIDGenerator
}

// RaceConditionHandler handles race conditions in transfer processing
type RaceConditionHandler struct {
	store *TransferStore
}

// NewRaceConditionHandler creates a new race condition handler
func NewRaceConditionHandler(store *TransferStore) *RaceConditionHandler {
	return &RaceConditionHandler{store: store}
}

// TransferLock represents a distributed lock on a transfer
type TransferLock struct {
	TransferID string
	LockedBy   string
	LockedAt   time.Time
	ExpiresAt  time.Time
}

// AcquireLock attempts to acquire a lock on a transfer
// Returns true if lock was acquired, false if already locked
func (h *RaceConditionHandler) AcquireLock(ctx context.Context, transferID, lockedBy string, ttl time.Duration) (bool, error) {
	query := `
		INSERT INTO transfer_locks (transfer_id, locked_by, locked_at, expires_at)
		VALUES ($1, $2, NOW(), NOW() + $3::interval)
		ON CONFLICT (transfer_id) DO UPDATE SET
			locked_by = EXCLUDED.locked_by,
			locked_at = EXCLUDED.locked_at,
			expires_at = EXCLUDED.expires_at
		WHERE transfer_locks.expires_at < NOW()
		RETURNING locked_by
	`

	var actualLockedBy string
	err := h.store.db.QueryRowContext(ctx, query, transferID, lockedBy, fmt.Sprintf("%d seconds", int(ttl.Seconds()))).Scan(&actualLockedBy)
	if err != nil {
		return false, nil // Lock not acquired
	}

	return actualLockedBy == lockedBy, nil
}

// ReleaseLock releases a lock on a transfer
func (h *RaceConditionHandler) ReleaseLock(ctx context.Context, transferID, lockedBy string) error {
	query := `DELETE FROM transfer_locks WHERE transfer_id = $1 AND locked_by = $2`
	_, err := h.store.db.ExecContext(ctx, query, transferID, lockedBy)
	return err
}

// WithLock executes a function while holding a lock on a transfer
func (h *RaceConditionHandler) WithLock(ctx context.Context, transferID string, ttl time.Duration, fn func() error) error {
	lockID := fmt.Sprintf("%d", time.Now().UnixNano())

	acquired, err := h.AcquireLock(ctx, transferID, lockID, ttl)
	if err != nil {
		return fmt.Errorf("failed to acquire lock: %w", err)
	}
	if !acquired {
		return fmt.Errorf("transfer %s is locked by another process", transferID)
	}

	defer h.ReleaseLock(ctx, transferID, lockID)

	return fn()
}

// StateTransitionValidator validates transfer state transitions
type StateTransitionValidator struct{}

// ValidTransitions defines valid state transitions
var ValidTransitions = map[MojaloopTransferState][]MojaloopTransferState{
	TransferStateReceived:  {TransferStateReserved, TransferStateAborted},
	TransferStateReserved:  {TransferStateCommitted, TransferStateAborted, TransferStateExpired},
	TransferStateCommitted: {}, // Terminal state
	TransferStateAborted:   {}, // Terminal state
	TransferStateExpired:   {}, // Terminal state
}

// IsValidTransition checks if a state transition is valid
func (v *StateTransitionValidator) IsValidTransition(from, to MojaloopTransferState) bool {
	validTargets, ok := ValidTransitions[from]
	if !ok {
		return false
	}

	for _, valid := range validTargets {
		if valid == to {
			return true
		}
	}

	return false
}

// IsTerminalState checks if a state is terminal
func (v *StateTransitionValidator) IsTerminalState(state MojaloopTransferState) bool {
	return state == TransferStateCommitted || state == TransferStateAborted || state == TransferStateExpired
}

// DuplicateDetector detects duplicate transfer requests
type DuplicateDetector struct {
	store *TransferStore
}

// NewDuplicateDetector creates a new duplicate detector
func NewDuplicateDetector(store *TransferStore) *DuplicateDetector {
	return &DuplicateDetector{store: store}
}

// CheckDuplicate checks if a transfer already exists and returns appropriate response
type DuplicateCheckResult struct {
	IsDuplicate bool
	Transfer    *MojaloopTransfer
	SameRequest bool // True if the duplicate has the same parameters
}

// Check checks for duplicate transfer
func (d *DuplicateDetector) Check(ctx context.Context, transferID string, payerFSP, payeeFSP string, amount uint64, currency string) (*DuplicateCheckResult, error) {
	existing, err := d.store.GetTransfer(ctx, transferID)
	if err != nil {
		return nil, err
	}

	if existing == nil {
		return &DuplicateCheckResult{IsDuplicate: false}, nil
	}

	// Check if parameters match
	sameRequest := existing.PayerFSP == payerFSP &&
		existing.PayeeFSP == payeeFSP &&
		existing.Amount == amount &&
		existing.Currency == currency

	return &DuplicateCheckResult{
		IsDuplicate: true,
		Transfer:    existing,
		SameRequest: sameRequest,
	}, nil
}

// RetryCounter tracks retry attempts for transfers
type RetryCounter struct {
	counts map[string]*atomic.Int32
	mu     sync.RWMutex
}

// NewRetryCounter creates a new retry counter
func NewRetryCounter() *RetryCounter {
	return &RetryCounter{
		counts: make(map[string]*atomic.Int32),
	}
}

// Increment increments the retry count for a transfer
func (r *RetryCounter) Increment(transferID string) int32 {
	r.mu.Lock()
	counter, ok := r.counts[transferID]
	if !ok {
		counter = &atomic.Int32{}
		r.counts[transferID] = counter
	}
	r.mu.Unlock()

	return counter.Add(1)
}

// Get returns the current retry count
func (r *RetryCounter) Get(transferID string) int32 {
	r.mu.RLock()
	counter, ok := r.counts[transferID]
	r.mu.RUnlock()

	if !ok {
		return 0
	}
	return counter.Load()
}

// Reset resets the retry count for a transfer
func (r *RetryCounter) Reset(transferID string) {
	r.mu.Lock()
	delete(r.counts, transferID)
	r.mu.Unlock()
}
