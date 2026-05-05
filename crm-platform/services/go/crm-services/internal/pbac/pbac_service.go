package pbac

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Policy-Based Access Control (PBAC) with attribute-based policies,
// hierarchical resource trees, and dynamic policy evaluation

type Policy struct {
	ID          string            `json:"id" db:"id"`
	Name        string            `json:"name" db:"name"`
	Description string            `json:"description" db:"description"`
	TenantID    string            `json:"tenant_id" db:"tenant_id"`
	Priority    int               `json:"priority" db:"priority"`
	Effect      PolicyEffect      `json:"effect" db:"effect"`
	Subjects    []SubjectMatcher  `json:"subjects"`
	Resources   []ResourceMatcher `json:"resources"`
	Actions     []string          `json:"actions"`
	Conditions  []Condition       `json:"conditions,omitempty"`
	Obligations []Obligation      `json:"obligations,omitempty"`
	Enabled     bool              `json:"enabled" db:"enabled"`
	Version     int               `json:"version" db:"version"`
	CreatedAt   time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
	CreatedBy   string            `json:"created_by" db:"created_by"`
}

type PolicyEffect string

const (
	EffectAllow PolicyEffect = "allow"
	EffectDeny  PolicyEffect = "deny"
)

type SubjectMatcher struct {
	Type       string            `json:"type"`
	Attributes map[string]string `json:"attributes"`
}

type ResourceMatcher struct {
	Type    string `json:"type"`
	Pattern string `json:"pattern"`
}

type Condition struct {
	Attribute string      `json:"attribute"`
	Operator  string      `json:"operator"`
	Value     interface{} `json:"value"`
}

type Obligation struct {
	Type       string                 `json:"type"`
	Parameters map[string]interface{} `json:"parameters"`
}

type AccessRequest struct {
	SubjectID    string                 `json:"subject_id"`
	SubjectType  string                 `json:"subject_type"`
	SubjectAttrs map[string]interface{} `json:"subject_attrs"`
	Resource     string                 `json:"resource"`
	ResourceType string                 `json:"resource_type"`
	Action       string                 `json:"action"`
	TenantID     string                 `json:"tenant_id"`
	Environment  map[string]interface{} `json:"environment"`
	Context      map[string]interface{} `json:"context"`
}

type AccessDecision struct {
	Allowed     bool         `json:"allowed"`
	PolicyID    string       `json:"policy_id,omitempty"`
	PolicyName  string       `json:"policy_name,omitempty"`
	Effect      PolicyEffect `json:"effect"`
	Reason      string       `json:"reason"`
	Obligations []Obligation `json:"obligations,omitempty"`
	EvaluatedAt time.Time    `json:"evaluated_at"`
	Duration    string       `json:"duration"`
}

// Role represents a named collection of permissions
type Role struct {
	ID          string   `json:"id" db:"id"`
	Name        string   `json:"name" db:"name"`
	TenantID    string   `json:"tenant_id" db:"tenant_id"`
	Description string   `json:"description" db:"description"`
	Permissions []string `json:"permissions"`
	ParentRole  string   `json:"parent_role,omitempty" db:"parent_role"`
	IsSystem    bool     `json:"is_system" db:"is_system"`
}

