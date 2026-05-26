package apisix

import (
	"sync"
	"sync/atomic"
	"time"
)

// --- GraphQL Proxy (#28) ---

type GraphQLProxyConfig struct {
	Endpoint       string            `json:"endpoint"`
	MaxQueryDepth  int               `json:"max_query_depth"`
	MaxComplexity  int               `json:"max_complexity"`
	IntrospectionEnabled bool        `json:"introspection_enabled"`
	AllowedQueries []AllowedQuery    `json:"allowed_queries"`
}

type AllowedQuery struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	MaxDepth    int    `json:"max_depth"`
	RateLimit   int    `json:"rate_limit_per_min"`
}

var DefaultGraphQLConfig = GraphQLProxyConfig{
	Endpoint:             "/graphql",
	MaxQueryDepth:        10,
	MaxComplexity:        1000,
	IntrospectionEnabled: false,
	AllowedQueries: []AllowedQuery{
		{Name: "TransactionSearch", Description: "Search transactions by criteria", MaxDepth: 5, RateLimit: 100},
		{Name: "SettlementSummary", Description: "Settlement summary by date range", MaxDepth: 3, RateLimit: 60},
		{Name: "BankParticipantStats", Description: "Per-bank transaction statistics", MaxDepth: 4, RateLimit: 30},
		{Name: "CorridorAnalytics", Description: "Remittance corridor analytics", MaxDepth: 4, RateLimit: 30},
		{Name: "FraudAlertHistory", Description: "Fraud alert history and trends", MaxDepth: 3, RateLimit: 60},
	},
}

// --- gRPC Transcoding (#29) ---

type GRPCTranscodingRoute struct {
	ServiceName  string `json:"service_name"`
	ProtoPackage string `json:"proto_package"`
	GRPCEndpoint string `json:"grpc_endpoint"`
	RESTPattern  string `json:"rest_pattern"`
	HTTPMethod   string `json:"http_method"`
	Description  string `json:"description"`
}

var GRPCTranscodingRoutes = []GRPCTranscodingRoute{
	{ServiceName: "LedgerService", ProtoPackage: "payment.ledger.v1", GRPCEndpoint: "go-ledger:50051", RESTPattern: "/api/v1/ledger/accounts/{account_id}/balance", HTTPMethod: "GET", Description: "Get account balance"},
	{ServiceName: "LedgerService", ProtoPackage: "payment.ledger.v1", GRPCEndpoint: "go-ledger:50051", RESTPattern: "/api/v1/ledger/transfers", HTTPMethod: "POST", Description: "Create transfer"},
	{ServiceName: "FraudService", ProtoPackage: "payment.fraud.v1", GRPCEndpoint: "fraud-detection:50052", RESTPattern: "/api/v1/fraud/score", HTTPMethod: "POST", Description: "Score transaction for fraud"},
	{ServiceName: "SettlementService", ProtoPackage: "payment.settlement.v1", GRPCEndpoint: "settlement-engine:50053", RESTPattern: "/api/v1/settlements/{batch_id}", HTTPMethod: "GET", Description: "Get settlement batch"},
	{ServiceName: "ComplianceService", ProtoPackage: "payment.compliance.v1", GRPCEndpoint: "compliance-engine:50054", RESTPattern: "/api/v1/compliance/screen", HTTPMethod: "POST", Description: "Sanctions screening"},
	{ServiceName: "RemittanceService", ProtoPackage: "payment.remittance.v1", GRPCEndpoint: "remittance-engine:50055", RESTPattern: "/api/v1/remittance/quote", HTTPMethod: "POST", Description: "Get remittance quote"},
}

// --- Dynamic Upstream Discovery (#30) ---

type ServiceDiscoveryConfig struct {
	Type         string `json:"type"` // kubernetes, consul, eureka
	Namespace    string `json:"namespace"`
	LabelSelector string `json:"label_selector"`
	HealthCheck  HealthCheckConfig `json:"health_check"`
}

type HealthCheckConfig struct {
	Type     string `json:"type"` // http, tcp, grpc
	Path     string `json:"path"`
	Interval int    `json:"interval"`
	Timeout  int    `json:"timeout"`
	Successes int   `json:"successes"`
	Failures  int   `json:"failures"`
}

var DefaultServiceDiscovery = ServiceDiscoveryConfig{
	Type:          "kubernetes",
	Namespace:     "payment-switch",
	LabelSelector: "app.kubernetes.io/part-of=payment-switch",
	HealthCheck: HealthCheckConfig{
		Type:      "http",
		Path:      "/health",
		Interval:  5,
		Timeout:   3,
		Successes: 2,
		Failures:  3,
	},
}

// --- IP Geofencing (#31) ---

