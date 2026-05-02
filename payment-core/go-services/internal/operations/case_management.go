// Package operations provides operational excellence features
// Priority 3: Case Management SLAs, Kill Switch, Operational Dashboards
package operations

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// =============================================================================
// Priority 3.1: Case Management SLAs and KPIs
// =============================================================================

// CaseManagementService provides case management with SLAs
type CaseManagementService struct {
	db            *sql.DB
	slaConfig     *SLAConfiguration
	assignmentMgr *AssignmentManager
	escalationMgr *EscalationManager
	metrics       *CaseMetrics
	notifier      CaseNotifier
	mu            sync.RWMutex
}

// SLAConfiguration defines SLA thresholds
type SLAConfiguration struct {
	// Time-based SLAs (in minutes)
	FirstResponseTime map[string]int `json:"first_response_time"` // By priority
	ResolutionTime    map[string]int `json:"resolution_time"`     // By priority
	EscalationTime    map[string]int `json:"escalation_time"`     // By priority

	// Queue-based SLAs
	MaxQueueSize   int `json:"max_queue_size"`
	MaxBacklogDays int `json:"max_backlog_days"`

	// Quality SLAs
	QASampleRate         float64 `json:"qa_sample_rate"` // Percentage to QA
	MaxFalsePositiveRate float64 `json:"max_false_positive_rate"`
	MinAccuracyRate      float64 `json:"min_accuracy_rate"`
}

// Case represents a review case
type Case struct {
	CaseID          string                 `json:"case_id"`
	CaseType        string                 `json:"case_type"` // KYC, KYB, FRAUD, AML
	Priority        string                 `json:"priority"`  // CRITICAL, HIGH, MEDIUM, LOW
	Status          CaseStatus             `json:"status"`
	CustomerID      string                 `json:"customer_id"`
	TransactionID   string                 `json:"transaction_id,omitempty"`
	Subject         string                 `json:"subject"`
	Description     string                 `json:"description"`
	RiskScore       float64                `json:"risk_score"`
	AssignedTo      string                 `json:"assigned_to"`
	AssignedAt      *time.Time             `json:"assigned_at,omitempty"`
	Queue           string                 `json:"queue"`
	Tags            []string               `json:"tags"`
	SLADeadline     time.Time              `json:"sla_deadline"`
	EscalationLevel int                    `json:"escalation_level"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	FirstResponseAt *time.Time             `json:"first_response_at,omitempty"`
	ResolvedAt      *time.Time             `json:"resolved_at,omitempty"`
	Resolution      string                 `json:"resolution,omitempty"`
	ResolutionNotes string                 `json:"resolution_notes,omitempty"`
	QAStatus        string                 `json:"qa_status,omitempty"`
	QAScore         float64                `json:"qa_score,omitempty"`
	Metadata        map[string]interface{} `json:"metadata"`
	AuditTrail      []CaseEvent            `json:"audit_trail"`
}

// CaseStatus represents case status
type CaseStatus string

const (
	CaseStatusNew        CaseStatus = "NEW"
	CaseStatusAssigned   CaseStatus = "ASSIGNED"
	CaseStatusInProgress CaseStatus = "IN_PROGRESS"
	CaseStatusPending    CaseStatus = "PENDING_INFO"
	CaseStatusEscalated  CaseStatus = "ESCALATED"
	CaseStatusResolved   CaseStatus = "RESOLVED"
	CaseStatusClosed     CaseStatus = "CLOSED"
)

// CaseEvent represents a case audit event
type CaseEvent struct {
	EventID   string    `json:"event_id"`
	EventType string    `json:"event_type"`
	UserID    string    `json:"user_id"`
	Details   string    `json:"details"`
	Timestamp time.Time `json:"timestamp"`
}

// CaseNotifier interface for case notifications
type CaseNotifier interface {
	NotifyCaseAssigned(ctx context.Context, c *Case) error
	NotifySLABreaching(ctx context.Context, c *Case) error
	NotifyCaseEscalated(ctx context.Context, c *Case) error
}

// AssignmentManager manages case assignment
type AssignmentManager struct {
	reviewers     map[string]*Reviewer
	queues        map[string]*Queue
	roundRobinIdx map[string]int
	mu            sync.RWMutex
}

// Reviewer represents a case reviewer
type Reviewer struct {
	ReviewerID  string   `json:"reviewer_id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Queues      []string `json:"queues"`
	Skills      []string `json:"skills"`
	MaxCaseload int      `json:"max_caseload"`
	CurrentLoad int      `json:"current_load"`
	Available   bool     `json:"available"`
	ShiftStart  string   `json:"shift_start"`
	ShiftEnd    string   `json:"shift_end"`
}