// ResourceNode represents a node in the resource hierarchy tree
type ResourceNode struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`
	Name     string          `json:"name"`
	Parent   string          `json:"parent,omitempty"`
	Children []*ResourceNode `json:"children,omitempty"`
}

type PolicyRepository interface {
	CreatePolicy(ctx context.Context, policy *Policy) error
	UpdatePolicy(ctx context.Context, policy *Policy) error
	DeletePolicy(ctx context.Context, id string) error
	GetPolicy(ctx context.Context, id string) (*Policy, error)
	ListPolicies(ctx context.Context, tenantID string) ([]*Policy, error)
	GetPoliciesForResource(ctx context.Context, tenantID, resourceType string) ([]*Policy, error)

	CreateRole(ctx context.Context, role *Role) error
	UpdateRole(ctx context.Context, role *Role) error
	DeleteRole(ctx context.Context, id string) error
	GetRole(ctx context.Context, id string) (*Role, error)
	ListRoles(ctx context.Context, tenantID string) ([]*Role, error)
	GetUserRoles(ctx context.Context, tenantID, userID string) ([]*Role, error)
	AssignRole(ctx context.Context, tenantID, userID, roleID string) error
	RevokeRole(ctx context.Context, tenantID, userID, roleID string) error
}

// PBACService implements policy-based access control
type PBACService struct {
	repo       PolicyRepository
	cache      *policyCache
	decisionCh chan *decisionLog
}

type policyCache struct {
	mu       sync.RWMutex
	policies map[string][]*Policy
	ttl      time.Duration
	loaded   map[string]time.Time
}

type decisionLog struct {
	Request  *AccessRequest  `json:"request"`
	Decision *AccessDecision `json:"decision"`
}

func NewPBACService(repo PolicyRepository) *PBACService {
	svc := &PBACService{
		repo: repo,
		cache: &policyCache{
			policies: make(map[string][]*Policy),
			ttl:      5 * time.Minute,
			loaded:   make(map[string]time.Time),
		},
		decisionCh: make(chan *decisionLog, 10000),
	}
	go svc.processDecisionLogs()
	return svc
}

func (s *PBACService) Evaluate(ctx context.Context, req *AccessRequest) (*AccessDecision, error) {
	start := time.Now()
	policies, err := s.getPolicies(ctx, req.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to load policies: %w", err)
	}

	var matchedDeny *Policy
	var matchedAllow *Policy

	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		if !s.matchSubject(p.Subjects, req) {
			continue
		}
		if !s.matchResource(p.Resources, req) {
			continue
		}
		if !s.matchAction(p.Actions, req.Action) {
			continue
		}
		if !s.evaluateConditions(p.Conditions, req) {
			continue
		}
		if p.Effect == EffectDeny {
			if matchedDeny == nil || p.Priority > matchedDeny.Priority {
				matchedDeny = p
			}
		} else {
			if matchedAllow == nil || p.Priority > matchedAllow.Priority {
				matchedAllow = p
			}
		}
	}

	decision := &AccessDecision{
		EvaluatedAt: time.Now().UTC(),
		Duration:    time.Since(start).String(),
	}

	// Deny-overrides combining: any explicit deny wins
	if matchedDeny != nil {
		decision.Allowed = false
		decision.Effect = EffectDeny
		decision.PolicyID = matchedDeny.ID
		decision.PolicyName = matchedDeny.Name
		decision.Reason = fmt.Sprintf("Denied by policy: %s", matchedDeny.Name)
		decision.Obligations = matchedDeny.Obligations
	} else if matchedAllow != nil {
		decision.Allowed = true
		decision.Effect = EffectAllow
		decision.PolicyID = matchedAllow.ID
		decision.PolicyName = matchedAllow.Name
		decision.Reason = fmt.Sprintf("Allowed by policy: %s", matchedAllow.Name)
		decision.Obligations = matchedAllow.Obligations
	} else {
		decision.Allowed = false
		decision.Effect = EffectDeny
		decision.Reason = "No matching policy found (default deny)"
	}

	s.decisionCh <- &decisionLog{Request: req, Decision: decision}
	return decision, nil
}

func (s *PBACService) matchSubject(matchers []SubjectMatcher, req *AccessRequest) bool {
	if len(matchers) == 0 {
		return true
	}
	for _, m := range matchers {
		if m.Type != "" && m.Type != req.SubjectType && m.Type != "*" {
			continue
		}
		attrMatch := true
		for k, v := range m.Attributes {
			if reqVal, ok := req.SubjectAttrs[k]; ok {
				if fmt.Sprintf("%v", reqVal) != v && v != "*" {
					attrMatch = false
					break
				}
			} else if v != "*" {
				attrMatch = false
				break
			}
		}
		if attrMatch {
			return true
		}
	}
	return false
}

func (s *PBACService) matchResource(matchers []ResourceMatcher, req *AccessRequest) bool {
	if len(matchers) == 0 {
		return true
	}
	for _, m := range matchers {
		if m.Type != "" && m.Type != req.ResourceType && m.Type != "*" {
			continue
		}
		if m.Pattern == "" || m.Pattern == "*" {
			return true
		}
		matched, _ := regexp.MatchString(m.Pattern, req.Resource)
		if matched {
			return true
		}
	}
	return false
}

func (s *PBACService) matchAction(actions []string, requestedAction string) bool {
	if len(actions) == 0 {
		return true
	}
	for _, a := range actions {
		if a == "*" || a == requestedAction {
			return true
		}
		if strings.HasSuffix(a, ":*") {
			prefix := strings.TrimSuffix(a, ":*")
			if strings.HasPrefix(requestedAction, prefix+":") {
				return true
			}
		}
	}
	return false
}

func (s *PBACService) evaluateConditions(conditions []Condition, req *AccessRequest) bool {
	for _, c := range conditions {
		val := s.resolveAttribute(c.Attribute, req)
		if !s.evaluateCondition(c, val) {
			return false
		}
	}
	return true
}

func (s *PBACService) resolveAttribute(attr string, req *AccessRequest) interface{} {
	parts := strings.SplitN(attr, ".", 2)
	if len(parts) < 2 {
		return nil
	}
	switch parts[0] {
	case "subject":
		return req.SubjectAttrs[parts[1]]
	case "environment":
		if parts[1] == "time" {
			return time.Now().UTC()
		}
		if parts[1] == "ip" {
			if v, ok := req.Environment["ip"]; ok {
				return v
			}
		}
		return req.Environment[parts[1]]
	case "context":
		return req.Context[parts[1]]
	}
	return nil
}

func (s *PBACService) evaluateCondition(c Condition, val interface{}) bool {
	switch c.Operator {
	case "equals":
		return fmt.Sprintf("%v", val) == fmt.Sprintf("%v", c.Value)
	case "not_equals":
		return fmt.Sprintf("%v", val) != fmt.Sprintf("%v", c.Value)
	case "contains":
		return strings.Contains(fmt.Sprintf("%v", val), fmt.Sprintf("%v", c.Value))
	case "in":
		if arr, ok := c.Value.([]interface{}); ok {
			valStr := fmt.Sprintf("%v", val)
			for _, item := range arr {
				if fmt.Sprintf("%v", item) == valStr {
					return true
				}
			}
		}
		return false
	case "exists":
		return val != nil
	}
	return false
}

func (s *PBACService) getPolicies(ctx context.Context, tenantID string) ([]*Policy, error) {
	s.cache.mu.RLock()
	if policies, ok := s.cache.policies[tenantID]; ok {
		if loaded, ok := s.cache.loaded[tenantID]; ok && time.Since(loaded) < s.cache.ttl {
			s.cache.mu.RUnlock()
			return policies, nil
		}
	}
	s.cache.mu.RUnlock()

	policies, err := s.repo.ListPolicies(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	s.cache.mu.Lock()
	s.cache.policies[tenantID] = policies
	s.cache.loaded[tenantID] = time.Now()
	s.cache.mu.Unlock()

	return policies, nil
}

func (s *PBACService) processDecisionLogs() {
	for range s.decisionCh {
		// Process decision logs for analytics
	}
}

// CRUD Handlers
type PBACHandler struct {
	service *PBACService
}

func NewPBACHandler(service *PBACService) *PBACHandler {
	return &PBACHandler{service: service}
}

func (h *PBACHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/access/evaluate", h.Evaluate)
	mux.HandleFunc("GET /api/v1/policies", h.ListPolicies)
	mux.HandleFunc("POST /api/v1/policies", h.CreatePolicy)
	mux.HandleFunc("GET /api/v1/policies/{id}", h.GetPolicy)
	mux.HandleFunc("PUT /api/v1/policies/{id}", h.UpdatePolicy)
	mux.HandleFunc("DELETE /api/v1/policies/{id}", h.DeletePolicy)
	mux.HandleFunc("GET /api/v1/roles", h.ListRoles)
	mux.HandleFunc("POST /api/v1/roles", h.CreateRole)
	mux.HandleFunc("PUT /api/v1/roles/{id}", h.UpdateRole)
	mux.HandleFunc("DELETE /api/v1/roles/{id}", h.DeleteRole)
	mux.HandleFunc("POST /api/v1/roles/{id}/assign", h.AssignRole)
	mux.HandleFunc("POST /api/v1/roles/{id}/revoke", h.RevokeRole)
}

func (h *PBACHandler) Evaluate(w http.ResponseWriter, r *http.Request) {
	var req AccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = r.Header.Get("X-Tenant-ID")
	}
	decision, err := h.service.Evaluate(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decision)
}

func (h *PBACHandler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank"
	}
	policies, err := h.service.repo.ListPolicies(r.Context(), tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(policies)
}

func (h *PBACHandler) CreatePolicy(w http.ResponseWriter, r *http.Request) {
	var p Policy
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now().UTC()
	p.UpdatedAt = p.CreatedAt
	p.Version = 1
	if err := h.service.repo.CreatePolicy(r.Context(), &p); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func (h *PBACHandler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.service.repo.GetPolicy(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *PBACHandler) UpdatePolicy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p Policy
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	p.ID = id
	p.UpdatedAt = time.Now().UTC()
	p.Version++
	if err := h.service.repo.UpdatePolicy(r.Context(), &p); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *PBACHandler) DeletePolicy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.service.repo.DeletePolicy(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PBACHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank"
	}
	roles, err := h.service.repo.ListRoles(r.Context(), tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

func (h *PBACHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var role Role
	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	role.ID = uuid.New().String()
	if err := h.service.repo.CreateRole(r.Context(), &role); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(role)
}

func (h *PBACHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var role Role
	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	role.ID = id
	if err := h.service.repo.UpdateRole(r.Context(), &role); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(role)
}

func (h *PBACHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.service.repo.DeleteRole(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PBACHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	roleID := r.PathValue("id")
	var req struct {
		UserID   string `json:"user_id"`
		TenantID string `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.service.repo.AssignRole(r.Context(), req.TenantID, req.UserID, roleID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PBACHandler) RevokeRole(w http.ResponseWriter, r *http.Request) {
	roleID := r.PathValue("id")
	var req struct {
		UserID   string `json:"user_id"`
		TenantID string `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.service.repo.RevokeRole(r.Context(), req.TenantID, req.UserID, roleID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SeedDefaultPolicies creates the default PBAC policies for a new tenant
func SeedDefaultPolicies() []*Policy {
	return []*Policy{
		{
			ID: "pol-admin-full-access", Name: "Admin Full Access", Priority: 100,
			Effect: EffectAllow,
			Subjects: []SubjectMatcher{{Type: "user", Attributes: map[string]string{"role": "admin"}}},
			Resources: []ResourceMatcher{{Type: "*", Pattern: ".*"}},
			Actions: []string{"*"},
			Enabled: true,
		},
		{
			ID: "pol-operator-transactions", Name: "Operator Transaction Access", Priority: 50,
			Effect: EffectAllow,
			Subjects: []SubjectMatcher{{Type: "user", Attributes: map[string]string{"role": "operator"}}},
			Resources: []ResourceMatcher{{Type: "transaction", Pattern: ".*"}, {Type: "customer", Pattern: ".*"}},
			Actions: []string{"read", "create", "update"},
			Enabled: true,
		},
		{
			ID: "pol-viewer-readonly", Name: "Viewer Read Only", Priority: 30,
			Effect: EffectAllow,
			Subjects: []SubjectMatcher{{Type: "user", Attributes: map[string]string{"role": "viewer"}}},
			Resources: []ResourceMatcher{{Type: "*", Pattern: ".*"}},
			Actions: []string{"read", "list"},
			Enabled: true,
		},
		{
			ID: "pol-deny-financial-outside-hours", Name: "Deny Financial Ops Outside Business Hours", Priority: 200,
			Effect: EffectDeny,
			Subjects: []SubjectMatcher{{Type: "user", Attributes: map[string]string{"role": "operator"}}},
			Resources: []ResourceMatcher{{Type: "transaction", Pattern: ".*"}, {Type: "transfer", Pattern: ".*"}},
			Actions: []string{"create", "approve"},
			Conditions: []Condition{
				{Attribute: "environment.business_hours", Operator: "equals", Value: false},
			},
			Enabled: true,
		},
		{
			ID: "pol-agent-field-access", Name: "Agent Field Operations", Priority: 40,
			Effect: EffectAllow,
			Subjects: []SubjectMatcher{{Type: "user", Attributes: map[string]string{"role": "agent"}}},
			Resources: []ResourceMatcher{
				{Type: "customer", Pattern: ".*"},
				{Type: "transaction", Pattern: "cash_.*"},
			},
			Actions: []string{"read", "create"},
			Conditions: []Condition{
				{Attribute: "context.channel", Operator: "in", Value: []interface{}{"agent_banking", "ussd", "mobile"}},
			},
			Enabled: true,
		},
		{
			ID: "pol-deny-delete-financial", Name: "Deny Delete on Financial Records", Priority: 999,
			Effect: EffectDeny,
			Subjects: []SubjectMatcher{{Type: "*"}},
			Resources: []ResourceMatcher{{Type: "transaction", Pattern: ".*"}, {Type: "transfer", Pattern: ".*"}, {Type: "ledger", Pattern: ".*"}},
			Actions: []string{"delete"},
			Enabled: true,
		},
	}
}

func SeedDefaultRoles() []*Role {
	return []*Role{
		{ID: "role-super-admin", Name: "Super Administrator", Permissions: []string{"*"}, IsSystem: true},
		{ID: "role-tenant-admin", Name: "Tenant Administrator", Permissions: []string{"tenant:*", "users:*", "roles:*", "policies:*", "settings:*"}, IsSystem: true},
		{ID: "role-operator", Name: "Operations Officer", Permissions: []string{"customers:read", "customers:write", "transactions:read", "transactions:create", "agents:read"}, IsSystem: true},
		{ID: "role-teller", Name: "Bank Teller", Permissions: []string{"customers:read", "transactions:read", "transactions:create", "cash:*"}, IsSystem: true},
		{ID: "role-agent", Name: "Field Agent", Permissions: []string{"customers:read", "customers:create", "transactions:read", "transactions:create", "kyc:create"}, IsSystem: true},
		{ID: "role-compliance", Name: "Compliance Officer", Permissions: []string{"*:read", "kyc:*", "sanctions:*", "audit:read", "reports:*"}, IsSystem: true},
		{ID: "role-analyst", Name: "Business Analyst", Permissions: []string{"*:read", "analytics:*", "reports:read", "dashboards:*"}, IsSystem: true},
		{ID: "role-viewer", Name: "Read-Only Viewer", Permissions: []string{"*:read"}, IsSystem: true},
	}
}
