package openappsec

import (
	"sync"
	"sync/atomic"
	"time"
)

// --- Enforce Mode (#63) ---

type EnforcementConfig struct {
	Mode              string            `json:"mode"` // LEARNING, PREVENT, PREVENT_LEARN
	WhitelistedPaths  []string          `json:"whitelisted_paths"`
	CustomExceptions  []WAFException    `json:"custom_exceptions"`
	LogLevel          string            `json:"log_level"`
	MaxRequestBodyKB  int               `json:"max_request_body_kb"`
	ResponseOnBlock   ResponseConfig    `json:"response_on_block"`
}

type WAFException struct {
	ID          string `json:"id"`
	Path        string `json:"path"`
	Method      string `json:"method"`
	Reason      string `json:"reason"`
	Parameter   string `json:"parameter,omitempty"`
	RuleID      string `json:"rule_id,omitempty"`
}

type ResponseConfig struct {
	StatusCode int    `json:"status_code"`
	Body       string `json:"body"`
	Headers    map[string]string `json:"headers"`
}

var DefaultEnforcementConfig = EnforcementConfig{
	Mode: "PREVENT_LEARN",
	WhitelistedPaths: []string{
		"/health",
		"/readiness",
		"/metrics",
	},
	CustomExceptions: []WAFException{
		{ID: "exc-001", Path: "/api/v1/iso20022/*", Method: "POST", Reason: "ISO 20022 XML payloads trigger XML injection false positives", Parameter: "body"},
		{ID: "exc-002", Path: "/api/v1/graphql", Method: "POST", Reason: "GraphQL queries contain structured query syntax", Parameter: "body"},
		{ID: "exc-003", Path: "/api/v1/compliance/reports/upload", Method: "POST", Reason: "Large file upload for regulatory reports", Parameter: "file"},
		{ID: "exc-004", Path: "/api/v1/webhooks/*", Method: "POST", Reason: "Bank webhook callbacks with varied payloads", Parameter: "body"},
	},
	LogLevel:         "info",
	MaxRequestBodyKB: 1024,
	ResponseOnBlock: ResponseConfig{
		StatusCode: 403,
		Body:       `{"error":"request_blocked","code":"WAF_BLOCKED","message":"Request blocked by security policy","request_id":"${REQUEST_ID}"}`,
		Headers:    map[string]string{"Content-Type": "application/json", "X-Security-Block": "true"},
	},
}

// --- Custom Payment Threat Intelligence (#64) ---

type ThreatIntelFeed struct {
	Name           string        `json:"name"`
	URL            string        `json:"url"`
	Type           string        `json:"type"` // IP, DOMAIN, HASH, PATTERN
	UpdateInterval time.Duration `json:"update_interval"`
	Enabled        bool          `json:"enabled"`
	Description    string        `json:"description"`
	LastUpdated    time.Time     `json:"last_updated"`
	EntryCount     int64         `json:"entry_count"`
}

type ThreatIntelManager struct {
	mu           sync.RWMutex
	feeds        []ThreatIntelFeed
	totalBlocked atomic.Int64
	totalMatched atomic.Int64
}

func NewThreatIntelManager() *ThreatIntelManager {
	return &ThreatIntelManager{
		feeds: []ThreatIntelFeed{
			{Name: "EFCC Fraud IPs", URL: "https://threat-intel.efcc.gov.ng/api/v1/ips", Type: "IP", UpdateInterval: 1 * time.Hour, Enabled: true, Description: "EFCC-published fraud source IPs", EntryCount: 15420},
			{Name: "NIBSS Blocked IPs", URL: "https://security.nibss-plc.com.ng/api/blocked-ips", Type: "IP", UpdateInterval: 30 * time.Minute, Enabled: true, Description: "NIBSS-maintained blocked IP list", EntryCount: 8930},
			{Name: "CBN Watchlist Domains", URL: "https://security.cbn.gov.ng/api/v1/domains", Type: "DOMAIN", UpdateInterval: 6 * time.Hour, Enabled: true, Description: "CBN suspicious domain watchlist", EntryCount: 2340},
			{Name: "Banking API Abuse Patterns", URL: "https://threat-intel.payment-switch.ng/patterns", Type: "PATTERN", UpdateInterval: 1 * time.Hour, Enabled: true, Description: "API abuse patterns specific to Nigerian banking", EntryCount: 450},
			{Name: "BIN Attack Signatures", URL: "https://threat-intel.payment-switch.ng/bin-attacks", Type: "PATTERN", UpdateInterval: 2 * time.Hour, Enabled: true, Description: "Card BIN brute-force attack signatures", EntryCount: 890},
			{Name: "Credential Stuffing IPs", URL: "https://threat-intel.payment-switch.ng/credential-stuffing", Type: "IP", UpdateInterval: 15 * time.Minute, Enabled: true, Description: "Known credential stuffing source IPs", EntryCount: 32100},
		},
	}
}

