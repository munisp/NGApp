// Package compliance provides regulatory compliance features
// Priority 2: Decision Reproducibility, SAR/STR Workflow, Sanctions Provenance, Retention Policy
package compliance

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
// Priority 2.1: Decision Reproducibility
// =============================================================================

// DecisionReproducibilityService ensures decisions can be replayed
type DecisionReproducibilityService struct {
	db            *sql.DB
	policyStore   PolicyStore
	modelStore    ModelStore
	evidenceStore EvidenceStore
	mu            sync.RWMutex
}

// PolicyStore interface for policy versioning
type PolicyStore interface {
	GetPolicy(ctx context.Context, policyID string, version int) (*PolicyVersion, error)
	GetActivePolicy(ctx context.Context, policyID string) (*PolicyVersion, error)
	SavePolicy(ctx context.Context, policy *PolicyVersion) error
	ListPolicyVersions(ctx context.Context, policyID string) ([]*PolicyVersion, error)
}

// ModelStore interface for model versioning
type ModelStore interface {
	GetModel(ctx context.Context, modelID string, version int) (*ModelVersion, error)
	GetActiveModel(ctx context.Context, modelID string) (*ModelVersion, error)
}

// EvidenceStore interface for evidence snapshots
type EvidenceStore interface {
	GetEvidenceSnapshot(ctx context.Context, snapshotID string) (*EvidenceSnapshot, error)
	SaveEvidenceSnapshot(ctx context.Context, snapshot *EvidenceSnapshot) error
}

