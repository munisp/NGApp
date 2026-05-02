// Package compliance provides AML case management
package compliance

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// AMLCaseManager provides comprehensive AML case management
// Features:
// - Case creation and assignment
// - Escalation workflows
// - Evidence attachments
// - SAR/STR reporting
// - Audit trail
type AMLCaseManager struct {
	// Storage
	storage CaseStorage
	
	// Workflow engine
	workflow *WorkflowEngine
	
	// Notification service
	notifier Notifier
	
	// Stats
	totalCases     uint64
	openCases      uint64
	escalatedCases uint64
	closedCases    uint64
	sarsGenerated  uint64
	
	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// CaseStorage interface for case persistence
type CaseStorage interface {
	Create(ctx context.Context, c *AMLCase) error
	Update(ctx context.Context, c *AMLCase) error
	Get(ctx context.Context, caseID string) (*AMLCase, error)
	GetByStatus(ctx context.Context, status string) ([]*AMLCase, error)
	GetByAssignee(ctx context.Context, assignee string) ([]*AMLCase, error)
	Search(ctx context.Context, query CaseSearchQuery) ([]*AMLCase, error)
}

// Notifier interface for notifications
type Notifier interface {
	Notify(ctx context.Context, notification Notification) error
}

// Notification represents a notification
type Notification struct {
	Type      string
	Recipient string
	Subject   string
	Body      string
	Priority  string
	Metadata  map[string]string
}

// AMLCase represents an AML investigation case
type AMLCase struct {
	ID              string                 `json:"id"`
	Status          string                 `json:"status"` // OPEN, INVESTIGATING, ESCALATED, PENDING_SAR, CLOSED
	Priority        string                 `json:"priority"` // LOW, MEDIUM, HIGH, CRITICAL
	Type            string                 `json:"type"` // SUSPICIOUS_ACTIVITY, SANCTIONS_HIT, THRESHOLD_BREACH, PATTERN_MATCH
	
	// Subject information
	SubjectType     string                 `json:"subject_type"` // INDIVIDUAL, ENTITY
	SubjectID       string                 `json:"subject_id"`
	SubjectName     string                 `json:"subject_name"`
	
	// Alert information
	AlertID         string                 `json:"alert_id"`
	AlertType       string                 `json:"alert_type"`
	AlertScore      float64                `json:"alert_score"`
	RiskFactors     []string               `json:"risk_factors"`
	
	// Assignment
	Assignee        string                 `json:"assignee"`
	AssigneeTeam    string                 `json:"assignee_team"`
	EscalatedTo     string                 `json:"escalated_to,omitempty"`
	EscalationLevel int                    `json:"escalation_level"`
	
	// Timeline
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	DueDate         time.Time              `json:"due_date"`
	ClosedAt        *time.Time             `json:"closed_at,omitempty"`
	SLABreached     bool                   `json:"sla_breached"`
	
	// Investigation
	Findings        string                 `json:"findings"`
	Decision        string                 `json:"decision"` // NO_ACTION, ENHANCED_DUE_DILIGENCE, FILE_SAR, CLOSE_ACCOUNT
	DecisionReason  string                 `json:"decision_reason"`
	
	// Evidence and notes
	Evidence        []Evidence             `json:"evidence"`
	Notes           []CaseNote             `json:"notes"`
	
	// SAR information
	SARRequired     bool                   `json:"sar_required"`
	SARID           string                 `json:"sar_id,omitempty"`
	SARFiledAt      *time.Time             `json:"sar_filed_at,omitempty"`
	
	// Audit trail
	AuditTrail      []AuditEvent           `json:"audit_trail"`
	
	// Metadata
	Metadata        map[string]interface{} `json:"metadata"`
}

// Evidence represents case evidence
type Evidence struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // DOCUMENT, TRANSACTION, SCREENSHOT, REPORT
	Name        string    `json:"name"`
	Description string    `json:"description"`
	FilePath    string    `json:"file_path"`
	FileSize    int64     `json:"file_size"`
	MimeType    string    `json:"mime_type"`
	Hash        string    `json:"hash"` // SHA-256 for integrity
	UploadedBy  string    `json:"uploaded_by"`
	UploadedAt  time.Time `json:"uploaded_at"`
}