type GeofenceRule struct {
	Name          string   `json:"name"`
	PathPattern   string   `json:"path_pattern"`
	AllowedCIDRs  []string `json:"allowed_cidrs"`
	BlockedCIDRs  []string `json:"blocked_cidrs"`
	AllowedCountries []string `json:"allowed_countries"`
	BlockedCountries []string `json:"blocked_countries"`
	Action        string   `json:"action"` // ALLOW, BLOCK, LOG
}

var GeofenceRules = []GeofenceRule{
	{
		Name:             "domestic-payments",
		PathPattern:      "/api/v1/nip/*",
		AllowedCountries: []string{"NG"},
		Action:           "BLOCK",
	},
	{
		Name:             "outbound-remittance",
		PathPattern:      "/api/v1/remittance/outbound/*",
		AllowedCountries: []string{"NG", "GB", "US", "GH", "ZA", "KE", "CA", "DE", "FR"},
		Action:           "BLOCK",
	},
	{
		Name:             "inbound-remittance",
		PathPattern:      "/api/v1/remittance/inbound/*",
		AllowedCountries: []string{"US", "GB", "CA", "DE", "FR", "GH", "ZA", "KE", "AE", "CN", "IN", "NG"},
		Action:           "BLOCK",
	},
	{
		Name:             "admin-panel",
		PathPattern:      "/api/admin/*",
		AllowedCIDRs:     []string{"10.0.0.0/8", "172.16.0.0/12"},
		Action:           "BLOCK",
	},
	{
		Name:             "sanctions-blocked",
		PathPattern:      "/api/*",
		BlockedCountries: []string{"KP", "IR", "SY", "CU", "RU"},
		Action:           "BLOCK",
	},
}

// --- ISO 20022 Transform (#32) ---

type ISO20022Transform struct {
	SourceFormat string `json:"source_format"` // XML, JSON
	TargetFormat string `json:"target_format"` // XML, JSON
	MessageType  string `json:"message_type"`
	XSLTPath     string `json:"xslt_path,omitempty"`
}

var ISO20022Transforms = []ISO20022Transform{
	{SourceFormat: "XML", TargetFormat: "JSON", MessageType: "pacs.008.001.10"},
	{SourceFormat: "XML", TargetFormat: "JSON", MessageType: "pacs.002.001.12"},
	{SourceFormat: "XML", TargetFormat: "JSON", MessageType: "pain.001.001.11"},
	{SourceFormat: "XML", TargetFormat: "JSON", MessageType: "camt.053.001.08"},
	{SourceFormat: "JSON", TargetFormat: "XML", MessageType: "pacs.008.001.10"},
	{SourceFormat: "JSON", TargetFormat: "XML", MessageType: "pacs.002.001.12"},
}

// --- API Key Management Portal (#33) ---

type APIKeyConfig struct {
	KeyID          string    `json:"key_id"`
	Name           string    `json:"name"`
	OrganizationID string    `json:"organization_id"`
	Permissions    []string  `json:"permissions"`
	RateLimit      int       `json:"rate_limit_per_min"`
	IPWhitelist    []string  `json:"ip_whitelist"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
	LastUsedAt     time.Time `json:"last_used_at"`
	Status         string    `json:"status"` // ACTIVE, REVOKED, EXPIRED
}

type APIKeyManager struct {
	mu      sync.RWMutex
	keys    map[string]*APIKeyConfig
	totalRequests atomic.Int64
	totalBlocked  atomic.Int64
}

func NewAPIKeyManager() *APIKeyManager {
	return &APIKeyManager{
		keys: make(map[string]*APIKeyConfig),
	}
}

func (m *APIKeyManager) CreateKey(name, orgID string, perms []string, rateLimit int, ipWhitelist []string, ttl time.Duration) *APIKeyConfig {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	key := &APIKeyConfig{
		KeyID:          "apk_" + now.Format("20060102150405"),
		Name:           name,
		OrganizationID: orgID,
		Permissions:    perms,
		RateLimit:      rateLimit,
		IPWhitelist:    ipWhitelist,
		ExpiresAt:      now.Add(ttl),
		CreatedAt:      now,
		Status:         "ACTIVE",
	}
	m.keys[key.KeyID] = key
	return key
}

func (m *APIKeyManager) ValidateKey(keyID, clientIP string) (bool, string) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	m.totalRequests.Add(1)
	key, ok := m.keys[keyID]
	if !ok {
		m.totalBlocked.Add(1)
		return false, "KEY_NOT_FOUND"
	}
	if key.Status != "ACTIVE" {
		m.totalBlocked.Add(1)
		return false, "KEY_" + key.Status
	}
	if time.Now().After(key.ExpiresAt) {
		m.totalBlocked.Add(1)
		return false, "KEY_EXPIRED"
	}
	if len(key.IPWhitelist) > 0 {
		found := false
		for _, ip := range key.IPWhitelist {
			if ip == clientIP {
				found = true
				break
			}
		}
		if !found {
			m.totalBlocked.Add(1)
			return false, "IP_NOT_WHITELISTED"
		}
	}
	return true, "OK"
}
