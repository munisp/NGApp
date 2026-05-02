// Package integration provides infrastructure integration components
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// PermifyClient provides authorization checks using Permify
type PermifyClient struct {
	baseURL    string
	httpClient *http.Client
	tenantID   string
	cache      *AuthzCache
	metrics    *AuthzMetrics
	mu         sync.RWMutex
}

// PermifyConfig holds Permify client configuration
type PermifyConfig struct {
	BaseURL        string        `json:"base_url"`
	TenantID       string        `json:"tenant_id"`
	Timeout        time.Duration `json:"timeout"`
	CacheTTL       time.Duration `json:"cache_ttl"`
	CacheMaxSize   int           `json:"cache_max_size"`
	EnableMetrics  bool          `json:"enable_metrics"`
}

// DefaultPermifyConfig returns default configuration
func DefaultPermifyConfig() *PermifyConfig {
	return &PermifyConfig{
		BaseURL:       "http://permify.payment-switch.svc.cluster.local:3476",
		TenantID:      "payment-switch",
		Timeout:       5 * time.Second,
		CacheTTL:      5 * time.Minute,
		CacheMaxSize:  10000,
		EnableMetrics: true,
	}
}

// AuthzCache provides caching for authorization decisions
type AuthzCache struct {
	entries  map[string]*CacheEntry
	maxSize  int
	ttl      time.Duration
	mu       sync.RWMutex
}

// CacheEntry represents a cached authorization decision
type CacheEntry struct {
	Decision  bool
	ExpiresAt time.Time
}

// AuthzMetrics tracks authorization metrics
type AuthzMetrics struct {
	ChecksTotal     int64   `json:"checks_total"`
	ChecksAllowed   int64   `json:"checks_allowed"`
	ChecksDenied    int64   `json:"checks_denied"`
	ChecksFailed    int64   `json:"checks_failed"`
	CacheHits       int64   `json:"cache_hits"`
	CacheMisses     int64   `json:"cache_misses"`
	AvgLatencyMs    float64 `json:"avg_latency_ms"`
	mu              sync.RWMutex
}

// NewPermifyClient creates a new Permify client
func NewPermifyClient(config *PermifyConfig) *PermifyClient {
	if config == nil {
		config = DefaultPermifyConfig()
	}

	return &PermifyClient{
		baseURL: config.BaseURL,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		tenantID: config.TenantID,
		cache: &AuthzCache{
			entries: make(map[string]*CacheEntry),
			maxSize: config.CacheMaxSize,
			ttl:     config.CacheTTL,
		},
		metrics: &AuthzMetrics{},
	}
}

// Permission represents a permission to check
type Permission string

const (
	// Kill switch permissions
	PermissionActivateKillSwitch   Permission = "activate_kill_switch"
	PermissionDeactivateKillSwitch Permission = "deactivate_kill_switch"
	PermissionViewKillSwitches     Permission = "view_kill_switches"

	// Settlement permissions
	PermissionApproveSettlement    Permission = "approve_settlement"
	PermissionRejectSettlement     Permission = "reject_settlement"
	PermissionViewSettlements      Permission = "view_settlements"
	PermissionInitiateSettlement   Permission = "initiate_settlement"

	// Participant permissions
	PermissionOnboardParticipant   Permission = "onboard_participant"
	PermissionSuspendParticipant   Permission = "suspend_participant"
	PermissionActivateParticipant  Permission = "activate_participant"
	PermissionViewParticipants     Permission = "view_participants"
	PermissionSetLimits            Permission = "set_limits"

	// Transfer permissions
	PermissionViewTransfers        Permission = "view_transfers"
	PermissionReverseTransfer      Permission = "reverse_transfer"
	PermissionHoldTransfer         Permission = "hold_transfer"

	// Audit permissions
	PermissionViewAuditLogs        Permission = "view_audit_logs"
	PermissionExportAuditLogs      Permission = "export_audit_logs"

	// Regulatory permissions
	PermissionGenerateReports      Permission = "generate_reports"
	PermissionSubmitReports        Permission = "submit_reports"
	PermissionViewReports          Permission = "view_reports"

	// Fraud permissions
	PermissionViewFraudAlerts      Permission = "view_fraud_alerts"
	PermissionResolveFraudAlert    Permission = "resolve_fraud_alert"
	PermissionUpdateFraudRules     Permission = "update_fraud_rules"

	// Admin permissions
	PermissionManageUsers          Permission = "manage_users"
	PermissionManageRoles          Permission = "manage_roles"
	PermissionViewSystemMetrics    Permission = "view_system_metrics"
	PermissionManageConfiguration  Permission = "manage_configuration"
)

