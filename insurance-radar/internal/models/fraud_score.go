package models

import (
	"time"

	"github.com/google/uuid"
)

// FraudType represents the type of fraud being assessed
type FraudType string

const (
	FraudTypeClaim       FraudType = "claim"
	FraudTypePolicy      FraudType = "policy_application"
	FraudTypeAgent       FraudType = "agent"
	FraudTypePayment     FraudType = "payment"
	FraudTypeIdentity    FraudType = "identity"
	FraudTypeDocument    FraudType = "document"
)

// RiskLevel represents the risk classification
type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// FraudScoreRequest represents a request to score for fraud
type FraudScoreRequest struct {
	RequestID     uuid.UUID              `json:"request_id"`
	FraudType     FraudType              `json:"fraud_type"`
	EntityID      uuid.UUID              `json:"entity_id"`
	CustomerID    uuid.UUID              `json:"customer_id,omitempty"`
	AgentID       uuid.UUID              `json:"agent_id,omitempty"`
	PolicyID      uuid.UUID              `json:"policy_id,omitempty"`
	ClaimID       uuid.UUID              `json:"claim_id,omitempty"`
	Amount        float64                `json:"amount,omitempty"`
	Currency      string                 `json:"currency,omitempty"`
	DeviceInfo    *DeviceInfo            `json:"device_info,omitempty"`
	LocationInfo  *LocationInfo          `json:"location_info,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
}

// DeviceInfo contains device fingerprinting data
type DeviceInfo struct {
	DeviceID        string `json:"device_id"`
	DeviceType      string `json:"device_type"`
	Browser         string `json:"browser"`
	BrowserVersion  string `json:"browser_version"`
	OS              string `json:"os"`
	OSVersion       string `json:"os_version"`
	ScreenResolution string `json:"screen_resolution"`
	Language        string `json:"language"`
	Timezone        string `json:"timezone"`
	CookiesEnabled  bool   `json:"cookies_enabled"`
	JavascriptEnabled bool `json:"javascript_enabled"`
	UserAgent       string `json:"user_agent"`
	IPAddress       string `json:"ip_address"`
	Fingerprint     string `json:"fingerprint"`
}

// LocationInfo contains geolocation data
type LocationInfo struct {
	IPAddress   string  `json:"ip_address"`
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	Region      string  `json:"region"`
	City        string  `json:"city"`
	PostalCode  string  `json:"postal_code"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	ISP         string  `json:"isp"`
	ASN         string  `json:"asn"`
	IsVPN       bool    `json:"is_vpn"`
	IsProxy     bool    `json:"is_proxy"`
	IsTor       bool    `json:"is_tor"`
	IsDatacenter bool   `json:"is_datacenter"`
}

// FraudScoreResponse represents the fraud assessment result
type FraudScoreResponse struct {
	RequestID       uuid.UUID              `json:"request_id"`
	Score           float64                `json:"score"`
	RiskLevel       RiskLevel              `json:"risk_level"`
	Decision        string                 `json:"decision"`
	Confidence      float64                `json:"confidence"`
	ProcessingTime  int64                  `json:"processing_time_ms"`
	Signals         []FraudSignal          `json:"signals"`
	RiskFactors     []RiskFactor           `json:"risk_factors"`
	Recommendations []string               `json:"recommendations"`
	MatchedRules    []MatchedRule          `json:"matched_rules"`
	NetworkSignals  *NetworkSignals        `json:"network_signals,omitempty"`
	Explanation     *FraudExplanation      `json:"explanation"`
	Timestamp       time.Time              `json:"timestamp"`
}

// FraudSignal represents a detected fraud signal
type FraudSignal struct {
	SignalID    string  `json:"signal_id"`
	Category    string  `json:"category"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Value       float64 `json:"value"`
	Weight      float64 `json:"weight"`
	Contribution float64 `json:"contribution"`
	IsAnomaly   bool    `json:"is_anomaly"`
}

// RiskFactor represents a contributing risk factor
type RiskFactor struct {
	FactorID    string  `json:"factor_id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Impact      string  `json:"impact"`
	Score       float64 `json:"score"`
	Evidence    string  `json:"evidence"`
}

// MatchedRule represents a fraud rule that was triggered
type MatchedRule struct {
	RuleID      string    `json:"rule_id"`
	RuleName    string    `json:"rule_name"`
	RuleType    string    `json:"rule_type"`
	Action      string    `json:"action"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	MatchedAt   time.Time `json:"matched_at"`
}

// NetworkSignals represents cross-network fraud signals
type NetworkSignals struct {
	SeenOnNetwork       bool      `json:"seen_on_network"`
	NetworkFraudCount   int       `json:"network_fraud_count"`
	FirstSeenAt         time.Time `json:"first_seen_at,omitempty"`
	LastFraudAt         time.Time `json:"last_fraud_at,omitempty"`
	RelatedEntities     int       `json:"related_entities"`
	CrossCompanyMatches int       `json:"cross_company_matches"`
	BlacklistMatch      bool      `json:"blacklist_match"`
	WhitelistMatch      bool      `json:"whitelist_match"`
}

// FraudExplanation provides human-readable explanation of the fraud decision
type FraudExplanation struct {
	Summary          string   `json:"summary"`
	TopFactors       []string `json:"top_factors"`
	MitigatingFactors []string `json:"mitigating_factors"`
	SuggestedActions []string `json:"suggested_actions"`
	ComplianceNotes  []string `json:"compliance_notes"`
}

// FraudEvent represents a fraud event for analytics
type FraudEvent struct {
	EventID       uuid.UUID              `json:"event_id"`
	RequestID     uuid.UUID              `json:"request_id"`
	FraudType     FraudType              `json:"fraud_type"`
	EntityID      uuid.UUID              `json:"entity_id"`
	Score         float64                `json:"score"`
	RiskLevel     RiskLevel              `json:"risk_level"`
	Decision      string                 `json:"decision"`
	Outcome       string                 `json:"outcome"`
	FalsePositive bool                   `json:"false_positive"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}
