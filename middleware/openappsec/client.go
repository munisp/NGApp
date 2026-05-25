package openappsec

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a real OpenAppSec management API client.
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// NewClient creates an OpenAppSec client from environment.
func NewClient() *Client {
	return &Client{
		baseURL: envOr("OPENAPPSEC_URL", "http://openappsec:8080"),
		apiKey:  os.Getenv("OPENAPPSEC_API_KEY"),
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies OpenAppSec is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("openappsec health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("openappsec unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) setAuth(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
}

// WAFStats contains WAF activity statistics.
type WAFStats struct {
	TotalRequests     int64  `json:"total_requests"`
	BlockedRequests   int64  `json:"blocked_requests"`
	LearnedPatterns   int    `json:"learned_patterns"`
	EnforcementMode   string `json:"enforcement_mode"`
	ActiveExceptions  int    `json:"active_exceptions"`
}

// GetWAFStats returns current WAF statistics.
func (c *Client) GetWAFStats(ctx context.Context) (*WAFStats, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/status", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var stats WAFStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

// ThreatEvent represents a detected security threat.
type ThreatEvent struct {
	Timestamp   time.Time `json:"timestamp"`
	SourceIP    string    `json:"source_ip"`
	URI         string    `json:"uri"`
	ThreatType  string    `json:"threat_type"`
	Severity    string    `json:"severity"`
	Action      string    `json:"action"`
	RuleID      string    `json:"rule_id"`
}

// GetRecentThreats returns recently detected threats.
func (c *Client) GetRecentThreats(ctx context.Context, limit int) ([]ThreatEvent, error) {
	url := fmt.Sprintf("%s/api/v1/threats?limit=%d", c.baseURL, limit)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var threats []ThreatEvent
	json.NewDecoder(resp.Body).Decode(&threats)
	return threats, nil
}

// UpdatePolicy updates the WAF policy.
func (c *Client) UpdatePolicy(ctx context.Context, policy map[string]interface{}) error {
	body, _ := json.Marshal(policy)
	req, err := http.NewRequestWithContext(ctx, "PUT", c.baseURL+"/api/v1/policy", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("update policy: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("update policy failed: status %d", resp.StatusCode)
	}
	return nil
}

// AddIPException adds an IP to the whitelist.
func (c *Client) AddIPException(ctx context.Context, ip, reason string) error {
	payload := map[string]interface{}{
		"source_ip": ip,
		"reason":    reason,
		"action":    "accept",
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/exceptions", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// ThreatFeedStatus contains threat intelligence feed information.
type ThreatFeedStatus struct {
	Name         string    `json:"name"`
	Entries      int       `json:"entries"`
	LastUpdate   time.Time `json:"last_update"`
	Active       bool      `json:"active"`
	MatchesToday int       `json:"matches_today"`
}

// GetThreatFeeds returns the status of threat intelligence feeds.
func (c *Client) GetThreatFeeds(ctx context.Context) ([]ThreatFeedStatus, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/threat-feeds", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var feeds []ThreatFeedStatus
	json.NewDecoder(resp.Body).Decode(&feeds)
	return feeds, nil
}
