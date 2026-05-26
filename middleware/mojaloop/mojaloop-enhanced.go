package mojaloop

import (
	"time"
)

// --- Full Hub Deployment (#54) ---

type MojaloopHubConfig struct {
	Components []HubComponent `json:"components"`
	Version    string         `json:"version"`
	Namespace  string         `json:"namespace"`
}

type HubComponent struct {
	Name        string `json:"name"`
	Image       string `json:"image"`
	Port        int    `json:"port"`
	Replicas    int    `json:"replicas"`
	Description string `json:"description"`
	Status      string `json:"status"` // DEPLOYED, PENDING, DISABLED
}

var DefaultHubConfig = MojaloopHubConfig{
	Version:   "16.0.0",
	Namespace: "mojaloop",
	Components: []HubComponent{
		{Name: "central-ledger", Image: "mojaloop/central-ledger:v17.3.2", Port: 3001, Replicas: 3, Description: "Core ledger for participant positions and settlement", Status: "DEPLOYED"},
		{Name: "ml-api-adapter", Image: "mojaloop/ml-api-adapter:v14.0.6", Port: 3000, Replicas: 3, Description: "FSPIOP API adapter for transfer/quote requests", Status: "DEPLOYED"},
		{Name: "account-lookup-service", Image: "mojaloop/account-lookup-service:v15.2.1", Port: 4002, Replicas: 2, Description: "ALS for party/participant resolution", Status: "DEPLOYED"},
		{Name: "quoting-service", Image: "mojaloop/quoting-service:v15.7.1", Port: 3002, Replicas: 2, Description: "Quote calculation and fee determination", Status: "DEPLOYED"},
		{Name: "central-settlement", Image: "mojaloop/central-settlement:v16.0.1", Port: 3007, Replicas: 2, Description: "Settlement windows and net positions", Status: "DEPLOYED"},
		{Name: "transaction-requests-service", Image: "mojaloop/transaction-requests-service:v14.1.4", Port: 4003, Replicas: 2, Description: "Transaction request handling for payee-initiated", Status: "DEPLOYED"},
		{Name: "auth-service", Image: "mojaloop/auth-service:v13.0.4", Port: 4004, Replicas: 2, Description: "PISP consent and authorization", Status: "DEPLOYED"},
		{Name: "thirdparty-api-adapter", Image: "mojaloop/thirdparty-api-adapter:v13.0.3", Port: 4005, Replicas: 2, Description: "Third-party payment initiation API", Status: "DEPLOYED"},
		{Name: "bulk-api-adapter", Image: "mojaloop/bulk-api-adapter:v16.0.0", Port: 3003, Replicas: 2, Description: "Bulk transfer handling", Status: "DEPLOYED"},
		{Name: "simulator", Image: "mojaloop/simulator:v13.0.1", Port: 8444, Replicas: 1, Description: "DFSP simulator for testing", Status: "DEPLOYED"},
	},
}

// --- PISP Implementation (#55) ---

type PISPConfig struct {
	ConsentEndpoint  string          `json:"consent_endpoint"`
	AuthServiceURL   string          `json:"auth_service_url"`
	FIDOEnabled      bool            `json:"fido_enabled"`
	Scopes           []ConsentScope  `json:"scopes"`
	RegisteredPISPs  []RegisteredPISP `json:"registered_pisps"`
}

type ConsentScope struct {
	AccountID string `json:"account_id"`
	Actions   []string `json:"actions"` // ACCOUNTS_GET_BALANCE, ACCOUNTS_TRANSFER
}

type RegisteredPISP struct {
	PISPID       string    `json:"pisp_id"`
	Name         string    `json:"name"`
	CallbackURL  string    `json:"callback_url"`
	Status       string    `json:"status"` // ACTIVE, SUSPENDED, PENDING
	RegisteredAt time.Time `json:"registered_at"`
	Scopes       []string  `json:"scopes"`
}

var DefaultPISPConfig = PISPConfig{
	ConsentEndpoint: "/thirdpartyRequests/transactions",
	AuthServiceURL:  "http://auth-service.mojaloop.svc:4004",
	FIDOEnabled:     true,
	Scopes: []ConsentScope{
		{AccountID: "*", Actions: []string{"ACCOUNTS_GET_BALANCE", "ACCOUNTS_TRANSFER"}},
	},
	RegisteredPISPs: []RegisteredPISP{
		{PISPID: "pisp-paystack", Name: "Paystack", CallbackURL: "https://api.paystack.co/mojaloop/callback", Status: "ACTIVE", Scopes: []string{"ACCOUNTS_GET_BALANCE", "ACCOUNTS_TRANSFER"}},
		{PISPID: "pisp-flutterwave", Name: "Flutterwave", CallbackURL: "https://api.flutterwave.com/mojaloop/callback", Status: "ACTIVE", Scopes: []string{"ACCOUNTS_TRANSFER"}},
		{PISPID: "pisp-kuda", Name: "Kuda Bank", CallbackURL: "https://api.kuda.com/mojaloop/callback", Status: "PENDING", Scopes: []string{"ACCOUNTS_GET_BALANCE", "ACCOUNTS_TRANSFER"}},
	},
}

// --- Oracle for Party Resolution (#56) ---

type OracleConfig struct {
	Oracles []Oracle `json:"oracles"`
}

type Oracle struct {
	OracleID    string `json:"oracle_id"`
	Name        string `json:"name"`
	PartyIDType string `json:"party_id_type"` // MSISDN, ACCOUNT_ID, EMAIL, PERSONAL_ID, BUSINESS
	Endpoint    string `json:"endpoint"`
	IsDefault   bool   `json:"is_default"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

var DefaultOracleConfig = OracleConfig{
	Oracles: []Oracle{
		{OracleID: "oracle-msisdn", Name: "MSISDN Oracle", PartyIDType: "MSISDN", Endpoint: "http://oracle-msisdn.mojaloop.svc:8080", IsDefault: true, Description: "Phone number → DFSP routing oracle", Status: "ACTIVE"},
		{OracleID: "oracle-account", Name: "Account Oracle", PartyIDType: "ACCOUNT_ID", Endpoint: "http://oracle-account.mojaloop.svc:8080", IsDefault: true, Description: "NUBAN account number → Bank routing oracle", Status: "ACTIVE"},
		{OracleID: "oracle-bvn", Name: "BVN Oracle", PartyIDType: "PERSONAL_ID", Endpoint: "http://oracle-bvn.mojaloop.svc:8080", IsDefault: false, Description: "BVN → primary bank resolution oracle", Status: "ACTIVE"},
		{OracleID: "oracle-merchant", Name: "Merchant Oracle", PartyIDType: "BUSINESS", Endpoint: "http://oracle-merchant.mojaloop.svc:8080", IsDefault: false, Description: "Merchant ID → acquirer bank oracle", Status: "ACTIVE"},
	},
}
