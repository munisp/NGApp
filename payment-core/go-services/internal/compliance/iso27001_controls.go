// Package compliance implements ISO 27001 compliance controls for PayGate
package compliance

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// ISO27001ControlFramework implements ISO 27001 Information Security Management System
type ISO27001ControlFramework struct {
	// Risk Assessment
	riskAssessment *RiskAssessmentFramework
	
	// Access Control (A.9)
	accessControl *AccessControlPolicy
	
	// Audit Logging (A.12.4)
	auditLogger *ComplianceAuditLogger
	
	// Incident Response (A.16)
	incidentResponse *IncidentResponseManager
	
	// Asset Management (A.8)
	assetInventory *AssetInventory
	
	// Cryptography (A.10)
	cryptoPolicy *CryptographyPolicy
	
	// Configuration
	config ISO27001Config
	
	mu sync.RWMutex
}

// ISO27001Config configures the compliance framework
type ISO27001Config struct {
	OrganizationName     string
	ISMSScope            string
	RiskAppetite         float64
	AuditRetentionDays   int
	IncidentSLAMinutes   int
	ReviewIntervalDays   int
}

// DefaultISO27001Config returns default configuration
func DefaultISO27001Config() ISO27001Config {
	return ISO27001Config{
		OrganizationName:   "PayGate",
		ISMSScope:          "Payment Processing Platform",
		RiskAppetite:       0.3,
		AuditRetentionDays: 2555, // 7 years
		IncidentSLAMinutes: 60,
		ReviewIntervalDays: 90,
	}
}

// NewISO27001ControlFramework creates a new ISO 27001 control framework
func NewISO27001ControlFramework(config ISO27001Config) *ISO27001ControlFramework {
	return &ISO27001ControlFramework{
		riskAssessment:   NewRiskAssessmentFramework(config.RiskAppetite),
		accessControl:    NewAccessControlPolicy(),
		auditLogger:      NewComplianceAuditLogger(config.AuditRetentionDays),
		incidentResponse: NewIncidentResponseManager(config.IncidentSLAMinutes),
		assetInventory:   NewAssetInventory(),
		cryptoPolicy:     NewCryptographyPolicy(),
		config:           config,
	}
}

// ============================================================================
// A.6 - Risk Assessment Framework
// ============================================================================

// RiskAssessmentFramework implements ISO 27001 risk assessment
type RiskAssessmentFramework struct {
	risks        map[string]*Risk
	treatments   map[string]*RiskTreatment
	riskAppetite float64
	mu           sync.RWMutex
}

// Risk represents an identified risk
type Risk struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	Category        string                 `json:"category"` // operational, technical, compliance, strategic
	Asset           string                 `json:"asset"`
	Threat          string                 `json:"threat"`
	Vulnerability   string                 `json:"vulnerability"`
	
	// Risk scoring
	Likelihood      float64                `json:"likelihood"`      // 0-1
	Impact          float64                `json:"impact"`          // 0-1
	InherentRisk    float64                `json:"inherent_risk"`   // likelihood * impact
	
	// Controls
	Controls        []string               `json:"controls"`
	ControlEffectiveness float64           `json:"control_effectiveness"` // 0-1
	ResidualRisk    float64                `json:"residual_risk"`
	
	// Treatment
	TreatmentID     string                 `json:"treatment_id,omitempty"`
	Status          string                 `json:"status"` // identified, assessed, treated, accepted, closed
	
	// Metadata
	Owner           string                 `json:"owner"`
	ReviewDate      time.Time              `json:"review_date"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	Attributes      map[string]string      `json:"attributes"`
}

// RiskTreatment represents a risk treatment plan
type RiskTreatment struct {
	ID              string    `json:"id"`
	RiskID          string    `json:"risk_id"`
	Type            string    `json:"type"` // mitigate, transfer, accept, avoid
	Description     string    `json:"description"`
	Actions         []TreatmentAction `json:"actions"`
	TargetRisk      float64   `json:"target_risk"`
	Status          string    `json:"status"` // planned, in_progress, completed
	Owner           string    `json:"owner"`
	DueDate         time.Time `json:"due_date"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
}

// TreatmentAction represents an action in a treatment plan
type TreatmentAction struct {
	ID          string    `json:"id"`
	Description string    `json:"description"`
	Owner       string    `json:"owner"`
	DueDate     time.Time `json:"due_date"`
	Status      string    `json:"status"`
	Evidence    string    `json:"evidence,omitempty"`
}

// NewRiskAssessmentFramework creates a new risk assessment framework
func NewRiskAssessmentFramework(riskAppetite float64) *RiskAssessmentFramework {
	return &RiskAssessmentFramework{
		risks:        make(map[string]*Risk),
		treatments:   make(map[string]*RiskTreatment),
		riskAppetite: riskAppetite,
	}
}

