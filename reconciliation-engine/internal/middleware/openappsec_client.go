package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type OpenAppSecClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type SecurityPolicy struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Mode        string                 `json:"mode"`
	Rules       []SecurityRule         `json:"rules"`
	Exceptions  []SecurityException    `json:"exceptions,omitempty"`
	RateLimits  []RateLimitRule        `json:"rate_limits,omitempty"`
	IPReputation *IPReputationConfig   `json:"ip_reputation,omitempty"`
	BotProtection *BotProtectionConfig `json:"bot_protection,omitempty"`
}

type SecurityRule struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Action      string   `json:"action"`
	Severity    string   `json:"severity"`
	Enabled     bool     `json:"enabled"`
	Conditions  []RuleCondition `json:"conditions,omitempty"`
}

type RuleCondition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type SecurityException struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Value       string   `json:"value"`
	RuleIDs     []string `json:"rule_ids,omitempty"`
}

type RateLimitRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Scope       string `json:"scope"`
	Requests    int    `json:"requests"`
	Period      int    `json:"period_seconds"`
	Action      string `json:"action"`
}

type IPReputationConfig struct {
	Enabled     bool     `json:"enabled"`
	Action      string   `json:"action"`
	Threshold   int      `json:"threshold"`
	Whitelist   []string `json:"whitelist,omitempty"`
	Blacklist   []string `json:"blacklist,omitempty"`
}

type BotProtectionConfig struct {
	Enabled         bool     `json:"enabled"`
	Mode            string   `json:"mode"`
	AllowedBots     []string `json:"allowed_bots,omitempty"`
	ChallengeAction string   `json:"challenge_action"`
}

type ThreatEvent struct {
	ID          string    `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	SourceIP    string    `json:"source_ip"`
	RequestURI  string    `json:"request_uri"`
	Method      string    `json:"method"`
	RuleID      string    `json:"rule_id"`
	RuleName    string    `json:"rule_name"`
	Action      string    `json:"action"`
	Details     string    `json:"details"`
}

type SecurityMetrics struct {
	TotalRequests     int64            `json:"total_requests"`
	BlockedRequests   int64            `json:"blocked_requests"`
	ThreatsByType     map[string]int64 `json:"threats_by_type"`
	ThreatsBySeverity map[string]int64 `json:"threats_by_severity"`
	TopAttackSources  []AttackSource   `json:"top_attack_sources"`
	Period            string           `json:"period"`
}

type AttackSource struct {
	IP          string `json:"ip"`
	Country     string `json:"country"`
	AttackCount int64  `json:"attack_count"`
}

func NewOpenAppSecClient(baseURL, apiKey string) (*OpenAppSecClient, error) {
	return &OpenAppSecClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func (o *OpenAppSecClient) CreatePolicy(ctx context.Context, policy *SecurityPolicy) error {
	url := fmt.Sprintf("%s/api/v1/policies", o.baseURL)

	jsonData, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("failed to marshal policy: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create policy failed: %s", string(body))
	}

	return nil
}

func (o *OpenAppSecClient) UpdatePolicy(ctx context.Context, policy *SecurityPolicy) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s", o.baseURL, policy.ID)

	jsonData, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("failed to marshal policy: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update policy: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (o *OpenAppSecClient) GetThreatEvents(ctx context.Context, startTime, endTime time.Time, limit int) ([]ThreatEvent, error) {
	url := fmt.Sprintf("%s/api/v1/events?start=%s&end=%s&limit=%d",
		o.baseURL,
		startTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339),
		limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get threat events: %w", err)
	}
	defer resp.Body.Close()

	var events []ThreatEvent
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return nil, fmt.Errorf("failed to decode events: %w", err)
	}

	return events, nil
}

func (o *OpenAppSecClient) GetSecurityMetrics(ctx context.Context, period string) (*SecurityMetrics, error) {
	url := fmt.Sprintf("%s/api/v1/metrics?period=%s", o.baseURL, period)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get metrics: %w", err)
	}
	defer resp.Body.Close()

	var metrics SecurityMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode metrics: %w", err)
	}

	return &metrics, nil
}

func (o *OpenAppSecClient) SetupReconciliationSecurity(ctx context.Context) error {
	policy := &SecurityPolicy{
		ID:   "reconciliation-security",
		Name: "Reconciliation Engine Security Policy",
		Mode: "prevent",
		Rules: []SecurityRule{
			{
				ID:       "sql-injection",
				Name:     "SQL Injection Protection",
				Type:     "sql_injection",
				Action:   "block",
				Severity: "high",
				Enabled:  true,
			},
			{
				ID:       "xss-protection",
				Name:     "XSS Protection",
				Type:     "xss",
				Action:   "block",
				Severity: "high",
				Enabled:  true,
			},
			{
				ID:       "path-traversal",
				Name:     "Path Traversal Protection",
				Type:     "path_traversal",
				Action:   "block",
				Severity: "high",
				Enabled:  true,
			},
			{
				ID:       "command-injection",
				Name:     "Command Injection Protection",
				Type:     "command_injection",
				Action:   "block",
				Severity: "critical",
				Enabled:  true,
			},
			{
				ID:       "sensitive-data",
				Name:     "Sensitive Data Exposure",
				Type:     "data_exposure",
				Action:   "block",
				Severity: "high",
				Enabled:  true,
				Conditions: []RuleCondition{
					{Field: "response_body", Operator: "contains", Value: "account_number"},
					{Field: "response_body", Operator: "contains", Value: "bank_code"},
				},
			},
		},
		RateLimits: []RateLimitRule{
			{
				ID:       "api-rate-limit",
				Name:     "API Rate Limit",
				Scope:    "ip",
				Requests: 1000,
				Period:   60,
				Action:   "block",
			},
			{
				ID:       "statement-upload-limit",
				Name:     "Statement Upload Rate Limit",
				Scope:    "user",
				Requests: 10,
				Period:   60,
				Action:   "block",
			},
		},
		IPReputation: &IPReputationConfig{
			Enabled:   true,
			Action:    "challenge",
			Threshold: 50,
		},
		BotProtection: &BotProtectionConfig{
			Enabled:         true,
			Mode:            "challenge",
			AllowedBots:     []string{"googlebot", "bingbot"},
			ChallengeAction: "captcha",
		},
	}

	return o.CreatePolicy(ctx, policy)
}

func (o *OpenAppSecClient) AddIPToBlacklist(ctx context.Context, ip string, reason string) error {
	url := fmt.Sprintf("%s/api/v1/blacklist", o.baseURL)

	data := map[string]string{
		"ip":     ip,
		"reason": reason,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to add to blacklist: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (o *OpenAppSecClient) AddIPToWhitelist(ctx context.Context, ip string, reason string) error {
	url := fmt.Sprintf("%s/api/v1/whitelist", o.baseURL)

	data := map[string]string{
		"ip":     ip,
		"reason": reason,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to add to whitelist: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (o *OpenAppSecClient) Close() error {
	return nil
}
