// Package integrations provides APISIX middleware for security integrations
package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"payment-switch/payment-core/integrations/openappsec"
	"payment-switch/payment-core/integrations/opencti"
	"payment-switch/payment-core/integrations/opensearch"
)

// APISIXMiddlewareConfig holds middleware configuration
type APISIXMiddlewareConfig struct {
	OpenAppSecURL     string
	OpenCTIURL        string
	OpenSearchURL     string
	EnableWAF         bool
	EnableThreatIntel bool
	EnableLogging     bool
	BlockOnThreat     bool
	ThreatThreshold   int
	LogLevel          string
}

// SecurityMiddleware provides APISIX security middleware
type SecurityMiddleware struct {
	config        APISIXMiddlewareConfig
	openAppSec    *openappsec.Client
	openCTI       *opencti.Client
	openSearch    *opensearch.Client
	httpClient    *http.Client
	mu            sync.RWMutex
	
	// Cached threat data
	blockedIPs    map[string]time.Time
	threatScores  map[string]int
	
	// Metrics
	requestsProcessed int64
	requestsBlocked   int64
	threatDetections  int64
}

// NewSecurityMiddleware creates a new security middleware
func NewSecurityMiddleware(config APISIXMiddlewareConfig) *SecurityMiddleware {
	return &SecurityMiddleware{
		config: config,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		blockedIPs:   make(map[string]time.Time),
		threatScores: make(map[string]int),
	}
}

// SetOpenAppSecClient sets the OpenAppSec client
func (m *SecurityMiddleware) SetOpenAppSecClient(client *openappsec.Client) {
	m.openAppSec = client
}

// SetOpenCTIClient sets the OpenCTI client
func (m *SecurityMiddleware) SetOpenCTIClient(client *opencti.Client) {
	m.openCTI = client
}

// SetOpenSearchClient sets the OpenSearch client
func (m *SecurityMiddleware) SetOpenSearchClient(client *opensearch.Client) {
	m.openSearch = client
}

// ProcessRequest processes an incoming request through security checks
func (m *SecurityMiddleware) ProcessRequest(ctx context.Context, req *SecurityRequest) (*SecurityResponse, error) {
	m.mu.Lock()
	m.requestsProcessed++
	m.mu.Unlock()
	
	response := &SecurityResponse{
		RequestID: req.RequestID,
		Allowed:   true,
		Timestamp: time.Now(),
	}
	
	// Check IP blocklist
	if m.isIPBlocked(req.SourceIP) {
		response.Allowed = false
		response.Reason = "IP is blocked"
		response.Action = "block"
		m.incrementBlocked()
		return response, nil
	}
	
	// Check threat intelligence
	if m.config.EnableThreatIntel && m.openCTI != nil {
		isMalicious, malIP := m.openCTI.IsIPMalicious(req.SourceIP)
		if isMalicious && malIP.Score >= m.config.ThreatThreshold {
			m.mu.Lock()
			m.threatDetections++
			m.mu.Unlock()
			
			if m.config.BlockOnThreat {
				response.Allowed = false
				response.Reason = fmt.Sprintf("Threat intelligence match: %s (score: %d)", malIP.ThreatType, malIP.Score)
				response.Action = "block"
				response.ThreatScore = malIP.Score
				m.incrementBlocked()
				
				// Add to local blocklist
				m.blockIP(req.SourceIP, 1*time.Hour)
				
				return response, nil
			} else {
				response.Warnings = append(response.Warnings, 
					fmt.Sprintf("Threat intelligence match: %s", malIP.ThreatType))
				response.ThreatScore = malIP.Score
			}
		}
	}
	
	// Check WAF
	if m.config.EnableWAF {
		wafResult, err := m.checkWAF(ctx, req)
		if err != nil {
			response.Warnings = append(response.Warnings, "WAF check failed")
		} else if wafResult != nil && wafResult.Action == "block" {
			response.Allowed = false
			response.Reason = wafResult.Reason
			response.Action = "block"
			response.WAFResult = wafResult
			m.incrementBlocked()
			return response, nil
		} else if wafResult != nil {
			response.WAFResult = wafResult
		}
	}
	
	// Log request
	if m.config.EnableLogging && m.openSearch != nil {
		m.logRequest(req, response)
	}
	
	return response, nil
}

