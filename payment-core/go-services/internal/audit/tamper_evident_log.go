// Package audit provides tamper-evident audit logging
package audit

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

// TamperEvidentLog provides cryptographically verifiable audit logs
// Features:
// - Hash chaining for integrity verification
// - WORM (Write Once Read Many) semantics
// - Object-lock style retention
// - Merkle tree for efficient verification
type TamperEvidentLog struct {
	// Storage backend
	storage AuditStorage
	
	// Hash chain state
	lastHash     string
	lastHashMu   sync.Mutex
	sequenceNum  uint64
	
	// Merkle tree for efficient verification
	merkleTree   *MerkleTree
	
	// Retention policy
	retentionDays int
	
	// Stats
	totalEntries   uint64
	verifySuccess  uint64
	verifyFailures uint64
	
	// Control
	ctx    context.Context
	cancel context.CancelFunc
}

// AuditStorage interface for audit log storage
type AuditStorage interface {
	// Append appends an entry (WORM - cannot be modified)
	Append(ctx context.Context, entry *TamperEvidentEntry) error
	// Get retrieves an entry by sequence number
	Get(ctx context.Context, sequenceNum uint64) (*TamperEvidentEntry, error)
	// GetRange retrieves entries in a range
	GetRange(ctx context.Context, start, end uint64) ([]*TamperEvidentEntry, error)
	// GetByTimeRange retrieves entries in a time range
	GetByTimeRange(ctx context.Context, start, end time.Time) ([]*TamperEvidentEntry, error)
	// Count returns total entry count
	Count(ctx context.Context) (uint64, error)
}

// AuditEntry represents a single audit log entry

// AuditLogConfig configures the audit log
type AuditLogConfig struct {
	RetentionDays     int
	MerkleTreeEnabled bool
	SigningEnabled    bool
	SigningKeyID      string
}

// DefaultAuditLogConfig returns secure defaults
func DefaultAuditLogConfig() AuditLogConfig {
	return AuditLogConfig{
		RetentionDays:     2555, // 7 years for financial regulations
		MerkleTreeEnabled: true,
		SigningEnabled:    false, // Requires HSM integration
	}
}

// NewTamperEvidentLog creates a new tamper-evident audit log
func NewTamperEvidentLog(storage AuditStorage, config AuditLogConfig) (*TamperEvidentLog, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
	log := &TamperEvidentLog{
		storage:       storage,
		retentionDays: config.RetentionDays,
		ctx:           ctx,
		cancel:        cancel,
	}
	
	if config.MerkleTreeEnabled {
		log.merkleTree = NewMerkleTree()
	}
	
	// Initialize from existing entries
	count, err := storage.Count(ctx)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to get entry count: %w", err)
	}
	
	if count > 0 {
		// Get last entry to continue hash chain
		lastEntry, err := storage.Get(ctx, count-1)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("failed to get last entry: %w", err)
		}
		log.lastHash = lastEntry.EntryHash
		log.sequenceNum = count
	} else {
		log.lastHash = "genesis"
		log.sequenceNum = 0
	}
	
	return log, nil
}

// Log logs an audit event
func (l *TamperEvidentLog) Log(ctx context.Context, event AuditEvent) error {
	l.lastHashMu.Lock()
	defer l.lastHashMu.Unlock()
	
	// Create entry
	entry := &TamperEvidentEntry{
		SequenceNum:   atomic.AddUint64(&l.sequenceNum, 1) - 1,
		Timestamp:     time.Now().UTC(),
		EventType:     event.EventType,
		Actor:         event.Actor,
		ActorType:     event.ActorType,
		Resource:      event.Resource,
		ResourceID:    event.ResourceID,
		Action:        event.Action,
		Outcome:       event.Outcome,
		Details:       event.Details,
		IPAddress:     event.IPAddress,
		UserAgent:     event.UserAgent,
		SessionID:     event.SessionID,
		CorrelationID: event.CorrelationID,
		PreviousHash:  l.lastHash,
		RetentionDays: l.retentionDays,
	}
	
	// Compute entry hash
	entry.EntryHash = l.computeEntryHash(entry)
	
	// Update hash chain
	l.lastHash = entry.EntryHash
	
	// Add to Merkle tree
	if l.merkleTree != nil {
		l.merkleTree.Add(entry.EntryHash)
	}
	
	// Persist entry
	if err := l.storage.Append(ctx, entry); err != nil {
		return fmt.Errorf("failed to append audit entry: %w", err)
	}
	
	atomic.AddUint64(&l.totalEntries, 1)
	
	return nil
}

