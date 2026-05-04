// Package integration provides infrastructure integration components
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// OpenAppSecClient integrates with open-appsec WAF for runtime application protection
// Provides: WAF policy management, threat intelligence feeds, attack blocking,
// ML-based anomaly detection, and API security enforcement
type OpenAppSecClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	policies   map[string]*WAFPolicy
	mu         sync.RWMutex
}

// WAFPolicy defines a web application firewall policy
type WAFPolicy struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Mode        string            `json:"mode"` // "detect", "prevent", "learn"
	Rules       []WAFRule         `json:"rules"`
	Exclusions  []string          `json:"exclusions"`
	RateLimit   *RateLimitPolicy  `json:"rate_limit,omitempty"`
	GeoBlocking *GeoBlockPolicy   `json:"geo_blocking,omitempty"`
	BotProtect  *BotProtectPolicy `json:"bot_protection,omitempty"`
	Enabled     bool              `json:"enabled"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// WAFRule defines an individual WAF rule
type WAFRule struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Category string   `json:"category"` // "sqli", "xss", "rfi", "lfi", "cmdi", "custom"
	Action   string   `json:"action"`   // "block", "detect", "challenge"
	Severity string   `json:"severity"` // "critical", "high", "medium", "low"
	Patterns []string `json:"patterns"`
	Targets  []string `json:"targets"` // "headers", "body", "query", "uri"
	Enabled  bool     `json:"enabled"`
}

// RateLimitPolicy defines rate limiting for WAF
type RateLimitPolicy struct {
	RequestsPerSecond int    `json:"requests_per_second"`
	BurstSize         int    `json:"burst_size"`
	BlockDurationSec  int    `json:"block_duration_sec"`
	KeyBy             string `json:"key_by"` // "ip", "header", "cookie"
}

// GeoBlockPolicy defines geographic blocking
type GeoBlockPolicy struct {
	AllowedCountries []string `json:"allowed_countries"`
	BlockedCountries []string `json:"blocked_countries"`
	Action           string   `json:"action"` // "block", "challenge"
}

// BotProtectPolicy defines bot protection settings
type BotProtectPolicy struct {
	Enabled        bool     `json:"enabled"`
	ChallengeMode  string   `json:"challenge_mode"` // "js", "captcha"
	AllowedBots    []string `json:"allowed_bots"`
	BlockKnownBots bool     `json:"block_known_bots"`
	MLDetection    bool     `json:"ml_detection"`
}

// ThreatEvent represents a detected security threat
type ThreatEvent struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	SourceIP   string    `json:"source_ip"`
	Country    string    `json:"country"`
	AttackType string    `json:"attack_type"`
	Severity   string    `json:"severity"`
	URI        string    `json:"uri"`
	Method     string    `json:"method"`
	Action     string    `json:"action_taken"`
	RuleID     string    `json:"rule_id"`
	Payload    string    `json:"payload,omitempty"`
	UserAgent  string    `json:"user_agent"`
}

// OpenAppSecConfig holds configuration
type OpenAppSecConfig struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Timeout int    `json:"timeout_sec"`
}

// DefaultOpenAppSecConfig returns default configuration
func DefaultOpenAppSecConfig() *OpenAppSecConfig {
	return &OpenAppSecConfig{
		BaseURL: "http://localhost:4000",
		APIKey:  "openappsec-dev-key",
		Timeout: 10,
	}
}

// NewOpenAppSecClient creates a new OpenAppSec WAF client
func NewOpenAppSecClient(cfg *OpenAppSecConfig) *OpenAppSecClient {
	if cfg == nil {
		cfg = DefaultOpenAppSecConfig()
	}

	return &OpenAppSecClient{
		baseURL: cfg.BaseURL,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.Timeout) * time.Second,
		},
		policies: make(map[string]*WAFPolicy),
	}
}

// CreatePolicy creates a new WAF policy
func (c *OpenAppSecClient) CreatePolicy(ctx context.Context, policy *WAFPolicy) error {
	data, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("marshal policy: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/policies", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("create policy failed: status %d", resp.StatusCode)
	}

	c.mu.Lock()
	c.policies[policy.ID] = policy
	c.mu.Unlock()

	return nil
}

// GetThreatEvents retrieves recent threat events
func (c *OpenAppSecClient) GetThreatEvents(ctx context.Context, since time.Time, limit int) ([]ThreatEvent, error) {
	url := fmt.Sprintf("%s/api/v1/events?since=%s&limit=%d",
		c.baseURL, since.Format(time.RFC3339), limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get events: %w", err)
	}
	defer resp.Body.Close()

	var events []ThreatEvent
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return nil, fmt.Errorf("decode events: %w", err)
	}

	return events, nil
}

// DefaultPaymentSwitchPolicy returns a production WAF policy for payment switches
func DefaultPaymentSwitchPolicy() *WAFPolicy {
	return &WAFPolicy{
		ID:   "payment-switch-waf",
		Name: "Payment Switch Protection",
		Mode: "prevent",
		Rules: []WAFRule{
			{ID: "sql-injection", Name: "SQL Injection Protection", Category: "sqli", Action: "block", Severity: "critical", Targets: []string{"body", "query"}, Enabled: true},
			{ID: "xss-protection", Name: "Cross-Site Scripting", Category: "xss", Action: "block", Severity: "high", Targets: []string{"body", "headers"}, Enabled: true},
			{ID: "api-abuse", Name: "API Abuse Detection", Category: "custom", Action: "block", Severity: "high", Targets: []string{"uri", "body"}, Enabled: true},
			{ID: "credential-stuffing", Name: "Credential Stuffing", Category: "custom", Action: "challenge", Severity: "critical", Targets: []string{"body"}, Enabled: true},
			{ID: "payment-tampering", Name: "Payment Data Tampering", Category: "custom", Action: "block", Severity: "critical", Targets: []string{"body"}, Enabled: true},
			{ID: "account-takeover", Name: "Account Takeover Prevention", Category: "custom", Action: "block", Severity: "critical", Targets: []string{"headers", "body"}, Enabled: true},
		},
		RateLimit: &RateLimitPolicy{
			RequestsPerSecond: 100,
			BurstSize:         200,
			BlockDurationSec:  300,
			KeyBy:             "ip",
		},
		GeoBlocking: &GeoBlockPolicy{
			AllowedCountries: []string{"NG", "GH", "KE", "ZA", "TZ", "UG", "RW", "SN", "CI", "CM"},
			Action:           "challenge",
		},
		BotProtect: &BotProtectPolicy{
			Enabled:        true,
			ChallengeMode:  "js",
			BlockKnownBots: true,
			MLDetection:    true,
			AllowedBots:    []string{"googlebot", "bingbot", "monitoring"},
		},
		Enabled: true,
	}
}