// ResourceType represents a resource type in the authorization model
type ResourceType string

const (
	ResourceKillSwitch    ResourceType = "kill_switch"
	ResourceSettlement    ResourceType = "settlement"
	ResourceParticipant   ResourceType = "participant"
	ResourceTransfer      ResourceType = "transfer"
	ResourceAuditLog      ResourceType = "audit_log"
	ResourceReport        ResourceType = "report"
	ResourceFraudAlert    ResourceType = "fraud_alert"
	ResourceFraudRule     ResourceType = "fraud_rule"
	ResourceUser          ResourceType = "user"
	ResourceRole          ResourceType = "role"
	ResourceSystem        ResourceType = "system"
)

// CheckRequest represents an authorization check request
type CheckRequest struct {
	Subject      Subject      `json:"subject"`
	Permission   Permission   `json:"permission"`
	Resource     Resource     `json:"resource"`
	Context      *AuthzContext `json:"context,omitempty"`
}

// Subject represents the entity requesting access
type Subject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// Resource represents the resource being accessed
type Resource struct {
	Type ResourceType `json:"type"`
	ID   string       `json:"id"`
}

// AuthzContext provides additional context for authorization decisions
type AuthzContext struct {
	IPAddress     string            `json:"ip_address,omitempty"`
	UserAgent     string            `json:"user_agent,omitempty"`
	RequestID     string            `json:"request_id,omitempty"`
	Timestamp     time.Time         `json:"timestamp"`
	Attributes    map[string]string `json:"attributes,omitempty"`
}

// CheckResponse represents an authorization check response
type CheckResponse struct {
	Allowed   bool   `json:"allowed"`
	Reason    string `json:"reason,omitempty"`
	CacheHit  bool   `json:"cache_hit"`
	LatencyMs int64  `json:"latency_ms"`
}

