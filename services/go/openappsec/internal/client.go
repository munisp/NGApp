package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	wafScansTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "openappsec_scans_total",
		Help: "Total WAF scans performed",
	})
	wafThreatsDetected = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "openappsec_threats_detected_total",
		Help: "Total threats detected by type",
	}, []string{"threat_type"})
	wafBlockedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "openappsec_blocked_total",
		Help: "Total requests blocked",
	})
	wafScanLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "openappsec_scan_latency_seconds",
		Help:    "WAF scan latency",
		Buckets: prometheus.DefBuckets,
	})
)

type ScanRequest struct {
	Method  string            `json:"method"`
	URI     string            `json:"uri"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	IP      string            `json:"ip"`
}

type ScanResult struct {
	Allowed    bool     `json:"allowed"`
	Threats    []Threat `json:"threats"`
	Score      float64  `json:"score"`
	Processing float64  `json:"processing_ms"`
}

type Threat struct {
	Type       string  `json:"type"`
	Severity   string  `json:"severity"`
	Pattern    string  `json:"pattern"`
	Location   string  `json:"location"`
	Confidence float64 `json:"confidence"`
	Timestamp  int64   `json:"timestamp"`
}

type Policy struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Mode        string   `json:"mode"`
	Rules       []Rule   `json:"rules"`
	Whitelist   []string `json:"whitelist"`
	Blacklist   []string `json:"blacklist"`
	CreatedAt   int64    `json:"created_at"`
}

type Rule struct {
	ID       string `json:"id"`
	Pattern  string `json:"pattern"`
	Action   string `json:"action"`
	Severity string `json:"severity"`
	Enabled  bool   `json:"enabled"`
}

type WAFMetrics struct {
	TotalScans     int64              `json:"total_scans"`
	TotalBlocked   int64              `json:"total_blocked"`
	TotalAllowed   int64              `json:"total_allowed"`
	Threats        int                `json:"threats_detected"`
	ThreatsByType  map[string]int     `json:"threats_by_type"`
	AvgLatencyMs   float64            `json:"avg_latency_ms"`
	TopAttackIPs   map[string]int     `json:"top_attack_ips"`
}

type HealthStatus struct {
	Connected    bool   `json:"connected"`
	Mode         string `json:"mode"`
	Policies     int    `json:"policies"`
	ThreatsTotal int    `json:"threats_total"`
}

type OpenAppSecClient struct {
	config     *Config
	httpClient *http.Client
	connected  bool
	mu         sync.RWMutex
	policies   map[string]*Policy
	threats    []*Threat
	whitelist  map[string]bool
	patterns   []*threatPattern
	metrics    *wafMetrics
}

type threatPattern struct {
	name     string
	pattern  *regexp.Regexp
	severity string
}

type wafMetrics struct {
	mu           sync.Mutex
	totalScans   int64
	totalBlocked int64
	totalAllowed int64
	threatTypes  map[string]int
	attackIPs    map[string]int
	latencies    []float64
}

func NewOpenAppSecClient(cfg *Config) (*OpenAppSecClient, error) {
	client := &OpenAppSecClient{
		config:     cfg,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		policies:   make(map[string]*Policy),
		whitelist:  make(map[string]bool),
		metrics: &wafMetrics{
			threatTypes: make(map[string]int),
			attackIPs:   make(map[string]int),
		},
	}

	client.initPatterns()
	client.initDefaultPolicy()

	if err := client.checkAgentConnection(); err != nil {
		fmt.Printf("[OpenAppSec] Agent not reachable (using local engine): %v\n", err)
		client.connected = false
	} else {
		client.connected = true
		fmt.Printf("[OpenAppSec] Connected to agent (mode: %s)\n", cfg.Mode)
	}

	go client.healthCheckLoop()
	return client, nil
}

func (c *OpenAppSecClient) checkAgentConnection() error {
	resp, err := c.httpClient.Get("http://localhost:19789/health")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *OpenAppSecClient) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		err := c.checkAgentConnection()
		c.mu.Lock()
		c.connected = (err == nil)
		c.mu.Unlock()
	}
}

func (c *OpenAppSecClient) initPatterns() {
	c.patterns = []*threatPattern{
		{name: "sql_injection", pattern: regexp.MustCompile(`(?i)(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set|exec\s*\(|execute\s+|xp_|sp_|0x[0-9a-f]+|\bor\b\s+1\s*=\s*1|\band\b\s+1\s*=\s*1|--|;\s*$|\bwaitfor\b|\bbenchmark\b)`), severity: "critical"},
		{name: "xss", pattern: regexp.MustCompile(`(?i)(<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<svg\s+on|alert\s*\(|confirm\s*\(|prompt\s*\(|document\.|window\.|eval\s*\()`), severity: "high"},
		{name: "path_traversal", pattern: regexp.MustCompile(`(?i)(\.\./|\.\.\\|%2e%2e|%252e%252e|/etc/passwd|/etc/shadow|/proc/self|/windows/system32)`), severity: "high"},
		{name: "command_injection", pattern: regexp.MustCompile("(?i)(;\s*(ls|cat|rm|wget|curl|bash|sh|python|perl|ruby|nc|ncat)\s|\|\s*(ls|cat|rm)|`.*`|\$\(.*\))"), severity: "critical"},
		{name: "ldap_injection", pattern: regexp.MustCompile(`(?i)(\(\|\(|\)\(|\*\)|%28%7c%28|objectclass=\*|cn=\*|uid=\*)`), severity: "high"},
		{name: "xxe", pattern: regexp.MustCompile(`(?i)(<!ENTITY|<!DOCTYPE.*\[|SYSTEM\s+["\']|PUBLIC\s+["\']|file://|php://|data://|expect://)`), severity: "critical"},
		{name: "ssrf", pattern: regexp.MustCompile(`(?i)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|169\.254\.|metadata\.google|100\.100\.100\.200)`), severity: "high"},
		{name: "header_injection", pattern: regexp.MustCompile(`(?i)(\r\n|%0d%0a|%0d|%0a)`), severity: "medium"},
	}
}

func (c *OpenAppSecClient) initDefaultPolicy() {
	c.policies["default"] = &Policy{
		ID: "default", Name: "Default Fintech Policy",
		Mode: c.config.Mode, CreatedAt: time.Now().Unix(),
		Rules: []Rule{
			{ID: "sqli", Pattern: "sql_injection", Action: "block", Severity: "critical", Enabled: true},
			{ID: "xss", Pattern: "xss", Action: "block", Severity: "high", Enabled: true},
			{ID: "traversal", Pattern: "path_traversal", Action: "block", Severity: "high", Enabled: true},
			{ID: "cmdi", Pattern: "command_injection", Action: "block", Severity: "critical", Enabled: true},
			{ID: "xxe", Pattern: "xxe", Action: "block", Severity: "critical", Enabled: true},
			{ID: "ssrf", Pattern: "ssrf", Action: "block", Severity: "high", Enabled: true},
			{ID: "ldap", Pattern: "ldap_injection", Action: "block", Severity: "high", Enabled: true},
			{ID: "header", Pattern: "header_injection", Action: "block", Severity: "medium", Enabled: true},
		},
	}
}

func (c *OpenAppSecClient) ScanRequest(req ScanRequest) *ScanResult {
	start := time.Now()
	wafScansTotal.Inc()

	c.mu.RLock()
	wl := c.whitelist[req.IP]
	c.mu.RUnlock()

	if wl {
		c.metrics.mu.Lock()
		c.metrics.totalScans++
		c.metrics.totalAllowed++
		c.metrics.mu.Unlock()
		return &ScanResult{Allowed: true, Score: 0, Processing: float64(time.Since(start).Microseconds()) / 1000}
	}

	if c.connected {
		result, err := c.scanViaAgent(req)
		if err == nil {
			return result
		}
	}

	var threats []Threat
	var totalScore float64
	targets := []struct{ val, loc string }{
		{req.URI, "uri"}, {req.Body, "body"},
	}
	for k, v := range req.Headers {
		targets = append(targets, struct{ val, loc string }{v, "header:" + k})
	}

	for _, target := range targets {
		for _, p := range c.patterns {
			if p.pattern.MatchString(target.val) {
				confidence := 0.85
				if p.severity == "critical" {
					confidence = 0.95
				}
				threat := Threat{
					Type: p.name, Severity: p.severity,
					Pattern: p.pattern.String()[:min(50, len(p.pattern.String()))],
					Location: target.loc, Confidence: confidence,
					Timestamp: time.Now().UnixMilli(),
				}
				threats = append(threats, threat)
				wafThreatsDetected.WithLabelValues(p.name).Inc()
				switch p.severity {
				case "critical":
					totalScore += 0.9
				case "high":
					totalScore += 0.7
				case "medium":
					totalScore += 0.4
				}
			}
		}
	}

	if totalScore > 1.0 {
		totalScore = 1.0
	}
	allowed := totalScore < 0.5 || c.config.Mode == "detect"
	processingMs := float64(time.Since(start).Microseconds()) / 1000
	wafScanLatency.Observe(time.Since(start).Seconds())

	c.metrics.mu.Lock()
	c.metrics.totalScans++
	if allowed {
		c.metrics.totalAllowed++
	} else {
		c.metrics.totalBlocked++
		wafBlockedTotal.Inc()
		c.metrics.attackIPs[req.IP]++
	}
	for _, t := range threats {
		c.metrics.threatTypes[t.Type]++
	}
	c.metrics.latencies = append(c.metrics.latencies, processingMs)
	if len(c.metrics.latencies) > 10000 {
		c.metrics.latencies = c.metrics.latencies[5000:]
	}
	c.metrics.mu.Unlock()

	if len(threats) > 0 {
		c.mu.Lock()
		for i := range threats {
			t := threats[i]
			c.threats = append(c.threats, &t)
		}
		c.mu.Unlock()
	}

	return &ScanResult{Allowed: allowed, Threats: threats, Score: totalScore, Processing: processingMs}
}

func (c *OpenAppSecClient) scanViaAgent(req ScanRequest) (*ScanResult, error) {
	data, _ := json.Marshal(req)
	resp, err := c.httpClient.Post("http://localhost:19789/scan", "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result ScanResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *OpenAppSecClient) AddPolicy(policy *Policy) {
	c.mu.Lock()
	defer c.mu.Unlock()
	policy.CreatedAt = time.Now().Unix()
	c.policies[policy.ID] = policy
}

func (c *OpenAppSecClient) GetPolicies() []*Policy {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*Policy, 0, len(c.policies))
	for _, p := range c.policies {
		result = append(result, p)
	}
	return result
}

func (c *OpenAppSecClient) GetThreats(limit int) []*Threat {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if limit <= 0 || limit > len(c.threats) {
		limit = len(c.threats)
	}
	start := len(c.threats) - limit
	if start < 0 {
		start = 0
	}
	result := make([]*Threat, limit)
	copy(result, c.threats[start:])
	return result
}

func (c *OpenAppSecClient) AddWhitelist(ips []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, ip := range ips {
		c.whitelist[ip] = true
	}
}

func (c *OpenAppSecClient) RemoveWhitelist(ips []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, ip := range ips {
		delete(c.whitelist, ip)
	}
}

func (c *OpenAppSecClient) GetMetrics() *WAFMetrics {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()
	var avgLat float64
	if len(c.metrics.latencies) > 0 {
		var sum float64
		for _, l := range c.metrics.latencies {
			sum += l
		}
		avgLat = sum / float64(len(c.metrics.latencies))
	}
	types := make(map[string]int)
	for k, v := range c.metrics.threatTypes {
		types[k] = v
	}
	ips := make(map[string]int)
	for k, v := range c.metrics.attackIPs {
		ips[k] = v
	}
	return &WAFMetrics{
		TotalScans: c.metrics.totalScans, TotalBlocked: c.metrics.totalBlocked,
		TotalAllowed: c.metrics.totalAllowed, Threats: len(c.threats),
		ThreatsByType: types, AvgLatencyMs: avgLat, TopAttackIPs: ips,
	}
}

func (c *OpenAppSecClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &HealthStatus{
		Connected: c.connected, Mode: c.config.Mode,
		Policies: len(c.policies), ThreatsTotal: len(c.threats),
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (_ *OpenAppSecClient) isInternalIP(ip string) bool {
	return strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "172.")
}