// IdentifyRisk identifies a new risk
func (r *RiskAssessmentFramework) IdentifyRisk(risk *Risk) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	risk.ID = generateRiskID()
	risk.Status = "identified"
	risk.CreatedAt = time.Now()
	risk.UpdatedAt = time.Now()
	
	r.risks[risk.ID] = risk
	return nil
}

// AssessRisk assesses a risk's likelihood and impact
func (r *RiskAssessmentFramework) AssessRisk(riskID string, likelihood, impact float64, controls []string, controlEffectiveness float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	risk, ok := r.risks[riskID]
	if !ok {
		return fmt.Errorf("risk not found: %s", riskID)
	}
	
	risk.Likelihood = likelihood
	risk.Impact = impact
	risk.InherentRisk = likelihood * impact
	risk.Controls = controls
	risk.ControlEffectiveness = controlEffectiveness
	risk.ResidualRisk = risk.InherentRisk * (1 - controlEffectiveness)
	risk.Status = "assessed"
	risk.UpdatedAt = time.Now()
	
	return nil
}

// TreatRisk creates a treatment plan for a risk
func (r *RiskAssessmentFramework) TreatRisk(riskID string, treatment *RiskTreatment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	risk, ok := r.risks[riskID]
	if !ok {
		return fmt.Errorf("risk not found: %s", riskID)
	}
	
	treatment.ID = generateTreatmentID()
	treatment.RiskID = riskID
	treatment.Status = "planned"
	
	r.treatments[treatment.ID] = treatment
	risk.TreatmentID = treatment.ID
	risk.Status = "treated"
	risk.UpdatedAt = time.Now()
	
	return nil
}

// GetRiskRegister returns all risks
func (r *RiskAssessmentFramework) GetRiskRegister() []*Risk {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	risks := make([]*Risk, 0, len(r.risks))
	for _, risk := range r.risks {
		risks = append(risks, risk)
	}
	return risks
}

// GetRisksAboveAppetite returns risks above risk appetite
func (r *RiskAssessmentFramework) GetRisksAboveAppetite() []*Risk {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	var risks []*Risk
	for _, risk := range r.risks {
		if risk.ResidualRisk > r.riskAppetite {
			risks = append(risks, risk)
		}
	}
	return risks
}

// generateRiskID generates a unique risk ID
func generateRiskID() string {
	data := fmt.Sprintf("risk-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "RISK-" + hex.EncodeToString(hash[:8])
}

// generateTreatmentID generates a unique treatment ID
func generateTreatmentID() string {
	data := fmt.Sprintf("treatment-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "TRT-" + hex.EncodeToString(hash[:8])
}

// ============================================================================
// A.9 - Access Control Policy
// ============================================================================

// AccessControlPolicy implements ISO 27001 A.9 access control
type AccessControlPolicy struct {
	policies     map[string]*AccessPolicy
	roles        map[string]*Role
	permissions  map[string]*Permission
	assignments  map[string][]string // user -> roles
	mu           sync.RWMutex
}

// AccessPolicy represents an access control policy
type AccessPolicy struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	Type            string    `json:"type"` // rbac, abac, mandatory
	Rules           []AccessRule `json:"rules"`
	EnforcementMode string    `json:"enforcement_mode"` // enforce, audit
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	ReviewDate      time.Time `json:"review_date"`
}

// AccessRule represents an access control rule
type AccessRule struct {
	ID          string            `json:"id"`
	Subject     string            `json:"subject"`     // role, user, group pattern
	Resource    string            `json:"resource"`    // resource pattern
	Action      string            `json:"action"`      // action pattern
	Effect      string            `json:"effect"`      // allow, deny
	Conditions  map[string]string `json:"conditions"`
	Priority    int               `json:"priority"`
}

// Role represents a security role
type Role struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	ParentRoles []string `json:"parent_roles"` // role inheritance
	CreatedAt   time.Time `json:"created_at"`
}

// Permission represents a permission
type Permission struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
	Description string `json:"description"`
}

// NewAccessControlPolicy creates a new access control policy manager
func NewAccessControlPolicy() *AccessControlPolicy {
	acp := &AccessControlPolicy{
		policies:    make(map[string]*AccessPolicy),
		roles:       make(map[string]*Role),
		permissions: make(map[string]*Permission),
		assignments: make(map[string][]string),
	}
	
	// Initialize default roles
	acp.initializeDefaultRoles()
	
	return acp
}