// Check performs an authorization check
func (c *PermifyClient) Check(ctx context.Context, req *CheckRequest) (*CheckResponse, error) {
	startTime := time.Now()

	c.metrics.mu.Lock()
	c.metrics.ChecksTotal++
	c.metrics.mu.Unlock()

	// Check cache first
	cacheKey := c.getCacheKey(req)
	if decision, found := c.cache.Get(cacheKey); found {
		c.metrics.mu.Lock()
		c.metrics.CacheHits++
		if decision {
			c.metrics.ChecksAllowed++
		} else {
			c.metrics.ChecksDenied++
		}
		c.metrics.mu.Unlock()

		return &CheckResponse{
			Allowed:   decision,
			CacheHit:  true,
			LatencyMs: time.Since(startTime).Milliseconds(),
		}, nil
	}

	c.metrics.mu.Lock()
	c.metrics.CacheMisses++
	c.metrics.mu.Unlock()

	// Build Permify check request
	permifyReq := map[string]interface{}{
		"tenant_id": c.tenantID,
		"metadata": map[string]interface{}{
			"snap_token":     "",
			"schema_version": "",
			"depth":          20,
		},
		"entity": map[string]interface{}{
			"type": string(req.Resource.Type),
			"id":   req.Resource.ID,
		},
		"permission": string(req.Permission),
		"subject": map[string]interface{}{
			"type": req.Subject.Type,
			"id":   req.Subject.ID,
		},
	}

	if req.Context != nil {
		permifyReq["context"] = map[string]interface{}{
			"tuples": []interface{}{},
			"attributes": []interface{}{},
			"data": req.Context.Attributes,
		}
	}

	reqBody, err := json.Marshal(permifyReq)
	if err != nil {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request to Permify
	httpReq, err := http.NewRequestWithContext(ctx, "POST", 
		fmt.Sprintf("%s/v1/tenants/%s/permissions/check", c.baseURL, c.tenantID),
		strings.NewReader(string(reqBody)))
	if err != nil {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("permify returned status %d: %s", resp.StatusCode, string(body))
	}

	var permifyResp struct {
		Can string `json:"can"`
	}
	if err := json.Unmarshal(body, &permifyResp); err != nil {
		c.metrics.mu.Lock()
		c.metrics.ChecksFailed++
		c.metrics.mu.Unlock()
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	allowed := permifyResp.Can == "CHECK_RESULT_ALLOWED"

	// Cache the decision
	c.cache.Set(cacheKey, allowed)

	// Update metrics
	latency := time.Since(startTime).Milliseconds()
	c.metrics.mu.Lock()
	if allowed {
		c.metrics.ChecksAllowed++
	} else {
		c.metrics.ChecksDenied++
	}
	c.metrics.AvgLatencyMs = c.metrics.AvgLatencyMs*0.9 + float64(latency)*0.1
	c.metrics.mu.Unlock()

	return &CheckResponse{
		Allowed:   allowed,
		CacheHit:  false,
		LatencyMs: latency,
	}, nil
}

// getCacheKey generates a cache key for the request
func (c *PermifyClient) getCacheKey(req *CheckRequest) string {
	return fmt.Sprintf("%s:%s:%s:%s:%s",
		req.Subject.Type, req.Subject.ID,
		req.Permission,
		req.Resource.Type, req.Resource.ID)
}

// Get retrieves a cached decision
func (cache *AuthzCache) Get(key string) (bool, bool) {
	cache.mu.RLock()
	defer cache.mu.RUnlock()

	entry, exists := cache.entries[key]
	if !exists {
		return false, false
	}

	if time.Now().After(entry.ExpiresAt) {
		return false, false
	}

	return entry.Decision, true
}

// Set stores a decision in the cache
func (cache *AuthzCache) Set(key string, decision bool) {
	cache.mu.Lock()
	defer cache.mu.Unlock()

	// Evict if at capacity
	if len(cache.entries) >= cache.maxSize {
		// Simple eviction: remove expired entries first
		now := time.Now()
		for k, v := range cache.entries {
			if now.After(v.ExpiresAt) {
				delete(cache.entries, k)
			}
		}
		// If still at capacity, remove oldest
		if len(cache.entries) >= cache.maxSize {
			for k := range cache.entries {
				delete(cache.entries, k)
				break
			}
		}
	}

	cache.entries[key] = &CacheEntry{
		Decision:  decision,
		ExpiresAt: time.Now().Add(cache.ttl),
	}
}

// Invalidate removes a cached decision
func (cache *AuthzCache) Invalidate(key string) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	delete(cache.entries, key)
}

// InvalidateAll clears the entire cache
func (cache *AuthzCache) InvalidateAll() {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.entries = make(map[string]*CacheEntry)
}

// GetMetrics returns current authorization metrics
func (c *PermifyClient) GetMetrics() *AuthzMetrics {
	c.metrics.mu.RLock()
	defer c.metrics.mu.RUnlock()

	return &AuthzMetrics{
		ChecksTotal:   c.metrics.ChecksTotal,
		ChecksAllowed: c.metrics.ChecksAllowed,
		ChecksDenied:  c.metrics.ChecksDenied,
		ChecksFailed:  c.metrics.ChecksFailed,
		CacheHits:     c.metrics.CacheHits,
		CacheMisses:   c.metrics.CacheMisses,
		AvgLatencyMs:  c.metrics.AvgLatencyMs,
	}
}

// AuthzMiddleware provides HTTP middleware for authorization
type AuthzMiddleware struct {
	client          *PermifyClient
	resourceMapper  ResourceMapper
	permissionMapper PermissionMapper
	auditLogger     AuditLogger
}

// ResourceMapper maps HTTP requests to resources
type ResourceMapper func(r *http.Request) Resource

// PermissionMapper maps HTTP requests to permissions
type PermissionMapper func(r *http.Request) Permission

// AuditLogger logs authorization decisions
type AuditLogger func(ctx context.Context, req *CheckRequest, resp *CheckResponse)

// NewAuthzMiddleware creates a new authorization middleware
func NewAuthzMiddleware(client *PermifyClient, resourceMapper ResourceMapper, permissionMapper PermissionMapper) *AuthzMiddleware {
	return &AuthzMiddleware{
		client:           client,
		resourceMapper:   resourceMapper,
		permissionMapper: permissionMapper,
	}
}

// WithAuditLogger adds an audit logger to the middleware
func (m *AuthzMiddleware) WithAuditLogger(logger AuditLogger) *AuthzMiddleware {
	m.auditLogger = logger
	return m
}

// Middleware returns the HTTP middleware handler
func (m *AuthzMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract subject from request (e.g., from JWT claims)
		subject := extractSubjectFromRequest(r)
		if subject == nil {
			http.Error(w, "Unauthorized: no subject", http.StatusUnauthorized)
			return
		}

		// Map request to resource and permission
		resource := m.resourceMapper(r)
		permission := m.permissionMapper(r)

		// Build check request
		checkReq := &CheckRequest{
			Subject:    *subject,
			Permission: permission,
			Resource:   resource,
			Context: &AuthzContext{
				IPAddress: r.RemoteAddr,
				UserAgent: r.UserAgent(),
				RequestID: r.Header.Get("X-Request-ID"),
				Timestamp: time.Now(),
			},
		}

		// Perform authorization check
		resp, err := m.client.Check(r.Context(), checkReq)
		if err != nil {
			http.Error(w, "Authorization check failed", http.StatusInternalServerError)
			return
		}

		// Log the decision
		if m.auditLogger != nil {
			m.auditLogger(r.Context(), checkReq, resp)
		}

		if !resp.Allowed {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// extractSubjectFromRequest extracts the subject from the request
func extractSubjectFromRequest(r *http.Request) *Subject {
	// Extract from JWT claims in Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil
	}

	// In production: decode JWT and extract claims
	// For now, extract from X-User-ID header (set by gateway after JWT validation)
	userID := r.Header.Get("X-User-ID")
	userType := r.Header.Get("X-User-Type")
	if userID == "" {
		return nil
	}
	if userType == "" {
		userType = "user"
	}

	return &Subject{
		Type: userType,
		ID:   userID,
	}
}

// DefaultResourceMapper provides default resource mapping
func DefaultResourceMapper() ResourceMapper {
	return func(r *http.Request) Resource {
		path := r.URL.Path
		
		// Map paths to resources
		switch {
		case strings.HasPrefix(path, "/api/v1/kill-switches"):
			id := extractResourceID(path, "/api/v1/kill-switches/")
			return Resource{Type: ResourceKillSwitch, ID: id}
		case strings.HasPrefix(path, "/api/v1/settlements"):
			id := extractResourceID(path, "/api/v1/settlements/")
			return Resource{Type: ResourceSettlement, ID: id}
		case strings.HasPrefix(path, "/api/v1/participants"):
			id := extractResourceID(path, "/api/v1/participants/")
			return Resource{Type: ResourceParticipant, ID: id}
		case strings.HasPrefix(path, "/api/v1/transfers"):
			id := extractResourceID(path, "/api/v1/transfers/")
			return Resource{Type: ResourceTransfer, ID: id}
		case strings.HasPrefix(path, "/api/v1/audit"):
			return Resource{Type: ResourceAuditLog, ID: "*"}
		case strings.HasPrefix(path, "/api/v1/reports"):
			id := extractResourceID(path, "/api/v1/reports/")
			return Resource{Type: ResourceReport, ID: id}
		case strings.HasPrefix(path, "/api/v1/fraud/alerts"):
			id := extractResourceID(path, "/api/v1/fraud/alerts/")
			return Resource{Type: ResourceFraudAlert, ID: id}
		case strings.HasPrefix(path, "/api/v1/fraud/rules"):
			id := extractResourceID(path, "/api/v1/fraud/rules/")
			return Resource{Type: ResourceFraudRule, ID: id}
		default:
			return Resource{Type: ResourceSystem, ID: "*"}
		}
	}
}

// DefaultPermissionMapper provides default permission mapping
func DefaultPermissionMapper() PermissionMapper {
	return func(r *http.Request) Permission {
		path := r.URL.Path
		method := r.Method

		// Kill switches
		if strings.HasPrefix(path, "/api/v1/kill-switches") {
			switch method {
			case "POST":
				return PermissionActivateKillSwitch
			case "DELETE":
				return PermissionDeactivateKillSwitch
			default:
				return PermissionViewKillSwitches
			}
		}

		// Settlements
		if strings.HasPrefix(path, "/api/v1/settlements") {
			if strings.HasSuffix(path, "/approve") {
				return PermissionApproveSettlement
			}
			if strings.HasSuffix(path, "/reject") {
				return PermissionRejectSettlement
			}
			if method == "POST" {
				return PermissionInitiateSettlement
			}
			return PermissionViewSettlements
		}

		// Participants
		if strings.HasPrefix(path, "/api/v1/participants") {
			if strings.HasSuffix(path, "/suspend") {
				return PermissionSuspendParticipant
			}
			if strings.HasSuffix(path, "/activate") {
				return PermissionActivateParticipant
			}
			if strings.HasSuffix(path, "/limits") {
				return PermissionSetLimits
			}
			if method == "POST" {
				return PermissionOnboardParticipant
			}
			return PermissionViewParticipants
		}

		// Transfers
		if strings.HasPrefix(path, "/api/v1/transfers") {
			if strings.HasSuffix(path, "/reverse") {
				return PermissionReverseTransfer
			}
			if strings.HasSuffix(path, "/hold") {
				return PermissionHoldTransfer
			}
			return PermissionViewTransfers
		}

		// Audit
		if strings.HasPrefix(path, "/api/v1/audit") {
			if strings.HasSuffix(path, "/export") {
				return PermissionExportAuditLogs
			}
			return PermissionViewAuditLogs
		}

		// Reports
		if strings.HasPrefix(path, "/api/v1/reports") {
			if method == "POST" && strings.HasSuffix(path, "/submit") {
				return PermissionSubmitReports
			}
			if method == "POST" {
				return PermissionGenerateReports
			}
			return PermissionViewReports
		}

		// Fraud
		if strings.HasPrefix(path, "/api/v1/fraud/alerts") {
			if strings.HasSuffix(path, "/resolve") {
				return PermissionResolveFraudAlert
			}
			return PermissionViewFraudAlerts
		}
		if strings.HasPrefix(path, "/api/v1/fraud/rules") {
			if method == "POST" || method == "PUT" || method == "DELETE" {
				return PermissionUpdateFraudRules
			}
			return PermissionViewFraudAlerts
		}

		// Default
		return PermissionViewSystemMetrics
	}
}

// extractResourceID extracts the resource ID from a path
func extractResourceID(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return "*"
	}
	remainder := strings.TrimPrefix(path, prefix)
	parts := strings.Split(remainder, "/")
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}
	return "*"
}