// SecurityRequest represents an incoming request
type SecurityRequest struct {
	RequestID     string            `json:"request_id"`
	SourceIP      string            `json:"source_ip"`
	Method        string            `json:"method"`
	Path          string            `json:"path"`
	Headers       map[string]string `json:"headers"`
	Body          []byte            `json:"body,omitempty"`
	UserAgent     string            `json:"user_agent"`
	ContentType   string            `json:"content_type"`
	ContentLength int64             `json:"content_length"`
	TLS           bool              `json:"tls"`
	Timestamp     time.Time         `json:"timestamp"`
}

// SecurityResponse represents the security check response
type SecurityResponse struct {
	RequestID    string      `json:"request_id"`
	Allowed      bool        `json:"allowed"`
	Reason       string      `json:"reason,omitempty"`
	Action       string      `json:"action"`
	ThreatScore  int         `json:"threat_score,omitempty"`
	WAFResult    *WAFResult  `json:"waf_result,omitempty"`
	Warnings     []string    `json:"warnings,omitempty"`
	Timestamp    time.Time   `json:"timestamp"`
	ProcessingMs float64     `json:"processing_ms"`
}

// WAFResult represents WAF check result
type WAFResult struct {
	Action      string   `json:"action"`
	Reason      string   `json:"reason,omitempty"`
	RuleID      string   `json:"rule_id,omitempty"`
	AttackType  string   `json:"attack_type,omitempty"`
	Confidence  float64  `json:"confidence"`
	Signatures  []string `json:"signatures,omitempty"`
}

// isIPBlocked checks if an IP is in the local blocklist
func (m *SecurityMiddleware) isIPBlocked(ip string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	expiry, exists := m.blockedIPs[ip]
	if !exists {
		return false
	}
	
	if time.Now().After(expiry) {
		// Expired, will be cleaned up later
		return false
	}
	
	return true
}

// blockIP adds an IP to the local blocklist
func (m *SecurityMiddleware) blockIP(ip string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.blockedIPs[ip] = time.Now().Add(duration)
}

// incrementBlocked increments the blocked counter
func (m *SecurityMiddleware) incrementBlocked() {
	m.mu.Lock()
	m.requestsBlocked++
	m.mu.Unlock()
}

// checkWAF performs WAF check via OpenAppSec
func (m *SecurityMiddleware) checkWAF(ctx context.Context, req *SecurityRequest) (*WAFResult, error) {
	if m.config.OpenAppSecURL == "" {
		return nil, nil
	}
	
	payload := map[string]interface{}{
		"request_id":     req.RequestID,
		"source_ip":      req.SourceIP,
		"method":         req.Method,
		"path":           req.Path,
		"headers":        req.Headers,
		"user_agent":     req.UserAgent,
		"content_type":   req.ContentType,
		"content_length": req.ContentLength,
	}
	
	if len(req.Body) > 0 && len(req.Body) < 1024*1024 {
		payload["body"] = string(req.Body)
	}
	
	body, _ := json.Marshal(payload)
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		m.config.OpenAppSecURL+"/api/v1/check", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	
	resp, err := m.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("WAF check failed: %s", resp.Status)
	}
	
	var result WAFResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return &result, nil
}

