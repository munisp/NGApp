package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// APIKey represents a self-service API key for a tenant
type APIKey struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenant_id"`
	Name         string    `json:"name"`
	Prefix       string    `json:"prefix"`
	KeyHash      string    `json:"-"`
	KeyMasked    string    `json:"key_masked"`
	Environment  string    `json:"environment"`
	Permissions  []string  `json:"permissions"`
	RateLimit    int       `json:"rate_limit"`
	Status       string    `json:"status"`
	LastUsedAt   *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	CreatedBy    string    `json:"created_by"`
}

// APIKeyCreated is returned when a new key is created (only time full key is visible)
type APIKeyCreated struct {
	APIKey
	Key string `json:"key"`
}

// APIKeyUsageStats tracks usage per key
type APIKeyUsageStats struct {
	KeyID        string `json:"key_id"`
	TotalCalls   int    `json:"total_calls"`
	Last24Hours  int    `json:"last_24_hours"`
	Last7Days    int    `json:"last_7_days"`
	ErrorRate    float64 `json:"error_rate_pct"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
}

// APIKeyService manages self-service API keys per tenant
type APIKeyService struct {
	keys map[string]*APIKey
	mu   sync.RWMutex
}

// NewAPIKeyService creates a new API key service with seed data
func NewAPIKeyService() *APIKeyService {
	svc := &APIKeyService{
		keys: make(map[string]*APIKey),
	}
	svc.seed()
	return svc
}

func (s *APIKeyService) seed() {
	now := time.Now()
	used1 := now.Add(-2 * time.Hour)
	used2 := now.Add(-30 * time.Minute)
	used3 := now.Add(-5 * time.Hour)
	exp1 := now.Add(90 * 24 * time.Hour)
	exp2 := now.Add(30 * 24 * time.Hour)

	seeds := []struct {
		id, tenant, name, env, createdBy string
		perms []string
		rate  int
		status string
		lastUsed *time.Time
		expires  *time.Time
		daysBefore int
	}{
		{"key-001", "tenant-acme-bank", "Production API Key", "production", "adebayo@acmebank.ng",
			[]string{"customers:read", "customers:write", "transactions:read", "transactions:write", "analytics:read"},
			1000, "active", &used1, &exp1, 120},
		{"key-002", "tenant-acme-bank", "Sandbox Testing Key", "sandbox", "adebayo@acmebank.ng",
			[]string{"customers:read", "customers:write", "transactions:read", "transactions:write", "agents:read", "agents:write"},
			500, "active", &used2, nil, 45},
		{"key-003", "tenant-acme-bank", "Analytics Read-Only", "production", "data-team@acmebank.ng",
			[]string{"analytics:read", "customers:read"},
			200, "active", &used3, &exp2, 30},
		{"key-004", "tenant-quickcash", "Agent Operations Key", "production", "halima@quickcash.ng",
			[]string{"agents:read", "agents:write", "transactions:read", "transactions:write"},
			500, "active", &used1, nil, 60},
		{"key-005", "tenant-quickcash", "Mobile App Key", "production", "dev@quickcash.ng",
			[]string{"customers:read", "agents:read", "transactions:read"},
			300, "active", &used2, nil, 55},
		{"key-006", "tenant-swiftremit", "Remittance Integration Key", "production", "chidinma@swiftremit.com",
			[]string{"transfers:read", "transfers:write", "corridors:read", "customers:read"},
			2000, "active", &used1, nil, 40},
		{"key-007", "tenant-swiftremit", "Compliance Key", "production", "compliance@swiftremit.com",
			[]string{"kyc:read", "sanctions:read", "transfers:read"},
			100, "active", &used3, nil, 35},
		{"key-008", "tenant-nextgen-mfb", "Trial Key", "sandbox", "musa@nextgenmfb.ng",
			[]string{"customers:read", "customers:write"},
			100, "active", nil, nil, 5},
		{"key-009", "tenant-acme-bank", "Deprecated Key", "production", "former-dev@acmebank.ng",
			[]string{"customers:read"}, 100, "revoked", nil, nil, 200},
	}

	for _, seed := range seeds {
		rawKey := generateRawKey(seed.env)
		s.keys[seed.id] = &APIKey{
			ID:          seed.id,
			TenantID:    seed.tenant,
			Name:        seed.name,
			Prefix:      keyPrefix(seed.env),
			KeyHash:     hashKey(rawKey),
			KeyMasked:   rawKey[:12] + "..." + rawKey[len(rawKey)-4:],
			Environment: seed.env,
			Permissions: seed.perms,
			RateLimit:   seed.rate,
			Status:      seed.status,
			LastUsedAt:  seed.lastUsed,
			ExpiresAt:   seed.expires,
			CreatedAt:   now.Add(-time.Duration(seed.daysBefore) * 24 * time.Hour),
			CreatedBy:   seed.createdBy,
		}
	}
}

// CreateKey generates a new API key for a tenant
func (s *APIKeyService) CreateKey(tenantID, name, environment, createdBy string, permissions []string, rateLimit int) (*APIKeyCreated, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rawKey := generateRawKey(environment)
	idBytes := make([]byte, 4)
	rand.Read(idBytes)
	id := "key-" + hex.EncodeToString(idBytes)

	key := &APIKey{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Prefix:      keyPrefix(environment),
		KeyHash:     hashKey(rawKey),
		KeyMasked:   rawKey[:12] + "..." + rawKey[len(rawKey)-4:],
		Environment: environment,
		Permissions: permissions,
		RateLimit:   rateLimit,
		Status:      "active",
		CreatedAt:   time.Now(),
		CreatedBy:   createdBy,
	}
	s.keys[id] = key

	return &APIKeyCreated{APIKey: *key, Key: rawKey}, nil
}

// ListKeys returns all keys for a tenant
func (s *APIKeyService) ListKeys(tenantID string) []*APIKey {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*APIKey
	for _, key := range s.keys {
		if tenantID == "" || key.TenantID == tenantID {
			result = append(result, key)
		}
	}
	return result
}

// RevokeKey disables an API key
func (s *APIKeyService) RevokeKey(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key, ok := s.keys[id]
	if !ok {
		return fmt.Errorf("key not found: %s", id)
	}
	key.Status = "revoked"
	return nil
}

// RotateKey creates a new key with the same permissions and revokes the old one
func (s *APIKeyService) RotateKey(id string) (*APIKeyCreated, error) {
	s.mu.Lock()
	old, ok := s.keys[id]
	if !ok {
		s.mu.Unlock()
		return nil, fmt.Errorf("key not found: %s", id)
	}
	old.Status = "revoked"
	s.mu.Unlock()

	return s.CreateKey(old.TenantID, old.Name+" (rotated)", old.Environment, old.CreatedBy, old.Permissions, old.RateLimit)
}

// GetKeyUsageStats returns usage statistics for a key
func (s *APIKeyService) GetKeyUsageStats(id string) *APIKeyUsageStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key, ok := s.keys[id]
	if !ok {
		return nil
	}
	// Simulated stats based on key age and rate limit
	daysOld := int(time.Since(key.CreatedAt).Hours() / 24)
	dailyCalls := key.RateLimit * 60 * 8 / 100 // ~8% of hourly limit over 8 hours
	return &APIKeyUsageStats{
		KeyID:        id,
		TotalCalls:   dailyCalls * daysOld,
		Last24Hours:  dailyCalls,
		Last7Days:    dailyCalls * 7,
		ErrorRate:    2.1,
		AvgLatencyMs: 45.7,
	}
}

// AvailablePermissions returns all permission scopes
func AvailablePermissions() []string {
	return []string{
		"customers:read", "customers:write",
		"transactions:read", "transactions:write",
		"agents:read", "agents:write",
		"transfers:read", "transfers:write",
		"corridors:read",
		"campaigns:read", "campaigns:write",
		"analytics:read",
		"webhooks:read", "webhooks:write",
		"kyc:read", "kyc:write",
		"sanctions:read",
	}
}

func generateRawKey(env string) string {
	b := make([]byte, 24)
	rand.Read(b)
	return keyPrefix(env) + hex.EncodeToString(b)
}

func keyPrefix(env string) string {
	if env == "sandbox" {
		return "sbx_"
	}
	return "prod_"
}

func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// RegisterHTTPHandlers registers API key endpoints
func (s *APIKeyService) RegisterHTTPHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/keys", s.handleKeys)
	mux.HandleFunc("/api/keys/permissions", s.handlePermissions)
}

func (s *APIKeyService) handleKeys(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	switch r.Method {
	case http.MethodGet:
		keys := s.ListKeys(tenantID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(keys)
	case http.MethodPost:
		var req struct {
			Name        string   `json:"name"`
			Environment string   `json:"environment"`
			Permissions []string `json:"permissions"`
			RateLimit   int      `json:"rate_limit"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		created, err := s.CreateKey(tenantID, req.Name, req.Environment, "admin", req.Permissions, req.RateLimit)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *APIKeyService) handlePermissions(w http.ResponseWriter, r *http.Request) {
	perms := AvailablePermissions()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perms)
}
