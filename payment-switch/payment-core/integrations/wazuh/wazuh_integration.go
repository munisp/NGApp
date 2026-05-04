// Package wazuh provides integration with Wazuh SIEM
package wazuh

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

// Config holds Wazuh configuration
type Config struct {
	ManagerURL       string
	APIUser          string
	APIPassword      string
	AlertWebhookURL  string
	AuditLogURL      string
	IncidentURL      string
	RefreshInterval  time.Duration
	AlertThreshold   int
}

// Alert represents a Wazuh security alert
type Alert struct {
	ID              string                 `json:"id"`
	Timestamp       time.Time              `json:"timestamp"`
	Rule            AlertRule              `json:"rule"`
	Agent           Agent                  `json:"agent"`
	Manager         Manager                `json:"manager"`
	FullLog         string                 `json:"full_log"`
	Decoder         Decoder                `json:"decoder"`
	Data            map[string]interface{} `json:"data"`
	Location        string                 `json:"location"`
	SrcIP           string                 `json:"srcip,omitempty"`
	DstIP           string                 `json:"dstip,omitempty"`
	SrcPort         string                 `json:"srcport,omitempty"`
	DstPort         string                 `json:"dstport,omitempty"`
	Protocol        string                 `json:"protocol,omitempty"`
	Action          string                 `json:"action,omitempty"`
}

// AlertRule represents the rule that triggered the alert
type AlertRule struct {
	ID          string   `json:"id"`
	Level       int      `json:"level"`
	Description string   `json:"description"`
	Groups      []string `json:"groups"`
	MITRE       *MITRE   `json:"mitre,omitempty"`
	PCI_DSS     []string `json:"pci_dss,omitempty"`
	GDPR        []string `json:"gdpr,omitempty"`
	HIPAA       []string `json:"hipaa,omitempty"`
	NIST        []string `json:"nist_800_53,omitempty"`
}

// MITRE represents MITRE ATT&CK mapping
type MITRE struct {
	ID        []string `json:"id"`
	Tactic    []string `json:"tactic"`
	Technique []string `json:"technique"`
}

// Agent represents a Wazuh agent
type Agent struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	IP      string `json:"ip"`
	Status  string `json:"status"`
	Version string `json:"version"`
	OS      OS     `json:"os"`
}

// OS represents operating system information
type OS struct {
	Name     string `json:"name"`
	Platform string `json:"platform"`
	Version  string `json:"version"`
	Arch     string `json:"arch"`
}

// Manager represents the Wazuh manager
type Manager struct {
	Name string `json:"name"`
}

// Decoder represents the decoder used
type Decoder struct {
	Name   string `json:"name"`
	Parent string `json:"parent,omitempty"`
}

// Vulnerability represents a detected vulnerability
type Vulnerability struct {
	ID          string    `json:"id"`
	CVE         string    `json:"cve"`
	Title       string    `json:"title"`
	Severity    string    `json:"severity"`
	CVSS        float64   `json:"cvss"`
	Package     string    `json:"package"`
	Version     string    `json:"version"`
	FixedIn     string    `json:"fixed_in,omitempty"`
	Agent       string    `json:"agent"`
	DetectedAt  time.Time `json:"detected_at"`
	Status      string    `json:"status"`
}

// SCAResult represents Security Configuration Assessment result
type SCAResult struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	PolicyName  string    `json:"policy_name"`
	CheckID     string    `json:"check_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Rationale   string    `json:"rationale"`
	Remediation string    `json:"remediation"`
	Result      string    `json:"result"`
	Agent       string    `json:"agent"`
	ScannedAt   time.Time `json:"scanned_at"`
}

// FileIntegrityEvent represents a file integrity monitoring event
type FileIntegrityEvent struct {
	Path        string    `json:"path"`
	Mode        string    `json:"mode"`
	UID         int       `json:"uid"`
	GID         int       `json:"gid"`
	Size        int64     `json:"size"`
	MD5         string    `json:"md5"`
	SHA1        string    `json:"sha1"`
	SHA256      string    `json:"sha256"`
	Event       string    `json:"event"`
	Agent       string    `json:"agent"`
	Timestamp   time.Time `json:"timestamp"`
}

// IncidentTicket represents an incident ticket
type IncidentTicket struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Severity    string    `json:"severity"`
	Status      string    `json:"status"`
	AlertIDs    []string  `json:"alert_ids"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	AssignedTo  string    `json:"assigned_to,omitempty"`
}

// Client provides Wazuh integration
type Client struct {
	config     Config
	httpClient *http.Client
	authToken  string
	tokenExp   time.Time
	mu         sync.RWMutex
	
	// Cached data
	agents          map[string]*Agent
	recentAlerts    []Alert
	vulnerabilities []Vulnerability
	
	// Alert handlers
	alertHandlers   []func(Alert)
	
	// Metrics
	alertsProcessed int64
	incidentsCreated int64
}