// logRequest logs the request to OpenSearch
func (m *SecurityMiddleware) logRequest(req *SecurityRequest, resp *SecurityResponse) {
	if m.openSearch == nil {
		return
	}
	
	if resp.Allowed {
		// Log as regular request
		m.openSearch.IndexLog(opensearch.LogEntry{
			Timestamp:   req.Timestamp,
			Level:       "info",
			Service:     "apisix",
			Message:     fmt.Sprintf("%s %s", req.Method, req.Path),
			RequestID:   req.RequestID,
			Method:      req.Method,
			Path:        req.Path,
			Metadata: map[string]interface{}{
				"source_ip":   req.SourceIP,
				"user_agent":  req.UserAgent,
				"tls":         req.TLS,
			},
		})
	} else {
		// Log as security event
		m.openSearch.IndexSecurityEvent(opensearch.SecurityEvent{
			Timestamp:   req.Timestamp,
			EventType:   "request_blocked",
			Severity:    "high",
			Source:      "apisix-middleware",
			SourceIP:    req.SourceIP,
			Action:      resp.Action,
			Resource:    req.Path,
			Result:      "blocked",
			Description: resp.Reason,
			Metadata: map[string]interface{}{
				"request_id":   req.RequestID,
				"method":       req.Method,
				"threat_score": resp.ThreatScore,
				"waf_result":   resp.WAFResult,
			},
		})
	}
}

// GetMetrics returns middleware metrics
func (m *SecurityMiddleware) GetMetrics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	return map[string]interface{}{
		"requests_processed": m.requestsProcessed,
		"requests_blocked":   m.requestsBlocked,
		"threat_detections":  m.threatDetections,
		"blocked_ips":        len(m.blockedIPs),
	}
}

// CleanupExpiredBlocks removes expired IP blocks
func (m *SecurityMiddleware) CleanupExpiredBlocks() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	now := time.Now()
	for ip, expiry := range m.blockedIPs {
		if now.After(expiry) {
			delete(m.blockedIPs, ip)
		}
	}
}

// GenerateAPISIXPluginConfig generates APISIX plugin configuration
func (m *SecurityMiddleware) GenerateAPISIXPluginConfig() map[string]interface{} {
	return map[string]interface{}{
		"plugins": map[string]interface{}{
			"security-middleware": map[string]interface{}{
				"enable":            true,
				"openappsec_url":    m.config.OpenAppSecURL,
				"opencti_url":       m.config.OpenCTIURL,
				"opensearch_url":    m.config.OpenSearchURL,
				"enable_waf":        m.config.EnableWAF,
				"enable_threat_intel": m.config.EnableThreatIntel,
				"enable_logging":    m.config.EnableLogging,
				"block_on_threat":   m.config.BlockOnThreat,
				"threat_threshold":  m.config.ThreatThreshold,
				"log_level":         m.config.LogLevel,
			},
		},
	}
}

// APISIXRoute represents an APISIX route with security
type APISIXRoute struct {
	ID          string                 `json:"id"`
	URI         string                 `json:"uri"`
	Methods     []string               `json:"methods"`
	Upstream    APISIXUpstream         `json:"upstream"`
	Plugins     map[string]interface{} `json:"plugins"`
}

// APISIXUpstream represents an APISIX upstream
type APISIXUpstream struct {
	Type  string       `json:"type"`
	Nodes []APISIXNode `json:"nodes"`
}

// APISIXNode represents an upstream node
type APISIXNode struct {
	Host   string `json:"host"`
	Port   int    `json:"port"`
	Weight int    `json:"weight"`
}

// CreateSecureRoute creates an APISIX route with security plugins
func (m *SecurityMiddleware) CreateSecureRoute(id, uri string, methods []string, upstream APISIXUpstream) *APISIXRoute {
	return &APISIXRoute{
		ID:       id,
		URI:      uri,
		Methods:  methods,
		Upstream: upstream,
		Plugins: map[string]interface{}{
			"security-middleware": map[string]interface{}{
				"enable":           true,
				"block_on_threat":  m.config.BlockOnThreat,
				"threat_threshold": m.config.ThreatThreshold,
			},
			"ip-restriction": map[string]interface{}{
				"blacklist": m.getBlockedIPList(),
			},
			"limit-req": map[string]interface{}{
				"rate":  100,
				"burst": 50,
				"key":   "remote_addr",
			},
			"prometheus": map[string]interface{}{
				"prefer_name": true,
			},
		},
	}
}

// getBlockedIPList returns the current blocked IP list
func (m *SecurityMiddleware) getBlockedIPList() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var ips []string
	now := time.Now()
	for ip, expiry := range m.blockedIPs {
		if now.Before(expiry) {
			ips = append(ips, ip)
		}
	}
	return ips
}