// CaseNote represents a case note
type CaseNote struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	Type      string    `json:"type"` // INVESTIGATION, DECISION, ESCALATION, GENERAL
	CreatedAt time.Time `json:"created_at"`
}

// AuditEvent represents a case audit event
type AuditEvent struct {
	Timestamp time.Time              `json:"timestamp"`
	Actor     string                 `json:"actor"`
	Action    string                 `json:"action"`
	Details   map[string]interface{} `json:"details"`
}

// CaseSearchQuery for searching cases
type CaseSearchQuery struct {
	Status       []string
	Priority     []string
	Type         []string
	Assignee     string
	SubjectID    string
	DateFrom     time.Time
	DateTo       time.Time
	SLABreached  *bool
	Limit        int
	Offset       int
}

// NewAMLCaseManager creates a new AML case manager
func NewAMLCaseManager(storage CaseStorage, notifier Notifier) *AMLCaseManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	mgr := &AMLCaseManager{
		storage:  storage,
		workflow: NewWorkflowEngine(),
		notifier: notifier,
		ctx:      ctx,
		cancel:   cancel,
	}
	
	// Start SLA monitoring
	mgr.wg.Add(1)
	go mgr.slaMonitorLoop()
	
	return mgr
}

// CreateCase creates a new AML case
func (m *AMLCaseManager) CreateCase(ctx context.Context, req CreateCaseRequest) (*AMLCase, error) {
	now := time.Now()
	
	c := &AMLCase{
		ID:          generateCaseID(),
		Status:      "OPEN",
		Priority:    req.Priority,
		Type:        req.Type,
		SubjectType: req.SubjectType,
		SubjectID:   req.SubjectID,
		SubjectName: req.SubjectName,
		AlertID:     req.AlertID,
		AlertType:   req.AlertType,
		AlertScore:  req.AlertScore,
		RiskFactors: req.RiskFactors,
		CreatedAt:   now,
		UpdatedAt:   now,
		DueDate:     m.calculateDueDate(req.Priority),
		Evidence:    make([]Evidence, 0),
		Notes:       make([]CaseNote, 0),
		AuditTrail:  make([]AuditEvent, 0),
		Metadata:    req.Metadata,
	}
	
	// Add creation audit event
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: now,
		Actor:     "SYSTEM",
		Action:    "CASE_CREATED",
		Details: map[string]interface{}{
			"alert_id":    req.AlertID,
			"alert_score": req.AlertScore,
		},
	})
	
	// Auto-assign based on priority and type
	c.Assignee, c.AssigneeTeam = m.workflow.AutoAssign(c)
	
	if err := m.storage.Create(ctx, c); err != nil {
		return nil, fmt.Errorf("failed to create case: %w", err)
	}
	
	atomic.AddUint64(&m.totalCases, 1)
	atomic.AddUint64(&m.openCases, 1)
	
	// Notify assignee
	if m.notifier != nil && c.Assignee != "" {
		_ = m.notifier.Notify(ctx, Notification{
			Type:      "CASE_ASSIGNED",
			Recipient: c.Assignee,
			Subject:   fmt.Sprintf("New AML Case Assigned: %s", c.ID),
			Body:      fmt.Sprintf("A new %s priority case has been assigned to you.", c.Priority),
			Priority:  c.Priority,
		})
	}
	
	return c, nil
}

// CreateCaseRequest for creating a case
type CreateCaseRequest struct {
	Priority    string
	Type        string
	SubjectType string
	SubjectID   string
	SubjectName string
	AlertID     string
	AlertType   string
	AlertScore  float64
	RiskFactors []string
	Metadata    map[string]interface{}
}

