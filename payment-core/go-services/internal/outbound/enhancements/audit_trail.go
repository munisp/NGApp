package enhancements

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// AuditAction represents the type of audited operation
type AuditAction string

const (
	AuditTransferCreated    AuditAction = "transfer.created"
	AuditTransferApproved   AuditAction = "transfer.approved"
	AuditTransferRejected   AuditAction = "transfer.rejected"
	AuditTransferCompleted  AuditAction = "transfer.completed"
	AuditTransferFailed     AuditAction = "transfer.failed"
	AuditConfigChanged      AuditAction = "config.changed"
	AuditRailStatusChanged  AuditAction = "rail.status_changed"
	AuditCorridorUpdated    AuditAction = "corridor.updated"
	AuditParticipantOnboard AuditAction = "participant.onboarded"
	AuditRateOverride       AuditAction = "rate.override"
	AuditComplianceEscalate AuditAction = "compliance.escalated"
	AuditUserLogin          AuditAction = "user.login"
	AuditApprovalDecision   AuditAction = "approval.decision"
	AuditDFSPRegistered     AuditAction = "dfsp.registered"
	AuditBatchSubmitted     AuditAction = "batch.submitted"
	AuditTierChanged        AuditAction = "tier.changed"
	AuditPrefundDeposit     AuditAction = "prefund.deposit"
)

// AuditEntry represents a single immutable audit log entry with cryptographic chaining
type AuditEntry struct {
	Sequence      int64             `json:"sequence"`
	Timestamp     time.Time         `json:"timestamp"`
	Action        AuditAction       `json:"action"`
	ActorID       string            `json:"actorId"`
	ActorRole     string            `json:"actorRole"`
	ResourceType  string            `json:"resourceType"`
	ResourceID    string            `json:"resourceId"`
	ParticipantID string            `json:"participantId,omitempty"`
	Details       map[string]string `json:"details"`
	IPAddress     string            `json:"ipAddress,omitempty"`
	PreviousHash  string            `json:"previousHash"`
	EntryHash     string            `json:"entryHash"`
}

// ImmutableAuditTrail provides append-only audit logging with hash chaining
type ImmutableAuditTrail struct {
	mu       sync.RWMutex
	entries  []AuditEntry
	lastHash string
	sequence int64
}

// NewImmutableAuditTrail creates a new audit trail with genesis hash
func NewImmutableAuditTrail() *ImmutableAuditTrail {
	return &ImmutableAuditTrail{
		entries:  make([]AuditEntry, 0),
		lastHash: "genesis-0000000000000000000000000000000000000000000000000000000000000000",
	}
}

// computeHash creates a SHA-256 hash of the entry contents chained with previous hash
func computeHash(entry *AuditEntry) string {
	data, _ := json.Marshal(map[string]interface{}{
		"sequence":     entry.Sequence,
		"timestamp":    entry.Timestamp.UnixNano(),
		"action":       entry.Action,
		"actorId":      entry.ActorID,
		"resourceType": entry.ResourceType,
		"resourceId":   entry.ResourceID,
		"previousHash": entry.PreviousHash,
	})
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// Append adds a new immutable entry to the audit trail
func (at *ImmutableAuditTrail) Append(action AuditAction, actorID, actorRole, resourceType, resourceID string, details map[string]string) *AuditEntry {
	at.mu.Lock()
	defer at.mu.Unlock()

	at.sequence++
	entry := AuditEntry{
		Sequence:     at.sequence,
		Timestamp:    time.Now(),
		Action:       action,
		ActorID:      actorID,
		ActorRole:    actorRole,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      details,
		PreviousHash: at.lastHash,
	}
	entry.EntryHash = computeHash(&entry)
	at.lastHash = entry.EntryHash
	at.entries = append(at.entries, entry)
	return &entry
}

// VerifyChain validates the integrity of the entire audit trail
func (at *ImmutableAuditTrail) VerifyChain() (bool, int, error) {
	at.mu.RLock()
	defer at.mu.RUnlock()

	expectedPrev := "genesis-0000000000000000000000000000000000000000000000000000000000000000"
	for i, entry := range at.entries {
		if entry.PreviousHash != expectedPrev {
			return false, i, fmt.Errorf("chain broken at sequence %d: expected prev %s, got %s", entry.Sequence, expectedPrev, entry.PreviousHash)
		}
		recomputed := computeHash(&entry)
		if entry.EntryHash != recomputed {
			return false, i, fmt.Errorf("hash mismatch at sequence %d: stored %s, computed %s", entry.Sequence, entry.EntryHash, recomputed)
		}
		expectedPrev = entry.EntryHash
	}
	return true, len(at.entries), nil
}

// Query returns audit entries matching the filter criteria
func (at *ImmutableAuditTrail) Query(action AuditAction, actorID, resourceType string, since time.Time, limit int) []AuditEntry {
	at.mu.RLock()
	defer at.mu.RUnlock()

	var results []AuditEntry
	for i := len(at.entries) - 1; i >= 0 && (limit <= 0 || len(results) < limit); i-- {
		e := at.entries[i]
		if !since.IsZero() && e.Timestamp.Before(since) {
			continue
		}
		if action != "" && e.Action != action {
			continue
		}
		if actorID != "" && e.ActorID != actorID {
			continue
		}
		if resourceType != "" && e.ResourceType != resourceType {
			continue
		}
		results = append(results, e)
	}
	return results
}

// Count returns the total number of audit entries
func (at *ImmutableAuditTrail) Count() int {
	at.mu.RLock()
	defer at.mu.RUnlock()
	return len(at.entries)
}

// GetLatest returns the most recent N entries
func (at *ImmutableAuditTrail) GetLatest(n int) []AuditEntry {
	at.mu.RLock()
	defer at.mu.RUnlock()
	if n > len(at.entries) {
		n = len(at.entries)
	}
	result := make([]AuditEntry, n)
	copy(result, at.entries[len(at.entries)-n:])
	return result
}