// initializeDefaultRoles creates default security roles
func (a *AccessControlPolicy) initializeDefaultRoles() {
	// Super Admin
	a.roles["super_admin"] = &Role{
		ID:          "super_admin",
		Name:        "Super Administrator",
		Description: "Full system access",
		Permissions: []string{"*"},
		CreatedAt:   time.Now(),
	}
	
	// Security Admin
	a.roles["security_admin"] = &Role{
		ID:          "security_admin",
		Name:        "Security Administrator",
		Description: "Security configuration and audit access",
		Permissions: []string{
			"security:*",
			"audit:read",
			"users:read",
			"roles:*",
		},
		CreatedAt: time.Now(),
	}
	
	// Compliance Officer
	a.roles["compliance_officer"] = &Role{
		ID:          "compliance_officer",
		Name:        "Compliance Officer",
		Description: "Compliance monitoring and reporting",
		Permissions: []string{
			"audit:read",
			"compliance:*",
			"reports:read",
			"risks:read",
		},
		CreatedAt: time.Now(),
	}
	
	// Operations
	a.roles["operations"] = &Role{
		ID:          "operations",
		Name:        "Operations",
		Description: "Day-to-day operations",
		Permissions: []string{
			"transactions:read",
			"settlements:read",
			"participants:read",
			"monitoring:read",
		},
		CreatedAt: time.Now(),
	}
	
	// Read Only
	a.roles["read_only"] = &Role{
		ID:          "read_only",
		Name:        "Read Only",
		Description: "Read-only access to non-sensitive data",
		Permissions: []string{
			"dashboard:read",
			"reports:read",
		},
		CreatedAt: time.Now(),
	}
}

// AssignRole assigns a role to a user
func (a *AccessControlPolicy) AssignRole(userID, roleID string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	
	if _, ok := a.roles[roleID]; !ok {
		return fmt.Errorf("role not found: %s", roleID)
	}
	
	roles := a.assignments[userID]
	for _, r := range roles {
		if r == roleID {
			return nil // Already assigned
		}
	}
	
	a.assignments[userID] = append(roles, roleID)
	return nil
}

// RevokeRole revokes a role from a user
func (a *AccessControlPolicy) RevokeRole(userID, roleID string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	
	roles := a.assignments[userID]
	for i, r := range roles {
		if r == roleID {
			a.assignments[userID] = append(roles[:i], roles[i+1:]...)
			return nil
		}
	}
	
	return fmt.Errorf("role not assigned to user")
}

// CheckAccess checks if a user has access to a resource
func (a *AccessControlPolicy) CheckAccess(userID, resource, action string) (bool, string) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	
	roles := a.assignments[userID]
	if len(roles) == 0 {
		return false, "no roles assigned"
	}
	
	// Check each role's permissions
	for _, roleID := range roles {
		role, ok := a.roles[roleID]
		if !ok {
			continue
		}
		
		for _, perm := range role.Permissions {
			if perm == "*" || matchPermission(perm, resource, action) {
				return true, fmt.Sprintf("allowed by role: %s", roleID)
			}
		}
	}
	
	return false, "no matching permission"
}

// matchPermission checks if a permission matches resource:action
func matchPermission(permission, resource, action string) bool {
	// Format: resource:action or resource:*
	if permission == resource+":"+action {
		return true
	}
	if permission == resource+":*" {
		return true
	}
	return false
}

// ============================================================================
// A.12.4 - Compliance Audit Logger
// ============================================================================

// ComplianceAuditLogger implements ISO 27001 A.12.4 logging
type ComplianceAuditLogger struct {
	events        []ComplianceAuditEvent
	retentionDays int
	mu            sync.RWMutex
}

// ComplianceAuditEvent represents a compliance audit event
type ComplianceAuditEvent struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	EventType     string                 `json:"event_type"`
	Category      string                 `json:"category"` // access, change, security, compliance
	Severity      string                 `json:"severity"` // info, warning, critical
	
	// Actor
	ActorID       string                 `json:"actor_id"`
	ActorType     string                 `json:"actor_type"` // user, service, system
	ActorIP       string                 `json:"actor_ip"`
	
	// Action
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id"`
	Outcome       string                 `json:"outcome"` // success, failure
	
	// Details
	Details       map[string]interface{} `json:"details"`
	PreviousState interface{}            `json:"previous_state,omitempty"`
	NewState      interface{}            `json:"new_state,omitempty"`
	
	// Integrity
	Hash          string                 `json:"hash"`
	PreviousHash  string                 `json:"previous_hash"`
	
	// Compliance
	ControlRef    string                 `json:"control_ref,omitempty"` // ISO 27001 control reference
	Justification string                 `json:"justification,omitempty"`
}

// NewComplianceAuditLogger creates a new compliance audit logger
func NewComplianceAuditLogger(retentionDays int) *ComplianceAuditLogger {
	return &ComplianceAuditLogger{
		events:        make([]ComplianceAuditEvent, 0),
		retentionDays: retentionDays,
	}
}

