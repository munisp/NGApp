package sandbox

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Environment represents the execution environment for a tenant
type Environment string

const (
	EnvProduction Environment = "production"
	EnvSandbox    Environment = "sandbox"
)

// SandboxConfig holds sandbox-specific configuration for a tenant
type SandboxConfig struct {
	TenantID          string      `json:"tenant_id"`
	Environment       Environment `json:"environment"`
	BaseURL           string      `json:"base_url"`
	APIKeyPrefix      string      `json:"api_key_prefix"`
	DataIsolated      bool        `json:"data_isolated"`
	RateLimitMultiplier float64   `json:"rate_limit_multiplier"`
	MaxTestTransactions int       `json:"max_test_transactions"`
	AllowedIPs        []string    `json:"allowed_ips,omitempty"`
	TestData          TestDataSet `json:"test_data"`
	ExpiresAt         time.Time   `json:"expires_at"`
	CreatedAt         time.Time   `json:"created_at"`
	Status            string      `json:"status"`
}

// TestDataSet describes the test data provisioned in a sandbox
type TestDataSet struct {
	Customers    int `json:"customers"`
	Agents       int `json:"agents"`
	Transactions int `json:"transactions"`
	Accounts     int `json:"accounts"`
	Corridors    int `json:"corridors"`
}

