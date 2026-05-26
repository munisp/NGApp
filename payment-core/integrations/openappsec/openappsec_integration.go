// Package openappsec provides integration with OpenAppSec WAF/API security
package openappsec

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

// Config holds OpenAppSec configuration
type Config struct {
	ManagementURL    string
	AgentURL         string
	APIKey           string
	AlertWebhookURL  string
	PrometheusURL    string
	RefreshInterval  time.Duration
	EnableBlocking   bool
	EnableLearning   bool
}

// SecurityEvent represents a security event from OpenAppSec
type SecurityEvent struct {
	ID              string                 `json:"id"`
	Timestamp       time.Time              `json:"timestamp"`
	EventType       string                 `json:"event_type"`
	Severity        string                 `json:"severity"`
	SourceIP        string                 `json:"source_ip"`
	DestinationIP   string                 `json:"destination_ip"`
	RequestMethod   string                 `json:"request_method"`
	RequestPath     string                 `json:"request_path"`
	RequestHeaders  map[string]string      `json:"request_headers"`
	AttackType      string                 `json:"attack_type"`
	AttackDetails   string                 `json:"attack_details"`
	Action          string                 `json:"action"`
	RuleID          string                 `json:"rule_id"`
	RuleName        string                 `json:"rule_name"`
	Confidence      float64                `json:"confidence"`
	GeoLocation     *GeoLocation           `json:"geo_location,omitempty"`
	UserAgent       string                 `json:"user_agent"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// GeoLocation represents geographic location data
type GeoLocation struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	City        string  `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// ThreatIntelligence represents threat intelligence data
type ThreatIntelligence struct {
	IPAddress       string    `json:"ip_address"`
	ThreatType      string    `json:"threat_type"`
	ThreatScore     float64   `json:"threat_score"`
	Source          string    `json:"source"`
	FirstSeen       time.Time `json:"first_seen"`
	LastSeen        time.Time `json:"last_seen"`
	IsBlocked       bool      `json:"is_blocked"`
	AssociatedIOCs  []string  `json:"associated_iocs"`
}

// PolicyRule represents a WAF policy rule
type PolicyRule struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Enabled     bool     `json:"enabled"`
	Action      string   `json:"action"`
	Severity    string   `json:"severity"`
	Patterns    []string `json:"patterns"`
	Exceptions  []string `json:"exceptions"`
}

// APISecurityPolicy represents API-specific security settings
type APISecurityPolicy struct {
	SchemaValidation    bool     `json:"schema_validation"`
	StrictMode          bool     `json:"strict_mode"`
	AllowedMethods      []string `json:"allowed_methods"`
	RateLimitPerSecond  int      `json:"rate_limit_per_second"`
	JWTValidation       bool     `json:"jwt_validation"`
	RequiredClaims      []string `json:"required_claims"`
}

// Client provides OpenAppSec integration
type Client struct {
	config     Config
	httpClient *http.Client
	mu         sync.RWMutex
	
	// Cached data
	blockedIPs      map[string]*ThreatIntelligence
	policyRules     []PolicyRule
	apiPolicies     map[string]*APISecurityPolicy
	
	// Event handlers
	eventHandlers   []func(SecurityEvent)
	
	// Metrics
	totalRequests   int64
	blockedRequests int64
	alertsSent      int64
}

// NewClient creates a new OpenAppSec client
func NewClient(config Config) *Client {
	if config.RefreshInterval == 0 {
		config.RefreshInterval = 5 * time.Minute
	}
	
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		blockedIPs:  make(map[string]*ThreatIntelligence),
		apiPolicies: make(map[string]*APISecurityPolicy),
	}
}

// Start begins the OpenAppSec integration
func (c *Client) Start(ctx context.Context) error {
	// Initial sync
	if err := c.syncPolicies(ctx); err != nil {
		return fmt.Errorf("initial policy sync failed: %w", err)
	}
	
	// Start background sync
	go c.backgroundSync(ctx)
	
	// Start event listener
	go c.listenForEvents(ctx)
	
	return nil
}

// backgroundSync periodically syncs policies and threat intelligence
func (c *Client) backgroundSync(ctx context.Context) {
	ticker := time.NewTicker(c.config.RefreshInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.syncPolicies(ctx); err != nil {
				fmt.Printf("Policy sync error: %v\n", err)
			}
		}
	}
}

// syncPolicies fetches latest policies from OpenAppSec management
func (c *Client) syncPolicies(ctx context.Context) error {
	// Fetch policy rules
	rules, err := c.fetchPolicyRules(ctx)
	if err != nil {
		return err
	}
	
	c.mu.Lock()
	c.policyRules = rules
	c.mu.Unlock()
	
	return nil
}

// fetchPolicyRules retrieves policy rules from management API
func (c *Client) fetchPolicyRules(ctx context.Context) ([]PolicyRule, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", 
		c.config.ManagementURL+"/api/v1/policies/rules", nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}
	
	var rules []PolicyRule
	if err := json.NewDecoder(resp.Body).Decode(&rules); err != nil {
		return nil, err
	}
	
	return rules, nil
}

// listenForEvents listens for security events from OpenAppSec
func (c *Client) listenForEvents(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			events, err := c.fetchRecentEvents(ctx)
			if err != nil {
				fmt.Printf("Event fetch error: %v\n", err)
				continue
			}
			
			for _, event := range events {
				c.processEvent(event)
			}
		}
	}
}

// fetchRecentEvents retrieves recent security events
func (c *Client) fetchRecentEvents(ctx context.Context) ([]SecurityEvent, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.ManagementURL+"/api/v1/events?since=10s", nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: %s", resp.Status)
	}
	
	var events []SecurityEvent
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return nil, err
	}
	
	return events, nil
}

