// Package national implements national payment switch components
package national

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// NOCOperationsCenter provides 24/7 operations tooling for the payment switch
type NOCOperationsCenter struct {
	db              *sql.DB
	auditLogger     *ImmutableAuditLogger
	hsmManager      *HSMKeyManager
	killSwitches    map[KillSwitchType]*KillSwitch
	circuitBreakers map[string]*CircuitBreaker
	incidents       map[string]*Incident
	alertManager    *AlertManager
	config          *NOCConfig
	mu              sync.RWMutex
}

// NOCConfig holds NOC configuration
type NOCConfig struct {
	AlertWebhookURL       string
	PagerDutyAPIKey       string
	SlackWebhookURL       string
	OpsGenieAPIKey        string
	EscalationTimeMinutes int
	AutoRecoveryEnabled   bool
	HealthCheckInterval   time.Duration
}

// NewNOCOperationsCenter creates a new NOC operations center
func NewNOCOperationsCenter(db *sql.DB, audit *ImmutableAuditLogger, hsm *HSMKeyManager, config *NOCConfig) *NOCOperationsCenter {
	noc := &NOCOperationsCenter{
		db:              db,
		auditLogger:     audit,
		hsmManager:      hsm,
		killSwitches:    make(map[KillSwitchType]*KillSwitch),
		circuitBreakers: make(map[string]*CircuitBreaker),
		incidents:       make(map[string]*Incident),
		config:          config,
	}

	// Initialize kill switches
	noc.initializeKillSwitches()

	// Initialize circuit breakers
	noc.initializeCircuitBreakers()

	// Initialize alert manager
	noc.alertManager = NewAlertManager(config)

	return noc
}

// KillSwitchType defines the type of kill switch
type KillSwitchType string

const (
	KillSwitchParticipant    KillSwitchType = "PARTICIPANT"
	KillSwitchCurrency       KillSwitchType = "CURRENCY"
	KillSwitchCorridor       KillSwitchType = "CORRIDOR"
	KillSwitchTransferType   KillSwitchType = "TRANSFER_TYPE"
	KillSwitchSettlement     KillSwitchType = "SETTLEMENT"
	KillSwitchAllTransfers   KillSwitchType = "ALL_TRANSFERS"
	KillSwitchAllSettlements KillSwitchType = "ALL_SETTLEMENTS"
	KillSwitchEmergencyHalt  KillSwitchType = "EMERGENCY_HALT"
)

// KillSwitch represents a kill switch
type KillSwitch struct {
	Type          KillSwitchType `json:"type"`
	Target        string         `json:"target,omitempty"` // Participant ID, currency, etc.
	Activated     bool           `json:"activated"`
	ActivatedAt   *time.Time     `json:"activated_at,omitempty"`
	ActivatedBy   string         `json:"activated_by,omitempty"`
	Reason        string         `json:"reason,omitempty"`
	AutoExpiry    *time.Time     `json:"auto_expiry,omitempty"`
	RequiresAuth  bool           `json:"requires_auth"`
	AuthorizedBy  []string       `json:"authorized_by,omitempty"`
}

// ActivateKillSwitch activates a kill switch
func (n *NOCOperationsCenter) ActivateKillSwitch(ctx context.Context, switchType KillSwitchType, target, reason, operator string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	key := string(switchType)
	if target != "" {
		key = fmt.Sprintf("%s:%s", switchType, target)
	}

	now := time.Now()
	ks := &KillSwitch{
		Type:        switchType,
		Target:      target,
		Activated:   true,
		ActivatedAt: &now,
		ActivatedBy: operator,
		Reason:      reason,
	}

	n.killSwitches[switchType] = ks

	// Save to database
	if err := n.saveKillSwitch(ctx, ks); err != nil {
		return fmt.Errorf("failed to save kill switch: %w", err)
	}

	// Audit log
	if n.auditLogger != nil {
		n.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventKillSwitchActivated,
			Severity:  AuditSeverityEmergency,
			Actor:     &AuditActor{ActorID: operator, ActorType: "USER", ActorName: operator},
			Subject:   &AuditSubject{SubjectID: key, SubjectType: "KILL_SWITCH", SubjectName: string(switchType)},
			Action:    "Activated kill switch",
			Details:   map[string]interface{}{"target": target, "reason": reason},
		})
	}

	// Send alerts
	n.alertManager.SendAlert(ctx, &Alert{
		AlertID:   generateEventID(),
		Severity:  AlertSeverityCritical,
		Title:     fmt.Sprintf("Kill Switch Activated: %s", switchType),
		Message:   fmt.Sprintf("Kill switch %s activated by %s. Reason: %s", switchType, operator, reason),
		Source:    "NOC",
		Timestamp: now,
	})

	return nil
}