// PolicyVersion represents a versioned policy
type PolicyVersion struct {
	PolicyID      string                 `json:"policy_id"`
	Version       int                    `json:"version"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	Rules         []PolicyRule           `json:"rules"`
	Thresholds    map[string]float64     `json:"thresholds"`
	Config        map[string]interface{} `json:"config"`
	EffectiveFrom time.Time              `json:"effective_from"`
	EffectiveTo   *time.Time             `json:"effective_to,omitempty"`
	CreatedBy     string                 `json:"created_by"`
	CreatedAt     time.Time              `json:"created_at"`
	ApprovedBy    string                 `json:"approved_by"`
	ApprovedAt    *time.Time             `json:"approved_at,omitempty"`
	Signature     string                 `json:"signature"` // Digital signature
	Hash          string                 `json:"hash"`
	Status        string                 `json:"status"` // DRAFT, PENDING_APPROVAL, ACTIVE, RETIRED
}

// PolicyRule represents a rule within a policy
type PolicyRule struct {
	RuleID     string                 `json:"rule_id"`
	Name       string                 `json:"name"`
	Condition  string                 `json:"condition"`
	Action     string                 `json:"action"`
	Priority   int                    `json:"priority"`
	Parameters map[string]interface{} `json:"parameters"`
	Enabled    bool                   `json:"enabled"`
}

// ModelVersion represents a versioned model
type ModelVersion struct {
	ModelID      string                 `json:"model_id"`
	Version      int                    `json:"version"`
	Name         string                 `json:"name"`
	Type         string                 `json:"type"` // FRAUD, KYC_RISK, AML
	ArtifactHash string                 `json:"artifact_hash"`
	ArtifactPath string                 `json:"artifact_path"`
	Features     []string               `json:"features"`
	Hyperparams  map[string]interface{} `json:"hyperparams"`
	Metrics      map[string]float64     `json:"metrics"`
	TrainedAt    time.Time              `json:"trained_at"`
	DeployedAt   *time.Time             `json:"deployed_at,omitempty"`
	Status       string                 `json:"status"`
	Signature    string                 `json:"signature"`
}

// EvidenceSnapshot represents a point-in-time evidence snapshot
type EvidenceSnapshot struct {
	SnapshotID    string                 `json:"snapshot_id"`
	DecisionID    string                 `json:"decision_id"`
	CustomerID    string                 `json:"customer_id"`
	SnapshotType  string                 `json:"snapshot_type"` // KYC, KYB, FRAUD, AML
	Evidence      map[string]interface{} `json:"evidence"`
	PolicyVersion int                    `json:"policy_version"`
	ModelVersion  int                    `json:"model_version"`
	CreatedAt     time.Time              `json:"created_at"`
	Hash          string                 `json:"hash"`
}

// DecisionRecord represents a reproducible decision record
type DecisionRecord struct {
	DecisionID       string                 `json:"decision_id"`
	DecisionType     string                 `json:"decision_type"`
	CustomerID       string                 `json:"customer_id"`
	TransactionID    string                 `json:"transaction_id,omitempty"`
	Decision         string                 `json:"decision"`
	Score            float64                `json:"score"`
	Reasons          []string               `json:"reasons"`
	PolicyID         string                 `json:"policy_id"`
	PolicyVersion    int                    `json:"policy_version"`
	ModelID          string                 `json:"model_id,omitempty"`
	ModelVersion     int                    `json:"model_version,omitempty"`
	EvidenceSnapshot string                 `json:"evidence_snapshot_id"`
	InputData        map[string]interface{} `json:"input_data"`
	RulesTriggered   []string               `json:"rules_triggered"`
	DecidedAt        time.Time              `json:"decided_at"`
	DecidedBy        string                 `json:"decided_by"` // SYSTEM or reviewer ID
	Hash             string                 `json:"hash"`
}

// NewDecisionReproducibilityService creates a new service
func NewDecisionReproducibilityService(db *sql.DB, policyStore PolicyStore, modelStore ModelStore, evidenceStore EvidenceStore) *DecisionReproducibilityService {
	return &DecisionReproducibilityService{
		db:            db,
		policyStore:   policyStore,
		modelStore:    modelStore,
		evidenceStore: evidenceStore,
	}
}

// RecordDecision records a decision with full reproducibility context
func (s *DecisionReproducibilityService) RecordDecision(ctx context.Context, record *DecisionRecord, evidence map[string]interface{}) error {
	// Create evidence snapshot
	snapshot := &EvidenceSnapshot{
		SnapshotID:    fmt.Sprintf("snap_%s_%d", record.DecisionID, time.Now().UnixNano()),
		DecisionID:    record.DecisionID,
		CustomerID:    record.CustomerID,
		SnapshotType:  record.DecisionType,
		Evidence:      evidence,
		PolicyVersion: record.PolicyVersion,
		ModelVersion:  record.ModelVersion,
		CreatedAt:     time.Now().UTC(),
	}

	// Calculate snapshot hash
	snapshotData, _ := json.Marshal(snapshot.Evidence)
	snapshotHash := sha256.Sum256(snapshotData)
	snapshot.Hash = hex.EncodeToString(snapshotHash[:])

	// Save snapshot
	if err := s.evidenceStore.SaveEvidenceSnapshot(ctx, snapshot); err != nil {
		return fmt.Errorf("failed to save evidence snapshot: %w", err)
	}

	record.EvidenceSnapshot = snapshot.SnapshotID

	// Calculate decision hash
	record.Hash = s.calculateDecisionHash(record)

	// Persist decision record
	return s.persistDecision(ctx, record)
}

// ReplayDecision replays a decision with original context
func (s *DecisionReproducibilityService) ReplayDecision(ctx context.Context, decisionID string) (*DecisionReplayResult, error) {
	// Load original decision
	original, err := s.loadDecision(ctx, decisionID)
	if err != nil {
		return nil, fmt.Errorf("failed to load decision: %w", err)
	}

	// Load evidence snapshot
	snapshot, err := s.evidenceStore.GetEvidenceSnapshot(ctx, original.EvidenceSnapshot)
	if err != nil {
		return nil, fmt.Errorf("failed to load evidence snapshot: %w", err)
	}

	// Load policy version
	policy, err := s.policyStore.GetPolicy(ctx, original.PolicyID, original.PolicyVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to load policy: %w", err)
	}

	// Load model version if applicable
	var model *ModelVersion
	if original.ModelID != "" {
		model, err = s.modelStore.GetModel(ctx, original.ModelID, original.ModelVersion)
		if err != nil {
			return nil, fmt.Errorf("failed to load model: %w", err)
		}
	}

	// Re-evaluate decision
	replayed := s.evaluateDecision(original.InputData, policy, model)

	return &DecisionReplayResult{
		OriginalDecision: original,
		ReplayedDecision: replayed,
		PolicyUsed:       policy,
		ModelUsed:        model,
		EvidenceSnapshot: snapshot,
		Match:            original.Decision == replayed.Decision,
		ReplayedAt:       time.Now().UTC(),
	}, nil
}

// DecisionReplayResult represents the result of replaying a decision
type DecisionReplayResult struct {
	OriginalDecision *DecisionRecord   `json:"original_decision"`
	ReplayedDecision *DecisionRecord   `json:"replayed_decision"`
	PolicyUsed       *PolicyVersion    `json:"policy_used"`
	ModelUsed        *ModelVersion     `json:"model_used,omitempty"`
	EvidenceSnapshot *EvidenceSnapshot `json:"evidence_snapshot"`
	Match            bool              `json:"match"`
	Differences      []string          `json:"differences,omitempty"`
	ReplayedAt       time.Time         `json:"replayed_at"`
}

func (s *DecisionReproducibilityService) calculateDecisionHash(record *DecisionRecord) string {
	data := fmt.Sprintf("%s:%s:%s:%s:%f:%d:%d:%s",
		record.DecisionID,
		record.CustomerID,
		record.Decision,
		record.PolicyID,
		record.Score,
		record.PolicyVersion,
		record.ModelVersion,
		record.DecidedAt.Format(time.RFC3339Nano),
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *DecisionReproducibilityService) persistDecision(ctx context.Context, record *DecisionRecord) error {
	if s.db == nil {
		return nil
	}

	inputDataJSON, _ := json.Marshal(record.InputData)
	rulesJSON, _ := json.Marshal(record.RulesTriggered)
	reasonsJSON, _ := json.Marshal(record.Reasons)

	query := `
		INSERT INTO decision_records (
			decision_id, decision_type, customer_id, transaction_id,
			decision, score, reasons, policy_id, policy_version,
			model_id, model_version, evidence_snapshot_id, input_data,
			rules_triggered, decided_at, decided_by, hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`

	_, err := s.db.ExecContext(ctx, query,
		record.DecisionID, record.DecisionType, record.CustomerID, record.TransactionID,
		record.Decision, record.Score, reasonsJSON, record.PolicyID, record.PolicyVersion,
		record.ModelID, record.ModelVersion, record.EvidenceSnapshot, inputDataJSON,
		rulesJSON, record.DecidedAt, record.DecidedBy, record.Hash,
	)

	return err
}

func (s *DecisionReproducibilityService) loadDecision(ctx context.Context, decisionID string) (*DecisionRecord, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not configured")
	}

	query := `
		SELECT decision_id, decision_type, customer_id, transaction_id,
		       decision, score, reasons, policy_id, policy_version,
		       model_id, model_version, evidence_snapshot_id, input_data,
		       rules_triggered, decided_at, decided_by, hash
		FROM decision_records WHERE decision_id = $1
	`

	var record DecisionRecord
	var inputDataJSON, rulesJSON, reasonsJSON []byte

	err := s.db.QueryRowContext(ctx, query, decisionID).Scan(
		&record.DecisionID, &record.DecisionType, &record.CustomerID, &record.TransactionID,
		&record.Decision, &record.Score, &reasonsJSON, &record.PolicyID, &record.PolicyVersion,
		&record.ModelID, &record.ModelVersion, &record.EvidenceSnapshot, &inputDataJSON,
		&rulesJSON, &record.DecidedAt, &record.DecidedBy, &record.Hash,
	)
	if err != nil {
		return nil, err
	}

	json.Unmarshal(inputDataJSON, &record.InputData)
	json.Unmarshal(rulesJSON, &record.RulesTriggered)
	json.Unmarshal(reasonsJSON, &record.Reasons)

	return &record, nil
}

func (s *DecisionReproducibilityService) evaluateDecision(input map[string]interface{}, policy *PolicyVersion, model *ModelVersion) *DecisionRecord {
	// Simplified decision evaluation - in production this would use the actual policy engine
	return &DecisionRecord{
		Decision:      "REPLAYED",
		Score:         0.0,
		PolicyVersion: policy.Version,
		ModelVersion:  model.Version,
		DecidedAt:     time.Now().UTC(),
		DecidedBy:     "REPLAY_ENGINE",
	}
}

// =============================================================================
// Priority 2.2: SAR/STR Workflow
// =============================================================================

// SARWorkflowService manages Suspicious Activity Report workflows
type SARWorkflowService struct {
	db         *sql.DB
	notifier   SARNotifier
	thresholds *SARThresholds
	mu         sync.RWMutex
}

// SARNotifier interface for SAR notifications
type SARNotifier interface {
	NotifySARCreated(ctx context.Context, sar *SuspiciousActivityReport) error
	NotifySARFiled(ctx context.Context, sar *SuspiciousActivityReport) error
	NotifySARDeadlineApproaching(ctx context.Context, sar *SuspiciousActivityReport) error
}

// SARThresholds defines thresholds for automatic SAR generation
type SARThresholds struct {
	TransactionAmount    float64 `json:"transaction_amount"`
	CumulativeAmount24h  float64 `json:"cumulative_amount_24h"`
	StructuringThreshold float64 `json:"structuring_threshold"`
	VelocityThreshold    int     `json:"velocity_threshold"`
	RiskScoreThreshold   float64 `json:"risk_score_threshold"`
	AMLMatchThreshold    float64 `json:"aml_match_threshold"`
}

// SuspiciousActivityReport represents a SAR
type SuspiciousActivityReport struct {
	SARID              string                 `json:"sar_id"`
	Status             SARStatus              `json:"status"`
	Priority           string                 `json:"priority"` // HIGH, MEDIUM, LOW
	CustomerID         string                 `json:"customer_id"`
	CustomerName       string                 `json:"customer_name"`
	AccountNumbers     []string               `json:"account_numbers"`
	SuspiciousActivity string                 `json:"suspicious_activity"`
	ActivityType       string                 `json:"activity_type"` // STRUCTURING, MONEY_LAUNDERING, FRAUD, etc.
	TotalAmount        float64                `json:"total_amount"`
	Currency           string                 `json:"currency"`
	DateRange          DateRange              `json:"date_range"`
	Transactions       []SARTransaction       `json:"transactions"`
	Narrative          string                 `json:"narrative"`
	Indicators         []string               `json:"indicators"`
	TriggerReason      string                 `json:"trigger_reason"`
	TriggerDecisionID  string                 `json:"trigger_decision_id,omitempty"`
	AssignedTo         string                 `json:"assigned_to"`
	CreatedAt          time.Time              `json:"created_at"`
	CreatedBy          string                 `json:"created_by"`
	ReviewedAt         *time.Time             `json:"reviewed_at,omitempty"`
	ReviewedBy         string                 `json:"reviewed_by,omitempty"`
	FiledAt            *time.Time             `json:"filed_at,omitempty"`
	FilingReference    string                 `json:"filing_reference,omitempty"`
	FilingDeadline     time.Time              `json:"filing_deadline"`
	Attachments        []SARAttachment        `json:"attachments"`
	AuditTrail         []SAREvent             `json:"audit_trail"`
	Metadata           map[string]interface{} `json:"metadata"`
}

// SARStatus represents SAR status
type SARStatus string

const (
	SARStatusDraft         SARStatus = "DRAFT"
	SARStatusPendingReview SARStatus = "PENDING_REVIEW"
	SARStatusApproved      SARStatus = "APPROVED"
	SARStatusRejected      SARStatus = "REJECTED"
	SARStatusFiled         SARStatus = "FILED"
	SARStatusAmended       SARStatus = "AMENDED"
)

// DateRange represents a date range
type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// SARTransaction represents a transaction in a SAR
type SARTransaction struct {
	TransactionID   string    `json:"transaction_id"`
	Date            time.Time `json:"date"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Type            string    `json:"type"`
	Counterparty    string    `json:"counterparty"`
	Description     string    `json:"description"`
	SuspiciousFlags []string  `json:"suspicious_flags"`
}

// SARAttachment represents an attachment to a SAR
type SARAttachment struct {
	AttachmentID string    `json:"attachment_id"`
	FileName     string    `json:"file_name"`
	FileType     string    `json:"file_type"`
	FileSize     int64     `json:"file_size"`
	StorageRef   string    `json:"storage_ref"`
	UploadedAt   time.Time `json:"uploaded_at"`
	UploadedBy   string    `json:"uploaded_by"`
}

// SAREvent represents an audit event for a SAR
type SAREvent struct {
	EventID   string    `json:"event_id"`
	EventType string    `json:"event_type"`
	UserID    string    `json:"user_id"`
	Details   string    `json:"details"`
	Timestamp time.Time `json:"timestamp"`
}

// NewSARWorkflowService creates a new SAR workflow service
func NewSARWorkflowService(db *sql.DB, notifier SARNotifier) *SARWorkflowService {
	return &SARWorkflowService{
		db:       db,
		notifier: notifier,
		thresholds: &SARThresholds{
			TransactionAmount:    10000,
			CumulativeAmount24h:  25000,
			StructuringThreshold: 9000,
			VelocityThreshold:    10,
			RiskScoreThreshold:   0.8,
			AMLMatchThreshold:    0.85,
		},
	}
}

// CheckSARTriggers checks if activity triggers SAR requirements
func (s *SARWorkflowService) CheckSARTriggers(ctx context.Context, activity *ActivityData) (*SARTriggerResult, error) {
	result := &SARTriggerResult{
		Triggered:  false,
		Indicators: make([]string, 0),
	}

	// Check transaction amount threshold
	if activity.Amount >= s.thresholds.TransactionAmount {
		result.Triggered = true
		result.Indicators = append(result.Indicators, fmt.Sprintf("Transaction amount $%.2f exceeds threshold $%.2f", activity.Amount, s.thresholds.TransactionAmount))
	}

	// Check cumulative amount
	if activity.CumulativeAmount24h >= s.thresholds.CumulativeAmount24h {
		result.Triggered = true
		result.Indicators = append(result.Indicators, fmt.Sprintf("24h cumulative amount $%.2f exceeds threshold $%.2f", activity.CumulativeAmount24h, s.thresholds.CumulativeAmount24h))
	}

	// Check structuring pattern
	if activity.Amount >= s.thresholds.StructuringThreshold && activity.Amount < s.thresholds.TransactionAmount {
		if activity.TransactionCount24h >= 3 {
			result.Triggered = true
			result.Indicators = append(result.Indicators, "Potential structuring detected: multiple transactions just below reporting threshold")
		}
	}

	// Check velocity
	if activity.TransactionCount24h >= s.thresholds.VelocityThreshold {
		result.Triggered = true
		result.Indicators = append(result.Indicators, fmt.Sprintf("High velocity: %d transactions in 24h exceeds threshold %d", activity.TransactionCount24h, s.thresholds.VelocityThreshold))
	}

	// Check risk score
	if activity.RiskScore >= s.thresholds.RiskScoreThreshold {
		result.Triggered = true
		result.Indicators = append(result.Indicators, fmt.Sprintf("High risk score %.2f exceeds threshold %.2f", activity.RiskScore, s.thresholds.RiskScoreThreshold))
	}

	// Check AML match
	if activity.AMLMatchScore >= s.thresholds.AMLMatchThreshold {
		result.Triggered = true
		result.Indicators = append(result.Indicators, fmt.Sprintf("AML match score %.2f exceeds threshold %.2f", activity.AMLMatchScore, s.thresholds.AMLMatchThreshold))
	}

	if result.Triggered {
		result.RecommendedActivityType = s.determineActivityType(result.Indicators)
		result.RecommendedPriority = s.determinePriority(activity, result.Indicators)
	}

	return result, nil
}

// ActivityData represents activity data for SAR trigger checking
type ActivityData struct {
	CustomerID          string    `json:"customer_id"`
	TransactionID       string    `json:"transaction_id"`
	Amount              float64   `json:"amount"`
	CumulativeAmount24h float64   `json:"cumulative_amount_24h"`
	TransactionCount24h int       `json:"transaction_count_24h"`
	RiskScore           float64   `json:"risk_score"`
	AMLMatchScore       float64   `json:"aml_match_score"`
	Timestamp           time.Time `json:"timestamp"`
}

// SARTriggerResult represents the result of SAR trigger checking
type SARTriggerResult struct {
	Triggered               bool     `json:"triggered"`
	Indicators              []string `json:"indicators"`
	RecommendedActivityType string   `json:"recommended_activity_type"`
	RecommendedPriority     string   `json:"recommended_priority"`
}

func (s *SARWorkflowService) determineActivityType(indicators []string) string {
	for _, ind := range indicators {
		if contains(ind, "structuring") {
			return "STRUCTURING"
		}
		if contains(ind, "AML") {
			return "MONEY_LAUNDERING"
		}
	}
	return "SUSPICIOUS_TRANSACTION"
}

func (s *SARWorkflowService) determinePriority(activity *ActivityData, indicators []string) string {
	if activity.AMLMatchScore >= 0.95 || activity.RiskScore >= 0.95 {
		return "HIGH"
	}
	if len(indicators) >= 3 {
		return "HIGH"
	}
	if activity.Amount >= 50000 {
		return "HIGH"
	}
	if len(indicators) >= 2 {
		return "MEDIUM"
	}
	return "LOW"
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// CreateSAR creates a new SAR
func (s *SARWorkflowService) CreateSAR(ctx context.Context, sar *SuspiciousActivityReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sar.SARID = fmt.Sprintf("SAR_%d", time.Now().UnixNano())
	sar.Status = SARStatusDraft
	sar.CreatedAt = time.Now().UTC()
	sar.FilingDeadline = time.Now().AddDate(0, 0, 30) // 30 days to file

	// Add creation event to audit trail
	sar.AuditTrail = append(sar.AuditTrail, SAREvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "CREATED",
		UserID:    sar.CreatedBy,
		Details:   "SAR created",
		Timestamp: time.Now().UTC(),
	})

	// Persist SAR
	if err := s.persistSAR(ctx, sar); err != nil {
		return err
	}

	// Notify
	if s.notifier != nil {
		s.notifier.NotifySARCreated(ctx, sar)
	}

	return nil
}

// FileSAR files a SAR with the regulatory authority
func (s *SARWorkflowService) FileSAR(ctx context.Context, sarID, filedBy, filingReference string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Load SAR
	sar, err := s.loadSAR(ctx, sarID)
	if err != nil {
		return err
	}

	if sar.Status != SARStatusApproved {
		return fmt.Errorf("SAR must be approved before filing, current status: %s", sar.Status)
	}

	now := time.Now().UTC()
	sar.Status = SARStatusFiled
	sar.FiledAt = &now
	sar.FilingReference = filingReference

	// Add filing event
	sar.AuditTrail = append(sar.AuditTrail, SAREvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "FILED",
		UserID:    filedBy,
		Details:   fmt.Sprintf("SAR filed with reference: %s", filingReference),
		Timestamp: now,
	})

	// Update SAR
	if err := s.updateSAR(ctx, sar); err != nil {
		return err
	}

	// Notify
	if s.notifier != nil {
		s.notifier.NotifySARFiled(ctx, sar)
	}

	return nil
}