// LogEvent logs a compliance audit event
func (l *ComplianceAuditLogger) LogEvent(ctx context.Context, event *ComplianceAuditEvent) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	
	// Generate ID
	event.ID = generateAuditID()
	event.Timestamp = time.Now()
	
	// Get previous hash for chain integrity
	if len(l.events) > 0 {
		event.PreviousHash = l.events[len(l.events)-1].Hash
	} else {
		event.PreviousHash = "genesis"
	}
	
	// Compute hash
	event.Hash = computeEventHash(event)
	
	l.events = append(l.events, *event)
	
	return nil
}

// LogAccessEvent logs an access control event
func (l *ComplianceAuditLogger) LogAccessEvent(ctx context.Context, actorID, actorIP, resource, action, outcome string) error {
	return l.LogEvent(ctx, &ComplianceAuditEvent{
		EventType:  "access",
		Category:   "access",
		Severity:   getSeverityForOutcome(outcome),
		ActorID:    actorID,
		ActorType:  "user",
		ActorIP:    actorIP,
		Action:     action,
		Resource:   resource,
		Outcome:    outcome,
		ControlRef: "A.9.4",
	})
}

// LogChangeEvent logs a configuration change event
func (l *ComplianceAuditLogger) LogChangeEvent(ctx context.Context, actorID, resource string, previousState, newState interface{}, justification string) error {
	return l.LogEvent(ctx, &ComplianceAuditEvent{
		EventType:     "change",
		Category:      "change",
		Severity:      "warning",
		ActorID:       actorID,
		ActorType:     "user",
		Action:        "modify",
		Resource:      resource,
		Outcome:       "success",
		PreviousState: previousState,
		NewState:      newState,
		Justification: justification,
		ControlRef:    "A.12.1",
	})
}

// LogSecurityEvent logs a security event
func (l *ComplianceAuditLogger) LogSecurityEvent(ctx context.Context, eventType, severity string, details map[string]interface{}) error {
	return l.LogEvent(ctx, &ComplianceAuditEvent{
		EventType:  eventType,
		Category:   "security",
		Severity:   severity,
		ActorType:  "system",
		Action:     eventType,
		Outcome:    "detected",
		Details:    details,
		ControlRef: "A.16.1",
	})
}

// GetEvents retrieves audit events with filters
func (l *ComplianceAuditLogger) GetEvents(startTime, endTime time.Time, category, severity string, limit int) []ComplianceAuditEvent {
	l.mu.RLock()
	defer l.mu.RUnlock()
	
	var filtered []ComplianceAuditEvent
	
	for _, event := range l.events {
		if event.Timestamp.Before(startTime) || event.Timestamp.After(endTime) {
			continue
		}
		if category != "" && event.Category != category {
			continue
		}
		if severity != "" && event.Severity != severity {
			continue
		}
		
		filtered = append(filtered, event)
		
		if limit > 0 && len(filtered) >= limit {
			break
		}
	}
	
	return filtered
}

// VerifyIntegrity verifies the integrity of the audit log chain
func (l *ComplianceAuditLogger) VerifyIntegrity() (bool, []string) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	
	var issues []string
	
	for i, event := range l.events {
		// Verify hash
		computedHash := computeEventHash(&event)
		if computedHash != event.Hash {
			issues = append(issues, fmt.Sprintf("hash mismatch at event %s", event.ID))
		}
		
		// Verify chain
		if i > 0 {
			if event.PreviousHash != l.events[i-1].Hash {
				issues = append(issues, fmt.Sprintf("chain broken at event %s", event.ID))
			}
		}
	}
	
	return len(issues) == 0, issues
}