// DeactivateKillSwitch deactivates a kill switch
func (n *NOCOperationsCenter) DeactivateKillSwitch(ctx context.Context, switchType KillSwitchType, target, operator string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	key := string(switchType)
	if target != "" {
		key = fmt.Sprintf("%s:%s", switchType, target)
	}

	ks, exists := n.killSwitches[switchType]
	if !exists || !ks.Activated {
		return fmt.Errorf("kill switch %s is not activated", switchType)
	}

	ks.Activated = false

	// Update database
	if err := n.updateKillSwitch(ctx, ks); err != nil {
		return fmt.Errorf("failed to update kill switch: %w", err)
	}

	// Audit log
	if n.auditLogger != nil {
		n.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventKillSwitchDeactivated,
			Severity:  AuditSeverityCritical,
			Actor:     &AuditActor{ActorID: operator, ActorType: "USER", ActorName: operator},
			Subject:   &AuditSubject{SubjectID: key, SubjectType: "KILL_SWITCH", SubjectName: string(switchType)},
			Action:    "Deactivated kill switch",
		})
	}

	// Send alerts
	n.alertManager.SendAlert(ctx, &Alert{
		AlertID:   generateEventID(),
		Severity:  AlertSeverityInfo,
		Title:     fmt.Sprintf("Kill Switch Deactivated: %s", switchType),
		Message:   fmt.Sprintf("Kill switch %s deactivated by %s", switchType, operator),
		Source:    "NOC",
		Timestamp: time.Now(),
	})

	return nil
}

// IsKillSwitchActive checks if a kill switch is active
func (n *NOCOperationsCenter) IsKillSwitchActive(switchType KillSwitchType, target string) bool {
	n.mu.RLock()
	defer n.mu.RUnlock()

	// Check emergency halt first
	if ks, exists := n.killSwitches[KillSwitchEmergencyHalt]; exists && ks.Activated {
		return true
	}

	// Check specific switch
	if ks, exists := n.killSwitches[switchType]; exists && ks.Activated {
		if ks.Target == "" || ks.Target == target {
			return true
		}
	}

	return false
}

// GetActiveKillSwitches returns all active kill switches
func (n *NOCOperationsCenter) GetActiveKillSwitches() []*KillSwitch {
	n.mu.RLock()
	defer n.mu.RUnlock()

	var active []*KillSwitch
	for _, ks := range n.killSwitches {
		if ks.Activated {
			active = append(active, ks)
		}
	}
	return active
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	Name           string              `json:"name"`
	State          CircuitBreakerState `json:"state"`
	FailureCount   int                 `json:"failure_count"`
	SuccessCount   int                 `json:"success_count"`
	LastFailure    *time.Time          `json:"last_failure,omitempty"`
	LastSuccess    *time.Time          `json:"last_success,omitempty"`
	OpenedAt       *time.Time          `json:"opened_at,omitempty"`
	HalfOpenAt     *time.Time          `json:"half_open_at,omitempty"`
	FailureThreshold int              `json:"failure_threshold"`
	SuccessThreshold int              `json:"success_threshold"`
	Timeout        time.Duration       `json:"timeout"`
	mu             sync.Mutex
}

// CircuitBreakerState defines the state of a circuit breaker
type CircuitBreakerState string