func (s *SARWorkflowService) persistSAR(ctx context.Context, sar *SuspiciousActivityReport) error {
	if s.db == nil {
		return nil
	}

	transactionsJSON, _ := json.Marshal(sar.Transactions)
	indicatorsJSON, _ := json.Marshal(sar.Indicators)
	attachmentsJSON, _ := json.Marshal(sar.Attachments)
	auditTrailJSON, _ := json.Marshal(sar.AuditTrail)
	metadataJSON, _ := json.Marshal(sar.Metadata)
	accountsJSON, _ := json.Marshal(sar.AccountNumbers)

	query := `
		INSERT INTO suspicious_activity_reports (
			sar_id, status, priority, customer_id, customer_name,
			account_numbers, suspicious_activity, activity_type, total_amount,
			currency, date_range_start, date_range_end, transactions, narrative,
			indicators, trigger_reason, trigger_decision_id, assigned_to,
			created_at, created_by, filing_deadline, attachments, audit_trail, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
	`

	_, err := s.db.ExecContext(ctx, query,
		sar.SARID, sar.Status, sar.Priority, sar.CustomerID, sar.CustomerName,
		accountsJSON, sar.SuspiciousActivity, sar.ActivityType, sar.TotalAmount,
		sar.Currency, sar.DateRange.Start, sar.DateRange.End, transactionsJSON, sar.Narrative,
		indicatorsJSON, sar.TriggerReason, sar.TriggerDecisionID, sar.AssignedTo,
		sar.CreatedAt, sar.CreatedBy, sar.FilingDeadline, attachmentsJSON, auditTrailJSON, metadataJSON,
	)

	return err
}