// AssignCase assigns a case to an investigator
func (m *AMLCaseManager) AssignCase(ctx context.Context, caseID, assignee, assignedBy string) error {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return err
	}
	
	previousAssignee := c.Assignee
	c.Assignee = assignee
	c.UpdatedAt = time.Now()
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     assignedBy,
		Action:    "CASE_ASSIGNED",
		Details: map[string]interface{}{
			"previous_assignee": previousAssignee,
			"new_assignee":      assignee,
		},
	})
	
	if err := m.storage.Update(ctx, c); err != nil {
		return err
	}
	
	// Notify new assignee
	if m.notifier != nil {
		_ = m.notifier.Notify(ctx, Notification{
			Type:      "CASE_ASSIGNED",
			Recipient: assignee,
			Subject:   fmt.Sprintf("AML Case Assigned: %s", caseID),
			Priority:  c.Priority,
		})
	}
	
	return nil
}

// EscalateCase escalates a case
func (m *AMLCaseManager) EscalateCase(ctx context.Context, caseID, escalatedTo, reason, escalatedBy string) error {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return err
	}
	
	c.Status = "ESCALATED"
	c.EscalatedTo = escalatedTo
	c.EscalationLevel++
	c.UpdatedAt = time.Now()
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     escalatedBy,
		Action:    "CASE_ESCALATED",
		Details: map[string]interface{}{
			"escalated_to":     escalatedTo,
			"escalation_level": c.EscalationLevel,
			"reason":           reason,
		},
	})
	
	c.Notes = append(c.Notes, CaseNote{
		ID:        generateNoteID(),
		Author:    escalatedBy,
		Content:   fmt.Sprintf("Escalated to %s: %s", escalatedTo, reason),
		Type:      "ESCALATION",
		CreatedAt: time.Now(),
	})
	
	if err := m.storage.Update(ctx, c); err != nil {
		return err
	}
	
	atomic.AddUint64(&m.escalatedCases, 1)
	
	// Notify escalation target
	if m.notifier != nil {
		_ = m.notifier.Notify(ctx, Notification{
			Type:      "CASE_ESCALATED",
			Recipient: escalatedTo,
			Subject:   fmt.Sprintf("URGENT: AML Case Escalated: %s", caseID),
			Body:      reason,
			Priority:  "CRITICAL",
		})
	}
	
	return nil
}

// AddEvidence adds evidence to a case
func (m *AMLCaseManager) AddEvidence(ctx context.Context, caseID string, evidence Evidence) error {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return err
	}
	
	evidence.ID = generateEvidenceID()
	evidence.UploadedAt = time.Now()
	
	c.Evidence = append(c.Evidence, evidence)
	c.UpdatedAt = time.Now()
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     evidence.UploadedBy,
		Action:    "EVIDENCE_ADDED",
		Details: map[string]interface{}{
			"evidence_id":   evidence.ID,
			"evidence_type": evidence.Type,
			"evidence_name": evidence.Name,
		},
	})
	
	return m.storage.Update(ctx, c)
}

// AddNote adds a note to a case
func (m *AMLCaseManager) AddNote(ctx context.Context, caseID string, note CaseNote) error {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return err
	}
	
	note.ID = generateNoteID()
	note.CreatedAt = time.Now()
	
	c.Notes = append(c.Notes, note)
	c.UpdatedAt = time.Now()
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     note.Author,
		Action:    "NOTE_ADDED",
		Details: map[string]interface{}{
			"note_id":   note.ID,
			"note_type": note.Type,
		},
	})
	
	return m.storage.Update(ctx, c)
}