const (
	CircuitBreakerClosed   CircuitBreakerState = "CLOSED"
	CircuitBreakerOpen     CircuitBreakerState = "OPEN"
	CircuitBreakerHalfOpen CircuitBreakerState = "HALF_OPEN"
)

// RecordSuccess records a successful operation
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	cb.LastSuccess = &now
	cb.SuccessCount++

	if cb.State == CircuitBreakerHalfOpen {
		if cb.SuccessCount >= cb.SuccessThreshold {
			cb.State = CircuitBreakerClosed
			cb.FailureCount = 0
			cb.SuccessCount = 0
		}
	}
}

// RecordFailure records a failed operation
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	cb.LastFailure = &now
	cb.FailureCount++

	if cb.State == CircuitBreakerClosed {
		if cb.FailureCount >= cb.FailureThreshold {
			cb.State = CircuitBreakerOpen
			cb.OpenedAt = &now
		}
	} else if cb.State == CircuitBreakerHalfOpen {
		cb.State = CircuitBreakerOpen
		cb.OpenedAt = &now
		cb.SuccessCount = 0
	}
}

// AllowRequest checks if a request should be allowed
func (cb *CircuitBreaker) AllowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.State {
	case CircuitBreakerClosed:
		return true
	case CircuitBreakerOpen:
		if cb.OpenedAt != nil && time.Since(*cb.OpenedAt) > cb.Timeout {
			cb.State = CircuitBreakerHalfOpen
			now := time.Now()
			cb.HalfOpenAt = &now
			cb.SuccessCount = 0
			return true
		}
		return false
	case CircuitBreakerHalfOpen:
		return true
	}
	return false
}