func (s *SARWorkflowService) loadSAR(ctx context.Context, sarID string) (*SuspiciousActivityReport, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not configured")
	}

	query := `
		SELECT sar_id, status, priority, customer_id, customer_name,
			account_numbers, suspicious_activity, activity_type, total_amount,
			currency, date_range_start, date_range_end, transactions, narrative,
			indicators, trigger_reason, trigger_decision_id, assigned_to,
			created_at, created_by, filing_deadline, attachments, audit_trail, metadata
		FROM suspicious_activity_reports WHERE sar_id = $1
	`

	sar := &SuspiciousActivityReport{}
	var accountsJSON, transactionsJSON, indicatorsJSON, attachmentsJSON, auditTrailJSON, metadataJSON []byte

	err := s.db.QueryRowContext(ctx, query, sarID).Scan(
		&sar.SARID, &sar.Status, &sar.Priority, &sar.CustomerID, &sar.CustomerName,
		&accountsJSON, &sar.SuspiciousActivity, &sar.ActivityType, &sar.TotalAmount,
		&sar.Currency, &sar.DateRange.Start, &sar.DateRange.End, &transactionsJSON, &sar.Narrative,
		&indicatorsJSON, &sar.TriggerReason, &sar.TriggerDecisionID, &sar.AssignedTo,
		&sar.CreatedAt, &sar.CreatedBy, &sar.FilingDeadline, &attachmentsJSON, &auditTrailJSON, &metadataJSON,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("SAR %s not found", sarID)
		}
		return nil, fmt.Errorf("failed to load SAR %s: %w", sarID, err)
	}

	if len(accountsJSON) > 0 {
		json.Unmarshal(accountsJSON, &sar.AccountNumbers)
	}
	if len(transactionsJSON) > 0 {
		json.Unmarshal(transactionsJSON, &sar.Transactions)
	}
	if len(indicatorsJSON) > 0 {
		json.Unmarshal(indicatorsJSON, &sar.Indicators)
	}
	if len(attachmentsJSON) > 0 {
		json.Unmarshal(attachmentsJSON, &sar.Attachments)
	}
	if len(auditTrailJSON) > 0 {
		json.Unmarshal(auditTrailJSON, &sar.AuditTrail)
	}
	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &sar.Metadata)
	}

	return sar, nil
}