// Queue represents a case queue
type Queue struct {
	QueueID        string   `json:"queue_id"`
	Name           string   `json:"name"`
	CaseTypes      []string `json:"case_types"`
	Priorities     []string `json:"priorities"`
	AssignmentMode string   `json:"assignment_mode"` // ROUND_ROBIN, LEAST_LOADED, SKILL_BASED
	Reviewers      []string `json:"reviewers"`
}

// EscalationManager manages case escalations
type EscalationManager struct {
	rules []EscalationRule
	mu    sync.RWMutex
}

// EscalationRule defines an escalation rule
type EscalationRule struct {
	RuleID        string `json:"rule_id"`
	Name          string `json:"name"`
	Condition     string `json:"condition"` // SLA_BREACH, RISK_THRESHOLD, MANUAL
	Threshold     int    `json:"threshold"` // Minutes or score
	TargetLevel   int    `json:"target_level"`
	TargetQueue   string `json:"target_queue"`
	NotifyManager bool   `json:"notify_manager"`
}

// CaseMetrics tracks case management KPIs
type CaseMetrics struct {
	TotalCases           int64            `json:"total_cases"`
	OpenCases            int64            `json:"open_cases"`
	ResolvedToday        int64            `json:"resolved_today"`
	AvgResolutionTime    float64          `json:"avg_resolution_time_mins"`
	AvgFirstResponseTime float64          `json:"avg_first_response_time_mins"`
	SLAComplianceRate    float64          `json:"sla_compliance_rate"`
	EscalationRate       float64          `json:"escalation_rate"`
	FalsePositiveRate    float64          `json:"false_positive_rate"`
	QAPassRate           float64          `json:"qa_pass_rate"`
	BacklogSize          int64            `json:"backlog_size"`
	ByPriority           map[string]int64 `json:"by_priority"`
	ByStatus             map[string]int64 `json:"by_status"`
	ByQueue              map[string]int64 `json:"by_queue"`
	mu                   sync.RWMutex
}

// NewCaseManagementService creates a new case management service
func NewCaseManagementService(db *sql.DB, notifier CaseNotifier) *CaseManagementService {
	return &CaseManagementService{
		db:       db,
		notifier: notifier,
		slaConfig: &SLAConfiguration{
			FirstResponseTime: map[string]int{
				"CRITICAL": 15,
				"HIGH":     60,
				"MEDIUM":   240,
				"LOW":      480,
			},
			ResolutionTime: map[string]int{
				"CRITICAL": 60,
				"HIGH":     240,
				"MEDIUM":   1440,
				"LOW":      2880,
			},
			EscalationTime: map[string]int{
				"CRITICAL": 30,
				"HIGH":     120,
				"MEDIUM":   720,
				"LOW":      1440,
			},
			MaxQueueSize:         1000,
			MaxBacklogDays:       7,
			QASampleRate:         0.1,
			MaxFalsePositiveRate: 0.05,
			MinAccuracyRate:      0.95,
		},
		assignmentMgr: &AssignmentManager{
			reviewers:     make(map[string]*Reviewer),
			queues:        make(map[string]*Queue),
			roundRobinIdx: make(map[string]int),
		},
		escalationMgr: &EscalationManager{
			rules: []EscalationRule{
				{RuleID: "sla_breach", Name: "SLA Breach Escalation", Condition: "SLA_BREACH", TargetLevel: 1, NotifyManager: true},
				{RuleID: "high_risk", Name: "High Risk Escalation", Condition: "RISK_THRESHOLD", Threshold: 90, TargetLevel: 2, NotifyManager: true},
			},
		},
		metrics: &CaseMetrics{
			ByPriority: make(map[string]int64),
			ByStatus:   make(map[string]int64),
			ByQueue:    make(map[string]int64),
		},
	}
}