// MakeDecision records a case decision
func (m *AMLCaseManager) MakeDecision(ctx context.Context, caseID string, decision DecisionRequest) error {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return err
	}
	
	c.Decision = decision.Decision
	c.DecisionReason = decision.Reason
	c.Findings = decision.Findings
	c.UpdatedAt = time.Now()
	
	if decision.Decision == "FILE_SAR" {
		c.SARRequired = true
		c.Status = "PENDING_SAR"
	} else {
		c.Status = "CLOSED"
		now := time.Now()
		c.ClosedAt = &now
		atomic.AddUint64(&m.closedCases, 1)
	}
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     decision.DecidedBy,
		Action:    "DECISION_MADE",
		Details: map[string]interface{}{
			"decision": decision.Decision,
			"reason":   decision.Reason,
		},
	})
	
	return m.storage.Update(ctx, c)
}

// DecisionRequest for making a decision
type DecisionRequest struct {
	Decision  string
	Reason    string
	Findings  string
	DecidedBy string
}

// GenerateSAR generates a Suspicious Activity Report
func (m *AMLCaseManager) GenerateSAR(ctx context.Context, caseID string, generatedBy string) (*SARReport, error) {
	c, err := m.storage.Get(ctx, caseID)
	if err != nil {
		return nil, err
	}
	
	if !c.SARRequired {
		return nil, fmt.Errorf("SAR not required for this case")
	}
	
	sar := &SARReport{
		ID:              generateSARID(),
		CaseID:          caseID,
		SubjectType:     c.SubjectType,
		SubjectID:       c.SubjectID,
		SubjectName:     c.SubjectName,
		SuspiciousActivity: c.Findings,
		RiskFactors:    c.RiskFactors,
		AlertScore:     c.AlertScore,
		GeneratedAt:    time.Now(),
		GeneratedBy:    generatedBy,
		Status:         "DRAFT",
	}
	
	// Populate SAR fields from case
	sar.NarrativeSummary = m.generateSARNarrative(c)
	
	c.SARID = sar.ID
	c.UpdatedAt = time.Now()
	
	c.AuditTrail = append(c.AuditTrail, AuditEvent{
		Timestamp: time.Now(),
		Actor:     generatedBy,
		Action:    "SAR_GENERATED",
		Details: map[string]interface{}{
			"sar_id": sar.ID,
		},
	})
	
	if err := m.storage.Update(ctx, c); err != nil {
		return nil, err
	}
	
	atomic.AddUint64(&m.sarsGenerated, 1)
	
	return sar, nil
}

// SARReport represents a Suspicious Activity Report
type SARReport struct {
	ID                 string    `json:"id"`
	CaseID             string    `json:"case_id"`
	SubjectType        string    `json:"subject_type"`
	SubjectID          string    `json:"subject_id"`
	SubjectName        string    `json:"subject_name"`
	SuspiciousActivity string    `json:"suspicious_activity"`
	RiskFactors        []string  `json:"risk_factors"`
	AlertScore         float64   `json:"alert_score"`
	NarrativeSummary   string    `json:"narrative_summary"`
	GeneratedAt        time.Time `json:"generated_at"`
	GeneratedBy        string    `json:"generated_by"`
	FiledAt            *time.Time `json:"filed_at,omitempty"`
	FiledBy            string    `json:"filed_by,omitempty"`
	Status             string    `json:"status"` // DRAFT, SUBMITTED, FILED
	RegulatoryRef      string    `json:"regulatory_ref,omitempty"`
}

// generateSARNarrative generates the SAR narrative
func (m *AMLCaseManager) generateSARNarrative(c *AMLCase) string {
	return fmt.Sprintf(
		"Subject: %s (%s)\n\nSuspicious Activity: %s\n\nRisk Factors: %v\n\nFindings: %s",
		c.SubjectName, c.SubjectID,
		c.AlertType,
		c.RiskFactors,
		c.Findings,
	)
}

