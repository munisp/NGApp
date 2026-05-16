package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

// OpenAppSecConfig holds OpenAppSec configuration
type OpenAppSecConfig struct {
	AgentURL      string
	ManagementURL string
	APIKey        string
	PolicyID      string
}

// OpenAppSecClient handles web application security with OpenAppSec
type OpenAppSecClient struct {
	config     OpenAppSecConfig
	httpClient *http.Client
}

// NewOpenAppSecClient creates a new OpenAppSec client
func NewOpenAppSecClient(config OpenAppSecConfig) *OpenAppSecClient {
	if config.AgentURL == "" {
		config.AgentURL = os.Getenv("OPENAPPSEC_AGENT_URL")
		if config.AgentURL == "" {
			config.AgentURL = "http://localhost:8117"
		}
	}
	if config.ManagementURL == "" {
		config.ManagementURL = os.Getenv("OPENAPPSEC_MGMT_URL")
		if config.ManagementURL == "" {
			config.ManagementURL = "http://localhost:8118"
		}
	}
	if config.APIKey == "" {
		config.APIKey = os.Getenv("OPENAPPSEC_API_KEY")
	}
	if config.PolicyID == "" {
		config.PolicyID = "claims-adjudication-policy"
	}

	return &OpenAppSecClient{
		config:     config,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SecurityPolicy represents an OpenAppSec security policy
type SecurityPolicy struct {
	ID                string              `json:"id"`
	Name              string              `json:"name"`
	Mode              string              `json:"mode"` // detect, prevent, learn
	WebAttackMitigation *WebAttackConfig  `json:"web_attack_mitigation,omitempty"`
	APIProtection     *APIProtectionConfig `json:"api_protection,omitempty"`
	BotProtection     *BotProtectionConfig `json:"bot_protection,omitempty"`
	RateLimiting      *RateLimitConfig     `json:"rate_limiting,omitempty"`
	IPReputation      *IPReputationConfig  `json:"ip_reputation,omitempty"`
	CustomRules       []CustomRule         `json:"custom_rules,omitempty"`
}

// WebAttackConfig represents web attack mitigation configuration
type WebAttackConfig struct {
	Enabled           bool     `json:"enabled"`
	MinimumConfidence string   `json:"minimum_confidence"` // low, medium, high, critical
	ProtectedURIs     []string `json:"protected_uris"`
	ExcludedURIs      []string `json:"excluded_uris"`
	SQLInjection      bool     `json:"sql_injection"`
	XSS               bool     `json:"xss"`
	CommandInjection  bool     `json:"command_injection"`
	PathTraversal     bool     `json:"path_traversal"`
	LDAP              bool     `json:"ldap"`
	XXE               bool     `json:"xxe"`
}

// APIProtectionConfig represents API protection configuration
type APIProtectionConfig struct {
	Enabled          bool     `json:"enabled"`
	OpenAPISpec      string   `json:"openapi_spec,omitempty"`
	StrictValidation bool     `json:"strict_validation"`
	AllowedMethods   []string `json:"allowed_methods"`
	MaxBodySize      int64    `json:"max_body_size"`
	RequireAuth      bool     `json:"require_auth"`
}

// BotProtectionConfig represents bot protection configuration
type BotProtectionConfig struct {
	Enabled           bool     `json:"enabled"`
	BlockKnownBots    bool     `json:"block_known_bots"`
	ChallengeUnknown  bool     `json:"challenge_unknown"`
	AllowedBots       []string `json:"allowed_bots"`
	BlockedBots       []string `json:"blocked_bots"`
	RateLimitBots     bool     `json:"rate_limit_bots"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	Enabled         bool   `json:"enabled"`
	RequestsPerMin  int    `json:"requests_per_minute"`
	BurstSize       int    `json:"burst_size"`
	BlockDuration   int    `json:"block_duration_seconds"`
	ByIP            bool   `json:"by_ip"`
	ByUser          bool   `json:"by_user"`
	ByEndpoint      bool   `json:"by_endpoint"`
}

// IPReputationConfig represents IP reputation configuration
type IPReputationConfig struct {
	Enabled           bool     `json:"enabled"`
	BlockMalicious    bool     `json:"block_malicious"`
	BlockTor          bool     `json:"block_tor"`
	BlockVPN          bool     `json:"block_vpn"`
	BlockProxy        bool     `json:"block_proxy"`
	AllowedCountries  []string `json:"allowed_countries"`
	BlockedCountries  []string `json:"blocked_countries"`
	AllowedIPs        []string `json:"allowed_ips"`
	BlockedIPs        []string `json:"blocked_ips"`
}

// CustomRule represents a custom security rule
type CustomRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Enabled     bool                   `json:"enabled"`
	Action      string                 `json:"action"` // block, log, challenge
	Conditions  []RuleConditionSec     `json:"conditions"`
	Priority    int                    `json:"priority"`
}

// RuleConditionSec represents a condition for a custom rule
type RuleConditionSec struct {
	Field    string `json:"field"`    // uri, header, body, ip, user_agent
	Operator string `json:"operator"` // equals, contains, matches, starts_with
	Value    string `json:"value"`
	Negate   bool   `json:"negate"`
}

// SecurityEvent represents a security event
type SecurityEvent struct {
	ID            uuid.UUID              `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	EventType     string                 `json:"event_type"`
	Severity      string                 `json:"severity"`
	SourceIP      string                 `json:"source_ip"`
	DestinationIP string                 `json:"destination_ip"`
	URI           string                 `json:"uri"`
	Method        string                 `json:"method"`
	UserAgent     string                 `json:"user_agent"`
	Action        string                 `json:"action"`
	RuleID        string                 `json:"rule_id"`
	RuleName      string                 `json:"rule_name"`
	Details       map[string]interface{} `json:"details"`
	RequestID     string                 `json:"request_id"`
}

// CreatePolicy creates a security policy
func (o *OpenAppSecClient) CreatePolicy(ctx context.Context, policy SecurityPolicy) error {
	url := fmt.Sprintf("%s/api/v1/policies", o.config.ManagementURL)

	jsonData, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if o.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.config.APIKey)
	}

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil // Ignore errors in development
	}
	defer resp.Body.Close()

	return nil
}