// PermifySchema returns the Permify schema for the payment switch
func PermifySchema() string {
	return `
entity user {}

entity role {
    relation member @user
}

entity organization {
    relation admin @user
    relation operator @user
    relation viewer @user
    relation member @role#member
}

entity kill_switch {
    relation organization @organization
    
    permission activate_kill_switch = organization.admin
    permission deactivate_kill_switch = organization.admin
    permission view_kill_switches = organization.admin or organization.operator or organization.viewer
}

entity settlement {
    relation organization @organization
    
    permission approve_settlement = organization.admin
    permission reject_settlement = organization.admin
    permission initiate_settlement = organization.admin or organization.operator
    permission view_settlements = organization.admin or organization.operator or organization.viewer
}

entity participant {
    relation organization @organization
    
    permission onboard_participant = organization.admin
    permission suspend_participant = organization.admin
    permission activate_participant = organization.admin
    permission set_limits = organization.admin or organization.operator
    permission view_participants = organization.admin or organization.operator or organization.viewer
}

entity transfer {
    relation organization @organization
    
    permission view_transfers = organization.admin or organization.operator or organization.viewer
    permission reverse_transfer = organization.admin
    permission hold_transfer = organization.admin or organization.operator
}

entity audit_log {
    relation organization @organization
    
    permission view_audit_logs = organization.admin or organization.operator
    permission export_audit_logs = organization.admin
}

entity report {
    relation organization @organization
    
    permission generate_reports = organization.admin or organization.operator
    permission submit_reports = organization.admin
    permission view_reports = organization.admin or organization.operator or organization.viewer
}

entity fraud_alert {
    relation organization @organization
    
    permission view_fraud_alerts = organization.admin or organization.operator
    permission resolve_fraud_alert = organization.admin or organization.operator
}

entity fraud_rule {
    relation organization @organization
    
    permission update_fraud_rules = organization.admin
    permission view_fraud_rules = organization.admin or organization.operator
}

entity system {
    relation organization @organization
    
    permission manage_users = organization.admin
    permission manage_roles = organization.admin
    permission view_system_metrics = organization.admin or organization.operator or organization.viewer
    permission manage_configuration = organization.admin
}
`
}