// processEvent handles a security event
func (c *Client) processEvent(event SecurityEvent) {
	// Update metrics
	c.mu.Lock()
	if event.Action == "block" {
		c.blockedRequests++
	}
	c.mu.Unlock()
	
	// Forward to alert webhook if critical
	if event.Severity == "critical" || event.Severity == "high" {
		c.sendAlert(event)
	}
	
	// Call registered handlers
	for _, handler := range c.eventHandlers {
		handler(event)
	}
}

// sendAlert sends an alert to the configured webhook
func (c *Client) sendAlert(event SecurityEvent) {
	if c.config.AlertWebhookURL == "" {
		return
	}
	
	alert := map[string]interface{}{
		"source":      "openappsec",
		"event_id":    event.ID,
		"timestamp":   event.Timestamp,
		"severity":    event.Severity,
		"attack_type": event.AttackType,
		"source_ip":   event.SourceIP,
		"path":        event.RequestPath,
		"action":      event.Action,
		"details":     event.AttackDetails,
	}
	
	body, _ := json.Marshal(alert)
	
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
	
	c.mu.Lock()
	c.alertsSent++
	c.mu.Unlock()
}

// RegisterEventHandler registers a handler for security events
func (c *Client) RegisterEventHandler(handler func(SecurityEvent)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.eventHandlers = append(c.eventHandlers, handler)
}

// IsIPBlocked checks if an IP is blocked
func (c *Client) IsIPBlocked(ip string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	intel, exists := c.blockedIPs[ip]
	return exists && intel.IsBlocked
}

// BlockIP adds an IP to the blocklist
func (c *Client) BlockIP(ctx context.Context, ip string, reason string, duration time.Duration) error {
	payload := map[string]interface{}{
		"ip_address": ip,
		"reason":     reason,
		"duration":   duration.Seconds(),
		"action":     "block",
	}
	
	body, _ := json.Marshal(payload)
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.ManagementURL+"/api/v1/enforcement/ip-block", bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to block IP: %s", resp.Status)
	}
	
	// Update local cache
	c.mu.Lock()
	c.blockedIPs[ip] = &ThreatIntelligence{
		IPAddress:  ip,
		ThreatType: reason,
		IsBlocked:  true,
		FirstSeen:  time.Now(),
		LastSeen:   time.Now(),
	}
	c.mu.Unlock()
	
	return nil
}

// UnblockIP removes an IP from the blocklist
func (c *Client) UnblockIP(ctx context.Context, ip string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE",
		c.config.ManagementURL+"/api/v1/enforcement/ip-block/"+ip, nil)
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to unblock IP: %s", resp.Status)
	}
	
	// Update local cache
	c.mu.Lock()
	delete(c.blockedIPs, ip)
	c.mu.Unlock()
	
	return nil
}

// UpdateAPIPolicy updates API security policy for an endpoint
func (c *Client) UpdateAPIPolicy(ctx context.Context, endpoint string, policy *APISecurityPolicy) error {
	payload := map[string]interface{}{
		"endpoint": endpoint,
		"policy":   policy,
	}
	
	body, _ := json.Marshal(payload)
	
	req, err := http.NewRequestWithContext(ctx, "PUT",
		c.config.ManagementURL+"/api/v1/policies/api", bytes.NewReader(body))
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to update API policy: %s", resp.Status)
	}
	
	// Update local cache
	c.mu.Lock()
	c.apiPolicies[endpoint] = policy
	c.mu.Unlock()
	
	return nil
}

// GetSecurityMetrics returns current security metrics
func (c *Client) GetSecurityMetrics() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return map[string]interface{}{
		"total_requests":   c.totalRequests,
		"blocked_requests": c.blockedRequests,
		"alerts_sent":      c.alertsSent,
		"blocked_ips":      len(c.blockedIPs),
		"active_rules":     len(c.policyRules),
	}
}

// SyncWithOpenCTI syncs threat intelligence from OpenCTI
func (c *Client) SyncWithOpenCTI(ctx context.Context, iocs []ThreatIntelligence) error {
	for _, ioc := range iocs {
		if ioc.ThreatScore > 0.7 && ioc.IPAddress != "" {
			if err := c.BlockIP(ctx, ioc.IPAddress, ioc.ThreatType, 24*time.Hour); err != nil {
				fmt.Printf("Failed to block IOC IP %s: %v\n", ioc.IPAddress, err)
			}
		}
	}
	return nil
}

// APISIXPlugin represents the APISIX plugin configuration for OpenAppSec
type APISIXPlugin struct {
	Name        string                 `json:"name"`
	Config      map[string]interface{} `json:"config"`
	Priority    int                    `json:"priority"`
	Enabled     bool                   `json:"enabled"`
}

// GenerateAPISIXPluginConfig generates APISIX plugin configuration
func (c *Client) GenerateAPISIXPluginConfig() *APISIXPlugin {
	return &APISIXPlugin{
		Name:     "openappsec",
		Priority: 1000,
		Enabled:  true,
		Config: map[string]interface{}{
			"agent_url":        c.config.AgentURL,
			"mode":             "inline",
			"timeout":          5000,
			"enable_learning":  c.config.EnableLearning,
			"enable_blocking":  c.config.EnableBlocking,
			"log_level":        "info",
			"excluded_paths": []string{
				"/health",
				"/metrics",
				"/ready",
			},
		},
	}
}

// HealthCheck performs a health check on OpenAppSec
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.AgentURL+"/health", nil)
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