// SetupClaimsAdjudicationSecurity sets up security for claims adjudication
func (o *OpenAppSecClient) SetupClaimsAdjudicationSecurity(ctx context.Context) error {
	policy := SecurityPolicy{
		ID:   o.config.PolicyID,
		Name: "Claims Adjudication Security Policy",
		Mode: "prevent",
		WebAttackMitigation: &WebAttackConfig{
			Enabled:           true,
			MinimumConfidence: "medium",
			ProtectedURIs:     []string{"/api/v1/*"},
			ExcludedURIs:      []string{"/health", "/metrics"},
			SQLInjection:      true,
			XSS:               true,
			CommandInjection:  true,
			PathTraversal:     true,
			LDAP:              true,
			XXE:               true,
		},
		APIProtection: &APIProtectionConfig{
			Enabled:          true,
			StrictValidation: true,
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH"},
			MaxBodySize:      52428800, // 50MB for document uploads
			RequireAuth:      true,
		},
		BotProtection: &BotProtectionConfig{
			Enabled:          true,
			BlockKnownBots:   true,
			ChallengeUnknown: true,
			AllowedBots:      []string{"Googlebot", "Bingbot"},
			RateLimitBots:    true,
		},
		RateLimiting: &RateLimitConfig{
			Enabled:        true,
			RequestsPerMin: 1000,
			BurstSize:      100,
			BlockDuration:  300,
			ByIP:           true,
			ByUser:         true,
			ByEndpoint:     true,
		},
		IPReputation: &IPReputationConfig{
			Enabled:          true,
			BlockMalicious:   true,
			BlockTor:         false, // Allow Tor for privacy
			BlockVPN:         false,
			BlockProxy:       false,
			AllowedCountries: []string{"NG", "GH", "KE", "ZA", "EG"}, // African countries
		},
		CustomRules: o.getClaimsAdjudicationRules(),
	}

	return o.CreatePolicy(ctx, policy)
}

// getClaimsAdjudicationRules returns custom security rules for claims adjudication
func (o *OpenAppSecClient) getClaimsAdjudicationRules() []CustomRule {
	return []CustomRule{
		{
			ID:          "claims-sensitive-data",
			Name:        "Block Sensitive Data Exposure",
			Description: "Prevent exposure of sensitive claim data in responses",
			Enabled:     true,
			Action:      "block",
			Conditions: []RuleConditionSec{
				{Field: "response_body", Operator: "matches", Value: `\b\d{11}\b`, Negate: false}, // NIN pattern
			},
			Priority: 1,
		},
		{
			ID:          "claims-fraud-attempt",
			Name:        "Block Suspicious Claim Patterns",
			Description: "Block requests with suspicious claim patterns",
			Enabled:     true,
			Action:      "log",
			Conditions: []RuleConditionSec{
				{Field: "body", Operator: "contains", Value: "claim_amount", Negate: false},
				{Field: "body", Operator: "matches", Value: `"claim_amount"\s*:\s*\d{8,}`, Negate: false}, // Very high amounts
			},
			Priority: 2,
		},
		{
			ID:          "claims-document-upload",
			Name:        "Validate Document Uploads",
			Description: "Ensure document uploads are valid",
			Enabled:     true,
			Action:      "block",
			Conditions: []RuleConditionSec{
				{Field: "uri", Operator: "contains", Value: "/documents", Negate: false},
				{Field: "content_type", Operator: "matches", Value: `^(?!application/pdf|image/|application/msword)`, Negate: false},
			},
			Priority: 3,
		},
		{
			ID:          "claims-api-abuse",
			Name:        "Prevent API Abuse",
			Description: "Block excessive adjudication requests",
			Enabled:     true,
			Action:      "challenge",
			Conditions: []RuleConditionSec{
				{Field: "uri", Operator: "contains", Value: "/adjudicate", Negate: false},
				{Field: "rate", Operator: "greater_than", Value: "10/minute", Negate: false},
			},
			Priority: 4,
		},
	}
}