// AuditEvent represents an event to be logged
// TamperEvidentEntry represents an entry in the tamper-evident log
type TamperEvidentEntry struct {
	SequenceNum   uint64                 `json:"sequence_num"`
	Timestamp     time.Time              `json:"timestamp"`
	EventType     string                 `json:"event_type"`
	Actor         string                 `json:"actor"`
	ActorType     string                 `json:"actor_type"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id"`
	Action        string                 `json:"action"`
	Outcome       string                 `json:"outcome"`
	Details       map[string]interface{} `json:"details"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	SessionID     string                 `json:"session_id"`
	CorrelationID string                 `json:"correlation_id"`
	PreviousHash  string                 `json:"previous_hash"`
	EntryHash     string                 `json:"entry_hash"`
	RetentionDays int                    `json:"retention_days"`
}

type AuditEvent struct {
	EventType     string
	Actor         string
	ActorType     string
	Resource      string
	ResourceID    string
	Action        string
	Outcome       string
	Details       map[string]interface{}
	IPAddress     string
	UserAgent     string
	SessionID     string
	CorrelationID string
}

// computeEntryHash computes the hash for an entry
func (l *TamperEvidentLog) computeEntryHash(entry *TamperEvidentEntry) string {
	// Create canonical representation
	data := fmt.Sprintf("%d|%s|%s|%s|%s|%s|%s|%s|%s|%s",
		entry.SequenceNum,
		entry.Timestamp.Format(time.RFC3339Nano),
		entry.EventType,
		entry.Actor,
		entry.Resource,
		entry.ResourceID,
		entry.Action,
		entry.Outcome,
		entry.PreviousHash,
		mustJSON(entry.Details),
	)
	
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// VerifyChain verifies the integrity of the hash chain
func (l *TamperEvidentLog) VerifyChain(ctx context.Context, start, end uint64) (*VerificationResult, error) {
	result := &VerificationResult{
		StartSequence: start,
		EndSequence:   end,
		Verified:      true,
		Timestamp:     time.Now(),
	}
	
	entries, err := l.storage.GetRange(ctx, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get entries: %w", err)
	}
	
	var previousHash string
	if start == 0 {
		previousHash = "genesis"
	} else {
		// Get previous entry
		prevEntry, err := l.storage.Get(ctx, start-1)
		if err != nil {
			return nil, fmt.Errorf("failed to get previous entry: %w", err)
		}
		previousHash = prevEntry.EntryHash
	}
	
	for _, entry := range entries {
		// Verify previous hash
		if entry.PreviousHash != previousHash {
			result.Verified = false
			result.Errors = append(result.Errors, VerificationError{
				SequenceNum: entry.SequenceNum,
				Type:        "CHAIN_BREAK",
				Message:     fmt.Sprintf("Previous hash mismatch: expected %s, got %s", previousHash, entry.PreviousHash),
			})
		}
		
		// Verify entry hash
		computedHash := l.computeEntryHash(entry)
		if entry.EntryHash != computedHash {
			result.Verified = false
			result.Errors = append(result.Errors, VerificationError{
				SequenceNum: entry.SequenceNum,
				Type:        "HASH_MISMATCH",
				Message:     fmt.Sprintf("Entry hash mismatch: expected %s, got %s", computedHash, entry.EntryHash),
			})
		}
		
		previousHash = entry.EntryHash
		result.EntriesVerified++
	}
	
	if result.Verified {
		atomic.AddUint64(&l.verifySuccess, 1)
	} else {
		atomic.AddUint64(&l.verifyFailures, 1)
	}
	
	return result, nil
}

// VerificationResult contains chain verification results
type VerificationResult struct {
	StartSequence   uint64              `json:"start_sequence"`
	EndSequence     uint64              `json:"end_sequence"`
	EntriesVerified int                 `json:"entries_verified"`
	Verified        bool                `json:"verified"`
	Errors          []VerificationError `json:"errors,omitempty"`
	Timestamp       time.Time           `json:"timestamp"`
}

// VerificationError represents a verification error
type VerificationError struct {
	SequenceNum uint64 `json:"sequence_num"`
	Type        string `json:"type"`
	Message     string `json:"message"`
}

// GetMerkleRoot returns the current Merkle root
func (l *TamperEvidentLog) GetMerkleRoot() string {
	if l.merkleTree == nil {
		return ""
	}
	return l.merkleTree.Root()
}

// GetMerkleProof returns a Merkle proof for an entry
func (l *TamperEvidentLog) GetMerkleProof(sequenceNum uint64) (*MerkleProof, error) {
	if l.merkleTree == nil {
		return nil, fmt.Errorf("Merkle tree not enabled")
	}
	return l.merkleTree.GetProof(int(sequenceNum))
}

// Stats returns audit log statistics
func (l *TamperEvidentLog) Stats() (entries, verifySuccess, verifyFailures uint64) {
	return atomic.LoadUint64(&l.totalEntries),
		atomic.LoadUint64(&l.verifySuccess),
		atomic.LoadUint64(&l.verifyFailures)
}

// Close shuts down the audit log
func (l *TamperEvidentLog) Close() error {
	l.cancel()
	return nil
}

// MerkleTree provides efficient verification
type MerkleTree struct {
	leaves []string
	mu     sync.RWMutex
}

// NewMerkleTree creates a new Merkle tree
func NewMerkleTree() *MerkleTree {
	return &MerkleTree{
		leaves: make([]string, 0),
	}
}

// Add adds a hash to the tree
func (t *MerkleTree) Add(hash string) {
	t.mu.Lock()
	t.leaves = append(t.leaves, hash)
	t.mu.Unlock()
}

// Root returns the Merkle root
func (t *MerkleTree) Root() string {
	t.mu.RLock()
	defer t.mu.RUnlock()
	
	if len(t.leaves) == 0 {
		return ""
	}
	
	return t.computeRoot(t.leaves)
}

// computeRoot computes the Merkle root
func (t *MerkleTree) computeRoot(hashes []string) string {
	if len(hashes) == 0 {
		return ""
	}
	if len(hashes) == 1 {
		return hashes[0]
	}
	
	// Pair and hash
	var nextLevel []string
	for i := 0; i < len(hashes); i += 2 {
		if i+1 < len(hashes) {
			combined := hashes[i] + hashes[i+1]
			hash := sha256.Sum256([]byte(combined))
			nextLevel = append(nextLevel, hex.EncodeToString(hash[:]))
		} else {
			nextLevel = append(nextLevel, hashes[i])
		}
	}
	
	return t.computeRoot(nextLevel)
}

// MerkleProof represents a Merkle proof
type MerkleProof struct {
	LeafHash string   `json:"leaf_hash"`
	Path     []string `json:"path"`
	Index    int      `json:"index"`
}

// GetProof returns a Merkle proof for an index
func (t *MerkleTree) GetProof(index int) (*MerkleProof, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	
	if index < 0 || index >= len(t.leaves) {
		return nil, fmt.Errorf("index out of range")
	}
	
	proof := &MerkleProof{
		LeafHash: t.leaves[index],
		Index:    index,
		Path:     make([]string, 0),
	}
	
	// Build proof path
	hashes := make([]string, len(t.leaves))
	copy(hashes, t.leaves)
	idx := index
	
	for len(hashes) > 1 {
		var nextLevel []string
		for i := 0; i < len(hashes); i += 2 {
			if i+1 < len(hashes) {
				if i == idx || i+1 == idx {
					if i == idx {
						proof.Path = append(proof.Path, hashes[i+1])
					} else {
						proof.Path = append(proof.Path, hashes[i])
					}
				}
				combined := hashes[i] + hashes[i+1]
				hash := sha256.Sum256([]byte(combined))
				nextLevel = append(nextLevel, hex.EncodeToString(hash[:]))
			} else {
				nextLevel = append(nextLevel, hashes[i])
			}
		}
		hashes = nextLevel
		idx = idx / 2
	}
	
	return proof, nil
}

// Helper function
func mustJSON(v interface{}) string {
	data, _ := json.Marshal(v)
	return string(data)
}

// Predefined audit event types
const (
	AuditEventTransferCreated    = "TRANSFER_CREATED"
	AuditEventTransferCommitted  = "TRANSFER_COMMITTED"
	AuditEventTransferFailed     = "TRANSFER_FAILED"
	AuditEventTransferReversed   = "TRANSFER_REVERSED"
	AuditEventUserLogin          = "USER_LOGIN"
	AuditEventUserLogout         = "USER_LOGOUT"
	AuditEventUserCreated        = "USER_CREATED"
	AuditEventUserModified       = "USER_MODIFIED"
	AuditEventUserDeleted        = "USER_DELETED"
	AuditEventPermissionGranted  = "PERMISSION_GRANTED"
	AuditEventPermissionRevoked  = "PERMISSION_REVOKED"
	AuditEventConfigChanged      = "CONFIG_CHANGED"
	AuditEventSecurityAlert      = "SECURITY_ALERT"
	AuditEventComplianceCheck    = "COMPLIANCE_CHECK"
	AuditEventDataExport         = "DATA_EXPORT"
	AuditEventDataAccess         = "DATA_ACCESS"
)