// Incident represents an operational incident
type Incident struct {
	IncidentID    string           `json:"incident_id"`
	Title         string           `json:"title"`
	Description   string           `json:"description"`
	Severity      IncidentSeverity `json:"severity"`
	Status        IncidentStatus   `json:"status"`
	AffectedServices []string      `json:"affected_services"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
	ResolvedAt    *time.Time       `json:"resolved_at,omitempty"`
	AssignedTo    string           `json:"assigned_to,omitempty"`
	Timeline      []*IncidentUpdate `json:"timeline"`
	RootCause     string           `json:"root_cause,omitempty"`
	Resolution    string           `json:"resolution,omitempty"`
	PostMortemURL string           `json:"post_mortem_url,omitempty"`
}

// IncidentSeverity defines the severity of an incident
type IncidentSeverity string

const (
	IncidentSeveritySEV1 IncidentSeverity = "SEV1" // Critical - Complete outage
	IncidentSeveritySEV2 IncidentSeverity = "SEV2" // Major - Significant impact
	IncidentSeveritySEV3 IncidentSeverity = "SEV3" // Minor - Limited impact
	IncidentSeveritySEV4 IncidentSeverity = "SEV4" // Low - Minimal impact
)

// IncidentStatus defines the status of an incident
type IncidentStatus string

const (
	IncidentStatusOpen         IncidentStatus = "OPEN"
	IncidentStatusInvestigating IncidentStatus = "INVESTIGATING"
	IncidentStatusIdentified   IncidentStatus = "IDENTIFIED"
	IncidentStatusMonitoring   IncidentStatus = "MONITORING"
	IncidentStatusResolved     IncidentStatus = "RESOLVED"
)

// IncidentUpdate represents an update to an incident
type IncidentUpdate struct {
	Timestamp   time.Time      `json:"timestamp"`
	Status      IncidentStatus `json:"status"`
	Message     string         `json:"message"`
	UpdatedBy   string         `json:"updated_by"`
}

// CreateIncident creates a new incident
func (n *NOCOperationsCenter) CreateIncident(ctx context.Context, title, description string, severity IncidentSeverity, affectedServices []string, operator string) (*Incident, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	now := time.Now()
	incident := &Incident{
		IncidentID:       generateEventID(),
		Title:            title,
		Description:      description,
		Severity:         severity,
		Status:           IncidentStatusOpen,
		AffectedServices: affectedServices,
		CreatedAt:        now,
		UpdatedAt:        now,
		Timeline: []*IncidentUpdate{
			{
				Timestamp: now,
				Status:    IncidentStatusOpen,
				Message:   "Incident created",
				UpdatedBy: operator,
			},
		},
	}

	n.incidents[incident.IncidentID] = incident

	// Save to database
	if err := n.saveIncident(ctx, incident); err != nil {
		return nil, fmt.Errorf("failed to save incident: %w", err)
	}

	// Audit log
	if n.auditLogger != nil {
		n.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventType("INCIDENT_CREATED"),
			Severity:  AuditSeverityCritical,
			Actor:     &AuditActor{ActorID: operator, ActorType: "USER", ActorName: operator},
			Subject:   &AuditSubject{SubjectID: incident.IncidentID, SubjectType: "INCIDENT", SubjectName: title},
			Action:    "Created incident",
			Details:   map[string]interface{}{"severity": severity, "affected_services": affectedServices},
		})
	}

	// Send alerts based on severity
	alertSeverity := AlertSeverityWarning
	if severity == IncidentSeveritySEV1 {
		alertSeverity = AlertSeverityCritical
	} else if severity == IncidentSeveritySEV2 {
		alertSeverity = AlertSeverityError
	}

	n.alertManager.SendAlert(ctx, &Alert{
		AlertID:   generateEventID(),
		Severity:  alertSeverity,
		Title:     fmt.Sprintf("[%s] %s", severity, title),
		Message:   description,
		Source:    "NOC",
		Timestamp: now,
	})

	return incident, nil
}

// UpdateIncident updates an incident
func (n *NOCOperationsCenter) UpdateIncident(ctx context.Context, incidentID string, status IncidentStatus, message, operator string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	incident, exists := n.incidents[incidentID]
	if !exists {
		return fmt.Errorf("incident %s not found", incidentID)
	}

	now := time.Now()
	incident.Status = status
	incident.UpdatedAt = now
	incident.Timeline = append(incident.Timeline, &IncidentUpdate{
		Timestamp: now,
		Status:    status,
		Message:   message,
		UpdatedBy: operator,
	})

	if status == IncidentStatusResolved {
		incident.ResolvedAt = &now
	}

	// Update database
	if err := n.updateIncident(ctx, incident); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	// Audit log
	if n.auditLogger != nil {
		n.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventType("INCIDENT_UPDATED"),
			Severity:  AuditSeverityInfo,
			Actor:     &AuditActor{ActorID: operator, ActorType: "USER", ActorName: operator},
			Subject:   &AuditSubject{SubjectID: incidentID, SubjectType: "INCIDENT", SubjectName: incident.Title},
			Action:    "Updated incident",
			Details:   map[string]interface{}{"status": status, "message": message},
		})
	}

	return nil
}

// GetIncident retrieves an incident by ID
func (n *NOCOperationsCenter) GetIncident(incidentID string) (*Incident, error) {
	n.mu.RLock()
	defer n.mu.RUnlock()

	incident, exists := n.incidents[incidentID]
	if !exists {
		return nil, fmt.Errorf("incident %s not found", incidentID)
	}
	return incident, nil
}

// GetActiveIncidents returns all active incidents
func (n *NOCOperationsCenter) GetActiveIncidents() []*Incident {
	n.mu.RLock()
	defer n.mu.RUnlock()

	var active []*Incident
	for _, incident := range n.incidents {
		if incident.Status != IncidentStatusResolved {
			active = append(active, incident)
		}
	}
	return active
}

// AlertManager manages alerts and notifications
type AlertManager struct {
	config     *NOCConfig
	alertChan  chan *Alert
}

// Alert represents an operational alert
type Alert struct {
	AlertID    string        `json:"alert_id"`
	Severity   AlertSeverity `json:"severity"`
	Title      string        `json:"title"`
	Message    string        `json:"message"`
	Source     string        `json:"source"`
	Timestamp  time.Time     `json:"timestamp"`
	Labels     map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// AlertSeverity defines the severity of an alert
type AlertSeverity string

const (
	AlertSeverityInfo     AlertSeverity = "INFO"
	AlertSeverityWarning  AlertSeverity = "WARNING"
	AlertSeverityError    AlertSeverity = "ERROR"
	AlertSeverityCritical AlertSeverity = "CRITICAL"
)

// NewAlertManager creates a new alert manager
func NewAlertManager(config *NOCConfig) *AlertManager {
	am := &AlertManager{
		config:    config,
		alertChan: make(chan *Alert, 1000),
	}

	// Start alert processor
	go am.processAlerts()

	return am
}

// SendAlert sends an alert
func (am *AlertManager) SendAlert(ctx context.Context, alert *Alert) {
	select {
	case am.alertChan <- alert:
	default:
		fmt.Printf("WARNING: Alert channel full, dropping alert: %s\n", alert.Title)
	}
}

// processAlerts processes alerts in the background
func (am *AlertManager) processAlerts() {
	for alert := range am.alertChan {
		// Send to configured channels
		if am.config.SlackWebhookURL != "" {
			am.sendToSlack(alert)
		}
		if am.config.PagerDutyAPIKey != "" && (alert.Severity == AlertSeverityCritical || alert.Severity == AlertSeverityError) {
			am.sendToPagerDuty(alert)
		}
		if am.config.OpsGenieAPIKey != "" {
			am.sendToOpsGenie(alert)
		}
		if am.config.AlertWebhookURL != "" {
			am.sendToWebhook(alert)
		}
	}
}

func (am *AlertManager) sendToSlack(alert *Alert) {
	// In production, send to Slack webhook
	payload := map[string]interface{}{
		"text": fmt.Sprintf("[%s] %s: %s", alert.Severity, alert.Title, alert.Message),
		"attachments": []map[string]interface{}{
			{
				"color":  am.getSeverityColor(alert.Severity),
				"title":  alert.Title,
				"text":   alert.Message,
				"footer": fmt.Sprintf("Source: %s | %s", alert.Source, alert.Timestamp.Format(time.RFC3339)),
			},
		},
	}
	_ = payload // Would be sent via HTTP POST
}

func (am *AlertManager) sendToPagerDuty(alert *Alert) {
	// In production, send to PagerDuty Events API v2
	payload := map[string]interface{}{
		"routing_key":  am.config.PagerDutyAPIKey,
		"event_action": "trigger",
		"payload": map[string]interface{}{
			"summary":  alert.Title,
			"severity": am.mapToPagerDutySeverity(alert.Severity),
			"source":   alert.Source,
			"custom_details": map[string]interface{}{
				"message": alert.Message,
			},
		},
	}
	_ = payload // Would be sent via HTTP POST
}

func (am *AlertManager) sendToOpsGenie(alert *Alert) {
	// In production, send to OpsGenie Alert API
	payload := map[string]interface{}{
		"message":     alert.Title,
		"description": alert.Message,
		"priority":    am.mapToOpsGeniePriority(alert.Severity),
		"source":      alert.Source,
	}
	_ = payload // Would be sent via HTTP POST
}

func (am *AlertManager) sendToWebhook(alert *Alert) {
	// In production, send to custom webhook
	data, _ := json.Marshal(alert)
	_ = data // Would be sent via HTTP POST
}

func (am *AlertManager) getSeverityColor(severity AlertSeverity) string {
	switch severity {
	case AlertSeverityCritical:
		return "#FF0000"
	case AlertSeverityError:
		return "#FF6600"
	case AlertSeverityWarning:
		return "#FFCC00"
	default:
		return "#00FF00"
	}
}

func (am *AlertManager) mapToPagerDutySeverity(severity AlertSeverity) string {
	switch severity {
	case AlertSeverityCritical:
		return "critical"
	case AlertSeverityError:
		return "error"
	case AlertSeverityWarning:
		return "warning"
	default:
		return "info"
	}
}

func (am *AlertManager) mapToOpsGeniePriority(severity AlertSeverity) string {
	switch severity {
	case AlertSeverityCritical:
		return "P1"
	case AlertSeverityError:
		return "P2"
	case AlertSeverityWarning:
		return "P3"
	default:
		return "P5"
	}
}

// HealthCheck represents a health check result
type HealthCheck struct {
	ServiceName    string            `json:"service_name"`
	Status         HealthStatus      `json:"status"`
	ResponseTimeMs int64             `json:"response_time_ms"`
	LastCheck      time.Time         `json:"last_check"`
	Details        map[string]string `json:"details,omitempty"`
	Error          string            `json:"error,omitempty"`
}

// HealthStatus defines the health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "HEALTHY"
	HealthStatusDegraded  HealthStatus = "DEGRADED"
	HealthStatusUnhealthy HealthStatus = "UNHEALTHY"
	HealthStatusUnknown   HealthStatus = "UNKNOWN"
)

// PerformHealthCheck performs health checks on all services
func (n *NOCOperationsCenter) PerformHealthCheck(ctx context.Context) ([]*HealthCheck, error) {
	services := []struct {
		Name     string
		Endpoint string
	}{
		{"ml-api-adapter", "http://ml-api-adapter:3000/health"},
		{"central-ledger", "http://central-ledger:3001/health"},
		{"account-lookup-service", "http://account-lookup-service:4002/health"},
		{"quoting-service", "http://quoting-service:3002/health"},
		{"central-settlements", "http://central-settlements:3007/health"},
		{"tigerbeetle", "http://tigerbeetle:3000/health"},
		{"postgresql", "postgresql://localhost:5432"},
		{"kafka", "kafka://localhost:9092"},
		{"redis", "redis://localhost:6379"},
	}

	var results []*HealthCheck
	for _, svc := range services {
		result := n.checkService(ctx, svc.Name, svc.Endpoint)
		results = append(results, result)

		// Save to database
		n.saveHealthCheck(ctx, result)

		// Alert if unhealthy
		if result.Status == HealthStatusUnhealthy {
			n.alertManager.SendAlert(ctx, &Alert{
				AlertID:   generateEventID(),
				Severity:  AlertSeverityError,
				Title:     fmt.Sprintf("Service Unhealthy: %s", svc.Name),
				Message:   result.Error,
				Source:    "HealthCheck",
				Timestamp: time.Now(),
			})
		}
	}

	return results, nil
}

func (n *NOCOperationsCenter) checkService(ctx context.Context, name, endpoint string) *HealthCheck {
	start := time.Now()
	result := &HealthCheck{
		ServiceName: name,
		LastCheck:   start,
	}

	// In production, make actual HTTP request
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(endpoint)
	
	result.ResponseTimeMs = time.Since(start).Milliseconds()

	if err != nil {
		result.Status = HealthStatusUnhealthy
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		result.Status = HealthStatusHealthy
	} else if resp.StatusCode >= 500 {
		result.Status = HealthStatusUnhealthy
		result.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
	} else {
		result.Status = HealthStatusDegraded
	}

	return result
}

// SystemMetrics represents system metrics
type SystemMetrics struct {
	Timestamp           time.Time `json:"timestamp"`
	TransactionsPerSec  float64   `json:"transactions_per_sec"`
	AvgLatencyMs        float64   `json:"avg_latency_ms"`
	P99LatencyMs        float64   `json:"p99_latency_ms"`
	ErrorRate           float64   `json:"error_rate"`
	ActiveConnections   int       `json:"active_connections"`
	QueueDepth          int       `json:"queue_depth"`
	CPUUsagePercent     float64   `json:"cpu_usage_percent"`
	MemoryUsagePercent  float64   `json:"memory_usage_percent"`
	DiskUsagePercent    float64   `json:"disk_usage_percent"`
}

// GetSystemMetrics retrieves current system metrics
func (n *NOCOperationsCenter) GetSystemMetrics(ctx context.Context) (*SystemMetrics, error) {
	metrics := &SystemMetrics{
		Timestamp: time.Now(),
	}

	// Query transaction rate (last minute)
	row := n.db.QueryRowContext(ctx, `
		SELECT COUNT(*) / 60.0 as tps
		FROM mojaloop_transfers
		WHERE created_at >= NOW() - INTERVAL '1 minute'
	`)
	row.Scan(&metrics.TransactionsPerSec)

	// Query latency metrics
	row = n.db.QueryRowContext(ctx, `
		SELECT 
			AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as avg_latency,
			PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as p99_latency
		FROM mojaloop_transfers
		WHERE created_at >= NOW() - INTERVAL '5 minutes'
		  AND completed_at IS NOT NULL
	`)
	row.Scan(&metrics.AvgLatencyMs, &metrics.P99LatencyMs)

	// Query error rate
	row = n.db.QueryRowContext(ctx, `
		SELECT 
			COUNT(CASE WHEN mojaloop_state = 'ABORTED' THEN 1 END)::float / 
			NULLIF(COUNT(*), 0) as error_rate
		FROM mojaloop_transfers
		WHERE created_at >= NOW() - INTERVAL '5 minutes'
	`)
	row.Scan(&metrics.ErrorRate)

	return metrics, nil
}

// Runbook represents an operational runbook
type Runbook struct {
	RunbookID   string          `json:"runbook_id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	Steps       []*RunbookStep  `json:"steps"`
	Triggers    []string        `json:"triggers"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// RunbookStep represents a step in a runbook
type RunbookStep struct {
	StepNumber  int    `json:"step_number"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Command     string `json:"command,omitempty"`
	Automated   bool   `json:"automated"`
}