// NewClient creates a new Wazuh client
func NewClient(config Config) *Client {
	if config.RefreshInterval == 0 {
		config.RefreshInterval = 30 * time.Second
	}
	if config.AlertThreshold == 0 {
		config.AlertThreshold = 10
	}
	
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		agents: make(map[string]*Agent),
	}
}

// Start begins the Wazuh integration
func (c *Client) Start(ctx context.Context) error {
	// Authenticate
	if err := c.authenticate(ctx); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}
	
	// Initial sync
	if err := c.syncAgents(ctx); err != nil {
		return fmt.Errorf("agent sync failed: %w", err)
	}
	
	// Start background tasks
	go c.backgroundSync(ctx)
	go c.alertPoller(ctx)
	
	return nil
}

// authenticate obtains an API token
func (c *Client) authenticate(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.ManagerURL+"/security/user/authenticate", nil)
	if err != nil {
		return err
	}
	
	req.SetBasicAuth(c.config.APIUser, c.config.APIPassword)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("auth failed: %s - %s", resp.Status, string(body))
	}
	
	var result struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	
	c.mu.Lock()
	c.authToken = result.Data.Token
	c.tokenExp = time.Now().Add(15 * time.Minute)
	c.mu.Unlock()
	
	return nil
}

// ensureAuthenticated checks and refreshes token if needed
func (c *Client) ensureAuthenticated(ctx context.Context) error {
	c.mu.RLock()
	expired := time.Now().After(c.tokenExp.Add(-1 * time.Minute))
	c.mu.RUnlock()
	
	if expired {
		return c.authenticate(ctx)
	}
	return nil
}

// backgroundSync periodically syncs agent and vulnerability data
func (c *Client) backgroundSync(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.ensureAuthenticated(ctx); err != nil {
				fmt.Printf("Wazuh auth error: %v\n", err)
				continue
			}
			
			if err := c.syncAgents(ctx); err != nil {
				fmt.Printf("Agent sync error: %v\n", err)
			}
			
			if err := c.syncVulnerabilities(ctx); err != nil {
				fmt.Printf("Vulnerability sync error: %v\n", err)
			}
		}
	}
}

// alertPoller polls for new alerts
func (c *Client) alertPoller(ctx context.Context) {
	ticker := time.NewTicker(c.config.RefreshInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.ensureAuthenticated(ctx); err != nil {
				continue
			}
			
			alerts, err := c.fetchRecentAlerts(ctx)
			if err != nil {
				fmt.Printf("Alert fetch error: %v\n", err)
				continue
			}
			
			for _, alert := range alerts {
				c.processAlert(alert)
			}
		}
	}
}