// CreateCase creates a new case
func (s *CaseManagementService) CreateCase(ctx context.Context, c *Case) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c.CaseID = fmt.Sprintf("CASE_%d", time.Now().UnixNano())
	c.Status = CaseStatusNew
	c.CreatedAt = time.Now().UTC()
	c.UpdatedAt = c.CreatedAt

	// Calculate SLA deadline
	resolutionMins := s.slaConfig.ResolutionTime[c.Priority]
	if resolutionMins == 0 {
		resolutionMins = 1440 // Default 24 hours
	}
	c.SLADeadline = c.CreatedAt.Add(time.Duration(resolutionMins) * time.Minute)

	// Add creation event
	c.AuditTrail = append(c.AuditTrail, CaseEvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "CREATED",
		UserID:    "SYSTEM",
		Details:   "Case created",
		Timestamp: c.CreatedAt,
	})

	// Auto-assign if possible
	if err := s.autoAssign(ctx, c); err != nil {
		// Log but don't fail - case can be manually assigned
	}

	// Update metrics
	atomic.AddInt64(&s.metrics.TotalCases, 1)
	atomic.AddInt64(&s.metrics.OpenCases, 1)
	s.metrics.mu.Lock()
	s.metrics.ByPriority[c.Priority]++
	s.metrics.ByStatus[string(c.Status)]++
	s.metrics.ByQueue[c.Queue]++
	s.metrics.mu.Unlock()

	return s.persistCase(ctx, c)
}

// AssignCase assigns a case to a reviewer
func (s *CaseManagementService) AssignCase(ctx context.Context, caseID, reviewerID, assignedBy string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, err := s.loadCase(ctx, caseID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	c.AssignedTo = reviewerID
	c.AssignedAt = &now
	c.Status = CaseStatusAssigned
	c.UpdatedAt = now

	c.AuditTrail = append(c.AuditTrail, CaseEvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "ASSIGNED",
		UserID:    assignedBy,
		Details:   fmt.Sprintf("Assigned to %s", reviewerID),
		Timestamp: now,
	})

	// Notify reviewer
	if s.notifier != nil {
		s.notifier.NotifyCaseAssigned(ctx, c)
	}

	return s.updateCase(ctx, c)
}

// ResolveCase resolves a case
func (s *CaseManagementService) ResolveCase(ctx context.Context, caseID, resolution, notes, resolvedBy string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, err := s.loadCase(ctx, caseID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	c.Status = CaseStatusResolved
	c.Resolution = resolution
	c.ResolutionNotes = notes
	c.ResolvedAt = &now
	c.UpdatedAt = now

	c.AuditTrail = append(c.AuditTrail, CaseEvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "RESOLVED",
		UserID:    resolvedBy,
		Details:   fmt.Sprintf("Resolved: %s", resolution),
		Timestamp: now,
	})

	// Update metrics
	atomic.AddInt64(&s.metrics.OpenCases, -1)
	atomic.AddInt64(&s.metrics.ResolvedToday, 1)

	// Check if should be QA'd
	if s.shouldQA() {
		c.QAStatus = "PENDING_QA"
	}

	return s.updateCase(ctx, c)
}

// CheckSLAs checks for SLA breaches and escalates
func (s *CaseManagementService) CheckSLAs(ctx context.Context) ([]*Case, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Find cases approaching or breaching SLA
	cases, err := s.findSLABreachingCases(ctx)
	if err != nil {
		return nil, err
	}

	var escalated []*Case
	for _, c := range cases {
		// Check if should escalate
		if time.Now().After(c.SLADeadline) {
			if err := s.escalateCase(ctx, c, "SLA_BREACH"); err != nil {
				continue
			}
			escalated = append(escalated, c)
		} else if time.Until(c.SLADeadline) < 30*time.Minute {
			// Warn about approaching SLA
			if s.notifier != nil {
				s.notifier.NotifySLABreaching(ctx, c)
			}
		}
	}

	return escalated, nil
}

