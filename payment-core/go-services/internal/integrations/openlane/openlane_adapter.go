package openlane

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// OpenLaneAdapter provides integration with OpenLane Core GRC platform
// for compliance operations, evidence tracking, and audit management.
//
// This adapter connects PayGate to OpenLane as a separate GRC service,
// allowing PayGate to:
// - Export audit logs as evidence
// - Create and track compliance tasks
// - Manage risk assessments
// - Generate compliance reports
type OpenLaneAdapter struct {
	baseURL     string
	apiKey      string
	httpClient  *http.Client
	orgID       string
	mu          sync.RWMutex
	csrfToken   string
}

// Config holds OpenLane adapter configuration
type Config struct {
	BaseURL        string
	APIKey         string
	OrganizationID string
	Timeout        time.Duration
}

// NewOpenLaneAdapter creates a new OpenLane adapter
func NewOpenLaneAdapter(config *Config) *OpenLaneAdapter {
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	return &OpenLaneAdapter{
		baseURL: config.BaseURL,
		apiKey:  config.APIKey,
		orgID:   config.OrganizationID,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// Evidence represents compliance evidence in OpenLane
type Evidence struct {
	ID              string                 `json:"id,omitempty"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description,omitempty"`
	Source          string                 `json:"source"`
	SourceID        string                 `json:"source_id,omitempty"`
	CollectedAt     time.Time              `json:"collected_at"`
	ExpiresAt       *time.Time             `json:"expires_at,omitempty"`
	ControlIDs      []string               `json:"control_ids,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	FileURL         string                 `json:"file_url,omitempty"`
	Status          string                 `json:"status,omitempty"`
	ApprovalStatus  string                 `json:"approval_status,omitempty"`
}

// Control represents a compliance control in OpenLane
type Control struct {
	ID                string   `json:"id,omitempty"`
	Name              string   `json:"name"`
	Description       string   `json:"description,omitempty"`
	ControlNumber     string   `json:"control_number"`
	Framework         string   `json:"framework"` // ISO27001, SOC2, NIST800-53
	Category          string   `json:"category,omitempty"`
	Subcategory       string   `json:"subcategory,omitempty"`
	ImplementationStatus string `json:"implementation_status,omitempty"`
	EvidenceIDs       []string `json:"evidence_ids,omitempty"`
}

// Risk represents a risk assessment in OpenLane
type Risk struct {
	ID              string    `json:"id,omitempty"`
	Name            string    `json:"name"`
	Description     string    `json:"description,omitempty"`
	Category        string    `json:"category,omitempty"`
	Likelihood      float64   `json:"likelihood"`
	Impact          float64   `json:"impact"`
	InherentRisk    float64   `json:"inherent_risk,omitempty"`
	ResidualRisk    float64   `json:"residual_risk,omitempty"`
	Status          string    `json:"status,omitempty"`
	TreatmentPlan   string    `json:"treatment_plan,omitempty"`
	ControlIDs      []string  `json:"control_ids,omitempty"`
	Owner           string    `json:"owner,omitempty"`
	DueDate         *time.Time `json:"due_date,omitempty"`
}

// Task represents a compliance task in OpenLane
type Task struct {
	ID              string                 `json:"id,omitempty"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description,omitempty"`
	Type            string                 `json:"type,omitempty"` // evidence_collection, review, remediation
	Priority        string                 `json:"priority,omitempty"`
	Status          string                 `json:"status,omitempty"`
	AssigneeID      string                 `json:"assignee_id,omitempty"`
	DueDate         *time.Time             `json:"due_date,omitempty"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	ControlIDs      []string               `json:"control_ids,omitempty"`
	RiskIDs         []string               `json:"risk_ids,omitempty"`
	EvidenceIDs     []string               `json:"evidence_ids,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// Incident represents a security incident in OpenLane
type Incident struct {
	ID              string                 `json:"id,omitempty"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description,omitempty"`
	Severity        string                 `json:"severity"` // low, medium, high, critical
	Status          string                 `json:"status,omitempty"`
	DetectedAt      time.Time              `json:"detected_at"`
	ResolvedAt      *time.Time             `json:"resolved_at,omitempty"`
	Source          string                 `json:"source,omitempty"`
	SourceID        string                 `json:"source_id,omitempty"`
	AffectedAssets  []string               `json:"affected_assets,omitempty"`
	ControlIDs      []string               `json:"control_ids,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// AuditLogEntry represents an audit log entry to export to OpenLane
type AuditLogEntry struct {
	ID              string                 `json:"id"`
	Timestamp       time.Time              `json:"timestamp"`
	EventType       string                 `json:"event_type"`
	Actor           string                 `json:"actor"`
	Resource        string                 `json:"resource"`
	Action          string                 `json:"action"`
	Outcome         string                 `json:"outcome"`
	Details         map[string]interface{} `json:"details,omitempty"`
	SourceIP        string                 `json:"source_ip,omitempty"`
	UserAgent       string                 `json:"user_agent,omitempty"`
}

// CreateEvidence creates evidence in OpenLane
func (a *OpenLaneAdapter) CreateEvidence(ctx context.Context, evidence *Evidence) (*Evidence, error) {
	evidence.Source = "paygate"
	
	resp, err := a.doRequest(ctx, "POST", "/api/v1/evidence", evidence)
	if err != nil {
		return nil, fmt.Errorf("failed to create evidence: %w", err)
	}
	defer resp.Body.Close()
	
	var result Evidence
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &result, nil
}

// ExportAuditLogs exports audit logs to OpenLane as evidence
func (a *OpenLaneAdapter) ExportAuditLogs(ctx context.Context, logs []AuditLogEntry, controlIDs []string) (*Evidence, error) {
	// Convert audit logs to evidence
	logsJSON, err := json.Marshal(logs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal audit logs: %w", err)
	}
	
	evidence := &Evidence{
		Name:        fmt.Sprintf("PayGate Audit Logs - %s", time.Now().Format("2006-01-02")),
		Description: fmt.Sprintf("Audit logs exported from PayGate containing %d entries", len(logs)),
		Source:      "paygate",
		CollectedAt: time.Now().UTC(),
		ControlIDs:  controlIDs,
		Tags:        []string{"audit-logs", "automated", "paygate"},
		Metadata: map[string]interface{}{
			"log_count":   len(logs),
			"export_time": time.Now().UTC(),
			"logs":        json.RawMessage(logsJSON),
		},
	}
	
	return a.CreateEvidence(ctx, evidence)
}

// CreateRisk creates a risk assessment in OpenLane
func (a *OpenLaneAdapter) CreateRisk(ctx context.Context, risk *Risk) (*Risk, error) {
	// Calculate inherent risk if not provided
	if risk.InherentRisk == 0 {
		risk.InherentRisk = risk.Likelihood * risk.Impact
	}
	
	resp, err := a.doRequest(ctx, "POST", "/api/v1/risks", risk)
	if err != nil {
		return nil, fmt.Errorf("failed to create risk: %w", err)
	}
	defer resp.Body.Close()
	
	var result Risk
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &result, nil
}

// CreateTask creates a compliance task in OpenLane
func (a *OpenLaneAdapter) CreateTask(ctx context.Context, task *Task) (*Task, error) {
	resp, err := a.doRequest(ctx, "POST", "/api/v1/tasks", task)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}
	defer resp.Body.Close()
	
	var result Task
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &result, nil
}

// CreateIncident creates a security incident in OpenLane
func (a *OpenLaneAdapter) CreateIncident(ctx context.Context, incident *Incident) (*Incident, error) {
	incident.Source = "paygate"
	
	resp, err := a.doRequest(ctx, "POST", "/api/v1/incidents", incident)
	if err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}
	defer resp.Body.Close()
	
	var result Incident
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return &result, nil
}

// GetControls retrieves controls from OpenLane
func (a *OpenLaneAdapter) GetControls(ctx context.Context, framework string) ([]Control, error) {
	path := "/api/v1/controls"
	if framework != "" {
		path += "?framework=" + framework
	}
	
	resp, err := a.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get controls: %w", err)
	}
	defer resp.Body.Close()
	
	var result struct {
		Controls []Control `json:"controls"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result.Controls, nil
}

// GetRisks retrieves risks from OpenLane
func (a *OpenLaneAdapter) GetRisks(ctx context.Context) ([]Risk, error) {
	resp, err := a.doRequest(ctx, "GET", "/api/v1/risks", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get risks: %w", err)
	}
	defer resp.Body.Close()
	
	var result struct {
		Risks []Risk `json:"risks"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result.Risks, nil
}

// GetTasks retrieves tasks from OpenLane
func (a *OpenLaneAdapter) GetTasks(ctx context.Context, status string) ([]Task, error) {
	path := "/api/v1/tasks"
	if status != "" {
		path += "?status=" + status
	}
	
	resp, err := a.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get tasks: %w", err)
	}
	defer resp.Body.Close()
	
	var result struct {
		Tasks []Task `json:"tasks"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result.Tasks, nil
}

// SyncPayGateRisks syncs PayGate risk register to OpenLane
func (a *OpenLaneAdapter) SyncPayGateRisks(ctx context.Context, risks []Risk) error {
	for _, risk := range risks {
		_, err := a.CreateRisk(ctx, &risk)
		if err != nil {
			return fmt.Errorf("failed to sync risk %s: %w", risk.Name, err)
		}
	}
	return nil
}

// SyncPayGateIncidents syncs PayGate incidents to OpenLane
func (a *OpenLaneAdapter) SyncPayGateIncidents(ctx context.Context, incidents []Incident) error {
	for _, incident := range incidents {
		_, err := a.CreateIncident(ctx, &incident)
		if err != nil {
			return fmt.Errorf("failed to sync incident %s: %w", incident.Title, err)
		}
	}
	return nil
}

// doRequest performs an HTTP request to OpenLane
func (a *OpenLaneAdapter) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}
	
	req, err := http.NewRequestWithContext(ctx, method, a.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("X-Organization-ID", a.orgID)
	
	// Add CSRF token if available
	a.mu.RLock()
	if a.csrfToken != "" {
		req.Header.Set("X-CSRF-Token", a.csrfToken)
	}
	a.mu.RUnlock()
	
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	
	// Store CSRF token from response
	if csrfToken := resp.Header.Get("X-CSRF-Token"); csrfToken != "" {
		a.mu.Lock()
		a.csrfToken = csrfToken
		a.mu.Unlock()
	}
	
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}
	
	return resp, nil
}

// InitCSRF initializes CSRF token from OpenLane
func (a *OpenLaneAdapter) InitCSRF(ctx context.Context) error {
	resp, err := a.doRequest(ctx, "GET", "/livez", nil)
	if err != nil {
		return fmt.Errorf("failed to initialize CSRF: %w", err)
	}
	resp.Body.Close()
	return nil
}

// HealthCheck checks OpenLane connectivity
func (a *OpenLaneAdapter) HealthCheck(ctx context.Context) error {
	resp, err := a.doRequest(ctx, "GET", "/healthz", nil)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	resp.Body.Close()
	return nil
}

// ISO27001ControlMapping maps PayGate controls to ISO 27001 control IDs
var ISO27001ControlMapping = map[string]string{
	"access_control":       "A.8.3",
	"audit_logging":        "A.8.15",
	"encryption_at_rest":   "A.8.24",
	"encryption_in_transit": "A.8.24",
	"incident_response":    "A.5.24",
	"risk_assessment":      "A.5.7",
	"secure_development":   "A.8.25",
	"network_security":     "A.8.20",
	"authentication":       "A.8.5",
	"session_management":   "A.8.3",
}

// GetISO27001ControlID returns the ISO 27001 control ID for a PayGate control
func GetISO27001ControlID(paygateControl string) string {
	if controlID, ok := ISO27001ControlMapping[paygateControl]; ok {
		return controlID
	}
	return ""
}