// GetRunbook retrieves a runbook by ID
func (n *NOCOperationsCenter) GetRunbook(ctx context.Context, runbookID string) (*Runbook, error) {
	row := n.db.QueryRowContext(ctx, `
		SELECT runbook_id, title, description, category, steps, triggers, created_at, updated_at
		FROM runbooks WHERE runbook_id = $1
	`, runbookID)

	runbook := &Runbook{}
	var stepsJSON, triggersJSON []byte

	err := row.Scan(
		&runbook.RunbookID, &runbook.Title, &runbook.Description, &runbook.Category,
		&stepsJSON, &triggersJSON, &runbook.CreatedAt, &runbook.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	json.Unmarshal(stepsJSON, &runbook.Steps)
	json.Unmarshal(triggersJSON, &runbook.Triggers)

	return runbook, nil
}

// Helper methods

func (n *NOCOperationsCenter) initializeKillSwitches() {
	// Load kill switches from database
	ctx := context.Background()
	rows, err := n.db.QueryContext(ctx, `
		SELECT type, target, activated, activated_at, activated_by, reason
		FROM kill_switches WHERE activated = true
	`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		ks := &KillSwitch{}
		var switchType string
		var activatedAt sql.NullTime
		var activatedBy, reason sql.NullString

		rows.Scan(&switchType, &ks.Target, &ks.Activated, &activatedAt, &activatedBy, &reason)
		ks.Type = KillSwitchType(switchType)
		if activatedAt.Valid {
			ks.ActivatedAt = &activatedAt.Time
		}
		if activatedBy.Valid {
			ks.ActivatedBy = activatedBy.String
		}
		if reason.Valid {
			ks.Reason = reason.String
		}

		n.killSwitches[ks.Type] = ks
	}
}

func (n *NOCOperationsCenter) initializeCircuitBreakers() {
	services := []string{
		"ml-api-adapter",
		"central-ledger",
		"account-lookup-service",
		"quoting-service",
		"central-settlements",
		"tigerbeetle",
	}

	for _, svc := range services {
		n.circuitBreakers[svc] = &CircuitBreaker{
			Name:             svc,
			State:            CircuitBreakerClosed,
			FailureThreshold: 5,
			SuccessThreshold: 3,
			Timeout:          30 * time.Second,
		}
	}
}

func (n *NOCOperationsCenter) saveKillSwitch(ctx context.Context, ks *KillSwitch) error {
	_, err := n.db.ExecContext(ctx, `
		INSERT INTO kill_switches (type, target, activated, activated_at, activated_by, reason)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (type, target) DO UPDATE SET
			activated = $3, activated_at = $4, activated_by = $5, reason = $6
	`, string(ks.Type), ks.Target, ks.Activated, ks.ActivatedAt, ks.ActivatedBy, ks.Reason)
	return err
}

func (n *NOCOperationsCenter) updateKillSwitch(ctx context.Context, ks *KillSwitch) error {
	_, err := n.db.ExecContext(ctx, `
		UPDATE kill_switches SET activated = $1 WHERE type = $2 AND target = $3
	`, ks.Activated, string(ks.Type), ks.Target)
	return err
}

func (n *NOCOperationsCenter) saveIncident(ctx context.Context, incident *Incident) error {
	timelineJSON, _ := json.Marshal(incident.Timeline)
	servicesJSON, _ := json.Marshal(incident.AffectedServices)

	_, err := n.db.ExecContext(ctx, `
		INSERT INTO incidents (
			incident_id, title, description, severity, status,
			affected_services, created_at, updated_at, timeline
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, incident.IncidentID, incident.Title, incident.Description, string(incident.Severity),
		string(incident.Status), servicesJSON, incident.CreatedAt, incident.UpdatedAt, timelineJSON)
	return err
}

func (n *NOCOperationsCenter) updateIncident(ctx context.Context, incident *Incident) error {
	timelineJSON, _ := json.Marshal(incident.Timeline)

	_, err := n.db.ExecContext(ctx, `
		UPDATE incidents SET
			status = $1, updated_at = $2, resolved_at = $3, timeline = $4,
			root_cause = $5, resolution = $6
		WHERE incident_id = $7
	`, string(incident.Status), incident.UpdatedAt, incident.ResolvedAt, timelineJSON,
		incident.RootCause, incident.Resolution, incident.IncidentID)
	return err
}

func (n *NOCOperationsCenter) saveHealthCheck(ctx context.Context, hc *HealthCheck) error {
	_, err := n.db.ExecContext(ctx, `
		INSERT INTO system_health_checks (service_name, check_time, status, response_time_ms, error_message)
		VALUES ($1, $2, $3, $4, $5)
	`, hc.ServiceName, hc.LastCheck, string(hc.Status), hc.ResponseTimeMs, hc.Error)
	return err
}

// NOCOperationsSchema returns the PostgreSQL schema for NOC tables
func NOCOperationsSchema() string {
	return `
-- Kill switches table
CREATE TABLE IF NOT EXISTS kill_switches (
    type VARCHAR(50) NOT NULL,
    target VARCHAR(128) NOT NULL DEFAULT '',
    activated BOOLEAN NOT NULL DEFAULT FALSE,
    activated_at TIMESTAMP WITH TIME ZONE,
    activated_by VARCHAR(128),
    reason TEXT,
    auto_expiry TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (type, target)
);

-- Index for active kill switches
CREATE INDEX IF NOT EXISTS idx_kill_switches_active 
ON kill_switches(activated) WHERE activated = TRUE;

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    incident_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    severity VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    affected_services JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(128),
    timeline JSONB,
    root_cause TEXT,
    resolution TEXT,
    post_mortem_url TEXT
);

-- Index for active incidents
CREATE INDEX IF NOT EXISTS idx_incidents_status 
ON incidents(status, created_at DESC);

-- Index for severity queries
CREATE INDEX IF NOT EXISTS idx_incidents_severity 
ON incidents(severity, created_at DESC);

-- Runbooks table
CREATE TABLE IF NOT EXISTS runbooks (
    runbook_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    steps JSONB NOT NULL,
    triggers JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for runbook queries
CREATE INDEX IF NOT EXISTS idx_runbooks_category 
ON runbooks(category);

-- Circuit breaker state table
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    service_name VARCHAR(128) PRIMARY KEY,
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_failure TIMESTAMP WITH TIME ZONE,
    last_success TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Operational alerts table
CREATE TABLE IF NOT EXISTS operational_alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(256) NOT NULL,
    message TEXT,
    source VARCHAR(128),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR(128),
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_operational_alerts_unack 
ON operational_alerts(acknowledged, timestamp DESC) WHERE acknowledged = FALSE;
`
}
