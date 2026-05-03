package keycloak

import (
	"time"
)

// --- BVN/NIN Custom SPI (#34) ---

type BVNNINSPIConfig struct {
	NIBSSEndpoint     string `json:"nibss_endpoint"`
	NINMAEndpoint     string `json:"ninma_endpoint"`
	BVNValidation     bool   `json:"bvn_validation"`
	NINValidation     bool   `json:"nin_validation"`
	BiometricMatch    bool   `json:"biometric_match"`
	MatchThreshold    float64 `json:"match_threshold"`
	CacheEnabled      bool   `json:"cache_enabled"`
	CacheTTLHours     int    `json:"cache_ttl_hours"`
	MaxRetries        int    `json:"max_retries"`
	TimeoutMs         int    `json:"timeout_ms"`
}

type BVNVerificationResult struct {
	BVN            string    `json:"bvn"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	MiddleName     string    `json:"middle_name"`
	DateOfBirth    string    `json:"date_of_birth"`
	PhoneNumber    string    `json:"phone_number"`
	Gender         string    `json:"gender"`
	BankCode       string    `json:"bank_code"`
	MatchScore     float64   `json:"match_score"`
	Verified       bool      `json:"verified"`
	VerifiedAt     time.Time `json:"verified_at"`
	WatchlistMatch bool      `json:"watchlist_match"`
}

var DefaultBVNSPIConfig = BVNNINSPIConfig{
	NIBSSEndpoint:  "https://api.nibss-plc.com.ng/bvn/v2/verify",
	NINMAEndpoint:  "https://api.nimc.gov.ng/v1/verify",
	BVNValidation:  true,
	NINValidation:  true,
	BiometricMatch: true,
	MatchThreshold: 0.85,
	CacheEnabled:   true,
	CacheTTLHours:  24,
	MaxRetries:     3,
	TimeoutMs:      5000,
}

// --- Adaptive Authentication (#35) ---

type AdaptiveAuthPolicy struct {
	Name           string           `json:"name"`
	Conditions     []AuthCondition  `json:"conditions"`
	RequiredStepUp string           `json:"required_step_up"` // NONE, OTP, BIOMETRIC, HARDWARE_TOKEN
	Description    string           `json:"description"`
}

type AuthCondition struct {
	Field    string `json:"field"`    // amount, country, time, device, ip_risk
	Operator string `json:"operator"` // gt, lt, eq, in, not_in
	Value    string `json:"value"`
}

var AdaptiveAuthPolicies = []AdaptiveAuthPolicy{
	{
		Name: "high-value-transfer",
		Conditions: []AuthCondition{
			{Field: "amount", Operator: "gt", Value: "5000000"},
		},
		RequiredStepUp: "OTP",
		Description:    "Transfers above ₦50,000 require OTP verification",
	},
	{
		Name: "very-high-value-transfer",
		Conditions: []AuthCondition{
			{Field: "amount", Operator: "gt", Value: "50000000"},
		},
		RequiredStepUp: "BIOMETRIC",
		Description:    "Transfers above ₦500,000 require biometric verification",
	},
	{
		Name: "cross-border-remittance",
		Conditions: []AuthCondition{
			{Field: "country", Operator: "not_in", Value: "NG"},
		},
		RequiredStepUp: "OTP",
		Description:    "Cross-border remittances require OTP",
	},
	{
		Name: "new-device",
		Conditions: []AuthCondition{
			{Field: "device", Operator: "eq", Value: "NEW"},
		},
		RequiredStepUp: "OTP",
		Description:    "New device login requires OTP",
	},
	{
		Name: "high-risk-ip",
		Conditions: []AuthCondition{
			{Field: "ip_risk", Operator: "gt", Value: "0.7"},
		},
		RequiredStepUp: "BIOMETRIC",
		Description:    "High-risk IP requires biometric step-up",
	},
	{
		Name: "admin-actions",
		Conditions: []AuthCondition{
			{Field: "role", Operator: "eq", Value: "ADMIN"},
			{Field: "action", Operator: "in", Value: "CREATE_USER,MODIFY_LIMITS,APPROVE_SETTLEMENT"},
		},
		RequiredStepUp: "HARDWARE_TOKEN",
		Description:    "Admin privileged actions require hardware token",
	},
}

// --- Bank IdP Federation (#36) ---

type FederatedIdP struct {
	BankCode     string `json:"bank_code"`
	BankName     string `json:"bank_name"`
	Protocol     string `json:"protocol"` // SAML, OIDC
	ProviderURL  string `json:"provider_url"`
	ClientID     string `json:"client_id"`
	Enabled      bool   `json:"enabled"`
	AutoLink     bool   `json:"auto_link"`
	FirstBrokerLogin string `json:"first_broker_login"` // review, auto-link
}

var FederatedIdPs = []FederatedIdP{
	{BankCode: "058", BankName: "GTBank", Protocol: "OIDC", ProviderURL: "https://id.gtbank.com/realms/corporate", ClientID: "payment-switch-gtb", Enabled: true, AutoLink: true, FirstBrokerLogin: "auto-link"},
	{BankCode: "044", BankName: "Access Bank", Protocol: "SAML", ProviderURL: "https://sso.accessbankplc.com/adfs/ls", ClientID: "payment-switch-access", Enabled: true, AutoLink: true, FirstBrokerLogin: "auto-link"},
	{BankCode: "057", BankName: "Zenith Bank", Protocol: "OIDC", ProviderURL: "https://id.zenithbank.com/auth", ClientID: "payment-switch-zenith", Enabled: true, AutoLink: false, FirstBrokerLogin: "review"},
	{BankCode: "011", BankName: "First Bank", Protocol: "SAML", ProviderURL: "https://sso.firstbanknigeria.com/saml2", ClientID: "payment-switch-firstbank", Enabled: true, AutoLink: true, FirstBrokerLogin: "auto-link"},
	{BankCode: "033", BankName: "UBA", Protocol: "OIDC", ProviderURL: "https://auth.ubagroup.com/realms/corporate", ClientID: "payment-switch-uba", Enabled: false, AutoLink: false, FirstBrokerLogin: "review"},
}

// --- Token Exchange (#37) ---

type TokenExchangeConfig struct {
	GrantType       string `json:"grant_type"` // urn:ietf:params:oauth:grant-type:token-exchange
	SubjectTokenType string `json:"subject_token_type"` // urn:ietf:params:oauth:token-type:access_token
	RequestedTokenType string `json:"requested_token_type"`
	Audience        string `json:"audience"`
	Scope           string `json:"scope"`
}

type ServiceTokenExchange struct {
	SourceService  string `json:"source_service"`
	TargetService  string `json:"target_service"`
	Audience       string `json:"audience"`
	Scopes         []string `json:"scopes"`
	CacheTokenSec  int    `json:"cache_token_sec"`
}

var ServiceExchanges = []ServiceTokenExchange{
	{SourceService: "go-ledger", TargetService: "temporal-server", Audience: "temporal-api", Scopes: []string{"workflow:execute", "workflow:signal"}, CacheTokenSec: 300},
	{SourceService: "go-ledger", TargetService: "fraud-detection", Audience: "fraud-api", Scopes: []string{"score:read"}, CacheTokenSec: 60},
	{SourceService: "fraud-detection", TargetService: "opensearch", Audience: "search-api", Scopes: []string{"index:read", "index:write"}, CacheTokenSec: 300},
	{SourceService: "settlement-engine", TargetService: "tigerbeetle", Audience: "ledger-api", Scopes: []string{"transfer:create", "account:read"}, CacheTokenSec: 60},
	{SourceService: "web-portal", TargetService: "go-ledger", Audience: "ledger-api", Scopes: []string{"transfer:create", "account:read"}, CacheTokenSec: 300},
}

// --- Brute Force Detection (#38) ---

type BruteForcePolicy struct {
	RealmName            string `json:"realm_name"`
	MaxLoginFailures     int    `json:"max_login_failures"`
	WaitIncrementSec     int    `json:"wait_increment_sec"`
	MaxWaitSec           int    `json:"max_wait_sec"`
	QuickLoginCheckMs    int    `json:"quick_login_check_ms"`
	MinQuickLoginWaitSec int    `json:"min_quick_login_wait_sec"`
	PermanentLockout     bool   `json:"permanent_lockout"`
}

var BruteForcePolicies = []BruteForcePolicy{
	{RealmName: "payment-switch", MaxLoginFailures: 3, WaitIncrementSec: 60, MaxWaitSec: 3600, QuickLoginCheckMs: 1000, MinQuickLoginWaitSec: 60, PermanentLockout: false},
	{RealmName: "payment-switch-admin", MaxLoginFailures: 5, WaitIncrementSec: 120, MaxWaitSec: 7200, QuickLoginCheckMs: 2000, MinQuickLoginWaitSec: 120, PermanentLockout: true},
	{RealmName: "payment-switch-api", MaxLoginFailures: 10, WaitIncrementSec: 30, MaxWaitSec: 1800, QuickLoginCheckMs: 500, MinQuickLoginWaitSec: 30, PermanentLockout: false},
}