// GetMetrics returns current case metrics
func (s *CaseManagementService) GetMetrics() *CaseMetrics {
	s.metrics.mu.RLock()
	defer s.metrics.mu.RUnlock()

	// Calculate rates
	if s.metrics.TotalCases > 0 {
		// These would be calculated from actual data
	}

	return s.metrics
}

// GetKPIDashboard returns KPI dashboard data
func (s *CaseManagementService) GetKPIDashboard(ctx context.Context) (*KPIDashboard, error) {
	metrics := s.GetMetrics()

	return &KPIDashboard{
		GeneratedAt:          time.Now().UTC(),
		TotalOpenCases:       metrics.OpenCases,
		ResolvedToday:        metrics.ResolvedToday,
		AvgResolutionTime:    metrics.AvgResolutionTime,
		AvgFirstResponseTime: metrics.AvgFirstResponseTime,
		SLACompliance:        metrics.SLAComplianceRate,
		EscalationRate:       metrics.EscalationRate,
		FalsePositiveRate:    metrics.FalsePositiveRate,
		QAPassRate:           metrics.QAPassRate,
		BacklogSize:          metrics.BacklogSize,
		CasesByPriority:      metrics.ByPriority,
		CasesByStatus:        metrics.ByStatus,
		CasesByQueue:         metrics.ByQueue,
	}, nil
}

// KPIDashboard represents KPI dashboard data
type KPIDashboard struct {
	GeneratedAt          time.Time        `json:"generated_at"`
	TotalOpenCases       int64            `json:"total_open_cases"`
	ResolvedToday        int64            `json:"resolved_today"`
	AvgResolutionTime    float64          `json:"avg_resolution_time_mins"`
	AvgFirstResponseTime float64          `json:"avg_first_response_time_mins"`
	SLACompliance        float64          `json:"sla_compliance_percent"`
	EscalationRate       float64          `json:"escalation_rate_percent"`
	FalsePositiveRate    float64          `json:"false_positive_rate_percent"`
	QAPassRate           float64          `json:"qa_pass_rate_percent"`
	BacklogSize          int64            `json:"backlog_size"`
	CasesByPriority      map[string]int64 `json:"cases_by_priority"`
	CasesByStatus        map[string]int64 `json:"cases_by_status"`
	CasesByQueue         map[string]int64 `json:"cases_by_queue"`
}

func (s *CaseManagementService) autoAssign(ctx context.Context, c *Case) error {
	s.assignmentMgr.mu.Lock()
	defer s.assignmentMgr.mu.Unlock()

	queue, ok := s.assignmentMgr.queues[c.Queue]
	if !ok {
		return fmt.Errorf("queue not found: %s", c.Queue)
	}

	// Find available reviewer
	var selectedReviewer *Reviewer
	switch queue.AssignmentMode {
	case "ROUND_ROBIN":
		selectedReviewer = s.roundRobinAssign(queue)
	case "LEAST_LOADED":
		selectedReviewer = s.leastLoadedAssign(queue)
	default:
		selectedReviewer = s.roundRobinAssign(queue)
	}

	if selectedReviewer != nil {
		now := time.Now().UTC()
		c.AssignedTo = selectedReviewer.ReviewerID
		c.AssignedAt = &now
		c.Status = CaseStatusAssigned
		selectedReviewer.CurrentLoad++
	}

	return nil
}

func (s *CaseManagementService) roundRobinAssign(queue *Queue) *Reviewer {
	if len(queue.Reviewers) == 0 {
		return nil
	}

	idx := s.assignmentMgr.roundRobinIdx[queue.QueueID]
	for i := 0; i < len(queue.Reviewers); i++ {
		reviewerID := queue.Reviewers[(idx+i)%len(queue.Reviewers)]
		reviewer, ok := s.assignmentMgr.reviewers[reviewerID]
		if ok && reviewer.Available && reviewer.CurrentLoad < reviewer.MaxCaseload {
			s.assignmentMgr.roundRobinIdx[queue.QueueID] = (idx + i + 1) % len(queue.Reviewers)
			return reviewer
		}
	}
	return nil
}

