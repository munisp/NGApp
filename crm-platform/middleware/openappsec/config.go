package openappsec

import (
	"encoding/json"
	"fmt"
	"os"
)

// Config represents OpenAppSec WAF configuration for CRM platform.
type Config struct {
	Mode               string        `json:"mode"` // detect, prevent, learning
	LogLevel           string        `json:"log_level"`
	Rules              []Rule        `json:"rules"`
	CustomRules        []CustomRule  `json:"custom_rules"`
	Exceptions         []Exception   `json:"exceptions"`
}

type Rule struct {
	Name     string `json:"name"`
	Enabled  bool   `json:"enabled"`
	Severity string `json:"severity"` // critical, high, medium, low
}

type CustomRule struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"` // rate_limit, ip_block, geo_block, header_check
	Action    string   `json:"action"` // block, log, challenge
	Condition string   `json:"condition"`
	Values    []string `json:"values"`
}

type Exception struct {
	Path   string `json:"path"`
	Method string `json:"method"`
	Reason string `json:"reason"`
}

// DefaultCRMConfig returns production WAF config for CRM platform.
func DefaultCRMConfig() Config {
	return Config{
		Mode:     "prevent",
		LogLevel: "info",
		Rules: []Rule{
			{Name: "sql-injection", Enabled: true, Severity: "critical"},
			{Name: "xss", Enabled: true, Severity: "critical"},
			{Name: "command-injection", Enabled: true, Severity: "critical"},
			{Name: "path-traversal", Enabled: true, Severity: "high"},
			{Name: "ldap-injection", Enabled: true, Severity: "high"},
			{Name: "ssrf", Enabled: true, Severity: "high"},
			{Name: "xxe", Enabled: true, Severity: "high"},
			{Name: "open-redirect", Enabled: true, Severity: "medium"},
			{Name: "csrf", Enabled: true, Severity: "medium"},
			{Name: "bot-detection", Enabled: true, Severity: "low"},
		},
		CustomRules: []CustomRule{
			{Name: "api-rate-limit", Type: "rate_limit", Action: "block", Condition: "path:/api/*", Values: []string{"200/min"}},
			{Name: "login-rate-limit", Type: "rate_limit", Action: "challenge", Condition: "path:/api/v1/auth/*", Values: []string{"10/min"}},
			{Name: "bulk-rate-limit", Type: "rate_limit", Action: "block", Condition: "path:/api/v1/bulk/*", Values: []string{"5/min"}},
			{Name: "geo-block", Type: "geo_block", Action: "block", Condition: "country", Values: []string{}},
			{Name: "require-tenant-header", Type: "header_check", Action: "block", Condition: "header:X-Tenant-ID", Values: []string{"required"}},
		},
		Exceptions: []Exception{
			{Path: "/health", Method: "GET", Reason: "health check"},
			{Path: "/ready", Method: "GET", Reason: "readiness probe"},
			{Path: "/metrics", Method: "GET", Reason: "prometheus metrics"},
		},
	}
}

// WriteConfig serializes config to a file for OpenAppSec agent.
func WriteConfig(cfg Config, path string) error {
	if path == "" {
		path = "/etc/openappsec/crm-policy.json"
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}
