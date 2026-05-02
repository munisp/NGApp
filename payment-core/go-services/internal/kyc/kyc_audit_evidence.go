// Package kyc provides KYC verification with production-ready audit logging
// and evidence bundling for regulatory compliance
package kyc

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// =============================================================================
// KYC Audit Logging with Evidence Bundles
// =============================================================================

// KYCAuditLogger provides immutable audit logging for KYC decisions
type KYCAuditLogger struct {
	db          *sql.DB
	mu          sync.RWMutex
	chainHash   string
	sequenceNum int64
}

// KYCAuditEvent represents an audit event for KYC decisions
type KYCAuditEvent struct {
	EventID         string                 `json:"event_id"`
	EventType       KYCAuditEventType      `json:"event_type"`
	VerificationID  string                 `json:"verification_id"`
	CustomerID      string                 `json:"customer_id"`
	Decision        KYCDecision            `json:"decision"`
	DecisionReason  string                 `json:"decision_reason"`
	RiskScore       float64                `json:"risk_score"`
	RiskLevel       RiskLevel              `json:"risk_level"`
	Evidence        *EvidenceBundle        `json:"evidence"`
	ModelVersion    string                 `json:"model_version,omitempty"`
	RuleVersion     string                 `json:"rule_version,omitempty"`
	ReviewerID      string                 `json:"reviewer_id,omitempty"`
	Timestamp       time.Time              `json:"timestamp"`
	SequenceNum     int64                  `json:"sequence_num"`
	PreviousHash    string                 `json:"previous_hash"`
	EventHash       string                 `json:"event_hash"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// KYCAuditEventType defines the type of audit event
type KYCAuditEventType string

const (
	AuditEventKYCInitiated      KYCAuditEventType = "KYC_INITIATED"
	AuditEventKYCCompleted      KYCAuditEventType = "KYC_COMPLETED"
	AuditEventKYCApproved       KYCAuditEventType = "KYC_APPROVED"
	AuditEventKYCRejected       KYCAuditEventType = "KYC_REJECTED"
	AuditEventKYCManualReview   KYCAuditEventType = "KYC_MANUAL_REVIEW"
	AuditEventKYCReviewDecision KYCAuditEventType = "KYC_REVIEW_DECISION"
	AuditEventAMLScreening      KYCAuditEventType = "AML_SCREENING"
	AuditEventSanctionsCheck    KYCAuditEventType = "SANCTIONS_CHECK"
	AuditEventPEPCheck          KYCAuditEventType = "PEP_CHECK"
	AuditEventDocumentVerified  KYCAuditEventType = "DOCUMENT_VERIFIED"
	AuditEventLivenessCheck     KYCAuditEventType = "LIVENESS_CHECK"
	AuditEventRiskAssessment    KYCAuditEventType = "RISK_ASSESSMENT"
)

// KYCDecision represents a KYC decision
type KYCDecision string

const (
	DecisionApproved      KYCDecision = "APPROVED"
	DecisionRejected      KYCDecision = "REJECTED"
	DecisionPendingReview KYCDecision = "PENDING_REVIEW"
	DecisionPendingDocs   KYCDecision = "PENDING_DOCUMENTS"
	DecisionEDD           KYCDecision = "ENHANCED_DUE_DILIGENCE"
)

// EvidenceBundle contains all evidence for a KYC decision
type EvidenceBundle struct {
	BundleID          string              `json:"bundle_id"`
	VerificationID    string              `json:"verification_id"`
	CustomerID        string              `json:"customer_id"`
	CreatedAt         time.Time           `json:"created_at"`
	
	// Identity Evidence
	IdentityEvidence  *IdentityEvidence   `json:"identity_evidence,omitempty"`
	
	// Document Evidence
	DocumentEvidence  []*DocumentEvidence `json:"document_evidence,omitempty"`
	
	// Screening Evidence
	ScreeningEvidence *ScreeningEvidence  `json:"screening_evidence,omitempty"`
	
	// Liveness Evidence
	LivenessEvidence  *LivenessEvidence   `json:"liveness_evidence,omitempty"`
	
	// Risk Assessment Evidence
	RiskEvidence      *RiskEvidence       `json:"risk_evidence,omitempty"`
	
	// Bundle Hash for integrity verification
	BundleHash        string              `json:"bundle_hash"`
}

// IdentityEvidence contains identity verification evidence
type IdentityEvidence struct {
	Provider          string    `json:"provider"` // e.g., "smile_identity"
	VerificationID    string    `json:"verification_id"`
	IDType            string    `json:"id_type"`
	IDNumber          string    `json:"id_number_masked"` // Masked for privacy
	FullName          string    `json:"full_name"`
	DateOfBirth       string    `json:"date_of_birth"`
	Nationality       string    `json:"nationality"`
	ConfidenceScore   float64   `json:"confidence_score"`
	MatchResult       string    `json:"match_result"`
	VerifiedAt        time.Time `json:"verified_at"`
	RawResponseHash   string    `json:"raw_response_hash"` // Hash of raw API response
}

// DocumentEvidence contains document verification evidence
type DocumentEvidence struct {
	DocumentID        string    `json:"document_id"`
	DocumentType      string    `json:"document_type"`
	FileName          string    `json:"file_name"`
	FileHash          string    `json:"file_hash"`
	ExtractionResult  string    `json:"extraction_result"`
	ConfidenceScore   float64   `json:"confidence_score"`
	TamperDetection   string    `json:"tamper_detection"`
	VerifiedAt        time.Time `json:"verified_at"`
	StorageLocation   string    `json:"storage_location"` // WORM storage reference
}

// ScreeningEvidence contains AML/sanctions screening evidence
type ScreeningEvidence struct {
	ScreeningID       string           `json:"screening_id"`
	Provider          string           `json:"provider"` // e.g., "comply_advantage"
	ScreeningType     string           `json:"screening_type"`
	WatchlistsChecked []string         `json:"watchlists_checked"`
	TotalMatches      int              `json:"total_matches"`
	ConfirmedMatches  int              `json:"confirmed_matches"`
	PotentialMatches  int              `json:"potential_matches"`
	FalsePositives    int              `json:"false_positives"`
	RiskScore         float64          `json:"risk_score"`
	RiskLevel         string           `json:"risk_level"`
	Matches           []*MatchEvidence `json:"matches,omitempty"`
	ScreenedAt        time.Time        `json:"screened_at"`
	RawResponseHash   string           `json:"raw_response_hash"`
}

// MatchEvidence contains evidence for a screening match
type MatchEvidence struct {
	MatchID       string  `json:"match_id"`
	MatchedName   string  `json:"matched_name"`
	WatchlistType string  `json:"watchlist_type"`
	MatchScore    float64 `json:"match_score"`
	Status        string  `json:"status"` // potential, confirmed, false_positive
	ReviewerID    string  `json:"reviewer_id,omitempty"`
	ReviewNotes   string  `json:"review_notes,omitempty"`
}

// LivenessEvidence contains liveness check evidence
type LivenessEvidence struct {
	CheckID         string    `json:"check_id"`
	Provider        string    `json:"provider"`
	LivenessScore   float64   `json:"liveness_score"`
	Passed          bool      `json:"passed"`
	SpoofDetection  string    `json:"spoof_detection"`
	FaceMatchScore  float64   `json:"face_match_score"`
	CheckedAt       time.Time `json:"checked_at"`
	ImageHash       string    `json:"image_hash"` // Hash of selfie image
}

// RiskEvidence contains risk assessment evidence
type RiskEvidence struct {
	AssessmentID    string       `json:"assessment_id"`
	OverallScore    float64      `json:"overall_score"`
	RiskLevel       string       `json:"risk_level"`
	RiskFactors     []RiskFactor `json:"risk_factors"`
	ModelVersion    string       `json:"model_version,omitempty"`
	RuleVersion     string       `json:"rule_version,omitempty"`
	AssessedAt      time.Time    `json:"assessed_at"`
}

// NewKYCAuditLogger creates a new KYC audit logger
func NewKYCAuditLogger(db *sql.DB) (*KYCAuditLogger, error) {
	logger := &KYCAuditLogger{
		db:        db,
		chainHash: "genesis",
	}
	
	// Initialize chain from database
	if db != nil {
		if err := logger.initializeChain(context.Background()); err != nil {
			return nil, err
		}
	}
	
	return logger, nil
}

// initializeChain initializes the hash chain from database
func (l *KYCAuditLogger) initializeChain(ctx context.Context) error {
	if l.db == nil {
		return nil
	}
	
	row := l.db.QueryRowContext(ctx, `
		SELECT sequence_num, event_hash FROM kyc_audit_events 
		ORDER BY sequence_num DESC LIMIT 1
	`)
	
	var seqNum int64
	var hash string
	if err := row.Scan(&seqNum, &hash); err != nil && err != sql.ErrNoRows {
		return err
	}
	
	if seqNum > 0 {
		l.sequenceNum = seqNum
		l.chainHash = hash
	}
	
	return nil
}

// LogEvent logs a KYC audit event with hash chain integrity
func (l *KYCAuditLogger) LogEvent(ctx context.Context, event *KYCAuditEvent) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	
	// Set sequence and chain
	l.sequenceNum++
	event.SequenceNum = l.sequenceNum
	event.PreviousHash = l.chainHash
	event.Timestamp = time.Now().UTC()
	
	// Generate event ID if not set
	if event.EventID == "" {
		event.EventID = fmt.Sprintf("kyc_audit_%d_%d", event.Timestamp.UnixNano(), event.SequenceNum)
	}
	
	// Calculate event hash
	event.EventHash = l.calculateEventHash(event)
	l.chainHash = event.EventHash
	
	// Persist to database
	if l.db != nil {
		if err := l.persistEvent(ctx, event); err != nil {
			return err
		}
	}
	
	return nil
}

// calculateEventHash calculates the hash for an event
func (l *KYCAuditLogger) calculateEventHash(event *KYCAuditEvent) string {
	data := fmt.Sprintf("%d:%s:%s:%s:%s:%s:%f:%s",
		event.SequenceNum,
		event.PreviousHash,
		event.EventType,
		event.VerificationID,
		event.CustomerID,
		event.Decision,
		event.RiskScore,
		event.Timestamp.Format(time.RFC3339Nano),
	)
	
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// persistEvent persists an event to the database
func (l *KYCAuditLogger) persistEvent(ctx context.Context, event *KYCAuditEvent) error {
	evidenceJSON, _ := json.Marshal(event.Evidence)
	metadataJSON, _ := json.Marshal(event.Metadata)
	
	query := `
		INSERT INTO kyc_audit_events (
			event_id, event_type, verification_id, customer_id,
			decision, decision_reason, risk_score, risk_level,
			evidence, model_version, rule_version, reviewer_id,
			timestamp, sequence_num, previous_hash, event_hash, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	
	_, err := l.db.ExecContext(ctx, query,
		event.EventID, event.EventType, event.VerificationID, event.CustomerID,
		event.Decision, event.DecisionReason, event.RiskScore, event.RiskLevel,
		evidenceJSON, event.ModelVersion, event.RuleVersion, event.ReviewerID,
		event.Timestamp, event.SequenceNum, event.PreviousHash, event.EventHash, metadataJSON,
	)
	
	return err
}

// CreateEvidenceBundle creates an evidence bundle for a KYC verification
func (l *KYCAuditLogger) CreateEvidenceBundle(
	verificationID, customerID string,
	identity *IdentityEvidence,
	documents []*DocumentEvidence,
	screening *ScreeningEvidence,
	liveness *LivenessEvidence,
	risk *RiskEvidence,
) *EvidenceBundle {
	bundle := &EvidenceBundle{
		BundleID:          fmt.Sprintf("bundle_%s_%d", verificationID, time.Now().UnixNano()),
		VerificationID:    verificationID,
		CustomerID:        customerID,
		CreatedAt:         time.Now().UTC(),
		IdentityEvidence:  identity,
		DocumentEvidence:  documents,
		ScreeningEvidence: screening,
		LivenessEvidence:  liveness,
		RiskEvidence:      risk,
	}
	
	// Calculate bundle hash
	bundle.BundleHash = l.calculateBundleHash(bundle)
	
	return bundle
}

// calculateBundleHash calculates the hash for an evidence bundle
func (l *KYCAuditLogger) calculateBundleHash(bundle *EvidenceBundle) string {
	data, _ := json.Marshal(bundle)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// VerifyChainIntegrity verifies the integrity of the audit chain
func (l *KYCAuditLogger) VerifyChainIntegrity(ctx context.Context, startSeq, endSeq int64) (bool, []string, error) {
	if l.db == nil {
		return true, nil, nil
	}
	
	rows, err := l.db.QueryContext(ctx, `
		SELECT event_id, sequence_num, previous_hash, event_hash,
		       event_type, verification_id, customer_id, decision,
		       risk_score, timestamp
		FROM kyc_audit_events
		WHERE sequence_num >= $1 AND sequence_num <= $2
		ORDER BY sequence_num ASC
	`, startSeq, endSeq)
	if err != nil {
		return false, nil, err
	}
	defer rows.Close()
	
	var errors []string
	var prevHash string
	var prevSeq int64
	
	for rows.Next() {
		var event KYCAuditEvent
		err := rows.Scan(
			&event.EventID, &event.SequenceNum, &event.PreviousHash, &event.EventHash,
			&event.EventType, &event.VerificationID, &event.CustomerID, &event.Decision,
			&event.RiskScore, &event.Timestamp,
		)
		if err != nil {
			return false, nil, err
		}
		
		// Verify sequence continuity
		if prevSeq > 0 && event.SequenceNum != prevSeq+1 {
			errors = append(errors, fmt.Sprintf("sequence gap at %d", event.SequenceNum))
		}
		
		// Verify hash chain
		if prevHash != "" && event.PreviousHash != prevHash {
			errors = append(errors, fmt.Sprintf("hash chain broken at sequence %d", event.SequenceNum))
		}
		
		// Verify event hash
		calculatedHash := l.calculateEventHash(&event)
		if calculatedHash != event.EventHash {
			errors = append(errors, fmt.Sprintf("event hash mismatch at sequence %d", event.SequenceNum))
		}
		
		prevHash = event.EventHash
		prevSeq = event.SequenceNum
	}
	
	return len(errors) == 0, errors, nil
}

// QueryEvents queries audit events with filters
func (l *KYCAuditLogger) QueryEvents(ctx context.Context, filter *AuditQueryFilter) ([]*KYCAuditEvent, error) {
	if l.db == nil {
		return nil, nil
	}
	
	query := `
		SELECT event_id, event_type, verification_id, customer_id,
		       decision, decision_reason, risk_score, risk_level,
		       evidence, model_version, rule_version, reviewer_id,
		       timestamp, sequence_num, previous_hash, event_hash, metadata
		FROM kyc_audit_events
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1
	
	if filter.VerificationID != "" {
		query += fmt.Sprintf(" AND verification_id = $%d", argNum)
		args = append(args, filter.VerificationID)
		argNum++
	}
	
	if filter.CustomerID != "" {
		query += fmt.Sprintf(" AND customer_id = $%d", argNum)
		args = append(args, filter.CustomerID)
		argNum++
	}
	
	if filter.EventType != "" {
		query += fmt.Sprintf(" AND event_type = $%d", argNum)
		args = append(args, filter.EventType)
		argNum++
	}
	
	if !filter.StartTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp >= $%d", argNum)
		args = append(args, filter.StartTime)
		argNum++
	}
	
	if !filter.EndTime.IsZero() {
		query += fmt.Sprintf(" AND timestamp <= $%d", argNum)
		args = append(args, filter.EndTime)
		argNum++
	}
	
	query += " ORDER BY sequence_num DESC"
	
	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argNum)
		args = append(args, filter.Limit)
	}
	
	rows, err := l.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var events []*KYCAuditEvent
	for rows.Next() {
		var event KYCAuditEvent
		var evidenceJSON, metadataJSON []byte
		
		err := rows.Scan(
			&event.EventID, &event.EventType, &event.VerificationID, &event.CustomerID,
			&event.Decision, &event.DecisionReason, &event.RiskScore, &event.RiskLevel,
			&evidenceJSON, &event.ModelVersion, &event.RuleVersion, &event.ReviewerID,
			&event.Timestamp, &event.SequenceNum, &event.PreviousHash, &event.EventHash, &metadataJSON,
		)
		if err != nil {
			return nil, err
		}
		
		if len(evidenceJSON) > 0 {
			json.Unmarshal(evidenceJSON, &event.Evidence)
		}
		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &event.Metadata)
		}
		
		events = append(events, &event)
	}
	
	return events, nil
}

// AuditQueryFilter defines filters for querying audit events
type AuditQueryFilter struct {
	VerificationID string
	CustomerID     string
	EventType      KYCAuditEventType
	StartTime      time.Time
	EndTime        time.Time
	Limit          int
}

// ExportForRegulator exports audit data for regulatory reporting
func (l *KYCAuditLogger) ExportForRegulator(ctx context.Context, startTime, endTime time.Time) (*RegulatoryExport, error) {
	events, err := l.QueryEvents(ctx, &AuditQueryFilter{
		StartTime: startTime,
		EndTime:   endTime,
	})
	if err != nil {
		return nil, err
	}
	
	export := &RegulatoryExport{
		ExportID:    fmt.Sprintf("reg_export_%d", time.Now().UnixNano()),
		StartTime:   startTime,
		EndTime:     endTime,
		GeneratedAt: time.Now().UTC(),
		TotalEvents: len(events),
		Events:      events,
	}
	
	// Calculate statistics
	var approved, rejected, pending int
	for _, e := range events {
		switch e.Decision {
		case DecisionApproved:
			approved++
		case DecisionRejected:
			rejected++
		case DecisionPendingReview, DecisionPendingDocs, DecisionEDD:
			pending++
		}
	}
	
	export.Statistics = map[string]int{
		"approved": approved,
		"rejected": rejected,
		"pending":  pending,
	}
	
	// Calculate export hash
	data, _ := json.Marshal(export)
	hash := sha256.Sum256(data)
	export.ExportHash = hex.EncodeToString(hash[:])
	
	return export, nil
}

// RegulatoryExport represents an export for regulatory reporting
type RegulatoryExport struct {
	ExportID    string                 `json:"export_id"`
	StartTime   time.Time              `json:"start_time"`
	EndTime     time.Time              `json:"end_time"`
	GeneratedAt time.Time              `json:"generated_at"`
	TotalEvents int                    `json:"total_events"`
	Statistics  map[string]int         `json:"statistics"`
	Events      []*KYCAuditEvent       `json:"events"`
	ExportHash  string                 `json:"export_hash"`
}

// =============================================================================
// Database Schema
// =============================================================================

// KYCAuditSchema returns the database schema for KYC audit logging
func KYCAuditSchema() string {
	return `
	-- KYC Audit Events with hash chain
	CREATE TABLE IF NOT EXISTS kyc_audit_events (
		event_id VARCHAR(128) PRIMARY KEY,
		event_type VARCHAR(64) NOT NULL,
		verification_id VARCHAR(64) NOT NULL,
		customer_id VARCHAR(64) NOT NULL,
		decision VARCHAR(32) NOT NULL,
		decision_reason TEXT,
		risk_score DECIMAL(5,4),
		risk_level VARCHAR(32),
		evidence JSONB,
		model_version VARCHAR(64),
		rule_version VARCHAR(64),
		reviewer_id VARCHAR(64),
		timestamp TIMESTAMP NOT NULL,
		sequence_num BIGINT NOT NULL UNIQUE,
		previous_hash VARCHAR(64) NOT NULL,
		event_hash VARCHAR(64) NOT NULL,
		metadata JSONB,
		INDEX idx_kyc_audit_verification (verification_id),
		INDEX idx_kyc_audit_customer (customer_id),
		INDEX idx_kyc_audit_timestamp (timestamp),
		INDEX idx_kyc_audit_sequence (sequence_num),
		INDEX idx_kyc_audit_event_type (event_type)
	);

	-- Evidence bundles storage
	CREATE TABLE IF NOT EXISTS kyc_evidence_bundles (
		bundle_id VARCHAR(128) PRIMARY KEY,
		verification_id VARCHAR(64) NOT NULL,
		customer_id VARCHAR(64) NOT NULL,
		identity_evidence JSONB,
		document_evidence JSONB,
		screening_evidence JSONB,
		liveness_evidence JSONB,
		risk_evidence JSONB,
		bundle_hash VARCHAR(64) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		INDEX idx_evidence_verification (verification_id),
		INDEX idx_evidence_customer (customer_id)
	);

	-- KYC Cases for persistence (replacing in-memory storage)
	CREATE TABLE IF NOT EXISTS kyc_cases (
		case_id VARCHAR(64) PRIMARY KEY,
		verification_id VARCHAR(64) NOT NULL,
		customer_id VARCHAR(64) NOT NULL,
		status VARCHAR(32) NOT NULL,
		decision VARCHAR(32),
		risk_score DECIMAL(5,4),
		risk_level VARCHAR(32),
		assigned_to VARCHAR(64),
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		completed_at TIMESTAMP,
		evidence_bundle_id VARCHAR(128),
		notes TEXT,
		metadata JSONB,
		INDEX idx_kyc_case_status (status),
		INDEX idx_kyc_case_customer (customer_id),
		INDEX idx_kyc_case_assigned (assigned_to)
	);

	-- KYB Cases for persistence
	CREATE TABLE IF NOT EXISTS kyb_cases (
		case_id VARCHAR(64) PRIMARY KEY,
		business_id VARCHAR(64) NOT NULL,
		business_name VARCHAR(256),
		registration_number VARCHAR(64),
		incorporation_country VARCHAR(2),
		status VARCHAR(32) NOT NULL,
		recommendation VARCHAR(32),
		risk_score INTEGER,
		assigned_to VARCHAR(64),
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		completed_at TIMESTAMP,
		workflow_id VARCHAR(64),
		documents JSONB,
		screenings JSONB,
		beneficial_owners JSONB,
		notes TEXT,
		metadata JSONB,
		INDEX idx_kyb_case_status (status),
		INDEX idx_kyb_case_business (business_id),
		INDEX idx_kyb_case_assigned (assigned_to)
	);

	-- AML Cases for persistence
	CREATE TABLE IF NOT EXISTS aml_cases (
		case_id VARCHAR(64) PRIMARY KEY,
		screening_id VARCHAR(64) NOT NULL,
		customer_id VARCHAR(64) NOT NULL,
		customer_name VARCHAR(256),
		status VARCHAR(32) NOT NULL,
		risk_score DECIMAL(5,4),
		risk_level VARCHAR(32),
		total_matches INTEGER,
		confirmed_matches INTEGER,
		false_positives INTEGER,
		assigned_to VARCHAR(64),
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		resolved_at TIMESTAMP,
		resolution VARCHAR(32),
		matches JSONB,
		notes TEXT,
		INDEX idx_aml_case_status (status),
		INDEX idx_aml_case_customer (customer_id),
		INDEX idx_aml_case_assigned (assigned_to)
	);
	`
}