func (s *CaseManagementService) leastLoadedAssign(queue *Queue) *Reviewer {
	var selected *Reviewer
	minLoad := int(^uint(0) >> 1) // Max int

	for _, reviewerID := range queue.Reviewers {
		reviewer, ok := s.assignmentMgr.reviewers[reviewerID]
		if ok && reviewer.Available && reviewer.CurrentLoad < reviewer.MaxCaseload {
			if reviewer.CurrentLoad < minLoad {
				minLoad = reviewer.CurrentLoad
				selected = reviewer
			}
		}
	}
	return selected
}

func (s *CaseManagementService) escalateCase(ctx context.Context, c *Case, reason string) error {
	c.EscalationLevel++
	c.Status = CaseStatusEscalated
	c.UpdatedAt = time.Now().UTC()

	c.AuditTrail = append(c.AuditTrail, CaseEvent{
		EventID:   fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType: "ESCALATED",
		UserID:    "SYSTEM",
		Details:   fmt.Sprintf("Escalated due to %s, level %d", reason, c.EscalationLevel),
		Timestamp: time.Now().UTC(),
	})

	if s.notifier != nil {
		s.notifier.NotifyCaseEscalated(ctx, c)
	}

	return s.updateCase(ctx, c)
}

func (s *CaseManagementService) shouldQA() bool {
	// Random sampling based on QA rate
	return time.Now().UnixNano()%100 < int64(s.slaConfig.QASampleRate*100)
}

func (s *CaseManagementService) persistCase(ctx context.Context, c *Case) error {
	if s.db == nil {
		return nil
	}

	tagsJSON, _ := json.Marshal(c.Tags)
	metadataJSON, _ := json.Marshal(c.Metadata)
	auditTrailJSON, _ := json.Marshal(c.AuditTrail)

	query := `
		INSERT INTO cases (
			case_id, case_type, priority, status, customer_id, transaction_id,
			subject, description, risk_score, assigned_to, assigned_at, queue,
			tags, sla_deadline, escalation_level, created_at, updated_at,
			first_response_at, resolved_at, resolution, resolution_notes,
			qa_status, qa_score, metadata, audit_trail
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
	`

	_, err := s.db.ExecContext(ctx, query,
		c.CaseID, c.CaseType, c.Priority, c.Status, c.CustomerID, c.TransactionID,
		c.Subject, c.Description, c.RiskScore, c.AssignedTo, c.AssignedAt, c.Queue,
		tagsJSON, c.SLADeadline, c.EscalationLevel, c.CreatedAt, c.UpdatedAt,
		c.FirstResponseAt, c.ResolvedAt, c.Resolution, c.ResolutionNotes,
		c.QAStatus, c.QAScore, metadataJSON, auditTrailJSON,
	)

	return err
}

func (s *CaseManagementService) loadCase(ctx context.Context, caseID string) (*Case, error) {
	// Implementation would load from database
	return nil, fmt.Errorf("not implemented")
}

func (s *CaseManagementService) updateCase(ctx context.Context, c *Case) error {
	// Implementation would update in database
	return nil
}

func (s *CaseManagementService) findSLABreachingCases(ctx context.Context) ([]*Case, error) {
	// Implementation would query database
	return nil, nil
}

// =============================================================================
// Priority 3.2: Kill Switch & Staged Rollout
// =============================================================================

// KillSwitchService provides kill switch and staged rollout controls
type KillSwitchService struct {
	db       *sql.DB
	switches map[string]*KillSwitch
	rollouts map[string]*StagedRollout
	mu       sync.RWMutex
}

// KillSwitch represents a kill switch
type KillSwitch struct {
	SwitchID     string     `json:"switch_id"`
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	Component    string     `json:"component"` // MODEL, RULE, FEATURE, SERVICE
	Enabled      bool       `json:"enabled"`
	FallbackMode string     `json:"fallback_mode"` // RULES_ONLY, ALLOW_ALL, BLOCK_ALL, PREVIOUS_VERSION
	ActivatedAt  *time.Time `json:"activated_at,omitempty"`
	ActivatedBy  string     `json:"activated_by,omitempty"`
	Reason       string     `json:"reason,omitempty"`
	AutoRevert   bool       `json:"auto_revert"`
	RevertAfter  int        `json:"revert_after_mins"`
}