func (tm *ThreatIntelManager) GetFeeds() []ThreatIntelFeed {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	result := make([]ThreatIntelFeed, len(tm.feeds))
	copy(result, tm.feeds)
	return result
}

func (tm *ThreatIntelManager) GetStats() map[string]int64 {
	return map[string]int64{
		"total_blocked": tm.totalBlocked.Load(),
		"total_matched": tm.totalMatched.Load(),
	}
}

// --- Bot Detection (#65) ---

type BotDetectionConfig struct {
	Enabled            bool                `json:"enabled"`
	JsChallenge        bool                `json:"js_challenge"`
	Fingerprinting     bool                `json:"fingerprinting"`
	RateLimitPerIP     int                 `json:"rate_limit_per_ip"`
	SuspiciousPatterns []BotPattern        `json:"suspicious_patterns"`
	BotActions         map[string]string   `json:"bot_actions"` // BLOCK, CHALLENGE, LOG
}

type BotPattern struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // RATE, PATTERN, BEHAVIOR, ENUMERATION
	Description string   `json:"description"`
	Indicators  []string `json:"indicators"`
	Action      string   `json:"action"` // BLOCK, CHALLENGE, LOG
	Threshold   int      `json:"threshold,omitempty"`
	WindowSec   int      `json:"window_sec,omitempty"`
}

var DefaultBotDetection = BotDetectionConfig{
	Enabled:        true,
	JsChallenge:    true,
	Fingerprinting: true,
	RateLimitPerIP: 100,
	SuspiciousPatterns: []BotPattern{
		{
			Name: "Account Enumeration", Type: "ENUMERATION",
			Description: "Systematic probing of account numbers",
			Indicators:  []string{"sequential_account_queries", "high_404_rate", "rapid_name_enquiry"},
			Action: "BLOCK", Threshold: 50, WindowSec: 60,
		},
		{
			Name: "BVN Brute Force", Type: "ENUMERATION",
			Description: "Systematic BVN validation attempts",
			Indicators:  []string{"sequential_bvn_queries", "high_validation_failures", "rapid_identity_checks"},
			Action: "BLOCK", Threshold: 10, WindowSec: 300,
		},
		{
			Name: "Card BIN Attack", Type: "ENUMERATION",
			Description: "Card BIN/PAN enumeration via payment attempts",
			Indicators:  []string{"sequential_card_attempts", "rapid_declined_transactions", "varying_cvv"},
			Action: "BLOCK", Threshold: 5, WindowSec: 60,
		},
		{
			Name: "Credential Stuffing", Type: "RATE",
			Description: "High-frequency login attempts with different credentials",
			Indicators:  []string{"unique_usernames_per_ip", "rapid_login_failures", "known_proxy_ip"},
			Action: "CHALLENGE", Threshold: 20, WindowSec: 300,
		},
		{
			Name: "API Scraping", Type: "BEHAVIOR",
			Description: "Systematic API endpoint crawling",
			Indicators:  []string{"sequential_endpoint_access", "no_referrer", "automated_user_agent", "rapid_requests"},
			Action: "CHALLENGE", Threshold: 200, WindowSec: 60,
		},
		{
			Name: "Transfer Flooding", Type: "RATE",
			Description: "Rapid transfer initiation (potential DDoS or abuse)",
			Indicators:  []string{"rapid_transfer_requests", "same_source_account", "micro_amounts"},
			Action: "BLOCK", Threshold: 30, WindowSec: 60,
		},
	},
	BotActions: map[string]string{
		"BLOCK":     "Return 403 and add IP to temporary blacklist",
		"CHALLENGE": "Present JavaScript challenge before allowing request",
		"LOG":       "Allow request but log for analysis",
	},
}