// syncAgents fetches agent information
func (c *Client) syncAgents(ctx context.Context) error {
	req, err := c.newRequest(ctx, "GET", "/agents", nil)
	if err != nil {
		return err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("agent fetch failed: %s", resp.Status)
	}
	
	var result struct {
		Data struct {
			AffectedItems []Agent `json:"affected_items"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	
	c.mu.Lock()
	c.agents = make(map[string]*Agent)
	for i := range result.Data.AffectedItems {
		agent := &result.Data.AffectedItems[i]
		c.agents[agent.ID] = agent
	}
	c.mu.Unlock()
	
	return nil
}

// syncVulnerabilities fetches vulnerability data
func (c *Client) syncVulnerabilities(ctx context.Context) error {
	req, err := c.newRequest(ctx, "GET", "/vulnerability", nil)
	if err != nil {
		return err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("vulnerability fetch failed: %s", resp.Status)
	}
	
	var result struct {
		Data struct {
			AffectedItems []Vulnerability `json:"affected_items"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	
	c.mu.Lock()
	c.vulnerabilities = result.Data.AffectedItems
	c.mu.Unlock()
	
	return nil
}

// fetchRecentAlerts retrieves recent alerts
func (c *Client) fetchRecentAlerts(ctx context.Context) ([]Alert, error) {
	req, err := c.newRequest(ctx, "GET", "/alerts?limit=100&sort=-timestamp", nil)
	if err != nil {
		return nil, err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alert fetch failed: %s", resp.Status)
	}
	
	var result struct {
		Data struct {
			AffectedItems []Alert `json:"affected_items"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return result.Data.AffectedItems, nil
}

// processAlert handles a security alert
func (c *Client) processAlert(alert Alert) {
	c.mu.Lock()
	c.alertsProcessed++
	c.recentAlerts = append(c.recentAlerts, alert)
	if len(c.recentAlerts) > 1000 {
		c.recentAlerts = c.recentAlerts[100:]
	}
	c.mu.Unlock()
	
	// Forward to audit log
	c.forwardToAuditLog(alert)
	
	// Create incident if high severity
	if alert.Rule.Level >= c.config.AlertThreshold {
		c.createIncident(alert)
	}
	
	// Send webhook notification
	if alert.Rule.Level >= 12 {
		c.sendAlertWebhook(alert)
	}
	
	// Call registered handlers
	for _, handler := range c.alertHandlers {
		handler(alert)
	}
}

// forwardToAuditLog sends alert to audit log service
func (c *Client) forwardToAuditLog(alert Alert) {
	if c.config.AuditLogURL == "" {
		return
	}
	
	auditEvent := map[string]interface{}{
		"event_type":  "security_alert",
		"source":      "wazuh",
		"severity":    c.levelToSeverity(alert.Rule.Level),
		"timestamp":   alert.Timestamp,
		"alert_id":    alert.ID,
		"rule_id":     alert.Rule.ID,
		"description": alert.Rule.Description,
		"agent":       alert.Agent.Name,
		"agent_ip":    alert.Agent.IP,
		"source_ip":   alert.SrcIP,
		"dest_ip":     alert.DstIP,
		"location":    alert.Location,
		"full_log":    alert.FullLog,
		"mitre":       alert.Rule.MITRE,
		"compliance": map[string]interface{}{
			"pci_dss": alert.Rule.PCI_DSS,
			"gdpr":    alert.Rule.GDPR,
			"hipaa":   alert.Rule.HIPAA,
			"nist":    alert.Rule.NIST,
		},
	}
	
	body, _ := json.Marshal(auditEvent)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.AuditLogURL+"/api/v1/events", bytes.NewReader(body))
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// createIncident creates an incident ticket
func (c *Client) createIncident(alert Alert) {
	if c.config.IncidentURL == "" {
		return
	}
	
	incident := IncidentTicket{
		Title:       fmt.Sprintf("[%s] %s", c.levelToSeverity(alert.Rule.Level), alert.Rule.Description),
		Description: fmt.Sprintf("Security alert from Wazuh\n\nAgent: %s (%s)\nRule: %s\nLocation: %s\n\nFull Log:\n%s",
			alert.Agent.Name, alert.Agent.IP, alert.Rule.ID, alert.Location, alert.FullLog),
		Severity:    c.levelToSeverity(alert.Rule.Level),
		Status:      "open",
		AlertIDs:    []string{alert.ID},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	
	body, _ := json.Marshal(incident)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.IncidentURL+"/api/v1/incidents", bytes.NewReader(body))
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		c.mu.Lock()
		c.incidentsCreated++
		c.mu.Unlock()
	}
}

// sendAlertWebhook sends critical alerts to webhook
func (c *Client) sendAlertWebhook(alert Alert) {
	if c.config.AlertWebhookURL == "" {
		return
	}
	
	webhook := map[string]interface{}{
		"source":      "wazuh",
		"alert_id":    alert.ID,
		"timestamp":   alert.Timestamp,
		"severity":    c.levelToSeverity(alert.Rule.Level),
		"level":       alert.Rule.Level,
		"rule_id":     alert.Rule.ID,
		"description": alert.Rule.Description,
		"agent":       alert.Agent.Name,
		"agent_ip":    alert.Agent.IP,
		"source_ip":   alert.SrcIP,
		"location":    alert.Location,
		"groups":      alert.Rule.Groups,
	}
	
	body, _ := json.Marshal(webhook)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.config.AlertWebhookURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// levelToSeverity converts Wazuh level to severity string
func (c *Client) levelToSeverity(level int) string {
	switch {
	case level >= 15:
		return "critical"
	case level >= 12:
		return "high"
	case level >= 7:
		return "medium"
	case level >= 4:
		return "low"
	default:
		return "info"
	}
}

// newRequest creates a new authenticated request
func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.config.ManagerURL+path, body)
	if err != nil {
		return nil, err
	}
	
	c.mu.RLock()
	token := c.authToken
	c.mu.RUnlock()
	
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	
	return req, nil
}

// RegisterAlertHandler registers a handler for alerts
func (c *Client) RegisterAlertHandler(handler func(Alert)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.alertHandlers = append(c.alertHandlers, handler)
}

// GetAgents returns all agents
func (c *Client) GetAgents() []Agent {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	var agents []Agent
	for _, agent := range c.agents {
		agents = append(agents, *agent)
	}
	return agents
}

// GetVulnerabilities returns all vulnerabilities
func (c *Client) GetVulnerabilities() []Vulnerability {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.vulnerabilities
}

// GetRecentAlerts returns recent alerts
func (c *Client) GetRecentAlerts(limit int) []Alert {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if limit <= 0 || limit > len(c.recentAlerts) {
		limit = len(c.recentAlerts)
	}
	
	start := len(c.recentAlerts) - limit
	if start < 0 {
		start = 0
	}
	
	return c.recentAlerts[start:]
}

// GetStats returns integration statistics
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return map[string]interface{}{
		"agents_count":      len(c.agents),
		"alerts_processed":  c.alertsProcessed,
		"incidents_created": c.incidentsCreated,
		"vulnerabilities":   len(c.vulnerabilities),
		"recent_alerts":     len(c.recentAlerts),
	}
}

// HealthCheck performs a health check
func (c *Client) HealthCheck(ctx context.Context) error {
	if err := c.ensureAuthenticated(ctx); err != nil {
		return err
	}
	
	req, err := c.newRequest(ctx, "GET", "/", nil)
	if err != nil {
		return err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: %s", resp.Status)
	}
	
	return nil
}