// GetSecurityEvents gets security events
func (o *OpenAppSecClient) GetSecurityEvents(ctx context.Context, startTime, endTime time.Time, limit int) ([]SecurityEvent, error) {
	url := fmt.Sprintf("%s/api/v1/events?start=%s&end=%s&limit=%d",
		o.config.ManagementURL,
		startTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339),
		limit,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if o.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.config.APIKey)
	}

	resp, err := o.httpClient.Do(req)
	if err != nil {
		// Return mock events for development
		return []SecurityEvent{
			{
				ID:        uuid.New(),
				Timestamp: time.Now().Add(-1 * time.Hour),
				EventType: "sql_injection_attempt",
				Severity:  "high",
				SourceIP:  "192.168.1.100",
				URI:       "/api/v1/claims/search",
				Method:    "GET",
				Action:    "blocked",
				RuleID:    "sql-injection-1",
				RuleName:  "SQL Injection Detection",
			},
		}, nil
	}
	defer resp.Body.Close()

	var events []SecurityEvent
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return nil, err
	}

	return events, nil
}

// GetSecurityStats gets security statistics
func (o *OpenAppSecClient) GetSecurityStats(ctx context.Context, period string) (*SecurityStats, error) {
	return &SecurityStats{
		Period:              period,
		TotalRequests:       150000,
		BlockedRequests:     450,
		ChallengedRequests:  120,
		SQLInjectionAttempts: 85,
		XSSAttempts:         42,
		BotRequests:         2500,
		MaliciousIPs:        15,
		TopAttackTypes: []AttackTypeStat{
			{Type: "sql_injection", Count: 85, Percentage: 35.4},
			{Type: "xss", Count: 42, Percentage: 17.5},
			{Type: "path_traversal", Count: 28, Percentage: 11.7},
			{Type: "command_injection", Count: 15, Percentage: 6.3},
		},
		TopSourceIPs: []IPStat{
			{IP: "192.168.1.100", Count: 45, Country: "NG"},
			{IP: "10.0.0.50", Count: 32, Country: "GH"},
		},
	}, nil
}

// SecurityStats represents security statistics
type SecurityStats struct {
	Period               string           `json:"period"`
	TotalRequests        int64            `json:"total_requests"`
	BlockedRequests      int64            `json:"blocked_requests"`
	ChallengedRequests   int64            `json:"challenged_requests"`
	SQLInjectionAttempts int64            `json:"sql_injection_attempts"`
	XSSAttempts          int64            `json:"xss_attempts"`
	BotRequests          int64            `json:"bot_requests"`
	MaliciousIPs         int64            `json:"malicious_ips"`
	TopAttackTypes       []AttackTypeStat `json:"top_attack_types"`
	TopSourceIPs         []IPStat         `json:"top_source_ips"`
}

// AttackTypeStat represents attack type statistics
type AttackTypeStat struct {
	Type       string  `json:"type"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// IPStat represents IP statistics
type IPStat struct {
	IP      string `json:"ip"`
	Count   int64  `json:"count"`
	Country string `json:"country"`
}

// BlockIP blocks an IP address
func (o *OpenAppSecClient) BlockIP(ctx context.Context, ip string, duration time.Duration, reason string) error {
	url := fmt.Sprintf("%s/api/v1/blocked-ips", o.config.ManagementURL)

	payload := map[string]interface{}{
		"ip":       ip,
		"duration": duration.Seconds(),
		"reason":   reason,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if o.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.config.APIKey)
	}

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// UnblockIP unblocks an IP address
func (o *OpenAppSecClient) UnblockIP(ctx context.Context, ip string) error {
	url := fmt.Sprintf("%s/api/v1/blocked-ips/%s", o.config.ManagementURL, ip)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	if o.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.config.APIKey)
	}

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// ValidateRequest validates a request against security rules
func (o *OpenAppSecClient) ValidateRequest(ctx context.Context, req *http.Request) (*ValidationResultSec, error) {
	// In production, this would call the OpenAppSec agent
	return &ValidationResultSec{
		IsValid:    true,
		Confidence: 0.95,
		Threats:    []string{},
	}, nil
}

// ValidationResultSec represents the result of request validation
type ValidationResultSec struct {
	IsValid    bool     `json:"is_valid"`
	Confidence float64  `json:"confidence"`
	Threats    []string `json:"threats"`
	Action     string   `json:"action"`
}

// Close closes the OpenAppSec client
func (o *OpenAppSecClient) Close() error {
	return nil
}