// calculateDueDate calculates case due date based on priority
func (m *AMLCaseManager) calculateDueDate(priority string) time.Time {
	now := time.Now()
	switch priority {
	case "CRITICAL":
		return now.Add(24 * time.Hour)
	case "HIGH":
		return now.Add(3 * 24 * time.Hour)
	case "MEDIUM":
		return now.Add(7 * 24 * time.Hour)
	default:
		return now.Add(14 * 24 * time.Hour)
	}
}

// slaMonitorLoop monitors SLA breaches
func (m *AMLCaseManager) slaMonitorLoop() {
	defer m.wg.Done()
	
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.checkSLABreaches()
		}
	}
}

// checkSLABreaches checks for SLA breaches
func (m *AMLCaseManager) checkSLABreaches() {
	ctx := context.Background()
	
	openCases, err := m.storage.GetByStatus(ctx, "OPEN")
	if err != nil {
		return
	}
	
	now := time.Now()
	for _, c := range openCases {
		if now.After(c.DueDate) && !c.SLABreached {
			c.SLABreached = true
			c.UpdatedAt = now
			
			c.AuditTrail = append(c.AuditTrail, AuditEvent{
				Timestamp: now,
				Actor:     "SYSTEM",
				Action:    "SLA_BREACHED",
				Details: map[string]interface{}{
					"due_date": c.DueDate,
				},
			})
			
			_ = m.storage.Update(ctx, c)
			
			// Notify
			if m.notifier != nil && c.Assignee != "" {
				_ = m.notifier.Notify(ctx, Notification{
					Type:      "SLA_BREACH",
					Recipient: c.Assignee,
					Subject:   fmt.Sprintf("SLA Breach: Case %s", c.ID),
					Priority:  "CRITICAL",
				})
			}
		}
	}
}

// Stats returns case manager statistics
func (m *AMLCaseManager) Stats() (total, open, escalated, closed, sars uint64) {
	return atomic.LoadUint64(&m.totalCases),
		atomic.LoadUint64(&m.openCases),
		atomic.LoadUint64(&m.escalatedCases),
		atomic.LoadUint64(&m.closedCases),
		atomic.LoadUint64(&m.sarsGenerated)
}

// Close shuts down the case manager
func (m *AMLCaseManager) Close() error {
	m.cancel()
	m.wg.Wait()
	return nil
}

// WorkflowEngine handles case workflow
type WorkflowEngine struct {
	rules []AssignmentRule
}

// AssignmentRule for auto-assignment
type AssignmentRule struct {
	Priority string
	Type     string
	Assignee string
	Team     string
}

// NewWorkflowEngine creates a new workflow engine
func NewWorkflowEngine() *WorkflowEngine {
	return &WorkflowEngine{
		rules: []AssignmentRule{
			{Priority: "CRITICAL", Type: "SANCTIONS_HIT", Assignee: "senior-analyst-1", Team: "sanctions"},
			{Priority: "HIGH", Type: "SUSPICIOUS_ACTIVITY", Assignee: "analyst-1", Team: "investigations"},
			{Priority: "MEDIUM", Type: "THRESHOLD_BREACH", Assignee: "analyst-2", Team: "monitoring"},
		},
	}
}

// AutoAssign auto-assigns a case
func (w *WorkflowEngine) AutoAssign(c *AMLCase) (string, string) {
	for _, rule := range w.rules {
		if (rule.Priority == "" || rule.Priority == c.Priority) &&
			(rule.Type == "" || rule.Type == c.Type) {
			return rule.Assignee, rule.Team
		}
	}
	return "unassigned", "general"
}

// Helper functions
func generateCaseID() string {
	return fmt.Sprintf("AML-%d", time.Now().UnixNano())
}

func generateNoteID() string {
	return fmt.Sprintf("NOTE-%d", time.Now().UnixNano())
}

func generateEvidenceID() string {
	return fmt.Sprintf("EVD-%d", time.Now().UnixNano())
}

func generateSARID() string {
	return fmt.Sprintf("SAR-%d", time.Now().UnixNano())
}
