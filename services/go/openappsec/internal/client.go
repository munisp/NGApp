package internal

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

type ScanRequest struct {
	Method    string            `json:"method"`
	URI       string            `json:"uri"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	SourceIP  string            `json:"source_ip"`
	UserAgent string            `json:"user_agent"`
}

type ScanResult struct {
	Allowed       bool     `json:"allowed"`
	Blocked       bool     `json:"blocked"`
	ThreatLevel   string   `json:"threat_level"`
	Threats       []string `json:"threats,omitempty"`
	Score         float64  `json:"score"`
	ProcessTimeMs float64  `json:"process_time_ms"`
	Action        string   `json:"action"`
}

type Policy struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Mode        string   `json:"mode"`
	Practices   []string `json:"practices"`
	SourceIDs   []string `json:"source_ids,omitempty"`
	TriggerIDs  []string `json:"trigger_ids,omitempty"`
}

type Threat struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Severity    string  `json:"severity"`
	Description string  `json:"description"`
	SourceIP    string  `json:"source_ip"`
	URI         string  `json:"uri"`
	Score       float64 `json:"score"`
	Blocked     bool    `json:"blocked"`
	Timestamp   int64   `json:"timestamp"`
}

type WhitelistEntry struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	Reason   string `json:"reason"`
}

type SecurityMetrics struct {
	TotalScans     int64            `json:"total_scans"`
	BlockedCount   int64            `json:"blocked_count"`
	AllowedCount   int64            `json:"allowed_count"`
	ThreatsByType  map[string]int64 `json:"threats_by_type"`
	AvgScoreMs     float64          `json:"avg_score_ms"`
	TopAttackTypes []string         `json:"top_attack_types"`
	BlockRate      float64          `json:"block_rate"`
}

type HealthStatus struct {
	Connected       bool   `json:"connected"`
	Mode            string `json:"mode"`
	Policies        int    `json:"policies"`
	ThreatsDetected int    `json:"threats_detected"`
	WhitelistSize   int    `json:"whitelist_size"`
}

type OpenAppSecClient struct {
	config    *Config
	mu        sync.RWMutex
	policies  []*Policy
	threats   []*Threat
	whitelist []*WhitelistEntry
	patterns  []*attackPattern
	metrics   *secMetrics
}

type attackPattern struct {
	name    string
	pattern *regexp.Regexp
	score   float64
}

type secMetrics struct {
	mu           sync.Mutex
	totalScans   int64
	blocked      int64
	allowed      int64
	threatTypes  map[string]int64
	scoreTimes   []float64
}

func NewOpenAppSecClient(cfg *Config) *OpenAppSecClient {
	client := &OpenAppSecClient{
		config: cfg,
		metrics: &secMetrics{
			threatTypes: make(map[string]int64),
		},
	}

	client.loadAttackPatterns()
	client.loadDefaultPolicies()

	fmt.Printf("[OpenAppSec] Initialized (mode: %s, threat_prevention: %v)\n", cfg.Mode, cfg.ThreatPrevention)
	return client
}

func (c *OpenAppSecClient) loadAttackPatterns() {
	c.patterns = []*attackPattern{
		{name: "SQL Injection", pattern: regexp.MustCompile(`(?i)(union\s+select|or\s+1\s*=\s*1|drop\s+table|insert\s+into|delete\s+from|update\s+.*set|select\s+.*from|;\s*--|'\s*or\s*')`), score: 0.9},
		{name: "XSS", pattern: regexp.MustCompile(`(?i)(<script|javascript:|on(error|load|click|mouseover)\s*=|<img\s+.*onerror|<svg\s+.*onload|eval\s*\(|document\.(cookie|location)|alert\s*\()`), score: 0.85},
		{name: "Path Traversal", pattern: regexp.MustCompile(`(\.\./|\.\.\\|%2e%2e|%252e%252e|/etc/passwd|/proc/self|\\windows\\system32)`), score: 0.8},
		{name: "Command Injection", pattern: regexp.MustCompile(`(?i)(;\s*(ls|cat|rm|wget|curl|bash|sh|python|perl|nc)\s|[|&]\s*(ls|cat|rm)|` + "`" + `.*` + "`" + `|\$\(.*\))`), score: 0.95},
		{name: "LDAP Injection", pattern: regexp.MustCompile(`(?i)([)(|*\\].*[)(|*\\]|objectclass=\*|cn=\*)`), score: 0.7},
		{name: "XML External Entity", pattern: regexp.MustCompile(`(?i)(<!DOCTYPE.*ENTITY|<!ENTITY|SYSTEM\s+"file:|SYSTEM\s+"http)`), score: 0.9},
		{name: "Server-Side Request Forgery", pattern: regexp.MustCompile(`(?i)(127\.0\.0\.1|localhost|0\.0\.0\.0|169\.254\.169\.254|metadata\.google|::1)`), score: 0.75},
		{name: "Log Injection", pattern: regexp.MustCompile(`(?i)(\r\n|\n|\r).*HTTP/`), score: 0.6},
		{name: "Open Redirect", pattern: regexp.MustCompile(`(?i)(redirect|url|next|return|goto)=https?://`), score: 0.5},
		{name: "Header Injection", pattern: regexp.MustCompile(`(\r\n|\n)[\w-]+:`), score: 0.7},
	}
}

func (c *OpenAppSecClient) loadDefaultPolicies() {
	c.policies = []*Policy{
		{ID: "default-web", Name: "Web Application Protection", Mode: "prevent",
			Practices: []string{"web-attacks", "api-attacks", "bot-protection"}},
		{ID: "api-protection", Name: "API Security", Mode: "prevent",
			Practices: []string{"api-attacks", "schema-validation", "rate-limiting"}},
		{ID: "financial-api", Name: "Financial API Protection", Mode: "prevent",
			Practices: []string{"web-attacks", "api-attacks", "data-loss-prevention", "fraud-detection"}},
	}
}

func (c *OpenAppSecClient) ScanRequest(req ScanRequest) *ScanResult {
	start := time.Now()

	c.mu.RLock()
	for _, entry := range c.whitelist {
		if entry.Type == "ip" && entry.Value == req.SourceIP {
			c.mu.RUnlock()
			c.recordScan(false, 0, time.Since(start))
			return &ScanResult{Allowed: true, Blocked: false, ThreatLevel: "none", Score: 0, Action: "allow", ProcessTimeMs: float64(time.Since(start).Microseconds()) / 1000}
		}
	}
	c.mu.RUnlock()

	var threats []string
	var maxScore float64
	scanTarget := strings.Join([]string{req.URI, req.Body, req.UserAgent}, " ")

	for _, ap := range c.patterns {
		if ap.pattern.MatchString(scanTarget) {
			threats = append(threats, ap.name)
			if ap.score > maxScore {
				maxScore = ap.score
			}
		}
	}

	blocked := len(threats) > 0 && maxScore >= 0.7 && c.config.ThreatPrevention
	processTime := float64(time.Since(start).Microseconds()) / 1000

	threatLevel := "none"
	action := "allow"
	if maxScore >= 0.9 {
		threatLevel = "critical"
	} else if maxScore >= 0.7 {
		threatLevel = "high"
	} else if maxScore >= 0.5 {
		threatLevel = "medium"
	} else if maxScore > 0 {
		threatLevel = "low"
	}

	if blocked {
		action = "block"
	} else if len(threats) > 0 {
		action = "detect"
	}

	if len(threats) > 0 {
		c.mu.Lock()
		c.threats = append(c.threats, &Threat{
			ID:          fmt.Sprintf("threat-%d", time.Now().UnixNano()),
			Type:        threats[0],
			Severity:    threatLevel,
			Description: fmt.Sprintf("Detected: %s", strings.Join(threats, ", ")),
			SourceIP:    req.SourceIP,
			URI:         req.URI,
			Score:       maxScore,
			Blocked:     blocked,
			Timestamp:   time.Now().Unix(),
		})
		if len(c.threats) > 10000 {
			c.threats = c.threats[5000:]
		}
		c.mu.Unlock()
	}

	c.recordScan(blocked, maxScore, time.Since(start))

	return &ScanResult{
		Allowed:       !blocked,
		Blocked:       blocked,
		ThreatLevel:   threatLevel,
		Threats:       threats,
		Score:         maxScore,
		ProcessTimeMs: processTime,
		Action:        action,
	}
}

func (c *OpenAppSecClient) recordScan(blocked bool, score float64, duration time.Duration) {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()
	c.metrics.totalScans++
	if blocked {
		c.metrics.blocked++
	} else {
		c.metrics.allowed++
	}
	c.metrics.scoreTimes = append(c.metrics.scoreTimes, float64(duration.Microseconds())/1000)
	if len(c.metrics.scoreTimes) > 10000 {
		c.metrics.scoreTimes = c.metrics.scoreTimes[5000:]
	}
}

func (c *OpenAppSecClient) AddPolicy(policy *Policy) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.policies = append(c.policies, policy)
}