func (s *SARWorkflowService) updateSAR(ctx context.Context, sar *SuspiciousActivityReport) error {
	if s.db == nil {
		return nil
	}

	transactionsJSON, _ := json.Marshal(sar.Transactions)
	indicatorsJSON, _ := json.Marshal(sar.Indicators)
	attachmentsJSON, _ := json.Marshal(sar.Attachments)
	auditTrailJSON, _ := json.Marshal(sar.AuditTrail)
	metadataJSON, _ := json.Marshal(sar.Metadata)

	query := `
		UPDATE suspicious_activity_reports SET
			status = $2, priority = $3, assigned_to = $4,
			narrative = $5, transactions = $6, indicators = $7,
			attachments = $8, audit_trail = $9, metadata = $10
		WHERE sar_id = $1
	`

	_, err := s.db.ExecContext(ctx, query,
		sar.SARID, sar.Status, sar.Priority, sar.AssignedTo,
		sar.Narrative, transactionsJSON, indicatorsJSON,
		attachmentsJSON, auditTrailJSON, metadataJSON,
	)
	return err
}

// =============================================================================
// Priority 2.3: Sanctions List Provenance
// =============================================================================

// SanctionsListManager manages sanctions list provenance
type SanctionsListManager struct {
	db        *sql.DB
	providers map[string]SanctionsListProvider
	mu        sync.RWMutex
}

// SanctionsListProvider interface for sanctions list providers
type SanctionsListProvider interface {
	FetchList(ctx context.Context) (*SanctionsList, error)
	GetProviderName() string
}

// SanctionsList represents a sanctions list with provenance
type SanctionsList struct {
	ListID        string            `json:"list_id"`
	ListType      string            `json:"list_type"` // OFAC, UN, EU, UK_HMT, etc.
	Provider      string            `json:"provider"`
	SourceURL     string            `json:"source_url"`
	FetchedAt     time.Time         `json:"fetched_at"`
	PublishedAt   time.Time         `json:"published_at"`
	EffectiveDate time.Time         `json:"effective_date"`
	EntryCount    int               `json:"entry_count"`
	ContentHash   string            `json:"content_hash"`
	Signature     string            `json:"signature,omitempty"`
	PreviousHash  string            `json:"previous_hash"`
	Version       int               `json:"version"`
	Status        string            `json:"status"` // ACTIVE, SUPERSEDED, RETIRED
	Metadata      map[string]string `json:"metadata"`
}

// SanctionsListUpdate represents an update to a sanctions list
type SanctionsListUpdate struct {
	UpdateID        string    `json:"update_id"`
	ListID          string    `json:"list_id"`
	ListType        string    `json:"list_type"`
	OldVersion      int       `json:"old_version"`
	NewVersion      int       `json:"new_version"`
	EntriesAdded    int       `json:"entries_added"`
	EntriesRemoved  int       `json:"entries_removed"`
	EntriesModified int       `json:"entries_modified"`
	DiffHash        string    `json:"diff_hash"`
	AppliedAt       time.Time `json:"applied_at"`
	AppliedBy       string    `json:"applied_by"`
}

// NewSanctionsListManager creates a new sanctions list manager
func NewSanctionsListManager(db *sql.DB) *SanctionsListManager {
	return &SanctionsListManager{
		db:        db,
		providers: make(map[string]SanctionsListProvider),
	}
}

// RegisterProvider registers a sanctions list provider
func (m *SanctionsListManager) RegisterProvider(provider SanctionsListProvider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.providers[provider.GetProviderName()] = provider
}

// UpdateList fetches and updates a sanctions list with provenance tracking
func (m *SanctionsListManager) UpdateList(ctx context.Context, listType string) (*SanctionsListUpdate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	provider, ok := m.providers[listType]
	if !ok {
		return nil, fmt.Errorf("no provider registered for list type: %s", listType)
	}

	// Fetch new list
	newList, err := provider.FetchList(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch list: %w", err)
	}

	// Get current list
	currentList, err := m.getCurrentList(ctx, listType)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get current list: %w", err)
	}

	// Calculate diff
	update := &SanctionsListUpdate{
		UpdateID:  fmt.Sprintf("upd_%d", time.Now().UnixNano()),
		ListID:    newList.ListID,
		ListType:  listType,
		AppliedAt: time.Now().UTC(),
		AppliedBy: "SYSTEM",
	}

	if currentList != nil {
		update.OldVersion = currentList.Version
		newList.PreviousHash = currentList.ContentHash
		newList.Version = currentList.Version + 1

		// Mark old list as superseded
		currentList.Status = "SUPERSEDED"
		m.updateListStatus(ctx, currentList)
	} else {
		newList.Version = 1
	}

	update.NewVersion = newList.Version

	// Save new list
	if err := m.saveList(ctx, newList); err != nil {
		return nil, fmt.Errorf("failed to save list: %w", err)
	}

	// Save update record
	if err := m.saveUpdate(ctx, update); err != nil {
		return nil, fmt.Errorf("failed to save update: %w", err)
	}

	return update, nil
}