// SandboxSession represents an active sandbox testing session
type SandboxSession struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	Environment   string    `json:"environment"`
	APIKey        string    `json:"api_key"`
	APIKeyMasked  string    `json:"api_key_masked"`
	Endpoint      string    `json:"endpoint"`
	Status        string    `json:"status"`
	RequestCount  int       `json:"request_count"`
	ErrorCount    int       `json:"error_count"`
	LastActivity  time.Time `json:"last_activity"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}

// TestScenario represents a certification test scenario
type TestScenario struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Endpoint    string `json:"endpoint"`
	Method      string `json:"method"`
	Required    bool   `json:"required"`
	Status      string `json:"status"`
	LastRun     string `json:"last_run,omitempty"`
	Result      string `json:"result,omitempty"`
}

// SandboxService manages environment isolation per tenant
type SandboxService struct {
	configs  map[string]*SandboxConfig
	sessions map[string]*SandboxSession
	mu       sync.RWMutex
}

// NewSandboxService creates a sandbox service with seed data
func NewSandboxService() *SandboxService {
	svc := &SandboxService{
		configs:  make(map[string]*SandboxConfig),
		sessions: make(map[string]*SandboxSession),
	}
	svc.seed()
	return svc
}

func (s *SandboxService) seed() {
	now := time.Now()
	tenants := []struct {
		id        string
		customers int
		agents    int
		txns      int
	}{
		{"tenant-acme-bank", 500, 200, 5000},
		{"tenant-quickcash", 200, 500, 3000},
		{"tenant-swiftremit", 300, 0, 4000},
		{"tenant-nextgen-mfb", 50, 20, 200},
	}

	for _, t := range tenants {
		// Production config
		s.configs[t.id+":production"] = &SandboxConfig{
			TenantID:            t.id,
			Environment:         EnvProduction,
			BaseURL:             "https://api.banking-crm.example.com/v1",
			APIKeyPrefix:        "prod_",
			DataIsolated:        true,
			RateLimitMultiplier: 1.0,
			MaxTestTransactions: 0,
			CreatedAt:           now.Add(-90 * 24 * time.Hour),
			Status:              "active",
		}

		// Sandbox config
		s.configs[t.id+":sandbox"] = &SandboxConfig{
			TenantID:            t.id,
			Environment:         EnvSandbox,
			BaseURL:             "https://sandbox.banking-crm.example.com/v1",
			APIKeyPrefix:        "sbx_",
			DataIsolated:        true,
			RateLimitMultiplier: 0.5,
			MaxTestTransactions: 10000,
			TestData: TestDataSet{
				Customers:    t.customers,
				Agents:       t.agents,
				Transactions: t.txns,
				Accounts:     t.customers * 2,
				Corridors:    8,
			},
			ExpiresAt: now.Add(90 * 24 * time.Hour),
			CreatedAt: now.Add(-30 * 24 * time.Hour),
			Status:    "active",
		}
	}
}

// GetConfig returns the sandbox/production config for a tenant
func (s *SandboxService) GetConfig(tenantID string, env Environment) (*SandboxConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := tenantID + ":" + string(env)
	config, ok := s.configs[key]
	if !ok {
		return nil, fmt.Errorf("no %s config for tenant %s", env, tenantID)
	}
	return config, nil
}

// ProvisionSandbox creates a new sandbox environment for a tenant
func (s *SandboxService) ProvisionSandbox(ctx context.Context, tenantID string, testCustomers int) (*SandboxConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := tenantID + ":sandbox"
	if _, exists := s.configs[key]; exists {
		return nil, fmt.Errorf("sandbox already exists for %s", tenantID)
	}

	config := &SandboxConfig{
		TenantID:            tenantID,
		Environment:         EnvSandbox,
		BaseURL:             "https://sandbox.banking-crm.example.com/v1",
		APIKeyPrefix:        "sbx_",
		DataIsolated:        true,
		RateLimitMultiplier: 0.5,
		MaxTestTransactions: 10000,
		TestData: TestDataSet{
			Customers:    testCustomers,
			Agents:       testCustomers / 5,
			Transactions: testCustomers * 10,
			Accounts:     testCustomers * 2,
			Corridors:    8,
		},
		ExpiresAt: time.Now().Add(90 * 24 * time.Hour),
		CreatedAt: time.Now(),
		Status:    "provisioning",
	}
	s.configs[key] = config

	// Simulate async provisioning
	go func() {
		time.Sleep(2 * time.Second)
		s.mu.Lock()
		config.Status = "active"
		s.mu.Unlock()
	}()

	return config, nil
}

// CreateSession starts a new sandbox testing session
func (s *SandboxService) CreateSession(tenantID string) (*SandboxSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	apiKeyBytes := make([]byte, 24)
	rand.Read(apiKeyBytes)
	apiKey := "sbx_" + hex.EncodeToString(apiKeyBytes)

	session := &SandboxSession{
		ID:          fmt.Sprintf("sess-%s", hex.EncodeToString(apiKeyBytes[:8])),
		TenantID:    tenantID,
		Environment: "sandbox",
		APIKey:      apiKey,
		APIKeyMasked: apiKey[:8] + "..." + apiKey[len(apiKey)-4:],
		Endpoint:    "https://sandbox.banking-crm.example.com/v1",
		Status:      "active",
		LastActivity: time.Now(),
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}
	s.sessions[session.ID] = session
	return session, nil
}

// GetTestScenarios returns certification test scenarios for a tenant
func (s *SandboxService) GetTestScenarios(tenantID string) []TestScenario {
	return []TestScenario{
		{ID: "ts-001", Name: "Customer CRUD", Category: "Core", Description: "Create, read, update, delete customers", Endpoint: "/v1/customers", Method: "POST/GET/PUT/DELETE", Required: true, Status: "pending"},
		{ID: "ts-002", Name: "Authentication Flow", Category: "Security", Description: "Obtain JWT token, refresh, revoke", Endpoint: "/auth/token", Method: "POST", Required: true, Status: "pending"},
		{ID: "ts-003", Name: "Transaction Processing", Category: "Banking", Description: "Create and verify transactions with idempotency", Endpoint: "/v1/banking/transactions", Method: "POST", Required: true, Status: "pending"},
		{ID: "ts-004", Name: "Agent Registration", Category: "Agent Banking", Description: "Register agent, verify KYC, activate", Endpoint: "/v1/agents", Method: "POST", Required: false, Status: "pending"},
		{ID: "ts-005", Name: "Remittance Transfer", Category: "Remittance", Description: "Initiate transfer, check status, complete", Endpoint: "/v1/remittance/transfers", Method: "POST", Required: false, Status: "pending"},
		{ID: "ts-006", Name: "Webhook Delivery", Category: "Integration", Description: "Subscribe to events, verify HMAC signature", Endpoint: "/v1/webhooks", Method: "POST", Required: true, Status: "pending"},
		{ID: "ts-007", Name: "Rate Limit Handling", Category: "Resilience", Description: "Handle 429 responses with backoff", Endpoint: "/v1/customers", Method: "GET", Required: true, Status: "pending"},
		{ID: "ts-008", Name: "Error Handling", Category: "Resilience", Description: "Validate error response format", Endpoint: "/v1/customers/invalid", Method: "GET", Required: true, Status: "pending"},
		{ID: "ts-009", Name: "Idempotency Check", Category: "Core", Description: "Send same request twice, verify single creation", Endpoint: "/v1/banking/transactions", Method: "POST", Required: true, Status: "pending"},
		{ID: "ts-010", Name: "Pagination", Category: "Core", Description: "List with page/limit, verify cursor navigation", Endpoint: "/v1/customers?page=1&limit=10", Method: "GET", Required: true, Status: "pending"},
		{ID: "ts-011", Name: "Concurrent Access", Category: "Performance", Description: "10 parallel requests, all succeed", Endpoint: "/v1/customers", Method: "GET", Required: false, Status: "pending"},
		{ID: "ts-012", Name: "Data Isolation", Category: "Security", Description: "Verify tenant A cannot access tenant B data", Endpoint: "/v1/customers", Method: "GET", Required: true, Status: "pending"},
	}
}

// ResolveEnvironment extracts the environment from request context
func ResolveEnvironment(r *http.Request) Environment {
	apiKey := r.Header.Get("X-API-Key")
	if strings.HasPrefix(apiKey, "sbx_") {
		return EnvSandbox
	}
	host := r.Host
	if strings.Contains(host, "sandbox") {
		return EnvSandbox
	}
	envHeader := r.Header.Get("X-Environment")
	if envHeader == "sandbox" {
		return EnvSandbox
	}
	return EnvProduction
}

// RegisterHTTPHandlers registers sandbox API endpoints
func (s *SandboxService) RegisterHTTPHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/sandbox/config", s.handleGetConfig)
	mux.HandleFunc("/api/sandbox/provision", s.handleProvision)
	mux.HandleFunc("/api/sandbox/session", s.handleCreateSession)
	mux.HandleFunc("/api/sandbox/scenarios", s.handleGetScenarios)
}

func (s *SandboxService) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	env := Environment(r.URL.Query().Get("environment"))
	if env == "" {
		env = EnvSandbox
	}
	config, err := s.GetConfig(tenantID, env)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (s *SandboxService) handleProvision(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		TenantID      string `json:"tenant_id"`
		TestCustomers int    `json:"test_customers"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	config, err := s.ProvisionSandbox(r.Context(), req.TenantID, req.TestCustomers)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(config)
}

func (s *SandboxService) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	tenantID := r.URL.Query().Get("tenant_id")
	if tenantID == "" {
		tenantID = r.Header.Get("X-Tenant-ID")
	}
	session, err := s.CreateSession(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(session)
}

func (s *SandboxService) handleGetScenarios(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	scenarios := s.GetTestScenarios(tenantID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scenarios)
}