func (c *OpenAppSecClient) ListPolicies() []*Policy {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*Policy, len(c.policies))
	copy(result, c.policies)
	return result
}

func (c *OpenAppSecClient) GetThreats() []*Threat {
	c.mu.RLock()
	defer c.mu.RUnlock()
	limit := 100
	start := 0
	if len(c.threats) > limit {
		start = len(c.threats) - limit
	}
	result := make([]*Threat, len(c.threats[start:]))
	copy(result, c.threats[start:])
	return result
}

func (c *OpenAppSecClient) AddWhitelist(entry *WhitelistEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.whitelist = append(c.whitelist, entry)
}

func (c *OpenAppSecClient) GetMetrics() *SecurityMetrics {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()

	var avgTime float64
	if len(c.metrics.scoreTimes) > 0 {
		var sum float64
		for _, t := range c.metrics.scoreTimes {
			sum += t
		}
		avgTime = sum / float64(len(c.metrics.scoreTimes))
	}

	var blockRate float64
	if c.metrics.totalScans > 0 {
		blockRate = float64(c.metrics.blocked) / float64(c.metrics.totalScans)
	}

	typeCopy := make(map[string]int64)
	for k, v := range c.metrics.threatTypes {
		typeCopy[k] = v
	}

	return &SecurityMetrics{
		TotalScans:     c.metrics.totalScans,
		BlockedCount:   c.metrics.blocked,
		AllowedCount:   c.metrics.allowed,
		ThreatsByType:  typeCopy,
		AvgScoreMs:     avgTime,
		TopAttackTypes: []string{"SQL Injection", "XSS", "Command Injection", "Path Traversal"},
		BlockRate:      blockRate,
	}
}

func (c *OpenAppSecClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &HealthStatus{
		Connected:       true,
		Mode:            c.config.Mode,
		Policies:        len(c.policies),
		ThreatsDetected: len(c.threats),
		WhitelistSize:   len(c.whitelist),
	}
}