// GetListProvenance gets the provenance chain for a list
func (m *SanctionsListManager) GetListProvenance(ctx context.Context, listType string, limit int) ([]*SanctionsList, error) {
	if m.db == nil {
		return nil, nil
	}

	query := `
		SELECT list_id, list_type, provider, source_url, fetched_at,
		       published_at, effective_date, entry_count, content_hash,
		       signature, previous_hash, version, status
		FROM sanctions_lists
		WHERE list_type = $1
		ORDER BY version DESC
		LIMIT $2
	`

	rows, err := m.db.QueryContext(ctx, query, listType, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []*SanctionsList
	for rows.Next() {
		var list SanctionsList
		err := rows.Scan(
			&list.ListID, &list.ListType, &list.Provider, &list.SourceURL, &list.FetchedAt,
			&list.PublishedAt, &list.EffectiveDate, &list.EntryCount, &list.ContentHash,
			&list.Signature, &list.PreviousHash, &list.Version, &list.Status,
		)
		if err != nil {
			return nil, err
		}
		lists = append(lists, &list)
	}

	return lists, nil
}

// VerifyListIntegrity verifies the integrity of the sanctions list chain
func (m *SanctionsListManager) VerifyListIntegrity(ctx context.Context, listType string) (bool, []string, error) {
	lists, err := m.GetListProvenance(ctx, listType, 100)
	if err != nil {
		return false, nil, err
	}

	var errors []string

	for i := 0; i < len(lists)-1; i++ {
		current := lists[i]
		previous := lists[i+1]

		// Verify hash chain
		if current.PreviousHash != previous.ContentHash {
			errors = append(errors, fmt.Sprintf("hash chain broken at version %d", current.Version))
		}

		// Verify version sequence
		if current.Version != previous.Version+1 {
			errors = append(errors, fmt.Sprintf("version gap at %d", current.Version))
		}
	}

	return len(errors) == 0, errors, nil
}

func (m *SanctionsListManager) getCurrentList(ctx context.Context, listType string) (*SanctionsList, error) {
	if m.db == nil {
		return nil, sql.ErrNoRows
	}

	query := `
		SELECT list_id, list_type, provider, source_url, fetched_at,
		       published_at, effective_date, entry_count, content_hash,
		       signature, previous_hash, version, status
		FROM sanctions_lists
		WHERE list_type = $1 AND status = 'ACTIVE'
		ORDER BY version DESC
		LIMIT 1
	`

	var list SanctionsList
	err := m.db.QueryRowContext(ctx, query, listType).Scan(
		&list.ListID, &list.ListType, &list.Provider, &list.SourceURL, &list.FetchedAt,
		&list.PublishedAt, &list.EffectiveDate, &list.EntryCount, &list.ContentHash,
		&list.Signature, &list.PreviousHash, &list.Version, &list.Status,
	)

	return &list, err
}

func (m *SanctionsListManager) saveList(ctx context.Context, list *SanctionsList) error {
	if m.db == nil {
		return nil
	}

	metadataJSON, _ := json.Marshal(list.Metadata)

	query := `
		INSERT INTO sanctions_lists (
			list_id, list_type, provider, source_url, fetched_at,
			published_at, effective_date, entry_count, content_hash,
			signature, previous_hash, version, status, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := m.db.ExecContext(ctx, query,
		list.ListID, list.ListType, list.Provider, list.SourceURL, list.FetchedAt,
		list.PublishedAt, list.EffectiveDate, list.EntryCount, list.ContentHash,
		list.Signature, list.PreviousHash, list.Version, list.Status, metadataJSON,
	)

	return err
}

func (m *SanctionsListManager) updateListStatus(ctx context.Context, list *SanctionsList) error {
	if m.db == nil {
		return nil
	}

	query := `UPDATE sanctions_lists SET status = $1 WHERE list_id = $2`
	_, err := m.db.ExecContext(ctx, query, list.Status, list.ListID)
	return err
}

func (m *SanctionsListManager) saveUpdate(ctx context.Context, update *SanctionsListUpdate) error {
	if m.db == nil {
		return nil
	}

	query := `
		INSERT INTO sanctions_list_updates (
			update_id, list_id, list_type, old_version, new_version,
			entries_added, entries_removed, entries_modified, diff_hash,
			applied_at, applied_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := m.db.ExecContext(ctx, query,
		update.UpdateID, update.ListID, update.ListType, update.OldVersion, update.NewVersion,
		update.EntriesAdded, update.EntriesRemoved, update.EntriesModified, update.DiffHash,
		update.AppliedAt, update.AppliedBy,
	)

	return err
}

// =============================================================================
// Priority 2.4: Retention/Deletion Policy
// =============================================================================

// RetentionPolicyService manages data retention and deletion
type RetentionPolicyService struct {
	db       *sql.DB
	policies map[string]*RetentionPolicy
	mu       sync.RWMutex
}

// RetentionPolicy represents a data retention policy
type RetentionPolicy struct {
	PolicyID        string    `json:"policy_id"`
	Name            string    `json:"name"`
	DataType        string    `json:"data_type"` // KYC, KYB, FRAUD, TRANSACTION, etc.
	RetentionDays   int       `json:"retention_days"`
	ArchiveDays     int       `json:"archive_days"` // Days before archiving
	DeleteAfterDays int       `json:"delete_after_days"`
	LegalHold       bool      `json:"legal_hold"`
	Jurisdiction    string    `json:"jurisdiction"`
	Regulation      string    `json:"regulation"` // GDPR, CCPA, etc.
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Status          string    `json:"status"`
}

// RetentionAction represents a retention action taken
type RetentionAction struct {
	ActionID     string    `json:"action_id"`
	PolicyID     string    `json:"policy_id"`
	DataType     string    `json:"data_type"`
	ActionType   string    `json:"action_type"` // ARCHIVE, DELETE, ANONYMIZE
	RecordsCount int64     `json:"records_count"`
	ExecutedAt   time.Time `json:"executed_at"`
	ExecutedBy   string    `json:"executed_by"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message,omitempty"`
}

// DeletionRequest represents a data deletion request (e.g., GDPR right to erasure)
type DeletionRequest struct {
	RequestID   string     `json:"request_id"`
	CustomerID  string     `json:"customer_id"`
	RequestType string     `json:"request_type"` // GDPR_ERASURE, CCPA_DELETE, etc.
	RequestedAt time.Time  `json:"requested_at"`
	RequestedBy string     `json:"requested_by"`
	Deadline    time.Time  `json:"deadline"`
	Status      string     `json:"status"` // PENDING, IN_PROGRESS, COMPLETED, REJECTED
	DataTypes   []string   `json:"data_types"`
	Exclusions  []string   `json:"exclusions"` // Data that cannot be deleted (legal hold, etc.)
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CompletedBy string     `json:"completed_by,omitempty"`
	AuditTrail  []string   `json:"audit_trail"`
}

// NewRetentionPolicyService creates a new retention policy service
func NewRetentionPolicyService(db *sql.DB) *RetentionPolicyService {
	svc := &RetentionPolicyService{
		db:       db,
		policies: make(map[string]*RetentionPolicy),
	}
	svc.initializeDefaultPolicies()
	return svc
}

// initializeDefaultPolicies sets up default retention policies
func (s *RetentionPolicyService) initializeDefaultPolicies() {
	// KYC data - typically 5-7 years after relationship ends
	s.policies["kyc_data"] = &RetentionPolicy{
		PolicyID:        "kyc_data",
		Name:            "KYC Data Retention",
		DataType:        "KYC",
		RetentionDays:   2555, // 7 years
		ArchiveDays:     1825, // 5 years
		DeleteAfterDays: 2920, // 8 years
		Jurisdiction:    "GLOBAL",
		Regulation:      "AML/KYC",
		Status:          "ACTIVE",
	}

	// Transaction data - typically 5-7 years
	s.policies["transaction_data"] = &RetentionPolicy{
		PolicyID:        "transaction_data",
		Name:            "Transaction Data Retention",
		DataType:        "TRANSACTION",
		RetentionDays:   2555, // 7 years
		ArchiveDays:     1825, // 5 years
		DeleteAfterDays: 2920, // 8 years
		Jurisdiction:    "GLOBAL",
		Regulation:      "AML/KYC",
		Status:          "ACTIVE",
	}

	// Fraud alerts - typically 5 years
	s.policies["fraud_data"] = &RetentionPolicy{
		PolicyID:        "fraud_data",
		Name:            "Fraud Data Retention",
		DataType:        "FRAUD",
		RetentionDays:   1825, // 5 years
		ArchiveDays:     1095, // 3 years
		DeleteAfterDays: 2190, // 6 years
		Jurisdiction:    "GLOBAL",
		Regulation:      "FRAUD_PREVENTION",
		Status:          "ACTIVE",
	}

	// SAR data - typically 5 years after filing
	s.policies["sar_data"] = &RetentionPolicy{
		PolicyID:        "sar_data",
		Name:            "SAR Data Retention",
		DataType:        "SAR",
		RetentionDays:   1825, // 5 years
		ArchiveDays:     1825, // 5 years (no early archive)
		DeleteAfterDays: 2555, // 7 years
		Jurisdiction:    "GLOBAL",
		Regulation:      "BSA/AML",
		Status:          "ACTIVE",
	}
}

// ProcessDeletionRequest processes a data deletion request
func (s *RetentionPolicyService) ProcessDeletionRequest(ctx context.Context, request *DeletionRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	request.Status = "IN_PROGRESS"
	request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Processing started", time.Now().Format(time.RFC3339)))

	// Check for legal holds
	exclusions, err := s.checkLegalHolds(ctx, request.CustomerID)
	if err != nil {
		return fmt.Errorf("failed to check legal holds: %w", err)
	}
	request.Exclusions = exclusions

	// Process each data type
	for _, dataType := range request.DataTypes {
		// Skip if excluded
		if containsString(exclusions, dataType) {
			request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Skipped %s (legal hold)", time.Now().Format(time.RFC3339), dataType))
			continue
		}

		// Anonymize or delete based on policy
		policy := s.policies[dataType+"_data"]
		if policy != nil && policy.LegalHold {
			// Anonymize instead of delete
			if err := s.anonymizeData(ctx, request.CustomerID, dataType); err != nil {
				request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Failed to anonymize %s: %v", time.Now().Format(time.RFC3339), dataType, err))
				continue
			}
			request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Anonymized %s", time.Now().Format(time.RFC3339), dataType))
		} else {
			// Delete
			if err := s.deleteData(ctx, request.CustomerID, dataType); err != nil {
				request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Failed to delete %s: %v", time.Now().Format(time.RFC3339), dataType, err))
				continue
			}
			request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Deleted %s", time.Now().Format(time.RFC3339), dataType))
		}
	}

	now := time.Now().UTC()
	request.Status = "COMPLETED"
	request.CompletedAt = &now
	request.AuditTrail = append(request.AuditTrail, fmt.Sprintf("%s: Processing completed", time.Now().Format(time.RFC3339)))

	return s.saveDeletionRequest(ctx, request)
}

// RunRetentionJob runs the retention policy job
func (s *RetentionPolicyService) RunRetentionJob(ctx context.Context) ([]*RetentionAction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var actions []*RetentionAction

	for _, policy := range s.policies {
		if policy.Status != "ACTIVE" {
			continue
		}

		// Archive old data
		archiveAction, err := s.archiveOldData(ctx, policy)
		if err != nil {
			continue
		}
		if archiveAction != nil {
			actions = append(actions, archiveAction)
		}

		// Delete expired data
		deleteAction, err := s.deleteExpiredData(ctx, policy)
		if err != nil {
			continue
		}
		if deleteAction != nil {
			actions = append(actions, deleteAction)
		}
	}

	return actions, nil
}

func (s *RetentionPolicyService) checkLegalHolds(ctx context.Context, customerID string) ([]string, error) {
	// Check for any legal holds on customer data
	// This would query a legal_holds table
	return []string{}, nil
}

func (s *RetentionPolicyService) anonymizeData(ctx context.Context, customerID, dataType string) error {
	// Anonymize PII while keeping aggregate data
	// Implementation depends on data type
	return nil
}

func (s *RetentionPolicyService) deleteData(ctx context.Context, customerID, dataType string) error {
	// Delete customer data of specified type
	// Implementation depends on data type
	return nil
}

func (s *RetentionPolicyService) archiveOldData(ctx context.Context, policy *RetentionPolicy) (*RetentionAction, error) {
	// Archive data older than archive threshold
	return nil, nil
}

func (s *RetentionPolicyService) deleteExpiredData(ctx context.Context, policy *RetentionPolicy) (*RetentionAction, error) {
	// Delete data older than delete threshold
	return nil, nil
}

func (s *RetentionPolicyService) saveDeletionRequest(ctx context.Context, request *DeletionRequest) error {
	if s.db == nil {
		return nil
	}

	dataTypesJSON, _ := json.Marshal(request.DataTypes)
	exclusionsJSON, _ := json.Marshal(request.Exclusions)
	auditTrailJSON, _ := json.Marshal(request.AuditTrail)

	query := `
		INSERT INTO deletion_requests (
			request_id, customer_id, request_type, requested_at, requested_by,
			deadline, status, data_types, exclusions, completed_at, completed_by, audit_trail
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (request_id) DO UPDATE SET
			status = $7, completed_at = $10, completed_by = $11, audit_trail = $12
	`

	_, err := s.db.ExecContext(ctx, query,
		request.RequestID, request.CustomerID, request.RequestType, request.RequestedAt, request.RequestedBy,
		request.Deadline, request.Status, dataTypesJSON, exclusionsJSON, request.CompletedAt, request.CompletedBy, auditTrailJSON,
	)

	return err
}

func containsString(slice []string, s string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}

// =============================================================================
// Database Schema
// =============================================================================

// ComplianceSchema returns the database schema for compliance components
func ComplianceSchema() string {
	return `
	-- Decision records for reproducibility
	CREATE TABLE IF NOT EXISTS decision_records (
		decision_id VARCHAR(128) PRIMARY KEY,
		decision_type VARCHAR(64) NOT NULL,
		customer_id VARCHAR(128) NOT NULL,
		transaction_id VARCHAR(128),
		decision VARCHAR(32) NOT NULL,
		score DECIMAL(5,4),
		reasons JSONB,
		policy_id VARCHAR(128) NOT NULL,
		policy_version INTEGER NOT NULL,
		model_id VARCHAR(128),
		model_version INTEGER,
		evidence_snapshot_id VARCHAR(128),
		input_data JSONB,
		rules_triggered JSONB,
		decided_at TIMESTAMP NOT NULL,
		decided_by VARCHAR(128) NOT NULL,
		hash VARCHAR(64) NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_decision_customer ON decision_records(customer_id);
	CREATE INDEX IF NOT EXISTS idx_decision_type ON decision_records(decision_type);
	CREATE INDEX IF NOT EXISTS idx_decision_time ON decision_records(decided_at);

	-- Evidence snapshots
	CREATE TABLE IF NOT EXISTS evidence_snapshots (
		snapshot_id VARCHAR(128) PRIMARY KEY,
		decision_id VARCHAR(128) NOT NULL,
		customer_id VARCHAR(128) NOT NULL,
		snapshot_type VARCHAR(64) NOT NULL,
		evidence JSONB NOT NULL,
		policy_version INTEGER,
		model_version INTEGER,
		created_at TIMESTAMP NOT NULL,
		hash VARCHAR(64) NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_snapshot_decision ON evidence_snapshots(decision_id);

	-- Policy versions
	CREATE TABLE IF NOT EXISTS policy_versions (
		policy_id VARCHAR(128) NOT NULL,
		version INTEGER NOT NULL,
		name VARCHAR(256) NOT NULL,
		description TEXT,
		rules JSONB NOT NULL,
		thresholds JSONB,
		config JSONB,
		effective_from TIMESTAMP NOT NULL,
		effective_to TIMESTAMP,
		created_by VARCHAR(128) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		approved_by VARCHAR(128),
		approved_at TIMESTAMP,
		signature VARCHAR(512),
		hash VARCHAR(64) NOT NULL,
		status VARCHAR(32) NOT NULL,
		PRIMARY KEY (policy_id, version)
	);
	CREATE INDEX IF NOT EXISTS idx_policy_status ON policy_versions(status);

	-- Suspicious Activity Reports
	CREATE TABLE IF NOT EXISTS suspicious_activity_reports (
		sar_id VARCHAR(128) PRIMARY KEY,
		status VARCHAR(32) NOT NULL,
		priority VARCHAR(16) NOT NULL,
		customer_id VARCHAR(128) NOT NULL,
		customer_name VARCHAR(256),
		account_numbers JSONB,
		suspicious_activity TEXT,
		activity_type VARCHAR(64),
		total_amount DECIMAL(18,2),
		currency VARCHAR(3),
		date_range_start TIMESTAMP,
		date_range_end TIMESTAMP,
		transactions JSONB,
		narrative TEXT,
		indicators JSONB,
		trigger_reason TEXT,
		trigger_decision_id VARCHAR(128),
		assigned_to VARCHAR(128),
		created_at TIMESTAMP NOT NULL,
		created_by VARCHAR(128) NOT NULL,
		reviewed_at TIMESTAMP,
		reviewed_by VARCHAR(128),
		filed_at TIMESTAMP,
		filing_reference VARCHAR(128),
		filing_deadline TIMESTAMP NOT NULL,
		attachments JSONB,
		audit_trail JSONB,
		metadata JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_sar_status ON suspicious_activity_reports(status);
	CREATE INDEX IF NOT EXISTS idx_sar_customer ON suspicious_activity_reports(customer_id);
	CREATE INDEX IF NOT EXISTS idx_sar_deadline ON suspicious_activity_reports(filing_deadline);

	-- Sanctions lists with provenance
	CREATE TABLE IF NOT EXISTS sanctions_lists (
		list_id VARCHAR(128) PRIMARY KEY,
		list_type VARCHAR(64) NOT NULL,
		provider VARCHAR(128) NOT NULL,
		source_url TEXT,
		fetched_at TIMESTAMP NOT NULL,
		published_at TIMESTAMP,
		effective_date TIMESTAMP,
		entry_count INTEGER,
		content_hash VARCHAR(64) NOT NULL,
		signature VARCHAR(512),
		previous_hash VARCHAR(64),
		version INTEGER NOT NULL,
		status VARCHAR(32) NOT NULL,
		metadata JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_sanctions_type ON sanctions_lists(list_type);
	CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions_lists(status);

	-- Sanctions list updates
	CREATE TABLE IF NOT EXISTS sanctions_list_updates (
		update_id VARCHAR(128) PRIMARY KEY,
		list_id VARCHAR(128) NOT NULL,
		list_type VARCHAR(64) NOT NULL,
		old_version INTEGER,
		new_version INTEGER NOT NULL,
		entries_added INTEGER DEFAULT 0,
		entries_removed INTEGER DEFAULT 0,
		entries_modified INTEGER DEFAULT 0,
		diff_hash VARCHAR(64),
		applied_at TIMESTAMP NOT NULL,
		applied_by VARCHAR(128) NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_update_list ON sanctions_list_updates(list_id);

	-- Deletion requests (GDPR, CCPA, etc.)
	CREATE TABLE IF NOT EXISTS deletion_requests (
		request_id VARCHAR(128) PRIMARY KEY,
		customer_id VARCHAR(128) NOT NULL,
		request_type VARCHAR(64) NOT NULL,
		requested_at TIMESTAMP NOT NULL,
		requested_by VARCHAR(128) NOT NULL,
		deadline TIMESTAMP NOT NULL,
		status VARCHAR(32) NOT NULL,
		data_types JSONB,
		exclusions JSONB,
		completed_at TIMESTAMP,
		completed_by VARCHAR(128),
		audit_trail JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_deletion_customer ON deletion_requests(customer_id);
	CREATE INDEX IF NOT EXISTS idx_deletion_status ON deletion_requests(status);
	CREATE INDEX IF NOT EXISTS idx_deletion_deadline ON deletion_requests(deadline);

	-- Retention actions log
	CREATE TABLE IF NOT EXISTS retention_actions (
		action_id VARCHAR(128) PRIMARY KEY,
		policy_id VARCHAR(128) NOT NULL,
		data_type VARCHAR(64) NOT NULL,
		action_type VARCHAR(32) NOT NULL,
		records_count BIGINT DEFAULT 0,
		executed_at TIMESTAMP NOT NULL,
		executed_by VARCHAR(128) NOT NULL,
		status VARCHAR(32) NOT NULL,
		error_message TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_retention_policy ON retention_actions(policy_id);
	CREATE INDEX IF NOT EXISTS idx_retention_time ON retention_actions(executed_at);
	`
}