// PermifyAuthzSchema returns PostgreSQL schema for authorization audit
func PermifyAuthzSchema() string {
	return `
-- Authorization decision audit log
CREATE TABLE IF NOT EXISTS authz_decisions (
    id SERIAL PRIMARY KEY,
    decision_id VARCHAR(64) NOT NULL,
    subject_type VARCHAR(50) NOT NULL,
    subject_id VARCHAR(255) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    allowed BOOLEAN NOT NULL,
    cache_hit BOOLEAN NOT NULL,
    latency_ms INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_authz_decisions_subject 
ON authz_decisions(subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authz_decisions_resource 
ON authz_decisions(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authz_decisions_denied 
ON authz_decisions(allowed, created_at DESC) WHERE allowed = FALSE;

-- Authorization metrics aggregation
CREATE TABLE IF NOT EXISTS authz_metrics_hourly (
    hour TIMESTAMP WITH TIME ZONE NOT NULL,
    permission VARCHAR(100) NOT NULL,
    checks_total INT NOT NULL DEFAULT 0,
    checks_allowed INT NOT NULL DEFAULT 0,
    checks_denied INT NOT NULL DEFAULT 0,
    cache_hits INT NOT NULL DEFAULT 0,
    avg_latency_ms DECIMAL(10,2),
    PRIMARY KEY (hour, permission)
);
`
}
