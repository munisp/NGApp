// Package openappsec provides integration with open-appsec WAF for the
// OG-RMM platform. Manages security policies, threat detection events,
// and WAF rule lifecycle via the open-appsec management API.
//
// Architecture:
//
//	APISIX → open-appsec attachment → policy enforcement → upstream services
//
// Ref: https://docs.openappsec.io/
package openappsec

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// Config holds open-appsec management API configuration.
type Config struct {
	ManagementURL string
	APIToken      string
	Enabled       bool
}

// ConfigFromEnv loads config from environment variables.
func ConfigFromEnv() Config {
	url := os.Getenv("OPENAPPSEC_MGMT_URL")
	if url == "" {
		url = "http://open-appsec-mgmt:8083"
	}
	token := os.Getenv("OPENAPPSEC_API_TOKEN")
	enabled := os.Getenv("OPENAPPSEC_ENABLED") == "true"
	return Config{ManagementURL: url, APIToken: token, Enabled: enabled}
}

// ThreatEvent represents a detected security threat from open-appsec.
type ThreatEvent struct {
	ID            string    `json:"id"`
	Severity      string    `json:"severity"` // Critical, High, Medium, Low
	AttackType    string    `json:"attackType"`
	SourceIP      string    `json:"sourceIP"`
	DestinationIP string    `json:"destinationIP"`
	URI           string    `json:"uri"`
	HTTPMethod    string    `json:"httpMethod"`
	Action        string    `json:"action"` // Prevent, Detect, Inactive
	Confidence    string    `json:"confidence"`
	Description   string    `json:"description"`
	Timestamp     time.Time `json:"timestamp"`
}

// SecurityPolicy defines a WAF policy configuration.
type SecurityPolicy struct {
	Name       string           `json:"name"`
	Mode       string           `json:"mode"` // prevent, detect, inactive
	Practices  []Practice       `json:"practices"`
	Triggers   []TriggerConfig  `json:"triggers,omitempty"`
	Exceptions []ExceptionRule  `json:"exceptions,omitempty"`
}

// Practice defines a security practice (e.g., Web Application, API Security).
type Practice struct {
	Name string `json:"name"`
	Type string `json:"type"` // WebApplication, APIProtection, BotDefense
	Mode string `json:"mode"` // prevent, detect, inactive
}

// TriggerConfig defines when to log or alert.
type TriggerConfig struct {
	Name          string `json:"name"`
	Type          string `json:"type"` // log, cef, syslog, webhook
	ApplyOn       string `json:"applyOn"` // all, detect, prevent
	SyslogAddress string `json:"syslogAddress,omitempty"`
	WebhookURL    string `json:"webhookURL,omitempty"`
}

// ExceptionRule defines traffic that bypasses WAF inspection.
type ExceptionRule struct {
	Name      string   `json:"name"`
	SourceIPs []string `json:"sourceIPs,omitempty"`
	URLs      []string `json:"urls,omitempty"`
	Reason    string   `json:"reason"`
}

// Client wraps the open-appsec management API.
type Client struct {
	cfg    Config
	client *http.Client
}

// NewClient creates a new open-appsec client.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) do(ctx context.Context, method, path string, body any) ([]byte, error) {
	if !c.cfg.Enabled {
		return nil, nil
	}
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("openappsec: marshal: %w", err)
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.cfg.ManagementURL+path, r)
	if err != nil {
		return nil, fmt.Errorf("openappsec: create request: %w", err)
	}
	if c.cfg.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openappsec: request: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("openappsec: HTTP %d: %s", resp.StatusCode, respBody)
	}
	return respBody, nil
}

// ApplyPolicy creates or updates a security policy.
func (c *Client) ApplyPolicy(ctx context.Context, policy SecurityPolicy) error {
	_, err := c.do(ctx, http.MethodPut, "/api/v1/policies/"+policy.Name, policy)
	if err != nil {
		slog.Warn("openappsec: failed to apply policy", "name", policy.Name, "error", err)
	}
	return err
}

// GetThreatEvents retrieves recent threat events.
func (c *Client) GetThreatEvents(ctx context.Context, limit int) ([]ThreatEvent, error) {
	if !c.cfg.Enabled {
		return nil, nil
	}
	data, err := c.do(ctx, http.MethodGet, fmt.Sprintf("/api/v1/threats?limit=%d", limit), nil)
	if err != nil {
		return nil, err
	}
	var events []ThreatEvent
	if err := json.Unmarshal(data, &events); err != nil {
		return nil, fmt.Errorf("openappsec: decode threats: %w", err)
	}
	return events, nil
}

// GetHealth checks the open-appsec service health.
func (c *Client) GetHealth(ctx context.Context) (map[string]any, error) {
	if !c.cfg.Enabled {
		return map[string]any{"status": "disabled"}, nil
	}
	data, err := c.do(ctx, http.MethodGet, "/api/v1/health", nil)
	if err != nil {
		return map[string]any{"status": "unreachable", "error": err.Error()}, nil
	}
	var result map[string]any
	json.Unmarshal(data, &result)
	return result, nil
}

// OGRMMDefaultPolicy returns the default WAF policy for the OG-RMM platform.
func OGRMMDefaultPolicy() SecurityPolicy {
	return SecurityPolicy{
		Name: "og-rmm-waf-policy",
		Mode: "prevent",
		Practices: []Practice{
			{Name: "web-app-protection", Type: "WebApplication", Mode: "prevent"},
			{Name: "api-protection", Type: "APIProtection", Mode: "prevent"},
			{Name: "bot-defense", Type: "BotDefense", Mode: "detect"},
		},
		Triggers: []TriggerConfig{
			{
				Name:    "opensearch-log",
				Type:    "syslog",
				ApplyOn: "all",
			},
			{
				Name:       "critical-webhook",
				Type:       "webhook",
				ApplyOn:    "prevent",
				WebhookURL: os.Getenv("WAF_WEBHOOK_URL"),
			},
		},
		Exceptions: []ExceptionRule{
			{
				Name:      "health-checks",
				URLs:      []string{"/health", "/readiness", "/metrics"},
				Reason:    "Infrastructure health probes",
			},
		},
	}
}
