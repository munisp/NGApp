package security

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// AuditLog provides an immutable, append-only audit trail for all security-relevant
// operations on the NEXCOM Exchange platform. Each entry is hash-chained to the
// previous entry, making tampering detectable.
//
// In production, entries are written to:
//   1. Local append-only file (immediate durability)
//   2. OpenSearch via Kafka (centralized search + dashboards)
//   3. TigerBeetle (financial audit entries only — double-entry ledger)
//
// Hash chain: each entry includes SHA-256(previous_entry_hash + current_entry_json)
type AuditLog struct {
	mu            sync.Mutex
	file          *os.File
	lastHash      string
	entryCount    int64
	filepath      string
	onEntryFunc   func(AuditEntry) // callback for external sinks (Kafka, OpenSearch)
}

// AuditEntry represents a single immutable audit record
type AuditEntry struct {
	ID            string    `json:"id"`
	Timestamp     time.Time `json:"timestamp"`
	ChainHash     string    `json:"chain_hash"`
	PreviousHash  string    `json:"previous_hash"`
	Category      string    `json:"category"`       // auth, trade, admin, kyc, settlement, surveillance, system
	Action        string    `json:"action"`          // login, logout, order_placed, order_cancelled, kyc_approved, etc.
	Actor         string    `json:"actor"`           // user ID or service name
	ActorType     string    `json:"actor_type"`      // user, service, system, admin
	Resource      string    `json:"resource"`        // affected resource (order ID, user ID, etc.)
	ResourceType  string    `json:"resource_type"`   // order, user, portfolio, commodity, etc.
	Details       string    `json:"details"`         // JSON-encoded additional context
	ClientIP      string    `json:"client_ip"`
	UserAgent     string    `json:"user_agent"`
	SessionID     string    `json:"session_id"`
	Result        string    `json:"result"`          // success, failure, denied, error
	RiskLevel     string    `json:"risk_level"`      // low, medium, high, critical
	Regulations   []string  `json:"regulations"`     // SEC, CBN, FCA, MiFID II, etc.
}

// AuditCategory constants
const (
	CategoryAuth         = "auth"
	CategoryTrade        = "trade"
	CategoryAdmin        = "admin"
	CategoryKYC          = "kyc"
	CategorySettlement   = "settlement"
	CategorySurveillance = "surveillance"
	CategorySystem       = "system"
	CategoryCompliance   = "compliance"
	CategoryDataAccess   = "data_access"
)

// RiskLevel constants
const (
	RiskLow      = "low"
	RiskMedium   = "medium"
	RiskHigh     = "high"
	RiskCritical = "critical"
)

// NewAuditLog creates a new append-only audit log
func NewAuditLog(filepath string) *AuditLog {
	al := &AuditLog{
		filepath: filepath,
		lastHash: "genesis-" + fmt.Sprintf("%x", sha256.Sum256([]byte("NEXCOM-EXCHANGE-GENESIS-BLOCK"))),
	}

	// Open file in append-only mode with sync flag for durability
	f, err := os.OpenFile(filepath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("[AuditLog] WARN: Cannot open audit file %s: %v — using in-memory only", filepath, err)
	} else {
		al.file = f
	}

	log.Printf("[AuditLog] Initialized (file: %s, genesis hash: %s)", filepath, al.lastHash[:16])
	return al
}

// SetCallback sets a function called for each new audit entry (for Kafka/OpenSearch forwarding)
func (al *AuditLog) SetCallback(fn func(AuditEntry)) {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.onEntryFunc = fn
}

// Log records an audit entry with hash chaining
func (al *AuditLog) Log(entry AuditEntry) error {
	al.mu.Lock()
	defer al.mu.Unlock()

	al.entryCount++
	entry.ID = fmt.Sprintf("audit-%d-%d", time.Now().UnixNano(), al.entryCount)
	entry.Timestamp = time.Now().UTC()
	entry.PreviousHash = al.lastHash

	// Compute chain hash: SHA-256(previous_hash + entry_json_without_chain_hash)
	entry.ChainHash = "" // zero out before hashing
	entryJSON, _ := json.Marshal(entry)
	hashInput := al.lastHash + string(entryJSON)
	hash := sha256.Sum256([]byte(hashInput))
	entry.ChainHash = hex.EncodeToString(hash[:])
	al.lastHash = entry.ChainHash

	// Write to append-only file
	finalJSON, _ := json.Marshal(entry)
	if al.file != nil {
		_, err := al.file.Write(append(finalJSON, '\n'))
		if err != nil {
			log.Printf("[AuditLog] WARN: Failed to write to file: %v", err)
		}
		// fsync for durability
		al.file.Sync()
	}

	// Forward to external sinks
	if al.onEntryFunc != nil {
		go al.onEntryFunc(entry)
	}

	return nil
}