// StagedRollout represents a staged rollout configuration
type StagedRollout struct {
	RolloutID    string          `json:"rollout_id"`
	Name         string          `json:"name"`
	Component    string          `json:"component"`
	Version      string          `json:"version"`
	Status       string          `json:"status"` // PENDING, IN_PROGRESS, PAUSED, COMPLETED, ROLLED_BACK
	CurrentStage int             `json:"current_stage"`
	Stages       []RolloutStage  `json:"stages"`
	StartedAt    *time.Time      `json:"started_at,omitempty"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
	CreatedBy    string          `json:"created_by"`
	Metrics      *RolloutMetrics `json:"metrics"`
}

// RolloutStage represents a rollout stage
type RolloutStage struct {
	StageNum        int                `json:"stage_num"`
	TrafficPercent  float64            `json:"traffic_percent"`
	Duration        int                `json:"duration_mins"`
	SuccessCriteria map[string]float64 `json:"success_criteria"`
	Status          string             `json:"status"`
	StartedAt       *time.Time         `json:"started_at,omitempty"`
	CompletedAt     *time.Time         `json:"completed_at,omitempty"`
}

// RolloutMetrics tracks rollout metrics
type RolloutMetrics struct {
	TotalRequests      int64   `json:"total_requests"`
	NewVersionRequests int64   `json:"new_version_requests"`
	ErrorRate          float64 `json:"error_rate"`
	LatencyP50         float64 `json:"latency_p50_ms"`
	LatencyP99         float64 `json:"latency_p99_ms"`
	FalsePositiveRate  float64 `json:"false_positive_rate"`
}

// NewKillSwitchService creates a new kill switch service
func NewKillSwitchService(db *sql.DB) *KillSwitchService {
	svc := &KillSwitchService{
		db:       db,
		switches: make(map[string]*KillSwitch),
		rollouts: make(map[string]*StagedRollout),
	}
	svc.initializeDefaultSwitches()
	return svc
}

// initializeDefaultSwitches sets up default kill switches
func (s *KillSwitchService) initializeDefaultSwitches() {
	s.switches["fraud_model"] = &KillSwitch{
		SwitchID:     "fraud_model",
		Name:         "Fraud Model Kill Switch",
		Description:  "Disables ML fraud model and falls back to rules",
		Component:    "MODEL",
		Enabled:      false,
		FallbackMode: "RULES_ONLY",
	}
	s.switches["aml_screening"] = &KillSwitch{
		SwitchID:     "aml_screening",
		Name:         "AML Screening Kill Switch",
		Description:  "Disables AML screening",
		Component:    "SERVICE",
		Enabled:      false,
		FallbackMode: "ALLOW_ALL",
	}
	s.switches["challenger_model"] = &KillSwitch{
		SwitchID:     "challenger_model",
		Name:         "Challenger Model Kill Switch",
		Description:  "Disables challenger model traffic",
		Component:    "MODEL",
		Enabled:      false,
		FallbackMode: "PREVIOUS_VERSION",
	}
}

// ActivateKillSwitch activates a kill switch
func (s *KillSwitchService) ActivateKillSwitch(ctx context.Context, switchID, activatedBy, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sw, ok := s.switches[switchID]
	if !ok {
		return fmt.Errorf("kill switch not found: %s", switchID)
	}

	now := time.Now().UTC()
	sw.Enabled = true
	sw.ActivatedAt = &now
	sw.ActivatedBy = activatedBy
	sw.Reason = reason

	return s.persistSwitch(ctx, sw)
}

// DeactivateKillSwitch deactivates a kill switch
func (s *KillSwitchService) DeactivateKillSwitch(ctx context.Context, switchID, deactivatedBy string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sw, ok := s.switches[switchID]
	if !ok {
		return fmt.Errorf("kill switch not found: %s", switchID)
	}

	sw.Enabled = false
	sw.ActivatedAt = nil
	sw.ActivatedBy = ""
	sw.Reason = ""

	return s.persistSwitch(ctx, sw)
}

// IsKillSwitchActive checks if a kill switch is active
func (s *KillSwitchService) IsKillSwitchActive(switchID string) (bool, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sw, ok := s.switches[switchID]
	if !ok {
		return false, ""
	}

	return sw.Enabled, sw.FallbackMode
}

// CreateRollout creates a new staged rollout
func (s *KillSwitchService) CreateRollout(ctx context.Context, rollout *StagedRollout) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	rollout.RolloutID = fmt.Sprintf("rollout_%d", time.Now().UnixNano())
	rollout.Status = "PENDING"
	rollout.CurrentStage = 0

	// Default stages if not provided
	if len(rollout.Stages) == 0 {
		rollout.Stages = []RolloutStage{
			{StageNum: 1, TrafficPercent: 1, Duration: 60, Status: "PENDING"},
			{StageNum: 2, TrafficPercent: 5, Duration: 120, Status: "PENDING"},
			{StageNum: 3, TrafficPercent: 25, Duration: 240, Status: "PENDING"},
			{StageNum: 4, TrafficPercent: 50, Duration: 480, Status: "PENDING"},
			{StageNum: 5, TrafficPercent: 100, Duration: 0, Status: "PENDING"},
		}
	}

	s.rollouts[rollout.RolloutID] = rollout
	return s.persistRollout(ctx, rollout)
}

// AdvanceRollout advances to the next rollout stage
func (s *KillSwitchService) AdvanceRollout(ctx context.Context, rolloutID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	rollout, ok := s.rollouts[rolloutID]
	if !ok {
		return fmt.Errorf("rollout not found: %s", rolloutID)
	}

	if rollout.CurrentStage >= len(rollout.Stages) {
		return fmt.Errorf("rollout already completed")
	}

	// Check success criteria for current stage
	if rollout.CurrentStage > 0 {
		if !s.checkSuccessCriteria(rollout) {
			return fmt.Errorf("success criteria not met for current stage")
		}
		now := time.Now().UTC()
		rollout.Stages[rollout.CurrentStage-1].CompletedAt = &now
	}

	// Advance to next stage
	rollout.CurrentStage++
	if rollout.CurrentStage <= len(rollout.Stages) {
		now := time.Now().UTC()
		rollout.Stages[rollout.CurrentStage-1].Status = "IN_PROGRESS"
		rollout.Stages[rollout.CurrentStage-1].StartedAt = &now
		rollout.Status = "IN_PROGRESS"
	} else {
		now := time.Now().UTC()
		rollout.Status = "COMPLETED"
		rollout.CompletedAt = &now
	}

	return s.persistRollout(ctx, rollout)
}

// RollbackRollout rolls back a rollout
func (s *KillSwitchService) RollbackRollout(ctx context.Context, rolloutID, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	rollout, ok := s.rollouts[rolloutID]
	if !ok {
		return fmt.Errorf("rollout not found: %s", rolloutID)
	}

	rollout.Status = "ROLLED_BACK"
	now := time.Now().UTC()
	rollout.CompletedAt = &now

	// Activate kill switch for the component
	if sw, ok := s.switches[rollout.Component+"_model"]; ok {
		sw.Enabled = true
		sw.ActivatedAt = &now
		sw.Reason = fmt.Sprintf("Rollout %s rolled back: %s", rolloutID, reason)
	}

	return s.persistRollout(ctx, rollout)
}

// GetTrafficPercent returns the current traffic percentage for a rollout
func (s *KillSwitchService) GetTrafficPercent(rolloutID string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rollout, ok := s.rollouts[rolloutID]
	if !ok || rollout.Status != "IN_PROGRESS" {
		return 0
	}

	if rollout.CurrentStage > 0 && rollout.CurrentStage <= len(rollout.Stages) {
		return rollout.Stages[rollout.CurrentStage-1].TrafficPercent
	}

	return 0
}

func (s *KillSwitchService) checkSuccessCriteria(rollout *StagedRollout) bool {
	if rollout.Metrics == nil {
		return true // No metrics to check
	}

	stage := rollout.Stages[rollout.CurrentStage-1]
	for metric, threshold := range stage.SuccessCriteria {
		switch metric {
		case "error_rate":
			if rollout.Metrics.ErrorRate > threshold {
				return false
			}
		case "latency_p99":
			if rollout.Metrics.LatencyP99 > threshold {
				return false
			}
		case "false_positive_rate":
			if rollout.Metrics.FalsePositiveRate > threshold {
				return false
			}
		}
	}
	return true
}

func (s *KillSwitchService) persistSwitch(ctx context.Context, sw *KillSwitch) error {
	// Implementation would persist to database
	return nil
}

func (s *KillSwitchService) persistRollout(ctx context.Context, rollout *StagedRollout) error {
	// Implementation would persist to database
	return nil
}

// =============================================================================
// Database Schema
// =============================================================================

// OperationsSchema returns the database schema for operations components
func OperationsSchema() string {
	return `
	-- Cases table
	CREATE TABLE IF NOT EXISTS cases (
		case_id VARCHAR(128) PRIMARY KEY,
		case_type VARCHAR(64) NOT NULL,
		priority VARCHAR(16) NOT NULL,
		status VARCHAR(32) NOT NULL,
		customer_id VARCHAR(128) NOT NULL,
		transaction_id VARCHAR(128),
		subject VARCHAR(512),
		description TEXT,
		risk_score DECIMAL(5,4),
		assigned_to VARCHAR(128),
		assigned_at TIMESTAMP,
		queue VARCHAR(64),
		tags JSONB,
		sla_deadline TIMESTAMP NOT NULL,
		escalation_level INTEGER DEFAULT 0,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		first_response_at TIMESTAMP,
		resolved_at TIMESTAMP,
		resolution VARCHAR(64),
		resolution_notes TEXT,
		qa_status VARCHAR(32),
		qa_score DECIMAL(5,4),
		metadata JSONB,
		audit_trail JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_case_status ON cases(status);
	CREATE INDEX IF NOT EXISTS idx_case_priority ON cases(priority);
	CREATE INDEX IF NOT EXISTS idx_case_assigned ON cases(assigned_to);
	CREATE INDEX IF NOT EXISTS idx_case_queue ON cases(queue);
	CREATE INDEX IF NOT EXISTS idx_case_sla ON cases(sla_deadline);
	CREATE INDEX IF NOT EXISTS idx_case_customer ON cases(customer_id);

	-- Kill switches
	CREATE TABLE IF NOT EXISTS kill_switches (
		switch_id VARCHAR(128) PRIMARY KEY,
		name VARCHAR(256) NOT NULL,
		description TEXT,
		component VARCHAR(64) NOT NULL,
		enabled BOOLEAN DEFAULT FALSE,
		fallback_mode VARCHAR(32),
		activated_at TIMESTAMP,
		activated_by VARCHAR(128),
		reason TEXT,
		auto_revert BOOLEAN DEFAULT FALSE,
		revert_after_mins INTEGER
	);

	-- Staged rollouts
	CREATE TABLE IF NOT EXISTS staged_rollouts (
		rollout_id VARCHAR(128) PRIMARY KEY,
		name VARCHAR(256) NOT NULL,
		component VARCHAR(64) NOT NULL,
		version VARCHAR(64) NOT NULL,
		status VARCHAR(32) NOT NULL,
		current_stage INTEGER DEFAULT 0,
		stages JSONB NOT NULL,
		started_at TIMESTAMP,
		completed_at TIMESTAMP,
		created_by VARCHAR(128) NOT NULL,
		metrics JSONB
	);
	CREATE INDEX IF NOT EXISTS idx_rollout_status ON staged_rollouts(status);
	CREATE INDEX IF NOT EXISTS idx_rollout_component ON staged_rollouts(component);

	-- Reviewers
	CREATE TABLE IF NOT EXISTS reviewers (
		reviewer_id VARCHAR(128) PRIMARY KEY,
		name VARCHAR(256) NOT NULL,
		email VARCHAR(256) NOT NULL,
		queues JSONB,
		skills JSONB,
		max_caseload INTEGER DEFAULT 20,
		current_load INTEGER DEFAULT 0,
		available BOOLEAN DEFAULT TRUE,
		shift_start VARCHAR(8),
		shift_end VARCHAR(8)
	);

	-- Queues
	CREATE TABLE IF NOT EXISTS queues (
		queue_id VARCHAR(128) PRIMARY KEY,
		name VARCHAR(256) NOT NULL,
		case_types JSONB,
		priorities JSONB,
		assignment_mode VARCHAR(32) DEFAULT 'ROUND_ROBIN',
		reviewers JSONB
	);
	`
}