// generateAuditID generates a unique audit ID
func generateAuditID() string {
	data := fmt.Sprintf("audit-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "AUD-" + hex.EncodeToString(hash[:8])
}

// computeEventHash computes hash for an audit event
func computeEventHash(event *ComplianceAuditEvent) string {
	data := fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s",
		event.Timestamp.Format(time.RFC3339Nano),
		event.EventType,
		event.ActorID,
		event.Action,
		event.Resource,
		event.Outcome,
		event.PreviousHash,
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// getSeverityForOutcome returns severity based on outcome
func getSeverityForOutcome(outcome string) string {
	if outcome == "failure" {
		return "warning"
	}
	return "info"
}

// ============================================================================
// A.16 - Incident Response Manager
// ============================================================================

// IncidentResponseManager implements ISO 27001 A.16 incident management
type IncidentResponseManager struct {
	incidents    map[string]*SecurityIncident
	slaMinutes   int
	mu           sync.RWMutex
}

// SecurityIncident represents a security incident
type SecurityIncident struct {
	ID              string                 `json:"id"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Type            string                 `json:"type"` // breach, malware, unauthorized_access, data_loss, etc.
	Severity        string                 `json:"severity"` // critical, high, medium, low
	Status          string                 `json:"status"` // open, investigating, contained, resolved, closed
	
	// Timeline
	DetectedAt      time.Time              `json:"detected_at"`
	ReportedAt      time.Time              `json:"reported_at"`
	AcknowledgedAt  *time.Time             `json:"acknowledged_at,omitempty"`
	ContainedAt     *time.Time             `json:"contained_at,omitempty"`
	ResolvedAt      *time.Time             `json:"resolved_at,omitempty"`
	ClosedAt        *time.Time             `json:"closed_at,omitempty"`
	
	// Assignment
	Reporter        string                 `json:"reporter"`
	Assignee        string                 `json:"assignee"`
	Team            string                 `json:"team"`
	
	// Impact
	AffectedSystems []string               `json:"affected_systems"`
	AffectedUsers   int                    `json:"affected_users"`
	DataCompromised bool                   `json:"data_compromised"`
	FinancialImpact float64                `json:"financial_impact"`
	
	// Response
	Actions         []IncidentAction       `json:"actions"`
	RootCause       string                 `json:"root_cause,omitempty"`
	LessonsLearned  string                 `json:"lessons_learned,omitempty"`
	
	// Evidence
	Evidence        []IncidentEvidence     `json:"evidence"`
	
	// Compliance
	NotificationRequired bool              `json:"notification_required"`
	NotificationSent     bool              `json:"notification_sent"`
	RegulatoryReport     string            `json:"regulatory_report,omitempty"`
}

// IncidentAction represents an action taken during incident response
type IncidentAction struct {
	ID          string    `json:"id"`
	Action      string    `json:"action"`
	Description string    `json:"description"`
	PerformedBy string    `json:"performed_by"`
	PerformedAt time.Time `json:"performed_at"`
	Result      string    `json:"result"`
}

// IncidentEvidence represents evidence collected during incident
type IncidentEvidence struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // log, screenshot, memory_dump, etc.
	Description string    `json:"description"`
	Location    string    `json:"location"`
	CollectedBy string    `json:"collected_by"`
	CollectedAt time.Time `json:"collected_at"`
	Hash        string    `json:"hash"` // For integrity verification
}

// NewIncidentResponseManager creates a new incident response manager
func NewIncidentResponseManager(slaMinutes int) *IncidentResponseManager {
	return &IncidentResponseManager{
		incidents:  make(map[string]*SecurityIncident),
		slaMinutes: slaMinutes,
	}
}

// ReportIncident reports a new security incident
func (m *IncidentResponseManager) ReportIncident(incident *SecurityIncident) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	incident.ID = generateIncidentID()
	incident.Status = "open"
	incident.ReportedAt = time.Now()
	if incident.DetectedAt.IsZero() {
		incident.DetectedAt = time.Now()
	}
	
	m.incidents[incident.ID] = incident
	
	return nil
}

// AcknowledgeIncident acknowledges an incident
func (m *IncidentResponseManager) AcknowledgeIncident(incidentID, assignee string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	incident, ok := m.incidents[incidentID]
	if !ok {
		return fmt.Errorf("incident not found: %s", incidentID)
	}
	
	now := time.Now()
	incident.AcknowledgedAt = &now
	incident.Assignee = assignee
	incident.Status = "investigating"
	
	return nil
}

// AddAction adds an action to an incident
func (m *IncidentResponseManager) AddAction(incidentID string, action *IncidentAction) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	incident, ok := m.incidents[incidentID]
	if !ok {
		return fmt.Errorf("incident not found: %s", incidentID)
	}
	
	action.ID = generateActionID()
	action.PerformedAt = time.Now()
	incident.Actions = append(incident.Actions, *action)
	
	return nil
}

// ContainIncident marks an incident as contained
func (m *IncidentResponseManager) ContainIncident(incidentID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	incident, ok := m.incidents[incidentID]
	if !ok {
		return fmt.Errorf("incident not found: %s", incidentID)
	}
	
	now := time.Now()
	incident.ContainedAt = &now
	incident.Status = "contained"
	
	return nil
}

// ResolveIncident resolves an incident
func (m *IncidentResponseManager) ResolveIncident(incidentID, rootCause, lessonsLearned string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	incident, ok := m.incidents[incidentID]
	if !ok {
		return fmt.Errorf("incident not found: %s", incidentID)
	}
	
	now := time.Now()
	incident.ResolvedAt = &now
	incident.Status = "resolved"
	incident.RootCause = rootCause
	incident.LessonsLearned = lessonsLearned
	
	return nil
}

// GetOpenIncidents returns all open incidents
func (m *IncidentResponseManager) GetOpenIncidents() []*SecurityIncident {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var open []*SecurityIncident
	for _, incident := range m.incidents {
		if incident.Status != "closed" && incident.Status != "resolved" {
			open = append(open, incident)
		}
	}
	return open
}

// GetSLABreaches returns incidents that breached SLA
func (m *IncidentResponseManager) GetSLABreaches() []*SecurityIncident {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var breaches []*SecurityIncident
	sla := time.Duration(m.slaMinutes) * time.Minute
	
	for _, incident := range m.incidents {
		if incident.AcknowledgedAt == nil {
			if time.Since(incident.ReportedAt) > sla {
				breaches = append(breaches, incident)
			}
		} else {
			if incident.AcknowledgedAt.Sub(incident.ReportedAt) > sla {
				breaches = append(breaches, incident)
			}
		}
	}
	return breaches
}

// generateIncidentID generates a unique incident ID
func generateIncidentID() string {
	data := fmt.Sprintf("incident-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "INC-" + hex.EncodeToString(hash[:8])
}

// generateActionID generates a unique action ID
func generateActionID() string {
	data := fmt.Sprintf("action-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "ACT-" + hex.EncodeToString(hash[:8])
}

// ============================================================================
// A.8 - Asset Inventory
// ============================================================================

// AssetInventory implements ISO 27001 A.8 asset management
type AssetInventory struct {
	assets map[string]*Asset
	mu     sync.RWMutex
}

// Asset represents an information asset
type Asset struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Type            string            `json:"type"` // hardware, software, data, service, personnel
	Classification  string            `json:"classification"` // public, internal, confidential, restricted
	Owner           string            `json:"owner"`
	Custodian       string            `json:"custodian"`
	Location        string            `json:"location"`
	
	// Value
	BusinessValue   string            `json:"business_value"` // critical, high, medium, low
	
	// Lifecycle
	Status          string            `json:"status"` // active, retired, planned
	AcquiredAt      time.Time         `json:"acquired_at"`
	RetiredAt       *time.Time        `json:"retired_at,omitempty"`
	ReviewDate      time.Time         `json:"review_date"`
	
	// Dependencies
	Dependencies    []string          `json:"dependencies"`
	DependentAssets []string          `json:"dependent_assets"`
	
	// Security
	SecurityControls []string         `json:"security_controls"`
	RiskAssessments  []string         `json:"risk_assessments"`
	
	// Metadata
	Tags            []string          `json:"tags"`
	Attributes      map[string]string `json:"attributes"`
}

// NewAssetInventory creates a new asset inventory
func NewAssetInventory() *AssetInventory {
	return &AssetInventory{
		assets: make(map[string]*Asset),
	}
}

// RegisterAsset registers a new asset
func (i *AssetInventory) RegisterAsset(asset *Asset) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	
	asset.ID = generateAssetID()
	asset.Status = "active"
	asset.AcquiredAt = time.Now()
	asset.ReviewDate = time.Now().AddDate(0, 0, 90) // Review in 90 days
	
	i.assets[asset.ID] = asset
	return nil
}

// GetAsset retrieves an asset by ID
func (i *AssetInventory) GetAsset(assetID string) (*Asset, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	
	asset, ok := i.assets[assetID]
	if !ok {
		return nil, fmt.Errorf("asset not found: %s", assetID)
	}
	return asset, nil
}

// GetAssetsByClassification returns assets by classification
func (i *AssetInventory) GetAssetsByClassification(classification string) []*Asset {
	i.mu.RLock()
	defer i.mu.RUnlock()
	
	var assets []*Asset
	for _, asset := range i.assets {
		if asset.Classification == classification {
			assets = append(assets, asset)
		}
	}
	return assets
}

// GetAssetsNeedingReview returns assets needing review
func (i *AssetInventory) GetAssetsNeedingReview() []*Asset {
	i.mu.RLock()
	defer i.mu.RUnlock()
	
	var assets []*Asset
	now := time.Now()
	for _, asset := range i.assets {
		if asset.ReviewDate.Before(now) {
			assets = append(assets, asset)
		}
	}
	return assets
}

// generateAssetID generates a unique asset ID
func generateAssetID() string {
	data := fmt.Sprintf("asset-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "AST-" + hex.EncodeToString(hash[:8])
}

// ============================================================================
// A.10 - Cryptography Policy
// ============================================================================

// CryptographyPolicy implements ISO 27001 A.10 cryptographic controls
type CryptographyPolicy struct {
	algorithms    map[string]*CryptoAlgorithm
	keyInventory  map[string]*CryptoKey
	mu            sync.RWMutex
}

// CryptoAlgorithm represents an approved cryptographic algorithm
type CryptoAlgorithm struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"` // symmetric, asymmetric, hash, kdf
	KeySizes    []int    `json:"key_sizes"`
	Approved    bool     `json:"approved"`
	Deprecated  bool     `json:"deprecated"`
	UseCases    []string `json:"use_cases"`
}

// CryptoKey represents a cryptographic key
type CryptoKey struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Algorithm     string    `json:"algorithm"`
	KeySize       int       `json:"key_size"`
	Purpose       string    `json:"purpose"` // encryption, signing, key_exchange
	Owner         string    `json:"owner"`
	Status        string    `json:"status"` // active, rotated, revoked, expired
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	RotatedAt     *time.Time `json:"rotated_at,omitempty"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty"`
	StorageLocation string  `json:"storage_location"` // hsm, vault, kms
}

// NewCryptographyPolicy creates a new cryptography policy
func NewCryptographyPolicy() *CryptographyPolicy {
	cp := &CryptographyPolicy{
		algorithms:   make(map[string]*CryptoAlgorithm),
		keyInventory: make(map[string]*CryptoKey),
	}
	
	// Initialize approved algorithms
	cp.initializeApprovedAlgorithms()
	
	return cp
}

// initializeApprovedAlgorithms sets up approved cryptographic algorithms
func (c *CryptographyPolicy) initializeApprovedAlgorithms() {
	// Symmetric encryption
	c.algorithms["aes-256-gcm"] = &CryptoAlgorithm{
		ID:       "aes-256-gcm",
		Name:     "AES-256-GCM",
		Type:     "symmetric",
		KeySizes: []int{256},
		Approved: true,
		UseCases: []string{"data_encryption", "file_encryption"},
	}
	
	// Asymmetric encryption
	c.algorithms["rsa-4096"] = &CryptoAlgorithm{
		ID:       "rsa-4096",
		Name:     "RSA-4096",
		Type:     "asymmetric",
		KeySizes: []int{4096},
		Approved: true,
		UseCases: []string{"key_exchange", "digital_signature"},
	}
	
	c.algorithms["ecdsa-p384"] = &CryptoAlgorithm{
		ID:       "ecdsa-p384",
		Name:     "ECDSA P-384",
		Type:     "asymmetric",
		KeySizes: []int{384},
		Approved: true,
		UseCases: []string{"digital_signature", "authentication"},
	}
	
	// Hash functions
	c.algorithms["sha-256"] = &CryptoAlgorithm{
		ID:       "sha-256",
		Name:     "SHA-256",
		Type:     "hash",
		KeySizes: []int{256},
		Approved: true,
		UseCases: []string{"integrity", "password_hashing"},
	}
	
	c.algorithms["sha-384"] = &CryptoAlgorithm{
		ID:       "sha-384",
		Name:     "SHA-384",
		Type:     "hash",
		KeySizes: []int{384},
		Approved: true,
		UseCases: []string{"integrity", "digital_signature"},
	}
	
	// KDF
	c.algorithms["argon2id"] = &CryptoAlgorithm{
		ID:       "argon2id",
		Name:     "Argon2id",
		Type:     "kdf",
		KeySizes: []int{256},
		Approved: true,
		UseCases: []string{"password_hashing", "key_derivation"},
	}
	
	// Deprecated algorithms
	c.algorithms["sha-1"] = &CryptoAlgorithm{
		ID:         "sha-1",
		Name:       "SHA-1",
		Type:       "hash",
		KeySizes:   []int{160},
		Approved:   false,
		Deprecated: true,
		UseCases:   []string{},
	}
	
	c.algorithms["md5"] = &CryptoAlgorithm{
		ID:         "md5",
		Name:       "MD5",
		Type:       "hash",
		KeySizes:   []int{128},
		Approved:   false,
		Deprecated: true,
		UseCases:   []string{},
	}
}

// IsAlgorithmApproved checks if an algorithm is approved
func (c *CryptographyPolicy) IsAlgorithmApproved(algorithmID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	algo, ok := c.algorithms[algorithmID]
	if !ok {
		return false
	}
	return algo.Approved && !algo.Deprecated
}

// RegisterKey registers a cryptographic key
func (c *CryptographyPolicy) RegisterKey(key *CryptoKey) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Validate algorithm
	algo, ok := c.algorithms[key.Algorithm]
	if !ok {
		return fmt.Errorf("unknown algorithm: %s", key.Algorithm)
	}
	if !algo.Approved {
		return fmt.Errorf("algorithm not approved: %s", key.Algorithm)
	}
	
	key.ID = generateKeyID()
	key.Status = "active"
	key.CreatedAt = time.Now()
	
	c.keyInventory[key.ID] = key
	return nil
}