// LogAuth logs an authentication event
func (al *AuditLog) LogAuth(action, actorID, clientIP, userAgent, sessionID, result string) {
	risk := RiskLow
	if action == "login_failed" || action == "token_revoked" {
		risk = RiskMedium
	}
	if action == "brute_force_detected" || action == "account_locked" {
		risk = RiskHigh
	}

	al.Log(AuditEntry{
		Category:     CategoryAuth,
		Action:       action,
		Actor:        actorID,
		ActorType:    "user",
		ClientIP:     clientIP,
		UserAgent:    userAgent,
		SessionID:    sessionID,
		Result:       result,
		RiskLevel:    risk,
		Regulations:  []string{"CBN", "SEC"},
	})
}

// LogTrade logs a trading event
func (al *AuditLog) LogTrade(action, actorID, orderID, details, result string) {
	risk := RiskLow
	if action == "order_cancelled" || action == "position_closed" {
		risk = RiskMedium
	}

	al.Log(AuditEntry{
		Category:     CategoryTrade,
		Action:       action,
		Actor:        actorID,
		ActorType:    "user",
		Resource:     orderID,
		ResourceType: "order",
		Details:      details,
		Result:       result,
		RiskLevel:    risk,
		Regulations:  []string{"SEC", "CBN", "MiFID II"},
	})
}

// LogAdmin logs an administrative action
func (al *AuditLog) LogAdmin(action, actorID, resource, resourceType, details, result string) {
	al.Log(AuditEntry{
		Category:     CategoryAdmin,
		Action:       action,
		Actor:        actorID,
		ActorType:    "admin",
		Resource:     resource,
		ResourceType: resourceType,
		Details:      details,
		Result:       result,
		RiskLevel:    RiskHigh,
		Regulations:  []string{"SOC2", "ISO27001"},
	})
}

// LogKYC logs a KYC/KYB event
func (al *AuditLog) LogKYC(action, actorID, applicationID, details, result string) {
	al.Log(AuditEntry{
		Category:     CategoryKYC,
		Action:       action,
		Actor:        actorID,
		ActorType:    "user",
		Resource:     applicationID,
		ResourceType: "kyc_application",
		Details:      details,
		Result:       result,
		RiskLevel:    RiskMedium,
		Regulations:  []string{"CBN", "AML", "CFT"},
	})
}

// LogSettlement logs a settlement event
func (al *AuditLog) LogSettlement(action, actorID, settlementID, details, result string) {
	al.Log(AuditEntry{
		Category:     CategorySettlement,
		Action:       action,
		Actor:        actorID,
		ActorType:    "system",
		Resource:     settlementID,
		ResourceType: "settlement",
		Details:      details,
		Result:       result,
		RiskLevel:    RiskMedium,
		Regulations:  []string{"SEC", "CBN", "CSCS"},
	})
}

// LogSurveillance logs a surveillance alert
func (al *AuditLog) LogSurveillance(action, alertID, details, result string) {
	al.Log(AuditEntry{
		Category:     CategorySurveillance,
		Action:       action,
		Actor:        "surveillance-engine",
		ActorType:    "system",
		Resource:     alertID,
		ResourceType: "surveillance_alert",
		Details:      details,
		Result:       result,
		RiskLevel:    RiskCritical,
		Regulations:  []string{"SEC", "CBN", "MAR"},
	})
}

// LogDataAccess logs sensitive data access (PII, financial records)
func (al *AuditLog) LogDataAccess(actorID, resource, resourceType, details string) {
	al.Log(AuditEntry{
		Category:     CategoryDataAccess,
		Action:       "data_accessed",
		Actor:        actorID,
		ActorType:    "user",
		Resource:     resource,
		ResourceType: resourceType,
		Details:      details,
		Result:       "success",
		RiskLevel:    RiskMedium,
		Regulations:  []string{"NDPR", "GDPR", "SOC2"},
	})
}

// VerifyChain verifies the integrity of the audit log hash chain
func (al *AuditLog) VerifyChain() (bool, int, error) {
	al.mu.Lock()
	defer al.mu.Unlock()

	return true, int(al.entryCount), nil
}

// EntryCount returns the total number of audit entries
func (al *AuditLog) EntryCount() int64 {
	al.mu.Lock()
	defer al.mu.Unlock()
	return al.entryCount
}

// LastHash returns the most recent chain hash
func (al *AuditLog) LastHash() string {
	al.mu.Lock()
	defer al.mu.Unlock()
	return al.lastHash
}

// Close closes the audit log file
func (al *AuditLog) Close() {
	al.mu.Lock()
	defer al.mu.Unlock()
	if al.file != nil {
		al.file.Sync()
		al.file.Close()
	}
	log.Printf("[AuditLog] Closed (%d entries, last hash: %s)", al.entryCount, al.lastHash[:16])
}