// GetExpiringKeys returns keys expiring within the given duration
func (c *CryptographyPolicy) GetExpiringKeys(within time.Duration) []*CryptoKey {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	var expiring []*CryptoKey
	threshold := time.Now().Add(within)
	
	for _, key := range c.keyInventory {
		if key.Status == "active" && key.ExpiresAt.Before(threshold) {
			expiring = append(expiring, key)
		}
	}
	return expiring
}

// generateKeyID generates a unique key ID
func generateKeyID() string {
	data := fmt.Sprintf("key-%d", time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return "KEY-" + hex.EncodeToString(hash[:8])
}

// ============================================================================
// Statement of Applicability
// ============================================================================

// StatementOfApplicability represents ISO 27001 SoA
type StatementOfApplicability struct {
	Controls []ControlApplicability `json:"controls"`
}

// ControlApplicability represents a control's applicability
type ControlApplicability struct {
	ControlID     string   `json:"control_id"`
	ControlName   string   `json:"control_name"`
	Applicable    bool     `json:"applicable"`
	Implemented   bool     `json:"implemented"`
	Justification string   `json:"justification"`
	Evidence      []string `json:"evidence"`
}

// GenerateSoA generates a Statement of Applicability
func (f *ISO27001ControlFramework) GenerateSoA() *StatementOfApplicability {
	return &StatementOfApplicability{
		Controls: []ControlApplicability{
			{ControlID: "A.5.1", ControlName: "Policies for information security", Applicable: true, Implemented: true, Justification: "Security policies defined and enforced"},
			{ControlID: "A.6.1", ControlName: "Internal organization", Applicable: true, Implemented: true, Justification: "Security roles and responsibilities defined"},
			{ControlID: "A.7.1", ControlName: "Prior to employment", Applicable: true, Implemented: true, Justification: "Background checks and security awareness"},
			{ControlID: "A.8.1", ControlName: "Responsibility for assets", Applicable: true, Implemented: true, Justification: "Asset inventory maintained"},
			{ControlID: "A.9.1", ControlName: "Business requirements of access control", Applicable: true, Implemented: true, Justification: "RBAC implemented via Permify"},
			{ControlID: "A.9.2", ControlName: "User access management", Applicable: true, Implemented: true, Justification: "User provisioning via Keycloak"},
			{ControlID: "A.9.4", ControlName: "System and application access control", Applicable: true, Implemented: true, Justification: "Zero Trust enforcement"},
			{ControlID: "A.10.1", ControlName: "Cryptographic controls", Applicable: true, Implemented: true, Justification: "TLS 1.3, AES-256-GCM encryption"},
			{ControlID: "A.12.1", ControlName: "Operational procedures and responsibilities", Applicable: true, Implemented: true, Justification: "Runbooks and procedures documented"},
			{ControlID: "A.12.4", ControlName: "Logging and monitoring", Applicable: true, Implemented: true, Justification: "Comprehensive audit logging"},
			{ControlID: "A.13.1", ControlName: "Network security management", Applicable: true, Implemented: true, Justification: "Network policies and micro-segmentation"},
			{ControlID: "A.14.1", ControlName: "Security requirements of information systems", Applicable: true, Implemented: true, Justification: "Secure SDLC practices"},
			{ControlID: "A.16.1", ControlName: "Management of information security incidents", Applicable: true, Implemented: true, Justification: "Incident response procedures"},
			{ControlID: "A.17.1", ControlName: "Information security continuity", Applicable: true, Implemented: true, Justification: "DR and BCP implemented"},
			{ControlID: "A.18.1", ControlName: "Compliance with legal and contractual requirements", Applicable: true, Implemented: true, Justification: "Regulatory compliance monitoring"},
		},
	}
}

// GenerateComplianceReport generates a compliance report
func (f *ISO27001ControlFramework) GenerateComplianceReport() map[string]interface{} {
	soa := f.GenerateSoA()
	
	var implemented, notImplemented int
	for _, control := range soa.Controls {
		if control.Implemented {
			implemented++
		} else {
			notImplemented++
		}
	}
	
	return map[string]interface{}{
		"organization":        f.config.OrganizationName,
		"scope":              f.config.ISMSScope,
		"generated_at":       time.Now().Format(time.RFC3339),
		"total_controls":     len(soa.Controls),
		"implemented":        implemented,
		"not_implemented":    notImplemented,
		"compliance_rate":    float64(implemented) / float64(len(soa.Controls)) * 100,
		"risks_above_appetite": len(f.riskAssessment.GetRisksAboveAppetite()),
		"open_incidents":     len(f.incidentResponse.GetOpenIncidents()),
		"sla_breaches":       len(f.incidentResponse.GetSLABreaches()),
		"assets_needing_review": len(f.assetInventory.GetAssetsNeedingReview()),
		"expiring_keys":      len(f.cryptoPolicy.GetExpiringKeys(30 * 24 * time.Hour)),
	}
}
